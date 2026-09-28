// A receipt is a call we already wrote down, graded against the next print we stored.
// No price is invented. No hit rate until 20 calls are actually scored.
import { gradeRead, movePct } from "./receipts.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function usd(n) {
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function longDay(iso) {
  const [y, m, d] = String(iso || "").split("-");
  const month = MONTHS[Number(m) - 1];
  if (!month || !d || !y) return "";
  return `${month} ${Number(d)}, ${y}`;
}

function rowsFor(heat) {
  const by = new Map();
  for (const row of heat || []) {
    if (!row?.id || !row.date || typeof row.price !== "number") continue;
    if (!by.has(row.id)) by.set(row.id, []);
    by.get(row.id).push(row);
  }
  for (const list of by.values()) list.sort((a, b) => (a.date < b.date ? -1 : 1));
  return by;
}

function directionInto(by, id, date, start) {
  const prior = [...(by.get(id) || [])].reverse().find((r) => r.date < date);
  if (!prior || !(start > 0)) return null;
  if (start > prior.price) return "up";
  if (start < prior.price) return "down";
  return null;
}

function laterOf(by, kind, id, date, sealedNow) {
  if (kind !== "sealed") return null;
  const nxt = (by.get(id) || []).find((r) => r.date > date);
  if (nxt) return { price: nxt.price, date: nxt.date };
  const now = sealedNow?.get?.(id);
  if (typeof now === "number" && now > 0) return { price: now, date: null };
  return null;
}

export function scoreWatch({ entries, heat, sealedNow }) {
  const by = rowsFor(heat);
  const out = [];
  for (const entry of entries || []) {
    if (!entry?.date) continue;
    for (const kind of ["sealed", "raw"]) {
      const pick = entry[kind];
      if (!pick?.name || typeof pick.price !== "number") continue;
      const sealed = kind === "sealed";
      const direction = directionInto(by, pick.id, entry.date, pick.price);
      const later = laterOf(by, sealed ? "sealed" : "single", pick.id, entry.date, sealedNow);
      const dated = Boolean(later?.date);
      const result = dated ? gradeRead({ start: pick.price, later: later.price, direction }) : "open";
      out.push({
        id: pick.id || null,
        name: pick.name,
        kind: sealed ? "sealed" : "single",
        date: entry.date,
        direction,
        start: pick.price,
        later: dated ? later.price : null,
        laterDate: dated ? later.date : null,
        result,
        movePct: dated ? movePct(pick.price, later.price) : null,
      });
    }
  }
  return out;
}

export function receiptWhy(row) {
  if (row.result === "hit" || row.result === "miss") {
    const way = row.direction === "up" ? "after a lower print" : "after a higher print";
    const end = row.result === "hit" ? "Same way." : "The other way.";
    return `Written down ${longDay(row.date)} at ${usd(row.start)}, ${way}. Next print ${longDay(row.laterDate)} was ${usd(row.later)}. ${end}`;
  }
  return `Written down ${longDay(row.date)} at ${usd(row.start)}. No earlier print, so this stays open.`;
}

export function publicReceipts(rows) {
  const graded = rows.filter((r) => r.result === "hit" || r.result === "miss");
  const opens = rows.filter((r) => r.result === "open").slice(-4);
  const shown = [...graded, ...opens];
  const hits = graded.filter((r) => r.result === "hit").length;
  const misses = graded.filter((r) => r.result === "miss").length;
  return {
    scored: graded.length,
    hits,
    misses,
    hitRate: graded.length >= 20 ? Math.round((hits / graded.length) * 1000) / 10 : null,
    rows: shown.map((row) => {
      const label = row.result === "hit" ? "Hit" : row.result === "miss" ? "Miss" : "Open";
      const price = row.result === "open" ? row.start : row.later;
      const hist = row.laterDate ? [[row.date, row.start], [row.laterDate, row.later]] : [[row.date, row.start]];
      return {
        id: `receipt-${row.date}-${row.kind}-${row.id || row.name}`,
        type: "receipt",
        result: row.result,
        kind: row.kind,
        name: row.name,
        headline: `${row.name}. ${label}.`,
        price,
        source: row.kind === "sealed" ? "Sealed print we stored" : "Price we stored",
        asOf: row.laterDate || row.date,
        why: receiptWhy(row),
        hist,
        href: "",
        changePct: row.movePct,
      };
    }),
  };
}
