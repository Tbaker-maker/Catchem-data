// Read quality, from a user's eyes. Every case in the ruling.
import { readFile, readdir, mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED } from "../lib/public-bundle.mjs";
import { flag } from "../flags.mjs";
import { buildReadLibrary, writeReadLibrary, boardImage, BRAND_TILE } from "../lib/read-library.mjs";
import {
  FOOTER,
  chaseInMorningFile,
  priceOnExactDay,
  printingSentence,
  publishReads,
  quietNight,
  sentenceForDay,
  whyLeak,
} from "../lib/read-quality.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASOF = "2026-10-08";

function card(partial) {
  return {
    id: partial.id,
    sku: partial.sku,
    kind: "single",
    name: partial.name || "Pikachu",
    set: partial.set || "Base Set",
    number: partial.number || "",
    headline: partial.headline,
    path: partial.path || partial.headline,
    price: partial.price,
    changePct: partial.changePct,
    windowDays: partial.windowDays,
    asOf: partial.asOf || ASOF,
    source: "TCGplayer market",
    href: `/c/${partial.sku}`,
  };
}

function libOf({ cards = {}, series = new Map(), extra = { lag: { reads: [] }, group: { reads: [] } }, dailyFiles = null, library = false, sealed = null, radar = null }) {
  return buildReadLibrary({
    catalogue: { asOf: ASOF, source: "TCGplayer market", cards },
    extra,
    series,
    dailyFiles,
    library,
    sealed,
    radar,
  });
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("reads.library is the one switch, a boolean", typeof flag("reads.library") === "boolean");
  t("ppt and volume stay off", flag("ppt.publicDisplay") === false && flag("reads.volume") === false);

  const day03 = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily/2026-10-03.json"), "utf8"));
  const day10 = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily/2026-10-10.json"), "utf8"));
  const gy03 = day03.prices.find((row) => row.id === 516693);
  const gy10 = day10.prices.find((row) => row.id === 516693);
  t("2026-10-03 Gyarados market is Holofoil 0.37", gy03 && gy03.market === 0.37 && gy03.printing === "Holofoil");
  const line03 = printingSentence({ ...gy03, name: "Gyarados", set: "SV: Scarlet & Violet 151", number: "130/165", asOf: "2026-10-03" });
  t("2026-10-03 sentence is $0.37 and not $1.36", line03.includes("$0.37") && line03.includes("Holofoil") && !line03.includes("1.36"));
  const poisoned = printingSentence({
    id: 516693,
    name: "Gyarados",
    set: "SV: Scarlet & Violet 151",
    number: "130/165",
    printing: "Holofoil",
    market: 1.36,
    asOf: "2026-10-03",
    printings: [{ name: "Holofoil", price: 0.37 }, { name: "Reverse Holofoil", price: 1.36 }],
  });
  t("two printings name Holofoil and never render $1.36", poisoned.includes("Holofoil") && poisoned.includes("$0.37") && !poisoned.includes("1.36"));
  const line10 = printingSentence({ ...gy10, name: "Gyarados", set: "SV: Scarlet & Violet 151", number: "130/165", asOf: "2026-10-10" });
  t("2026-10-10 names Holofoil $0.37 and not the reverse", line10.includes("Holofoil $0.37") && !line10.includes("1.27") && !line10.includes("1.36"));

  const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const duds = catalog.items.filter((item) => /dudunsparce/i.test(item.name || ""));
  t("catalog has Dudunsparce rows", duds.length >= 8);
  // Live market can return to $1.11 (it did on 2026-10-28). Guard that the catalog
  // tracks the newest daily file, not that $1.11 is forever banned from the live catalog.
  const dailyDir = join(ROOT, "data/history/tcgcsv-daily");
  const dayFiles = (await readdir(dailyDir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  const newestDay = dayFiles.at(-1);
  const newestDoc = JSON.parse(await readFile(join(dailyDir, newestDay), "utf8"));
  const liveDud = duds.find((item) => item.tcgplayerProductId === 623605);
  const newestRow = newestDoc.prices.find((row) => row.id === 623605);
  t(
    "catalog Dudunsparce ex 623605 matches newest daily market",
    Boolean(liveDud && newestRow && liveDud.price === newestRow.market),
  );
  const dailyNames = ["2026-09-26", "2026-09-27", "2026-09-29", "2026-10-03", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"];
  const docs = new Map();
  for (const day of dailyNames) docs.set(day, JSON.parse(await readFile(join(ROOT, `data/history/tcgcsv-daily/${day}.json`), "utf8")));
  const on1010 = duds.filter((item) => priceOnExactDay(docs.get("2026-10-10"), item.tcgplayerProductId, 1.11));
  const saidOn1010 = duds.some((item) => sentenceForDay({ ...item, price: 1.11, market: 1.11 }, docs.get("2026-10-10")));
  t("Dudunsparce $1.11 is not printed on 2026-10-10", on1010.length === 0 && saidOn1010 === false);
  let invented = false;
  for (const [day, doc] of docs) {
    for (const item of duds) {
      const said = sentenceForDay({ ...item, price: 1.11, market: 1.11 }, doc);
      const onFile = priceOnExactDay(doc, item.tcgplayerProductId, 1.11);
      if (said && !onFile) invented = true;
      if (!onFile && said) invented = true;
    }
  }
  t("a Dudunsparce price is printed only when that day file contains it", invented === false);
  const sep27 = docs.get("2026-09-27").prices.find((row) => row.id === 623605);
  t("2026-09-27 file really has Dudunsparce ex 623605 at $1.11", sep27 && sep27.market === 1.11 && sep27.printing === "Holofoil");
  const later = sentenceForDay({ id: 623605, name: "Dudunsparce ex - 178/159", price: 1.11, market: 1.11, printing: "Holofoil" }, docs.get("2026-10-10"));
  t("that $1.11 is not reused on 2026-10-10", later == null && priceOnExactDay(docs.get("2026-10-10"), 623605, 1.11) === false);

  const moverCard = card({
    id: "move-tcgcsv-1-7",
    sku: "tcgcsv-1",
    headline: "Pikachu is up 20% over 7 days, from $10.00 to $12.00.",
    price: 12,
    changePct: 20,
    windowDays: 7,
  });
  const series = new Map([[1, new Map([["2026-10-01", 10], ["2026-10-08", 12]])]]);
  const missing = libOf({ cards: { a: moverCard }, series, dailyFiles: new Set([ASOF]) });
  t("missing start file means no movers", missing.counts.mover.qualified === 0 && !missing.board.some((row) => row.signal === "mover"));
  const present = libOf({ cards: { a: moverCard }, series, dailyFiles: new Set(["2026-10-01", ASOF]) });
  t("exact 7-day pair can board", present.board.some((row) => row.signal === "mover" && row.sku === "tcgcsv-1"));

  const plain = card({
    id: "move-tcgcsv-2-7",
    sku: "tcgcsv-2",
    name: "Dragonair",
    headline: "Dragonair is down 7.5% over 7 days, from $18.88 to $17.46.",
    price: 17.46,
    changePct: -7.5,
    windowDays: 7,
  });
  const plainLib = libOf({
    cards: { b: plain },
    series: new Map([[2, new Map([["2026-10-01", 18.88], ["2026-10-08", 17.46]])]]),
  });
  t("a plain row under 8% never boards", plainLib.counts.plain.qualified === 1 && plainLib.counts.plain.boarded === 0 && plainLib.board.length === 0);

  const tiny = libOf({
    cards: { g: card({ id: "move-tcgcsv-9-7", sku: "tcgcsv-9", name: "Mew", headline: "Mew.", price: 1.4, changePct: 1, windowDays: 7 }) },
    series: new Map([[9, new Map([["2026-10-04", 1], ["2026-10-05", 1.1], ["2026-10-06", 1.2], ["2026-10-07", 1.3], ["2026-10-08", 1.4]])]]),
  });
  t("a streak under $1 does not board", tiny.counts.streak.qualified === 0 && !tiny.board.some((row) => row.signal === "streak"));

  const huge = card({
    id: "move-tcgcsv-3-7",
    sku: "tcgcsv-3",
    name: "Koffing",
    headline: "Koffing is up 250% over 7 days, from $1.00 to $3.50.",
    price: 3.5,
    changePct: 250,
    windowDays: 7,
  });
  const capped = libOf({
    cards: { c: huge },
    series: new Map([[3, new Map([["2026-10-01", 1], ["2026-10-08", 3.5]])]]),
  });
  t("a move of 200% or more does not board", capped.counts.mover.qualified === 0 && capped.board.length === 0);

  const up = card({ id: "move-tcgcsv-4-7", sku: "tcgcsv-4", name: "Abra", headline: "Abra is up 20% over 7 days, from $10.00 to $12.00.", price: 12, changePct: 20, windowDays: 7 });
  const up2 = card({ id: "move-tcgcsv-5-7", sku: "tcgcsv-5", name: "Kadabra", headline: "Kadabra is up 50% over 7 days, from $10.00 to $15.00.", price: 15, changePct: 50, windowDays: 7 });
  const down = card({ id: "move-tcgcsv-6-7", sku: "tcgcsv-6", name: "Alakazam", headline: "Alakazam is down 20% over 7 days, from $20.00 to $16.00.", price: 16, changePct: -20, windowDays: 7 });
  const pair = libOf({
    cards: { up, up2, down },
    series: new Map([
      [4, new Map([["2026-10-01", 10], ["2026-10-08", 12]])],
      [5, new Map([["2026-10-01", 10], ["2026-10-08", 15]])],
      [6, new Map([["2026-10-01", 20], ["2026-10-08", 16]])],
    ]),
  });
  const movers = pair.board.filter((row) => row.signal === "mover");
  t("at most one mover up and one mover down", movers.length === 2 && movers.filter((row) => row.changePct > 0).length === 1 && movers.filter((row) => row.changePct < 0).length === 1 && movers.some((row) => row.sku === "tcgcsv-5"));
  const top = movers.find((row) => row.sku === "tcgcsv-5");
  t("price form puts dollars before the percent", top.headline === "Kadabra (Base Set). TCGplayer market: $15.00 (2026-10-08), from $10.00 (2026-10-01). Up $5.00, 50%.");

  const empty = libOf({ cards: {} });
  t("quiet night with zero reads", empty.board.length === 0 && empty.quietNight === `Quiet night, ${ASOF}. No read cleared the bar. Missing days were not filled in.`);
  t("quiet night helper does not pad", quietNight(ASOF, 0).includes("No read") && quietNight(ASOF, 2) === `Quiet night, ${ASOF}. 2 read cleared the bar. A thin board is the whole board.` && quietNight(ASOF, 3) === "");
  t("two reads stay two", pair.board.length === 2 && pair.quietNight.includes("2 read cleared the bar") && pair.quietNight.includes("A thin board is the whole board"));

  const high = card({
    id: "move-tcgcsv-7-30",
    sku: "tcgcsv-7",
    name: "Pidgey",
    headline: "Pidgey hit a 6-month high: $2.66, up 72.7% in 30 days.",
    price: 2.66,
    changePct: 72.7,
    windowDays: 30,
  });
  const highSeries = new Map([[7, new Map([["2026-04-01", 1], ["2026-07-10", 2.42], ["2026-09-08", 1.54], ["2026-10-08", 2.66]])]]);
  const unproven = libOf({ cards: { high }, series: highSeries, dailyFiles: new Set(["2026-10-08", "2026-10-03"]) });
  t("an unproven 6-month high stays off the board", unproven.counts.high.qualified === 0 && !unproven.board.some((row) => /6-month/i.test(row.headline)));
  const month = card({
    id: "move-tcgcsv-8-30",
    sku: "tcgcsv-8",
    name: "Rattata",
    headline: "Rattata hit a 6-month high and a September high: $2.66, up 72.7% in 30 days.",
    path: "Rattata latest price on Sep 8.",
    price: 2.66,
    changePct: 72.7,
    windowDays: 30,
  });
  const monthLib = libOf({
    cards: { month },
    series: new Map([[8, new Map([["2026-04-01", 1], ["2026-09-08", 1.54], ["2026-10-08", 2.66]])]]),
    dailyFiles: new Set(["2026-09-26", "2026-09-27", "2026-09-08", "2026-10-08"]),
  });
  t("a September high is dropped until every file that month is checked", monthLib.board.every((row) => !/September high/i.test(row.headline)));

  const extra = {
    lag: { reads: [] },
    group: { reads: [] },
    reads: [
      { id: "spread-narrow", sku: "sv-narrow", readKind: "spread", kind: "spread", name: "Narrow", headline: "Narrow asks run from $70.00 to $90.00.", asOf: ASOF, receipt: { low: 70, high: 90, median: 80, count: 6 } },
      { id: "spread-wide", sku: "sv-wide", readKind: "spread", kind: "spread", name: "Wide", headline: "Wide asks run from $40.00 to $100.00.", asOf: ASOF, receipt: { low: 40, high: 100, median: 60, count: 6 } },
      { id: "spread-also", sku: "sv-also", readKind: "spread", kind: "spread", name: "Also", headline: "Also asks run from $10.00 to $40.00.", asOf: ASOF, receipt: { low: 10, high: 40, median: 20, count: 6 } },
      { id: "ask-small", sku: "sv-ask-small", readKind: "askmove", kind: "askmove", name: "Ask small", headline: "Ask small went from $80.00 to $80.40.", asOf: ASOF, receipt: { askFrom: 80, askTo: 80.4, market: 40 } },
      { id: "ask-big", sku: "sv-ask-big", readKind: "askmove", kind: "askmove", name: "Ask big", headline: "Ask big went from $80.00 to $82.00.", asOf: ASOF, receipt: { askFrom: 80, askTo: 82, market: 40 } },
      { id: "mkt-small", sku: "sv-mkt-small", readKind: "mktmove", kind: "mktmove", name: "Market small", headline: "Market small went from $40.00 to $40.40.", asOf: ASOF, receipt: { marketFrom: 40, marketTo: 40.4, ask: 80 } },
      { id: "mkt-big", sku: "sv-mkt-big", readKind: "mktmove", kind: "mktmove", name: "Market big", headline: "Market big went from $40.00 to $42.00.", asOf: ASOF, receipt: { marketFrom: 40, marketTo: 42, ask: 80 } },
      { id: "still-1", sku: "sv-still", readKind: "still", kind: "still", name: "Still", headline: "The ask stayed the same.", asOf: ASOF },
      { id: "list-1", sku: "sv-list", readKind: "listing", kind: "listing", name: "List", headline: "Listing estimate from the Browse total: 40.", asOf: ASOF },
      { id: "poke-1", sku: "pokemon-pika", readKind: "pokemon", kind: "pokemon", name: "Pikachu", headline: "Pikachu (#25): 40 cards, 12 artists.", asOf: ASOF },
      { id: "dive-1", sku: "sv-dive", readKind: "dive", kind: "dive", name: "Dive", headline: "Dive. Deeper look on the chart.", asOf: ASOF },
      { id: "vol-1", sku: "sv-vol", readKind: "volume", kind: "volume", name: "Vol", headline: "12 sold.", asOf: ASOF },
      { id: "quiet-1", sku: "sv-quiet", readKind: "quiet", kind: "quiet", name: "Quiet", headline: "Quiet sold count.", asOf: ASOF },
      { id: "mix-1", sku: "sv-mix", readKind: "mix", kind: "mix", name: "Mix", headline: "Mix of conditions.", asOf: ASOF },
      { id: "cond-1", sku: "sv-cond", readKind: "conditions", kind: "conditions", name: "Cond", headline: "Conditions.", asOf: ASOF },
      { id: "flat-1", sku: "sv-flat", readKind: "soldflat", kind: "soldflat", name: "Flat", headline: "Sold flat.", asOf: ASOF },
      { id: "sold-down", sku: "sv-down", readKind: "solddown", kind: "solddown", name: "Down", headline: "Sold down.", asOf: ASOF },
      { id: "share-1", sku: "sv-share", readKind: "setshare", kind: "setshare", name: "Share", headline: "Set share.", asOf: ASOF },
    ],
  };
  const shaped = libOf({ cards: {}, extra });
  const kinds = shaped.board.map((row) => row.readKind);
  t("one spread only when the high ask is at least double", kinds.filter((kind) => kind === "spread").length === 1 && shaped.board.some((row) => row.id === "spread-wide") && !shaped.board.some((row) => row.id === "spread-narrow"));
  t("one ask-move and one market-move only at $1", shaped.board.filter((row) => row.readKind === "askmove").length === 1 && shaped.board.some((row) => row.id === "ask-big") && shaped.board.filter((row) => row.readKind === "mktmove").length === 1 && shaped.board.some((row) => row.id === "mkt-big"));
  t("dropped rows stay off the board", ["still", "listing", "pokemon", "dive", "volume", "quiet", "mix", "conditions", "soldflat", "solddown", "setshare"].every((kind) => !kinds.includes(kind)));
  t("footer is on the library once", shaped.footer === FOOTER && shaped.board.every((row) => !String(row.whyItMatters).includes("listing is not a sale")));

  const turnedSeries = new Map([
    [50, new Map([["2026-10-01", 10], ["2026-10-07", 13], ["2026-10-08", 12]])],
    [51, new Map([["2026-10-01", 20], ["2026-10-07", 30], ["2026-10-08", 28]])],
  ]);
  const turnedCards = {
    a: card({ id: "card-50", sku: "tcgcsv-50", name: "Charizard", headline: "Charizard.", price: 12 }),
    b: card({ id: "card-51", sku: "tcgcsv-51", name: "Blastoise", headline: "Blastoise.", price: 28 }),
  };
  const files = new Set(["2026-10-01", "2026-10-07", ASOF]);
  const off = libOf({ cards: turnedCards, series: turnedSeries, dailyFiles: files, library: false });
  t("turned stays off while the switch is off", !off.board.some((row) => row.signal === "turned"));
  const on = libOf({ cards: turnedCards, series: turnedSeries, dailyFiles: files, library: true });
  const turned = on.board.filter((row) => row.signal === "turned");
  t("turned caps at one when the switch is on", turned.length === 1 && turned[0].sku === "tcgcsv-51");
  t("turned copy names the week and the last night", turned[0].headline.includes("TCGplayer market: $28.00 (2026-10-08), from $20.00 (2026-10-01). Last night it went from $30.00 to $28.00.") && turned[0].whyItMatters === "The week is up $8.00. The last day turned down $2.00.");

  const sealedProducts = [
    { id: "art-parent", name: "Art Parent ETB", combinedArts: true, tcgPlayerId: null },
    { id: "art-priced", name: "Art Priced ETB", combinedArts: true, tcgPlayerId: "900" },
    { id: "box-a", name: "Booster Box", combinedArts: false, tcgPlayerId: "100", set: "Base" },
    { id: "box-b", name: "Elite Trainer Box", combinedArts: false, tcgPlayerId: "200", set: "Base" },
  ];
  const sealedSeries = new Map([
    [900, new Map([["2026-10-01", 20], ["2026-10-08", 40]])],
    [100, new Map([["2026-10-01", 100], ["2026-10-08", 112]])],
    [200, new Map([["2026-10-01", 50], ["2026-10-08", 70]])],
  ]);
  const sealedOff = libOf({ cards: {}, series: sealedSeries, dailyFiles: new Set(["2026-10-01", ASOF]), library: false, sealed: sealedProducts });
  t("sealed week stays off while the switch is off", !sealedOff.board.some((row) => row.signal === "sealed"));
  const sealedOn = libOf({ cards: {}, series: sealedSeries, dailyFiles: new Set(["2026-10-01", ASOF]), library: true, sealed: sealedProducts });
  const sealedRows = sealedOn.board.filter((row) => row.signal === "sealed");
  t("sealed week caps at one and skips art parents", sealedRows.length === 1 && sealedRows[0].sku === "box-b" && !sealedOn.board.some((row) => /Art /.test(row.name)));
  t("sealed copy", sealedRows[0].headline.includes("Elite Trainer Box. TCGplayer market: $70.00 (2026-10-08), from $50.00 (2026-10-01). Up $20.00.") && !/\bNM\b/.test(sealedRows[0].headline) && sealedRows[0].whyItMatters === "A sealed product moved $5 or more on the two dates. This is the market price, not an eBay ask, and not a sale.");

  // The live radar drops a row once it has released (the 10-26 digest dropped
  // Deck Crafter's Collection), so the release-day check pins its own rows on
  // top of the live file: one verified English row and one verified JP row,
  // both dated seven days after 2026-10-16. Only the English row may board.
  const liveRadar = JSON.parse(await readFile(join(ROOT, "data/release-radar.json"), "utf8"));
  const radar = {
    ...liveRadar,
    upcoming: [
      ...(liveRadar.upcoming || []).filter((row) => row.date !== "2026-10-23"),
      { name: "Deck Crafter's Collection", type: "product", date: "2026-10-23", confidence: "verified", note: "$9.99 MSRP. Fixture row pinned for the release-day read test." },
      { name: "JP: Fixture Expansion Pack", type: "jp-set", date: "2026-10-23", confidence: "verified", note: "Fixture JP row. Must never board." },
    ],
  };
  const releaseOff = libOf({ cards: {}, library: false, radar });
  t("release stays off while the switch is off", !releaseOff.board.some((row) => row.signal === "release"));
  const releaseDay = buildReadLibrary({
    catalogue: { asOf: "2026-10-16", source: "TCGplayer market", cards: {} },
    extra: { lag: { reads: [] }, group: { reads: [] } },
    series: new Map(),
    library: true,
    radar: { ...radar, upcoming: radar.upcoming.map((row) => ({ ...row, msrp: 49.99 })) },
  });
  const releases = releaseDay.board.filter((row) => row.signal === "release");
  t("release shows the verified non-jp row seven days out, with no MSRP", releases.length === 1 && releases[0].headline.startsWith(`Deck Crafter's Collection is dated 2026-10-23 on the release file (checked ${radar.updated}).`) && !/msrp|\$/i.test(releases[0].headline) && !releases.some((row) => /jp/i.test(row.headline)));
  const none = buildReadLibrary({
    catalogue: { asOf: "2026-10-11", source: "TCGplayer market", cards: {} },
    extra: { lag: { reads: [] }, group: { reads: [] } },
    series: new Map(),
    library: true,
    radar,
  });
  t("a day that is not release day or seven days before stays empty", !none.board.some((row) => row.signal === "release"));

  const accent = libOf({
    cards: {
      a: card({ id: "move-tcgcsv-70-7", sku: "tcgcsv-70", name: "Pokemon Fan", headline: "Pokemon Fan is up 20% over 7 days, from $10.00 to $12.00.", price: 12, changePct: 20, windowDays: 7 }),
    },
    series: new Map([[70, new Map([["2026-10-01", 10], ["2026-10-08", 12]])]]),
  });
  const accentRow = accent.board.find((row) => row.sku === "tcgcsv-70");
  t("Pokémon takes the accent and the line has no em dash", accentRow && accentRow.headline.startsWith("Pokémon Fan") && !accent.board.some((row) => /—/.test(`${row.headline} ${row.whyItMatters}`)));

  const banned = libOf({
    cards: {
      a: card({ id: "move-tcgcsv-71-30", sku: "tcgcsv-71", name: "Abra", headline: "Abra is a buy and a 6-month high: $2.66.", path: "Abra hit a 6-month high: $2.66, up 72.7% in 30 days.", price: 2.66, changePct: 72.7, windowDays: 30 }),
    },
    series: highSeries.get(7) ? new Map([[71, highSeries.get(7)]]) : new Map(),
  });
  t("a banned word does not board", !banned.board.some((row) => BANNED.test(row.headline)));

  const copyBoard = [...present.board, ...pair.board, ...shaped.board, ...on.board, ...sealedOn.board];
  t("no why line has a file path, a tcgcsv id, or a banned word", copyBoard.every((row) => !whyLeak(row.whyItMatters) && !BANNED.test(row.whyItMatters) && !BANNED.test(row.headline)));

  const published = publishReads(pair);
  t("published count equals the array length", published.count === published.reads.length && published.reads.length === pair.board.length);
  const root = await mkdtemp(join(tmpdir(), "reads-"));
  await mkdir(join(root, "research/assets/public/feed"), { recursive: true });
  await writeFile(join(root, "research/assets/public/reads.json"), JSON.stringify({ asOf: ASOF, count: 1093, reads: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }] }));
  const written = await writeReadLibrary({
    root,
    catalogue: { asOf: ASOF, source: "TCGplayer market", cards: { up, down } },
    extra: { lag: { reads: [] }, group: { reads: [] } },
    series: new Map([
      [4, new Map([["2026-10-01", 10], ["2026-10-08", 12]])],
      [6, new Map([["2026-10-01", 20], ["2026-10-08", 16]])],
    ]),
    dailyFiles: new Set(["2026-10-01", ASOF]),
    library: false,
  });
  const reads = JSON.parse(await readFile(join(root, "research/assets/public/reads.json"), "utf8"));
  const libraryFile = JSON.parse(await readFile(join(root, "research/assets/public/feed/read-library.json"), "utf8"));
  t("reads.json ids equal the library board and the count matches", reads.count === reads.reads.length && reads.count === libraryFile.board.length && reads.reads.map((row) => row.id).join() === libraryFile.board.map((row) => row.id).join() && reads.count === written.board.length && reads.count !== 1093);

  const cents = new Set();
  const add = (n) => { if (typeof n === "number") cents.add(Math.round(n * 100)); };
  for (const row of day10.prices) {
    add(row.market);
    for (const printing of row.printings || []) add(printing.price);
  }
  t("2283.14 and 1412.72 are not in the 2026-10-10 daily file", !cents.has(228314) && !cents.has(141272));
  const kept = chaseInMorningFile([
    { name: "Umbreon VMAX", priceMarket: 2283.14 },
    { name: "Umbreon ex", priceMarket: 1412.72 },
    { name: "Gyarados", priceMarket: 0.37 },
  ], day10);
  t("pulse drops chase prices missing from that morning", kept.length === 1 && kept[0].priceMarket === 0.37 && !kept.some((row) => row.priceMarket === 2283.14 || row.priceMarket === 1412.72));

  {
    const imgs = { "tcgcsv-1": "/img/sv1/12" };
    t("board image: catalogue picture by id first", boardImage({ sku: "tcgcsv-1" }, imgs, true) === "https://catchemtcg.com/data/editor/tcg/sv1/12_hires.png");
    t("board image: TCGplayer photo by productId when the flag is on", boardImage({ sku: "tcgcsv-704180" }, {}, true) === "https://tcgplayer-cdn.tcgplayer.com/product/704180_in_400x400.jpg");
    t("board image: branded tile when the flag is off and no catalogue hit", boardImage({ sku: "tcgcsv-704180" }, {}, false) === BRAND_TILE);
    t("board image: a sealed slug maps to its TCGplayer id", boardImage({ id: "askmove-sv7-etb", sku: "sv7-etb" }, {}, true, new Map([["sv7-etb", "557350"]])) === "https://tcgplayer-cdn.tcgplayer.com/product/557350_in_400x400.jpg");
    t("board image: a non-product read still gets the tile", boardImage({ id: "spread-x" }, {}, true) === BRAND_TILE);
    try {
      const pub = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), "../../research/assets/public/reads.json"), "utf8"));
      t("published reads.json: no board row has an empty image", (pub.reads || []).every((row) => typeof row.image === "string" && row.image.trim() !== ""));
      t("published reads.json: count equals length", pub.count === (pub.reads || []).length);
    } catch { t("published reads.json is readable", false); }
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("read-quality.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("read quality ok");
}
