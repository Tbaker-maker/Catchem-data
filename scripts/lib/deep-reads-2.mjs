// Deep reads, round 2: every printing of a Pokémon, one rarity across sets,
// chase lists per set with history, and the slump watch.
// Every card carries its real rarity label for its generation (realLabel).
// Card reads use singles prices only; no sealed data.

import { money } from "./public-bundle.mjs";
import { monthDay } from "./takes.mjs";
import { addDays, dateLabel } from "./history-reads.mjs";
import { speciesToken } from "./fact-reads.mjs";
import { row, valueOn, sparkOf } from "./deep-reads.mjs";

const short = (s) => String(s || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
const cleanName = (n) => String(n || "").replace(/\s+-\s+[A-Z]*\d+\/[A-Z]*\d+\s*$/, "").replace(/\s*\((?:Alternate Full Art|Alternate Art Secret|Alternate Art|Secret|Full Art)\)\s*$/i, "").trim();
const numTxt = (c) => (c.number ? ` #${c.number}` : "");
const sgn = (n) => `${n >= 0 ? "up" : "down"} ${Math.abs(Math.round(n))}%`;
const JUNK = new Set(["", "None", "Unconfirmed", "Code Card"]);
const LOW = new Set(["Common", "Uncommon", "Code Card", "None", "", "Unconfirmed"]);
const SWSH = (c) => String(c.release || "") >= "2020-02" && String(c.release || "") < "2023-03";
const SM = (c) => String(c.release || "") >= "2017-02" && String(c.release || "") < "2020-02";

// The public label: real rarity per generation, never mixed.
// IR and SIR only when TCGplayer's rarity says so (Scarlet & Violet on).
// Alternate Art only on Sword & Shield. Tag Team (Alternate Art) only on Sun & Moon.
// Trainer Gallery and Galarian Gallery are Sword & Shield subsets.
export function realLabel(c, tags = []) {
  const t = new Set(tags);
  if (c.rarity === "Special Illustration Rare" || c.rarity === "Illustration Rare") return c.rarity;
  if (t.has("Tag Team (Alternate Art)") && SM(c)) return "Tag Team (Alternate Art)";
  if (t.has("Alternate Art") && SWSH(c)) return "Alternate Art";
  if (t.has("Galarian Gallery") && SWSH(c)) return "Galarian Gallery";
  if (t.has("Trainer Gallery") && SWSH(c)) return "Trainer Gallery";
  return JUNK.has(c.rarity) ? "" : c.rarity;
}

const now = (c, asOf) => (c.pts.at(-1)?.[0] === asOf ? c.pts.at(-1)[1] : null);
const yearAgo = (c, asOf) => valueOn(c.pts, addDays(asOf, -365));
const yrLine = (c, asOf) => { const a = yearAgo(c, asOf), z = now(c, asOf); const ch = a && z ? ((z - a) / a) * 100 : null; return ch != null && Math.abs(ch) <= 500 ? `, ${sgn(ch)} in a year` : ""; };

function labelled(cards, tagsOf, asOf, minPrice = 1) {
  const out = [];
  for (const c of cards) {
    const z = now(c, asOf);
    if (!z || z < minPrice) continue;
    const label = realLabel(c, tagsOf(c.id));
    if (!label) continue;
    out.push({ c, z, label });
  }
  return out;
}

// Every printing of one Pokémon, each with its own label, tonight's price first.
export function everyPrinting(cards, tagsOf, { asOf, max = 12 }) {
  const by = new Map();
  for (const r of labelled(cards, tagsOf, asOf, 2)) {
    const t = speciesToken(r.c.name);
    if (!t || t.length < 3) continue;
    if (!by.has(t)) by.set(t, []);
    by.get(t).push(r);
  }
  const groups = [...by.entries()].filter(([, rs]) => rs.length >= 6).map(([t, rs]) => ({ t, rs: rs.sort((a, b) => b.z - a.z), total: rs.reduce((s, r) => s + r.z, 0) }));
  groups.sort((a, b) => b.total - a.total);
  const out = [];
  for (const g of groups.slice(0, max)) {
    const labels = new Map();
    for (const r of g.rs) labels.set(r.label, (labels.get(r.label) || 0) + 1);
    const mix = [...labels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, n]) => `${n} ${l}`).join(", ");
    const top = g.rs.slice(0, 4);
    const rr = row("printings", g.t, g.t, `Every ${g.t} printing we price: ${g.rs.length} cards, from ${money(g.rs.at(-1).z)} to ${money(g.rs[0].z)} tonight.`, [
      ...top.map((r) => `${cleanName(r.c.name)}, ${r.label} (${short(r.c.set)}${numTxt(r.c)}): ${money(r.z)}${yrLine(r.c, asOf)}.`),
      `Most common labels: ${mix}.`,
      `TCGplayer market, ${monthDay(asOf)}. Each label is the card's own rarity in its set.`,
    ], asOf, `TCGplayer market, ${asOf}; rarity from TCGplayer and the catalogue`, { href: `/search?q=${encodeURIComponent(g.t)}`, chart: { label: `Top ${g.t} printings tonight, $`, bars: g.rs.slice(0, 6).map((r) => [`${short(r.c.set)}`.slice(0, 16), Math.round(r.z)]) }, weight: g.total });
    if (rr) out.push(rr);
  }
  return out;
}

const CHASE_LABELS = ["Special Illustration Rare", "Illustration Rare", "Alternate Art", "Tag Team (Alternate Art)", "Trainer Gallery", "Galarian Gallery", "Secret Rare", "Hyper Rare", "Ultra Rare"];

// One Pokémon, one label, across sets: e.g. every Charizard Special Illustration Rare.
export function sameLabelAcrossSets(cards, tagsOf, { asOf, max = 12 }) {
  const by = new Map();
  for (const r of labelled(cards, tagsOf, asOf, 3)) {
    if (!CHASE_LABELS.includes(r.label)) continue;
    const t = speciesToken(r.c.name);
    if (!t || t.length < 3) continue;
    const k = `${t}|${r.label}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const groups = [];
  for (const [k, rs] of by) {
    const sets = new Set(rs.map((r) => r.c.set));
    if (sets.size < 3) continue;
    const [t, label] = k.split("|");
    groups.push({ t, label, rs: rs.sort((a, b) => b.z - a.z), total: rs.reduce((s, r) => s + r.z, 0) });
  }
  groups.sort((a, b) => b.total - a.total);
  const out = [];
  for (const g of groups.slice(0, max)) {
    const top = g.rs.slice(0, 4);
    const rr = row("samelabel", `${g.t}-${g.label}`, `${g.t} ${g.label}`, `${g.t} ${g.label} cards by set: ${g.rs.length} on file, led by ${short(g.rs[0].c.set)} at ${money(g.rs[0].z)}.`, [
      ...top.map((r) => `${short(r.c.set)}: ${cleanName(r.c.name)}${numTxt(r.c)} ${money(r.z)}${yrLine(r.c, asOf)}.`),
      `Lowest: ${short(g.rs.at(-1).c.set)} at ${money(g.rs.at(-1).z)}.`,
      `TCGplayer market, ${monthDay(asOf)}. Only cards whose own rarity is ${g.label}.`,
    ].slice(0, 6), asOf, `TCGplayer market, ${asOf}; rarity from TCGplayer and the catalogue`, { href: `/search?q=${encodeURIComponent(`${g.t} ${g.label}`)}`, chart: { label: `${g.t} ${g.label} by set, $`, bars: g.rs.slice(0, 6).map((r) => [short(r.c.set).slice(0, 16), Math.round(r.z)]) }, weight: g.total });
    if (rr) out.push(rr);
  }
  return out;
}

// Chase list per set: the top 5 singles tonight with their price a year ago.
export function chaseLists(cards, tagsOf, { asOf, max = 15 }) {
  const by = new Map();
  for (const r of labelled(cards, tagsOf, asOf, 5)) {
    if (LOW.has(r.c.rarity)) continue;
    if (!by.has(r.c.set)) by.set(r.c.set, []);
    by.get(r.c.set).push(r);
  }
  const groups = [...by.entries()].filter(([, rs]) => rs.length >= 5).map(([set, rs]) => ({ set, rs: rs.sort((a, b) => b.z - a.z).slice(0, 5) }));
  for (const g of groups) g.total = g.rs.reduce((s, r) => s + r.z, 0);
  groups.sort((a, b) => b.total - a.total);
  const out = [];
  for (const g of groups.slice(0, max)) {
    const withYear = g.rs.filter((r) => yearAgo(r.c, asOf));
    const a = withYear.reduce((s, r) => s + yearAgo(r.c, asOf), 0), z = withYear.reduce((s, r) => s + r.z, 0);
    const head = withYear.length === 5
      ? `${short(g.set)} chase list: the top 5 are worth ${money(g.total)} together, ${sgn(((z - a) / a) * 100)} from a year ago.`
      : `${short(g.set)} chase list: the top 5 are worth ${money(g.total)} together tonight.`;
    const rr = row("chase", g.set, short(g.set), head, [
      ...g.rs.map((r) => { const y = yearAgo(r.c, asOf); return `${cleanName(r.c.name)}, ${r.label}: ${money(r.z)}${y ? ` (was ${money(y)} on ${dateLabel(addDays(asOf, -365), asOf)})` : ""}.`; }),
      `TCGplayer market, ${monthDay(asOf)}.`,
    ], asOf, `TCGplayer market, ${addDays(asOf, -365)} and ${asOf}`, { href: g.rs[0].c.setSlug ? `/sets/${g.rs[0].c.setSlug}` : "", chart: { label: "Top 5 tonight, $", bars: g.rs.map((r) => [cleanName(r.c.name).slice(0, 16), Math.round(r.z)]) }, weight: g.total });
    if (rr) out.push(rr);
  }
  return out;
}

// Slump watch: a card that set a 1-year high in the last 120 days and is now 25% or more below it.
export function slumpWatch(cards, tagsOf, { asOf, max = 12, skip = new Set() }) {
  const rows = [];
  for (const r of labelled(cards, tagsOf, asOf, 20)) {
    const c = r.c;
    if (skip.has(c.id) || LOW.has(c.rarity)) continue;
    const yr = c.pts.filter((p) => p[0] >= addDays(asOf, -365));
    if (yr.length < 10) continue;
    const peak = yr.reduce((m, p) => (p[1] > m[1] ? p : m), yr[0]);
    if (peak[0] < addDays(asOf, -120) || peak[0] === asOf) continue;
    const drop = (1 - r.z / peak[1]) * 100;
    if (drop < 25 || drop > 80) continue;
    rows.push({ ...r, peak, drop });
  }
  rows.sort((a, b) => b.peak[1] - b.z - (a.peak[1] - a.z));
  const out = [];
  for (const s of rows.slice(0, max)) {
    const y = yearAgo(s.c, asOf);
    const rr = row("slump", s.c.id, s.c.name, `Slump watch: ${cleanName(s.c.name)}, ${s.label} (${short(s.c.set)}), is ${Math.round(s.drop)}% under its ${dateLabel(s.peak[0], asOf)} high.`, [
      `High ${money(s.peak[1])} on ${dateLabel(s.peak[0], asOf)}, the top of the past year.`,
      `Tonight (${monthDay(asOf)}): ${money(s.z)}.`,
      y ? `A year ago: ${money(y)}.` : `No price on file a year ago.`,
      `TCGplayer market, singles only.`,
    ], asOf, `TCGplayer market, ${addDays(asOf, -365)} to ${asOf}`, { sku: s.c.id, href: `/c/${s.c.id}`, price: s.z, chart: { label: "TCGplayer market, past year", points: sparkOf(s.c.pts.filter((p) => p[0] >= addDays(asOf, -365))) }, startDate: s.peak[0], endDate: asOf });
    if (rr) out.push(rr);
  }
  return out;
}
