// One-off, local or manual CI: rebuild sealed listings counted per night from
// git history of data/sealed-prices.json. Reads git only. No network, no keys.
//
//   node scripts/backfill-listing-counts-git.mjs [--out data/derived/listing-counts/git-backfill.json.gz]
//
// Output (private use until Intel checks the level against the daily tier):
//   { method: "sealed-step-git", source, builtAt, nights: { day: { at, rows } }, skipped }
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNights } from "./lib/listing-count-git-backfill.mjs";
import { ptDate } from "./lib/listing-counts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = "data/sealed-prices.json";
const argOut = process.argv.indexOf("--out");
const OUT = resolve(ROOT, argOut > 0 ? process.argv[argOut + 1] : "data/derived/listing-counts/git-backfill.json.gz");

const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const log = git(["log", "--format=%H %cI", "--", FILE]).trim().split("\n").filter(Boolean);
const commits = [];
let bad = 0;
for (const line of log) {
  const [sha, at] = line.split(" ");
  let doc;
  try { doc = JSON.parse(git(["show", `${sha}:${FILE}`])); } catch { bad += 1; continue; }
  const when = doc.updatedAt || at;
  commits.push({ day: ptDate(when), at: new Date(when).toISOString(), doc });
}
const { nights, skipped } = buildNights(commits);
const days = Object.keys(nights);
const items = new Set(days.flatMap((d) => nights[d].rows.map((r) => r.id)));
const out = { method: "sealed-step-git", source: `git history of ${FILE}`, builtAt: new Date().toISOString(), nights, skipped };
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, gzipSync(JSON.stringify(out)));
console.log(`commits=${log.length} unreadable=${bad} nights=${days.length} first=${days[0] || "-"} last=${days.at(-1) || "-"} items=${items.size} skipped=${skipped.length} -> ${OUT}`);
