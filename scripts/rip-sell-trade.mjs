// rip-sell-trade.mjs — RIP IT, SELL IT, OR TRADE IT.
//
// One question every sealed owner actually has, and nobody answers with
// numbers: you own this box — what is it worth doing with it?
//
//   RIP IT   — break it into packs. What the contents fetch as loose packs.
//   SELL IT  — list it online. What you keep after marketplace fees.
//   TRADE IT — hand it over at a table. The middle of the deal zone, where a
//              cash trade beats the internet for both sides.
//
// Every input already exists: pack economics, net proceeds, deal zone. Nobody
// else holds all three for the same product, which is the only reason this can
// exist at all.
//
// WHAT IT WILL NOT DO: it will not price the cards inside. We have no pull-rate
// or hit-value data we could defend, so "rip" means what the PACKS are worth,
// not what you might pull. Presenting an expected-value guess as a number would
// be the single most dishonest thing this product could do — it is exactly the
// figure a reader would act on, and exactly the one we cannot source.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const der = await J("data/derived-insights.json") ?? {};
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const packMath = der.packMath ?? {};
const zones = der.dealZone?.byId ?? {};
const nets = der.netProceeds?.byId ?? {};
const money = n => Math.round(n * 100) / 100;

// Loose pack price per set, so "what are the packs worth" is a real number
// rather than an inference from the box we are trying to value.
const loosePack = {};
for (const p of sp.products) {
  if (p.subtype !== "booster-pack" || !p.priceMedian || p.publishBlock) continue;
  loosePack[p.setId] = p.priceMedian;
}
// packMath publishes perPack, not a count. The count is recoverable from the
// box price it was derived from — reversing our own arithmetic rather than
// hardcoding pack counts that would drift from the products file.
const priceOf = Object.fromEntries(sp.products.filter(p => p.priceMedian).map(p => [p.id, p.priceMedian]));
const packsIn = {};
for (const r of packMath.all ?? []) {
  if (!r.perPack || !priceOf[r.id]) continue;
  const n = Math.round(priceOf[r.id] / r.perPack);
  if (n > 1 && n <= 40) packsIn[r.id] = n;      // a sealed box is 1<n<=36; 40 allows for oddities
}

const rows = [];
for (const p of sp.products) {
  if (p.dataStatus !== "live" || !p.priceMedian || p.publishBlock) continue;
  const packs = packsIn[p.id];
  const lp = loosePack[p.setId];
  const zone = zones[p.id];
  const net = nets[p.id];
  if (!packs || !lp || !zone || net == null) continue;   // all three exits or none

  const rip = money(packs * lp);
  const sell = money(typeof net === "number" ? net : net.ebay ?? 0);
  const trade = money(zone.midpoint);
  if (!rip || !sell || !trade) continue;

  // TRADE always beats SELL by construction — the deal-zone midpoint sits above
  // the online net because nobody takes a cut. A tool where one option always
  // wins is not a decision, it is a slogan. So the genuine choice is RIP vs
  // SELL, and TRADE is presented as what it actually is: a modifier on either.
  const online = [
    { exit: "RIP IT", value: rip, note: `${packs} packs at $${lp} each, sold loose` },
    { exit: "SELL IT", value: sell, note: `listed sealed online, after marketplace fees` },
  ].sort((a, b) => b.value - a.value);
  const best = online[0], other = online[1];
  const gapPct = Math.round((best.value / other.value - 1) * 1000) / 10;
  const tradeBonusPct = Math.round((trade / sell - 1) * 1000) / 10;

  rows.push({
    id: p.id, name: p.name, sealedPrice: p.priceMedian, packs,
    rip, sell, trade, best: best.exit, gapPct, tradeBonusPct, options: online,
    chip: "READ",
    read: `Sold online, this box is worth more ${best.exit === "RIP IT" ? "broken into packs" : "left sealed"} — about $${best.value.toLocaleString("en-US")} against $${other.value.toLocaleString("en-US")}, a ${Math.abs(gapPct)}% difference. ` +
      (best.exit === "RIP IT"
        ? `The packs fetch more loose than the box does as a box. That is what the PACKS are worth, not what you might pull — we do not price the cards inside, because there is no pull data here we could defend.`
        : `The sealed box carries a premium the loose pack market has not matched.`) +
      ` Selling it face to face instead clears about ${tradeBonusPct}% more than listing it, because nobody takes a cut — that part needs a buyer standing in front of you, which is the bit a number cannot promise.`,
  });
}

rows.sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));
const out = { generatedAt: new Date().toISOString(),
  name: "Rip it, Sell it, or Trade it",
  question: "You own this sealed box. What is it worth doing with it?",
  method: "RIP = the packs inside at loose pack prices. SELL = what you keep online after fees. The real choice is between those two. TRADE is not a third contender — a face-to-face deal beats an online listing every time because nobody takes a cut, so it is shown as a bonus on whichever route you pick.",
  limits: "We do not price the cards inside a pack. There is no pull-rate or hit-value figure here we could source, so RIP is what the PACKS are worth — never an expected value for what you might open.",
  chip: "READ", covered: rows.length, rows: rows.slice(0, 60) };

await writeFile(join(ROOT, "research/pulse/rip-sell-trade.json"), JSON.stringify(out, null, 1));
console.log(`✓ rip/sell/trade: ${rows.length} products with all three exits priced`);
for (const r of rows.slice(0, 5))
  console.log(`  ${r.best.padEnd(8)} ${r.name.slice(0, 30).padEnd(30)} rip $${String(r.rip).padStart(8)} vs sell $${String(r.sell).padStart(8)}  (${r.gapPct > 0 ? "+" : ""}${r.gapPct}%) · trading adds ${r.tradeBonusPct}%`);
