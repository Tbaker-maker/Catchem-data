// Pull the live Pokémon catalog from TCGCSV and append one daily price file.
// Does not rewrite earlier days. Does not invent a price. continue-on-error in CI.
import { mkdir, writeFile } from "node:fs/promises";
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

export async function fetchCatalog(today = TODAY) {
  const groups = (await getJson(GROUPS)).results || [];
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
  await writeFile(join(catalogDir, "tcgcsv-latest.json"), JSON.stringify(snap.latest));
  await writeFile(join(catalogDir, "tcgcsv-coverage.json"), JSON.stringify(snap.coverage, null, 2));
  await writeFile(dayPath, JSON.stringify(snap.daily));
  console.log(`tcgcsv groups ${groups.length - failedGroups.length}/${groups.length} items ${snap.latest.counts.items} priced ${snap.latest.counts.priced} sealed ${snap.latest.counts.sealed} slabs ${snap.latest.counts.slab}`);
  return snap;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchCatalog().catch((err) => {
    console.error(`tcgcsv catalog failed: ${err.message}`);
    process.exitCode = 1;
  });
}
