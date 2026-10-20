// Publish gate and the Oct 19 reads check bugs. Made up numbers only.
import { checkRead, gateReads } from "../lib/publish-gate.mjs";
import { staleOneStep } from "../lib/read-quality.mjs";
import { backToRead } from "../lib/history-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const rule = (r, ctx = {}) => checkRead(r, ctx).flags.map((f) => f.rule);
  const base = { id: "x", name: "Box", headline: "Box: $10 (Oct 19).", asOf: "2026-10-19" };

  const d = checkRead({ ...base, receipt: { name: "30th Celebration \u2014 Decks" } });
  t("dash stripped and read kept", d.read && !/[\u2014\u2013]/.test(JSON.stringify(d.read)) && d.flags[0].rule === "dash");
  t("category name is a bad title", rule({ ...base, name: "Rating: Illustration Rares" }).includes("title"));
  t("doubled card number is a bad title", rule({ ...base, name: "Chansey ex 96/109 #96/109" }).includes("title"));
  const chips = { x: { tiles: { price: { dir: "up", days: 7, stage: { word: "Building", dir: "down" } } } } };
  t("headline down vs tile up drops", rule({ ...base, headline: "Box: Down 17%.", windowDays: 7 }, { chips }).includes("direction"));
  t("950 day tile on a 7 day read drops", rule({ ...base, windowDays: 7 }, { chips: { x: { tiles: { price: { dir: "up", days: 950 } } } } }).includes("window"));
  const facts = () => ({ range: { high: { price: 300, date: "2026-08-13" } } });
  t("same high, two dates drops", rule({ ...base, receipt: { between: { price: 300, date: "2026-07-16" } } }, { facts }).includes("fact-date"));
  const lc = { ...base, readKind: "listings", sku: "sm35-etb", asOf: "2026-10-18", receipt: { n: 11 } };
  t("listings read behind the nightly drops", rule(lc, { listings: { "sm35-etb": { date: "2026-10-19", n: 13 } } }).includes("stale"));
  t("zero listings counted drops", rule({ ...lc, receipt: { n: 0 } }).includes("listings-zero"));
  t("NM on sealed drops", rule({ ...base, kind: "sealed", headline: "Box NM $10." }).includes("condition"));
  t("bad image removed", checkRead({ ...base, image: "javascript:x" }).read.image === undefined);
  t("Vintage on a 2004 set drops", rule({ ...base, set: "POP Series 1", tags: ["Vintage"] }, { sets: { "POP Series 1": "2004-09-01" } }).includes("era"));
  t("same read as yesterday drops", rule({ ...base, endDate: "2026-10-19" }, { asOf: "2026-10-19", prev: { x: { ...base, asOf: "2026-10-18", endDate: "2026-10-19" } } }).includes("repeat"));
  t("advice wording drops", rule({ ...base, headline: "You should buy this box now." }).includes("advice"));
  t("raw card codes are a bad title", rule({ ...base, headline: "Set: top cards on TCGplayer market are #R/RGB at $6,000.27." }).includes("title"));
  t("priced card with no tiles drops", rule({ ...base, kind: "single", price: 61.97, href: "/c/tcgcsv-1" }, { chips: {} }).includes("tiles"));
  t("priced sealed read with no tiles drops", rule({ ...base, kind: "sealed", price: 107, href: "/p/example-box" }, { chips: {} }).includes("tiles"));
  t("a price tile keeps the read", !rule({ ...base, kind: "single", price: 46.89, href: "/c/tcgcsv-90105" }, { chips: { x: { tiles: { price: { dir: "up", days: 7, pct: 15.4 } } } } }).includes("tiles"));
  t("a data tile keeps the read", !rule({ ...base, kind: "single", price: 10, href: "/c/tcgcsv-2" }, { chips: { x: { tiles: { data: { bars: 3, of: 5 } } } } }).includes("tiles"));
  t("price being checked is not required to have tiles", !rule({ ...base, kind: "single", price: 10, href: "/c/tcgcsv-3", headline: "Price being checked." }, { chips: {} }).includes("tiles"));
  t("an unpriced deep read is not required to have tiles", !rule({ ...base, kind: "deep" }, { chips: {} }).includes("tiles"));
  t("bare pattern rate under 50 drops", rule({ ...base, readKind: "pattern-forming", headline: "Items matching this pattern were right 29.1% of the time 7 days later, vs 20.8% normally." }).includes("pattern-rate"));
  t("lift lead keeps a later rate", !rule({ ...base, readKind: "pattern-forming", headline: "1.4x more likely than usual to rise and finish above the usual move within 7 days. 29.1% of 2,962 past cases vs 20.8% for all items." }).includes("pattern-rate"));
  t("down 17 price headline is not a pattern rate", !rule({ ...base, headline: "Box: Down 17%." }).includes("pattern-rate"));
  t("bare 55 is not under 50", !rule({ ...base, readKind: "pattern-forming", headline: "This pattern was right 55% of the time." }).includes("pattern-rate"));
  t("clean read passes", rule(base).length === 0);
  const many = Array.from({ length: 40 }, (_, i) => ({ ...base, id: `r${i}`, name: "Rating: X" }));
  t("systemic breakage is flagged", gateReads(many).systemic === true);

  const days = new Map([["2026-10-12", 2265.93], ["2026-10-13", 2265.93], ["2026-10-14", 2265.93], ["2026-10-15", 2265.93], ["2026-10-16", 1886.95], ["2026-10-17", 1886.95], ["2026-10-18", 1886.95], ["2026-10-19", 1886.95]]);
  t("one old step, flat since: no repeat sealed read", staleOneStep(days, "2026-10-12", "2026-10-19") === true);
  days.set("2026-10-19", 1800);
  t("a fresh move still reads", staleOneStep(days, "2026-10-12", "2026-10-19") === false);

  const pts = [["2025-03-27", 175.27], ["2026-07-16", 300], ["2026-08-13", 300], ["2026-10-19", 176.65]];
  const r = backToRead({ pts, name: "Charizard", set: "EX Power Keepers", number: "6/108", id: 84188 }, "2026-10-19");
  t("back-to read uses the latest day at the high", !r || r.receipt?.between?.date === "2026-08-13");
  return fail;
}
