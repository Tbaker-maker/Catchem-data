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
  const steps = [];
  let cur = null;
  const push = () => { if (cur) steps.push(cur); cur = null; };
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
      };
      continue;
    }
    if (!cur) continue;
    if (/^  \S/.test(line) || /^[^ ]/.test(line)) { push(); inSteps = false; continue; }
    const id = line.match(/^        id:\s*(.+)$/);
    if (id) cur.id = id[1].trim();
    const uses = line.match(/^        uses:\s*(.+)$/);
    if (uses) cur.uses = uses[1].trim();
    if (/^        continue-on-error:\s*true\s*$/.test(line)) cur.continueOnError = true;
    const iff = line.match(/^        if:\s*(.+)$/);
    if (iff) cur.if = iff[1].trim();
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
  s = s.replace(/git config user\.name[^\n]*/g, "true # dress: author comes from the environment");
  s = s.replace(/git config user\.email[^\n]*/g, "true # dress: email comes from the environment");
  s = s.replace(/git pull --rebase --autostash origin main/g, "echo 'dress rehearsal: skip pull'");
  s = s.replace(/\bgit push\b[^\n]*/g, "echo 'dress rehearsal: skip push' && git branch -f dress-rehearsal-throwaway HEAD");
  s = s.replace(/\bcurl\b[^\n]*/g, "echo 'dress rehearsal: skip curl'");
  s = s.replace(/(^|\n)([ \t]*)gh\b/g, "$1$2true # dress skip gh ");
  return s;
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

export function shouldRun(expr, ctx) {
  if (!String(expr || "").trim()) return !ctx.hardFailed;
  return evalExpr(expr, ctx);
}

function runShell(script, env) {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", script], { cwd: ROOT, env, stdio: "inherit" });
    child.on("close", (code) => resolve(code == null ? 1 : code));
  });
}

export async function rehearse(steps, env, run = runShell) {
  const ctx = { hardFailed: false, failedStep: "", soft: [], outcomes: {} };
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
    const script = dressRun(step.run);
    console.log(`\n===== STEP: ${step.name} =====`);
    const code = script.trim() ? await run(script, env) : 0;
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
    ctx.hardFailed = true;
    ctx.failedStep = step.name;
    console.error(`DRESS REHEARSAL FAILED at step: ${step.name} (exit ${code})`);
  }
  if (ctx.soft.length) console.error("continue-on-error failures:\n" + ctx.soft.map((n) => "- " + n).join("\n"));
  if (ctx.hardFailed) console.error(`DRESS REHEARSAL FAILED at step: ${ctx.failedStep}`);
  else console.log("DRESS REHEARSAL PASSED");
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
  const preload = "--import ./scripts/dress-rehearsal-preload.mjs";
  env.NODE_OPTIONS = env.NODE_OPTIONS && env.NODE_OPTIONS.includes(preload) ? env.NODE_OPTIONS : [env.NODE_OPTIONS, preload].filter(Boolean).join(" ");
  const ctx = await rehearse(steps, env);
  process.exit(ctx.hardFailed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
