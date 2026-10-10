// Pull the live Pokémon catalog from TCGCSV and append one daily price file.
// Does not rewrite earlier days. Does not invent a price. continue-on-error in CI.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildGroup, mergeSnapshot } from "./lib/tcgcsv-catalog.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = new Date().toISOString().slice(0, 10);
const GROUPS = "https://tcgcsv.com/tcgplayer/3/groups";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "CatchEm/1.0 (catchemtcg.com)" },
      signal: AbortSignal.timeout(25000),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(600 * (attempt + 1));
      return getJson(url, attempt + 1);
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt < 2) {
      await sleep(600 * (attempt + 1));
      return getJson(url, attempt + 1);
    }
    throw err;
  }
}

async function pool(items, limit, fn) {
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// Keep every raw TCGCSV response we fetch, in full, forever: one folder per
// day, gzip ndjson, every field as served (low/mid/high/market/directLow,
// subTypeName, extendedData...). Lives under tcgcsv-daily/raw/ so the nightly
// commit step already keeps it; readers only take top-level *.json files.
export function rawLines(rows, extra = {}) {
  return rows.map((row) => JSON.stringify({ ...extra, ...row })).join("\n") + (rows.length ? "\n" : "");
}

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

// Product metadata barely changes day to day (~3.4 MB gz). Store a group's
// products only when they differ from the last stored copy; the manifest maps
// every group to the day holding its current copy, so any day rebuilds fully.
async function lastProductMap(rawRoot, today) {
  let days = [];
  try { days = (await readdir(rawRoot)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < today).sort(); } catch {}
  for (const day of days.reverse()) {
    try {
      const m = JSON.parse(await readFile(join(rawRoot, day, "manifest.json"), "utf8"));
      if (m.productGroups) return m.productGroups;
    } catch {}
  }
  return {};
}

export async function writeRawDay(root, today, raw) {
  const rawRoot = join(root, "data/history/tcgcsv-daily/raw");
  const dir = join(rawRoot, today);
  await mkdir(dir, { recursive: true });
  const parts = raw.parts.slice().sort((a, b) => a.groupId - b.groupId);
  const prev = await lastProductMap(rawRoot, today);
  const productGroups = {};
  let productText = "";
  for (const p of parts) {
    const text = rawLines(p.products, { _groupId: p.groupId });
    const h = sha(text);
    if (prev[p.groupId]?.sha === h) {
      productGroups[p.groupId] = prev[p.groupId];
    } else {
      productGroups[p.groupId] = { sha: h, day: today, count: p.products.length };
      productText += text;
    }
  }
  // A failed group keeps pointing at its last stored copy.
  for (const [gid, v] of Object.entries(prev)) if (!productGroups[gid]) productGroups[gid] = v;
  const files = {
    "groups.ndjson.gz": rawLines(raw.groups),
    "products.ndjson.gz": productText,
    "prices.ndjson.gz": parts.map((p) => rawLines(p.prices, { _groupId: p.groupId })).join(""),
  };
  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(dir, name), gzipSync(text, { level: 9 }));
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    date: today,
    source: "https://tcgcsv.com/tcgplayer/3 (TCGplayer data via TCGCSV)",
    note: "Raw responses as fetched, unmodified except _groupId. Kept permanently. products.ndjson.gz holds only groups that changed; productGroups says which day holds each group.",
    groups: raw.groups.length,
    products: parts.reduce((n, p) => n + p.products.length, 0),
    productGroupsStoredToday: Object.values(productGroups).filter((v) => v.day === today).length,
    priceRows: parts.reduce((n, p) => n + p.prices.length, 0),
    failedGroups: raw.failedGroups,
    productGroups,
  }));
}

export async function fetchCatalog(today = TODAY) {
  const groups = (await getJson(GROUPS)).results || [];
  const rawParts = [];
  const parts = [];
  const failedGroups = [];
  let done = 0;
  await pool(groups, 6, async (group) => {
    const id = group.groupId;
    try {
      const [products, prices] = await Promise.all([
        getJson(`https://tcgcsv.com/tcgplayer/3/${id}/products`),
        getJson(`https://tcgcsv.com/tcgplayer/3/${id}/prices`),
      ]);
      rawParts.push({ groupId: id, products: products.results || [], prices: prices.results || [] });
      parts.push(buildGroup({
        groupId: id,
        groupName: group.name,
        products: products.results || [],
        priceRows: prices.results || [],
        asOf: today,
      }));
    } catch (err) {
      failedGroups.push({ groupId: id, name: group.name, error: String(err.message || err).slice(0, 180) });
    }
    done++;
    if (done % 25 === 0) console.log(`  tcgcsv ${done}/${groups.length}`);
    await sleep(30);
  });
  failedGroups.sort((a, b) => a.groupId - b.groupId);
  const snap = mergeSnapshot(parts, { asOf: today, failedGroups });
  const catalogDir = join(ROOT, "data/catalog");
  const dayPath = join(ROOT, "data/history/tcgcsv-daily", `${today}.json`);
  await mkdir(catalogDir, { recursive: true });
  await mkdir(dirname(dayPath), { recursive: true });
  // Write the day before the other catalog files. A later write in this
  // process must not be able to drop the day that already landed.
  await writeFile(dayPath, JSON.stringify(snap.daily));
  try {
    await writeRawDay(ROOT, today, { groups, parts: rawParts, failedGroups });
  } catch (err) {
    console.error(`tcgcsv raw archive ${today} failed: ${err.message}`);
  }
  try {
    await writeFile(join(catalogDir, "tcgcsv-latest.json"), JSON.stringify(snap.latest));
    await writeFile(join(catalogDir, "tcgcsv-coverage.json"), JSON.stringify(snap.coverage, null, 2));
  } catch (err) {
    console.error(`tcgcsv day ${today} is on disk; a later catalog write failed: ${err.message}`);
    throw err;
  }
  console.log(`tcgcsv groups ${groups.length - failedGroups.length}/${groups.length} items ${snap.latest.counts.items} priced ${snap.latest.counts.priced} sealed ${snap.latest.counts.sealed} slabs ${snap.latest.counts.slab}`);
  return snap;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchCatalog().catch((err) => {
    console.error(`tcgcsv catalog failed: ${err.message}`);
    process.exitCode = 1;
  });
}
