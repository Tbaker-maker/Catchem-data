// The backfill never contradicts a TCGCSV file: no product whose backfill is a
// different printing, and no backfill point on a day a TCGCSV file already has.
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pruneBackfill, pruneSeries } from "../lib/backfill-prune.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  const src = await readFile(join(ROOT, "scripts/lib/backfill-prune.mjs"), "utf8");
  t("backfill prune does not fetch", !/\bfetch\s*\(|\bhttps?:\/\//i.test(src));

  // Pure: a listed product loses its whole series; an overlapping day yields to TCGCSV.
  const series = {
    "111": [["2026-09-25", 9.99], ["2026-09-26", 9.99]],
    "222": [["2026-09-24", 2.00], ["2026-09-25", 2.00], ["2026-09-26", 2.10]],
    "333": [["2026-09-25", 50.01]],
  };
  const tcgcsv = new Map([[222, new Set(["2026-09-26"])], [333, new Set(["2026-09-25"])], [111, new Set(["2026-09-26"])]]);
  const r = pruneSeries(series, { removed: new Set([111]), tcgcsv });
  t("a different-printing series is dropped whole", !("111" in r.kept));
  t("an overlapping day keeps only the TCGCSV point", JSON.stringify(r.kept["222"]) === JSON.stringify([["2026-09-24", 2.00], ["2026-09-25", 2.00]]));
  t("a product left with no days is dropped, not filled", !("333" in r.kept));
  t("no point is added or changed", Object.values(r.kept).flat().every(([d, v]) => series["222"].some(([d2, v2]) => d2 === d && v2 === v)));

  // On disk, with a temp repo: write mode removes, check mode then finds nothing.
  const root = await mkdtemp(join(tmpdir(), "backfill-prune-"));
  await mkdir(join(root, "data/history/market-backfill"), { recursive: true });
  await mkdir(join(root, "data/history/tcgcsv-daily"), { recursive: true });
  await mkdir(join(root, "data/history/tcgplayer-market"), { recursive: true });
  await writeFile(join(root, "data/history/market-backfill/00.json"), JSON.stringify({ source: "s", note: "n", series }) + "\n");
  await writeFile(join(root, "data/history/tcgcsv-daily/2026-09-26.json"), JSON.stringify({ prices: [{ id: 222, market: 2.00, printing: "Normal" }, { id: 111, market: 3.00, printing: "Normal" }] }));
  await writeFile(join(root, "data/history/tcgplayer-market/sm7-booster-box.json"), JSON.stringify({ tcgplayerProductId: 333, points: [{ date: "2026-09-25", market: 50.02, source: "TCGplayer market via TCGCSV" }] }));
  await writeFile(join(root, "data/history/market-backfill-removed.json"), JSON.stringify({ products: [{ id: 111, dailyPrinting: "Normal", backfillPrinting: "Reverse Holofoil" }] }));
  const wrote = await pruneBackfill(root, { write: true });
  const again = await pruneBackfill(root, { write: false });
  const doc = JSON.parse(await readFile(join(root, "data/history/market-backfill/00.json"), "utf8"));
  t("write mode drops the listed product and the overlap days", wrote.droppedProducts === 2 && wrote.overlapPoints === 2 && Object.keys(doc.series).join() === "222" && doc.note === "n");
  t("a second pass has nothing to drop", again.droppedProducts === 0 && again.overlapPoints === 0 && again.changedFiles === 0);

  // Contract on the committed files.
  const repo = await pruneBackfill(ROOT, { write: false });
  t("committed backfill has no different-printing product and no day a TCGCSV file has", repo.droppedProducts === 0 && repo.droppedPoints === 0 && repo.overlapPoints === 0);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("market-backfill.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("market backfill ok");
}
