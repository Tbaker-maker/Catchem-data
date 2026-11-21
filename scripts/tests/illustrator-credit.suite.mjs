// A raw dash is not an illustrator. Catalogue writers store null. Public writers store "".
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogueArtist, illustratorCredit, scrubArtistJson } from "../lib/illustrator-credit.mjs";
import { cleanArtist } from "../lib/path-tags.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const WRITERS = [
  "scripts/ingest-catalogue.mjs",
  "scripts/backfill-catalogue-sets.mjs",
  "scripts/fetch-artists.mjs",
  "scripts/backfill-artists.mjs",
  "scripts/build-public-bundle.mjs",
  "scripts/lib/path-tags.mjs",
  "scripts/lib/fact-reads.mjs",
  "scripts/lib/card-rating.mjs",
  "scripts/lib/card-face-stamp.mjs",
  "scripts/build-read-facts.mjs",
  "scripts/lib/history-reads.mjs",
  "scripts/lib/rich-reads.mjs",
];

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("a dash is not a credit", illustratorCredit("\u2014") === "" && illustratorCredit("\u2013") === "" && illustratorCredit("  ") === "" && illustratorCredit(null) === "");
  t("a real name stays", illustratorCredit("  Ken Sugimori ") === "Ken Sugimori" && catalogueArtist("Ken Sugimori") === "Ken Sugimori");
  t("the catalogue stores null for a dash", catalogueArtist("\u2014") === null && catalogueArtist("") === null);
  t("public tags drop a dash", cleanArtist("\u2014") === "" && cleanArtist("Miki Kudo") === "Miki Kudo");

  const sample = '{"name":"A \\u2014 B","artist":"\\u2014","note":"kept \\u2014","other":{"artist":"Ken Sugimori"}}';
  const scrubbed = scrubArtistJson(sample);
  const doc = JSON.parse(scrubbed);
  t("only the artist field is cleared", doc.artist === null && doc.other.artist === "Ken Sugimori" && doc.name.includes("\u2014") && doc.note.includes("\u2014"));

  const sourced = "Noriko Takaya, \n Shinji Higuchi";
  const kept = JSON.parse(scrubArtistJson(JSON.stringify({ artist: sourced, note: "left alone" })));
  const dropped = JSON.parse(scrubArtistJson(JSON.stringify({ artist: "\u2014", note: "left alone" })));
  t("a sourced credit is kept", kept.artist === "Noriko Takaya, Shinji Higuchi" && kept.note === "left alone");
  t("only a sourceless credit is dropped", dropped.artist === null && dropped.note === "left alone");

  for (const rel of WRITERS) {
    const src = await readFile(join(ROOT, rel), "utf8");
    const uses = src.includes("illustratorCredit") || src.includes("catalogueArtist") || src.includes("cleanArtist(");
    const raw = (src.match(/artist:\s*[^,\n]+/g) || []).filter((line) => /\.artist\b/.test(line) && !/illustratorCredit|catalogueArtist|cleanArtist/.test(line));
    t(`${rel} does not copy a raw artist`, uses && raw.length === 0);
    if (raw.length) console.log(`    ${raw.join(" | ")}`);
  }

  const catalogue = await readFile(join(ROOT, "data/card-catalogue.json"), "utf8");
  const dashCredits = (catalogue.match(/"artist"\s*:\s*"(?:\\u2014|\\u2013|\u2014|\u2013)"/g) || []).length;
  t("the catalogue file has no dash-only artist", dashCredits === 0);

  return fail;
}
