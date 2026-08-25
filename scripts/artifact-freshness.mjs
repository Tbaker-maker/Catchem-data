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
// Deliberately advisory. Legitimate quiet exists: a radar of confirmed release
// dates should not change most days, and blocking a build because nothing
// happened would be the same mistake in the other direction. The failure mode
// here is nobody LOOKING, so this prints and does not stop anything.
import { readFile, readdir } from "node:fs/promises";
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

const wfFiles = (await readdir(WF)).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
const jobs = [];

for (const f of wfFiles) {
  const src = await readFile(join(WF, f), "utf-8");
  const crons = [...src.matchAll(/-\s*cron:\s*["']([^"']+)["']/g)].map(m => m[1]);
  if (!crons.length) continue;                    // not scheduled; not our business

  // Everything the job stages. This is the job's own promise about what it
  // produces — the write-vs-commit law in CLAUDE.md means an unlisted file
  // evaporates, so the git-add list IS the artifact list.
  const adds = [...src.matchAll(/git add ([^\n]+)/g)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(p => p && !p.startsWith("-"));

  const hours = Math.min(...crons.map(c => cadenceHours(c) ?? 24 * 365));
  jobs.push({ workflow: f, crons, hours, paths: [...new Set(adds)] });
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
  for (const p of job.paths) {
    // A directory promise ("research/") is checked as a whole: the newest thing
    // inside it is what the job last managed to produce.
    const iso = lastChanged(p);
    if (!iso) { rows.push({ job, p, days: null, note: "never committed" }); continue; }
    const days = (now - Date.parse(iso)) / 86400000;
    // How many runs should have touched this since it last moved?
    const runsMissed = Math.floor(days * 24 / job.hours);
    rows.push({ job, p, days, iso, runsMissed });
  }
}

rows.sort((a, b) => (b.runsMissed ?? 1e9) - (a.runsMissed ?? 1e9));

console.log("ARTIFACT FRESHNESS — what each scheduled job promised, and when it last delivered\n");
console.log(`  ${jobs.length} scheduled workflow(s) · ${rows.length} promised path(s)\n`);

// A run every 24h that has not moved a file in 3 days is worth a look. Below
// that is noise; a daily job legitimately produces nothing on a quiet day.
const SUSPECT = 3;
let suspect = 0;

for (const r of rows) {
  const label = `${r.p}`.padEnd(42);
  if (r.days === null) {
    console.log(`  ?  ${label} never committed — promised by ${r.job.workflow}`);
    suspect++;
    continue;
  }
  const mark = r.runsMissed >= SUSPECT ? "!" : " ";
  if (r.runsMissed >= SUSPECT) suspect++;
  console.log(`  ${mark}  ${label} ${r.days.toFixed(1)}d ago · ~${r.runsMissed} run(s) since it last moved`);
}

console.log("");
if (suspect) {
  console.log(`${suspect} path(s) worth a look. "!" means the owning job has run several times`);
  console.log("without the file changing. That is EITHER a quiet week OR a dead pipeline,");
  console.log("and the two are indistinguishable from here — which is exactly how the release");
  console.log("radar stayed frozen for eight days behind eight green runs.");
  console.log("");
  console.log("For each one, the question is: does the job record that it CHECKED, separately");
  console.log("from whether it CHANGED anything? If not, that is the defect.");
} else {
  console.log("Every promised artifact has moved within the expected number of runs.");
}
