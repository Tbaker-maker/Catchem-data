// node scripts/publish-gate.mjs [--check]   (--check reports only, never writes)
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gateReads, RULES } from "./lib/publish-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");
const check = process.argv.includes("--check");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

const readsPath = join(PUB, "reads.json");
const doc = await J(readsPath, { reads: [] });
const chips = (await J(join(PUB, "signal-chips.json"), {}))?.byId || {};
const listings = {};
for (const p of (await J(join(PUB, "listings-counted.json"), {}))?.products || []) if (p?.listingsCounted?.date) listings[p.id] = p.listingsCounted;
const sets = {};
for (const s of (await J(join(PUB, "sets.json"), {}))?.sets || []) if (s?.name && s.release) sets[s.name] = s.release;
let prev = {};
try {
  const old = JSON.parse(execFileSync("git", ["show", `${process.env.GATE_PREV_REF || "HEAD"}:research/assets/public/reads.json`], { cwd: ROOT, maxBuffer: 1 << 28 }).toString());
  for (const r of old.reads || []) prev[r.id] = r;
} catch { prev = {}; }
const facts = (id) => { const p = join(PUB, "feed/facts", `${id}.json`); if (!existsSync(p)) return null; try { return JSON.parse(execFileSync("cat", [p]).toString()); } catch { return null; } };

const asOf = doc.asOf || (doc.reads || []).map((r) => r.asOf).filter(Boolean).sort().pop();
const ctx = { chips, listings, sets, prev, facts, asOf };
const { readdir } = await import("node:fs/promises");
const feedFiles = [];
for (const dir of ["today", "up", "down", "watch", "cook", "cool", "heat"]) {
  const d = join(PUB, "feed", dir);
  if (!existsSync(d)) continue;
  for (const f of await readdir(d)) if (f.endsWith(".json")) feedFiles.push(join(d, f));
}
const res = gateReads(doc.reads || [], ctx);
const total = { rows: doc.reads?.length || 0, dropped: res.dropped, counts: { ...res.counts } };
const log = [...res.log];
const writes = [];
for (const f of feedFiles) {
  const rows = await J(f, null);
  if (!Array.isArray(rows)) continue;
  const fr = gateReads(rows, { ...ctx, prev: {} }, { maxDropShare: 1 });
  total.rows += rows.length; total.dropped += fr.dropped;
  for (const k of Object.keys(fr.counts)) total.counts[k] += fr.counts[k];
  log.push(...fr.log.map((l) => ({ ...l, file: f.slice(PUB.length + 1) })));
  if (fr.log.length) writes.push([f, fr.kept]);
}
console.log(JSON.stringify(total));
for (const l of log) console.log(`gate ${l.action} ${l.rule} ${l.id}${l.file ? ` [${l.file}]` : ""}${l.note ? ` (${l.note})` : ""}`);
const systemic = total.rows > 20 && total.dropped / total.rows > 0.25;
if (systemic) { console.error(`publish gate: systemic breakage, ${total.dropped} of ${total.rows} rows failed. Not publishing.`); process.exit(1); }
if (!check) {
  await writeFile(readsPath, JSON.stringify({ ...doc, reads: res.kept, count: res.kept.length, gate: { rules: RULES.map(([id]) => id), counts: res.counts, dropped: res.dropped } }, null, 1) + "\n");
  for (const [f, kept] of writes) await writeFile(f, JSON.stringify(kept) + "\n");
}
