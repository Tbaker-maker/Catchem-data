import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hiddenSealedPids, isBrowseHidden, showsOnSite } from "../lib/browse-hidden.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const pids = hiddenSealedPids([
    { id: "tcgcsv-233335", tcgPlayerId: "233335", browse: false, browseReason: "case" },
    { id: "tcgcsv-229277", tcgPlayerId: "229277" },
    { id: "x", tcgPlayerId: null, browse: false },
  ]);
  t("only browse:false rows with a numeric productId are hidden", pids.size === 1 && pids.has(233335));
  t("a hidden sealed catalogue item is left out of browse", isBrowseHidden({ kind: "sealed", tcgplayerProductId: 233335 }, pids));
  t("a single with the same number is not hidden", !isBrowseHidden({ kind: "single", tcgplayerProductId: 233335 }, pids));
  t("a plain sealed product stays in browse", !isBrowseHidden({ kind: "sealed", tcgplayerProductId: 229277 }, pids));
  const casePids = new Set([609238]);
  t("a hidden case is not a public read", showsOnSite({ id: "tcgcsv-609238", kind: "sealed", tcgplayerProductId: 609238 }, casePids) === false);
  t("a costco exclusive can stay public", showsOnSite({ id: "costco-1", kind: "sealed", tcgplayerProductId: 609238 }, casePids, new Set(["costco-1"])) === true);
  t("a single is still a public read", showsOnSite({ id: "tcgcsv-1", kind: "single", tcgplayerProductId: 609238 }, casePids) === true);
  const rows = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
  const real = hiddenSealedPids(rows);
  t("every browse:false row in the data is still in the data", real.size === rows.filter((r) => r.browse === false).length && real.size > 0);
  const src = await readFile(join(ROOT, "scripts/build-public-bundle.mjs"), "utf8");
  t("the public bundle reads the browse flag before building search", src.includes("hiddenSealedPids(") && src.indexOf("isBrowseHidden(") < src.indexOf("search.push("));
  const feed = await readFile(join(ROOT, "scripts/build-feed.mjs"), "utf8");
  t("the feed skips a hidden sealed product before a mover", feed.includes("showsOnSite(") && feed.indexOf("showsOnSite(") < feed.indexOf("items.push("));
  const span = await readFile(join(ROOT, "scripts/lib/span-reads.mjs"), "utf8");
  t("span reads skip a hidden sealed product", span.includes("showsOnSite("));
  const scan = await readFile(join(ROOT, "scripts/lib/scanner/load.mjs"), "utf8");
  t("scanner reads skip a hidden sealed product", scan.includes("showsOnSite("));
  const board = await readFile(join(ROOT, "scripts/lib/board-mix.mjs"), "utf8");
  t("board sealed reads skip a hidden product", board.includes("row.browse !== false"));
  const counts = JSON.parse(await readFile(join(ROOT, "research/assets/public/counts.json"), "utf8"));
  if (typeof counts.browseHiddenSealed === "number") {
    const search = JSON.parse(await readFile(join(ROOT, "research/assets/public/search-lite.json"), "utf8"));
    const ids = new Set(search.map((r) => String(r[0])));
    t("no hidden case is in search-lite", !ids.has("tcgcsv-233335") && ![...real].some((pid) => ids.has(`tcgcsv-${pid}`) ));
  }
  return fail;
}
