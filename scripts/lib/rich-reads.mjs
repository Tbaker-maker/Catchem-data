// Non-price and mixed reads. Every number is a point on a dated file.
// A missing input is left out. Empty kinds return no rows.

import { banGuard } from "./copy-rules.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { money, BANNED as BUNDLE_BAN, FILLER_BAN } from "./public-bundle.mjs";
import { nearestPoint, addDays, dateLabel, dayNum } from "./history-reads.mjs";

const BAN = banGuard("rich reads");
const LOW = new Set(["Common", "Uncommon", "Rare", "Code Card", "Promo", "None", ""]);
const TIERS = [["Illustration Rare", "IR"], ["Special Illustration Rare", "SIR"]];

export function copyOk(text) {
  const s = String(text || "");
  return s.length > 0 && !BAN.test(s) && !BUNDLE_BAN.test(s) && !FILLER_BAN.test(s) && !/\bpeers?\b/i.test(s) && !/\bno data\b/i.test(s);
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function signed(n) {
  const body = round1(Math.abs(n));
  const text = Number.isInteger(body) ? String(body) : body.toFixed(1);
  if (n > 0) return `+${text}%`;
  if (n < 0) return `-${text}%`;
  return "0%";
}

function median(xs) {
  const s = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}

function slug(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function shortSet(s) {
  return String(s || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
}

function rowBase(kind, id, name, headline, lines, asOf, source, extra = {}) {
  const bits = [headline, source, extra.why || "", ...lines];
  if (bits.some((s) => s && !copyOk(s))) return null;
  return {
    id, sku: extra.sku || "", href: extra.href || "",
    readKind: kind, kind, board: "v3", family: kind, name,
    headline, path: headline, lines: lines.slice(0, 6),
    asOf, source, why: extra.why || `From ${source}.`,
    startDate: extra.startDate || "", endDate: extra.endDate || asOf,
    receipt: extra.receipt || {},
  };
}

function spanMove(card, fromTarget, toTarget, fromSlack, toSlack) {
  const a = nearestPoint(card.pts, fromTarget, fromSlack);
  const b = nearestPoint(card.pts, toTarget, toSlack);
  if (!a || !b || a[0] >= b[0] || !(a[1] > 0) || !(b[1] > 0)) return null;
  return { from: a[0], to: b[0], p0: a[1], p1: b[1], pct: ((b[1] - a[1]) / a[1]) * 100, card };
}

export function rarityBandReads(cards, { asOf, days = 28, max = 6 } = {}) {
  const by = new Map();
  for (const c of cards || []) {
    if (!c?.set || !c.rarity) continue;
    const key = `${c.setSlug || c.set}|${c.rarity}`;
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(c);
  }
  const out = [];
  for (const [key, list] of by) {
    const tier = TIERS.find((t) => t[0] === list[0].rarity);
    if (!tier) continue;
    const moves = list.map((c) => spanMove(c, addDays(asOf, -days), asOf, 4, 2)).filter((m) => m && dayNum(m.to) - dayNum(m.from) >= 20);
    if (moves.length < 6) continue;
    const med = median(moves.map((m) => m.pct));
    const up = moves.filter((m) => m.pct >= 3).length;
    const down = moves.filter((m) => m.pct <= -3).length;
    const same = up / moves.length >= 0.7 || down / moves.length >= 0.7;
    if (!same || med == null || Math.abs(med) < 3) continue;
    const example = moves.slice().sort((a, b) => Math.abs(a.pct - med) - Math.abs(b.pct - med) || (a.card.id < b.card.id ? -1 : 1))[0];
    const setName = shortSet(list[0].set);
    const dir = up >= down ? "rose" : "fell";
    const nDir = up >= down ? up : down;
    const from = moves.map((m) => m.from).sort()[0];
    const to = moves.map((m) => m.to).sort().at(-1);
    const headline = `${tier[0]} cards in ${setName}: ${nDir} of ${moves.length} ${dir}, median ${signed(med)}, ${dateLabel(from, asOf)} to ${dateLabel(to, asOf)}.`;
    const lines = [
      `${up} up and ${down} down, of ${moves.length} ${tier[0]} cards.`,
      `Median move ${signed(med)}.`,
      `${example.card.name}: ${money(example.p0)} on ${dateLabel(example.from, asOf)} to ${money(example.p1)} on ${dateLabel(example.to, asOf)} (${signed(example.pct)}).`,
      `Same set, same rarity. TCGplayer market on those dates.`,
    ];
    const read = rowBase("rarity-band", `rarity-band-${slug(key)}`, setName, headline, lines, asOf, `TCGplayer market, ${from} to ${to}`, {
      why: "Each card uses its own two market prices. The dates in the line are those points.",
      startDate: from, endDate: to,
      receipt: { set: setName, rarity: tier[0], n: moves.length, up, down, median: round1(med) },
    });
    if (read) out.push(read);
  }
  return out.sort((a, b) => Math.abs(b.receipt.median) - Math.abs(a.receipt.median) || (a.id < b.id ? -1 : 1)).slice(0, max);
}

export function artistBandReads(cards, { asOf, days = 28, max = 6 } = {}) {
  const by = new Map();
  for (const c of cards || []) {
    const artist = String(c?.artist || "").trim();
    if (!artist || LOW.has(c.rarity)) continue;
    if (!by.has(artist)) by.set(artist, []);
    by.get(artist).push(c);
  }
  const out = [];
  for (const [artist, list] of by) {
    const moves = list.map((c) => spanMove(c, addDays(asOf, -days), asOf, 4, 2)).filter((m) => m && m.p1 >= 5 && dayNum(m.to) - dayNum(m.from) >= 20);
    if (moves.length < 6) continue;
    const med = median(moves.map((m) => m.pct));
    const up = moves.filter((m) => m.pct >= 3).length;
    const down = moves.filter((m) => m.pct <= -3).length;
    if ((up / moves.length < 0.7 && down / moves.length < 0.7) || med == null || Math.abs(med) < 3) continue;
    const example = moves.slice().sort((a, b) => Math.abs(a.pct - med) - Math.abs(b.pct - med) || (a.card.id < b.card.id ? -1 : 1))[0];
    const dir = up >= down ? "rose" : "fell";
    const nDir = up >= down ? up : down;
    const from = moves.map((m) => m.from).sort()[0];
    const to = moves.map((m) => m.to).sort().at(-1);
    const headline = `Cards illustrated by ${artist}: ${nDir} of ${moves.length} ${dir}, median ${signed(med)}, ${dateLabel(from, asOf)} to ${dateLabel(to, asOf)}.`;
    const lines = [
      `${up} up and ${down} down, of ${moves.length} cards illustrated by ${artist}.`,
      `Median move ${signed(med)}.`,
      `${example.card.name} (${shortSet(example.card.set)}): ${money(example.p0)} on ${dateLabel(example.from, asOf)} to ${money(example.p1)} on ${dateLabel(example.to, asOf)} (${signed(example.pct)}).`,
      `Artist name from the card file. Prices are TCGplayer market on the dates named.`,
    ];
    const read = rowBase("artist-band", `artist-band-${slug(artist)}`, artist, headline, lines, asOf, `TCGplayer market, ${from} to ${to}; artist from the card file`, {
      why: "Official card artist from the catalogue. Prices are that artist's own cards on the two dates.",
      startDate: from, endDate: to,
      receipt: { artist, n: moves.length, up, down, median: round1(med) },
    });
    if (read) out.push(read);
  }
  return out.sort((a, b) => Math.abs(b.receipt.median) - Math.abs(a.receipt.median) || (a.id < b.id ? -1 : 1)).slice(0, max);
}

function setAgeMove(set, cards, lateTarget, slack = 10) {
  const earlyTarget = addDays(set.release, 14);
  const moves = [];
  let early = "";
  let late = "";
  for (const c of cards) {
    if (c.setSlug !== set.slug || LOW.has(c.rarity)) continue;
    const m = spanMove(c, earlyTarget, lateTarget, slack, slack);
    if (!m || m.p1 < 2) continue;
    moves.push(m.pct);
    if (!early || m.from < early) early = m.from;
    if (!late || m.to > late) late = m.to;
  }
  if (moves.length < 8) return null;
  return { n: moves.length, med: median(moves), early, late };
}

export function releaseCycleReads(cards, setsDoc, { asOf, max = 4 } = {}) {
  const sets = (setsDoc?.sets || []).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s.release || "")) && s.release < asOf && s.slug && s.era);
  const bySlug = new Map();
  for (const c of cards || []) {
    if (!c.setSlug) continue;
    if (!bySlug.has(c.setSlug)) bySlug.set(c.setSlug, []);
    bySlug.get(c.setSlug).push(c);
  }
  const out = [];
  for (const set of sets) {
    const age = dayNum(asOf) - dayNum(set.release);
    if (age < 45 || age > 800) continue;
    const ownCards = bySlug.get(set.slug) || [];
    const own = setAgeMove(set, ownCards, asOf, 8);
    if (!own || own.med == null) continue;
    const peers = [];
    for (const other of sets) {
      if (other.slug === set.slug || other.era !== set.era || other.release >= set.release) continue;
      const late = addDays(other.release, age);
      if (late > asOf) continue;
      const m = setAgeMove(other, bySlug.get(other.slug) || [], late, 10);
      if (m) peers.push(m.med);
    }
    if (peers.length < 3) continue;
    const peerMed = median(peers);
    if (peerMed == null) continue;
    const headline = `${shortSet(set.name)} released ${dateLabel(set.release, asOf)}. On ${dateLabel(asOf, asOf)} that is ${age} days later. Chase cards moved a median ${signed(own.med)} (${own.n} cards). Earlier ${set.era} sets at ${age} days moved a median ${signed(peerMed)} (${peers.length} sets).`;
    const lines = [
      `Release date ${set.release} from sets.json. Counted day is ${asOf}.`,
      `This set: median ${signed(own.med)} on ${own.n} chase cards, ${dateLabel(own.early, asOf)} to ${dateLabel(own.late, asOf)}.`,
      `Earlier ${set.era} sets, same number of days after release: median ${signed(peerMed)} across ${peers.length} sets.`,
      `Chase cards are rarities above Rare. Prices are TCGplayer market.`,
    ];
    const read = rowBase("release-cycle", `release-cycle-${set.slug}`, shortSet(set.name), headline, lines, asOf, `sets.json; TCGplayer market, ${set.release} to ${asOf}`, {
      why: "The day count is the release date on sets.json against the board date. Each median uses prices on file.",
      startDate: set.release, endDate: asOf, href: "",
      receipt: { slug: set.slug, age, own: round1(own.med), peers: round1(peerMed), peerN: peers.length },
    });
    if (read) out.push({ ...read, gap: Math.abs(own.med - peerMed) });
  }
  return out.sort((a, b) => b.gap - a.gap || (a.id < b.id ? -1 : 1)).slice(0, max);
}

export function mixedReads({ cards, sealedPool, listings, rotation, asOf, start, end, max = 8 } = {}) {
  const out = [];
  for (const c of cards || []) {
    const week = spanMove(c, addDays(asOf, -7), asOf, 2, 1);
    const year = spanMove(c, addDays(asOf, -365), asOf, 5, 2);
    if (!week || !year || week.p1 < 5) continue;
    if (Math.abs(week.pct) < 3 || Math.abs(year.pct) < 3) continue;
    const headline = `${c.name}: ${money(week.p0)} on ${dateLabel(week.from, asOf)} to ${money(week.p1)} on ${dateLabel(week.to, asOf)} (${signed(week.pct)}). Over the year, ${money(year.p0)} on ${dateLabel(year.from, asOf)} to ${money(year.p1)} on ${dateLabel(year.to, asOf)} (${signed(year.pct)}).`;
    const lines = [
      `7-day prices: ${money(week.p0)} on ${week.from} and ${money(week.p1)} on ${week.to}.`,
      `Year prices: ${money(year.p0)} on ${year.from} and ${money(year.p1)} on ${year.to}.`,
      `Both windows are TCGplayer market for the same product id.`,
    ];
    const read = rowBase("mixed", `mixed-card-${c.id}`, c.name, headline, lines, asOf, `TCGplayer market, ${year.from} to ${week.to}`, {
      sku: c.id, href: `/c/${c.id}`,
      why: "One card, two dated windows from its own price file.",
      startDate: year.from, endDate: week.to,
      receipt: { week: round1(week.pct), year: round1(year.pct) },
    });
    if (read) out.push({ ...read, rank: Math.abs(week.pct) + Math.abs(year.pct) });
  }
  const priceStart = start || addDays(asOf, -7);
  const priceEnd = end || asOf;
  const byId = new Map((listings?.products || []).map((p) => [p.id, p]));
  for (const p of sealedPool || []) {
    const lc = byId.get(p.id)?.listingsCounted;
    if (!lc?.date || !Number.isInteger(lc.n) || !(p.from > 0) || !(p.to > 0)) continue;
    const pricePct = ((p.to - p.from) / p.from) * 100;
    const listFrom = lc.prev && Number.isInteger(lc.prev.n) ? lc.prev.n : null;
    const listDate = lc.prev?.date;
    if (listFrom == null || !listDate) continue;
    if (Math.abs(pricePct) < 3 && Math.abs(lc.n - listFrom) < 4) continue;
    const listPct = listFrom > 0 ? ((lc.n - listFrom) / listFrom) * 100 : 0;
    let rot = "";
    const setId = String(p.group || "").toLowerCase();
    const hit = (rotation?.sets || []).find((s) => setId && String(s.slug || "").toLowerCase().includes(setId));
    if (hit?.status && rotation?.asOf) rot = `${hit.name} is ${hit.status} (rotation-status.json, ${rotation.asOf}).`;
    const headline = `${p.name}: market ${money(p.from)} on ${dateLabel(priceStart, asOf)} to ${money(p.to)} on ${dateLabel(priceEnd, asOf)} (${signed(pricePct)}). Listings counted ${listFrom} on ${dateLabel(listDate, asOf)} to ${lc.n} on ${dateLabel(lc.date, asOf)}.`;
    const lines = [
      `Market ${money(p.from)} on ${priceStart} to ${money(p.to)} on ${priceEnd} (${signed(pricePct)}).`,
      `Listings counted ${listFrom} on ${listDate} to ${lc.n} on ${lc.date}. A listing is not a sale.`,
      rot,
    ].filter(Boolean);
    const read = rowBase("mixed", `mixed-sealed-${p.id}`, p.name, headline, lines, asOf, `TCGplayer market, ${priceStart} and ${priceEnd}; eBay listings counted, ${listDate} and ${lc.date}`, {
      sku: p.id, href: `/p/${p.id}`,
      why: "The market prices and the listings counted are separate dated files.",
      startDate: listDate, endDate: lc.date,
      receipt: { pricePct: round1(pricePct), listingsPct: round1(listPct) },
    });
    if (read) out.push({ ...read, rank: Math.abs(pricePct) + Math.abs(listPct) });
  }
  const cardsOut = out.filter((r) => String(r.href || "").startsWith("/c/")).sort((a, b) => Math.abs(b.receipt.week) - Math.abs(a.receipt.week) || (a.id < b.id ? -1 : 1));
  const sealedOut = out.filter((r) => String(r.href || "").startsWith("/p/")).sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1));
  const cardN = Math.ceil(max / 2);
  const sealedN = max - cardN;
  return [...sealedOut.slice(0, sealedN), ...cardsOut.slice(0, cardN)];
}

export function ripReads(doc, { max = 6 } = {}) {
  const asOf = doc?.asOf;
  if (!asOf || !Array.isArray(doc?.rows)) return [];
  const out = [];
  const rows = doc.rows.filter((r) => r?.id && r.price > 0 && r.contentsEV > 0 && r.priceAsOf);
  rows.sort((a, b) => b.price - a.price || (a.id < b.id ? -1 : 1));
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.setId)) continue;
    const pctOfPrice = round1((r.contentsEV / r.price) * 100);
    const pubs = (r.slots || []).map((s) => s.published).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""))).sort();
    const pull = pubs.length ? (pubs[0] === pubs.at(-1) ? `Pull rates dated ${dateLabel(pubs[0], asOf)}.` : `Pull rates dated ${dateLabel(pubs[0], asOf)} to ${dateLabel(pubs.at(-1), asOf)}.`) : "";
    const headline = `${r.name}: rip value ${money(r.contentsEV)} is ${pctOfPrice}% of the ${money(r.price)} market price on ${dateLabel(r.priceAsOf, asOf)}.`;
    const lines = [
      `Rip value ${money(r.contentsEV)}. Market price ${money(r.price)} on ${r.priceAsOf}.`,
      r.packs ? `${r.packs} packs. ${pull}`.trim() : pull,
      `Dated rip value file, price date ${r.priceAsOf}.`,
    ].filter(Boolean);
    const read = rowBase("rip", `rip-${r.id}`, r.name, headline, lines.filter(Boolean), asOf, `rip value file, ${r.priceAsOf}`, {
      sku: r.id, href: `/p/${r.id}`,
      why: "Rip value is the estimated contents from dated pull rates and singles prices, set next to that day's market price.",
      startDate: pubs[0] || r.priceAsOf, endDate: r.priceAsOf,
      receipt: { price: r.price, contentsEV: r.contentsEV, pctOfPrice },
    });
    if (read) {
      seen.add(r.setId);
      out.push(read);
    }
    if (out.length >= max) break;
  }
  return out;
}

export function listingsFact(product, asOf) {
  const lc = product?.listingsCounted;
  if (!lc?.date || !Number.isInteger(lc.n)) return "";
  if (lc.prev?.date && Number.isInteger(lc.prev.n)) {
    return `Listings counted ${lc.prev.n} on ${dateLabel(lc.prev.date, asOf || lc.date)} to ${lc.n} on ${dateLabel(lc.date, asOf || lc.date)}. A listing is not a sale.`;
  }
  return `Listings counted ${lc.n} on ${dateLabel(lc.date, asOf || lc.date)}. A listing is not a sale.`;
}

export function attachListingsFacts(reads, doc) {
  const byId = new Map((doc?.products || []).filter((p) => p?.id).map((p) => [p.id, p]));
  for (const r of reads || []) {
    const hrefId = String(r.href || "").startsWith("/p/") ? String(r.href).slice(3) : "";
    const product = byId.get(r.sku) || byId.get(hrefId);
    if (!product || r.readKind === "listings") continue;
    if (String(r.href || "").startsWith("/c/") || String(r.sku || "").startsWith("tcgcsv-")) continue;
    const fact = listingsFact(product, r.asOf || doc?.asOf);
    if (!fact || !copyOk(fact)) continue;
    const blob = [r.headline, ...(r.lines || []), r.why].join(" ");
    if (/listings counted/i.test(blob)) continue;
    if (Array.isArray(r.lines)) {
      if (r.lines.length >= 6) continue;
      r.lines.push(fact);
    } else if (r.readKind !== "deep") {
      r.lines = [fact];
    }
  }
  return reads;
}

export function loadRipDoc(root) {
  try { return JSON.parse(readFileSync(join(root, "data/derived/rip-roi.json"), "utf8")); } catch { return null; }
}

export function loadDurableKeys() {
  try {
    const p = join(dirname(fileURLToPath(import.meta.url)), "../../config/scanner-durable.json");
    const doc = JSON.parse(readFileSync(p, "utf8"));
    return new Set(doc.keys || []);
  } catch { return new Set(); }
}
