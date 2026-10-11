import { groupLag, sealedVsChase, setHeat } from "../lib/in-depth.mjs";

const start = "2026-10-03";
const end = "2026-10-10";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const moved = sealedVsChase({
    set: "Surging Sparks",
    start,
    end,
    sealed: { from: 40, to: 44, count: 3 },
    chase: { from: 12, to: 12.2, count: 8 },
  });
  t("sealed vs chase names the side, both prices, both dates, and the counts", moved && moved.publish === true && moved.moved === "sealed" && moved.headline.includes("Sealed moved") && moved.headline.includes("$44.00 (2026-10-10)") && moved.headline.includes("$40.00 (2026-10-03)") && moved.headline.includes("$12.00 (2026-10-03)") && moved.headline.includes("$12.20 (2026-10-10)") && moved.headline.includes("3 sealed products") && moved.headline.includes("8 chase cards") && !/average|level/i.test(moved.headline));
  t("both sides moving is not a read", sealedVsChase({ set: "Surging Sparks", start, end, sealed: { from: 40, to: 44, count: 3 }, chase: { from: 10, to: 12, count: 8 } }) === null);
  t("neither side moving is not a read", sealedVsChase({ set: "Surging Sparks", start, end, sealed: { from: 40, to: 40.2, count: 3 }, chase: { from: 10, to: 10.1, count: 8 } }) === null);
  t("a missing price is not filled", sealedVsChase({ set: "Surging Sparks", start, end, sealed: { from: 40, to: 44, count: 3 }, chase: { from: 10, count: 8 } }) === null);
  t("a set-lines level is not used", sealedVsChase({ set: "Surging Sparks", start, end, sealed: { from: 40, to: 44, count: 3, level: 110 }, chase: { from: 12, to: 12.2, count: 8 } }) === null);
  t("six days is not the sealed pair", sealedVsChase({ set: "Surging Sparks", start, end: "2026-10-09", sealed: { from: 40, to: 44, count: 1 }, chase: { from: 12, to: 12, count: 1 } }) === null);

  const members = [
    ...[1, 2, 3, 4, 5].map((n) => ({ id: `tcgcsv-${n}`, era: "swsh", kind: "V", from: 10, to: 12 })),
    { id: "tcgcsv-6", era: "swsh", kind: "V", from: 8, to: 8 },
    { id: "tcgcsv-7", era: "swsh", kind: "V", from: 9, to: 9 },
    { id: "tcgcsv-8", era: "swsh", kind: "VMAX", from: 5, to: 9 },
    { id: "tcgcsv-9", era: "sv", kind: "V", from: 5, to: 9 },
    { id: "tcgcsv-10", era: "swsh", kind: "V", from: 4, to: null },
  ];
  const lag = groupLag(members, { era: "swsh", kind: "V", start, end });
  t("group lag needs 5 ids up in the same era and kind", lag && lag.publish === true && lag.up === 5 && lag.flat.join() === "tcgcsv-6,tcgcsv-7" && !lag.headline.includes("tcgcsv-8") && !lag.headline.includes("tcgcsv-9"));
  t("four up ids are not a group lag", groupLag(members.slice(1), { era: "swsh", kind: "V", start, end }) === null);
  const manyFlat = groupLag([
    ...[1, 2, 3, 4, 5].map((n) => ({ id: `up-${n}`, era: "swsh", kind: "illustration rare", from: 2, to: 3 })),
    ...Array.from({ length: 10 }, (_, n) => ({ id: `flat-${n}`, era: "swsh", kind: "illustration rare", from: 4, to: 4 })),
  ], { era: "swsh", kind: "illustration rare", start, end });
  t("flat similar ids stop at 8", manyFlat && manyFlat.flat.length === 8);

  const cards = [
    ...[1, 2, 3, 4, 5].map(() => ({ from: 10, to: 12 })),
    { from: 10, to: 10.2 },
    { from: 5, to: null },
  ];
  const heat = setHeat(cards, { set: "Obsidian Flames", start, end });
  t("set heat counts only priced cards and stores the count", heat && heat.publish === true && heat.n === 5 && heat.priced === 6 && heat.counts["Obsidian Flames"] === 5 && heat.headline === "5 of 6 priced cards in Obsidian Flames moved at least 8% and at least $1 from Oct 3 to Oct 10.");
  t("four heated cards are not set heat", setHeat(cards.slice(1), { set: "Obsidian Flames", start, end }) === null);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("in-depth.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
