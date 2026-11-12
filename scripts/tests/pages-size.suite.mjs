// The Pages tree is the files git would check out. Fetched URLs stay.
// Unfetched card scans, old pulse rasters, and private shots stay gone.
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMIT_BYTES, publishBytes } from "../check-pages-size.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const KEEP = [
  "trending.json",
  "data/indexes/sealed.json",
  "data/indexes/singles.json",
  "data/heat-check.json",
  "data/sealed-prices.json",
  "data/search/manifest.json",
  "data/card-catalogue.json",
  "data/card-attrs.json",
  "research/assets/build.html",
  "research/assets/public/search-lite.json",
  "research/assets/public/sets.json",
  "research/assets/public/hist-long",
  "research/pulse/pulse-feed.json",
  "research/pulse/cards/latest-binder.png",
  "research/pulse/cards/latest-index.png",
  "research/assets/img/me2pt5/logo.png",
  "research/assets/img/me3/logo.png",
  "research/assets/img/me4/logo.png",
  "research/assets/img/me5/logo.png",
  "rules/jp-news.json",
  "rules/advice-phrases.json",
];

const GONE = [
  "research/assets/private/pulse-mock.html",
  "research/assets/img/me2pt5/1.png",
  "research/assets/img/me5/1.png",
  "research/pulse/cards/verify-hyogonosuke.png",
];

async function exists(rel) {
  try {
    await access(join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

export async function run() {
  let fail = 0;
  const t = (name, ok, detail = "") => {
    if (ok) console.log("  ok  ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };
  const { bytes, count } = publishBytes(ROOT);
  t("publish tree is at or under 900 MiB", bytes <= LIMIT_BYTES, `${bytes} bytes, ${count} files`);
  t("the guard constant is 900 MiB", LIMIT_BYTES === 900 * 1024 * 1024);
  for (const rel of KEEP) t(`kept ${rel}`, await exists(rel));
  for (const rel of GONE) t(`not published ${rel}`, !(await exists(rel)));
  return fail;
}
