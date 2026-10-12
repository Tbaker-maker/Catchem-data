// Sealed against the chase card. One side clears $1 and 3%. The other does not.
// Publishes nothing by itself. The registry keeps it behind reads.library.

import { money } from "../public-bundle.mjs";
import { floorOk, formatPct } from "../read-quality.mjs";
import { monthDay, takeCode, TAKE_CODES } from "../takes.mjs";

function sideMove(side) {
  const from = Number(side?.from);
  const to = Number(side?.to);
  if (!(from > 0) || !(to > 0)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(side?.start || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(side?.end || ""))) return null;
  const pct = ((to - from) / from) * 100;
  return { from, to, start: side.start, end: side.end, pct, clears: floorOk(from, to, pct) };
}

export function sealedVsChase({ set, sealed, chase } = {}) {
  const box = sideMove(sealed);
  const card = sideMove(chase);
  if (!box || !card) return null;
  if (box.start !== card.start || box.end !== card.end) return null;
  const span = Math.round((Date.parse(`${box.end}T00:00:00Z`) - Date.parse(`${box.start}T00:00:00Z`)) / 86400000);
  if (span !== 7) return null;
  if (box.clears === card.clears) return null;
  const moved = box.clears ? "sealed" : "chase";
  const mover = box.clears ? box : card;
  const still = box.clears ? card : box;
  const code = takeCode({ from: mover.from, to: mover.to, start: mover.start, end: mover.end });
  if (code && !TAKE_CODES.includes(code)) return null;
  const when = `${monthDay(box.start)} to ${monthDay(box.end)}`;
  const headline = `${money(mover.to)} from ${money(mover.from)}. The ${moved} side moved. The ${moved === "sealed" ? "chase" : "sealed"} side did not. ${when}.`;
  if (!headline.startsWith("$")) return null;
  const receipt = {
    set: String(set || ""),
    start: box.start,
    end: box.end,
    sealedFrom: box.from,
    sealedTo: box.to,
    sealedClears: box.clears,
    chaseFrom: card.from,
    chaseTo: card.to,
    chaseClears: card.clears,
    moved,
  };
  return {
    id: `sealed-chase-${String(set || "set").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    signal: "sealed-vs-chase",
    headline,
    take: code,
    why: `${moved === "sealed" ? "Sealed" : "The chase"} cleared $1 and 3%. The other side did not. ${formatPct(mover.pct)}% against ${formatPct(still.pct)}%.`,
    whatWouldMakeThisWrong: "Wrong if either side is missing a price on either date, or both sides clear the same bar.",
    receipt,
    source: "TCGplayer market",
    sourceLine: `${receipt.set} ${box.start} ${box.end}`,
  };
}
