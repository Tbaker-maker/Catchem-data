import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { HISTORY_PPP, HISTORY_PPT, VOLUME_PPP, VOLUME_PPT, writeReplacements } from "../lib/ppp-replace.mjs";

const limits = {
  volumeMinCards: 1,
  shapeMinCards: 1,
  crosscheckMinProducts: 1,
  sealedHistoryMinProducts: 1,
};

function nm(date, listings, market) {
  return { source: "tcgplayer", condition: "Near Mint", date, listings, market, currency: "USD" };
}

export async function runPppReplaceTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };
  const root = await mkdtemp(join(tmpdir(), "ppp-replace-"));
  await mkdir(join(root, "data/meta"), { recursive: true });
  await mkdir(join(root, HISTORY_PPT), { recursive: true });
  const pptHistory = join(root, HISTORY_PPT, "me1-etb.json");
  await writeFile(pptHistory, "{\"id\":\"me1-etb\"}\n");
  await writeFile(join(root, VOLUME_PPT), "{\"cards\":{}}\n");
  const before = await readFile(pptHistory, "utf8");

  const closed = await writeReplacements({ root, volumeShards: { "1": { rows: [{ source: "tcgplayer", condition: "Near Mint", date: "2026-11-01", listings: 3 }] } } });
  t("missing limits write nothing", closed.written.length === 0 && closed.ready === false && /fail closed/.test(closed.reason));

  await writeFile(join(root, "data/meta/ppp-replace-limits.json"), JSON.stringify(limits));
  const ebayOnly = await writeReplacements({
    root,
    volumeShards: { "9": { rows: [{ date: "2026-11-01", currency: "USD", sales: 4, priced_sales: 4, median: 2 }] } },
    shapeCards: [],
    pulls: [],
    historyRecords: [],
  });
  t("eBay sales rows are not listings counted and do not write", ebayOnly.written.length === 0 && /listings/.test(ebayOnly.reason));

  const own = new Map([[10, new Map([["2026-11-10", 10], ["2026-11-11", 10], ["2026-11-12", 10]])]]);
  const wrote = await writeReplacements({
    root,
    today: "2026-11-14",
    volumeShards: { "84856": { rows: [nm("2026-11-01", 4, 1)] } },
    shapeCards: [{
      id: "tcgcsv-84856",
      printing: "Normal",
      scrapedOn: "2026-11-14",
      rows: [
        nm("2026-11-01", 1, 1), nm("2026-11-02", 1, 1), nm("2026-11-03", 1, 1),
        nm("2026-11-04", 1, 1), nm("2026-11-05", 1, 1), nm("2026-11-06", 1, 1),
        nm("2026-11-07", 1, 1),
        { source: "tcgplayer", condition: "Lightly Played", date: "2026-11-07", market: 0.5, listings: 1 },
      ],
    }],
    pulls: [{
      tcgPlayerId: "98562",
      body: { prices: [{ source: "tcgplayer", currency: "USD", condition: "Unopened", market_price: 12, created_at: "2026-11-13T00:00:00.000Z" }] },
    }],
    idByTid: new Map([["98562", "deoxys-pack"]]),
    historyRecords: [{
      pid: 10,
      rows: ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"].map((date) => ({
        date, source: "tcgplayer", currency: "USD", condition: "Unopened", avg: 10,
      })),
    }],
    ownByPid: own,
  });
  t("a full fixture writes beside PPT and does not replace it", wrote.written.includes(VOLUME_PPP) && wrote.written.includes(HISTORY_PPP) && (await readFile(pptHistory, "utf8")) === before && !(await readFile(join(root, HISTORY_PPP, "10.json"), "utf8")).includes("PokemonPriceTracker"));
  const cross = JSON.parse(await readFile(join(root, "data/sealed-crosscheck-ppp.json"), "utf8"));
  t("the crosscheck clock is the pull time, not a made-up midnight", cross.updatedAt === "2026-11-13T00:00:00.000Z" && cross.products.length === 1 && !("condition" in cross.products[0]));
  await rm(root, { recursive: true, force: true });
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPppReplaceTests();
  if (fail) process.exit(1);
}
