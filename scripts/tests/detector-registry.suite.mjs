import { buildReadLibrary } from "../lib/read-library.mjs";
import { gapReport } from "../lib/detectors/gaps.mjs";
import { learningReport } from "../lib/detectors/learning.mjs";
import { refreshPlan } from "../lib/detectors/refresh.mjs";
import { runRegistry } from "../lib/detectors/registry.mjs";
import { checkDetector } from "../lib/detectors/shape.mjs";

const ASOF = "2026-10-08";

function card(partial) {
  return {
    id: partial.id,
    sku: partial.sku,
    kind: "single",
    name: partial.name || "Pikachu",
    set: partial.set || "Base Set",
    number: partial.number || "58/102",
    headline: partial.headline,
    path: partial.path || partial.headline,
    price: partial.price,
    changePct: partial.changePct,
    windowDays: partial.windowDays,
    asOf: ASOF,
    source: "TCGplayer market",
    href: `/c/${partial.sku}`,
  };
}

function ctx() {
  return {
    catalogue: {
      asOf: ASOF,
      source: "TCGplayer market",
      cards: {
        a: card({
          id: "move-tcgcsv-1-7",
          sku: "tcgcsv-1",
          headline: "Pikachu is up 10% over 7 days.",
          price: 11,
          changePct: 10,
          windowDays: 7,
        }),
        b: card({
          id: "move-tcgcsv-2-7",
          sku: "tcgcsv-2",
          name: "Dragonair",
          headline: "Dragonair is up 10% over 7 days.",
          price: 11,
          changePct: 10,
          windowDays: 7,
        }),
      },
    },
    extra: { lag: { reads: [], omitted: [], missingPrice: [] }, group: { reads: [] } },
    series: new Map([
      [1, new Map([["2026-10-01", 10], ["2026-10-08", 11]])],
      [2, new Map([["2026-10-08", 11]])],
    ]),
    dailyFiles: new Set(["2026-10-01", "2026-10-08"]),
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const input = ctx();
  const direct = buildReadLibrary({ ...input, library: false, pptPublic: false, volumeReads: false });
  const via = runRegistry(input, { switchOn: false });
  t("registry library matches buildReadLibrary", JSON.stringify(via.lib) === JSON.stringify(direct));
  t("same files, same board, second pass", JSON.stringify(runRegistry(input).lib.board) === JSON.stringify(direct.board));
  t("the proved mover is the mover slice", via.byId.mover.length === 1 && via.byId.mover[0].sku === "tcgcsv-1");
  t("a missing start day is not a mover", via.byId.mover.every((row) => row.sku !== "tcgcsv-2"));
  t("plain is not boarded", via.byId.plain.length === 0 && via.lib.counts.plain.boarded === 0);
  t("slots publish nothing while the switch is off", via.byId.supply.length === 0 && via.byId.release.length === 0 && via.logs.some((row) => row.id === "supply" && row.skipped === "reads.library off"));
  t("a thrown detector adds no row", (() => {
    const bad = checkDetector({
      id: "boom",
      inputs: ["none"],
      rule: "throws",
      minimums: {},
      copy: "none",
      take: () => { throw new Error("nope"); },
      wrongIf: "a fake row",
    });
    const out = runRegistry(input, { extras: [bad] });
    return out.byId.boom.length === 0 && out.logs.some((row) => row.id === "boom" && row.error === "nope") && out.lib.board.length === direct.board.length;
  })());

  const learned = learningReport({
    asOf: "2026-10-10",
    types: [
      { type: "price", reads: 2, tooEarly: 2, scored14: 0, hit14: 0, scored28: 0, hit28: 0, scored56: 0, hit56: 0 },
      { type: "quiet", reads: 25, tooEarly: 0, scored14: 20, hit14: 0, scored28: 0, hit28: 0, scored56: 0, hit56: 0 },
    ],
  });
  t("hit rate stays hidden under 20", learned.public === false && learned.detectors[0].hitRate14 === null && learned.detectors[0].review === false && learned.detectors[0].minimums === "unchanged");
  t("20 misses is a review flag, not a new minimum", learned.detectors[1].hitRate14 === 0 && learned.detectors[1].review === true && learned.detectors[1].minimums === "unchanged");

  const gaps = gapReport({
    sets: [
      { slug: "base-set", name: "Base Set", skus: ["tcgcsv-1"] },
      { slug: "jungle", name: "Jungle", skus: ["tcgcsv-9"] },
    ],
    covered: ["tcgcsv-1"],
  });
  t("a set with no covered sku is a gap and gets no read", gaps.uncovered === 1 && gaps.rows[0].slug === "jungle" && gaps.rows[0].reads === 0);

  const plan = refreshPlan(
    { "tcgcsv-daily": "a", news: "a", "ebay-listings": "a", "ebay-solds": "a", "release-radar": "a" },
    { "tcgcsv-daily": "b", news: "a", "ebay-listings": "b", "ebay-solds": "b", "release-radar": "a" },
  );
  t("a changed price file refreshes price detectors only", plan.changed.some((row) => row.input === "tcgcsv-daily" && row.detectors.includes("mover")));
  t("an eBay file change refreshes no detector", plan.changed.filter((row) => row.input.startsWith("ebay")).every((row) => row.detectors.length === 0) && plan.paidCalls === 0 && plan.ebayInReads === false);
  t("an unchanged news file is not in the plan", !plan.changed.some((row) => row.input === "news"));

  return fail;
}

if (import.meta.url === new URL(process.argv[1], "file:").href || process.argv[1].endsWith("detector-registry.suite.mjs")) {
  const fail = await run();
  if (fail) process.exit(1);
}
