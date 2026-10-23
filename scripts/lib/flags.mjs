import { crowdedCallFlags as crowdedFromLib, hypeEffectFlags as hypeFromLib } from "./hype-crowd.mjs";
// Flag rules for data/derived/flags.json. Pure functions over files the nightly
// already wrote. Each flag: { type, severity: "high"|"medium"|"low", key, line, data }.

export const FLAG_TYPES = {
  NEW_SET: "A TCGCSV set (group) appeared that was not there last night, or a future product in a news calendar is not on the radar.",
  NEW_RELEASE: "A product appeared on the release radar or releases file.",
  RELEASE_DATE_CHANGE: "A radar date changed since last night, or a news calendar shows another date for a radar product.",
  PRICE_MOVE: "A single or sealed product moved 50%+ and $10+ between the last two price days (both prices $5+).",
  NEWS_SOURCE_FAILING: "A news source failed or returned nothing tonight.",
  NEWS_LEAD: "A news headline matched a research category: supply, grading, new product or market news.",
  DATA_GAP: "A calendar day has no TCGCSV price file, or tonight's file priced 10%+ fewer products than the last one.",
  STALE_FILE: "A file the reads depend on is older than its allowed age.",
  ODD_PRICE: "Prices held back as likely data errors (Card Rating held list, sealed price outliers).",
  YOUTUBE_LEAD: "Creator videos (official YouTube API, private store) point at something new: a set, card or sealed product on 2+ channels this week, pack-destruction or print-run talk, or a topic not seen before. Counts and dates only. An unverified lead for review, never a fact; nothing in reads or ratings uses it.",
  YOUTUBE_DISAGREE: "Creators made opposite price-direction claims on one set or card inside 14 days, or our TCGplayer prices contradicted creator claims tonight. Counts and dates only.",
  YOUTUBE_KEY_MISSING: "YOUTUBE_API_KEY is not set for the nightly, or the YouTube step failed. The learning loop did not run.",
  READ_TYPE_EMPTY: "A known read type produced nothing tonight.",
  HYPE_EFFECT: "Heavy creator attention on a set, card, or sealed product this week, with the historical 30-day move for past subjects that saw similar attention. n≥20 holdout. Counts, dates, and percent only. No creator names. Not advice.",
  CROWDED_CALL: "Many tracked creators made the same-direction call on one set, card, or sealed product inside a short window, with the historical 30-day move for past crowded calls at that level. n≥20 holdout. Singles and sealed stay separate. No creator names. Not advice.",
};


export const READ_TYPES = ["high", "low", "single", "backto", "sealed", "streak", "year", "plain", "set", "spread", "askmove", "mktmove", "climb", "setheat", "breadth", "release", "newsline", "listings", "rotation", "pokemon", "sealedchase", "deep"];

export const MOVE = { pct: 0.5, abs: 10, floor: 5, max: 40 };
export const STALE_DAYS = { catalog: 1, reads: 1, news: 1, ebaySealed: 2, cardRating: 1, radarCheck: 7, releases: 7 };

const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const money = (v) => `$${Number(v).toFixed(2)}`;

export function newSetFlags(groups, state) {
  const known = new Set((state?.groups || []).map(String));
  if (!known.size) return [];
  return groups.filter((g) => !known.has(String(g.id))).map((g) => ({ type: "NEW_SET", severity: "high", key: `group:${g.id}`, line: `New set in TCGCSV: ${g.name} (group ${g.id}${g.published ? `, published ${g.published}` : ""}).`, data: g }));
}

export function releaseFlags(radar, state) {
  const out = [];
  const prev = new Map((state?.radar || []).map((r) => [r.name, r.date]));
  if (!prev.size) return out;
  for (const u of radar?.upcoming || []) {
    if (!prev.has(u.name)) out.push({ type: "NEW_RELEASE", severity: "medium", key: `radar:${u.name}`, line: `New on the release radar: ${u.name} (${u.date}, ${u.confidence || "no confidence"}).`, data: { name: u.name, date: u.date } });
    else if (prev.get(u.name) !== u.date) out.push({ type: "RELEASE_DATE_CHANGE", severity: "high", key: `radar-date:${u.name}`, line: `Radar date changed: ${u.name} ${prev.get(u.name)} to ${u.date}.`, data: { name: u.name, from: prev.get(u.name), to: u.date } });
  }
  return out;
}

export function priceMoveFlags(prevDay, prevPrices, day, prices, names) {
  const out = [];
  for (const [id, to] of prices) {
    const from = prevPrices.get(id);
    if (!(from >= MOVE.floor) || !(to >= MOVE.floor)) continue;
    const pct = to / from - 1;
    if (Math.abs(pct) < MOVE.pct || Math.abs(to - from) < MOVE.abs) continue;
    const n = names.get(id) || { name: `product ${id}`, set: "" };
    out.push({ type: "PRICE_MOVE", severity: Math.abs(to - from) >= 100 ? "high" : "medium", key: `move:${id}:${day}`, line: `${n.name}${n.set ? ` (${n.set})` : ""}: ${money(from)} (${prevDay}) to ${money(to)} (${day}) on TCGplayer market, ${pct > 0 ? "up" : "down"} ${Math.round(Math.abs(pct) * 100)}%.`, data: { id: `tcgcsv-${id}`, from, to, fromDay: prevDay, toDay: day, pct: Math.round(pct * 1000) / 10, kind: n.kind || "" } });
  }
  out.sort((a, b) => Math.abs(b.data.to - b.data.from) - Math.abs(a.data.to - a.data.from));
  return out.slice(0, MOVE.max);
}

export function newsSourceFlags(news) {
  const out = [];
  for (const f of news?.failures || []) out.push({ type: "NEWS_SOURCE_FAILING", severity: "medium", key: `news-fail:${f.source || f.name || JSON.stringify(f).slice(0, 40)}`, line: `News source failed: ${f.source || f.name || "unknown"}${f.reason || f.error ? ` (${String(f.reason || f.error).slice(0, 120)})` : ""}.`, data: f });
  for (const s of news?.sources || []) if (!(s.items > 0)) out.push({ type: "NEWS_SOURCE_FAILING", severity: "low", key: `news-empty:${s.source}`, line: `News source returned nothing: ${s.source}.`, data: s });
  return out;
}

export function dataGapFlags(days, today, counts = {}) {
  const have = new Set(days);
  const out = [];
  const missing = [];
  const first = [...days].sort()[0];
  for (let i = 30; i >= 0; i--) { const d = addDays(today, -i); if (first && d >= first && !have.has(d)) missing.push(d); }
  if (missing.length) out.push({ type: "DATA_GAP", severity: missing.some((d) => dayDiff(d, today) <= 2) ? "high" : "low", key: `gap:${missing.join(",")}`, line: `No TCGCSV price file for ${missing.length} day(s) in the last 31 (since the first daily file): ${missing.join(", ")}.`, data: { missing } });
  const sorted = [...days].filter((d) => counts[d]).sort();
  const last = sorted.at(-1), prev = sorted.at(-2);
  if (last && prev && counts[last] < counts[prev] * 0.9) out.push({ type: "DATA_GAP", severity: "high", key: `count-drop:${last}`, line: `Price file ${last} has ${counts[last]} products, down from ${counts[prev]} on ${prev}.`, data: { last, prev, lastCount: counts[last], prevCount: counts[prev] } });
  return out;
}

export function staleFlags(stamps, today) {
  const out = [];
  for (const [name, { date, file }] of Object.entries(stamps)) {
    const limit = STALE_DAYS[name];
    if (limit == null) continue;
    if (!date) { out.push({ type: "STALE_FILE", severity: "high", key: `stale:${name}`, line: `${file} has no date.`, data: { file } }); continue; }
    const age = dayDiff(String(date).slice(0, 10), today);
    if (age > limit) out.push({ type: "STALE_FILE", severity: age > limit * 3 ? "high" : "medium", key: `stale:${name}`, line: `${file} is ${age} days old (dated ${String(date).slice(0, 10)}, allowed ${limit}).`, data: { file, date, age, limit } });
  }
  return out;
}

export function oddPriceFlags(held, outliers, sealed) {
  const out = [];
  for (const p of (sealed?.products || [])) {
    if (!p?.floorDropped) continue;
    out.push({ type: "ODD_PRICE", severity: "low", key: `floor-dropped:${p.id}`, line: `Floor left off for ${p.name}: ${p.floorDropped}. The median still publishes.`, data: { id: p.id, reason: p.floorDropped, source: "data/sealed-prices.json" } });
  }
  for (const r of (held?.rows || []).slice(0, 60)) out.push({ type: "ODD_PRICE", severity: "low", key: `held:${r.id}`, line: `Held for a check: ${r.name} (${r.set}) at ${money(r.price?.price ?? r.price)}, ${r.reason}.`, data: { id: r.id, group: r.group, ratio: r.ratio, source: "data/derived/card-rating-held.json" } });
  for (const r of (outliers?.high || []).slice(0, 30)) out.push({ type: "ODD_PRICE", severity: "medium", key: `sealed-outlier:${r.sku || r.id}`, line: `Sealed price outlier: ${r.name || r.sku || r.id}.`, data: { ...r, source: "data/derived/sealed-price-outliers.json" } });
  return out;
}

export function readTypeFlags(kindCounts, state) {
  const prev = state?.readKinds || {};
  return READ_TYPES.filter((k) => !(kindCounts[k] > 0)).map((k) => ({ type: "READ_TYPE_EMPTY", severity: prev[k] > 0 ? "high" : "low", key: `empty:${k}`, line: `Read type "${k}" produced nothing tonight${prev[k] > 0 ? ` (it had ${prev[k]} last night)` : ""}.`, data: { kind: k, lastNight: prev[k] || 0 } }));
}

export function summarizeFlags(flags) {
  const byType = {}, bySeverity = { high: 0, medium: 0, low: 0 };
  for (const f of flags) { byType[f.type] = (byType[f.type] || 0) + 1; bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; }
  return { byType, bySeverity };
}

// YouTube leads from data/derived/youtube-leads.json. Counts and dates only.
export function youtubeFlags(doc) {
  if (!doc || !doc.asOf) return [];
  if (doc.keyPresent === false || doc.status === "error") return [{ type: "YOUTUBE_KEY_MISSING", severity: "medium", key: `yt:missing:${doc.asOf}`, line: doc.keyPresent === false ? "YOUTUBE_API_KEY is not set; the YouTube learning loop did not run." : `YouTube step failed (${(doc.errors || []).join("; ")}).`, data: { status: doc.status } }];
  const dis = doc.disagreements || {};
  const disFlags = [
    ...(dis.creatorRows || []).map((d) => ({ type: "YOUTUBE_DISAGREE", severity: "low", key: `yt:dis:${d.label}:${d.to}`, line: `Creators disagree on ${d.label}: opposite claims on ${d.channels} channels, ${d.from} to ${d.to}.`, data: d })),
    ...(dis.dataContradictedTonight ? [{ type: "YOUTUBE_DISAGREE", severity: "low", key: `yt:data:${doc.asOf}`, line: `${dis.dataContradictedTonight} creator claims were contradicted by TCGplayer prices tonight (${doc.asOf}).`, data: { count: dis.dataContradictedTonight } }] : []),
  ];
  return disFlags.concat((doc.leads || []).map((l) => ({ type: "YOUTUBE_LEAD", severity: l.kind === "new_method" ? "low" : "medium", key: `yt:${l.kind}:${l.ref ?? l.label}:${l.to}`, line: l.kind === "new_method" ? `First creator video tagged ${l.label} (${l.from}).` : `${l.label}: ${l.videos} creator videos on ${l.channels} channels, ${l.from} to ${l.to} (unverified lead).`, data: l })));
}

export function hypeEffectFlagsFromFiles(docsByLevel) {
  if (!docsByLevel) return [];
  return hypeFromLib(docsByLevel);
}

export function crowdedCallFlagsFromFiles(docsByLevel) {
  if (!docsByLevel) return [];
  return crowdedFromLib(docsByLevel);
}

