// Runs the detectors around the library that already ships.
// Does not write reads.json. Does not flip reads.library.
// A detector that throws is logged and skipped. It does not add a row.

import { buildReadLibrary } from "../read-library.mjs";
import { SWITCH } from "./registry-switch.mjs";
import { ASK_DETECTORS } from "./asks.mjs";
import { PRICE_DETECTORS } from "./price.mjs";
import { SLOTS } from "./slots.mjs";
import { shuffleDay } from "./browse.mjs";

export { SWITCH };

export function detectors() {
  return [...PRICE_DETECTORS, ...ASK_DETECTORS, ...SLOTS];
}

export function runRegistry(ctx = {}, { switchOn = false, extras = [] } = {}) {
  const logs = [];
  const lib = buildReadLibrary({
    catalogue: ctx.catalogue,
    extra: ctx.extra,
    series: ctx.series,
    dailyFiles: ctx.dailyFiles ?? null,
    sealed: ctx.sealed ?? null,
    radar: ctx.radar ?? null,
    library: false,
    pptPublic: false,
    volumeReads: false,
  });
  const list = [...detectors(), ...extras];
  const byId = {};
  for (const det of list) {
    if (det.gate === SWITCH && switchOn !== true) {
      logs.push({ id: det.id, skipped: "reads.library off" });
      byId[det.id] = [];
      continue;
    }
    try {
      const rows = det.take(lib, ctx);
      byId[det.id] = Array.isArray(rows) ? rows : [];
      if (!Array.isArray(rows)) logs.push({ id: det.id, skipped: "take did not return a list" });
    } catch (err) {
      logs.push({ id: det.id, error: String(err?.message || err) });
      byId[det.id] = [];
    }
  }
  const fresh = [];
  for (const det of list) {
    if (det.gate !== SWITCH || det.id === "rotation") continue;
    for (const row of byId[det.id] || []) fresh.push(row);
  }
  return { lib, byId, logs, browse: shuffleDay(fresh, lib.asOf), public: false };
}
