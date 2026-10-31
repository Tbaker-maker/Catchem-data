// Opens one issue when the nightly tests fail.
// Title: "Nightly run failed <date>" (America/Los_Angeles).
// Body: the failing test names. A red night does not retry and does not publish.
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const TITLE = `Nightly run failed ${date}`;
const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || ""}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
let doc = null;
try { doc = JSON.parse(await readFile(process.argv[2] || "data/derived/test-triage.json", "utf8")); } catch { doc = null; }
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8" });

function addNames(f, out) {
  if (!f) return;
  if (Array.isArray(f.inner) && f.inner.length) for (const name of f.inner) out.push(name);
  else if (f.name) out.push(f.name);
  for (const test of f.tests || []) addNames(test, out);
}

const names = [];
if (doc) {
  for (const row of doc.blocked || []) addNames(row, names);
  for (const row of doc.withheld || []) addNames(row, names);
  for (const row of doc.monitor || []) addNames(row, names);
}
const unique = [...new Set(names)];
const trouble = !doc || unique.length > 0 || doc.blocked?.length || doc.withheld?.length;
const list = unique.length ? unique.map((name) => `- ${name}`).join("\n") : (doc?.summary || "No test names were written.");
const body = `Run: ${run}\n\nFailing tests:\n${list}`;

if (!trouble) {
  console.log("clean night, no issue");
  process.exit(0);
}
let open = [];
try { open = JSON.parse(gh("issue", "list", "--state", "open", "--search", `in:title "${TITLE}"`, "--json", "number,title")).filter((i) => i.title === TITLE); } catch { open = []; }
try {
  if (open.length) { gh("issue", "comment", String(open[0].number), "--body", body); console.log(`updated issue #${open[0].number}`); }
  else { console.log(gh("issue", "create", "--title", TITLE, "--body", body).trim()); }
} catch (e) {
  console.log(`::warning::issue not updated: ${String(e.message).split("\n")[0]}`);
}
