// scripts/pop-velocity.mjs — Pop Velocity (dormant until 2 snapshots)
// Δ PSA10 pop / month per chase + gem rate → the SUPPLY side of Slab Math.
// "Premium +$1,426 BUT pop grew +38 this month — premium eroding as the
// hobby slabs into it." Human-sourced snapshots only; provenance = the
// grader's own free pop page, dated.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT,"data/pop-snapshots.json"),"utf-8"));
const snaps = d.snapshots||[];
if (snaps.length < 2) { console.log(`pop-velocity dormant: ${snaps.length}/2 snapshots (monthly ritual — see data/pop-snapshots.json _meta)`); process.exit(0); }
const [prev, curr] = snaps.slice(-2);
const rows = [];
for (const c of curr.cards||[]) {
  const p = (prev.cards||[]).find(x=>x.cardId===c.cardId && x.grader===c.grader);
  if (!p) continue;
  const days = (new Date(curr.date)-new Date(prev.date))/86400000 || 30;
  rows.push({ cardId:c.cardId, name:c.name, grader:c.grader,
    pop10:c.pop10, dPop10:c.pop10-p.pop10, perMonth:Math.round((c.pop10-p.pop10)/days*30),
    gemRate:c.total?Math.round(c.pop10/c.total*1000)/10:null,
    provenance:`${c.grader} pop report (free), ${curr.date} vs ${prev.date}` });
}
rows.sort((a,b)=>b.perMonth-a.perMonth);
await writeFile(join(ROOT,"data/pop-velocity.json"), JSON.stringify({
  generatedAt:new Date().toISOString(),
  method:"Human-entered monthly snapshots from free official pop pages. Velocity = Δpop over interval, normalized /month. Supply-side companion to Grading Premium.",
  window:`${prev.date} → ${curr.date}`, rows }, null, 2)+"\n");
console.log(`✓ pop-velocity: ${rows.length} chases · fastest: ${rows[0]?.name} +${rows[0]?.perMonth}/mo`);
