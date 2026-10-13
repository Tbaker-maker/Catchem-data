// YouTube learning loop. Pure functions. The runner (scripts/youtube-learn.mjs)
// calls the official YouTube Data API v3 and writes catchem-data-private.
// No AI, no scraping, no captions. Cards match by catalogue id, never by name alone.
import { addDays, HORIZONS, MIN_SCORED, scoreLedger, priceAtHorizon } from "./self-check.mjs";
import { buildCardIndex, matchCards } from "./card-matcher.mjs";

export const UNIT_COST = { channels: 1, playlistItems: 1, videos: 1, commentThreads: 1 };

export const TOPICS = {
  pack_destruction: /\b(pack destruction|packs? (?:being )?(?:opened|ripped)|rip(?:ped|ping)? (?:every|all|cases?)|opened supply|destroy(?:ed|ing) (?:packs|supply))\b/i,
  print_run: /\b(print runs?|printing more|reprints?|reprinted|out of print|print wave|second wave|restock(?:s|ed)?|allocation)\b/i,
  pull_rates: /\b(pull rates?|odds of pulling|per box|hit rates?|god packs?)\b/i,
  rotation: /\b(rotation|rotat(?:e|es|ing|ed)|standard legal|regulation mark)\b/i,
  grading: /\b(psa ?10|psa|cgc|bgs|beckett|grading|graded|pop report|gem rate|slabs?)\b/i,
  price_move: /\b(went up|going up|spik(?:e|ed|ing)|jump(?:ed)?|climb(?:ed|ing)|crash(?:ed|ing)?|tank(?:ed|ing)|dropp(?:ed|ing)|dip(?:ped)?|doubled|tripled|all[- ]time high)\b/i,
  new_product: /\b(new set|reveal(?:ed)?|announc(?:e|ed|ement)|pre-?orders?|upcoming|release date|leak(?:ed)?)\b/i,
};

// Direction words a creator uses about where a price goes next. Sentence level.
const UP = /\b(will (?:go up|rise|climb|explode|moon)|going (?:to go )?up|undervalued|under ?priced|about to (?:pop|run|climb)|will be worth more|sleeper|long[- ]term winner)\b/i;
const DOWN = /\b(will (?:go down|drop|fall|crash|tank)|going (?:to go )?down|overvalued|over ?priced|about to (?:drop|fall)|bubble|will be worth less)\b/i;

const POS = ["love", "great", "amazing", "beautiful", "awesome", "best", "good", "fire", "hyped", "excited", "underrated", "gorgeous", "nice", "thanks", "helpful"];
const NEG = ["hate", "bad", "worst", "overpriced", "scam", "terrible", "boring", "trash", "greedy", "disappointing", "expensive", "awful", "dead", "crash"];
const POS_RE = new RegExp(`\\b(${POS.join("|")})\\b`, "gi"), NEG_RE = new RegExp(`\\b(${NEG.join("|")})\\b`, "gi");

const norm = (s) => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9/& ]+/g, " ").replace(/\s+/g, " ").trim();
const baseName = (name) => norm(String(name || "").replace(/\s+-\s+[^-]*$/, "").replace(/\s*\([^)]*\)\s*/g, " "));
const numKey = (n) => { const m = /^0*([0-9]+[a-z]?)\/0*([0-9a-z]+)$/i.exec(String(n || "").trim()); return m ? `${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null; };
const SEALED_KIND = [["booster box", /\bbooster box\b/], ["elite trainer box", /\b(elite trainer box|etb)\b/], ["booster bundle", /\bbooster bundle\b/], ["ultra premium collection", /\b(ultra premium collection|upc)\b/]];
const GENERIC_SET = /^(promos?|.*promos|alternate art promos|miscellaneous cards.*|.*trainer kit.*|mcdonalds.*)$/i;

// Index of the catalogue for id matching.
export function buildCatalogueIndex(items = []) {
  const byNum = new Map(), byPid = new Map(), sets = new Map(), sealedBySet = new Map(), pidsBySet = new Map();
  for (const it of items) {
    const pid = Number(it.tcgplayerProductId);
    if (!pid) continue;
    byPid.set(pid, it);
    if (it.groupId) {
      if (!pidsBySet.has(it.groupId)) pidsBySet.set(it.groupId, []);
      if (it.kind === "single") pidsBySet.get(it.groupId).push(pid);
      const sn = norm(String(it.set || "").replace(/^[A-Z0-9]{2,5}\d*[a-z]?:\s*/, ""));
      if (sn.length >= 6 && !GENERIC_SET.test(it.set || "") && !sets.has(it.groupId)) sets.set(it.groupId, { groupId: it.groupId, set: it.set, key: sn });
    }
    if (it.kind === "single") {
      const k = numKey(it.number);
      if (k) { if (!byNum.has(k)) byNum.set(k, []); byNum.get(k).push({ pid, base: baseName(it.name), groupId: it.groupId }); }
    } else if (it.kind === "sealed" && it.groupId) {
      if (!sealedBySet.has(it.groupId)) sealedBySet.set(it.groupId, []);
      sealedBySet.get(it.groupId).push({ pid, name: norm(it.name) });
    }
  }
  // Longest set names first so "Prismatic Evolutions" wins over "Evolutions".
  const setList = [...sets.values()].sort((a, b) => b.key.length - a.key.length);
  return { byNum, byPid, setList, sealedBySet, pidsBySet, cardIndex: buildCardIndex(items) };
}

// Mentions in one text. A TCGplayer product link, a collector number plus the
// card's own name, or one confident card-matcher hit. Name alone never matches.
export function extractMentions(text, idx) {
  const raw = String(text || ""), t = ` ${norm(raw)} `;
  const cards = new Set(), sets = new Set(), sealed = new Set(), reasons = {}, ambiguous = [];
  const why = (k, r) => { if (!reasons[k]) reasons[k] = r; };
  for (const m of raw.matchAll(/tcgplayer\.com\/product\/(\d{3,8})/gi)) {
    const it = idx.byPid.get(Number(m[1]));
    if (it) { const sealedOne = it.kind === "sealed"; (sealedOne ? sealed : cards).add(Number(m[1])); why(`${sealedOne ? "sealed" : "card"}:${m[1]}`, "product_link"); }
  }
  let rest = t;
  for (const s of idx.setList) {
    const k = ` ${s.key} `;
    if (rest.includes(k)) { sets.add(s.groupId); why(`set:${s.groupId}`, "set_name"); rest = rest.split(k).join(" "); }
  }
  for (const m of raw.matchAll(/\b0*(\d{1,3}[a-z]?)\s*\/\s*0*(\d{2,3}|[a-z]{1,3}\d{0,3})\b/gi)) {
    const hits = (idx.byNum.get(`${m[1].toLowerCase()}/${m[2].toLowerCase()}`) || []).filter((c) => c.base.length >= 3 && t.includes(` ${c.base} `));
    const inSet = hits.filter((c) => sets.has(c.groupId));
    const pick = inSet.length === 1 ? inSet : hits.length === 1 ? hits : [];
    if (!pick.length && hits.length > 1) ambiguous.push(`${m[1]}/${m[2]}`);
    for (const c of pick) { cards.add(c.pid); why(`card:${c.pid}`, inSet.length === 1 ? "number_name_set" : "number_name"); }
  }
  for (const g of sets) {
    for (const [kind, re] of SEALED_KIND) {
      if (!re.test(t)) continue;
      const hit = (idx.sealedBySet.get(g) || []).filter((p) => p.name.includes(kind) && !/\b(case|display|bundle of|pokemon center)\b/.test(p.name));
      if (hit.length === 1) { sealed.add(hit[0].pid); why(`sealed:${hit[0].pid}`, "set_sealed_kind"); }
    }
  }
  if (idx.cardIndex) {
    for (const hit of matchCards(raw, idx.cardIndex).matches) {
      if (cards.has(hit.pid)) continue;
      cards.add(hit.pid);
      why(`card:${hit.pid}`, hit.reason);
    }
  }
  return { cards: [...cards].sort((a, b) => a - b), sets: [...sets].sort((a, b) => a - b), sealed: [...sealed].sort((a, b) => a - b), reasons, ambiguous };
}

export const topicTags = (text) => Object.entries(TOPICS).filter(([, re]) => re.test(String(text || ""))).map(([k]) => k);

// Word-list sentiment over comments, -1..1. An Eden seed, not a model.
export function commentSentiment(comments = []) {
  let pos = 0, neg = 0;
  for (const c of comments) { pos += (String(c).match(POS_RE) || []).length; neg += (String(c).match(NEG_RE) || []).length; }
  const n = pos + neg;
  return { comments: comments.length, pos, neg, score: n ? Math.round(((pos - neg) / n) * 100) / 100 : 0 };
}

// Extraction confidence by match reason (doc 1NqTC4UZ "How others score calls", upgrade 1).
export const CONFIDENCE = {
  product_link: 0.95,
  number_name_set_finish: 0.93,
  number_set: 0.92,
  number_name_finish: 0.9,
  number_name_set: 0.9,
  nickname: 0.9,
  number_name: 0.75,
  name_set_finish: 0.85,
  name_finish: 0.84,
  name_set: 0.82,
  set_sealed_kind: 0.7,
  set_name: 0.6,
};
export const MIN_CONFIDENCE = 0.5;
export const HYPE_TITLE_CONFIDENCE = 0.4;

// Stated horizon (upgrade 3). The claim is still scored at 7, 30 and 90 days; its status
// is read at the stated one. "long" = years: provisional until 90 days, never a 30-day fail.
const HORIZON_WORDS = [
  ["long", /\b(long[- ]term|years?|\d\s*-\s*\d+\s*years|decade|hold forever|retire\w*|generational|multi[- ]year)\b/i],
  [90, /\b(this year|next (?:few|couple) months|\d+\s*months|by (?:summer|spring|fall|winter|next year)|90 days|quarter)\b/i],
  [30, /\b(this month|next month|30 days|(?:next )?few weeks|by (?:christmas|the holidays|black friday)|mid[- ]term)\b/i],
  [7, /\b(this week|next week|next few days|short[- ]term|near[- ]term|right now|tomorrow|flip)\b/i],
];
export function statedHorizon(...texts) {
  for (const t of texts) for (const [h, re] of HORIZON_WORDS) if (re.test(String(t || ""))) return h;
  return null;
}

// Why a direction sentence produced no scorable claim (upgrade 5, private audit log).
function unmatchedReason(s, m) {
  if (m.ambiguous.length) return "ambiguous_reprint";
  if (/\b(psa|cgc|bgs|slabs?|graded|gem ?mint)\b/i.test(s)) return "slab";
  if (/\b(sealed|booster box(es)?|etbs?|packs?)\b/i.test(s)) return "sealed_generally";
  if (/\b(market|hobby|everything|prices)\b/i.test(s)) return "whole_market";
  return "no_match";
}

// Dated direction claims about one card id, sealed product id or set, sentence by
// sentence. Each carries a reason code and a confidence; below MIN_CONFIDENCE stays unscored.
export function extractClaims({ videoId, channel, date, text, title = "", hype = false, chapters = [], unmatched = null }, idx) {
  const out = [];
  const sentences = String(text || "").split(/(?<=[.!?])\s+|\n+/).filter((s) => s.length > 8);
  const videoHorizon = statedHorizon(title);
  for (const s of sentences) {
    const dir = UP.test(s) ? 1 : DOWN.test(s) ? -1 : 0;
    if (!dir) continue;
    const m = extractMentions(s, idx);
    const fromTitle = title && s.trim() === String(title).trim();
    const conf = (r) => Math.min(CONFIDENCE[r] ?? 0.5, fromTitle && hype ? HYPE_TITLE_CONFIDENCE : 1);
    const horizon = statedHorizon(s) ?? videoHorizon;
    // Receipt: the chapter this line is, or the chapter whose title names the same target.
    const chap = chapters.find((c) => s.includes(c.title)) || null;
    const receiptFor = (key) => { const c = chap || chapters.find((x) => (key.startsWith("set:") ? x.mentions?.sets?.includes(Number(key.slice(4))) : key.startsWith("card:") ? x.mentions?.cards?.includes(Number(key.slice(5))) : x.mentions?.sealed?.includes(Number(key.slice(7))))); return c ? { chapterT: c.t, chapterTitle: c.title, url: `https://youtu.be/${videoId}?t=${c.t}` } : null; };
    const base = { videoId, channel, date, dir, horizon, text: s.slice(0, 200), from: fromTitle ? "title" : "text" };
    for (const pid of m.cards) { const r = m.reasons[`card:${pid}`]; out.push({ id: `${videoId}:c${pid}:${dir}`, ...base, target: "card", pid, reason: r, confidence: conf(r), receipt: receiptFor(`card:${pid}`) }); }
    for (const pid of m.sealed) { const r = m.reasons[`sealed:${pid}`]; out.push({ id: `${videoId}:p${pid}:${dir}`, ...base, target: "sealed", pid, reason: r, confidence: conf(r), receipt: receiptFor(`sealed:${pid}`) }); }
    if (!m.cards.length && !m.sealed.length) for (const g of m.sets) out.push({ id: `${videoId}:s${g}:${dir}`, ...base, target: "set", groupId: g, reason: "set_name", confidence: conf("set_name"), receipt: receiptFor(`set:${g}`) });
    if (unmatched && !m.cards.length && !m.sealed.length && !m.sets.length) unmatched.push({ videoId, channel, date, dir, reason: unmatchedReason(s, m), text: s.slice(0, 200) });
  }
  const seen = new Set();
  return out.filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Score claims at 7, 30 and 90 days. Card claims run through the same scoreLedger
// as self-check (held = price on the claimed side; excess vs the market median).
// Set claims use the median change of the set's priced singles between the same days.
// Direction band (upgrade 2): a hit needs |change| >= BAND on the claimed side AND
// excess vs market with the claimed sign. Inside the band is flat. The absolute
// result stays as heldAbs.
export const BAND = 0.03;
export function bandResult(h, dir, band = BAND) {
  if (!h || h.chg == null) return null;
  if (Math.abs(h.chg) < band) return "flat";
  if (Math.sign(h.chg) !== dir) return "miss";
  if (h.excess == null) return null;
  return Math.sign(h.excess) === dir ? "hit" : "miss";
}
const applyBand = (c) => {
  for (const h of HORIZONS) {
    const x = c[`h${h}`];
    if (!x || x.result !== undefined) continue;
    x.heldAbs = x.held;
    x.result = bandResult(x, c.dir);
    x.held = x.result == null ? null : x.result === "hit";
  }
};

export function scoreClaims(claims, { priceOn, marketChange, pidsBySet, today }) {
  const cardRows = [];
  for (const c of claims) {
    if (c.confidence != null && c.confidence < MIN_CONFIDENCE) { c.unscored = "low_confidence"; continue; }
    if (c.target === "card" || c.target === "sealed") {
      if (!(c.price > 0)) { const p = priceOn(c.pid, c.date) ?? priceAtHorizon(priceOn, c.pid, c.date, 0)?.price; if (p > 0) c.price = p; }
      if (c.price > 0) cardRows.push(c); else c.unscored = "no_price";
      continue;
    }
    const pids = pidsBySet.get(c.groupId) || [];
    for (const h of HORIZONS) {
      if (c[`h${h}`] || addDays(c.date, h) > today) continue;
      for (let d = 0; d <= 3; d++) {
        const day = addDays(c.date, h + d);
        if (day > today) break;
        const ch = [];
        for (const pid of pids) { const a = priceOn(pid, c.date), b = priceOn(pid, day); if (a > 0 && b > 0) ch.push(b / a - 1); }
        if (ch.length < 5) continue;
        const chg = median(ch), base = marketChange ? marketChange(c.date, day) : null;
        c[`h${h}`] = { day, chg: Math.round(chg * 10000) / 10000, excess: base == null ? null : Math.round((chg - base) * 10000) / 10000, held: c.dir > 0 ? chg >= 0 : chg <= 0 };
        break;
      }
    }
  }
  for (const c of cardRows) c.t = "read";
  scoreLedger(cardRows, priceOn, today, marketChange);
  for (const c of claims) if (!c.unscored) applyBand(c);
  return claims;
}

// Which channels, topics and product types have been right (upgrade 4). Rates are
// confidence-weighted hit rates on each claim's stated horizon when it has one.
export function rankClaims(claims, videoTopics = new Map()) {
  const groups = new Map();
  const add = (key, c) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); };
  for (const c of claims) {
    if (c.unscored) continue;
    const type = c.target === "card" ? "singles" : c.target;
    add(`channel:${c.channel}`, c); add(`type:${type}`, c); add(`channel_type:${c.channel}|${type}`, c);
    for (const t of videoTopics.get(c.videoId) || []) { add(`topic:${t}`, c); add(`channel_topic:${c.channel}|${t}`, c); }
  }
  const rows = [];
  for (const [key, cs] of groups) {
    const i = key.indexOf(":");
    const row = { by: key.slice(0, i), key: key.slice(i + 1), claims: cs.length };
    for (const h of HORIZONS) {
      const s = cs.map((c) => [c, c[`h${h}`]]).filter(([, x]) => x && x.held != null);
      const w = s.reduce((a, [c]) => a + (c.confidence ?? 1), 0);
      row[`scored${h}`] = s.length;
      row[`heldPct${h}`] = s.length >= MIN_SCORED && w > 0 ? Math.round((100 * s.reduce((a, [c, x]) => a + (x.held ? c.confidence ?? 1 : 0), 0)) / w) : null;
      row[`absHeldPct${h}`] = s.length >= MIN_SCORED ? Math.round((100 * s.filter(([, x]) => x.heldAbs).length) / s.length) : null;
      const ex = s.map(([, x]) => x.excess).filter((x) => x != null);
      row[`medianExcess${h}`] = ex.length >= MIN_SCORED ? Math.round(median(ex) * 1000) / 10 : null;
    }
    const st = cs.filter((c) => typeof c.horizon === "number" && c[`h${c.horizon}`]?.held != null);
    row.statedScored = st.length;
    row.statedHeldPct = st.length >= MIN_SCORED ? Math.round((100 * st.filter((c) => c[`h${c.horizon}`].held).length) / st.length) : null;
    rows.push(row);
  }
  return rows.sort((a, b) => (b.heldPct30 ?? -1) - (a.heldPct30 ?? -1) || b.claims - a.claims || (a.key < b.key ? -1 : 1));
}

// Public-safe leads: counts and dates only. No creator names, text or scores.
const HYPE = /!!|\b(insane|crazy|crazier|explod\w*|skyrocket\w*|massive|huge|never seen|must|urgent|moon\w*)\b/i;
export const isHype = (title) => HYPE.test(String(title || "")) || (String(title || "").replace(/[^A-Za-z]/g, "").length > 10 && (String(title).match(/[A-Z]/g) || []).length / String(title).replace(/[^A-Za-z]/g, "").length > 0.6);
// Weight of one video in attention and sentiment counts, from the channel's tone setting.
export function videoWeight(v, tone = {}) {
  const w = Number.isFinite(tone.weight) ? tone.weight : 1;
  return tone.hype && isHype(v.title) ? w * 0.5 : w;
}

export function buildLeads(videos, { today, idx, seenTopics = [], days = 7, firstRun = false, tones = {} }) {
  const from = addDays(today, -(days - 1));
  const recent = videos.filter((v) => v.date >= from && v.date <= today);
  const tally = new Map();
  const bump = (key, v, label) => {
    if (!tally.has(key)) tally.set(key, { key, label, channels: new Map(), videos: 0, wv: 0 });
    const [kind, id] = key.split(":");
    const tone = tones[v.channel] || {};
    const cond = kind === "topic" ? tone.byTopic?.[id] : kind === "set" ? tone.byType?.set : kind === "card" ? tone.byType?.singles : kind === "sealed" ? tone.byType?.sealed : undefined;
    const r = tally.get(key), w = videoWeight(v, cond != null ? { ...tone, weight: cond } : tone);
    r.channels.set(v.channel, Math.max(r.channels.get(v.channel) || 0, w)); r.videos++; r.wv += w;
  };
  for (const v of recent) {
    for (const g of v.mentions.sets) bump(`set:${g}`, v, idx.setList.find((s) => s.groupId === g)?.set || `set ${g}`);
    for (const p of v.mentions.cards) bump(`card:${p}`, v, idx.byPid.get(p)?.name || `card ${p}`);
    for (const p of v.mentions.sealed) bump(`sealed:${p}`, v, idx.byPid.get(p)?.name || `product ${p}`);
    for (const t of v.topics) if (t === "pack_destruction" || t === "print_run") bump(`topic:${t}`, v, t === "pack_destruction" ? "Pack destruction" : "Print runs");
  }
  const leads = [];
  for (const r of tally.values()) {
    const [kind, id] = r.key.split(":");
    const n = r.channels.size, wc = [...r.channels.values()].reduce((a, b) => a + b, 0);
    if (kind === "topic" ? r.wv >= 2 : wc >= 2) leads.push({ kind: kind === "topic" ? id : `${kind}_attention`, ref: kind === "topic" ? null : Number(id), label: r.label, channels: n, videos: r.videos, weighted: Math.round((kind === "topic" ? r.wv : wc) * 100) / 100, from, to: today });
  }
  const seen = new Set(seenTopics);
  if (!firstRun) for (const v of recent) for (const t of v.topics) if (!seen.has(t)) { seen.add(t); leads.push({ kind: "new_method", ref: null, label: t.replace(/_/g, " "), channels: 1, videos: 1, from: v.date, to: today }); }
  return leads.sort((a, b) => b.channels - a.channels || b.videos - a.videos || (a.label < b.label ? -1 : 1));
}

const BANNED = /\b(buy|buys|buying|sell|sells|selling|hold|holding|support|resistance|bottom|printed|play|target|invest\w*|crypto|moon|hodl|stack|load up)\b/i;
// The only public sentence shape: attention across creators, with counts and dates.
export function attentionLine(lead) {
  const line = `${lead.label} is getting attention across creators this week: ${lead.videos} videos on ${lead.channels} channels, ${lead.from} to ${lead.to}.`;
  if (BANNED.test(line) || /\u2014/.test(line)) throw new Error("attention line used a banned word");
  return line;
}
export const isBanned = (s) => BANNED.test(String(s));

// Tyler's rule: a creator claim is never fact. Every claim is an unverified lead
// until our own data (TCGplayer prices here) backs or contradicts it, with evidence.
export function claimStatus(c) {
  if (c.unscored === "low_confidence") return { status: "unverified", evidence: null, unscored: "low_confidence" };
  const stated = typeof c.horizon === "number" ? c.horizon : null;
  const h = c.horizon === "long" ? 90 : stated ?? [...HORIZONS].reverse().find((x) => c[`h${x}`] && c[`h${x}`].held != null);
  const s = h ? c[`h${h}`] : null;
  if (!s || s.held == null) return { status: "unverified", evidence: null, horizon: c.horizon ?? null };
  return { status: s.held ? "backed" : "contradicted", provisional: c.horizon === "long" ? true : undefined, evidence: { source: c.target === "set" ? "TCGplayer market, median single in the set" : "TCGplayer market (data/history/tcgcsv-daily)", horizonDays: h, statedHorizon: c.horizon ?? null, from: c.date, to: s.day, change: s.chg, vsMarket: s.excess, result: s.result, band: BAND, absoluteHeld: s.heldAbs } };
}

// Methods, signals and data sources creators describe. Candidate read paths for the
// weekly audit to test. Never used by reads until tested.
const METHOD = [
  ["print_run_estimate", /\b(estimate|estimating|calculat\w*|figure out|math)\b.{0,60}\b(print run|supply|how many (?:boxes|packs|cases))\b|\b(print run|supply)\b.{0,60}\b(estimate|calculat\w*)\b/i],
  ["signal_watched", /\b(i (?:watch|track|look at|check|monitor)|signals?|indicator|metric)\b.{0,80}\b(listings?|sold|sales|volume|pop|population|sell[- ]through|price|supply|demand)\b/i],
  ["pull_rate_method", /\b(pull rates?|odds)\b.{0,60}\b(sample|opened|cases?|data|tracked|counted)\b/i],
];
const SOURCES = /\b(pricecharting|gemrate|pokedata(?:\.io)?|tcgplayer|ebay sold|130point|psa pop|cgc pop|collectr|cardladder|card ladder|pokemon center|alt\.xyz|tcgquant|collectracks|whatnot|cardmarket)\b/gi;

export function extractIdeas({ videoId, channel, date, text }) {
  const out = [];
  for (const s of String(text || "").split(/(?<=[.!?])\s+|\n+/).filter((x) => x.length > 15)) {
    for (const [kind, re] of METHOD) if (re.test(s)) out.push({ id: `${videoId}:${kind}:${out.length}`, kind, videoId, channel, date, text: s.slice(0, 240), status: "candidate" });
    for (const m of s.matchAll(SOURCES)) out.push({ id: `${videoId}:source:${m[1].toLowerCase()}`, kind: "data_source", source: m[1].toLowerCase(), videoId, channel, date, status: "candidate" });
  }
  const seen = new Set();
  return out.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
}

// Track-record weight per creator. Neutral (1) until MIN_SCORED claims are scored.
// Then 0.5 + held rate, clamped to 0.5..1.5, from the 30-day rate when it has enough
// rows, else the 7-day rate. Private; only applied inside attention and trend counts.
const weightOfRow = (r) => {
  const h = r.scored30 >= MIN_SCORED ? 30 : r.scored7 >= MIN_SCORED ? 7 : null;
  const pct = h ? r[`heldPct${h}`] : null;
  return pct == null ? null : { weight: Math.min(1.5, Math.max(0.5, Math.round((0.5 + pct / 100) * 100) / 100)), basis: `held${h}`, heldPct: pct, scored: r[`scored${h}`] };
};
export function creatorWeights(ranking = []) {
  const out = {};
  for (const r of ranking) {
    if (r.by !== "channel") continue;
    out[r.key] = weightOfRow(r) || { weight: 1, basis: "neutral", scored: Math.max(r.scored7 || 0, r.scored30 || 0) };
  }
  // Topic- and type-conditioned weights, used when a lead's topic has 20+ scored rows.
  for (const r of ranking) {
    if (r.by !== "channel_topic" && r.by !== "channel_type") continue;
    const [ch, k] = r.key.split("|");
    const w = weightOfRow(r);
    if (!w) continue;
    out[ch] ||= { weight: 1, basis: "neutral", scored: 0 };
    (out[ch][r.by === "channel_topic" ? "byTopic" : "byType"] ||= {})[k] = w;
  }
  return out;
}
export const combinedTones = (tones = {}, weights = {}) => {
  const keys = new Set([...Object.keys(tones), ...Object.keys(weights)]);
  const tw = (k) => (Number.isFinite(tones[k]?.weight) ? tones[k].weight : 1);
  const scale = (m, k) => (m ? Object.fromEntries(Object.entries(m).map(([t, w]) => [t, tw(k) * w.weight])) : undefined);
  return Object.fromEntries([...keys].map((k) => [k, { ...(tones[k] || {}), weight: tw(k) * (weights[k]?.weight ?? 1), byTopic: scale(weights[k]?.byTopic, k), byType: scale(weights[k]?.byType, k) }]));
};

// Hype effect: what set prices did 7, 30 and 90 days after heavy creator coverage.
// An event is the first day a set reaches 3+ videos on 2+ channels inside 7 days;
// one event per set per 30 days. Change = median single in the set, excess = vs market.
export function hypeEvents(videos, { minVideos = 3, minChannels = 2, windowDays = 7, cooldown = 30 } = {}) {
  const bySet = new Map();
  for (const v of videos) for (const g of v.mentions?.sets || []) { if (!bySet.has(g)) bySet.set(g, []); bySet.get(g).push(v); }
  const events = [];
  for (const [g, vs] of bySet) {
    vs.sort((a, b) => (a.date < b.date ? -1 : 1));
    let last = null;
    for (const v of vs) {
      if (last && v.date < addDays(last, cooldown)) continue;
      const from = addDays(v.date, -(windowDays - 1));
      const win = vs.filter((x) => x.date >= from && x.date <= v.date);
      const ch = new Set(win.map((x) => x.channel));
      if (win.length >= minVideos && ch.size >= minChannels) { events.push({ groupId: g, date: v.date, videos: win.length, channels: ch.size }); last = v.date; }
    }
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.groupId - b.groupId));
}

export function scoreHype(events, { priceOn, marketChange, pidsBySet, today }) {
  for (const e of events) {
    const pids = pidsBySet.get(e.groupId) || [];
    for (const h of HORIZONS) {
      if (e[`h${h}`] || addDays(e.date, h) > today) continue;
      for (let d = 0; d <= 3; d++) {
        const day = addDays(e.date, h + d);
        if (day > today) break;
        const ch = [];
        for (const pid of pids) { const a = priceOn(pid, e.date), b = priceOn(pid, day); if (a > 0 && b > 0) ch.push(b / a - 1); }
        if (ch.length < 5) continue;
        const chg = median(ch), base = marketChange ? marketChange(e.date, day) : null;
        e[`h${h}`] = { day, chg: Math.round(chg * 10000) / 10000, excess: base == null ? null : Math.round((chg - base) * 10000) / 10000, priced: ch.length };
        break;
      }
    }
  }
  const summary = {};
  for (const h of HORIZONS) {
    const ex = events.map((e) => e[`h${h}`]?.excess).filter((x) => x != null);
    summary[`h${h}`] = { events: ex.length, medianExcessPct: ex.length >= 5 ? Math.round(median(ex) * 1000) / 10 : null, beatMarketPct: ex.length >= 5 ? Math.round((100 * ex.filter((x) => x > 0).length) / ex.length) : null };
  }
  return { events, summary };
}

// Disagreements: opposite claims on one target from different creators inside 14
// days, and claims our TCGplayer prices contradicted. Private rows; public counts only.
export function disagreements(claims, { today, days = 14 } = {}) {
  const creator = [];
  const byTarget = new Map();
  for (const c of claims) { const k = c.target === "card" ? `card:${c.pid}` : `set:${c.groupId}`; if (!byTarget.has(k)) byTarget.set(k, []); byTarget.get(k).push(c); }
  for (const [k, cs] of byTarget) {
    const recent = cs.filter((c) => c.date >= addDays(today, -(days - 1)));
    const up = recent.filter((c) => c.dir > 0), down = recent.filter((c) => c.dir < 0);
    const upCh = new Set(up.map((c) => c.channel)), downCh = new Set(down.map((c) => c.channel));
    if (up.length && down.length && [...upCh].some((a) => [...downCh].some((b) => a !== b))) {
      const dates = recent.map((c) => c.date).sort();
      creator.push({ target: k, up: upCh.size, down: downCh.size, from: dates[0], to: dates.at(-1), claims: recent.map((c) => c.id) });
    }
  }
  const data = claims.filter((c) => c.status === "contradicted" && c.statusSince === today).map((c) => ({ target: c.target === "card" ? `card:${c.pid}` : `set:${c.groupId}`, claim: c.id, date: c.date, evidence: c.evidence }));
  return { creator, data };
}

// Eden seed from comment sentiment: per catalogue id, likes-weighted and creator-weighted,
// with this week against the week before so a turn in mood shows.
export function edenSeed(videos, { today, weightOf = () => 1 }) {
  const wk = addDays(today, -6), prev = addDays(today, -13), start = addDays(today, -29);
  const rows = {};
  for (const v of videos) {
    if (v.date < start || v.date > today) continue;
    const w = weightOf(v);
    let pos = 0, neg = 0;
    for (const c of v.topComments || []) { const s = commentSentiment([c.text]); const lw = 1 + Math.log10(1 + (c.likes || 0)); pos += s.pos * lw; neg += s.neg * lw; }
    const keys = [...(v.mentions?.sets || []).map((g) => `set:${g}`), ...(v.mentions?.cards || []).map((p) => `card:${p}`), ...(v.mentions?.sealed || []).map((p) => `sealed:${p}`)];
    for (const k of keys) {
      const r = (rows[k] ||= { videos: 0, comments: 0, pos: 0, neg: 0, week: { pos: 0, neg: 0, videos: 0 }, prevWeek: { pos: 0, neg: 0, videos: 0 } });
      r.videos++; r.comments += (v.topComments || []).length; r.pos += w * pos; r.neg += w * neg;
      const b = v.date >= wk ? r.week : v.date >= prev ? r.prevWeek : null;
      if (b) { b.pos += w * pos; b.neg += w * neg; b.videos++; }
    }
  }
  const sc = (p, n) => (p + n ? Math.round(((p - n) / (p + n)) * 100) / 100 : null);
  for (const r of Object.values(rows)) {
    r.pos = Math.round(r.pos * 100) / 100; r.neg = Math.round(r.neg * 100) / 100;
    r.score = sc(r.pos, r.neg); r.week.score = sc(r.week.pos, r.week.neg); r.prevWeek.score = sc(r.prevWeek.pos, r.prevWeek.neg);
    r.turn = r.week.score != null && r.prevWeek.score != null ? Math.round((r.week.score - r.prevWeek.score) * 100) / 100 : null;
  }
  return rows;
}

// Chapters a creator writes in the description ("0:00 Intro", "12:34 - Prismatic").
// Needs 3+ timestamps in time order, the first under 1 minute (YouTube's own rule is 0:00).
const TS = /^\s*[([]?((?:\d{1,2}:)?\d{1,2}:\d{2})[)\]]?\s*(?:[-–—:|•]\s*)?(.+?)\s*$/;
const secs = (t) => t.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
export function parseChapters(description) {
  const rows = [];
  for (const line of String(description || "").split(/\r?\n/)) {
    const m = TS.exec(line);
    if (m && m[2] && !/^\d{1,2}:\d{2}/.test(m[2])) rows.push({ t: secs(m[1]), title: m[2].slice(0, 120) });
  }
  if (rows.length < 3 || rows[0].t > 59) return [];
  for (let i = 1; i < rows.length; i++) if (rows[i].t <= rows[i - 1].t) return [];
  return rows;
}

// Topic outline per video: each chapter with its topics and catalogue matches.
export function videoOutline(v, idx) {
  return parseChapters(v.description).map((c) => ({ t: c.t, title: c.title, topics: topicTags(c.title), mentions: extractMentions(c.title, idx) }));
}
