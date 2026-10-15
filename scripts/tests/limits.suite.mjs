import { buildLimits, listingSource, mergeAlerts, pptSource, warningLine, youtubeSource, LISTING_CALL_BUDGET } from "../lib/limits-watch.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const now = new Date("2026-10-15T22:00:00.000Z");
  const hot = listingSource([{ at: "2026-10-15T21:00:00.000Z", n: 3700 }], now);
  t("85% of the listing budget warns", hot.share >= 0.85 && warningLine(hot).includes("87%") && warningLine(hot).includes("4,277") && warningLine(hot).includes("2026-10-15"));
  const quiet = listingSource([{ at: "2026-10-15T21:00:00.000Z", n: 100 }], now);
  t("under 85% has no warning", quiet.share < 0.85 && warningLine(quiet) === "");
  t("a call older than 24 hours is not counted", listingSource([{ at: "2026-10-14T21:00:00.000Z", n: 4000 }], now).used === 0);
  const ppt = pptSource({ asOf: "2026-10-15", credits: { usedToday: 15994, left: 4006 } });
  t("PPT limit is used plus left and stays quiet under 85%", ppt.used === 15994 && ppt.limit === 20000 && ppt.share === 0.8 && warningLine(ppt) === "");
  const pptHot = pptSource({ asOf: "2026-10-15", credits: { usedToday: 17000, left: 3000 } });
  t("PPT warns at 85%", pptHot.share === 0.85 && warningLine(pptHot).includes("85%") && warningLine(pptHot).includes("20,000"));
  t("a PPT file with no dated credits is omitted", pptSource({ credits: { usedToday: 10, left: 10 } }) === null && pptSource(null) === null);
  t("a missing YouTube file is omitted", youtubeSource(null) === null && youtubeSource({ quota: [] }) === null);
  const yt = youtubeSource({ quota: [{ date: "2026-10-15", units: 9000, videos: 4 }] });
  t("YouTube uses the dated units", yt.used === 9000 && yt.limit === 10000 && warningLine(yt).includes("90%"));
  const doc = buildLimits({
    now,
    listingLog: [{ at: "2026-10-15T21:00:00.000Z", n: 100 }],
    ppt: null,
    youtube: null,
  });
  t("a missing source is left out and no number is invented", doc.sources.length === 1 && doc.sources[0].id === "ebay-browse" && !doc.sources.some((s) => s.id === "ppt" || s.id === "youtube" || s.id === "railway"));
  t("the listing budget stays 4277", LISTING_CALL_BUDGET === 4277 && doc.sources[0].limit === 4277);
  const merged = mergeAlerts(["Price day is behind."], ["eBay Browse is at 87% of the 4,277 daily listing calls as of 2026-10-15."]);
  t("a warning is added without dropping an older alert", merged.length === 2 && merged[0].startsWith("Price"));
  t("warning copy has no banned dash", !doc.warnings.join(" ").includes("\u2014") && !warningLine(hot).includes("\u2014"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("limits.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("limits watch ok");
}
