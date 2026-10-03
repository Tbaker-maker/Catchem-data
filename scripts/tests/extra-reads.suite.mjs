import { alignedEnds, buildBrowse, groupReadsFromMembers, lagFromSets, seededShuffle } from "../lib/extra-reads.mjs";

function series(points) {
  return points;
}

function day(n) {
  const start = Date.parse("2026-08-01T00:00:00Z");
  return new Date(start + n * 86400000).toISOString().slice(0, 10);
}

function line(start, end, from, to) {
  const pts = [];
  const steps = end - start;
  for (let i = 0; i <= steps; i += 1) {
    const price = from + ((to - from) * i) / steps;
    pts.push([day(start + i), Math.round(price * 100) / 100]);
  }
  return pts;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  const asOf = day(40);
  const packUp = line(10, 40, 4, 6);
  const boxFlat = line(10, 40, 100, 100);
  const singleUp = line(10, 40, 1, 2);
  const singleDown = line(10, 40, 3, 1);
  const made = lagFromSets([{
    name: "Example Set",
    packs: [{ id: "tcgcsv-1", name: "Example Booster Pack", series: packUp }],
    boxes: [{ id: "tcgcsv-2", name: "Example Booster Box", series: boxFlat }],
    singles: [{ id: "tcgcsv-3", name: "Example", series: singleUp }],
  }], { asOf, days: 30 });
  t("a lag read ships when the pack moved, the box did not, and singles moved the same way", made.reads.length === 1 && made.missingPrice.length === 0);
  t("the lag sentence leads with the pack prices and dates", made.reads[0] && /^Example Set: Example Booster Pack latest price rose from \$4\.00 on Aug 11 to \$6\.00 on Sep 10, up 50\.0%\./.test(made.reads[0].path));
  t("the lag sentence does not use a banned word", made.reads[0] && !/stored|last print|printed|bigger last step/.test(made.reads[0].path));

  const missing = lagFromSets([{
    name: "No Box",
    packs: [{ id: "tcgcsv-4", name: "Pack", series: packUp }],
    boxes: [{ id: "tcgcsv-5", name: "Box", series: [] }],
    singles: [],
  }], { asOf, days: 30 });
  t("a set with no box price is left out", missing.reads.length === 0 && missing.missingPrice.length === 1 && missing.missingPrice[0].boxesWithPrice === 0);

  const vintage = lagFromSets([{
    name: "Base Set",
    packs: [{ id: "tcgcsv-6", name: "Base Pack", series: packUp }],
    boxes: [],
    singles: [],
  }], { asOf, days: 30 });
  t("vintage without both series is not a lag read", vintage.reads.length === 0 && vintage.missingPrice.length === 1 && vintage.missingPrice[0].vintage === true);

  const split = lagFromSets([{
    name: "Two Packs",
    packs: [
      { id: "tcgcsv-7", name: "Pack A", series: packUp },
      { id: "tcgcsv-8", name: "Pack B", series: line(10, 40, 8, 7) },
    ],
    boxes: [{ id: "tcgcsv-9", name: "Box", series: boxFlat }],
    singles: [{ id: "tcgcsv-10", name: "Mon", series: singleUp }],
  }], { asOf, days: 30 });
  t("two pack prices are recorded and not shipped", split.reads.length === 0 && split.omitted.length === 1 && split.omitted[0].packs.length === 2);

  const opposed = lagFromSets([{
    name: "Split Singles",
    packs: [{ id: "tcgcsv-11", name: "Pack", series: packUp }],
    boxes: [{ id: "tcgcsv-12", name: "Box", series: boxFlat }],
    singles: [
      { id: "tcgcsv-13", name: "Up", series: singleUp },
      { id: "tcgcsv-14", name: "Down", series: singleDown },
    ],
  }], { asOf, days: 30 });
  t("singles that disagree with each other are not given a winner", opposed.reads.length === 0 && opposed.omitted[0]?.reason === "singles did not move with the pack");

  const supplied = lagFromSets([{
    name: "Example Set",
    packs: [{ id: "tcgcsv-1", name: "Example Booster Pack", series: packUp }],
    boxes: [{ id: "tcgcsv-2", name: "Example Booster Box", series: boxFlat }],
    singles: [{ id: "tcgcsv-3", name: "Example", series: singleUp }],
  }], { asOf, days: 30, supplyBySet: new Map([["Example Set", "The source says supply is rising."]]) });
  t("supply that points the other way is said and not picked", /supply is rising, and the pack price moved the other way/.test(supplied.reads[0]?.path || ""));
  t("a line that does not say shrinking or rising adds nothing", !/supply/.test(made.reads[0].path));

  const movedBox = lagFromSets([{
    name: "Box Moved",
    packs: [{ id: "tcgcsv-15", name: "Pack", series: packUp }],
    boxes: [{ id: "tcgcsv-16", name: "Box", series: line(10, 40, 90, 110) }],
    singles: [{ id: "tcgcsv-17", name: "Mon", series: singleUp }],
  }], { asOf, days: 30 });
  t("a box that moved is not a lag read", movedBox.reads.length === 0 && movedBox.omitted[0]?.reason === "booster box moved");

  const swsh = [];
  const modern = [];
  for (let i = 0; i < 6; i += 1) {
    swsh.push({ id: `tcgcsv-v-${i}`, name: `Mon ${i} V`, set: "SWSH07: Evolving Skies", rarity: "Ultra Rare", series: line(10, 40, 2, 4) });
    modern.push({ id: `tcgcsv-c-${i}`, name: `Chase ${i}`, set: "SV01: Scarlet & Violet Base Set", rarity: "Illustration Rare", series: line(10, 40, 10, 6) });
  }
  swsh.push({ id: "tcgcsv-v-flat", name: "Still V", set: "SWSH07: Evolving Skies", rarity: "Ultra Rare", series: line(10, 40, 5, 5) });
  const high = line(10, 40, 1, 9);
  swsh[0].series = high;
  const grouped = groupReadsFromMembers([...swsh, ...modern], { asOf, days: 30 });
  t("a group read ships only when both sides moved", grouped.reads.length === 1 && /Sword & Shield V and VMAX cards are up while Modern chase cards are down/.test(grouped.reads[0].path));
  t("an all-time high is a filled up triangle and the word high", grouped.reads[0].highs.some((row) => row.id === "tcgcsv-v-0" && row.mark === "▲ high") && grouped.reads[0].path.includes("▲ high"));
  t("a similar card that has not moved is named by id", grouped.reads[0].similarStill.some((row) => row.id === "tcgcsv-v-flat") && grouped.reads[0].path.includes("tcgcsv-v-flat"));

  const quiet = groupReadsFromMembers(swsh.filter((row) => row.id !== "tcgcsv-v-flat"), { asOf, days: 30 });
  t("no still card is invented when the climbing group all moved", quiet.reads.length === 0 || quiet.reads[0].similarStill.length === 0);

  const none = groupReadsFromMembers(swsh, { asOf, days: 30 });
  t("one side alone is not a group read", none.reads.length === 0);

  const ids = ["b", "a", "c", "d"];
  const shuffled = seededShuffle(ids, "2026-09-27");
  t("the unfiltered loop is not the ranked order", shuffled.join() !== ids.join() && shuffled.slice().sort().join() === ids.slice().sort().join());
  const again = seededShuffle(ids, "2026-09-27");
  t("the shuffle is stable for a catalog day", again.join() === shuffled.join());
  const browse = buildBrowse({ asOf: "2026-09-27", cardIds: ids, rankedIds: ids, news: [{ url: "https://example.com" }], waves: [] });
  t("a ranked filter keeps its order and the open loop does not", browse.ranked.join() === ids.join() && browse.unfiltered.join() !== ids.join() && browse.filters.pokemon.premiumCanHide === true && browse.filters.news.windowDays === 14);

  const gap = alignedEnds([["2026-09-01", 1]], "2026-09-27", 30);
  t("one point is not a series", gap == null);

  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("extra-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("extra reads ok");
}
