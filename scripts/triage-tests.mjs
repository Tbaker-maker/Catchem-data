// Sorts a run-tests.mjs log into block, withhold and monitor (scripts/lib/test-tiers.mjs).
//   node scripts/triage-tests.mjs <log> [--mode nightly|pr] [--out triage.json]
// Exit 1 only when something blocks. Writes the plain summary to the job
// summary and `blocked`, `withheld` outputs for later steps.
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { triage, describe } from "./lib/test-tiers.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const log = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const mode = opt("--mode", "nightly");
const outPath = opt("--out", "data/derived/test-triage.json");

let text = "";
try { text = await readFile(log, "utf8"); } catch { text = ""; }
const result = triage(text, mode);
const words = describe(result);
await writeFile(outPath, JSON.stringify({ ...result, summary: words, at: new Date().toISOString() }, null, 2) + "\n");
console.log(words);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Tonight's tests\n\n${words}\n\n`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `blocked=${result.blocked.length ? "1" : "0"}\nwithheld=${result.withheld.map((g) => g.key).join(",")}\n`);
}
process.exit(result.blocked.length ? 1 : 0);
