// One Browse call per WOTC single, listings only. Stops on 403 or 429.
// Spends only the room left under the shared 24h counter after the sealed reserve.
// The price band is read from catchem-data-private and is never written out.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { used24 } from "./lib/listing-counts.mjs";
import { loadPriceTrustConfig } from "./lib/price-trust.mjs";
import {
  headlinePass, parseListing, passingConditions, publicSampleDoc, publicSampleRow, sampleQuery, sampleRoom, topVintage,
} from "./lib/listing-sample.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OAUTH = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = async (p, d) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

async function token() {
  const { EBAY_APP_ID: a, EBAY_CERT_ID: c } = process.env;
  if (!a || !c) return null;
  const res = await fetch(OAUTH, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${a}:${c}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (res.status === 403 || res.status === 429) {
    console.log(`eBay OAuth ${res.status}, stopping`);
    return { stop: res.status };
  }
  if (!res.ok) throw new Error(`OAuth ${res.status}`);
  return { access: (await res.json()).access_token };
}

async function band() {
  try { return await loadPriceTrustConfig(ROOT); } catch { /* private checkout next */ }
  const key = process.env.PRIVATE_DATA_TOKEN || "";
  if (!key) return null;
  const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/price-trust.json", {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-vintage-sample" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return null;
  const cfg = await res.json();
  const minListings = Number(cfg.minListings);
  const minRatio = Number(cfg.minRatio);
  const maxRatio = Number(cfg.maxRatio);
  if (!(minListings >= 1) || !(minRatio > 0) || !(maxRatio > minRatio)) return null;
  return { minListings, minRatio, maxRatio };
}

function cardsFrom(catalog, sets, daily, held) {
  const byName = new Map((sets.sets || sets || []).map((row) => [row.name, row]));
  const priceById = new Map((daily.prices || []).map((row) => [Number(row.id), row]));
  const out = [];
  for (const item of catalog.items || []) {
    if (!item || item.kind === "sealed") continue;
    const set = byName.get(item.set);
    const day = priceById.get(Number(item.tcgplayerProductId));
    const printings = (day?.printings || item.printings || [])
      .filter((row) => row && row.name && Number(row.price) > 0)
      .map((row) => ({ name: row.name, price: Number(row.price) }));
    const price = Number(day?.market ?? item.price);
    const printing = String(day?.printing || item.printing || "");
    out.push({
      id: item.id,
      name: item.name,
      number: item.number,
      set: item.set,
      slug: set?.slug || "",
      release: set?.release || "",
      kind: "single",
      price,
      printing,
      printings: printings.length ? printings : (printing && price > 0 ? [{ name: printing, price }] : []),
      unverified: held[item.id] === "unverified",
    });
  }
  return out;
}

async function searchOne(access, card) {
  const params = new URLSearchParams({
    q: sampleQuery(card),
    category_ids: "183454",
    filter: "conditionIds:{4000},priceCurrency:USD,itemLocationCountry:US",
    limit: "50",
  });
  const res = await fetch(`${SEARCH}?${params}`, {
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${access}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
  });
  if (res.status === 403 || res.status === 429) return { stop: res.status };
  if (!res.ok) return { listings: [] };
  const data = await res.json();
  const listings = [];
  for (const item of data.itemSummaries || []) {
    const row = parseListing(item);
    if (row) listings.push(row);
  }
  return { listings };
}

function applyCard(item, head, passes, asOf) {
  item.price = head.amount;
  delete item.priceStatus;
  for (const printing of item.printings || []) {
    const hit = passes.find((row) => row.printing === printing.name);
    if (!hit) continue;
    if (printing.name === head.printing) {
      printing.price = head.amount;
      printing.asOf = asOf;
      delete printing.status;
    }
  }
}

const statePath = join(ROOT, "data/derived/listing-counts/state.json");
const samplePath = join(ROOT, "data/derived/vintage-sample.json");
const holdPath = join(ROOT, "research/assets/public/price-hold.json");
const ladderPath = join(ROOT, "research/assets/public/condition-prices.json");

const now = new Date();
const state = await J(statePath, { last: {}, log: [] });
state.log ||= [];
const used = used24(state.log, now);
const room = sampleRoom({ used });
const prior = await J(samplePath, { rows: [] });
const seen = new Set((prior.rows || []).map((row) => row.id));
console.log(`vintage sample: used ${used} in 24h, room ${room}, already checked ${seen.size}`);
if (room < 1) {
  console.log("vintage sample: no room under the shared listing budget");
  process.exit(0);
}
const cfg = await band();
if (!cfg) {
  console.log("vintage sample: price trust config is not on this machine, nothing published");
  process.exit(0);
}
const tok = await token();
if (!tok) {
  console.log("vintage sample: no eBay keys, nothing called");
  process.exit(0);
}
if (tok.stop) process.exit(0);

const catalog = await J(join(ROOT, "data/catalog/tcgcsv-latest.json"), { items: [] });
const sets = await J(join(ROOT, "research/assets/public/sets.json"), { sets: [] });
const dayName = String(catalog.asOf || now.toISOString().slice(0, 10)).slice(0, 10);
const daily = await J(join(ROOT, "data/history/tcgcsv-daily", `${dayName}.json`), { prices: [] });
const hold = await J(holdPath, { ids: {} });
hold.ids ||= {};
const ladder = await J(ladderPath, { asOf: dayName, source: "TCGplayer market", note: "A price is kept only when the file names that condition and that printing.", cards: {} });
ladder.cards ||= {};
const pool = topVintage(cardsFrom(catalog, sets, daily, hold.ids), 300).filter((card) => !seen.has(card.id)).slice(0, room);
console.log(`vintage sample: calling ${pool.length}`);

const fresh = [];
let calls = 0;
let stop = 0;
for (const card of pool) {
  calls += 1;
  let result;
  try { result = await searchOne(tok.access, card); }
  catch (err) { console.log(`vintage sample: ${err.name || "error"}, stopping`); break; }
  if (result.stop) {
    stop = result.stop;
    console.log(`eBay ${stop}, stopping`);
    break;
  }
  const passes = passingConditions(card, result.listings, cfg);
  const head = headlinePass(card, passes);
  let wrote = false;
  if (head && card.slug) {
    const setPath = join(ROOT, "research/assets/public/sets", `${card.slug}.json`);
    const setDoc = await J(setPath, null);
    const item = setDoc?.items?.find((row) => row && row.id === card.id);
    if (item) {
      applyCard(item, head, passes, dayName);
      await writeFile(setPath, JSON.stringify(setDoc));
      delete hold.ids[card.id];
      const slot = { date: dayName };
      for (const pass of passes.filter((bit) => bit.printing === head.printing)) slot[pass.condition] = pass.amount;
      ladder.cards[card.id] = { ...(ladder.cards[card.id] || {}), [head.printing]: slot };
      wrote = true;
    }
  }
  fresh.push(publicSampleRow(card, wrote ? passes : []));
  await sleep(250);
}

if (calls > 0) state.log.push({ at: new Date().toISOString(), n: calls, source: "vintage-sample" });
await writeFile(statePath, JSON.stringify(state) + "\n");
const doc = publicSampleDoc(dayName, [...(prior.rows || []), ...fresh]);
await writeFile(samplePath, JSON.stringify(doc, null, 1) + "\n");
if (fresh.some((row) => row.published)) {
  hold.asOf = dayName;
  ladder.asOf = dayName;
  await writeFile(holdPath, JSON.stringify(hold));
  await writeFile(ladderPath, JSON.stringify(ladder));
}
const published = fresh.filter((row) => row.published).length;
console.log(JSON.stringify({ called: calls, checked: fresh.length, published, stop }));
