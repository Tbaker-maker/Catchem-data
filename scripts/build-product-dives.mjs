// Build per-product deep-dive JSON under research/pulse/dive/.
// Called from generate-pulse.mjs (nightly already git-adds research/pulse/).
// No workflow edit. No invented solds. No Browse-total fill from page counts.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildAllDives, indexOutlierMap } from "./lib/product-dives.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/pulse/dive");
const J = async (p) => {
  try {
    return JSON.parse(await readFile(join(ROOT, p), "utf-8"));
  } catch {
    return null;
  }
};

export async function buildProductDives() {
  const heatHistory = (await J("data/heat-history.json")) ?? [];
  const sealedPrices = (await J("data/sealed-prices.json")) ?? { products: [] };
  const buyoutTape = (await J("data/buyout-tape.json")) ?? { rows: [] };
  const outlierDoc = (await J("data/derived/sealed-price-outliers.json")) ?? (await J("data/price-outliers.json")) ?? null;
  const outlierMap = indexOutlierMap(outlierDoc);
  const redirects = (await J("research/assets/public/redirects.json")) ?? { products: {} };

  const bundle = buildAllDives({
    heatHistory,
    sealedPrices,
    buyoutTape,
    outlierMap,
    redirects,
  });

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const index = {
    asOf: bundle.asOf,
    generatedAt: bundle.generatedAt,
    count: bundle.count,
    note: bundle.note,
    volumeNote: bundle.volumeNote,
    outlierHook: bundle.outlierHook,
    ids: bundle.ids,
    byTcgcsv: bundle.byTcgcsv,
  };
  await writeFile(join(OUT, "index.json"), JSON.stringify(index) + "\n");

  for (const dive of bundle.dives) {
    await writeFile(join(OUT, `${dive.id}.json`), JSON.stringify(dive) + "\n");
  }

  console.log(
    `✓ product dives: ${bundle.count} payloads → research/pulse/dive/ (volume=null; outlier ${outlierMap ? "wired" : "hook only"})`,
  );
  return bundle;
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) await buildProductDives();
