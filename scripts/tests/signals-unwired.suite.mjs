import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STORE = "data/private/ledger/" + "signals.json";
const FIELD = "proven" + "ForUse";

async function files(dir, out = []) {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    if (name.name === "node_modules") continue;
    const path = join(dir, name.name);
    if (name.isDirectory()) await files(path, out);
    else if (name.name.endsWith(".mjs") || name.name.endsWith(".js")) out.push(path);
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, cond, extra = "") => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name, extra); } };
  const hits = [];
  for (const path of await files(ROOT)) {
    const text = await readFile(path, "utf8");
    if (text.includes(STORE) || text.includes(FIELD)) hits.push(path);
  }
  t("no public script imports the private signal store", hits.length === 0, hits.join(", "));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("signals-unwired.suite.mjs")) process.exit(await run() ? 1 : 0);
