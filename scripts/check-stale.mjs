// Compare the catalog day with the public feed asOf. No network.
// Only an exact YYYY-MM-DD asOf is used. A second date is recorded, not chosen.
//
// --at-run-start: the nightly writes today's catalog day first (PR #125) and
// only rebuilds the feed near the end of the run. At run start the feed is
// therefore checked against the catalog day that is committed (published),
// which is the day the last feed was built from. The fresh day is named in the
// sentence, not hidden. If the published day cannot be read, the working
// catalog day is used as before.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
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

// asOf of the catalog as committed at `ref` in the git repo holding `catalog`.
// Returns "" when there is no repo, the file is not tracked, or asOf is not a day.
export function committedCatalogDay(catalog, ref = "HEAD") {
  try {
    const cwd = dirname(catalog);
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const rel = relative(top, catalog).split("\\").join("/");
    const text = execFileSync("git", ["show", `${ref}:${rel}`], { cwd: top, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    return dayOf(JSON.parse(text).asOf);
  } catch {
    return "";
  }
}

export async function checkStale({
  catalog = join(ROOT, "data/catalog/tcgcsv-latest.json"),
  feed = join(ROOT, "research/assets/public/reads.json"),
  catalogue = "",
  publishedDay = null,
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

  // publishedDay null: plain check against the working catalog day.
  // publishedDay "": run-start check, but the committed day could not be read.
  // publishedDay older than the working day: the working day was written in
  // this run and the feed is not rebuilt from it yet, so compare the feed with
  // the published day and name the working day.
  let compareDay = catalogDay;
  let label = "catalog day";
  let tail = "";
  if (publishedDay === "") {
    tail = ", and the published catalog day could not be read, so the working catalog day was used";
  } else if (publishedDay != null) {
    const published = dayOf(publishedDay);
    if (!published) return { exitCode: 1, sentence: "The published catalog asOf is not a calendar day." };
    if (published < catalogDay) {
      compareDay = published;
      label = "published catalog day";
      tail = `, and catalog day ${catalogDay} was written earlier in this run and is not published yet, so the feed is rebuilt from it later in the run`;
    } else if (published > catalogDay) {
      tail = `, and the published catalog day ${published} is newer than the working catalog day, so the working day was used`;
    }
  }

  let exitCode = 0;
  let sentence;
  if (feedDay < compareDay) {
    exitCode = 1;
    sentence = `The feed file asOf ${feedDay} is older than the ${label} ${compareDay}${tail}.`;
  } else if (feedDay === compareDay) {
    sentence = `The feed file asOf ${feedDay} matches the ${label} ${compareDay}${tail}.`;
  } else {
    sentence = `The feed file asOf ${feedDay} is newer than the ${label} ${compareDay}${tail}.`;
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

  return { exitCode, sentence, catalogDay, feedDay, comparedDay: compareDay };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = args.catalog || join(ROOT, "data/catalog/tcgcsv-latest.json");
  const result = await checkStale({
    catalog: catalogPath,
    publishedDay: args["at-run-start"] ? committedCatalogDay(catalogPath) : null,
    feed: args.feed || join(ROOT, "research/assets/public/reads.json"),
    catalogue: args.catalogue === undefined ? join(ROOT, "research/assets/public/feed/catalogue.json") : (args.catalogue || ""),
  });
  console.log(result.sentence);
  process.exit(result.exitCode);
}
