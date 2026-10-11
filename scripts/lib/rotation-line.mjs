// Rotation line. The sentence is its own field. It is never a headline.
// The line is attached only when the read already qualified and the set's
// mark is F or G on the site list.
//
// Source: catchem-site/src/rotation.mjs SET_MARKS (card-attrs note 2026-08-24).
// That list is newer than data/set-marks.json (generatedAt 2026-08-18).
// The data file is read only to report a disagreement. It does not add a set.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROTATION_LINE = "Rotated sets historically stop getting new print runs. What's already out there is the supply.";
export const SITE_ASOF = "2026-08-24";

// The site's 11. Mark is the letter on catchem-site. ids are data/set-logos keys.
export const SITE_FG = [
  { slug: "pokemon-go", mark: "F", ids: ["pgo"], names: ["Pokémon GO", "Pokemon GO"] },
  { slug: "swsh09-brilliant-stars", mark: "F", ids: ["swsh9"], names: ["Brilliant Stars", "SWSH09: Brilliant Stars"] },
  { slug: "swsh10-astral-radiance", mark: "F", ids: ["swsh10"], names: ["Astral Radiance", "SWSH10: Astral Radiance"] },
  { slug: "swsh11-lost-origin", mark: "F", ids: ["swsh11"], names: ["Lost Origin", "SWSH11: Lost Origin"] },
  { slug: "swsh12-silver-tempest", mark: "F", ids: ["swsh12"], names: ["Silver Tempest", "SWSH12: Silver Tempest"] },
  { slug: "sv-paldean-fates", mark: "G", ids: ["sv4pt5"], names: ["Paldean Fates", "SV: Paldean Fates"] },
  { slug: "sv-scarlet-and-violet-151", mark: "G", ids: ["sv3pt5"], names: ["Scarlet & Violet 151", "SV: Scarlet & Violet 151", "151"] },
  { slug: "sv01-scarlet-and-violet-base-set", mark: "G", ids: ["sv1"], names: ["Scarlet & Violet", "Scarlet & Violet Base Set", "SV01: Scarlet & Violet Base Set"] },
  { slug: "sv02-paldea-evolved", mark: "G", ids: ["sv2"], names: ["Paldea Evolved", "SV02: Paldea Evolved"] },
  { slug: "sv03-obsidian-flames", mark: "G", ids: ["sv3"], names: ["Obsidian Flames", "SV03: Obsidian Flames"] },
  { slug: "sv04-paradox-rift", mark: "G", ids: ["sv4"], names: ["Paradox Rift", "SV04: Paradox Rift"] },
];

// Site letters that are not F or G, kept so a data F/G can disagree.
const SITE_OTHER = {
  "sv07-stellar-crown": "H",
};

// Every data id whose file mark is F or G, plus the name in data/set-logos.json.
const DATA_LINKS = [
  { id: "pgo", slug: "pokemon-go", name: "Pokémon GO" },
  { id: "swsh9", slug: "swsh09-brilliant-stars", name: "Brilliant Stars" },
  { id: "swsh10", slug: "swsh10-astral-radiance", name: "Astral Radiance" },
  { id: "swsh11", slug: "swsh11-lost-origin", name: "Lost Origin" },
  { id: "swsh12", slug: "swsh12-silver-tempest", name: "Silver Tempest" },
  { id: "swsh12pt5", slug: null, name: "Crown Zenith" },
  { id: "sv1", slug: "sv01-scarlet-and-violet-base-set", name: "Scarlet & Violet" },
  { id: "sv2", slug: "sv02-paldea-evolved", name: "Paldea Evolved" },
  { id: "sv3", slug: "sv03-obsidian-flames", name: "Obsidian Flames" },
  { id: "sv3pt5", slug: "sv-scarlet-and-violet-151", name: "151" },
  { id: "sv4", slug: "sv04-paradox-rift", name: "Paradox Rift" },
  { id: "sv4pt5", slug: "sv-paldean-fates", name: "Paldean Fates" },
  { id: "sv7", slug: "sv07-stellar-crown", name: "Stellar Crown" },
];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(swsh\d+|sv\d*|me\d*|sm\d*)\s*:\s*/i, "")
    .replace(/\s+(trainer gallery|galarian gallery)$/i, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

const BY_KEY = new Map();
for (const row of SITE_FG) {
  BY_KEY.set(row.slug, row.mark);
  for (const id of row.ids) BY_KEY.set(id, row.mark);
  for (const name of row.names) BY_KEY.set(fold(name), row.mark);
}

function siteMark(slug) {
  if (!slug) return null;
  const hit = SITE_FG.find((row) => row.slug === slug);
  if (hit) return hit.mark;
  return SITE_OTHER[slug] || null;
}

export function markOf(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (BY_KEY.has(raw)) return BY_KEY.get(raw);
  const lower = raw.toLowerCase();
  if (BY_KEY.has(lower)) return BY_KEY.get(lower);
  const folded = fold(raw);
  return BY_KEY.get(folded) || null;
}

export function fresherSource(generatedAt) {
  const day = String(generatedAt || "").slice(0, 10);
  if (day && day > SITE_ASOF) return "set-marks";
  return "site";
}

export async function loadSetMarks(root = ROOT) {
  return JSON.parse(await readFile(join(root, "data/set-marks.json"), "utf8"));
}

export function rotationDisagreements(marksDoc) {
  const marks = marksDoc?.marks || {};
  const out = [];
  const seen = new Set();
  for (const link of DATA_LINKS) {
    seen.add(link.id);
    const dataMark = marks[link.id];
    if (dataMark !== "F" && dataMark !== "G") continue;
    const site = siteMark(link.slug);
    if (site === dataMark) continue;
    out.push({ id: link.id, name: link.name, dataMark, siteMark: site || "absent" });
  }
  for (const [id, dataMark] of Object.entries(marks)) {
    if (seen.has(id)) continue;
    if (dataMark !== "F" && dataMark !== "G") continue;
    out.push({ id, name: "", dataMark, siteMark: "unmapped" });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function stripLine(text) {
  if (typeof text !== "string" || !text.includes(ROTATION_LINE)) return text;
  return text.split(ROTATION_LINE).join("").replace(/\s{2,}/g, " ").trim();
}

export function attachRotation(read) {
  if (!read || typeof read !== "object") return null;
  const next = { ...read, headline: stripLine(read.headline) };
  delete next.rotationLine;
  const qualified = read.qualified === true || (read.qualified !== false && read.publish === true);
  if (!qualified) return next;
  const mark = markOf(read.setId || read.setSlug || read.set);
  if (mark !== "F" && mark !== "G") return next;
  next.rotationLine = ROTATION_LINE;
  if (next.headline === ROTATION_LINE) next.headline = "";
  return next;
}
