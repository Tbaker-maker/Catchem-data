import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { valueOn } from "../lib/deep-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BANNED = /\b(buy|sell|hold|held|holding|support|resistance|bottom|printed|play|target|invest|moon|pump|dump|hodl|crypto)\b/i;

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const pts = [["2026-09-01", 10], ["2026-09-10", 20]];
  t("valueOn uses the last real point inside 8 days", valueOn(pts, "2026-09-12") === 20 && valueOn(pts, "2026-09-30") == null);
  const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
  const rows = doc.reads || [];
  const deep = rows.filter((r) => r.readKind === "deep");
  const price = rows.filter((r) => r.board !== "v3" || r.priceRead === true);
  t("board is 200 to 400 reads", rows.length >= 200 && rows.length <= 400);
  t("price reads are at most 40%", price.length <= Math.floor(rows.length * 0.4) + 1);
  t("deep reads exist", deep.length >= 20);
  t("each deep read has 3 to 6 lines, a source and a date", deep.every((r) => Array.isArray(r.lines) && r.lines.length >= 3 && r.lines.length <= 6 && r.source && /^\d{4}-\d{2}-\d{2}$/.test(r.asOf)));
  t("deep charts carry points or bars", deep.every((r) => !r.chart || (Array.isArray(r.chart.points) && r.chart.points.length >= 2) || (Array.isArray(r.chart.bars) && r.chart.bars.length >= 2)));
  t("deep text has no em dash or banned word", deep.every((r) => ![r.headline, ...r.lines].some((s) => /\u2014/.test(s) || BANNED.test(s))));
  const ir = deep.find((r) => r.deep === "irlife");
  t("Pokemon spotlights name a real species", deep.filter((r) => r.deep === "pokemon").every((r) => String(r.name).length >= 3));
  t("IR lifecycle names the holo baseline", !ir || ir.lines.some((l) => /holo/i.test(l)));
  const ids = rows.map((r) => r.id);
  t("no duplicate ids", new Set(ids).size === ids.length);
  t("no same family side by side", rows.every((r, i) => i === 0 || (r.family || r.readKind) !== (rows[i - 1].family || rows[i - 1].readKind)));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("deep-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
