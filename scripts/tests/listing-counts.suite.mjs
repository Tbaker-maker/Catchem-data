import { guardianOrder, guardianRank, tiers, pickRun, runSlice, roleSlice, missingTop, ptDate, used24, nightlyBudget, buildQuery, keepTitle, summarize, vintageHeldBack } from "../lib/listing-counts.mjs";
import { readFile } from "node:fs/promises";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name); } };
  const cfg = JSON.parse(await readFile(new URL("../../config/api-budgets.json", import.meta.url), "utf8"));
  const b = nightlyBudget({ sealedPriced: 207, limit: cfg.ebayBrowse.dailyLimit, share: cfg.ebayBrowse.useShare });
  t("plan uses 98% of 5000 with 100 in reserve", b.safe === 4900 && b.reserve === 100 && b.budget + b.sealedStep < 4900);
  t("share is a config value", nightlyBudget({ limit: 1000, share: 0.5 }).safe === 500);

  const items = [
    { id: "s1", kind: "sealed", tcgplayerProductId: 1, price: 100, name: "Box A" },
    { id: "s2", kind: "sealed", tcgplayerProductId: 2, price: 50, name: "Box B" },
    { id: "s3", kind: "sealed", tcgplayerProductId: 3, name: "Unpriced tin" },
    { id: "c1", kind: "single", price: 500, name: "Card - 1/10", number: "001/10" },
    { id: "c2", kind: "single", price: 2, name: "Card B - 2/10", number: "2/10" },
    { id: "c3", kind: "single", price: 0.2, name: "Bulk", number: "3" },
  ];
  const tp = tiers({ items, skipIds: new Set(["2"]), dailyBudget: 3, tailFloor: 1 });
  t("priced sealed is in the daily tier, priced-step sealed skipped", tp.daily.some((x) => x.id === "s1") && !tp.daily.some((x) => x.id === "s2") && !tp.tail.some((x) => x.id === "s2"));
  t("unpriced sealed without attention is tail", tp.tail.some((x) => x.id === "s3"));
  t("singles fill the daily tier by value up to budget minus the tail floor", tp.counts.singlesTop === 1 && tp.daily.some((x) => x.id === "c1") && tp.singleCutoff === 500);
  t("attention lifts an unpriced sealed product into the daily tier", tiers({ items, attention: new Set(["s3"]), dailyBudget: 10 }).daily.some((x) => x.id === "s3"));
  t("leftover and tail cycle are reported", tp.leftover === 1 && tp.tailCycleDays === tp.tail.length);

  {
    const gNow = new Date("2026-10-14T05:00:00Z");
    const d = [
      { id: "h", kind: "single", rarity: "Holo Rare", price: 900 },
      { id: "ir", kind: "single", rarity: "Illustration Rare", price: 40 },
      { id: "sir", kind: "single", rarity: "Special Illustration Rare", price: 30 },
      { id: "done", kind: "single", rarity: "Special Illustration Rare", price: 999 },
      { id: "box", kind: "sealed", price: 120 },
    ];
    const last = { done: "2026-10-14T03:00:00Z" };
    const g = pickRun({ daily: d, tail: [{ id: "t" }], last, now: gNow, slice: 10, role: "guardian" });
    t("guardian counts only daily-tier items missing today, never tail", g.length === 4 && !g.some((x) => x.id === "done" || x.id === "t"));
    t("guardian order: chase first, then IR, then the rest", g[0].id === "sir" && g[1].id === "ir" && guardianRank({ kind: "sealed" }) === 2);
    t("guardian respects the slice", pickRun({ daily: d, tail: [], last, now: gNow, slice: 2, role: "guardian" }).length === 2);
    t("guardian slice never exceeds room or the daily listing budget", roleSlice({ role: "guardian", safe: 4900, used: 4800, dailyBudget: 4277 }) === 100 && roleSlice({ role: "guardian", safe: 9000, used: 0, dailyBudget: 4277 }) === 4277 && roleSlice({ role: "guardian", safe: 4900, used: 5000, dailyBudget: 4277 }) === 0);
    t("vintage sample calls stay out of the listing slice until that log exists", vintageHeldBack([], new Date("2026-10-18T20:00:00Z")) === 300 && vintageHeldBack([{ at: "2026-10-18T18:00:00Z", n: 300, source: "vintage-sample" }], new Date("2026-10-18T20:00:00Z")) === 0 && vintageHeldBack([{ at: "2026-10-17T18:00:00Z", n: 300, source: "vintage-sample" }], new Date("2026-10-18T20:00:00Z")) === 300 && roleSlice({ role: "guardian", safe: 4900, used: 4000, dailyBudget: 4000, holdBack: 300 }) === 600 && roleSlice({ role: "guardian", safe: 4900, used: 4000, dailyBudget: 4000 }) === 900);
    t("guardian is idempotent: nothing left after everything is counted", pickRun({ daily: d, tail: [], last: Object.fromEntries(d.map((x) => [x.id, "2026-10-14T04:00:00Z"])), now: gNow, slice: 10, role: "guardian" }).length === 0 && guardianOrder([]).length === 0);
  }

  const now = new Date("2026-10-13T12:00:00Z");
  const log = [{ at: "2026-10-12T11:00:00Z", n: 999 }, { at: "2026-10-13T04:00:00Z", n: 700 }, { at: "2026-10-13T08:00:00Z", n: 300 }];
  t("counter is a rolling 24 hours", used24(log, now) === 1000);
  t("a run takes an even share of the day", runSlice({ safe: 4900, used: 0, dailyBudget: 4200, runsPerDay: 6 }) === 700);
  t("a run never passes the 24-hour cap", runSlice({ safe: 4900, used: 4800, dailyBudget: 4200, runsPerDay: 6 }) === 100 && runSlice({ safe: 4900, used: 5000, dailyBudget: 4200 }) === 0);
  const last = { s1: "2026-10-13T08:00:00Z", c1: "2026-10-12T06:00:00Z" };
  const pr = pickRun({ daily: tp.daily, tail: tp.tail, last, now, slice: 2 });
  t("daily items counted today (PT) wait; stale daily items go first", pr[0].id === "c1" && !pr.some((x) => x.id === "s1"));
  t("leftover goes to the tail", pr.length === 2 && pr[1].tier === "tail");
  t("slice is never exceeded", pickRun({ daily: tp.daily, tail: tp.tail, now, slice: 0 }).length === 0);

  t("raw single query drops graded and lots", /-psa/.test(buildQuery(items[3])) && /-lot/.test(buildQuery(items[3])) && /Card 1\/10/.test(buildQuery(items[3])));
  t("sealed query drops cases", /-case/.test(buildQuery(items[0])));
  t("graded and lot titles are not counted for raw", !keepTitle("single", "PSA 10 Charizard") && !keepTitle("single", "Lot of 5 cards") && keepTitle("single", "Charizard ex 199/165 NM"));
  t("case titles are not counted for sealed", !keepTitle("sealed", "Booster Box Case 6x") && keepTitle("sealed", "Booster Box Sealed"));
  const s = summarize("single", 200, ["Charizard NM", "PSA 9 Charizard", "Charizard", "Charizard lot"]);
  t("count scales the eBay total by the kept share", s.listingsCounted === 100 && s.sampleKept === 2);
  t("no total means no count", summarize("single", undefined, ["a"]).listingsCounted === null);
  const spread = summarize("sealed", 40, ["Booster Box", "Booster Box"], [
    { title: "Booster Box", seller: { username: "alice-seller" } },
    { title: "Booster Box", seller: { username: "alice-seller" } },
    { title: "Booster Box", seller: { username: "bob-seller" } },
  ]);
  t("seller counts stay counts", spread.sellers === 2 && spread.topShare === 0.67 && spread.top2Share === 1 && !JSON.stringify(spread).includes("alice-seller") && !JSON.stringify(spread).includes("username"));
  // Three-run day under the rolling 24h counter (6 AM, noon, 6 PM PT + 9 PM sealed step).
  {
    const budget = b.budget, sealed = b.sealedStep, safe = b.safe;
    const daily = Array.from({ length: 3700 }, (_, i) => ({ id: "top" + i }));
    const tail = Array.from({ length: 30000 }, (_, i) => ({ id: "tail" + i }));
    const last = {};
    const log = [];
    let total = 0, over = false, tailDone = 0;
    const runs = [["full", 13], ["top", 19], ["full", 25], ["sealed", 28]];
    let fullCalls = [];
    for (let day = 0; day < 4; day++) {
      for (const [role, h] of runs) {
        const now = new Date(Date.UTC(2026, 9, 14 + day, h, 0));
        const used = used24(log, now);
        if (role === "sealed") { log.push({ at: now.toISOString(), n: sealed, source: "sealed-price-step" }); if (used + sealed > safe) over = true; continue; }
        const inWin = log.some((e) => e.source === "sealed-price-step" && Date.parse(e.at) > now.getTime() - 86400000);
        const slice = roleSlice({ role, safe, used, dailyBudget: budget, sealedStep: sealed, sealedInWindow: inWin });
        const picked = pickRun({ daily, tail, last, now, slice, role });
        if (role === "full" && h === 13 && day > 0) t(`day ${day}: first full run takes tops before any tail`, picked.slice(0, Math.min(picked.length, missingTop(daily, last, now).length)).every((x) => x.id.startsWith("top")));
        for (const x of picked) last[x.id] = now.toISOString();
        if (role === "full") fullCalls.push(picked.length);
        tailDone += picked.filter((x) => x.id.startsWith("tail")).length;
        log.push({ at: now.toISOString(), n: picked.length, source: "listing-counts" });
        if (used + picked.length > safe) over = true;
        total += picked.length;
      }
      if (day > 0) t(`day ${day}: no top item misses the PT day`, missingTop(daily, last, new Date(Date.UTC(2026, 9, 14 + day, 26, 0))).length === 0);
    }
    t("no run passes the rolling 24h cap", !over);
    t("three runs spend about the whole listing budget", total / 4 > budget * 0.9);
    t("tail keeps rotating", tailDone > 0);
    console.log("  full-run calls", fullCalls.join(","), "per day", Math.round(total / 4));
  }
  // A 429 run leaves tops uncounted; the next run (even midday) retries them first.
  {
    const daily = [{ id: "a" }, { id: "b" }], tail = [{ id: "z" }];
    const now = new Date("2026-10-14T19:00:00Z");
    const last = { a: "2026-10-14T13:05:00Z" };
    t("midday retries only tops not counted today", JSON.stringify(pickRun({ daily, tail, last, now, slice: 5, role: "top" }).map((x) => x.id)) === '["b"]');
    t("full run retries missed tops before tail", pickRun({ daily, tail, last, now, slice: 5 })[0].id === "b");
    t("missing-day check names the top item", JSON.stringify(missingTop(daily, last, now)) === '["b"]');
    t("PT calendar day, not UTC", ptDate("2026-10-15T05:00:00Z") === "2026-10-14");
  }
  const yt = JSON.parse(await readFile(new URL("../../config/youtube-channels.json", import.meta.url), "utf8"));
  t("YouTube cap is 98% of 10,000", Math.floor(cfg.youtube.dailyQuota * cfg.youtube.useShare) === 9800 && yt.limits.dailyUnitBudget <= 9800);
  return fail;
}
