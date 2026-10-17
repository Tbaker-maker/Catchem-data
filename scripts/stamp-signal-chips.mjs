// Writes public signal chips. Rules come from catchem-data-private.
// The public file has the chip words and the as-of date only.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { readSignals } from "./lib/signal-chips.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC = join(ROOT, "research/assets/public");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

async function loadRules() {
  const direct = process.env.SIGNAL_RULES || "";
  if (direct) {
    const doc = await readJson(direct);
    if (!doc) throw new Error("signal rules file was not readable");
    return doc;
  }
  const store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" });
  try {
    const doc = await readJson(join(store.dir, "signal-chips/thresholds.json"));
    if (!doc) {
      console.log("signal chips: rules file is not in the private store, so no chips were written");
      return null;
    }
    return doc;
  } finally {
    if (store.remote) await store.close(["signal-chips/thresholds.json"], "signal chip rules");
  }
}

function skuOf(read) {
  const sku = String(read?.sku || "");
  if (/^tcgcsv-\d+$/.test(sku)) return sku;
  const href = String(read?.href || "");
  const fromHref = href.match(/\/(?:c|p)\/(tcgcsv-\d+)/);
  if (fromHref) return fromHref[1];
  const fromId = String(read?.id || "").match(/(tcgcsv-\d+)/);
  return fromId ? fromId[1] : "";
}

function parseSpark(packed, asOf) {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(end) || !packed) return [];
  const out = [];
  for (const bit of String(packed).split(",")) {
    const m = bit.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const off = Number(m[1]);
    const price = Number(m[2]);
    if (off < 0 || off > 120 || !(price > 0)) continue;
    out.push([new Date(end - off * 86400000).toISOString().slice(0, 10), price]);
  }
  return out;
}

function parseHist(packed) {
  const epoch = Date.parse("1970-01-01T00:00:00Z");
  const out = [];
  for (const bit of String(packed || "").split(",")) {
    const m = bit.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const price = Number(m[2]);
    if (!(price > 0)) continue;
    out.push([new Date(epoch + Number(m[1]) * 86400000).toISOString().slice(0, 10), price]);
  }
  return out;
}

async function indexPacked(dir, wanted, parse) {
  const hit = new Map();
  let names = [];
  try { names = await readdir(dir); } catch { return hit; }
  for (const name of names) {
    if (!name.endsWith(".json") || name === "summary.json") continue;
    if (hit.size >= wanted.size) break;
    const doc = await readJson(join(dir, name));
    const rows = doc?.rows;
    if (!rows || typeof rows !== "object") continue;
    for (const id of wanted) {
      if (hit.has(id) || rows[id] == null) continue;
      hit.set(id, parse(rows[id]));
    }
  }
  return hit;
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function listingsFor(read, byId, byName) {
  const keys = [read?.sku, skuOf(read), String(read?.href || "").split("/").pop()];
  for (const key of keys) {
    if (key && byId.has(key)) return byId.get(key);
  }
  const name = norm(read?.name);
  return name && byName.has(name) ? byName.get(name) : null;
}

function setFor(read, sets) {
  const slug = String(read?.setSlug || read?.receipt?.slug || "").toLowerCase();
  const name = norm(read?.set || read?.name);
  return sets.find((row) => (slug && row.slug === slug) || (name && norm(row.name) === name)) || null;
}

function monthsUntil(status, asOf) {
  const m = String(status || "").match(/([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
  const idx = months[m[1].toLowerCase()];
  if (idx == null) return null;
  const when = Date.UTC(Number(m[3]), idx, Number(m[2]));
  const now = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(when) || !Number.isFinite(now) || when <= now) return null;
  return (when - now) / (86400000 * 30.44);
}

export async function stampSignalChips({ root = ROOT, rules, writeReads = false } = {}) {
  const readsPath = join(root, "research/assets/public/reads.json");
  const bundle = await readJson(readsPath);
  const reads = Array.isArray(bundle?.reads) ? bundle.reads : [];
  if (!rules || !reads.length) return { count: 0, wrote: false };
  const asOf = String(bundle.asOf || reads.find((row) => row?.asOf)?.asOf || "").slice(0, 10);
  const holdDoc = await readJson(join(root, "research/assets/public/price-hold.json"));
  const holds = new Set(Object.keys(holdDoc?.ids || {}));
  const listed = await readJson(join(root, "research/assets/public/listings-counted.json"));
  const byId = new Map();
  const byName = new Map();
  for (const row of listed?.products || []) {
    const box = row?.listingsCounted || {};
    const prev = box.prev || {};
    const item = { n: box.n, prev: prev.n, date: box.date || listed.asOf || "" };
    if (row.id) byId.set(row.id, item);
    const name = norm(row.name);
    if (name) byName.set(name, item);
  }
  const setsDoc = await readJson(join(root, "research/assets/public/sets.json"));
  const sets = Array.isArray(setsDoc?.sets) ? setsDoc.sets : [];
  const rotDoc = await readJson(join(root, "research/assets/public/rotation-status.json"));
  const rotBy = new Map((rotDoc?.sets || []).map((row) => [row.slug, row]));
  const skus = new Set(reads.map(skuOf).filter(Boolean));
  const sparks = await indexPacked(join(root, "research/assets/public/sparks"), skus, (packed) => parseSpark(packed, asOf));
  const missing = new Set([...skus].filter((id) => !sparks.has(id)));
  const hist = missing.size ? await indexPacked(join(root, "research/assets/public/hist-long"), missing, parseHist) : new Map();

  const byRead = {};
  let count = 0;
  for (const read of reads) {
    if (!read || !read.id) continue;
    const sku = skuOf(read);
    const set = setFor(read, sets);
    const rot = set ? rotBy.get(set.slug) : null;
    const spark = sparks.get(sku);
    const older = hist.get(sku);
    const points = (older && older.length > (spark?.length || 0)) ? older : (spark || older || []);
    const built = readSignals(read, {
      asOf: read.asOf || asOf,
      points,
      listings: listingsFor(read, byId, byName),
      held: sku ? holds.has(sku) : false,
      release: set?.release || "",
      art: read.art || "",
      rotationMonths: monthsUntil(rot?.status, read.asOf || asOf),
    }, rules);
    if (!built.signals.length) {
      delete read.signals;
      delete read.blurb;
      continue;
    }
    byRead[read.id] = { signals: built.signals, blurb: built.blurb };
    read.signals = built.signals;
    if (built.blurb) read.blurb = built.blurb;
    else delete read.blurb;
    count += 1;
  }
  const samples = [];
  const take = (pred) => {
    for (const read of reads) {
      const row = byRead[read.id];
      if (!row || samples.some((item) => item.id === read.id)) continue;
      if (!pred(row, read)) continue;
      samples.push({ id: read.id, name: read.name || "", signals: row.signals, blurb: row.blurb || "" });
      return;
    }
  };
  take((row) => row.signals.some((chip) => chip.kind === "move" && (chip.dir === "up" || chip.dir === "down")));
  take((row, read) => String(read.href || "").startsWith("/p/") && row.signals.some((chip) => chip.kind === "listings"));
  take((row) => row.signals.some((chip) => chip.dir === "dash"));
  const out = {
    asOf,
    source: "TCGplayer market, eBay listings counted",
    count,
    byId: byRead,
    preview: samples[0] || null,
    samples,
  };
  await writeFile(join(root, "research/assets/public/signal-chips.json"), `${JSON.stringify(out, null, 1)}\n`);
  if (writeReads) await writeFile(readsPath, `${JSON.stringify(bundle, null, 1)}\n`);
  console.log(`signal chips: ${count} reads`);
  return { count, wrote: true, asOf };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const rules = await loadRules();
  if (rules) {
    await stampSignalChips({ rules, writeReads: process.env.SIGNAL_STAMP_READS === "1" });
  }
}
