// qa-gate.mjs — THE SLOP DEFENSE.
// Runs after the data is built and BEFORE anything is published. Its job
// is not to fix numbers; it is to refuse to let a suspicious one reach a
// post, a card, the Pulse, or the newsletter. Anything it flags gets
// publishBlock:true and is skipped by every public surface — the number
// still exists in the data (transparency), it just doesn't get a megaphone.
//
// DOCTRINE (Tyler, Aug 21): "AI slop is an easy tag to get and a hard one
// to remove." A wrong number published confidently is the fastest route to
// that tag. So: publish slower than we compute, and let the machine be the
// first skeptic — not the founder's eyes.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const sp = await J("data/sealed-prices.json");
const div = await J("data/divergence-report.json") ?? { rows: [] };
const hh = await J("data/heat-history.json") ?? [];
const today = new Date().toISOString().slice(0, 10);
if (!sp) { console.log("· qa-gate: no price file, skipping"); process.exit(0); }

const tcgBy = new Map((div.rows || []).map(r => [r.id, r.tcgMarket]));
const prevBy = {};
for (const r of [...hh].sort((a, b) => a.date < b.date ? -1 : 1)) if (r.date < today && r.price) prevBy[r.id] = r.price;

const flags = [];
let blocked = 0;
for (const p of sp.products || []) {
  if (p.dataStatus !== "live" || !p.priceMedian) continue;
  const reasons = [];
  const med = p.priceMedian, hi = p.priceHigh, lo = p.priceFloorClean ?? p.priceLow;

  // 1 · SPREAD-SHAPE: a clean single-item market is tight. A high 3× the
  //     median means the top half is carrying something that isn't our SKU.
  const warns = [];
  if (hi && med && hi / med >= 3) warns.push(`high $${hi} is ${(hi / med).toFixed(1)}× the median — watch for lot/case listings in the top half`);

  // 2 · FLOOR GAP: a floor under a third of the median usually means damaged
  //     goods, empty boxes, or a different SKU sneaking through.
  if (lo && med && med / lo >= 3) warns.push(`floor $${lo} is ${(med / lo).toFixed(1)}× under the median`);

  // 3 · OVERNIGHT JUMP: sealed asks don't move 30% in a day. If they appear
  //     to, our filters changed something — not the market.
  const prev = prevBy[p.id];
  if (prev && Math.abs(med / prev - 1) >= 0.30) reasons.push(`median moved ${Math.round((med / prev - 1) * 100)}% overnight vs $${prev} — filter drift suspected`);

  // 4 · CROSS-SOURCE SANITY: modern products trade on both venues. Beyond
  //     ±60% one of the two numbers is wrong, and we don't know which.
  const tcg = tcgBy.get(p.id);
  const OFF_TCG = /^(sm|xy|base|neo|hgss|bw|det|dp)/.test(p.id);
  if (tcg && !OFF_TCG && Math.abs(med / tcg - 1) >= 0.60) reasons.push(`${Math.round((med / tcg - 1) * 100)}% from TCGplayer ($${tcg}) — beyond any photo-premium explanation`);

  // 5 · THIN TAPE: a median off a handful of listings isn't a market read.
  if ((p.listingCount ?? 0) < 5) reasons.push(`only ${p.listingCount} listings — too thin to headline`);

  if (warns.length && !reasons.length) { p.qaWarn = warns; }
  else if (p.qaWarn) delete p.qaWarn;
  if (reasons.length) {
    p.publishBlock = true;
    p.qaReasons = reasons;
    blocked++;
    flags.push({ id: p.id, name: p.name, median: med, high: hi, floor: lo, listings: p.listingCount,
      reasons, warns, topPricedTitles: p.topPricedTitles ?? null });
  } else if (p.publishBlock) { delete p.publishBlock; delete p.qaReasons; }
}

await writeFile(join(ROOT, "data/sealed-prices.json"), JSON.stringify(sp, null, 2) + "\n");
const report = { generatedAt: new Date().toISOString(), date: today,
  checked: (sp.products || []).filter(p => p.dataStatus === "live" && p.priceMedian).length,
  warned: (sp.products||[]).filter(p=>p.qaWarn).length, blocked, note: "Blocked products stay in the data and on the Board (labeled); they are barred from Daily Three, social posts, cards, and the newsletter until they pass.",
  flags };
await writeFile(join(ROOT, "research/pulse/qa-report.json"), JSON.stringify(report, null, 1));
console.log(`✓ QA gate: ${report.checked} checked · ${blocked} blocked from publication`);
for (const f of flags.slice(0, 8)) console.log(`  ⚠ ${f.name.slice(0, 34)}: ${f.reasons[0]}`);
