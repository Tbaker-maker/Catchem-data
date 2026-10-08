// Catalogue images are id → src from the Post Office indexes.
// Seed overrides full when both have the same id. A src that is not a
// catalogue path is left out. Names are never keys.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function cleanSrc(src) {
  const path = String(src || "").trim().split(/[?#]/)[0];
  if (!/^(?:\/img\/|\/cards\/|\/thumb\/)/.test(path)) return "";
  if (path.includes("..") || path.includes("//")) return "";
  return path;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadCatalogueImages(root = ROOT) {
  const images = {};
  const take = (rows) => {
    for (const row of rows || []) {
      const id = row && row.id;
      const path = cleanSrc(row && row.src);
      if (!id || !path) continue;
      images[id] = path;
    }
  };
  take(await readJson(join(root, "research/assets/cards/full/index.json")).catch(() => []));
  take(await readJson(join(root, "research/assets/cards/seed/index.json")).catch(() => []));
  return images;
}

export function cataloguePath(map, id) {
  if (!map || id == null || id === "") return "";
  const path = map[id];
  return typeof path === "string" && /^(?:\/img\/|\/cards\/|\/thumb\/)/.test(path) ? path : "";
}

async function writeReport(root, images) {
  const dir = join(root, "research/assets/public/sets");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  const singles = [];
  const sealed = [];
  const setLogos = [];
  let matchedSingles = 0;
  let matchedSealed = 0;
  let matchedLogos = 0;
  const seen = new Set();
  for (const name of names) {
    const doc = await readJson(join(dir, name));
    const slug = doc.slug || name.slice(0, -5);
    if (cataloguePath(images, slug)) matchedLogos += 1;
    else setLogos.push(slug);
    for (const item of doc.items || []) {
      const id = item && item.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const kind = item.kind === "sealed" ? "sealed" : "single";
      if (cataloguePath(images, id)) {
        if (kind === "sealed") matchedSealed += 1;
        else matchedSingles += 1;
        continue;
      }
      if (kind === "sealed") sealed.push(id);
      else singles.push(id);
    }
  }
  singles.sort();
  sealed.sort();
  setLogos.sort();
  const status = "missing from the catalogue";
  const report = {
    status,
    rule: "Match by id only. A name is not a match.",
    matchedById: { singles: matchedSingles, sealed: matchedSealed, setLogos: matchedLogos },
    singles: { status, count: singles.length, ids: singles },
    sealed: { status, count: sealed.length, ids: sealed },
    setLogos: { status, count: setLogos.length, ids: setLogos },
  };
  const ordered = {};
  for (const id of Object.keys(images).sort()) ordered[id] = images[id];
  const pub = join(root, "research/assets/public");
  await writeFile(join(pub, "catalogue-images.json"), JSON.stringify({ source: "Post Office catalogue. Match by id only.", images: ordered }));
  await writeFile(join(pub, "missing-from-catalogue.json"), JSON.stringify(report));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const images = await loadCatalogueImages(ROOT);
  const report = await writeReport(ROOT, images);
  console.log(`catalogue images ${Object.keys(images).length}`);
  console.log(`matched singles ${report.matchedById.singles} sealed ${report.matchedById.sealed} logos ${report.matchedById.setLogos}`);
  console.log(`missing singles ${report.singles.count} sealed ${report.sealed.count} logos ${report.setLogos.count}`);
}
