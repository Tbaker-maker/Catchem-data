import { indexLine } from "../lib/public-index-line.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

const card = (rows) => ({ hist: rows });
const ten = (rows) => Array.from({ length: 10 }, () => card(rows));

{
  // Sep 28 has no file. It must be a gap, not a carried-forward level.
  const r = indexLine(ten([["2026-09-26", 10], ["2026-09-27", 11], ["2026-09-29", 12.1]]));
  const by = Object.fromEntries(r.points.map((p) => [p.d, p]));
  t("missing day is a gap (v null)", by["2026-09-28"] && by["2026-09-28"].v === null);
  t("move across the gap is measured from the last real day", by["2026-09-29"].v === 121 && by["2026-09-29"].from === "2026-09-27");
  t("card count is stated", r.cards === 10 && r.gaps === 1 && r.links === 2);
}
{
  // Under 8 cards linked is a gap too, not the old level repeated.
  const r = indexLine([...Array.from({ length: 5 }, () => card([["2026-01-01", 10], ["2026-01-02", 20]]))]);
  t("too few cards is a gap", r.points[1].v === null && r.points[1].n === 5 && r.cards === 0);
}
{
  // Small daily moves compound; the level is not rounded between days.
  const rows = Array.from({ length: 31 }, (_, i) => [`2026-05-${String(i + 1).padStart(2, "0")}`, 100 * 1.0004 ** i]);
  const r = indexLine(ten(rows));
  t("0.04% a day is not rounded away", r.points.at(-1).v === 101.2, String(r.points.at(-1).v));
}
{
  const r = indexLine(ten([["2026-01-01", 1], ["2026-01-02", 5]]));
  t("cards under $2 on the from-day are left out", r.points[1].v === null);
}

if (fail) { console.error(`public-index-line: ${fail} failed`); process.exit(1); }
console.log("public-index-line: all passed");
