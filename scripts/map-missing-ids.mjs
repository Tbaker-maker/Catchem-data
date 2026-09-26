// Map sealed products and set slugs that have no id yet.
// Uses the TCGCSV catalog and the PPT set list already on disk. No network. No prices.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyQueue } from "./lib/sealed-id-match.mjs";
import { applySetMap, matchMissingSets } from "./lib/ppt-set-id-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function priceKeys(value, found = []) {
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value)) {
    if (/price|market/i.test(key)) found.push(key);
    else priceKeys(child, found);
  }
  return found;
}

export async function mapMissingIds(root = ROOT) {
  const sealed = JSON.parse(await readFile(join(root, "data/sealed-products.json"), "utf8"));
  const queueFile = JSON.parse(await readFile(join(root, "scripts/ppt-history-backfill-ids.json"), "utf8"));
  const catalog = JSON.parse(await readFile(join(root, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const setMap = JSON.parse(await readFile(join(root, "data/ppt-set-map.json"), "utf8"));
  const catalogue = JSON.parse(await readFile(join(root, "data/card-catalogue.json"), "utf8"));

  const known = new Set((queueFile.products || []).flatMap((row) => row.keys || []));
  const tracked = sealed.filter((product) => !known.has(product.id));
  const slim = (catalog.items || [])
    .filter((item) => item.kind === "sealed")
    .map((item) => ({
      kind: item.kind,
      subtype: item.subtype,
      name: item.name,
      set: item.set,
      tcgplayerProductId: item.tcgplayerProductId,
    }));
  const result = applyQueue({ products: queueFile.products, tracked, catalog: slim });
  const cardCounts = {};
  for (const card of Object.values(catalogue.cards || {})) {
    if (!card?.setId) continue;
    cardCounts[card.setId] = (cardCounts[card.setId] || 0) + 1;
  }
  const sets = matchMissingSets(setMap.unmatched || [], setMap.providerSets || [], cardCounts);
  const nextMap = applySetMap(setMap, sets.mapped);
  const mappedSlugs = nextMap.lastIdMatch?.slugs || [];
  const mappedDetail = mappedSlugs.map((slug) => {
    const row = nextMap.bySlug[slug];
    return {
      slug,
      ourName: row?.ourName || null,
      pptName: row?.pptName || null,
      cardCount: row?.cardCount ?? null,
      matchedBy: row?.matchedBy || null,
    };
  });
  const cardsMapped = mappedSlugs.reduce((sum, slug) => sum + (cardCounts[slug] || 0), 0);
  const cardsReview = sets.review.reduce((sum, row) => sum + (cardCounts[row.slug] || 0), 0);
  const cardsUnmatched = sets.unmatched.reduce((sum, row) => sum + (cardCounts[row.slug] || 0), 0);
  const catalogRows = result.products.filter((row) => (row.keys || []).some((key) => String(key).startsWith("catalog-")));
  const carried = result.products.length - catalogRows.length;

  const report = {
    asOf: catalog.asOf || "2026-09-26",
    source: "TCGCSV catalog product ids and PPT set names already on file",
    note: "The 829 figure was the gap from 171 queued ids toward a 1,000 target, not 829 known products. New ids are copied from the TCGCSV catalog. No price is stored. Review rows are not queued.",
    trackedMissing: tracked.length,
    trackedMapped: result.accepted.filter((row) => !String(row.id).startsWith("catalog-")).length,
    trackedReview: result.review.length,
    trackedUnmatched: result.unmatched.length,
    catalogAccepted: catalogRows.length,
    catalogReview: result.catalogReview.length,
    queueBefore: carried,
    queueAfter: result.products.length,
    stillShortOf1000: Math.max(0, 1000 - result.products.length),
    singles: {
      setsMissing: mappedSlugs.length + sets.review.length + sets.unmatched.length,
      cardsMissingSetId: cardsMapped + cardsReview + cardsUnmatched,
      setsMapped: mappedSlugs.length,
      cardsMapped,
      setsReview: sets.review.length,
      cardsReview,
      setsUnmatched: sets.unmatched.length,
      cardsUnmatched,
      mapped: mappedDetail,
    },
  };
  const review = {
    asOf: report.asOf,
    note: "Uncertain sealed matches. Not used by the PPT queue. No prices.",
    tracked: result.review,
    unmatched: result.unmatched,
    catalog: result.catalogReview,
  };
  const setReview = {
    asOf: report.asOf,
    note: "Uncertain PPT set matches. Not written into bySlug. No prices.",
    review: sets.review,
    unmatched: sets.unmatched,
  };
  const leaked = priceKeys(report).concat(priceKeys(review), priceKeys(setReview), priceKeys({ products: result.products }));
  if (leaked.length) throw new Error(`refusing to write a price field: ${leaked[0]}`);

  const queue = {
    note: "TCGplayer product ids for sealed products. Config only, no prices. High-confidence TCGCSV matches were added on 2026-09-26. Review rows were not added.",
    products: result.products.map((row) => ({ tcgPlayerId: String(row.tcgPlayerId), keys: row.keys })),
  };
  const dir = join(root, "data/ppt");
  await mkdir(dir, { recursive: true });
  const lines = queue.products.map((row) => JSON.stringify(row)).join(",\n");
  await writeFile(join(root, "scripts/ppt-history-backfill-ids.json"), `{"note":${JSON.stringify(queue.note)},\n"products":[\n${lines}\n]}\n`);
  await writeFile(join(dir, "sealed-id-review.json"), JSON.stringify(review, null, 2));
  await writeFile(join(dir, "sealed-id-report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(dir, "singles-set-review.json"), JSON.stringify(setReview, null, 2));
  await writeFile(join(root, "data/ppt-set-map.json"), `${JSON.stringify(nextMap, null, 2)}\n`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await mapMissingIds();
  console.log(JSON.stringify({
    trackedMapped: report.trackedMapped,
    trackedReview: report.trackedReview,
    trackedUnmatched: report.trackedUnmatched,
    catalogAccepted: report.catalogAccepted,
    catalogReview: report.catalogReview,
    queueBefore: report.queueBefore,
    queueAfter: report.queueAfter,
    stillShortOf1000: report.stillShortOf1000,
    singles: {
      setsMapped: report.singles.setsMapped,
      cardsMapped: report.singles.cardsMapped,
      setsReview: report.singles.setsReview,
      cardsReview: report.singles.cardsReview,
      setsUnmatched: report.singles.setsUnmatched,
      cardsUnmatched: report.singles.cardsUnmatched,
    },
  }, null, 2));
}
