// ingest-movies.mjs — theatrical posters + searchable iconic scenes.
// Posters: Wikipedia infobox File: (the actual one-sheet). Not Serebii 5KB
// thumbs. Not logos. HTTP 200 is not enough — mime image, size floor.
// Scenes are NAMES on the film row so "mewtwo is born" finds the poster.
// We do not invent stills we cannot fetch.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "CatchEmCatalogue/1.0 (https://catchemtcg.com; Pokémon movie poster metadata)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FILMS = [
  {
    id: "m01", wiki: "Pokémon the First Movie",
    n: "Mewtwo Strikes Back", title: "Pokémon: The First Movie", year: "1998",
    species: ["Mewtwo", "Mew", "Pikachu", "Charizard"],
    aliases: ["the first movie", "mewtwo movie", "mewtwo strikes back", "movie 1", "m01", "pokemon the first movie"],
    scenes: ["mewtwo is born", "the clone", "mew versus mewtwo", "i never asked to be created", "cloning"]
  },
  {
    id: "m02", wiki: "Pokémon: The Movie 2000",
    n: "The Power of One", title: "Pokémon the Movie 2000", year: "1999",
    species: ["Lugia", "Articuno", "Zapdos", "Moltres", "Pikachu"],
    aliases: ["the power of one", "lugia movie", "movie 2000", "movie 2", "the birds movie", "three legendary birds"],
    scenes: ["lugia from the sea", "the storm", "collector", "slowking", "the prophecy"]
  },
  {
    id: "m03", wiki: "Pokémon 3: The Movie",
    n: "Spell of the Unown", title: "Pokémon 3: The Movie", year: "2000",
    species: ["Entei", "Unown", "Pikachu"],
    aliases: ["spell of the unown", "entei movie", "pokemon 3", "crystal tower", "movie 3"],
    scenes: ["crystal tower", "molly", "the unown", "real entei"]
  },
  {
    id: "m04", wiki: "Pokémon 4Ever",
    n: "Celebi — Voice of the Forest", title: "Pokémon 4Ever", year: "2001",
    species: ["Celebi", "Suicune", "Pikachu"],
    aliases: ["pokemon 4ever", "celebi movie", "voice of the forest", "movie 4", "celebi"],
    scenes: ["the forest", "sammy", "time travel", "celebi is captured"]
  },
  {
    id: "m05", wiki: "Pokémon Heroes",
    n: "Latios and Latias", title: "Pokémon Heroes", year: "2002",
    species: ["Latios", "Latias", "Pikachu"],
    aliases: ["pokemon heroes", "latias latios", "alto mare", "movie 5", "the eon movie"],
    scenes: ["alto mare", "soul dew", "latias in disguise", "the canal"]
  },
  {
    id: "m06", wiki: "Pokémon: Jirachi Wish Maker",
    n: "Jirachi: Wish Maker", title: "Jirachi: Wish Maker", year: "2003",
    species: ["Jirachi", "Groudon", "Pikachu"],
    aliases: ["jirachi wish maker", "jirachi movie", "movie 6", "millennium comet"],
    scenes: ["millennium comet", "the wish", "seven nights"]
  },
  {
    id: "m07", wiki: "Pokémon: Destiny Deoxys",
    n: "Destiny Deoxys", title: "Destiny Deoxys", year: "2004",
    species: ["Deoxys", "Rayquaza", "Pikachu"],
    aliases: ["destiny deoxys", "deoxys movie", "movie 7", "rayquaza vs deoxys"],
    scenes: ["the aurora", "sky battle", "rayquaza versus deoxys"]
  },
  {
    id: "m08", wiki: "Pokémon: Lucario and the Mystery of Mew",
    n: "Lucario and the Mystery of Mew", title: "Lucario and the Mystery of Mew", year: "2005",
    species: ["Lucario", "Mew", "Pikachu"],
    aliases: ["lucario movie", "mystery of mew", "movie 8", "aura movie"],
    scenes: ["the aura", "tree of beginning", "sir aaron"]
  },
  {
    id: "m09", wiki: "Pokémon Ranger and the Temple of the Sea",
    n: "Temple of the Sea", title: "Pokémon Ranger and the Temple of the Sea", year: "2006",
    species: ["Manaphy", "Kyogre", "Pikachu"],
    aliases: ["temple of the sea", "manaphy movie", "pokemon ranger movie", "movie 9"],
    scenes: ["the sea temple", "prince of the sea", "the egg"]
  },
  {
    id: "m10", wiki: "Pokémon: The Rise of Darkrai",
    n: "The Rise of Darkrai", title: "The Rise of Darkrai", year: "2007",
    species: ["Darkrai", "Dialga", "Palkia", "Pikachu"],
    aliases: ["rise of darkrai", "darkrai movie", "movie 10", "dialga vs palkia"],
    scenes: ["alaramos", "the garden", "darkrai is not the villain"]
  },
  {
    id: "m11", wiki: "Pokémon: Giratina & the Sky Warrior",
    n: "Giratina and the Sky Warrior", title: "Giratina & the Sky Warrior", year: "2008",
    species: ["Giratina", "Shaymin", "Pikachu"],
    aliases: ["giratina movie", "sky warrior", "shaymin movie", "movie 11", "reverse world"],
    scenes: ["reverse world", "shaymin sky forme", "the frozen sky"]
  },
  {
    id: "m12", wiki: "Pokémon: Arceus and the Jewel of Life",
    n: "Arceus and the Jewel of Life", title: "Arceus and the Jewel of Life", year: "2009",
    species: ["Arceus", "Pikachu"],
    aliases: ["arceus movie", "jewel of life", "movie 12"],
    scenes: ["judgment", "the jewel of life", "michina"]
  },
  {
    id: "m13", wiki: "Pokémon: Zoroark: Master of Illusions",
    n: "Zoroark: Master of Illusions", title: "Zoroark: Master of Illusions", year: "2010",
    species: ["Zoroark", "Zorua", "Celebi", "Pikachu"],
    aliases: ["zoroark movie", "master of illusions", "movie 13", "zorua movie"],
    scenes: ["the illusions", "crown city", "zoroark protects zorua"]
  },
  {
    id: "m14", wiki: "Pokémon the Movie: Black—Victini and Reshiram",
    n: "Victini and Zekrom / Reshiram", title: "Black & White — Victini", year: "2011",
    species: ["Victini", "Zekrom", "Reshiram", "Pikachu"],
    aliases: ["victini movie", "victini and zekrom", "victini and reshiram", "black and white movie", "movie 14"],
    scenes: ["the sword of the vale", "victini", "reshiram", "zekrom"]
  },
  {
    id: "m15", wiki: "Pokémon the Movie: Kyurem vs. the Sword of Justice",
    n: "Kyurem vs. the Sword of Justice", title: "Kyurem vs. the Sword of Justice", year: "2012",
    species: ["Kyurem", "Keldeo", "Cobalion", "Terrakion", "Virizion", "Pikachu"],
    aliases: ["kyurem movie", "keldeo movie", "sword of justice", "movie 15"],
    scenes: ["the swords of justice", "keldeo's horn", "kyurem"]
  },
  {
    id: "m16", wiki: "Pokémon the Movie: Genesect and the Legend Awakened",
    n: "Genesect and the Legend Awakened", title: "Genesect and the Legend Awakened", year: "2013",
    species: ["Genesect", "Mewtwo", "Pikachu"],
    aliases: ["genesect movie", "legend awakened", "movie 16", "mewtwo awakens"],
    scenes: ["mewtwo awakens", "the genesect army"]
  },
  {
    id: "m17", wiki: "Pokémon the Movie: Diancie and the Cocoon of Destruction",
    n: "Diancie and the Cocoon of Destruction", title: "Diancie and the Cocoon of Destruction", year: "2014",
    species: ["Diancie", "Xerneas", "Yveltal", "Pikachu"],
    aliases: ["diancie movie", "cocoon of destruction", "movie 17"],
    scenes: ["the cocoon", "mega diancie"]
  },
  {
    id: "m18", wiki: "Pokémon the Movie: Hoopa and the Clash of Ages",
    n: "Hoopa and the Clash of Ages", title: "Hoopa and the Clash of Ages", year: "2015",
    species: ["Hoopa", "Pikachu"],
    aliases: ["hoopa movie", "clash of ages", "movie 18", "hoopa unbound"],
    scenes: ["hoopa unbound", "the bottle"]
  },
  {
    id: "m19", wiki: "Pokémon the Movie: Volcanion and the Mechanical Marvel",
    n: "Volcanion and the Mechanical Marvel", title: "Volcanion and the Mechanical Marvel", year: "2016",
    species: ["Volcanion", "Magearna", "Pikachu"],
    aliases: ["volcanion movie", "magearna movie", "mechanical marvel", "movie 19"],
    scenes: ["magearna's heart", "the furnace"]
  },
  {
    id: "m20", wiki: "Pokémon the Movie: I Choose You!",
    n: "I Choose You!", title: "Pokémon the Movie: I Choose You!", year: "2017",
    species: ["Ho-Oh", "Marshadow", "Pikachu", "Charmander"],
    aliases: ["i choose you", "i choosed you", "movie 20", "ho-oh movie", "marshadow movie"],
    scenes: ["i choose you", "ho-oh", "charmander in the rain", "the first partner"]
  },
  {
    id: "m21", wiki: "Pokémon the Movie: The Power of Us",
    n: "The Power of Us", title: "Pokémon the Movie: The Power of Us", year: "2018",
    species: ["Lugia", "Zeraora", "Pikachu"],
    aliases: ["the power of us", "zeraora movie", "everyone's story", "movie 21"],
    scenes: ["zeraora", "the wind festival", "lugia returns"]
  },
  {
    id: "m22", wiki: "Pokémon: Mewtwo Strikes Back — Evolution",
    n: "Mewtwo Strikes Back — Evolution", title: "Mewtwo Strikes Back — Evolution", year: "2019",
    species: ["Mewtwo", "Mew", "Pikachu"],
    aliases: ["mewtwo evolution", "strikes back evolution", "movie 22", "cgi mewtwo"],
    scenes: ["mewtwo is born", "the clone", "mew versus mewtwo"]
  },
  {
    id: "m23", wiki: "Pokémon the Movie: Secrets of the Jungle",
    n: "Secrets of the Jungle", title: "Pokémon the Movie: Secrets of the Jungle", year: "2020",
    species: ["Zarude", "Celebi", "Pikachu"],
    aliases: ["secrets of the jungle", "zarude movie", "koko", "movie 23"],
    scenes: ["the jungle", "koko", "zarude raises a child"]
  },
  {
    id: "mdp", wiki: "Detective Pikachu (film)",
    n: "Detective Pikachu", title: "Pokémon Detective Pikachu", year: "2019",
    species: ["Pikachu", "Mewtwo", "Mr. Mime", "Psyduck", "Charizard"],
    aliases: ["detective pikachu", "live action pikachu", "ryan reynolds pikachu", "detective pikachu movie"],
    scenes: ["ryan reynolds pikachu", "live action", "mr mime", "mewtwo reveal"]
  },
];

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  const text = await r.text();
  try { return JSON.parse(text); } catch (e) {
    throw new Error("not json " + r.status + " " + text.slice(0, 80));
  }
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

async function fileUrl(file) {
  const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|mime&titles=" + encodeURIComponent("File:" + file);
  const j = await getJson(url);
  const p = Object.values((j.query && j.query.pages) || {})[0];
  const info = p && p.imageinfo && p.imageinfo[0];
  if (!info || !info.url) return null;
  if (!/^image\//.test(info.mime || "")) return null;
  if ((info.size || 0) < 12000) return null;
  if ((info.width || 0) < 200) return null;
  return { url: String(info.url).replace(/\?.*$/, ""), width: info.width, height: info.height, size: info.size, mime: info.mime };
}

const films = [];
const rows = [];
for (const f of FILMS) {
  try {
    const file = await infoboxFile(f.wiki);
    await sleep(280);
    const img = file ? await fileUrl(file) : null;
    await sleep(280);
    if (!img) {
      console.log("NO " + f.id + " " + f.n + " no poster");
      continue;
    }
    const rec = {
      id: "mov-" + f.id + "-poster",
      n: f.n,
      title: f.title,
      year: f.year,
      kind: "poster",
      species: f.species,
      aliases: f.aliases,
      scenes: f.scenes,
      wiki: f.wiki,
      img: img ? img.url : "",
      w: img ? img.width : 0,
      bytes: img ? img.size : 0,
    };
    films.push(rec);
    rows.push([
      rec.id, rec.n, rec.title, rec.year, rec.img,
      rec.species.join("|"), rec.aliases.join("|"), rec.scenes.join("|"),
    ]);
    console.log((img ? "OK " : "NO ") + f.id + " " + f.n + (img ? " " + img.width + "x" + img.height : " no poster"));
  } catch (e) {
    console.log("ERR " + f.id + " " + e.message);
  }
}

const ok = films.filter(x => x.img);
const store = {
  note: "Pokémon movie theatrical posters from Wikipedia infobox File:. Scene names are search keys, not extra images. No stills we could not fetch. Not paper. Not Pocket.",
  ingestedAt: new Date().toISOString(),
  source: "https://en.wikipedia.org/w/api.php",
  films,
};
await writeFile(join(ROOT, "data/movie-catalogue.json"), JSON.stringify(store, null, 2));
await writeFile(join(ROOT, "research/assets/movie-rows.json"), JSON.stringify(rows));
console.log("posters with art: " + ok.length + "/" + FILMS.length);
if (ok.length < 15) {
  console.error("too few posters");
  process.exit(1);
}
