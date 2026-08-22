// artist-angles.mjs — the content lane nobody else can run.
//
// Art posts do well in this hobby and everybody makes them. What nobody does
// is JOIN the illustrator to the market: who drew the card everyone is chasing,
// what an artist's whole body of work is worth, whether a debut card was the
// one that mattered. Art accounts have the taste and none of the data; price
// accounts have the data and never look at who drew it. We hold both.
//
// LAWS THIS OBEYS, strictly, because artist claims are easy to get wrong:
// - Every artist name and card count comes from data/artists.json, sourced
//   from pokemontcg.io. Never from memory. If the file is missing, this
//   produces nothing and says so.
// - COUNTS ARE SCOPED. "Three cards in the sets we track" is publishable.
//   "Only three cards ever" requires complete coverage and is otherwise
//   forbidden — it is exactly the kind of claim a reader can disprove in
//   thirty seconds, and being disproved is the one thing we cannot afford.
// - Prices carry their chip and their date like every other figure.
// - No adversarial framing, no hype verbs, no jargon (v11), and the artist is
//   a person — write about their work the way you would if they were reading.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const art = await J("data/artists.json");
// NO process.exit() — this is imported by generate-pulse as one link in a
// chain that ends with publish-assert, and an exit(0) from an imported module
// ends the WHOLE run with a success code, silently skipping the last line of
// defence. rasterize-cards did exactly that and CI reported green. A module
// with nothing to do returns; it does not take the process with it.
const haveArtists = !!art && Object.keys(art.byArtist || {}).length > 0;
if (!haveArtists) {
  console.log("· artist angles: no data/artists.json yet — run scripts/fetch-artists.mjs first. Producing nothing rather than guessing.");
}
if (haveArtists) {
const sg = await J("data/singles-prices.json") ?? { cards: [] };
const price = Object.fromEntries((sg.cards || []).filter(c => c.priceMarket).map(c => [c.cardId, c.priceMarket]));
const money = n => `$${Math.round(n).toLocaleString("en-US")}`;
const complete = art.coverage?.complete === true;
// The scoping phrase is the difference between a fact and a claim we cannot defend.
const scope = complete ? "" : " in the sets we track";

const angles = [];
const A = Object.entries(art.byArtist).map(([artist, d]) => ({ artist, ...d }));

// 1 — THE SHORT CATALOGUE. HELD unless coverage is complete, and it is worth
// saying exactly why, because the scoping phrase looked like enough and was not.
//
// The count was scoped correctly — "in the sets we track" is literally true —
// but the SENTENCE BUILT ON IT was not scoped at all: "a small body of work is
// easy to hold in your head" is a claim about an illustrator's career, and we
// have no evidence for it. We track 119 chase singles across 54 illustrators,
// so 91% of them show 4 or fewer cards and 32 show exactly one. The angle was
// not finding illustrators with small catalogues; it was reading back the
// arithmetic of our own sampling and calling it a fact about a person.
//
// Checked against pokemontcg.io on 2026-08-22: Anesaki Dynamic has 140 cards
// and Shinji Kanda 22. The draft called Anesaki Dynamic's body of work small.
// A reader who knows the hobby disproves that in seconds, which the header of
// this file correctly names as the one thing we cannot afford.
//
// It returns automatically if coverage ever becomes complete, because then the
// count would mean what the sentence says. Scope the number AND the claim you
// hang on it — a true statistic can still carry a false sentence.
for (const a of (complete ? A.filter(x => x.cardCount <= 4).sort((x, y) => x.cardCount - y.cardCount).slice(0, 3) : [])) {
  const valued = a.cards.filter(c => price[c.cardId]);
  angles.push({ id: `artist-short-${a.artist.replace(/\W+/g, "-").toLowerCase()}`, kind: "short catalogue",
    chip: "VERIFIED", artist: a.artist,
    post: `${a.artist} has illustrated ${a.cardCount} Pokémon card${a.cardCount === 1 ? "" : "s"}${scope}.\n\n` +
      a.cards.map(c => `• ${c.name} — ${c.setName}${price[c.cardId] ? ` (${money(price[c.cardId])})` : ""}`).join("\n") +
      `\n\nA small body of work is easy to hold in your head, which is its own kind of collectable.`,
    why: "A short catalogue is inherently interesting and easy to verify. The scoping phrase is what stops it becoming a claim a reader can disprove.",
    sources: ["pokemontcg.io artist credits", "our own price feed"] });
}

// 2 — WHO DREW THE CHASE. The join nobody else makes.
const chases = A.flatMap(a => a.cards.map(c => ({ ...c, artist: a.artist, artistTotal: a.cardCount, price: price[c.cardId] })))
  .filter(c => c.price).sort((x, y) => y.price - x.price).slice(0, 3);
for (const c of chases) {
  angles.push({ id: `artist-chase-${c.cardId}`, kind: "who drew the chase", chip: "VERIFIED", artist: c.artist,
    // The count clause is deliberately absent. "…who has 1 card in the sets we
    // track" is literally true and still invites the reader to conclude the
    // illustrator has one card — Anesaki Dynamic has 140. A number that can
    // only be read wrongly is worth less than the sentence it costs, and the
    // payload of this angle is the join itself, not the tally.
    post: `${c.name} from ${c.setName} sits at ${money(c.price)} ungraded.\n\n` +
      `It was illustrated by ${c.artist}.\n\n` +
      `Everyone can tell you what this card costs. Fewer can tell you who drew it.`,
    why: "Art accounts have the taste and none of the data. Price accounts have the data and never look at who drew it. This is the only lane that holds both.",
    sources: ["pokemontcg.io artist credits", "our own price feed"] });
}

// 3 — THE LONG CAREER. Someone whose work spans eras.
for (const a of A.filter(x => x.firstSeen && x.latestSeen && x.cardCount >= 3)
  .map(x => ({ ...x, years: (Date.parse(x.latestSeen) - Date.parse(x.firstSeen)) / 31557600000 }))
  .filter(x => x.years >= 5).sort((x, y) => y.years - x.years).slice(0, 2)) {
  angles.push({ id: `artist-span-${a.artist.replace(/\W+/g, "-").toLowerCase()}`, kind: "long career",
    chip: "VERIFIED", artist: a.artist,
    post: `${a.artist}'s work spans ${Math.round(a.years)} years of Pokémon cards${scope} — ` +
      `${a.cards[0].setName} in ${String(a.firstSeen).slice(0, 4)} through ${a.cards[a.cards.length - 1].setName} in ${String(a.latestSeen).slice(0, 4)}.\n\n` +
      `Sets rotate, prices move, and somebody has quietly been drawing this whole time.`,
    why: "Longevity is a story the market never tells, because the market only looks at what changed today.",
    sources: ["pokemontcg.io artist credits and set release dates"] });
}

const out = { generatedAt: new Date().toISOString(),
  coverage: art.coverage,
  scopingRule: complete
    ? "Coverage is complete for the tracked set; counts may be stated plainly."
    : "Coverage is PARTIAL. Every count is phrased 'in the sets we track'. An 'only N ever' claim is forbidden from this data.",
  angles };
await writeFile(join(ROOT, "research/pulse/artist-angles.json"), JSON.stringify(out, null, 1));
console.log(`✓ artist angles: ${angles.length} drafted from ${A.length} illustrators (coverage ${complete ? "complete" : "partial — counts scoped"})`);
for (const a of angles.slice(0, 3)) console.log(`  ${a.kind.padEnd(18)} ${a.artist}`);
}   // haveArtists
