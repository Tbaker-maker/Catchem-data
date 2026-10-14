// Nightly: compare eBay median ask with TCGplayer market (TCGCSV days) per sealed item.
// Writes data/price-sanity.json (ids + action only, no read text) and, when
// PRIVATE_OUT is set, the full private report there.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { checkRow, checkSingle, quantiles, band, LIMITS, EBAY_LEAD_USD } from "./lib/price-sanity.mjs";
import { buildQuery, keepTitle } from "./lib/listing-counts.mjs";

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

async function topSingles(limit = 25) {
  const dir = join(ROOT, "research/assets/public/buckets");
  let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith(".json")); } catch { files = []; }
  const cards = [];
  for (const f of files) {
    let rows = [];
    try { rows = JSON.parse(await readFile(join(dir, f), "utf8")); } catch { continue; }
    for (const r of rows || []) {
      if (r?.kind === "sealed" || !(r?.price >= 20) || !r?.id || !r?.num) continue;
      cards.push({ id: r.id, name: r.name || "", number: r.num, setId: r.setSlug || "", tcg: r.price, tcgDate: String(r.asOf || asOf).slice(0, 10) });
    }
  }
  cards.sort((a, b) => b.tcg - a.tcg || (a.id < b.id ? -1 : 1));
  return cards.slice(0, limit);
}

let asksFile = null;
try { asksFile = JSON.parse(await readFile(join(ROOT, "data/derived/singles-asks.json"), "utf8")); } catch { asksFile = null; }
if (!asksFile && process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID) {
  try {
    const basic = Buffer.from(`${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`).toString("base64");
    const tokRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });
    if (tokRes.ok) {
      const token = (await tokRes.json()).access_token;
      const rows = [];
      for (const card of (await topSingles(15))) {
        const params = new URLSearchParams({ q: buildQuery({ kind: "single", name: card.name, number: card.number }), category_ids: "183454", filter: "conditionIds:{4000},priceCurrency:USD,itemLocationCountry:US", limit: "50" });
        const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, { signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
        if (!res.ok) continue;
        const data = await res.json();
        const prices = (data.itemSummaries || []).filter((item) => keepTitle("single", item.title || "")).map((item) => Number(item.price?.value)).filter((n) => n > 0).sort((a, b) => a - b);
        if (prices.length) rows.push({ id: card.id, name: card.name, number: card.number, ebay: Math.round(prices[Math.floor(prices.length / 2)] * 100) / 100, listings: prices.length, date: asOf, condition: "Ungraded" });
        await new Promise((r) => setTimeout(r, 200));
      }
      if (rows.length) {
        asksFile = { asOf, note: "eBay asking, Ungraded. A listing is not a sale.", rows };
        await mkdir(join(ROOT, "data/derived"), { recursive: true });
        await writeFile(join(ROOT, "data/derived/singles-asks.json"), JSON.stringify(asksFile, null, 1) + "\n");
      }
    }
  } catch (err) { console.error(`singles asks skipped: ${err.message}`); }
}
const askById = new Map();
for (const row of asksFile?.rows || []) if (row?.id && row.ebay > 0) askById.set(row.id, row);
const singles = [];
for (const card of await topSingles()) {
  const ask = askById.get(card.id);
  if (!ask) continue;
  singles.push(checkSingle({
    id: card.id, name: card.name, number: card.number, setId: card.setId,
    ebay: ask.ebay, listings: ask.listings ?? 0, tcg: card.tcg, tcgDate: card.tcgDate,
    tcgFlatDays: 0, asOf: ask.date || asksFile.asOf || asOf,
  }));
}
const singlesFlagged = singles.filter((r) => r.flag);

const report = {
  asOf, generatedFrom: ["data/sealed-prices.json", "data/history/tcgplayer-market/*.json"],
  note: "eBay side is asking prices, not sales. Ratio = eBay median ask / TCGplayer market. Singles use the same check when a dated eBay ask file names the card.",
  limits: LIMITS, ebayLeadUsd: EBAY_LEAD_USD,
  counts: { sealedItems: (sealed.products || []).length, withBoth: withBoth.length, flagged: flagged.length,
    singlesCompared: singles.length, singlesFlagged: singlesFlagged.length,
    actions: flagged.reduce((m, r) => ((m[r.action] = (m[r.action] || 0) + 1), m), {}) },
  ratioQuantiles: quantiles(withBoth.map((r) => r.ratio)),
  byBand: Object.fromEntries(Object.entries(byBand).map(([k, v]) => [k, { n: v.length, ...quantiles(v, [0.1, 0.5, 0.9]) }])),
  leadProposal: lead,
  worst, rows: withBoth,
  singles,
};
const pub = {
  asOf,
  source: "data/sealed-prices.json + data/history/tcgplayer-market",
  items: Object.fromEntries(flagged.filter((r) => r.action !== "review").map((r) => [r.id, r.action])),
  singles: Object.fromEntries(singlesFlagged.filter((r) => r.action !== "review").map((r) => [r.id, r.action])),
  singlesAsOf: asksFile?.asOf || "",
};
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
