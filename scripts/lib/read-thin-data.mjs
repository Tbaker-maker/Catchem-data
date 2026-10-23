// Shared thin-data check. Every limit lives in catchem-data-private
// (config/read-thin-data.json). This file never stores those numbers.
// A missing config or a missing limit blocks the read. Nothing is guessed.
// A blocked read is left out and written to the flag file. It is not rewritten.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MARK = /^(SWSH|SV|SM|ME|XY|BW|HGSS|DP|EX|POP)\s?\d*[A-Za-z.]*\s?[:-]/i;
const WORD = /^(SWSH|SV|SM|ME|XY|BW|HGSS|DP|EX|POP)\b/i;

const REASON = {
  "single-price": "This slump or recovery rests on one dated price.",
  "single-jump": "This slump or recovery is one jump between two prices.",
  "thin-listings": "This big move rests on too few listings counted.",
  "small-dip": "This sealed dip is too small in percent or dollars.",
  "date-mismatch": "The listings counted date is not the same day as the price date.",
  "era-mismatch": "The era tag does not come from the set release era.",
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function limitNum(v) {
  if (v == null || v === "") return null;
  return num(v);
}

function hit(rule) {
  const reason = REASON[rule];
  return reason ? { rule, reason } : null;
}

// Era code from the set name prefix. One function for every read builder.
export function releaseEra(setName) {
  const g = String(setName || "");
  const m = g.match(MARK) || g.match(WORD);
  return m ? m[1].toUpperCase() : "";
}

const LIMIT_KEYS = ["minAnchorDays", "anchorBand", "minJumps", "jumpRatio", "minListings", "bigMoveRatio", "minDipPct", "minDipUsd", "maxDayGap"];
const LIMITS_MISSING = { rule: "limits-missing", reason: "thin data limits not loaded" };

export function validReadThin(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const out = {};
  for (const key of LIMIT_KEYS) {
    const n = limitNum(cfg[key]);
    if (n == null) return null;
    out[key] = n;
  }
  if (!cfg.eraTags || typeof cfg.eraTags !== "object" || Array.isArray(cfg.eraTags)) return null;
  out.eraTags = cfg.eraTags;
  return out;
}

let cacheKey = "";
let cacheVal;

export async function loadReadThinData(root = ROOT) {
  const key = `${String(root || "")}\n${process.env.READ_THIN_DATA_FILE || ""}`;
  if (cacheKey === key && cacheVal !== undefined) return cacheVal;
  const candidates = [
    process.env.READ_THIN_DATA_FILE,
    join(root, "..", "catchem-data-private", "config", "read-thin-data.json"),
  ].filter(Boolean);
  let found = null;
  for (const path of candidates) {
    try {
      found = validReadThin(JSON.parse(await readFile(path, "utf8")));
      if (found) break;
    } catch { /* next place */ }
  }
  if (!found) {
    const token = process.env.PRIVATE_DATA_TOKEN || "";
    if (token) {
      try {
        const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/read-thin-data.json", {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-read-thin-data" },
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) found = validReadThin(await res.json());
      } catch { /* no config, no opinion */ }
    }
  }
  cacheKey = key;
  cacheVal = found;
  return found;
}

export function clearReadThinCache() {
  cacheKey = "";
  cacheVal = undefined;
}

function dayGap(a, b) {
  if (!DAY.test(String(a || "")) || !DAY.test(String(b || ""))) return null;
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
  return Math.abs(Math.round((da - db) / 86400000));
}

function pointsOf(read) {
  const raw = read?.thin?.points || read?.chart?.points;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!Array.isArray(row)) continue;
    const price = Number(row[1]);
    if (!(price > 0)) continue;
    out.push([String(row[0] || "").slice(0, 10), price]);
  }
  return out;
}

function daysNear(points, price, band) {
  if (!(price > 0) || !(band >= 0)) return 0;
  let n = 0;
  for (const row of points) {
    if (Math.abs(row[1] - price) / price <= band) n += 1;
  }
  return n;
}

function levels(points, band) {
  const out = [];
  for (const row of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(row[1] - last.price) / last.price <= band) {
      last.days += 1;
      last.end = row[0];
    } else {
      out.push({ price: row[1], days: 1, start: row[0], end: row[0] });
    }
  }
  return out;
}

function lastMoveRatio(points) {
  if (points.length < 2) return null;
  const last = points[points.length - 1][1];
  if (!(last > 0)) return null;
  for (let i = points.length - 2; i >= 0; i -= 1) {
    const prev = points[i][1];
    if (prev > 0 && Math.abs(prev - last) / last > 0.01) return last / prev;
  }
  return null;
}

function largeSteps(lv, ratio, direction) {
  let n = 0;
  for (let i = 1; i < lv.length; i += 1) {
    const a = lv[i - 1].price;
    const b = lv[i].price;
    if (!(a > 0) || !(b > 0)) continue;
    const gain = direction === "up" ? b / a : a / b;
    if (gain >= ratio) n += 1;
  }
  return n;
}

function claimOf(read) {
  const named = String(read?.thin?.claim || read?.deep || "");
  if (named === "slump" || named === "recovery") return named;
  return "";
}

export function prepareThin(read) {
  const prior = read?.thin && typeof read.thin === "object" ? { ...read.thin } : {};
  const claim = prior.claim || claimOf({ ...read, thin: prior });
  if (claim) prior.claim = claim;
  const points = pointsOf({ ...read, thin: prior });
  if (points.length && !prior.points) prior.points = points;
  if (prior.moveRatio == null) {
    const ratio = lastMoveRatio(points);
    if (ratio != null) prior.moveRatio = ratio;
  }
  const head = `${read?.headline || ""} ${read?.path || ""}`;
  if (/doubl/i.test(head)) prior.bigMove = true;
  const from = num(read?.receipt?.marketFrom);
  const to = num(read?.receipt?.marketTo);
  const sealed = read?.lane === "sealed" || read?.readKind === "mktmove" || read?.kind === "mktmove" || prior.sealed === true;
  if (sealed && from > 0 && to > 0 && to < from) {
    prior.sealed = true;
    prior.claim = prior.claim || "sealed-dip";
    if (prior.dipUsd == null) prior.dipUsd = from - to;
    if (prior.dipPct == null) prior.dipPct = ((from - to) / from) * 100;
    if (!prior.priceDate) prior.priceDate = String(read?.receipt?.to || read?.endDate || read?.asOf || "").slice(0, 10);
  }
  const era = (read?.signals || []).find((chip) => chip?.kind === "era");
  if (era?.tag && !prior.eraTag) prior.eraTag = String(era.tag);
  if (!prior.setName) {
    const fromSet = String(read?.set || "");
    const fromName = String(read?.name || "");
    prior.setName = fromSet || (releaseEra(fromName) ? fromName : "");
  }
  const tileFrom = num(read?.tiles?.price?.from);
  const tileTo = num(read?.price);
  if (prior.moveRatio == null && tileFrom > 0 && tileTo > 0) prior.moveRatio = tileTo / tileFrom;
  const pct = num(read?.changePct);
  if (prior.moveRatio == null && pct != null) prior.moveRatio = 1 + pct / 100;
  return { ...read, thin: prior };
}

function seriesHits(read, cfg) {
  const claim = claimOf(read);
  const points = pointsOf(read);
  if (!claim || !points.length) return [];
  const hits = [];
  if (points.length < cfg.minAnchorDays) hits.push(hit("single-price"));
  if (claim === "slump" && points.length) {
    const peak = Math.max(...points.map((row) => row[1]));
    if (daysNear(points, peak, cfg.anchorBand) < cfg.minAnchorDays) hits.push(hit("single-price"));
  }
  if (points.length > 1) {
    const lv = levels(points, cfg.anchorBand);
    if (claim === "recovery" && lv.length > 1) {
      const prev = lv[lv.length - 2];
      const last = lv[lv.length - 1];
      if (prev.price > 0 && last.price / prev.price >= cfg.jumpRatio && largeSteps(lv, cfg.jumpRatio, "up") < cfg.minJumps) hits.push(hit("single-jump"));
    }
    if (claim === "slump" && lv.length > 1) {
      const peak = Math.max(...lv.map((row) => row.price));
      const idx = lv.findIndex((row) => peak > 0 && Math.abs(row.price - peak) / peak <= cfg.anchorBand);
      if (idx >= 0 && idx < lv.length - 1) {
        const next = lv[idx + 1];
        if (next.price > 0 && lv[idx].price / next.price >= cfg.jumpRatio && largeSteps(lv, cfg.jumpRatio, "down") < cfg.minJumps) hits.push(hit("single-jump"));
      }
    }
  }
  return hits.filter(Boolean);
}

function bigMoveHit(read, cfg) {
  if (cfg.bigMoveRatio == null || cfg.minListings == null) return null;
  const thin = read.thin || {};
  const ratio = num(thin.moveRatio);
  const named = thin.bigMove === true || thin.claim === "big-move";
  const big = named || (ratio != null && ratio >= cfg.bigMoveRatio);
  if (!big) return null;
  if (ratio != null && !(ratio >= cfg.bigMoveRatio) && !named) return null;
  if (named && ratio != null && !(ratio >= cfg.bigMoveRatio)) return null;
  const n = num(thin.listingsCounted);
  if (n == null || !(n < cfg.minListings)) return null;
  return hit("thin-listings");
}

function dipHit(read, cfg) {
  if (cfg.minDipPct == null || cfg.minDipUsd == null) return null;
  const thin = read.thin || {};
  if (thin.claim !== "sealed-dip" && thin.sealed !== true) return null;
  const usd = num(thin.dipUsd);
  const pct = num(thin.dipPct);
  if (!(usd > 0) || !(pct > 0)) return null;
  if (usd < cfg.minDipUsd || pct < cfg.minDipPct) return hit("small-dip");
  return null;
}

function dateHit(read, cfg) {
  if (cfg.maxDayGap == null) return null;
  const thin = read.thin || {};
  const gap = dayGap(thin.listingsDate, thin.priceDate);
  if (gap == null || !(gap > cfg.maxDayGap)) return null;
  return hit("date-mismatch");
}

function eraHit(read, cfg) {
  if (!cfg.eraTags) return null;
  const thin = read.thin || {};
  const tag = String(thin.eraTag || "");
  const setName = String(thin.setName || read?.set || "");
  const allowed = tag && Array.isArray(cfg.eraTags[tag]) ? cfg.eraTags[tag] : null;
  if (!allowed || !setName) return null;
  const era = releaseEra(setName);
  if (!era) return null;
  const ok = allowed.map((item) => String(item || "").toUpperCase()).includes(era);
  return ok ? null : hit("era-mismatch");
}

export function thinReadHits(read, cfg) {
  if (!read) return [];
  const rules = validReadThin(cfg);
  if (!rules) return [LIMITS_MISSING];
  const row = prepareThin(read);
  const hits = [];
  const seen = new Set();
  for (const item of [...seriesHits(row, rules), bigMoveHit(row, rules), dipHit(row, rules), dateHit(row, rules), eraHit(row, rules)]) {
    if (!item || seen.has(item.rule)) continue;
    seen.add(item.rule);
    hits.push(item);
  }
  return hits;
}

export function thinReadBlock(read, cfg) {
  return thinReadHits(read, cfg)[0] || null;
}

function snapshot(read) {
  return {
    id: read?.id || "",
    name: read?.name || "",
    headline: read?.headline || "",
    set: read?.set || read?.thin?.setName || "",
    sku: read?.sku || "",
    readKind: read?.readKind || read?.kind || "",
    deep: read?.deep || "",
  };
}

export function gateReads(reads, cfg, annotate = null) {
  const rules = validReadThin(cfg);
  const list = Array.isArray(reads) ? reads : [];
  if (!rules) {
    return {
      keep: [],
      flags: list.map((read) => ({
        id: read?.id || "",
        name: read?.name || "",
        rule: LIMITS_MISSING.rule,
        reason: LIMITS_MISSING.reason,
        read: snapshot(read),
      })),
    };
  }
  const keep = [];
  const flags = [];
  for (const read of list) {
    const row = prepareThin(read);
    if (typeof annotate === "function") {
      const extra = annotate(read);
      if (extra && typeof extra === "object") Object.assign(row.thin, extra);
    }
    const hits = thinReadHits(row, rules);
    if (!hits.length) {
      if (read && read.thin && typeof read.thin === "object") delete read.thin;
      keep.push(read);
      continue;
    }
    const first = hits[0];
    flags.push({
      id: row.id || "",
      name: row.name || "",
      rule: first.rule,
      reason: first.reason,
      read: snapshot(row),
    });
  }
  return { keep, flags };
}

export async function writeReadFlags(root, asOf, flags) {
  const day = String(asOf || "").slice(0, 10);
  if (!DAY.test(day) || !Array.isArray(flags) || !flags.length) return null;
  const dir = join(root, "data/derived/read-flags");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${day}.json`);
  let prev = [];
  try { prev = JSON.parse(await readFile(path, "utf8")).flags || []; } catch { /* new day */ }
  const seen = new Set(prev.map((row) => `${row.id}|${row.rule}`));
  const next = prev.slice();
  for (const row of flags) {
    const key = `${row.id}|${row.rule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(row);
  }
  const doc = {
    asOf: day,
    source: "Thin data check. Blocked reads are left out and listed here. They are not rewritten.",
    flags: next,
  };
  await writeFile(path, `${JSON.stringify(doc, null, 1)}\n`);
  return doc;
}

export async function loadListingIndex(root) {
  try {
    const doc = JSON.parse(await readFile(join(root, "data/derived/listing-counts/latest.json"), "utf8"));
    const out = new Map();
    for (const [id, row] of Object.entries(doc?.rows || {})) {
      const n = num(row?.listingsCounted);
      if (n == null) continue;
      out.set(id, { n, date: String(row?.date || "").slice(0, 10) });
    }
    return out;
  } catch {
    return new Map();
  }
}

export function listingAnnotate(index) {
  if (!index || typeof index.get !== "function") return null;
  return (read) => {
    const row = index.get(String(read?.sku || "")) || index.get(String(read?.id || ""));
    if (!row || !Number.isFinite(row.n)) return null;
    return { listingsCounted: row.n };
  };
}

// Drop blocked reads only after the flag file is written. No flag, no drop.
export async function dropThinReads(reads, root, asOf, annotate = null) {
  const cfg = await loadReadThinData(root);
  const { keep, flags } = gateReads(reads, cfg, annotate);
  if (!flags.length) return Array.isArray(reads) ? reads.slice() : [];
  try {
    const wrote = await writeReadFlags(root, asOf, flags);
    if (!wrote) return Array.isArray(reads) ? reads.slice() : [];
  } catch {
    return Array.isArray(reads) ? reads.slice() : [];
  }
  return keep;
}
