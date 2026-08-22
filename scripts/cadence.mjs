// cadence.mjs — how often should an agent run?
//
// Cost is not the constraint. Six of our seven agents are free and finish in
// under half a second; running them hourly would cost nothing measurable. The
// constraint is ATTENTION. An agent running hourly produces twenty-four times
// the output for a person who reads once a day, and by our own law that is
// farming — volume that looks like work and changes nothing.
//
// THE PRINCIPLE: match cadence to the rate of change of the thing being
// watched, not to the clock.
//   - Agents watching MARKET DATA run daily, because the data lands daily.
//   - Agents watching OUR CODE run when the code changes. Running the Breaker
//     on a day nobody committed produces yesterday's list, which is exactly the
//     BROKEN RECORD failure the supervisor is built to catch. We would be
//     manufacturing our own false alarms.
//   - Agents that COST money run only when their input changed, and never on a
//     timer. A schedule spends money whether or not there is anything to look at.
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = async (...a) => { try { return (await run("git", a, { cwd: ROOT })).stdout.trim(); } catch { return ""; } };

export const CADENCE = {
  // watches market data → runs with the data
  "falsifier":         { when: "daily", watches: "market data" },
  "correction-hunter": { when: "daily", watches: "figures we published" },
  "agent-supervisor":  { when: "daily", watches: "the other agents" },
  "agent-digest":      { when: "daily", watches: "all agent output" },
  // watches our own code → runs when the code moves
  "platform":          { when: "daily", watches: "today's stories against each platform's shape" },
  "security":          { when: "daily", watches: "credentials in the repo and its history" },
  "steward":           { when: "daily", watches: "whether the work is saved, organised and on track" },
  "anomaly":           { when: "daily", watches: "the market" },
  "breaker":           { when: "on-change", watches: "scripts/", paths: ["scripts/"] },
  "improver":          { when: "on-change-or-weekly", watches: "scripts/ and product shape", paths: ["scripts/"], weeklyOn: 1 },
  "experience":        { when: "on-change-or-weekly", watches: "the app's structure", paths: ["../catchem-app/src/"], weeklyOn: 1 },
  "creator":           { when: "on-change-or-weekly", watches: "creator assets and the portal", paths: ["scripts/post-bank.mjs", "scripts/social-posts.mjs", "../catchem-app/src/"], weeklyOn: 1 },
  "universe-advisor":  { when: "weekly", watches: "catalogue vs priced universe", weeklyOn: 1 },
  // costs money → only when its input actually changed
  "review-agents":     { when: "on-change", watches: "published copy", paths: ["scripts/compute-derived.mjs", "scripts/generate-pulse.mjs", "data/did-you-know.json"], costs: true },
};

// Did the paths this agent watches change since it last ran?
export async function shouldRun(agent, lastRunISO) {
  const c = CADENCE[agent];
  if (!c) return { run: true, why: "unregistered agent — defaulting to run, but register it" };
  const now = new Date();
  if (c.when === "daily") return { run: true, why: "watches data that lands daily" };
  if (c.when === "weekly" || c.when === "on-change-or-weekly") {
    const due = !lastRunISO || (now - new Date(lastRunISO)) / 86400000 >= 7;
    if (due) return { run: true, why: "weekly cadence due" };
  }
  if (c.paths?.length) {
    const since = lastRunISO ? `--since=${lastRunISO}` : "-5";
    const changed = await git("log", since, "--name-only", "--format=");
    const hit = c.paths.some(p => changed.split("\n").some(f => f && f.startsWith(p.replace(/\/$/, ""))));
    return hit
      ? { run: true, why: `${c.watches} changed since the last run` }
      : { run: false, why: `${c.watches} unchanged — running would reproduce the last result${c.costs ? " and spend money doing it" : ""}` };
  }
  return { run: false, why: "not due" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hist = JSON.parse(await readFile(join(ROOT, "data/agent-history.json"), "utf-8").catch(() => "{}")) || {};
  console.log(`\n  Cadence is set by how fast the watched thing changes, not by the clock.\n`);
  for (const [agent, c] of Object.entries(CADENCE)) {
    const last = (hist.runs?.[agent] ?? []).slice(-1)[0]?.date ?? null;
    const d = await shouldRun(agent, last);
    console.log(`  ${agent.padEnd(20)} ${String(c.when).padEnd(20)} ${d.run ? "RUN " : "skip"}  ${d.why}`);
  }
  console.log();
}
