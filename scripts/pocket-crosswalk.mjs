// pocket-crosswalk.mjs — paper TCG vs Pocket, same Pokémon, two games.
//
// Does not merge catalogues. Does not invent a price. A twin is a name match
// after stripping form prefixes and (ex/V/GX) suffixes. Artist match is extra.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT, p), "utf8"));

const FORM = /^(Team Rocket's |Galarian |Alolan |Hisuian |Paldean |Mega |Dark |Light |Shining |Radiant |Bloodmoon )/i;
const MECH = /\s+(ex|EX|GX|V|VMAX|VSTAR|V-UNION|BREAK)$/i;
const base = n => String(n || "").replace(FORM, "").replace(MECH, "").replace(/-ex$/i, "").trim();
const RANK = ["Crown", "Three Star", "Two Shiny", "Two Star", "One Shiny", "One Star", "Four Diamond"];
const rank = r => { const i = RANK.indexOf(r || ""); return i < 0 ? 99 : i; };

const paper = (await J("data/card-catalogue.json")).cards;
const pocket = (await J("data/pocket-catalogue.json")).cards;

const pBy = {}, kBy = {};
for (const [id, c] of Object.entries(paper)) {
  const b = base(c.name); if (!b) continue;
  (pBy[b] = pBy[b] || []).push({ id, a: c.artist, s: c.setName, y: (c.releaseDate || "").slice(0, 4), r: c.rarity, n: c.name });
}
for (const [id, c] of Object.entries(pocket)) {
  const b = base(c.name); if (!b) continue;
  (kBy[b] = kBy[b] || []).push({ id, a: c.artist, s: c.setName, y: (c.releaseDate || "").slice(0, 4), r: c.rarity, n: c.name });
}
const pa = new Set(Object.values(paper).map(c => c.artist).filter(Boolean));
const ka = new Set(Object.values(pocket).map(c => c.artist).filter(Boolean));

const twins = {};
for (const b of Object.keys(pBy).sort()) {
  if (!kBy[b]) continue;
  const show = kBy[b].slice().sort((a, c) => rank(a.r) - rank(c.r));
  const sharedA = [...new Set(pBy[b].map(x => x.a).filter(a => a && kBy[b].some(y => y.a === a)))];
  twins[b] = {
    paper: pBy[b].length,
    pocket: kBy[b].length,
    artists: sharedA,
    pocketBest: show.slice(0, 3).map(x => x.id),
  };
}

const out = {
  note: "Same Pokémon in paper TCG and Pocket. Name match after form/ex strip. Not a price. Pocket catalogue still lags Limitless.",
  builtAt: new Date().toISOString(),
  paperCards: Object.keys(paper).length,
  pocketCards: Object.keys(pocket).length,
  paperBases: Object.keys(pBy).length,
  pocketBases: Object.keys(kBy).length,
  sharedBases: Object.keys(twins).length,
  paperArtists: pa.size,
  pocketArtists: ka.size,
  sharedArtists: [...pa].filter(a => ka.has(a)).length,
  twins,
};
await writeFile(join(ROOT, "data/pocket-crosswalk.json"), JSON.stringify(out));
console.log("✓ crosswalk: " + out.sharedBases + " shared Pokémon · " +
  out.sharedArtists + " shared illustrators · paper " + out.paperCards +
  " / pocket " + out.pocketCards);
