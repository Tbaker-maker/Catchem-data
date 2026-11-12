// SVP 181 to 184 images are the URLs api.pokemontcg.io published on 2026-11-12.
// hsp-HGSS18 stays out: both sizes came back as the 186316-byte placeholder.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const URLS = {
  "svp-181": ["https://images.pokemontcg.io/svp/181.png", "https://images.pokemontcg.io/svp/181_hires.png"],
  "svp-182": ["https://images.pokemontcg.io/svp/182.png", "https://images.pokemontcg.io/svp/182_hires.png"],
  "svp-183": ["https://images.pokemontcg.io/svp/183.png", "https://images.pokemontcg.io/svp/183_hires.png"],
  "svp-184": ["https://images.pokemontcg.io/svp/184.png", "https://images.pokemontcg.io/svp/184_hires.png"],
};

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok  " + name);
    else { fail += 1; console.error("  FAIL " + name); }
  };
  const doc = JSON.parse(await readFile(join(ROOT, "data/card-images.json"), "utf8"));
  const images = doc.images || {};
  t("the image count matches the file", doc.cards === Object.keys(images).length && doc.cards === 20318);
  for (const [id, pair] of Object.entries(URLS)) {
    const row = images[id];
    t(id + " uses the API url", !!row && row.small === pair[0] && row.large === pair[1]);
  }
  t("hsp-HGSS18 stays out", !images["hsp-HGSS18"]);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("svp-promo-images.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
