// Artist and generation tags for singles.
// Artist is copied from the public set item. This file does not match on name.
// Generation is the series that set already belongs to, numbered only when
// that series is one game generation. Mega Evolution is not numbered.
// A promo set with no series name is not numbered. Sealed is never tagged.
import { eraOf, slug } from "./public-bundle.mjs";

const NUMBERED_ERA = {
  "Scarlet & Violet": "9",
  "Sword & Shield": "8",
  "Sun & Moon": "7",
  XY: "6",
  "Black & White": "5",
  "HeartGold & SoulSilver": "4",
  "Diamond & Pearl": "4",
  EX: "3",
  Neo: "2",
};

export function cleanArtist(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 80) return "";
  if (/^unknown$/i.test(text)) return "";
  return text;
}

// Number, or "" when this set is not one numbered generation.
export function generationOfSet(name) {
  const raw = String(name ?? "");
  const bare = raw.toLowerCase().replace(/\s+/g, " ").trim();
  // e-Card sets are filed as Original. They are generation 2.
  if (/^(expedition|aquapolis|skyridge)\b/.test(bare) || /\be-reader\b/.test(bare)) return "2";
  // POP Series is filed with promos. It is generation 3.
  if (/^pop series\b/.test(bare)) return "3";
  // Legendary Collection reprints generation 1. The era label is Original.
  if (/^legendary collection\b/.test(bare)) return "1";
  const era = eraOf(raw);
  if (NUMBERED_ERA[era]) return NUMBERED_ERA[era];
  if (era === "Original" && /base set|jungle|fossil|team rocket|gym heroes|gym challenge/.test(bare)) return "1";
  return "";
}

export function unnumberedReason(name) {
  if (generationOfSet(name)) return "";
  const era = eraOf(name);
  if (era === "Mega Evolution") return "megaEvolution";
  if (era === "Promos and extras") return "promosAndExtras";
  if (era === "Original") return "originalUnnumbered";
  return "other";
}

// Null when the row is sealed, or a single with neither credit nor generation.
export function tagSingle({ id, kind, setName, artist } = {}) {
  if (kind !== "single") return null;
  if (!/^tcgcsv-\d+$/.test(String(id || ""))) return null;
  const generation = generationOfSet(setName);
  const credit = cleanArtist(artist);
  if (!credit && !generation) return null;
  const row = {};
  if (credit) {
    row.artist = credit;
    row.artistSlug = slug(credit);
  }
  if (generation) row.generation = generation;
  return row;
}

export function pct(part, whole) {
  const a = Number(part);
  const b = Number(whole);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.round((a / b) * 1000) / 10;
}

export function summarize({ singles, sealedSeen = 0, rows, reasons }) {
  let artist = 0;
  let generation = 0;
  let both = 0;
  for (const row of rows) {
    const hasArtist = !!row.artist;
    const hasGeneration = !!row.generation;
    if (hasArtist) artist += 1;
    if (hasGeneration) generation += 1;
    if (hasArtist && hasGeneration) both += 1;
  }
  return {
    singles,
    artist,
    generation,
    both,
    artistPct: pct(artist, singles),
    generationPct: pct(generation, singles),
    sealedSeen,
    sealedTagged: 0,
    unnumbered: {
      megaEvolution: reasons.megaEvolution || 0,
      promosAndExtras: reasons.promosAndExtras || 0,
      originalUnnumbered: reasons.originalUnnumbered || 0,
      other: reasons.other || 0,
    },
  };
}
