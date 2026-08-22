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
const REPOS = [ROOT, join(ROOT, "..", "catchem-app")];
const gitIn = async (cwd, ...a) => { try { return (await run("git", a, { cwd })).stdout.trim(); } catch { return ""; } };
// Both repos, always. Which one a path belongs to is inferred from the path,
// but history is read from BOTH because a collision can happen in either.
const git = async (...a) => (await Promise.all(REPOS.map(r => gitIn(r, ...a)))).filter(Boolean).join("\n");

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
// git log --name-only prints REPO-RELATIVE paths, so an ABSOLUTE argument can
// never match and reports a confident "nobody". Verified 2026-08-23: the same
// Ticker.jsx returned "nobody" by absolute path and "chat and CC" by relative
// one, minutes apart. Since the fence says to run this before editing, and an
// absolute path is the natural way to name a file in the other repo, the
// all-clear was reachable exactly when it mattered most.
const relTarget = String(target).replace(/\\/g, "/").replace(/^.*?\/(catchem-app|Catchem-data)\//, "");
const baseName = relTarget.split("/").pop();
const targetBlocks = recent.split(/\n(?=[0-9a-f]{7,}\|)/)
  .filter(b => b.includes(relTarget) || b.includes(baseName));
const lanes = new Set(targetBlocks.map(laneOf));
const touched = targetBlocks.length > 0;
const otherLane = lanes.has("CC");
const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
const base = target.replace(/^scripts\//, "").replace(/\.mjs$/, "");
const similar = files.filter(f => f !== `${base}.mjs` && (f.includes(base.split("-")[0]) || base.includes(f.replace(".mjs", "").split("-")[0])));

const reposSeen = (await Promise.all(REPOS.map(async r => (await gitIn(r, "rev-parse", "--show-toplevel")) ? r.split("/").pop() : null))).filter(Boolean);
console.log(`\n  collision check — ${target}`);
console.log(`  repos searched: ${reposSeen.join(", ") || "NONE — this check saw nothing and its answer means nothing"}\n`);
console.log(`  touched in the last ${HOURS}h by: ${touched ? [...lanes].join(" and ") : "nobody"}${otherLane ? " ← the other lane has been here" : ""}`);
if (similar.length) console.log(`  similar scripts that may already do this job: ${similar.join(", ")}`);
const exists = files.includes(`${base}.mjs`);
console.log(`  already exists: ${exists ? "YES — extend it, do not replace it" : "no"}`);
if (touched || exists) console.log(`\n  Read first. Overwriting a file the other lane just wrote is how a ruling gets silently reverted.\n`);
