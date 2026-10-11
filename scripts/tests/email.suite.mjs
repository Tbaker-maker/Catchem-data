import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintEmail } from "../lint-email.mjs";

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
  t("daily email does not pad", !daily.includes("Quiet night") || daily.includes("Fewer than 3"));
  return fail;
}
