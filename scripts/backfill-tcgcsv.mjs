// Pull TCGplayer market prices from TCGCSV for products we can match.
// Runs daily in CI against the LIVE endpoint (tcgcsv.com/tcgplayer/3/...), so
// history accumulates one real day at a time from 2026-09-25.
// Historical archive files are used when TCGCSV publishes them. If the
// archive is offline, those days are a gap. Today's live price is appended
// only when the catalog name passes the match checks.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rejectReason, rowAcceptable } from "./lib/tcgcsv-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/history/tcgplayer-market");
const SOURCE = "TCGplayer market via TCGCSV";
const TODAY = new Date().toISOString().slice(0, 10);
const YEAR_AGO = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

const J = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "CatchEm/1.0 (catchemtcg.com)" },
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return JSON.parse(text);
}

function pickPrice(rows) {
  const withMarket = rows.filter((r) => r.marketPrice != null);
  if (!withMarket.length) return { gap: "no market price on this day" };
  const normal = withMarket.filter((r) => r.subTypeName === "Normal");
  const row = normal.length === 1 ? normal[0] : (withMarket.length === 1 ? withMarket[0] : null);
  if (!row) return { gap: "more than one printing, so no single price was chosen" };
  return { market: row.marketPrice, low: row.lowPrice ?? null, subTypeName: row.subTypeName };
}

async function archiveStatus() {
  const url = `https://tcgcsv.com/archive/tcgplayer/prices-${TODAY}.ppmd.7z`;
  try {
    const res = await fetch("https://tcgcsv.com/archive/tcgplayer/prices-2026-09-18.ppmd.7z", {
      headers: { "user-agent": "CatchEm/1.0 (catchemtcg.com)" },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    if (/temporarily removed/i.test(text)) {
      return { available: false, url, note: text.replace(/\s+/g, " ").slice(0, 280) };
    }
    if (res.ok && !text.startsWith("{") && text.length > 1000) return { available: true, url };
    return { available: false, url, note: `archive responded ${res.status}` };
  } catch (err) {
    return { available: false, url, note: String(err.message || err) };
  }
}

async function catalog() {
  const groups = (await getJson("https://tcgcsv.com/tcgplayer/3/groups")).results || [];
  const byId = new Map();
  let n = 0;
  const queue = [...groups];
  async function worker() {
    while (queue.length) {
      const g = queue.shift();
      try {
        const body = await getJson(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`);
        for (const p of body.results || []) byId.set(p.productId, { name: p.name, groupId: g.groupId, group: g.name });
        n++;
        if (n % 40 === 0) console.log(`  catalog ${n}/${groups.length}`);
      } catch (err) {
        console.error("  group failed", g.groupId, err.message);
      }
      await sleep(80);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return byId;
}

const products = await J("data/sealed-products.json");
const map = await J("data/crosscheck-id-map.json");
const byOur = new Map((map.entries || []).map((e) => [e.id, e]));
let trending = { plays: [] };
try {
  trending = await getJson("https://tbaker-maker.github.io/Catchem-data/trending.json");
} catch (err) {
  console.error("trending.json unavailable", err.message);
}

const candidates = [];
const unmatched = [];
for (const p of products) {
  const row = byOur.get(p.id);
  if (!row) { unmatched.push({ id: p.id, name: p.name, reason: "no TCGplayer id on file" }); continue; }
  const why = rowAcceptable(row);
  if (why) { unmatched.push({ id: p.id, name: p.name, reason: why, matchedName: row.matchedName || null }); continue; }
  const nameWhy = rejectReason(p, row.matchedName);
  if (nameWhy) { unmatched.push({ id: p.id, name: p.name, reason: nameWhy, tcgplayerProductId: Number(row.tcgPlayerId), matchedName: row.matchedName }); continue; }
  candidates.push({ id: p.id, name: p.name, subtype: p.subtype, tcgplayerProductId: Number(row.tcgPlayerId), matchedName: row.matchedName, kind: "sealed" });
}
for (const play of trending.plays || []) {
  if (play.tcgplayerProductId == null) {
    unmatched.push({ id: play.sku, name: play.name, reason: "chase single has no TCGplayer product id" });
    continue;
  }
  candidates.push({
    id: play.sku,
    name: play.name,
    subtype: "single",
    tcgplayerProductId: Number(play.tcgplayerProductId),
    matchedName: play.name,
    kind: "single",
  });
}

console.log(`candidates ${candidates.length}, unmatched so far ${unmatched.length}`);
console.log("walking the Pokémon catalog");
const cat = await catalog();

const accepted = [];
for (const c of candidates) {
  const found = cat.get(c.tcgplayerProductId);
  if (!found) {
    unmatched.push({ id: c.id, name: c.name, reason: "product id was not in the current Pokémon catalog", tcgplayerProductId: c.tcgplayerProductId });
    continue;
  }
  const why = rejectReason({ ...c, name: c.kind === "single" ? found.name : c.name, subtype: c.kind === "single" ? "single" : c.subtype }, found.name);
  if (c.kind !== "single" && why) {
    unmatched.push({ id: c.id, name: c.name, reason: why, tcgplayerProductId: c.tcgplayerProductId, catalogName: found.name });
    continue;
  }
  if (c.kind === "single") {
    const ours = c.name.toLowerCase();
    const catName = found.name.toLowerCase();
    const token = ours.split(/\s+/).find((w) => w.length > 4);
    if (token && !catName.includes(token.toLowerCase())) {
      unmatched.push({ id: c.id, name: c.name, reason: "catalog name does not match the chase single", tcgplayerProductId: c.tcgplayerProductId, catalogName: found.name });
      continue;
    }
  }
  accepted.push({ ...c, catalogName: found.name, groupId: found.groupId });
}

const archive = await archiveStatus();
const gap = archive.available ? null : {
  from: YEAR_AGO,
  to: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  reason: "The TCGCSV price archive is not public right now, so the prior 12 months were not filled in. No prices were invented.",
};

const byGroup = new Map();
for (const a of accepted) {
  if (!byGroup.has(a.groupId)) byGroup.set(a.groupId, []);
  byGroup.get(a.groupId).push(a);
}
const todayPrice = new Map();
for (const [groupId, rows] of byGroup) {
  try {
    const body = await getJson(`https://tcgcsv.com/tcgplayer/3/${groupId}/prices`);
    const grouped = new Map();
    for (const r of body.results || []) {
      if (!grouped.has(r.productId)) grouped.set(r.productId, []);
      grouped.get(r.productId).push(r);
    }
    for (const a of rows) todayPrice.set(a.id, pickPrice(grouped.get(a.tcgplayerProductId) || []));
  } catch (err) {
    for (const a of rows) todayPrice.set(a.id, { gap: err.message });
  }
  await sleep(80);
}

await mkdir(OUT, { recursive: true });
const files = [];
for (const a of accepted) {
  const got = todayPrice.get(a.id) || { gap: "no price file" };
  // Append, never replace: keep every day already on file and add today only
  // if it is not there yet. A day that fails is recorded as a gap, not filled.
  let prev = null;
  try { prev = JSON.parse(await readFile(join(OUT, `${a.id}.json`), "utf8")); } catch {}
  const points = Array.isArray(prev?.points) ? [...prev.points] : [];
  const gaps = Array.isArray(prev?.gaps) ? [...prev.gaps] : [];
  if (gap && !gaps.some((g) => g.from && g.to)) gaps.push(gap);
  const haveToday = points.some((p) => p.date === TODAY);
  if (!haveToday && got.market != null) {
    points.push({ date: TODAY, market: got.market, low: got.low, source: SOURCE });
  } else if (!haveToday && !gaps.some((g) => g.date === TODAY)) {
    gaps.push({ date: TODAY, reason: got.gap || "no price" });
  }
  points.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  const doc = {
    id: a.id,
    name: a.name,
    tcgplayerProductId: a.tcgplayerProductId,
    tcgplayerName: a.catalogName,
    source: SOURCE,
    points,
    gaps,
  };
  await writeFile(join(OUT, `${a.id}.json`), JSON.stringify(doc, null, 2));
  files.push({ id: a.id, days: points.length, gaps: gaps.length, market: points[points.length - 1]?.market ?? null });
}

const coverage = {
  asOf: TODAY,
  source: SOURCE,
  archive,
  window: { from: YEAR_AGO, to: TODAY },
  matched: accepted.length,
  unmatched: unmatched.length,
  daysPerProduct: files.map((f) => ({ id: f.id, days: f.days, latestMarket: f.market })),
  note: "Weekly archive sampling is what this script will do once the archive is public again. Until then every past day is a gap.",
};
await writeFile(join(OUT, "mapping.json"), JSON.stringify({
  asOf: TODAY,
  source: "crosscheck-id-map high-confidence rows, checked against the live TCGCSV catalog",
  entries: accepted.map((a) => ({ id: a.id, tcgplayerProductId: a.tcgplayerProductId, tcgplayerName: a.catalogName, ourName: a.name })),
}, null, 2));
await writeFile(join(OUT, "unmatched.json"), JSON.stringify({ asOf: TODAY, products: unmatched }, null, 2));
await writeFile(join(OUT, "coverage.json"), JSON.stringify(coverage, null, 2));
console.log(`wrote ${files.length} product files, ${unmatched.length} unmatched`);
