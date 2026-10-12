// One-off: seeds the private self-check ledger with past reads from git history of
// research/assets/public/reads.json (one snapshot per asOf day), then scores them.
// Usage: node scripts/self-check-backfill.mjs   (needs full git history)
// Writes to gitignored data/private/self-check/ unless PRIVATE_DATA_TOKEN is set.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { snapshotNight, scoreLedger, summarize } from "./lib/self-check.mjs";
import { loadPriceBook, readLedger } from "./self-check.mjs";
import { openPrivate } from "./lib/private-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function backfillReads(root = ROOT) {
  const { priceOn, marketChange } = await loadPriceBook(root);
  const shas = execFileSync("git", ["-C", root, "log", "--format=%H", "--", "research/assets/public/reads.json"], { encoding: "utf8" }).trim().split("\n");
  const byDay = new Map();
  for (const sha of shas) { // newest first: first seen per asOf is that day's final board
    let doc;
    try { doc = JSON.parse(execFileSync("git", ["-C", root, "show", `${sha}:research/assets/public/reads.json`], { encoding: "utf8", maxBuffer: 1 << 28 })); } catch { continue; }
    const day = String(doc.asOf || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && !byDay.has(day)) byDay.set(day, doc.reads || []);
  }
  const rows = [];
  for (const [day, reads] of byDay) rows.push(...snapshotNight({ asOf: day, reads, priceOn }));
  return { rows, days: [...byDay.keys()].sort(), priceOn, marketChange };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" });
  const dir = join(store.dir, "self-check");
  await mkdir(dir, { recursive: true });
  const { rows, days, priceOn, marketChange } = await backfillReads(ROOT);
  const existing = await readLedger(dir);
  const have = new Set(existing.map((e) => `${e.t}:${e.kind}:${e.pid}:${e.date}`));
  const ledger = [...existing, ...rows.filter((e) => !have.has(`${e.t}:${e.kind}:${e.pid}:${e.date}`))];
  const today = days.at(-1);
  for (const e of ledger) for (const h of [7, 30, 90]) delete e[`h${h}`];
  scoreLedger(ledger, priceOn, today, marketChange);
  await writeFile(join(dir, "ledger.jsonl.gz"), gzipSync(ledger.map((e) => JSON.stringify(e)).join("\n") + "\n"));
  console.log(JSON.stringify({ days, added: ledger.length - existing.length, summary: summarize(ledger).filter((r) => r.type === "read") }, null, 1));
  console.log(JSON.stringify(await store.close(["self-check/ledger.jsonl.gz"], "Self-check: seed past reads from git history")));
}
