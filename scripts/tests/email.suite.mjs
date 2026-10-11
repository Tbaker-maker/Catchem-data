import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintEmail } from "../lint-email.mjs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { proveRead, provenBoard, makeDayLoader, isRotatedSet } from "../lib/email-proof.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const banned = /\b(Hit rate|Hits|Misses)\b/;
  const weeklyDir = join(ROOT, "data/derived");
  const names = (await readdir(weeklyDir)).filter((n) => /weekly/i.test(n));
  for (const name of names) {
    const text = await readFile(join(weeklyDir, name), "utf8");
    t(`public weekly file has no track record words: ${name}`, !banned.test(text));
  }
  t("public receipts-weekly is gone", !names.includes("receipts-weekly.json"));
  const htmlFiles = [
    "newsletter/templates/weekly.html",
    "newsletter/templates/welcome-1.html",
    "newsletter/templates/welcome-2.html",
    "newsletter/templates/welcome-3.html",
    "newsletter/out/weekly-2026-10-11.html",
    "newsletter/out/daily-2026-10-11.html",
  ];
  for (const file of htmlFiles) {
    const html = await readFile(join(ROOT, file), "utf8");
    const errors = lintEmail(file, html);
    t(`email lint ${file}`, errors.length === 0);
    if (errors.length) console.error(errors.join("\n"));
  }
  const weekly = await readFile(join(ROOT, "newsletter/out/weekly-2026-10-11.html"), "utf8");
  t("weekly email has one site CTA", (weekly.match(/href="https:\/\/catchemtcg\.com"/g) || []).length === 1);
  t("weekly email has no empty heat line", !weekly.includes("No heat list"));
  const daily = await readFile(join(ROOT, "newsletter/out/daily-2026-10-11.html"), "utf8");
  t("daily email does not pad", !daily.includes("Quiet night") || daily.includes("Fewer than three"));

  // Price proof on a fixture root.
  const root = await mkdtemp(join(tmpdir(), "email-proof-"));
  const dd = join(root, "data/history/tcgcsv-daily");
  await mkdir(dd, { recursive: true });
  await writeFile(join(dd, "2026-10-03.json"), JSON.stringify({ prices: [{ id: 1, market: 10.6 }, { id: 2, market: 0.22 }, { id: 3, market: 195.64 }, { id: 4, market: 20 }] }));
  await writeFile(join(dd, "2026-10-10.json"), JSON.stringify({ prices: [{ id: 1, market: 22.93 }, { id: 2, market: 0.2 }, { id: 3, market: 195.69 }, { id: 4, market: 25 }] }));
  const day = makeDayLoader(root);
  const mv = (id, a, aDate, b, bDate, kind = "single") => ({ id: `move-tcgcsv-${id}`, sku: `tcgcsv-${id}`, kind, headline: `TCGplayer market: $${b} (${bDate}), from $${a} (${aDate}).` });
  t("a proven move clears", (await proveRead(mv(1, 10.6, "2026-10-03", 22.93, "2026-10-10"), { day })).ok === true);
  const pre = await proveRead(mv(2, 0.22, "2026-09-09", 0.2, "2026-10-08"), { day });
  t("a pre-history date is rejected", !pre.ok && /before 2026-09-26/.test(pre.reason));
  const sub = await proveRead(mv(2, 0.22, "2026-10-03", 0.2, "2026-10-10"), { day });
  t("a sub-$1 move is rejected", !sub.ok && /under \$1/.test(sub.reason));
  const sealedSmall = await proveRead(mv(3, 195.64, "2026-10-03", 195.69, "2026-10-10", "sealed"), { day });
  t("a 5-cent sealed move is rejected", !sealedSmall.ok);
  const notIn = await proveRead(mv(1, 11.11, "2026-10-03", 22.93, "2026-10-10"), { day });
  t("a price not in that exact day's file is rejected", !notIn.ok && /not in 2026-10-03 file/.test(notIn.reason));
  const sealedFive = await proveRead(mv(4, 20, "2026-10-03", 25, "2026-10-10", "sealed"), { day });
  t("a sealed move of exactly $5 and 25% clears", sealedFive.ok === true);
  const ask = await proveRead({ id: "askmove-x", kind: "sealed", receipt: { from: "2026-10-10", to: "2026-10-11", askFrom: 270, askTo: 275 } }, { day });
  t("an eBay ask move is not a proven price", !ask.ok);
  let threw = false;
  try { await provenBoard({ count: 0, reads: [mv(1, 10.6, "2026-10-03", 22.93, "2026-10-10")] }, { day }); } catch { threw = true; }
  t("count must equal length", threw);
  const ok = await provenBoard({ count: 1, reads: [mv(1, 10.6, "2026-10-03", 22.93, "2026-10-10")] }, { day });
  t("count equal to length passes", ok.kept.length === 1);
  t("rotation line only for F/G sets", isRotatedSet("SV: Scarlet & Violet 151") && isRotatedSet("SWSH11: Lost Origin") && !isRotatedSet("Prismatic Evolutions") && !isRotatedSet("Dragon Majesty"));
  t("daily email has a preheader in the text version", (await readFile(join(ROOT, "newsletter/out/daily-2026-10-11.txt"), "utf8")).startsWith("PREHEADER: "));
  return fail;
}
