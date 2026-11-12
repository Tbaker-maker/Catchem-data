// UX audit Nov 11 (3): reads said "matches the high on file across the 85 day
// range. History starts Feb 8, 2024" (Rayquaza 26/110), said "tonight" on a
// price that was days old, and worded sealed vs chase both ways ("it costs 1.4x
// the card" on a box, "the card costs 24.9x the sealed price" on a pack).
import { whatWeSee } from "../lib/what-we-see.mjs";
import { sealedGapDeep } from "../lib/deep-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  // Every phrase variant, by trying many ids (pick() is a stable hash of the id).
  const variants = (facts) => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(whatWeSee({ ...facts, item: { id: `tcgcsv-${i}` } }));
    return [...seen].filter(Boolean);
  };
  const longHigh = { range: { from: "2024-02-08", now: { date: "2026-10-30", price: 80 }, high: { price: 80, date: "2026-10-30" }, low: { price: 18, date: "2024-11-14" }, daysSinceHigh: 0, fromHighPct: 0, window: { days: 85, high: 80, highOn: "2026-10-30", place: "upper part" } } };
  const lh = variants(longHigh);
  t("a long history is not called an 85 day range", lh.length > 1 && lh.every((s) => !s.includes("85 day range")));
  t("the long-history line names its start", lh.every((s) => s.includes("Feb 8, 2024")));
  t("no 'tonight' on a dated high", lh.every((s) => !/tonight/i.test(s)));

  // When the chip window is the whole history, naming it is still right.
  const shortHigh = { range: { ...longHigh.range, from: "2026-07-27", window: { ...longHigh.range.window, days: 95 } } };
  const sh = variants(shortHigh);
  t("a window that is the whole history keeps its day count", sh.some((s) => s.includes("95 day range")));

  const nearLow = { range: { from: "2024-02-08", now: { date: "2026-10-30", price: 18.2 }, high: { price: 80, date: "2025-01-01" }, low: { price: 18, date: "2026-09-01" }, daysSinceHigh: 667, fromHighPct: -77 } };
  const atLow = { range: { ...nearLow.range, now: { date: "2026-10-30", price: 18 } } };
  const lows = [...variants(nearLow), ...variants(atLow)];
  t("low lines carry the price date, not 'tonight'", lows.length > 2 && lows.every((s) => !/tonight/i.test(s)));
  t("a dated low line names Oct 30", lows.some((s) => s.includes("Oct 30, 2026")));

  // Sealed vs chase: one direction on a pack and on a box.
  const days = ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-30"];
  const chase = { id: "tcgcsv-1", name: "Greninja ex", set: "SV06: Twilight Masquerade", number: "214/167", rarity: "Special Illustration Rare", printing: "Holofoil", pts: days.map((d, i) => [d, i === days.length - 1 ? 232 : 250]) };
  const hist = (v0, v1) => days.map((d, i) => ({ date: d, market: i === days.length - 1 ? v1 : v0 }));
  const gap = sealedGapDeep(
    [
      { id: "pack", name: "Twilight Masquerade Booster Pack", set: "SV06: Twilight Masquerade", tcgPlayerId: 1 },
      { id: "box", name: "Twilight Masquerade Booster Box", set: "SV06: Twilight Masquerade", tcgPlayerId: 2 },
    ],
    new Map([["pack", hist(5, 6)], ["box", hist(300, 335)]]),
    [chase],
    new Map([[1, { group: "SV06: Twilight Masquerade" }], [2, { group: "SV06: Twilight Masquerade" }]]),
    { asOf: "2026-10-30" },
  );
  const pack = gap.find((r) => r.sku === "pack"), box = gap.find((r) => r.sku === "box");
  t("both sealed reads build", pack && box);
  t("pack: the card as a multiple of the sealed price", pack && pack.headline.includes("Greninja ex") && /costs 38\.7x the sealed price on Oct 30, from 50x on Sep 26\./.test(pack.headline));
  t("box: same direction, card over sealed", box && /costs 0\.69x the sealed price on Oct 30, from 0\.83x on Sep 26\./.test(box.headline) && !/it costs/.test(box.headline));
  t("one chart label for both", pack && box && pack.chart.label === box.chart.label && box.chart.points.at(-1)[1] === 0.69);
  t("no 'tonight' in sealed vs chase copy", gap.every((r) => ![r.headline, ...r.lines].join(" ").includes("tonight")));
  // The publish gate checks the same rounding, so an honest box read is kept.
  const { checkRead } = await import("../lib/publish-gate.mjs");
  t("the gate keeps the two-decimal box read", box && !checkRead(box, {}).flags.some((f) => f.rule === "ratio"));
  t("the gate drops a one-decimal box ratio", box && checkRead({ ...box, headline: box.headline.replace("0.69x", "0.7x") }, {}).flags.some((f) => f.rule === "ratio"));

  // The last paired day can be before the catalogue day: name that day, not asOf.
  const lateAsOf = "2026-11-01";
  const chaseLate = { ...chase, pts: chase.pts.concat([[lateAsOf, 232]]) };
  const late = sealedGapDeep(
    [
      { id: "pack", name: "Twilight Masquerade Booster Pack", set: "SV06: Twilight Masquerade", tcgPlayerId: 1 },
    ],
    new Map([["pack", hist(5, 6)]]),
    [chaseLate],
    new Map([[1, { group: "SV06: Twilight Masquerade" }]]),
    { asOf: lateAsOf },
  );
  const latePack = late.find((r) => r.sku === "pack");
  t("a read still builds when the last paired day is 2 days before asOf", latePack && latePack.headline.includes("on Oct 30") && latePack.headline.includes("from 50x on Sep 26"));
  t("the headline and both dollar lines name the paired day, not asOf", latePack && latePack.lines[0].includes("Oct 30") && latePack.lines[1].includes("Oct 30") && !latePack.headline.includes("Nov 1") && !latePack.lines[0].includes("Nov 1") && !latePack.lines[1].includes("Nov 1"));
  return fail;
}
