// Run 45902396201 (2026-11-27): build-feed.mjs wrote 374 reads, then the
// "Rebuild set pages and feature data with the released holds" step (#599) ran
// build-public-bundle.mjs again. The bundle's publishFeed rewrote reads.json
// with only the bare price lead (3 reads), the board cap left 0, and publish
// refused. After build-feed runs, the bundle must leave reads.json and feed/ alone.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleKeepsFeed, KEEP_FEED_ENV } from "../lib/feed-owner.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond, detail = "") => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name, detail); } };

// Steps of the nightly job, in order, each with its name, env block and run text.
export function workflowSteps(yml) {
  return yml.split(/\n(?=\s*- name: )/).slice(1).map((chunk) => ({
    name: (chunk.match(/- name: (.*)/) || [])[1]?.trim() || "",
    text: chunk,
  }));
}

// A bundle call keeps the feed when its own line or the step env sets the switch.
export function bundleCallsWithoutKeep(steps, afterName) {
  const start = steps.findIndex((s) => s.name === afterName);
  if (start < 0) return [`no step named ${afterName}`];
  const bad = [];
  for (const step of steps.slice(start + 1)) {
    const stepEnv = new RegExp(`^\\s+${KEEP_FEED_ENV}: ["']?1["']?\\s*$`, "m").test(step.text);
    for (const line of step.text.split("\n")) {
      if (!/build-public-bundle\.mjs/.test(line) || /^\s*#/.test(line)) continue;
      if (!stepEnv && !new RegExp(`${KEEP_FEED_ENV}=1\\s+node scripts/build-public-bundle\\.mjs`).test(line)) bad.push(step.name);
    }
  }
  return bad;
}

export async function run() {
  fail = 0;
  t("the switch is off by default", bundleKeepsFeed({}) === false);
  t("the switch is on only for 1", bundleKeepsFeed({ [KEEP_FEED_ENV]: "1" }) === true && bundleKeepsFeed({ [KEEP_FEED_ENV]: "0" }) === false);

  const fixture = [
    "jobs:",
    "      - name: Rebuild public set pages",
    "        run: node scripts/build-public-bundle.mjs",
    "      - name: Rebuild the public feed",
    "        run: node scripts/build-feed.mjs",
    "      - name: Rebuild set pages and feature data with the released holds",
    "        run: |",
    "          if node scripts/build-public-bundle.mjs && node scripts/write-feature-data.mjs; then echo ok; fi",
  ].join("\n");
  t("the run 45902396201 step shape is caught", bundleCallsWithoutKeep(workflowSteps(fixture), "Rebuild the public feed").join() === "Rebuild set pages and feature data with the released holds");
  t("a bundle before the feed build is fine", bundleCallsWithoutKeep(workflowSteps(fixture.split("\n").slice(0, 5).join("\n")), "Rebuild the public feed").length === 0);
  t("an inline switch passes", bundleCallsWithoutKeep(workflowSteps(fixture.replace("if node scripts/build-public", `if ${KEEP_FEED_ENV}=1 node scripts/build-public`)), "Rebuild the public feed").length === 0);

  const wf = await readFile(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const bad = bundleCallsWithoutKeep(workflowSteps(wf), "Rebuild the public feed");
  t("no step after the feed build lets the bundle rewrite reads.json", bad.length === 0, bad.join("; "));

  const src = await readFile(join(ROOT, "scripts/build-public-bundle.mjs"), "utf8");
  const gate = src.indexOf("bundleKeepsFeed(process.env)");
  const call = src.indexOf("await publishFeed(");
  t("the bundle skips publishFeed when the switch is on", gate > 0 && call > gate && /if \(!keepFeed\)|keepFeed \?/.test(src.slice(gate, call + 40)));
  return fail;
}
