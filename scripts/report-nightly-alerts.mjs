// Flush skip records from run-last-good into one deduped alert per fingerprint.
// Also writes a rollup when any step was skipped. Exits 0 always.
import { readFile } from "node:fs/promises";
import { applyAlertFromEnv } from "./lib/alert-apply.mjs";

const path = process.argv[2] || process.env.CATCHEM_NEVER_BLOCK_RECORD || "/tmp/catchem-never-block.jsonl";
let lines = [];
try {
  lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
} catch {
  lines = [];
}
const rows = [];
for (const line of lines) {
  try { rows.push(JSON.parse(line)); } catch { /* skip a bad line */ }
}

const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || ""}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;

if (!rows.length) {
  await applyAlertFromEnv({
    fingerprint: "nightly:update-sealed-prices",
    severity: "P1",
    fixed: true,
    happened: "The price run finished with no never-block skips.",
    impact: "Nothing withheld by this check.",
    alreadyDid: "No last-good restore was needed.",
    ask: "Nothing needed",
  });
  console.log("no never-block skips");
  process.exit(0);
}

const names = rows.map((r) => r.step).join(", ");
for (const row of rows) {
  await applyAlertFromEnv({
    fingerprint: row.fingerprint || `nightly-step:${row.step}`,
    severity: "P1",
    happened: `${row.step} failed and was skipped.`,
    impact: "Last-good files for this step stayed in place. Later steps still ran.",
    alreadyDid: `Restored last-good files and continued. Run: ${run}`,
    ask: "Nothing needed",
  });
}
await applyAlertFromEnv({
  fingerprint: "nightly:update-sealed-prices",
  severity: "P1",
  happened: `The price run skipped: ${names}.`,
  impact: "Last-good data was kept for those steps. Other steps still published.",
  alreadyDid: `Continued the run after last-good restores. Run: ${run}`,
  ask: "Nothing needed",
});
console.log(`reported ${rows.length} skip(s)`);
process.exit(0);
