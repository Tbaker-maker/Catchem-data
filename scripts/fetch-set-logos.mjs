// scripts/fetch-set-logos.mjs — regenerate data/set-logos.json.
//
// Set logos and symbols exactly as the pokemontcg.io /v2/sets API publishes
// them, keyed by set id. build-public-bundle.mjs reads logos from this file and
// shows no logo for a set that has no entry. It never builds an image URL from
// a set id, because hosts differ per set and a guessed path that 404s comes
// back as a placeholder (card-guard blocks that pattern).
//
// Manual only: run `node scripts/fetch-set-logos.mjs` when new sets release.
// No workflow runs it. Unauthenticated paging works; POKEMONTCG_API_KEY is sent
// when present. If every attempt fails, the existing file is left as it is.
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/set-logos.json");
const BASE = "https://api.pokemontcg.io/v2/sets";
const PAGE_SIZE = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPage(page) {
  const url = `${BASE}?page=${page}&pageSize=${PAGE_SIZE}&orderBy=releaseDate`;
  const headers = { Accept: "application/json", "User-Agent": "catchem-data/set-logos" };
  if (process.env.POKEMONTCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  let last = "";
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
      if (res.ok) return await res.json();
      last = `http ${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await sleep(Math.min(30000, 2000 * attempt));
  }
  throw new Error(`page ${page} failed after retries: ${last}`);
}

const sets = {};
let total = Infinity;
for (let page = 1; (page - 1) * PAGE_SIZE < total; page++) {
  const doc = await getPage(page);
  total = Number(doc.totalCount) || 0;
  for (const s of doc.data || []) {
    if (!s?.id) continue;
    const logo = typeof s.images?.logo === "string" && /^https:\/\//.test(s.images.logo) ? s.images.logo : null;
    const symbol = typeof s.images?.symbol === "string" && /^https:\/\//.test(s.images.symbol) ? s.images.symbol : null;
    if (!logo && !symbol) continue;
    sets[s.id] = { name: s.name ?? null, series: s.series ?? null, releaseDate: s.releaseDate ?? null, logo, symbol };
  }
  if (!(doc.data || []).length) break;
}

const count = Object.keys(sets).length;
if (!count || count < total * 0.9) {
  console.error(`set logos: only ${count} of ${total} sets returned — not writing a partial file`);
  process.exit(1);
}
const out = {
  source: "pokemontcg.io /v2/sets (images.logo, images.symbol as returned)",
  sourceUrl: `${BASE}?pageSize=${PAGE_SIZE}&orderBy=releaseDate`,
  fetchedAt: new Date().toISOString(),
  totalCount: total,
  count,
  sets: Object.fromEntries(Object.entries(sets).sort((a, b) => a[0].localeCompare(b[0]))),
};
await writeFile(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(`set logos: wrote ${count} of ${total} sets to data/set-logos.json`);
