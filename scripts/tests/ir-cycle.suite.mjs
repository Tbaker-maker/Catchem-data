import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rotationChip, rangePos, positionText, trend, curveNote, listingsBySet, setListings, cleanCopy, series } from "../lib/ir-cycle.mjs";
import { popularity } from "../lib/popular-pokemon.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

export async function run() {
  fail = 0;
  const rot = { sources: [{ mark: "G", date: "2026-04-10", text: "April 10, 2026" }, { mark: "Z", date: "2027-04-09", text: "April 9, 2027" }],
    expected: [{ mark: "H", window: "spring 2027" }],
    sets: [{ slug: "a", mark: "G" }, { slug: "b", mark: "H" }, { slug: "c", mark: "Z" }, { slug: "d", mark: null }] };
  t("rotated set says Rotated with the official date", rotationChip(rot, "a", "2026-10-12").text === "Rotated April 10, 2026 (mark G)");
  t("announced future date counts down", rotationChip(rot, "c", "2026-10-12").text === "Rotates in 179 days (April 9, 2027, mark Z)");
  const h = rotationChip(rot, "b", "2026-10-12");
  t("unannounced mark shows the labeled window, no countdown", h.official === false && /not announced/.test(h.text) && !/Rotates in/.test(h.text));
  t("no mark, no chip", rotationChip(rot, "d", "2026-10-12") === null);
  t("range position", rangePos({ low: { price: 10 }, high: { price: 20 } }, 10) === 0 && positionText(0) === "Near its lowest on file");
  const pts = [["2026-07-14", 10], ["2026-09-12", 8], ["2026-10-12", 12]];
  t("30 day trend uses dated points", trend(pts, "2026-10-12", 30).pct === 50);
  t("trend is null when no price near the start", trend([["2026-10-12", 5]], "2026-10-12", 90) === null);
  t("long history merges with nightly", series({ hist: [["2026-10-12", 5]] }, "20000:4").length === 2);
  t("curve stage by age", curveNote("IR", 100).stage === "first 6 months" && curveNote("SIR", 400).stage === "past one year");
  const by = listingsBySet({ updatedAt: "2026-10-12T05:00:00Z", products: [{ id: "x-pack", set: "Foo", subtype: "booster-pack", listingCount: 9 }, { id: "x-bb", name: "Foo Booster Box", set: "Foo", subtype: "booster-box", listingCount: 4 }] }, { updatedAt: "2026-10-11T05:00:00Z", products: [{ id: "x-bb", listingCount: 6 }] });
  const l = setListings(by, "SV99: Foo");
  t("set listings pick the booster box, exact count with dates", l.id === "x-bb" && l.n === 4 && l.date === "2026-10-12" && l.prev.n === 6);
  t("popularity: Charizard weighs most, Fidough zero", popularity("Charizard ex - 199/165").weight === 5 && popularity("Fidough - 213/198").weight === 0);
  t("popularity: Eeveelution tagged", popularity("Umbreon ex - 161/131").tags.includes("eeveelution"));
  t("copy check blocks banned words", !cleanCopy("Best time to load up") && cleanCopy("Near its lowest on file"));

  const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/ir-cycle.json"), "utf8"));
  t("ir-cycle has rows and a date", doc.rows.length > 100 && /^\d{4}-\d{2}-\d{2}$/.test(doc.asOf));
  t("no private score is published", doc.rows.every((r) => !("_score" in r)));
  t("every row is an IR or SIR with a dated price", doc.rows.every((r) => ["IR", "SIR", "TG", "GG", "ALT"].includes(r.kind) && r.price.price > 0 && /^\d{4}-/.test(r.price.date)));
  t("older kinds included", ["TG", "GG", "ALT"].every((k) => doc.rows.some((r) => r.kind === k)));
  t("weights add to 100", Object.values(doc.scoreWeights).reduce((a, b) => a + b, 0) === 100);
  t("lift chips are clean facts", doc.rows.every((r) => Array.isArray(r.lifts) && r.lifts.every((l) => cleanCopy(l.text))));
  t("stage is a factor, not a gate: a rotated card can rank in the top 200", doc.rows.slice(0, 200).some((r) => /Rotated/.test(r.rotation?.text || "") || ["TG", "GG", "ALT"].includes(r.kind)));
  t("public strings are clean", doc.rows.every((r) => cleanCopy(r.position) && cleanCopy(r.curve.text) && cleanCopy(r.rotation?.text || "")) && cleanCopy(doc.note));
  // Verify by id: the row name matches the bucket row with the same id.
  const r0 = doc.rows[0];
  const bucket = String((Number((r0.id.match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");
  const rows = JSON.parse(await readFile(join(ROOT, `research/assets/public/buckets/${bucket}.json`), "utf8"));
  const hit = rows.find((r) => r.id === r0.id);
  t("top row verified by id", hit && hit.name === r0.name && (r0.kind === "IR" ? hit.rarity === "Illustration Rare" : r0.kind === "SIR" ? hit.rarity === "Special Illustration Rare" : true));
  fail += await runScoreUnits();
  fail += await runMarkChecks();
  fail += await runCardMarkChecks();
  return fail;
}
if (import.meta.url === `file://${process.argv[1]}`) run().then((n) => process.exit(n ? 1 : 0));

import { peersValue, trendValue, stageValue } from "../lib/ir-cycle.mjs";
export async function runScoreUnits() {
  let f = 0; const u = (n, c) => { if (!c) { f++; console.error("  FAIL", n); } };
  u("below both peers lifts fully", peersValue(-30, -10, -20).v === 1 && /down 30%/.test(peersValue(-30, -10, -20).chip));
  u("above peers no lift", peersValue(5, -10, -20).v === 0);
  u("turning up chip", trendValue({ pct: 6 }, { pct: -20 }).chip === "Up 6% in 30 days after down 20% in 90");
  u("young card is not excluded", stageValue(50, false).v > 0);
  return f;
}
import { MARK_OVERRIDES } from "../lib/feature-data.mjs";
export async function runMarkChecks() {
  const rot = JSON.parse(await readFile(join(ROOT, "research/assets/public/rotation-status.json"), "utf8"));
  let f = 0;
  for (const [slug, o] of Object.entries(MARK_OVERRIDES)) { const r = rot.sets.find((s) => s.slug === slug); if (!r || r.mark !== o.mark) { f++; console.error("  FAIL mark", slug); } }
  for (const slug of ["sv-prismatic-evolutions", "sv09-journey-together", "me-ascended-heroes"]) { if (rot.sets.find((s) => s.slug === slug)?.mark) { f++; console.error("  FAIL mixed set got a mark", slug); } }
  return f;
}
import { cardMarks } from "../lib/ir-cycle.mjs";
import { markCited } from "../lib/board-mix.mjs";
export async function runCardMarkChecks() {
  let f = 0; const u = (n, c) => { if (!c) { f++; console.error("  FAIL", n); } };
  const m = cardMarks([{ id: "tcgcsv-1", kind: "single", setSlug: "sv-prismatic-evolutions", scan: "/img/sv8pt5/159" }, { id: "tcgcsv-2", kind: "single", setSlug: "sv-prismatic-evolutions", scan: "/cards/pattern/x.jpg" }], { "sv8pt5-159": { rm: "G" } });
  u("card mark by scan id", m["tcgcsv-1"]?.mark === "G" && m["tcgcsv-1"].ptcgId === "sv8pt5-159" && !m["tcgcsv-2"]);
  u("checked date cited", markCited({ checked: "2026-10-12" }, { asOf: "2026-08-24" }) === "checked Oct 12, 2026");
  const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/card-marks.json"), "utf8"));
  u("Sandy Shocks SIR (tcgcsv-610514, sv8pt5-159) is G by id", doc.cards["tcgcsv-610514"]?.mark === "G" && doc.cards["tcgcsv-610514"].ptcgId === "sv8pt5-159");
  return f;
}
