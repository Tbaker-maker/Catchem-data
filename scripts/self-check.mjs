// Nightly self-check and bounded Card Rating tuner. Runs from write-track-record.mjs
// (the nightly step that already carries PRIVATE_DATA_TOKEN). Script only, no AI.
//
// Private (catchem-data-private, or gitignored data/private/ without a token):
//   data/private/self-check/ledger.jsonl.gz  past reads and rating verdicts with ship price
//   data/private/self-check/scores.json      held rates at 7, 30 and 90 days per type
//   data/private/self-check/tuner-state.json weights versions and history (revert path)
//   data/private/self-check/tuner-log.jsonl  every tuner decision with its evidence
// Public (committed by the nightly with data/derived/):
//   private self-check/rating-weights.json   the tuned weights. Never published.
//
// CLI: node scripts/self-check.mjs [--revert=base|<version>] [--freeze] [--unfreeze] [--no-tune]
import { readFile, readdir, writeFile, mkdir, appendFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { snapshotNight, scoreLedger, summarize, pruneLedger, HORIZONS } from "./lib/self-check.mjs";
import { tuneNight, initialState, revertTo, TUNER } from "./lib/rating-tuner.mjs";
import { sameWeights } from "./lib/rating-weights.mjs";
import { validRatingWeights } from "./lib/card-rating.mjs";
import { openPrivate } from "./lib/private-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = "research/assets/public";

export async function loadPriceBook(root) {
  const book = new Map();
  const dir = join(root, "data/history/tcgcsv-daily");
  for (const f of (await readdir(dir)).sort()) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
    const day = f.slice(0, 10);
    const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
    for (const r of doc.prices || []) {
      const v = Number(r.market);
      if (!(v > 0) || !r.id) continue;
      let m = book.get(Number(r.id));
      if (!m) book.set(Number(r.id), (m = new Map()));
      if (!m.has(day)) m.set(day, v); // first printing listed wins, same as the catalog
    }
  }
  const cache = new Map();
  // Median change of every product priced on both days. The read baseline.
  const marketChange = (d1, d2) => {
    const k = `${d1}|${d2}`;
    if (cache.has(k)) return cache.get(k);
    const ch = [];
    for (const m of book.values()) { const a = m.get(d1), b = m.get(d2); if (a > 0 && b > 0) ch.push(b / a - 1); }
    ch.sort((x, y) => x - y);
    const v = ch.length ? (ch.length % 2 ? ch[ch.length >> 1] : (ch[(ch.length >> 1) - 1] + ch[ch.length >> 1]) / 2) : null;
    cache.set(k, v);
    return v;
  };
  return { priceOn: (pid, day) => book.get(Number(pid))?.get(day) ?? null, marketChange };
}

async function readJson(p, d = null) { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } }

export async function loadRatingRows(root) {
  const rows = [];
  const dir = join(root, PUB, "feed/rating");
  for (const f of await readdir(dir).catch(() => [])) if (/^\d+\.json$/.test(f)) rows.push(...((await readJson(join(dir, f), {}))?.rows || []));
  return rows;
}

export async function readLedger(dir) {
  try {
    return gunzipSync(await readFile(join(dir, "ledger.jsonl.gz"))).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

export async function runSelfCheck({ root = ROOT, token = process.env.PRIVATE_DATA_TOKEN || "", argv = process.argv.slice(2), now = new Date() } = {}) {
  const reads = await readJson(join(root, PUB, "reads.json"), {});
  const today = String(reads?.asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("reads.json has no asOf");
  let store;
  try { store = await openPrivate({ root, token }); }
  catch (err) { console.error(`self-check: ${err.message}; using local data/private`); store = await openPrivate({ root, token: "" }); }
  const dir = join(store.dir, "self-check");
  await mkdir(dir, { recursive: true });

  // Base weights come from the private model spec; tuned weights stay private too.
  const spec = await readJson(join(store.dir, "model-spec/spec.json"), null);
  const BASE = validRatingWeights(spec?.cardRating?.weights) ? { ...spec.cardRating.weights } : null;
  const weightsPath = join(dir, "rating-weights.json");
  const pubWeights = await readJson(weightsPath, null);
  const wv = BASE && pubWeights && sameWeights(pubWeights.base, BASE) ? pubWeights.version || "base" : "base";

  const { priceOn, marketChange } = await loadPriceBook(root);
  let ledger = (await readLedger(dir)).filter((e) => e.date !== today);
  const night = snapshotNight({ asOf: today, reads: reads.reads || [], ratingRows: await loadRatingRows(root), priceOn, weightsVersion: wv });
  ledger.push(...night);
  scoreLedger(ledger, priceOn, today, marketChange);
  ledger = pruneLedger(ledger, today);
  const summary = summarize(ledger);
  const scores = {
    asOf: today, generatedAt: now.toISOString(), private: true,
    note: "Private. Held = price on the claimed side after h days (reads), or beat/lagged its rating group median (rating). Prices: TCGplayer market daily files. h scores on day h, else the first priced day up to h+3.",
    horizons: HORIZONS, ledgerRows: ledger.length, loggedTonight: night.length, rows: summary,
  };

  // Tuner
  let state = await readJson(join(dir, "tuner-state.json"), null);
  const log = [];
  if (!BASE) log.push({ date: today, action: "skip", reason: "no private model spec" });
  else if (!state || !sameWeights(state.base, BASE)) {
    log.push({ date: today, action: "seed", reason: state ? "base weights changed" : "first run", base: { ...BASE } });
    state = initialState(BASE);
  }
  const rev = argv.find((a) => a.startsWith("--revert="));
  if (rev && state) { const to = rev.split("=")[1]; state = revertTo(state, to, today); log.push({ date: today, action: "manual-revert", to }); }
  if (state && argv.includes("--freeze")) { state.frozen = true; log.push({ date: today, action: "freeze" }); }
  if (state && argv.includes("--unfreeze")) { state.frozen = false; log.push({ date: today, action: "unfreeze" }); }
  if (BASE && !rev && !argv.includes("--no-tune") && !state.tunedOn?.includes?.(today)) {
    const out = tuneNight(state, ledger, today);
    state = out.state; log.push(...out.log);
    state.tunedOn = today;
  }

  await writeFile(join(dir, "ledger.jsonl.gz"), gzipSync(ledger.map((e) => JSON.stringify(e)).join("\n") + "\n"));
  await writeFile(join(dir, "scores.json"), JSON.stringify(scores, null, 1) + "\n");
  if (state) await writeFile(join(dir, "tuner-state.json"), JSON.stringify(state, null, 1) + "\n");
  for (const l of log) await appendFile(join(dir, "tuner-log.jsonl"), JSON.stringify(l) + "\n");
  if (state) await writeFile(weightsPath, JSON.stringify({
    version: state.version, since: state.since || null, frozen: Boolean(state.frozen), base: state.base, weights: state.weights,
    limits: { perFactorPerNight: TUNER.stepPoints, maxPairsPerNight: TUNER.maxPairsPerNight, cooldownDays: TUNER.cooldownDays, floorShare: TUNER.floorShare, ceilShare: TUNER.ceilShare, horizonDays: TUNER.horizon, minRows: TUNER.minRows },
    note: "Card Rating factor weights used by the nightly build. Set by the self-check tuner inside the limits above. Revert: node scripts/self-check.mjs --revert=base (or a version).",
  }, null, 1) + "\n");
  
  // Call-pattern / crowd-angle candidates: refresh scores from private rows when present.
  let patternCheck = null;
  try {
    const { scorePatternCandidates, attachConditions } = await import("./lib/call-patterns.mjs");
    const { loadLongHistoryPriceBook } = await import("./lib/tcgci-score.mjs");
    const ideasDoc = await readJson(join(store.dir, "youtube/ideas.json"), { ideas: [] });
    const patternIdeas = (ideasDoc.ideas || []).filter((i) => i.source === "call-patterns" || i.kind === "call_pattern" || String(i.kind || "").startsWith("crowd") || ["quiet_climbers","hype_fade","attention_lag","consensus_flips","crowd_ignored_rarities","crowd_vs_data"].includes(i.kind));
    const tcgci = await readJson(join(store.dir, "tcgci/rescored-claims.json"), { claims: [] });
    if (patternIdeas.length && (tcgci.claims || []).length) {
      const { priceOn } = await loadLongHistoryPriceBook(root);
      const rows = (tcgci.claims || []).map((c) => attachConditions(c, { priceOn })).filter((r) => r.hit != null);
      patternCheck = scorePatternCandidates(patternIdeas, rows);
      await mkdir(join(store.dir, "call-patterns"), { recursive: true });
      await writeFile(join(store.dir, "call-patterns/self-check.json"), JSON.stringify({ asOf: today, private: true, ...patternCheck, note: "Refreshed by self-check. Promote to public only when passedHoldout." }, null, 1) + "\n");
    }
  } catch (err) { console.error(`pattern-check skipped: ${err.message}`); }

  const pushed = await store.close(["self-check/ledger.jsonl.gz", "self-check/scores.json", "self-check/tuner-state.json", "self-check/tuner-log.jsonl", "self-check/rating-weights.json", "call-patterns/self-check.json"], `Self-check ${today}`);
  return { today, loggedTonight: night.length, ledgerRows: ledger.length, patternCheck, scored: summary.reduce((a, r) => a + r.scored7 + r.scored30 + r.scored90, 0), tuner: log.map((l) => l.action), weightsVersion: state.version, pushed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await runSelfCheck()));
}
