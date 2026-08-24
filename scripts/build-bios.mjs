// build-bios.mjs — a bio for every card, and every number in it must be earned.
//
// Tyler, 2026-08-24: "Each card should have a bio, and that bio should be logic
// to our system — history, stats, colour, cuteness rating, comedy rating,
// seriousness, popularity, price, likeness. We need this down to a T."
//
// THE TRAP IN THE REQUEST, and it is the whole design problem: a cuteness
// rating I invent is **my taste wearing a number**, and our own law says a
// grouping not in the data is slop. It would fail on the first card.
//
// THE RESOLUTION: **every rating names the printed field it derives from.** If a
// rating cannot name one, it does not ship. That turns the soft ratings from
// opinions into claims somebody can check by looking at the card — which is the
// same standard we hold every other surface to.
//
// So: comedy comes from ATTACK NAMES, cute comes from the Baby subtype and
// unevolved low-HP basics, serious comes from grim flavour text we validated by
// reading, colour comes from the TYPE because the type IS the card frame
// colour, and price and scarcity come from real percentiles.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const idx = await J("research/assets/card-index.json") ?? [];
const attrs = (await J("data/card-attrs.json"))?.cards ?? {};
const text = (await J("data/card-text.json"))?.cards ?? {};
const lore = (await J("data/lore.json"))?.lore ?? {};

// ── PRICE PERCENTILE ──────────────────────────────────────────────────────
// A rating only means something against a distribution, so build the real one
// rather than picking thresholds that feel right.
const prices = idx.map(c => c.p).filter(p => p != null).sort((a, b) => a - b);
const pct = (p) => {
  if (p == null) return null;
  let lo = 0, hi = prices.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (prices[mid] < p) lo = mid + 1; else hi = mid; }
  return Math.round(lo / prices.length * 100);
};

// The type IS the card's frame colour. This is not an aesthetic judgement —
// it is what the printed card looks like.
const TYPE_COLOUR = { Fire: "red", Water: "blue", Grass: "green", Lightning: "yellow",
  Psychic: "purple", Fighting: "brown", Darkness: "black", Metal: "silver",
  Dragon: "gold", Fairy: "pink", Colorless: "white" };

// Genuinely absurd attack names. Deliberately narrow — the first pass caught
// "Pound" and "Sing", which are ordinary attacks, and a comedy rating that
// fires on half the catalogue rates nothing.
const JOKE_ATTACK = /\b(splash|metronome|take it easy|slack off|do the wave|belly drum|tickle|teeter dance|sweet kiss|lovely kiss|payday|spit up|swallow|stockpile|water sport|mud sport|smelling salts|fake tears|charm|encore|assist|present|nap|snore|yawn|substitute|transform|struggle|self-destruct|explosion|hold hands|celebrate|happy hour|baby-doll eyes)\b/i;
const GRIM = /\b(devours|drags (it|them|its prey)|steals? (souls|life|dreams)|feeds on (fear|dreams|life)|never (returns|seen again)|dead mother|deceased mother|curse|corpse|victims?)\b/i;

const ERAS = [[1998, 2003, "vintage"], [2004, 2010, "e-card & EX"], [2011, 2016, "Black & White / XY"],
  [2017, 2020, "Sun & Moon"], [2021, 2026, "modern"]];
const REGIONS = [[1,151,"Kanto"],[152,251,"Johto"],[252,386,"Hoenn"],[387,493,"Sinnoh"],
  [494,649,"Unova"],[650,721,"Kalos"],[722,809,"Alola"],[810,905,"Galar"],[906,1025,"Paldea"]];

const bios = {};
for (const c of idx) {
  const a = attrs[c.i] ?? {};
  const t = text[c.i] ?? {};
  const atk = (t.a ?? []).join(" ");
  const flav = t.f ?? "";
  const price = c.p ?? null;
  const p = pct(price);
  const year = Number(c.y) || null;

  // Every rating carries WHY. A number without its derivation is exactly the
  // thing we refuse to publish anywhere else.
  const ratings = {};
  const why = {};

  if (p != null) { ratings.price = Math.ceil(p / 10) || 1; why.price = `${p}th percentile of ${prices.length.toLocaleString()} priced cards`; }

  if (a.hp) { ratings.power = Math.min(10, Math.max(1, Math.round(a.hp / 38))); why.power = `${a.hp} HP printed on the card`; }

  // COMEDY — from the attack name, which is printed.
  const joke = (t.a ?? []).find(x => JOKE_ATTACK.test(x));
  if (joke) { ratings.comedy = 8; why.comedy = `its attack is called "${joke}"`; }
  else if (/\b(dance|kiss|hug|sing|lick)\b/i.test(atk)) { ratings.comedy = 5; why.comedy = "an attack name with a soft or silly verb"; }

  // CUTE — the Baby subtype is a real printed category; an unevolved Basic with
  // low HP is the shape of a small creature.
  if ((a.st ?? []).includes("Baby")) { ratings.cute = 10; why.cute = "the Baby subtype, printed on the card"; }
  else if ((a.st ?? []).includes("Basic") && !a.ev && a.hp && a.hp <= 60) { ratings.cute = 7; why.cute = `an unevolved Basic at ${a.hp} HP`; }
  else if (a.ev && a.hp && a.hp >= 200) { ratings.cute = 2; why.cute = `a fully evolved ${a.hp} HP form`; }

  // SERIOUS — grim language in the printed flavour text, validated by reading.
  if (GRIM.test(flav)) { ratings.serious = 9; why.serious = "its own flavour text uses grim language"; }
  else if (flav && /\b(legend|ancient|said to|believed)\b/i.test(flav)) { ratings.serious = 6; why.serious = "flavour text framed as legend"; }

  // SCARCITY — the printed rarity.
  const r = c.r ?? "";
  if (/Secret|Hyper|Rainbow/i.test(r)) { ratings.scarcity = 10; why.scarcity = r; }
  else if (/Illustration Rare/i.test(r)) { ratings.scarcity = 8; why.scarcity = r; }
  else if (/Ultra|Holo/i.test(r)) { ratings.scarcity = 6; why.scarcity = r; }
  else if (/Rare/i.test(r)) { ratings.scarcity = 4; why.scarcity = r; }
  else if (r) { ratings.scarcity = 2; why.scarcity = r; }

  const region = REGIONS.find(([lo, hi]) => a.dex && a.dex >= lo && a.dex <= hi);
  const era = ERAS.find(([lo, hi]) => year && year >= lo && year <= hi);

  bios[c.i] = {
    name: c.n, set: c.s, year: c.y, artist: c.a ?? null, rarity: c.r ?? null, price,
    type: a.t ?? null,
    colour: (a.t ?? []).map(x => TYPE_COLOUR[x]).filter(Boolean),
    stage: (a.st ?? []).find(x => /^(Basic|Stage 1|Stage 2|VMAX|VSTAR|MEGA|Baby)$/.test(x)) ?? null,
    mechanic: (a.st ?? []).filter(x => /^(ex|EX|V|VMAX|VSTAR|GX|BREAK|Prime|LEGEND|Star|MEGA|Radiant|Tag Team)$/.test(x)),
    hp: a.hp ?? null, weakness: a.w ?? null, evolvesFrom: a.ev ?? null,
    dex: a.dex ?? null, region: region ? region[2] : null, era: era ? era[2] : null,
    attacks: t.a ?? null, lore: lore[c.i] ?? null,
    ratings, why,
  };
}

const rated = Object.values(bios).filter(b => Object.keys(b.ratings).length);
await writeFile(join(ROOT, "data/card-bios.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: "A bio per card. EVERY rating names the printed field it derives from, in the `why` object — a rating that cannot name one does not ship. A cuteness score I invented would be my taste wearing a number, and our own law says a grouping not in the data is slop.",
  derivations: {
    price: "percentile across every priced card",
    power: "printed HP",
    comedy: "the attack NAME — a genuinely absurd one scores 8, a soft verb scores 5",
    cute: "the Baby subtype scores 10; an unevolved Basic at 60 HP or less scores 7; a fully evolved 200+ HP form scores 2",
    serious: "grim language in the printed flavour text scores 9; legend framing scores 6",
    scarcity: "the printed rarity",
    colour: "the TYPE, because the type determines the card's frame colour — not an aesthetic judgement",
  },
  refused: "popularity and likeness. We hold no engagement data per card, and any number would be invented. They ship when there is a real signal behind them and not before.",
  coverage: { total: idx.length, withAnyRating: rated.length },
  bios }, null, 1));

console.log(`✓ bios: ${idx.length.toLocaleString()} cards, ${rated.length.toLocaleString()} with at least one derived rating`);
const counts = {};
for (const b of Object.values(bios)) for (const k of Object.keys(b.ratings)) counts[k] = (counts[k] ?? 0) + 1;
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1]))
  console.log(`   ${String(v).padStart(6)}  ${k}`);
console.log(`\n  REFUSED: popularity, likeness — no real signal, so no number.`);
