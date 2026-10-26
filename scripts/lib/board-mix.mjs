// Reads board v3: non-price reads built only from files on disk, plus the
// "not moved yet" lists for card and sealed pages. Every number carries a date.
// Turned on and off by the one kill switch, reads.library.

import { banGuard } from "./copy-rules.mjs";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { money, BANNED as BUNDLE_BAN, FILLER_BAN } from "./public-bundle.mjs";
import { pictureForRead, loadBoardImageInputs } from "./read-library.mjs";
import { monthDay } from "./takes.mjs";

const LONG_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// A mark checked card by card later than the card file cites its own check date.
export function markCited(set, doc) {
  const c = String(set?.checked || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return `checked ${LONG_MONTHS[Number(c.slice(5, 7)) - 1]} ${Number(c.slice(8, 10))}, ${c.slice(0, 4)}`;
  return `our list, ${monthDay(doc.asOf)}`;
}
import { buildPokemonIndex, pokemonFactLine, speciesToken } from "./fact-reads.mjs";
import { COMBINED_ART_PARENTS } from "./detectors/listing-trend.mjs";
import { sealedVsChase } from "./detectors/sealed-vs-chase.mjs";
import { loadHistoryCards, historyReads, dayNum } from "./history-reads.mjs";
import { speakDates } from "./read-quality.mjs";
import { setDeepDives, cardStories, eraComparison, preReleaseContext, sealedGapDeep, marketRoundup, artistSpotlights, pokemonSpotlights, rarityTierReports, anniversaryReads, rotationAftermath, recoveryWatch, steadiest, biggestYear, irLifecycle } from "./deep-reads.mjs";
import { everyPrinting, sameLabelAcrossSets, chaseLists, slumpWatch } from "./deep-reads-2.mjs";
import { loadJumpy } from "./jumpy-price.mjs";
import { loadWindowSeries } from "./thin-trading.mjs";
import { rarityBandReads, artistBandReads, releaseCycleReads, mixedReads, ripReads, attachListingsFacts, loadRipDoc } from "./rich-reads.mjs";
import { buildListings } from "./feature-data.mjs";
import { dropHeldReads, loadHeldIds, unstickFamilies } from "./price-hold-skip.mjs";
import { loadReadStability } from "./read-stability.mjs";
import { spaceFamilies } from "./reads-guard.mjs";
import { dropThinReads, listingAnnotate, loadListingIndex, releaseEra } from "./read-thin-data.mjs";

export const BOARD_TAG = "v3";
export const PRICE_SHARE_MAX = 1 / 3;
export const BOARD_MAX = 400;
export const BANNED = banGuard("board mix");
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

// Era is the set release prefix (SWSH07: Evolving Skies -> SWSH, EX Hidden Legends -> EX).
export function eraOf(groupName) {
  return releaseEra(groupName);
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
      source: `${String(r.source || "").replace(/^(?:https?:\/\/)?support\.pokemoncenter\.com\/\S*/i, "Pokémon Center Estimated Preorder Release Dates page")}, checked ${r.checked}`,
      receipt: { date: r.date, source: r.source, checked: r.checked, market: r.market || null },
      variants: [`${inDays} days to go: ${name} lands ${monthDay(r.date)}.`, `Coming ${monthDay(r.date)}: ${name}.`].filter(cleanCopy),
    });
  }
  return out;
}

// One country-named line per source item. Japanese items need an English title on file.
export function newsReads(newsDoc, asOf, { days = 7, max = 5, perSource = 2 } = {}) {
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
  return out.filter((r) => { const n = seen.get(r.name) || 0; seen.set(r.name, n + 1); return n < perSource; }).slice(0, max);
}

// eBay listing counts stated exactly. Skips shared-art parents and small counts.
export function listingReads(doc, { minStart = 15, minMove = 4, minPct = 20 } = {}) {
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
    out.push({ id: `listings-${p.id}`, sku: p.id, href: `/p/${p.id}`, readKind: "listings", kind: "listings", board: BOARD_TAG, family: "listings", name: p.name, headline, path: headline, asOf: lc.date, source: `eBay listings counted, ${monthDay(lc.prev.date)} and ${monthDay(lc.date)}`, receipt: { start: a, end: b, startDate: lc.prev.date, endDate: lc.date }, variants: [`eBay listings ${a} to ${b} (${monthDay(lc.prev.date)} to ${monthDay(lc.date)}) for ${p.name}. A listing is not a sale.`].filter(cleanCopy) });
  }
  return out;
}

// Sealed product against the top-priced chase card of the same TCGplayer group,
// matched by product id. Same two dates. One side cleared $1 and 3%, the other did not.
export function sealedChaseReads({ products, histories, rawProducts, pool, start, end, max = 2 }) {
  if (!rawProducts || !pool?.length) return [];
  const top = new Map();
  for (const p of pool) {
    const cur = top.get(p.group);
    if (!cur || p.to > cur.to) top.set(p.group, p);
  }
  const out = [];
  for (const prod of products || []) {
    if (!prod?.id || COMBINED_ART_PARENTS.has(prod.id) || prod.combinedArts === true) continue;
    const pid = Number(prod.tcgPlayerId);
    const group = pid ? rawProducts.get(pid)?.group : "";
    const chase = group && top.get(group);
    const pts = histories.get(prod.id);
    const from = pointOn(pts, start), to = pointOn(pts, end);
    if (!chase || !(from > 0) || !(to > 0) || chase.to < 10) continue;
    const hit = sealedVsChase({ set: group, sealed: { from, to, start, end }, chase: { from: chase.from, to: chase.to, start, end } });
    if (!hit) continue;
    const sp = Math.round(pct(from, to)), cp = Math.round(pct(chase.from, chase.to));
    const sign = (n) => (n > 0 ? `up ${n}%` : n < 0 ? `down ${-n}%` : "flat");
    const headline = `${prod.name} went ${money(from)} to ${money(to)} (${sign(sp)}) while its top chase card, ${cleanName(chase.name)}, went ${money(chase.from)} to ${money(chase.to)} (${sign(cp)}). ${monthDay(start)} to ${monthDay(end)}, TCGplayer market.`;
    if (!cleanCopy(headline)) continue;
    out.push({
      id: `sealedchase-${prod.id}`, sku: prod.id, href: `/p/${prod.id}`, readKind: "sealedchase", kind: "sealedchase", board: BOARD_TAG, family: "pattern",
      name: prod.name, set: shortSet(group), headline, path: headline, asOf: end, startDate: start, endDate: end,
      source: `TCGplayer market, ${start} and ${end}`,
      why: hit.why, whatWouldMakeThisWrong: hit.whatWouldMakeThisWrong,
      receipt: { ...hit.receipt, sealedId: prod.id, chaseId: `tcgcsv-${chase.id}` },
      gap: Math.abs(sp - cp),
    });
  }
  return out.sort((a, b) => b.gap - a.gap).slice(0, max);
}

// One line per set on our rotation list. Marks and dates come from the file.
export function rotationSetReads(doc, asOf, { max = 30 } = {}) {
  const out = [];
  if (!doc?.asOf) return out;
  let printRunSaid = false;
  for (const set of doc.sets || []) {
    if (!set?.name || !set.status || !set.mark) continue;
    const rotated = /^Rotated /.test(set.status);
    const headline = rotated
      ? `${set.name} (mark ${set.mark}) left Standard: ${set.status.replace(/^Rotated /, "rotated ")} (${markCited(set, doc)}).${printRunSaid ? "" : " Rotated sets historically stop getting new print runs."}`
      : `${set.name} (mark ${set.mark}) is Standard legal (${markCited(set, doc)}).`;
    if (!cleanCopy(headline)) continue;
    if (rotated) printRunSaid = true;
    out.push({ id: `rotation-set-${set.slug}`, readKind: "rotation", kind: "rotation", board: BOARD_TAG, family: "rotation", name: set.name, set: set.name, headline, path: headline, asOf, href: `/sets/${set.slug}`, source: `rotation-status.json, ${doc.asOf}`, receipt: { set: set.slug, mark: set.mark, status: set.status, asOf: doc.asOf } });
    if (out.length >= max) break;
  }
  return out;
}

// eBay listing count for one product on one day, stated exactly.
export function listingLevelReads(doc, { min = 10, max = 30, asOf = "" } = {}) {
  const out = [];
  const skip = new Set([...(doc?.skippedParents || []), ...COMBINED_ART_PARENTS]);
  for (const p of doc?.products || []) {
    const lc = p?.listingsCounted;
    if (!p?.id || skip.has(p.id) || !Number.isInteger(lc?.n) || lc.n < min || !lc.date) continue;
    // A count from another day is not this read. Do not carry it forward.
    if (asOf && lc.date !== asOf) continue;
    const headline = `${p.name}: ${lc.n} eBay listings counted on ${monthDay(lc.date)}. A listing is not a sale.`;
    if (!cleanCopy(headline)) continue;
    const lines = [];
    if (lc.prev?.date && Number.isInteger(lc.prev.n)) {
      const line = `Listings counted ${lc.prev.n} on ${monthDay(lc.prev.date)} to ${lc.n} on ${monthDay(lc.date)}. A listing is not a sale.`;
      if (cleanCopy(line)) lines.push(line);
    }
    out.push({ id: `listcount-${p.id}`, sku: p.id, href: `/p/${p.id}`, readKind: "listings", kind: "listings", board: BOARD_TAG, family: "listings", name: p.name, headline, path: headline, lines, asOf: lc.date, source: lc.prev?.date ? `eBay listings counted, ${lc.prev.date} and ${lc.date}` : `eBay listings counted, ${lc.date}`, receipt: { n: lc.n, prev: lc.prev?.n ?? null, date: lc.date, prevDate: lc.prev?.date || "" } });
  }
  return out.sort((a, b) => b.receipt.n - a.receipt.n).slice(0, max);
}

// Breadth for one set: up, down and barely moved among priced chase cards.
export function setBreadthReads(pool, { start, end, minPriced = 15, max = 40 } = {}) {
  const bySet = new Map();
  for (const p of pool) {
    if (p.to < 2) continue;
    if (!bySet.has(p.group)) bySet.set(p.group, []);
    bySet.get(p.group).push(p);
  }
  const out = [];
  for (const [set, rows] of bySet) {
    if (rows.length < minPriced) continue;
    const up = rows.filter((p) => p.to - p.from >= 1 && pct(p.from, p.to) >= 8).length;
    const down = rows.filter((p) => p.from - p.to >= 1 && pct(p.from, p.to) <= -8).length;
    const flat = rows.filter((p) => Math.abs(pct(p.from, p.to)) < 3).length;
    const headline = `${shortSet(set)} this week: ${up} chase cards up 8% or more, ${down} down 8% or more, ${flat} barely moved, of ${rows.length} counted (${monthDay(start)} to ${monthDay(end)}).`;
    if (!cleanCopy(headline)) continue;
    out.push({ id: `breadth-set-${set}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), readKind: "breadth", kind: "breadth", board: BOARD_TAG, family: "breadth", name: set, set, headline, path: headline, asOf: end, startDate: start, endDate: end, href: `/feed?f=set&set=${encodeURIComponent(set)}`, source: `TCGplayer market, ${start} and ${end}`, receipt: { set, start, end, priced: rows.length, up, down, flat }, moved: up + down });
  }
  return out.sort((a, b) => b.moved - a.moved || b.receipt.priced - a.receipt.priced).slice(0, max);
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
  const week = Number(r.windowDays) === 7 && dayNum(r.endDate) - dayNum(r.startDate) === 7;
  if (r.readKind === "streak" && r.streakN >= 3) headline = `${up ? "Up" : "Down"} ${r.streakN} days in a row: ${who}, ${span} on TCGplayer market.`;
  else if (up && x >= 2 && week) headline = `${who} more than doubled in a week: ${span} on TCGplayer market.`;
  else if (up && x >= 2) headline = `${who} more than doubled: ${span} on TCGplayer market.`;
  else headline = `${who}: ${span} on TCGplayer market. ${up ? "Up" : "Down"} ${p}%.`;
  const variants = [
    `${who} went ${up ? "up" : "down"} ${p}% in ${r.windowDays || 7} days: ${span}, TCGplayer market.`,
    `${span}: that is ${who} on TCGplayer market, ${up ? "up" : "down"} ${p}%.`,
  ].filter(cleanCopy);
  if (!cleanCopy(headline)) return r;
  return { ...r, headline, path: headline, variants };
}
// Thin-market guard: a market price that triples or loses two thirds inside one
// read window is far more often one odd listing than a real move. Drop it.
export function thinMarketOutlier(r) {
  if (!r || !["streak", "single", "sealed"].includes(r.readKind)) return false;
  const m = String(r.headline || "").match(fromRe);
  const to = Number(r.price);
  const from = m ? Number(m[1].replace(/,/g, "")) : NaN;
  if (!(from > 0) || !(to > 0)) return false;
  const x = to / from;
  return x >= 3 || x <= 1 / 3;
}
export function keepPriceRead(r) {
  if (thinMarketOutlier(r)) return false;
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
    why: "TCGplayer market price on the two dates shown.",
    receipt: { start, end, priced: priced.length, up, down, flat },
    variants: [
      `${monthDay(start)} to ${monthDay(end)}: of ${priced.length} chase cards counted, ${up} went up 8%+ and ${down} went down 8%+.`,
      `${flat} of ${priced.length} chase cards held within 3% from ${monthDay(start)} to ${monthDay(end)}. ${up} went up 8%+, ${down} went down 8%+.`,
    ].filter(cleanCopy),
  }];
}

export function isPriceRead(r) {
  return !r?.board || r.board !== BOARD_TAG || r.priceRead === true;
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

// Price reads at most about one third of the board. Price rows are trimmed, never invented.
// No two of the same family back to back where it can be avoided.
export function mixBoard(priceRows, fresh, day, { maxShare = PRICE_SHARE_MAX } = {}) {
  const nFresh = fresh.length;
  const maxPrice = !(maxShare < 1) || nFresh === 0
    ? priceRows.length
    : Math.floor((maxShare * nFresh) / (1 - maxShare));
  const price = priceRows.slice(0, Math.max(0, Math.min(priceRows.length, maxPrice)));
  const all = shuffleByDay([...price, ...fresh], day);
  const out = [];
  const pool = all.slice();
  const fam = (r) => r.family || "price";
  const left = new Map();
  for (const r of pool) left.set(fam(r), (left.get(fam(r)) || 0) + 1);
  while (pool.length) {
    const last = out[out.length - 1];
    // The family with the most rows left goes first when it may, so a large
    // family is not left over at the end with nothing to sit between.
    let i = -1;
    let best = -1;
    for (let k = 0; k < pool.length; k++) {
      const f = fam(pool[k]);
      if (last && f === fam(last)) continue;
      if (left.get(f) > best) { best = left.get(f); i = k; }
    }
    if (i < 0) i = 0;
    const row = pool.splice(i, 1)[0];
    left.set(fam(row), left.get(fam(row)) - 1);
    out.push(row);
  }
  return out;
}

// Quotas are filled in order. A kind with nothing that passes hands its slots to the next kind.
export const KIND_QUOTAS = [
  { kind: "rip", n: 4 },
  { kind: "mixed", n: 6 },
  { kind: "rarity-band", n: 6 },
  { kind: "artist-band", n: 6 },
  { kind: "release-cycle", n: 4 },
  { kind: "listings", n: 8 },
  { kind: "pattern-forming", n: 3 },
  { kind: "pattern-ending", n: 2 },
  { kind: "past-cases", n: 2 },
];

export function fillSlots(rows, plan = KIND_QUOTAS) {
  const by = new Map();
  for (const r of rows || []) {
    const k = r.readKind || r.kind || "";
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const picked = [];
  const seen = new Set();
  let spill = 0;
  for (const step of plan) {
    const want = step.n + spill;
    const take = (by.get(step.kind) || []).filter((r) => !seen.has(r.id)).slice(0, want);
    for (const r of take) { seen.add(r.id); picked.push(r); }
    spill = want - take.length;
  }
  if (spill > 0) {
    for (const r of rows || []) {
      if (spill <= 0) break;
      if (seen.has(r.id) || plan.some((step) => step.kind === (r.readKind || r.kind))) continue;
      seen.add(r.id);
      picked.push(r);
      spill -= 1;
    }
  }
  const rest = (rows || []).filter((r) => !seen.has(r.id));
  return [...picked, ...rest];
}

function ratingDisplayName(read) {
  const name = String(read?.name || "").trim();
  const bad = !name || /^(?:Sealed )?Rating:/i.test(name) || /^tcgcsv-\d+$/i.test(name) || /^#[A-Za-z0-9/]+$/.test(name);
  if (!bad) return read.name;
  const head = String(read.headline || "");
  const fromHead = head.match(/:\s+(.+?),\s+\$/);
  if (fromHead) return fromHead[1].trim();
  const line = (read.lines || []).find((s) => typeof s === "string" && s.includes("$"));
  const fromLine = String(line || "").match(/^(.+?):\s+\$/);
  return fromLine ? fromLine[1].trim() : read.name;
}

export function fitBoard(priceRows, fresh, { maxShare = PRICE_SHARE_MAX, maxBoard = BOARD_MAX, plan = KIND_QUOTAS } = {}) {
  const ordered = fillSlots(fresh, plan);
  const priceCap = (nFresh) => (maxShare < 1 && nFresh > 0 ? Math.floor((maxShare * nFresh) / (1 - maxShare)) : priceRows.length);
  const freshKeep = [];
  for (const r of ordered) {
    const next = freshKeep.length + 1;
    const priceN = Math.min(priceRows.length, priceCap(next));
    if (next + priceN > maxBoard) break;
    freshKeep.push(r);
  }
  const priceN = Math.min(priceRows.length, priceCap(freshKeep.length));
  return { price: priceRows.slice(0, priceN), fresh: freshKeep };
}

export async function buildBoardV3(root, { on = true, spanReads = [], scannerReads = [] } = {}) {
  const pub = join(root, "research/assets/public");
  const readsPath = join(pub, "reads.json");
  const doc = await readJson(readsPath);
  if (!doc || !Array.isArray(doc.reads)) return { skipped: "no reads.json" };
  const base = doc.reads.filter(isPriceRead).filter((r) => r.board !== "hist").filter(keepPriceRead).map(polishPriceRead);
  const end = doc.asOf;
  const start = addDays(end, -7);
  const dailyDir = join(root, "data/history/tcgcsv-daily");
  const startDoc = await readJson(join(dailyDir, `${start}.json`));
  const endDoc = await readJson(join(dailyDir, `${end}.json`));
  const raw = await latestRawProducts(root);
  const catalogue = await readJson(join(pub, "feed/catalogue.json"), {});
  let card = { pool: [], risers: {} };
  if (startDoc && endDoc && raw) card = buildCardLag({ startDoc, endDoc, products: raw.products, start, end, catalogueCards: catalogue.cards || {} });
  const heldIds = await loadHeldIds(root);
  card.pool = (card.pool || []).filter((row) => !heldIds.has(`tcgcsv-${row.id}`));
  for (const id of Object.keys(card.risers || {})) if (heldIds.has(id)) delete card.risers[id];

  const sealedProducts = await readJson(join(root, "data/sealed-products.json"), []);
  const histories = new Map();
  for (const p of sealedProducts) {
    const h = await readJson(join(root, `data/history/tcgplayer-market/${p.id}.json`));
    if (h?.points) histories.set(p.id, h.points);
  }
  const sealed = buildSealedLag({ products: sealedProducts, histories, start, end });
  let hist = { counts: {}, picked: {} };
  let histCards = [];
  try {
    const { cards } = await loadHistoryCards(root);
    histCards = cards.filter((row) => !heldIds.has(row.id));
    hist = historyReads(histCards, end, { perKind: { high: 30, low: 10, year: 40, plain: 60, backto: 40, set: 30 } });
  } catch { hist = { counts: {}, picked: {} }; }
  await writeFile(join(pub, "feed/not-moved.json"), JSON.stringify({
    asOf: end, start, end, on,
    label: "Similar cards that have not moved yet. A take, not a rule.",
    rule: "Risers: up at least 15% and $2 (cards) or 10% and $5 (sealed) over the 7 days. Lagging: same era and same rarity or product type, matched by id, moved less than 3% either way.",
    source: `TCGplayer market, ${start} and ${end}`,
    cards: on ? card.risers : {}, sealed: on ? sealed.risers : {},
  }) + "\n");

  if (!on) {
    const kept = unstickFamilies(dropHeldReads(base, heldIds));
    const listingIndex = await loadListingIndex(root);
    const gated = await dropThinReads(kept, root, end, listingAnnotate(listingIndex));
    await writeFile(readsPath, JSON.stringify({ ...doc, reads: gated, count: gated.length }, null, 1) + "\n");
    return { on, price: gated.length, fresh: 0 };
  }
  const releases = await readJson(join(pub, "releases.json"));
  const news = await readJson(join(root, "research/digests/news.json"));
  // write-feature-data refreshes listings-counted.json after build-feed runs, so the
  // public file is a night behind here. Build the same doc from tonight's
  // sealed-prices.json and use whichever is newer.
  const listings = await freshListings(root, await readJson(join(pub, "listings-counted.json")));
  const rotation = await readJson(join(pub, "rotation-status.json"));
  const catDoc = await readJson(join(root, "data/card-catalogue.json"));
  const catDay = String(catDoc?.ingestedAt || "").slice(0, 10);
  let index = null;
  try {
    const cat = await readJson(join(root, "data/card-catalogue.json"));
    const attrs = await readJson(join(root, "data/card-attrs.json"));
    index = buildPokemonIndex(cat?.cards || {}, attrs?.cards || {});
  } catch { index = null; }
  const climbs = groupClimbReads(card.pool, { start, end }).slice(0, 20);
  const heats = setHeatReads(card.pool, { start, end }).slice(0, 30);
  const names = [...base.map((r) => r.name), ...climbs.map((r) => r.receipt.up[0] && card.pool.find((p) => `tcgcsv-${p.id}` === r.receipt.up[0].id)?.name)].filter(Boolean);
  const fresh = [
    ...climbs,
    ...heats,
    ...releaseReads(releases, end, { days: 90 }),
    ...newsReads(news, end, { days: 10, max: 40, perSource: 6 }),
    ...listingReads(listings).slice(0, 10),
    ...listingLevelReads(listings, { asOf: end }),
    ...sealedChaseReads({ products: sealedProducts, histories, rawProducts: raw?.products, pool: card.pool, start, end, max: 10 }),
    ...rotationReads(rotation, end),
    ...rotationSetReads(rotation, end),
    ...breadthReads(card.pool, { start, end }),
    ...setBreadthReads(card.pool, { start, end }),
  ];
  // Deep layer. Aggregates sit in the non-price lane; card stories, sealed gaps
  // and the eBay-vs-market dives count as price reads.
  const setsDoc = await readJson(join(pub, "sets.json"));
  let deepPrice = [];
  let deepGap = [];
  let deepRecovery = [];
  let deepRating = [];
  let deepSealed = [];
  let deepSlump = [];
  try {
    const usedHist = new Set(Object.values(hist.picked).flat().map((r) => r.sku));
    let nights = { points: new Map(), low: new Map() };
    try { nights = await loadWindowSeries(root, end); } catch { /* no low on file: a thin card cannot lead */ }
    const idOf = (c) => Number(String(c?.id || "").replace(/\D/g, ""));
    const seriesOf = (c) => {
      const daily = nights.points.get(idOf(c));
      if (daily?.length && daily.at(-1)[0] === end) return daily;
      return c.pts;
    };
    const lowOf = (c) => {
      const n = nights.low.get(idOf(c));
      return n > 0 ? n : null;
    };
    const era = eraComparison(histCards, { asOf: end, sets: setsDoc });
    fresh.push(
      ...setDeepDives(histCards, { asOf: end, sets: setsDoc, rotation, seriesOf, lowOf }),
      ...era,
      ...preReleaseContext(histCards, { asOf: end, sets: setsDoc, releases }),
      ...marketRoundup({ asOf: end, start, pool: card.pool, histCounts: hist.counts, eraRow: era[0], releases }),
      // Artist spotlights stay out: no creator names in public reads.
      ...pokemonSpotlights(histCards, { asOf: end }),
      ...rarityTierReports(histCards, { asOf: end, sets: setsDoc }),
      ...anniversaryReads(histCards, { asOf: end, sets: setsDoc }),
      ...rotationAftermath(histCards, { asOf: end, rotation }),
      ...steadiest(histCards, { asOf: end }),
      ...biggestYear(histCards, { asOf: end, sets: setsDoc }),
      ...irLifecycle(histCards, { asOf: end }),
    );
    const variants = await readJson(join(root, "data/card-variants.json"), { cards: {} });
    const tagsOf = (id) => variants.cards?.[id]?.tags || [];
    // Card numbers from the catalogue by card id, where the history file has none.
    const catalogDoc = await readJson(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] });
    const catNum = new Map((catalogDoc.items || []).map((it) => [it.id, it.number || ""]));
    const numbered = histCards.map((c) => (c.number ? c : { ...c, number: catNum.get(c.id) || "" }));
    const jumpy = await loadJumpy(root);
    fresh.push(
      ...everyPrinting(numbered, tagsOf, { asOf: end, max: 6, jumpy, seriesOf, lowOf }),
      ...sameLabelAcrossSets(numbered, tagsOf, { asOf: end, max: 6, jumpy, seriesOf, lowOf }),
      ...chaseLists(histCards, tagsOf, { asOf: end, max: 20, jumpy, seriesOf, lowOf }).filter((r) => !fresh.some((f) => f.href && f.href === r.href)).slice(0, 8),
    );
    deepSlump = slumpWatch(histCards, tagsOf, { asOf: end, max: 10, skip: usedHist }).map((r) => ({ ...r, priceRead: true }));
    deepSlump = await dropThinReads(deepSlump, root, end);
    // Card Rating group reads (feed/card-rating.json, built by build-card-rating.mjs).
    // They compare prices, so they ride a price lane and count toward the price share.
    const rating = await readJson(join(pub, "feed/card-rating.json"), {});
    if (rating?.asOf === end) deepRating = (rating.reads || []).filter((r) => r.headline && r.lines?.length >= 3).map((r) => ({ ...r, name: ratingDisplayName(r), source: String(r.source || "").replace(/Card Rating peers/g, "Card Rating, typical price of similar cards"), priceRead: true }));
    // Sealed Rating reads (feed/sealed-rating.json, built by build-sealed-rating.mjs). Price lane.
    const sealedRating = await readJson(join(pub, "feed/sealed-rating.json"), {});
    if (sealedRating?.asOf === end) deepSealed = (sealedRating.reads || []).filter((r) => r.headline && r.lines?.length >= 3).map((r) => ({ ...r, priceRead: true }));
    const stability = await loadReadStability(root);
    const stories = cardStories(histCards, { asOf: end, skip: usedHist, stability, seriesOf, lowOf });
    for (const r of stories) usedHist.add(r.sku);
    deepPrice = stories.map((r) => ({ ...r, priceRead: true }));
    deepRecovery = recoveryWatch(histCards, { asOf: end, skip: usedHist }).map((r) => ({ ...r, priceRead: true }));
    deepRecovery = await dropThinReads(deepRecovery, root, end);
    deepGap = sealedGapDeep(sealedProducts, histories, histCards, raw?.products, { asOf: end }).map((r) => ({ ...r, priceRead: true }));
  } catch (err) { console.error("deep reads skipped:", err.message); }
  if (Array.isArray(spanReads) && spanReads.length) {
    const used = new Set();
    const seenId = new Set();
    for (const r of [...base, ...fresh]) {
      if (r.href) used.add(String(r.href));
      if (r.id) seenId.add(r.id);
    }
    for (const raw of spanReads) {
      if (!raw || !raw.id || seenId.has(raw.id)) continue;
      const row = { ...raw };
      if (row.href && used.has(String(row.href))) row.href = "";
      if (row.href) used.add(String(row.href));
      seenId.add(row.id);
      fresh.push(row);
    }
  }
  if (Array.isArray(scannerReads) && scannerReads.length) {
    const used = new Set();
    const seenId = new Set();
    for (const r of [...base, ...fresh]) {
      if (r.href) used.add(String(r.href));
      if (r.id) seenId.add(r.id);
    }
    for (const raw of scannerReads) {
      if (!raw || !raw.id || seenId.has(raw.id)) continue;
      const row = { ...raw };
      if (row.href && used.has(String(row.href))) row.href = "";
      if (row.href) used.add(String(row.href));
      seenId.add(row.id);
      fresh.push(row);
    }
  }
  const extraDoc = await readJson(join(pub, "feed/extra-reads.json"), {});
  const dives = (extraDoc.reads || []).filter((r) => r.readKind === "dive" && r.headline);
  const factNames = [...names, ...Object.values(hist.picked).flat().map((r) => r.name)];
  if (index) fresh.push(...factReads(index, factNames, { max: 20, asOf: catDay }));
  fresh.push(
    ...rarityBandReads(histCards, { asOf: end }),
    ...artistBandReads(histCards, { asOf: end }),
    ...releaseCycleReads(histCards, setsDoc, { asOf: end }),
    ...mixedReads({ cards: histCards, sealedPool: sealed.pool, listings, rotation, asOf: end, start, end }),
    ...ripReads(loadRipDoc(root)),
  );
  {
    const seenHead = new Set();
    const seenSku = new Set();
    const keep = [];
    for (const r of fresh) {
      const h = String(r.headline || "").toLowerCase();
      const cardKey = ["listings", "sealedchase"].includes(r.readKind) ? r.sku : "";
      if (!h || seenHead.has(h) || (cardKey && seenSku.has(cardKey))) continue;
      seenHead.add(h);
      if (cardKey) seenSku.add(cardKey);
      keep.push(r);
    }
    fresh.length = 0;
    fresh.push(...keep);
  }
  attachListingsFacts(fresh, listings);
  const { images, tcgOn, sealedPid, logos } = await loadBoardImageInputs(root);
  for (const r of fresh) r.image = pictureForRead(r, images, tcgOn, sealedPid, logos);
  for (const r of fresh) {
    if (r.headline) r.headline = speakDates(r.headline, r.asOf);
    if (r.path) r.path = speakDates(r.path, r.asOf);
    if (r.source) r.source = speakDates(r.source, r.asOf);
    if (Array.isArray(r.lines)) r.lines = r.lines.map((line) => typeof line === "string" ? speakDates(line, r.asOf) : line);
    if (!r.why && r.source) r.why = `From ${r.source}.`;
    if (r.why) r.why = speakDates(r.why, r.asOf);
    if (!r.whyItMatters) r.whyItMatters = r.why;
    else r.whyItMatters = speakDates(r.whyItMatters, r.asOf);
  }
  for (const k of Object.keys(hist.picked)) for (const r of hist.picked[k]) r.image = pictureForRead(r, images, tcgOn, sealedPid, logos);
  // Price rows round-robin: tonight's price reads, then one of each long-history kind.
  // Two of tonight's rows per round, so week moves keep their place.
  const lanes = [base.filter((_, i) => i % 2 === 0), base.filter((_, i) => i % 2 === 1), deepPrice, deepRating, deepGap, deepRecovery, deepSlump, deepSealed, dives, ...["high", "year", "backto", "set", "plain", "low"].map((k) => hist.picked[k] || [])];
  const priceRows = [];
  for (let i = 0; lanes.some((l) => i < l.length); i += 1) for (const l of lanes) if (l[i]) priceRows.push(l[i]);
  const seenSku = new Set(fresh.filter((r) => ["listings", "sealedchase"].includes(r.readKind)).map((r) => r.sku));
  const priceDedup = priceRows.filter((r) => { const k = r.readKind === "set" ? r.id : (r.sku || r.id); if (seenSku.has(k)) return false; seenSku.add(k); return true; });
  // One product page once per night: a later row that links to the same card or product is dropped.
  const seenHref = new Set();
  // A set page can carry a deep dive and also a rotation or birthday line. The
  // Feed keys rows by link, so a second row on the same set page keeps its
  // words but loses the link. The deep dive keeps the link: it is the set read.
  const diveSets = new Set(priceDedup.filter((r) => r.readKind === "deep" && r.deep === "set").map((r) => String(r.href || "")).filter(Boolean));
  const seenSet = new Set();
  const oneSet = (r) => {
    const h = String(r.href || "");
    if (!/^\/sets\//.test(h)) return;
    const dive = r.readKind === "deep" && r.deep === "set";
    if (seenSet.has(h) || (!dive && diveSets.has(h))) r.href = "";
    else seenSet.add(h);
  };
  const onePage = (r) => {
    oneSet(r);
    const h = String(r.href || "");
    if (!/^\/(?:c|p)\//.test(h)) return true;
    if (seenHref.has(h)) {
      if (r.readKind === "mixed" || r.readKind === "rip") {
        r.href = "";
        return true;
      }
      return false;
    }
    seenHref.add(h);
    return true;
  };
  const freshOne = fresh.filter(onePage);
  attachListingsFacts(priceDedup, listings);
  const fitted = fitBoard(priceDedup.filter(onePage), freshOne);
  const mixed = unstickFamilies(dropHeldReads(mixBoard(fitted.price, fitted.fresh, end, { maxShare: 1 }), heldIds));
  for (const r of mixed) if (!String(r.image || "").trim()) r.image = pictureForRead(r, images, tcgOn, sealedPid, logos);
  const listingIndex = await loadListingIndex(root);
  const gated = finishBoard(await dropThinReads(mixed, root, end, listingAnnotate(listingIndex)));
  for (const r of gated) {
    if (r.headline) r.headline = speakDates(r.headline, r.asOf);
    if (r.path) r.path = speakDates(r.path, r.asOf);
    if (r.source) r.source = speakDates(r.source, r.asOf);
    if (r.why) r.why = speakDates(r.why, r.asOf);
    if (r.whyItMatters) r.whyItMatters = speakDates(r.whyItMatters, r.asOf);
    if (Array.isArray(r.lines)) r.lines = r.lines.map((line) => typeof line === "string" ? speakDates(line, r.asOf) : line);
    if (Array.isArray(r.variants)) r.variants = r.variants.map((line) => typeof line === "string" ? speakDates(line, r.asOf) : line);
  }
  await writeFile(readsPath, JSON.stringify({ ...doc, reads: gated, count: gated.length }, null, 1) + "\n");
  const byKind = {};
  for (const r of gated) byKind[r.readKind || r.kind] = (byKind[r.readKind || r.kind] || 0) + 1;
  return { on, history: hist.counts, price: gated.filter(isPriceRead).length, fresh: gated.length - gated.filter(isPriceRead).length, byKind, cardRisers: Object.keys(card.risers).length, sealedRisers: Object.keys(sealed.risers).length };
}

export async function freshListings(root, pubDoc) {
  try {
    const sealed = JSON.parse(await readFile(join(root, "data/sealed-prices.json"), "utf8"));
    const parents = JSON.parse(await readFile(join(root, "data/sealed-products.json"), "utf8"));
    const asOf = String(sealed?.updatedAt || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || (pubDoc?.asOf && pubDoc.asOf > asOf)) return pubDoc;
    const built = buildListings(sealed.products || [], parents);
    if (!built.products?.length) return pubDoc;
    return { asOf, source: "data/sealed-prices.json", parentsFile: "data/sealed-products.json", skippedParents: built.skipped, products: built.products };
  } catch { return pubDoc; }
}

// Last pass on the published board, after every step that can drop a read.
// Price reads (isPriceRead) stay at most one third of the board: price rows are
// trimmed from the back, history rows first and deep dives last, never invented.
// Then no two of a family sit side by side.
export function finishBoard(rows, { maxShare = PRICE_SHARE_MAX } = {}) {
  const list = (rows || []).slice();
  const nFresh = list.filter((r) => !isPriceRead(r)).length;
  const priceIdx = list.map((r, i) => (isPriceRead(r) ? i : -1)).filter((i) => i >= 0);
  const cap = maxShare < 1 ? Math.floor((maxShare * nFresh) / (1 - maxShare)) : priceIdx.length;
  let extra = priceIdx.length - cap;
  const drop = new Set();
  const rank = (r) => (r.board === "hist" ? 0 : r.readKind === "deep" ? 2 : 1);
  for (const tier of [0, 1, 2]) {
    for (let k = priceIdx.length - 1; k >= 0 && extra > 0; k -= 1) {
      const i = priceIdx[k];
      if (!drop.has(i) && rank(list[i]) === tier) { drop.add(i); extra -= 1; }
    }
  }
  return spaceFamilies(list.filter((_, i) => !drop.has(i)));
}
