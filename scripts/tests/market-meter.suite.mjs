// Heat and fear/greed meter. Made up numbers only, plus the committed public file.
import { readFile } from "node:fs/promises";
import {
  clampScore, bandFor, DEFAULT_BANDS, meterSpecOf, packSlice, factLine, adviceFree, shareScore,
} from "../lib/market-meter.mjs";
import { checkMeter, unpublishMeter } from "../lib/publish-gate.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("scores stay inside 0 to 100", clampScore(-4) === 0 && clampScore(0) === 0 && clampScore(50.4) === 50 && clampScore(100) === 100 && clampScore(140) === 100 && clampScore("no") === null);

  const moodCuts = [[0, "Extreme fear"], [24, "Extreme fear"], [25, "Fear"], [44, "Fear"], [45, "Neutral"], [55, "Neutral"], [56, "Greed"], [75, "Greed"], [76, "Extreme greed"], [100, "Extreme greed"]];
  t("mood bands match the cuts", moodCuts.every(([n, name]) => bandFor(n, DEFAULT_BANDS.mood) === name));
  const heatCuts = [[0, "Cold"], [24, "Cold"], [25, "Cool"], [44, "Cool"], [45, "Warm"], [55, "Warm"], [56, "Hot"], [75, "Hot"], [76, "On fire"], [100, "On fire"]];
  t("heat bands match the cuts", heatCuts.every(([n, name]) => bandFor(n, DEFAULT_BANDS.heat) === name));

  t("a missing spec publishes nothing", meterSpecOf(null) === null && meterSpecOf({ cardRating: {} }) === null);
  t("a component that did not pass is not loaded", meterSpecOf({ marketMeter: { minComponents: 2, components: { breadth: { pass: false, weight: 1 }, movers: { pass: true, weight: 1 } } } })?.components?.breadth === undefined);

  const spec = meterSpecOf({
    marketMeter: {
      minComponents: 1,
      components: {
        breadth: { pass: true, weight: 1.3, meter: "mood" },
        momentum: { pass: true, weight: 1, meter: "mood" },
        movers: { pass: true, weight: 1.5, meter: "heat" },
        newHighs: { pass: true, weight: 1, meter: "heat" },
      },
    },
  });
  const breadth = factLine("breadth", { score: 68, up: 17, n: 25 }, "sealed");
  t("reason uses the real numbers", breadth === "68% of sealed up over 7 days (17 of 25)");
  const packed = packSlice({
    breadth: { score: 68, fact: breadth },
    movers: { score: 39, fact: factLine("movers", shareScore([true, false, false, true, false, false, false, false, false, true].slice(0, 0)), "sealed") || "39% of sealed moved more than their usual week (35 of 90)" },
  }, spec);
  t("a missing component is excluded and the count shows it", packed.moodUsed === 1 && packed.heatUsed === 1 && packed.used === 2 && packed.inputs.length === 2 && !packed.inputs.some((row) => row.id === "momentum" || row.id === "newHighs"));
  t("reasons keep the fixture numbers", packed.reasons.some((line) => line.includes("17 of 25") && line.includes("68%")));
  t("no advice wording in the reasons", packed.reasons.every((line) => adviceFree(line)) && !/\b(buy|sell|load up|time to)\b/i.test(packed.reasons.join(" ")));

  const banned = packSlice({
    breadth: { score: 80, fact: "time to buy the sealed index" },
    movers: { score: 20, fact: "20% of sealed moved more than their usual week (2 of 10)" },
  }, spec);
  t("an advice fact is left out", banned.mood == null && banned.heatUsed === 1 && !JSON.stringify(banned).includes("buy"));

  const thin = { published: true, asOf: "2026-10-19", minComponents: 2, market: { mood: 68, heat: 28, moodUsed: 1, heatUsed: 2, reasons: ["68% of sets up over 7 days (10 of 15)"] } };
  t("gate drops a thin meter", checkMeter(thin, { minComponents: 2, freshAsOf: "2026-10-19" }).reasons.includes("thin"));
  const stale = { published: true, asOf: "2026-10-16", minComponents: 2, market: { mood: 68, heat: 28, moodUsed: 2, heatUsed: 2, reasons: ["68% of sets up over 7 days (10 of 15)"] } };
  t("gate drops a stale meter", checkMeter(stale, { minComponents: 2, freshAsOf: "2026-10-19" }).reasons.includes("stale"));
  const fresh = { published: true, asOf: "2026-10-19", minComponents: 2, market: { mood: 68, moodBand: "Greed", heat: 28, heatBand: "Cool", moodUsed: 2, heatUsed: 2, used: 4, reasons: ["68% of sets up over 7 days (10 of 15)"] } };
  t("a full fresh meter stays", checkMeter(fresh, { minComponents: 2, freshAsOf: "2026-10-19" }).ok === true);
  t("unpublish clears the slices", unpublishMeter(fresh).published === false && unpublishMeter(fresh).market === null);
  t("two days behind is still fresh", checkMeter({ ...fresh, asOf: "2026-10-17" }, { minComponents: 2, freshAsOf: "2026-10-19" }).ok === true);

  try {
    const pub = JSON.parse(await readFile(new URL("../../research/assets/public/market-meter.json", import.meta.url), "utf8"));
    const blob = JSON.stringify(pub);
    t("public file has no private hit rate", !blob.includes("hitPct") && !blob.includes("\"rate\""));
    t("public file has no em dash and no advice", !/[\u2014\u2013]/.test(blob) && !/\b(buy|sell|load up|time to|to the moon)\b/i.test(blob));
    t("public market score is in range", pub.market.mood >= 0 && pub.market.mood <= 100 && pub.market.heat >= 0 && pub.market.heat <= 100);
    t("public reasons are real sentences", Array.isArray(pub.market.reasons) && pub.market.reasons.length >= 1 && pub.market.reasons.every((line) => /\d/.test(line)));
    // Vintage publishes only once it has two proven inputs on the same day (Oct 23:
    // first night it did). Either way nothing is invented.
    const v = pub.vintage;
    const vintageHidden = v == null && (pub.hidden || []).some((row) => row.id === "vintage");
    const vintageProven = v != null && Number(v.used) >= 2 && Array.isArray(v.reasons) && v.reasons.length >= 1 && v.reasons.every((line) => /\d/.test(line)) && !(pub.hidden || []).some((row) => row.id === "vintage");
    t("vintage is not invented", vintageHidden || vintageProven);
    t("component bars have scores", Array.isArray(pub.market.inputs) && pub.market.inputs.length >= 2 && pub.market.inputs.every((row) => row.score >= 0 && row.score <= 100 && row.fact));
  } catch {
    t("public market meter file is present", false);
  }
  return fail;
}
