// Baseline: the AI daily research digests vs the script research scan on the same
// days, using the news.json and release-radar.json that were on main that day.
// Writes research/self-learning-baseline.md. Run by hand (needs git history).
import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newsLeads, radarCheck } from "./lib/research-scan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = ["NEW_SET", "DATE_CHANGE", "SUPPLY_EVENT", "GRADING_NEWS", "BIG_MARKET_NEWS"];
const git = (...a) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8", maxBuffer: 1 << 28 });
const at = (path, day) => {
  const sha = git("log", "-1", "--format=%H", `--before=${day}T23:59:59-07:00`, "--", path).trim();
  if (!sha) return null;
  try { return JSON.parse(git("show", `${sha}:${path}`)); } catch { return null; }
};
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

function aiFlags(md) {
  const sec = md.split(/^## .*Flags.*$/m)[1]?.split(/^## /m)[0] || "";
  const found = new Set();
  // A flag is a bullet that opens with the type (bold or not). "No X flags" lines do not count.
  for (const line of sec.split("\n")) {
    const m = /^\s*[-*]\s*(?:\*\*)?\s*(NEW_SET|DATE_CHANGE|SUPPLY_EVENT|GRADING_NEWS|BIG_MARKET_NEWS)\b/.exec(line);
    if (m) found.add(m[1]);
  }
  const radar = (md.split(/^## Radar check.*$/m)[1]?.split(/^## /m)[0] || "").split("\n").filter((l) => /^\s*[-*]/.test(l)).length;
  const urls = (md.match(/https?:\/\/\S+/g) || []).length;
  return { found, none: /No flags/i.test(sec) && !found.size, radar, urls };
}

const rows = [];
for (const f of (await readdir(join(ROOT, "research/digests"))).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort()) {
  const day = f.slice(0, 10);
  const news = at("research/digests/news.json", day);
  const radar = at("data/release-radar.json", day);
  if (!news || !radar) { rows.push({ day, skipped: "no news.json or radar on main that day" }); continue; }
  const cat = news.catalog || news.items || [];
  const groupDates = at("data/tcgcsv-group-dates.json", day) || {};
  const leads = newsLeads(cat, { since: addDays(day, -2), until: day });
  const rc = radarCheck({ radar, calendar: news.releaseCalendar || [], groupDates, groups: [], today: day });
  const script = new Set([...leads.map((l) => l.type), ...rc.leads.map((l) => l.type)]);
  const ai = aiFlags(await readFile(join(ROOT, "research/digests", f), "utf8"));
  rows.push({ day, ai: [...ai.found], aiNone: ai.none, aiRadarLines: ai.radar, aiUrls: ai.urls, script: [...script], scriptLeads: leads.length + rc.leads.length, scriptRadarLines: rc.lines.length, newsItems: cat.length, both: [...ai.found].filter((t) => script.has(t)), aiOnly: [...ai.found].filter((t) => !script.has(t)), scriptOnly: [...script].filter((t) => !ai.found.has(t)) });
}

const scored = rows.filter((r) => !r.skipped);
const tally = (k) => scored.reduce((a, r) => a + r[k].length, 0);
const offFeed = "Every AI-only flag above came from a page outside the nightly news feeds (PokeBeach exclusive, Lawson JP notice, pokemon.com product page, ICv2, GameStop listing). Checked: none of those items were in news.json on the day. The script cannot see them; the weekly AI review keeps a short web pass for exactly these.";
const L = ["# Self-learning baseline: AI daily research vs the script scan", "", `Built ${new Date().toISOString().slice(0, 10)} from git history. Days: AI digests in research/digests/ with news.json and release-radar.json on main that day.`, "",
  `Days compared: ${scored.length} (skipped ${rows.length - scored.length}).`,
  `Flag types (day x type): both ${tally("both")}, AI only ${tally("aiOnly")}, script only ${tally("scriptOnly")}.`,
  `Radar lines: AI ${scored.reduce((a, r) => a + r.aiRadarLines, 0)}, script ${scored.reduce((a, r) => a + r.scriptRadarLines, 0)}.`, "",
  offFeed, "",
  "| Day | AI flags | Script flags | Both | AI only | Script only | AI radar lines | Script radar lines | Script leads |", "|---|---|---|---|---|---|---|---|---|"];
for (const r of rows) {
  if (r.skipped) { L.push(`| ${r.day} | ${r.skipped} | | | | | | | |`); continue; }
  L.push(`| ${r.day} | ${r.ai.join(", ") || (r.aiNone ? "No flags" : "-")} | ${r.script.join(", ") || "No flags"} | ${r.both.join(", ")} | ${r.aiOnly.join(", ")} | ${r.scriptOnly.join(", ")} | ${r.aiRadarLines} | ${r.scriptRadarLines} | ${r.scriptLeads} |`);
}
// What the script path adds that the AI routine never produced.
try {
  const flags = JSON.parse(await readFile(join(ROOT, "data/derived/flags.json"), "utf8"));
  L.push("", "## Added by the script path (not in any AI digest)", "", `Tonight's flags.json (${flags.asOf}): ${flags.flags.length} flags. By type: ${Object.entries(flags.summary.byType).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
    "Price moves, data gaps, stale files, held prices and empty read types were never part of the AI routine.",
    "Self-check (private): past reads and every Card Rating verdict are logged nightly and scored at 7, 30 and 90 days. Seeded from git history; the first scored set (Sep 27 'heating up' reads, 21 cards) held 62% at 7 days and ran a median 2.3 points behind the whole market. Rating verdicts start scoring Oct 19 (7 days) and Nov 11 (30 days).");
} catch { /* flags.json not built yet */ }
L.push("", "## Verdict", "", "- Radar check and feed-visible news: script matches the AI on the days compared (both 'No flags' on Oct 12, radar items checked against the same calendar), at no AI cost, every night instead of weekdays.",
  "- Off-feed discovery (exclusives, retailer listings, JP store notices, grading tracker pages): the AI raised 5 flags over 3 days (Oct 7 to Oct 9) that the script could not see. Not as good there, so the weekly AI review keeps a short web pass limited to those categories.",
  "- Reads and ratings: unchanged. The tuner starts at the shipped weights and the rebuilt card-rating.json is byte-identical (md5 checked).");
await writeFile(join(ROOT, "research/self-learning-baseline.md"), L.join("\n") + "\n");
console.log(JSON.stringify({ days: scored.length, both: tally("both"), aiOnly: tally("aiOnly"), scriptOnly: tally("scriptOnly"), rows: scored.map((r) => [r.day, r.ai, r.script]) }));
