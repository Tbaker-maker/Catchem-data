// Shell tokens on a git add line are not promised artifacts.
// A missing path is still a promise, so a real gap stays blocking.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectGitAddPaths, collectPromisedPaths } from "../lib/git-add-paths.mjs";
import { freshnessBlocks, stalePromisedPaths, staticAssetExcuse } from "../lib/static-asset-freshness.mjs";
import { heldReportIfSpreadHeld } from "../lib/spread-held.mjs";
import { heldSupplyWatch } from "../lib/supply-held.mjs";
import { pptOffCursor, pptOffUsage, skippedSlabStatus } from "../lib/ppt-skip-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function pathsIn(src) {
  const out = [];
  for (const match of String(src).matchAll(/git add ([^\n]+)/g)) {
    out.push(...collectGitAddPaths(match[1]));
  }
  return out;
}

// Today's feed commit, copied so the $p case does not need a workflow rewrite.
const FEED_FIXTURE = [
  'SET_PATHS="research/assets/public/sets.json research/assets/public/sets research/assets/public/buckets research/assets/public/artists research/assets/public/artists.json research/assets/public/search-lite.json research/assets/public/redirects.json research/assets/public/indexes.json research/assets/public/movers.json research/assets/public/price-hold.json research/assets/public/receipts.json research/assets/public/accuracy.json research/assets/public/search-rank.mjs research/assets/public/sitemap.xml research/assets/public/set-logos.json research/assets/img/set-logo-tiles.json research/assets/img/set-logo-flags.json research/assets/img/set-logo-filled.json"',
  'for p in $SET_PATHS; do if [ -e "$p" ]; then git add "$p"; fi; done',
  'if compgen -G "research/assets/public/sitemap-*.xml" > /dev/null; then git add research/assets/public/sitemap-*.xml; fi',
  "git add research/assets/img/*/logo.png || true",
  "git add data/sealed-prices.json data/divergence-report.json",
].join("\n");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const logoLine = "research/assets/img/*/logo.png || true";
  const logoPaths = collectGitAddPaths(logoLine);
  t("|| is not a promised path", !logoPaths.includes("||"));
  t("true is not a promised path", !logoPaths.includes("true"));
  t("the logo glob on that line is still promised", logoPaths.length === 1 && logoPaths[0] === "research/assets/img/*/logo.png");

  const mixed = pathsIn(`
    git add research/assets/img/*/logo.png || true
    git add data/not-written.json || true
    git add data/sealed-prices.json
    git add grades-*.json; fi
  `);
  t("a missing output stays on the promise list", mixed.includes("data/not-written.json"));
  t("a real output stays on the promise list", mixed.includes("data/sealed-prices.json"));
  t("fi after a semicolon is not a path", !mixed.includes("fi"));
  t("shell tokens never enter the mixed list", !mixed.includes("||") && !mixed.includes("true") && !mixed.includes("false"));
  t("a shell variable is not a path", collectGitAddPaths('"$p"; fi; done').length === 0 && collectGitAddPaths("$p").length === 0);

  const fixturePaths = collectPromisedPaths(FEED_FIXTURE);
  t("the feed fixture does not promise $p", !fixturePaths.includes("$p") && !fixturePaths.includes('"$p"'));
  t("the feed fixture does not promise sitemap-01.xml", !fixturePaths.includes("research/assets/public/sitemap-01.xml"));
  t("the feed fixture keeps the shard glob", fixturePaths.includes("research/assets/public/sitemap-*.xml"));
  t("the feed fixture still promises sitemap.xml", fixturePaths.includes("research/assets/public/sitemap.xml"));
  t("the feed fixture still promises sealed-prices.json", fixturePaths.includes("data/sealed-prices.json"));

  const nowMs = Date.parse("2026-11-28T00:00:00.000Z");
  const stale = stalePromisedPaths(
    ["data/sealed-prices.json", "research/assets/public/sitemap.xml"],
    {
      lastChanged: {
        "data/sealed-prices.json": "2026-11-25T00:00:00.000Z",
        "research/assets/public/sitemap.xml": "2026-11-27T18:00:00.000Z",
      },
      nowMs,
      hours: 24,
    },
  );
  t("a stale price file still fails on a fixture clock", stale.some((row) => row.path === "data/sealed-prices.json"));
  t("a file inside two runs does not fail on a fixture clock", !stale.some((row) => row.path === "research/assets/public/sitemap.xml"));
  const missing = stalePromisedPaths(["data/not-written.json"], { lastChanged: {}, nowMs, hours: 24 });
  t("a promised file with no commit still fails", missing.some((row) => row.path === "data/not-written.json"));

  const sealed = await readFile(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const live = pathsIn(sealed);
  const promised = collectPromisedPaths(sealed);
  t("the sealed workflow does not promise ||", !live.includes("||"));
  t("the sealed workflow does not promise true", !live.includes("true"));
  t("the sealed workflow still promises sealed-prices.json", live.includes("data/sealed-prices.json"));
  t("the sealed workflow still promises the logo glob", live.includes("research/assets/img/*/logo.png"));
  t("the sealed workflow does not promise $p", !promised.includes("$p") && !promised.includes('"$p"'));
  t("the sealed workflow does not promise sitemap-01.xml", !promised.includes("research/assets/public/sitemap-01.xml"));
  t("the sealed workflow still promises sitemap.xml", promised.includes("research/assets/public/sitemap.xml"));
  t("the price commit stages divergence-report.json", promised.includes("data/divergence-report.json"));

  const held = heldReportIfSpreadHeld({
    priceSource: "TCGplayer market",
    products: [{ id: "a" }, { id: "b" }],
  }, "2026-11-28T00:00:00.000Z");
  t("a held spread still writes when the crosscheck is absent", held && held.dataStatus === "held" && held.generatedAt === "2026-11-28T00:00:00.000Z" && held.rows.length === 0 && held.skipped.length === 2);
  t("a held report does not invent an ask row", held.rows.every((row) => !("ebayAskMedian" in row)) && held.skipped.every((row) => row.reason && row.id));
  t("a legacy priced file does not take the held path", heldReportIfSpreadHeld({ products: [{ id: "a", priceMedian: 3 }] }) === null);
  const divergence = await readFile(join(ROOT, "scripts/compute-divergence.mjs"), "utf8");
  const heldAt = divergence.indexOf("heldReportIfSpreadHeld");
  const bailAt = divergence.indexOf("if (!tcg?.products) process.exit(0)");
  t("the held report is chosen before a missing crosscheck exits", heldAt >= 0 && bailAt > heldAt);

  const supply = heldSupplyWatch("2026-11-28T00:00:00.000Z");
  t("supply watch writes a held report when TCG history is absent", supply.dataStatus === "held" && supply.generatedAt === "2026-11-28T00:00:00.000Z" && supply.rows.length === 0 && supply.counts.compared == null && supply.counts.read === 0);
  const supplySrc = await readFile(join(ROOT, "scripts/compute-supply-watch.mjs"), "utf8");
  const supplyHeldAt = supplySrc.indexOf("heldSupplyWatch");
  const supplyBailAt = supplySrc.indexOf("if (!Array.isArray(tcgH)) process.exit(0)");
  t("supply watch does not exit before the held write", supplyHeldAt >= 0 && (supplyBailAt === -1 || supplyHeldAt < supplyBailAt));

  const usage = pptOffUsage({ asOf: "2026-11-25", credits: { usedToday: 128 } }, new Date("2026-11-28T00:00:00.000Z"));
  t("PPT_OFF usage is a zero-credit skip", usage.status === "skipped" && usage.credits.used.total === 0 && usage.credits.usedThisRun === 0 && usage.asOf === "2026-11-28");
  t("PPT_OFF usage does not carry an older day's credits forward", usage.credits.usedToday === 0);
  const sameDay = pptOffUsage({ asOf: "2026-11-28", credits: { usedToday: 12 } }, new Date("2026-11-28T00:00:00.000Z"));
  t("PPT_OFF keeps credits already counted today", sameDay.credits.usedToday === 12);
  const cursor = pptOffCursor({ asOf: "2026-11-25", done: ["sealed-1"], advanced: true }, new Date("2026-11-28T00:00:00.000Z"));
  t("PPT_OFF keeps the resume ids", cursor.done.join() === "sealed-1" && cursor.advanced === false && cursor.asOf === "2026-11-28");
  const slab = skippedSlabStatus("2026-11-28");
  t("PPT_OFF slab status writes no median and no candidate list", slab.status === "skipped" && slab.creditsUsed === 0 && slab.mediansWritten === 0 && slab.candidates === 0 && slab.cards.length === 0 && slab.asOf === "2026-11-28");
  const refreshSrc = await readFile(join(ROOT, "scripts/ppt-refresh.mjs"), "utf8");
  const slabsSrc = await readFile(join(ROOT, "scripts/ppt-slabs.mjs"), "utf8");
  t("ppt-refresh writes the skip log when PPT_OFF", refreshSrc.includes("pptOffUsage") && refreshSrc.includes("pptOffCursor"));
  t("ppt-slabs writes the skip status when PPT_OFF", slabsSrc.includes("skippedSlabStatus"));

  t("a stale set logo is not a freshness failure",
    staticAssetExcuse("research/assets/img/baseset/logo.png") !== ""
    && staticAssetExcuse("research/assets/img/*/logo.png") !== ""
    && staticAssetExcuse("research/assets/public/set-logos.json") !== ""
    && freshnessBlocks("research/assets/img/baseset/logo.png", 9, "") === false);
  t("a stale data file is still a freshness failure",
    staticAssetExcuse("data/sealed-prices.json") === ""
    && staticAssetExcuse("research/assets/public/counts.json") === ""
    && staticAssetExcuse("data/derived/listing-counts/") === ""
    && staticAssetExcuse("research/assets/public/sitemap.xml") === ""
    && staticAssetExcuse("data/divergence-report.json") === ""
    && freshnessBlocks("data/sealed-prices.json", 9, "") === true
    && freshnessBlocks("data/sealed-prices.json", 1, "") === false
    && freshnessBlocks("data/divergence-report.json", 2, "") === true);

  const guard = await readFile(join(ROOT, "scripts/artifact-freshness.mjs"), "utf8");
  t("the freshness guard uses the static logo excuse", guard.includes("staticAssetExcuse(r.p)"));
  t("the suspect line is still two runs", /const SUSPECT = 2;/.test(guard));
  t("divergence-report is not on the slow list", !/"data\/divergence-report\.json":/.test(guard));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("artifact-freshness.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
