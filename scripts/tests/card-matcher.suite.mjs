import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCardIndex, matchCards } from "../lib/card-matcher.mjs";
import { buildCatalogueIndex, extractMentions } from "../lib/youtube.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const FIXTURE = [
  { tcgplayerProductId: 102, id: "tcgcsv-102", groupId: 2, set: "SWSH07: Evolving Skies", name: "Umbreon VMAX (Alternate Art Secret)", number: "215/203", rarity: "Secret Rare", kind: "single" },
  { tcgplayerProductId: 101, id: "tcgcsv-101", groupId: 2, set: "SWSH07: Evolving Skies", name: "Umbreon VMAX", number: "095/203", rarity: "Ultra Rare", kind: "single" },
  { tcgplayerProductId: 103, id: "tcgcsv-103", groupId: 1, set: "SV: Prismatic Evolutions", name: "Umbreon ex", number: "161/131", rarity: "Special Illustration Rare", kind: "single" },
];

// Hand-checked against data/catalog/tcgcsv-latest.json asOf 2026-10-13.
// A null pid means the line must stay unmatched. Accuracy is matches that agree, over 50.
// Gengar SIR is tcgcsv-717610 (ME: 30th Celebration, 154/128). Mega Gengar is a different name.
const SAMPLE = [
  ["Moonbreon is undervalued", 246723],
  ["moonbrean from evolving skies", 246723],
  ["Umbreon VMAX alt art, Evolving Skies", 246723],
  ["215/203 from Evolving Skies", 246723],
  ["SWSH07 215/203", 246723],
  ["ES 215/203", 246723],
  ["Mega Gengar SIR", 676096],
  ["Mega Dragonite SIR", 676102],
  ["Mega Charizard X SIR from Phantasmal Flames", 662184],
  ["Charizard ex special illustration rare from Obsidian Flames", 509980],
  ["Venusaur ex SIR from 151", 517044],
  ["Pikachu ex SIR from Surging Sparks", 590027],
  ["Gengar VMAX alt art from Fusion Strike", 253266],
  ["Aerodactyl VSTAR 093/196 Lost Origin", 282255],
  ["Mewtwo XY101 from XY Promos", 108624],
  ["Rayquaza VMAX alt art Evolving Skies", 246733],
  ["Iono SIR Paldea Evolved", 497689],
  ["Mew ex SIR Paldean Fates", 534919],
  ["Umbreon ex SIR Prismatic Evolutions", 610516],
  ["Eevee ex SIR Prismatic Evolutions", 610522],
  ["Roaring Moon ex SIR Paradox Rift", 523932],
  ["Bloodmoon Ursaluna ex SIR Twilight Masquerade", 550260],
  ["Pecharunt ex SIR Shrouded Fable", 560404],
  ["Mega Lucario ex SIR Mega Evolution", 654518],
  ["Latias ex SIR Surging Sparks", 589985],
  ["Umbreon is so good", null],
  ["pulled 215/203 today", null],
  ["Pikachu SIR", null],
  ["Umbreon VMAX from Evolving Skies", null],
  ["Gengar SIR", 717610],
  ["Charizard from Obsidian Flames", null],
  ["Venusaur from 151", null],
  ["Pikachu from Surging Sparks", null],
  ["Treekachu SIR", null],
  ["Aerodactyl illustration rare from Lost Origin", null],
  ["Team Rocket SIR from Destined Rivals", null],
  ["Pikachu from Crown Zenith", null],
  ["the market will go up", null],
  ["Evolving Skies booster box", null],
  ["illustration rares are undervalued", null],
  ["Gengar VMAX Climbs", null],
  ["Mega Charizard X from Phantasmal Flames", null],
  ["IR", null],
  ["alt art", null],
  ["ES", null],
  ["Moonbreon from Prismatic Evolutions", null],
  ["215/203 from Surging Sparks", null],
  ["Charizard 215/203 Evolving Skies", null],
  ["Bubble Mew", null],
  ["these singles will rise", null],
];

export async function run() {
  let fail = 0;
  const t = (name, ok, detail = "") => {
    if (ok) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " " + detail : ""}`); }
  };
  if (SAMPLE.length !== 50) t("sample is 50 claims", false, String(SAMPLE.length));

  const idx = buildCardIndex(FIXTURE);
  const moon = matchCards("Moonbreon is undervalued", idx);
  t("fixture nickname is the alt art", moon.matches.length === 1 && moon.matches[0].pid === 102 && moon.matches[0].reason === "nickname" && moon.matches[0].confidence === 0.9);
  t("fixture name alone stays unmatched", matchCards("Umbreon is so good", idx).matches.length === 0);
  t("fixture number alone stays unmatched", matchCards("pulled 215/203 today", idx).matches.length === 0);
  t("fixture vmax without a finish stays unmatched", matchCards("Umbreon VMAX from Evolving Skies", idx).matches.length === 0);
  t("fixture nickname disagrees with the named set", matchCards("Moonbreon from Prismatic Evolutions", idx).matches.length === 0);
  const multi = matchCards("9:00 Moonbreon Rising\nPrismatic Evolutions ETB", idx);
  t("a later line's set does not veto a nickname", multi.matches.length === 1 && multi.matches[0].pid === 102 && multi.matches[0].reason === "nickname");
  const wired = extractMentions("Moonbreon is undervalued", buildCatalogueIndex(FIXTURE));
  t("youtube mentions use the matcher", wired.cards.length === 1 && wired.cards[0] === 102 && wired.reasons["card:102"] === "nickname");

  let catalogue = null;
  try { catalogue = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8")); } catch { catalogue = null; }
  t("catalogue file is present", !!catalogue?.items?.length);
  if (catalogue) {
    const full = buildCardIndex(catalogue.items);
    let agree = 0;
    const misses = [];
    for (const [text, pid] of SAMPLE) {
      const got = matchCards(text, full).matches;
      const ok = pid == null ? got.length === 0 : got.length === 1 && got[0].pid === pid;
      if (ok) agree += 1;
      else misses.push(`${JSON.stringify(text)} expected ${pid} got ${got.map((m) => m.pid).join(",") || "none"}`);
    }
    t("hand-checked sample accuracy", agree === 50, `${agree}/50`);
    for (const line of misses.slice(0, 12)) console.error("       " + line);
    const nick = full.nicknames.find((row) => row.alias === "moonbreon");
    t("moonbreon resolves to 215/203", nick?.card?.pid === 246723 && nick.card.number === "215/203");
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("card-matcher.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
