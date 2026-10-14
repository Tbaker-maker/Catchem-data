// Nightly list of open PRs with red CI or older than 3 days. Written to the
// private store. The failing check name is included when GitHub has one.
import { writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { janitorRows } from "./lib/ops-bots.mjs";
import { openPrivate } from "./lib/private-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (b) => { out += b; });
    child.stderr.on("data", (b) => { err += b; });
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

let prs = [];
if (process.argv.includes("--fixture")) {
  prs = JSON.parse(process.argv[process.argv.indexOf("--fixture") + 1] || "[]");
} else {
  const listed = await run("gh", ["pr", "list", "--repo", "Tbaker-maker/Catchem-data", "--state", "open", "--limit", "50", "--json", "number,title,createdAt,url"]);
  if (listed.code !== 0) {
    console.log(JSON.stringify({ prJanitor: { ok: false, reason: listed.err.slice(0, 200) } }));
    process.exit(0);
  }
  prs = JSON.parse(listed.out || "[]");
  for (const pr of prs) {
    const checks = await run("gh", ["pr", "checks", String(pr.number), "--repo", "Tbaker-maker/Catchem-data", "--json", "name,state,bucket"]);
    if (checks.code !== 0) { pr.checks = []; continue; }
    const rows = JSON.parse(checks.out || "[]");
    pr.checks = rows.map((row) => ({ name: row.name, conclusion: String(row.state || row.bucket || "").toLowerCase() === "failure" ? "failure" : row.state }));
  }
}
const rows = janitorRows(prs, new Date());
const asOf = new Date().toISOString().slice(0, 10);
const doc = { asOf, count: rows.length, rows };
let store;
try { store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" }); }
catch { store = await openPrivate({ root: ROOT, token: "" }); }
await mkdir(join(store.dir, "janitor"), { recursive: true });
await writeFile(join(store.dir, "janitor/latest.json"), JSON.stringify(doc, null, 1) + "\n");
const pushed = await store.close(["janitor/latest.json"], `pr janitor ${asOf}`);
console.log(JSON.stringify({ prJanitor: { asOf, count: rows.length, pushed: Boolean(pushed?.pushed) } }));
