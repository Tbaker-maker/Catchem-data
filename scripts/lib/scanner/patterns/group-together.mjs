import { pack, round1 } from "../common.mjs";

export const id = "group-together";
export const privateOnly = false;

const MIN = { set: 20, era: 20, artist: 8, pokemon: 6 };

// series.group: { type, name, n, up, down, medianPct, start, end }
export function detect(series) {
  const g = series?.group;
  if (!g) return null;
  const need = MIN[g.type] || 20;
  if (!(g.n >= need) || !g.start || !g.end) return null;
  const upShare = g.n ? g.up / g.n : 0;
  const downShare = g.n ? g.down / g.n : 0;
  const share = Math.max(upShare, downShare);
  const dir = upShare >= downShare ? 1 : -1;
  if (share >= 0.6 && Math.abs(g.medianPct) >= 3) {
    return pack(id, "confirmed", 40 + Math.round(share * 40) + Math.min(15, Math.round(g.n / 20)), g.start, g.end, {
      pct: round1(g.medianPct), n: g.n, up: g.up, down: g.down, groupType: g.type, dir,
    });
  }
  if (share >= 0.5 && Math.abs(g.medianPct) >= 2) {
    return pack(id, "forming", 25 + Math.round(share * 20), g.start, g.end, {
      pct: round1(g.medianPct), n: g.n, up: g.up, down: g.down, groupType: g.type, dir,
    });
  }
  if (g.priorShare >= 0.6 && share < 0.5) {
    return pack(id, "ending", 35, g.priorStart || g.start, g.end, {
      pct: round1(g.medianPct), n: g.n, up: g.up, down: g.down, groupType: g.type, dir,
    });
  }
  return null;
}
