// Take codes. Labels are display-only. A missing rule is no take, never Watch.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED, FILLER_BAN, TAKE_FOOTER, TAKE_LABELS, bannedWord, fillerBanned, lineBanned } from "../lib/public-bundle.mjs";
import { buildReadLibrary } from "../lib/read-library.mjs";
import { listingSentence, listingsPastMinimum, takeCode, takeLayout } from "../lib/takes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LABELS = ["Looks like a buy", "Wait for a dip", "Watch", "Avoid for now", "Looks stretched"];

const downListings = { source: "filteredTotal", start: 80, end: 50, startDate: "2026-10-03", endDate: "2026-10-10" };
const upListings = { source: "filteredTotal", start: 40, end: 55, startDate: "2026-10-03", endDate: "2026-10-10" };

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("the five labels are the only display words", JSON.stringify(TAKE_LABELS) === JSON.stringify({
    up: "Looks like a buy",
    dip: "Wait for a dip",
    watch: "Watch",
    avoid: "Avoid for now",
    stretched: "Looks stretched",
  }));
  t("the regex still matches buy and for now", BANNED.test("Looks like a buy") && FILLER_BAN.test("Avoid for now") && BANNED.test("This is a buy.") && FILLER_BAN.test("Check back for now."));
  for (const label of LABELS) t(`exact label is exempt: ${label}`, lineBanned(label) === false && bannedWord(label) === false && fillerBanned(label) === false);
  t("the footer is exempt", lineBanned(TAKE_FOOTER) === false && TAKE_FOOTER === "A take is our read of the numbers, not advice.");
  t("a longer buy sentence stays banned", lineBanned("Looks like a buy today.") && lineBanned("This is a buy.") && bannedWord("Looks like a buy."));
  t("a longer for-now sentence stays banned", lineBanned("Avoid for now.") && lineBanned("Check back for now.") && fillerBanned("Avoid for now, please."));
  t("Watch this is not the exempt label", TAKE_LABELS.watch === "Watch" && lineBanned("Watch this.") === false && lineBanned("Watch") === false);
  t("only the five labels and the footer are exempt", [TAKE_FOOTER, ...LABELS].every((line) => lineBanned(line) === false) && lineBanned("Looks like a buy today.") === true && lineBanned("Not a take.") === false);

  t("up at least 8% and $1, not a high", takeCode({ from: 10, to: 12, sixMonthHigh: false }) === "up");
  t("the same move at a proven 6-month high is stretched", takeCode({ from: 10, to: 12, sixMonthHigh: true }) === "stretched");
  t("a high flag that is not true stays up", takeCode({ from: 10, to: 12, sixMonthHigh: "yes" }) === "up");
  t("down at least 3% and $1 is a dip", takeCode({ from: 10, to: 9 }) === "dip");
  t("up from 3% to under 8% and at least $1 is watch", takeCode({ from: 20, to: 21 }) === "watch");
  t("8% even is up, just under 8% is watch", takeCode({ from: 100, to: 108 }) === "up" && takeCode({ from: 100, to: 107.99 }) === "watch");
  t("under $1 is no take even at 10%", takeCode({ from: 4.41, to: 4.76 }) === null && takeCode({ from: 10, to: 10.99 }) === null);
  t("under 3% is no take", takeCode({ from: 100, to: 102 }) === null && takeCode({ from: 100, to: 97.1 }) === null);
  t("listings down past the minimum and a flat price is watch", listingsPastMinimum(downListings, "down") && takeCode({ from: 10, to: 10.1, listings: downListings }) === "watch");
  t("listings up and a down move of 3% and $1 is avoid", listingsPastMinimum(upListings, "up") && takeCode({ from: 10, to: 9, listings: upListings }) === "avoid");
  t("listings up with a flat price is not a take", takeCode({ from: 10, to: 10.1, listings: upListings }) === null);
  t("a browse total cannot make a listing take", takeCode({ from: 10, to: 10.1, listings: { source: "browseTotal", start: 80, end: 50 } }) === null);
  t("listingCount cannot make a listing take", takeCode({ from: 10, to: 10.1, listings: { source: "listingCount", start: 80, end: 50 } }) === null);
  t("a short listing move is not past the minimum", listingsPastMinimum({ source: "filteredTotal", start: 40, end: 32 }, "down") === false && listingsPastMinimum({ source: "filteredTotal", start: 39, end: 20 }, "down") === false);
  t("no inputs is no take", takeCode({}) === null && takeCode({ from: 5, to: 5 }) === null);
  t("never defaults to Watch", takeCode({ from: 4.41, to: 4.76 }) !== "watch" && takeCode({ listings: upListings, from: 10, to: 10 }) !== "watch");

  const up = takeLayout({ from: 10, to: 12, start: "2026-10-03", end: "2026-10-10", sixMonthHigh: false, source: "TCGplayer market", sourceDate: "2026-10-10" });
  t("layout is label, prices, why, wrong, source, footer", up && up.lines[0] === "Looks like a buy" && up.lines[1] === "TCGplayer market: $12.00 NM (2026-10-10), from $10.00 NM (2026-10-03). Up $2.00 NM, 20%." && up.why === "Up $2.00 on those two dates." && up.wrong === "Wrong if either date has a different market price." && up.source === "TCGplayer market, 2026-10-10." && up.lines.at(-1) === TAKE_FOOTER && up.code === "up");
  const avoid = takeLayout({ from: 10, to: 9, start: "2026-10-03", end: "2026-10-10", listings: upListings });
  t("avoid keeps its label and does not say because", avoid && avoid.code === "avoid" && avoid.label === "Avoid for now" && avoid.lines.includes("Avoid for now") && !/\bbecause\b/i.test(avoid.lines.join(" ")));
  const opposite = takeLayout({ from: 10, to: 12, start: "2026-10-03", end: "2026-10-10", listings: downListings });
  t("opposite price and listings show both numbers and no because", opposite && opposite.prices.includes("$12.00") && opposite.listings === "eBay listings 80 to 50 (Oct 3 to Oct 10)." && opposite.lines.indexOf(opposite.prices) < opposite.lines.indexOf(opposite.listings) && !/\bbecause\b/i.test(opposite.lines.join(" ")) && !/Browse|listingCount|browseTotal/.test(opposite.lines.join(" ")));
  t("a banned why drops the layout", takeLayout({ from: 10, to: 12, start: "2026-10-03", end: "2026-10-10", why: "This is a buy." }) === null);
  t("listing sentence is the filtered pair only", listingSentence(80, 50, "2026-10-03", "2026-10-10") === "eBay listings 80 to 50 (Oct 3 to Oct 10).");

  const machampFrom = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily/2026-10-03.json"), "utf8")).prices.find((row) => row.id === 124072).market;
  const machampTo = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily/2026-10-10.json"), "utf8")).prices.find((row) => row.id === 124072).market;
  t("Machamp's file move gets no take and not Watch", machampFrom === 4.41 && machampTo === 4.76 && takeCode({ from: machampFrom, to: machampTo }) === null);

  const lib = buildReadLibrary({
    catalogue: {
      asOf: "2026-10-08",
      cards: {
        a: {
          id: "move-tcgcsv-1-7", sku: "tcgcsv-1", kind: "single", name: "Pikachu", set: "Base Set",
          headline: "Pikachu is up 17.2% over 7 days, from $6.00 to $7.03.", price: 7.03, changePct: 17.2, windowDays: 7, asOf: "2026-10-08",
        },
      },
    },
    extra: { lag: { reads: [] }, group: { reads: [] } },
    series: new Map([[1, new Map([["2026-10-01", 6], ["2026-10-08", 7.03]])]]),
  });
  const row = lib.board.find((item) => item.sku === "tcgcsv-1");
  t("a boarded read stores the code, not the label", row && row.take === "up" && !JSON.stringify(row).includes("Looks like a buy"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("takes.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
