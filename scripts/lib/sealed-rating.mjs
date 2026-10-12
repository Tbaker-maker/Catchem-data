// Sealed Rating: factual position data for sealed products, from files on disk.
// Built now: chase-card value against the sealed price, set value against the sealed price,
// price trend over our nightly sealed history, eBay listings counted, print-window stage, age.
// Waiting on data: pack destruction range, set popularity, expected pack value.
// Not advice. Copy never says buy, sell, hold, bottom, target, invest or stack.

export const TYPES = {
  "booster-box": { label: "Booster Boxes", one: "booster box" },
  etb: { label: "Elite Trainer Boxes", one: "Elite Trainer Box" },
  "pc-etb": { label: "Pokémon Center Elite Trainer Boxes", one: "Pokémon Center Elite Trainer Box" },
  "booster-bundle": { label: "Booster Bundles", one: "Booster Bundle" },
  "special-collection": { label: "special collections", one: "special collection" },
  tin: { label: "tins", one: "tin" },
  "booster-pack": { label: "booster packs", one: "booster pack" },
  case: { label: "cases", one: "case" },
  deck: { label: "decks", one: "deck" },
};
export const MIN_PEERS = 5;
export const SHARDS = 16;
export function sealedShard(id) { return String((Number((String(id).match(/(\d+)/) || [])[1]) || 0) % SHARDS).padStart(2, "0"); }
export const MIN_TREND_DAYS = 7;
export const MIN_LISTING_NIGHTS = 7;
export const ERAS = [
  // Release windows from the first and last main sets of each era (sets.json release dates).
  { key: "mega", label: "Mega Evolution era", from: "2025-09-26", note: "Current era. Sets in the current era are the ones still getting new print runs." },
  { key: "sv", label: "Scarlet & Violet era", from: "2023-03-31", note: "The era's last main sets came out Jul 18, 2025." },
  { key: "swsh", label: "Sword & Shield era", from: "2020-02-07", note: "The era's last main set came out Jan 20, 2023." },
  { key: "older", label: "Before Sword & Shield", from: "0000-00-00", note: "Older era." },
];
const LATE = new Set(["tin", "special-collection"]);

const BANNED = /\b(buy|buys|buying|sell|sells|selling|hold|holds|holding|bottom|bottomed|support|resistance|target|invest\w*|stack\w*|load up|best time|underpriced|overpriced|undervalued|overvalued)\b|[\u2014\u2013]/i;
export function cleanCopy(text) { return !BANNED.test(String(text || "")); }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const md = (d) => `${MON[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
const mdy = (d) => `${md(d)}, ${d.slice(0, 4)}`;
const money = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n) => Math.round(n * 100) / 100;
const median = (xs) => { const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const bareName = (n) => String(n || "").replace(/\s+-\s+[A-Z]*\d*[a-z]?\/[A-Z]*\d*\s*$/, "").trim();
const shortSet = (s) => String(s || "").replace(/^(SV|SWSH|SM|ME|XY|BW)\d*[a-z]*:\s*/i, "").replace(/^ME:\s*/, "").trim();
export function setNamed(name, set) {
  const core = shortSet(set).replace(/^(Scarlet & Violet|Sword & Shield|Sun & Moon|Mega Evolution)[:\s]*/i, "").trim().toLowerCase();
  return core.length >= 3 && String(name || "").toLowerCase().includes(core);
}
function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

export function eraOf(release) {
  if (!release) return null;
  return ERAS.find((e) => release >= e.from) || null;
}

// Print-window stage, from official rotation dates and the era of release.
export function stageOf({ release, subtype, rot }) {
  const era = eraOf(release);
  if (!era) return null;
  const late = LATE.has(subtype);
  const rotated = rot?.status && /^Rotated/i.test(rot.status);
  let key = era.key === "mega" ? "current" : rotated ? "rotated" : era.key === "sv" ? "previous" : "older";
  const label = key === "current" ? "Current era" : key === "rotated" ? `${rot.status}` : key === "previous" ? "Previous era, still in Standard" : era.label;
  const lines = [era.note];
  if (rot?.mark) lines.push(`Regulation mark ${rot.mark}${rot.status ? `, ${rot.status}` : ""}.`);
  if (late && key !== "current") lines.push("Tins and collections can be made after a set's main print run, so this stage says less about them.");
  return { key, label, era: era.label, late, lines };
}

// Percentile of v among xs, 0 to 1. Ties count half.
export function pctRank(v, xs) {
  const s = xs.filter((x) => Number.isFinite(x));
  if (!Number.isFinite(v) || s.length < MIN_PEERS) return null;
  let below = 0, eq = 0;
  for (const x of s) { if (x < v) below++; else if (x === v) eq++; }
  return r2((below + eq / 2) / s.length);
}

export function verdictOf(p, many) {
  if (p == null) return null;
  if (p >= 0.75) return `Low price next to its set's top card, compared with other ${many}`;
  if (p <= 0.25) return `High price next to its set's top card, compared with other ${many}`;
  return `In line with other ${many} next to its set's top card`;
}

// sets: Map slug -> { total, n, top: { id, name, price, date } } built from singles priced on asOf.
export function setValues(rows, asOf) {
  const out = new Map();
  for (const r of rows) {
    if (r.kind === "sealed" || !r.setSlug || !(r.price > 0) || String(r.asOf || "").slice(0, 10) !== asOf) continue;
    const s = out.get(r.setSlug) || { total: 0, n: 0, cards: [] };
    s.total += r.price; s.n += 1;
    s.cards.push({ id: r.id, name: bareName(r.name), num: r.num || "", price: r.price, date: asOf });
    out.set(r.setSlug, s);
  }
  for (const s of out.values()) {
    s.total = r2(s.total);
    s.cards.sort((a, b) => b.price - a.price);
    // A top card priced 4x or more over the next one is held for a check (often a promo or a mislabeled row).
    let i = 0;
    while (i < s.cards.length - 1 && s.cards[i].price >= 4 * s.cards[i + 1].price) i++;
    s.held = s.cards.slice(0, i).map((c) => ({ id: c.id, name: c.name, price: c.price }));
    s.top = s.cards[i] || null;
    delete s.cards;
  }
  return out;
}

export function trendOf(hist) {
  const h = (hist || []).filter((p) => p && p[1] > 0);
  if (h.length < MIN_TREND_DAYS) return { days: h.length, from: h[0]?.[0] || null };
  const a = h[0], z = h.at(-1);
  return { days: h.length, from: a[0], to: z[0], a: a[1], z: z[1], pct: Math.round(((z[1] - a[1]) / a[1]) * 1000) / 10 };
}

// listings: Map tcgcsv id -> { n, date, prev:{n,date}, nights }
export function buildSealedRatings({ rows, rot, listings = new Map(), packs = new Map(), today }) {
  const sets = setValues(rows, today);
  const rotBy = new Map((rot?.sets || []).map((s) => [s.slug, s]));
  const base = [];
  for (const r of rows) {
    if (r.kind !== "sealed" || !(r.price > 0) || !TYPES[r.subtype]) continue;
    // Half boxes and displays of several products are not compared with full single products.
    if (/\bhalf\b|\bdisplay\b|\bset of \d|\(set of/i.test(r.name) && r.subtype !== "case") continue;
    if (String(r.asOf || "").slice(0, 10) !== today) continue;
    // Top card and set value only when the product is named for its set (tins and collections
    // are often filed under a promo group whose cards are not in the product).
    const sv = setNamed(r.name, r.set) ? sets.get(r.setSlug) : null;
    const top = sv?.top || null;
    const item = {
      id: r.id, name: r.name, set: r.set, setSlug: r.setSlug, type: r.subtype, typeLabel: TYPES[r.subtype].one, release: r.release || null,
      price: { price: r.price, date: today, source: "TCGplayer market" },
      chase: top && sv.n >= 10 ? { ...top, ratio: r2(top.price / r.price), held: sv.held?.length ? sv.held : undefined } : null,
      setValue: sv && sv.n >= 10 ? { total: sv.total, n: sv.n, ratio: r2(sv.total / r.price), date: today } : null,
      trend: trendOf(r.hist),
      listings: listings.get(r.id) || null,
      packs: packs.get(r.id) || null,
      stage: stageOf({ release: r.release, subtype: r.subtype, rot: rotBy.get(r.setSlug) }),
      ageDays: r.release ? daysBetween(r.release, today) : null,
    };
    if (item.packs) item.perPack = r2(r.price / item.packs);
    base.push(item);
  }
  const byType = new Map();
  for (const it of base) { if (!byType.has(it.type)) byType.set(it.type, []); byType.get(it.type).push(it); }
  for (const [type, list] of byType) {
    const ratios = list.map((x) => x.chase?.ratio);
    const svr = list.map((x) => x.setValue?.ratio);
    const tr = list.map((x) => x.trend?.pct);
    const med = median(ratios);
    for (const it of list) {
      const f = {};
      const c = pctRank(it.chase?.ratio, ratios); if (c != null) f.chase = { v: c, label: "Top card vs sealed price" };
      const s = pctRank(it.setValue?.ratio, svr); if (s != null) f.setValue = { v: s, label: "Set value vs sealed price" };
      const t = pctRank(it.trend?.pct, tr); if (t != null) f.trend = { v: t, label: "Price trend, nightly history" };
      it.factors = f;
      it.peers = { type, n: ratios.filter(Number.isFinite).length, medianChaseRatio: med == null ? null : r2(med) };
      it.verdict = verdictOf(f.chase?.v ?? null, TYPES[type].label);
    }
  }
  return base;
}

export function waitingFactors(nights) {
  return [
    { key: "destruction", label: "Pack destruction range", why: "Needs dated PSA population counts entered each month plus cleared pull-rate inputs. Ranges for a few sets are in the research doc, not on the site." },
    { key: "listingsTrend", label: "Listings trend", why: `Needs ${MIN_LISTING_NIGHTS} nights of eBay listings counts. ${nights} on file.` },
    { key: "popularity", label: "Set popularity", why: "No dated, cleared source for how popular a set is yet." },
    { key: "packValue", label: "Expected pack value", why: "Needs per-set pull rates we can cite. Community rates vary by set and print run." },
  ];
}

export function sealedReads(list, { asOf, max = 3 } = {}) {
  const out = [];
  const byType = new Map();
  for (const it of list) if (it.chase && it.factors?.chase && it.peers.n >= MIN_PEERS) { if (!byType.has(it.type)) byType.set(it.type, []); byType.get(it.type).push(it); }
  const usedSets = new Set();
  for (const type of ["booster-box", "etb", "pc-etb", "booster-bundle", "special-collection", "tin"]) {
    const rs = byType.get(type);
    if (!rs) continue;
    const T = TYPES[type];
    // One product per set in a read, and a set leads only one read a night.
    const seen = new Set();
    const pick = rs.filter((x) => x.factors.chase.v >= 0.75).sort((a, b) => b.chase.ratio - a.chase.ratio)
      .filter((x) => { if (seen.has(x.setSlug)) return false; seen.add(x.setSlug); return true; });
    const lead = pick.findIndex((x) => !usedSets.has(x.setSlug));
    if (lead < 0) continue;
    pick.unshift(...pick.splice(lead, 1));
    if (!pick.length) continue;
    const top = pick[0];
    usedSets.add(top.setSlug);
    const head = `Sealed vs its top card, ${T.label}: ${top.name} is ${money(top.price.price)} (${md(asOf)}) and its set's top card ${top.chase.name} is ${money(top.chase.price)}, ${top.chase.ratio}x the sealed price. The ${T.one} median is ${top.peers.medianChaseRatio}x across ${top.peers.n}.`;
    const lines = [
      ...pick.slice(0, max).map((x) => `${x.name}: ${money(x.price.price)}, top card ${x.chase.name} ${money(x.chase.price)} (${x.chase.ratio}x).`),
      `Top card is the highest-priced single in the set on ${md(asOf)}. All prices TCGplayer market.`,
      "A factual comparison of prices on file, not advice.",
    ];
    if (!cleanCopy(head) || lines.some((l) => !cleanCopy(l))) continue;
    out.push({ id: `deep-sealedrating-${type}`, readKind: "deep", kind: "deep", deep: "sealedrating", board: "v3", family: "deep", name: `Sealed Rating: ${T.label}`, sku: top.id, href: `/p/${top.id}`, headline: head, path: head, lines: lines.slice(0, 6), asOf, source: `TCGplayer market, ${asOf}; Sealed Rating, same product type`, tags: [], receipt: { type, items: pick.slice(0, max).map((x) => ({ id: x.id, price: x.price, chase: x.chase })) } });
  }
  // Print stage: median nightly change of boxes and ETBs by stage.
  const pool = list.filter((x) => ["booster-box", "etb"].includes(x.type) && x.trend?.pct != null && x.stage);
  const groups = [["current", "Current era"], ["previous", "Previous era, in Standard"], ["rotated", "Rotated from Standard"], ["older", "Older eras"]]
    .map(([k, label]) => { const g = pool.filter((x) => x.stage.key === k); return { k, label, n: g.length, med: median(g.map((x) => x.trend.pct)) }; })
    .filter((g) => g.n >= MIN_PEERS);
  if (groups.length >= 2) {
    const from = pool.map((x) => x.trend.from).sort()[0];
    const head = `Sealed by print stage, ${md(from)} to ${md(asOf)}: ${groups.map((g) => `${g.label} median ${g.med > 0 ? "+" : ""}${Math.round(g.med * 10) / 10}%`).join(", ")}.`;
    const lines = [
      ...groups.map((g) => `${g.label}: ${g.n} booster boxes and Elite Trainer Boxes, median ${g.med > 0 ? "+" : ""}${Math.round(g.med * 10) / 10}%.`),
      `Change from each product's first to last night on file, ${MIN_TREND_DAYS} nights or more. Stages use official rotation dates and era release dates.`,
      "TCGplayer market. Past moves are history, not a forecast.",
    ];
    if (cleanCopy(head) && lines.every(cleanCopy)) out.push({ id: "deep-sealedrating-stage", readKind: "deep", kind: "deep", deep: "sealedrating", board: "v3", family: "deep", name: "Sealed Rating: print stage", href: "/movers", headline: head, path: head, lines: lines.slice(0, 6), asOf, source: `TCGplayer market, ${from} to ${asOf}; rotation-status.json`, tags: [], chart: { label: "Median change by print stage, %", bars: groups.map((g) => [g.label, Math.round(g.med * 10) / 10]) }, receipt: { groups } });
  }
  return out;
}

// Singles vs sealed: the same basket of a set's singles against one sealed product,
// on the product's first night on file and tonight. Ranges come from the nightly ratio.
export function singlesVsSealed(rows, { asOf, types = ["etb", "booster-box"], minCards = 50 } = {}) {
  const bySet = new Map();
  for (const r of rows) if (r.kind !== "sealed" && r.setSlug && r.hist?.length) { if (!bySet.has(r.setSlug)) bySet.set(r.setSlug, []); bySet.get(r.setSlug).push(r); }
  const out = [];
  for (const p of rows) {
    if (p.kind !== "sealed" || !types.includes(p.subtype) || !setNamed(p.name, p.set) || /\bhalf\b|display|case|set of/i.test(p.name)) continue;
    const ph = (p.hist || []).filter((x) => x[1] > 0);
    if (ph.length < MIN_TREND_DAYS || ph.at(-1)[0] !== asOf) continue;
    const cards = bySet.get(p.setSlug) || [];
    // Value on a night = the last price on or before it (a missing night carries the prior price).
    const val = (h, d) => { let v = null; for (const [x, y] of h) { if (x > d) break; if (y > 0) v = y; } return v; };
    const hs = cards.map((c) => c.hist.slice().sort((x, y) => (x[0] < y[0] ? -1 : 1)));
    const start = ph.find(([d]) => hs.filter((h) => val(h, d) != null).length >= minCards);
    if (!start) continue;
    const a = start[0];
    const basket = hs.filter((h) => val(h, a) != null && h.some(([d, y]) => d === asOf && y > 0));
    if (basket.length < minCards) continue;
    const sum = (d) => r2(basket.reduce((t, h) => t + val(h, d), 0));
    const ratios = ph.filter(([d]) => d >= a).map(([d, v]) => [d, r2(sum(d) / v)]);
    if (ratios.length < MIN_TREND_DAYS) continue;
    const sealedFrom = ph.find(([d]) => d === a)[1];
    const vals = ratios.map((x) => x[1]);
    out.push({ id: p.id, name: p.name, set: p.set, setSlug: p.setSlug, type: p.subtype, from: a, to: asOf, nights: ratios.length, cards: basket.length,
      singlesFrom: sum(a), singlesTo: sum(asOf), sealedFrom, sealedTo: ph.at(-1)[1], low: Math.min(...vals), high: Math.max(...vals), ratioFrom: ratios[0][1], ratioTo: ratios.at(-1)[1], points: ratios });
  }
  return out;
}

export function singlesVsSealedReads(list, { asOf, max = 4 } = {}) {
  const seen = new Set();
  const picks = list.filter((x) => x.ratioFrom > 0).sort((a, b) => Math.abs(b.ratioTo / b.ratioFrom - 1) - Math.abs(a.ratioTo / a.ratioFrom - 1)).filter((x) => { if (seen.has(x.setSlug)) return false; seen.add(x.setSlug); return true; }).slice(0, max);
  return picks.map((x) => {
    const head = `Singles vs sealed, ${shortSet(x.set)}: ${x.cards} singles add up to ${x.ratioTo}x the ${x.name} tonight, from ${x.ratioFrom}x on ${md(x.from)}. Range ${x.low}x to ${x.high}x over ${x.nights} nights.`;
    const lines = [
      `${x.cards} singles: ${money(x.singlesFrom)} (${md(x.from)}) to ${money(x.singlesTo)} (${md(asOf)}).`,
      `${x.name}: ${money(x.sealedFrom)} to ${money(x.sealedTo)}, same nights.`,
      `Same basket every night: singles priced on ${md(x.from)} and ${md(asOf)}; a missing night carries the prior price.`,
      "A factual comparison of prices on file, not advice.",
    ];
    if (!cleanCopy(head) || !lines.every(cleanCopy)) return null;
    return { id: `deep-singlesvssealed-${x.setSlug}`.slice(0, 90), readKind: "deep", kind: "deep", deep: "singlesvssealed", board: "v3", family: "deep", name: `Singles vs sealed: ${shortSet(x.set)}`, sku: x.id, href: `/p/${x.id}`, headline: head, path: head, lines, asOf, source: `TCGplayer market, ${x.from} to ${asOf}`, tags: [], chart: { label: "Singles total / sealed price", points: x.points }, startDate: x.from, endDate: asOf, receipt: { cards: x.cards, from: x.from, low: x.low, high: x.high } };
  }).filter(Boolean);
}
