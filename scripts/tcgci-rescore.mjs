// Rescore private TCGCI calls with Catch'em's method and write tcgci-derived
// scorecards / creatorWeights. Runs from tcgci-learn after a successful fetch,
// or standalone: node scripts/tcgci-rescore.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { parseLedger } from "./lib/tcgci.mjs";
import {
  TCGCI_SOURCE,
  loadLongHistoryPriceBook,
  rescoreCalls,
  compareMethods,
  buildScorecards,
  summarizeRescore,
  buildCreatorCatalogue,
} from "./lib/tcgci-score.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

export async function runTcgciRescore({
  root = ROOT,
  token = process.env.PRIVATE_DATA_TOKEN || "",
  now = new Date(),
  store: givenStore = null,
  callsDoc = null,
} = {}) {
  const today = now.toISOString().slice(0, 10);
  let store = givenStore;
  let ownsStore = false;
  if (!store) {
    ownsStore = true;
    try { store = await openPrivate({ root, token }); }
    catch (err) {
      console.error(`tcgci-rescore: ${err.message}; using local data/private`);
      store = await openPrivate({ root, token: "" });
    }
  }
  const dir = join(store.dir, "tcgci");
  await mkdir(dir, { recursive: true });

  let doc = callsDoc;
  if (!doc) doc = await J(join(dir, "calls.json"), null);
  if (!doc) {
    // Allow a raw ledger shape too
    return { status: "skipped", reason: "no tcgci calls on file", asOf: today, source: TCGCI_SOURCE };
  }
  const parsed = Array.isArray(doc.calls) && doc.calls[0]?.theirVerdict != null
    ? { calls: doc.calls, updated: doc.updated }
    : parseLedger(doc);
  if (!parsed.calls?.length) {
    return { status: "skipped", reason: "empty calls", asOf: today, source: TCGCI_SOURCE };
  }

  const { priceOn, marketChange, size } = await loadLongHistoryPriceBook(root);
  const { claims, skipped } = rescoreCalls(parsed.calls, { priceOn, marketChange, today });
  const compare = compareMethods(claims);
  const scorecards = buildScorecards(claims, compare);
  const summary = summarizeRescore({ claims, skipped, compare, scorecards, today, priceBookSize: size });

  // Slim private claims: no TCGCI prose (already omitted upstream); keep scores.
  const slimClaims = claims.map((c) => ({
    id: c.id,
    source: TCGCI_SOURCE,
    tcgciId: c.tcgciId,
    videoId: c.videoId,
    channel: c.channel,
    date: c.date,
    rating: c.rating,
    hold: c.hold,
    dir: c.hold ? 0 : c.dir,
    horizon: c.horizon,
    target: c.target,
    pid: c.pid,
    item: c.item,
    set: c.set,
    topicHints: c.topicHints,
    theirVerdict: c.theirVerdict,
    ourVerdict7: c.ourVerdict7,
    ourVerdict30: c.ourVerdict30,
    ourVerdict90: c.ourVerdict90,
    h7: c.h7 || null,
    h30: c.h30 || null,
    h90: c.h90 || null,
    price: c.price || null,
    unscored: c.unscored || null,
  }));

  await writeFile(join(dir, "rescored-claims.json"), JSON.stringify({
    asOf: today,
    fetchedAt: now.toISOString(),
    source: TCGCI_SOURCE,
    private: true,
    note: "Catch'em rescore of TCGCI calls. Never publish. Not mixed into youtube/claims.json.",
    method: "7/30/90 days, 3% band, market-relative, stated horizon (long/short/text).",
    priceBookSize: size,
    skipped,
    claims: slimClaims,
  }, null, 1) + "\n");

  await writeFile(join(dir, "scorecards.json"), JSON.stringify({
    asOf: today,
    fetchedAt: now.toISOString(),
    source: TCGCI_SOURCE,
    private: true,
    note: "Per-creator hit rates under our method vs TCGCI ±5%. Separate from youtube/scores.json.",
    theirBandPct: scorecards.theirBandPct,
    ourBand: scorecards.ourBand,
    compare: summary.compare,
    creators: scorecards.creators,
    ranking: scorecards.ranking,
  }, null, 1) + "\n");

  await writeFile(join(dir, "creator-weights.json"), JSON.stringify({
    asOf: today,
    fetchedAt: now.toISOString(),
    source: TCGCI_SOURCE,
    private: true,
    note: "tcgci-derived weights only. Do not silently blend with youtube/creator-weights.json.",
    rule: "Neutral (1) until 20 scored claims; then 0.5 + held rate, clamped 0.5..1.5.",
    weights: scorecards.weights,
  }, null, 1) + "\n");

  await writeFile(join(dir, "rescore-summary.json"), JSON.stringify(summary, null, 1) + "\n");

  const configChannels = (await J(join(root, "config/youtube-channels.json"), { channels: [] })).channels || [];
  const catalogue = buildCreatorCatalogue({
    calls: parsed.calls, scorecards, configChannels, asOf: today, now,
  });
  await writeFile(join(dir, "creator-catalogue.json"), JSON.stringify(catalogue, null, 1) + "\n");

  // Pointer on the YouTube weights file when present — never overwrites their numbers.
  const ytWeightsPath = join(store.dir, "youtube/creator-weights.json");
  const ytW = await J(ytWeightsPath, null);
  if (ytW && typeof ytW === "object") {
    ytW.otherSources = {
      ...(ytW.otherSources || {}),
      [TCGCI_SOURCE]: {
        path: "data/private/tcgci/creator-weights.json",
        asOf: today,
        note: "Separate source. Not blended into weights above.",
      },
    };
    await writeFile(ytWeightsPath, JSON.stringify(ytW, null, 1) + "\n");
  }

  const paths = [
    "tcgci/rescored-claims.json",
    "tcgci/scorecards.json",
    "tcgci/creator-weights.json",
    "tcgci/rescore-summary.json",
    "tcgci/creator-catalogue.json",
  ];
  if (ytW) paths.push("youtube/creator-weights.json");
  let pushed = { pushed: false, reason: "store owned by caller" };
  if (ownsStore) {
    pushed = await store.close(paths, `TCGCI rescore ${today}: ${claims.length} mapped, ${summary.scored30} scored@30`);
  }
  return { status: "ok", ...summary, privatePushed: Boolean(pushed?.pushed), paths };
}

if (process.argv[1] && process.argv[1].endsWith("tcgci-rescore.mjs")) {
  const d = await runTcgciRescore();
  console.log(JSON.stringify({ tcgciRescore: { status: d.status, claimsMapped: d.claimsMapped, scored30: d.scored30, compare: d.compare } }, null, 2));
}
