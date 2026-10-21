// Root cause guard (Oct 20): an eBay 429 tripped the wipe guard, the eBay step
// exited 1 and the whole sealed run died before TCGCSV, PPT and publish.
// eBay must never gate the daily TCGplayer and PPT publish.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const wf = readFileSync(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
const steps = wf.split(/\n(?=      - name: )/).slice(1);
const i = steps.findIndex(s => /fetch-sealed-prices\.mjs/.test(s));
const fails = [];
if (i < 0) fails.push("eBay fetch step not found");
else {
  const s = steps[i];
  if (!/\n\s+continue-on-error:\s*true/.test(s)) fails.push("eBay fetch step lacks continue-on-error: true");
  const id = (s.match(/\n\s+id:\s*([\w-]+)/) || [])[1];
  for (const d of steps.slice(i + 1)) {
    const ifl = (d.match(/\n\s+if:\s*(.+)/) || [])[1] || "";
    if (id && new RegExp(`steps\\.${id}\\.`).test(ifl)) fails.push(`downstream step depends on eBay: ${d.split("\n")[0].trim()}`);
  }
  for (const want of ["backfill-tcgcsv.mjs", "fetch-sealed-crosscheck.mjs", "build-feed.mjs", "publish-public-data.mjs"]) {
    const d = steps.slice(i + 1).find(x => x.includes(want));
    if (!d) fails.push(`${want} must run after the eBay step`);
    else if (/\n\s+if:\s*success\(\)/.test(d)) fails.push(`${want} is gated on success()`);
  }
}
for (const f of fails) console.log(`  FAIL ebay nonblocking: ${f}`);
if (fails.length) { process.exitCode = 1; throw new Error(`ebay nonblocking: ${fails.length} failed`); }
console.log("  ok  ebay step cannot block TCGCSV, PPT, feed or publish");
