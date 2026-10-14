import { nearestPoint, extremeRead, windowRead, backToRead, setReads, historyReads, dateLabel } from "../lib/history-reads.mjs";
import { parsePcPreordersApi } from "../lib/news-sources.mjs";
import { listingReads, sealedChaseReads } from "../lib/board-mix.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const asOf = "2026-10-12";
  const card = (pts, extra = {}) => ({ id: "tcgcsv-1", name: "Test Card", set: "SV09: Journey Together", rarity: "Special Illustration Rare", printing: "Holofoil", pts, ...extra });

  t("nearest point names its own day", nearestPoint([["2026-09-10", 1], ["2026-09-14", 2]], "2026-09-12", 4)[0] === "2026-09-10");
  t("nearest point stays inside the window", nearestPoint([["2026-09-01", 1]], "2026-09-12", 4) === null);
  t("other years carry the year", dateLabel("2025-10-09", asOf) === "Oct 9, 2025" && dateLabel("2026-03-05", asOf) === "Mar 5");

  const climb = card([["2024-02-08", 50], ["2024-06-01", 80], ["2025-06-01", 40], ["2026-01-01", 45], [asOf, 90]]);
  const hi = extremeRead(climb, asOf, 1);
  t("highest since names the month and the older point", hi && hi.headline.startsWith("Highest since Jun 2024") || hi?.headline.includes("on file"));
  t("a 52-week high needs a year of points", extremeRead(card([["2026-01-01", 10], [asOf, 20]]), asOf, 1) === null);
  t("a tiny new high is not a read", extremeRead(card([["2024-02-08", 50], ["2026-01-01", 100], [asOf, 101]]), asOf, 1) === null);

  const yr = windowRead(card([["2025-10-09", 20], [asOf, 40]]), asOf, { days: 365, slack: 7, minPct: 25, maxPct: 300, minUsd: 5, kind: "year" });
  t("one year on uses the real start day", yr && yr.headline.includes("$20.00 NM (Oct 9, 2025) to $40.00 NM (Oct 12)") && yr.startDate === "2025-10-09");
  t("no point near the day, no read", windowRead(card([["2025-09-01", 20], [asOf, 40]]), asOf, { days: 365, slack: 7, minPct: 25, minUsd: 5, kind: "year" }) === null);
  t("an outsized jump is left out", windowRead(card([["2026-09-12", 2], [asOf, 40]]), asOf, { days: 30, slack: 4, minPct: 15, maxPct: 150, minUsd: 2, kind: "plain" }) === null);

  const back = backToRead(card([["2025-01-10", 30], ["2025-06-01", 60], [asOf, 30.2]]), asOf);
  t("back to its price names both dates and the swing", back && back.headline.includes("Back to its Jan 10, 2025 price") && back.headline.includes("$60.00 NM (Jun 1, 2025)"));

  const cards = Array.from({ length: 12 }, (_, i) => card([["2026-09-12", 20], [asOf, i < 6 ? 25 : 20]], { id: `tcgcsv-${i + 10}` }));
  const sr = setReads(cards, asOf);
  t("set read counts exactly", sr.length === 1 && sr[0].headline.includes("6 of 12 priced cards up 10% or more, 0 down"));
  const all = historyReads(cards, asOf);
  t("history reads carry a real start date and the hist tag", Object.values(all.picked).flat().every((r) => r.board === "hist" && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate)));
  t("no banned words or em dashes", Object.values(all.picked).flat().every((r) => !/[\u2014\u2013]/.test(r.headline) && !/\b(buy|sell|hold|target|bottom)\b/i.test(r.headline)));

  const api = JSON.stringify({ article: { updated_at: "2026-10-05T16:13:37Z", body: "<table><tbody><tr><td>Item Name</td><td>Region Availability</td><td>Estimated Ship Date</td></tr><tr><td>Pokémon TCG: Test Booster Bundle</td><td>US</td><td>Late October 2026</td></tr></tbody></table>" } });
  const pc = parsePcPreordersApi(api);
  t("Pokémon Center preorders come from the Help Center API with the article's own date", pc.length === 1 && pc[0].date === "2026-10-05" && pc[0].setDate === "Late October 2026");
  t("an empty API answer is no items", parsePcPreordersApi("{}").length === 0);

  const lr = listingReads({ products: [{ id: "x", name: "X Box", listingsCounted: { n: 18, date: "2026-10-12", prev: { n: 14, date: "2026-10-11" } } }] });
  t("listing read at 14 to 18 is stated exactly", lr.length === 1 && lr[0].headline.includes("eBay listings 14 to 18 (Oct 11 to Oct 12). A listing is not a sale."));

  const hist = new Map([["sv9-booster-box", [{ date: "2026-10-05", market: 100 }, { date: "2026-10-12", market: 100.5 }]]]);
  const raw = new Map([[555, { group: "SV09: Journey Together" }]]);
  const sc = sealedChaseReads({ products: [{ id: "sv9-booster-box", name: "Journey Together Booster Box", tcgPlayerId: "555" }], histories: hist, rawProducts: raw, pool: [{ id: 9, group: "SV09: Journey Together", name: "N's Zoroark ex", from: 30, to: 40 }], start: "2026-10-05", end: asOf });
  t("sealed vs chase names both sides by id with both dates", sc.length === 1 && sc[0].receipt.chaseId === "tcgcsv-9" && sc[0].headline.includes("Oct 5 to Oct 12"));
  return fail;
}
