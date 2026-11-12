// Dress rehearsal of .github/workflows/update-sealed-prices.yml.
// Runs the same steps against the current checkout. eBay is replayed from the
// newest saved data/raw/ebay-sealed file (EBAY_REPLAY=1) and api.ebay.com is
// blocked. publish-public-data.mjs is called without --push. git push is
// rewritten to a local throwaway branch. The first hard failure stops the
// pipeline and names the step. continue-on-error steps are listed and the run
// continues.

import { readFileSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW = join(ROOT, ".github/workflows/update-sealed-prices.yml");

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
    if (/^        continue-on-error:\s*true\s*$/.test(line)) cur.continueOnError = true;
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

export function dressRun(script) {
  let s = String(script || "");
  s = s.replace(/node scripts\/publish-public-data\.mjs --push\b/g, "node scripts/publish-public-data.mjs");
  // Wrap git, gh and curl so a push, a hook, or an issue command cannot leave
  // this machine. Rewriting the middle of a line breaks `if git push; then`.
  const prelude = [
    "git() {",
    "  if [ \"$1\" = \"push\" ] || [ \"$1\" = \"pull\" ]; then",
    "    echo \"dress rehearsal: skip git $1\"",
    "    command git branch -f dress-rehearsal-throwaway HEAD >/dev/null 2>&1 || true",
    "    return 0",
    "  fi",
    "  if [ \"$1\" = \"config\" ]; then",
    "    echo \"dress rehearsal: skip git config\"",
    "    return 0",
    "  fi",
    "  command git \"$@\"",
    "}",
    "gh() { echo \"dress rehearsal: skip gh\"; return 0; }",
    "curl() { echo \"dress rehearsal: skip curl\"; return 0; }",
    "node() { command node --import ./scripts/dress-rehearsal-preload.mjs \"$@\"; }",
  ].join("\n");
  return prelude + "\n" + s;
}

function evalExpr(expr, ctx) {
  const e = String(expr || "").trim();
  if (e === "always()") return true;
  if (e === "failure()") return ctx.hardFailed;
  if (e === "success()") return !ctx.hardFailed;
  const parts = e.split(/\s*&&\s*/);
  if (parts.length > 1) return parts.every((part) => evalExpr(part, ctx));
  const m = e.match(/^steps\.([A-Za-z0-9_-]+)\.outcome\s*==\s*'(success|failure)'$/);
  if (m) return ctx.outcomes[m[1]] === m[2];
  console.log("dress rehearsal: unrecognized if, running only while the run is green: " + e);
  return !ctx.hardFailed;
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

export function shouldRun(expr, ctx) {
  // A blank if still runs after an earlier failure. The nightly stops there,
  // so a broken step hides the next one until the following night. This run
  // keeps going and names the first hard failure at the end.
  if (!String(expr || "").trim()) return true;
  return evalExpr(expr, ctx);
}

function runShell(script, env) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", script], { cwd: ROOT, env, stdio: "inherit" });
    child.on("close", (code) => resolve(code == null ? 1 : code));
  });
}

export async function rehearse(steps, env, run = runShell) {
  const ctx = { hardFailed: false, failedStep: "", failures: [], soft: [], outcomes: {} };
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const key = step.id || `n${i}`;
    if (!shouldRun(step.if, ctx)) {
      console.log(`SKIP ${step.name}`);
      ctx.outcomes[key] = "skipped";
      continue;
    }
    if (step.uses && !step.run) {
      console.log(`SKIP uses ${step.name} (${step.uses})`);
      ctx.outcomes[key] = "success";
      continue;
    }
    const script = expandGha(dressRun(step.run), ctx);
    console.log(`\n===== STEP: ${step.name} =====`);
    const stepEnv = { ...env, ...(step.env || {}), EBAY_REPLAY: "1", DRESS_REHEARSAL: "1" };
    stepEnv.EBAY_APP_ID = "";
    stepEnv.EBAY_CERT_ID = "";
    const code = script.trim() ? await run(script, stepEnv) : 0;
    if (code === 0) {
      ctx.outcomes[key] = "success";
      continue;
    }
    ctx.outcomes[key] = "failure";
    if (step.continueOnError) {
      ctx.soft.push(step.name);
      console.error(`CONTINUE ${step.name} (exit ${code})`);
      continue;
    }
    if (!ctx.failedStep) ctx.failedStep = step.name;
    ctx.failures.push(step.name);
    ctx.hardFailed = true;
    console.error(`DRESS REHEARSAL FAILED at step: ${step.name} (exit ${code})`);
  }
  if (ctx.soft.length) console.error("continue-on-error failures:\n" + ctx.soft.map((n) => "- " + n).join("\n"));
  if (ctx.hardFailed) {
    console.error(`DRESS REHEARSAL FAILED at step: ${ctx.failedStep}`);
    console.error("All hard failures:\n" + ctx.failures.map((n) => "- " + n).join("\n"));
  } else console.log("DRESS REHEARSAL PASSED");
  return ctx;
}

async function main() {
  const yaml = readFileSync(WORKFLOW, "utf8");
  const steps = parseWorkflowSteps(yaml);
  if (!steps.length) {
    console.error("DRESS REHEARSAL FAILED at step: parse workflow (no steps)");
    process.exit(1);
  }
  console.log(`dress rehearsal: ${steps.length} steps from update-sealed-prices.yml`);
  if (process.env.DRESS_SKIP_BRANCH !== "1") {
    execSync("git checkout -B dress-rehearsal-throwaway", { cwd: ROOT, stdio: "inherit" });
  }
  const env = { ...process.env, EBAY_REPLAY: "1", DRESS_REHEARSAL: "1" };
  env.GIT_AUTHOR_NAME = env.GIT_AUTHOR_NAME || "catchem-bot";
  env.GIT_AUTHOR_EMAIL = env.GIT_AUTHOR_EMAIL || "bot@catchem.app";
  env.GIT_COMMITTER_NAME = env.GIT_COMMITTER_NAME || "catchem-bot";
  env.GIT_COMMITTER_EMAIL = env.GIT_COMMITTER_EMAIL || "bot@catchem.app";
  const ctx = await rehearse(steps, env);
  process.exit(ctx.hardFailed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
