// Builds research/assets/public from the TCGplayer catalog and the eBay sealed tape.
// No PPT fields. Missing prices are omitted, never written as 0.
import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
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

function numLeft(n) {
  const s = String(n || "").trim().toLowerCase();
  const tg = s.match(/^tg\s*0*(\d+)/);
  if (tg) return "tg" + String(Number(tg[1]));
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
  return [...days.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
}

const PRODUCT_WORD = /\b(deck|booster|elite trainer|\btin\b|\bbox\b|bundle|\bpack\b|case|collection|binder|sleeve|playmat|album|\bcoin\b|display)\b/i;
const BAD_IMAGE = new Set([232881, 532629]);
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
const mainKeys = new Set();
for (const item of items) {
  if (/prize pack/i.test(item.set || "")) continue;
  const key = baseKey(item);
  if (key) mainKeys.add(key);
}
const dropIds = new Set();
for (const item of items) {
  if (!/prize pack/i.test(item.set || "")) continue;
  const key = baseKey(item);
  if (key && mainKeys.has(key)) dropIds.add(item.id);
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
  if (dropIds.has(item.id)) continue;
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
for (const card of Object.values(catalogue.cards || {})) {
  const artist = personName(card.artist);
  const left = numLeft(card.number);
  if (!left) continue;
  const cands = byNum.get(left) || [];
  const setName = norm(card.setName);
  let best = null;
  let bestScore = 0;
  for (const item of cands) {
    const ns = nameScore(card.name, item.name);
    if (ns < 3) continue;
    const set = norm(item.set);
    let score = ns;
    if (setName && set && set === setName) score += 8;
    else if (setName && set && (set.includes(setName) || setName.includes(set))) score += 3;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  if (!best || bestScore < 3) continue;
  if (artist && !artistById.has(best.id)) artistById.set(best.id, artist);
  if (card.setId && card.number) {
    scanById.set(best.id, `https://images.pokemontcg.io/${card.setId}/${String(card.number).replace(/^0+/, "")}.png`);
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

let RUN_AT = null;
try { RUN_AT = (await read("data/ppt/run-report.json")).finishedAt || null; } catch { RUN_AT = null; }

const sets = new Map();
for (const item of items) {
  if (dropIds.has(item.id)) continue;
  const key = `${item.groupId}|${item.set}`;
  if (!sets.has(key)) {
    sets.set(key, {
      slug: setSlug.get(key),
      name: pretty(item.set),
      raw: item.set,
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
  const hist = histFor(item.tcgplayerProductId);
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
    const card = { ...item, set: set.name, setSlug: set.slug, source: "TCGplayer market", asOf: catalog.asOf };
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
  artistCards: artistById.size,
  artistNote: "Illustrator credits cover only the cards we could match. Not every card, and not every artist.",
  ebaySealedTracked: null,
};
await writeFile(join(OUT, "counts.json"), JSON.stringify(counts, null, 1) + "\n");
await writeFile(join(OUT, "sets.json"), JSON.stringify({ asOf: catalog.asOf, source: "TCGplayer market", sets: setIndex }));
await writeFile(join(OUT, "artists.json"), JSON.stringify({ asOf: catalog.asOf, note: counts.artistNote, artists: artistIndex }));
await writeFile(join(OUT, "search-lite.json"), JSON.stringify(search));

function stockImage(item) {
  const n = Number(item?.pid);
  if (n && !BAD_IMAGE.has(n)) return `https://tcgplayer-cdn.tcgplayer.com/product/${n}_in_400x400.jpg`;
  const scan = String(item?.scan || "");
  if (scan.startsWith("https://images.pokemontcg.io/")) return scan;
  return "";
}
function rowRead(item, set, type, extra = {}) {
  const price = money(item.price) ? Number(item.price) : null;
  if (!price || price < 20) return null;
  const hist = item.hist || [];
  const prev = hist.length >= 2 ? hist[hist.length - 2][1] : null;
  const pct = Number.isFinite(item.pct) ? item.pct : changePct(prev, price);
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
    confidence: hist.length >= 7 ? "Tracked" : "Early",
    history: hist.map((pt) => pt[1]),
    hist,
    image: stockImage(item),
    href: item.kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`,
    number: item.num || "",
    rarity: item.rarity || "",
    low: item.low || null,
    artist: item.artist || "",
    why: "Compared with the previous TCGplayer market print. One day is not a trend.",
    score: Math.round(Math.log10(price) * 30 + Math.min(Math.abs(pct || 0), 25)),
    ...extra,
  };
  read.headline = headlineFor(read);
  if (!read.headline || /ebayimg|i\.ebayimg/i.test(read.image || "")) return null;
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
movers.sort((a, b) => (b.score || 0) - (a.score || 0) || Math.abs(b.changePct) - Math.abs(a.changePct));
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
const redirects = { products: {}, sets: {} };
try {
  const tape = await read("data/sealed-prices.json");
  ebayTracked = (tape.products || []).filter((p) => p.dataStatus === "live").length;
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
for (const set of sets.values()) {
  const bare = slug(String(set.raw || "").replace(/^[^:]+:\s*/, ""));
  if (bare && bare !== set.slug && !redirects.sets[bare]) redirects.sets[bare] = `/sets/${set.slug}`;
}

const boxes = flat
  .map(([item, set]) => {
    const packs = item.subtype === "booster-box" ? 36
      : item.subtype === "booster-bundle" ? 6
      : (item.subtype === "etb" || item.subtype === "pc-etb") && !/celebrations/i.test(item.set || "")
        ? (/sword|shield|swsh/i.test(item.set || "") ? 8 : 9)
        : null;
    if (!(packs > 1) || !(item.price >= 40)) return null;
    const perPack = Math.round((item.price / packs) * 100) / 100;
    return rowRead(item, set, "box", {
      perPack,
      score: 40 + Math.log10(item.price),
      why: `TCGplayer market price divided by ${packs} packs. Not a sold price.`,
    });
  })
  .filter(Boolean)
  .sort((a, b) => b.price - a.price)
  .slice(0, 4);
candidates.push(...boxes);

function catalogForWatch(w) {
  if (w?.id === "swsh7-215") return items.find((item) => item.id === "tcgcsv-246723") || null;
  const key = norm(w?.name);
  if (!key) return null;
  return items.find((item) => norm(item.name) === key && money(item.price))
    || items.find((item) => norm(item.name).includes(key) && money(item.price))
    || null;
}

const watchReads = [];
try {
  const der = await read("data/derived-insights.json");
  const watches = der.watchOutcomes || {};
  for (const key of ["sealed", "raw"]) {
    const w = watches[key];
    const item = catalogForWatch(w);
    if (!item) continue;
    const set = sets.get(`${item.groupId}|${item.set}`);
    const row = set?.items.find((it) => it.id === item.id);
    if (!row) continue;
    const read = rowRead(row, set, "receipt", {
      score: 18,
      why: "Same TCGplayer market price as the product page. A hit rate waits until 20 calls had a direction written down first.",
    });
    if (read) {
      read.id = `receipt-${key}`;
      watchReads.push(read);
      candidates.push(read);
    }
  }
} catch { /* receipts stay empty if the file is missing */ }

let updatedAt = null;
try { updatedAt = (await read("data/ppt/run-report.json")).finishedAt || null; } catch { /* clock stays null */ }
counts.updatedAt = updatedAt;
counts.ebaySealedTracked = ebayTracked;
await writeFile(join(OUT, "counts.json"), JSON.stringify(counts, null, 1) + "\n");

const reads = rankReads(candidates, 24).map((row, i) => ({ ...row, n: i + 1 }));
await writeFile(join(OUT, "reads.json"), JSON.stringify({
  asOf: catalog.asOf,
  updatedAt,
  source: "TCGplayer market",
  count: reads.length,
  reads,
}, null, 1) + "\n");

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

await writeFile(join(OUT, "receipts.json"), JSON.stringify({
  asOf: catalog.asOf,
  updatedAt,
  note: "A hit rate is published only after 20 calls had a direction written down first. These rows use the same market price as the product page.",
  hitRate: null,
  scored: watchReads.length >= 20 ? watchReads.length : Math.min(watchReads.length, 1),
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
  scored: 1,
  hits: 0,
  misses: 1,
  hitRate: null,
  note: "One call was scored from the 2026-09-26 revisit. A hit rate is hidden until 20 calls had a direction written down first. Crowd votes are not in this file.",
  rows: [{ name: "Celebrations Ultra-Premium Collection", result: "miss", date: "2026-09-26" }],
}, null, 1) + "\n");

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

console.log(`public bundle: ${counts.items} items, ${counts.single} singles, ${counts.sealed} sealed, ${counts.sets} sets, ${counts.artists} artists, ${artistMatches} artist links, dropped ${dropIds.size} prize-pack twins, ${reads.length} reads, redirects ${Object.keys(redirects.products).length}, sitemaps ${files.length}`);

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
