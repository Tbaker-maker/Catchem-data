// Nightly collector for the PkmnPrices read pathways.
// 1. Builds one item per product that has PkmnPrices rows: own TCGplayer market
//    days for the catalogue printing (data/history/tcgcsv-daily), eBay listings
//    counted, and the PkmnPrices rows.
// 2. Runs every pathway for asOf and writes each hit, kept or not, to the private
//    store (ppp-reads/<asOf>.json) with the pop snapshots it has seen.
// 3. Returns fact reads for the board. They go through the same board fit,
//    reads guard, thin-data drop and copy rules as every other read.
//    flags.json "ppp.reads" false turns the public reads off; the private log stays.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { pretty } from "../public-bundle.mjs";
import { flag } from "../../flags.mjs";
import { openPrivate } from "../private-store.mjs";
import { loadPppContext, attachPpp } from "./context.mjs";
import { mergePopHistory } from "./inputs.mjs";
import { runPathways } from "./pathways.mjs";
import { factRead } from "./copy.mjs";
import { isDay } from "./series.mjs";

export const PER_PATHWAY = 12;
export const TOTAL_CAP = 96;

const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

export function pppReadsOn() {
  return flag("ppp.reads") === true;
}

// Pathway, item kind and direction whose scanner gate passed (any horizon).
// With the flag off, only these fact reads are public.
export function provenKeys(gates = []) {
  const out = new Set();
  for (const g of gates || []) {
    if (!g?.passed || !String(g.pattern || "").startsWith("ppp-")) continue;
    out.add(`${String(g.pattern).slice(4)}|${g.kind}|${g.dir}`);
  }
  return out;
}

async function ownPoints(root, wanted) {
  const out = new Map();
  const dir = join(root, "data/history/tcgcsv-daily");
  let files = [];
  try { files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort(); } catch { return out; }
  for (const f of files) {
    const day = f.slice(0, 10);
    const doc = await J(join(dir, f), null);
    for (const row of doc?.prices || []) {
      const want = wanted.get(Number(row.id));
      if (!want || !(Number(row.market) > 0)) continue;
      if (want.printing && row.printing !== want.printing) continue;
      if (!out.has(want.id)) out.set(want.id, []);
      out.get(want.id).push({ date: day, price: Math.round(Number(row.market) * 100) / 100, src: "own" });
    }
  }
  return out;
}

async function listingCounts(root, ids) {
  const out = new Map();
  const dir = join(root, "data/derived/listing-counts/history");
  let names = [];
  try { names = (await readdir(dir)).filter((n) => n.endsWith(".json.gz") || n.endsWith(".json")).sort(); } catch { return out; }
  for (const name of names) {
    let doc;
    try {
      const buf = await readFile(join(dir, name));
      doc = JSON.parse((name.endsWith(".gz") ? gunzipSync(buf) : buf).toString("utf8"));
    } catch { continue; }
    for (const row of doc?.rows || []) {
      const id = String(row?.id || "");
      const date = String(row?.date || doc?.date || "");
      if (!ids.has(id) || !isDay(date) || !(row.listingsCounted >= 0)) continue;
      if (!out.has(id)) out.set(id, new Map());
      out.get(id).set(date, Number(row.listingsCounted));
    }
  }
  return out;
}

export async function buildItems(root, ctx, catalog) {
  const byId = new Map();
  for (const it of catalog?.items || []) if (it?.id && ctx.items.has(it.id) && !byId.has(it.id)) byId.set(it.id, it);
  const wanted = new Map();
  for (const [id, cat] of byId) {
    const p = ctx.items.get(id);
    const printing = p.printing || cat.printing || (cat.printings?.length === 1 ? cat.printings[0].name : "");
    wanted.set(Number(cat.tcgplayerProductId), { id, printing });
  }
  const points = await ownPoints(root, wanted);
  const lists = await listingCounts(root, new Set(byId.keys()));
  const items = [];
  for (const [id, cat] of byId) {
    const want = wanted.get(Number(cat.tcgplayerProductId));
    items.push({
      id,
      pid: Number(cat.tcgplayerProductId),
      kind: cat.kind === "sealed" ? "sealed" : "single",
      name: pretty(cat.name || ""),
      set: cat.set || "",
      printing: cat.kind === "sealed" ? "" : want.printing,
      price: Number(cat.price) || 0,
      points: (points.get(id) || []).sort((a, b) => (a.date < b.date ? -1 : 1)),
      listings: [...(lists.get(id) || new Map()).entries()].map(([date, n]) => ({ date, n })).sort((a, b) => (a.date < b.date ? -1 : 1)),
    });
  }
  attachPpp(items, ctx);
  return items;
}

function effect(h) {
  const m = h.metrics || {};
  const v = [m.gapPct, m.ratio != null && h.pathway === "sold-pace" ? (m.ratio - 1) * 100 : null, m.divergencePts, m.ratioNow != null && m.ratioThen ? ((m.ratioNow / m.ratioThen) - 1) * 100 : null,
    m.growthPct, m.shiftPts != null ? m.shiftPts * 5 : null, m.pricePct, m.changePct, m.gapMovePts, m.pctPast, m.ratio != null && h.pathway === "msrp-sold" ? (m.ratio - 1) * 100 : null]
    .filter((x) => Number.isFinite(x)).map(Math.abs);
  return v.length ? Math.max(...v) : 0;
}

export function pickFacts(hits, itemsById, asOf, L, { perPathway = PER_PATHWAY, total = TOTAL_CAP } = {}) {
  const flags = [];
  const by = new Map();
  for (const h of hits) {
    if (h.error) continue;
    const item = itemsById.get(h.itemId);
    if (!item) continue;
    const price = item.points.at(-1)?.price || item.price;
    if (!(price >= L.minPrice)) continue;
    if (!by.has(h.pathway)) by.set(h.pathway, []);
    by.get(h.pathway).push({ h, item });
  }
  const lanes = [...by.values()].map((rows) => rows.sort((a, b) => effect(b.h) - effect(a.h) || (a.item.id < b.item.id ? -1 : 1)));
  const reads = [];
  const usedItem = new Set();
  const perCount = new Map();
  // Round-robin across pathways so one pathway cannot fill the board.
  for (let i = 0; reads.length < total && lanes.some((l) => i < l.length); i += 1) {
    for (const lane of lanes) {
      if (reads.length >= total || i >= lane.length) continue;
      const { h, item } = lane[i];
      if ((perCount.get(h.pathway) || 0) >= perPathway || usedItem.has(item.id)) continue;
      const read = factRead(h, item, asOf, { flags });
      if (!read) continue;
      reads.push(read);
      usedItem.add(item.id);
      perCount.set(h.pathway, (perCount.get(h.pathway) || 0) + 1);
    }
  }
  return { reads, flags };
}

export async function collectPppReads({ root, asOf, catalog, token = process.env.PRIVATE_DATA_TOKEN || "", writePrivate = true, open = openPrivate, gates = [] } = {}) {
  const proven = provenKeys(gates);
  const allPublic = pppReadsOn();
  const ctx = await loadPppContext(root, { token });
  const day = String(asOf || catalog?.asOf || "").slice(0, 10);
  const summary = { asOf: day, inputFiles: ctx.inputFiles, inputFrom: ctx.inputFrom, inputAsOf: ctx.inputAsOf, pppItems: ctx.items.size, fxDays: ctx.fx.length, msrp: ctx.msrp.size, public: allPublic ? "all" : "proven only", proven: [...proven].sort() };
  if (!ctx.items.size || !isDay(day)) return { reads: [], hits: [], summary: { ...summary, idle: true, reason: ctx.items.size ? "no asOf" : "no PkmnPrices input file yet" } };
  const items = await buildItems(root, ctx, catalog);
  const byId = new Map(items.map((it) => [it.id, it]));
  const hits = [];
  for (const it of items) for (const h of runPathways(it, day, ctx.L, ctx)) hits.push({ ...h, itemId: it.id, kind: it.kind });
  const showable = hits.filter((h) => !h.error && (allPublic || proven.has(`${h.pathway}|${h.kind}|${h.dir}`)));
  const picked = showable.length ? pickFacts(showable, byId, day, ctx.L) : { reads: [], flags: [] };
  const byPathway = {};
  for (const h of hits) if (!h.error) byPathway[h.pathway] = (byPathway[h.pathway] || 0) + 1;
  const readsByPathway = {};
  for (const r of picked.reads) readsByPathway[r.readKind] = (readsByPathway[r.readKind] || 0) + 1;
  Object.assign(summary, { items: items.length, withOwnPrice: items.filter((i) => i.points.length).length, hits: hits.filter((h) => !h.error).length, errors: hits.filter((h) => h.error).length, byPathway, reads: picked.reads.length, readsByPathway, copyFlags: picked.flags.length });
  if (writePrivate) summary.privatePush = await writePrivateLog(root, token, day, { summary, hits, flags: picked.flags, ctx }, { open });
  return { reads: picked.reads, hits, flags: picked.flags, summary };
}

export async function writePrivateLog(root, token, day, { summary, hits, flags, ctx }, { open = openPrivate } = {}) {
  let store;
  try { store = await open({ root, token }); } catch (err) { console.error(`ppp reads: ${err.message}; using local data/private`); store = await open({ root, token: "" }); }
  const dir = join(store.dir, "ppp-reads");
  await mkdir(dir, { recursive: true });
  const pop = mergePopHistory(ctx.popHistory, ctx.items);
  await writeFile(join(dir, `${day}.json`), JSON.stringify({ asOf: day, private: true, note: "Every PkmnPrices pathway hit tonight, kept or not. Scores come from the scanner replay (scanner/weights.json, patterns ppp-*). Weight 0 until a gate passes.", summary, flags, hits }) + "\n");
  await writeFile(join(dir, "pop-history.json"), JSON.stringify(pop) + "\n");
  const rel = [`ppp-reads/${day}.json`, "ppp-reads/pop-history.json"];
  const pushed = await store.close(rel, `ppp reads ${day}`);
  return { pushed: Boolean(pushed?.pushed), reason: pushed?.reason || null, remote: store.remote === true };
}
