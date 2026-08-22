// collision-guard.mjs — two lanes, one file, no accidents.
//
// On 2026-08-23 chat and CC independently built rip-sell-trade.mjs, the era
// ELI5s, and a recruiter for the supervisor — inside ten minutes. Nothing broke,
// because each was checked before overwriting, but that was care rather than
// architecture. Earlier the same day the same pattern DID break something: two
// licensing gates added to one function, where the second silently overrode the
// first and a ruling from Tyler stopped taking effect.
//
// This makes the check mechanical. Before building, ask: has the other lane
// touched this recently, or is it already doing this job?
//
// It never blocks and never edits. It answers a question, because the failure
// here is not malice or incompetence — it is two people working fast on the
// same thing without a cheap way to notice.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// TWO REPOS, not one. This pinned every git call to Catchem-data, so a path in
// catchem-app returned "touched by: nobody · already exists: no" — a confident
// all-clear on the exact repo the fence exists to protect. Caught 2026-08-22
// when it cleared a Ticker.jsx that chat had edited twenty minutes earlier.
// A guard that answers for the wrong repo is worse than one that admits it
// cannot see: the first is trusted.
const REPOS = { data: ROOT, app: join(ROOT, "..", "catchem-app") };
const repoFor = (p) => /catchem-app|[\/]src[\/]|\.jsx$/.test(String(p || "")) ? REPOS.app : REPOS.data;
const gitIn = async (cwd, ...a) => { try { return (await run("git", a, { cwd })).stdout.trim(); } catch { return ""; } };
const git = async (...a) => gitIn(repoFor(process.argv[2]), ...a);

const target = process.argv[2];
const HOURS = Number(process.env.COLLISION_WINDOW_HOURS || 6);

// Who authored recent commits? Chat commits as "Catchem Claude"; CC's identity
// differs. Either way, the useful signal is "someone else touched this lately".
const recent = await git("log", `--since=${HOURS} hours ago`, "--name-only", "--format=%H|%an|%ad|%s%n%b|END", "--date=relative");
// Lane detection: chat and CC share a git identity ("Catchem Claude"), so the
// author field cannot separate them. CC signs with a Co-Authored-By trailer;
// chat does not. That trailer is the only honest signal we have.
const laneOf = (block) => /Co-Authored-By:/i.test(block) ? "CC" : "chat";

if (!target) {
  // No argument: report every file both lanes touched inside the window.
  const blocks = recent.split(/\n(?=[0-9a-f]{7,}\|)/).filter(Boolean);
  const byFile = {};
  for (const b of blocks) {
    const lane = laneOf(b);
    const files = b.split("\n").filter(l => l && !l.includes("|") && /\.(mjs|json|md|jsx|html|yml)$/.test(l));
    for (const f of files) (byFile[f] ||= new Set()).add(lane);
  }
  // Generated artifacts are rewritten by every run in both lanes — that is not a
// collision, it is the pipeline working. Only hand-written files matter here.
const GENERATED = /^(data\/(derived-insights|heartbeat|agent-history|catalyst-log|sealed-prices|divergence-report|heat-|singles-|crosscheck|era-|pop-|release-)|research\/(pulse|assets)\/)/;
const contested = Object.entries(byFile)
  .filter(([f, a]) => a.size > 1 && !GENERATED.test(f));
  if (!contested.length) { console.log(`✓ collision guard: no file touched by more than one author in the last ${HOURS}h`); process.exit(0); }
  console.log(`\n  ⚠ ${contested.length} file(s) touched by BOTH lanes in the last ${HOURS}h — check before editing:\n`);
  for (const [f, authors] of contested.slice(0, 15)) console.log(`   ${f}  (${[...authors].join(", ")})`);
  console.log(`\n  Not an error. It means: read the file before you write it, and check whether the job is already done.\n`);
  process.exit(0);
}

// With an argument: is this specific thing already being worked on?
// git log --name-only prints REPO-RELATIVE paths, so an absolute argument never
// matched and every absolute path reported "nobody" — a confident all-clear
// produced by a string comparison that could not succeed.
const relTarget = String(target).replace(/\\/g, "/").replace(/^.*?\/(catchem-app|Catchem-data)\//, "");
const baseName = relTarget.split("/").pop();
const targetBlocks = recent.split(/\n(?=[0-9a-f]{7,}\|)/)
  .filter(b => b.includes(relTarget) || b.includes(baseName));
const lanes = new Set(targetBlocks.map(laneOf));
const touched = targetBlocks.length > 0;
const otherLane = lanes.has("CC");
const inAppRepo = repoFor(target) === REPOS.app;
// scripts/ lives in the data repo; for an app file these two checks are
// meaningless rather than reassuring, so they say so instead of saying "no".
const files = inAppRepo ? [] : (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
const base = target.replace(/^scripts\//, "").replace(/\.mjs$/, "");
const similar = files.filter(f => f !== `${base}.mjs` && (f.includes(base.split("-")[0]) || base.includes(f.replace(".mjs", "").split("-")[0])));

console.log(`\n  collision check — ${target}\n`);
console.log(`  repo: ${inAppRepo ? "catchem-app" : "Catchem-data"}`);
console.log(`  touched in the last ${HOURS}h by: ${touched ? [...lanes].join(" and ") : "nobody"}${otherLane ? " ← the other lane has been here" : ""}`);
if (similar.length) console.log(`  similar scripts that may already do this job: ${similar.join(", ")}`);
const exists = files.includes(`${base}.mjs`);
console.log(`  already exists: ${inAppRepo ? "n/a (app repo — this check covers scripts/ only)" : exists ? "YES — extend it, do not replace it" : "no"}`);
if (touched || exists) console.log(`\n  Read first. Overwriting a file the other lane just wrote is how a ruling gets silently reverted.\n`);
