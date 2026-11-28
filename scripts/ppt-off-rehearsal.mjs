// Dress rehearsal for PPT_OFF. No publish. No price API.
// Spawns the PPT entry points with the switch on, and blocks any PPT host
// if a guard is missing. Does not rewrite sealed prices. A held spread report,
// a held supply report, and the PPT skip logs may be rewritten, because those
// jobs record that they ran.
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { datasetCoverage } from "./lib/ppt-cutover.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPAWN = [
  "scripts/ppt-refresh.mjs",
  "scripts/fetch-sealed-crosscheck.mjs",
  "scripts/ppt-history-backfill.mjs",
  "scripts/mount-private-ppt.mjs",
  "scripts/push-private-ppt.mjs",
  "scripts/ppt-intraday.mjs",
  "scripts/ppt-slabs.mjs",
  "scripts/note-run-start.mjs",
  "scripts/resolve-set-ids.mjs",
  "scripts/fetch-singles-enrichment.mjs",
  "scripts/enrich-by-set.mjs",
  "scripts/extend-crosscheck-map.mjs",
  "scripts/verify-watchlist-prices.mjs",
  "scripts/graded-window-probe.mjs",
  "scripts/build-crosscheck-map.mjs",
  "scripts/import-history-backfill.mjs",
  "scripts/compute-divergence.mjs",
  "scripts/compute-supply-watch.mjs",
];

function runNode(rel) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", join(ROOT, "scripts/ppt-off-net-block.mjs"), join(ROOT, rel)], {
      cwd: ROOT,
      env: {
        ...process.env,
        PPT_OFF: "1",
        POKEMONPRICETRACKER_API_KEY: "",
        PKMNPRICES_API_KEY: "",
        PRIVATE_DATA_TOKEN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 20000);
    child.stdout.on("data", (buf) => { out += buf.toString(); });
    child.stderr.on("data", (buf) => { out += buf.toString(); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        script: rel,
        code,
        blocked: /PPT request blocked|refused a Pokemon Price Tracker request/.test(out),
        skipped: /PPT_OFF:/.test(out) || /was not read/.test(out),
        tail: out.trim().split("\n").slice(-3).join(" | ").slice(0, 240),
      });
    });
  });
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const steps = [];
for (const rel of SPAWN) steps.push(await runNode(rel));

const cov = await datasetCoverage(ROOT, { readJson, env: { PPT_OFF: "1" } });
const report = {
  at: new Date().toISOString().slice(0, 10),
  pptOff: "1",
  network: "PPT host blocked. No PkmnPrices key. No eBay call.",
  steps,
  coverage: cov,
  notRun: [
    "Price writers, the public bundle, and publish-public-data.mjs were not run. This rehearsal does not publish. Sealed prices are not rewritten. Held reports and PPT skip logs may be.",
    "Steps that call TCGCSV, eBay, or pokemontcg.io were not run. No extra paid call was made.",
  ],
};
const outPath = process.env.PPT_OFF_REPORT || "";
if (outPath) await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
const failed = steps.filter((row) => row.code !== 0 || row.blocked);
console.log(JSON.stringify({ outPath, steps: steps.length, failed: failed.length, ready: cov.ready, rows: cov.rows.map((row) => ({ id: row.id, pppN: row.pppN, min: row.min, switched: row.switched })) }, null, 2));
if (failed.length) {
  for (const row of failed) console.error("FAIL", row.script, row.code, row.tail);
  process.exit(1);
}
