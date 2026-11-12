// Weekly movers use a 7-day window ending near asOf. Stale last prints stay off.
import { biggestMovers, windowMove, listingChanges, newPatterns, weeklyDoc, patternLine } from "../lib/weekly-changes.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  };

  const asOf = "2026-10-30";
  const pikachu = { id: "tcgcsv-215153", name: "Pikachu (English)", num: "PW 1", set: "Promo", hist: [["2026-10-06", 100], ["2026-10-07", 175]] };
  const haxorus = { id: "tcgcsv-145867", name: "Haxorus", num: "016/020", set: "Dragon Vault", printing: "Holofoil", hist: [["2026-10-23", 27.7], ["2026-10-28", 27.56], ["2026-10-30", 39.8]] };
  const leafeon = {
    id: "tcgcsv-86684",
    name: "Leafeon LV.X",
    num: "99/100",
    hist: [["2026-10-20", 200], ["2026-10-23", 200], ["2026-10-24", 525], ["2026-10-27", 525], ["2026-10-30", 200]],
  };
  const sealed = { id: "tcgcsv-100", name: "Surging Sparks ETB", kind: "sealed", set: "Surging Sparks", hist: [["2026-10-23", 40], ["2026-10-30", 49.99]] };
  const staleLetter = biggestMovers([pikachu, haxorus, leafeon, sealed], { asOf, limit: 20, floor: 5 });
  t("a last print from Oct 7 is not a 30 Oct mover", !staleLetter.some((row) => row.id === "tcgcsv-215153"));
  const hax = staleLetter.find((row) => row.id === "tcgcsv-145867");
  t("Haxorus uses the 7-day window, not only the last two ticks", hax && hax.from === "2026-10-23" && hax.to === "2026-10-30" && hax.p0 === 27.7 && hax.p1 === 39.8 && hax.pct === 43.7 && hax.printing === "Holofoil" && hax.source === "TCGplayer market via TCGCSV");
  t("Leafeon is a short spike, not a leading crash", !staleLetter.some((row) => row.id === "tcgcsv-86684" && row.pct === -61.9));
  const leaf = windowMove(leafeon.hist, { asOf, days: 7, floor: 5 });
  t("Leafeon's 7-day window is flat and flagged as a thin spike", leaf && leaf.pct === 0 && leaf.flag === "thin-spike" && leaf.p0 === 200 && leaf.p1 === 200);
  t("sealed products can be weekly movers", staleLetter.some((row) => row.id === "tcgcsv-100" && row.kind === "sealed" && row.pct === 25));

  // rd6 shape: no asOf, two points seven days apart still counts as a 7-day move.
  const rd6 = biggestMovers([{ id: "c", name: "Card", num: "1/10", hist: [["2026-10-06", 10], ["2026-10-13", 12]] }]);
  t("a mover with no asOf still keeps a 7-day pair", rd6.length === 1 && rd6[0].from === "2026-10-06" && rd6[0].to === "2026-10-13" && rd6[0].pct === 20);

  const listed = listingChanges({ a: { id: "a", date: "2026-10-13", listingsCounted: 80, kind: "sealed" } }, [{ id: "a", date: "2026-10-01", listingsCounted: 100 }]);
  t("listings counted emit both field shapes", listed.length === 1 && listed[0].fromN === 100 && listed[0].toN === 80 && listed[0].prev === 100 && listed[0].n === 80 && listed[0].prevDate === "2026-10-01" && listed[0].date === "2026-10-13" && listed[0].kind === "sealed");

  const obj = newPatterns({ passed: [{ pattern: "breakaway", stage: "confirmed", kind: "single", dir: "up", horizon: 7, n: 692, rate: 38.5, base: 30.4 }] });
  t("patterns keep object fields and a pipe line the site already parses", obj[0].pattern === "breakaway" && obj[0].base === 30.4 && patternLine(obj[0]) === "breakaway|confirmed|single|up|7d|n=692|rate=38.5|base=30.4");

  const doc = weeklyDoc({ asOf: "2026-10-30", movers: staleLetter, listings: [], listingDays: 1, includesSealed: true });
  t("the letter names the 7-day window and source", doc.windowDays === 7 && doc.windowFrom === "2026-10-23" && doc.source === "TCGplayer market via TCGCSV" && doc.includesSealed === true);
  t("one listings day stays empty", doc.listingsCounted.changes.length === 0);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("weekly-window.suite.mjs")) process.exit(await run() ? 1 : 0);
