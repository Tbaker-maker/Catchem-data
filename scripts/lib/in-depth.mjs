// In-depth reads. A row is returned only when it qualifies. No averages.
// Prices are the numbers passed in. A missing price is not filled.
import { money } from "./public-bundle.mjs";
import { centsOf, floorOk } from "./read-quality.mjs";
import { monthDay } from "./takes.mjs";

const KINDS = new Set(["v", "vmax", "vstar", "illustration rare"]);

function daySpan(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to || ""))) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function sideMove(side) {
  const from = Number(side?.from);
  const to = Number(side?.to);
  if (!(from > 0) || !(to > 0)) return null;
  const pct = ((to - from) / from) * 100;
  return { from, to, pct, clears: floorOk(from, to, pct), count: Number(side.count) };
}

export function sealedVsChase({ set, start, end, sealed, chase } = {}) {
  if (daySpan(start, end) !== 7) return null;
  if (sealed?.level != null || chase?.level != null) return null;
  const left = sideMove(sealed);
  const right = sideMove(chase);
  if (!left || !right) return null;
  if (!Number.isInteger(left.count) || left.count < 1 || !Number.isInteger(right.count) || right.count < 1) return null;
  if (left.clears === right.clears) return null;
  const moved = left.clears ? "sealed" : "chase";
  const a = moved === "sealed" ? left : right;
  const b = moved === "sealed" ? right : left;
  const other = moved === "sealed" ? "chase" : "sealed";
  const sentence = `${moved[0].toUpperCase()}${moved.slice(1)} moved. ${set} ${moved} TCGplayer market: ${money(a.to)} (${end}), from ${money(a.from)} (${start}). ${other[0].toUpperCase()}${other.slice(1)} was ${money(b.from)} (${start}) and ${money(b.to)} (${end}). ${left.count} sealed products and ${right.count} chase cards were priced on both days.`;
  if (/average|level/i.test(sentence)) return null;
  return {
    id: `sealed-chase-${String(set || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    readKind: "sealed-chase",
    lane: "sealed-chase",
    signal: "sealed-chase",
    set: String(set || ""),
    moved,
    headline: sentence,
    publish: true,
    sealed: { from: left.from, to: left.to, count: left.count },
    chase: { from: right.from, to: right.to, count: right.count },
    start,
    end,
  };
}

export function groupLag(members, { era, kind, start, end } = {}) {
  const want = String(kind || "").toLowerCase();
  if (!era || !KINDS.has(want) || daySpan(start, end) !== 7) return null;
  const same = [];
  for (const row of members || []) {
    if (String(row?.era || "") !== era || String(row?.kind || "").toLowerCase() !== want) continue;
    if (!row?.id) continue;
    const from = Number(row.from);
    const to = Number(row.to);
    if (!(from > 0) || !(to > 0)) continue;
    const centsFrom = centsOf(from);
    const centsTo = centsOf(to);
    const dir = centsTo > centsFrom ? "up" : centsTo < centsFrom ? "down" : "flat";
    same.push({ id: String(row.id), from, to, dir });
  }
  const up = same.filter((row) => row.dir === "up");
  if (up.length < 5) return null;
  const flat = same.filter((row) => row.dir === "flat").slice(0, 8).map((row) => row.id);
  const sentence = `${up.length} ${era} ${want} ids are up from ${monthDay(start)} to ${monthDay(end)}.${flat.length ? ` Flat: ${flat.join(", ")}.` : ""}`;
  return {
    id: `group-${era}-${want.replace(/\s+/g, "-")}`,
    readKind: "group",
    lane: "group",
    signal: "group",
    era,
    kind: want,
    up: up.length,
    flat,
    headline: sentence,
    publish: true,
    start,
    end,
  };
}

export function setHeat(cards, { set, start, end } = {}) {
  if (!set || daySpan(start, end) !== 7) return null;
  const priced = [];
  for (const card of cards || []) {
    const from = Number(card?.from);
    const to = Number(card?.to);
    if (!(from > 0) || !(to > 0)) continue;
    const pct = ((to - from) / from) * 100;
    priced.push({ moved: floorOk(from, to, pct) && Math.abs(pct) >= 8 });
  }
  const n = priced.filter((row) => row.moved).length;
  if (n < 5) return null;
  const fromD = monthDay(start);
  const toD = monthDay(end);
  const sentence = `${n} of ${priced.length} priced cards in ${set} moved at least 8% and at least $1 from ${fromD} to ${toD}.`;
  return {
    id: `heat-${String(set).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    readKind: "set-heat",
    lane: "set-heat",
    signal: "set-heat",
    set,
    n,
    priced: priced.length,
    counts: { [set]: n },
    headline: sentence,
    publish: true,
    start,
    end,
  };
}
