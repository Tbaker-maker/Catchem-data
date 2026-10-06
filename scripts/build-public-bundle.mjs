// Builds research/assets/public from the TCGplayer catalog and the eBay sealed tape.
// No PPT fields. Missing prices are omitted, never written as 0.
import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bucketOf, bestMove, changePct, chartSeries, cleanHistory, dropTiledCycles, eraOf, money, pretty, slug,
} from "./lib/public-bundle.mjs";
import { publicReceipts, scoreWatch } from "./lib/public-receipts.mjs";
import { publishFeed, readCallLog, readShelfFile } from "./lib/feed-catalogue.mjs";
import { nextCountsUpdatedAt } from "./lib/price-stamp.mjs";
import { cardImage } from "./image-source.mjs";

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

function numLeft(n) {
  const s = String(n || "").trim().toLowerCase().replace(/\s+/g, "");
  const pref = s.match(/^([a-z]+)0*(\d+)/);
  if (pref) return pref[1] + String(Number(pref[2]));
  const m = s.match(/^0*(\d+)/);
  return m ? String(Number(m[1])) : "";
}
function addPoint(map, pid, date, market) {
  const id = Number(pid);
  const v = Number(market);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !(v > 0)) return;
  if (!map.has(id)) map.set(id, new Map());
  map.get(id).set(String(date), Math.round(v * 100) / 100);
}
const series = new Map();
const lowByPid = new Map();
try {
  const backfillDir = join(ROOT, "data/history/market-backfill");
  for (const file of (await readdir(backfillDir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(backfillDir, file), "utf8"));
    for (const [pid, pts] of Object.entries(doc.series || {})) {
      for (const pt of pts || []) addPoint(series, pid, pt?.[0], pt?.[1]);
    }
  }
} catch { /* backfill is optional until a history import has run */ }
try {
  for (const file of await readdir(join(ROOT, "data/history/tcgplayer-market"))) {
    if (!file.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgplayer-market", file), "utf8"));
    for (const pt of doc.points || []) {
      if (pt?.source && !/tcgcsv|tcgplayer market/i.test(String(pt.source))) continue;
      addPoint(series, doc.tcgplayerProductId, pt.date, pt.market);
      if (pt.low > 0) lowByPid.set(Number(doc.tcgplayerProductId), Number(pt.low));
    }
  }
} catch { /* watchlist history is optional */ }
try {
  for (const file of (await readdir(join(ROOT, "data/history/tcgcsv-daily"))).sort()) {
    if (!file.endsWith(".json")) continue;
    const day = file.slice(0, 10);
    const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", file), "utf8"));
    for (const row of doc.prices || []) addPoint(series, row.id, day, row.market);
  }
} catch { /* daily files are the canonical series */ }
function histFor(pid) {
  const days = series.get(Number(pid));
  if (!days) return [];
  return dropTiledCycles([...days.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1));
}

const PRODUCT_WORD = /\b(deck|booster|elite trainer|\btin\b|\bbox\b|bundle|\bpack\b|case|collection|binder|sleeve|playmat|album|\bcoin\b|display)\b/i;
const BAD_IMAGE = new Set([232881, 532629]);
const GAP_IMAGE = new Set(((await read("data/image-gaps.json").catch(() => ({ pids: [] }))).pids || []).map(Number));
function publicKind(item) {
  const setName = item.set || "";
  const name = item.name || "";
  if (/world championship/i.test(setName)) {
    if (/championship deck\s*:/i.test(name) || /^\d{4}\s+world championship/i.test(name)) return "sealed";
    return "single";
  }
  return item.kind === "sealed" ? "sealed" : "single";
}
for (const item of items) item.kind = publicKind(item);

const NAME_STOP = new Set(["the", "and", "art", "secret", "alternate", "illustration", "special", "rare", "holo", "holofoil", "promo"]);
function nameTokens(name) {
  return norm(String(name || "").replace(/\([^)]*\)/g, " ")).split(" ").filter((w) => w.length > 2 && !NAME_STOP.has(w));
}
function nameScore(a, b) {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  const sb = new Set(tb);
  const hit = ta.filter((t) => sb.has(t)).length;
  if (!hit) return 0;
  return hit >= Math.min(ta.length, tb.length) ? hit + 2 : hit;
}
function baseKey(item) {
  const left = numLeft(item.number);
  const tokens = nameTokens(item.name).filter((t) => !/^\d+$/.test(t)).slice(0, 3).join(" ");
  return left && tokens ? `${tokens}|${left}` : "";
}
const mainByKey = new Map();
for (const item of items) {
  if (/prize pack/i.test(item.set || "")) continue;
  const key = baseKey(item);
  if (key && !mainByKey.has(key)) mainByKey.set(key, item);
}
const versionsOf = new Map();
const linkedPrize = new Set();
for (const item of items) {
  if (!/prize pack/i.test(item.set || "")) continue;
  const main = mainByKey.get(baseKey(item));
  if (!main) continue;
  linkedPrize.add(item.id);
  const list = versionsOf.get(main.id) || [];
  list.push({
    id: item.id,
    name: pretty(item.name),
    set: pretty(item.set),
    price: money(item.price) ? Number(item.price) : null,
  });
  versionsOf.set(main.id, list);
}

function personName(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t === t.toUpperCase()) return t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return t;
}

const catalogue = await read("data/card-catalogue.json").catch(() => ({ cards: {} }));
const byNum = new Map();
for (const item of items) {
  if (linkedPrize.has(item.id)) continue;
  const left = numLeft(item.number);
  if (!left) continue;
  if (!byNum.has(left)) byNum.set(left, []);
  byNum.get(left).push(item);
}

const artistById = new Map();
const scanById = new Map();
const setIdVotes = new Map();
let artistMatches = 0;
const artistGroups = new Map();
for (const [cardId, card] of Object.entries(catalogue.cards || {})) {
  const artist = personName(card.artist);
  const left = numLeft(card.number);
  if (!left) continue;
  const cands = byNum.get(left) || [];
  const setName = norm(card.setName);
  let best = null;
  let bestScore = 0;
  for (const item of cands) {
    const ns = nameScore(card.name, item.name);
    const set = norm(item.set);
    const setHit = setName && set && (set === setName || set.includes(setName) || setName.includes(set));
    if (ns < 1) continue;
    if (!setHit && ns < 3) continue;
    let score = ns;
    if (setHit && set === setName) score += 8;
    else if (setHit) score += 3;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (!best || bestScore < 3) continue;
  if (artist && !artistById.has(best.id)) artistById.set(best.id, artist);
  if (card.setId && card.number) {
    // The scan URL comes from data/card-images.json (the URL the source
    // publishes for this card id), never built from setId/number: hosts differ
    // per set and a guessed path that 404s comes back as a card back. No entry
    // means no scan.
    const scan = cardImage(cardId, false);
    if (scan) scanById.set(best.id, scan);
    const voteKey = `${best.groupId}|${best.set}`;
    if (!setIdVotes.has(voteKey)) setIdVotes.set(voteKey, new Map());
    const votes = setIdVotes.get(voteKey);
    votes.set(card.setId, (votes.get(card.setId) || 0) + 1);
  }
  if (artist) {
    artistMatches += 1;
    const list = artistGroups.get(artist) || [];
    list.push(best.id);
    artistGroups.set(artist, list);
  }
}
function foldSet(s) {
  return String(s || "").replace(/[—–]/g, " ").normalize("NFD").replace(/\p{M}/gu, "");
}
const SET_ALIAS = {
  "swsh black star promos": "SWSH: Sword & Shield Promo Cards",
  "sm black star promos": "SM Promos",
  "bw black star promos": "Black and White Promos",
  "dp black star promos": "Diamond and Pearl Promos",
  "wizards black star promos": "WoTC Promo",
  "sun moon": "SM Base Set",
  "expedition base set": "Expedition",
  "xy": "XY Base Set",
  "hs unleashed": "Unleashed",
  "hs undaunted": "Undaunted",
};
function aliasSet(s) {
  const key = norm(foldSet(s));
  const year = key.match(/^mcdonald s collection (\d{4})$/);
  if (year) return `McDonald's Promos ${year[1]}`;
  return SET_ALIAS[key] || s;
}
function setTokens(s) {
  return norm(foldSet(s)).split(" ").filter((w) => w && w !== "and" && !/^(sv|swsh|sm|xy|me|bw|dp|hgss|ex)\d*$/.test(w));
}
// How well an index set name is the same set as a catalog group. 0 means no.
function setScore(indexSet, catalogSet) {
  const a = setTokens(indexSet);
  const b = setTokens(catalogSet);
  if (!a.length || !b.length) return 0;
  const have = new Set(b);
  if (!a.every((t) => have.has(t))) return 0;
  let pen = 0;
  for (const t of b) {
    if (a.includes(t)) continue;
    if (/^\d+$/.test(t)) pen += 6;
    else if (t === "base" || t === "set") pen += 1;
    else pen += 3;
  }
  const era = /^(sv|swsh|sm|xy|me|bw|dp|hgss|ex)\d*\b/;
  if (era.test(norm(catalogSet)) && !era.test(norm(indexSet))) pen += 4;
  if (norm(indexSet) === norm(catalogSet)) pen -= 5;
  return 20 - pen;
}
let cardIndex = [];
try {
  cardIndex = JSON.parse(await readFile(join(ROOT, "research/assets/card-index.json"), "utf8"));
} catch { cardIndex = []; }
if (!Array.isArray(cardIndex)) cardIndex = [];
for (const card of cardIndex) {
  const artist = personName(card.a);
  const ident = String(card.i || "");
  const num = ident.includes("-") ? ident.slice(ident.lastIndexOf("-") + 1) : "";
  const left = numLeft(num);
  if (!artist || !left) continue;
  let best = null;
  let bestScore = 0;
  for (const item of byNum.get(left) || []) {
    if (artistById.has(item.id) || linkedPrize.has(item.id)) continue;
    const ns = nameScore(card.n, item.name);
    const agree = setScore(aliasSet(card.s), item.set);
    if (ns < 1 || agree < 8) continue;
    const score = ns + agree;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (!best || bestScore < 9) continue;
  artistById.set(best.id, artist);
  artistMatches += 1;
  const list = artistGroups.get(artist) || [];
  list.push(best.id);
  artistGroups.set(artist, list);
}
// Poké Ball and Master Ball rows share a collector number with the card we already matched.
const artistByNum = new Map();
for (const item of items) {
  const artist = artistById.get(item.id);
  const left = numLeft(item.number);
  if (!artist || !left) continue;
  const key = `${item.groupId}|${left}`;
  if (!artistByNum.has(key)) artistByNum.set(key, artist);
}
for (const item of items) {
  if (artistById.has(item.id) || linkedPrize.has(item.id)) continue;
  const left = numLeft(item.number);
  if (!left) continue;
  const artist = artistByNum.get(`${item.groupId}|${left}`);
  if (!artist) continue;
  artistById.set(item.id, artist);
  artistMatches += 1;
  const list = artistGroups.get(artist) || [];
  list.push(item.id);
  artistGroups.set(artist, list);
}
function logoFor(key) {
  const votes = setIdVotes.get(key);
  if (!votes) return "";
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [id, n] = ranked[0];
  const total = [...votes.values()].reduce((s, x) => s + x, 0);
  if (!id || n < 3 || n / total < 0.6) return "";
  return `https://images.pokemontcg.io/${id}/logo.png`;
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

const groupDates = await read("data/tcgcsv-group-dates.json").catch(() => ({}));
const releaseBySet = new Map();
for (const card of Object.values(catalogue.cards || {})) {
  if (!card.releaseDate || !card.setName) continue;
  const day = String(card.releaseDate).replaceAll("/", "-").slice(0, 10);
  const key = norm(card.setName);
  if (key && day && !releaseBySet.has(key)) releaseBySet.set(key, day);
}
function releaseFor(setName, groupId) {
  const published = groupDates[String(groupId)];
  if (published) return published;
  const n = norm(setName);
  return releaseBySet.get(n) || null;
}

let RUN_AT = null;
try { RUN_AT = (await read("data/ppt/run-report.json")).finishedAt || null; } catch { RUN_AT = null; }

const rawById = new Map();
const sets = new Map();
for (const item of items) {
  if (linkedPrize.has(item.id)) continue;
  const key = `${item.groupId}|${item.set}`;
  if (!sets.has(key)) {
    sets.set(key, {
      slug: setSlug.get(key),
      name: pretty(item.set),
      raw: item.set,
      era: eraOf(item.set),
      groupId: item.groupId,
      release: releaseFor(item.set, item.groupId),
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
  const histRaw = histFor(item.tcgplayerProductId);
  const hist = chartSeries(histRaw);
  rawById.set(item.id, histRaw);
  const prevP = hist.length >= 2 ? hist[hist.length - 2][1] : null;
  const pct = price ? changePct(prevP, price) : null;
  if (pct > 0) set.up += 1;
  else if (pct < 0) set.down += 1;
  const artist = artistById.get(item.id) || null;
  const pid = BAD_IMAGE.has(Number(item.tcgplayerProductId)) ? null : item.tcgplayerProductId;
  set.items.push({
    id: item.id,
    name: pretty(item.name),
    num: item.number || "",
    kind: item.kind === "sealed" ? "sealed" : "single",
    subtype: item.subtype || null,
    rarity: item.rarity || "",
    price,
    pid,
    artist,
    pct,
    hist,
    low: lowByPid.get(Number(item.tcgplayerProductId)) || null,
    scan: pid ? "" : (scanById.get(item.id) || ""),
    versions: versionsOf.get(item.id) || [],
    sold: null,
  });
}

await mkdir(join(OUT, "sets"), { recursive: true });
await mkdir(join(OUT, "buckets"), { recursive: true });
await mkdir(join(OUT, "artists"), { recursive: true });

function indexLine(list) {
  const dates = [...new Set(list.flatMap((it) => (it.hist || []).map((pt) => pt[0])))].sort();
  if (dates.length < 2) return dates.map((d) => ({ d, v: null, n: 0 }));
  let level = 100;
  const out = [{ d: dates[0], v: 100, n: 0 }];
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const day = dates[i];
    const ratios = [];
    for (const item of list) {
      const a = (item.hist || []).find((pt) => pt[0] === prev);
      const b = (item.hist || []).find((pt) => pt[0] === day);
      if (a && b && a[1] >= 2 && b[1] > 0) ratios.push(b[1] / a[1]);
    }
    if (ratios.length < 8) {
      out.push({ d: day, v: level, n: ratios.length });
      continue;
    }
    ratios.sort((x, y) => x - y);
    const med = ratios[Math.floor(ratios.length / 2)];
    level = Math.round(level * med * 10) / 10;
    out.push({ d: day, v: level, n: ratios.length });
  }
  return out;
}

const setIndex = [];
const buckets = new Map();
const search = [];
let pricedSingles = 0;
let pricedSealed = 0;
for (const set of sets.values()) {
  const heatDenom = set.up + set.down;
  void heatDenom;
  const pricedSinglesInSet = set.items.filter((it) => it.kind === "single" && it.price).sort((a, b) => b.price - a.price);
  pricedSinglesInSet.forEach((it, i) => { it.rank = i + 1; it.of = pricedSinglesInSet.length; });
  const also = pricedSinglesInSet.slice(0, 4).map((it) => ({ id: it.id, name: it.name }));
  for (const it of set.items) it.also = also.filter((x) => x.id !== it.id).slice(0, 3);
  const logo = logoFor(`${set.groupId}|${set.raw}`);
  const row = {
    slug: set.slug,
    name: set.name,
    era: set.era,
    release: set.release,
    single: set.single,
    sealed: set.sealed,
    priced: set.priced,
    logo,
  };
  setIndex.push(row);
  const line = (kind) => indexLine(set.items.filter((it) => it.kind === kind));
  const topSealed = set.items.filter((it) => it.kind === "sealed" && it.price).sort((a, b) => b.price - a.price)[0] || null;
  const topChase = set.items.filter((it) => it.kind === "single" && it.price && /illustration|special illustration|hyper|secret|ultra|rainbow/i.test(it.rarity || "")).sort((a, b) => b.price - a.price)[0] || null;
  const body = {
    ...row,
    source: "TCGplayer market",
    asOf: catalog.asOf,
    singleIndex: line("single"),
    sealedIndex: line("sealed"),
    sealedLine: topSealed ? { id: topSealed.id, name: topSealed.name, price: topSealed.price } : null,
    chaseLine: topChase ? { id: topChase.id, name: topChase.name, price: topChase.price, pid: topChase.pid } : null,
    items: set.items,
  };
  await writeFile(join(OUT, "sets", `${set.slug}.json`), JSON.stringify(body));
  for (const item of set.items) {
    if (item.price && item.kind === "single") pricedSingles += 1;
    if (item.price && item.kind === "sealed") pricedSealed += 1;
    const card = { ...item, set: set.name, setSlug: set.slug, release: set.release || null, source: "TCGplayer market", asOf: catalog.asOf };
    const b = bucketOf(item.id);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(card);
    search.push([item.id, item.name, set.name, item.num || "", item.artist || "", item.kind, item.price || 0, set.slug, item.rarity || ""]);
  }
}
setIndex.sort((a, b) => a.era.localeCompare(b.era) || a.name.localeCompare(b.name));
for (const [b, rows] of buckets) {
  await writeFile(join(OUT, "buckets", `${b}.json`), JSON.stringify(rows));
}

const byId = new Map(items.map((item) => [item.id, item]));
const histById = new Map();
const pidById = new Map();
for (const set of sets.values()) {
  for (const it of set.items) {
    histById.set(it.id, it.hist || []);
    pidById.set(it.id, it.pid || null);
  }
}
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
      pid: pidById.get(item.id) || null,
      hist: histById.get(item.id) || [],
    });
  }
  if (!cards.length) continue;
  artistIndex.push({ slug: aSlug, name: pretty(name), count: cards.length });
  await writeFile(join(OUT, "artists", `${aSlug}.json`), JSON.stringify({
    name: pretty(name),
    slug: aSlug,
    source: "illustrator credit from pokemontcg.io, price from TCGplayer market",
    index: indexLine(cards),
    cards,
  }));
}

const published = [...sets.values()];
const counts = {
  asOf: catalog.asOf,
  source: "TCGplayer market",
  items: published.reduce((n, set) => n + set.items.length, 0),
  single: published.reduce((n, set) => n + set.single, 0),
  sealed: published.reduce((n, set) => n + set.sealed, 0),
  slab: 0,
  sets: setIndex.length,
  priced: published.reduce((n, set) => n + set.priced, 0),
  artists: artistIndex.length,
  artistCards: 0,
  artistNote: "",
  sealedNote: "Sealed means the box, tin, pack, or collection. Cards are singles, including trainer-kit cards and the cards inside a world championship deck. Those cards used to be counted as sealed (the old figure was 2,998). No sealed name is repeated in one set.",
  soldNote: "No sold list is in this catalog. A sold price is shown only when one is stored. The price on a card is TCGplayer market, not a sold price.",
  ebaySealedTracked: null,
};
const singleN = counts.single;
const credited = published.reduce((n, set) => n + set.items.filter((it) => it.kind === "single" && it.artist).length, 0);
counts.artistCards = credited;
counts.artistNote = `Illustrator credits come from the card catalogue and the card index, when the name and the set agree. ${credited.toLocaleString("en-US")} of ${singleN.toLocaleString("en-US")} singles have a credit. Not every card has one.`;
let priorUpdatedAt = null;
try {
  const priorCounts = await read("research/assets/public/counts.json");
  if (priorCounts && typeof priorCounts.updatedAt === "string") priorUpdatedAt = priorCounts.updatedAt;
} catch { /* no previous line */ }
let priceDoc = null;
try { priceDoc = await read("data/sealed-prices.json"); } catch { /* no price file */ }
const lineAt = nextCountsUpdatedAt(priceDoc, priorUpdatedAt);
if (lineAt) counts.updatedAt = lineAt;
await writeFile(join(OUT, "counts.json"), JSON.stringify(counts, null, 1) + "\n");
await writeFile(join(OUT, "sets.json"), JSON.stringify({ asOf: catalog.asOf, source: "TCGplayer market", sets: setIndex }));
await writeFile(join(OUT, "artists.json"), JSON.stringify({ asOf: catalog.asOf, note: counts.artistNote, artists: artistIndex }));
await writeFile(join(OUT, "search-lite.json"), JSON.stringify(search));

function stockImage(item) {
  const n = Number(item?.pid);
  if (n && (BAD_IMAGE.has(n) || GAP_IMAGE.has(n))) return "";
  if (n) return `https://tcgplayer-cdn.tcgplayer.com/product/${n}_in_400x400.jpg`;
  const scan = String(item?.scan || "");
  if (scan.startsWith("https://images.pokemontcg.io/")) return scan;
  return "";
}
const flat = [];
for (const set of sets.values()) {
  for (const item of set.items) flat.push([item, set]);
}
let hist30 = 0;
let hist90 = 0;
const qualified = [];
for (const [item, set] of flat) {
  const raw = rawById.get(item.id) || item.hist || [];
  if (raw.length >= 30) hist30 += 1;
  if (raw.length >= 90) hist90 += 1;
  const kind = item.kind === "sealed" ? "sealed" : "single";
  const move = bestMove(raw, kind);
  if (!move || move.from < 5 || move.to < 5) continue;
  const year = Number(String(set.release || "").slice(0, 4)) || null;
  const chart = item.hist || [];
  const read = {
    id: `move-${item.id}`,
    type: "mover",
    kind,
    set: set.name,
    setSlug: set.slug,
    name: pretty(item.name),
    year,
    price: move.to,
    fromPrice: move.from,
    changePct: move.pct,
    windowDays: move.window,
    fromDate: move.fromDate,
    toDate: move.toDate,
    chartWindow: `${move.window} days, ${move.fromDate} to ${move.toDate}`,
    source: `TCGplayer market, ${move.toDate}`,
    asOf: move.toDate,
    history: chart.map((pt) => pt[1]),
    hist: chart,
    rawHist: raw,
    image: stockImage(item),
    href: kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`,
    number: item.num || "",
    rarity: item.rarity || "",
    artist: item.artist || "",
    release: set.release || "",
    score: Math.round(Math.abs(move.to - move.from) * 100) / 100,
  };
  if (/ebayimg|i\.ebayimg/i.test(read.image || "")) read.image = "";
  qualified.push(read);
}
qualified.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));
console.log(`history >=30 ${hist30} >=90 ${hist90} qualifying ${qualified.length}`);
const candidates = qualified;
const movers = qualified;

let ebayTracked = 0;
let legacyTape = [];
const redirects = { products: {}, sets: {} };
try {
  const tape = await read("data/sealed-prices.json");
  legacyTape = tape.products || [];
  ebayTracked = legacyTape.filter((p) => p.dataStatus === "live").length;
  const byNorm = new Map();
  for (const item of items) {
    if (item.kind !== "sealed") continue;
    const key = norm(item.name);
    if (key && !byNorm.has(key)) byNorm.set(key, item);
  }
  const setVotes = new Map();
  for (const p of tape.products || []) {
    const hit = byNorm.get(norm(p.name));
    if (!hit) continue;
    redirects.products[p.id] = `/p/${hit.id}`;
    const setKey = `${hit.groupId}|${hit.set}`;
    const slugHit = setSlug.get(setKey);
    if (p.setId && slugHit) {
      if (!setVotes.has(p.setId)) setVotes.set(p.setId, new Map());
      const m = setVotes.get(p.setId);
      m.set(slugHit, (m.get(slugHit) || 0) + 1);
    }
  }
  for (const [setId, m] of setVotes) {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) redirects.sets[setId] = `/sets/${best[0]}`;
  }
} catch { /* name map is optional */ }

const SET_HINTS = [
  ["swsh12pt5-", "crown-zenith"],
  ["swsh35-", "champion"],
  ["swsh45-", "sword-shield-promo"],
  ["sv8pt5-", "prismatic"],
  ["sv6pt5-", "shrouded"],
  ["sv4pt5-", "paldean-fates"],
  ["sv3pt5-", "151"],
  ["zsv10pt5-bb-", "black-bolt"],
  ["rsv10pt5-wf-", "white-flare"],
  ["me2pt5-", "ascended-heroes"],
  ["sv10-", "destined-rivals"],
  ["sv9-", "journey-together"],
  ["sv8-", "surging-sparks"],
  ["sv7-", "stellar-crown"],
  ["sv6-", "twilight-masquerade"],
  ["sv5-", "temporal-forces"],
  ["sv4-", "paradox-rift"],
  ["sv3-", "obsidian-flames"],
  ["sv2-", "paldea-evolved"],
  ["sv1-", "sv01"],
  ["swsh12-", "silver-tempest"],
  ["swsh11-", "lost-origin"],
  ["swsh10-", "astral-radiance"],
  ["swsh9-", "brilliant-stars"],
  ["swsh8-", "fusion-strike"],
  ["swsh7-", "evolving-skies"],
  ["swsh6-", "chilling-reign"],
  ["swsh5-", "battle-styles"],
  ["swsh4-", "vivid-voltage"],
  ["swsh3-", "darkness-ablaze"],
  ["swsh2-", "rebel-clash"],
  ["swsh1-", "swsh01"],
  ["me1-", "me01"],
  ["me2-", "phantasmal"],
  ["me5-", "pitch-black"],
  ["cel25-", "celebrations"],
  ["xy12-", "xy-evolutions"],
  ["sm5-", "ultra-prism"],
  ["sm1-", "sm-base"],
  ["bw1-", "black-and-white"],
  ["det1-", "detective-pikachu"],
  ["neo1-", "neo-genesis"],
  ["base3-", "fossil"],
  ["base2-", "jungle"],
  ["base1-", "base-set"],
];
function subtypeFromLegacy(id) {
  if (/-pc-etb$/.test(id)) return "pc-etb";
  if (/-etb$/.test(id)) return "etb";
  if (/-bb$|-bundle$/.test(id)) return "booster-bundle";
  if (/booster-box$/.test(id)) return "booster-box";
  if (/-tin$/.test(id)) return "tin";
  if (/-pack$/.test(id)) return "booster-pack";
  if (/-premium$/.test(id)) return "special-collection";
  return null;
}
const JUNK_SEALED = /set of \d|costco|sam'?s club|dollar general|walmart|walgreens|\(lgs\)/i;
for (const p of legacyTape) {
  if (!p?.id || redirects.products[p.id]) continue;
  const hint = SET_HINTS.find(([pre]) => p.id.startsWith(pre))?.[1];
  const subtype = subtypeFromLegacy(p.id);
  if (!hint || !subtype) continue;
  const pool = [...sets.values()].filter((set) => set.slug === hint || set.slug.includes(hint));
  const exact = pool.filter((set) => set.slug === hint);
  const chosenSets = exact.length ? exact : pool;
  const cands = [];
  for (const set of chosenSets) {
    for (const item of set.items) {
      if (item.kind !== "sealed" || item.subtype !== subtype) continue;
      if (JUNK_SEALED.test(item.name || "")) continue;
      cands.push(item);
    }
  }
  if (!cands.length) continue;
  cands.sort((a, b) => String(a.name).length - String(b.name).length || String(a.name).localeCompare(String(b.name)));
  redirects.products[p.id] = `/p/${cands[0].id}`;
}

for (const set of sets.values()) {
  const bare = slug(String(set.raw || "").replace(/^[^:]+:\s*/, ""));
  if (bare && bare !== set.slug && !redirects.sets[bare]) redirects.sets[bare] = `/sets/${set.slug}`;
}
const OLD_SETS = {
  base1: "base-set",
  base2: "jungle",
  base3: "fossil",
  base4: "base-set-2",
  base5: "team-rocket",
  bw1: "black-and-white",
  det1: "detective-pikachu",
  neo1: "neo-genesis",
  xy12: "xy-evolutions",
};
for (const [from, to] of Object.entries(OLD_SETS)) {
  if (!redirects.sets[from]) redirects.sets[from] = `/sets/${to}`;
}

const watchReads = [];
try {
  const log = await read("research/pulse/watch-log.json");
  const heat = await read("data/heat-history.json").catch(() => []);
  const sealed = await read("data/sealed-prices.json").catch(() => ({ products: [] }));
  const sealedNow = new Map((sealed.products || []).map((p) => [p.id, p.priceMedian]));
  const scored = scoreWatch({ entries: log.entries || [], heat, sealedNow });
  const pub = publicReceipts(scored);
  watchReads.push(...pub.rows);
  counts.receipts = { scored: pub.scored, hits: pub.hits, misses: pub.misses, hitRate: pub.hitRate };
} catch { /* receipts stay empty if the log is missing */ }

let updatedAt = null;
try { updatedAt = (await read("data/ppt/run-report.json")).finishedAt || null; } catch { /* clock stays null */ }
counts.ebaySealedTracked = ebayTracked;
await writeFile(join(OUT, "counts.json"), JSON.stringify(counts, null, 1) + "\n");

const feedItems = [];
for (const [item, set] of flat) {
  const raw = rawById.get(item.id) || item.hist || [];
  if (raw.length < 30) continue;
  const kind = item.kind === "sealed" ? "sealed" : "single";
  feedItems.push({
    id: item.id,
    name: pretty(item.name),
    set: set.name,
    setSlug: set.slug,
    kind,
    number: item.num || item.number || "",
    price: money(item.price) ? Number(item.price) : (raw.at(-1)?.[1] || 0),
    release: set.release || "",
    hist: raw,
    href: kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`,
    image: stockImage(item),
  });
}
const logFile = process.env.LEARNING_LOG || "";
const priorCalls = logFile ? await readCallLog(logFile) : [];
const feedResult = await publishFeed({
  items: feedItems,
  prior: priorCalls,
  prices: new Map(items.filter((item) => Number(item.price) > 0 && item.id).map((item) => [item.id, Number(item.price)])),
  asOf: catalog.asOf,
  updatedAt,
  outDir: OUT,
  logFile: logFile || null,
  shelf: await readShelfFile(process.env.SHELF_LOG || join(ROOT, "data/learning/shelf.jsonl")),
  gapPids: [...GAP_IMAGE],
  rewriteDir: join(ROOT, "data/learning/path-rewrites"),
  root: ROOT,
});
console.log(`feed catalogue ${feedResult.count} logged +${feedResult.logged.added}`);

const splitMovers = (kind) => {
  const rows = movers.filter((row) => row.kind === kind && row.price >= 20).map((row) => ({
    id: row.id.replace(/^(heating|cooling|mover)-/, ""),
    name: row.name,
    set: row.set,
    price: row.price,
    changePct: row.changePct,
    href: row.href,
    image: row.image,
    hist: row.hist || [],
  }));
  return {
    rising: rows.filter((row) => row.changePct > 0).slice(0, 40),
    falling: rows.filter((row) => row.changePct < 0).slice(0, 40),
  };
};
const singleMove = splitMovers("single");
const sealedMove = splitMovers("sealed");
await writeFile(join(OUT, "movers.json"), JSON.stringify({
  asOf: catalog.asOf,
  updatedAt,
  note: "TCGplayer market, one day. Slabs stay off this list.",
  singles: singleMove.rising.concat(singleMove.falling).slice(0, 50),
  sealed: sealedMove.rising.concat(sealedMove.falling).slice(0, 50),
  singlesRising: singleMove.rising,
  singlesFalling: singleMove.falling,
  sealedRising: sealedMove.rising,
  sealedFalling: sealedMove.falling,
  slabs: [],
}, null, 1) + "\n");

const receiptPub = {
  scored: counts.receipts?.scored || 0,
  hits: counts.receipts?.hits || 0,
  misses: counts.receipts?.misses || 0,
  hitRate: counts.receipts?.hitRate ?? null,
};
await writeFile(join(OUT, "receipts.json"), JSON.stringify({
  asOf: catalog.asOf,
  updatedAt,
  note: "A hit means the next stored price moved the same way as the price we wrote down. A miss moved the other way. A hit rate stays hidden until 20 calls are scored. These are not sold prices.",
  hitRate: receiptPub.hitRate,
  scored: receiptPub.scored,
  hits: receiptPub.hits,
  misses: receiptPub.misses,
  rows: watchReads,
}, null, 1) + "\n");

const allItems = [...sets.values()].flatMap((set) => set.items);
await writeFile(join(OUT, "indexes.json"), JSON.stringify({
  asOf: catalog.asOf,
  updatedAt,
  source: "TCGplayer market, daily",
  note: "Chain-linked median of day-to-day ratios. Singles and sealed are separate. Two days is not a month.",
  singles: indexLine(allItems.filter((it) => it.kind === "single")),
  sealed: indexLine(allItems.filter((it) => it.kind === "sealed")),
}, null, 1) + "\n");

await writeFile(join(OUT, "redirects.json"), JSON.stringify(redirects));
await copyFile(new URL("./lib/collector-search.mjs", import.meta.url), join(OUT, "search-rank.mjs"));

await writeFile(join(OUT, "accuracy.json"), JSON.stringify({
  asOf: catalog.asOf,
  updatedAt,
  scored: receiptPub.scored,
  hits: receiptPub.hits,
  misses: receiptPub.misses,
  hitRate: receiptPub.hitRate,
  note: "Scored only when a direction was written down first and a later price exists. A hit rate stays hidden until 20. Crowd votes are not in this file. No sold list is in this catalog.",
  rows: watchReads.filter((row) => row.result === "hit" || row.result === "miss").map((row) => ({
    name: row.name, result: row.result, date: row.asOf,
  })),
}, null, 1) + "\n");

for (const set of setIndex) {
  if (/sun & moon|^xy$|scarlet|sword|mega/i.test(set.era || "") && String(set.release || "").startsWith("1999")) {
    throw new Error(`${set.name} still shows ${set.release}`);
  }
}

const origin = "https://catchemtcg.com";
const chunks = [];
let buf = ["/", "/feed", "/feed/all", "/sets", "/board", "/artists", "/search", "/methodology", "/receipts", "/accuracy", "/post-office"];
const pushUrl = (path) => {
  buf.push(path);
  if (buf.length >= 4500) { chunks.push(buf); buf = []; }
};
for (const set of setIndex) pushUrl(`/sets/${set.slug}`);
for (const artist of artistIndex) pushUrl(`/artists/${artist.slug}`);
for (const row of search) pushUrl(`${row[5] === "sealed" ? "/p/" : "/c/"}${row[0]}`);
if (buf.length) chunks.push(buf);
const files = [];
for (let i = 0; i < chunks.length; i++) {
  const name = `sitemap-${String(i).padStart(2, "0")}.xml`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${chunks[i].map((u) => `<url><loc>${origin}${u}</loc></url>`).join("\n")}\n</urlset>\n`;
  await writeFile(join(OUT, name), xml);
  files.push(name);
}
const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((f) => `<sitemap><loc>${origin}/${f}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
await writeFile(join(OUT, "sitemap.xml"), indexXml);

console.log(`public bundle: ${counts.items} items, ${counts.single} singles, ${counts.sealed} sealed, ${counts.sets} sets, ${counts.artists} artists, ${artistMatches} artist links, prize-pack versions ${linkedPrize.size}, ${reads.length} reads, redirects ${Object.keys(redirects.products).length}, sitemaps ${files.length}`);

const priceOf = new Map();
for (const set of sets.values()) {
  for (const it of set.items) if (it.price) priceOf.set(it.id, it.price);
}
const mismatches = [];
for (const read of reads) {
  const id = String(read.href || "").split("/").pop();
  const want = priceOf.get(id);
  if (want != null && Math.abs(want - Number(read.price)) > 0.009) mismatches.push(`${id} read ${read.price} vs ${want}`);
  if (/ebayimg|ebay\.com|images\.ebay/i.test(read.image || "")) mismatches.push(`${id} ebay image`);
}
for (const row of [...(singleMove?.rising || []), ...(sealedMove?.rising || [])]) {
  const id = String(row.href || "").split("/").pop();
  const want = priceOf.get(id);
  if (want != null && Math.abs(want - Number(row.price)) > 0.009) mismatches.push(`${id} mover ${row.price} vs ${want}`);
}
if (mismatches.length) {
  console.error(mismatches.slice(0, 12).join("\n"));
  throw new Error(`price or image mismatch (${mismatches.length})`);
}
