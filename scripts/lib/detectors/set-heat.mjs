// How many priced cards in one set cleared 8% and $1. Nothing under 5.

import { floorOk } from "../read-quality.mjs";
import { monthDay } from "../takes.mjs";

function cleared(card) {
  const from = Number(card?.from);
  const to = Number(card?.to);
  if (!(from > 0) || !(to > 0)) return false;
  const pct = ((to - from) / from) * 100;
  return Math.abs(pct) >= 8 && floorOk(from, to, pct);
}

export function setHeat(cards, { set, priced, start, end } = {}) {
  const list = Array.isArray(cards) ? cards : [];
  const nPriced = Number.isInteger(priced) ? priced : list.filter((card) => Number(card?.from) > 0 && Number(card?.to) > 0).length;
  if (!set || !/^\d{4}-\d{2}-\d{2}$/.test(String(start || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end || ""))) return null;
  const span = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  if (span !== 7) return null;
  const moved = list.filter(cleared);
  if (moved.length < 5 || nPriced < moved.length) return null;
  const from = monthDay(start);
  const to = monthDay(end);
  if (!from || !to) return null;
  const headline = `${moved.length} of ${nPriced} priced cards in ${set} moved at least 8% and at least $1 from ${from} to ${to}.`;
  return {
    id: `set-heat-${String(set).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    signal: "set-heat",
    headline,
    take: null,
    why: `${moved.length} cards cleared the bar. ${nPriced - moved.length} priced cards in the set did not.`,
    whatWouldMakeThisWrong: "Wrong if a counted card did not move at least 8% and at least $1 on those two dates.",
    receipt: {
      set,
      priced: nPriced,
      n: moved.length,
      start,
      end,
      cards: moved.map((card) => ({ id: card.id, from: card.from, to: card.to })),
    },
    source: "TCGplayer market",
    sourceLine: `${set} ${start} ${end}`,
  };
}
