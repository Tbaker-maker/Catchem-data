// universe-advisor.mjs — what should we spend our price budget on?
//
// Metadata is free and unlimited. PRICES are the constrained resource: every
// tracked single costs an API call every day, forever. So the question is not
// "how many cards can we track" — it is "which cards, if priced, buy the most
// analytical power per unit of cost".
//
// This answers it with arithmetic instead of instinct. The scoring reflects
// what actually makes our instruments work:
//
//   COHORT COMPLETION  — an artist with 6 catalogue cards and 2 priced is one
//     card away from a real cohort. Priceing that third card unlocks RT-7
//     attribution for their entire body of work. This is the highest-value
//     purchase available and nobody would find it by intuition.
//   ERA BALANCE        — our index leans 88% modern. Cards from thin eras buy
//     coverage the index currently lacks.
//   CHASE STATUS       — the cards people actually search for. Coverage of a
//     set nobody asks about is cheap and useless.
//
// It never says "buy this card". It says "pricing this card makes these
// instruments work", which is a different and honest claim.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const cat = await J("data/card-catalogue.json");
if (!cat || !Object.keys(cat.cards || {}).length) {
  console.log("· universe advisor: no catalogue yet — run scripts/ingest-catalogue.mjs first.");
  process.exit(0);
}
const sg = await J("data/singles-prices.json") ?? { cards: [] };
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const pricedIds = new Set((sg.cards || []).map(c => c.cardId).filter(Boolean));
const MIN_COHORT = 3;

// Which artists are close to a usable cohort?
const byArtist = {};
for (const [cardId, c] of Object.entries(cat.cards)) {
  if (!c.artist) continue;
  (byArtist[c.artist] ||= { total: 0, priced: 0, candidates: [] }).total++;
  if (pricedIds.has(cardId)) byArtist[c.artist].priced++;
  else byArtist[c.artist].candidates.push({ cardId, ...c });
}

// Era coverage — where is the catalogue thick and our pricing thin?
const eraOf = id => /^(sv|zsv|rsv)/.test(id) ? "Scarlet & Violet" : /^swsh|^cel/.test(id) ? "Sword & Shield"
  : /^me/.test(id) ? "Mega Evolution" : /^sm/.test(id) ? "Sun & Moon" : /^xy/.test(id) ? "XY"
  : /^bw/.test(id) ? "Black & White" : /^(hgss|dp|pl)/.test(id) ? "DP/HGSS" : "Vintage & other";
const eraCounts = {};
for (const [cardId, c] of Object.entries(cat.cards)) {
  const e = eraOf(c.setId || "");
  (eraCounts[e] ||= { catalogue: 0, priced: 0 }).catalogue++;
  if (pricedIds.has(cardId)) eraCounts[e].priced++;
}
const thinEras = new Set(Object.entries(eraCounts)
  .filter(([, v]) => v.catalogue >= 200 && v.priced / v.catalogue < 0.002)
  .map(([k]) => k));

// A card is worth pricing in proportion to what it unlocks.
const RARE_CHASE = /(secret|special illustration|illustration rare|hyper|rainbow|gold|alt)/i;
const scored = [];
for (const [artist, a] of Object.entries(byArtist)) {
  const needed = MIN_COHORT - a.priced;
  if (needed <= 0 || a.total < MIN_COHORT) continue;      // already viable, or can never be
  // Prefer the artist's most collectable unpriced cards — a cohort built from
  // bulk commons is technically a cohort and practically useless.
  const picks = a.candidates
    .sort((x, y) => (RARE_CHASE.test(y.rarity || "") ? 1 : 0) - (RARE_CHASE.test(x.rarity || "") ? 1 : 0))
    .slice(0, needed);
  for (const p of picks) {
    let score = 0; const reasons = [];
    score += 50 / Math.max(1, needed); reasons.push(`completes a cohort for ${artist} (${a.priced}/${MIN_COHORT} priced, ${a.total} catalogue cards)`);
    if (a.total >= 20) { score += 25; reasons.push(`prolific illustrator — ${a.total} cards means a large body of work becomes analysable`); }
    if (RARE_CHASE.test(p.rarity || "")) { score += 15; reasons.push(`chase-class rarity (${p.rarity})`); }
    if (thinEras.has(eraOf(p.setId || ""))) { score += 20; reasons.push(`${eraOf(p.setId)} is thinly covered in our pricing`); }
    scored.push({ cardId: p.cardId, name: p.name, set: p.setName, rarity: p.rarity, artist, score: Math.round(score), reasons });
  }
}
scored.sort((a, b) => b.score - a.score);

// What does each tranche actually buy?
const tranche = n => {
  const picks = scored.slice(0, n);
  const artistsUnlocked = new Set();
  const counts = {};
  for (const p of picks) counts[p.artist] = (counts[p.artist] || 0) + 1;
  for (const [artist, added] of Object.entries(counts))
    if ((byArtist[artist].priced + added) >= MIN_COHORT) artistsUnlocked.add(artist);
  return { cards: picks.length, artistCohortsUnlocked: artistsUnlocked.size,
    catalogueCardsMadeAnalysable: [...artistsUnlocked].reduce((s, a) => s + byArtist[a].total, 0) };
};

const out = { generatedAt: new Date().toISOString(),
  principle: "Metadata is free; prices are the constrained resource. This ranks cards by what pricing them UNLOCKS, not by what they are worth. It never recommends a purchase — only coverage.",
  today: { catalogueCards: Object.keys(cat.cards).length, pricedSingles: pricedIds.size,
    trackedProducts: (sp.products || []).length,
    artistsInCatalogue: Object.keys(byArtist).length,
    artistsWithViableCohort: Object.values(byArtist).filter(a => a.priced >= MIN_COHORT).length },
  eraCoverage: eraCounts,
  tranches: { "+25": tranche(25), "+50": tranche(50), "+100": tranche(100), "+200": tranche(200) },
  recommended: scored.slice(0, 200) };

await writeFile(join(ROOT, "research/pulse/universe-advisor.json"), JSON.stringify(out, null, 1));
console.log(`✓ universe advisor: ${out.today.catalogueCards} catalogue cards · ${out.today.pricedSingles} priced · ${out.today.artistsWithViableCohort}/${out.today.artistsInCatalogue} artists analysable today`);
for (const [k, v] of Object.entries(out.tranches))
  console.log(`  ${k.padEnd(6)} cards → unlocks ${v.artistCohortsUnlocked} artist cohorts, making ${v.catalogueCardsMadeAnalysable} catalogue cards analysable`);
console.log(`\n  top picks:`);
for (const p of scored.slice(0, 5)) console.log(`   ${String(p.score).padStart(3)}  ${p.name.slice(0, 24).padEnd(24)} ${p.artist.slice(0, 20).padEnd(20)} ${p.reasons[0]}`);
