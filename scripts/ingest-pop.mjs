// scripts/ingest-pop.mjs — the 2-minute monthly pop ritual.
// Paste-format, one line per card:  cardId pop10 pop9 total
// (whitespace-separated; commas in numbers ok; # starts a comment line.)
// Usage:
//   node scripts/ingest-pop.mjs [--date YYYY-MM-DD] [--grader psa] [--source "psacard.com manual"] [file]
//   ...or pipe/paste on stdin and end with Ctrl+Z (win) / Ctrl+D.
// Merges into data/pop-snapshots.json by (date, cardId, grader) — re-pasting
// a corrected line the same day updates in place, never duplicates. Then
// auto-runs pop-velocity so the ritual is one command end-to-end.
// Human-entered numbers only; the standing no-scrape rule covers PSA.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAP_PATH = join(ROOT, "data/pop-snapshots.json");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return dflt;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const date = opt("date", new Date().toISOString().slice(0, 10));
const grader = (opt("grader", "psa") || "psa").toLowerCase();
const source = opt("source", "psacard.com manual");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`bad --date "${date}" (want YYYY-MM-DD)`); process.exit(1);
}

const input = args[0]
  ? await readFile(args[0], "utf-8")
  : await new Promise((res) => {
      let s = "";
      process.stdin.on("data", (c) => (s += c));
      process.stdin.on("end", () => res(s));
    });

// Known-id set (typo guard, warn-only): enrichment cardIds + watchlist id: queries.
const known = new Set();
try {
  const e = JSON.parse(await readFile(join(ROOT, "data/singles-enrichment.json"), "utf-8"));
  for (const c of e.cards || []) known.add(c.cardId);
} catch {}
try {
  const w = JSON.parse(await readFile(join(ROOT, "data/singles-watchlist.json"), "utf-8"));
  for (const c of w.cards || []) {
    const m = /(?:^|\s)id:([\w-]+)/.exec(c.q || "");
    if (m) known.add(m[1]);
  }
} catch {}

const num = (s) => {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const rows = [];
const bad = [];
for (const raw of input.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const parts = line.split(/\s+/);
  if (parts.length !== 4) { bad.push(`${line}  ← want: cardId pop10 pop9 total`); continue; }
  const [cardId, p10s, p9s, tots] = parts;
  const pop10 = num(p10s), pop9 = num(p9s), popTotal = num(tots);
  if (pop10 === null || pop9 === null || popTotal === null) { bad.push(`${line}  ← non-numeric pop`); continue; }
  if (pop10 + pop9 > popTotal) { bad.push(`${line}  ← pop10+pop9 > total`); continue; }
  if (!known.has(cardId)) console.warn(`⚠ unknown cardId "${cardId}" (not in enrichment/watchlist — typo? ingesting anyway)`);
  rows.push({ date, cardId, grader, pop10, pop9, popTotal, source });
}
if (bad.length) { console.error(`REJECTED ${bad.length} line(s):\n  ` + bad.join("\n  ")); }
if (!rows.length) { console.error("no valid lines — nothing written"); process.exit(bad.length ? 1 : 0); }

const d = JSON.parse(await readFile(SNAP_PATH, "utf-8"));
d.snapshots = d.snapshots || [];
let added = 0, updated = 0;
for (const r of rows) {
  const i = d.snapshots.findIndex((s) => s.date === r.date && s.cardId === r.cardId && s.grader === r.grader);
  if (i === -1) { d.snapshots.push(r); added++; } else { d.snapshots[i] = r; updated++; }
}
d.snapshots.sort((a, b) => a.date.localeCompare(b.date) || a.cardId.localeCompare(b.cardId));
await writeFile(SNAP_PATH, JSON.stringify(d, null, 2) + "\n");

const dates = [...new Set(d.snapshots.map((s) => s.date))].sort();
console.log(`✓ ingest-pop: +${added} added, ${updated} updated (${date}, ${grader}, "${source}")`);
console.log(`  file now: ${d.snapshots.length} rows across ${dates.length} date(s): ${dates.join(", ")}`);
execFileSync(process.execPath, [join(ROOT, "scripts/pop-velocity.mjs")], { stdio: "inherit" });
