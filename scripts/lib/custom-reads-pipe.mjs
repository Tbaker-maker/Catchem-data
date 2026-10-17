// Custom Reads pipe. Member follows come from the site worker and stay out of
// git (this repo is public). The night's DMs go back to the worker as one
// outbox the bot reads. Lines are plain dated facts that pass the copy rules.

import { isClean } from "./copy-rules.mjs";

const money = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDay = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};
const bareSet = (name) => String(name || "").replace(/^[^:]*:\s*/, "").trim().toLowerCase();

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
        kind: "single",
        line: `${set.name}: top cards on TCGplayer market are ${top.map((p) => `#${p.number} at ${money(p.price)}`).join(", ")}, as of ${when}.`,
      });
    }
    for (const p of priced) {
      reads.push({ id: `card-${p.id}-${day}`, set: set.slug, cardId: p.id, kind: "card", line: `${set.name} #${p.number} is ${money(p.price)} on TCGplayer market, as of ${when}.` });
    }
  }
  const setByName = new Map((catalogue?.sets || []).map((s) => [bareSet(s.name), s.slug]));
  for (const row of sealed?.products || []) {
    if (!row?.tcgPlayerId || row.dataStatus !== "live") continue;
    const ask = Number(row.askMedian || row.priceMedian || row.priceUsd);
    const count = Number(row.listingCount);
    if (!(ask > 0) || !(count > 0)) continue;
    reads.push({
      id: `sealed-${row.id}-${day}`,
      set: setByName.get(bareSet(row.set)) || "",
      cardId: `tcgcsv-${row.tcgPlayerId}`,
      kind: "sealed",
      line: `${row.name}: ${count} eBay listings counted, middle ask ${money(ask)}, as of ${when}.`,
    });
  }
  return { day, reads: reads.filter((r) => r.line.length <= 220 && !/[\u2013\u2014]/.test(r.line) && isClean(r.line)) };
}

// A set or watched item narrows a follow. Kind alone only matches set lines.
export function memberMatch(follow, read) {
  if (!follow || !read) return false;
  const kinds = Array.isArray(follow.kinds) ? follow.kinds : [];
  const watched = [...(follow.cards || []), ...(follow.sealed || [])];
  if (read.cardId && watched.includes(read.cardId)) return true;
  if (read.kind === "card") return false;
  const sets = Array.isArray(follow.sets) ? follow.sets : [];
  if (sets.length) return sets.includes(read.set) && (!kinds.length || kinds.includes(read.kind));
  return false;
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
    const reads = (pool.reads || []).filter((read) => memberMatch(follow, read)).slice(0, limit).map((read) => ({ line: read.line }));
    const row = { discordId: id, lead: `Your ${follow.frequency || "weekly"} Catch'em read, ${shortDay(day)}.`, reads };
    if (follow.news === true && news.length) row.news = news.slice(0, 3);
    if (follow.games === true && games.length) row.games = games.slice(0, 3);
    if (!reads.length && !row.news && !row.games) { quiet++; continue; }
    members.push(row);
  }
  return { day, builtAt: new Date(now).toISOString(), members, counts: { follows: follows.length, members: members.length, notDue, quiet } };
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
