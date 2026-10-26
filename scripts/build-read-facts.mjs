// Per-read facts for the read pages: research/assets/public/feed/facts/<id>.json.
// Inputs are our own published files only. Each figure carries its date.
// Never fails the nightly: a missing input leaves that field out.
import { readFile, readdir, writeFile, mkdir, rm } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBreakdown } from "./lib/what-we-see.mjs";
import { unpackLong, mergeHistory, changeOver, highLow, band, indexChange, listingsFact, matchPattern, itemKeys, similar, gapFact } from "./lib/read-facts.mjs";
import { priceRange } from "./lib/signal-chips.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");
const OUT = join(PUB, "feed/facts");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

export function factFileName(id) {
  return String(id).replace(/[^A-Za-z0-9._-]/g, "_") + ".json";
}

export async function buildReadFacts(root = ROOT, opts = {}) {
  const pub = join(root, "research/assets/public");
  const readsDoc = await J(join(pub, "reads.json"), { reads: [] });
  const asOf = String(readsDoc.asOf || "").slice(0, 10);
  const rows = new Map();
  for (const f of (await readdir(join(pub, "buckets")).catch(() => [])).filter((n) => n.endsWith(".json"))) {
    for (const r of (await J(join(pub, "buckets", f), [])) || []) if (r?.id) rows.set(r.id, r);
  }
  const longText = new Map();
  for (const f of (await readdir(join(pub, "hist-long")).catch(() => [])).filter((n) => n.endsWith(".json"))) {
    const doc = await J(join(pub, "hist-long", f), { rows: {} });
    for (const [id, packed] of Object.entries(doc?.rows || {})) longText.set(id, packed);
  }
  const histCache = new Map();
  const histOf = (id) => {
    if (histCache.has(id)) return histCache.get(id);
    const row = rows.get(id);
    const h = mergeHistory(unpackLong(longText.get(id)), row?.hist || []);
    histCache.set(id, h);
    return h;
  };

  const sets = await J(join(pub, "sets.json"), { sets: [] });
  const setBySlug = new Map((sets.sets || []).map((s) => [s.slug, s]));
  // "SV10: Destined Rivals" and "Destined Rivals" are the same set.
  const bare = (n) => String(n || "").toLowerCase().replace(/^[^:]{1,12}:\s*/, "").trim();
  const byBare = new Map();
  for (const s of sets.sets || []) { byBare.set(bare(s.name), s.slug); byBare.set(String(s.name || "").toLowerCase(), s.slug); }
  const slugByName = (n) => (n ? byBare.get(String(n).toLowerCase()) || byBare.get(bare(n)) || "" : "");
  const rot = await J(join(pub, "rotation-status.json"), { sets: [] });
  const rotBySlug = new Map((rot.sets || []).map((s) => [s.slug, s]));
  const sealedDoc = await J(join(root, "data/sealed-prices.json"), { products: [] });
  const sealedById = new Map((sealedDoc.products || []).map((p) => [p.id, p]));
  const asks = await J(join(root, "data/derived/singles-asks.json"), { rows: [] });
  const askById = new Map((asks.rows || []).map((r) => [r.id, r]));
  const rip = await J(join(root, "data/derived/rip-roi.json"), { rows: [] });
  const ripById = new Map((rip.rows || []).map((r) => [r.id, r]));
  const yp = await J(join(root, "data/derived/year-patterns.json"), { patterns: [] });
  const lc = await J(join(pub, "listings-counted.json"), { products: [] });
  const lcBySku = new Map((lc.products || []).map((p) => [p.id, p.listingsCounted]));

  // Listings counted by item, by day.
  const listed = new Map();
  const histDir = join(root, "data/derived/listing-counts/history");
  for (const name of (await readdir(histDir).catch(() => [])).filter((n) => n.endsWith(".json.gz")).sort()) {
    let doc;
    try { doc = JSON.parse(gunzipSync(await readFile(join(histDir, name))).toString()); } catch { continue; }
    const date = String(doc.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (const r of doc.rows || []) {
      if (!r?.id || !Number.isInteger(r.listingsCounted)) continue;
      if (!listed.has(r.id)) listed.set(r.id, {});
      listed.get(r.id)[date] = r.listingsCounted;
    }
  }

  // Bands: 30-day change per item, grouped once.
  const bySetRarity = new Map(), byArtist = new Map(), bySetKind = new Map();
  const changeCache = new Map();
  const change30 = (id) => {
    if (!changeCache.has(id)) changeCache.set(id, changeOver(histOf(id), 30, asOf));
    return changeCache.get(id);
  };
  const push = (m, k, v) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const r of rows.values()) {
    push(bySetKind, `${r.setSlug}|${r.kind}`, r);
    if (r.kind === "single" && r.price > 0) {
      if (r.rarity) push(bySetRarity, `${r.setSlug}|${r.rarity}`, r.id);
      if (r.artist) push(byArtist, r.artist, r.id);
    }
  }
  const bandMemo = new Map();
  const bandOf = (key, ids) => {
    if (!bandMemo.has(key)) bandMemo.set(key, band(ids.map(change30)));
    return bandMemo.get(key);
  };
  const setDocs = new Map();
  const setDoc = async (slug) => {
    if (!slug) return null;
    if (!setDocs.has(slug)) setDocs.set(slug, await J(join(pub, "sets", `${slug}.json`)));
    return setDocs.get(slug);
  };

  const resolve = (read) => {
    const direct = [read.sku, read.cardId, read.id].map((s) => String(s || "").match(/(?:^|-)(tcgcsv-\d+)(?:-|$)/)).find(Boolean);
    if (direct) return { id: direct[1], sealed: null };
    const sp = sealedById.get(String(read.sku || ""));
    if (sp?.tcgPlayerId) return { id: `tcgcsv-${sp.tcgPlayerId}`, sealed: sp };
    return null;
  };

  const factsFor = async (f, row, sealed, slug, lite = false) => {
    if (row) {
      f.item = { id: row.id, kind: row.kind, name: row.name, number: row.num || "", set: row.set || "", setSlug: slug, rarity: row.rarity || "", artist: row.artist || "", price: row.price, priceAsOf: row.asOf || asOf };
      const hist = histOf(row.id);
      const ch = {};
      for (const [k, n] of [["d7", 7], ["d30", 30], ["d90", 90], ["y1", 365]]) { const c = changeOver(hist, n, asOf); if (c) ch[k] = c; }
      if (Object.keys(ch).length) f.change = ch;
      const hl = highLow(hist, asOf);
      if (hl) {
        const shared = priceRange(hist, asOf, { minDays: 1, slackDays: 0 });
        if (shared && Math.round(shared.high * 100) === Math.round(hl.high.price * 100)) hl.window = { days: shared.days, high: shared.high, highOn: shared.highOn, place: shared.place };
        f.range = hl;
      }
      if (row.kind === "single" && row.rank > 0 && row.of > 1) f.rank = { rank: row.rank, of: row.of, set: row.set, asOf: row.asOf || asOf };
      const prints = (row.printings || []).filter((p) => p && p.name && p.price > 0);
      if (prints.length >= 2) f.variants = prints.map((p) => ({ name: p.name, price: p.price, asOf: p.asOf || row.asOf }));
      // Listings counted: nightly history by item, then the sealed file, then the singles ask file.
      const days = { ...(listed.get(row.id) || {}) };
      const sc = sealed ? lcBySku.get(sealed.id) : null;
      if (sc && Number.isInteger(sc.n) && sc.date) { days[sc.date] = sc.n; if (sc.prev && Number.isInteger(sc.prev.n) && sc.prev.date) days[sc.prev.date] ??= sc.prev.n; }
      const ask0 = row.kind === "single" ? askById.get(row.id) : null;
      if (ask0 && Number.isInteger(ask0.listings) && ask0.date) days[ask0.date] ??= ask0.listings;
      const lf = listingsFact(days, asOf);
      if (lf) f.listings = lf;
      if (row.kind === "single") {
        const ask = askById.get(row.id);
        const g = ask && gapFact({ tcg: row.price, tcgDate: row.asOf, ebay: ask.ebay, ebayDate: ask.date, listings: ask.listings });
        if (g) f.gap = { ...g, condition: ask.condition || "Ungraded" };
      } else if (sealed) {
        const last = (sealed.priceHistory || []).filter((p) => p?.price > 0).at(-1);
        const g = last && gapFact({ tcg: row.price, tcgDate: row.asOf, ebay: last.price, ebayDate: last.date, listings: sealed.listingCount });
        if (g) f.gap = { ...g, condition: "Sealed" };
      }
      if (!lite && row.kind === "single" && row.rarity) {
        const b = bandOf(`r|${slug}|${row.rarity}`, bySetRarity.get(`${slug}|${row.rarity}`) || []);
        if (b) f.rarityBand = { ...b, set: row.set, rarity: row.rarity };
      }
      if (!lite && row.kind === "single" && row.artist) {
        const b = bandOf(`a|${row.artist}`, byArtist.get(row.artist) || []);
        if (b) f.artistBand = { ...b, artist: row.artist };
      }
      const r = ripById.get(row.id);
      if (r && r.contentsEV > 0 && r.price > 0) f.rip = { price: r.price, contentsEV: r.contentsEV, roiPct: r.roiPct, beatChance: r.beatChance, median: r.median, asOf: rip.asOf };
      const sims = lite ? [] : similar(row, bySetKind.get(`${row.setSlug}|${row.kind}`) || []);
      if (sims.length) f.similar = sims.map((s) => ({ ...s, asOf: row.asOf || asOf }));
    }
    const set = setBySlug.get(slug);
    const rotRow = rotBySlug.get(slug);
    if (rotRow && (rotRow.mark || rotRow.status)) f.rotation = { mark: rotRow.mark || "", status: rotRow.status || "", asOf: String(rot.asOf || "").slice(0, 10) };
    const sd = await setDoc(slug);
    if (sd) {
      const kind = row?.kind === "sealed" ? "sealedIndex" : "singleIndex";
      const m = indexChange(sd[kind], 30);
      if (m) f.setMomentum = { ...m, set: sd.name, kind: row?.kind === "sealed" ? "sealed" : "singles" };
    }
    const keys = itemKeys({ release: set?.release, rotation: rotRow, subtype: row?.subtype, asOf });
    const pat = matchPattern(yp.patterns, keys);
    if (pat) f.pattern = { ...pat, asOf: String(yp.asOf || "").slice(0, 10) };
    return f;
  };
  const out = {};
  for (const read of readsDoc.reads || []) {
    if (!read?.id) continue;
    const hit = resolve(read);
    const row = hit ? rows.get(hit.id) : null;
    const f = { id: read.id, asOf, source: "Our published files: buckets, hist-long, sets, rotation-status, listing-counts, singles-asks, sealed-prices, rip-roi, year-patterns" };
    const slug = row?.setSlug || slugByName(hit?.sealed?.set) || (setBySlug.has(read.receipt?.slug) ? read.receipt.slug : "") || slugByName(read.set) || slugByName(read.receipt?.set) || "";
    await factsFor(f, row, hit?.sealed || null, slug);
    const br = buildBreakdown(f);
    if (br.line) {
      f.line = br.line;
      f.breakdown = { lead: br.lead, order: br.order, sections: br.sections };
    }
    if (Object.keys(f).length > 3) out[read.id] = f;
  }
  if (!opts.items) return { asOf, facts: out };
  // Item reads: every bucket row, grouped by set so a page fetches one file.
  const sealedByPid = new Map();
  for (const p of sealedDoc.products || []) if (p?.tcgPlayerId) sealedByPid.set(`tcgcsv-${p.tcgPlayerId}`, p);
  const items = new Map();
  for (const row of rows.values()) {
    if (!(row.price > 0)) continue;
    const slug = row.setSlug || "unsorted";
    const f = await factsFor({}, row, sealedByPid.get(row.id) || null, row.setSlug || "", true);
    delete f.item.setSlug;
    const br = buildBreakdown(f);
    if (br.line) {
      f.line = br.line;
      f.breakdown = { lead: br.lead, order: br.order, sections: br.sections };
    }
    if (!items.has(slug)) items.set(slug, {});
    items.get(slug)[row.id] = f;
  }
  return { asOf, facts: out, items };
}

export async function writeReadFacts(root = ROOT) {
  const t0 = Date.now();
  const out = join(root, "research/assets/public/feed/facts");
  const { asOf, facts, items } = await buildReadFacts(root, { items: true });
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const [id, f] of Object.entries(facts)) await writeFile(join(out, factFileName(id)), JSON.stringify(f) + "\n");
  const itemDir = join(root, "research/assets/public/feed/items");
  await rm(itemDir, { recursive: true, force: true });
  await mkdir(itemDir, { recursive: true });
  let itemCount = 0, bytes = 0;
  for (const [slug, map] of items) {
    // One item per line, so a page can slice its row out of the text without parsing the shard.
    const lines = Object.entries(map).map(([id, f]) => `${JSON.stringify(id)}:${JSON.stringify(f)}`);
    const body = `{"asOf":${JSON.stringify(asOf)},"set":${JSON.stringify(slug)},"source":"Our published files. TCGplayer market (NM for singles) and eBay listings counted, dated per field.","items":{\n${lines.join(",\n")}\n}}\n`;
    bytes += body.length; itemCount += Object.keys(map).length;
    await writeFile(join(itemDir, factFileName(slug)), body);
  }
  return { asOf, files: Object.keys(facts).length, items: itemCount, shards: items.size, itemBytes: bytes, ms: Date.now() - t0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { console.log(JSON.stringify({ readFacts: await writeReadFacts(ROOT) })); }
  catch (err) { console.error(`read facts skipped: ${err.message}`); }
}
