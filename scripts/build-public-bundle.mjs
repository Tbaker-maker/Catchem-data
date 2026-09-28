// Builds research/assets/public from the TCGplayer catalog and the eBay sealed tape.
// No PPT fields. Missing prices are omitted, never written as 0.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bucketOf, changePct, cleanHistory, eraOf, headlineFor, money, pretty, rankReads, slug,
} from "./lib/public-bundle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/assets/public");

const read = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function packsFor(p) {
  if (p.packs != null) return p.packs;
  const era = /^me/.test(p.setId || "") ? "me" : /^sv/.test(p.setId || "") ? "sv" : /^swsh/.test(p.setId || "") ? "swsh" : null;
  if ((p.setId || "") === "cel25") return null;
  if (p.subtype === "booster-pack") return 1;
  if (p.subtype === "booster-box") return 36;
  if (p.subtype === "booster-bundle") return 6;
  if (p.subtype === "etb" || p.subtype === "pc-etb") return era === "swsh" ? 8 : (era ? 9 : null);
  return null;
}

const catalog = await read("data/catalog/tcgcsv-latest.json");
const items = catalog.items || [];
const yestDoc = await read("data/history/tcgcsv-daily/2026-09-26.json").catch(() => null);
const todayDoc = await read("data/history/tcgcsv-daily/2026-09-27.json").catch(() => null);
const yest = new Map((yestDoc?.prices || []).map((row) => [row.id, row.market]));
const today = new Map((todayDoc?.prices || []).map((row) => [row.id, row.market]));

const catalogue = await read("data/card-catalogue.json").catch(() => ({ cards: {} }));
const byName = new Map();
for (const item of items) {
  const key = norm(String(item.name || "").split(" - ")[0]);
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(item);
}

const artistById = new Map();
let artistMatches = 0;
const artistGroups = new Map();
for (const card of Object.values(catalogue.cards || {})) {
  const artist = String(card.artist || "").trim();
  if (!artist) continue;
  const cands = byName.get(norm(card.name)) || [];
  const setName = norm(card.setName);
  const num = norm(card.number).replace(/^0+/, "");
  let best = null;
  let bestScore = 0;
  for (const item of cands) {
    const set = norm(item.set);
    let score = 0;
    if (setName && (set.includes(setName) || setName.includes(set))) score += 2;
    const inum = norm(item.number).replace(/^0+/, "");
    if (num && inum && (inum.startsWith(num) || num.startsWith(inum.split(" ")[0]))) score += 2;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (!best || bestScore < 2) continue;
  artistMatches += 1;
  if (!artistById.has(best.id)) artistById.set(best.id, artist);
  const list = artistGroups.get(artist) || [];
  list.push(best.id);
  artistGroups.set(artist, list);
}

const slugUsed = new Map();
const setSlug = new Map();
for (const item of items) {
  const key = `${item.groupId}|${item.set}`;
  if (setSlug.has(key)) continue;
  let s = slug(item.set) || "set";
  if (slugUsed.has(s)) s = `${s}-${item.groupId}`;
  slugUsed.set(s, key);
  setSlug.set(key, s);
}

const releaseBySet = new Map();
for (const card of Object.values(catalogue.cards || {})) {
  if (!card.releaseDate || !card.setName) continue;
  const day = String(card.releaseDate).replaceAll("/", "-").slice(0, 10);
  const key = norm(card.setName);
  if (key && day && !releaseBySet.has(key)) releaseBySet.set(key, day);
}
function releaseFor(setName) {
  const n = norm(setName);
  if (releaseBySet.has(n)) return releaseBySet.get(n);
  for (const [key, day] of releaseBySet) {
    if (n.includes(key) || key.includes(n)) return day;
  }
  return null;
}

const sets = new Map();
for (const item of items) {
  const key = `${item.groupId}|${item.set}`;
  if (!sets.has(key)) {
    sets.set(key, {
      slug: setSlug.get(key),
      name: pretty(item.set),
      era: eraOf(item.set),
      groupId: item.groupId,
      release: releaseFor(item.set),
      single: 0,
      sealed: 0,
      priced: 0,
      up: 0,
      down: 0,
      items: [],
    });
  }
  const set = sets.get(key);
  if (item.kind === "sealed") set.sealed += 1;
  else set.single += 1;
  const price = money(item.price) ? Number(item.price) : null;
  if (price) set.priced += 1;
  const prev = yest.get(item.tcgplayerProductId);
  const pct = price ? changePct(prev, price) : null;
  if (pct > 0) set.up += 1;
  else if (pct < 0) set.down += 1;
  const artist = artistById.get(item.id) || null;
  set.items.push({
    id: item.id,
    name: pretty(item.name),
    num: item.number || "",
    kind: item.kind === "sealed" ? "sealed" : "single",
    rarity: item.rarity || "",
    price,
    pid: item.tcgplayerProductId,
    artist,
    pct,
  });
}

await mkdir(join(OUT, "sets"), { recursive: true });
await mkdir(join(OUT, "buckets"), { recursive: true });
await mkdir(join(OUT, "artists"), { recursive: true });

const setIndex = [];
const buckets = new Map();
const search = [];
let pricedSingles = 0;
let pricedSealed = 0;
for (const set of sets.values()) {
  const heatDenom = set.up + set.down;
  const row = {
    slug: set.slug,
    name: set.name,
    era: set.era,
    release: set.release,
    single: set.single,
    sealed: set.sealed,
    priced: set.priced,
    upShare: heatDenom ? Math.round((100 * set.up) / heatDenom) : null,
  };
  setIndex.push(row);
  const body = { ...row, source: "TCGplayer market", asOf: catalog.asOf, items: set.items };
  await writeFile(join(OUT, "sets", `${set.slug}.json`), JSON.stringify(body));
  for (const item of set.items) {
    if (item.price && item.kind === "single") pricedSingles += 1;
    if (item.price && item.kind === "sealed") pricedSealed += 1;
    const card = { ...item, set: set.name, setSlug: set.slug, source: "TCGplayer market", asOf: catalog.asOf };
    const b = bucketOf(item.id);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(card);
    search.push([item.id, item.name, set.slug, item.num || "", item.artist || "", item.kind, item.price || 0]);
  }
}
setIndex.sort((a, b) => a.era.localeCompare(b.era) || a.name.localeCompare(b.name));
for (const [b, rows] of buckets) {
  await writeFile(join(OUT, "buckets", `${b}.json`), JSON.stringify(rows));
}

const byId = new Map(items.map((item) => [item.id, item]));
const artistIndex = [];
for (const [name, ids] of [...artistGroups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
  const unique = [...new Set(ids)];
  const aSlug = slug(name);
  if (!aSlug) continue;
  const cards = [];
  for (const id of unique) {
    const item = byId.get(id);
    if (!item) continue;
    const key = `${item.groupId}|${item.set}`;
    const price = money(item.price) ? Number(item.price) : null;
    cards.push({
      id: item.id,
      name: pretty(item.name),
      set: pretty(item.set),
      setSlug: setSlug.get(key),
      num: item.number || "",
      price,
    });
  }
  if (!cards.length) continue;
  artistIndex.push({ slug: aSlug, name: pretty(name), count: cards.length });
  await writeFile(join(OUT, "artists", `${aSlug}.json`), JSON.stringify({ name: pretty(name), slug: aSlug, source: "illustrator credit from pokemontcg.io, price from TCGplayer market", cards }));
}

const counts = {
  asOf: catalog.asOf,
  source: "TCGplayer market",
  items: items.length,
  single: items.filter((row) => row.kind === "single").length,
  sealed: items.filter((row) => row.kind === "sealed").length,
  slab: 0,
  sets: setIndex.length,
  priced: items.filter((row) => money(row.price)).length,
  artists: artistIndex.length,
  artistCards: artistMatches,
  artistNote: "Illustrator credits cover only the cards we could match. Not every card, and not every artist.",
  ebaySealedTracked: null,
};
await writeFile(join(OUT, "counts.json"), JSON.stringify(counts, null, 1) + "\n");
await writeFile(join(OUT, "sets.json"), JSON.stringify({ asOf: catalog.asOf, source: "TCGplayer market", sets: setIndex }));
await writeFile(join(OUT, "artists.json"), JSON.stringify({ asOf: catalog.asOf, note: counts.artistNote, artists: artistIndex }));
await writeFile(join(OUT, "search-lite.json"), JSON.stringify(search));

function rowRead(item, set, type, extra = {}) {
  const price = money(item.price) ? Number(item.price) : null;
  if (!price) return null;
  const prev = yest.get(item.pid || item.tcgplayerProductId);
  const pct = changePct(prev, price);
  const history = cleanHistory([prev, price]);
  const read = {
    id: `${type}-${item.id}`,
    type,
    kind: item.kind === "sealed" ? "sealed" : "single",
    set: set.name,
    setSlug: set.slug,
    name: item.name,
    price,
    changePct: pct,
    source: "TCGplayer market",
    asOf: catalog.asOf,
    confidence: "Early",
    history,
    image: item.pid ? `https://tcgplayer-cdn.tcgplayer.com/product/${item.pid}_in_400x400.jpg` : "",
    href: item.kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`,
    number: item.num || "",
    rarity: item.rarity || "",
    why: "Compared with yesterday's TCGplayer market price. One day is not a trend.",
    score: Math.abs(pct || 0),
    ...extra,
  };
  read.headline = headlineFor(read);
  if (!read.headline) return null;
  return read;
}

const candidates = [];
const flat = [];
for (const set of sets.values()) {
  for (const item of set.items) flat.push([item, set]);
}
const movers = flat
  .map(([item, set]) => rowRead(item, set, "mover"))
  .filter((row) => row && Number.isFinite(row.changePct) && row.changePct !== 0);
movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
for (const row of movers) {
  if (row.changePct >= 8) row.type = "heating";
  else if (row.changePct <= -8) row.type = "cooling";
  row.headline = headlineFor(row);
  row.id = `${row.type}-${row.id.split("-").slice(1).join("-")}`;
}
const singleMovers = movers.filter((row) => row.kind === "single").slice(0, 40);
const sealedMovers = movers.filter((row) => row.kind === "sealed").slice(0, 20);
candidates.push(...singleMovers.slice(0, 14), ...sealedMovers.slice(0, 8));

const chaseSets = new Map();
for (const [item, set] of flat) {
  if (item.kind !== "single" || !item.price) continue;
  if (!/illustration|special illustration|hyper|rainbow|art rare|ultra rare/i.test(item.rarity || "")) continue;
  const prev = chaseSets.get(set.slug);
  if (!prev || item.price > prev[0].price) chaseSets.set(set.slug, [item, set]);
}
const chases = [...chaseSets.values()]
  .sort((a, b) => b[0].price - a[0].price)
  .slice(0, 6)
  .map(([item, set]) => rowRead(item, set, "chase", { score: 50, why: "Highest matching chase rarity we have a market price for in this set today." }));
candidates.push(...chases.filter(Boolean));

let ebayTracked = 0;
try {
  const tape = await read("data/sealed-prices.json");
  ebayTracked = (tape.products || []).filter((p) => p.dataStatus === "live").length;
  const loose = new Map();
  for (const p of tape.products || []) {
    if (p.subtype === "booster-pack" && p.dataStatus === "live" && money(p.priceMedian)) loose.set(p.setId, Number(p.priceMedian));
  }
  for (const p of tape.products || []) {
    if (p.dataStatus !== "live") continue;
    const packs = packsFor(p);
    const median = Number(p.priceMedian);
    if (!(packs > 1) || !money(median)) continue;
    const perPack = Math.round((median / packs) * 100) / 100;
    if (!money(perPack)) continue;
    const loosePack = loose.get(p.setId);
    const hist = cleanHistory((p.priceHistory || []).map((h) => h.price));
    const read = {
      id: `box-${p.id}`,
      type: "box",
      kind: "sealed",
      set: pretty(p.set),
      name: pretty(p.name),
      price: median,
      perPack,
      changePct: null,
      source: "eBay ask",
      asOf: (tape.updatedAt || "").slice(0, 10),
      confidence: hist.length >= 7 ? "Tracked" : "Early",
      history: hist.slice(-14),
      image: p.representativeImage || p.image || "",
      href: `/p/${p.id}.html`,
      why: loosePack ? `Median eBay ask divided by ${packs} packs. A loose pack of the same set is ${money(loosePack)}.` : `Median eBay ask divided by ${packs} packs.`,
      score: 30,
    };
    read.headline = headlineFor(read);
    if (read.headline) candidates.push(read);
    if (candidates.filter((row) => row.type === "box").length >= 4) break;
  }
} catch { /* eBay list is optional for the catalog */ }

try {
  const der = await read("data/derived-insights.json");
  const watches = der.watchOutcomes || {};
  for (const key of ["sealed", "raw"]) {
    const w = watches[key];
    if (!w) continue;
    const price = Number(w.now ?? w.price);
    if (!money(price)) continue;
    const rawPct = Number(w.dPct);
    const pct = Number.isFinite(rawPct) && Math.abs(rawPct) <= 60 ? rawPct : null;
    const read = {
      id: `receipt-${key}`,
      type: "receipt",
      kind: key === "sealed" ? "sealed" : "single",
      set: "",
      name: pretty(w.name),
      price,
      changePct: pct,
      source: key === "sealed" ? "eBay ask" : "TCGplayer market",
      asOf: watches.date || catalog.asOf,
      confidence: "Early",
      history: money(w.price) && money(price) ? cleanHistory([Number(w.price), price]) : [],
      image: "",
      href: "/receipts",
      why: "We wrote this watch down yesterday and checked it again. No direction was promised, so this is not a hit or a miss.",
      score: 12,
    };
    read.headline = headlineFor(read);
    if (read.headline) candidates.push(read);
  }
} catch { /* receipts stay on their own page if the file is missing */ }

counts.ebaySealedTracked = ebayTracked;
await writeFile(join(OUT, "counts.json"), JSON.stringify(counts, null, 1) + "\n");

const reads = rankReads(candidates, 24).map((row, i) => ({ ...row, n: i + 1 }));
await writeFile(join(OUT, "reads.json"), JSON.stringify({
  asOf: catalog.asOf,
  source: "TCGplayer market, plus eBay asks on box math",
  count: reads.length,
  reads,
}, null, 1) + "\n");

const moverRows = (kind) => movers.filter((row) => row.kind === kind).slice(0, 50).map((row) => ({
  id: row.id.replace(/^(heating|cooling|mover)-/, ""),
  name: row.name,
  set: row.set,
  price: row.price,
  changePct: row.changePct,
  href: row.href,
  image: row.image,
}));
await writeFile(join(OUT, "movers.json"), JSON.stringify({
  asOf: catalog.asOf,
  note: "One day of TCGplayer market prices. Slabs stay hidden until a graded feed exists.",
  singles: moverRows("single"),
  sealed: moverRows("sealed"),
  slabs: [],
}, null, 1) + "\n");

let receipts = [];
try {
  const der = await read("data/derived-insights.json");
  const watches = der.watchOutcomes || {};
  receipts = ["sealed", "raw"].map((key) => {
    const w = watches[key];
    if (!w || !money(w.now) && !money(w.price)) return null;
    const price = Number(w.now ?? w.price);
    if (!money(price)) return null;
    const pct = Number.isFinite(Number(w.dPct)) ? Number(w.dPct) : null;
    const read = {
      id: `receipt-${key}`,
      type: "receipt",
      kind: key === "sealed" ? "sealed" : "single",
      set: "",
      name: pretty(w.name),
      price,
      changePct: pct,
      source: key === "sealed" ? "eBay ask" : "TCGplayer market",
      asOf: watches.date || catalog.asOf,
      why: "We wrote this watch down yesterday and checked it again. No direction was promised, so this is not a hit or a miss.",
      score: 10,
    };
    read.headline = headlineFor(read);
    return read.headline ? read : null;
  }).filter(Boolean);
} catch { receipts = []; }
await writeFile(join(OUT, "receipts.json"), JSON.stringify({
  asOf: catalog.asOf,
  note: "A hit rate is published only after a direction was written down first. These rows are revisits.",
  hitRate: null,
  rows: receipts,
}, null, 1) + "\n");

console.log(`public bundle: ${counts.items} items, ${counts.sets} sets, ${counts.artists} artists, ${reads.length} reads, ebay tracked ${ebayTracked}`);
