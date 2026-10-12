// Self-check, tuner limits, flags and the script research scan.
import { claimOf, snapshotNight, scoreLedger, summarize, addDays } from "../lib/self-check.mjs";
import { tuneNight, initialState, revertTo, validWeights, TUNER } from "../lib/rating-tuner.mjs";
import { sameWeights } from "../lib/rating-weights.mjs";
import { priceMoveFlags, dataGapFlags, staleFlags, readTypeFlags, newSetFlags, releaseFlags } from "../lib/flags.mjs";
import { newsLeads, radarCheck, nameMatch } from "../lib/research-scan.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

  // Claims
  t("high claims up", claimOf({ readKind: "high" }) === 1);
  t("low claims down", claimOf({ readKind: "low" }) === -1);
  t("plain reads its receipt", claimOf({ readKind: "plain", receipt: { from: 10, to: 8 } }) === -1);
  t("backto is not scored", claimOf({ readKind: "backto" }) === 0);
  t("old heating board claims up", claimOf({ kind: "single", type: "heating", changePct: 40 }) === 1);

  // Scoring uses the price file, exact day or up to 3 days later, never the headline.
  const prices = { "1|2026-09-01": 10, "1|2026-09-09": 12, "2|2026-09-01": 10, "2|2026-09-08": 9, "3|2026-09-01": 10 };
  const priceOn = (pid, d) => prices[`${pid}|${d}`] ?? null;
  const night = snapshotNight({ asOf: "2026-09-01", reads: [{ readKind: "high", sku: "tcgcsv-1", headline: "$99" }, { readKind: "low", sku: "tcgcsv-2" }, { readKind: "high", sku: "tcgcsv-3" }], priceOn });
  t("ship price from the file", night[0].price === 10);
  scoreLedger(night, priceOn, "2026-09-20", () => 0);
  t("day 8 fills a 7-day horizon (slack)", night[0].h7?.day === "2026-09-09" && night[0].h7.held === true);
  t("down claim held when lower", night[1].h7.held === true);
  t("no later price is no score", !night[2].h7);
  t("30 days not scored early", !night[0].h30);
  t("rates need 20 scored", summarize(night).every((r) => r.heldPct7 === null));

  // Rating rows: held = beat the group median for "below".
  const rp = { "5|2026-09-01": 10, "5|2026-09-08": 13, "6|2026-09-01": 10, "6|2026-09-08": 10, "7|2026-09-01": 10, "7|2026-09-08": 9 };
  const rOn = (pid, d) => rp[`${pid}|${d}`] ?? null;
  const rows = snapshotNight({ asOf: "2026-09-01", ratingRows: [5, 6, 7].map((n, i) => ({ id: `tcgcsv-${n}`, group: "ir", verdict: ["Priced below similar cards", "In line", "Priced above similar cards"][i], price: { date: "2026-09-01" }, score: 50, factors: { peer: { v: 0.5 } } })), priceOn: rOn });
  scoreLedger(rows, rOn, "2026-09-10");
  t("below beat its group", rows[0].h7.held === true);
  t("above lagged its group", rows[2].h7.held === true);

  // Tuner limits
  const base = { peer: 25, popularity: 15, scarcity: 15, demand: 15, age: 10, artist: 10, range: 10 };
  const st = initialState(base);
  t("no results, no move", tuneNight(st, [], "2026-10-12").log[0].action === "hold");
  const ledger = [];
  for (let i = 0; i < 400; i++) {
    const good = (i % 10) / 10;
    ledger.push({ t: "rating", kind: "below", group: "ir", pid: i, date: "2026-09-01", price: 1, score: 50, wv: "base", f: { demand: good, artist: 1 - good, peer: 0.5 + (i % 3) / 10 }, h30: { excess: good - 0.45 + ((i * 7) % 5) / 100 } });
  }
  const a = tuneNight(st, ledger, "2026-10-12");
  const moved = Object.keys(base).reduce((s, k) => s + Math.abs(a.state.weights[k] - base[k]), 0);
  t("one pair or two per night, 1 point each", moved <= 2 * TUNER.maxPairsPerNight && Object.keys(base).every((k) => Math.abs(a.state.weights[k] - base[k]) <= TUNER.stepPoints));
  t("weights still sum to 100", Object.values(a.state.weights).reduce((x, y) => x + y, 0) === 100);
  t("demand up, artist down", a.state.weights.demand === 16 && a.state.weights.artist === 9);
  t("cooldown holds the next night", tuneNight(a.state, ledger, "2026-10-13").state.weights.demand === 16);
  let s = a.state;
  for (let d = 0; d < 200; d += 7) s = tuneNight(s, ledger, addDays("2026-10-20", d)).state;
  t("never past 1.5x or below 0.5x base", validWeights(base, s.weights) && s.weights.artist >= 5 && s.weights.demand <= 22);
  t("manual revert to base", sameWeights(revertTo(s, "base", "2027-01-01").weights, base));
  t("frozen does nothing", tuneNight({ ...a.state, frozen: true }, ledger, "2026-11-01").log[0].reason === "frozen");
  t("bad weights rejected", !validWeights(base, { ...base, peer: 60, popularity: -20 }));
  // Auto-revert: the new version's score lines up worse than its parent's.
  const worse = ledger.map((e, i) => ({ ...e, wv: i % 2 ? a.state.version : "base", score: i % 2 ? 100 - e.f.demand * 100 : e.f.demand * 100 }));
  const r = tuneNight({ ...a.state, lastMoved: {} }, worse, "2026-11-20");
  t("auto-revert to parent", r.log[0].action === "auto-revert" && sameWeights(r.state.weights, base));

  // Flags
  const mv = priceMoveFlags("2026-10-11", new Map([[1, 20], [2, 20], [3, 4]]), "2026-10-12", new Map([[1, 40], [2, 25], [3, 40]]), new Map([[1, { name: "A", set: "S" }]]));
  t("50% and $10 move flagged, small and sub-$5 not", mv.length === 1 && mv[0].data.id === "tcgcsv-1");
  t("gap only after the first daily file", dataGapFlags(["2026-10-10", "2026-10-12"], "2026-10-12")[0].data.missing.join() === "2026-10-11");
  t("stale file flagged", staleFlags({ news: { file: "n", date: "2026-10-09" } }, "2026-10-12")[0].type === "STALE_FILE");
  t("empty read type that worked last night is high", readTypeFlags({}, { readKinds: { high: 3 } }).find((f) => f.data.kind === "high").severity === "high");
  t("first night seeds, no new-set flood", newSetFlags([{ id: 1, name: "X" }], {}).length === 0 && newSetFlags([{ id: 2, name: "Y" }], { groups: [1] }).length === 1);
  t("radar date change", releaseFlags({ upcoming: [{ name: "Z", date: "2026-11-07" }] }, { radar: [{ name: "Z", date: "2026-11-06" }] })[0].type === "RELEASE_DATE_CHANGE");

  // Research scan
  t("supply headline is a lead", newsLeads([{ title: "Pokemon Center announces reprint of 151 ETB", url: "u", published: "2026-10-12" }], { since: "2026-10-10", until: "2026-10-12" })[0]?.type === "SUPPLY_EVENT");
  t("tournament is not a new set", newsLeads([{ title: "Regional Championships announced for new expansion", url: "u", date: "2026-10-12" }], { since: "2026-10-10" }).every((l) => l.type !== "NEW_SET"));
  t("future event date is not a fresh item", newsLeads([{ title: "PSA grading price increase", url: "u", date: "2026-12-01" }], { since: "2026-10-10", until: "2026-10-12" }).length === 0);
  t("names match", nameMatch("Delta Reign (ME06, Mega Rayquaza ex)", "Mega Evolution - Delta Reign") >= 0.6);
  const rc = radarCheck({ radar: { upcoming: [{ name: "JP: 30th CELEBRATION Card Set", date: "2026-10-16" }, { name: "Delta Reign", date: "2026-11-06" }] }, calendar: [{ title: "30th Celebration", date: "2026-09-16", source: "Serebii", url: "a" }, { title: "Delta Reign", date: "2026-11-13", source: "Serebii", url: "b" }], today: "2026-10-12" });
  t("JP radar item ignores English sources", !rc.leads.some((l) => /JP/.test(l.name)));
  t("other date is a single-source DATE_CHANGE lead", rc.leads.some((l) => l.type === "DATE_CHANGE" && l.seenDate === "2026-11-13" && l.confidence === "single-source"));
  return fail;
}
