// Dress rehearsal of .github/workflows/update-sealed-prices.yml.
// Runs the same steps against the current checkout so one run shows every
// failure, not only the first one.
//
// Safety, for this process and every child it starts:
// - git, gh, curl and wget are PATH shims in a temp bin dir at the front of
//   PATH, so a bash step and a node execSync or spawn call hit the same shim.
//   git push, git pull and git config writes are blocked (a push only moves
//   the local dress-rehearsal-throwaway branch). gh, curl and wget never run.
// - NODE_OPTIONS imports dress-rehearsal-preload.mjs by absolute path, which
//   throws on any api.ebay.com request.
// - publish-public-data.mjs is called without --push.
// - Every secret the nightly reads is blank. A step that cannot work without
//   one is logged as SKIPPED: needs secret X and is not a failure.
// - EBAY_REPLAY=1: fetch-sealed-prices.mjs replays the newest saved
//   data/raw/ebay-sealed/YYYY-MM-DD.json.gz through its normal write path.
//
// Keep-going mode (on unless DRESS_KEEP_GOING=0): a step with no if, or with
// success(), still runs after a hard failure and is labelled "ran after
// earlier failure". always() and failure() keep their meaning. The unit test
// step also runs every suite on its own so each failing suite is listed.
// The end of the log is one table of every step.

import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW = join(ROOT, ".github/workflows/update-sealed-prices.yml");
const PRELOAD = join(ROOT, "scripts/dress-rehearsal-preload.mjs");

// Secrets a step can do without: the scripts fall back to public files.
const OPTIONAL_SECRETS = new Set(["PRIVATE_DATA_TOKEN", "YOUTUBE_API_KEY"]);
// Secrets the rehearsal replaces: eBay comes from the saved night.
const REPLAYED_SECRETS = new Set(["EBAY_APP_ID", "EBAY_CERT_ID"]);
// Steps whose whole job is the private repo still need PRIVATE_DATA_TOKEN.
const PRIVATE_ONLY_STEP = /^Pull private |\bprivate (repo|log|history|state)\b/i;
const PRIVATE_ONLY_RUN = /scripts\/(mount|push)-private-|ppp-private-sync\.mjs/;

export function parseWorkflowSteps(yaml) {
  const lines = String(yaml).split(/\n/);
  let inSteps = false;
  let inRun = false;
  let runIndent = 0;
  let inEnv = false;
  const steps = [];
  let cur = null;
  const push = () => { if (cur) steps.push(cur); cur = null; inEnv = false; };
  for (const line of lines) {
    if (!inSteps) {
      if (/^    steps:\s*$/.test(line)) inSteps = true;
      continue;
    }
    if (inRun) {
      if (line.trim() === "") { cur.run += "\n"; continue; }
      const ind = line.match(/^ */)[0].length;
      if (ind >= runIndent) { cur.run += (cur.run ? "\n" : "") + line.slice(runIndent); continue; }
      inRun = false;
    }
    if (/^      - name:/.test(line)) {
      push();
      cur = {
        name: line.replace(/^      - name:\s*/, "").trim(),
        id: "",
        run: "",
        uses: "",
        continueOnError: false,
        if: "",
        env: {},
        secrets: [],
      };
      continue;
    }
    if (!cur) continue;
    if (/^  \S/.test(line) || /^[^ ]/.test(line)) { push(); inSteps = false; continue; }
    if (inEnv) {
      const em = line.match(/^          ([A-Za-z0-9_]+):\s*(.*)$/);
      if (em) {
        let val = em[2].trim();
        const quoted = val.match(/^"([^"]*)"/) || val.match(/^'([^']*)'/);
        if (quoted) val = quoted[1];
        else val = val.replace(/\s+#.*$/, "").trim();
        for (const m of val.matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)) {
          if (!cur.secrets.includes(m[1])) cur.secrets.push(m[1]);
        }
        val = val.replace(/\$\{\{\s*secrets\.[^}]+\}\}/g, "");
        val = val.replace(/\$\{\{\s*github\.[^}]+\}\}/g, "");
        cur.env[em[1]] = val;
        continue;
      }
      inEnv = false;
    }
    const id = line.match(/^        id:\s*(.+)$/);
    if (id) cur.id = id[1].trim();
    const uses = line.match(/^        uses:\s*(.+)$/);
    if (uses) cur.uses = uses[1].trim();
    if (/^        continue-on-error:\s*true\b/.test(line)) cur.continueOnError = true;
    const iff = line.match(/^        if:\s*(.+)$/);
    if (iff) cur.if = iff[1].trim();
    if (/^        env:\s*$/.test(line)) { inEnv = true; continue; }
    if (/^        run:\s*\|\s*$/.test(line)) { inRun = true; runIndent = 10; cur.run = ""; continue; }
    const inline = line.match(/^        run:\s*(\S.*)$/);
    if (inline) cur.run = inline[1];
  }
  push();
  return steps;
}

// Secrets this step cannot run without. The rehearsal never has them.
export function neededSecrets(step) {
  const out = [];
  for (const name of step.secrets || []) {
    if (REPLAYED_SECRETS.has(name)) continue;
    if (OPTIONAL_SECRETS.has(name)) {
      if (name === "PRIVATE_DATA_TOKEN" && (PRIVATE_ONLY_STEP.test(step.name) || PRIVATE_ONLY_RUN.test(step.run || ""))) out.push(name);
      continue;
    }
    out.push(name);
  }
  return out;
}

export function allSecrets(steps) {
  const all = new Set();
  for (const s of steps) for (const n of s.secrets || []) all.add(n);
  return [...all];
}

export function dressRun(script) {
  return String(script || "").replace(/node scripts\/publish-public-data\.mjs --push\b/g, "node scripts/publish-public-data.mjs");
}

function realBinary(name, pathValue) {
  for (const dir of String(pathValue || "").split(delimiter)) {
    if (!dir) continue;
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return "";
}

// Writes git, gh, curl and wget shims into a new temp bin dir and returns
// { bin, path, realGit } where path puts that dir first. The git shim reads
// DRESS_ROOT to know which checkout must not get config writes.
export function installShims(basePath = process.env.PATH || "") {
  const bin = mkdtempSync(join(tmpdir(), "dress-bin-"));
  const realGit = realBinary("git", basePath) || "/usr/bin/git";
  const git = readFileSync(join(ROOT, "scripts/dress-rehearsal-git-shim.sh"), "utf8").replace("__REAL_GIT__", realGit);
  const block = (name) => `#!/usr/bin/env bash
# dress rehearsal ${name} shim: never runs.
echo "dress rehearsal: blocked ${name}" >&2
exit 0
`;
  writeFileSync(join(bin, "git"), git);
  for (const name of ["gh", "curl", "wget"]) writeFileSync(join(bin, name), block(name));
  for (const name of ["git", "gh", "curl", "wget"]) chmodSync(join(bin, name), 0o755);
  return { bin, path: [bin, basePath].filter(Boolean).join(delimiter), realGit };
}

export function nodeOptionsWithPreload(existing = "") {
  const flag = `--import=${PRELOAD}`;
  return String(existing || "").includes(flag) ? existing : [existing, flag].filter(Boolean).join(" ");
}

function evalExpr(expr, ctx, keepGoing) {
  const e = String(expr || "").trim();
  if (e === "always()") return true;
  if (e === "failure()") return ctx.hardFailed;
  if (e === "success()") return keepGoing ? true : !ctx.hardFailed;
  if (e === "cancelled()") return false;
  const parts = e.split(/\s*&&\s*/);
  if (parts.length > 1) return parts.every((part) => evalExpr(part, ctx, keepGoing));
  const m = e.match(/^steps\.([A-Za-z0-9_-]+)\.(?:outcome|conclusion)\s*==\s*'(success|failure|skipped)'$/);
  if (m) return ctx.outcomes[m[1]] === m[2];
  console.log("dress rehearsal: unrecognized if, treated as success(): " + e);
  return keepGoing ? true : !ctx.hardFailed;
}

// True when the expression is gated on the run being green: a blank if is an
// implicit success(). Those are the steps keep-going mode runs anyway.
function successGated(expr) {
  const e = String(expr || "").trim();
  if (!e) return true;
  if (/\b(always|failure|cancelled)\(\)/.test(e)) return false;
  return true;
}

export function expandGha(script, ctx) {
  return String(script || "").replace(/\$\{\{\s*([^}]+)\s*\}\}/g, (_, raw) => {
    const e = raw.trim();
    const step = e.match(/^steps\.([A-Za-z0-9_-]+)\.(outcome|conclusion)$/);
    if (step) return ctx.outcomes[step[1]] || "";
    if (e === "github.repository") return process.env.GITHUB_REPOSITORY || "Tbaker-maker/Catchem-data";
    if (e === "github.run_id") return process.env.GITHUB_RUN_ID || "0";
    if (e === "github.run_attempt") return process.env.GITHUB_RUN_ATTEMPT || "1";
    if (e === "github.sha") return process.env.GITHUB_SHA || "dress";
    if (e === "github.ref") return process.env.GITHUB_REF || "refs/heads/dress-rehearsal-throwaway";
    if (e === "github.server_url") return "https://github.com";
    if (e === "github.workflow") return "Nightly dress rehearsal";
    if (e === "github.job") return "rehearse";
    if (e === "github.actor") return process.env.GITHUB_ACTOR || "dress-rehearsal";
    return "";
  });
}

// { run, afterFailure } for one step in the current run state.
export function shouldRun(expr, ctx, keepGoing = true) {
  const run = evalExpr(String(expr || "").trim() || "success()", ctx, keepGoing);
  const afterFailure = run && ctx.hardFailed && successGated(expr);
  return { run, afterFailure };
}

const ERROR_LINE = /(✗|💥|\bFAIL\b|\bFAILED\b|\bError\b|ERROR|fatal:|ENOENT|Cannot find|not found|failed|refus|::error::)/;

export function firstErrorLine(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .filter((l) => !/^dress rehearsal: blocked/.test(l) && !/^::warning::/.test(l));
  const hit = lines.find((l) => ERROR_LINE.test(l) && !/^\s*(ok|✓)\b/.test(l));
  return (hit || lines.at(-1) || "").slice(0, 200);
}

function runShell(script, env) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["--noprofile", "--norc", "-e", "-c", script], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const keep = (chunk) => { out += chunk.toString(); if (out.length > 4_000_000) out = out.slice(-2_000_000); };
    child.stdout.on("data", (c) => { process.stdout.write(c); keep(c); });
    child.stderr.on("data", (c) => { process.stderr.write(c); keep(c); });
    child.on("close", (code) => resolve({ code: code == null ? 1 : code, output: out }));
  });
}

// The suites the nightly runner loads: every *.suite.mjs plus each *.test.mjs
// that run-tests.mjs names.
export function suiteFiles(testsDir, runnerText) {
  const names = readdirSync(testsDir).sort();
  const suites = names.filter((n) => n.endsWith(".suite.mjs"));
  const tests = names.filter((n) => n.endsWith(".test.mjs")).filter((n) => {
    const base = n.replace(/\.test\.mjs$/, "");
    return runnerText.includes(`./${n}`) || runnerText.includes(`"${base}"`);
  });
  return [...tests, ...suites];
}

const SUITE_WRAPPER = `
const file = process.env.SUITE_FILE;
if (!file) { console.error("SUITE_FILE is not set"); process.exit(1); }
const mod = await import(file);
let failed = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok  " + name);
  else { failed += 1; console.error("  FAIL " + name + (detail ? ": " + detail : "")); }
};
const fns = Object.entries(mod).filter(([k, v]) => typeof v === "function" && (k === "run" || /^run[A-Z].*Tests?$/.test(k)));
for (const [, fn] of fns) {
  const n = await fn(t);
  if (typeof n === "number") failed += n;
}
if (failed) { console.error("SUITE: " + failed + " failed"); process.exit(1); }
`;

// node --input-type=module -e puts a trailing path in argv[1]. Suites that
// self-run when argv[1] ends with their filename then run again from this
// wrapper. board-determinism is three rebuilds (about 20 minutes) and the
// second pass blows the 30 minute cap (exit 124). The path stays in
// SUITE_FILE so argv[1] is not the suite.
export function suiteProcessCommand(file) {
  return `SUITE_FILE=${shq(file)} timeout 1800 node --input-type=module -e ${shq(SUITE_WRAPPER)}`;
}

// Every suite in its own process, so one red suite cannot hide the next.
// Returns [{ file, ok, reason }].
export async function runEverySuite(env, run = runShell) {
  const testsDir = join(ROOT, "scripts/tests");
  const runnerText = readFileSync(join(testsDir, "run-tests.mjs"), "utf8");
  const files = suiteFiles(testsDir, runnerText);
  const results = [];
  console.log(`\n===== every unit-test suite, one process each (${files.length}) =====`);
  for (const f of files) {
    const script = suiteProcessCommand(join(testsDir, f));
    const r = await run(script, env);
    const ok = r.code === 0;
    const reason = ok ? "" : firstFailing(r.output) || `exit ${r.code}`;
    results.push({ file: f, ok, reason });
  }
  const bad = results.filter((r) => !r.ok);
  console.log(`\nunit-test suites: ${results.length - bad.length} passed, ${bad.length} failed`);
  for (const b of bad) console.log(`  SUITE FAIL ${b.file}: ${b.reason}`);
  return results;
}

function firstFailing(output) {
  const lines = String(output || "").split(/\r?\n/).map((l) => l.trim());
  const fails = lines.filter((l) => /^(FAIL\b|✗|not ok\b)/.test(l) || /AssertionError|Error:/.test(l));
  return fails.slice(0, 3).join(" | ").slice(0, 300);
}

function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

// Not the private thresholds. The gate has a loaded file so a blank
// PRIVATE_DATA_TOKEN does not block every read. Production has no stub.
export function writeDressStubLimits() {
  const dir = mkdtempSync(join(tmpdir(), "dress-limits-"));
  const path = join(dir, "read-thin-data.json");
  const stub = {
    minAnchorDays: 1,
    anchorBand: 1,
    minJumps: 1,
    jumpRatio: 1000,
    minListings: 0,
    bigMoveRatio: 100,
    minDipPct: 0,
    minDipUsd: 0,
    maxDayGap: 365,
    eraTags: {},
  };
  writeFileSync(path, JSON.stringify(stub) + "\n");
  console.error(`DRESS REHEARSAL: private thin limits were not loaded. Using a stub limits file at ${path}. This is not the private config. Production blocks every read when that file is missing.`);
  return path;
}

export async function rehearse(steps, env, run = runShell, opts = {}) {
  const keepGoing = opts.keepGoing !== false;
  const everySuite = opts.everySuite || null;
  const blankSecrets = allSecrets(steps);
  const ctx = { hardFailed: false, failedStep: "", failures: [], soft: [], secretSkips: [], outcomes: {}, rows: [], suites: [] };
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const key = step.id || `n${i}`;
    const row = { n: i + 1, name: step.name, ran: false, result: "", note: "", error: "" };
    ctx.rows.push(row);
    const gate = shouldRun(step.if, ctx, keepGoing);
    if (!gate.run) {
      console.log(`SKIP ${step.name} (if: ${step.if})`);
      ctx.outcomes[key] = "skipped";
      row.result = "skipped";
      row.note = `if: ${step.if}`;
      continue;
    }
    if (step.uses && !step.run) {
      console.log(`SKIP uses ${step.name} (${step.uses})`);
      ctx.outcomes[key] = "success";
      row.result = "skipped";
      row.note = `uses ${step.uses}, done by the rehearsal job`;
      continue;
    }
    const needs = neededSecrets(step);
    if (needs.length) {
      const msg = `SKIPPED: needs secret ${needs.join(", ")}`;
      console.log(`${msg} (${step.name})`);
      ctx.outcomes[key] = "skipped";
      ctx.secretSkips.push({ name: step.name, secrets: needs });
      row.result = "skipped";
      row.note = msg;
      continue;
    }
    const script = expandGha(dressRun(step.run), ctx);
    console.log(`\n===== STEP: ${step.name}${gate.afterFailure ? " (ran after earlier failure)" : ""} =====`);
    const stepEnv = { ...env, ...(step.env || {}), EBAY_REPLAY: "1", DRESS_REHEARSAL: "1" };
    for (const name of blankSecrets) stepEnv[name] = "";
    stepEnv.GH_TOKEN = "";
    stepEnv.GITHUB_TOKEN = "";
    row.ran = true;
    if (gate.afterFailure) row.note = "ran after earlier failure";
    const r = script.trim() ? await run(script, stepEnv) : { code: 0, output: "" };
    const code = typeof r === "number" ? r : r.code;
    const output = typeof r === "number" ? "" : r.output;
    if (step.id === "tests" && everySuite) {
      ctx.suites = await everySuite(stepEnv);
      const bad = ctx.suites.filter((s) => !s.ok);
      if (bad.length) row.note = [row.note, `failing suites: ${bad.map((s) => s.file).join(", ")}`].filter(Boolean).join("; ");
    }
    if (code === 0) {
      ctx.outcomes[key] = "success";
      row.result = "pass";
      continue;
    }
    ctx.outcomes[key] = "failure";
    row.error = firstErrorLine(output) || `exit ${code}`;
    if (step.continueOnError) {
      ctx.soft.push(step.name);
      row.result = "fail (continue-on-error)";
      console.error(`CONTINUE ${step.name} (exit ${code})`);
      continue;
    }
    if (!ctx.failedStep) ctx.failedStep = step.name;
    ctx.failures.push(step.name);
    ctx.hardFailed = true;
    row.result = "FAIL";
    console.error(`DRESS REHEARSAL STEP FAILED: ${step.name} (exit ${code})`);
  }
  printSummary(ctx);
  return ctx;
}

export function stepTable(rows) {
  const esc = (s) => String(s || "").replace(/\|/g, "/");
  const head = "| # | step | ran | result | note | first error line |\n|---|---|---|---|---|---|";
  return head + "\n" + rows.map((r) => `| ${r.n} | ${esc(r.name)} | ${r.ran ? "ran" : "skipped"} | ${esc(r.result)} | ${esc(r.note)} | ${esc(r.error)} |`).join("\n");
}

function printSummary(ctx) {
  const lines = [];
  lines.push("## Dress rehearsal step table", "", stepTable(ctx.rows), "");
  lines.push(`Hard failures (${ctx.failures.length}):`);
  for (const n of ctx.failures) lines.push(`- ${n}`);
  lines.push("", `continue-on-error failures (${ctx.soft.length}):`);
  for (const n of ctx.soft) lines.push(`- ${n}`);
  lines.push("", `Skipped, needs a secret the rehearsal does not have (${ctx.secretSkips.length}), not failures:`);
  for (const s of ctx.secretSkips) lines.push(`- ${s.name}: SKIPPED: needs secret ${s.secrets.join(", ")}`);
  const bad = (ctx.suites || []).filter((s) => !s.ok);
  if ((ctx.suites || []).length) {
    lines.push("", `Unit-test suites run one by one: ${ctx.suites.length - bad.length} passed, ${bad.length} failed`);
    for (const b of bad) lines.push(`- ${b.file}: ${b.reason}`);
  }
  lines.push("", ctx.hardFailed ? `DRESS REHEARSAL FAILED: ${ctx.failures.length} hard failure(s), first at step: ${ctx.failedStep}` : "DRESS REHEARSAL PASSED");
  const text = lines.join("\n");
  console.log("\n" + text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { writeFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n", { flag: "a" }); } catch { /* summary only */ }
  }
  if (process.env.DRESS_REPORT) {
    try { writeFileSync(process.env.DRESS_REPORT, JSON.stringify({ rows: ctx.rows, failures: ctx.failures, soft: ctx.soft, secretSkips: ctx.secretSkips, suites: ctx.suites }, null, 1) + "\n"); } catch { /* report only */ }
  }
}

async function main() {
  const yaml = readFileSync(WORKFLOW, "utf8");
  const steps = parseWorkflowSteps(yaml);
  if (!steps.length) {
    console.error("DRESS REHEARSAL FAILED at step: parse workflow (no steps)");
    process.exit(2);
  }
  console.log(`dress rehearsal: ${steps.length} steps from update-sealed-prices.yml`);
  const shims = installShims(process.env.PATH);
  console.log(`dress rehearsal: git, gh, curl and wget shims in ${shims.bin}`);
  if (process.env.DRESS_SKIP_BRANCH !== "1") {
    execSync(`${JSON.stringify(shims.realGit)} checkout -B dress-rehearsal-throwaway`, { cwd: ROOT, stdio: "inherit" });
  }
  const env = { ...process.env, EBAY_REPLAY: "1", DRESS_REHEARSAL: "1", PATH: shims.path, DRESS_ROOT: ROOT };
  env.NODE_OPTIONS = nodeOptionsWithPreload(env.NODE_OPTIONS);
  env.GIT_AUTHOR_NAME = env.GIT_AUTHOR_NAME || "catchem-bot";
  env.GIT_AUTHOR_EMAIL = env.GIT_AUTHOR_EMAIL || "bot@catchem.app";
  env.GIT_COMMITTER_NAME = env.GIT_COMMITTER_NAME || "catchem-bot";
  env.GIT_COMMITTER_EMAIL = env.GIT_COMMITTER_EMAIL || "bot@catchem.app";
  const keepGoing = process.env.DRESS_KEEP_GOING !== "0";
  const stubPath = writeDressStubLimits();
  env.READ_THIN_DATA_FILE = stubPath;
  const ctx = await rehearse(steps, env, runShell, { keepGoing, everySuite: keepGoing ? (e) => runEverySuite(e) : null });
  process.exit(ctx.hardFailed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
