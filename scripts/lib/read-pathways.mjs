// Read pathways: reads that passed a pre-registered long-history test against
// naive momentum. Thresholds, windows, version ids and the evidence live in
// catchem-data-private (config/read-pathways.json). This file holds none of
// them. With no valid config, no fresh price tonight, a stale market, thin
// trading or a gap in the weekly record, a pathway writes nothing.
//   quiet-high     singles and sealed: a new 1-year high reached without a big week
//   quiet-climber  singles: ahead of set and rarity peers over 13 weeks, in small steps
// Public copy states facts only. It never says what a price will do.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { row, deepReadId, sparkOf } from "./deep-reads.mjs";
import { addDays, dayNum } from "./history-reads.mjs";
import { cardTitle } from "./card-face.mjs";
import { assessThin } from "./thin-trading.mjs";
import { staleMarket } from "./stale-market.mjs";
import { renderPathway, hashOf } from "./read-phrasing.mjs";

const LOW = new Set(["Common", "Uncommon", "Code Card", "None", ""]);
const short = (s) => String(s || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
// Same rule as deep-reads valueOn (last point on or before the day, at most 7
// days old), with a binary search because a pathway asks hundreds of days.
export function valueOn(pts, day, maxAge = 7) {
  let lo = 0, hi = pts.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (pts[mid][0] <= day) { at = mid; lo = mid + 1; } else hi = mid - 1; }
  if (at < 0 || dayNum(day) - dayNum(pts[at][0]) > maxAge) return null;
  return pts[at][1];
}

export function configHash(cfg) { return createHash("sha256").update(canonical(cfg)).digest("hex"); }

const RULE_KEYS = {
  "quiet-high": ["priorWeeks", "skipWeeks", "minCoverage", "newHighRatio", "stepWeeks", "minUpWeeks", "maxStepRatio", "minPrice", "cooldownWeeks"],
  "quiet-climber": ["moveWeeks", "minPeers", "relLow", "relHigh", "stepWeeks", "minUpWeeks", "maxStepRatio", "minPrice", "cooldownWeeks"],
};

// Fail closed: every number present and in range, a version id, a
// registration date, and readsEnabled true. Anything else is null.
export function validPathways(cfg) {
  if (!cfg || typeof cfg !== "object" || cfg.readsEnabled !== true) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cfg.registeredAt || ""))) return null;
  const out = [];
  for (const p of cfg.pathways || []) {
    if (!p || p.enabled !== true || !RULE_KEYS[p.pathway] || !/^[a-z0-9-]+-v\d+$/.test(String(p.versionId || ""))) continue;
    if (!["single", "sealed"].includes(p.kind)) continue;
    if (p.pathway === "quiet-climber" && p.kind !== "single") continue;
    const r = p.rule || {};
    if (!RULE_KEYS[p.pathway].every((k) => Number.isFinite(Number(r[k])))) continue;
    const rule = Object.fromEntries(RULE_KEYS[p.pathway].map((k) => [k, Number(r[k])]));
    if (!(rule.stepWeeks >= 4) || !(rule.maxStepRatio > 1) || !(rule.minPrice > 0)) continue;
    if (p.pathway === "quiet-high" && (!(rule.priorWeeks > rule.skipWeeks) || !(rule.newHighRatio >= 1) || !(rule.minCoverage > 0 && rule.minCoverage <= 1))) continue;
    if (p.pathway === "quiet-climber" && (!(rule.relHigh > rule.relLow) || !(rule.minPeers >= 2) || !(rule.moveWeeks >= 4))) continue;
    out.push({ pathway: p.pathway, kind: p.kind, versionId: p.versionId, maxReads: Math.max(0, Math.min(50, Number(p.maxReads) || 12)), rule });
  }
  if (!out.length) return null;
  return { registeredAt: cfg.registeredAt, hash: configHash(cfg), pathways: out };
}

async function fetchPrivate(path, raw = false) {
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-read-pathways" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return raw ? Buffer.from(await res.arrayBuffer()) : await res.json();
  } catch { return null; }
}

export async function loadPathways(root) {
  const local = [process.env.READ_PATHWAYS_FILE, root ? join(root, "..", "catchem-data-private", "config", "read-pathways.json") : ""].filter(Boolean);
  for (const path of local) {
    try { const v = validPathways(JSON.parse(await readFile(path, "utf8"))); if (v) return v; } catch { /* next */ }
  }
  return validPathways(await fetchPrivate("config/read-pathways.json"));
}

// Sealed long history (private TCGCSV archive). Map product id -> [[date, price]].
export function parseSealedLong(buf) {
  try {
    const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
    const doc = JSON.parse(text);
    const out = new Map();
    for (const [id, v] of Object.entries(doc.products || {})) {
      const pts = (v.pts || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && Number(p[1]) > 0).map((p) => [p[0], Number(p[1])]);
      if (pts.length) out.set(id, pts);
    }
    return out;
  } catch { return new Map(); }
}

export async function loadSealedLong(root) {
  const rel = "research/archive/sealed-long-tcgcsv.json.gz";
  const local = [process.env.SEALED_LONG_FILE, root ? join(root, "..", "catchem-data-private", rel) : ""].filter(Boolean);
  for (const path of local) {
    try { const m = parseSealedLong(await readFile(path)); if (m.size) return m; } catch { /* next */ }
  }
  const buf = await fetchPrivate(rel, true);
  return buf ? parseSealedLong(buf) : new Map();
}

// Merge two point lists by date; the later list wins a shared day.
export function mergePoints(a, b) {
  const m = new Map(a || []);
  for (const p of b || []) m.set(p[0], p[1]);
  return [...m.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1));
}

// Weekly prices ending tonight. w[0] is n weeks ago, w[n] is tonight. Missing is null.
export function weekly(pts, asOf, n) {
  const out = [];
  for (let k = n; k >= 0; k -= 1) out.push(valueOn(pts, addDays(asOf, -7 * k)));
  return out;
}

function steps(w, from) {
  let up = 0, down = 0, max = -Infinity;
  for (let i = from; i < w.length; i += 1) {
    const a = w[i - 1], b = w[i];
    if (a == null || b == null) continue;
    const s = Math.log(b / a);
    if (s > 0) up += 1; else if (s < 0) down += 1;
    if (s > max) max = s;
  }
  return { up, down, max };
}

// Quiet new high on one series, tonight. Returns facts or null.
export function quietHighAt(pts, asOf, rule) {
  const n = rule.priorWeeks;
  const w = weekly(pts, asOf, n);
  const now = w[n];
  if (now == null || !(now >= rule.minPrice)) return null;
  const prior = w.slice(0, n - rule.skipWeeks);
  const have = prior.filter((x) => x != null);
  if (have.length < rule.minCoverage * prior.length) return null;
  const pm = Math.max(...have);
  if (!(now >= pm * rule.newHighRatio)) return null;
  const st = steps(w, n - rule.stepWeeks + 1);
  if (st.up < rule.minUpWeeks || !(st.max <= Math.log(rule.maxStepRatio))) return null;
  // Copy must be true on every day on file, not only weekly: tonight has to
  // beat every daily point of the past year, or the read is not written.
  const from = addDays(asOf, -365);
  let top = null;
  for (const p of pts) { if (p[0] < from) continue; if (p[0] >= asOf) break; if (!top || p[1] > top[1]) top = p; }
  if (!top || !(now > top[1])) return null;
  return { now, prevHigh: top[1], prevHighDate: top[0], daysSinceHigh: dayNum(asOf) - dayNum(top[0]), abovePct: (now / top[1] - 1) * 100, upWeeks: st.up, downWeeks: st.down, maxStepPct: (Math.exp(st.max) - 1) * 100 };
}

// One read per cooldown: tonight must fire and no earlier weekly date inside the cooldown.
function firstInCooldown(test, asOf, rule) {
  const hit = test(asOf);
  if (!hit) return null;
  for (let k = 1; k < rule.cooldownWeeks; k += 1) if (test(addDays(asOf, -7 * k))) return null;
  return hit;
}

function yearFacts(pts, asOf) {
  const from = addDays(asOf, -365);
  const yr = pts.filter((p) => p[0] >= from && p[0] <= asOf);
  if (yr.length < 2) return {};
  let lo = yr[0], hi = yr[0];
  for (const p of yr) { if (p[1] < lo[1]) lo = p; if (p[1] > hi[1]) hi = p; }
  const now = pts.at(-1)[1];
  const before = yr.filter((p) => p[0] < asOf);
  const topOfYear = before.length > 0 && now >= Math.max(...before.map((p) => p[1]));
  const yearAgo = valueOn(pts, from);
  const spot = hi[1] > lo[1] ? Math.round(((now - lo[1]) / (hi[1] - lo[1])) * 100) : null;
  return { yearLow: lo[1], yearLowDate: lo[0], yearHigh: hi[1], yearHighDate: hi[0], topOfYear, yearAgo, yearAgoDate: yearAgo != null ? from : null, spot };
}

function move13(pts, asOf) {
  const a = valueOn(pts, addDays(asOf, -91));
  const z = valueOn(pts, asOf);
  return a > 0 && z > 0 ? { then: a, thenDate: addDays(asOf, -91), now: z, move: (z / a - 1) * 100, log: Math.log(z / a) } : null;
}

function setStats(item, peers, asOf) {
  const moves = [];
  for (const p of peers) { const m = move13(p.pts, asOf); if (m) moves.push({ id: p.id, move: m.move }); }
  const mine = moves.find((m) => m.id === item.id);
  if (!mine || moves.length < 5) return {};
  const sorted = moves.map((m) => m.move).sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const byPrice = peers.filter((p) => p.pts.at(-1)?.[0] === asOf).sort((a, z) => z.pts.at(-1)[1] - a.pts.at(-1)[1]);
  const rank = byPrice.findIndex((p) => p.id === item.id) + 1;
  return { setMedian13: median, setCount: moves.length, setBeat: moves.filter((m) => m.id !== item.id && m.move < mine.move).length, setRank: rank || null, setPriced: rank ? byPrice.length : null };
}

// Catch-all groups are not a set: no set age, no set comparison.
const NOT_A_SET = /miscellaneous|promo|world championship|trainer kit|league|prize pack|mcdonald|deck exclusives|blister exclusives/i;

function baseFacts(item, asOf, kind) {
  const notSet = NOT_A_SET.test(String(item.set || ""));
  const rel = /^\d{4}-\d{2}-\d{2}$/.test(String(item.release || "")) ? item.release : null;
  const ageYears = rel ? Math.floor((dayNum(asOf) - dayNum(rel)) / 365.25) : null;
  const who = kind === "sealed" ? String(item.name || "").trim() : cardTitle(item);
  return {
    asOf, kind, who, short: String(item.name || "").replace(/\s*\(.*\)\s*$/, "").trim(), setName: notSet ? null : short(item.set) || null,
    rarity: kind === "single" && !LOW.has(item.rarity) ? item.rarity : null, release: notSet ? null : rel, ageYears: notSet ? null : ageYears,
    firstDate: item.pts[0][0], firstPrice: item.pts[0][1], points: item.pts.length,
  };
}

// Gates every pathway shares: fresh tonight, not stale, not thin.
function passesGates(item, asOf, { seriesOf, lowOf, lowsOf, staleMarketRule }) {
  const last = item.pts.at(-1);
  if (!last || last[0] !== asOf || !(last[1] > 0)) return false;
  const supplied = typeof seriesOf === "function" ? seriesOf(item) : null;
  const series = Array.isArray(supplied) && supplied.length ? supplied : item.pts;
  const lows = typeof lowsOf === "function" ? lowsOf(item) : null;
  if (staleMarket(series, lows, asOf, staleMarketRule).stale) return false;
  if (typeof lowOf === "function" || item.low != null) {
    const thin = assessThin(series, asOf, { market: last[1], low: typeof lowOf === "function" ? lowOf(item) : item.low });
    if (thin.thin && !thin.canLead) return false;
  }
  return true;
}

function toRow(item, p, facts, cfg, asOf) {
  const seed = `${item.id}|${asOf}`;
  const got = renderPathway(p.pathway, facts, seed);
  if (!got) return null;
  const href = p.kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`;
  const start = facts.kind && p.pathway === "quiet-high" ? addDays(asOf, -7 * p.rule.priorWeeks) : addDays(asOf, -7 * p.rule.moveWeeks);
  const r = row(p.pathway, `${item.id}`, item.name, got.headline, got.lines, asOf, `TCGplayer market (tcgcsv daily archive and our nightly days), ${start} to ${asOf}`, {
    sku: item.id, href, set: item.set || "", price: facts.now, priceRead: true,
    chart: { label: "TCGplayer market", points: sparkOf(item.pts.filter((x) => x[0] >= start)) },
    startDate: start, endDate: asOf,
  });
  if (!r) return null;
  return {
    ...r,
    id: deepReadId(p.pathway, item.id),
    family: "deep",
    similar: `pathway:${p.pathway}`,
    pathway: { id: p.pathway, kind: p.kind, version: p.versionId, configHash: cfg.hash.slice(0, 12), registeredAt: cfg.registeredAt },
    phrase: { pathway: p.pathway, seed, facts, templates: got.templates, angles: got.angles },
  };
}

// items: { id, name, set, setSlug, release, rarity, pts } with pts sorted [[date, price]].
export function pathwayReads({ singles = [], sealed = [], asOf, cfg, seriesOf = null, lowOf = null, lowsOf = null, staleMarketRule = null, skip = new Set() } = {}) {
  if (!cfg || !Array.isArray(cfg.pathways) || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return [];
  const out = [];
  // One read per item a night: the first pathway in config order keeps it.
  const taken = new Set(skip);
  const gates = { seriesOf, lowOf, lowsOf, staleMarketRule };
  const bySetOf = (list) => { const m = new Map(); for (const c of list) { if (c.pts.at(-1)?.[0] !== asOf) continue; const k = c.set || ""; if (!m.has(k)) m.set(k, []); m.get(k).push(c); } return m; };
  const setsSingle = bySetOf(singles), setsSealed = bySetOf(sealed);
  for (const p of cfg.pathways) {
    const pool = p.kind === "sealed" ? sealed : singles;
    const sets = p.kind === "sealed" ? setsSealed : setsSingle;
    const rows = [];
    if (p.pathway === "quiet-high") {
      for (const item of pool) {
        if (taken.has(item.id) || (p.kind === "single" && LOW.has(item.rarity))) continue;
        if (!passesGates(item, asOf, gates)) continue;
        const hit = firstInCooldown((d) => quietHighAt(item.pts, d, p.rule), asOf, p.rule);
        if (!hit) continue;
        const facts = { ...baseFacts(item, asOf, p.kind), ...yearFacts(item.pts, asOf), ...hit, ...setStats(item, sets.get(item.set || "") || [], asOf) };
        const m = move13(item.pts, asOf);
        if (m) facts.move13 = m.move;
        rows.push({ item, facts, weight: hit.abovePct });
      }
    } else if (p.pathway === "quiet-climber") {
      // Peers: same set and rarity, priced at or above the floor on both ends.
      const groups = new Map();
      for (const c of pool) {
        if (LOW.has(c.rarity)) continue;
        const key = `${c.set}|${c.rarity}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
      }
      const testAt = (item, d) => {
        const g = groups.get(`${item.set}|${item.rarity}`) || [];
        const moves = [];
        let mine = null;
        for (const c of g) {
          const a = valueOn(c.pts, addDays(d, -7 * p.rule.moveWeeks)), z = valueOn(c.pts, d);
          if (!(a > 0) || !(z >= p.rule.minPrice)) continue;
          const lm = Math.log(z / a);
          moves.push(lm);
          if (c.id === item.id) mine = lm;
        }
        if (mine == null || moves.length < p.rule.minPeers) return null;
        moves.sort((a, b) => a - b);
        const med = moves.length % 2 ? moves[(moves.length - 1) / 2] : (moves[moves.length / 2 - 1] + moves[moves.length / 2]) / 2;
        const rel = mine - med;
        if (!(rel >= Math.log(p.rule.relLow)) || !(rel <= Math.log(p.rule.relHigh))) return null;
        // A missing week counts as not up, as in the pre-registered test.
        const w = weekly(item.pts, d, p.rule.stepWeeks);
        const st = steps(w, 1);
        if (st.up < p.rule.minUpWeeks || !(st.max <= Math.log(p.rule.maxStepRatio))) return null;
        return { peerCount: moves.length, peerMedian: (Math.exp(med) - 1) * 100, move13: (Math.exp(mine) - 1) * 100, relPts: ((Math.exp(mine) - 1) - (Math.exp(med) - 1)) * 100, upWeeks: st.up, downWeeks: st.down, maxStepPct: (Math.exp(st.max) - 1) * 100 };
      };
      for (const item of pool) {
        if (taken.has(item.id) || LOW.has(item.rarity)) continue;
        if (!passesGates(item, asOf, gates)) continue;
        const hit = firstInCooldown((d) => testAt(item, d), asOf, p.rule);
        if (!hit) continue;
        const m = move13(item.pts, asOf);
        if (!m) continue;
        const facts = { ...baseFacts(item, asOf, p.kind), ...yearFacts(item.pts, asOf), ...setStats(item, sets.get(item.set || "") || [], asOf), ...hit, now: m.now, then: m.then, thenDate: m.thenDate };
        rows.push({ item, facts, weight: hit.relPts });
      }
    }
    // Most room above the bar first, ties by a stable hash so a rebuild is the same.
    rows.sort((a, z) => z.weight - a.weight || hashOf(`${a.item.id}|${asOf}`) - hashOf(`${z.item.id}|${asOf}`));
    let n = 0;
    for (const r of rows) {
      if (n >= p.maxReads) break;
      const rr = toRow(r.item, p, r.facts, cfg, asOf);
      if (rr) { out.push(rr); taken.add(r.item.id); n += 1; }
    }
  }
  return out;
}

// Rows the private forward ledger keeps. One per read id, day and version.
export function ledgerRows(reads) {
  return (reads || []).filter((r) => r?.pathway?.version).map((r) => ({
    readId: r.id, sku: r.sku, asOf: r.asOf, pathway: r.pathway.id, kind: r.pathway.kind, version: r.pathway.version,
    configHash: r.pathway.configHash, price: num(r.price), templates: r.phrase?.templates || [], angles: r.phrase?.angles || [],
  }));
}

export function appendLedger(ledger, rows) {
  const doc = ledger && Array.isArray(ledger.calls) ? ledger : { private: true, calls: [] };
  const seen = new Set(doc.calls.map((c) => `${c.readId}|${c.asOf}|${c.version}`));
  let added = 0;
  for (const r of rows) {
    const k = `${r.readId}|${r.asOf}|${r.version}`;
    if (seen.has(k)) continue;
    seen.add(k);
    doc.calls.push(r);
    added += 1;
  }
  return { doc, added };
}
