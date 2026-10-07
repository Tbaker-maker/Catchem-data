// ── ARTIFACT FRESHNESS — the sweep that found the radar ────────────────────
// Three times in one day a run reported success over an artifact it had not
// produced. Two were caught by reading the artifact; the third was caught by
// noticing a DATE that had not moved while the job that owns it ran green every
// morning for eight days.
//
// That last one is the cheapest check in this repo and nothing was running it.
// The method: take everything a scheduled job promises to write, ask git when
// each file last actually changed, and compare that against how often the job
// runs. A file whose job runs daily and whose content last moved six days ago
// is either genuinely quiet or completely dead, and the two look identical from
// outside — which is the whole point. This does not decide which. It NAMES the
// ones where the question is worth asking, so nobody has to notice on their own.
//
// NOW BLOCKING, AND THE REASON IS WHERE THE SIGNAL LANDS RATHER THAN HOW LOUD
// IT IS. The six failed price runs were VISIBLE the whole time — red ticks in
// the GitHub Actions tab, a place nobody on this project opens. Tyler checks
// the fleet. He does not check Actions. A signal delivered somewhere nobody
// looks is not a signal, it is a record for the post-mortem.
//
// The earlier version of this file printed and exited 0, on the reasoning that
// legitimate quiet exists and blocking on a slow news day is the same mistake
// inverted. That reasoning was right about the RADAR and wrong about the rest:
// a release radar can honestly go a week without moving, but a price feed that
// has not moved in three daily runs is not having a quiet week.
//
// So the threshold does the discriminating instead of the exit code. Two runs
// stale is the line, and anything that legitimately moves more slowly declares
// itself in SLOW below rather than being waved through by making the whole
// guard advisory.
import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WF = join(ROOT, ".github", "workflows");

// crontab -> roughly how many hours between runs. Only the shapes this repo
// uses; anything else is reported as unknown rather than guessed at.
function cadenceHours(cron) {
  const [min, hour, dom, mon, dow] = cron.trim().split(/\s+/);
  if (dom === "*" && mon === "*" && dow === "*") {
    if (hour === "*") return 1;
    if (hour.includes("/")) return Number(hour.split("/")[1]) || 24;
    if (hour.includes(",")) return 24 / hour.split(",").length;
    return 24;
  }
  if (dow !== "*" && dom === "*") return 24 * 7;
  return null;
}

const SHELL = new Set(["fi", "then", "else", "elif", "do", "done", "if", "esac", "in"]);

function cleanAddToken(raw) {
  let p = String(raw || "").trim();
  if (!p) return "";
  if ((p.startsWith("\"") && p.endsWith("\"")) || (p.startsWith("'") && p.endsWith("'"))) p = p.slice(1, -1);
  p = p.replace(/;+$/g, "");
  if (!p || p === "\\" || p.startsWith("-") || p.startsWith(">") || SHELL.has(p)) return "";
  return p;
}

function lineNo(src, index) {
  return src.slice(0, index).split("\n").length;
}

function newestTracked(pattern) {
  let out = "";
  try { out = execFileSync("git", ["ls-files", "--", pattern], { cwd: ROOT, encoding: "utf8" }); }
  catch { return ""; }
  const files = out.split("\n").map((s) => s.trim()).filter(Boolean);
  let best = "";
  let bestIso = "";
  for (const file of files) {
    let iso = "";
    try { iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { cwd: ROOT, encoding: "utf8" }).trim(); }
    catch { iso = ""; }
    if (!best || iso > bestIso) { best = file; bestIso = iso; }
  }
  return best;
}

function invokedText(src) {
  const names = [...src.matchAll(/\bnode\s+(scripts\/[\w./-]+\.mjs)/g)].map((m) => m[1])
    .filter((rel) => !rel.includes("/tests/") && rel !== "scripts/tests/run-tests.mjs");
  const seen = new Set();
  const out = [];
  const readScript = (rel) => {
    const norm = rel.replace(/^\.\//, "");
    if (seen.has(norm)) return;
    seen.add(norm);
    let text = "";
    try { text = readFileSync(join(ROOT, norm), "utf8"); } catch { return; }
    out.push(text);
    const dir = dirname(norm);
    for (const match of text.matchAll(/["'](\.[^"']+\.mjs)["']/g)) {
      readScript(join(dir, match[1]));
    }
  };
  for (const rel of names) readScript(rel);
  return out.join("\n");
}

function isProduced(path, scripts, workflowSrc) {
  const bare = String(path || "").replace(/\/+$/, "");
  if (!bare) return false;
  if (scripts.includes(bare)) return true;
  const base = bare.split("/").pop() || "";
  if (base && scripts.includes(base)) return true;
  if (/^grades-\d{4}-\d{2}-\d{2}\.json$/.test(base) && scripts.includes("grades-") && scripts.includes("learning")) return true;
  // A path written in the workflow itself (not only listed on git add) is a product.
  // Continuation lines under `git add` are arguments, not writers.
  const lines = String(workflowSrc || "").split("\n");
  if (lines.some((line) => line.includes(bare) && !/git add\b/.test(line) && /writeFile|>>/.test(line))) return true;
  return false;
}

const wfFiles = (await readdir(WF)).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
const jobs = [];

for (const f of wfFiles) {
  const src = await readFile(join(WF, f), "utf-8");
  const crons = [...src.matchAll(/-\s*cron:\s*["']([^"']+)["']/g)].map(m => m[1]);
  if (!crons.length) continue;                    // not scheduled; not our business

  // Everything the job stages. This is the job's own promise about what it
  // produces — the write-vs-commit law in CLAUDE.md means an unlisted file
  // evaporates, so the git-add list IS the artifact list.
  // A shell word is not a path. `git add grades-*.json; fi` used to report
  // a file named "fi" and the unexpanded glob as never committed.
  const scripts = invokedText(src);
  const paths = [];
  const unwired = [];
  const seen = new Set();
  for (const match of src.matchAll(/git add ([^\n]+)/g)) {
    const line = lineNo(src, match.index);
    for (const token of match[1].split(/\s+/)) {
      const cleaned = cleanAddToken(token);
      if (!cleaned || seen.has(cleaned)) continue;
      seen.add(cleaned);
      const expanded = /[*?\[]/.test(cleaned) ? (newestTracked(cleaned) || cleaned) : cleaned;
      const entry = { path: expanded, line, from: cleaned };
      if (isProduced(expanded, scripts, src) || isProduced(cleaned, scripts, src)) paths.push(entry);
      else unwired.push(entry);
    }
  }

  const hours = Math.min(...crons.map(c => cadenceHours(c) ?? 24 * 365));
  jobs.push({ workflow: f, crons, hours, paths, unwired });
}

// git log is the honest record: mtime changes on checkout, commit dates do not.
const lastChanged = (p) => {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", p],
      { cwd: ROOT, encoding: "utf-8" }).trim();
    return out || null;
  } catch { return null; }
};

const now = Date.now();
const rows = [];

for (const job of jobs) {
  for (const entry of job.unwired || []) {
    rows.push({
      job, p: entry.path, days: null, line: entry.line,
      note: `git add at ${job.workflow}:${entry.line} but no step in that workflow runs a writer`,
      unwired: true,
    });
  }
  for (const entry of job.paths) {
    const p = entry.path;
    // A directory promise ("research/") is checked as a whole: the newest thing
    // inside it is what the job last managed to produce.
    const iso = lastChanged(p);
    if (!iso) { rows.push({ job, p, days: null, note: "never committed", line: entry.line }); continue; }
    const days = (now - Date.parse(iso)) / 86400000;
    // How many runs should have touched this since it last moved?
    const runsMissed = Math.floor(days * 24 / job.hours);
    rows.push({ job, p, days, iso, runsMissed, line: entry.line });
  }
}

rows.sort((a, b) => (b.runsMissed ?? 1e9) - (a.runsMissed ?? 1e9));

console.log("ARTIFACT FRESHNESS — what each scheduled job promised, and when it last delivered\n");
console.log(`  ${jobs.length} scheduled workflow(s) · ${rows.length} promised path(s)\n`);

// TWO RUNS. A daily job that has produced nothing twice running is either
// broken or has nothing to say, and it must be able to tell us which — the
// same rule already applied to the radar's checkedAt.
const SUSPECT = 2;

// Paths that legitimately move slowly, each with the reason it is allowed to.
// A file earns a place here by being genuinely event-driven; "it is often
// unchanged" is not a reason, it is the symptom this guard exists to catch.
const SLOW = {
  "data/release-radar.json":
    "confirmed release dates change when the world changes, not daily — but it now records checkedAt separately from updated, so a dead agent is still visible",
  "data/recovery-log.json":
    "written by the watchdog ONLY when the heartbeat goes red and a recovery is dispatched; never having fired is the healthy state",
};
let suspect = 0, excused = 0;

const stale = [];

for (const r of rows) {
  const label = `${r.p}`.padEnd(42);
  const excuse = SLOW[r.p];

  if (r.days === null) {
    if (r.unwired) {
      console.log(`  ·  ${label} not a product of ${r.job.workflow}:${r.line} — no step runs a writer. A workflow edit at that line would be required.`);
      excused++;
      continue;
    }
    if (excuse) { console.log(`  ·  ${label} never written — ${excuse}`); excused++; continue; }
    console.log(`  ?  ${label} never committed — promised by ${r.job.workflow}`);
    suspect++; stale.push({ ...r, why: "never committed" });
    continue;
  }

  const over = r.runsMissed >= SUSPECT;
  if (over && excuse) {
    console.log(`  ·  ${label} ${r.days.toFixed(1)}d · ~${r.runsMissed} runs — allowed: ${excuse.slice(0, 60)}…`);
    excused++;
    continue;
  }
  if (over) { suspect++; stale.push(r); }
  console.log(`  ${over ? "!" : " "}  ${label} ${r.days.toFixed(1)}d ago · ~${r.runsMissed} run(s) since it last moved`);
}

console.log("");
if (suspect) {
  console.log(`✗ ARTIFACT FRESHNESS — ${suspect} promised artifact(s) more than ${SUSPECT} runs stale:`);
  for (const r of stale)
    console.log(`   ${r.p} — ${r.why ?? `~${r.runsMissed} runs, last moved ${r.days.toFixed(1)}d ago`} (${r.job.workflow})`);
  console.log("");
  console.log("A scheduled job that has produced nothing twice running is either broken or has");
  console.log("nothing to say, and it must be able to tell us WHICH. Six red price runs sat in");
  console.log("the Actions tab for three days because that is not a place anybody here looks.");
  console.log("");
  console.log("Either fix the job, or make it record that it CHECKED separately from whether it");
  console.log("CHANGED anything — the way release-radar now writes checkedAt. If the file");
  console.log("genuinely moves on events rather than on a schedule, add it to SLOW with the");
  console.log("reason, which is a decision somebody makes on purpose rather than a silence.");
  process.exit(1);
}
console.log(`✓ artifact freshness: every promised artifact moved within ${SUSPECT} runs` +
  (excused ? ` · ${excused} path(s) excused (slow on purpose, or not written by that workflow)` : ""));
