import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseWorkflowSteps, dressRun, expandGha, shouldRun, rehearse, neededSecrets,
  installShims, nodeOptionsWithPreload, stepTable, firstErrorLine, suiteFiles, suiteProcessCommand,
  writeDressStubLimits,
} from "./nightly-dress-rehearsal.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yaml = readFileSync(join(root, ".github/workflows/update-sealed-prices.yml"), "utf8");
const steps = parseWorkflowSteps(yaml);
const names = steps.map((s) => s.name);
assert.ok(steps.length >= 80, "expected the nightly step list, got " + steps.length);
for (const name of [
  "Fetch sealed prices from eBay",
  "Dated reads, rip value, and status",
  "Publish the public-data branch",
  "Commit price data (before anything reports on it)",
  "Smoke test (live site + feed + rendered app)",
  "Unit tests (fail-fast)",
]) assert.ok(names.includes(name), name);

const byName = (prefix) => steps.find((s) => s.name.startsWith(prefix));
const pub = byName("Publish the public-data");
const tests = steps.find((s) => s.id === "tests");
assert.equal(tests.env.FEED_FRESHNESS_WARN_ONLY, "1");
const ebay = byName("Fetch sealed prices");
assert.equal(ebay.env.EBAY_APP_ID, "");
assert.deepEqual(ebay.secrets.sort(), ["EBAY_APP_ID", "EBAY_CERT_ID", "PRIVATE_DATA_TOKEN"]);
assert.match(pub.run, /--push/);
assert.doesNotMatch(dressRun(pub.run), /--push/);
assert.match(dressRun(pub.run), /publish-public-data\.mjs/);

// Secrets: eBay is replayed and the private token is optional, so those steps
// run. A step that only works with its key is skipped and named.
assert.deepEqual(neededSecrets(ebay), []);
assert.deepEqual(neededSecrets(byName("Dated reads")), []);
assert.deepEqual(neededSecrets(byName("Rebuild outputs on today's day")), []);
assert.deepEqual(neededSecrets(byName("PPP budgeted refresh")), ["PKMNPRICES_API_KEY"]);
assert.deepEqual(neededSecrets(byName("Trigger app rebuild")), ["CF_DEPLOY_HOOK"]);
assert.deepEqual(neededSecrets(byName("Mount private PPT history")), ["PRIVATE_DATA_TOKEN"]);
assert.deepEqual(neededSecrets(byName("Push raw PPP to private repo")), ["PRIVATE_DATA_TOKEN"]);
assert.deepEqual(neededSecrets(byName("Append shelf counts to the private log")), ["PRIVATE_DATA_TOKEN"]);
assert.deepEqual(neededSecrets(byName("Publish the public-data")), []);

// PATH shims: a bash step and a node child process both hit them.
const shims = installShims(process.env.PATH);
const repo = mkdtempSync(join(tmpdir(), "dress-repo-"));
const other = mkdtempSync(join(tmpdir(), "dress-other-"));
const remote = mkdtempSync(join(tmpdir(), "dress-remote-"));
const realGit = (args, cwd) => execFileSync(shims.realGit, args, { cwd, encoding: "utf8" }).trim();
try {
  realGit(["init", "-q", "--bare"], remote);
  for (const dir of [repo, other]) {
    realGit(["init", "-q", "-b", "main"], dir);
    realGit(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x"], dir);
    realGit(["config", "user.name", "before"], dir);
  }
  // The rehearsal checkout pushes to GitHub. Nothing listens at this URL, so
  // only the shim can make a push to it exit 0.
  realGit(["remote", "add", "origin", "https://github.invalid/Tbaker-maker/Catchem-data.git"], repo);
  realGit(["remote", "add", "origin", remote], other);
  const env = { ...process.env, PATH: shims.path, DRESS_ROOT: repo, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_TERMINAL_PROMPT: "0" };

  const bash = spawnSync("bash", ["-e", "-c", "if git push origin HEAD:refs/heads/leak; then echo PUSHED; fi\ngit push\ngit config user.name after\ngit pull origin main\ncurl -s -X POST https://example.invalid/hook\ngh issue create --title x --body y\necho NAME=$(git config user.name)\n"], { cwd: repo, env, encoding: "utf8" });
  assert.equal(bash.status, 0, bash.stderr);
  assert.match(bash.stdout, /PUSHED/);
  assert.match(bash.stdout, /NAME=before/);
  assert.match(bash.stderr, /blocked git push[\s\S]*blocked git push/);
  assert.match(bash.stderr, /blocked git config write/);
  assert.match(bash.stderr, /blocked git pull/);
  assert.match(bash.stderr, /blocked curl/);
  assert.match(bash.stderr, /blocked gh/);

  const child = `
    const { execSync, spawnSync } = require("node:child_process");
    execSync("git push origin HEAD:refs/heads/from-node", { stdio: "inherit" });
    execSync("git -C . push --force origin HEAD:refs/heads/from-node-c", { stdio: "inherit" });
    execSync("git -c remote.origin.pushurl=/tmp/x push origin HEAD", { stdio: "inherit" });
    const gh = spawnSync("gh", ["issue", "create", "--title", "x", "--body", "y"], { encoding: "utf8" });
    process.stderr.write(gh.stderr);
    if (gh.status !== 0) process.exit(7);
    execSync("git config --global user.name leak", { stdio: "inherit" });
    execSync("git config user.name leak", { stdio: "inherit" });
  `;
  const node = spawnSync(process.execPath, ["-e", child], { cwd: repo, env: { ...env, HOME: repo }, encoding: "utf8" });
  assert.equal(node.status, 0, node.stderr);
  assert.equal((node.stderr.match(/blocked git push/g) || []).length, 2, node.stderr);
  assert.match(node.stderr, /blocked git url override/);
  assert.match(node.stderr, /blocked gh/);
  assert.equal((node.stderr.match(/blocked git config write/g) || []).length, 2, node.stderr);
  assert.equal(realGit(["config", "user.name"], repo), "before");
  assert.equal(spawnSync(shims.realGit, ["config", "--global", "user.name"], { env: { ...process.env, HOME: repo }, encoding: "utf8" }).stdout.trim(), "");
  // A blocked push moves only the local throwaway branch.
  assert.match(realGit(["branch", "--list", "dress-rehearsal-throwaway"], repo), /dress-rehearsal-throwaway/);
  // Reads still work through the shim.
  const read = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo, env, encoding: "utf8" });
  assert.equal(read.stdout.trim(), "main");
  // A unit test's own temp repo with a local bare remote still pushes and
  // writes its config, so the suites behave as they do in the nightly.
  const local = spawnSync("bash", ["-e", "-c", "git config user.name inner\ngit push -q -u origin main\ngit push -q\n"], { cwd: other, env, encoding: "utf8" });
  assert.equal(local.status, 0, local.stderr);
  assert.doesNotMatch(local.stderr, /blocked/);
  assert.equal(realGit(["config", "user.name"], other), "inner");
  assert.equal(realGit(["for-each-ref", "--format=%(refname)"], remote), "refs/heads/main");
} finally {
  for (const dir of [repo, other, remote, shims.bin]) rmSync(dir, { recursive: true, force: true });
}

assert.match(nodeOptionsWithPreload(""), /^--import=\/.*dress-rehearsal-preload\.mjs$/);
assert.equal(nodeOptionsWithPreload(nodeOptionsWithPreload("--max-old-space-size=4096")).split("--import=").length, 2);

// Keep-going: success() and a blank if still run after a hard failure and are
// labelled. always() and failure() keep their meaning.
const green = { hardFailed: false, outcomes: { tests: "success", setpages: "success", publish: "success" } };
assert.deepEqual(shouldRun("", green), { run: true, afterFailure: false });
assert.equal(shouldRun("failure()", green).run, false);
assert.equal(shouldRun("always()", green).run, true);
assert.equal(shouldRun("always() && steps.tests.outcome == 'success'", green).run, true);
assert.equal(shouldRun("steps.setpages.outcome == 'success'", green).run, true);
const red = { hardFailed: true, failedStep: "Unit tests (fail-fast)", outcomes: { tests: "failure", publish: "failure" } };
assert.deepEqual(shouldRun("", red), { run: true, afterFailure: true });
assert.deepEqual(shouldRun("success()", red), { run: true, afterFailure: true });
assert.deepEqual(shouldRun("failure()", red), { run: true, afterFailure: false });
assert.deepEqual(shouldRun("always()", red), { run: true, afterFailure: false });
assert.equal(shouldRun("failure() && steps.publish.outcome == 'failure'", red).run, true);
assert.equal(shouldRun("always() && steps.tests.outcome == 'success'", red).run, false);
// Without keep-going it is the nightly's own rule.
assert.equal(shouldRun("success()", red, false).run, false);
assert.equal(shouldRun("", red, false).run, false);
assert.equal(expandGha("echo ${{ steps.tests.outcome }} ${{ github.repository }}", red), "echo failure Tbaker-maker/Catchem-data");
assert.equal(expandGha("echo ${{ secrets.EBAY_APP_ID }}", red), "echo ");

assert.equal(firstErrorLine("  ok  a\n  FAIL b : reads wrote nothing\n  ✗ c"), "FAIL b : reads wrote nothing");
assert.equal(firstErrorLine("dress rehearsal: blocked curl\nlast line"), "last line");

const fake = [
  { name: "ok", id: "a", run: "true", uses: "", continueOnError: false, if: "", secrets: [] },
  { name: "soft", id: "b", run: "exit 3", uses: "", continueOnError: true, if: "", secrets: [] },
  { name: "hard", id: "c", run: "exit 4", uses: "", continueOnError: false, if: "", secrets: [] },
  { name: "later", id: "d", run: "exit 9", uses: "", continueOnError: false, if: "", secrets: [] },
  { name: "green only", id: "g", run: "true", uses: "", continueOnError: false, if: "success()", secrets: [] },
  { name: "needs key", id: "k", run: "exit 5", uses: "", continueOnError: false, if: "", secrets: ["CF_DEPLOY_HOOK"] },
  { name: "always after", id: "e", run: "true", uses: "", continueOnError: false, if: "always()", secrets: [] },
  { name: "on failure", id: "f", run: "true", uses: "", continueOnError: false, if: "failure()", secrets: [] },
];
const ran = [];
const seenEnv = [];
const ctx = await rehearse(fake, { CF_DEPLOY_HOOK: "https://leak.invalid" }, async (script, env) => {
  const body = script.trim().split("\n").pop();
  ran.push(body);
  seenEnv.push(env.CF_DEPLOY_HOOK);
  return body.startsWith("exit") ? { code: Number(body.split(" ")[1]), output: `ERROR: boom ${body}` } : { code: 0, output: "" };
});
assert.deepEqual(ran, ["true", "exit 3", "exit 4", "exit 9", "true", "true", "true"]);
assert.ok(seenEnv.every((v) => v === ""), "a secret reached a step");
assert.equal(ctx.failedStep, "hard");
assert.deepEqual(ctx.failures, ["hard", "later"]);
assert.deepEqual(ctx.soft, ["soft"]);
assert.deepEqual(ctx.secretSkips, [{ name: "needs key", secrets: ["CF_DEPLOY_HOOK"] }]);
const row = (n) => ctx.rows.find((r) => r.name === n);
assert.equal(row("later").note, "ran after earlier failure");
assert.equal(row("green only").note, "ran after earlier failure");
assert.equal(row("always after").note, "");
assert.equal(row("needs key").ran, false);
assert.equal(row("needs key").note, "SKIPPED: needs secret CF_DEPLOY_HOOK");
assert.equal(row("hard").error, "ERROR: boom exit 4");
const table = stepTable(ctx.rows);
assert.equal(table.split("\n").length, 2 + fake.length);
assert.match(table, /\| 3 \| hard \| ran \| FAIL \|/);
assert.match(table, /\| 6 \| needs key \| skipped \| skipped \| SKIPPED: needs secret CF_DEPLOY_HOOK \|/);

// The unit-test step runs every suite and lists the red ones.
const withTests = [{ name: "Unit tests (fail-fast)", id: "tests", run: "exit 1", uses: "", continueOnError: false, if: "", secrets: [] }];
const tctx = await rehearse(withTests, {}, async () => ({ code: 1, output: "" }), {
  everySuite: async () => [{ file: "a.suite.mjs", ok: true, reason: "" }, { file: "b.suite.mjs", ok: false, reason: "FAIL x" }],
});
assert.match(tctx.rows[0].note, /failing suites: b\.suite\.mjs/);
const files = suiteFiles(join(root, "scripts/tests"), readFileSync(join(root, "scripts/tests/run-tests.mjs"), "utf8"));
for (const f of ["publish-writes.suite.mjs", "deep-reads.suite.mjs", "public-bundle.suite.mjs", "read-facts.test.mjs", "price-sanity.test.mjs"]) assert.ok(files.includes(f), f);

// A trailing path becomes argv[1] and suites self-run, then the wrapper
// runs them again. board-determinism then exceeds 30 minutes. The path is
// SUITE_FILE only, so the CLI guard stays quiet and run() happens once.
const probeDir = mkdtempSync(join(tmpdir(), "dress-suite-"));
const probe = join(probeDir, "probe.suite.mjs");
try {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(probe, `
let n = 0;
export async function run() {
  n += 1;
  console.log("RAN " + n + " argv1=" + (process.argv[1] || ""));
  console.log(process.argv[1].endsWith("probe.suite.mjs") ? "SELF" : "ENDS");
  return 0;
}
if (process.argv[1] && process.argv[1].endsWith("probe.suite.mjs")) {
  console.log("SELF");
  await run();
}
`);
  const cmd = suiteProcessCommand(probe);
  assert.match(cmd, /SUITE_FILE=/);
  assert.match(cmd, /dress-suite-runner\.mjs'$/);
  assert.doesNotMatch(cmd, /probe\.suite\.mjs'$/);
  const once = spawnSync("bash", ["-lc", cmd], { encoding: "utf8" });
  assert.equal(once.status, 0, once.stderr);
  assert.equal((once.stdout.match(/^RAN /gm) || []).length, 1, once.stdout);
  assert.doesNotMatch(once.stdout, /SELF/);
  assert.match(once.stdout, /argv1=\S/);
  assert.doesNotMatch(once.stdout, /probe\.suite\.mjs/);
  assert.match(once.stdout, /ENDS/);
} finally {
  rmSync(probeDir, { recursive: true, force: true });
}

const preload = await import("./dress-rehearsal-preload.mjs");
void preload;
await assert.rejects(() => fetch("https://api.ebay.com/buy/browse/v1/item_summary/search", { signal: AbortSignal.timeout(5000) }), /blocked an eBay API call/);
const https = await import("node:https");
assert.throws(() => https.request("https://api.ebay.com/identity/v1/oauth2/token"), /blocked an eBay API call/);

const stubPath = writeDressStubLimits();
const stub = JSON.parse(readFileSync(stubPath, "utf8"));
for (const key of ["minAnchorDays", "anchorBand", "minJumps", "jumpRatio", "minListings", "bigMoveRatio", "minDipPct", "minDipUsd", "maxDayGap"]) {
  assert.equal(typeof stub[key], "number", key);
}
assert.equal(typeof stub.eraTags, "object");
assert.ok(!Array.isArray(stub.eraTags));

console.log("nightly dress rehearsal parser ok", steps.length);
