// Recount catalog kinds and compare them to the coverage file. Does not rewrite it.
// Counts are the rows actually read. Disagreeing files are both reported.
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

export function countKinds(items) {
  let single = 0;
  let sealed = 0;
  let other = 0;
  for (const item of items || []) {
    if (item?.kind === "single") single += 1;
    else if (item?.kind === "sealed") sealed += 1;
    else other += 1;
  }
  return { single, sealed, other };
}

export async function checkCoverage({
  catalog = join(ROOT, "data/catalog/tcgcsv-latest.json"),
  coverage = join(ROOT, "data/catalog/tcgcsv-coverage.json"),
} = {}) {
  let catalogDoc;
  try {
    catalogDoc = JSON.parse(await readFile(catalog, "utf8"));
  } catch (err) {
    const sentence = err && err.code === "ENOENT" ? "The catalog file is missing." : "The catalog file could not be read.";
    return { exitCode: 1, sentence };
  }
  if (!Array.isArray(catalogDoc.items)) return { exitCode: 1, sentence: "The catalog file has no items list." };

  let coverageDoc;
  try {
    coverageDoc = JSON.parse(await readFile(coverage, "utf8"));
  } catch (err) {
    const sentence = err && err.code === "ENOENT" ? "The coverage file is missing." : "The coverage file could not be read.";
    return { exitCode: 1, sentence };
  }
  const counts = coverageDoc.counts;
  if (!counts || typeof counts.single !== "number" || typeof counts.sealed !== "number") {
    return { exitCode: 1, sentence: "The coverage file has no single and sealed counts." };
  }

  const got = countKinds(catalogDoc.items);
  if (got.single + got.sealed + got.other !== catalogDoc.items.length) {
    return { exitCode: 1, sentence: "Refused the kind counts because they do not match the catalog rows." };
  }
  let sentence;
  let exitCode = 0;
  if (got.single !== counts.single || got.sealed !== counts.sealed) {
    exitCode = 1;
    sentence = `Catalog single ${got.single} and sealed ${got.sealed} differ from coverage single ${counts.single} and sealed ${counts.sealed}.`;
  } else {
    sentence = `Catalog single ${got.single} and sealed ${got.sealed} match the coverage file.`;
  }
  const catalogDay = catalogDoc.asOf == null || catalogDoc.asOf === "" ? "" : dayOf(catalogDoc.asOf);
  const coverageDay = coverageDoc.asOf == null || coverageDoc.asOf === "" ? "" : dayOf(coverageDoc.asOf);
  if ((catalogDoc.asOf && !catalogDay) || (coverageDoc.asOf && !coverageDay)) {
    sentence = sentence.slice(0, -1) + ", and an asOf was not a calendar day so no day was chosen.";
  } else if (catalogDay && coverageDay && catalogDay !== coverageDay) {
    sentence = sentence.slice(0, -1) + `, and catalog asOf ${catalogDay} and coverage asOf ${coverageDay} were both kept.`;
  }
  return {
    exitCode,
    sentence,
    got: { single: got.single, sealed: got.sealed },
    expected: { single: counts.single, sealed: counts.sealed },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkCoverage({
    catalog: args.catalog || join(ROOT, "data/catalog/tcgcsv-latest.json"),
    coverage: args.coverage || join(ROOT, "data/catalog/tcgcsv-coverage.json"),
  });
  console.log(result.sentence);
  process.exit(result.exitCode);
}
