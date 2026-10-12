// Reads board v3: non-price reads built only from files on disk, plus the
// "not moved yet" lists for card and sealed pages. Every number carries a date.
// Turned on and off by the one kill switch, reads.library.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { money, BANNED as BUNDLE_BAN, FILLER_BAN } from "./public-bundle.mjs";
import { boardImage, loadBoardImageInputs } from "./read-library.mjs";
import { monthDay } from "./takes.mjs";
import { buildPokemonIndex, pokemonFactLine, speciesToken } from "./fact-reads.mjs";
import { COMBINED_ART_PARENTS } from "./detectors/listing-trend.mjs";

export const BOARD_TAG = "v3";
export const PRICE_SHARE_MAX = 0.4;
export const BANNED = /\b(buy|buys|buying|sell|sells|selling|hold|holds|holding|support|resistance|bottom|printed|play|plays|playing|target|invest|investing|investment|crypto|token|moon|hodl|pump|dump|nft)\b/i;
const EM = /[\u2014\u2013]/;

export function cleanCopy(text) {
  const s = String(text || "");
  return s.length > 0 && !BANNED.test(s) && !BUNDLE_BAN.test(s) && !FILLER_BAN.test(s) && !EM.test(s);
}

export function pct(from, to) {
  return ((to - from) / from) * 100;
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Era is the TCGplayer group prefix (SWSH07: Evolving Skies -> SWSH).
export function eraOf(groupName) {
  const g = String(groupName || "");
  const m = g.match(/^(SWSH|SV|SM|ME|XY|BW|HGSS|DP|EX|POP)\s?\d*[A-Za-z.]*\s?[:-]/i) || g.match(/^(SWSH|SV|SM|ME|XY|BW|HGSS|DP)\b/i);
  return m ? m[1].toUpperCase() : "";
}

const ERA_NAME = { SWSH: "Sword & Shield", SV: "Scarlet & Violet", SM: "Sun & Moon", ME: "Mega Evolution", XY: "XY", BW: "Black & White", HGSS: "HeartGold SoulSilver", DP: "Diamond & Pearl", EX: "EX" };
export function eraName(era) { return ERA_NAME[era] || era; }

const LOW_RARITY = new Set(["Common", "Uncommon", "Rare", "Code Card", "Promo", "None", ""]);

// Price per id on one day. Card ids pick one printing and keep it on both days.
export function dayMap(doc) {
  const out = new Map();
  for (const row of doc?.prices || []) {
    const id = Number(row?.id);
    const m = Number(row?.market);
    if (!id || !(m > 0)) continue;
    const key = `${id}|${row.printing || ""}`;
    out.set(key, m);
  }
  return out;
}

// For each id, the printing with the higher end price, same printing at start.
export function pairs(startMap, endMap) {
  const best = new Map();
  for (const [key, to] of endMap) {
    const from = startMap.get(key);
    if (!(from > 0)) continue;
    const id = Number(key.split("|")[0]);
    const cur = best.get(id);
    if (!cur || to > cur.to) best.set(id, { id, from, to });
  }
  return best;
}

export function isUp(p, { minPct = 8, minUsd = 1, minPrice = 5 } = {}) {
  return p.to >= minPrice && p.to - p.from >= minUsd && pct(p.from, p.to) >= minPct;
}
export function isFlat(p, { maxPct = 3, minPrice = 3 } = {}) {
  return p.to >= minPrice && Math.abs(pct(p.from, p.to)) < maxPct;
}

// Up to 6 same-kind ids that stayed flat. Same set first, then same era.
// Closest price first. Ids only, never names.
export function laggingFor(card, pool, { max = 6 } = {}) {
  const out = [];
  const near = (a, b) => Math.abs(Math.log(a.to / card.to)) - Math.abs(Math.log(b.to / card.to));
  const same = pool.filter((p) => p.id !== card.id && p.kind === card.kind && p.era === card.era && isFlat(p));
  const inSet = same.filter((p) => p.group === card.group).sort(near);
  const inEra = same.filter((p) => p.group !== card.group).sort(near);
  for (const p of [...inSet, ...inEra]) {
    if (out.length >= max) break;
    out.push(p);
  }
  return out;
}

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function latestRawProducts(root) {
  const dir = join(root, "data/history/tcgcsv-daily/raw");
  let days = [];
  try { days = (await readdir(dir)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse(); } catch { return null; }
  for (const day of days) {
    const p = join(dir, day, "products.ndjson.gz");
    const g = join(dir, day, "groups.ndjson.gz");
    if (!existsSync(p) || !existsSync(g)) continue;
    const text = gunzipSync(await readFile(p)).toString("utf8");
    if (!text.trim()) continue;
    const groups = new Map();
    for (const line of gunzipSync(await readFile(g)).toString("utf8").split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      groups.set(row.groupId, row.name);
    }
    const products = new Map();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const ext = Object.fromEntries((row.extendedData || []).map((e) => [e.name, e.value]));
      products.set(row.productId, {
        group: groups.get(row.groupId) || "",
        rarity: String(ext.Rarity || ""),
        number: String(ext.Number || ""),
        name: String(row.name || ""),
      });
    }
    return { day, products };
  }
  return null;
}

// Card side: risers and their flat lookalikes, keyed by tcgcsv id.
export function buildCardLag({ startDoc, endDoc, products, start, end, catalogueCards = {}, minRisePct = 15, minRiseUsd = 2 }) {
  const pr = pairs(dayMap(startDoc), dayMap(endDoc));
  const pool = [];
  for (const p of pr.values()) {
    const meta = products.get(p.id);
    if (!meta || LOW_RARITY.has(meta.rarity)) continue;
    const era = eraOf(meta.group);
    if (!era) continue;
    pool.push({ ...p, kind: meta.rarity, era, group: meta.group, name: meta.name, number: meta.number });
  }
  const out = {};
  for (const card of pool) {
    if (!(card.to >= 5 && card.to - card.from >= minRiseUsd && pct(card.from, card.to) >= minRisePct)) continue;
    const lag = laggingFor(card, pool);
    if (!lag.length) continue;
    out[`tcgcsv-${card.id}`] = {
      from: card.from, to: card.to, start, end, kind: card.kind, era: card.era, set: card.group,
      lagging: lag.map((p) => ({
        id: `tcgcsv-${p.id}`, name: p.name, number: p.number, set: p.group,
        from: p.from, to: p.to, start, end,
        image: catalogueCards[`tcgcsv-${p.id}`]?.image || "",
      })),
    };
  }
  return { pool, risers: out };
}

function pointOn(points, day) {
  const row = (points || []).find((p) => p && p.date === day && Number(p.market) > 0);
  return row ? Number(row.market) : null;
}

const SEALED_ERA = [["swsh", "SWSH"], ["sv", "SV"], ["sm", "SM"], ["me", "ME"], ["xy", "XY"], ["bw", "BW"], ["cel25", "SWSH"], ["pgo", "SWSH"]];
export function sealedEra(setId) {
  const s = String(setId || "").toLowerCase();
  for (const [p, e] of SEALED_ERA) if (s.startsWith(p)) return e;
  return "";
}

// Sealed side: same era, same product type, by catalogue id.
export function buildSealedLag({ products, histories, start, end, minRisePct = 10, minRiseUsd = 5 }) {
  const pool = [];
  for (const prod of products || []) {
    if (!prod?.id || COMBINED_ART_PARENTS.has(prod.id) || prod.combinedArts === true) continue;
    const pts = histories.get(prod.id);
    const from = pointOn(pts, start);
    const to = pointOn(pts, end);
    const era = sealedEra(prod.setId);
    if (!(from > 0) || !(to > 0) || !era || !prod.subtype) continue;
    pool.push({ id: prod.id, name: prod.name, kind: prod.subtype, era, group: prod.setId, from, to, pid: /^\d+$/.test(String(prod.tcgPlayerId || "")) ? Number(prod.tcgPlayerId) : 0 });
  }
  const out = {};
  for (const p of pool) {
    if (!(p.to - p.from >= minRiseUsd && pct(p.from, p.to) >= minRisePct)) continue;
    const lag = laggingFor(p, pool.map((q) => ({ ...q })), { max: 6 }).filter((q) => q.to >= 3);
    if (!lag.length) continue;
    out[p.id] = { from: p.from, to: p.to, start, end, kind: p.kind, era: p.era, lagging: lag.map((q) => ({ id: q.id, name: q.name, from: q.from, to: q.to, start, end, pid: q.pid })) };
  }
  return { pool, risers: out };
}

// Group climb: at least 4 same-era same-kind ids up 8% and $1, name up to 3 flat ids.
export function groupClimbReads(pool, { start, end, minUp = 4 } = {}) {
  const groups = new Map();
  for (const p of pool) {
    const key = `${p.era}|${p.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const reads = [];
  for (const [key, rows] of groups) {
    const up = rows.filter((p) => isUp(p)).sort((a, b) => (b.to - b.from) - (a.to - a.from));
    if (up.length < minUp) continue;
    const lo = Math.min(...up.map((p) => p.to)) / 2;
    const hi = Math.max(...up.map((p) => p.to)) * 2;
    const flat = rows.filter((p) => isFlat(p, { minPrice: 5 }) && p.to >= lo && p.to <= hi).sort((a, b) => b.to - a.to).slice(0, 3);
    if (!flat.length) continue;
    const [era, kind] = key.split("|");
    const lead = up[0];
    const flatText = flat.map((p) => `${p.name} (${p.group}) ${money(p.to)}, was ${money(p.from)}`).join("; ");
    const f0 = flat[0];
    const headline = `${up.length} ${eraName(era)} ${kind} cards rose 8%+ from ${monthDay(start)} to ${monthDay(end)}. Biggest: ${cleanName(lead.name)}, ${money(lead.from)} to ${money(lead.to)}. Not moved yet: ${cleanName(f0.name)} at ${money(f0.to)}.`;
    if (!cleanCopy(headline)) continue;
    reads.push({
      id: `climb-${era}-${kind}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      sku: `tcgcsv-${lead.id}`,
      href: `/c/tcgcsv-${lead.id}`,
      readKind: "climb", kind: "climb", board: BOARD_TAG, family: "pattern",
      name: `${kind}, ${eraName(era)}`,
      headline, path: headline,
      why: "Same era and same rarity, matched by TCGplayer product id. A take, not a rule.",
      whatWouldMakeThisWrong: "Wrong if any listed id has a different rarity or a different price on those two dates.",
      asOf: end, startDate: start, endDate: end,
      source: `TCGplayer market, ${start} and ${end}`,
      receipt: { era, kind, start, end, up: up.slice(0, 12).map((p) => ({ id: `tcgcsv-${p.id}`, from: p.from, to: p.to })), flat: flat.map((p) => ({ id: `tcgcsv-${p.id}`, from: p.from, to: p.to })) },
      upCount: up.length,
      variants: [
        `Not moved yet: ${flatText}. Meanwhile ${up.length} ${kind} cards from the ${eraName(era)} era rose at least 8% (${monthDay(start)} to ${monthDay(end)}), led by ${lead.name} at ${money(lead.to)}, from ${money(lead.from)}.`,
        `${lead.name} went from ${money(lead.from)} to ${money(lead.to)} (${monthDay(start)} to ${monthDay(end)}), one of ${up.length} ${eraName(era)} ${kind} cards up at least 8%. Same era, same rarity, still flat: ${flatText}.`,
      ].filter(cleanCopy),
    });
  }
  return reads.sort((a, b) => b.upCount - a.upCount);
}

// Set heat: count of priced cards in one set that cleared 8% and $1.
export function setHeatReads(pool, { start, end, minMoved = 5 } = {}) {
  const bySet = new Map();
  for (const p of pool) {
    if (!bySet.has(p.group)) bySet.set(p.group, []);
    bySet.get(p.group).push(p);
  }
  const out = [];
  for (const [set, rows] of bySet) {
    const up = rows.filter((p) => isUp(p, { minPrice: 2 }));
    if (up.length < minMoved) continue;
    const headline = `${shortSet(set)}: ${up.length} of ${rows.length} priced chase cards rose 8%+ and $1 or more (${monthDay(start)} to ${monthDay(end)}).`;
    if (!cleanCopy(headline)) continue;
    out.push({
      id: `setheat-${set}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), readKind: "setheat", kind: "setheat", board: BOARD_TAG, family: "set",
      sku: `tcgcsv-${up[0].id}`, href: `/c/tcgcsv-${up[0].id}`, name: set, set,
      headline, path: headline, asOf: end, startDate: start, endDate: end,
      source: `TCGplayer market, ${start} and ${end}`,
      why: "Chase cards here are rarities above Rare. Counted by product id.",
      receipt: { set, start, end, priced: rows.length, n: up.length },
      n: up.length,
      variants: [
        `${set}: ${up.length} of ${rows.length} priced chase cards rose at least 8% and $1 (${monthDay(start)} to ${monthDay(end)}).`,
        `From ${monthDay(start)} to ${monthDay(end)}, ${up.length} chase cards in ${set} rose at least 8% and $1. ${rows.length - up.length} others did not.`,
      ].filter(cleanCopy),
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

export function releaseReads(releasesDoc, asOf, { days = 45 } = {}) {
  const out = [];
  const until = addDays(asOf, days);
  for (const r of releasesDoc?.releases || []) {
    if (!r?.name || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date || ""))) continue;
    if (r.date < asOf || r.date > until) continue;
    const name = String(r.name).replace(/\s*[\u2014\u2013]\s*/g, ": ").replace(/^JP:\s*/, "Japan: ").replace(/^CN:\s*/, "China: ");
    const inDays = Math.round((Date.parse(r.date) - Date.parse(asOf)) / 86400000);
    let headline = `${name} is out ${monthDay(r.date)}, ${inDays} days from ${monthDay(asOf)}.`;
    if (r.market?.price > 0 && r.market?.date) headline += ` ${r.market.name} is listed at ${money(r.market.price)} on TCGplayer (${monthDay(r.market.date)}).`;
    if (!cleanCopy(headline)) continue;
    out.push({
      id: `release-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80), readKind: "release", kind: "release", board: BOARD_TAG, family: "calendar",
      name, headline, path: headline, asOf, date: r.date,
      href: r.market?.id ? `/p/${r.market.id}` : "",
      source: `${r.source}, checked ${r.checked}`,
      receipt: { date: r.date, source: r.source, checked: r.checked, market: r.market || null },
      variants: [`${inDays} days to go: ${name} lands ${monthDay(r.date)}.`, `Coming ${monthDay(r.date)}: ${name}.`].filter(cleanCopy),
    });
  }
  return out;
}

// One country-named line per source item. Japanese items need an English title on file.
export function newsReads(newsDoc, asOf, { days = 7, max = 5 } = {}) {
  const items = newsDoc?.filters?.news?.items || [];
  const since = addDays(asOf, -days);
  const out = [];
  const country = { jp: "Japan", cn: "China", kr: "Korea", tw: "Taiwan" };
  for (const it of items) {
    if (!it?.url || !it?.date || it.date < since || it.date > asOf) continue;
    let title = String(it.titleEn || it.title || "").trim();
    if (it.language && it.language !== "en") {
      if (!it.titleEn) continue;
      const c = country[it.region];
      if (!c) continue;
      if (!title.startsWith(`${c}:`)) title = `${c}: ${title}`;
    }
    title = title.replace(/\s*\(external link\)\s*/i, "");
    const headline = `${title} (${it.source}, ${monthDay(it.date)})`;
    if (!cleanCopy(headline)) continue;
    const vg = /video-games|vgc/i.test(String(it.tags || "")) || /Victory Road|Gematsu|Pokémon GO/.test(it.source);
    out.push({
      id: `news-${it.url}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90), readKind: "newsline", kind: "newsline", board: BOARD_TAG, family: vg ? "games" : "news",
      name: it.source, headline, path: headline, asOf: it.date, url: it.url, href: it.url,
      source: `${it.source}, ${it.date}`, region: it.region || "", originalTitle: it.originalTitle || "",
      receipt: { url: it.url, date: it.date, source: it.source },
    });
  }
  // Spread sources so one feed does not take the board.
  const seen = new Map();
  return out.filter((r) => { const n = seen.get(r.name) || 0; seen.set(r.name, n + 1); return n < 2; }).slice(0, max);
}

// eBay listing counts stated exactly. Skips shared-art parents and small counts.
export function listingReads(doc, { minStart = 20, minMove = 5, minPct = 15 } = {}) {
  const out = [];
  const skip = new Set([...(doc?.skippedParents || []), ...COMBINED_ART_PARENTS]);
  for (const p of doc?.products || []) {
    const lc = p?.listingsCounted;
    if (!p?.id || skip.has(p.id) || !lc?.prev) continue;
    const a = lc.prev.n, b = lc.n;
    if (!Number.isInteger(a) || !Number.isInteger(b) || Math.max(a, b) < minStart) continue;
    if (Math.abs(b - a) < minMove || Math.abs(pct(a, b)) < minPct) continue;
    const headline = `${p.name}: eBay listings ${a} to ${b} (${monthDay(lc.prev.date)} to ${monthDay(lc.date)}). A listing is not a sale.`;
    if (!cleanCopy(headline)) continue;
    out.push({ id: `listings-${p.id}`, sku: p.id, href: `/p/${p.id}`, readKind: "listings", kind: "listings", board: BOARD_TAG, family: "listings", name: p.name, headline, path: headline, asOf: lc.date, source: `eBay listings counted, ${lc.prev.date} and ${lc.date}`, receipt: { start: a, end: b, startDate: lc.prev.date, endDate: lc.date }, variants: [`eBay listings ${a} to ${b} (${monthDay(lc.prev.date)} to ${monthDay(lc.date)}) for ${p.name}. A listing is not a sale.`].filter(cleanCopy) });
  }
  return out;
}

export function rotationReads(doc, asOf) {
  const sets = doc?.sets || [];
  const std = sets.filter((s) => s.status === "Standard");
  if (!std.length || !doc.asOf) return [];
  const marks = [...new Set(std.map((s) => s.mark).filter(Boolean))].sort();
  const src = (doc.sources || []).slice(-1)[0];
  const headline = `Standard right now: ${std.length} sets, marks ${marks.join(", ")} (our list, ${monthDay(doc.asOf)}).${src ? ` Last rotation: ${src.text}.` : ""} Rotated sets historically stop getting new print runs.`;
  if (!cleanCopy(headline)) return [];
  return [{ id: `rotation-${doc.asOf}`, readKind: "rotation", kind: "rotation", board: BOARD_TAG, family: "rotation", name: "Rotation", headline, path: headline, asOf, href: "/rotation", source: `rotation-status.json, ${doc.asOf}${src ? `; ${src.href}` : ""}`, receipt: { sets: std.length, marks, asOf: doc.asOf } }];
}

// Pokemon facts from the catalogue: card count and artist count by dex, by id.
export function factReads(index, names, { max = 3, asOf = "" } = {}) {
  const out = [];
  const used = new Set();
  for (const name of names) {
    const token = speciesToken(name);
    const entry = token && index?.get?.(token);
    if (!entry || used.has(entry.dex)) continue;
    const row = pokemonFactLine(entry);
    if (!row || !cleanCopy(row.headline)) continue;
    used.add(entry.dex);
    const day = asOf ? ` (catalogue, ${monthDay(asOf)})` : "";
    const headline = row.headline.replace(/\.$/, "") + day + ".";
    out.push({ ...row, headline: cleanCopy(headline) ? headline : row.headline, asOf: asOf || row.asOf, board: BOARD_TAG, family: "fact", source: "data/card-catalogue.json and data/card-attrs.json" });
    if (out.length >= max) break;
  }
  return out;
}

// Price reads: short, dated wording built from the same fields. Never new numbers.
const fromRe = /from \$([\d,]+\.\d{2})/;
export function cleanName(name) {
  return String(name || "").replace(/\s+-\s+[A-Z]*\d+\/[A-Z]*\d+\s*$/, "").trim();
}
export function shortSet(set) {
  return String(set || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
}
export function polishPriceRead(r) {
  if (!r || !["streak", "single", "sealed"].includes(r.readKind)) return r;
  const m = String(r.headline || "").match(fromRe);
  const to = Number(r.price);
  if (!m || !(to > 0) || !r.startDate || !r.endDate) return r;
  const from = Number(m[1].replace(/,/g, ""));
  if (!(from > 0)) return r;
  const name = cleanName(r.name);
  const set = shortSet(r.set);
  const who = set && r.readKind !== "sealed" ? `${name} (${set})` : name;
  const span = `${money(from)} (${monthDay(r.startDate)}) to ${money(to)} (${monthDay(r.endDate)})`;
  const up = to > from;
  const p = Math.round(Math.abs(pct(from, to)));
  const x = to / from;
  let headline;
  if (r.readKind === "streak" && r.streakN >= 3) headline = `${up ? "Up" : "Down"} ${r.streakN} days in a row: ${who}, ${span} on TCGplayer market.`;
  else if (up && x >= 2) headline = `${who} more than doubled in a week: ${span} on TCGplayer market.`;
  else headline = `${who}: ${span} on TCGplayer market. ${up ? "Up" : "Down"} ${p}%.`;
  const variants = [
    `${who} went ${up ? "up" : "down"} ${p}% in ${r.windowDays || 7} days: ${span}, TCGplayer market.`,
    `${span}: that is ${who} on TCGplayer market, ${up ? "up" : "down"} ${p}%.`,
  ].filter(cleanCopy);
  if (!cleanCopy(headline)) return r;
  return { ...r, headline, path: headline, variants };
}
export function keepPriceRead(r) {
  if (r?.readKind === "askmove") {
    const a = Number(r.receipt?.askFrom), b = Number(r.receipt?.askTo);
    if (a > 0 && b > 0 && Math.abs(pct(a, b)) < 5) return false;
  }
  return true;
}

// Breadth: how many priced chase cards rose and fell at least 8% and $1 over the week.
export function breadthReads(pool, { start, end } = {}) {
  const priced = pool.filter((p) => p.to >= 2);
  if (priced.length < 50) return [];
  const up = priced.filter((p) => p.to - p.from >= 1 && pct(p.from, p.to) >= 8).length;
  const down = priced.filter((p) => p.from - p.to >= 1 && pct(p.from, p.to) <= -8).length;
  const flat = priced.filter((p) => Math.abs(pct(p.from, p.to)) < 3).length;
  const headline = `This week in chase cards: ${up} went up 8% or more, ${down} went down 8% or more, ${flat} barely moved. ${priced.length} counted, ${monthDay(start)} to ${monthDay(end)}.`;
  if (!cleanCopy(headline)) return [];
  return [{
    id: `breadth-${end}`, readKind: "breadth", kind: "breadth", board: BOARD_TAG, family: "breadth", name: "Chase cards this week",
    headline, path: headline, asOf: end, startDate: start, endDate: end, href: "/feed?f=prices",
    source: `TCGplayer market, ${start} and ${end}`,
    why: "Chase cards are rarities above Rare priced $2 or more on both dates, counted by product id. Moves need 8% and $1. Barely moved is under 3% either way.",
    receipt: { start, end, priced: priced.length, up, down, flat },
    variants: [
      `${monthDay(start)} to ${monthDay(end)}: of ${priced.length} chase cards counted, ${up} went up 8%+ and ${down} went down 8%+.`,
      `${flat} of ${priced.length} chase cards held within 3% from ${monthDay(start)} to ${monthDay(end)}. ${up} went up 8%+, ${down} went down 8%+.`,
    ].filter(cleanCopy),
  }];
}

export function isPriceRead(r) {
  return !r?.board || r.board !== BOARD_TAG;
}

// Deterministic shuffle by day so the board is unranked.
export function shuffleByDay(rows, day) {
  let seed = 0;
  for (const ch of String(day)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const a = rows.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Price reads at most 40% of the board. Price rows are trimmed, never invented.
// No two of the same family back to back where it can be avoided.
export function mixBoard(priceRows, fresh, day, { maxShare = PRICE_SHARE_MAX } = {}) {
  const nFresh = fresh.length;
  const maxPrice = Math.floor((maxShare * nFresh) / (1 - maxShare));
  const price = priceRows.slice(0, Math.max(0, Math.min(priceRows.length, maxPrice)));
  const all = shuffleByDay([...price, ...fresh], day);
  const out = [];
  const pool = all.slice();
  while (pool.length) {
    const last = out[out.length - 1];
    const fam = (r) => r.family || "price";
    let i = pool.findIndex((r) => !last || fam(r) !== fam(last));
    if (i < 0) i = 0;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export async function buildBoardV3(root, { on = true } = {}) {
  const pub = join(root, "research/assets/public");
  const readsPath = join(pub, "reads.json");
  const doc = await readJson(readsPath);
  if (!doc || !Array.isArray(doc.reads)) return { skipped: "no reads.json" };
  const base = doc.reads.filter(isPriceRead).filter(keepPriceRead).map(polishPriceRead);
  const end = doc.asOf;
  const start = addDays(end, -7);
  const dailyDir = join(root, "data/history/tcgcsv-daily");
  const startDoc = await readJson(join(dailyDir, `${start}.json`));
  const endDoc = await readJson(join(dailyDir, `${end}.json`));
  const raw = await latestRawProducts(root);
  const catalogue = await readJson(join(pub, "feed/catalogue.json"), {});
  let card = { pool: [], risers: {} };
  if (startDoc && endDoc && raw) card = buildCardLag({ startDoc, endDoc, products: raw.products, start, end, catalogueCards: catalogue.cards || {} });

  const sealedProducts = await readJson(join(root, "data/sealed-products.json"), []);
  const histories = new Map();
  for (const p of sealedProducts) {
    const h = await readJson(join(root, `data/history/tcgplayer-market/${p.id}.json`));
    if (h?.points) histories.set(p.id, h.points);
  }
  const sealed = buildSealedLag({ products: sealedProducts, histories, start, end });
  await writeFile(join(pub, "feed/not-moved.json"), JSON.stringify({
    asOf: end, start, end, on,
    label: "Similar cards that have not moved yet. A take, not a rule.",
    rule: "Risers: up at least 15% and $2 (cards) or 10% and $5 (sealed) over the 7 days. Lagging: same era and same rarity or product type, matched by id, moved less than 3% either way.",
    source: `TCGplayer market, ${start} and ${end}`,
    cards: on ? card.risers : {}, sealed: on ? sealed.risers : {},
  }) + "\n");

  if (!on) {
    await writeFile(readsPath, JSON.stringify({ ...doc, reads: base, count: base.length }, null, 1) + "\n");
    return { on, price: base.length, fresh: 0 };
  }
  const releases = await readJson(join(pub, "releases.json"));
  const news = await readJson(join(root, "research/digests/news.json"));
  const listings = await readJson(join(pub, "listings-counted.json"));
  const rotation = await readJson(join(pub, "rotation-status.json"));
  const catDoc = await readJson(join(root, "data/card-catalogue.json"));
  const catDay = String(catDoc?.ingestedAt || "").slice(0, 10);
  let index = null;
  try {
    const cat = await readJson(join(root, "data/card-catalogue.json"));
    const attrs = await readJson(join(root, "data/card-attrs.json"));
    index = buildPokemonIndex(cat?.cards || {}, attrs?.cards || {});
  } catch { index = null; }
  const climbs = groupClimbReads(card.pool, { start, end }).slice(0, 4);
  const heats = setHeatReads(card.pool, { start, end }).slice(0, 2);
  const names = [...base.map((r) => r.name), ...climbs.map((r) => r.receipt.up[0] && card.pool.find((p) => `tcgcsv-${p.id}` === r.receipt.up[0].id)?.name)].filter(Boolean);
  const fresh = [
    ...climbs,
    ...heats,
    ...releaseReads(releases, end).slice(0, 3),
    ...newsReads(news, end),
    ...listingReads(listings).slice(0, 2),
    ...rotationReads(rotation, end),
    ...breadthReads(card.pool, { start, end }),
    ...(index ? factReads(index, names, { max: 2, asOf: catDay }) : []),
  ];
  const { images, tcgOn, sealedPid } = await loadBoardImageInputs(root);
  for (const r of fresh) r.image = boardImage(r, images, tcgOn, sealedPid);
  for (const r of fresh) { if (!r.why) r.why = `From ${r.source}.`; if (!r.whyItMatters) r.whyItMatters = r.why; }
  const reads = mixBoard(base, fresh, end);
  await writeFile(readsPath, JSON.stringify({ ...doc, reads, count: reads.length }, null, 1) + "\n");
  const byKind = {};
  for (const r of reads) byKind[r.readKind || r.kind] = (byKind[r.readKind || r.kind] || 0) + 1;
  return { on, price: reads.filter(isPriceRead).length, fresh: reads.length - reads.filter(isPriceRead).length, byKind, cardRisers: Object.keys(card.risers).length, sealedRisers: Object.keys(sealed.risers).length };
}
