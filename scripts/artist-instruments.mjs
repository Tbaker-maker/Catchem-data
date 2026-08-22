// artist-instruments.mjs — is it the CARD, or the ARTIST?
//
// When a card moves, everybody asks why and everybody guesses. There is a
// question underneath that nobody in this hobby has ever asked with data:
// did the illustrator's OTHER work move too?
//
//   All of their cards moved  → something happened to the ARTIST. A feature, a
//                               convention appearance, a set announcement, a
//                               community moment. The whole body of work reprices.
//   Only this one moved       → something happened to the CARD. The Pokémon,
//                               the set, the chase, a tournament result.
//
// That distinction changes what a collector does next, and it cannot be
// answered by anyone holding only art data or only price data. We hold both.
//
// EVERYTHING HERE IS A READ. Cohort movement is evidence, never proof — a
// small cohort or a thin day says INSUFFICIENT rather than inventing a verdict.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const cat = await J("data/card-catalogue.json");
if (!cat || !Object.keys(cat.cards || {}).length) {
  console.log("· artist instruments: no data/card-catalogue.json — run scripts/ingest-catalogue.mjs first. Producing nothing rather than guessing.");
  process.exit(0);
}
const sg = await J("data/singles-prices.json") ?? { cards: [] };
const hist = await J("research/pulse/singles-history.json") ?? { entries: [] };

// Two price sources, in priority order. Our own tracked feed is verified and
// wins; the catalogue's bundled TCGplayer figures cover thousands more cards
// and make cohorts real. Every card records WHICH source priced it, because a
// mixed-provenance number that does not say so is the start of a bad habit.
const priced = new Map();
const provenance = new Map();
for (const [id, c] of Object.entries(cat.cards)) if (c.price != null) { priced.set(id, c.price); provenance.set(id, "catalogue"); }
for (const c of sg.cards || []) if (c.cardId && c.priceMarket) { priced.set(c.cardId, c.priceMarket); provenance.set(c.cardId, "tracked"); }
const series = {};
for (const e of hist.entries || []) (series[e.cardId] ||= []).push({ date: e.date, price: e.price });
for (const k of Object.keys(series)) series[k].sort((a, b) => a.date < b.date ? -1 : 1);
const ret = id => { const s = series[id]; if (!s || s.length < 2) return null; const a = s[s.length - 2].price, b = s[s.length - 1].price; return a ? b / a - 1 : null; };
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// Build every artist's complete body of work from the catalogue, then mark
// which of those cards we can actually price.
const artists = {};
for (const [cardId, c] of Object.entries(cat.cards)) {
  if (!c.artist) continue;
  (artists[c.artist] ||= { cards: [], setIds: new Set() });
  artists[c.artist].cards.push({ cardId, ...c, price: priced.get(cardId) ?? null, priceFrom: provenance.get(cardId) ?? null, ret: ret(cardId) });
  artists[c.artist].setIds.add(c.setId);
}

const MIN_COHORT = 3;          // fewer than three priced cards is not a cohort
const MOVE = 0.03;             // 3% is the smallest move worth attributing
const profiles = [];
for (const [name, a] of Object.entries(artists)) {
  const all = a.cards.sort((x, y) => (x.releaseDate || "") < (y.releaseDate || "") ? -1 : 1);
  const pricedCards = all.filter(c => c.price != null);
  const moved = pricedCards.filter(c => c.ret != null);
  const rets = moved.map(c => c.ret);
  const cohortRet = rets.length ? median(rets) : null;
  // Dispersion answers "do their cards move together?". Low dispersion with a
  // real move is the signature of artist-wide repricing.
  const dispersion = rets.length >= MIN_COHORT
    ? Math.sqrt(rets.reduce((s, r) => s + (r - (rets.reduce((x, y) => x + y, 0) / rets.length)) ** 2, 0) / rets.length)
    : null;
  const values = pricedCards.map(c => c.price);
  profiles.push({
    artist: name,
    catalogueCards: all.length,
    setsSpanned: [...a.setIds].length,
    firstSeen: all[0]?.releaseDate ?? null,
    latestSeen: all[all.length - 1]?.releaseDate ?? null,
    pricedCards: pricedCards.length,
    medianValue: median(values),
    topCard: pricedCards.slice().sort((x, y) => y.price - x.price)[0] ?? null,
    cohortReturnPct: cohortRet == null ? null : Math.round(cohortRet * 1000) / 10,
    dispersionPct: dispersion == null ? null : Math.round(dispersion * 1000) / 10,
    cards: all.map(c => ({ cardId: c.cardId, name: c.name, setName: c.setName, rarity: c.rarity, price: c.price, retPct: c.ret == null ? null : Math.round(c.ret * 1000) / 10 })),
  });
}

// ── ATTRIBUTION: for every card that moved, was it the card or the artist? ──
const attributions = [];
for (const p of profiles) {
  if (p.pricedCards < MIN_COHORT || p.cohortReturnPct == null) continue;
  for (const c of p.cards) {
    if (c.retPct == null || Math.abs(c.retPct) < MOVE * 100) continue;
    const cohort = p.cohortReturnPct, dispersion = p.dispersionPct ?? 99;
    const withCohort = Math.abs(c.retPct - cohort) <= Math.max(2, dispersion);
    attributions.push({
      cardId: c.cardId, card: c.name, set: c.setName, artist: p.artist,
      cardMovePct: c.retPct, artistCohortMovePct: cohort, cohortSize: p.pricedCards,
      verdict: withCohort ? "ARTIST-WIDE" : "CARD-SPECIFIC", chip: "READ",
      read: withCohort
        ? `${c.name} moved ${c.retPct > 0 ? "up" : "down"} ${Math.abs(c.retPct)}%, and the rest of ${p.artist}'s priced work moved ${cohort > 0 ? "up" : "down"} ${Math.abs(cohort)}% with it. When a whole body of work reprices together it usually reflects something about the illustrator rather than this one card.`
        : `${c.name} moved ${c.retPct > 0 ? "up" : "down"} ${Math.abs(c.retPct)}% while the rest of ${p.artist}'s priced work sat at ${cohort > 0 ? "+" : ""}${cohort}%. A card moving alone usually means something about that card — the Pokémon, the set, or its place as a chase — rather than the artist.`,
    });
  }
}

// ── UNDERRATED: a card sitting well below its artist's own median ───────────
const underrated = [];
for (const p of profiles) {
  if (p.pricedCards < MIN_COHORT || !p.medianValue) continue;
  for (const c of p.cards) {
    if (c.price == null || c.price >= p.medianValue * 0.5) continue;
    underrated.push({ cardId: c.cardId, card: c.name, set: c.setName, artist: p.artist,
      price: c.price, artistMedian: p.medianValue, catalogueCards: p.catalogueCards, chip: "READ",
      read: `${c.name} sits at $${Math.round(c.price).toLocaleString("en-US")} while the middle of ${p.artist}'s priced work is $${Math.round(p.medianValue).toLocaleString("en-US")}. That gap is not a recommendation — it usually reflects the Pokémon or the rarity rather than the art — but it is where an art-first collector would look first.` });
  }
}

const out = { generatedAt: new Date().toISOString(),
  method: "Cohort movement compares a card's latest move to the median move of everything else the same illustrator drew that we can price. Fewer than three priced cards is not a cohort and produces no verdict.",
  coverage: { artists: profiles.length, catalogueCards: Object.keys(cat.cards).length, pricedCards: priced.size, pricedFromCatalogue: [...provenance.values()].filter(v => v === 'catalogue').length,
    artistsWithCohort: profiles.filter(p => p.pricedCards >= MIN_COHORT).length,
    note: "Catalogue counts are complete for the sets ingested; an 'ever' claim is valid only for artists whose sets are all present." },
  profiles: profiles.sort((a, b) => b.catalogueCards - a.catalogueCards).slice(0, 200),
  attributions, underrated: underrated.sort((a, b) => (b.artistMedian - b.price) - (a.artistMedian - a.price)).slice(0, 25) };

await writeFile(join(ROOT, "research/pulse/artist-instruments.json"), JSON.stringify(out, null, 1));
console.log(`✓ artist instruments: ${profiles.length} illustrators · ${out.coverage.artistsWithCohort} with a real cohort · ${attributions.length} attributions · ${underrated.length} sitting below their artist's median`);
for (const a of attributions.slice(0, 4)) console.log(`  ${a.verdict.padEnd(14)} ${a.card.slice(0, 26).padEnd(26)} ${a.cardMovePct > 0 ? "+" : ""}${a.cardMovePct}% vs cohort ${a.artistCohortMovePct > 0 ? "+" : ""}${a.artistCohortMovePct}%`);
