import { pathToFileURL } from "node:url";
import { buildSupplyLead, chartSegments, gapDates, listingSentence, listingWindow } from "../lib/supply-lead.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

const both = [
  { date: "2026-10-02", listingCount: 140, price: 16.98 },
  { date: "2026-10-09", listingCount: 109, price: 16.98 },
];
const fell = listingWindow(both.map((row) => ({ date: row.date, listingCount: row.listingCount, ask: row.price })), 7);
t("a 22% drop on both exact days qualifies", fell.qualify === true && fell.pct === -22.1 && fell.askStayed === true);
const sentence = listingSentence("Surging Sparks ETB", fell);
t("the sentence names eBay listings and the ask", sentence.startsWith("Fewer copies listed: Surging Sparks ETB eBay listings fell 22.1% in 7 days (140 → 109).") && sentence.includes("eBay ask stayed at $16.98"));
t("the sentence does not call listings sales", !/\bsales?\b/i.test(sentence) && !/\bholds?\b/i.test(sentence));

const gapped = [
  { date: "2026-10-03", listingCount: 140, ask: 10 },
  { date: "2026-10-09", listingCount: 100, ask: 12 },
];
const missing = listingWindow(gapped, 7);
t("a missing exact day drops the read", missing.qualify === false && missing.reason === "missing-exact-day" && listingSentence("Surging Sparks ETB", missing) === "");

const small = listingWindow([
  { date: "2026-09-09", listingCount: 100, ask: 10 },
  { date: "2026-10-09", listingCount: 90, ask: 10 },
], 30);
t("under 15% does not qualify", small.qualify === false && small.reason === "under-15" && small.pct === -10);

const reach = [
  { date: "2026-10-01", listingCount: 200, ask: 10 },
  { date: "2026-10-03", listingCount: 100, ask: 10 },
  { date: "2026-10-09", listingCount: 100, ask: 10 },
];
t("an earlier night is not a stand-in", listingWindow(reach, 7).reason === "missing-exact-day");

const segs = chartSegments([
  { date: "2026-10-05", listings: 10, ask: 1 },
  { date: "2026-10-07", listings: 8, ask: 1 },
], "listings");
t("a gap splits the chart", segs.length === 2 && gapDates([{ date: "2026-10-05" }, { date: "2026-10-07" }]).join(",") === "2026-10-06");

const doc = buildSupplyLead([
  { id: "sv8-etb", date: "2026-10-02", listingCount: 140, price: 16.98 },
  { id: "sv8-etb", date: "2026-10-09", listingCount: 109, price: 16.98 },
  { id: "other", date: "2026-10-08", listingCount: 50, price: 4 },
  { id: "other", date: "2026-10-09", listingCount: 40, price: 4 },
], { "sv8-etb": "Surging Sparks ETB" }, { enabled: false });
t("flag off keeps the count and hides the read", doc.enabled === false && doc.wouldQualify === 1 && doc.reads.length === 0 && doc.windows["7"].qualify === 1 && doc.belowGate.length === 0);
const on = buildSupplyLead([
  { id: "sv8-etb", date: "2026-10-02", listingCount: 140, price: 16.98 },
  { id: "sv8-etb", date: "2026-10-09", listingCount: 109, price: 16.98 },
], { "sv8-etb": "Surging Sparks ETB" }, { enabled: true });
t("flag on publishes the same read", on.reads.length === 1 && on.reads[0].id === "sv8-etb" && on.reads[0].sentence.includes("140 → 109"));

if (fail) console.log(fail + " failed");
else console.log("supply lead ok");
// run-tests.mjs imports every *.suite.mjs and counts a missing run() as a
// failure, which stopped the nightly. The checks above run on import; run()
// reports their count. Run directly, a failure still exits non-zero.
export async function run() { return fail; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && fail) process.exit(1);

