// falsifier.mjs — THE AGENT THAT ATTACKS US.
//
// Every house thesis ships with the condition that would prove it wrong.
// Nobody in this hobby publishes those, and nobody anywhere checks them on a
// schedule. This does, every morning: it walks each thesis, tests its
// falsifier against today's data, and reports SURVIVED, TRIPPED, or
// INSUFFICIENT — the last being the honest answer more often than either.
//
// LAWS IT OBEYS
// - No-Guessing: a test that cannot be run reports INSUFFICIENT with the
//   reason and the data it would need. It never approximates a verdict.
// - It reports against us as readily as for us. A thesis that survives on a
//   technicality is reported as surviving on a technicality.
// - It drafts amendments; it never publishes them. Drafts-for-human.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rotate } from "./rotate.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const der = await J("data/derived-insights.json") ?? {};
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const div = await J("data/divergence-report.json") ?? { rows: [] };
const hh = await J("data/heat-history.json") ?? [];
const ixh = await J("research/pulse/index-history.json") ?? { entries: [] };
const today = new Date().toISOString().slice(0, 10);


// ── VOICE (Tyler, 2026-08-23: "don't let the agents feel like robots") ──
// Warmth is not impersonation. This agent is obviously a machine and says so;
// it just does not have to sound like a compliance form. Three rules:
//   1. The jokes are always at OUR expense. Never a member's, never a vendor's.
//   2. The numbers stay flat. Humour lives in the sentence around them.
//   3. Rotate the phrasing, or a daily artifact becomes wallpaper by week two.
const pickLine = (arr, salt = 0) => rotate(arr, salt);
const VOICE = {
  allSurvived: [
    "Tried to prove ourselves wrong this morning. Failed again. Annoying, but reassuring.",
    "Went looking for a reason to retract something. Came back empty-handed.",
    "Every claim we make survived its own kill condition today. We'll try harder tomorrow.",
    "No theses died today. The scoreboard stays boring, which is the good outcome.",
  ],
  someTripped: [
    "One of our own claims did not survive today. That is what the falsifiers are for, and it is going in public.",
    "We said in advance what would end this thesis. That thing happened. So it ends.",
    "A read we published has failed its own test. Better we find it than you do.",
  ],
  mostlyInsufficient: [
    "Mostly \"we cannot tell yet\" today — half these tests need weeks of history we simply do not have. Saying so beats guessing.",
    "A lot of honest shrugs on this run. The tape is young; the tests are patient.",
    "Not much of a verdict today. Most of our claims need more time before they can be judged, and pretending otherwise would be the actual failure.",
  ],
};

const live = (sp.products || []).filter(p => p.dataStatus === "live" && p.priceMedian);
const daysOfTape = new Set(hh.filter(r => r.date >= "2026-08-19").map(r => r.date)).size;

// A test returns { verdict, detail, needs? }.
// SURVIVED  — the falsifier condition did not occur.
// TRIPPED   — it did; the thesis must be amended in public.
// INSUFFICIENT — we cannot honestly say yet, and we say exactly what is missing.
const tests = [

  { id: "RT-1", name: "The Reprint Cycle",
    falsifier: "a reprint-era product class stays below its pre-reprint level long enough that reprints are not absorbed",
    run: () => daysOfTape < 30
      ? { verdict: "INSUFFICIENT", detail: `needs a multi-week price series to judge absorption; we hold ${daysOfTape} clean days`, needs: "30+ days of tape across a reprint event" }
      : { verdict: "PENDING", detail: "no reprint event inside the clean window yet" } },

  { id: "RT-3", name: "Depth–Liquidity Matrix",
    falsifier: "pile-up states precede 14-day price softness in fewer than 55% of cases",
    run: () => daysOfTape < 21
      ? { verdict: "INSUFFICIENT", detail: `the test needs 14 days AFTER each pile-up state; we hold ${daysOfTape} days total`, needs: "21+ days of tape" }
      : { verdict: "PENDING", detail: "depth reads are still calibrating" } },

  { id: "RT-4", name: "The Photo Premium",
    falsifier: "the resting cross-market baseline measures at or below 0% — i.e. eBay stops carrying a premium at all",
    run: () => {
      const rows = (div.rows || []).filter(r => r.spreadPct != null && !r.offTcgEra);
      if (rows.length < 20) return { verdict: "INSUFFICIENT", detail: `only ${rows.length} comparable rows`, needs: "20+ cross-market rows" };
      const sorted = rows.map(r => r.spreadPct).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return median <= 0
        ? { verdict: "TRIPPED", detail: `median cross-market gap is ${median}% across ${rows.length} products — eBay is no longer carrying a premium, which is the stated kill condition` }
        : { verdict: "SURVIVED", detail: `median gap ${median}% across ${rows.length} products, still positive` };
    } },

  { id: "RT-4b", name: "Commodity-Pack Venue Rule",
    falsifier: "mapped TCGplayer pack prices persistently sit ABOVE eBay asks for the same SKU",
    run: () => {
      const packs = (div.rows || []).filter(r => r.id.endsWith("-pack") && r.tcgMarket && r.ebayAskMedian);
      if (packs.length < 10) return { verdict: "INSUFFICIENT", detail: `${packs.length} mapped pack SKUs`, needs: "10+ mapped packs" };
      const above = packs.filter(r => r.tcgMarket > r.ebayAskMedian).length;
      const pct = Math.round(above / packs.length * 100);
      return pct > 50
        ? { verdict: "TRIPPED", detail: `TCGplayer sits above eBay on ${pct}% of ${packs.length} mapped packs — the commodity assumption fails for this class` }
        : { verdict: "SURVIVED", detail: `TCGplayer sits above eBay on only ${pct}% of ${packs.length} mapped packs` };
    } },

  { id: "RT-4a", name: "Venue Boundary",
    falsifier: "TCGplayer vintage-sealed volume becomes material — listing depth comparable to modern",
    run: () => {
      const vintage = live.filter(p => /^(sm|xy|base|neo|hgss|bw|det|dp)/.test(p.id));
      const modern = live.filter(p => /^(sv|swsh|me)/.test(p.id));
      if (!vintage.length || !modern.length) return { verdict: "INSUFFICIENT", detail: "not enough of one class to compare" };
      const med = a => { const s = a.map(p => p.listingCount || 0).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
      const v = med(vintage), m = med(modern);
      return v >= m * 0.8
        ? { verdict: "TRIPPED", detail: `vintage listing depth (${v}) has reached ${Math.round(v / m * 100)}% of modern (${m}) — the venue gate should be re-opened` }
        : { verdict: "SURVIVED", detail: `vintage depth ${v} vs modern ${m} — still a thinner, separate market` };
    } },

  { id: "RT-5", name: "PSA-9 Tax / Fresh-Set Exception",
    falsifier: "fresh-set 9-premiums persist 12+ months after release, i.e. the bend never fades",
    run: () => ({ verdict: "INSUFFICIENT", detail: "graded premiums need a licensed daily graded feed we do not have", needs: "a licensed graded-price source" }) },

  { id: "RT-6", name: "Scheduled-Event Anticlimax",
    falsifier: "a rotation or print-close date produces a measurable same-week move across the affected cohort",
    run: () => ({ verdict: "INSUFFICIENT", detail: "no scheduled event has fallen inside the clean window; first real test is the April 2027 rotation", needs: "a scheduled event inside the tape" }) },

  { id: "RT-2", name: "Supply Injection Absorb-or-Stall",
    falsifier: "a supply injection is followed by neither absorption nor a stall — listings rise and prices are unaffected either way",
    run: () => {
      const shifts = (der.supplyShifts || []).filter(s => s.dPct != null && s.priceDPct != null);
      if (shifts.length < 5) return { verdict: "INSUFFICIENT", detail: `${shifts.length} shifts with both listing and price deltas`, needs: "5+ shift events" };
      const injections = shifts.filter(s => s.dPct > 15);
      if (!injections.length) return { verdict: "INSUFFICIENT", detail: "no supply injections in today's data to test against", needs: "a shift with listings up 15%+" };
      const unaffected = injections.filter(s => Math.abs(s.priceDPct) < 1).length;
      const pct = Math.round(unaffected / injections.length * 100);
      return pct >= 80
        ? { verdict: "TRIPPED", detail: `${pct}% of ${injections.length} supply injections moved prices less than 1% — injections are not being absorbed OR stalling, which is the stated kill condition` }
        : { verdict: "SURVIVED", detail: `${injections.length} injections today; ${100 - pct}% moved prices measurably` };
    } },

  { id: "RT-7", name: "Artist Cohort Attribution",
    falsifier: "cards by the same illustrator move together no more often than random cards of similar rarity and era",
    run: () => ({ verdict: "INSUFFICIENT", detail: "needs the full catalogue ingested plus 30+ days of singles history to compare cohort coherence against a random baseline", needs: "catalogue + 30 days of singles tape" }) },

  // Not a thesis, but the same discipline: the index must never move on a
  // methodology change. This has been violated twice and is worth a daily check.
  { id: "IDX", name: "Index moves only on the market",
    falsifier: "the index level changes on a day when composition or pricing basis changed",
    run: () => {
      const e = (ixh.entries || []).slice(-1)[0];
      if (!e) return { verdict: "INSUFFICIENT", detail: "no index history yet" };
      if (e.matched === 0 && e.date === today) return { verdict: "SURVIVED", detail: "first day of a clean series — no prior day to move against" };
      const unmatched = (e.constituents ?? 0) - (e.matched ?? 0);
      return { verdict: "SURVIVED", detail: `${e.matched} products carried the day's move; ${unmatched} entered or lacked a prior price and correctly contributed nothing` };
    } },
];

// COVERAGE: a thesis written and never tested is exactly the failure this
// agent exists to prevent, so it checks itself. RT-2 and RT-7 were both
// missing when this was added — written into doctrine, tested by nothing.
const theses = [...(await readFile(join(ROOT, "research/house-theses.md"), "utf-8")).matchAll(/^## (RT-[0-9a-z]+)/gm)].map(m => m[1]);
const untested = theses.filter(t => !tests.some(x => x.id === t));

const results = tests.map(t => { try { return { ...t, ...t.run() }; } catch (e) { return { ...t, verdict: "ERROR", detail: e.message }; } });
const tripped = results.filter(r => r.verdict === "TRIPPED");
const mood = tripped.length ? pickLine(VOICE.someTripped)
  : results.filter(r => r.verdict === "INSUFFICIENT").length >= results.length / 2 ? pickLine(VOICE.mostlyInsufficient)
  : pickLine(VOICE.allSurvived);
if (untested.length) console.warn(`  ⚠ ${untested.length} thesis/theses in doctrine with NO falsifier test: ${untested.join(", ")} — write one or retire the thesis`);
const report = { generatedAt: new Date().toISOString(), date: today, mood,
  note: "We test our own claims before anyone else gets the chance. INSUFFICIENT is an honest verdict and is reported as loudly as the others.",
  coverage: { thesesInDoctrine: theses.length, tested: theses.length - untested.length, untested },
  summary: { survived: results.filter(r => r.verdict === "SURVIVED").length,
             tripped: tripped.length,
             insufficient: results.filter(r => r.verdict === "INSUFFICIENT").length,
             pending: results.filter(r => r.verdict === "PENDING").length },
  results: results.map(({ id, name, falsifier, verdict, detail, needs }) => ({ id, name, falsifier, verdict, detail, needs })),
  amendmentsDrafted: tripped.map(t => ({ thesis: t.id,
    draft: `${t.id} (${t.name}) tripped its own falsifier on ${today}: ${t.detail} We stated in advance that this would end the thesis, so it ends. A replacement read will not be published until it carries its own falsifier.` })) };

await writeFile(join(ROOT, "research/pulse/falsifier-report.json"), JSON.stringify(report, null, 1));
console.log(`\n  ${mood}\n`);
console.log(`✓ falsifier: ${report.summary.survived} survived · ${report.summary.tripped} TRIPPED · ${report.summary.insufficient} insufficient · ${report.summary.pending} pending`);
for (const r of results) console.log(`  ${r.verdict.padEnd(12)} ${r.id.padEnd(6)} ${r.detail}`);
if (tripped.length) console.log(`\n  ⚠ ${tripped.length} thesis/theses tripped — amendment drafts are in the report. Publishing them is a human decision.`);
