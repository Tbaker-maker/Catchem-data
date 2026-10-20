// Market heat and fear/greed. Facts only. Weights, the case floor and the
// hit rule live in catchem-data-private model-spec (marketMeter). A missing
// spec means the build writes nothing new. A component with no number today
// is left out. It is never filled in.

export const DAY = 86400000;
export const addDays = (d, n) => new Date(Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export const DEFAULT_BANDS = {
  mood: [[0, 24, "Extreme fear"], [25, 44, "Fear"], [45, 55, "Neutral"], [56, 75, "Greed"], [76, 100, "Extreme greed"]],
  heat: [[0, 24, "Cold"], [25, 44, "Cool"], [45, 55, "Warm"], [56, 75, "Hot"], [76, 100, "On fire"]],
};

export const COMPONENT_METER = {
  breadth: "mood",
  momentum: "mood",
  supply: "mood",
  sellThrough: "mood",
  movers: "heat",
  newHighs: "heat",
  churn: "heat",
};

const BANNED = /\b(buy|sell|load up|time to|don't miss|do not miss|to the moon)\b/i;

export function clampScore(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(0, Math.min(100, Math.round(x)));
}

export function bandFor(score, bands) {
  const s = clampScore(score);
  if (s == null || !Array.isArray(bands)) return "";
  for (const row of bands) {
    const lo = Number(row[0]);
    const hi = Number(row[1]);
    if (s >= lo && s <= hi) return String(row[2] || "");
  }
  return "";
}

export function meterSpecOf(doc) {
  const m = doc?.marketMeter;
  if (!m || typeof m !== "object") return null;
  const min = Number(m.minComponents);
  if (!(min >= 1) || !m.components || typeof m.components !== "object") return null;
  const components = {};
  for (const [key, row] of Object.entries(m.components)) {
    if (!COMPONENT_METER[key] || !row || row.pass !== true) continue;
    const weight = Number(row.weight);
    if (!(weight > 0)) continue;
    if (row.meter && row.meter !== COMPONENT_METER[key]) continue;
    components[key] = { weight, meter: COMPONENT_METER[key] };
  }
  if (!Object.keys(components).length) return null;
  return {
    minComponents: min,
    hitPct: Number(m.hitPct) > 0 ? Number(m.hitPct) : 3,
    minN: Number(m.minN) >= 1 ? Number(m.minN) : 20,
    bands: {
      mood: Array.isArray(m.bands?.mood) ? m.bands.mood : DEFAULT_BANDS.mood,
      heat: Array.isArray(m.bands?.heat) ? m.bands.heat : DEFAULT_BANDS.heat,
    },
    vintageBefore: String(m.vintageBefore || "2003-06-01"),
    modernEras: Array.isArray(m.modernEras) && m.modernEras.length ? m.modernEras.map(String) : ["Scarlet & Violet", "Mega Evolution"],
    components,
  };
}

export function median(xs) {
  const s = (xs || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}

// Last point on asOf, and a point near asOf-days. A gap inside the slack is
// still a real step. A series with no point on asOf is skipped.
export function windowPct(points, asOf, days, slack = 3) {
  const endDay = String(asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay) || !(days > 0)) return null;
  let end = null;
  for (const p of points || []) {
    if (p.d > endDay) break;
    if (p.d === endDay && p.v > 0) end = p;
  }
  if (!end) return null;
  const startDay = addDays(endDay, -days);
  const startMin = addDays(startDay, -slack);
  let start = null;
  for (const p of points) {
    if (p.d > startDay) break;
    if (p.d >= startMin && p.v > 0) start = p;
  }
  if (!start || !(start.v > 0)) return null;
  return ((end.v - start.v) / start.v) * 100;
}

export function percentileScore(latest, prior) {
  const xs = (prior || []).filter((n) => Number.isFinite(n));
  if (!Number.isFinite(latest) || xs.length < 20) return null;
  const below = xs.filter((n) => n < latest).length;
  return clampScore((below / xs.length) * 100);
}

export function shareScore(flags, minN = 8) {
  const known = (flags || []).filter((f) => f === true || f === false);
  if (known.length < minN) return null;
  const yes = known.filter(Boolean).length;
  return { score: clampScore((yes / known.length) * 100), yes, n: known.length };
}

export function breadthFrom(pcts, minN = 8) {
  const known = (pcts || []).filter((n) => Number.isFinite(n));
  if (known.length < minN) return null;
  const up = known.filter((n) => n > 0).length;
  return { score: clampScore((up / known.length) * 100), up, n: known.length };
}

// Hot call: score at or above 56. Cold call: at or below 44. Neutral is not a call.
export function callSide(score) {
  const s = clampScore(score);
  if (s == null) return "";
  if (s >= 56) return "hot";
  if (s <= 44) return "cold";
  return "";
}

// Mood hit: the call matches a move of at least hitPct that also beats the median move.
// Heat hit: a hot call lands on a larger absolute move than the median absolute move.
// base is the majority outcome on the same decisive days, so a pass has to beat the usual case.
export function scoreCalls(rows, { kind = "mood", hitPct = 3, minN = 20 } = {}) {
  const ready = (rows || []).filter((row) => Number.isFinite(row?.fwd) && callSide(row.score));
  const medianFwd = median(ready.map((row) => row.fwd));
  const medianAbs = median(ready.map((row) => Math.abs(row.fwd)));
  const calls = [];
  let upDays = 0;
  let decisive = 0;
  for (const row of ready) {
    const side = callSide(row.score);
    if (kind === "heat") {
      const abs = Math.abs(row.fwd);
      if (medianAbs == null) continue;
      const hit = side === "hot" ? abs > medianAbs : abs < medianAbs;
      calls.push(hit);
      continue;
    }
    if (Math.abs(row.fwd) < hitPct || medianFwd == null) continue;
    decisive += 1;
    const up = row.fwd >= hitPct && row.fwd > medianFwd;
    if (up) upDays += 1;
    const hit = side === "hot" ? up : row.fwd <= -hitPct && row.fwd < medianFwd;
    calls.push(hit);
  }
  const n = calls.length;
  const hits = calls.filter(Boolean).length;
  const rate = n ? Math.round((hits / n) * 1000) / 1000 : null;
  const upShare = decisive ? upDays / decisive : null;
  const base = kind === "heat" ? 0.5 : (upShare == null ? null : Math.round(Math.max(upShare, 1 - upShare) * 1000) / 1000);
  const published = n >= minN && rate != null && base != null && rate > base;
  return { n, hits, rate, base, published };
}

export function combineMeter(parts, spec, which) {
  const specRows = spec?.components || {};
  const used = [];
  for (const [key, part] of Object.entries(parts || {})) {
    const row = specRows[key];
    if (!row || row.meter !== which) continue;
    if (part?.score == null) continue;
    const fact = String(part.fact || "").trim();
    if (!fact || BANNED.test(fact)) continue;
    used.push({ key, score: part.score, weight: row.weight, fact });
  }
  if (!used.length) return { score: null, used: 0, parts: [] };
  const w = used.reduce((sum, part) => sum + part.weight, 0);
  const score = clampScore(used.reduce((sum, part) => sum + part.weight * part.score, 0) / w);
  return { score, used: used.length, parts: used };
}

export function topReasons(mood, heat, limit = 3) {
  const parts = [...(mood?.parts || []), ...(heat?.parts || [])];
  parts.sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50) || a.key.localeCompare(b.key));
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    if (seen.has(part.fact)) continue;
    seen.add(part.fact);
    out.push(part.fact);
    if (out.length >= limit) break;
  }
  return out;
}

export function packSlice(parts, spec) {
  const mood = combineMeter(parts, spec, "mood");
  const heat = combineMeter(parts, spec, "heat");
  const min = spec.minComponents;
  const moodOk = mood.used >= min && mood.score != null;
  const heatOk = heat.used >= min && heat.score != null;
  if (!moodOk && !heatOk) return null;
  return {
    mood: moodOk ? mood.score : null,
    moodBand: moodOk ? bandFor(mood.score, spec.bands.mood) : "",
    heat: heatOk ? heat.score : null,
    heatBand: heatOk ? bandFor(heat.score, spec.bands.heat) : "",
    moodUsed: moodOk ? mood.used : 0,
    heatUsed: heatOk ? heat.used : 0,
    used: (moodOk ? mood.used : 0) + (heatOk ? heat.used : 0),
    reasons: topReasons(moodOk ? mood : null, heatOk ? heat : null),
    inputs: [...(moodOk ? mood.parts : []), ...(heatOk ? heat.parts : [])].map((part) => ({
      id: part.key,
      meter: COMPONENT_METER[part.key] || "",
      score: part.score,
      fact: part.fact,
    })),
  };
}

export function factLine(key, info, noun) {
  const name = noun || "sets";
  const pct = (n) => `${Math.round(n)}%`;
  if (key === "breadth" && info) return `${pct(info.score)} of ${name} up over 7 days (${info.up} of ${info.n})`;
  if (key === "movers" && info) return `${pct(info.score)} of ${name} moved more than their usual week (${info.yes} of ${info.n})`;
  if (key === "newHighs" && info) return `${pct(info.score)} of ${name} at a 90 day high (${info.yes} of ${info.n})`;
  if (key === "momentum" && info && Number.isFinite(info.pct)) {
    const pace = info.score >= 50 ? "above its usual pace" : "below its usual pace";
    const signed = `${info.pct > 0 ? "+" : ""}${(Math.round(info.pct * 10) / 10).toFixed(1)}%`;
    const label = name === "sets" ? "set" : name.replace(/ sets$/, "");
    return `The median ${label} move is ${signed} over 7 days, ${pace}`;
  }
  if (key === "supply" && info && Number.isFinite(info.chg)) {
    const dir = info.chg > 0 ? "up" : info.chg < 0 ? "down" : "flat";
    return `listings counted ${dir} ${Math.abs(Math.round(info.chg * 10) / 10)}% from the day before`;
  }
  if (key === "churn" && info) return `${pct(info.score)} of tracked products changed listings counted (${info.yes} of ${info.n})`;
  if (key === "sellThrough" && info && Number.isFinite(info.rate)) return `listings gone were ${Math.round(info.rate * 10) / 10}% of the prior listings counted`;
  return "";
}

export function adviceFree(text) {
  return !BANNED.test(String(text || ""));
}
