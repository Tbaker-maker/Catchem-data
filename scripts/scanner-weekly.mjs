// Weekly scanner report. Reads the private scanner summary when it is mounted
// and writes the report back to the private store.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { scannerWeekly } from "./lib/scanner-report.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };

const localSummary = await read(join(ROOT, "data/private/scanner/summary.json"));
const localWeights = await read(join(ROOT, "data/private/scanner/weights.json"));
const asOf = String(localSummary?.asOf || localWeights?.asOf || new Date().toISOString()).slice(0, 10);
const report = scannerWeekly({ asOf, summary: localSummary, weights: localWeights });
let store;
try { store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" }); }
catch { store = await openPrivate({ root: ROOT, token: "" }); }
await mkdir(join(store.dir, "scanner/weekly"), { recursive: true });
const rel = `scanner/weekly/${asOf}.json`;
await writeFile(join(store.dir, rel), JSON.stringify(report, null, 1) + "\n");
const pushed = await store.close([rel], `scanner weekly ${asOf}`);
console.log(JSON.stringify({ scannerWeekly: { asOf, passed: report.passed, pushed: Boolean(pushed?.pushed) } }));
