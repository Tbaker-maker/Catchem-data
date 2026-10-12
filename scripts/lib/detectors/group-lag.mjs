// Same era, same kind. At least 5 ids up. Up to 8 flat ids are named. No padding.

import { money } from "../public-bundle.mjs";
import { floorOk } from "../read-quality.mjs";
import { monthDay, TAKE_CODES, takeCode } from "../takes.mjs";

const KINDS = new Set(["V", "VMAX", "VSTAR", "illustration rare"]);

function upEnough(row) {
  const from = Number(row?.from);
  const to = Number(row?.to);
  if (!(from > 0) || !(to > 0) || !(to > from)) return false;
  return floorOk(from, to, ((to - from) / from) * 100) && ((to - from) / from) * 100 >= 8;
}

export function groupLag(members, { era, kind, start, end } = {}) {
  if (!KINDS.has(kind)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(end || ""))) return null;
  const span = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  if (span !== 7) return null;
  const same = (members || []).filter((row) => row && row.era === era && row.kind === kind && row.id);
  const up = same.filter(upEnough);
  const flat = same.filter((row) => {
    const from = Number(row.from);
    const to = Number(row.to);
    return from > 0 && to > 0 && !upEnough(row) && !floorOk(from, to, ((to - from) / from) * 100);
  });
  if (up.length < 5) return null;
  const namedFlat = flat.slice(0, 8);
  const lead = up[0];
  const code = takeCode({ from: lead.from, to: lead.to, start, end });
  if (code && !TAKE_CODES.includes(code)) return null;
  const headline = `${money(lead.to)} from ${money(lead.from)}. ${up.length} ${kind} cards in ${era} rose from ${monthDay(start)} to ${monthDay(end)}.`;
  return {
    id: `group-lag-${String(era || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${String(kind).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    signal: "group-lag",
    headline,
    take: code,
    why: `${up.length} ids moved at least 8% and at least $1. ${namedFlat.length} similar ids stayed under that bar.`,
    whatWouldMakeThisWrong: "Wrong if an id is a different era or kind, or a flat id actually cleared $1 and 3%.",
    receipt: {
      era,
      kind,
      start,
      end,
      up: up.map((row) => ({ id: row.id, from: row.from, to: row.to })),
      flat: namedFlat.map((row) => ({ id: row.id, from: row.from, to: row.to })),
    },
    source: "TCGplayer market",
    sourceLine: `${era} ${kind} ${start} ${end}`,
  };
}
