// Compare the catalog day with the public feed asOf. No network.
// Only an exact YYYY-MM-DD asOf is used. A second date is recorded, not chosen.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) out[name] = true;
    else { out[name] = value; i += 1; }
  }
  return out;
}

function dayOf(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function checkStale({
  catalog = join(ROOT, "data/catalog/tcgcsv-latest.json"),
  feed = join(ROOT, "research/assets/public/reads.json"),
  catalogue = "",
} = {}) {
  let catalogDoc;
  try {
    catalogDoc = await readJson(catalog);
  } catch (err) {
    const sentence = err && err.code === "ENOENT" ? "The catalog file is missing." : "The catalog file could not be read.";
    return { exitCode: 1, sentence };
  }
  if (catalogDoc.asOf == null || catalogDoc.asOf === "") return { exitCode: 1, sentence: "The catalog file has no asOf day." };
  const catalogDay = dayOf(catalogDoc.asOf);
  if (!catalogDay) return { exitCode: 1, sentence: "The catalog asOf is not a calendar day." };

  let feedDoc;
  try {
    feedDoc = await readJson(feed);
  } catch (err) {
    const sentence = err && err.code === "ENOENT" ? "The feed file is missing." : "The feed file could not be read.";
    return { exitCode: 1, sentence };
  }
  if (feedDoc.asOf == null || feedDoc.asOf === "") return { exitCode: 1, sentence: "The feed file has no asOf day." };
  const feedDay = dayOf(feedDoc.asOf);
  if (!feedDay) return { exitCode: 1, sentence: "The feed asOf is not a calendar day." };

  let exitCode = 0;
  let sentence;
  if (feedDay < catalogDay) {
    exitCode = 1;
    sentence = `The feed file asOf ${feedDay} is older than the catalog day ${catalogDay}.`;
  } else if (feedDay === catalogDay) {
    sentence = `The feed file asOf ${feedDay} matches the catalog day ${catalogDay}.`;
  } else {
    sentence = `The feed file asOf ${feedDay} is newer than the catalog day ${catalogDay}.`;
  }

  const leadDays = [];
  let leadRefused = false;
  for (const row of Array.isArray(feedDoc.reads) ? feedDoc.reads : []) {
    if (!row || !Object.prototype.hasOwnProperty.call(row, "asOf") || row.asOf == null || row.asOf === "") continue;
    const day = dayOf(row.asOf);
    if (!day) leadRefused = true;
    else if (!leadDays.includes(day)) leadDays.push(day);
  }
  leadDays.sort();
  if (leadRefused) sentence = sentence.slice(0, -1) + ", and a lead asOf was not a calendar day so it was not used.";
  else if (leadDays.length && (leadDays.length !== 1 || leadDays[0] !== feedDay)) {
    sentence = sentence.slice(0, -1) + `, and lead lines carry ${leadDays.join(" and ")} which were not used as the feed day.`;
  }

  if (catalogue) {
    try {
      const extra = await readJson(catalogue);
      if (extra.asOf != null && extra.asOf !== "") {
        const catalogueDay = dayOf(extra.asOf);
        if (!catalogueDay) return { exitCode: 1, sentence: "The catalogue asOf is not a calendar day." };
        if (catalogueDay !== feedDay) {
          sentence = sentence.slice(0, -1) + `, and feed/catalogue.json asOf ${catalogueDay} was kept beside the reads file asOf ${feedDay}.`;
        }
      }
    } catch (err) {
      if (!err || err.code !== "ENOENT") return { exitCode: 1, sentence: "The catalogue file could not be read." };
    }
  }

  return { exitCode, sentence, catalogDay, feedDay };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkStale({
    catalog: args.catalog || join(ROOT, "data/catalog/tcgcsv-latest.json"),
    feed: args.feed || join(ROOT, "research/assets/public/reads.json"),
    catalogue: args.catalogue === undefined ? join(ROOT, "research/assets/public/feed/catalogue.json") : (args.catalogue || ""),
  });
  console.log(result.sentence);
  process.exit(result.exitCode);
}
