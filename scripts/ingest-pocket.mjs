// ingest-pocket.mjs — Pokémon TCG Pocket catalogue. Separate game, separate file.
//
// Paper stays in data/card-catalogue.json (pokemontcg.io). Pocket is not paper.
// Mixing them would make INDEX.length a lie and Find return the wrong game.
//
// Source of record for CARD DATA: TCGdex API, series `tcgp`, MIT.
//   GET https://api.tcgdex.net/v2/en/series/tcgp
//   GET https://api.tcgdex.net/v2/en/sets/{id}
//   GET https://api.tcgdex.net/v2/en/cards/{id}
// Images: https://assets.tcgdex.net/en/tcgp/{set}/{num}/high.webp (CORS *).
// We hotlink. We do not rehost Nintendo art.
//
// TCGdex lags the live app. Limitless Pocket (/cards) is the freshness check —
// set names, dates, counts only. If Limitless has a set we do not, this file
// says so. We do not scrape Limitless card images (their S3, their ToS).
//
// IDs are prefixed tcgp- so they never collide with paper (sv10-229 etc).
// No prices. Pocket has no eBay sealed run and we will not invent one.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.tcgdex.net/v2/en";
const FETCH_TIMEOUT_MS = 30000;
const CONCURRENCY = 6;

const get = async (url) => {
  const r = await fetch(url, {
    headers: { "User-Agent": "CatchEm-pocket-ingest/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
};

const pool = async (items, n, fn) => {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  });
  await Promise.all(workers);
  return out;
};

const series = await get(API + "/series/tcgp");
const setList = series.sets || [];
console.log("tcgdex series tcgp: " + setList.length + " sets");

const store = {
  note: "Pokémon TCG Pocket metadata from TCGdex (MIT). NOT paper TCG. NOT prices. IDs prefixed tcgp-.",
  game: "tcgp",
  source: "https://api.tcgdex.net/v2/en/series/tcgp",
  imagePattern: "https://assets.tcgdex.net/en/tcgp/{set}/{num}/high.webp",
  ingestedAt: null,
  sets: {},
  cards: {},
  lag: null,
};

let failures = [];
for (const s of setList) {
  const set = await get(API + "/sets/" + s.id);
  const brief = set.cards || [];
  const details = await pool(brief, CONCURRENCY, async (c) => {
    try {
      return await get(API + "/cards/" + c.id);
    } catch (e) {
      failures.push({ id: c.id, err: e.message });
      return null;
    }
  });
  let n = 0;
  for (const c of details) {
    if (!c) continue;
    const id = "tcgp-" + c.id;
    const attacks = Array.isArray(c.attacks) ? c.attacks.map(a => a && a.name).filter(Boolean) : undefined;
    store.cards[id] = {
      name: c.name,
      artist: c.illustrator || null,
      setId: (c.set && c.set.id) || s.id,
      setName: (c.set && c.set.name) || s.name,
      number: c.localId,
      rarity: c.rarity || null,
      releaseDate: set.releaseDate || series.releaseDate || null,
      supertype: c.category || null,
      hp: c.hp ?? null,
      types: c.types || undefined,
      stage: c.stage || undefined,
      attackNames: attacks && attacks.length ? attacks : undefined,
      image: c.image ? c.image + "/high.webp" : null,
      game: "tcgp",
    };
    n++;
  }
  store.sets[s.id] = {
    name: set.name || s.name,
    releaseDate: set.releaseDate || null,
    tcgdex: (set.cardCount && set.cardCount.total) || brief.length,
    ingested: n,
    complete: n === brief.length,
  };
  console.log("  " + s.id + "  " + n + "/" + brief.length + "  " + (set.name || s.name));
}

store.ingestedAt = new Date().toISOString();

// Freshness check — Limitless set index only.
let limitless = [];
try {
  const html = await (await fetch("https://pocket.limitlesstcg.com/cards", {
    headers: { "User-Agent": "CatchEm-pocket-ingest/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })).text();
  const re = /href="\/cards\/([A-Za-z0-9-]+)"[^>]*>[\s\S]*?<\/span>\s*([^<]+?)\s+\1\s+(\d{1,2} \w{3} \d{2})?\s+(\d+)/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(html))) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    limitless.push({ id: m[1], name: m[2].trim(), date: (m[3] || "").trim(), count: Number(m[4]) });
  }
  if (!limitless.length) {
    const codes = [...html.matchAll(/href="\/cards\/([A-Za-z0-9-]+)"/g)].map(x => x[1]);
    for (const id of codes) if (!seen.has(id) && id !== "cards") {
      seen.add(id);
      limitless.push({ id, name: null, date: null, count: null });
    }
  }
} catch (e) {
  store.lag = { error: "limitless index failed: " + e.message };
}

const ours = new Set(Object.keys(store.sets));
const missing = limitless.filter(s => !ours.has(s.id));
store.lag = {
  tcgdexSets: Object.keys(store.sets).length,
  tcgdexCards: Object.keys(store.cards).length,
  limitlessSets: limitless.length,
  limitlessHasWeDoNot: missing,
  note: missing.length
    ? "TCGdex is behind Limitless. Those sets are not in this file. Do not claim Pocket is complete."
    : "TCGdex set ids match the Limitless index we could parse.",
};

const withArtist = Object.values(store.cards).filter(c => c.artist).length;
await writeFile(join(ROOT, "data/pocket-catalogue.json"), JSON.stringify(store));
console.log("✓ pocket: " + Object.keys(store.cards).length + " cards · " +
  Object.keys(store.sets).length + " sets · " + withArtist + " with illustrator · " +
  failures.length + " failed details");
if (missing.length) {
  console.log("  LAG vs Limitless (" + missing.length + " sets we do not hold):");
  for (const s of missing) console.log("    " + s.id + "  " + (s.name || "?") + "  " + (s.date || "") + "  " + (s.count || ""));
}
if (failures.length) console.log("  ⚠ " + failures.slice(0, 6).map(f => f.id).join(", "));
