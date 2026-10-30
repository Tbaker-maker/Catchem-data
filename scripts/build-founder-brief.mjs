// Write the weekly founder brief from dated files and merged PR titles.
// Sunday Pacific, any hour: Actions often starts the 8 AM cron late.
// BRIEF_FORCE=1 writes on any day. A run that does not write exits 1.
// Missing files hide their section. This does not post anywhere.
import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { prsFromLog, renderBrief, shouldWriteBrief, weekWindow } from "./lib/founder-brief.mjs";

const exec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

function ptParts(now) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Vancouver", weekday: "short", hour: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" });
  const bag = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]));
  return { weekday: bag.weekday, hour: Number(bag.hour), day: `${bag.year}-${bag.month}-${bag.day}` };
}

const now = new Date();
const pt = ptParts(now);
const force = process.env.BRIEF_FORCE === "1";
const decision = shouldWriteBrief(pt, force);
if (!decision.write) {
  console.error(JSON.stringify({ brief: "failed", reason: decision.reason, day: pt.day, weekday: pt.weekday, hour: pt.hour }));
  process.exit(1);
}

const status = await readJson(join(ROOT, "data/derived/status.json"));
const limits = await readJson(join(ROOT, "data/derived/limits/latest.json"));
const listings = await readJson(join(ROOT, "data/derived/listing-counts/latest.json"));
const drift = await readJson(join(ROOT, "data/derived/drift-plan.json"));
const queue = await readJson(join(ROOT, "config/founder-brief-next.json"));
const progressText = await readFile(join(ROOT, "docs/queue/oct17/PROGRESS.md"), "utf8").catch(() => "");
const window = weekWindow(pt.day);
let logText = "";
try {
  const since = new Date(`${window.start}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 1);
  const until = new Date(`${pt.day}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 2);
  const res = await exec("git", ["log", `--since=${since.toISOString()}`, `--until=${until.toISOString()}`, "--pretty=format:%cI%x09%s"], { cwd: ROOT });
  logText = res.stdout || "";
} catch { logText = ""; }
const prs = prsFromLog(logText);
const rows = Number.isFinite(Number(listings?.rowCount)) ? Number(listings.rowCount) : (listings?.rows && typeof listings.rows === "object" ? Object.keys(listings.rows).length : null);
const text = renderBrief({
  asOf: pt.day,
  prs,
  status,
  drift,
  limits,
  listings: rows == null ? null : { asOf: listings?.asOf, rows },
  queue: queue?.items || [],
  progressText,
});
const dir = join(ROOT, "data/derived/brief");
await mkdir(dir, { recursive: true });
const merged = { asOf: pt.day, repo: "Catchem-data", prs };
await writeFile(join(dir, "merged-prs.json"), JSON.stringify(merged, null, 1) + "\n");
const path = join(dir, `${pt.day}.md`);
await writeFile(path, text);
const info = await stat(path);
if (!info.size) {
  console.error(JSON.stringify({ brief: "failed", reason: "wrote an empty file", day: pt.day, path: `data/derived/brief/${pt.day}.md` }));
  process.exit(1);
}
console.log(JSON.stringify({ brief: { asOf: pt.day, shipped: prs.length, path: `data/derived/brief/${pt.day}.md` } }));
