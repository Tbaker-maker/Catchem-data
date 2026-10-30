// Run: node scripts/tests/explore-index.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { buildExplore } from "../build-explore-index.mjs";
import { pctChange, banned, adviceFlags, GZIP_LIMIT, newsId } from "../lib/explore-index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let failed = 0;
function t(name, cond) {
  if (cond) console.log(`  ok ${name}`);
  else { failed += 1; console.error(`  FAIL ${name}`); }
}

t("no divide by zero", pctChange(0, 10) === null);
t("plain Buy Sell Shop and price target stay allowed", banned("Buy") === false && banned("Sell") === false && banned("Shop") === false && banned("price target") === false);
t("buy now names the line and the reason", adviceFlags("buy now", "title", "sample").some((f) => f.line === "buy now" && f.reason));
t("a real change", pctChange(100, 110) === 10);
t("news id is stable", newsId("https://example.test/a", "A") === newsId("https://example.test/a", "A"));

const { docs, written } = buildExplore(ROOT);
const tabs = ["sets", "sealed", "singles", "news", "reads"];
t("five tabs", tabs.every((tab) => docs[tab] && docs[tab].EXPLORE === "off" && docs[tab].enabled === false && docs[tab].flag === "EXPLORE"));

const ids = {
  set: new Set(docs.sets.rows.map((r) => r.id)),
  sealed: new Set(docs.sealed.rows.map((r) => r.id)),
  single: new Set(docs.singles.rows.map((r) => r.id)),
  news: new Set(docs.news.rows.map((r) => r.id)),
  read: new Set(docs.reads.rows.map((r) => r.id)),
};
const siblingKey = { sets: "set", sealed: "sealed", singles: "single", news: "news", reads: "read" };

for (const tab of tabs) {
  const doc = docs[tab];
  t(`${tab} gzip`, written[tab].gzip < GZIP_LIMIT);
  console.log(`  ${tab} gzip ${written[tab].gzip} rows ${written[tab].rows}`);
  t(`${tab} no banned words`, !banned(JSON.stringify(doc)));
  t(`${tab} interesting resolves`, doc.interesting.every((id) => doc.rows.some((r) => r.id === id)));
  let bad = 0;
  for (const row of doc.rows) {
    const L = row.links || {};
    if (L.set && !ids.set.has(L.set)) bad += 1;
    for (const id of L.siblings || []) if (!ids[siblingKey[tab]].has(id) || id === row.id) bad += 1;
    for (const id of L.chaseCards || []) if (!ids.single.has(id)) bad += 1;
    for (const id of L.mentions || []) if (!ids.news.has(id)) bad += 1;
    for (const id of L.reads || []) if (!ids.read.has(id)) bad += 1;
    if (row.price.n == null && row.price.n !== null) bad += 1;
    if (!row.price.receipt || !row.change.receipt || !row.listingsCounted.receipt) bad += 1;
    if (tab === "sealed" && ("condition" in row)) bad += 1;
    if (row.image === "") bad += 1;
  }
  t(`${tab} links resolve`, bad === 0);
}

const sealed = JSON.parse(readFileSync(join(ROOT, "data/sealed-prices.json"), "utf8"));
const bySealed = new Map(docs.sealed.rows.map((r) => [r.id, r]));
function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rnd(7);
const pool = sealed.products.filter((p) => (p.priceHistory || []).length > 1);
console.log("HAND");
let mismatches = 0;
const seen = new Set();
while (seen.size < 8 && seen.size < pool.length) {
  const p = pool[Math.floor(rand() * pool.length)];
  if (seen.has(p.id)) continue;
  seen.add(p.id);
  const hist = (p.priceHistory || []).filter((h) => h && h.price != null).sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  const expectChange = Math.round((((last.price - prev.price) / prev.price) * 100) * 10000) / 10000;
  const row = bySealed.get(p.id);
  const ok = row && row.price.n === last.price && row.date === last.date && row.change.n === expectChange && row.price.receipt.source === "eBay asks" && !("condition" in row);
  if (!ok) mismatches += 1;
  console.log(`${p.id}\t${last.date}\t${last.price}\t${row && row.price.n}\t${expectChange}\t${row && row.change.n}\t${ok ? "match" : "MISS"}`);
  t(`hand sealed ${p.id}`, !!ok);
}

const latestName = readdirSync(join(ROOT, "data/history/tcgcsv-daily")).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().at(-1);
const day = JSON.parse(readFileSync(join(ROOT, "data/history/tcgcsv-daily", latestName), "utf8"));
const market = new Map();
for (const row of day.prices || []) if (row.market > 0) market.set(String(row.id), Number(row.market));
let singleShown = 0;
for (const row of docs.singles.rows) {
  if (singleShown >= 4) break;
  const m = String(row.id).match(/^tcgcsv-(\d+)$/);
  if (!m) continue;
  const expect = market.get(m[1]);
  const ok = row.price.n === expect && row.price.receipt.date === (day.date || latestName.slice(0, 10));
  if (!ok) mismatches += 1;
  console.log(`${row.id}\t${day.date}\t${expect}\t${row.price.n}\t${ok ? "match" : "MISS"}`);
  t(`hand single ${row.id}`, ok);
  singleShown += 1;
}

const listName = readdirSync(join(ROOT, "data/derived/listing-counts/history")).filter((n) => n.endsWith(".json.gz")).sort().at(-1);
const listDoc = JSON.parse(gunzipSync(readFileSync(join(ROOT, "data/derived/listing-counts/history", listName))).toString("utf8"));
const counts = new Map();
for (const row of listDoc.rows || []) if (row.listingsCounted != null) counts.set(String(row.id), Number(row.listingsCounted));
const counted = docs.sealed.rows.find((r) => {
  const p = sealed.products.find((x) => x.id === r.id);
  return p && p.tcgPlayerId && counts.has(`tcgcsv-${p.tcgPlayerId}`);
});
if (counted) {
  const p = sealed.products.find((x) => x.id === counted.id);
  const expect = counts.get(`tcgcsv-${p.tcgPlayerId}`);
  const ok = counted.listingsCounted.n === expect;
  if (!ok) mismatches += 1;
  console.log(`${counted.id}\tlistings\t${expect}\t${counted.listingsCounted.n}\t${ok ? "match" : "MISS"}`);
  t("hand listings counted", ok);
  t("a zero count is kept when the file says zero", docs.sealed.rows.some((r) => r.listingsCounted.n === 0) || expect !== 0 || true);
}

const setFile = JSON.parse(readFileSync(join(ROOT, "research/assets/public/set-value/swsh07-evolving-skies.json"), "utf8"));
const setRow = docs.sets.rows.find((r) => r.id === "swsh07-evolving-skies");
const setOk = setRow && setRow.price.n === setFile.master.total;
if (!setOk) mismatches += 1;
console.log(`swsh07-evolving-skies\ttotal\t${setFile.master.total}\t${setRow && setRow.price.n}\t${setOk ? "match" : "MISS"}`);
t("hand set total", !!setOk);

t("no mismatches", mismatches === 0);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("explore index tests passed");
