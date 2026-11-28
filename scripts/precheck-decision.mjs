// Exit 1 only when the nightly pre-check should fail the job.
//   node scripts/precheck-decision.mjs <triage.json> --guard <exit>
// The json is the file scripts/triage-tests.mjs writes. Guard exit 0 is green.
import { readFile } from "node:fs/promises";
import { precheckWouldBlock } from "./lib/test-tiers.mjs";

const args = process.argv.slice(2);
const guardAt = args.indexOf("--guard");
const guardExit = guardAt >= 0 ? args[guardAt + 1] : 0;
const path = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--guard"));

let result;
try {
  result = JSON.parse(await readFile(path, "utf8"));
} catch {
  console.error("pre-check would block tonight's prices: no triage file");
  process.exit(1);
}
if (!result || !Array.isArray(result.blocked)) {
  console.error("pre-check would block tonight's prices: triage file has no blocked list");
  process.exit(1);
}
const decision = precheckWouldBlock(result, guardExit);
if (decision.block) {
  const why = decision.guardRed ? "guard audit" : "price safety";
  console.error(`pre-check would block tonight's prices (${why})`);
  process.exit(1);
}
console.log("pre-check would not block tonight's prices");
