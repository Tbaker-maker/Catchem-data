// Second matching pass for sealed ids still in review. No PPT request.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applySecondPass, normSet } from "./lib/sealed-id-pass2.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function groupDates() {
  try {
    const res = await fetch("https://tcgcsv.com/tcgplayer/3/groups", { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return {};
    const body = await res.json();
    const out = {};
    for (const group of body.results || []) {
      if (group.groupId != null && group.publishedOn) out[group.groupId] = group.publishedOn;
    }
    return out;
  } catch {
    return {};
  }
}

export async function runPass2(root = ROOT, { dates = null } = {}) {
  const review = JSON.parse(await readFile(join(root, "data/ppt/sealed-id-review.json"), "utf8"));
  const queue = JSON.parse(await readFile(join(root, "scripts/ppt-history-backfill-ids.json"), "utf8"));
  const sealed = JSON.parse(await readFile(join(root, "data/sealed-products.json"), "utf8"));
  const catalog = JSON.parse(await readFile(join(root, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const cards = JSON.parse(await readFile(join(root, "data/card-catalogue.json"), "utf8"));
  const byId = new Map(sealed.map((row) => [row.id, row]));
  const tracked = [...(review.tracked || []), ...(review.unmatched || [])].map((row) => ({
    ...row,
    ...(byId.get(row.id) || {}),
    id: row.id,
    name: row.name,
    set: row.set,
    subtype: row.subtype,
  }));
  const slim = (catalog.items || [])
    .filter((item) => item.kind === "sealed")
    .map((item) => ({
      kind: item.kind,
      subtype: item.subtype,
      name: item.name,
      set: item.set,
      groupId: item.groupId,
      tcgplayerProductId: item.tcgplayerProductId,
    }));
  const setDates = {};
  for (const card of Object.values(cards.cards || {})) {
    if (!card?.releaseDate) continue;
    if (card.setId && !setDates[card.setId]) setDates[card.setId] = card.releaseDate;
    const key = normSet(card.setName);
    if (key && !setDates[key]) setDates[key] = card.releaseDate;
  }
  const before = (review.tracked || []).length + (review.unmatched || []).length + (review.catalog || []).length;
  const result = applySecondPass({
    products: queue.products || [],
    tracked,
    catalogReview: review.catalog || [],
    catalog: slim,
    groupDates: dates || await groupDates(),
    setDates,
  });
  const after = result.review.length + result.unmatched.length + result.catalogReview.length;
  const summary = {
    asOf: "2026-09-26",
    note: "Second pass. Auto-apply only at 0.85 or higher with a lead of 0.08. Set names, product type, language, and edition are normalized. Group id and release date break ties. No price is stored.",
    before,
    resolved: result.accepted.length,
    trackedResolved: result.accepted.filter((row) => !String(row.id).startsWith("catalog-")).length,
    catalogResolved: result.catalogAccepted,
    stillReview: result.review.length,
    stillUnmatched: result.unmatched.length,
    stillCatalogReview: result.catalogReview.length,
    queueAfter: result.products.length,
    left: after,
  };
  return { result, summary, queue };
}

async function main() {
  const { result, summary, queue } = await runPass2();
  const review = {
    asOf: summary.asOf,
    note: summary.note,
    pass2: summary,
    tracked: result.review,
    unmatched: result.unmatched,
    catalog: result.catalogReview,
  };
  await writeFile(join(ROOT, "data/ppt/sealed-id-review.json"), `${JSON.stringify(review, null, 2)}\n`);
  queue.note = "TCGplayer product ids for sealed products. Config only, no prices. A second pass on 2026-09-26 added rows at 0.85 or higher with a 0.08 lead. Review rows were not added.";
  queue.products = result.products.map((row) => ({ tcgPlayerId: String(row.tcgPlayerId), keys: row.keys }));
  const lines = queue.products.map((row) => JSON.stringify(row)).join(",\n");
  await writeFile(join(ROOT, "scripts/ppt-history-backfill-ids.json"), `{"note":${JSON.stringify(queue.note)},\n"products":[\n${lines}\n]}\n`);
  const reportPath = join(ROOT, "data/ppt/sealed-id-report.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.queueBeforePass2 = report.queueAfter;
  report.queueAfter = summary.queueAfter;
  if (typeof report.stillShortOf1000 === "number") report.stillShortOf1000 = Math.max(0, 1000 - summary.queueAfter);
  report.pass2 = summary;
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`pass2 resolved=${summary.resolved} tracked=${summary.trackedResolved} catalog=${summary.catalogResolved} left=${summary.left} queue=${summary.queueAfter}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
