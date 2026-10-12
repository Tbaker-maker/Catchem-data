// YouTube learning loop. Pure functions. The runner (scripts/youtube-learn.mjs)
// calls the official YouTube Data API v3 and writes catchem-data-private.
// No AI, no scraping, no captions. Cards match by catalogue id, never by name alone.
import { addDays, HORIZONS, MIN_SCORED, scoreLedger, priceAtHorizon } from "./self-check.mjs";

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
  return { byNum, byPid, setList, sealedBySet, pidsBySet };
}

// Mentions in one text. Cards: a TCGplayer product link, or a card number plus the
// card's own name in the same text, resolving to exactly one catalogue id.
export function extractMentions(text, idx) {
  const raw = String(text || ""), t = ` ${norm(raw)} `;
  const cards = new Set(), sets = new Set(), sealed = new Set();
  for (const m of raw.matchAll(/tcgplayer\.com\/product\/(\d{3,8})/gi)) {
    const it = idx.byPid.get(Number(m[1]));
    if (it) (it.kind === "sealed" ? sealed : cards).add(Number(m[1]));
  }
  let rest = t;
  for (const s of idx.setList) {
    const k = ` ${s.key} `;
    if (rest.includes(k)) { sets.add(s.groupId); rest = rest.split(k).join(" "); }
  }
  for (const m of raw.matchAll(/\b0*(\d{1,3}[a-z]?)\s*\/\s*0*(\d{2,3}|[a-z]{1,3}\d{0,3})\b/gi)) {
    const hits = (idx.byNum.get(`${m[1].toLowerCase()}/${m[2].toLowerCase()}`) || []).filter((c) => c.base.length >= 3 && t.includes(` ${c.base} `));
    const inSet = hits.filter((c) => sets.has(c.groupId));
    const pick = inSet.length === 1 ? inSet : hits.length === 1 ? hits : [];
    for (const c of pick) cards.add(c.pid);
  }
  for (const g of sets) {
    for (const [kind, re] of SEALED_KIND) {
      if (!re.test(t)) continue;
      const hit = (idx.sealedBySet.get(g) || []).filter((p) => p.name.includes(kind) && !/\b(case|display|bundle of|pokemon center)\b/.test(p.name));
      if (hit.length === 1) sealed.add(hit[0].pid);
    }
  }
  return { cards: [...cards].sort((a, b) => a - b), sets: [...sets].sort((a, b) => a - b), sealed: [...sealed].sort((a, b) => a - b) };
}

export const topicTags = (text) => Object.entries(TOPICS).filter(([, re]) => re.test(String(text || ""))).map(([k]) => k);

// Word-list sentiment over comments, -1..1. An Eden seed, not a model.
export function commentSentiment(comments = []) {
  let pos = 0, neg = 0;
  for (const c of comments) { pos += (String(c).match(POS_RE) || []).length; neg += (String(c).match(NEG_RE) || []).length; }
  const n = pos + neg;
  return { comments: comments.length, pos, neg, score: n ? Math.round(((pos - neg) / n) * 100) / 100 : 0 };
}

// Dated direction claims about one card id or one set, sentence by sentence.
export function extractClaims({ videoId, channel, date, text }, idx) {
  const out = [];
  const sentences = String(text || "").split(/(?<=[.!?\n])\s+/).filter((s) => s.length > 8);
  for (const s of sentences) {
    const dir = UP.test(s) ? 1 : DOWN.test(s) ? -1 : 0;
    if (!dir) continue;
    const m = extractMentions(s, idx);
    for (const pid of m.cards) out.push({ id: `${videoId}:c${pid}:${dir}`, videoId, channel, date, dir, target: "card", pid, text: s.slice(0, 200) });
    if (!m.cards.length) for (const g of m.sets) out.push({ id: `${videoId}:s${g}:${dir}`, videoId, channel, date, dir, target: "set", groupId: g, text: s.slice(0, 200) });
  }
  const seen = new Set();
  return out.filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Score claims at 7, 30 and 90 days. Card claims run through the same scoreLedger
// as self-check (held = price on the claimed side; excess vs the market median).
// Set claims use the median change of the set's priced singles between the same days.
export function scoreClaims(claims, { priceOn, marketChange, pidsBySet, today }) {
  const cardRows = [];
  for (const c of claims) {
    if (c.target === "card") {
      if (!(c.price > 0)) { const p = priceOn(c.pid, c.date) ?? priceAtHorizon(priceOn, c.pid, c.date, 0)?.price; if (p > 0) c.price = p; }
      if (c.price > 0) cardRows.push(c);
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
  return claims;
}

// Which channels and topics have been right. Rates need MIN_SCORED rows, like self-check.
export function rankClaims(claims, videoTopics = new Map()) {
  const groups = new Map();
  const add = (key, c) => { if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); };
  for (const c of claims) { add(`channel:${c.channel}`, c); for (const t of videoTopics.get(c.videoId) || []) add(`topic:${t}`, c); }
  const rows = [];
  for (const [key, cs] of groups) {
    const row = { by: key.split(":")[0], key: key.split(":")[1], claims: cs.length };
    for (const h of HORIZONS) {
      const s = cs.map((c) => c[`h${h}`]).filter((x) => x && x.held != null);
      row[`scored${h}`] = s.length;
      row[`heldPct${h}`] = s.length >= MIN_SCORED ? Math.round((100 * s.filter((x) => x.held).length) / s.length) : null;
      const ex = s.map((x) => x.excess).filter((x) => x != null);
      row[`medianExcess${h}`] = ex.length >= MIN_SCORED ? Math.round(median(ex) * 1000) / 10 : null;
    }
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
    const r = tally.get(key), w = videoWeight(v, tones[v.channel]);
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
  const h = [...HORIZONS].reverse().find((x) => c[`h${x}`] && c[`h${x}`].held != null);
  if (!h) return { status: "unverified", evidence: null };
  const s = c[`h${h}`];
  return { status: s.held ? "backed" : "contradicted", evidence: { source: c.target === "card" ? "TCGplayer market (data/history/tcgcsv-daily)" : "TCGplayer market, median single in the set", horizonDays: h, from: c.date, to: s.day, change: s.chg, vsMarket: s.excess } };
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
  for (const s of String(text || "").split(/(?<=[.!?\n])\s+/).filter((x) => x.length > 15)) {
    for (const [kind, re] of METHOD) if (re.test(s)) out.push({ id: `${videoId}:${kind}:${out.length}`, kind, videoId, channel, date, text: s.slice(0, 240), status: "candidate" });
    for (const m of s.matchAll(SOURCES)) out.push({ id: `${videoId}:source:${m[1].toLowerCase()}`, kind: "data_source", source: m[1].toLowerCase(), videoId, channel, date, status: "candidate" });
  }
  const seen = new Set();
  return out.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));
}
