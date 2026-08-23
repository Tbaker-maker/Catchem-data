// resolve-set-ids.mjs — learn the provider's OWN set ids before spending on them.
//
// WHY THIS EXISTS. The first catalogue-scale enrichment run spent 9,114 credits
// across 31 requests and came back with 861 cards from FIVE sets — none of
// which were the five sets it asked for. It requested ex8, pop3, pop4, pop5,
// mcd19…; it received Plasma Storm, Plasma Freeze, Plasma Blast, Prismatic
// Evolutions and Phantasmal Flames.
//
// The cause is a namespace collision that nothing in the pipeline checked.
// Our catalogue keys sets by the pokemontcg.io SLUG ("base1", "sv8", "ex8").
// The provider keys them by an internal NUMBER (1370, 1382, 23821). Zero of
// our 130 slugs overlap their ids. Sending setId=ex8 does not error — it is
// simply not honoured, and the response is billed anyway.
//
// That is the worst possible failure shape: it looks like success. Data
// arrives, the file grows, coverage counters go up, and every card in it is a
// card we did not choose. The enrichment we thought covered 4,027 of the top
// 6,000 by value actually has a MEDIAN CARD PRICE OF $0.49 — because it is
// whatever the provider returned, not what we targeted.
//
// So: resolve the ids from the provider, join them to our catalogue by name,
// and report what does not match rather than guessing. A set we cannot map is
// a set we do not fetch.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
const FETCH_TIMEOUT_MS = 30000;

// Join key. The provider prefixes with an era ("SV: Prismatic Evolutions",
// "ME02: Phantasmal Flames"); we do not. Punctuation and the word "set" drift
// between the two catalogues ("Base" vs "Base Set"). Strip all of it and
// compare what is left.
export const norm = s => String(s || "")
  .replace(/^[A-Z]{1,4}\d*(?:pt\d)?:\s*/i, "")   // era prefix
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\bset\b/g, "")
  .trim()
  .replace(/\s+/g, " ");

async function getJSON(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url.replace(/\?.*/, "")}`);
  return r.json();
}

export async function fetchProviderSets() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const d = await getJSON(`${BASE}/sets?limit=500&page=${page}`);
    const rows = d.data || d.sets || [];
    all.push(...rows);
    if (rows.length < 500) break;
  }
  return all;
}

export function joinToCatalogue(providerSets, catalogueSets) {
  const byName = new Map();
  for (const p of providerSets) {
    const id = p.id ?? p.setId ?? p._id;
    const name = p.name ?? p.setName;
    if (id == null || !name) continue;
    // Keep the first id for a name; duplicates are logged, never merged blindly.
    const k = norm(name);
    if (!byName.has(k)) byName.set(k, { id, name, cardCount: p.cardCount ?? p.total ?? null });
  }
  const bySlug = {}, unmatched = [];
  const claimed = new Set();
  for (const [slug, name] of Object.entries(catalogueSets)) {
    const hit = byName.get(norm(name));
    if (hit) {
      bySlug[slug] = { pptSetId: hit.id, pptName: hit.name, ourName: name, cardCount: hit.cardCount, matchedBy: "name" };
      claimed.add(norm(hit.name));
    } else unmatched.push({ slug, name, normalised: norm(name) });
  }
  // The reverse gap is worth as much as the forward one: a set the provider
  // prices and we do not carry is a hole in OUR catalogue. This is how we found
  // that bw9 (Plasma Freeze) is missing from our 130 sets entirely — the
  // provider returned it, and we had nowhere to put it.
  const providerOnly = [...byName.entries()]
    .filter(([k]) => !claimed.has(k))
    .map(([, v]) => ({ pptSetId: v.id, name: v.name, cardCount: v.cardCount }));
  return { bySlug, unmatched, providerOnly, providerSetCount: byName.size };
}

async function main() {
  if (!KEY) { console.error("Missing POKEMONPRICETRACKER_API_KEY"); process.exit(1); }
  const cat = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf-8"));
  const catalogueSets = {};
  for (const c of Object.values(cat.cards)) if (c.setId) catalogueSets[c.setId] = c.setName || null;

  const providerSets = await fetchProviderSets();
  const { bySlug, unmatched, providerOnly, providerSetCount } = joinToCatalogue(providerSets, catalogueSets);

  await writeFile(join(ROOT, "data/ppt-set-map.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), providerSetCount,
      matched: Object.keys(bySlug).length, unmatchedCount: unmatched.length,
      providerOnlyCount: providerOnly.length,
      note: "Provider set ids are internal numbers; our catalogue uses pokemontcg.io slugs. "
          + "Requests using the slug are NOT honoured and are billed anyway — see the 2026-08-23 report.",
      bySlug, unmatched, providerOnly }, null, 1) + "\n");

  console.log(`provider sets: ${providerSetCount} · our sets: ${Object.keys(catalogueSets).length}`);
  console.log(`✓ matched ${Object.keys(bySlug).length} · ours unmatched ${unmatched.length} · provider-only ${providerOnly.length}`);
  for (const u of unmatched.slice(0, 15)) console.log(`  ours, no provider match: ${u.slug.padEnd(14)} ${u.name}`);
  if (unmatched.length > 15) console.log(`  …and ${unmatched.length - 15} more`);
  for (const p of providerOnly.slice(0, 10)) console.log(`  provider-only (gap in OUR catalogue): ${p.name}`);
  if (providerOnly.length > 10) console.log(`  …and ${providerOnly.length - 10} more`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
