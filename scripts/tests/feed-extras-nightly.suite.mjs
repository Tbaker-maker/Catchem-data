// feed-extras-nightly.suite.mjs — the nightly feed rebuild keeps the flagged
// (outlier) and dive reads when their source files have rows, and ships none
// when they do not.
//
// build-feed.mjs is the nightly path. It used to hand writeExtra only catalog
// reads; writeExtra drops outlier/dive rows from reads.json and re-adds only
// what it is given, so every nightly stripped them. build-feed now calls
// writeFeedExtras, and this suite runs that exact function against a fixture
// root, so the assertion is about the code the nightly runs, not a copy of it.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFeedExtras } from "../build-extra-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function put(root, rel, value) {
  await mkdir(dirname(join(root, rel)), { recursive: true });
  await writeFile(join(root, rel), typeof value === "string" ? value : JSON.stringify(value));
}
const get = async (root, rel) => JSON.parse(await readFile(join(root, rel), "utf8"));

const LEAD = [
  { id: "move-1", sku: "tcgcsv-1", readKind: "price", kind: "single", price: 10, path: "p1" },
  { id: "pokemon-a", sku: "pokemon-a", readKind: "pokemon", kind: "pokemon", path: "p2" },
  { id: "move-2", sku: "tcgcsv-2", readKind: "price", kind: "single", price: 20, path: "p3" },
  // Left over from an earlier build; must not survive a rebuild on its own.
  { id: "outlier-old", sku: "old", readKind: "outlier", kind: "outlier", price: 1, path: "stale" },
  { id: "dive-old", sku: "old", readKind: "dive", kind: "dive", price: 1, path: "stale" },
];
const BROWSE_ARGS = { asOf: "2026-10-06", cardIds: ["a", "b"], rankedIds: ["a", "b"], news: [], waves: [] };

async function fixture({ withSources }) {
  const root = await mkdtemp(join(tmpdir(), "feed-extras-"));
  await put(root, "research/assets/public/reads.json", { asOf: "2026-10-06", count: 2, reads: LEAD });
  await mkdir(join(root, "research/assets/public/feed"), { recursive: true });
  if (withSources) {
    await put(root, "data/derived/sealed-price-outliers.json", {
      asOf: "2026-10-06",
      high: [
        { id: "sv5-pc-etb", name: "Temporal Forces Pokemon Center Elite Trainer Box", severity: "high", direction: "high", todayDate: "2026-10-06", todayPrice: 499.99, referencePrice: 255.75, pctGap: 95.5, provisionalLabel: "possible real move" },
        { id: "cel25-etb", name: "Celebrations Elite Trainer Box", severity: "high", direction: "low", todayDate: "2026-10-06", todayPrice: 161.99, referencePrice: 330, pctGap: -50.9, provisionalLabel: "possible real move" },
        { id: "xy12-etb", name: "Evolutions Elite Trainer Box", severity: "high", direction: "high", todayDate: "2026-10-06", todayPrice: 850, referencePrice: 420, pctGap: 102.4, provisionalLabel: "likely bad listing" },
      ],
      soft: [],
    });
    await put(root, "research/pulse/dive/index.json", { ids: ["sv5-pc-etb", "cel25-etb", "no-market", "missing-file"] });
    await put(root, "research/pulse/dive/sv5-pc-etb.json", { id: "sv5-pc-etb", name: "Temporal Forces Pokemon Center Elite Trainer Box", asOf: "2026-10-06", latest: { priceMedian: 499.99, lastSeen: "2026-10-06", dataStatus: "live" }, outlier: { note: "Price flagged: 95.5% above recent median — review" } });
    await put(root, "research/pulse/dive/cel25-etb.json", { id: "cel25-etb", name: "Celebrations Elite Trainer Box", asOf: "2026-10-06", latest: { priceMedian: 161.99, lastSeen: "2026-10-06", dataStatus: "live" } });
    await put(root, "research/pulse/dive/no-market.json", { id: "no-market", name: "Empty", asOf: "2026-10-06", latest: { dataStatus: "no-active-market", listingCount: 0 } });
  }
  return root;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  // ── source files have rows ──
  const full = await fixture({ withSources: true });
  try {
    const extra = { asOf: "2026-10-06", volume: [], reads: [{ id: "lag-1", readKind: "lag", kind: "lag" }, LEAD[3]] };
    const summary = await writeFeedExtras(full, extra, BROWSE_ARGS);
    const reads = (await get(full, "research/assets/public/reads.json")).reads;
    const ex = await get(full, "research/assets/public/feed/extra-reads.json");
    const browse = await get(full, "research/assets/public/feed/browse.json");
    const ids = reads.map((r) => r.id);
    t("both outlier rows in the file survive the rebuild", ids.includes("outlier-sv5-pc-etb") && ids.includes("outlier-cel25-etb") && reads.filter((r) => r.readKind === "outlier").length === 2);
    t("a likely bad listing is not a Flagged read", !ids.includes("outlier-xy12-etb") && !ex.reads.some((r) => r.id === "outlier-xy12-etb"));
    t("dive teasers with a live price survive the rebuild", ids.includes("dive-sv5-pc-etb") && ids.includes("dive-cel25-etb") && reads.filter((r) => r.readKind === "dive").length === 2);
    t("a dive with no market and no outlier note does not ship", !ids.includes("dive-no-market") && !ids.includes("dive-missing-file"));
    t("stale outlier/dive rows from an earlier build are dropped", !ids.includes("outlier-old") && !ids.includes("dive-old") && !ex.reads.some((r) => r.id === "outlier-old"));
    t("price and pokemon reads stay, and the front still starts with a price", ids[0] === "move-1" && ids.includes("move-2") && ids.includes("pokemon-a"));
    t("prices come from the files", reads.find((r) => r.id === "outlier-sv5-pc-etb").price === 499.99 && reads.find((r) => r.id === "dive-cel25-etb").price === 161.99);
    t("extra-reads keeps its other kinds and counts the new ones", ex.reads.some((r) => r.id === "lag-1") && ex.flagged.count === 2 && ex.dives.count === 2);
    t("Flagged and Dive filters are full", browse.filters.flagged.items.length === 2 && browse.filters.dive.items.length === 2);
    t("summary reports what shipped", summary.outliers === 2 && summary.dives === 2);
    const teaser = reads.find((r) => r.id === "dive-sv5-pc-etb").path;
    t("the outlier note ends its sentence before the dive line", teaser.includes("— review. Deeper look on the chart.") && !/review Deeper/.test(teaser));
    t("no sold or volume wording ships", reads.every((r) => !/\b(solds?|volume)\b/i.test(String(r.path || ""))));
  } finally { await rm(full, { recursive: true, force: true }); }

  // ── source files have none: honestly absent ──
  const empty = await fixture({ withSources: false });
  try {
    const summary = await writeFeedExtras(empty, { asOf: "2026-10-06", volume: [], reads: [LEAD[3], LEAD[4]] }, BROWSE_ARGS);
    const reads = (await get(empty, "research/assets/public/reads.json")).reads;
    const browse = await get(empty, "research/assets/public/feed/browse.json");
    const ex = await get(empty, "research/assets/public/feed/extra-reads.json");
    t("no source rows means no outlier or dive reads", !reads.some((r) => r.readKind === "outlier" || r.readKind === "dive") && !ex.reads.some((r) => r.readKind === "outlier" || r.readKind === "dive"));
    t("empty filters say so honestly", browse.filters.flagged.items.length === 0 && browse.filters.dive.items.length === 0 && browse.filters.flagged.empty === "No flagged prices." && browse.filters.dive.empty === "No deep dives.");
    t("counts are zero, not invented", ex.flagged.count === 0 && ex.dives.count === 0 && summary.outliers === 0 && summary.dives === 0);
    t("price reads survive an empty rebuild", reads.map((r) => r.id).join() === "move-1,pokemon-a,move-2");
  } finally { await rm(empty, { recursive: true, force: true }); }

  // ── the nightly script uses this path ──
  const src = await readFile(join(ROOT, "scripts/build-feed.mjs"), "utf8");
  t("build-feed.mjs rebuilds extras through writeFeedExtras", /writeFeedExtras\(ROOT,/.test(src) && !/\bwriteExtra\(/.test(src));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("feed-extras-nightly.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
