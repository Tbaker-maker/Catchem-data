import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  chooseQuery,
  createLimiter,
  creditCost,
  intradayPlan,
  planFromRecords,
  schedule,
  tierOf,
} from "../lib/ppt-plan.mjs";
import { callsFor, executePlan } from "../ppt-refresh.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export async function runPptPlanTests() {
  fail = 0;
  t("refresh with history is 1 credit", creditCost({ hasHistory: true }) === 1);
  t("history is 2 credits", creditCost({ hasHistory: false }) === 2);
  t("slab first pull is 3", creditCost({ hasHistory: false, includeEbay: true }) === 3);
  t("SIR before illustration rare", tierOf({ rarity: "Special Illustration Rare" }) === "sir");
  t("illustration rare", tierOf({ rarity: "Illustration Rare" }) === "ir");
  t("gallery", tierOf({ rarity: "Trainer Gallery Rare Holo", setName: "Crown Zenith" }) === "gallery");
  t("rare over 5", tierOf({ rarity: "Rare Holo", price: 6 }) === "rare-over-5");
  t("rare at 5 is not over 5", tierOf({ rarity: "Rare", price: 5 }) === "other");
  t("whole set uses fetchAllInSet", chooseQuery(100, 100) === "fetchAllInSet");
  t("a handful stays by id", chooseQuery(2, 100) === "byId");

  const sched = schedule([
    { tier: "a", credits: 15, items: 2 },
    { tier: "b", credits: 5, items: 1 },
  ], 10);
  t("schedule spills across days", sched.days === 2 && sched.tiers[0].startDay === 1 && sched.tiers[1].endDay === 2, JSON.stringify(sched));
  t("unchanged sample is one late run", intradayPlan(false).mode === "one-late-run");
  t("changed sample is every 4 hours", intradayPlan(true).runsUtc.length === 6);
  t("untested sample spends nothing", intradayPlan(null).mode === "untested");

  let clock = 0;
  const sleeps = [];
  const reserve = createLimiter({
    unitsPerMinute: 5,
    now: () => clock,
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
  });
  await reserve(3);
  await reserve(3);
  t("limiter waits instead of bursting", sleeps.length === 1 && sleeps[0] > 0);

  const plan = planFromRecords({
    sealed: [{ tcgPlayerId: "1", hasHistory: true }, { tcgPlayerId: "2", hasHistory: false }],
    cards: [
      { setId: "sv1", rarity: "Special Illustration Rare", name: "A", price: 20 },
      { setId: "sv1", rarity: "Common", name: "B", price: 0.1 },
      { setId: "nope", rarity: "Rare", name: "C", price: 9 },
    ],
    setMap: { sv1: { pptSetId: "abc", cardCount: 2 } },
    slabCandidates: 10,
    slabExecutable: 0,
  });
  t("sealed short of 1000 is stated", plan.sealed.queued === 2 && plan.sealed.shortfall === 998);
  t("unmapped card is blocked", plan.blockedNoSetId === 1);
  t("slabs are not executable", plan.slabs.executable === 0 && plan.slabs.separateFromSingles === true);
  t("set order is kept for calls", plan.setOrder.length === 1 && plan.setOrder[0].pptSetId === "abc");
  const calls = callsFor([{ tcgPlayerId: "9", hasHistory: true }], plan.setOrder);
  t("sealed refresh is estimated at 1", calls[0].estimated === 1 && calls[0].url.includes("includeHistory=true"));
  t("singles call is fetchAllInSet without ebay", calls[1].url.includes("fetchAllInSet=true") && !calls[1].url.includes("includeEbay"));

  const dir = await mkdtemp(join(tmpdir(), "ppt-"));
  const secret = "super-secret-key";
  const ran = await executePlan({
    key: secret,
    calls: [{ bucket: "sealed", id: "sealed-9", estimated: 2, units: 1, items: 1, url: "https://example.test/sealed" }],
    fetchImpl: async () => ({ metadata: { apiCallsConsumed: { total: 2 } }, data: [{ unopenedPrice: 50 }] }),
    reserve: async () => {},
    rawDir: dir,
    budget: 16000,
    secrets: [secret],
  });
  t("credits come from the provider total", ran.used.total === 2 && ran.items.sealed === 1);
  const raw = JSON.parse(await readFile(join(dir, "sealed-9.json"), "utf8"));
  t("raw file is not the public log", raw.data[0].unopenedPrice === 50);
  t("error text would redact the key", !JSON.stringify(ran).includes(secret));

  t("execute without a key sends nothing", (await executePlan({ key: "", calls, fetchImpl: () => { throw new Error("called"); }, reserve: async () => {} })).used.total === 0);

  console.log(fail ? `${fail} failed` : "ppt plan ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runPptPlanTests();
  if (n) process.exit(1);
}
