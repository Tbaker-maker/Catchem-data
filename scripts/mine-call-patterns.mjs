// Nightly: mine winning-call conditions + crowd-vs-data angles (script only, no AI).
// Private first under data/private/call-patterns/. Holdout + n≥20 gate via
// evaluatePatterns(). Only angles that pass write neutral lines to
// data/derived/crowd-attention.json (no advice words, no creator names).
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { loadLongHistoryPriceBook } from "./lib/tcgci-score.mjs";
import { isBanned } from "./lib/youtube.mjs";
import {
  attachConditions,
  minePatterns,
  patternsToIdeas,
  crowdClusters,
  crowdVsData,
  prototypeCrowdReads,
  crowdIdeas,
  SOURCE,
  MIN_N,
} from "./lib/call-patterns.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

async function loadContext(root, priceOn, bookSeries) {
  const sealed = await J(join(root, "data/sealed-products.json"), []);
  const catalog = await J(join(root, "data/catalog/tcgcsv-latest.json"), {});
  const sets = await J(join(root, "research/assets/public/sets.json"), { sets: [] });
  const rot = await J(join(root, "research/assets/public/rotation-status.json"), { sets: [] });
  const pulls = await J(join(root, "data/pull-rates.json"), { rows: [] });
  const listings = await J(join(root, "research/assets/public/listings-counted.json"), { products: [] });

  const setBySlug = new Map((sets.sets || []).map((s) => [s.slug, s]));
  const setByName = new Map((sets.sets || []).map((s) => [String(s.name || "").toLowerCase(), s]));
  const rotBySet = new Map((rot.sets || []).map((s) => [s.slug, s]));

  const metaByPid = new Map();
  for (const s of sealed) {
    const pid = Number(s.tcgPlayerId || s.tcgplayerProductId);
    if (!pid) continue;
    const setSlug = s.setId || null;
    const set = setBySlug.get(setSlug) || setByName.get(String(s.set || "").toLowerCase());
    metaByPid.set(pid, {
      id: s.id,
      name: s.name,
      kind: "sealed",
      subtype: s.subtype || "sealed",
      setId: s.setId,
      setSlug: set?.slug || setSlug,
      set: s.set,
      release: set?.release || null,
      groupId: s.groupId,
    });
  }
  for (const it of catalog.items || []) {
    const pid = Number(it.tcgplayerProductId || it.id);
    if (!pid || metaByPid.has(pid)) continue;
    const setName = String(it.set || "").replace(/^(SV|SWSH|SM|ME|XY|BW)[^:]*:\s*/i, "").trim();
    const set = setByName.get(setName.toLowerCase()) || setByName.get(String(it.set || "").toLowerCase());
    metaByPid.set(pid, {
      id: `tcgcsv-${pid}`,
      name: it.name,
      kind: it.kind || "single",
      subtype: it.kind === "sealed" ? "sealed" : "single",
      setId: set?.slug || null,
      setSlug: set?.slug || null,
      set: it.set,
      release: set?.release || null,
      groupId: it.groupId,
      rarity: it.rarity,
    });
  }

  // Pull-rate band index by setSlug (first rarity row's band via percentile buckets)
  const pullBySet = new Map();
  const bySet = new Map();
  for (const r of pulls.rows || []) {
    if (!r.setSlug || !(r.pct > 0)) continue;
    if (!bySet.has(r.setSlug)) bySet.set(r.setSlug, []);
    bySet.get(r.setSlug).push(r.pct);
  }
  const allMed = [...bySet.values()].map((xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]);
  allMed.sort((a, b) => a - b);
  for (const [slug, xs] of bySet) {
    const med = xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    let band = 0;
    if (allMed.length >= 4) {
      const q1 = allMed[Math.floor(allMed.length * 0.25)];
      const q2 = allMed[Math.floor(allMed.length * 0.5)];
      const q3 = allMed[Math.floor(allMed.length * 0.75)];
      band = med <= q1 ? 0 : med <= q2 ? 1 : med <= q3 ? 2 : 3;
    }
    pullBySet.set(slug, { band, med });
  }

  const listingsById = new Map();
  const listingRows = Array.isArray(listings.products) ? listings.products : Object.values(listings.products || {});
  for (const p of listingRows) {
    if (p?.id != null) listingsById.set(p.id, p.listingsCounted?.n ?? p.n ?? null);
  }

  // Sealed vs singles value ratio proxy: count of sealed pids vs single pids per set in meta
  const sealedRatioBySet = new Map();
  const counts = new Map();
  for (const m of metaByPid.values()) {
    if (!m.setSlug) continue;
    const c = counts.get(m.setSlug) || { sealed: 0, single: 0 };
    if (m.kind === "sealed" || m.subtype !== "single") c.sealed++;
    else c.single++;
    counts.set(m.setSlug, c);
  }
  for (const [slug, c] of counts) {
    if (c.single > 0) sealedRatioBySet.set(slug, c.sealed / c.single);
  }

  return {
    metaByPid,
    rotBySet,
    pullBySet,
    listingsById,
    sealedRatioBySet,
    priceOn,
    seriesByPid: bookSeries,
  };
}

// Build pid->Map(day,price) from the long-history book loader internals by probing days.
async function seriesFromBook(root) {
  const { priceOn, size } = await loadLongHistoryPriceBook(root);
  // Reconstruct series by reading sealed market files + daily (same as book)
  const series = new Map();
  const put = (pid, day, v) => {
    if (!(pid > 0) || !(v > 0)) return;
    if (!series.has(pid)) series.set(pid, new Map());
    series.get(pid).set(day, v);
  };
  try {
    for (const f of (await readdir(join(root, "data/history/tcgcsv-daily"))).sort()) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
      const day = f.slice(0, 10);
      const doc = JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily", f), "utf8"));
      for (const r of doc.prices || []) put(Number(r.id), day, Number(r.market));
    }
  } catch {}
  for (const dir of ["data/history/tcgplayer-market", "data/history/ppt-sealed-private", "data/history/ppt-sealed"]) {
    let names = [];
    try { names = await readdir(join(root, dir)); } catch { continue; }
    for (const f of names) {
      if (!f.endsWith(".json") || ["mapping.json", "coverage.json", "manifest.json"].includes(f)) continue;
      try {
        const doc = JSON.parse(await readFile(join(root, dir, f), "utf8"));
        const pid = Number(doc.tcgplayerProductId);
        for (const p of doc.points || []) put(pid, p.date, Number(p.market));
      } catch {}
    }
  }
  return { priceOn, series, size };
}

export function evaluatePatterns(mined, { minN = MIN_N } = {}) {
  // Holdout gate: testN≥minN and testRate > baseTest
  const passed = [];
  const failed = [];
  for (const p of mined.patterns || []) {
    const ok = p.testN >= minN && p.testRate != null && mined.baseTest != null && p.testRate > mined.baseTest;
    (ok ? passed : failed).push({ ...p, passedHoldout: ok });
  }
  return { passed, failed, baseTest: mined.baseTest, baseTrain: mined.baseTrain };
}

export function evaluateCrowdAngles(crowd, prototypes, { minN = MIN_N } = {}) {
  const passed = [];
  const failed = [];
  for (const p of crowd.patterns || []) {
    const ok = p.n >= minN && p.lift > 0;
    (ok ? passed : failed).push({ ...p, passedHoldout: ok, angle: "crowd_vs_data" });
  }
  for (const p of prototypes || []) {
    // Prototypes need n≥minN; attention_lag / quiet_climbers etc.
    const ok = (p.n || 0) >= minN;
    (ok ? passed : failed).push({ ...p, passedHoldout: ok, angle: p.kind });
  }
  return { passed, failed };
}

export function publicLines(passedCrowd, { asOf } = {}) {
  const lines = [];
  for (const p of passedCrowd) {
    const text = p.publicWording || p.rule?.wording;
    if (!text || isBanned(text)) continue;
    lines.push({
      id: `crowd:${p.kind || p.angle || "x"}:${p.condition || ""}:${asOf}`,
      kind: p.kind || p.angle || "crowd",
      asOf,
      line: text,
      n: p.n || p.testN || null,
      status: "passed_holdout",
      note: "Neutral data-only. No creator names. Not advice.",
    });
  }
  return lines;
}

export async function runMineCallPatterns({
  root = ROOT,
  token = process.env.PRIVATE_DATA_TOKEN || "",
  now = new Date(),
  store: givenStore = null,
} = {}) {
  const today = now.toISOString().slice(0, 10);
  let store = givenStore;
  let ownsStore = false;
  if (!store) {
    ownsStore = true;
    try { store = await openPrivate({ root, token }); }
    catch (err) {
      console.error(`call-patterns: ${err.message}; using local data/private`);
      store = await openPrivate({ root, token: "" });
    }
  }
  const dir = join(store.dir, "call-patterns");
  await mkdir(dir, { recursive: true });

  const tcgci = await J(join(store.dir, "tcgci/rescored-claims.json"), { claims: [] });
  const yt = await J(join(store.dir, "youtube/claims.json"), { claims: [] });
  const claims = [
    ...(tcgci.claims || []).map((c) => ({ ...c, source: c.source || "tcgci-derived" })),
    ...(yt.claims || []).filter((c) => c.h30 || c.ourVerdict30).map((c) => ({
      ...c,
      source: "youtube",
      ourVerdict30: c.ourVerdict30 || (c.h30?.held === true ? "right" : c.h30?.held === false ? "wrong" : c.h30?.result === "flat" ? "flat" : null),
      topicHints: c.topics || c.topicHints || [],
    })),
  ];

  const { priceOn, series, size } = await seriesFromBook(root);
  const ctx = await loadContext(root, priceOn, series);
  const rows = claims.map((c) => attachConditions(c, ctx)).filter((r) => r.pid && r.date);
  const scored = rows.filter((r) => r.hit != null);

  const mined = minePatterns(scored, { minN: MIN_N });
  const evalPat = evaluatePatterns(mined);

  const clusters = crowdClusters(claims);
  const rowByPidDate = new Map(rows.map((r) => [`${r.pid}|${r.date}`, r]));
  const crowd = crowdVsData(clusters, rowByPidDate, { minN: MIN_N });

  // Attention counts: calls per pid in last 30 days
  const attentionByPid = new Map();
  for (const c of claims) {
    const pid = c.pid ?? c.productId;
    const date = c.date || c.issued;
    if (pid == null || !date) continue;
    if (date < addDaysSafe(today, -30)) continue;
    attentionByPid.set(Number(pid), (attentionByPid.get(Number(pid)) || 0) + 1);
  }
  const prototypes = prototypeCrowdReads({
    clusters, rows, attentionByPid, priceSeries: series, asOf: today,
  });
  const evalCrowd = evaluateCrowdAngles(crowd, prototypes, { minN: MIN_N });

  const ideaPat = patternsToIdeas(evalPat.passed, { asOf: today, now });
  const ideaCrowd = crowdIdeas(evalCrowd.passed.filter((p) => p.angle === "crowd_vs_data" || p.kind === "crowd_vs_data"), evalCrowd.passed.filter((p) => p.angle && p.angle !== "crowd_vs_data"), { asOf: today });

  // Merge into youtube/ideas.json test list (candidates)
  const ideasPath = join(store.dir, "youtube/ideas.json");
  const ideasDoc = await J(ideasPath, { ideas: [] });
  const seen = new Set((ideasDoc.ideas || []).map((i) => i.id));
  let added = 0;
  for (const idea of [...ideaPat, ...ideaCrowd]) {
    if (seen.has(idea.id)) continue;
    ideasDoc.ideas.push(idea);
    seen.add(idea.id);
    added++;
  }
  await mkdir(join(store.dir, "youtube"), { recursive: true });
  await writeFile(ideasPath, JSON.stringify({
    asOf: today,
    private: true,
    note: "Candidate read paths. Weekly audit / self-check tests them. call_pattern and crowd_* from mine-call-patterns.mjs.",
    ideas: ideasDoc.ideas,
  }, null, 1) + "\n");

  const summary = {
    asOf: today,
    generatedAt: now.toISOString(),
    source: SOURCE,
    private: true,
    priceBookSize: size,
    claimsIn: claims.length,
    rows: rows.length,
    scored: scored.length,
    patterns: {
      baseTrain: mined.baseTrain,
      baseTest: mined.baseTest,
      trainN: mined.trainN,
      testN: mined.testN,
      passed: evalPat.passed.length,
      failed: evalPat.failed.length,
      topPassed: evalPat.passed.slice(0, 15),
    },
    crowd: {
      clusters: crowd.clusters,
      baseWrongRate: crowd.baseWrongRate,
      passed: evalCrowd.passed.length,
      failed: evalCrowd.failed.length,
      topPassed: evalCrowd.passed.slice(0, 15),
      prototypes: prototypes.map((p) => ({ kind: p.kind, n: p.n, passedHoldout: (p.n || 0) >= MIN_N })),
    },
    ideasAdded: added,
  };

  await writeFile(join(dir, "rows.json"), JSON.stringify({ asOf: today, private: true, n: rows.length, rows }, null, 1) + "\n");
  await writeFile(join(dir, "patterns.json"), JSON.stringify({ asOf: today, private: true, mined: { ...mined, patterns: mined.patterns.slice(0, 80) }, evaluation: evalPat }, null, 1) + "\n");
  await writeFile(join(dir, "crowd.json"), JSON.stringify({
    asOf: today, private: true, crowd, prototypes, evaluation: evalCrowd,
    clusters: clusters.slice(0, 100),
  }, null, 1) + "\n");
  await writeFile(join(dir, "summary.json"), JSON.stringify(summary, null, 1) + "\n");

  // Self-check ledger for patterns (private scores going forward)
  const scores = {
    asOf: today,
    private: true,
    note: "Holdout results for call-pattern and crowd angles. Promote to public only when passedHoldout.",
    minN: MIN_N,
    patternPassed: evalPat.passed,
    patternFailed: evalPat.failed.slice(0, 40),
    crowdPassed: evalCrowd.passed,
    crowdFailed: evalCrowd.failed,
  };
  await writeFile(join(dir, "self-check.json"), JSON.stringify(scores, null, 1) + "\n");

  // Public-safe derived file: only PASSED crowd angles (neutral lines)
  const pubLines = publicLines(evalCrowd.passed, { asOf: today });
  await mkdir(join(root, "data/derived"), { recursive: true });
  await writeFile(join(root, "data/derived/crowd-attention.json"), JSON.stringify({
    asOf: today,
    generatedAt: now.toISOString(),
    note: "Neutral data-only lines from crowd angles that passed n≥20 holdout. No creator names. Not advice. Pattern formulas stay private.",
    count: pubLines.length,
    lines: pubLines,
  }, null, 1) + "\n");

  const paths = [
    "call-patterns/rows.json",
    "call-patterns/patterns.json",
    "call-patterns/crowd.json",
    "call-patterns/summary.json",
    "call-patterns/self-check.json",
    "youtube/ideas.json",
  ];
  let pushed = { pushed: false, reason: "store owned by caller" };
  if (ownsStore) {
    pushed = await store.close(paths, `Call patterns ${today}: ${evalPat.passed.length} patterns, ${evalCrowd.passed.length} crowd angles passed`);
  }

  return {
    status: "ok",
    asOf: today,
    scored: scored.length,
    patternsPassed: evalPat.passed.length,
    patternsFailed: evalPat.failed.length,
    crowdPassed: evalCrowd.passed.length,
    crowdFailed: evalCrowd.failed.length,
    publicLines: pubLines.length,
    ideasAdded: added,
    topPatterns: evalPat.passed.slice(0, 10),
    topCrowd: evalCrowd.passed.slice(0, 10),
    privatePushed: Boolean(pushed?.pushed),
    paths,
    summary,
  };
}

function addDaysSafe(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

if (process.argv[1] && process.argv[1].endsWith("mine-call-patterns.mjs")) {
  const d = await runMineCallPatterns();
  console.log(JSON.stringify({
    callPatterns: {
      status: d.status, scored: d.scored,
      patternsPassed: d.patternsPassed, crowdPassed: d.crowdPassed,
      publicLines: d.publicLines, ideasAdded: d.ideasAdded,
    },
  }, null, 2));
}
