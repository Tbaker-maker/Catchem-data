import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { pptOff, isPptDataPath, assertPptCallAllowed } from "../lib/ppt-off.mjs";
import { readCrosscheck } from "../lib/ppt-paths.mjs";
import { loadMarketHistory } from "../lib/market-history.mjs";
import { loadPptCards, loadPptSealed } from "../ppp-refresh.mjs";
import { datasetCoverage } from "../lib/ppt-cutover.mjs";
import { comparePulls } from "../lib/ppp-compare.mjs";
import { updateVolumeFile } from "../compute-tcgplayer-volume.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const LIVE_CALLS = [
  "scripts/resolve-set-ids.mjs",
  "scripts/fetch-sealed-crosscheck.mjs",
  "scripts/fetch-singles-enrichment.mjs",
  "scripts/ppt-refresh.mjs",
  "scripts/enrich-by-set.mjs",
  "scripts/extend-crosscheck-map.mjs",
  "scripts/verify-watchlist-prices.mjs",
  "scripts/graded-window-probe.mjs",
  "scripts/ppt-history-backfill.mjs",
  "scripts/build-crosscheck-map.mjs",
];

function withOff(fn) {
  const prev = process.env.PPT_OFF;
  process.env.PPT_OFF = "1";
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev == null) delete process.env.PPT_OFF;
      else process.env.PPT_OFF = prev;
    });
}

export async function runPptOffTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };

  const saved = process.env.PPT_OFF;
  delete process.env.PPT_OFF;
  t("PPT_OFF defaults off", pptOff() === false);
  t("only 1, true, or yes turn the switch on", pptOff({ PPT_OFF: "1" }) && pptOff({ PPT_OFF: "true" }) && pptOff({ PPT_OFF: "yes" }) && !pptOff({ PPT_OFF: "0" }));
  if (saved == null) delete process.env.PPT_OFF;
  else process.env.PPT_OFF = saved;

  t("a PPT history path is recognized and a PPP path is not", isPptDataPath("data/history/ppt-sealed/a.json") && isPptDataPath("ppt-raw-private/2026-11-14/sealed-1.json") && !isPptDataPath("raw/ppp/2026-11-14/card-1.json") && !isPptDataPath("data/ppp/enrich-report.json"));

  let refused = false;
  await withOff(async () => {
    try { assertPptCallAllowed(); } catch (err) { refused = err.code === "PPT_OFF"; }
  });
  t("a PPT call throws instead of sending", refused);

  const root = await mkdtemp(join(tmpdir(), "ppt-off-"));
  await mkdir(join(root, "ppt-raw-private/crosscheck"), { recursive: true });
  await mkdir(join(root, "ppt-raw-private/2026-11-14"), { recursive: true });
  await mkdir(join(root, "data/history/ppt-sealed"), { recursive: true });
  await mkdir(join(root, "data/meta"), { recursive: true });
  await writeFile(join(root, "ppt-raw-private/crosscheck/sealed-crosscheck.json"), JSON.stringify({ products: [{ id: "box", tcgMarket: 10 }] }));
  await writeFile(join(root, "ppt-raw-private/2026-11-14/sealed-98562.json"), JSON.stringify({ data: [{ tcgPlayerId: 98562, unopenedPrice: 12 }] }));
  await writeFile(join(root, "ppt-raw-private/2026-11-14/set-sv1.json"), JSON.stringify({
    data: [{ tcgPlayerId: 84856, prices: { variants: { Normal: { "Near Mint": { price: 1 } } } } }],
  }));
  await writeFile(join(root, "data/history/ppt-sealed/box.json"), JSON.stringify({ id: "box", points: [{ date: "2026-11-01", market: 9 }] }));
  await writeFile(join(root, "data/meta/ppp-replace-limits.json"), JSON.stringify({
    volumeMinCards: 2,
    shapeMinCards: 2,
    crosscheckMinProducts: 2,
    sealedHistoryMinProducts: 2,
  }));
  await writeFile(join(root, "data/meta/tcgplayer-volume.json"), JSON.stringify({ counts: { cards: 3 }, cards: { a: {}, b: {}, c: {} } }));

  await withOff(async () => {
    const cross = await readCrosscheck(root, "sealed-crosscheck.json");
    t("PPT_OFF does not return a crosscheck that is on disk", cross == null);
    const hist = await loadMarketHistory(root, { allowPpt: true });
    t("PPT_OFF ignores allowPpt", hist.coverage.pptProducts === 0);
    const sealed = await loadPptSealed(root, "2026-11-14");
    const cards = await loadPptCards(root, "2026-11-14");
    t("PPT_OFF compare loaders stay empty while the files exist", sealed.size === 0 && cards.size === 0);
    const vol = await updateVolumeFile({ root, rawDirs: [join(root, "ppt-raw-private/2026-11-14")], today: "2026-11-14" });
    t("PPT_OFF does not write listings counted from PPT raw", vol.written === false && vol.files === 0);
    const seen = [];
    const cov = await datasetCoverage(root, {
      readJson: async (path) => {
        seen.push(path);
        return null;
      },
    });
    t("PPT_OFF coverage does not open the PPT volume file", seen.every((path) => !path.endsWith(`${join("data/meta", "tcgplayer-volume.json")}`)) && cov.pptOff === true && cov.ready === false);
    t("an under-minimum dataset names a fallback and does not switch", cov.rows.every((row) => row.switched === false && row.use == null && row.fallback));
  });

  const matched = comparePulls({
    pppSealed: [{
      tcgPlayerId: "98562",
      body: { prices: [{ source: "tcgplayer", currency: "USD", condition: "Unopened", market_price: 100 }] },
    }],
    pppCards: [{
      tcgPlayerId: "84856",
      body: { prices: [{ source: "tcgplayer", currency: "USD", condition: "Near Mint", variant: "Normal", market_price: 0.4 }] },
    }],
    tcgcsvByTid: new Map([
      ["98562", { kind: "sealed", price: 100 }],
      ["84856", { kind: "single", printings: [{ name: "Normal", price: 0.32 }] }],
    ]),
    pptSealedByTid: new Map([
      ["98562", { data: [{ tcgPlayerId: 98562, unopenedPrice: 110 }] }],
    ]),
    pptCardBodies: [{
      data: [{
        tcgPlayerId: 84856,
        prices: {
          primaryPrinting: "Normal",
          variants: { Normal: { "Near Mint": { price: 0.32 } } },
        },
      }],
    }],
  });
  t("a matched sealed row and a matched card row are not 0", matched.sealedVsPpt.nCompared > 0 && matched.singlesVsPpt.nCompared > 0);
  const empty = comparePulls({ pppSealed: [], pppCards: [], tcgcsvByTid: new Map(), pptSealedByTid: new Map(), pptCardBodies: [] });
  t("the same assertion would fail when both sides are empty", !(empty.sealedVsPpt.nCompared > 0 && empty.singlesVsPpt.nCompared > 0));

  for (const rel of LIVE_CALLS) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    const gate = text.indexOf("pptOff()");
    const call = text.search(/fetch\s*\(|fetchWithBackoff\s*\(/);
    t(`${rel} gates before any PPT request`, gate >= 0 && (call === -1 || gate < call));
  }

  await rm(root, { recursive: true, force: true });
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPptOffTests();
  if (fail) process.exit(1);
}
