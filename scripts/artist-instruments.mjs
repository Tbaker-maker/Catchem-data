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
    cards: all.map(c => ({ cardId: c.cardId, name: c.name, setName: c.setName, rarity: c.rarity, finish: c.priceFinish ?? null, releaseDate: c.releaseDate ?? null, price: c.price, retPct: c.ret == null ? null : Math.round(c.ret * 1000) / 10 })),
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
// COMPARE LIKE WITH LIKE (fixed 2026-08-22). This measured a card against the
// median of its artist's ENTIRE body of work, across every rarity. A card's
// price is set overwhelmingly by rarity and by which Pokémon is on it, so every
// bulk common by an illustrator who also drew one chase card came out
// "underrated". Measured on the first real run: 23 of 25 finds compared across
// mixed rarities and 7 were commons under $2 — the worst was Brute Bonnet, an
// Uncommon at $0.24, held against a $287.82 median drawn from a 3-card cohort.
// The old read even conceded the flaw in its own text ("it usually reflects the
// Pokémon or the rarity rather than the art"), which is a caveat standing in
// for a control. A number that needs a sentence explaining it probably means
// something else is not a finding.
// Now the median is per artist PER RARITY, and a rarity needs its own cohort of
// three before it can be compared at all. Far fewer finds, each one defensible.
// median() already exists above; reusing it rather than shadowing.
// money(): a 24-cent card printed as "$0" in the old read — rounding a price
// to nothing is its own small dishonesty.
const money = n => n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`;
const underrated = [];
for (const p of profiles) {
  if (p.pricedCards < MIN_COHORT) continue;
  const byRarity = {};
  // Keyed by rarity AND FINISH. Rarity alone was still not like-for-like:
  // Aya Kusube's "Rare Holo" cohort held a 2001 unlimitedHolofoil at $1,051
  // beside a 2022 reverseHolofoil at $0.24, and the instrument duly reported
  // the 24-cent card as underrated. A reverse holo and an unlimited holo are
  // different products wearing the same rarity word.
  for (const c of p.cards) if (c.price != null && c.rarity && c.finish && c.releaseDate) (byRarity[c.rarity + " / " + c.finish] ||= []).push(c);
  for (const c of p.cards) {
    if (c.price == null || !c.rarity || !c.finish || !c.releaseDate) continue;
    // ...AND THE SAME ERA. Rarity plus finish was still not like-for-like:
    // 5ban Graphics' "Rare / holofoil" cohort spans decades, so a 2007 Palkia
    // at $0.26 was held against a $563 median carried by a vintage card and
    // duly reported as the single most underrated card we track. A 20-year gap
    // is a different market, not a mispricing — our own venue law says vintage
    // trades somewhere else entirely. Peers must sit within five years.
    const yr = d => Number(String(d).slice(0, 4));
    const peers = (byRarity[c.rarity + " / " + c.finish] || [])
      .filter(x => x.cardId !== c.cardId && Math.abs(yr(x.releaseDate) - yr(c.releaseDate)) <= 5);
    if (peers.length < MIN_COHORT) continue;          // no like-for-like cohort, no claim
    const rarityMedian = median(peers.map(x => x.price));
    if (!rarityMedian || c.price >= rarityMedian * 0.5) continue;
    underrated.push({ cardId: c.cardId, card: c.name, set: c.setName, artist: p.artist,
      price: c.price, rarity: c.rarity, finish: c.finish, rarityMedian, rarityPeers: peers.length,
      artistMedian: p.medianValue, catalogueCards: p.catalogueCards, chip: "READ",
      read: `${c.name} sits at ${money(c.price)} while ${p.artist}'s other ${c.rarity} (${c.finish}) cards sit around ${money(rarityMedian)} (${peers.length} of them, within five years). Same illustrator, same rarity tier — so this compares like with like rather than holding a common against a chase card. Still not a recommendation: what a card is worth is mostly the Pokémon on it.` });
  }
}

const out = { generatedAt: new Date().toISOString(),
  method: "Cohort movement compares a card's latest move to the median move of everything else the same illustrator drew that we can price. Fewer than three priced cards is not a cohort and produces no verdict.",
  coverage: { artists: profiles.length, catalogueCards: Object.keys(cat.cards).length, pricedCards: priced.size, pricedFromCatalogue: [...provenance.values()].filter(v => v === 'catalogue').length,
    artistsWithCohort: profiles.filter(p => p.pricedCards >= MIN_COHORT).length,
    note: "Catalogue counts are complete for the sets ingested; an 'ever' claim is valid only for artists whose sets are all present." },
  profiles: profiles.sort((a, b) => b.catalogueCards - a.catalogueCards).slice(0, 200),
  // Ranked by the gap against the SAME-RARITY median, not the whole-cohort one
  // the comparison no longer uses. Sorting by artistMedian kept pushing bulk
  // commons to the top — the widest absolute gap is always a cheap card
  // measured against an expensive cohort, which is the confound this
  // instrument was just fixed to avoid. Ranking on the metric you actually
  // computed sounds obvious; it survived one round of fixing here anyway.
  // NOT PUBLISHABLE (2026-08-22). This took three successive controls — same
  // rarity, then same finish, then same era — and each one removed a class of
  // nonsense only for the next to surface. The last example standing: 5ban
  // Graphics' "Rare / holofoil" cards within five years of 2021 are two 2021
  // Celebrations bulk cards at $0.26 and two 2025 Victini chase cards at $600,
  // so a 26-cent card is measured against a $565 median and reported as the
  // most underrated card we track.
  //
  // The defect is not the controls, it is the premise. Card price is driven by
  // which Pokémon is on it, chase status and set-specific scarcity — none of
  // which we model — and "Rare" means different things in different sets. A
  // 3-4 card artist cohort cannot isolate an art effect from those. Tuning the
  // thresholds until the visible examples stop being embarrassing would be the
  // same mistake as scoping a count and not the sentence built on it.
  //
  // So it stays computed and stays advisory, and it carries a flag saying so.
  // It becomes publishable when there is a model of what a card should cost,
  // not before.
  publishable: false,
  publishableReason: "Underrated finds compare cards within an artist's cohort but do not model the things that actually set a card's price (which Pokémon, chase status, set scarcity). Cohorts of 3-4 make the median unstable, and 'Rare' is not a consistent tier across sets. Advisory only — do not put these on a public surface.",
  attributions, underrated: underrated
    .sort((a, b) => (b.rarityMedian - b.price) - (a.rarityMedian - a.price)).slice(0, 25) };

await writeFile(join(ROOT, "research/pulse/artist-instruments.json"), JSON.stringify(out, null, 1));
console.log(`✓ artist instruments: ${profiles.length} illustrators · ${out.coverage.artistsWithCohort} with a real cohort · ${attributions.length} attributions · ${underrated.length} sitting below their artist's median`);
for (const a of attributions.slice(0, 4)) console.log(`  ${a.verdict.padEnd(14)} ${a.card.slice(0, 26).padEnd(26)} ${a.cardMovePct > 0 ? "+" : ""}${a.cardMovePct}% vs cohort ${a.artistCohortMovePct > 0 ? "+" : ""}${a.artistCohortMovePct}%`);
