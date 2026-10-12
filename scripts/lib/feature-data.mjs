// Public files for set value, rotation, releases, and listing counts.
// Every number is copied from a file already in the repo. A missing price stays off.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Marks with no announced date. Not a date: a labeled window from the
// yearly pattern (F rotated April 11, 2025; G rotated April 10, 2026).
// Checked 2026-10-12: no 2027 announcement on pokemon.com.
export const ROTATION_EXPECTED = [
  {
    mark: "H",
    window: "spring 2027",
    basis: "Past in-person rotations: F on April 11, 2025 and G on April 10, 2026.",
    checked: "2026-10-12",
  },
];

export const ROTATION_SOURCES = [
  {
    mark: "F",
    date: "2025-04-11",
    text: "April 11, 2025",
    href: "https://www.pokemon.com/us/pokemon-news/2025-pokemon-tcg-standard-format-rotation-announcement",
  },
  {
    mark: "G",
    date: "2026-04-10",
    text: "April 10, 2026",
    href: "https://www.pokemon.com/us/pokemon-news/2026-pokemon-tcg-standard-format-rotation-announcement",
  },
];

const SOURCE_PATH = /(?:https?:\/\/)?(?:[\w.-]*\.)?pokemon(?:center)?\.com\/[^\s,)'"]+|30th\.pokemon-card\.com\/[^\s,)'"]+/gi;

export function compact(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normSetName(value) {
  return compact(value).replace(/^(?:ex|xy|sm|sv|swsh|mee|me|sve)\d*(?:pt\d+)?\s+/, "");
}

function cardSetId(id) {
  const m = String(id || "").match(/^([a-z0-9]+)-/);
  return m ? m[1] : "";
}

function cents(value) {
  const n = Number(value);
  if (!(n > 0)) return 0;
  return Math.round(n * 100);
}

export function datedDay(value) {
  const m = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

export function shouldWrite(kind, input) {
  const src = input || {};
  if (kind === "set-value") return Boolean(datedDay(src.date) && src.prices > 0);
  if (kind === "rotation") return Boolean(datedDay(src.asOf) && src.sets > 0);
  if (kind === "releases") return Boolean(datedDay(src.checked) && src.releases > 0);
  if (kind === "listings") return Boolean(datedDay(src.asOf) && (src.products > 0 || src.parents > 0));
  return false;
}

export function nonEmptyDoc(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return false;
  if (!datedDay(doc.asOf || doc.checked)) return false;
  return Object.keys(doc).length > 0;
}

export function officialSource(note) {
  const hits = String(note || "").match(SOURCE_PATH) || [];
  const path = hits.map((hit) => hit.replace(/[.)]+$/g, "")).find((hit) => hit.includes("/"));
  return path || "";
}

const MARKET_SUBTYPES = ["booster-box", "etb", "booster-bundle"];

function productPid(item) {
  const fromField = Number(item?.tcgplayerProductId);
  if (Number.isInteger(fromField) && fromField > 0) return fromField;
  const m = String(item?.id || "").match(/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function plainOfSubtype(item, subtype) {
  if (!item || item.kind !== "sealed" || item.subtype !== subtype || item.subtype === "case") return false;
  if (subtype === "booster-box" && /half|case|display/i.test(String(item.name || ""))) return false;
  return productPid(item) > 0;
}

export function namedProductClass(release) {
  if (!release || release.type === "main-set" || release.type === "jp-product") return "";
  const rel = compact(release.name);
  if (release.type === "decks" || rel.includes("battle deck")) return "deck";
  if (rel.includes("ultra premium") || /\bupcs?\b/.test(rel)) return "upc";
  if (rel.includes("binder")) return "binder";
  return "";
}

function classMatch(item, cls) {
  if (!item || item.kind !== "sealed" || item.subtype === "case") return false;
  if (!(productPid(item) > 0)) return false;
  const name = compact(item.name);
  if (!name || name.endsWith(" case")) return false;
  if (cls === "deck") return item.subtype == null && name.includes("battle deck");
  if (cls === "binder") return name.includes("binder collection");
  if (cls === "upc") return name.includes("ultra premium");
  return false;
}

// The group id comes from the catalogue set code (ME06:) or, when the row has
// no set code, the one catalogue set whose label is contained in the row.
// A product is then chosen by subtype or by that row's product class, never
// by whichever name happened to sort first.
export function groupIdForRelease(release, items) {
  if (!release || release.type === "jp-product") return null;
  const rel = String(release.name || "");
  const code = rel.match(/\b((?:ME|SV|SWSH|SM|XY)\d+)\b/i);
  if (code) {
    const prefix = `${code[1].toUpperCase()}:`;
    const ids = new Set();
    for (const item of items || []) {
      if (String(item.set || "").toUpperCase().startsWith(prefix) && item.groupId != null) ids.add(item.groupId);
    }
    if (ids.size === 1) return [...ids][0];
    if (ids.size > 1) return null;
  }
  const seen = new Map();
  for (const item of items || []) {
    const set = String(item.set || "");
    const tail = set.includes(":") ? set.slice(set.indexOf(":") + 1).trim() : "";
    if (tail.length < 8 || item.groupId == null || !rel.includes(tail)) continue;
    const prev = seen.get(tail);
    if (prev == null && seen.has(tail)) continue;
    if (prev != null && prev !== item.groupId) seen.set(tail, null);
    else if (!seen.has(tail)) seen.set(tail, item.groupId);
  }
  let best = "";
  let gid = null;
  for (const [tail, id] of seen) {
    if (id == null) continue;
    if (tail.length > best.length) { best = tail; gid = id; }
  }
  return gid;
}

function firstMarket(items, days) {
  const ids = new Map();
  for (const item of items || []) {
    const pid = productPid(item);
    if (pid) ids.set(pid, item);
  }
  for (const day of days || []) {
    if (!datedDay(day.date)) continue;
    let best = null;
    for (const price of day.prices || []) {
      const item = ids.get(Number(price.id));
      if (!item || !(Number(price.market) > 0)) continue;
      if (!best || Number(price.id) < best.pid) {
        best = { pid: Number(price.id), item, price: Number(price.market), date: datedDay(day.date) };
      }
    }
    if (best) return best;
  }
  return null;
}

export function releaseMarketItem(release, items, days) {
  const gid = groupIdForRelease(release, items);
  if (gid == null) return null;
  const pool = (items || []).filter((item) => item && item.groupId === gid && item.kind === "sealed");
  if (release.type === "main-set") {
    for (const subtype of MARKET_SUBTYPES) {
      const hit = firstMarket(pool.filter((item) => plainOfSubtype(item, subtype)), days);
      if (hit) return hit;
    }
    return null;
  }
  const cls = namedProductClass(release);
  if (!cls) return null;
  return firstMarket(pool.filter((item) => classMatch(item, cls)), days);
}

export function idsForCatalogSet(items, catalogSet) {
  const ids = new Set();
  for (const item of items || []) {
    if (!item || item.kind === "sealed" || item.set !== catalogSet || !item.id) continue;
    ids.add(String(item.id));
  }
  return ids;
}

export function buildSetValueDoc(setDoc, priceMap, date, opts = {}) {
  const onlyIds = opts.onlyIds || null;
  const singles = (setDoc?.items || []).filter((item) => {
    if (!item || item.kind === "sealed") return false;
    if (onlyIds && !onlyIds.has(String(item.id))) return false;
    return true;
  });
  const priced = [];
  let unpriced = 0;
  let totalCents = 0;
  for (const item of singles) {
    const raw = String(item.id || "");
    const pid = Number(item.pid || (raw.startsWith("tcgcsv-") ? raw.slice(7) : ""));
    const market = priceMap.get(pid);
    if (!(market > 0)) {
      unpriced += 1;
      continue;
    }
    totalCents += cents(market);
    priced.push({
      id: raw || `tcgcsv-${pid}`,
      name: item.name || "",
      number: item.num || "",
      price: market,
      date,
    });
  }
  priced.sort((a, b) => b.price - a.price || String(a.id).localeCompare(String(b.id)));
  const doc = {
    slug: opts.slug || setDoc.slug,
    name: opts.name || setDoc.name || "",
    asOf: date,
    source: `data/history/tcgcsv-daily/${date}.json`,
    top: priced.slice(0, 10),
    master: {
      total: totalCents / 100,
      priced: priced.length,
      unpriced,
      inSet: singles.length,
    },
  };
  if (!opts.catalogSet) return doc;
  return {
    slug: doc.slug,
    name: doc.name,
    catalogSet: opts.catalogSet,
    asOf: doc.asOf,
    source: doc.source,
    top: doc.top,
    master: doc.master,
  };
}

export function rotationStatus(mark) {
  const row = ROTATION_SOURCES.find((source) => source.mark === mark);
  if (row) return `Rotated ${row.text}`;
  if (mark === "D" || mark === "E") return null;
  if (mark) return "Standard";
  return null;
}

export function assignMarks(sets, logos, officialSets, cards) {
  const groups = new Map();
  for (const [id, card] of Object.entries(cards || {})) {
    const sid = cardSetId(id);
    if (!sid) continue;
    if (!groups.has(sid)) groups.set(sid, []);
    groups.get(sid).push(card?.rm || null);
  }
  const byName = new Map();
  for (const [id, meta] of Object.entries(officialSets || {})) {
    const key = normSetName(meta?.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key).add(id);
  }
  const slugIds = new Map();
  for (const set of sets || []) {
    const row = logos?.[set.slug];
    const logoId = row && typeof row === "object" && !row.gallerySetId && !row.parentSetId ? row.setId : "";
    const hits = byName.get(normSetName(set.name));
    if (logoId) slugIds.set(set.slug, logoId);
    else if (hits && hits.size === 1) slugIds.set(set.slug, [...hits][0]);
    else if (row && row.setId) slugIds.set(set.slug, row.setId);
  }
  for (const set of sets || []) {
    const hits = byName.get(normSetName(set.name));
    if (hits && hits.size === 1) slugIds.set(set.slug, [...hits][0]);
  }
  const sharers = new Map();
  for (const set of sets || []) {
    const sid = slugIds.get(set.slug);
    if (!sid) continue;
    if (!sharers.has(sid)) sharers.set(sid, []);
    sharers.get(sid).push(set);
  }
  const out = [];
  for (const set of sets || []) {
    const sid = slugIds.get(set.slug) || "";
    const rms = groups.get(sid) || [];
    const letters = rms.filter(Boolean);
    const counts = new Map();
    for (const letter of letters) counts.set(letter, (counts.get(letter) || 0) + 1);
    let top = "";
    let topN = 0;
    for (const [letter, n] of counts) {
      if (n > topN) { top = letter; topN = n; }
    }
    const singles = Number(set.single) || 0;
    const share = letters.length ? topN / letters.length : 0;
    const cover = singles ? letters.length / singles : 0;
    let ok = Boolean(top) && share >= 0.8 && cover >= 0.8;
    if (ok && (sharers.get(sid) || []).length > 1) ok = singles === rms.length;
    const mark = ok ? top : null;
    out.push({
      slug: set.slug,
      name: set.name || "",
      mark,
      status: rotationStatus(mark),
    });
  }
  return out;
}

export function listingsFromHistory(history) {
  const points = (history || [])
    .filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number.isInteger(point.filteredTotal) && point.filteredTotal >= 0)
    .map((point) => ({ n: point.filteredTotal, date: String(point.date).slice(0, 10) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) return null;
  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  return prev ? { n: last.n, date: last.date, prev } : { n: last.n, date: last.date };
}

export function buildListings(products, parents) {
  const skip = new Set((parents || []).filter((row) => row && row.combinedArts === true).map((row) => row.id));
  const rows = [];
  for (const product of products || []) {
    if (!product?.id || skip.has(product.id)) continue;
    const listingsCounted = listingsFromHistory(product.priceHistory);
    if (!listingsCounted) continue;
    rows.push({ id: product.id, name: product.name || "", listingsCounted });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { skipped: [...skip].sort(), products: rows };
}

export function buildReleases(radar, items, days) {
  const checked = String(radar?.updated || "");
  const releases = [];
  for (const row of radar?.upcoming || []) {
    if (row?.confidence !== "verified") continue;
    const source = officialSource(row.note);
    const entry = {
      name: row.name,
      date: row.date,
      type: row.type,
      source,
      checked,
    };
    const hit = releaseMarketItem(row, items, days);
    if (hit && hit.item?.id && datedDay(hit.date) && Number(hit.price) > 0) {
      entry.market = {
        id: hit.item.id,
        name: hit.item.name || "",
        price: hit.price,
        date: hit.date,
      };
    }
    releases.push(entry);
  }
  return { checked, source: "data/release-radar.json", releases };
}

export function dailyRows(docs) {
  const days = [];
  for (const doc of docs || []) {
    const date = datedDay(doc && doc.date);
    if (!date) continue;
    days.push({ date, prices: Array.isArray(doc.prices) ? doc.prices : [] });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

export async function loadPriceMap(root) {
  const dir = join(root, "data/history/tcgcsv-daily");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  const docs = [];
  for (const name of names) docs.push(JSON.parse(await readFile(join(dir, name), "utf8")));
  const days = dailyRows(docs);
  const latest = days[days.length - 1];
  const map = new Map();
  for (const row of latest?.prices || []) {
    if (Number(row.market) > 0) map.set(Number(row.id), Number(row.market));
  }
  return { date: latest?.date || "", map, days };
}
