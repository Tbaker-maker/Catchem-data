// Nightly: compare eBay median ask with TCGplayer market (TCGCSV days) per sealed item.
// Writes data/price-sanity.json (ids + action only, no read text) and, when
// PRIVATE_OUT is set, the full private report there.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { checkRow, quantiles, band, LIMITS, EBAY_LEAD_USD } from "./lib/price-sanity.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

const sealed = await J("data/sealed-prices.json");
const asOf = String(sealed.updatedAt || "").slice(0, 10);
const histDir = join(ROOT, "data/history/tcgplayer-market");
const tcg = new Map();
for (const f of await readdir(histDir)) {
  if (!f.endsWith(".json") || f === "mapping.json" || f === "coverage.json") continue;
  const d = JSON.parse(await readFile(join(histDir, f), "utf8"));
  const pts = (d.points || []).filter((p) => p.market > 0);
  if (!pts.length) continue;
  const last = pts.at(-1);
  let flat = 0;
  for (let i = pts.length - 1; i >= 0 && pts[i].market === last.market; i--) flat = Math.round((Date.parse(last.date) - Date.parse(pts[i].date)) / 86400000);
  tcg.set(d.id, { market: last.market, date: last.date, flat });
}

const rows = [];
for (const p of sealed.products || []) {
  const t = tcg.get(p.id);
  const ebay = p.askMedian ?? p.priceMedian ?? p.priceUsd;
  if (!t || !(ebay > 0)) continue;
  rows.push(checkRow({ id: p.id, name: p.name, setId: p.setId, subtype: p.subtype, ebay, listings: p.listingCount ?? 0, tcg: t.market, tcgDate: t.date, tcgFlatDays: t.flat, asOf }));
}
const withBoth = rows.filter((r) => r.ratio != null);
const flagged = withBoth.filter((r) => r.flag);
const worst = [...flagged].sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio))).slice(0, 20);
const byBand = {};
for (const r of withBoth) (byBand[r.band] ||= []).push(r.ratio);
const lead = { ebay: withBoth.filter((r) => r.lead === "ebay").length, tcgplayer: withBoth.filter((r) => r.lead === "tcgplayer").length };

const report = {
  asOf, generatedFrom: ["data/sealed-prices.json", "data/history/tcgplayer-market/*.json"],
  note: "eBay side is asking prices, not sales. Ratio = eBay median ask / TCGplayer market.",
  limits: LIMITS, ebayLeadUsd: EBAY_LEAD_USD,
  counts: { sealedItems: (sealed.products || []).length, withBoth: withBoth.length, flagged: flagged.length,
    actions: flagged.reduce((m, r) => ((m[r.action] = (m[r.action] || 0) + 1), m), {}) },
  ratioQuantiles: quantiles(withBoth.map((r) => r.ratio)),
  byBand: Object.fromEntries(Object.entries(byBand).map(([k, v]) => [k, { n: v.length, ...quantiles(v, [0.1, 0.5, 0.9]) }])),
  leadProposal: lead,
  worst, rows: withBoth,
};
const pub = { asOf, source: "data/sealed-prices.json + data/history/tcgplayer-market", items: Object.fromEntries(flagged.filter((r) => r.action !== "review").map((r) => [r.id, r.action])) };
await writeFile(join(ROOT, "data/indexes/price-sanity.json"), JSON.stringify(pub, null, 2) + "\n");
if (process.env.PRIVATE_OUT) {
  await mkdir(process.env.PRIVATE_OUT, { recursive: true });
  await writeFile(join(process.env.PRIVATE_OUT, "summary.json"), JSON.stringify(report, null, 2) + "\n");
} else {
  let store;
  try { store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" }); }
  catch (err) { console.error(`price sanity: ${err.message}; using local data/private`); store = await openPrivate({ root: ROOT, token: "" }); }
  const dir = join(store.dir, "price-sanity");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "summary.json"), JSON.stringify(report, null, 2) + "\n");
  const res = await store.close(["price-sanity/summary.json"], `price sanity ${asOf}`);
  console.log("private:", JSON.stringify(res));
}
console.log(JSON.stringify({ ...report.counts, ratioQuantiles: report.ratioQuantiles, byBand: report.byBand, lead }, null, 0));
