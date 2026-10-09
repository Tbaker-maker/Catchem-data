// Run the four nightly data checks in order.
// One printed line per check, taken from that script.
// Exit 1 only when check-stale or check-coverage exits 1.
// Does not invent prices and does not rewrite feed copy.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  "check-half-price.mjs",
  "check-stale.mjs",
  "check-coverage.mjs",
  "write-learning-log.mjs",
];

function oneLine(name, stdout, stderr) {
  const fromOut = String(stdout || "").trim().split(/\r?\n/).filter(Boolean);
  if (fromOut.length) return fromOut[0];
  const fromErr = String(stderr || "").trim().split(/\r?\n/).filter(Boolean);
  if (fromErr.length) return fromErr[0];
  return `${name} produced no line.`;
}

// atRunStart: called from note-run-start, before the feed is rebuilt. The
// stale check then compares the feed with the published (committed) catalog
// day, because the early TCGCSV step has already written today's day.
export function runNightlyChecks({ atRunStart = false } = {}) {
  let fail = 0;
  for (const name of STEPS) {
    const extra = atRunStart && name === "check-stale.mjs" ? ["--at-run-start"] : [];
    const child = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), name), ...extra], {
      cwd: ROOT,
      encoding: "utf8",
    });
    console.log(oneLine(name, child.stdout, child.stderr));
    const code = child.status == null ? 1 : child.status;
    if ((name === "check-stale.mjs" || name === "check-coverage.mjs") && code === 1) fail = 1;
  }
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runNightlyChecks());
}
