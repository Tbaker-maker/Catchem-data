// Card Rating: a factual comparison of one card against similar cards.
// Grows out of the IR watchlist (scripts/lib/ir-cycle.mjs). Every factor is
// 0 to 1 and comes from files on disk: TCGplayer market prices (nightly
// buckets plus hist-long), card-variants.json, search-lite.json, eBay sealed
// listings counted, tonight's reads. Nothing is estimated or filled.
// Wording is factual only. This is not advice.
import { series, priceAt, trend, range, rangePos, stageValue, setListings, days } from "./ir-cycle.mjs";
import { popularity, monName } from "./popular-pokemon.mjs";

// Weights add to 100. A factor with no data is left out and the rest are
// rescaled, so a missing fact never counts as good or bad.
export const RATING_WEIGHTS = { peer: 25, popularity: 15, scarcity: 10, pull: 5, demand: 15, age: 10, artist: 10, range: 10 };
export const FACTOR_LABEL = { peer: "Price vs similar cards", popularity: "Popularity", scarcity: "How rare this version is", pull: "Pull rate", demand: "Recent demand", age: "Age", artist: "Artist", range: "Price vs its own history" };

// Verdict bands on price against the peer median.
export const BELOW = 0.8;
export const ABOVE = 1.25;
export const MIN_PEERS = 5;
// A price more than 10x away from its peer median is held back for a check,
// never shown as a verdict or used in a read.
export const CHECK = 10;

const LOWR = new Set(["Common", "Uncommon", "Promo", ""]);
const WOTC_END = "2003-06-01";
const EX_START = "2003-06-01";
const EX_END = "2007-06-01";

// Groups, first match wins. Each has its own peer set and read path.
export const GROUPS = [
  // Public labels name each card's own rarity or variant tag. Never an IR or SIR equivalent.
  { key: "tagteam-alt", label: "Tag Team (Alternate Art) cards", one: "Tag Team (Alternate Art)", tag: "Tag Team (Alternate Art)", test: (c) => c.tags.has("Tag Team (Alternate Art)") || (c.tags.has("Tag Team") && c.tags.has("Alternate Art")) },
  { key: "tagteam", label: "Tag Team cards", one: "Tag Team", tag: "Tag Team", test: (c) => c.tags.has("Tag Team") && !LOWR.has(c.rarity) },
  { key: "swsh-alt", label: "Alternate Art cards", one: "Alternate Art", tag: "Alternate Art", test: (c) => c.tags.has("Alternate Art") && c.release >= "2020-02" && c.release < "2023-03" },
  { key: "tg", label: "Trainer Gallery cards", one: "Trainer Gallery", tag: "Trainer Gallery", test: (c) => c.tags.has("Trainer Gallery") },
  { key: "gg", label: "Galarian Gallery cards", one: "Galarian Gallery", tag: "Galarian Gallery", test: (c) => c.tags.has("Galarian Gallery") },
  { key: "sir", label: "Special Illustration Rares", one: "Special Illustration Rare", rarity: "Special Illustration Rare", test: (c) => c.rarity === "Special Illustration Rare" },
  { key: "ir", label: "Illustration Rares", one: "Illustration Rare", rarity: "Illustration Rare", test: (c) => c.rarity === "Illustration Rare" },
  { key: "gold-star", label: "Gold Star cards", one: "Gold Star card", test: (c) => / Star\b/.test(c.name) && !/Prism Star|Black Star|Team Star|Star Piece|Grey Star/i.test(c.name) && c.release >= EX_START && c.release < EX_END && c.rarity === "Ultra Rare" },
  { key: "shining", label: "Shining cards", one: "Shining card", test: (c) => /^Shining /.test(c.name) && c.release < WOTC_END && !LOWR.has(c.rarity) },
  { key: "prism", label: "Prism Star cards", one: "Prism Star card", test: (c) => c.tags.has("Prism Star") },
  { key: "radiant", label: "Radiant cards", one: "Radiant card", test: (c) => c.tags.has("Radiant") },
  { key: "gold", label: "Gold cards", one: "Gold card", test: (c) => c.tags.has("Gold") },
  { key: "ex-era-ex", label: "EX-era ex cards", one: "EX-era ex card", test: (c) => / ex\b/.test(c.name) && c.release >= EX_START && c.release < EX_END && c.rarity === "Ultra Rare" },
  { key: "wotc-holo", label: "vintage WOTC holos", one: "vintage WOTC holo", test: (c) => c.release < WOTC_END && c.rarity === "Holo Rare" && !/promo/i.test(c.set) },
];
// 1st Editions are priced as their own printing, against other 1st Edition WOTC holos.
export const FIRST_ED = { key: "first-ed", label: "1st Edition WOTC holos", one: "1st Edition WOTC holo" };
export const PRINT_WINDOW = new Set(["ir", "sir", "tg", "gg", "swsh-alt", "tagteam-alt", "tagteam", "radiant", "gold"]);

const median = (a) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); const m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null; };
const clamp = (x) => Math.max(0, Math.min(1, x));
// Percentile rank of x inside list (0 lowest, 1 highest).
const pctRank = (list, x) => { if (!list.length) return null; let below = 0; for (const v of list) if (v < x) below++; return below / Math.max(1, list.length - 1); };
export const bandOf = (w) => (w >= 3 ? "high" : w >= 1 ? "mid" : "low");

// Peer value: half the peer median scores 0.75, double scores 0.25.
export function peerValue(price, med) {
  if (!(price > 0) || !(med > 0)) return null;
  return clamp(0.5 - Math.log2(price / med) / 4);
}
export function verdictOf(ratio) {
  if (ratio == null) return null;
  if (ratio <= BELOW) return "Priced below similar cards";
  if (ratio >= ABOVE) return "Priced above similar cards";
  return "Priced in line with similar cards";
}

// Artist premium from our data: for each artist, the median of (card price /
// median price of same set and rarity), over cards in sets with 5+ peers.
export function artistPremiums(cards, minCards = 8) {
  const bySR = new Map();
  for (const c of cards) { const k = c.setSlug + "|" + c.rarity; if (!bySR.has(k)) bySR.set(k, []); bySR.get(k).push(c.price); }
  const med = new Map([...bySR].map(([k, a]) => [k, a.length >= 5 ? median(a) : null]));
  const byArtist = new Map();
  for (const c of cards) {
    const m = med.get(c.setSlug + "|" + c.rarity);
    if (!c.artist || !m) continue;
    if (!byArtist.has(c.artist)) byArtist.set(c.artist, []);
    byArtist.get(c.artist).push(c.price / m);
  }
  const out = new Map();
  for (const [a, xs] of byArtist) if (xs.length >= minCards) out.set(a, { premium: median(xs), n: xs.length });
  const all = [...out.values()].map((x) => x.premium);
  for (const v of out.values()) v.v = pctRank(all, v.premium);
  return out;
}

// Scarcity of the treatment for one Pokémon.
export function scarcity(card, byMon) {
  const list = byMon.get(card.mon) || [];
  if (!card.mon || list.length < 1) return null;
  const same = list.filter((c) => c.group === card.group);
  const commons = list.filter((c) => c.rarity === "Common" || c.rarity === "Uncommon").length;
  const first = same.every((c) => c.release >= card.release);
  const v = 0.4 * (first ? 1 : 0) + 0.4 * (1 - Math.min(same.length - 1, 9) / 9) + 0.2 * (list.length ? commons / list.length : 0);
  return { v: clamp(v), total: list.length, same: same.length, commons, first };
}

export function weeksUp(pts, end, n = 12) {
  let up = 0, seen = 0;
  for (let i = 0; i < n; i++) {
    const a = priceAt(pts, new Date(Date.parse(end) - (i + 1) * 7 * 86400000).toISOString().slice(0, 10));
    const b = priceAt(pts, new Date(Date.parse(end) - i * 7 * 86400000).toISOString().slice(0, 10));
    if (!a || !b) continue;
    seen++;
    if (b[1] > a[1]) up++;
  }
  return seen >= 6 ? { up, of: seen } : null;
}

const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dl = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d || "")) ? `${MONS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}, ${d.slice(0, 4)}` : "");
const title = (s) => String(s || "").replace(/\b([a-z])/g, (m) => m.toUpperCase());
const POP_LABEL = { headliner: "Fan favourite", eeveelution: "Eeveelution", gen1: "Gen 1", starter: "Starter", popular: "Popular Pokémon" };
const pctTxt = (n) => (n > 0 ? `up ${n}%` : n < 0 ? `down ${Math.abs(n)}%` : "flat");

// rows: nightly bucket rows. longRows: hist-long map. variants: card-variants cards map.
// searchMons: Map mon -> count of catalogue rows in search. readHits: Map id -> count of tonight's streak/climb reads.
// Pull rate, only where data/pull-rates-published.json has a published figure for the set and rarity.
// pulls: Map "setSlug|rarity" -> { oneIn, perCard, cards, source, url }. v = share of rated
// set-and-rarity pairs of the same rarity with easier per-card odds (harder pull, higher bar).
export function pullFactor(c, pulls) {
  const k = pulls?.get(`${c.setSlug}|${c.rarity}`) || (/^GG\d/i.test(String(c.num || "")) ? pulls?.get(`${c.setSlug}|Galarian Gallery`) : null);
  if (!k) return null;
  const same = [...pulls.values()].filter((x) => x.rarity === k.rarity).map((x) => x.perCard);
  if (same.length < 3) return { v: 0.5, k };
  const below = same.filter((x) => x < k.perCard).length, eq = same.filter((x) => x === k.perCard).length;
  return { v: Math.round(((below + eq / 2) / same.length) * 100) / 100, k };
}
export function pullTable(doc, rows) {
  const count = new Map();
  for (const r of rows || []) if (r.kind === "single" && r.setSlug) {
    const key = `${r.setSlug}|${/^GG\d/i.test(String(r.num || "")) ? "Galarian Gallery" : r.rarity}`;
    count.set(key, (count.get(key) || 0) + 1);
  }
  const out = new Map();
  for (const x of doc?.rates || []) {
    const key = `${x.setSlug}|${x.rarity}`, n = count.get(key);
    if (!n || !(x.oneInPacks > 0)) continue;
    const src = doc.sources?.[x.source] || {};
    out.set(key, { rarity: x.rarity, oneIn: x.oneInPacks, cards: n, perCard: Math.round(x.oneInPacks * n), source: src.name || x.source, url: src.url || "", asOf: src.dataAsOf || src.revised || src.checked || "" });
  }
  return out;
}
export function buildRatings({ rows, longRows = {}, variants = {}, searchMons = new Map(), readHits = new Map(), bySet = null, rot = null, today, pulls = null }) {
  const cards = [];
  for (const r of rows) {
    if (r.kind !== "single" || !r.release || !r.setSlug) continue;
    if (/promo|prize pack|miscellaneous|world championship/i.test(r.set || "")) continue;
    const pts = series(r, longRows[r.id]);
    const now = priceAt(pts, today, 3);
    if (!now) continue;
    const tags = new Set(variants[r.id]?.tags || []);
    const c = { printing: r.printing || "", id: r.id, name: r.name, num: r.num, set: r.set, setSlug: r.setSlug, rarity: r.rarity || "", artist: r.artist || "", release: r.release, tags, pts, price: now[1], date: now[0], printings: r.printings || [], mon: monName(r.name) };
    c.group = (GROUPS.find((g) => g.test(c)) || {}).key || "";
    cards.push(c);
  }
  const byMon = new Map();
  for (const c of cards) { if (!c.mon) continue; if (!byMon.has(c.mon)) byMon.set(c.mon, []); byMon.get(c.mon).push(c); }
  const artists = artistPremiums(cards);
  const rated = [];
  const ctx = (c, g, price, date, pts) => {
    const pop = popularity(c.name);
    const t30 = pts ? trend(pts, today, 30) : null;
    const t90 = pts ? trend(pts, today, 90) : null;
    const rg = pts ? range(pts) : null;
    return { c, g, price, date, pts, pop, band: bandOf(pop.weight), t30, t90, rg, pos: rg ? rangePos(rg, price) : null, wk: pts ? weeksUp(pts, today) : null };
  };
  for (const c of cards) {
    if (!c.group) continue;
    const g = GROUPS.find((x) => x.key === c.group);
    if (c.group === "wotc-holo" && /1st Edition/.test(c.printing)) {
      // The main row is the 1st Edition price; the WOTC holo peer set uses the unlimited printing.
      const un = c.printings.find((p) => /^(Unlimited Holofoil|Holofoil)$/.test(p.name) && p.price > 0 && p.asOf);
      if (un) rated.push({ ...ctx(c, g, un.price, un.asOf, null), printingName: un.name });
    } else rated.push({ ...ctx(c, g, c.price, c.date, c.pts), printingName: c.printing });
  }
  // 1st Edition printings of WOTC holos, priced as their own printing on the same date.
  // History is used only when the row's main printing is the 1st Edition one.
  for (const c of cards) {
    if (c.release >= WOTC_END || c.rarity !== "Holo Rare") continue;
    const fe = c.printings.find((p) => p.name === "1st Edition Holofoil" && p.price > 0 && p.asOf);
    if (fe) rated.push({ ...ctx(c, FIRST_ED, fe.price, fe.asOf, /1st Edition/.test(c.printing) ? c.pts : null), firstEd: true, printingName: fe.name });
  }
  // Peer medians: same group, same popularity band, with a fallback to the group.
  const groupKey = (x) => x.g.key;
  const pools = new Map();
  for (const x of rated) for (const k of [groupKey(x) + "|" + x.band, groupKey(x)]) { if (!pools.has(k)) pools.set(k, []); pools.get(k).push(x); }
  const t90Pool = new Map();
  for (const x of rated) if (x.t90) { if (!t90Pool.has(groupKey(x))) t90Pool.set(groupKey(x), []); t90Pool.get(groupKey(x)).push(x.t90.pct); }
  const relPool = new Map();
  for (const x of rated) { if (!relPool.has(groupKey(x))) relPool.set(groupKey(x), []); relPool.get(groupKey(x)).push(-Date.parse(x.c.release)); }
  const out = [];
  for (const x of rated) {
    const { c, g } = x;
    let peers = pools.get(g.key + "|" + x.band) || [];
    let peerBasis = "similar popularity";
    if (peers.length - 1 < MIN_PEERS) { peers = pools.get(g.key) || []; peerBasis = "all popularity levels"; }
    const others = peers.filter((p) => p !== x);
    const med = others.length >= MIN_PEERS ? median(others.map((p) => p.price)) : null;
    const ratio = med ? x.price / med : null;
    // Also held: a WOTC 1st Edition price on file below its own unlimited price.
    const fe1 = c.printings.find((p) => p.name === "1st Edition Holofoil")?.price;
    const un1 = c.printings.find((p) => /^(Unlimited Holofoil|Unlimited)$/.test(p.name))?.price;
    const printOdd = c.release < WOTC_END && fe1 > 0 && un1 > 0 && fe1 < un1;
    const check = printOdd || (ratio != null && (ratio < 1 / CHECK || ratio > CHECK));
    const f = {};
    const pv = peerValue(x.price, med);
    if (pv != null && !check) f.peer = { v: pv, fact: `${money(x.price)} (${dl(x.date)}) vs a typical ${money(med)} for ${g.label} (${others.length} cards, ${peerBasis})` };
    f.popularity = { v: clamp(x.pop.weight / 5 * 0.7 + (searchMons.get(c.mon) ? 0.3 * Math.min(1, Math.log10(searchMons.get(c.mon)) / 2) : 0)), fact: `${x.pop.tags.length ? x.pop.tags.map((t) => POP_LABEL[t] || t).join(", ") : "Not on the popularity list"}; ${searchMons.get(c.mon) || 0} ${title(c.mon)} cards in our search` };
    const pf = pullFactor(c, pulls);
    if (pf) f.pull = { v: pf.v, fact: `${pf.k.rarity}: 1 in ${pf.k.oneIn} packs for any of the ${pf.k.cards} in the set, about 1 in ${pf.k.perCard.toLocaleString("en-US")} for this card if split evenly (${pf.k.source}${pf.k.asOf ? `, ${dl(pf.k.asOf)}` : ""})` };
    const sc = scarcity(c, byMon);
    if (sc) f.scarcity = { v: sc.v, fact: `${sc.total} ${title(c.mon)} cards in the catalogue, ${sc.same} in this group, ${sc.commons} commons or uncommons${sc.first ? `. The first ${g.one} of ${title(c.mon)} on file` : ""}` };
    const ar = artists.get(c.artist);
    if (ar) f.artist = { v: ar.v, fact: `Cards by ${c.artist} typically sell for ${ar.premium.toFixed(2)}x similar cards from the same set and rarity (${ar.n} cards)` };
    const age = days(c.release, today);
    if (PRINT_WINDOW.has(g.key)) {
      const status = (rot?.sets || []).find((s) => s.slug === c.setSlug)?.status || "";
      const rotated = /^Rotated/.test(status) || ["tg", "gg", "swsh-alt", "tagteam-alt", "tagteam", "gold"].includes(g.key) && c.release < "2023";
      const st = stageValue(age, rotated);
      f.age = { v: st.v, fact: `${age} days since release (${dl(c.release)})${rotated ? ", set rotated" : ""}` };
    } else {
      const rk = pctRank(relPool.get(g.key) || [], -Date.parse(c.release));
      if (rk != null) f.age = { v: rk, fact: `Released ${dl(c.release)}, ${Math.floor(age / 365)} years ago` };
    }
    const tr = x.t90 ? pctRank(t90Pool.get(g.key) || [], x.t90.pct) : null;
    if (tr != null || x.wk) {
      const hits = readHits.get(c.id) || 0;
      const v = (tr ?? 0.5) * 0.5 + (x.wk ? x.wk.up / x.wk.of : 0.5) * 0.3 + Math.min(hits, 2) / 2 * 0.2;
      f.demand = { v: clamp(v), fact: [x.t90 ? `90 days ${pctTxt(x.t90.pct)} (${dl(x.t90.from.date)} to ${dl(x.t90.to.date)})` : "", x.wk ? `Up in ${x.wk.up} of the last ${x.wk.of} weeks` : "", hits ? `in ${hits} streak or climb read tonight` : ""].filter(Boolean).join(", ") };
    }
    if (x.pos != null) f.range = { v: (100 - x.pos) / 100, fact: `Low ${money(x.rg.low.price)} (${dl(x.rg.low.date)}), high ${money(x.rg.high.price)} (${dl(x.rg.high.date)}), on file since ${dl(x.rg.since)}` };
    let w = 0, s = 0;
    for (const k of Object.keys(f)) { w += RATING_WEIGHTS[k]; s += RATING_WEIGHTS[k] * f[k].v; }
    const score = w ? Math.round((s / w) * 100) : null;
    out.push({
      id: c.id, name: c.name, num: c.num, set: c.set, setSlug: c.setSlug, group: g.key, groupLabel: g.label, groupOne: g.one,
      printing: x.printingName || "", firstEd: !!x.firstEd, price: { price: x.price, date: x.date, source: "TCGplayer market" },
      peers: med ? { median: Math.round(med * 100) / 100, n: others.length, basis: peerBasis, ratio: Math.round(ratio * 100) / 100 } : null,
      verdict: check ? null : verdictOf(ratio), check: check || undefined, score: check ? null : score, coverage: w,
      factors: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { v: Math.round(v.v * 100) / 100, fact: v.fact }])),
    });
  }
  return out;
}

// 64 shards by the numeric part of the id. The site loads one shard per card page.
export function shardOf(id) { const n = Number(String(id || "").replace(/\D/g, "")) || 0; return String(n % 64).padStart(2, "0"); }

export function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const BANNED = /\b(buy|buys|buying|sell|sells|selling|hold|holds|holding|bottom|bottomed|support|resistance|target|invest\w*|stack\w*|load up|best time|underpriced|overpriced)\b|[\u2014\u2013]/i;
export function cleanCopy(text) { return !BANNED.test(String(text || "")); }

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const md = (d) => `${MON[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
// Read names: drop the TCGplayer number and variant suffixes; the variant chip covers them.
export const bare = (n) => String(n || "").replace(/\s+-\s+[A-Z]*\d+[a-z]?\/[A-Z]*\d+\s*$/, "").replace(/(\s*\((\d+[a-z]?|[A-Z]{1,3}\d+|Alternate[^)]*|Full Art|Secret|Delta Species)\))+\s*$/i, "").trim();
const shortSet = (s) => String(s || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();

// Feed reads per group: the card furthest below its peers, and the one furthest above.
export function ratingReads(list, { asOf, max = 3 } = {}) {
  const out = [];
  const byGroup = new Map();
  for (const r of list) if (r.peers && !r.check && r.verdict && r.peers.n >= MIN_PEERS && r.price.date >= addDaysIso(asOf, -3)) { if (!byGroup.has(r.group)) byGroup.set(r.group, []); byGroup.get(r.group).push(r); }
  for (const [g, rs] of byGroup) {
    for (const side of ["below", "above"]) {
      const pick = rs.filter((r) => (side === "below" ? r.peers.ratio <= BELOW : r.peers.ratio >= ABOVE)).sort((a, b) => (side === "below" ? a.peers.ratio - b.peers.ratio : b.peers.ratio - a.peers.ratio) || (b.score - a.score));
      if (!pick.length) continue;
      const top = pick[0];
      const label = top.groupLabel;
      const pv = top.firstEd ? " 1st Edition" : "";
      const head = `Priced ${side} similar ${label}: ${bare(top.name)}${pv} (${shortSet(top.set)} ${top.num || ""}), ${money(top.price.price)} (${md(top.price.date)}) on TCGplayer market. Typical price for similar cards: ${money(top.peers.median)} (${top.peers.n} cards).`.replace(/\s+\)/, ")");
      const lines = [
        ...pick.slice(0, max).map((r) => `${bare(r.name)}${r.firstEd ? " 1st Edition" : ""} (${shortSet(r.set)}): ${money(r.price.price)} (${md(r.price.date)}), ${r.peers.ratio}x the typical ${money(r.peers.median)}.`),
        `Similar cards: other ${label} with similar popularity where there are ${MIN_PEERS} or more, otherwise all ${label}. Typical price is the middle price. TCGplayer market on ${md(asOf)}.`,
        "A factual comparison of prices on file, not advice.",
      ];
      if (!cleanCopy(head) || lines.some((l) => !cleanCopy(l)) || lines.length < 3) continue;
      out.push({
        id: `deep-rating-${g}-${side}`, readKind: "deep", kind: "deep", deep: "rating", board: "v3", family: "deep", name: `Rating: ${label}`,
        sku: top.id, href: `/c/${top.id}`, headline: head, path: head, lines: lines.slice(0, 6), asOf, source: `TCGplayer market, buckets and hist-long, ${asOf}; Card Rating peers`,
        tags: [], receipt: { group: g, side, cards: pick.slice(0, max).map((r) => ({ id: r.id, price: r.price, peers: r.peers })) },
      });
    }
  }
  return out;
}
function addDaysIso(d, n) { return new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10); }
