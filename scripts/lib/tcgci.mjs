// Pure helpers for the TCG Card Investor public ledger.
// Source: https://tcgcardinvestor.com/track-record/calls.json (public download link
// on their track-record page). robots.txt Allows / and only Disallows /api/ and /go/.
// No terms page forbids automated reading of the public site. We never republish
// their text; storage is private under data/private/tcgci/.

export const TCGCI_CALLS_URL = "https://tcgcardinvestor.com/track-record/calls.json";
export const TCGCI_USER_AGENT = "CatchEmBot/1.0 (+https://catchemtcg.com; research; polite daily ledger fetch)";
export const THEIR_FLAT_BAND_PCT = 5;

// Display names on their ledger → our youtube channel keys (config/youtube-channels.json).
export const CHANNEL_MAP = {
  "nostalgia nomics": "nomics",
  "the poke plumber": "pokeplumber",
  "thepokepplumber": "pokeplumber",
  "anontcg": "pokeanon",
  "danny phantump": "dannyphantump",
  "alpha investments": "alphainvestments",
  "christy holds": "christyholds",
  "christyholds": "christyholds",
  "ketchum all collectibles": "ketchumallcollectibles",
  "ketchumallcollectibles": "ketchumallcollectibles",
  "top 10 pokemon": "top10pokemon",
  "phillips collectibles": "phillipscollectibles",
  "steelcitystacks": "steelcitystacks",
  "steel city stacks": "steelcitystacks",
  "pokemartusa": "pokemartusa",
  "poke profit (tcg quant)": "tcgquant",
  "tcg quant": "tcgquant",
  "jayketchumtcg": "jayketchumtcg",
  "pokémon traitor": "pokemontraitor",
  "pokemon traitor": "pokemontraitor",
};

export function mapChannel(name) {
  if (!name) return null;
  const k = String(name).trim().toLowerCase();
  return CHANNEL_MAP[k] || null;
}

export function directionOf(rating) {
  const r = String(rating || "").toLowerCase();
  if (r === "buy") return 1;
  if (r === "sell" || r === "avoid") return -1;
  if (r === "hold") return 0;
  return null;
}

// Their published rule: >5% the claimed way = right, >5% the other way = wrong,
// else flat. Hold is right unless it fell more than 5%.
export function theirVerdict(call, bandPct = THEIR_FLAT_BAND_PCT) {
  const p = call?.price || {};
  const at = p.at_call, a30 = p.at_30d;
  // No pinned TCGplayer product → unscored (their page leaves these out of the 30-day table).
  if (p.product_id == null || !(at > 0)) return "unscored";
  // Product pinned but +30d not in yet → pending.
  if (a30 == null || !(a30 >= 0)) return "pending";
  const movePct = ((a30 - at) / at) * 100;
  const rating = String(call.rating || "").toLowerCase();
  if (rating === "hold") return movePct < -bandPct ? "wrong" : "right";
  if (Math.abs(movePct) <= bandPct) return "flat";
  if (rating === "buy") return movePct > bandPct ? "right" : "wrong";
  if (rating === "sell" || rating === "avoid") return movePct < -bandPct ? "right" : "wrong";
  return "unscored";
}

export function normalizeCall(raw) {
  const p = raw?.price || {};
  const dir = directionOf(raw.rating);
  return {
    id: raw.id,
    week: raw.week || null,
    issued: raw.issued || null,
    channel: raw.channel || null,
    channelKey: mapChannel(raw.channel),
    videoId: raw.video_id || null,
    ts: raw.ts || null,
    url: raw.url || null,
    rating: String(raw.rating || "").toLowerCase() || null,
    dir,
    item: raw.item || null,
    kind: raw.kind || null,
    targetPrice: raw.target_price ?? null,
    horizon: raw.horizon || null,
    productId: p.product_id ?? null,
    product: p.product || null,
    set: p.set || null,
    priceConfidence: p.confidence ?? null,
    atCall: p.at_call ?? null,
    at30d: p.at_30d ?? null,
    now: p.now ?? null,
    nowDate: p.now_date || null,
    pricedAt: p.priced_at || null,
    // Only the fields we need (plus ids for matching). Never store their claim prose.
    theirVerdict: theirVerdict(raw),
  };
}

export function parseLedger(doc) {
  const calls = Array.isArray(doc?.calls) ? doc.calls.map(normalizeCall) : [];
  return {
    updated: doc?.updated || null,
    scoring: {
      evalDays: doc?.scoring?.eval_days ?? 30,
      flatBandPct: doc?.scoring?.flat_band_pct ?? THEIR_FLAT_BAND_PCT,
    },
    calls,
    counts: {
      total: calls.length,
      byRating: tally(calls.map((c) => c.rating)),
      byVerdict: tally(calls.map((c) => c.theirVerdict)),
      withChannelKey: calls.filter((c) => c.channelKey).length,
      withProductId: calls.filter((c) => c.productId != null).length,
    },
  };
}

function tally(xs) {
  const o = {};
  for (const x of xs) o[x || "unknown"] = (o[x || "unknown"] || 0) + 1;
  return o;
}

function ourResult30(claim) {
  const h = claim?.h30;
  if (!h || h.held == null) return null;
  if (h.result === "flat") return "flat";
  if (h.result === "hit" || h.held === true) return "right";
  if (h.result === "miss" || h.held === false) return "wrong";
  return null;
}

function matchKey(videoId, productId, item) {
  if (videoId && productId != null) return `v:${videoId}|p:${productId}`;
  if (videoId && item) return `v:${videoId}|i:${String(item).toLowerCase().replace(/\s+/g, " ").trim()}`;
  return null;
}

// Cross-check their 30-day verdict against our own scored YouTube claims for the
// same video + product. Agreement is private method research only.
export function crossCheck(tcgciCalls, ourClaims) {
  const byKey = new Map();
  for (const c of ourClaims || []) {
    const vid = c.videoId || c.video_id;
    const pid = c.pid ?? c.productId;
    const item = c.item || c.name || null;
    const k = matchKey(vid, pid, item);
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev || (c.h30 && !prev.h30)) byKey.set(k, c);
  }
  const rows = [];
  for (const t of tcgciCalls || []) {
    if (t.theirVerdict === "pending" || t.theirVerdict === "unscored") continue;
    const k = matchKey(t.videoId, t.productId, t.item);
    if (!k) continue;
    const ours = byKey.get(k);
    if (!ours) continue;
    const our = ourResult30(ours);
    if (!our) continue;
    rows.push({
      id: t.id,
      videoId: t.videoId,
      productId: t.productId,
      channelKey: t.channelKey || mapChannel(t.channel),
      issued: t.issued,
      rating: t.rating,
      theirVerdict: t.theirVerdict,
      ourVerdict: our,
      agree: t.theirVerdict === our,
      ourChg: ours.h30?.chg ?? null,
      ourExcess: ours.h30?.excess ?? null,
    });
  }
  const agree = rows.filter((r) => r.agree).length;
  return {
    matched: rows.length,
    agree,
    disagree: rows.length - agree,
    agreePct: rows.length ? Math.round((100 * agree) / rows.length) : null,
    byChannel: summarizeBy(rows, "channelKey"),
    rows,
  };
}

function summarizeBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key] || "unknown";
    const cur = m.get(k) || { key: k, n: 0, agree: 0 };
    cur.n += 1;
    if (r.agree) cur.agree += 1;
    m.set(k, cur);
  }
  return [...m.values()]
    .map((x) => ({ ...x, agreePct: x.n ? Math.round((100 * x.agree) / x.n) : null }))
    .sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));
}


// Cheap robots.txt parse for User-agent: *. Returns whether path is allowed.
// Only cares about Allow/Disallow under * (and unnamed default). No crawling of
// other agents' blocks. Missing/unreadable robots → allow=false (stay out).
export function parseRobots(text) {
  const lines = String(text || "").split(/\r?\n/);
  let inStar = false, seenStar = false;
  const rules = [];
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = /^(user-agent|allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      inStar = val === "*";
      if (inStar) seenStar = true;
      continue;
    }
    if (!inStar) continue;
    if (key === "allow" || key === "disallow") rules.push({ type: key, path: val || "/" });
  }
  return { seenStar, rules };
}

export function robotsAllows(robotsText, path) {
  const { seenStar, rules } = parseRobots(robotsText);
  if (!seenStar && !rules.length) return { allowed: false, reason: "no User-agent: * rules" };
  // Longest matching rule wins (robots convention).
  let best = null;
  for (const r of rules) {
    if (!r.path) continue;
    if (path === r.path || path.startsWith(r.path)) {
      if (!best || r.path.length >= best.path.length) best = r;
    }
  }
  if (!best) return { allowed: true, reason: "no matching disallow" };
  if (best.type === "disallow") return { allowed: false, reason: `Disallow: ${best.path}` };
  return { allowed: true, reason: `Allow: ${best.path}` };
}

export function publicSafeStatus({ asOf, fetchedAt, status, counts, cross, errors = [] }) {
  // Counts and dates only. No creator names, no item text, no claim text.
  return {
    asOf,
    fetchedAt,
    status,
    source: "tcgcardinvestor.com/track-record/calls.json",
    note: "Counts only. Their call text and creator names stay private under data/private/tcgci/.",
    calls: counts?.total ?? 0,
    scored: (counts?.byVerdict?.right || 0) + (counts?.byVerdict?.wrong || 0) + (counts?.byVerdict?.flat || 0),
    pending: counts?.byVerdict?.pending || 0,
    unscored: counts?.byVerdict?.unscored || 0,
    crossMatched: cross?.matched ?? 0,
    crossAgreePct: cross?.agreePct ?? null,
    errors: errors.map((e) => String(e).slice(0, 200)),
  };
}
