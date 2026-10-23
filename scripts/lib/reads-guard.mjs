// Last check on the public reads before they ship.
// Every limit lives in catchem-data-private (config/reads-guard.json). This file
// never stores those numbers. Without the limits the price checks do not run
// and the step says so. A blocked read is left out and listed in the flag file.
// Nothing is rewritten except a chip or a date that the read's own files disprove.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { eraTagOf, eraLabel } from "./signal-chips.mjs";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KEYS = ["spikeRatio", "neighborBand", "maxSpikeRun", "flipRatio", "flatMinPoints", "stepRatio", "minListingsChange"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const REASON = {
  "spike-price": "The read cites a price that is one short jump, with the prices on both sides in agreement.",
  "price-flip": "The price jumped to a fixed level and straight back. That is not a steady move.",
  "flat-step": "The move is one step to or from a price that sat exactly still for many days.",
  "no-change": "The listings counted did not change, so there is nothing to read.",
};

const cents = (v) => Math.round(Number(v) * 100);

export function validGuard(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const out = {};
  for (const key of KEYS) {
    const n = Number(cfg[key]);
    if (cfg[key] == null || cfg[key] === "" || !Number.isFinite(n)) return null;
    out[key] = n;
  }
  return out;
}

export async function loadGuard(root) {
  const paths = [process.env.READS_GUARD_FILE, join(root, "..", "catchem-data-private", "config", "reads-guard.json")].filter(Boolean);
  for (const path of paths) {
    try {
      const got = validGuard(JSON.parse(await readFile(path, "utf8")));
      if (got) return got;
    } catch { /* next */ }
  }
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/reads-guard.json", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-reads-guard" },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? validGuard(await res.json()) : null;
  } catch {
    return null;
  }
}

export function monthDay(day) {
  if (!DAY.test(String(day || ""))) return "";
  return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
}

function moneyText(v) {
  const n = Number(v);
  if (!(n > 0)) return "";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function textOf(read) {
  const lines = Array.isArray(read?.lines) ? read.lines.join(" ") : "";
  return `${read?.headline || ""} ${read?.path || ""} ${lines}`;
}

// Chart points and the daily files, merged by date. Dates only, no filling.
export function seriesOf(read, daily) {
  const map = new Map();
  for (const row of read?.chart?.points || []) {
    if (Array.isArray(row) && DAY.test(String(row[0]).slice(0, 10)) && Number(row[1]) > 0) map.set(String(row[0]).slice(0, 10), Number(row[1]));
  }
  const id = String(read?.sku || "").match(/^tcgcsv-(\d+)$/)?.[1];
  const rows = id && daily ? daily.get(id) : null;
  if (rows && rows.length) {
    const price = Number(read?.price);
    const printings = [...new Set(rows.map((r) => r.printing))];
    const last = (p) => rows.filter((r) => r.printing === p).sort((a, b) => a.date.localeCompare(b.date)).pop();
    const pick = printings.find((p) => cents(last(p)?.market) === cents(price)) || (printings.length === 1 ? printings[0] : null);
    if (pick) for (const r of rows) if (r.printing === pick) map.set(r.date, r.market);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function levelsOf(points) {
  const out = [];
  for (const [day, price] of points) {
    const last = out[out.length - 1];
    if (last && cents(last.price) === cents(price)) { last.n += 1; last.end = day; } else out.push({ price, n: 1, start: day, end: day });
  }
  return out;
}

const close = (a, b, band) => Math.abs(a - b) / Math.max(a, b) <= band;
const ratio = (a, b) => Math.max(a, b) / Math.min(a, b);

// Prices that are a short run with agreeing neighbours on both sides.
export function spikePrices(points, cfg) {
  const out = new Set();
  for (let i = 1; i < points.length - 1; i += 1) {
    for (let run = 1; run <= cfg.maxSpikeRun && i + run < points.length; run += 1) {
      const left = points[i - 1][1];
      const right = points[i + run][1];
      if (!close(left, right, cfg.neighborBand)) continue;
      const mid = (left + right) / 2;
      const inner = points.slice(i, i + run).map((p) => p[1]);
      if (inner.every((p) => ratio(p, mid) >= cfg.spikeRatio)) inner.forEach((p) => out.add(cents(p)));
    }
  }
  return out;
}

export function flipHit(points, cfg) {
  const lv = levelsOf(points);
  if (lv.length < 3) return false;
  const [a, b, c] = lv.slice(-3);
  return cents(a.price) === cents(c.price) && ratio(a.price, b.price) >= cfg.flipRatio;
}

export function flatStepHit(points, cfg) {
  const lv = levelsOf(points);
  if (lv.length < 2) return false;
  const last = lv[lv.length - 1];
  const prev = lv[lv.length - 2];
  if (ratio(last.price, prev.price) < cfg.stepRatio) return false;
  return last.n >= cfg.flatMinPoints || prev.n >= cfg.flatMinPoints;
}

// Set wide reads name one card as a link. Its price is not the read.
const SET_KINDS = new Set(["set", "breadth", "setheat"]);

export function priceHits(read, cfg, daily) {
  if (!cfg || SET_KINDS.has(read?.readKind)) return [];
  const points = seriesOf(read, daily);
  if (points.length < 3) return [];
  const hits = [];
  const spikes = spikePrices(points, cfg);
  const text = textOf(read);
  for (const c of spikes) {
    const m = moneyText(c / 100);
    if (m && text.includes(m)) { hits.push("spike-price"); break; }
  }
  if (spikes.has(cents(read?.price))) hits.push("spike-price");
  if (flipHit(points, cfg)) hits.push("price-flip");
  if (flatStepHit(points, cfg)) hits.push("flat-step");
  return [...new Set(hits)];
}

function chipPct(chip) {
  const m = String(chip?.text || "").match(/(-?\d+(?:\.\d+)?)%\s*(\d+)D/i);
  return m ? { pct: Number(m[1]), days: Number(m[2]) } : null;
}

// A chip that says the opposite of its own read is taken off. The read stays.
export function fixChips(read, cfg = null) {
  const signals = Array.isArray(read?.signals) ? read.signals : null;
  if (!signals) return { read, changed: [] };
  const changed = [];
  const pct = Number(read?.changePct);
  const days = Number(read?.windowDays);
  const has = Number.isFinite(pct) && Number.isFinite(days) && days > 0;
  const sign = has ? Math.sign(Math.round(pct)) : 0;
  const keep = [];
  for (const chip of signals) {
    if (chip?.kind === "era") {
      const tag = chip.tag;
      const release = String(read?.release || read?.setRelease || "").slice(0, 10);
      const want = release ? eraTagOf(release) : "";
      if (want && want !== tag) { keep.push({ ...chip, tag: want, label: eraLabel(want) }); changed.push("era"); continue; }
    }
    if (has && chip?.kind === "move") {
      const c = chipPct(chip);
      const dir = chip.dir === "up" ? 1 : chip.dir === "down" ? -1 : 0;
      if (c && c.days === days && dir !== sign) { changed.push("move"); continue; }
    }
    if (has && days <= 7 && chip?.kind === "momentum") {
      const w = String(chip.word || "");
      const bad = (w === "Flat" && sign !== 0) || (w === "Rising" && sign < 0) || (w === "Cooling" && sign > 0);
      if (bad) { changed.push("momentum"); continue; }
    }
    const rn = Number(read?.receipt?.n);
    const rp = Number(read?.receipt?.prev);
    const way = Number.isFinite(rn) && Number.isFinite(rp) && read?.receipt?.prev != null ? Math.sign(rn - rp) : null;
    const chipWay = chip?.dir === "up" ? 1 : chip?.dir === "down" ? -1 : 0;
    if (chip?.kind === "listings" && thinListings(read, cfg)) { changed.push("listings"); continue; }
    if (chip?.kind === "listings" && way != null && chipWay !== way) {
      changed.push("listings");
      continue;
    }
    keep.push(chip);
  }
  if (!changed.length) return { read, changed };
  const out = { ...read, signals: keep };
  if (read.tiles && changed.includes("listings")) { out.tiles = { ...read.tiles }; delete out.tiles.listings; }
  return { read: out, changed };
}

// A listings trend word on a count that moved by only a few listings is not a trend.
export function thinListings(read, cfg) {
  const spark = read?.tiles?.listings?.spark;
  if (!cfg || !Array.isArray(spark) || spark.length < 2) return false;
  const a = Number(spark[0]);
  const b = Number(spark[spark.length - 1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(b - a) < cfg.minListingsChange;
}

// Product ids in the Post Office catalogue whose daily prices fail the price checks.
export function guardSkip(catalogue, cfg, daily) {
  const out = new Set();
  if (!cfg || !daily) return out;
  for (const set of catalogue?.sets || []) {
    for (const p of set.prices || []) {
      if (!(Number(p?.price) > 0)) continue;
      const hits = priceHits({ sku: String(p.id || ""), price: p.price, readKind: "card", headline: "" }, cfg, daily);
      if (hits.length) out.add(String(p.id));
    }
  }
  return out;
}

// signal-chips.json must match the guarded reads: no chips for a left out read,
// and the same fixed chips the read now carries.
export function guardChipDoc(doc, keep, flags, cfg = null) {
  if (!doc || typeof doc !== "object") return doc;
  const gone = new Set((flags || []).map((f) => f.id));
  const kept = new Map((keep || []).map((r) => [r.id, r]));
  const byId = {};
  for (const [id, row] of Object.entries(doc.byId || {})) {
    if (gone.has(id)) continue;
    const read = kept.get(id);
    let next = read && Array.isArray(read.signals) ? { ...row, signals: read.signals } : row;
    if (read?.tiles && next.tiles) next = { ...next, tiles: read.tiles };
    const fixed = fixChips(next, cfg).read;
    byId[id] = fixed;
  }
  const bySku = {};
  for (const [sku, id] of Object.entries(doc.bySku || {})) if (byId[id]) bySku[sku] = id;
  const ok = (row) => row && !gone.has(row.id) && byId[row.id];
  const swap = (row) => (ok(row) ? { ...row, signals: byId[row.id].signals } : null);
  const first = Object.entries(byId).find(([, row]) => (row.signals || []).length);
  let preview = swap(doc.preview);
  if (!preview && first) preview = { id: first[0], name: first[1].name, signals: first[1].signals, blurb: first[1].blurb || "" };
  const samples = (doc.samples || []).map(swap).filter(Boolean);
  return { ...doc, byId, bySku, preview: preview || doc.preview, samples };
}

export function noChangeListings(read) {
  const r = read?.receipt;
  return (read?.readKind === "listings" || read?.kind === "listings") && r && r.n != null && Number(r.n) === Number(r.prev);
}

// The eBay ask is dated by the day it was captured, not a carried row.
export function fixAskDate(read, heatRows) {
  if (read?.readKind !== "askmove" || !read.receipt?.from) return { read, changed: false };
  const rows = (heatRows || []).filter((r) => r.id === read.sku).sort((a, b) => a.date.localeCompare(b.date));
  let i = rows.findIndex((r) => r.date === read.receipt.from);
  if (i < 0) return { read, changed: false };
  const same = (a, b) => cents(a.price) === cents(b.price) && a.listingCount != null && Number(a.listingCount) === Number(b.listingCount);
  while (i > 0 && same(rows[i], rows[i - 1])) i -= 1;
  const day = rows[i].date;
  if (day === read.receipt.from) return { read, changed: false };
  const was = `${monthDay(read.receipt.from)} to`;
  const now = `${monthDay(day)} to`;
  const swap = (s) => (typeof s === "string" ? s.split(was).join(now) : s);
  return {
    read: { ...read, headline: swap(read.headline), path: swap(read.path), why: swap(read.why), receipt: { ...read.receipt, from: day } },
    changed: true,
  };
}

export async function loadDaily(root, days = 30) {
  const dir = join(root, "data/history/tcgcsv-daily");
  let names = [];
  try { names = (await readdir(dir)).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().slice(-days); } catch { return new Map(); }
  const out = new Map();
  let prev = "";
  for (const name of names) {
    let doc;
    try { doc = JSON.parse(await readFile(join(dir, name), "utf8")); } catch { continue; }
    const key = JSON.stringify(doc.prices || null);
    if (key === prev) continue; // an exact copy of the day before is a missing day
    prev = key;
    const date = name.slice(0, 10);
    for (const p of doc.prices || []) {
      if (!(Number(p.market) > 0)) continue;
      const id = String(p.id);
      if (!out.has(id)) out.set(id, []);
      out.get(id).push({ date, market: Number(p.market), printing: p.printing || "" });
    }
  }
  return out;
}

// Check our own picture host with a plain GET (the site answers HEAD with 404). A clear 404 falls back to the TCGplayer photo
// for the same product id. A network error keeps the picture as it is.
export async function fixImage(read, head) {
  const img = String(read?.image || "");
  if (!/^https:\/\/catchemtcg\.com\/data\/editor\//.test(img)) return { read, changed: false };
  let status = 0;
  try { status = await head(img); } catch { return { read, changed: false }; }
  if (status !== 404) return { read, changed: false };
  const pid = String(read?.sku || "").match(/^tcgcsv-(\d+)$/)?.[1] || (/^\d+$/.test(String(read?.tcgPlayerId || "")) ? String(read.tcgPlayerId) : "");
  const next = pid ? `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_in_400x400.jpg` : "https://catchemtcg.com/og.png";
  return { read: { ...read, image: next }, changed: true };
}

export async function guardReads(reads, { cfg, daily, heatRows, head, releaseOf }) {
  const keep = [];
  const flags = [];
  const fixes = [];
  for (const raw of reads || []) {
    let read = raw;
    if (releaseOf && !read.release) {
      const rel = releaseOf(read);
      if (rel) read = { ...read, release: rel };
    }
    if (noChangeListings(read)) { flags.push(flagRow(read, "no-change")); continue; }
    const hits = priceHits(read, cfg, daily);
    if (hits.length) { flags.push(flagRow(read, hits[0])); continue; }
    const a = fixAskDate(read, heatRows); read = a.read; if (a.changed) fixes.push({ id: read.id, fix: "ask-date" });
    const c = fixChips(read, cfg); read = c.read; for (const k of c.changed) fixes.push({ id: read.id, fix: `chip-${k}` });
    if (head) { const im = await fixImage(read, head); read = im.read; if (im.changed) fixes.push({ id: read.id, fix: "image" }); }
    if (read.release && !raw.release) delete read.release;
    keep.push(read);
  }
  return { keep: spaceFamilies(keep), flags, fixes };
}

// Leaving a read out can put two of the same family side by side. Take the
// next read of another family instead, keeping the order as close as it was.
export function spaceFamilies(reads) {
  const fam = (r) => r?.family || r?.readKind || "";
  const left = reads.slice();
  const out = [];
  while (left.length) {
    const last = out.length ? fam(out[out.length - 1]) : null;
    let i = left.findIndex((r) => fam(r) !== last);
    if (i < 0) i = 0;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

function flagRow(read, rule) {
  return {
    id: read?.id || "",
    name: read?.name || "",
    rule,
    reason: REASON[rule],
    read: { id: read?.id || "", name: read?.name || "", headline: read?.headline || "", sku: read?.sku || "", readKind: read?.readKind || "" },
  };
}
