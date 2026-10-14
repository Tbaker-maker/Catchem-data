import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanText, cleanDoc, enforceCopy, isClean, REPLACEMENTS } from "../lib/copy-rules.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => { console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail += 1; };
  const idDoc = { id: "scan-pattern-forming-breakout-tcgcsv-84658", key: "support-bottom", slug: "hold-target", url: "https://x.test/buy", file: "data/printed/play.json", headline: "Up 4% since Oct 1" };
  t("ids, keys, slugs, urls and paths with banned words pass", cleanDoc(idDoc).errors.length === 0 && cleanDoc(idDoc).fixes.length === 0);
  t("a machine id in a visible field is not checked", isClean("scan-pattern-forming-breakout-tcgcsv-84658"));
  t("whole words only: words inside other words pass", isClean("Holographic playmat from Bottomley, a supplyless Targetless line") && isClean("Upholds its range") === true);
  t("breakout is rewritten", cleanText("A breakout this week").text === "A climb past its range this week");
  t("bottom is rewritten", cleanText("Near the bottom of its year").text === "Near the low of its year");
  t("support and resistance are rewritten", cleanText("At support").text === "At recent low range" && cleanText("At resistance").text === "At recent high range");
  t("printed is rewritten", cleanText("The printed price").text === "The recorded price");
  t("an em dash becomes a comma", cleanText("Up 4% \u2014 since Oct 1").text === "Up 4%, since Oct 1");
  t("supply alone becomes listings counted", cleanText("supply fell").text === "listings counted fell");
  for (const w of ["buy", "sell", "hold", "target", "invest", "play", "stack", "load up", "crypto"]) {
    const r = cleanText(`time to ${w} now`, { field: "why", id: "r-1" });
    t(`${w} with no replacement fails and names the field and read`, r.errors.length === 1 && /field "why"/.test(r.errors[0]) && /read r-1/.test(r.errors[0]));
  }
  t("No data fails", cleanText("No data yet", { field: "body" }).errors.length === 1);
  let thrown = "";
  try { enforceCopy({ reads: [{ id: "x-9", why: "a good buy" }] }, "reads"); } catch (e) { thrown = e.message; }
  t("enforceCopy throws with the field and read id", /field "why" of read x-9/.test(thrown));
  const fixed = enforceCopy({ reads: [{ id: "x-8", why: "A breakout from the bottom" }] }, "reads");
  t("enforceCopy rewrites and keeps going", fixed.reads[0].why === "A climb past its range from the low");
  t("every replacement is itself clean", Object.values(REPLACEMENTS).every((r) => isClean(r)));

  // Today's real board: report visible-text hits, never fail on them here.
  const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
  const r = cleanDoc(reads);
  console.log(`  reads.json visible-text hits: ${r.fixes.length} rewrites, ${r.errors.length} hard`);
  for (const h of [...r.fixes.map((f) => `rewrite ${f.id} ${f.field}: ${f.from} -> ${f.to}`), ...r.errors].slice(0, 40)) console.log(`    ${h}`);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("copy-rules.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
