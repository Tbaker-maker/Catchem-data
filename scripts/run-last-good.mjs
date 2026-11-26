// Run a price-run command. On failure, restore last-good files, record a skip,
// raise one deduped alert, and exit 0 so later steps still publish.
import { appendFileSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { lastGoodResult, recordPath, skipRecord } from "./lib/never-block.mjs";
import { applyAlertFromEnv } from "./lib/alert-apply.mjs";

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i + 1] || fallback;
}

const step = arg("--step", "unknown step");
const record = arg("--record", recordPath());
const dash = process.argv.indexOf("--");
const cmd = dash === -1 ? [] : process.argv.slice(dash + 1);
if (!cmd.length) {
  console.log("::warning::run-last-good: no command after --");
  process.exit(0);
}

function porcelain() {
  const r = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout : "";
}

const before = porcelain();
const ran = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", env: process.env });
const code = ran.status == null ? 1 : ran.status;
const after = porcelain();
const result = lastGoodResult({ exitCode: code, before, after });

if (result.action === "restore") {
  if (result.restore.checkout.length) {
    spawnSync("git", ["checkout", "--", ...result.restore.checkout], { stdio: "inherit" });
  }
  for (const path of result.restore.remove) {
    if (existsSync(path)) rmSync(path, { recursive: true, force: true });
  }
  const row = skipRecord({ step, restore: result.restore, code });
  if (record) appendFileSync(record, `${JSON.stringify(row)}\n`);
  console.log(`::warning::${step} failed. Restored last-good files and continued: ${(result.restore.checkout || []).join(", ") || "(none checked out)"}`);
  await applyAlertFromEnv({
    fingerprint: row.fingerprint,
    severity: "P1",
    happened: `${step} exited ${code}.`,
    impact: "Last-good files for this step stayed in place. Later steps still run and can publish.",
    alreadyDid: "Restored last-good files and continued the price run.",
    ask: "Nothing needed",
  });
}

process.exit(0);
