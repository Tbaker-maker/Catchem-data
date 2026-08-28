// ingest-hardware.mjs — consoles + cartridges/discs/boxes.
// Consoles: Wikimedia Commons hardware photos (not logos).
// Cartridges: Wikipedia infobox of the game (the retail object people
// recognize). If Commons has a cart photo we prefer that. Caption says
// cart / disc / box honestly. No SVG, no 5KB thumbs.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "CatchEmCatalogue/1.0 (https://catchemtcg.com; console and cartridge metadata)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CONSOLES = [
  { id: "gb", n: "Game Boy", year: "1989", file: "Game-Boy-FL.png",
    aliases: ["game boy", "gameboy", "original game boy", "dmg", "brick"],
    spark: ["red", "blue", "yellow", "the first one"] },
  { id: "gbp", n: "Game Boy Pocket", year: "1996", file: "Game-Boy-Pocket-FL.png",
    aliases: ["game boy pocket", "pocket game boy"], spark: ["thin"] },
  { id: "gbc", n: "Game Boy Color", year: "1998", file: "Nintendo-Game-Boy-Color-FL.png",
    aliases: ["game boy color", "gbc", "colour"], spark: ["gold", "silver", "crystal"] },
  { id: "gba", n: "Game Boy Advance", year: "2001", file: "Nintendo-Game-Boy-Advance-Purple-FL.png",
    aliases: ["game boy advance", "gba", "advance"], spark: ["ruby", "sapphire", "firered"] },
  { id: "gbasp", n: "Game Boy Advance SP", year: "2003", file: "Game-Boy-Advance-SP-Mk1-Blue.png",
    aliases: ["gba sp", "advance sp", "sp", "frontlight"], spark: ["emerald", "the clamshell"] },
  { id: "gbmicro", n: "Game Boy Micro", year: "2005", file: "Game-Boy-Micro.png",
    aliases: ["game boy micro", "micro"], spark: ["tiny"] },
  { id: "pmini", n: "Pokémon Mini", year: "2001", file: "Pokemon_mini.png",
    aliases: ["pokemon mini", "pokémon mini"], spark: ["the tiny one"] },
  { id: "n64", n: "Nintendo 64", year: "1996", file: "Nintendo-64-wController-L.jpg",
    aliases: ["nintendo 64", "n64", "64"], spark: ["stadium", "snap", "transfer pak"] },
  { id: "n64pika", n: "Pikachu Nintendo 64", year: "2000", file: "Pikachu Nintendo 64 in the Science Museum 2025-08-14.jpg",
    aliases: ["pikachu n64", "pikachu nintendo 64", "orange n64"], spark: ["pikachu console"] },
  { id: "gcn", n: "GameCube", year: "2001", file: "GameCube-Console-Set.png",
    aliases: ["gamecube", "game cube", "gcn", "ngc"], spark: ["colosseum", "xd", "box"] },
  { id: "ds", n: "Nintendo DS", year: "2004", file: "Nintendo-DS-Fat-Blue.png",
    aliases: ["nintendo ds", "ds", "dual screen", "phat ds"], spark: ["diamond", "pearl"] },
  { id: "dslite", n: "Nintendo DS Lite", year: "2006", file: "Nintendo-DS-Lite-Black-Open.png",
    aliases: ["ds lite", "dslite"], spark: ["heartgold", "soulsilver"] },
  { id: "dsi", n: "Nintendo DSi", year: "2008", file: "Nintendo-DSi-Bl-Open.png",
    aliases: ["dsi", "nintendo dsi"], spark: ["black", "white"] },
  { id: "3ds", n: "Nintendo 3DS", year: "2011", file: "Nintendo-3DS-AquaOpen.png",
    aliases: ["3ds", "nintendo 3ds"], spark: ["x", "y", "or as"] },
  { id: "n3ds", n: "New Nintendo 3DS", year: "2014", file: "New_Nintendo_3DS.png",
    aliases: ["new 3ds", "new nintendo 3ds"], spark: ["sun", "moon"] },
  { id: "2ds", n: "Nintendo 2DS", year: "2013", file: "Nintendo-2DS-angle.png",
    aliases: ["2ds", "nintendo 2ds"], spark: ["the cheap one"] },
  { id: "wii", n: "Wii", year: "2006", file: "Wii-Console.png",
    aliases: ["wii", "nintendo wii"], spark: ["battle revolution", "pokepark"] },
  { id: "wiiu", n: "Wii U", year: "2012", file: "Wii_U_Console_and_Gamepad.png",
    aliases: ["wii u", "wiiu"], spark: ["pokken"] },
  { id: "nsw", n: "Nintendo Switch", year: "2017", file: "Nintendo-Switch-wJoyCons-BlRd-Standing-FL.png",
    aliases: ["switch", "nintendo switch"], spark: ["let's go", "sword", "scarlet"] },
  { id: "nswlite", n: "Nintendo Switch Lite", year: "2019", file: "NintendoSwitchLiteConsole.png",
    aliases: ["switch lite", "lite"], spark: ["handheld only"] },
  { id: "nswoled", n: "Nintendo Switch OLED", year: "2021", file: "Nintendo-Switch-OLED-Docked.png",
    aliases: ["switch oled", "oled"], spark: ["the nice screen"] },
  { id: "nsw2", n: "Nintendo Switch 2", year: "2025", file: "Nintendo Switch 2 - 54431639637.jpg",
    aliases: ["switch 2", "nintendo switch 2"], spark: ["za", "legends"] },
  { id: "pkbplus", n: "Poké Ball Plus", year: "2018", file: "Nintendo-Pokemon-Lets-Go-Poke-Ball-Plus-Controller.jpg",
    aliases: ["poke ball plus", "pokeball plus", "let's go controller"], spark: ["let's go"] },
  { id: "pwalk", n: "Pokéwalker", year: "2009", file: "Poke-Walker.jpg",
    aliases: ["pokewalker", "pokéwalker", "heartgold pedometer"], spark: ["heartgold", "soulsilver"] },
];

const CARTS = [
  { id: "red", wiki: "Pokémon Red, Blue, and Yellow", n: "Pokémon Red", year: "1996", platform: "Game Boy",
    species: ["Charizard"], aliases: ["red", "pokemon red", "red version", "red cart", "red cartridge"], kind: "box" },
  { id: "blue", wiki: "Pokémon Red, Blue, and Yellow", n: "Pokémon Blue", year: "1998", platform: "Game Boy",
    species: ["Blastoise"], aliases: ["blue", "pokemon blue", "blue version", "blue cart"], kind: "box" },
  { id: "yellow", wiki: "Pokémon Yellow", n: "Pokémon Yellow", year: "1998", platform: "Game Boy",
    species: ["Pikachu"], aliases: ["yellow", "pokemon yellow", "yellow version", "special pikachu edition"], kind: "box" },
  { id: "gold", wiki: "Pokémon Gold and Silver", n: "Pokémon Gold", year: "1999", platform: "Game Boy Color",
    species: ["Ho-Oh"], aliases: ["gold", "pokemon gold", "gold version"], kind: "box" },
  { id: "silver", wiki: "Pokémon Gold and Silver", n: "Pokémon Silver", year: "1999", platform: "Game Boy Color",
    species: ["Lugia"], aliases: ["silver", "pokemon silver", "silver version"], kind: "box" },
  { id: "crystal", wiki: "Pokémon Crystal", n: "Pokémon Crystal", year: "2000", platform: "Game Boy Color",
    species: ["Suicune"], aliases: ["crystal", "pokemon crystal"], kind: "box" },
  { id: "ruby", wiki: "Pokémon Ruby and Sapphire", n: "Pokémon Ruby", year: "2002", platform: "Game Boy Advance",
    species: ["Groudon"], aliases: ["ruby", "pokemon ruby"], kind: "box" },
  { id: "sapphire", wiki: "Pokémon Ruby and Sapphire", n: "Pokémon Sapphire", year: "2002", platform: "Game Boy Advance",
    species: ["Kyogre"], aliases: ["sapphire", "pokemon sapphire"], kind: "box" },
  { id: "emerald", wiki: "Pokémon Emerald", n: "Pokémon Emerald", year: "2004", platform: "Game Boy Advance",
    species: ["Rayquaza"], aliases: ["emerald", "pokemon emerald"], kind: "box" },
  { id: "fr", wiki: "Pokémon FireRed and LeafGreen", n: "Pokémon FireRed", year: "2004", platform: "Game Boy Advance",
    species: ["Charizard"], aliases: ["firered", "fire red", "pokemon firered"], kind: "box" },
  { id: "lg", wiki: "Pokémon FireRed and LeafGreen", n: "Pokémon LeafGreen", year: "2004", platform: "Game Boy Advance",
    species: ["Venusaur"], aliases: ["leafgreen", "leaf green"], kind: "box" },
  { id: "diamond", wiki: "Pokémon Diamond and Pearl", n: "Pokémon Diamond", year: "2006", platform: "Nintendo DS",
    species: ["Dialga"], aliases: ["diamond", "pokemon diamond"], kind: "box" },
  { id: "pearl", wiki: "Pokémon Diamond and Pearl", n: "Pokémon Pearl", year: "2006", platform: "Nintendo DS",
    species: ["Palkia"], aliases: ["pearl", "pokemon pearl"], kind: "box" },
  { id: "platinum", wiki: "Pokémon Platinum", n: "Pokémon Platinum", year: "2008", platform: "Nintendo DS",
    species: ["Giratina"], aliases: ["platinum", "pokemon platinum"], kind: "box" },
  { id: "hg", wiki: "Pokémon HeartGold and SoulSilver", n: "Pokémon HeartGold", year: "2009", platform: "Nintendo DS",
    species: ["Ho-Oh"], aliases: ["heartgold", "heart gold", "hg"], kind: "box" },
  { id: "ss", wiki: "Pokémon HeartGold and SoulSilver", n: "Pokémon SoulSilver", year: "2009", platform: "Nintendo DS",
    species: ["Lugia"], aliases: ["soulsilver", "soul silver", "ss"], kind: "box" },
  { id: "black", wiki: "Pokémon Black and White", n: "Pokémon Black", year: "2010", platform: "Nintendo DS",
    species: ["Reshiram", "Zekrom"], aliases: ["black", "pokemon black", "black version"], kind: "box" },
  { id: "white", wiki: "Pokémon Black and White", n: "Pokémon White", year: "2010", platform: "Nintendo DS",
    species: ["Zekrom", "Reshiram"], aliases: ["white", "pokemon white", "white version"], kind: "box" },
  { id: "xy", wiki: "Pokémon X and Y", n: "Pokémon X and Y", year: "2013", platform: "Nintendo 3DS",
    species: ["Xerneas", "Yveltal"], aliases: ["x and y", "pokemon x", "pokemon y", "xy"], kind: "box" },
  { id: "oras", wiki: "Pokémon Omega Ruby and Alpha Sapphire", n: "Omega Ruby / Alpha Sapphire", year: "2014", platform: "Nintendo 3DS",
    species: ["Groudon", "Kyogre"], aliases: ["oras", "omega ruby", "alpha sapphire"], kind: "box" },
  { id: "sm", wiki: "Pokémon Sun and Moon", n: "Pokémon Sun and Moon", year: "2016", platform: "Nintendo 3DS",
    species: ["Solgaleo", "Lunala"], aliases: ["sun and moon", "pokemon sun", "pokemon moon"], kind: "box" },
  { id: "lgpe", wiki: "Pokémon: Let's Go, Pikachu! and Let's Go, Eevee!", n: "Let's Go, Pikachu! / Eevee!", year: "2018", platform: "Nintendo Switch",
    species: ["Pikachu", "Eevee"], aliases: ["let's go", "lets go", "let's go pikachu", "let's go eevee"], kind: "box" },
  { id: "swsh", wiki: "Pokémon Sword and Shield", n: "Pokémon Sword and Shield", year: "2019", platform: "Nintendo Switch",
    species: ["Zacian", "Zamazenta"], aliases: ["sword and shield", "swsh", "sword", "shield"], kind: "box" },
  { id: "bdsp", wiki: "Pokémon Brilliant Diamond and Shining Pearl", n: "Brilliant Diamond / Shining Pearl", year: "2021", platform: "Nintendo Switch",
    species: ["Dialga", "Palkia"], aliases: ["bdsp", "brilliant diamond", "shining pearl"], kind: "box" },
  { id: "pla", wiki: "Pokémon Legends: Arceus", n: "Pokémon Legends: Arceus", year: "2022", platform: "Nintendo Switch",
    species: ["Arceus"], aliases: ["legends arceus", "arceus", "pla"], kind: "box" },
  { id: "sv", wiki: "Pokémon Scarlet and Violet", n: "Pokémon Scarlet and Violet", year: "2022", platform: "Nintendo Switch",
    species: ["Koraidon", "Miraidon"], aliases: ["scarlet and violet", "scarlet", "violet", "sv"], kind: "box" },
  { id: "stad", wiki: "Pokémon Stadium", n: "Pokémon Stadium", year: "1999", platform: "Nintendo 64",
    species: ["Charizard", "Blastoise"], aliases: ["stadium", "pokemon stadium", "n64 stadium"], kind: "disc" },
  { id: "stad2", wiki: "Pokémon Stadium 2", n: "Pokémon Stadium 2", year: "2000", platform: "Nintendo 64",
    species: ["Lugia", "Ho-Oh"], aliases: ["stadium 2", "pokemon stadium 2"], kind: "disc" },
  { id: "colo", wiki: "Pokémon Colosseum", n: "Pokémon Colosseum", year: "2003", platform: "GameCube",
    species: ["Umbreon", "Espeon"], aliases: ["colosseum", "pokemon colosseum"], kind: "disc" },
  { id: "xd", wiki: "Pokémon XD: Gale of Darkness", n: "Pokémon XD: Gale of Darkness", year: "2005", platform: "GameCube",
    species: ["Shadow Lugia"], aliases: ["xd", "gale of darkness", "shadow lugia"], kind: "disc" },
  { id: "snap", wiki: "Pokémon Snap", n: "Pokémon Snap", year: "1999", platform: "Nintendo 64",
    species: ["Pikachu"], aliases: ["snap", "pokemon snap", "n64 snap"], kind: "disc" },
  { id: "nsnap", wiki: "New Pokémon Snap", n: "New Pokémon Snap", year: "2021", platform: "Nintendo Switch",
    species: ["Pikachu"], aliases: ["new snap", "new pokemon snap"], kind: "box" },
  { id: "pbr", wiki: "Pokémon Battle Revolution", n: "Pokémon Battle Revolution", year: "2006", platform: "Wii",
    species: ["Pikachu"], aliases: ["battle revolution", "pbr"], kind: "disc" },
];

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  const text = await r.text();
  try { return JSON.parse(text); } catch {
    throw new Error("not json " + r.status + " " + text.slice(0, 60));
  }
}

async function fileUrl(file) {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime&titles=" + encodeURIComponent("File:" + file);
  let j = await getJson(url);
  let p = Object.values((j.query && j.query.pages) || {})[0];
  if (!p || p.missing || !p.imageinfo) {
    const en = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime&titles=" + encodeURIComponent("File:" + file);
    j = await getJson(en);
    p = Object.values((j.query && j.query.pages) || {})[0];
  }
  const info = p && p.imageinfo && p.imageinfo[0];
  if (!info || !info.url) return null;
  if (!/^image\//.test(info.mime || "")) return null;
  if (/\.svg$/i.test(file) || /svg/.test(info.mime || "")) return null;
  if ((info.size || 0) < 12000) return null;
  if ((info.width || 0) < 200) return null;
  return { url: String(info.url).replace(/\?.*$/, ""), width: info.width, height: info.height, size: info.size };
}

async function infoboxFile(wiki) {
  const url = "https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&section=0&redirects=1&page=" + encodeURIComponent(wiki);
  const j = await getJson(url);
  const t = j.parse && j.parse.wikitext && j.parse.wikitext["*"];
  if (!t) return null;
  const m = t.match(/\|\s*image\s*=\s*([^\n]+)/i);
  if (!m) return null;
  let file = m[1].trim().replace(/^\[\[/, "").replace(/\]\].*$/, "").replace(/^File:/i, "").trim();
  file = file.replace(/<!--.*-->/g, "").trim();
  if (!file || /\.svg$/i.test(file) || /logo/i.test(file)) return null;
  return file;
}

const consoles = [];
const carts = [];

for (const c of CONSOLES) {
  try {
    const img = await fileUrl(c.file);
    await sleep(220);
    if (!img) { console.log("NO console " + c.id); continue; }
    consoles.push({
      id: "hw-" + c.id, n: c.n, year: c.year, kind: "console", img: img.url,
      w: img.width, aliases: c.aliases, spark: c.spark, platform: c.n,
    });
    console.log("OK console " + c.id + " " + img.width + "x" + img.height);
  } catch (e) { console.log("ERR console " + c.id + " " + e.message); }
}

const wikiCache = {};
for (const g of CARTS) {
  try {
    let file = wikiCache[g.wiki];
    if (file === undefined) {
      file = await infoboxFile(g.wiki);
      wikiCache[g.wiki] = file || null;
      await sleep(280);
    }
    const img = file ? await fileUrl(file) : null;
    await sleep(220);
    if (!img) { console.log("NO cart " + g.id); continue; }
    carts.push({
      id: "cart-" + g.id, n: g.n, year: g.year, kind: g.kind, img: img.url,
      w: img.width, aliases: g.aliases, species: g.species, platform: g.platform,
    });
    console.log("OK cart " + g.id + " " + g.kind + " " + img.width);
  } catch (e) { console.log("ERR cart " + g.id + " " + e.message); }
}

const store = {
  note: "Consoles from Commons hardware photos. Cartridges are the retail object (Wikipedia infobox). kind is console|box|disc|cart. No logos.",
  ingestedAt: new Date().toISOString(),
  consoles, carts,
};
await writeFile(join(ROOT, "data/hardware-catalogue.json"), JSON.stringify(store, null, 2));

function row(x, extra) {
  return [x.id, x.n, x.platform || x.n, x.year, x.img, x.kind,
    (x.aliases || []).join("|"), (x.species || x.spark || []).join("|")];
}
await writeFile(join(ROOT, "research/assets/console-rows.json"), JSON.stringify(consoles.map(row)));
await writeFile(join(ROOT, "research/assets/cart-rows.json"), JSON.stringify(carts.map(row)));
console.log("consoles " + consoles.length + "/" + CONSOLES.length + " carts " + carts.length + "/" + CARTS.length);
if (consoles.length < 12 || carts.length < 15) {
  console.error("too few hardware rows");
  process.exit(1);
}
