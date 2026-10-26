// Adds one group to tonight's withhold list after a later builder crashed.
//   node scripts/withhold-group.mjs <group key> "<reason>"
// Only a group named in scripts/lib/test-tiers.mjs can be withheld; anything
// else exits 1, so an unknown crash still stops the run (fail closed).
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { GROUPS, describe } from "./lib/test-tiers.mjs";

const [key, reason = "builder crashed"] = process.argv.slice(2);
const file = "data/derived/test-triage.json";
const g = GROUPS.find((x) => x.key === key);
if (!g) { console.error(`no withhold group named ${key}`); process.exit(1); }
let doc;
try { doc = JSON.parse(await readFile(file, "utf8")); } catch { doc = { mode: "nightly", finished: true, blocked: [], withheld: [], monitor: [], paths: [] }; }
if (doc.blocked?.length) process.exit(1);
let row = doc.withheld.find((x) => x.key === key);
if (!row) { row = { key, label: g.label, paths: g.paths, tests: [] }; doc.withheld.push(row); }
row.tests.push({ name: reason, inner: [] });
doc.paths = [...new Set(doc.withheld.flatMap((x) => x.paths))];
doc.summary = describe(doc);
await writeFile(file, JSON.stringify(doc, null, 2) + "\n");
console.log(`::warning::withheld ${g.label}: ${reason}`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Withheld after a crash: ${g.label} (${reason})\n\n`);
