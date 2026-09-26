// Fail the daily run only when a private push was expected and did not land,
// or raw PPT is tracked in this public tree. Prices are committed before this.
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findPptPriceKeys, safetyVerdict } from "./lib/run-report.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

export async function checkSafety(root = ROOT) {
  const push = await readJson(join(root, "data/ppt/push-status.json"));
  let tracked = [];
  try {
    const { stdout } = await exec("git", ["ls-files"], { cwd: root });
    tracked = stdout.split("\n").filter(Boolean);
  } catch {
    tracked = [];
  }
  const status = push || { expected: false, pushed: false, reason: "no push status" };
  const fieldHits = [];
  for (const rel of tracked) {
    if (!rel.endsWith(".json")) continue;
    let body;
    try { body = JSON.parse(await readFile(join(root, rel), "utf8")); } catch { continue; }
    for (const hit of findPptPriceKeys(body, rel)) fieldHits.push(hit);
  }
  return safetyVerdict({ push: status, tracked, fieldHits });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const verdict = await checkSafety();
  if (!verdict.ok) {
    console.error(verdict.reasons.join("\n"));
    process.exit(1);
  }
  console.log("ppt safety ok");
}
