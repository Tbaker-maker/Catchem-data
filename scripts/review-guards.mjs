// Pull request review holds. Run from pr-tests.
// Private limits are read only when PRIVATE_DATA_TOKEN is set. Without it,
// fixture files must carry a fake marker and this process prints a notice.
// It does not pass silently. It does not print the token or a limit value.
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { dashProblems, fixtureMarkerProblems, mergeIndexes, privateLimitProblems, writerProblems } from "./lib/review-guards.mjs";
import { READERS } from "./lib/public-sources.mjs";

const root = process.env.REVIEW_GUARDS_ROOT || process.cwd();

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

async function walk(dir, out) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (/\.(mjs|json|md)$/.test(entry.name)) out.push(path);
  }
}

async function testFiles() {
  const abs = [];
  await walk(join(root, "scripts/tests"), abs);
  const files = [];
  for (const path of abs) {
    const rel = path.slice(root.length + 1).replaceAll("\\", "/");
    files.push({ path: rel, text: await readFile(path, "utf8") });
  }
  return files;
}

async function privateConfigs(token) {
  const file = process.env.REVIEW_GUARDS_LIMITS_FILE || "";
  if (file) return [JSON.parse(await readFile(file, "utf8"))];
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "catchem-review-guards",
  };
  const list = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config", { headers, signal: AbortSignal.timeout(20000) });
  if (!list.ok) return null;
  const rows = await list.json();
  const configs = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row.name || !row.name.endsWith(".json")) continue;
    const res = await fetch(row.url, { headers, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const body = await res.json();
    const text = Buffer.from(String(body.content || "").replace(/\n/g, ""), "base64").toString("utf8");
    configs.push(JSON.parse(text));
  }
  return configs;
}

const problems = [];
const base = process.env.BASE_SHA || "";
if (!base) {
  console.error("FAIL review guards: BASE_SHA is not set, so the diff checks cannot run");
  process.exit(1);
}
let names = "";
let diff = "";
let messages = "";
try {
  names = git(["diff", "--name-only", `${base}...HEAD`]);
  diff = git(["diff", "-U0", `${base}...HEAD`]);
  messages = git(["log", "--format=%B", `${base}...HEAD`]);
} catch (err) {
  console.error(`FAIL review guards: could not diff ${base}...HEAD`);
  process.exit(1);
}
const changed = names ? names.split("\n").filter(Boolean) : [];
for (const problem of dashProblems(diff)) problems.push(problem);
for (const problem of writerProblems({ files: changed, messages, readers: READERS })) problems.push(problem);

const token = process.env.PRIVATE_DATA_TOKEN || "";
const files = await testFiles();
if (!token && !process.env.REVIEW_GUARDS_LIMITS_FILE) {
  console.log("NOTICE: PRIVATE_DATA_TOKEN is not set. Live limit comparison skipped.");
  const marker = fixtureMarkerProblems(files);
  if (!marker.length) console.log("NOTICE: fixtures carry a fake marker.");
  else for (const problem of marker) problems.push(problem);
} else {
  const configs = await privateConfigs(token);
  if (!configs) {
    console.error("FAIL review guards: private config could not be read. Not a pass.");
    process.exit(1);
  }
  for (const problem of privateLimitProblems(files, mergeIndexes(configs))) problems.push(problem);
}

if (problems.length) {
  for (const problem of problems) console.error(`FAIL ${problem}`);
  process.exit(1);
}
console.log("review guards: ok");
