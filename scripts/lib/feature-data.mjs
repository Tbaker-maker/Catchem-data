// Public files for set value, rotation, releases, and listing counts.
// Every number is copied from a file already in the repo. A missing price stays off.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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

export function officialSource(note) {
  const hits = String(note || "").match(SOURCE_PATH) || [];
  const path = hits.map((hit) => hit.replace(/[.)]+$/g, "")).find((hit) => hit.includes("/"));
  return path || "";
}

export function releaseMatchesItem(release, item) {
  if (!release || release.type === "main-set" || release.type === "jp-product") return false;
  const rel = compact(release.name);
  const name = compact(item?.name);
  if (!name || name.endsWith(" case")) return false;
  if (rel.includes("deck crafter") && name.includes("deck crafter")) return true;
  if (!rel.includes("30th celebration") || !name.includes("30th celebration")) return false;
  if (rel.includes("binder collection") && name.includes("binder collection")) return true;
  if (rel.includes("battle deck") && name.includes("battle deck")) return true;
  if (rel.includes("ditto premium") && name.includes("ditto premium")) return true;
  if (rel.includes("figure collection") && name.includes("figure collection")) return true;
  if (rel.includes("day") && rel.includes("night") && name.includes("ultra premium collection")) return true;
  return false;
}

export function mainSetName(release, items) {
  if (release?.type !== "main-set") return "";
  const rel = String(release.name || "");
  const tails = new Set();
  for (const item of items || []) {
    const set = String(item?.set || "");
    const tail = set.includes(":") ? set.slice(set.indexOf(":") + 1).trim() : set.trim();
    if (tail.length >= 8 && rel.includes(tail)) tails.add(set);
  }
  return tails.size === 1 ? [...tails][0] : "";
}

export function buildSetValueDoc(setDoc, priceMap, date) {
  const singles = (setDoc?.items || []).filter((item) => item && item.kind !== "sealed");
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
  return {
    slug: setDoc.slug,
    name: setDoc.name || "",
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
    const ids = new Map();
    const setName = mainSetName(row, items);
    for (const item of items || []) {
      const hit = setName ? item.set === setName : releaseMatchesItem(row, item);
      if (!hit) continue;
      const m = String(item.id || "").match(/(\d+)$/);
      if (!m) continue;
      ids.set(Number(m[1]), item);
    }
    let first = null;
    for (const day of days || []) {
      for (const price of day.prices || []) {
        const item = ids.get(Number(price.id));
        if (!item || !(Number(price.market) > 0)) continue;
        if (!first || Number(price.id) < first.pid) {
          first = { pid: Number(price.id), item, price: Number(price.market), date: day.date };
        }
      }
      if (first) break;
    }
    if (first) {
      entry.market = {
        id: first.item.id,
        name: first.item.name || "",
        price: first.price,
        date: first.date,
      };
    }
    releases.push(entry);
  }
  return { checked, source: "data/release-radar.json", releases };
}

export async function loadPriceMap(root) {
  const dir = join(root, "data/history/tcgcsv-daily");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  const days = [];
  for (const name of names) {
    const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
    days.push({ date: String(doc.date || name.slice(0, 10)), prices: doc.prices || [] });
  }
  const latest = days[days.length - 1];
  const map = new Map();
  for (const row of latest?.prices || []) {
    if (Number(row.market) > 0) map.set(Number(row.id), Number(row.market));
  }
  return { date: latest?.date || "", map, days };
}
