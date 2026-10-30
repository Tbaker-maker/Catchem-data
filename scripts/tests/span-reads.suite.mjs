// Year-range, year-ago, season, and the renamed card headline.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { everyPrinting } from "../lib/deep-reads-2.mjs";
import {
  FAN_NOTE,
  MIN_HISTORY_DAYS,
  assembleSpanReads,
  calendarEnds,
  mergeOwnFill,
  releaseEnds,
  seasonItemRead,
  seasonSetRead,
  spanCopyOk,
  yearAgoRead,
  yearRangeRead,
} from "../lib/span-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function pts(rows, src = "own") {
  return rows.map(([date, price]) => ({ date, price, src }));
}

function item(extra) {
  return {
    id: "tcgcsv-1",
    name: "Test Box",
    set: "SV: Test",
    setSlug: "sv-test",
    kind: "sealed",
    release: "2020-01-01",
    href: "/p/tcgcsv-1",
    points: [],
    ...extra,
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name); } };

  const merged = mergeOwnFill(
    [["2026-01-15", 50], ["2026-10-13", 52]],
    [["2025-10-13", 80], ["2026-01-15", 1], ["2026-09-01", 1]],
  );
  t("own wins on the shared date and later fill is dropped", merged.find((p) => p.date === "2026-01-15")?.price === 50 && merged.find((p) => p.date === "2026-01-15")?.src === "own" && !merged.some((p) => p.date === "2026-09-01") && merged.some((p) => p.date === "2025-10-13" && p.src === "fill" && p.price === 80));
  t("fill with no own days is not used", mergeOwnFill([], [["2025-10-13", 10]]).length === 0);

  const long = item({
    points: [
      ...pts([["2025-10-13", 80]], "fill"),
      ...pts([["2026-01-15", 50], ["2026-10-13", 52]]),
    ],
  });
  const nearLow = yearRangeRead(long, "2026-10-13");
  t("near the low end names the latest date and the fan-site note", nearLow && /Near the low end of its 12-month range/.test(nearLow.headline) && nearLow.headline.includes("$52.00") && nearLow.headline.includes("Oct 13") && nearLow.lines.includes(FAN_NOTE) && nearLow.receipt.low.price === 50 && nearLow.receipt.high.price === 80 && nearLow.receipt.spanDays >= MIN_HISTORY_DAYS);
  t("a short history is skipped", yearRangeRead(item({ points: pts([["2026-09-01", 10], ["2026-10-13", 8]]) }), "2026-10-13") == null);
  t("a range under 10% is skipped", yearRangeRead(item({
    points: pts([["2025-10-13", 100], ["2026-01-15", 105], ["2026-10-13", 109]]),
  }), "2026-10-13") == null);
  t("a 10% range at the low end is kept without a fan-site note", (() => {
    const read = yearRangeRead(item({ points: pts([["2025-10-13", 110], ["2026-06-01", 100], ["2026-10-13", 100]]) }), "2026-10-13");
    return read && read.receipt.edge === "low" && !read.lines.includes(FAN_NOTE);
  })());
  t("the middle of the range is skipped", yearRangeRead(item({
    points: pts([["2025-10-13", 80], ["2026-01-15", 50], ["2026-10-13", 65]]),
  }), "2026-10-13") == null);
  const nearHigh = yearRangeRead(item({
    kind: "single",
    href: "/c/tcgcsv-9",
    id: "tcgcsv-9",
    name: "Pikachu",
    points: [...pts([["2025-10-13", 40]], "fill"), ...pts([["2026-03-01", 70], ["2026-10-13", 78]])],
  }), "2026-10-13");
  t("a single with fill can sit near the high end", nearHigh && nearHigh.receipt.edge === "high" && nearHigh.href === "/c/tcgcsv-9" && nearHigh.lines.includes(FAN_NOTE) && !/\b(sealed|booster|etb)\b/i.test([nearHigh.headline, ...nearHigh.lines].join(" ")));

  const ago = item({
    points: pts([["2025-10-13", 10], ["2026-10-13", 12]]),
  });
  const year = yearAgoRead(ago, "2026-10-13");
  t("a year ago today names both dates and the percent", year && year.headline.startsWith("A year ago today it was $10.00 on Oct 13, 2025") && year.headline.includes("now $12.00 on Oct 13, 2026 (+20%)") && !year.headline.includes(" NM") && year.receipt.today === true);
  t("a point 2 days off does not say today", (() => {
    const read = yearAgoRead(item({ points: pts([["2025-10-11", 10], ["2026-10-13", 12]]) }), "2026-10-13");
    return read && !/today/.test(read.headline) && read.headline.includes("Oct 11, 2025") && read.lines.some((l) => l.includes("Oct 11, 2025")) && !read.lines.some((l) => /\b20\d{2}-\d{2}-\d{2}\b/.test(l));
  })());
  t("a point 4 days off is skipped", yearAgoRead(item({ points: pts([["2025-10-09", 10], ["2026-10-13", 12]]) }), "2026-10-13") == null);
  t("a move under 5% is skipped", yearAgoRead(item({ points: pts([["2025-10-13", 100], ["2026-10-13", 104.9]]) }), "2026-10-13") == null);
  t("a 5% move is kept", yearAgoRead(item({ points: pts([["2025-10-13", 100], ["2026-10-13", 105]]) }), "2026-10-13")?.headline.includes("(+5%)") === true);
  t("a move over 500% is skipped", yearAgoRead(item({ points: pts([["2025-10-13", 10], ["2026-10-13", 80]]) }), "2026-10-13") == null);
  t("a fill year-ago point carries the fan-site note", yearAgoRead(item({
    points: [...pts([["2025-10-13", 40]], "fill"), ...pts([["2026-10-13", 50]])],
  }), "2026-10-13")?.lines.includes(FAN_NOTE) === true);

  t("calendar window is 30 days ending one year back", calendarEnds("2026-10-13").start === "2025-09-13" && calendarEnds("2026-10-13").end === "2025-10-13");
  t("release window is the 30 days after last year's release when tonight is still in that stretch", releaseEnds("2025-09-26", "2026-10-13")?.start === "2025-09-26" && releaseEnds("2025-09-26", "2026-10-13")?.end === "2025-10-26");
  t("a release far from tonight is not a release window", releaseEnds("2020-01-01", "2026-10-13") == null);

  const season = seasonItemRead(item({
    name: "Lost Box",
    release: "2020-01-01",
    points: pts([["2025-09-13", 20], ["2025-10-13", 25], ["2026-10-13", 30]]),
  }), "2026-10-13");
  t("season names last year's 30-day move and both dates", season && /same 30 days last year/.test(season.headline) && season.headline.includes("$20.00") && season.headline.includes("Sep 13, 2025") && season.headline.includes("(+25%)") && season.lines.some((l) => l.includes("Sep 13, 2025") && l.includes("Oct 13, 2025")) && !season.lines.some((l) => /\b20\d{2}-\d{2}-\d{2}\b/.test(l)));
  t("a season move under 5% is skipped", seasonItemRead(item({
    points: pts([["2025-09-13", 100], ["2025-10-13", 104], ["2026-10-13", 104]]),
  }), "2026-10-13") == null);
  const released = seasonItemRead(item({
    name: "Mega Box",
    set: "ME01: Mega Evolution",
    release: "2025-09-26",
    points: pts([["2025-09-13", 10], ["2025-09-26", 40], ["2025-10-13", 11], ["2025-10-26", 50], ["2026-10-13", 55]]),
  }), "2026-10-13");
  t("a live release stretch uses last year's 30 days after release", released && /30 days after ME01: Mega Evolution released/.test(released.headline) && released.headline.includes("Sep 26, 2025") && released.headline.includes("Oct 26, 2025") && !released.headline.includes("Sep 13"));
  const older = seasonItemRead(item({
    name: "Old Card",
    set: "SV: Scarlet & Violet 151",
    release: "2023-09-22",
    points: pts([["2025-09-22", 20], ["2025-10-22", 30], ["2026-10-13", 28]]),
  }), "2026-10-13");
  t("an older set does not claim it released last year", older && /release date last year/.test(older.headline) && !/151 released/.test(older.headline));

  const many = (n, dropOne = false) => Array.from({ length: n }, (_, i) => item({
    id: `tcgcsv-${i + 1}`,
    name: `Mon ${i + 1}`,
    kind: "single",
    href: `/c/tcgcsv-${i + 1}`,
    points: pts([
      [i === 0 && dropOne ? "2025-08-01" : "2025-09-13", 10 + (i % 4)],
      ["2025-10-13", 12 + (i % 5)],
      ["2026-10-13", 14],
    ]),
  }));
  t("a set under 20 measured items gets no set-wide line", seasonSetRead(many(19), "2026-10-13") == null);
  t("a missing end is not counted and does not invent a night", seasonSetRead(many(20, true), "2026-10-13") == null);
  const setRead = seasonSetRead(many(20), "2026-10-13");
  t("20 items with both ends make one set line", setRead && setRead.receipt.setWide === true && setRead.receipt.n === 20 && setRead.receipt.kind === "single" && !/\b(sealed|booster|etb)\b/i.test([setRead.headline, ...setRead.lines].join(" ")) && !setRead.lines.join(" ").includes("2025-08-01"));

  const packed = assembleSpanReads({
    rangeItems: [long],
    agoItems: [ago, ...many(20)],
    asOf: "2026-10-13",
  });
  t("assemble keeps each kind and every line passes the copy gate", packed.reads.some((r) => r.readKind === "year-range") && packed.reads.some((r) => r.readKind === "year-ago") && packed.reads.some((r) => r.readKind === "season") && packed.reads.every((r) => [r.headline, r.why, r.source, ...r.lines].every((s) => spanCopyOk(s))));
  t("fan-site note passes the copy gate", spanCopyOk(FAN_NOTE));

  const cards = Array.from({ length: 6 }, (_, i) => ({
    id: `tcgcsv-${i + 1}`,
    name: `Pikachu - ${i + 1}/100`,
    set: `SV: Test ${i}`,
    number: `${i + 1}/100`,
    rarity: "Rare",
    release: "2024-01-01",
    pts: [["2025-10-13", 4 + i], ["2026-10-13", 10 + i]],
  }));
  const renamed = everyPrinting(cards, () => [], { asOf: "2026-10-13", max: 2 });
  t("the headline counts every card we price", renamed.length === 1 && renamed[0].deep === "printings" && renamed[0].headline === "Every Pikachu card we price: 6 cards, from $10.00 to $15.00 tonight.");
  t("the renamed read has no printing word", renamed.every((r) => [r.headline, r.chart?.label, ...r.lines].every((s) => !/\bprintings?\b/i.test(String(s || "")))));

  const feed = readFileSync(join(ROOT, "scripts/build-feed.mjs"), "utf8");
  t("build-feed collects span reads before the board", feed.includes("collectSpanReads") && feed.indexOf("collectSpanReads") < feed.indexOf("await buildBoardV3") && feed.includes("spanReads"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("span-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
