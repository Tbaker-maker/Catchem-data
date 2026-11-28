// Missing secrets never fail the price run. Preflight reports has_<NAME>
// outputs, warns, and raises one needs-yes alert per secret name. Names only.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { missingAlerts, presentFixes, preflight, writeOutputs } from "../lib/secret-preflight.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond, detail) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? ` (${detail})` : ""}`); }
  };

  const manifest = JSON.parse(await readFile(join(ROOT, "config/secrets-manifest.json"), "utf8"));
  t("the manifest is a list of named secrets", Array.isArray(manifest) && manifest.length >= 8);
  t("every row has a name and a feature and no value field", manifest.every((row) => row.name && row.feature && !("value" in row) && !("secret" in row)));
  const names = manifest.map((row) => row.name);
  for (const need of ["POKEMONTCG_API_KEY", "MIRROR_REMOTE_URL", "DRIFT_BOT_TOKEN", "PRIVATE_DATA_TOKEN", "EBAY_APP_ID", "POKEMONPRICETRACKER_API_KEY"]) {
    t(`manifest includes ${need}`, names.includes(need));
  }
  t("GITHUB_TOKEN is not a repo secret in the manifest", !names.includes("GITHUB_TOKEN"));

  const env = { POKEMONTCG_API_KEY: "x", MIRROR_REMOTE_URL: "" };
  const rows = preflight(manifest, env);
  const tcg = rows.find((r) => r.name === "POKEMONTCG_API_KEY");
  const mirror = rows.find((r) => r.name === "MIRROR_REMOTE_URL");
  const drift = rows.find((r) => r.name === "DRIFT_BOT_TOKEN");
  t("a present secret is marked set with has_ output", tcg.present === true && tcg.outputKey === "has_POKEMONTCG_API_KEY");
  t("an empty secret is marked not set", mirror.present === false && mirror.outputKey === "has_MIRROR_REMOTE_URL");
  t("a missing env var is marked not set", drift.present === false);
  t("results never include the secret value", rows.every((r) => !("value" in r) && r.present === Boolean(r.present)));

  const alerts = missingAlerts(rows);
  t("each missing secret becomes one needs-yes fingerprint", alerts.every((a) => a.needsYes === true && a.fingerprint.startsWith("secret-missing:") && a.severity === "P2"));
  t("a present secret does not raise an alert", !alerts.some((a) => a.fingerprint === "secret-missing:POKEMONTCG_API_KEY"));
  t("a missing secret does raise an alert", alerts.some((a) => a.fingerprint === "secret-missing:MIRROR_REMOTE_URL"));

  const outFile = join(await mkdtemp(join(tmpdir(), "preflight-")), "out.txt");
  writeOutputs(rows.slice(0, 2), outFile);
  const text = await readFile(outFile, "utf8");
  t("outputs are has_NAME=true or false only", /^has_[A-Z0-9_]+=(true|false)$/m.test(text) && !text.includes("x"));
  await rm(dirname(outFile), { recursive: true, force: true });

  const script = await readFile(join(ROOT, "scripts/secret-preflight.mjs"), "utf8");
  const lib = await readFile(join(ROOT, "scripts/lib/secret-preflight.mjs"), "utf8");
  t("the preflight scripts never print process.env values", !/console\.(log|info|warn|error)\([^)]*process\.env/.test(script + lib));

  const dry = spawnSync(process.execPath, [join(ROOT, "scripts/secret-preflight.mjs"), "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, POKEMONTCG_API_KEY: "should-never-appear", MIRROR_REMOTE_URL: "", DRIFT_BOT_TOKEN: "" },
  });
  t("dry run exits 0 even when secrets are missing", dry.status === 0);
  t("dry run lists names as set or not set", /POKEMONTCG_API_KEY\s+set/.test(dry.stdout) && /MIRROR_REMOTE_URL\s+not set/.test(dry.stdout));
  t("dry run never prints a secret value", !String(dry.stdout + dry.stderr).includes("should-never-appear"));

  const fixes = presentFixes(rows);
  t("a present secret is queued to close its missing-secret alert", fixes.some((a) => a.fixed === true && a.fingerprint === "secret-missing:POKEMONTCG_API_KEY"));
  t("a missing secret is not marked fixed", !fixes.some((a) => a.fingerprint === "secret-missing:MIRROR_REMOTE_URL"));

  return fail;
}
