// Deep reads: tap-to-expand cards with 3 to 6 short lines and a small chart.
// Built only from files on disk: long singles history + nightly days
// (history-reads.mjs), sets.json, rotation-status.json, releases.json,
// sealed nightly history and tonight's 7-day pool. Every number is a point on
// file with its date. A card's price on a day is its last real point on or
// before that day, and only if that point is at most 8 days older (the long
// archive keeps change-only points with a 7-day heartbeat). Nothing is filled.

import { banGuard } from "./copy-rules.mjs";
import { money } from "./public-bundle.mjs";
import { monthDay } from "./takes.mjs";
import { markCited } from "./board-mix.mjs";
import { addDays, dayNum, dateLabel, monthYear } from "./history-reads.mjs";
import { speciesToken } from "./fact-reads.mjs";
import { barLabel, cardTitle, tcgAmount } from "./card-face.mjs";

const usd = (n) => tcgAmount(n, money);

export const DEEP_TAG = "v3";
const BANNED = banGuard("deep reads");
const ok = (s) => !!s && !BANNED.test(s) && !/[\u2014\u2013]/.test(s);
const pctOf = (a, b) => ((b - a) / a) * 100;
const sgn = (n) => `${n >= 0 ? "up" : "down"} ${Math.abs(Math.round(n))}%`;
const short = (s) => String(s || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
const cleanName = (n) => String(n || "").replace(/\s+-\s+[A-Z]*\d+\/[A-Z]*\d+\s*$/, "").trim();
const LOW = new Set(["Common", "Uncommon", "Code Card", "None", ""]);

export function valueOn(pts, day, maxAge = 8) {
  let hit = null;
  for (const p of pts) { if (p[0] <= day) hit = p; else break; }
  if (!hit || dayNum(day) - dayNum(hit[0]) > maxAge) return null;
  return hit[1];
}

// A small chart: at most n points, real points only, the last one always kept.
export function sparkOf(pts, n = 48) {
  if (pts.length <= n) return pts.map((p) => [p[0], p[1]]);
  const step = (pts.length - 1) / (n - 1);
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(pts[Math.round(i * step)]);
  return out.map((p) => [p[0], p[1]]);
}

export function row(kind, id, name, headline, lines, asOf, source, extra = {}) {
  const ls = lines.filter(ok).slice(0, 6);
  if (!ok(headline) || ls.length < 3) return null;
  return { id: `deep-${kind}-${id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90), readKind: "deep", kind: "deep", deep: kind, board: DEEP_TAG, family: "deep", name, headline, path: headline, lines: ls, asOf, source, ...extra };
}

// Same basket on every date: cards with a price on all of them.
function basketValue(cards, days) {
  let total = days.map(() => 0);
  let n = 0;
  for (const c of cards) {
    const v = days.map((d) => valueOn(c.pts, d));
    if (v.some((x) => x == null)) continue;
    n += 1;
    total = total.map((t, i) => t + v[i]);
  }
  return { n, total };
}

// Chase basket for a set: the set's top-priced singles with a fresh price
// tonight. A move over a window only compares the same cards, each with a real
// price on both dates, and only when those cards carry most of the basket's
// value tonight. Otherwise the window is left out.
export const CHASE_N = 15;
export const MATCH_SHARE = 0.8;
export function chaseBasket(list, asOf, { stale = [], n = CHASE_N } = {}) {
  const fresh = list.filter((c) => !LOW.has(c.rarity) && c.pts.at(-1)?.[0] === asOf && c.pts.at(-1)[1] > 0);
  const chase = fresh.slice().sort((a, z) => z.pts.at(-1)[1] - a.pts.at(-1)[1]).slice(0, n);
  const floor = chase.length ? chase.at(-1).pts.at(-1)[1] : Infinity;
  // A pricier card in the same set without a fresh price means the top is not fully covered.
  const missing = stale.filter((c) => !LOW.has(c.rarity) && c.pts.at(-1)?.[0] !== asOf && (c.pts.at(-1)?.[1] || 0) > floor);
  const now = chase.reduce((t, c) => t + c.pts.at(-1)[1], 0);
  return { chase, now, missing, complete: missing.length === 0 };
}
export function windowMove(chase, from, asOf, share = MATCH_SHARE) {
  let a = 0, z = 0, n = 0, nowAll = 0;
  for (const c of chase) {
    const t = valueOn(c.pts, asOf);
    if (t != null) nowAll += t;
    const f = valueOn(c.pts, from);
    if (f == null || t == null || !(f > 0)) continue;
    a += f; z += t; n += 1;
  }
  if (!n || !(nowAll > 0) || z / nowAll < share) return null;
  return { from: a, to: z, n, ch: pctOf(a, z) };
}

export function setDeepDives(cards, { asOf, sets, rotation, max = 25 }) {
  const meta = new Map((sets?.sets || []).map((s) => [s.slug, s]));
  const rot = new Map((rotation?.sets || []).map((s) => [s.slug, s]));
  const bySet = new Map();
  for (const c of cards) if (c.setSlug) { if (!bySet.has(c.setSlug)) bySet.set(c.setSlug, []); bySet.get(c.setSlug).push(c); }
  const days = [addDays(asOf, -365), addDays(asOf, -90), addDays(asOf, -30), asOf];
  const out = [];
  for (const [slug, all] of bySet) {
    const bk = chaseBasket(all, asOf, { stale: all });
    if (bk.chase.length < 10 || !(bk.now > 0)) continue;
    const { chase, now } = bk;
    const yr = windowMove(chase, days[0], asOf), qt = windowMove(chase, days[1], asOf), mo = windowMove(chase, days[2], asOf);
    const s = meta.get(slug) || {};
    const r = rot.get(slug);
    const name = s.name || short(all[0].set);
    const n = chase.length;
    const who = bk.complete ? `its top ${n} chase cards` : `the top ${n} chase cards we price tonight`;
    const tail = yr ? `, ${sgn(yr.ch)} in a year for the ${yr.n} with a price both dates` : "";
    const headline = `${name} deep dive: ${who} are worth ${usd(now)} together${tail}.`;
    const moves = [mo && `30 days ${sgn(mo.ch)} (${mo.n} cards)`, qt && `90 days ${sgn(qt.ch)} (${qt.n} cards)`, yr && `1 year ${sgn(yr.ch)} (${yr.n} cards)`].filter(Boolean);
    const tiers = new Map();
    for (const c of chase) {
      const a = valueOn(c.pts, days[0]), z = valueOn(c.pts, asOf);
      if (a == null || z == null) continue;
      const t = tiers.get(c.rarity) || { a: 0, z: 0, n: 0 };
      t.a += a; t.z += z; t.n += 1; tiers.set(c.rarity, t);
    }
    const lead = [...tiers.entries()].filter(([, t]) => t.n >= 3).map(([k, t]) => ({ k, ch: pctOf(t.a, t.z), n: t.n })).sort((a, z) => z.ch - a.ch)[0];
    const lines = [
      `Top ${n} by TCGplayer market price tonight (${monthDay(asOf)}), each with a price dated ${monthDay(asOf)}: ${usd(now)} together.`,
      `Top cards tonight: ${chase.slice(0, 3).map((c) => `${cardTitle(c)} ${usd(c.pts.at(-1)[1])}`).join(", ")}.`,
      moves.length ? `Same cards on both dates only: ${moves.join(", ")}.` : `Not enough of these cards have a price a year ago to compare.`,
      bk.complete ? "" : `${bk.missing.length} pricier card${bk.missing.length === 1 ? "" : "s"} in this set ${bk.missing.length === 1 ? "has" : "have"} no fresh price tonight and ${bk.missing.length === 1 ? "is" : "are"} left out.`,
      lead ? `Leading tier over the year: ${lead.k}, ${sgn(lead.ch)} across ${lead.n} cards.` : "",
      r?.status ? `Rotation: ${r.status === "Standard" ? `Standard legal, mark ${r.mark}` : `${r.status}, mark ${r.mark}`} (${markCited(r, rotation)}).` : (s.release ? `Released ${dateLabel(s.release, asOf)}.` : ""),
    ];
    const spark = yr ? [[days[0], Math.round(yr.from * 100) / 100], [asOf, Math.round(yr.to * 100) / 100]] : [[asOf, Math.round(now * 100) / 100]];
    const rr = row("set", slug, name, headline, lines, asOf, `TCGplayer market, ${days[0]} to ${asOf}; sets.json; rotation-status.json ${rotation?.asOf || ""}`, { set: name, href: `/sets/${slug}`, chart: { label: yr ? `${yr.n} chase cards, same cards both dates` : `${n} chase cards, tonight`, points: spark }, startDate: days[0], endDate: asOf, receipt: { slug, n, now, complete: bk.complete, missing: bk.missing.map((c) => c.id), cards: chase.map((c) => ({ id: c.id, price: c.pts.at(-1)[1], date: c.pts.at(-1)[0] })), year: yr, quarter: qt, month: mo, days }, weight: yr ? Math.abs(yr.ch) : 0 });
    if (rr) out.push(rr);
  }
  return out.sort((a, z) => z.weight - a.weight).slice(0, max);
}

export function cardStories(cards, { asOf, max = 25, skip = new Set() }) {
  const live = cards.filter((c) => c.pts.at(-1)?.[0] === asOf && c.pts.at(-1)[1] >= 50 && !LOW.has(c.rarity) && dayNum(asOf) - dayNum(c.pts[0][0]) >= 365 && !skip.has(c.id));
  const bySpecies = new Map();
  for (const c of cards) { const t = speciesToken(c.name); if (!t || c.pts.at(-1)?.[0] !== asOf) continue; if (!bySpecies.has(t)) bySpecies.set(t, []); bySpecies.get(t).push(c); }
  const bySet = new Map();
  for (const c of cards) { if (c.pts.at(-1)?.[0] !== asOf) continue; if (!bySet.has(c.set)) bySet.set(c.set, []); bySet.get(c.set).push(c); }
  const out = [];
  for (const c of live.sort((a, z) => z.pts.at(-1)[1] - a.pts.at(-1)[1]).slice(0, max * 2)) {
    const now = c.pts.at(-1);
    const peak = c.pts.reduce((m, p) => (p[1] > m[1] ? p : m));
    const low = c.pts.reduce((m, p) => (p[1] < m[1] ? p : m));
    const yr = c.pts.filter((p) => p[0] >= addDays(asOf, -365));
    const yHi = Math.max(...yr.map((p) => p[1])), yLo = Math.min(...yr.map((p) => p[1]));
    if (yHi === yLo) continue;
    const spot = Math.round(((now[1] - yLo) / (yHi - yLo)) * 100);
    const sp = bySpecies.get(speciesToken(c.name)) || [];
    const spRank = sp.slice().sort((a, z) => z.pts.at(-1)[1] - a.pts.at(-1)[1]).findIndex((x) => x.id === c.id) + 1;
    const peers = (bySet.get(c.set) || []).slice().sort((a, z) => z.pts.at(-1)[1] - a.pts.at(-1)[1]);
    const setRank = peers.findIndex((x) => x.id === c.id) + 1;
    const who = cardTitle(c);
    const headline = `The story of ${who}: ${usd(now[1])} tonight, ${spot}% of the way from its 1-year low to its 1-year high.`;
    const lines = [
      `On file since ${monthYear(c.pts[0][0])}: ${c.pts.length} TCGplayer market points for this card (${c.printing || "default"}).`,
      `Peak ${usd(peak[1])} on ${dateLabel(peak[0], asOf)}. Low ${usd(low[1])} on ${dateLabel(low[0], asOf)}.`,
      `Past year range: ${usd(yLo)} to ${usd(yHi)}. Tonight (${monthDay(asOf)}): ${usd(now[1])}.`,
      sp.length > 1 && spRank ? `Number ${spRank} of ${sp.length} ${speciesToken(c.name)} cards we price tonight.` : "",
      setRank && peers.length > 1 ? `Number ${setRank} of ${peers.length} priced cards in ${short(c.set)}.` : "",
    ];
    const rr = row("card", c.id, c.name, headline, lines, asOf, `TCGplayer market (tcgcsv daily archive and our nightly days), ${c.pts[0][0]} to ${asOf}`, { sku: c.id, href: `/c/${c.id}`, set: c.set, price: now[1], chart: { label: "TCGplayer market", points: sparkOf(c.pts) }, startDate: c.pts[0][0], endDate: asOf });
    if (rr) out.push(rr);
    if (out.length >= max) break;
  }
  return out;
}

const ERA_GROUPS = [["WOTC", ["Original", "Neo"]], ["EX", ["EX"]], ["DP", ["Diamond & Pearl"]], ["HGSS", ["HeartGold & SoulSilver"]], ["BW", ["Black & White"]], ["XY", ["XY"]], ["SM", ["Sun & Moon"]], ["SWSH", ["Sword & Shield"]], ["SV", ["Scarlet & Violet"]], ["Mega Evolution", ["Mega Evolution"]]];
export function eraComparison(cards, { asOf, sets }) {
  const eraOf = new Map((sets?.sets || []).map((s) => [s.slug, s.era]));
  const days = [addDays(asOf, -365), asOf];
  const rows = [];
  for (const [label, eras] of ERA_GROUPS) {
    const pool = cards.filter((c) => eras.includes(eraOf.get(c.setSlug)) && !LOW.has(c.rarity));
    const b = basketValue(pool, days);
    if (b.n < 20) continue;
    rows.push({ label, n: b.n, a: b.total[0], z: b.total[1], ch: pctOf(b.total[0], b.total[1]) });
  }
  if (rows.length < 3) return [];
  rows.sort((a, z) => z.ch - a.ch);
  const best = rows[0], worst = rows.at(-1);
  const headline = `Eras over the past year: ${best.label} led, ${sgn(best.ch)}. ${worst.label} trailed, ${sgn(worst.ch)}.`;
  const lines = [
    ...rows.slice(0, 5).map((r) => `${r.label}: ${usd(r.a)} to ${usd(r.z)} (${sgn(r.ch)}), ${r.n} chase cards.`),
    `Same cards on both dates: ${dateLabel(days[0], asOf)} and ${monthDay(asOf)}, TCGplayer market.`,
  ];
  if (rows.length > 5) lines.splice(4, 1, `Also: ${rows.slice(4).map((r) => `${r.label} ${sgn(r.ch)}`).join(", ")}.`);
  const rr = row("era", asOf, "Eras", headline, lines, asOf, `TCGplayer market, ${days[0]} and ${asOf}; sets.json`, { href: "/sets", chart: { label: "1-year change by era, %", bars: rows.map((r) => [r.label, Math.round(r.ch)]) }, startDate: days[0], endDate: asOf, receipt: rows });
  return rr ? [rr] : [];
}

// How recent sets moved in their first 30 days, next to what is coming.
export function preReleaseContext(cards, { asOf, sets, releases }) {
  const done = [];
  for (const s of sets?.sets || []) {
    if (!s.release || s.release < "2024-03-01" || addDays(s.release, 37) > asOf) continue;
    const pool = cards.filter((c) => c.setSlug === s.slug && !LOW.has(c.rarity));
    const b = basketValue(pool, [addDays(s.release, 7), addDays(s.release, 37)]);
    if (b.n < 8) continue;
    done.push({ name: s.name, release: s.release, n: b.n, ch: pctOf(b.total[0], b.total[1]) });
  }
  const next = (releases?.releases || []).filter((r) => r.date >= asOf).slice(0, 2);
  if (done.length < 3 || !next.length) return [];
  done.sort((a, z) => z.release.localeCompare(a.release));
  const recent = done.slice(0, 5);
  const down = recent.filter((r) => r.ch < 0).length;
  const n0 = String(next[0].name).replace(/\s*[\u2014\u2013]\s*/g, ": ").replace(/^JP:\s*/, "Japan: ").replace(/\s*\([^)]*\)\s*$/, "");
  const headline = `Before ${n0} lands ${monthDay(next[0].date)}: ${down} of the last ${recent.length} sets we can measure went down in their first month.`;
  const lines = [
    ...recent.slice(0, 4).map((r) => `${r.name} (out ${dateLabel(r.release, asOf)}): ${sgn(r.ch)}, week 1 to week 5, ${r.n} chase cards.`),
    `Measured from day 7 to day 37 after release, same cards on both days, TCGplayer market. Past moves are history, not a forecast.`,
  ];
  const rr = row("prerelease", next[0].date, n0, headline, lines, asOf, `TCGplayer market; sets.json release dates; ${releases?.source || "releases.json"}, checked ${releases?.checked || ""}`, { href: "/releases", chart: { label: "First-month change, %", bars: recent.map((r) => [short(r.name), Math.round(r.ch)]) }, receipt: { recent, next: next.map((r) => ({ name: r.name, date: r.date })) } });
  return rr ? [rr] : [];
}

// Sealed product against its set's top chase card, every nightly day both have.
export function sealedGapDeep(products, histories, cards, rawProducts, { asOf, max = 10 }) {
  const top = new Map();
  for (const c of cards) { const g = short(c.set).toLowerCase(); if (c.pts.at(-1)?.[0] !== asOf) continue; if (!top.has(g) || c.pts.at(-1)[1] > top.get(g).pts.at(-1)[1]) top.set(g, c); }
  const out = [];
  for (const p of products || []) {
    const pid = Number(p.tcgPlayerId);
    const group = (pid && rawProducts?.get(pid)?.group) || p.set;
    const chase = top.get(short(p.set).toLowerCase()) || top.get(short(group).toLowerCase());
    const hp = (histories.get(p.id) || []).filter((x) => x?.market > 0).map((x) => [x.date, x.market]);
    if (!chase || hp.length < 7 || hp.at(-1)[0] !== asOf) continue;
    const cm = new Map(chase.pts);
    const both = hp.filter((x) => cm.has(x[0])).map((x) => [x[0], Math.round((x[1] / cm.get(x[0])) * 100) / 100]);
    if (both.length < 7) continue;
    const a = both[0], z = both.at(-1);
    const sa = hp.find((x) => x[0] === a[0])[1], sz = hp.at(-1)[1];
    const ca = cm.get(a[0]), cz = cm.get(z[0]);
    const inv = (r) => Math.round((1 / r) * 10) / 10;
    const headline = z[1] >= 1
      ? `${p.name} vs its top chase card: it costs ${z[1]}x ${cardTitle(chase)} tonight, from ${a[1]}x on ${monthDay(a[0])}.`
      : `${p.name} vs its top chase card: ${cardTitle(chase)} costs ${inv(z[1])}x the sealed price tonight, from ${inv(a[1])}x on ${monthDay(a[0])}.`;
    const lines = [
      `${p.name}: ${usd(sa)} (${monthDay(a[0])}) to ${usd(sz)} (${monthDay(asOf)}).`,
      `${cardTitle(chase)}: ${usd(ca)} to ${usd(cz)}, same days.`,
      `Ratio on ${both.length} nightly days both had a price, ${monthDay(a[0])} to ${monthDay(z[0])}, TCGplayer market.`,
      `Matched by set name: the chase card is the top-priced card in ${short(group)} tonight.`,
    ];
    const rr = row("sealedgap", p.id, p.name, headline, lines, asOf, `TCGplayer market, ${a[0]} to ${asOf}`, { sku: p.id, href: `/p/${p.id}`, chart: z[1] >= 1 ? { label: "Sealed price / chase card price", points: both } : { label: "Chase card price / sealed price", points: both.map((x) => [x[0], inv(x[1])]) }, startDate: a[0], endDate: asOf, weight: Math.abs(z[1] / a[1] - 1) });
    if (rr) out.push(rr);
  }
  return out.sort((a, z) => z.weight - a.weight).slice(0, max);
}

export function marketRoundup({ asOf, start, pool, histCounts, eraRow, releases }) {
  const priced = (pool || []).filter((p) => p.to >= 2);
  if (priced.length < 50) return [];
  const up = priced.filter((p) => p.to - p.from >= 1 && pctOf(p.from, p.to) >= 8).length;
  const down = priced.filter((p) => p.from - p.to >= 1 && pctOf(p.from, p.to) <= -8).length;
  const big = priced.slice().sort((a, z) => (z.to - z.from) - (a.to - a.from))[0];
  const soon = (releases?.releases || []).filter((r) => r.date >= asOf && r.date <= addDays(asOf, 30));
  const headline = `State of the market, week to ${monthDay(asOf)}: ${up} chase cards up 8% or more, ${down} down. ${down > up ? "A cooler week." : up > down ? "A warmer week." : "An even week."}`;
  const lines = [
    `${priced.length} chase cards counted, ${monthDay(start)} to ${monthDay(asOf)}, TCGplayer market.`,
    big ? `Biggest dollar climb: ${cleanName(big.name)}, ${usd(big.from)} to ${usd(big.to)}.` : "",
    histCounts ? `On the long history tonight: ${histCounts.high || 0} cards at a 52-week or longer high, ${histCounts.low || 0} at a low.` : "",
    eraRow ? eraRow.headline : "",
    soon.length ? `Next 30 days: ${soon.map((r) => `${String(r.name).replace(/\s*[\u2014\u2013]\s*/g, ": ").replace(/^JP:\s*/, "Japan: ").replace(/\s*\([^)]*\)\s*$/, "")} (${monthDay(r.date)})`).slice(0, 3).join(", ")}.` : "",
  ];
  const rr = row("market", asOf, "State of the market", headline, lines, asOf, `TCGplayer market, ${start} and ${asOf}`, { href: "/feed", chart: { label: "Cards up vs down", bars: [["Up 8%+", up], ["Down 8%+", down]] }, startDate: start, endDate: asOf });
  return rr ? [rr] : [];
}

// ── More deep types ──
const yearPair = (c, asOf) => {
  const a = valueOn(c.pts, addDays(asOf, -365)), z = c.pts.at(-1)?.[0] === asOf ? c.pts.at(-1)[1] : null;
  // Quality bar: a 5x+ year is left out of rankings, it can be a printing mix-up.
  return a != null && z != null && pctOf(a, z) <= 500 ? { a, z, ch: pctOf(a, z) } : null;
};

export function artistSpotlights(cards, { asOf, max = 12 }) {
  const by = new Map();
  for (const c of cards) { if (!c.artist || LOW.has(c.rarity)) continue; const y = yearPair(c, asOf); if (!y || y.z < 5) continue; if (!by.has(c.artist)) by.set(c.artist, []); by.get(c.artist).push({ c, ...y }); }
  const out = [];
  for (const [artist, rows] of by) {
    if (rows.length < 8) continue;
    const a = rows.reduce((s, r) => s + r.a, 0), z = rows.reduce((s, r) => s + r.z, 0);
    const best = rows.slice().sort((x, y) => y.ch - x.ch)[0];
    const top = rows.slice().sort((x, y) => y.z - x.z)[0];
    const up = rows.filter((r) => r.ch > 0).length;
    const ch = pctOf(a, z);
    const rr = row("artist", artist, artist, `Artist spotlight, ${artist}: ${rows.length} chase cards worth ${usd(z)} together, ${sgn(ch)} in a year.`, [
      `Together: ${usd(a)} (${dateLabel(addDays(asOf, -365), asOf)}) to ${usd(z)} (${monthDay(asOf)}), TCGplayer market.`,
      `${up} of ${rows.length} went up over the year.`,
      `Best year: ${cardTitle(best.c)}, ${usd(best.a)} to ${usd(best.z)}.`,
      `Priciest tonight: ${cardTitle(top.c)} at ${usd(top.z)}.`,
    ], asOf, `TCGplayer market, ${addDays(asOf, -365)} and ${asOf}; artist from the catalogue`, { href: `/artists/${String(artist).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`, chart: { label: "1-year change, top 6 cards, %", bars: rows.slice().sort((x, y) => y.z - x.z).slice(0, 6).map((r) => [barLabel(r.c, 18), Math.round(r.ch)]) }, startDate: addDays(asOf, -365), endDate: asOf, weight: rows.length });
    if (rr) out.push(rr);
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, max);
}

export function pokemonSpotlights(cards, { asOf, max = 15 }) {
  const by = new Map();
  for (const c of cards) { const t = speciesToken(c.name); const y = yearPair(c, asOf); if (!t || t.length < 3 || !y || y.z < 3) continue; if (!by.has(t)) by.set(t, []); by.get(t).push({ c, ...y }); }
  const out = [];
  for (const [t, rows] of by) {
    if (rows.length < 6) continue;
    rows.sort((x, y) => y.ch - x.ch);
    const best = rows[0], worst = rows.at(-1);
    const kept = rows.filter((r) => r.ch >= 0).length;
    const top = rows.slice().sort((x, y) => y.z - x.z)[0];
    const rr = row("pokemon", t, t, `${t} spotlight: of ${rows.length} cards with a year of prices, ${kept} kept or grew their price. Best: ${cardTitle(best.c)}, ${sgn(best.ch)}.`, [
      `Best year: ${cardTitle(best.c)}, ${usd(best.a)} to ${usd(best.z)}.`,
      `Toughest year: ${cardTitle(worst.c)}, ${usd(worst.a)} to ${usd(worst.z)}.`,
      `Priciest tonight: ${cardTitle(top.c)} at ${usd(top.z)}.`,
      `${dateLabel(addDays(asOf, -365), asOf)} to ${monthDay(asOf)}, TCGplayer market, matched by product id.`,
    ], asOf, `TCGplayer market, ${addDays(asOf, -365)} and ${asOf}`, { chart: { label: "1-year change, %", bars: rows.slice(0, 6).map((r) => [short(r.c.set).slice(0, 16), Math.round(r.ch)]) }, startDate: addDays(asOf, -365), endDate: asOf, weight: rows.length });
    if (rr) out.push(rr);
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, max);
}

const TIERS = [["SIR", /^Special Illustration Rare$/], ["IR", /^Illustration Rare$/], ["Gold", /^(Hyper Rare|Secret Rare|Rare Secret|Gold)/i], ["Full Art", /^(Ultra Rare|Rare Ultra|Full Art)/i], ["Holo", /^(Holo Rare|Rare Holo)$/i]];
export function rarityTierReports(cards, { asOf, sets }) {
  const eraOf = new Map((sets?.sets || []).map((s) => [s.slug, s.era]));
  const out = [];
  for (const era of ["Scarlet & Violet", "Sword & Shield", "Sun & Moon", "XY", "Mega Evolution"]) {
    const res = [];
    for (const [label, re] of TIERS) {
      const rows = cards.filter((c) => eraOf.get(c.setSlug) === era && re.test(c.rarity)).map((c) => yearPair(c, asOf)).filter(Boolean);
      if (rows.length < 8) continue;
      const a = rows.reduce((s, r) => s + r.a, 0), z = rows.reduce((s, r) => s + r.z, 0);
      res.push({ label, n: rows.length, a, z, ch: pctOf(a, z) });
    }
    if (res.length < 2) continue;
    res.sort((x, y) => y.ch - x.ch);
    const best = res[0];
    const fell = Math.abs(Math.round(best.ch * 10) / 10);
    const lead = best.ch < 0
      ? `${era} rarity report: every rarity fell over the year. ${best.label} cards fell least, down ${fell}%.`
      : `${era} rarity report: ${best.label} cards did best over the year, ${sgn(best.ch)}.`;
    const rr = row("tiers", era, era, lead, [
      ...res.map((r) => `${r.label}: ${usd(r.a)} to ${usd(r.z)} (${sgn(r.ch)}), ${r.n} cards.`),
      `Same cards on ${dateLabel(addDays(asOf, -365), asOf)} and ${monthDay(asOf)}, TCGplayer market.`,
    ], asOf, `TCGplayer market, ${addDays(asOf, -365)} and ${asOf}; rarity from TCGplayer`, { chart: { label: "1-year change by tier, %", bars: res.map((r) => [r.label, Math.round(r.ch)]) }, startDate: addDays(asOf, -365), endDate: asOf });
    if (rr) out.push(rr);
  }
  return out;
}

export function anniversaryReads(cards, { asOf, sets, window = 7 }) {
  const out = [];
  for (const s of sets?.sets || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.release || ""))) continue;
    const years = Number(asOf.slice(0, 4)) - Number(s.release.slice(0, 4));
    if (years < 1) continue;
    const ann = `${asOf.slice(0, 4)}-${s.release.slice(5)}`;
    const gap = dayNum(asOf) - dayNum(ann);
    if (gap < 0 || gap > window) continue;
    const pool = cards.filter((c) => c.setSlug === s.slug && !LOW.has(c.rarity));
    const since = s.release >= "2024-03-01" ? addDays(s.release, 7) : addDays(asOf, -365);
    const b = basketValue(pool, [since, asOf]);
    if (b.n < 8) continue;
    const ch = pctOf(b.total[0], b.total[1]);
    const top = pool.filter((c) => c.pts.at(-1)?.[0] === asOf).sort((x, y) => y.pts.at(-1)[1] - x.pts.at(-1)[1])[0];
    const rr = row("anniversary", s.slug, s.name, `Happy ${years}${years === 1 ? "st" : years === 2 ? "nd" : years === 3 ? "rd" : "th"} birthday, ${s.name} (out ${dateLabel(s.release, asOf)}). Its chase cards are ${sgn(ch)} since ${dateLabel(since, asOf)}.`, [
      `${b.n} chase cards: ${usd(b.total[0])} (${dateLabel(since, asOf)}) to ${usd(b.total[1])} (${monthDay(asOf)}), TCGplayer market.`,
      top ? `Top card tonight: ${cardTitle(top)} at ${usd(top.pts.at(-1)[1])}.` : "",
      `Released ${dateLabel(s.release, asOf)} (sets.json).`,
      s.release < "2024-03-01" ? "Our price history starts Feb 2024, so this compares the past year." : "Measured from one week after release.",
    ], asOf, `TCGplayer market, ${since} and ${asOf}; sets.json`, { href: `/sets/${s.slug}`, startDate: since, endDate: asOf });
    if (rr) out.push(rr);
  }
  return out;
}

// Rotation aftermath: sets that left Standard on a date inside our history.
export function rotationAftermath(cards, { asOf, rotation }) {
  const out = [];
  const groups = new Map();
  for (const s of rotation?.sets || []) { const m = /^Rotated (.+)$/.exec(String(s.status || "")); if (m) { const d = (rotation.sources || []).find((x) => x.mark === s.mark)?.date; if (d) { if (!groups.has(d)) groups.set(d, []); groups.get(d).push(s); } } }
  for (const [date, list] of groups) {
    const before = addDays(date, -30), after = addDays(date, 30);
    if (before < "2024-02-15" || after > asOf) continue;
    const res = [];
    for (const s of list) {
      const b = basketValue(cards.filter((c) => c.setSlug === s.slug && !LOW.has(c.rarity)), [before, after, asOf]);
      if (b.n >= 8) res.push({ name: s.name, n: b.n, t: b.total });
    }
    if (res.length < 2) continue;
    const sum = res.reduce((x, r) => x.map((v, i) => v + r.t[i]), [0, 0, 0]);
    const rr = row("rotation", date, `Rotation ${date}`, `Rotation aftermath: sets that left Standard on ${dateLabel(date, asOf)} went ${sgn(pctOf(sum[0], sum[1]))} from a month before to a month after.`, [
      ...res.slice(0, 4).map((r) => `${r.name}: ${usd(r.t[0])} (${dateLabel(before, asOf)}) to ${usd(r.t[1])} (${dateLabel(after, asOf)}), ${usd(r.t[2])} now, ${r.n} chase cards.`),
      `Since then: ${sgn(pctOf(sum[1], sum[2]))} to ${monthDay(asOf)}. Rotated sets historically stop getting new print runs.`,
    ], asOf, `TCGplayer market, ${before}, ${after} and ${asOf}; rotation-status.json`, { chart: { label: "Rotated sets, total", points: [[before, Math.round(sum[0])], [after, Math.round(sum[1])], [asOf, Math.round(sum[2])]] }, startDate: before, endDate: asOf });
    if (rr) out.push(rr);
  }
  return out;
}

export function recoveryWatch(cards, { asOf, max = 15, skip = new Set() }) {
  const out = [];
  for (const c of cards) {
    if (skip.has(c.id) || LOW.has(c.rarity) || c.pts.at(-1)?.[0] !== asOf || c.pts.at(-1)[1] < 20) continue;
    let peak = c.pts[0];
    let trough = null;
    for (const p of c.pts) { if (p[1] > peak[1]) { peak = p; trough = null; } else if (!trough || p[1] < trough[1]) trough = p; }
    const now = c.pts.at(-1);
    if (!trough || trough[1] > peak[1] * 0.7 || now[1] < trough[1] * 1.2 || now[1] >= peak[1]) continue;
    if (dayNum(asOf) - dayNum(trough[0]) > 365) continue;
    const back = Math.round(((now[1] - trough[1]) / (peak[1] - trough[1])) * 100);
    const rr = row("recovery", c.id, c.name, `Recovery watch: ${cardTitle(c)} fell ${Math.round(100 - (trough[1] / peak[1]) * 100)}% from its peak and has climbed back ${back}% of the way.`, [
      `Peak ${usd(peak[1])} on ${dateLabel(peak[0], asOf)}.`,
      `Low ${usd(trough[1])} on ${dateLabel(trough[0], asOf)}.`,
      `Tonight (${monthDay(asOf)}): ${usd(now[1])}, TCGplayer market.`,
    ], asOf, `TCGplayer market, ${peak[0]} to ${asOf}`, { sku: c.id, href: `/c/${c.id}`, price: now[1], chart: { label: "TCGplayer market", points: sparkOf(c.pts.filter((p) => p[0] >= peak[0])) }, startDate: peak[0], endDate: asOf, weight: now[1] });
    if (rr) out.push(rr);
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, max);
}

export function steadiest(cards, { asOf }) {
  const rows = [];
  for (const c of cards) {
    if (LOW.has(c.rarity) || c.pts.at(-1)?.[0] !== asOf || c.pts.at(-1)[1] < 50) continue;
    const yr = c.pts.filter((p) => p[0] >= addDays(asOf, -365));
    if (yr.length < 20 || dayNum(asOf) - dayNum(c.pts[0][0]) < 365) continue;
    const m = yr.reduce((s, p) => s + p[1], 0) / yr.length;
    const sd = Math.sqrt(yr.reduce((s, p) => s + (p[1] - m) ** 2, 0) / yr.length);
    rows.push({ c, cv: sd / m, lo: Math.min(...yr.map((p) => p[1])), hi: Math.max(...yr.map((p) => p[1])), n: yr.length });
  }
  rows.sort((a, z) => a.cv - z.cv);
  const top = rows.slice(0, 5);
  if (top.length < 3) return [];
  const rr = row("steady", asOf, "Steadiest cards", `The steadiest cards of the past year: ${cardTitle(top[0].c)} never left ${usd(top[0].lo)} to ${usd(top[0].hi)}.`, [
    ...top.map((r) => `${cardTitle(r.c)}: ${usd(r.lo)} to ${usd(r.hi)} across ${r.n} points.`),
    `Cards priced $50 or more tonight, ranked by how little they swung, ${dateLabel(addDays(asOf, -365), asOf)} to ${monthDay(asOf)}, TCGplayer market.`,
  ].slice(0, 6), asOf, `TCGplayer market, ${addDays(asOf, -365)} to ${asOf}`, { startDate: addDays(asOf, -365), endDate: asOf });
  return rr ? [rr] : [];
}

export function biggestYear(cards, { asOf, sets }) {
  const eraOf = new Map((sets?.sets || []).map((s) => [s.slug, s.era]));
  const out = [];
  for (const [label, eras] of ERA_GROUPS) {
    const rows = cards.filter((c) => eras.includes(eraOf.get(c.setSlug)) && !LOW.has(c.rarity)).map((c) => ({ c, ...(yearPair(c, asOf) || {}) })).filter((r) => r.a >= 5 && r.z - r.a >= 5);
    if (rows.length < 3) continue;
    rows.sort((x, y) => y.ch - x.ch);
    const top = rows.slice(0, 3);
    const rr = row("bigyear", label, label, `Biggest year in ${label}: ${cardTitle(top[0].c)} went ${usd(top[0].a)} to ${usd(top[0].z)}.`, [
      ...top.map((r, i) => `${i + 1}. ${cardTitle(r.c)}: ${usd(r.a)} to ${usd(r.z)}, ${sgn(r.ch)}.`),
      `${dateLabel(addDays(asOf, -365), asOf)} to ${monthDay(asOf)}, TCGplayer market. Cards priced $5 or more a year ago that gained $5 or more.`,
    ], asOf, `TCGplayer market, ${addDays(asOf, -365)} and ${asOf}`, { chart: { label: "1-year change, %", bars: top.map((r) => [barLabel(r.c, 18), Math.round(r.ch)]) }, startDate: addDays(asOf, -365), endDate: asOf });
    if (rr) out.push(rr);
  }
  return out;
}

// IR lifecycle: a nightly port of the IR study (/workspace/ir-study/run.py).
// Illustration Rares against plain holos (the baseline) and SIRs, same sets,
// same dates, TCGplayer market, real points within 8 days only.
function median(xs) { const a = xs.slice().sort((x, y) => x - y); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; }
function irGroup(c) {
  const sv = /^(SV|ME)/.test(c.set);
  if (sv && c.rarity === "Illustration Rare") return "IR";
  if (sv && c.rarity === "Special Illustration Rare") return "SIR";
  if (sv && c.rarity === "Rare" && c.printing === "Holofoil") return "Holo";
  return null;
}
const pctTxt = (x) => `${x >= 0 ? "" : "-"}${Math.abs(Math.round(x * 100))}%`;
export function irLifecycle(cards, { asOf }) {
  const g = { y1: { IR: [], Holo: [], SIR: [] }, new6: { IR: [], Holo: [] } };
  let best = null;
  const firstFor = new Map();
  for (const c of cards) {
    const grp = irGroup(c);
    if (!grp || !/^\d{4}-\d{2}-\d{2}$/.test(c.release || "")) continue;
    const now = valueOn(c.pts, asOf, 3);
    if (now == null) continue;
    const y1d = addDays(c.release, 365);
    if (c.release >= "2023-01-01" && c.release < "2025-01-01" && y1d <= asOf) {
      const y1 = valueOn(c.pts, y1d);
      if (y1) g.y1[grp].push(now / y1 - 1);
    }
    if (c.release >= "2025-03-01" && c.release < "2026-03-01" && grp !== "SIR") {
      const rel = valueOn(c.pts, addDays(c.release, 30), 40), m6 = valueOn(c.pts, addDays(c.release, 182));
      if (rel && m6 && addDays(c.release, 182) <= asOf) g.new6[grp].push(m6 / rel - 1);
    }
    const first = c.pts[0];
    if (grp === "IR" && first[0] >= c.release && first[1] > 0) {
      const ch = now / first[1] - 1;
      if (!best || ch > best.ch) best = { c, first, now, ch };
    }
    if (grp === "Holo" && first[0] >= c.release) { if (!firstFor.has(c.set)) firstFor.set(c.set, []); firstFor.get(c.set).push({ c, first, now }); }
  }
  const m = (xs) => median(xs);
  const ir1 = m(g.y1.IR), h1 = m(g.y1.Holo), s1 = m(g.y1.SIR), ir6 = m(g.new6.IR), h6 = m(g.new6.Holo);
  if (ir1 == null || h1 == null || ir6 == null || h6 == null || !best || g.y1.IR.length < 30) return [];
  // Holo baseline for the top IR: plain holos from its set, from their first point to tonight.
  const peers = (firstFor.get(best.c.set) || []).map((h) => h.now / h.first[1] - 1);
  const hb = m(peers);
  const day = monthDay(asOf) + ", " + asOf.slice(0, 4);
  const read1 = `IRs after the spotlight moves on: IRs from 2023-24 Scarlet & Violet sets rose a median ${pctTxt(ir1)} from one year after release to ${day} (${g.y1.IR.length} cards, TCGplayer market). Plain holos from the same sets rose ${pctTxt(h1)}${s1 != null ? `, SIRs ${pctTxt(s1)}` : ""}.`;
  const read2 = `New-set IRs, first 6 months: IRs from sets released Mar 2025 to Feb 2026 moved a median ${pctTxt(ir6)} in their first 6 months (${g.new6.IR.length} cards, TCGplayer market).`;
  // Its holo baseline is a different group and window from the headline (newer sets, first 6 months),
  // so the line names both. The headline's own holo baseline (h1) is read 1 and the line below.
  const holo2 = `Holo baseline for those newer sets, same first 6 months: ${pctTxt(h6)} (${g.new6.Holo.length} cards).`;
  const holo1 = `Holo baseline: plain holos from those 2023-24 sets rose a median ${pctTxt(h1)} over the same stretch (${g.y1.Holo.length} cards).`;
  const read3 = `${cardTitle(best.c)} IR: ${usd(best.first[1])} in ${monthYear(best.first[0])}, ${usd(best.now)} on ${day} on TCGplayer market. Up ${Math.round(best.ch * 100)}%, the largest IR climb in our history file.`;
  const holo3 = hb != null ? `Holo baseline for ${short(best.c.set)}: plain holos moved a median ${pctTxt(hb)} from their first point to ${monthDay(asOf)} (${peers.length} cards).` : "";
  const rr = row("irlife", asOf, "IR lifecycle", `IR lifecycle: older Scarlet & Violet IRs rose a median ${pctTxt(ir1)} since their first birthday. Plain holos from the same sets: ${pctTxt(h1)}.`, [read1, holo1, read2, holo2, read3, holo3], asOf,
    `TCGplayer market, buckets and hist-long, ${asOf}; method from the Catch'em IR study`, { chart: { label: "Median change, 1 year after release to tonight, %", bars: [["IR", Math.round(ir1 * 100)], ["Holo", Math.round(h1 * 100)], ...(s1 != null ? [["SIR", Math.round(s1 * 100)]] : [])] }, receipt: { ir1, h1, s1, ir6, h6, n: { ir1: g.y1.IR.length, h1: g.y1.Holo.length, s1: g.y1.SIR.length, ir6: g.new6.IR.length, h6: g.new6.Holo.length }, best: { id: best.c.id, from: best.first, to: best.now } } });
  return rr ? [rr] : [];
}
