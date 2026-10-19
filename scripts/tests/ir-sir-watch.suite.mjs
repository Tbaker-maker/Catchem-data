import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { irKind, fullSeries, cardFacts, peerStats, signalFlags, score, readLines, clean, listingDirection, upTo, windowMean } from "../lib/ir-sir-watch.mjs";
import { evaluate, summarize, provenWeights } from "../lib/ir-sir-backtest.mjs";
import { newCalls, checkOutcomes, summarize as callSummary, priceOn } from "../log-stage-calls.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };
const day = (i) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const line = (n, f) => Array.from({ length: n }, (_, i) => [day(i), f(i)]);

export async function run() {
  fail = 0;
  t("IR and SIR by rarity only", irKind({ kind: "single", rarity: "Illustration Rare" }) === "IR" && irKind({ kind: "single", rarity: "Special Illustration Rare" }) === "SIR" && irKind({ kind: "single", rarity: "Double Rare" }) === "" && irKind({ kind: "sealed", rarity: "Illustration Rare" }) === "");
  const s = fullSeries({ fillHist: [["2026-01-02", 5]], hist: [["2026-01-03", 6]] }, "20454:4");
  t("long, fill and nightly merge in date order", s.length === 3 && s[0][1] === 4 && s[2][1] === 6);
  const pts = line(100, (i) => 10 + i * 0.1);
  t("cut at the anchor drops later prices", upTo(pts, day(10)).length === 11);
  t("window mean needs enough points", windowMean(pts, day(99), 7, 3) > 0 && windowMean(pts.slice(0, 2), day(1), 90, 6) === null);
  const f = cardFacts(pts, day(99), null);
  t("facts carry dated changes and baselines", f.price === pts[99][1] && f.ch30.pct > 0 && f.vs30 > 0 && f.high90.date === day(99));
  const cards = ["a", "b", "c", "d", "e"].map((id, i) => ({ id, name: `Fidough - ${i}/1`, setSlug: "x", kind: "IR", facts: { price: 2 + i, ch30: { pct: -i * 10 } }, age: 400, rotDays: null }));
  const peers = peerStats(cards).get("x|IR");
  t("peer median by set and kind", peers.n === 5 && peers.ch30 === -20);
  const rules = { signals: { laggard30: { gapPct: 10, minPeers: 4 }, pastOneYear: { days: 365 }, cheapNonChase: { rankMax: 0.34, popMax: 0, minPeers: 4 } }, proven: { laggard30: { weight: 10 } } };
  const fl = signalFlags(cards[4], peers, rules);
  t("flags fire from private cutoffs", fl.laggard30 && fl.pastOneYear && !fl.cheapNonChase);
  t("no rules, no flags", Object.keys(signalFlags(cards[4], peers, {})).length === 0);
  t("only proven signals score", score(fl, rules).score === 10 && score(fl, rules).used.join() === "laggard30");
  t("listings direction compares 7 nights back", listingDirection([{ date: "2026-10-12", n: 30 }, { date: "2026-10-19", n: 24 }], "2026-10-19").pct === -20);
  const c = { name: "N's Reshiram - 167/159", set: "SV09: Journey Together", num: "167/159", kind: "IR", release: "2025-03-28", age: 570, facts: { price: 14.23, date: "2026-10-19", ch7: { pct: 11.1, from: { price: 12.81, date: "2026-10-12" } }, ch30: { pct: -4.5 }, vs30: -0.2, vs90: -12.5, stage: { word: "Reversing", dir: "up" } }, listings: { n: 20, date: "2026-10-19", from: { n: 25, date: "2026-10-12" } } };
  const lines = readLines(c, { n: 11, ch30: -15.3 });
  t("read names the card, price and date", /^N's Reshiram \(Journey Together\) 167\/159, Illustration Rare: \$14\.23 on Oct 19, up 11% from \$12\.81 on Oct 12\.$/.test(lines[0]));
  t("read says listings gone, never sold", lines.some((l) => /5 listings gone/.test(l)) && lines.every((l) => !/\bsold\b|\bsales?\b/i.test(l)));
  t("read lines pass the copy rules", lines.every(clean));
  t("copy check blocks dashes and advice", !clean("Up 5% \u2014 nice") && !clean("Load up before the move"));
  const bcards = [{ id: "p", kind: "IR", setSlug: "x", release: "2025-01-01", name: "A", pts: line(200, (i) => 10 + i) }, { id: "q", kind: "IR", setSlug: "x", release: "2025-01-01", name: "B", pts: line(200, () => 10) }];
  const rows = evaluate(bcards, { rules: { signals: { pastOneYear: { days: 1 } } }, rot: {}, from: day(40), to: day(150), step: 14, horizon: 30, split: day(100) });
  t("backtest never reads past the anchor for facts", rows.length > 0 && rows.every((r) => r.a <= day(150)));
  t("backtest beat is against the kind median", rows.filter((r) => r.id === "p").every((r) => r.beat) && rows.filter((r) => r.id === "q").every((r) => !r.beat));
  const sum = summarize(rows, { minN: 1, minLift: 0.5 });
  t("unproven when lift is short", !sum.signals.pastOneYear.proven && Object.keys(provenWeights(sum)).length === 0);

  const chips = { asOf: "2026-10-19", byId: { r1: { sku: "s1", name: "N's Reshiram #167/159", tiles: { price: { stage: { word: "Reversing", dir: "up", days: 7, date: "2026-10-19" } } } }, r2: { sku: "s1", name: "dup", tiles: { price: { stage: { word: "Reversing", dir: "up", days: 7, date: "2026-10-19" } } } } } };
  const series = { s1: [["2026-10-19", 14.23], ["2026-10-26", 15], ["2026-11-03", 13], ["2026-11-18", 16]] };
  const add = newCalls(chips, { calls: [] }, { seriesOf: (k) => series[k], listingOf: () => ({ listingsCounted: 9, date: "2026-10-19" }) });
  t("one call per product, stage and direction", add.length === 1 && add[0].price === 14.23 && add[0].listings.n === 9 && add[0].status === "open");
  t("a repeat inside 7 days is not logged again", newCalls(chips, { calls: add }, { seriesOf: (k) => series[k], listingOf: () => null }).length === 0);
  checkOutcomes(add, { seriesOf: (k) => series[k], today: "2026-11-20" });
  t("day 7, 14 and 30 scored on the called side", add[0].outcomes.d7.hit === true && add[0].outcomes.d14.hit === false && add[0].outcomes.d30.hit === true && add[0].status === "closed");
  t("summary counts hits", callSummary(add)["Reversing up"].hits7 === 1);
  t("price on day uses the slack window", priceOn(series.s1, "2026-10-24", 3)[0] === "2026-10-26" && priceOn(series.s1, "2026-10-20", 3) === null);

  const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/ir-sir.json"), "utf8").catch(() => "null"));
  if (doc) {
    const txt = JSON.stringify(doc);
    t("public file has IR and SIR rows with dated prices", doc.rows.length > 100 && doc.rows.every((r) => ["IR", "SIR"].includes(r.kind) && r.price.price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.price.date)));
    t("no score, weight or cutoff is published", !/"(score|weight|weights|_score|proven|gapPct|rankMax|popMax|minLift)"/.test(txt));
    t("every public read passes the copy rules", doc.reads.every((r) => [r.headline, ...r.lines].every(clean)));
  }
  return fail;
}
if (import.meta.url === `file://${process.argv[1]}`) run().then((n) => process.exit(n ? 1 : 0));
