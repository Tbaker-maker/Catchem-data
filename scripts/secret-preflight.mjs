// Set has_<NAME> outputs for every secret in the manifest. Missing secrets
// warn, raise one needs-yes alert, and never fail the run. Names only.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preflight, missingAlerts, presentFixes, writeOutputs } from "./lib/secret-preflight.mjs";
import { applyAlertFromEnv } from "./lib/alert-apply.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry-run");
const manifest = JSON.parse(await readFile(join(ROOT, "config/secrets-manifest.json"), "utf8"));
const rows = preflight(manifest, process.env);

for (const row of rows) {
  console.log(`${row.name}  ${row.present ? "set" : "not set"}`);
  if (!row.present) {
    console.log(`::warning::${row.name} is not set. ${row.feature || "That feature"} is off. Last-good data stays as it is.`);
  }
}

if (process.env.GITHUB_OUTPUT) writeOutputs(rows, process.env.GITHUB_OUTPUT);

if (!dry) {
  for (const alert of missingAlerts(rows)) {
    await applyAlertFromEnv(alert);
  }
  for (const alert of presentFixes(rows)) {
    await applyAlertFromEnv(alert);
  }
}

process.exit(0);
