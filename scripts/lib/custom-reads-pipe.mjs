// Custom Reads pipe. Member follows come from the site worker and stay out of
// git (this repo is public). The night's DMs go back to the worker as one
// outbox the bot reads. Lines are plain dated facts that pass the copy rules.

import { isClean } from "./copy-rules.mjs";
import { artType } from "./art-type.mjs";
import { eraOf } from "./public-bundle.mjs";

const money = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDay = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};
const bareSet = (name) => String(name || "").replace(/^[^:]*:\s*/, "").trim().toLowerCase();
const plainSet = (name) => String(name || "").replace(/^[^:]*:\s*/, "").trim();

export function eraKey(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function sameLabel(a, b) {
  return eraKey(a) !== "" && eraKey(a) === eraKey(b);
}

// "Umbreon ex - 161/131" plus number 161/131 becomes "Umbreon ex 161/131".
export function cardTitle(name, number) {
  let title = String(name || "").replace(/\s+/g, " ").trim();
  const num = String(number || "").trim();
  if (title && num && title.toLowerCase().endsWith(num.toLowerCase())) {
    title = title.slice(0, title.length - num.length).replace(/[\s-]+$/, "").trim();
  }
  if (title && num) return `${title} ${num}`;
  if (title) return title;
  return num ? `#${num}` : "";
}

function hasPokemon(name, pokemon) {
  const want = String(pokemon || "").toLowerCase();
  if (!want) return false;
  const words = String(name || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.includes(want);
}

function cardArt(row) {
  if (row?.art) return String(row.art);
  return artType({
    name: row?.name || "",
    rarity: row?.rarity || "",
    num: row?.number || row?.num || "",
    number: row?.number || row?.num || "",
    printing: row?.printing || "",
    kind: "single",
    tags: row?.tags,
  });
}

// Reads for one night, built from files the nightly already writes.
export function poolFromData({ catalogue, sealed } = {}) {
  const day = String(catalogue?.asOf || String(sealed?.updatedAt || "").slice(0, 10) || "");
  const reads = [];
  const when = shortDay(day);
  for (const set of catalogue?.sets || []) {
    if (!set?.released || !set.slug) continue;
    const priced = (set.prices || []).filter((p) => Number(p?.price) > 0);
    const top = [...priced].sort((a, b) => b.price - a.price).slice(0, 3);
    if (top.length) {
      reads.push({
        id: `set-${set.slug}-${day}`,
        set: set.slug,
        era: set.era || eraOf(set.name || ""),
        kind: "single",
        price: Number(top[0].price) || 0,
        line: `${set.name}: top cards on TCGplayer market are ${top.map((p) => `#${p.number} at ${money(p.price)}`).join(", ")}, as of ${when}.`,
      });
    }
    for (const p of priced) {
      const art = cardArt(p);
      const title = cardTitle(p.name, p.number);
      const where = plainSet(set.name) || set.name;
      reads.push({
        id: `card-${p.id}-${day}`,
        set: set.slug,
        cardId: p.id,
        kind: "card",
        name: p.name || "",
        number: p.number || "",
        art,
        rarity: p.rarity || "",
        era: set.era || eraOf(set.name || ""),
        price: Number(p.price) || 0,
        line: `${title}, ${where} is ${money(p.price)} on TCGplayer market, as of ${when}.`,
      });
    }
  }
  const setByName = new Map((catalogue?.sets || []).map((s) => [bareSet(s.name), s]));
  for (const row of sealed?.products || []) {
    if (!row?.tcgPlayerId || row.dataStatus !== "live") continue;
    const ask = Number(row.askMedian || row.priceMedian || row.priceUsd);
    const count = Number(row.listingCount);
    if (!(ask > 0) || !(count > 0)) continue;
    const home = setByName.get(bareSet(row.set)) || null;
    reads.push({
      id: `sealed-${row.id}-${day}`,
      set: home?.slug || "",
      cardId: `tcgcsv-${row.tcgPlayerId}`,
      kind: "sealed",
      name: row.name || "",
      era: home?.era || eraOf(home?.name || row.set || ""),
      price: ask,
      line: `${row.name}: ${count} eBay listings counted, middle ask ${money(ask)}, as of ${when}.`,
    });
  }
  return { day, reads: reads.filter((r) => r.line.length <= 220 && !/[\u2013\u2014]/.test(r.line) && isClean(r.line)) };
}

// A set, a watched item, a Pokemon, a rarity, or an era narrows a follow.
// Kind alone does not match the catalogue. Card lines stay out of a set-only follow.
export function memberMatch(follow, read) {
  if (!follow || !read) return false;
  const kinds = Array.isArray(follow.kinds) ? follow.kinds : [];
  const watched = [...(follow.cards || []), ...(follow.sealed || [])];
  if (read.cardId && watched.includes(read.cardId)) return true;
  const sets = Array.isArray(follow.sets) ? follow.sets : [];
  const pokemon = Array.isArray(follow.pokemon) ? follow.pokemon : [];
  const rarities = Array.isArray(follow.rarities) ? follow.rarities : [];
  const eras = Array.isArray(follow.eras) ? follow.eras : [];
  if (!sets.length && !pokemon.length && !rarities.length && !eras.length) return false;
  if (sets.length && !sets.includes(read.set)) return false;
  if (eras.length && !eras.some((era) => sameLabel(era, read.era))) return false;
  const cardPick = pokemon.length > 0 || rarities.length > 0;
  if (read.kind === "card") {
    if (!cardPick) return false;
    if (kinds.length && !kinds.includes("single") && !kinds.includes("card")) return false;
    if (pokemon.length && !pokemon.some((name) => hasPokemon(read.name || read.line, name))) return false;
    if (rarities.length && !rarities.some((name) => sameLabel(name, read.art) || sameLabel(name, read.rarity))) return false;
    return true;
  }
  if (cardPick && !sets.length && !eras.length) return false;
  if (kinds.length && !kinds.includes(read.kind)) return false;
  return sets.length > 0 || eras.length > 0;
}

const QUARTER_MONTHS = new Set(["01", "04", "07", "10"]);
export function dueOn(follow, day, now = Date.now()) {
  const saved = Date.parse(follow?.savedAt || "");
  if (Number.isFinite(saved) && now - saved >= 0 && now - saved < 36 * 3600 * 1000) return true;
  const often = String(follow?.frequency || "weekly");
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const [, mm, dd] = day.split("-");
  if (often === "daily") return true;
  if (often === "monthly") return dd === "01";
  if (often === "quarterly") return dd === "01" && QUARTER_MONTHS.has(mm);
  return d.getUTCDay() === 0; // weekly lands on Sunday
}

export function buildOutbox({ follows = [], pool = { day: "", reads: [] }, news = [], games = [], now = Date.now(), limit = 6 } = {}) {
  const day = pool.day || new Date(now).toISOString().slice(0, 10);
  const members = [];
  let notDue = 0;
  let quiet = 0;
  for (const follow of follows) {
    const id = String(follow?.discordId || follow?.id || "").replace(/^d:/, "");
    if (!/^\d{5,25}$/.test(id)) continue;
    if (!dueOn(follow, day, now)) { notDue++; continue; }
    const reads = (pool.reads || [])
      .filter((read) => memberMatch(follow, read))
      .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
      .slice(0, limit)
      .map((read) => ({ line: read.line }));
    const row = { discordId: id, lead: `Your ${follow.frequency || "weekly"} Catch'em read, ${shortDay(day)}.`, reads };
    if (follow.news === true && news.length) {
      const rows = news.filter((row) => isClean(row?.headline) && isClean(row?.line)).slice(0, 3);
      if (rows.length) row.news = rows;
    }
    if (follow.games === true && games.length) {
      const rows = games.filter((row) => isClean(row?.headline) && isClean(row?.line)).slice(0, 3);
      if (rows.length) row.games = rows;
    }
    if (!reads.length && !row.news && !row.games) { quiet++; continue; }
    members.push(row);
  }
  return { day, builtAt: new Date(now).toISOString(), members, counts: { follows: follows.length, members: members.length, notDue, quiet } };
}

// One sample line per picker chip. No member ids. The site embeds this file.
export const PREVIEW_PICKS = [
  ["set:me-30th-celebration", { sets: ["me-30th-celebration"], kinds: ["single"] }],
  ["set:me-ascended-heroes", { sets: ["me-ascended-heroes"], kinds: ["single"] }],
  ["set:me05-pitch-black", { sets: ["me05-pitch-black"], kinds: ["single"] }],
  ["set:sv-prismatic-evolutions", { sets: ["sv-prismatic-evolutions"], kinds: ["single"] }],
  ["set:sv10-destined-rivals", { sets: ["sv10-destined-rivals"], kinds: ["single"] }],
  ["set:sv-black-bolt", { sets: ["sv-black-bolt"], kinds: ["single"] }],
  ["pokemon:Pikachu", { pokemon: ["Pikachu"], kinds: ["single"] }],
  ["pokemon:Charizard", { pokemon: ["Charizard"], kinds: ["single"] }],
  ["pokemon:Eevee", { pokemon: ["Eevee"], kinds: ["single"] }],
  ["pokemon:Umbreon", { pokemon: ["Umbreon"], kinds: ["single"] }],
  ["pokemon:Mew", { pokemon: ["Mew"], kinds: ["single"] }],
  ["rarity:Illustration Rare", { rarities: ["Illustration Rare"], kinds: ["single"] }],
  ["rarity:Special Illustration Rare", { rarities: ["Special Illustration Rare"], kinds: ["single"] }],
  ["rarity:Ultra Rare", { rarities: ["Ultra Rare"], kinds: ["single"] }],
  ["era:Scarlet and Violet", { eras: ["Scarlet and Violet"], kinds: ["single"] }],
  ["era:Sword and Shield", { eras: ["Sword and Shield"], kinds: ["single"] }],
  ["era:Sun and Moon", { eras: ["Sun and Moon"], kinds: ["single"] }],
  ["era:Mega Evolution", { eras: ["Mega Evolution"], kinds: ["single"] }],
];

export function previewLines(pool) {
  const reads = pool?.reads || [];
  const lines = {};
  for (const [key, follow] of PREVIEW_PICKS) {
    const hit = reads
      .filter((read) => memberMatch(follow, read) && isClean(read.line))
      .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))[0];
    if (hit) lines[key] = hit.line;
  }
  const sealed = reads
    .filter((read) => read.kind === "sealed" && isClean(read.line))
    .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))[0];
  if (sealed) lines["product:sealed"] = sealed.line;
  return { asOf: pool?.day || "", lines };
}

export async function fetchFollows({ base, token, fetchImpl = fetch }) {
  const res = await fetchImpl(new URL("/api/reads/export", base), { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`follows export answered ${res.status}`);
  const doc = await res.json();
  if (!doc || !Array.isArray(doc.follows)) throw new Error("follows export has no follows list");
  return doc.follows;
}

export async function putOutbox({ base, token, outbox, fetchImpl = fetch }) {
  const { counts, ...body } = outbox;
  const res = await fetchImpl(new URL("/api/reads/outbox", base), {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`outbox store answered ${res.status}`);
  return res.json();
}
