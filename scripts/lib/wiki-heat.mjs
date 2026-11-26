// Wikipedia title map and pageview z-score. No network. Fail closed under 30 days.
// This does not fill the Google Trends slot.

import { zscore } from "./heat-check.mjs";

export const FRANCHISE = { title: "Pokémon_Trading_Card_Game", kind: "franchise", name: "Pokémon Trading Card Game" };
const NO_PAGE = new Set(["Surging Sparks", "Prismatic Evolutions"]);

export function mapTitle(name, known = {}) {
  const raw = String(name || "").trim();
  if (!raw) return null;
  if (/^list of\b/i.test(raw)) return null;
  if (NO_PAGE.has(raw)) return null;
  if (raw === "Pokémon Trading Card Game" || raw === "Pokemon Trading Card Game") {
    return { title: FRANCHISE.title, kind: "franchise" };
  }
  const hit = known[raw];
  if (hit && hit.unique === true && hit.title && !/^list of\b/i.test(hit.title)) {
    return { title: hit.title, kind: "set", groupId: hit.groupId ?? null };
  }
  return null;
}

export function pageviewZ(days) {
  const series = (days || []).map((d) => Number(d?.views)).filter((n) => Number.isFinite(n));
  if (series.length < 30) return { z: null, partial: true, days: series.length, reason: "under 30 days" };
  const latest = series[series.length - 1];
  const z = zscore(latest, series);
  return { z: z == null ? null : Math.round(z * 1000) / 1000, partial: false, days: series.length, reason: null };
}

export function publicWikiRows(rows, flagOn = false) {
  if (flagOn !== true) return [];
  return (rows || []).filter((row) => row && row.z != null && row.days >= 30);
}
