// node scripts/test-baseline.mjs <pr log> <base log>
// Exit 1 when the PR has a failing test that the base commit does not have.
import { readFile, appendFile } from "node:fs/promises";
import { compareToBase, describeBaseline } from "./lib/test-baseline.mjs";

const [prLog, baseLog] = process.argv.slice(2);
const read = async (p) => { try { return await readFile(p, "utf8"); } catch { return ""; } };
const result = compareToBase(await read(prLog), await read(baseLog));
const words = describeBaseline(result);
console.log(words);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Tests against the base commit\n\n${words}\n\n`);
process.exit(result.fresh.length || !result.prFinished ? 1 : 0);
