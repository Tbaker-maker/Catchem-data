// ppp-enrich lane caps run on real charges (x-credits-charged), and a call that
// charges more than expected stops the lane for the UTC day. No network, no key.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runLanes } from "../ppp-enrich.mjs";
import { currentRunBudget, laneMeter } from "../lib/ppp-budget.mjs";
import { pppClient } from "../lib/ppp-client.mjs";

const NOW = Date.parse("2026-11-12T02:00:00Z");
const NEXT_DAY = Date.parse("2026-11-13T02:00:00Z");
const budget = { dailyCredits: 20000, perMinute: 60, minGapMs: 0, reserve: 0, lanes: { comps: { cap: 50 } }, refreshDays: { comps: 7 } };
// Singles under $20 make one raw comps call each, expected cost 20.
const products = [1, 2, 3, 4, 5].map((pid) => ({ id: `tcgcsv-${pid}`, pid, kind: "single", name: `c${pid}`, market: 10 - pid }));

function fakeClient(chargeFor) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const n = chargeFor(calls.length);
    return new Response(JSON.stringify({ data: [], pagination: { has_more: false } }), { status: 200, headers: { "x-credits-charged": String(n), "x-credits-remaining": "15000" } });
  };
  return { client: pppClient({ key: "test-key", minGapMs: 0, fetchImpl }), calls };
}

async function freshRaw(ledger = null) {
  const dir = await mkdtemp(join(tmpdir(), "ppp-enrich-test-"));
  await writeFile(join(dir, "id-map.json"), JSON.stringify({ single: Object.fromEntries(products.map((p) => [p.pid, `ppp-${p.pid}`])), sealed: {} }));
  if (ledger) await writeFile(join(dir, "ledger.json"), JSON.stringify(ledger));
  return dir;
}

export async function runPppEnrichTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };
  const quiet = () => {};
  const lanes = new Set(["comps"]);
  const dirs = [];
  try {
    const m = laneMeter("comps", budget);
    m.charge(20, null, 20);
    t("a charge at the expected cost keeps the lane open", m.canSpend(20) && !m.stopped);
    m.charge(25, null, 20);
    t("a charge above the expected cost stops the lane", !m.canSpend(1) && m.stopped?.charged === 25 && m.stopped?.expected === 20, JSON.stringify(m.stopped));

    // Actual spend so far plus the expected cost must fit the cap: 0+20, 20+20 fit 50; 40+20 does not.
    let dir = await freshRaw(); dirs.push(dir);
    let fc = fakeClient(() => 20);
    let report = await runLanes({ client: fc.client, budget, products, lanes, now: NOW, log: quiet, rawDir: dir });
    let ledger = JSON.parse(await readFile(join(dir, "ledger.json"), "utf8"));
    t("the cap is checked against real spend before each call", fc.calls.length === 2 && report.comps.credits === 40 && ledger.lanes.comps === 40, `${fc.calls.length} calls, ${report.comps.credits} credits`);

    // Earlier spend today from the ledger counts too.
    dir = await freshRaw({ day: "2026-11-12", lanes: { comps: 45 } }); dirs.push(dir);
    fc = fakeClient(() => 20);
    report = await runLanes({ client: fc.client, budget, products, lanes, now: NOW, log: quiet, rawDir: dir });
    t("a lane with 45 of 50 spent today makes no call that expects 20", fc.calls.length === 0 && report.comps.credits === 0);

    // Overshoot: the first call charges 30 against an expected 20. The lane stops at once.
    dir = await freshRaw(); dirs.push(dir);
    fc = fakeClient(() => 30);
    report = await runLanes({ client: fc.client, budget, products, lanes, now: NOW, log: quiet, rawDir: dir });
    ledger = JSON.parse(await readFile(join(dir, "ledger.json"), "utf8"));
    t("an overcharged call stops the lane after that one call", fc.calls.length === 1 && report.comps.credits === 30, `${fc.calls.length} calls`);
    t("the ledger records the real charge and the stop", ledger.lanes.comps === 30 && ledger.stopped?.comps?.charged === 30 && ledger.stopped?.comps?.expected === 20, JSON.stringify(ledger));
    t("the report says the lane stopped", report.comps.stopped?.charged === 30 && report.comps.stopped?.expected === 20);

    fc = fakeClient(() => 20);
    report = await runLanes({ client: fc.client, budget, products, lanes, now: NOW, log: quiet, rawDir: dir });
    t("a second run the same UTC day stays stopped", fc.calls.length === 0, `${fc.calls.length} calls`);

    fc = fakeClient(() => 20);
    report = await runLanes({ client: fc.client, budget, products, lanes, now: NEXT_DAY, log: quiet, rawDir: dir });
    ledger = JSON.parse(await readFile(join(dir, "ledger.json"), "utf8"));
    t("the stop clears at the next UTC day", fc.calls.length > 0 && !ledger.stopped && ledger.day === "2026-11-13", JSON.stringify(ledger));

    const plan = { ...budget, lanes: { ...budget.lanes, current: { cap: 100 } } };
    const kept = currentRunBudget(plan, { day: "2026-11-12", lanes: { comps: 30 }, stopped: { comps: { charged: 30, expected: 20 } } }, "2026-11-12");
    t("the current-price refresh keeps an enrich lane's stop when it rewrites the ledger", kept.ledger.stopped?.comps?.charged === 30 && kept.ledger.lanes.comps === 30);
  } finally {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  }
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runPppEnrichTests();
  if (n) { console.error(`${n} failed`); process.exit(1); }
}
