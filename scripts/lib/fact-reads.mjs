// Non-price feed lines. Counts come from catalogue fields. A pull line ships
// only when the rate and the pack price are both already in the cited files.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FORM = /^(Galarian|Alolan|Hisuian|Paldean|Dark|Light|Shining|Radiant|Team Aqua's|Team Magma's|Team Rocket's|Rocket's|Misty's|Brock's|Erika's|Sabrina's|Blaine's|Koga's|Giovanni's|Lillie's|N's|Marnie's|Ethan's|Cynthia's|Steven's|Iono's|Arven's|Hop's|Bea's|Crystal|Shadow|Mega)\s+/i;
const MECH = /\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV\.X|-EX|-GX)$/;
const NOT_A_MON = /^(Energy|Pokémon|Pokemon|Trainer|Item|Supporter|Stadium|Tool|Professor|Team|Tapu|Iron|Great|Roaring|Slither|Scream|Brute|Flutter|Sandy|Walking|Gouging|Raging)$/i;

export function speciesToken(name) {
  let text = String(name || "").replace(/\s*\([^)]*\)/g, " ").replace(/\s+-\s+\S+$/, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i += 1) text = text.replace(FORM, "");
  text = text.replace(MECH, "").trim();
  const token = text.split(" ")[0] || "";
  if (!token || NOT_A_MON.test(token)) return "";
  return token;
}

function hasNumber(text, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const forms = new Set([String(n)]);
  if (Number.isInteger(n)) forms.add(String(n));
  else forms.add(n.toFixed(2));
  const raw = String(text || "");
  for (const form of forms) {
    const escaped = form.replace(".", "\\.");
    if (new RegExp(`(^|[^0-9.])${escaped}([^0-9.]|$)`).test(raw)) return true;
  }
  return false;
}

// oneIn is the already-stored "1 in N" pack count. cost = pack price / (1/N).
export function pullCostLine({ setName, tier, oneIn, packPrice, rateText, priceText, rateFile, priceFile }) {
  const packs = Number(oneIn);
  const price = Number(packPrice);
  const tierName = tier === "SIR" ? "special illustration rare" : tier === "IR" ? "illustration rare" : "";
  if (!setName || !tierName || !Number.isInteger(packs) || packs < 2 || !(price > 0)) return null;
  if (!rateFile || !priceFile) return null;
  if (!/pull/i.test(String(rateText || ""))) return null;
  if (!hasNumber(rateText, packs) || !hasNumber(priceText, price)) return null;
  const cost = Math.round(packs * price * 100) / 100;
  const money = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sentence = `${setName} ${tierName} cards show up about 1 in ${packs} packs at ${money(price)} a pack, so the pull cost is ${money(cost)}.`;
  const slug = String(setName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `pull-${slug}-${tier.toLowerCase()}`,
    sku: `pull-${slug}-${tier.toLowerCase()}`,
    readKind: "pull",
    kind: "pull",
    name: setName,
    set: setName,
    tier,
    oneIn: packs,
    packPrice: price,
    cost,
    path: sentence,
    headline: sentence,
    why: `Pull rate is in ${rateFile}. Pack price is in ${priceFile}.`,
    sources: { rate: rateFile, packPrice: priceFile },
  };
}

export function buildPokemonIndex(cards, attrs) {
  const byDex = new Map();
  for (const [id, card] of Object.entries(cards || {})) {
    const dex = Number(attrs?.[id]?.dex);
    if (!Number.isInteger(dex) || dex <= 0) continue;
    const token = speciesToken(card?.name);
    if (!token) continue;
    if (!byDex.has(dex)) byDex.set(dex, []);
    byDex.get(dex).push({ token, artist: String(card?.artist || "").trim() });
  }
  const named = new Map();
  for (const [dex, rows] of byDex) {
    const counts = new Map();
    for (const row of rows) counts.set(row.token, (counts.get(row.token) || 0) + 1);
    let token = "";
    let best = -1;
    for (const [name, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (n > best) {
        best = n;
        token = name;
      }
    }
    const artists = new Set(rows.map((row) => row.artist).filter(Boolean));
    if (!token || rows.length < 1 || artists.size < 1) continue;
    const entry = { name: token, dex, cardCount: rows.length, artistCount: artists.size };
    if (!named.has(token)) named.set(token, []);
    named.get(token).push(entry);
  }
  const index = new Map();
  for (const [token, entries] of named) {
    if (entries.length === 1) index.set(token, entries[0]);
  }
  return index;
}

export async function loadPokemonIndex(root) {
  const catalogue = JSON.parse(await readFile(join(root, "data/card-catalogue.json"), "utf8"));
  const attrs = JSON.parse(await readFile(join(root, "data/card-attrs.json"), "utf8"));
  return buildPokemonIndex(catalogue.cards || {}, attrs.cards || {});
}

export function pokemonFactLine(entry) {
  if (!entry) return null;
  const cardCount = Number(entry.cardCount);
  const artistCount = Number(entry.artistCount);
  const dex = Number(entry.dex);
  const name = String(entry.name || "");
  if (!name || !Number.isInteger(cardCount) || !Number.isInteger(artistCount) || !Number.isInteger(dex)) return null;
  if (cardCount < 1 || artistCount < 1 || dex < 1) return null;
  const sentence = `${name} has ${cardCount} cards in the catalog, drawn by ${artistCount} artists, and the national dex number on those cards is ${dex}.`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    id: `pokemon-${slug}`,
    sku: `pokemon-${slug}`,
    readKind: "pokemon",
    kind: "pokemon",
    name,
    set: "",
    path: sentence,
    headline: sentence,
    why: `Card count is cards in data/card-catalogue.json whose data/card-attrs.json dex is ${dex}. Artist count is the distinct artist field on those cards. No pronunciation field is on file.`,
    cardCount,
    artistCount,
    dex,
    sources: {
      cardCount: "data/card-catalogue.json",
      artistCount: "data/card-catalogue.json",
      dex: "data/card-attrs.json",
    },
  };
}

export function interleavePokemonFacts(priceRows, index) {
  const used = new Set();
  const out = [];
  for (const row of priceRows || []) {
    out.push({ ...row, readKind: "price" });
    const token = speciesToken(row?.name);
    const entry = token && index?.get?.(token);
    if (!entry || used.has(entry.dex)) continue;
    const line = pokemonFactLine(entry);
    if (!line) continue;
    used.add(entry.dex);
    out.push(line);
  }
  return out;
}
