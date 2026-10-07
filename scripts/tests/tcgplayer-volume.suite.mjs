// tcgplayer-volume.suite.mjs — TCGplayer sold counts from PPT set raws.
// Nulls are never filled, the window holds complete days only, a card is kept
// only when its id, number and printing verify against the catalog, and the
// feed ships volume reads only when the derived file has a real count.
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VOLUME_SOURCE,
  catalogIndex,
  cardVolume,
  fullWindow,
  mergeVolumeDoc,
  normalizeNumber,
  serializeVolumeDoc,
  setVolumes,
  shiftDay,
  windowCount,
} from "../lib/tcgplayer-volume.mjs";
import { MAX_READS, volumeRead, volumeReads } from "../lib/volume-reads.mjs";
import { restorePrivate, stagePrivate } from "../lib/private-ppt.mjs";
import { buildBrowse } from "../lib/extra-reads.mjs";
import { updateVolumeFile } from "../compute-tcgplayer-volume.mjs";
import { writeFeedExtras } from "../build-extra-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRICE_KEYS = /"(tcgMarket|unopenedPrice|pptMarket|market|marketPrice|price)"\s*:/;

async function put(root, rel, value) {
  await mkdir(dirname(join(root, rel)), { recursive: true });
  await writeFile(join(root, rel), typeof value === "string" ? value : JSON.stringify(value));
}
const get = async (root, rel) => JSON.parse(await readFile(join(root, rel), "utf8"));

/** Daily NM history ending the day before the scrape, like a real PPT raw. */
function history(lastDay, vols) {
  return vols.map((v, i) => ({ date: `${shiftDay(lastDay, -(vols.length - 1 - i))}T00:00:00.000Z`, market: 1.23, volume: v }));
}
function card(pid, number, variants) {
  return { tcgPlayerId: String(pid), name: `Card ${pid}`, cardNumber: number, prices: { market: 9.99 }, priceHistory: { variants } };
}
const CATALOG = [
  { id: "tcgcsv-101", tcgplayerProductId: 101, name: "Alpha - 001/100", number: "001/100", set: "Test Set", kind: "single", printing: "Holofoil", price: 12 },
  { id: "tcgcsv-102", tcgplayerProductId: 102, name: "Beta", number: "002/100", set: "Test Set", kind: "single", printing: "Normal", price: 8 },
  { id: "tcgcsv-103", tcgplayerProductId: 103, name: "Gamma", number: "003/100", set: "Test Set", kind: "single", printing: "Normal", price: 50 },
  { id: "tcgcsv-104", tcgplayerProductId: 104, name: "Delta", number: "004/100", set: "Test Set", kind: "single", printing: null, price: 7 },
  { id: "tcgcsv-105", tcgplayerProductId: 105, name: "Box", number: null, set: "Test Set", kind: "sealed", printing: null, price: 100 },
  { id: "tcgcsv-106", tcgplayerProductId: 106, name: "Cheap", number: "006/100", set: "Test Set", kind: "single", printing: "Normal", price: 0.25 },
  { id: "tcgcsv-107", tcgplayerProductId: 107, name: "Quiet", number: "007/100", set: "Test Set", kind: "single", printing: "Normal", price: 20 },
];
// Scrape day 2026-10-06 → history ends 2026-10-05 (partial) → window ends 2026-10-04.
const SCRAPE = "2026-10-06";
const LAST = "2026-10-05";
function raw() {
  const thirtyTwo = (fill) => Array.from({ length: 32 }, (_, i) => fill(i));
  return {
    metadata: { historyWindow: { days: 180, from: "2026-04-09", to: SCRAPE } },
    data: [
      // 101: Holofoil NM has 1 sale every other day; the partial last day has 50 that must not count.
      card(101, "1/100", {
        Normal: { "Near Mint": { history: history(LAST, thirtyTwo(() => 9)) } },
        Holofoil: {
          "Near Mint": { history: history(LAST, [...thirtyTwo((i) => (i % 2 ? 1 : null)).slice(0, 31), 50]) },
          "Lightly Played": { history: history(LAST, thirtyTwo(() => 7)) },
        },
      }),
      // 102: card number disagrees with the catalog → skipped.
      card(102, "099/100", { Normal: { "Near Mint": { history: history(LAST, thirtyTwo(() => 1)) } } }),
      // 103: only 10 days of history → no full 30-day window.
      card(103, "003/100", { Normal: { "Near Mint": { history: history(LAST, Array.from({ length: 10 }, () => 2)) } } }),
      // 104: catalog has no printing → skipped.
      card(104, "004/100", { Normal: { "Near Mint": { history: history(LAST, thirtyTwo(() => 1)) } } }),
      // 105: sealed in the catalog → not a single → skipped.
      card(105, "", { Normal: { "Near Mint": { history: history(LAST, thirtyTwo(() => 1)) } } }),
      // 106: real count but under the market floor for a read.
      card(106, "006/100", { Normal: { "Near Mint": { history: history(LAST, thirtyTwo(() => 3)) } } }),
      // 107: all null → zero sold; listed on card pages, never a read.
      card(107, "007/100", { Normal: { "Near Mint": { history: history(LAST, thirtyTwo(() => null)) } } }),
      // 999: not in the catalog.
      card(999, "009/100", { Normal: { "Near Mint": { history: history(LAST, thirtyTwo(() => 1)) } } }),
    ],
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  // ── window math ──
  const h = [
    { date: "2026-10-01T00:00:00.000Z", volume: 2 },
    { date: "2026-10-02T00:00:00.000Z", volume: null },
    { date: "2026-10-03T00:00:00.000Z", volume: 3 },
  ];
  const w = windowCount(h, "2026-09-30", "2026-10-03");
  t("null volume adds nothing and is never filled", w.sold === 5);
  t("daysWithData counts days that have a point, null or not", w.daysWithData === 3 && w.days === 4);
  t("a gap day makes the window not full", !fullWindow({ window7d: { from: "2026-09-27", to: "2026-10-03", daysWithData: 6 } }, 7));
  t("card numbers normalise", normalizeNumber("065a/119") === "65a" && normalizeNumber("1/100") === normalizeNumber("001/100") && normalizeNumber("SWSH029") === "swsh029");

  // ── catalog verification ──
  const dupIndex = catalogIndex([...CATALOG, { id: "tcgcsv-101b", tcgplayerProductId: 101, kind: "single", printing: "Normal" }]);
  t("a product id seen twice in the catalog is dropped, not guessed", !dupIndex.has("101"));
  const index = catalogIndex(CATALOG);
  t("catalog index holds singles only", index.has("101") && !index.has("105"));

  const got = setVolumes(raw(), index);
  const a = got.rows["tcgcsv-101"];
  t("window ends two days before the scrape (complete days only)", a.window30d.to === "2026-10-04" && a.window7d.to === "2026-10-04");
  t("30-day window is inclusive and 30 days long", a.window30d.from === "2026-09-05" && fullWindow(a, 30));
  t("count uses the catalog printing in Near Mint only", a.printing === "Holofoil" && a.sold30d === 15 && a.sold7d === 3);
  t("the partial newest day never counts", a.sold30d < 50);
  t("number mismatch is skipped", !got.rows["tcgcsv-102"] && got.skipped["card number differs"] === 1);
  t("missing catalog printing is skipped", !got.rows["tcgcsv-104"] && got.skipped["catalog has no printing"] === 1);
  t("sealed and unknown ids are skipped", !got.rows["tcgcsv-105"] && !got.rows["tcgcsv-999"] && got.skipped["not in catalog"] === 2);
  t("short history is kept but not full", got.rows["tcgcsv-103"] && !fullWindow(got.rows["tcgcsv-103"], 30) && got.rows["tcgcsv-103"].window30d.daysWithData === 9);
  t("all-null history is a real zero", got.rows["tcgcsv-107"].sold30d === 0 && fullWindow(got.rows["tcgcsv-107"], 30));
  const twice = raw();
  twice.data.push(card(101, "1/100", twice.data[0].priceHistory.variants));
  t("a tcgPlayerId repeated inside one raw is dropped", !setVolumes(twice, index).rows["tcgcsv-101"]);
  t("printing missing in PPT is skipped", cardVolume(card(101, "1/100", { Normal: {} }), CATALOG[0], SCRAPE).skip === "printing missing in PPT");

  // ── merge + output shape ──
  const doc = mergeVolumeDoc(null, got.rows, { updatedOn: SCRAPE });
  const older = { ...got.rows["tcgcsv-101"], scrapedOn: "2026-09-27", sold30d: 999 };
  const merged = mergeVolumeDoc(doc, { "tcgcsv-101": older }, { updatedOn: SCRAPE });
  t("an older scrape never replaces a newer count", merged.cards["tcgcsv-101"].sold30d === 15);
  t("file names its source", doc.source === VOLUME_SOURCE && VOLUME_SOURCE === "TCGplayer sales via PokemonPriceTracker");
  const text = serializeVolumeDoc(doc);
  t("serialized file parses back", JSON.parse(text).cards["tcgcsv-101"].sold30d === 15);
  t("no PPT price field is written", !PRICE_KEYS.test(text));

  // ── reads ──
  const reads = volumeReads(doc, CATALOG, { asOf: SCRAPE });
  t("only cards with a full window, a count above zero and a $5+ market get a read", reads.map((r) => r.sku).join() === "tcgcsv-101");
  const r = reads[0];
  t("read states the count, the window and Near Mint", r.path === "Alpha (Test Set, 001/100): 15 Near Mint copies sold on TCGplayer in the 30 days Sep 5–Oct 4, 3 of them in the last 7 (Sep 28–Oct 4).");
  t("read is attributed and points at the card page", r.sold.source === VOLUME_SOURCE && r.why.startsWith(VOLUME_SOURCE) && r.href === "/c/tcgcsv-101" && r.readKind === "volume");
  t("read never mentions listings or eBay", !/listing|ebay/i.test(r.path + r.why));
  t("no read for a stale window", volumeReads(doc, CATALOG, { asOf: "2026-11-30" }).length === 0);
  t("no read when the ids do not match", volumeRead(got.rows["tcgcsv-101"], CATALOG[1]) === null);
  const bench = { cards: {} };
  const benchItems = [];
  for (let i = 0; i < 45; i += 1) {
    const id = `tcgcsv-${1000 + i}`;
    bench.cards[id] = { ...a, id, tcgplayerProductId: 1000 + i, sold30d: 500 - i };
    benchItems.push({ id, kind: "single", price: 10, tcgplayerProductId: 1000 + i, name: `Card ${i}`, number: "1", set: "Set" });
  }
  const top = volumeReads(bench, benchItems, { asOf: SCRAPE, max: 40 }).map((row) => row.sku);
  const cooled = new Set(top.slice(0, 4));
  const filled = volumeReads(bench, benchItems, { asOf: SCRAPE, max: 40, exclude: cooled });
  t("cooldown is applied before the cap so the shelf still fills", filled.length === 40 && filled.every((row) => !cooled.has(row.sku)));
  t("no file means no reads", volumeReads(null, CATALOG).length === 0);
  t("singular copy reads right", volumeRead({ ...a, sold30d: 1 }, CATALOG[0]).path.includes(": 1 Near Mint copy sold"));

  // ── browse filter ──
  t("no Volume filter without counts", !buildBrowse({ asOf: SCRAPE, cardIds: [], volume: [] }).filters.volume);
  const browse = buildBrowse({ asOf: SCRAPE, cardIds: [], volume: reads });
  t("Volume filter lists the reads when counts exist", browse.filters.volume.items.length === 1 && browse.filters.volume.readKind === "volume");

  // ── compute script + nightly feed path on a fixture root ──
  const root = await mkdtemp(join(tmpdir(), "tcg-volume-"));
  try {
    await put(root, "data/catalog/tcgcsv-latest.json", { asOf: SCRAPE, items: CATALOG });
    const rawDir = join(root, "ppt-raw-private", SCRAPE);
    await put(root, `ppt-raw-private/${SCRAPE}/set-test.json`, raw());
    await put(root, `ppt-raw-private/${SCRAPE}/sealed-1.json`, { data: [] });
    const out = await updateVolumeFile({ root, rawDirs: [rawDir], today: SCRAPE });
    t("compute writes the derived files from set raws", out.written && out.files === 1 && out.counts.full30d === 3);
    const state = await get(root, "ppt-raw-private/tcgplayer-volume.json");
    const pub = await get(root, "data/derived/tcgplayer-volume.json");
    t("every verified card goes to the private state", Object.keys(state.cards).sort().join() === "tcgcsv-101,tcgcsv-103,tcgcsv-106,tcgcsv-107");
    t("the public file holds only the cards a read shows", Object.keys(pub.cards).join() === "tcgcsv-101" && pub.published === 1 && pub.counts.full30d === 3);
    const none = await updateVolumeFile({ root, rawDirs: [join(root, "ppt-raw-private", "2026-10-07")], today: "2026-10-07" });
    t("a day with no set raws leaves the files alone", !none.written && (await get(root, "data/derived/tcgplayer-volume.json")).updatedOn === SCRAPE);
    // A second day merges onto the mounted private state, not onto the public slice.
    const later = raw();
    later.metadata.historyWindow.to = "2026-10-08";
    later.data = [card(101, "1/100", { Holofoil: { "Near Mint": { history: history("2026-10-07", Array.from({ length: 32 }, () => 1)) } } })];
    await put(root, "ppt-raw-private/2026-10-08/set-test.json", later);
    await updateVolumeFile({ root, rawDirs: [join(root, "ppt-raw-private", "2026-10-08")], today: "2026-10-08" });
    const state2 = await get(root, "ppt-raw-private/tcgplayer-volume.json");
    t("the next day merges onto the private state", state2.cards["tcgcsv-101"].scrapedOn === "2026-10-08" && state2.cards["tcgcsv-101"].sold30d === 30 && state2.cards["tcgcsv-107"].scrapedOn === SCRAPE);

    // Private staging: the state goes to catchem-data-private/data/meta and comes back; not into raw/<date>.
    const dest = join(root, "private");
    const actions = await stagePrivate({ checkout: join(root, "nothing"), rawDir: join(root, "ppt-raw-private"), dest, date: "2026-10-08" });
    const dayCopy = await readFile(join(dest, "raw/2026-10-08/tcgplayer-volume.json"), "utf8").then(() => true, () => false);
    t("volume state is staged privately, outside the day's raw copy", actions.includes("tcgplayer-volume") && !dayCopy && (await get(dest, "data/meta/tcgplayer-volume.json")).cards["tcgcsv-101"]);
    const back = join(root, "mounted");
    const restored = await restorePrivate({ clone: dest, root: back });
    t("volume state mounts back into ppt-raw-private", restored.includes("tcgplayer-volume") && (await get(back, "ppt-raw-private/tcgplayer-volume.json")).cards["tcgcsv-107"]);

    await put(root, "research/assets/public/reads.json", { asOf: SCRAPE, reads: [
      { id: "move-1", sku: "tcgcsv-1", readKind: "price", kind: "single", price: 10, path: "p1" },
      { id: "move-2", sku: "tcgcsv-2", readKind: "price", kind: "single", price: 20, path: "p2" },
      { id: "volume-old", sku: "tcgcsv-1", readKind: "volume", kind: "volume", path: "stale" },
    ] });
    await mkdir(join(root, "research/assets/public/feed"), { recursive: true });
    const summary = await writeFeedExtras(root, { asOf: SCRAPE, reads: [] }, { asOf: SCRAPE, cardIds: ["a"], rankedIds: [], news: [], waves: [] });
    const lead = (await get(root, "research/assets/public/reads.json")).reads;
    const ex = await get(root, "research/assets/public/feed/extra-reads.json");
    const br = await get(root, "research/assets/public/feed/browse.json");
    t("nightly path ships the volume read", summary.volume === 1 && ex.reads.some((x) => x.id === "volume-tcgcsv-101") && lead.some((x) => x.id === "volume-tcgcsv-101"));
    t("stale volume rows are dropped", !lead.some((x) => x.id === "volume-old"));
    t("Volume filter is on browse", br.filters.volume?.items?.[0]?.sold?.count30d === 30);
    const publicDirs = await readdir(join(root, "research/assets/public/feed"));
    t("no bulk per-card volume table is published", !publicDirs.includes("volume"));

    await rm(join(root, "data/derived/tcgplayer-volume.json"));
    const empty = await writeFeedExtras(root, { asOf: SCRAPE, reads: [] }, { asOf: SCRAPE, cardIds: ["a"], rankedIds: [], news: [], waves: [] });
    const lead2 = (await get(root, "research/assets/public/reads.json")).reads;
    const br2 = await get(root, "research/assets/public/feed/browse.json");
    t("no derived file: no volume read and no Volume filter", empty.volume === 0 && !lead2.some((x) => x.readKind === "volume") && !br2.filters.volume);
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  // ── the committed public file is a display slice, not the table ──
  try {
    const committed = JSON.parse(await readFile(join(ROOT, "data/derived/tcgplayer-volume.json"), "utf8"));
    t("committed public volume file holds at most the read cards", Object.keys(committed.cards || {}).length <= MAX_READS);
  } catch { t("committed public volume file is readable", false); }

  // ── nightly wiring, no workflow edit ──
  const refresh = await readFile(join(ROOT, "scripts/ppt-refresh.mjs"), "utf8");
  t("ppt-refresh updates the volume file from today's raws", /updateVolumeFile\(\{ root: ROOT, rawDirs: \[join\(ROOT, "ppt-raw-private", today\)\]/.test(refresh));
  return fail;
}
