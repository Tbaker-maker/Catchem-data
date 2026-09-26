import { labelFor, listingHeat, scoreFrom, zscore } from "../lib/heat-check.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

const flat = Array.from({ length: 40 }, (_, i) => ({ date: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`, listingCount: 20 }));
// rebuild real dates
const rows = [];
for (let i = 0; i < 40; i++) {
  const d = new Date(Date.UTC(2026, 7, 1 + i));
  rows.push({ date: d.toISOString().slice(0, 10), listingCount: i === 39 ? 10 : 20 });
}
const heat = listingHeat(rows, "2026-09-09");
t("30 days required", listingHeat(rows.slice(0, 10), "2026-09-09").z == null);
t("a drop in listings is hotter than zero", heat.z > 0, String(heat.z));
t("the note does not call listings sold", !/\bsold\b/i.test(heat.note));

const coldRows = rows.map((r, i) => ({ ...r, listingCount: i === rows.length - 1 ? 40 : 20 }));
const cold = listingHeat(coldRows, "2026-09-09");
t("more listings scores colder", cold.z < 0, String(cold.z));

const gapped = [{ date: "2026-08-25", listingCount: 20 }, { date: "2026-08-26", listingCount: 21 }, { date: "2026-09-21", listingCount: 60 }, { date: "2026-09-22", listingCount: 61 }];
const g = listingHeat(gapped, "2026-09-22");
t("a jump across a gap is not counted as a day's change", g.days === 2 && g.latest === 1, JSON.stringify(g));

t("short series has no z", zscore(1, [1, 2, 3]) == null);
t("labels", labelFor(10) === "Cold" && labelFor(30) === "Cool" && labelFor(50) === "Steady" && labelFor(70) === "Warm" && labelFor(90) === "Hot");
const scored = scoreFrom([
  { key: "listings", weight: 0.4, z: 1.2 },
  { key: "momentum", weight: 0.3, z: null },
  { key: "trends", weight: 0.2, z: null },
  { key: "youtube", weight: 0.1, z: null },
]);
t("missing inputs stay out of the score", scored.partial && scored.weightsUsed.length === 1);
t("score stays inside 0 to 100", scored.score >= 0 && scored.score <= 100);

console.log(fail ? `${fail} failed` : "heat check ok");
if (fail) process.exit(1);
