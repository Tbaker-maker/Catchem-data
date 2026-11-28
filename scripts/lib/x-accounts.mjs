// X (Twitter) accounts: price-call scoring and restock events. Pure functions, no network.
// Price calls reuse the YouTube claim rules (lib/youtube.mjs): 7/30/90 days, 3% band that
// must beat the market, unscored below 0.5 confidence, unrated until 20 scored calls.
import { extractClaims, extractMentions, scoreClaims, rankClaims, claimStatus } from "./youtube.mjs";

export const MIN_RATED = 20;
export const GOOD_HIT_PCT = 55;
export const CATEGORIES = ["creator", "news", "data", "app", "ai", "restock"];
const SPAM = /\b(giveaway|airdrop|solana:|pump\b|presale|whitelist|dm me to (?:buy|sell)|ca:)\b/i;

// One raw post -> dated claims tied to catalogue ids (never by name alone).
export function postClaims(post, handle, idx) {
  const date = String(post.created_at || "").slice(0, 10);
  if (!date) return [];
  return extractClaims({ videoId: `x${post.id}`, channel: handle, date, text: String(post.text || "") }, idx).map((c) => ({ ...c, source: "x", postId: String(post.id), url: `https://x.com/${handle}/status/${post.id}` }));
}

export function scoreXClaims(claims, book, idx, today) {
  scoreClaims(claims, { priceOn: book.priceOn, marketChange: book.marketChange, pidsBySet: idx.pidsBySet, today });
  for (const c of claims) { const st = claimStatus(c); c.status = st.status; c.evidence = st.evidence; }
  return claims;
}

export const spamShare = (posts) => (posts.length ? posts.filter((p) => SPAM.test(p.text || "")).length / posts.length : 0);

// Status: rejected (spam or giveaway), tracked (>=20 scored calls and hit rate >= GOOD_HIT_PCT),
// trial (scorable creator with fewer calls, or below the bar), source (news/data/app/ai/restock).
export function rateAccounts(accounts, claims, postsByHandle = {}) {
  const ranking = rankClaims(claims);
  const row = (h) => ranking.find((r) => r.by === "channel" && r.key === h) || null;
  const types = (h) => ranking.filter((r) => r.by === "channel_type" && r.key.startsWith(`${h}|`)).map((r) => ({ type: r.key.split("|")[1], claims: r.claims, scored30: r.scored30, heldPct30: r.heldPct30 }));
  return accounts.map((a) => {
    const r = row(a.handle);
    const scored = r ? Math.max(r.scored7 || 0, r.scored30 || 0, r.scored90 || 0) : 0;
    const hit = r ? (r.heldPct30 ?? r.heldPct7 ?? r.heldPct90 ?? null) : null;
    const spam = spamShare(postsByHandle[a.handle] || []);
    let status, reason;
    if (spam >= 0.3) { status = "rejected"; reason = `spam or giveaway in ${Math.round(spam * 100)}% of sampled posts`; }
    else if (a.category !== "creator") { status = "source"; reason = `${a.category} account: tracked as a source, not scored`; }
    else if (scored >= MIN_RATED && hit != null && hit >= GOOD_HIT_PCT) { status = "tracked"; reason = `${scored} scored calls, ${hit}% hit`; }
    else if (scored >= MIN_RATED) { status = "rejected"; reason = `${scored} scored calls, ${hit}% hit is under ${GOOD_HIT_PCT}%`; }
    else { status = "trial"; reason = `${scored} scored calls (unrated until ${MIN_RATED})`; }
    return { ...a, calls: claims.filter((c) => c.channel === a.handle).length, scored, hitRate: scored >= MIN_RATED ? hit : null, topics: types(a.handle), status, reason };
  });
}

// ---------- restocks ----------
export const RETAILERS = [
  ["pokemon_center", /\bpok[eé]mon ?center\b|\bpkc\b|pokemoncenter\.com/i],
  ["target", /\btarget\b|🎯/i],
  ["walmart", /\bwalmart\b/i],
  ["best_buy", /\bbest ?buy\b/i],
  ["gamestop", /\bgamestop\b/i],
  ["costco", /\bcostco\b/i],
  ["sams_club", /\bsam'?s club\b/i],
  ["amazon", /\bamazon\b/i],
  ["argos", /\bargos\b/i],
  ["smyths", /\bsmyths\b/i],
  ["game_uk", /\bgame\.co\.uk\b/i],
  ["eb_games", /\beb ?games\b/i],
];
const LIVE = /\b(live|restock(?:ed)?|in stock|back in stock|available now|dropping now|dropped|is up|now available|loaded)\b/i;
const SOLD_OUT = /\b(sold out|gone|out of stock)\b/i;
const NOT_EVENT = /\b(preorders? (?:soon|expected)|expected at|queue at|no (?:set )?date|tonight'?s drop is expected|watchlist|might|potential|rumou?r)\b/i;
const normProduct = (t) => String(t || "").toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/#\w+/g, "").split(/\b(?:live|restock|in stock|back in stock|available|dropping|dropped|is up|sold out|gone|out of stock|at)\b/)[0].replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
export const ALERT_GAP_WINDOW_MIN = 7 * 24 * 60;
export const ALERT_GAP_NOTE = "Gap between X alerts we have read, not a shelf clock.";

function verifiedSealed(m) {
  if (!m || !Array.isArray(m.sealed) || m.sealed.length !== 1) return null;
  const id = m.sealed[0];
  const reason = m.reasons && m.reasons[`sealed:${id}`];
  if (reason === "product_link" || reason === "set_sealed_kind") return id;
  return null;
}

export function parseRestock(post, handle, idx, region = "US") {
  const text = String(post.text || "");
  if (NOT_EVENT.test(text)) return null;
  const sold = SOLD_OUT.test(text);
  if (!sold && !LIVE.test(text)) return null;
  const hit = RETAILERS.find(([, re]) => re.test(text));
  if (!hit) return null;
  const m = idx ? extractMentions(text, idx) : { sealed: [] };
  const reg = /\b(uk|united kingdom)\b|🇬🇧/i.test(text) ? "UK" : /\b(canada|\.ca\b)\b|🇨🇦/i.test(text) ? "CA" : region;
  return { timestamp: post.created_at, retailer: hit[0], product: verifiedSealed(m), productText: normProduct(text), region: reg, handle, postId: String(post.id), kind: sold ? "sold_out" : "in_stock" };
}

// Same retailer + same product (id, else normalized text) + region inside 3 hours = one restock.
export function dedupeRestocks(rows, windowMin = 180) {
  const sorted = [...rows].filter(Boolean).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const events = [];
  for (const r of sorted) {
    const key = `${r.retailer}|${r.region}|${r.kind || "in_stock"}|${r.product ?? (r.productText.length >= 8 ? r.productText : `post:${r.postId}`)}`;
    const t = Date.parse(r.timestamp);
    const e = events.find((x) => x.key === key && t - Date.parse(x.timestamp) <= windowMin * 60000);
    if (e) { if (!e.seenBy.some((s) => s.postId === r.postId)) e.seenBy.push({ handle: r.handle, postId: r.postId, timestamp: r.timestamp }); continue; }
    events.push({ key, timestamp: r.timestamp, retailer: r.retailer, product: r.product, productText: r.productText, region: r.region, handle: r.handle, postId: r.postId, kind: r.kind || "in_stock", seenBy: [{ handle: r.handle, postId: r.postId, timestamp: r.timestamp }] });
  }
  return events;
}

const ptParts = (iso) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { dow: p.weekday, hour: Number(p.hour) % 24 };
};
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const med = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function marketOn(priceOn, product, day) {
  if (typeof priceOn !== "function" || product == null) return null;
  const keys = [product, String(product)];
  const n = Number(product);
  if (Number.isFinite(n)) keys.push(n);
  const s = String(product);
  if (!s.startsWith("tcgcsv-")) keys.push(`tcgcsv-${s}`);
  const seen = new Set();
  for (const k of keys) {
    const mark = typeof k === "string" ? `s:${k}` : `n:${k}`;
    if (seen.has(mark)) continue;
    seen.add(mark);
    const v = priceOn(k, day);
    if (v > 0) return v;
  }
  return null;
}

export function pairAlertGaps(events, windowMin = ALERT_GAP_WINDOW_MIN) {
  const sorted = [...events].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const out = sorted.map((e) => ({ ...e }));
  for (const e of out) {
    if (e.kind !== "sold_out") continue;
    const productKey = e.product ?? e.productText;
    let prior = null;
    for (const p of out) {
      if ((p.kind || "in_stock") === "sold_out") continue;
      if (p.retailer !== e.retailer || p.region !== e.region) continue;
      if ((p.product ?? p.productText) !== productKey) continue;
      const gap = (Date.parse(e.timestamp) - Date.parse(p.timestamp)) / 60000;
      if (!(gap >= 0 && gap <= windowMin)) continue;
      if (!prior || Date.parse(p.timestamp) > Date.parse(prior.timestamp)) prior = p;
    }
    if (!prior) continue;
    e.alertGapMinutes = Math.round((Date.parse(e.timestamp) - Date.parse(prior.timestamp)) / 60000);
    e.alertGapNote = ALERT_GAP_NOTE;
  }
  return out;
}

export function publicRestockLine(event, gateOn = false) {
  if (gateOn !== true || !event) return null;
  const n = Number(event.postsRead);
  if (!(n > 0)) return null;
  return `Among the ${n} X posts we have read, a post named this product.`;
}

export function restockStudy(events, priceOn = null) {
  const count = (f) => { const o = {}; for (const e of events) { const k = f(e); o[k] = (o[k] || 0) + 1; } return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };
  const byDow = count((e) => ptParts(e.timestamp).dow), byHour = count((e) => ptParts(e.timestamp).hour);
  const gaps = {};
  const groups = new Map();
  for (const e of events) { const k = `${e.retailer}|${e.product ?? (e.productText.length >= 8 ? e.productText : `post:${e.postId}`)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(Date.parse(e.timestamp)); }
  for (const [k, ts] of groups) if (ts.length > 1) { ts.sort((a, b) => a - b); gaps[k] = { n: ts.length, medianGapDays: Math.round((med(ts.slice(1).map((t, i) => (t - ts[i]) / 86400000)) * 10)) / 10 }; }
  const moves = [];
  if (priceOn) for (const e of events) {
    if (!e.product) continue;
    const d = e.timestamp.slice(0, 10);
    const a = marketOn(priceOn, e.product, addDays(d, -1)) ?? marketOn(priceOn, e.product, d);
    const b = marketOn(priceOn, e.product, addDays(d, 7));
    if (a > 0 && b > 0) moves.push({ product: e.product, date: d, retailer: e.retailer, chg7: Math.round((b / a - 1) * 10000) / 10000, source: "TCGplayer market" });
  }
  const paired = pairAlertGaps(events);
  const alertGaps = paired.filter((e) => e.alertGapMinutes != null).map((e) => ({ product: e.product, retailer: e.retailer, region: e.region, alertGapMinutes: e.alertGapMinutes, alertGapNote: e.alertGapNote }));
  return { events: events.length, first: events[0]?.timestamp || null, last: events.at(-1)?.timestamp || null, byRetailer: count((e) => e.retailer), byRegion: count((e) => e.region), byProduct: Object.fromEntries(Object.entries(count((e) => e.product ? `id:${e.product}` : e.productText)).slice(0, 40)), byDowPT: byDow, byHourPT: byHour, gaps, alertGaps, priceAfter: { n: moves.length, median7: med(moves.map((m) => m.chg7)), rows: moves } };
}

// Restock account ranking: accuracy (event confirmed by another account, or by a later
// sealed price move), speed (minutes ahead of the next account on shared events),
// false alarms (single-source events never confirmed), coverage (share of all events seen).
export function rateRestockAccounts(events, handles, postsByHandle = {}) {
  const total = events.length || 1;
  return handles.map((h) => {
    const mine = events.filter((e) => e.seenBy.some((s) => s.handle === h));
    const shared = mine.filter((e) => new Set(e.seenBy.map((s) => s.handle)).size > 1);
    const leads = [];
    for (const e of shared) {
      const own = Date.parse(e.seenBy.find((s) => s.handle === h).timestamp);
      const others = e.seenBy.filter((s) => s.handle !== h).map((s) => Date.parse(s.timestamp));
      leads.push(Math.round((Math.min(...others) - own) / 60000));
    }
    const solo = mine.length - shared.length;
    return { handle: h, events: mine.length, confirmed: shared.length, accuracyPct: mine.length ? Math.round((100 * shared.length) / mine.length) : null, medianLeadMin: med(leads), firstOnShared: leads.filter((x) => x > 0).length, unconfirmed: solo, coveragePct: Math.round((1000 * mine.length) / total) / 10, spamShare: Math.round(spamShare(postsByHandle[h] || []) * 100) / 100, note: "Accuracy = confirmed by a second account inside 3h. Unconfirmed is a false-alarm upper bound (our sample is partial)." };
  }).sort((a, b) => (b.coveragePct - a.coveragePct) || ((b.accuracyPct ?? 0) - (a.accuracyPct ?? 0)));
}
