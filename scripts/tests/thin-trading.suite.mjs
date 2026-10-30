// Thin trading: Lugia EX Full Art 134/135 (tcgcsv-86916) real nightly series,
// and the Delta Reign Booster Bundle date line.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { whyPlain } from "../lib/read-quality.mjs";
import { buildGroup } from "../lib/tcgcsv-catalog.mjs";
import { chaseLists } from "../lib/deep-reads-2.mjs";
import { cardStories } from "../lib/deep-reads.mjs";
import { assessThin, listingBacks, loadWindowSeries, priceSteps, thinLine } from "../lib/thin-trading.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASOF = "2026-10-26";
const LINE = "Few price changes lately: moved in 3 steps since Oct 3.";

async function dayPrice(id, day) {
  try {
    const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", `${day}.json`), "utf8"));
    const row = (doc.prices || []).find((item) => item.id === id);
    return row ? row.market : null;
  } catch {
    return null;
  }
}

function flatCard(id, price) {
  return {
    id: `tcgcsv-${id}`,
    name: `Card ${id}`,
    number: `${id}/135`,
    set: "BW: Plasma Storm",
    setSlug: "bw8-plasma-storm",
    rarity: "Ultra Rare",
    printing: "Holofoil",
    pts: [[ASOF, price]],
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const nights = await loadWindowSeries(ROOT, ASOF);
  const lugia = nights.points.get(86916) || [];
  const got = Object.fromEntries(lugia);
  t("Lugia keeps the opening print through Oct 3", got["2026-09-26"] === 938.5 && got["2026-10-03"] === 938.5);
  t("Oct 4 is not a day on file", got["2026-10-04"] == null && (await dayPrice(86916, "2026-10-04")) == null);
  t("Lugia steps are the real nightly prints", got["2026-10-05"] === 1344.25 && got["2026-10-21"] === 1344.25 && got["2026-10-22"] === 2219.24 && got["2026-10-24"] === 2219.24 && got["2026-10-25"] === 2717.32 && got["2026-10-26"] === 2717.32);
  const steps = priceSteps(lugia, ASOF);
  t("three real changes, longest flat run 17 days, since Oct 3", steps.changes === 3 && steps.longest === 17 && steps.since === "2026-10-03" && steps.jumps.length === 3);
  t("two jumps are over 30% and the last is not", steps.jumps[0].pct > 30 && steps.jumps[1].pct > 30 && steps.jumps[2].pct < 30 && steps.maxJumpPct > 30);

  const backed = assessThin(lugia, ASOF, { market: 2717.32, low: nights.low.get(86916) });
  t("tonight's low listing is 2849.99 and it backs 2717.32", nights.low.get(86916) === 2849.99 && listingBacks(2717.32, 2849.99) && backed.backed && backed.canLead);
  t("the plain line names the three steps", backed.line === LINE && thinLine(3, "2026-10-03") === LINE && !/[\u2014\u2013]|\bsold\b|\bsales\b/i.test(backed.line));
  const open = assessThin(lugia, ASOF, { market: 2717.32, low: null });
  t("no low on file cannot lead", open.thin && !open.backed && !open.canLead && open.line === "");
  const far = assessThin(lugia, ASOF, { market: 2717.32, low: 5000 });
  t("a far low listing does not back the print", !far.backed && !far.canLead);
  t("a measured zero low is not a listing", !listingBacks(2717.32, 0) && assessThin(lugia, ASOF, { market: 2717.32, low: 0 }).low == null);

  const quiet = priceSteps([["2026-09-26", 10], ["2026-09-27", 10], ["2026-10-26", 10]], ASOF);
  t("no price change is not thin, and a gap does not extend the flat run", quiet.changes === 0 && quiet.longest === 2 && !assessThin([["2026-09-26", 10], ["2026-10-26", 10]], ASOF, { market: 10, low: null }).thin);
  const gap = priceSteps([["2026-09-26", 10], ["2026-09-27", 10], ["2026-10-03", 10], ["2026-10-05", 20]], ASOF);
  t("a missing day is not a change", gap.changes === 1 && gap.since === "2026-10-03" && gap.longest === 2);
  t("exactly 30% is not over 30%", !assessThin([["2026-10-25", 100], ["2026-10-26", 130]], ASOF, { market: 130, low: null }).thin);
  t("four changes stay eligible even with a big jump", !assessThin([
    ["2026-10-22", 100], ["2026-10-23", 140], ["2026-10-24", 150], ["2026-10-25", 160], ["2026-10-26", 170],
  ], ASOF, { market: 170, low: null }).thin);
  t("one step uses the singular", thinLine(1, "2026-10-03") === "Few price changes lately: moved in 1 step since Oct 3.");

  const lugiaCard = {
    id: "tcgcsv-86916",
    name: "Lugia EX",
    number: "134/135",
    set: "BW: Plasma Storm",
    setSlug: "bw8-plasma-storm",
    rarity: "Ultra Rare",
    printing: "Holofoil",
    pts: [["2024-10-26", 100], ...lugia],
  };
  const others = [400, 300, 200, 100, 50].map((price, i) => flatCard(i + 1, price));
  const tags = () => [];
  const blocked = chaseLists([lugiaCard, ...others], tags, { asOf: ASOF, lowOf: () => null });
  const blockedText = JSON.stringify(blocked);
  t("an unbacked thin card cannot lead the chase list or its total", blocked.length === 1 && !blockedText.includes("Lugia") && !blockedText.includes("2,717.32") && blocked[0].headline.includes("1,050.00"));
  const shown = chaseLists([lugiaCard, ...others], tags, { asOf: ASOF, lowOf: (c) => (c.id === "tcgcsv-86916" ? 2849.99 : null) });
  t("a backed thin card still leads and carries the line", shown.length === 1 && shown[0].lines[0].includes("Lugia EX") && shown[0].lines[1] === LINE && shown[0].lines.at(-1).startsWith("TCGplayer market,") && shown[0].headline.includes("3,717.32") && shown[0].lines.length <= 6);

  const storyOff = cardStories([lugiaCard], { asOf: ASOF, lowOf: () => null });
  const storyOn = cardStories([lugiaCard], { asOf: ASOF, lowOf: () => 2849.99 });
  t("an unbacked thin card cannot headline", storyOff.length === 0);
  t("a backed thin card can headline and still says few changes", storyOn.length === 1 && storyOn[0].headline.startsWith("The story of Lugia EX") && storyOn[0].lines.includes(LINE));

  const from = await dayPrice(712097, "2026-10-05");
  const to = await dayPrice(712097, "2026-10-26");
  t("Delta Reign Booster Bundle names Oct 5 to Oct 26", from === 78.83 && to === 55.83 && whyPlain(from, to, "2026-10-05", "2026-10-26") === "Down $23.00 from Oct 5 to Oct 26.");
  t("dates stay off the line when a caller has none", whyPlain(78.83, 55.83) === "Down $23.00 on those two dates.");

  const sealed = buildGroup({
    groupId: 1,
    groupName: "ME06: Delta Reign",
    asOf: ASOF,
    products: [{ productId: 712097, name: "Delta Reign Booster Bundle", extendedData: [] }],
    priceRows: [{ productId: 712097, marketPrice: 55.83, lowPrice: 52.5, subTypeName: "Normal" }],
  });
  const bundle = sealed.prices[0];
  t("a sealed low is stored with no condition label", bundle && bundle.low === 52.5 && bundle.printing === "Normal" && !("condition" in bundle) && sealed.items[0].kind === "sealed");

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("thin-trading.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
