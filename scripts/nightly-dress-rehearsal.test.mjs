import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseWorkflowSteps, dressRun, shouldRun, rehearse } from "./nightly-dress-rehearsal.mjs";

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

const pub = steps.find((s) => s.name.startsWith("Publish the public-data"));
assert.match(pub.run, /--push/);
assert.doesNotMatch(dressRun(pub.run), /--push/);
assert.match(dressRun(pub.run), /publish-public-data\.mjs/);
const commit = steps.find((s) => s.name.startsWith("Commit price data"));
const rewritten = dressRun(commit.run);
assert.doesNotMatch(rewritten, /^[ \t]*git config/m);
assert.doesNotMatch(rewritten, /\bgit push\b/);
assert.match(rewritten, /dress-rehearsal-throwaway/);
assert.doesNotMatch(rewritten, /git pull --rebase/);
const hook = steps.find((s) => s.name.startsWith("Trigger app rebuild"));
assert.doesNotMatch(dressRun(hook.run), /^[ \t]*curl\b/m);

const green = { hardFailed: false, outcomes: { tests: "success", setpages: "success", publish: "success" } };
assert.equal(shouldRun("", green), true);
assert.equal(shouldRun("failure()", green), false);
assert.equal(shouldRun("always()", green), true);
assert.equal(shouldRun("always() && steps.tests.outcome == 'success'", green), true);
assert.equal(shouldRun("steps.setpages.outcome == 'success'", green), true);
const red = { hardFailed: true, failedStep: "Unit tests (fail-fast)", outcomes: { tests: "failure", publish: "failure" } };
assert.equal(shouldRun("", red), false);
assert.equal(shouldRun("failure()", red), true);
assert.equal(shouldRun("always()", red), true);
assert.equal(shouldRun("failure() && steps.publish.outcome == 'failure'", red), true);
assert.equal(shouldRun("success()", red), false);

const fake = [
  { name: "ok", id: "a", run: "true", uses: "", continueOnError: false, if: "" },
  { name: "soft", id: "b", run: "exit 3", uses: "", continueOnError: true, if: "" },
  { name: "hard", id: "c", run: "exit 4", uses: "", continueOnError: false, if: "" },
  { name: "later", id: "d", run: "exit 9", uses: "", continueOnError: false, if: "" },
  { name: "always after", id: "e", run: "true", uses: "", continueOnError: false, if: "always()" },
];
const ran = [];
const ctx = await rehearse(fake, {}, async (script) => { ran.push(script); return script.includes("exit") ? Number(script.split(" ")[1]) : 0; });
assert.deepEqual(ran, ["true", "exit 3", "exit 4", "true"]);
assert.equal(ctx.failedStep, "hard");
assert.deepEqual(ctx.soft, ["soft"]);

const preload = await import("./dress-rehearsal-preload.mjs");
void preload;
await assert.rejects(() => fetch("https://api.ebay.com/buy/browse/v1/item_summary/search"), /blocked an eBay API call/);

console.log("nightly dress rehearsal parser ok", steps.length);
