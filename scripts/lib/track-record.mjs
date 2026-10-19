// Scores a shipped take only when a later TCGplayer market exists on the exact day.
// Ship price comes from the daily price file, never from a headline.
// Under 14 days is too early. A missing later price is no score. watch is not scored.
// The scored file is private. The public file is a stub with no rows.

import { HORIZONS, SCORE_MIN } from "./second-library.mjs";
import { cleanDoc, VISIBLE_FIELDS } from "./copy-rules.mjs";

const LABEL_BAN = /Looks like a buy|Wait for a dip|Avoid for now|Looks stretched/;

export const TAKE_CODES = ["up", "dip", "watch", "avoid", "stretched"];
// Fact reads carry no take. Their type comes from the direction the read itself
// states (its own change, direction, move chip or chart), scored as "did the
// move keep going". A read with no stated direction is a fact and is not scored.
export const DERIVED_CODES = ["move-up", "move-down"];
const SCORED_CODES = new Set(["up", "dip", "avoid", "stretched", ...DERIVED_CODES]);

export { HORIZONS, SCORE_MIN };

export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function dayGap(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function takeOf(read) {
  const code = String(read?.take || "");
  return TAKE_CODES.includes(code) ? code : "";
}

export function directionOf(read) {
  const c = read?.changePct;
  if (typeof c === "number" && Number.isFinite(c) && c !== 0) return c > 0 ? "up" : "down";
  if (read?.direction === "up" || read?.direction === "down") return read.direction;
  const mv = (Array.isArray(read?.signals) ? read.signals : []).find((x) => x?.kind === "move" && (x.dir === "up" || x.dir === "down"));
  if (mv) return mv.dir;
  const pts = read?.chart?.points;
  if (Array.isArray(pts) && pts.length >= 2) {
    const a = Number(pts[0]?.[1]), b = Number(pts[pts.length - 1]?.[1]);
    if (a > 0 && b > 0 && a !== b) return b > a ? "up" : "down";
  }
  return "";
}

export function typeOf(read) {
  const code = String(read?.take || "");
  if (TAKE_CODES.includes(code) || DERIVED_CODES.includes(code) || code === "fact") return code;
  const dir = directionOf(read);
  return dir === "up" ? "move-up" : dir === "down" ? "move-down" : "fact";
}

function hitOf(take, from, to) {
  if (take === "up" || take === "move-up") return to > from;
  if (take === "move-down") return to < from;
  if (take === "dip" || take === "avoid" || take === "stretched") return to < from;
  return null;
}

export function percentFor(hit, n) {
  if (!(n >= SCORE_MIN)) return null;
  return Math.round((100 * hit) / n);
}

// Product names are proper names and ids are machine keys, so only words a reader sees are checked.
const TRACK_VISIBLE = new Set([...VISIBLE_FIELDS, "type", "take"].filter((k) => k !== "status"));
function assertClean(doc, visible = TRACK_VISIBLE) {
  // Flags only. A flagged line stops the file with the line and its reason; nothing is rewritten.
  const r = cleanDoc(doc, { visible });
  const label = r.errors.length ? null : JSON.stringify(r.doc, (k, v) => (TRACK_VISIBLE.has(k) || typeof v !== "string" ? v : undefined));
  if (r.errors.length || LABEL_BAN.test(label)) throw new Error(`track record broke a copy rule: ${r.errors.join("; ") || "a take label"}`);
  return r.doc;
}

export function scoreRead(read, later = {}, today, shipFromFile = null) {
  const shipped = String(read?.asOf || "").slice(0, 10);
  const price = Number(shipFromFile?.market);
  const take = typeOf(read);
  const age = dayGap(shipped, today);
  const base = {
    id: String(read?.id || ""),
    productId: String(read?.sku || ""),
    name: String(read?.name || ""),
    type: take,
    take,
    shipped,
    price: price > 0 ? price : null,
    shipSource: price > 0 ? String(shipFromFile?.source || "") : "",
    age,
  };
  if (!base.id || !base.productId || age == null) {
    return { ...base, status: "no-score", note: "no score" };
  }
  if (take === "watch") return { ...base, status: "no-score", note: "watch is not scored" };
  if (take === "fact") return { ...base, status: "no-score", note: "a fact with no stated direction is not scored" };
  if (!SCORED_CODES.has(take)) return { ...base, status: "no-score", note: "no score" };
  if (!(price > 0)) return { ...base, status: "no-score", note: "no score" };
  if (age < HORIZONS[0]) return { ...base, status: "too-early", note: "too early" };
  const marks = {};
  for (const horizon of HORIZONS) {
    if (age < horizon) continue;
    const day = addDays(shipped, horizon);
    const next = Number(later[day]);
    if (!(next > 0)) {
      marks[String(horizon)] = { day, price: null, sameDirection: null };
      continue;
    }
    marks[String(horizon)] = { day, price: next, sameDirection: hitOf(take, price, next) };
  }
  const scored = Object.values(marks).some((mark) => mark.price != null);
  return {
    ...base,
    status: scored ? "scored" : "no-later-price",
    note: scored ? "" : "no later price, so no score",
    marks,
  };
}

// Rows from earlier nights that left the board, as read-like objects. Their
// stored ship price is used when that day's file price is not on hand.
export function priorReads(prior, reads) {
  const live = new Set((reads || []).map((r) => String(r?.id || "")));
  const out = [];
  for (const row of prior?.rows || []) {
    const id = String(row?.id || "");
    if (!id || live.has(id) || !row.shipped) continue;
    out.push({ id, sku: String(row.productId || ""), name: String(row.name || ""), asOf: row.shipped, take: row.take || "", _ship: row.price > 0 ? { market: row.price, source: row.shipSource || "" } : null });
  }
  return out;
}

export function buildTrackRecord(reads, laterByProduct = {}, today, shipByProduct = {}, prior = null) {
  const all = [...(reads || []), ...priorReads(prior, reads)];
  const rows = all.map((read) => {
    const sku = String(read?.sku || "");
    const day = String(read?.asOf || "").slice(0, 10);
    return scoreRead(read, laterByProduct[sku] || {}, today, shipByProduct[sku]?.[day] || read?._ship || null);
  });
  rows.sort((a, b) => String(b.shipped).localeCompare(String(a.shipped)) || String(b.id).localeCompare(String(a.id)));
  const byType = {};
  for (const row of rows) {
    const key = row.take || "";
    if (!byType[key]) {
      byType[key] = {
        type: key, reads: 0, tooEarly: 0, noLaterPrice: 0, scored: 0,
        scored14: 0, hit14: 0, scored28: 0, hit28: 0, scored56: 0, hit56: 0,
      };
    }
    const bag = byType[key];
    bag.reads += 1;
    if (row.status === "too-early") bag.tooEarly += 1;
    if (row.status === "no-later-price") bag.noLaterPrice += 1;
    if (row.status === "scored") bag.scored += 1;
    for (const horizon of HORIZONS) {
      const mark = row.marks?.[String(horizon)];
      if (mark?.price == null) continue;
      bag[`scored${horizon}`] += 1;
      if (mark.sameDirection === true) bag[`hit${horizon}`] += 1;
    }
  }
  const types = Object.values(byType).sort((a, b) => a.type.localeCompare(b.type));
  for (const bag of types) {
    bag.line = `${bag.scored} scored so far`;
    for (const horizon of HORIZONS) {
      const n = bag[`scored${horizon}`];
      bag[`line${horizon}`] = `${n} scored so far`;
      const pct = percentFor(bag[`hit${horizon}`], n);
      if (pct != null) bag[`percent${horizon}`] = pct;
    }
  }
  const dates = rows.map((row) => row.shipped).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  return assertClean({
    public: false,
    asOf: today,
    rule: "A take is stored with its ship date. The ship price is the TCGplayer market on that date from the daily price file. It is not taken from a headline. Days 14, 28, and 56 use that exact day's market. A missing day is no score. Under 14 days is too early. watch is not scored. up is scored when the later market is higher. dip, avoid, and stretched are scored when the later market is lower. A read with no take is typed from the direction it states: move-up is scored when the later market is higher, move-down when it is lower; a fact with no stated direction is not scored. Rows stay on file after the read leaves the board. A percent is stored only after 20 scored reads of that code.",
    oldest: dates[0] || "",
    newest: dates[dates.length - 1] || "",
    count: rows.length,
    tooEarly: rows.filter((row) => row.status === "too-early").length,
    noLaterPrice: rows.filter((row) => row.status === "no-later-price").length,
    scored14: types.reduce((n, row) => n + row.scored14, 0),
    scored28: types.reduce((n, row) => n + row.scored28, 0),
    scored56: types.reduce((n, row) => n + row.scored56, 0),
    scoreMin: SCORE_MIN,
    types,
    rows,
  });
}

export function publicTrackRecord(doc) {
  return assertClean({
    public: false,
    asOf: String(doc?.asOf || "").slice(0, 10),
    count: 0,
    scoreMin: SCORE_MIN,
    types: [],
    rows: [],
  });
}

function money2(n) {
  const v = Number(n);
  if (!(v > 0)) return "";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pageLine(n, moved, days) {
  if (!(n > 0)) return "";
  return `Of ${n} reads in ${days} days, ${moved} moved the way the read described.`;
}

// Public page only. No take codes, horizons, weights, or how a read is chosen.
// Rows come from our own dated price snapshots (the receipt hist), not a headline.
export function publicTrackPage(receipts, today) {
  const asOf = String(today || receipts?.asOf || "").slice(0, 10);
  const rows = [];
  for (const row of receipts?.rows || []) {
    const hist = (Array.isArray(row?.hist) ? row.hist : []).filter((point) => Array.isArray(point) && /^\d{4}-\d{2}-\d{2}/.test(String(point[0])) && Number(point[1]) > 0);
    if (!hist.length || !row?.name) continue;
    const then = hist[0];
    const now = hist[hist.length - 1];
    const result = String(row.result || "");
    const moved = result === "hit" ? true : result === "miss" ? false : null;
    const kind = row.kind === "single" ? "single" : "sealed";
    const said = `Recorded at ${money2(then[1])}.`;
    if (kind === "sealed" && /\bNM\b|Near Mint/.test(said + String(row.name))) continue;
    rows.push({
      id: String(row.id || ""),
      date: String(then[0]).slice(0, 10),
      name: String(row.name),
      said,
      priceThen: Number(then[1]),
      priceNow: Number(now[1]),
      source: String(row.source || "TCGplayer market price"),
      priceDate: String(now[0]).slice(0, 10),
      kind,
      moved,
    });
  }
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.name).localeCompare(String(b.name)));
  const inWindow = (days, kind) => rows.filter((row) => {
    if (kind && row.kind !== kind) return false;
    if (row.moved == null) return false;
    if (!asOf) return true;
    const age = dayGap(row.date, asOf);
    return age != null && age <= days && age >= 0;
  });
  const pack = (days, kind) => {
    const list = inWindow(days, kind);
    const moved = list.filter((row) => row.moved === true).length;
    return { reads: list.length, moved, line: pageLine(list.length, moved, days) };
  };
  const scored = rows.filter((row) => row.moved != null).length;
  const d90 = pack(90, "");
  return assertClean({
    public: true,
    asOf,
    thin: scored < 30,
    disclaimer: "Past moves don't predict future prices.",
    summary: d90.line,
    windows: {
      d30: pack(30, ""),
      d90,
      sealed30: pack(30, "sealed"),
      sealed90: pack(90, "sealed"),
      single30: pack(30, "single"),
      single90: pack(90, "single"),
    },
    rows,
  }, new Set([...TRACK_VISIBLE, "said", "summary", "disclaimer", "line"]));
}

export function siteTrack(trackRecord) {
  if (trackRecord?.public !== true) return { page: false, cardLine: "", score: null };
  return { page: true, cardLine: "", score: null };
}
