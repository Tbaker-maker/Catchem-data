// Shared PkmnPrices credit plan. config/ppp-budget.json is the single source.
// A lane may spend up to its cap per UTC day, and nobody spends below the reserve.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function loadBudget(root = ROOT) {
  return JSON.parse(readFileSync(join(root, "config/ppp-budget.json"), "utf8"));
}

export function laneCap(name, budget = loadBudget()) {
  const lane = budget.lanes?.[name];
  if (!lane) throw new Error(`unknown PPP lane ${name}`);
  return Number(lane.cap) || 0;
}

// Lanes never add up to more than the plan allows.
export function checkBudget(budget = loadBudget()) {
  const sum = Object.values(budget.lanes || {}).reduce((s, l) => s + (Number(l.cap) || 0), 0);
  const problems = [];
  if (sum + Number(budget.reserve || 0) > Number(budget.dailyCredits)) problems.push(`lanes ${sum} + reserve ${budget.reserve} > ${budget.dailyCredits}`);
  if (!(Number(budget.minGapMs) >= Math.ceil(60000 / Number(budget.perMinute)))) problems.push("minGapMs is under the per-minute limit");
  return problems;
}

// Spend tracker for one lane in one run. remaining = last x-credits-remaining header.
// already = credits this lane spent earlier in the same UTC day (from the ledger).
// spent only ever grows by what x-credits-charged reported, so the cap is on real spend.
// A call that comes back charging more than the caller expected stops the lane for
// the rest of the UTC day: the cost model is wrong, so no later pre-check can be trusted.
// stopped = that day's stop from the ledger, so a second run the same day stays stopped.
export function laneMeter(name, budget = loadBudget(), already = 0, { stopped = null } = {}) {
  const cap = laneCap(name, budget);
  const reserve = Number(budget.reserve) || 0;
  let spent = Number(already) || 0;
  let remaining = null;
  let stop = stopped || null;
  return {
    name,
    cap,
    get spent() { return spent; },
    get remaining() { return remaining; },
    get stopped() { return stop; },
    // can we afford a request that may cost up to `cost` credits?
    canSpend(cost = 1) {
      if (stop) return false;
      if (spent + cost > cap) return false;
      if (remaining != null && remaining - cost < reserve) return false;
      return true;
    },
    charge(charged, left, expected = null) {
      const c = Number(charged) || 0;
      spent += c;
      if (Number.isFinite(Number(left)) && left !== null && left !== "") remaining = Number(left);
      if (!stop && expected !== null && expected !== undefined && Number.isFinite(Number(expected)) && c > Number(expected)) {
        stop = { charged: c, expected: Number(expected) };
      }
    },
  };
}

// Per-UTC-day spend ledger, so a second run on the same day keeps to the same caps.
export function ledgerFor(ledger, day) {
  return ledger && ledger.day === day ? ledger : { day, lanes: {} };
}

// Caps plus reserve, so a reviewer can see the plan never exceeds the daily limit.
export function plannedSpend(budget = loadBudget()) {
  const lanes = Object.fromEntries(
    Object.entries(budget.lanes || {}).map(([name, lane]) => [name, Number(lane.cap) || 0]),
  );
  const laneSum = Object.values(lanes).reduce((sum, n) => sum + n, 0);
  const reserve = Number(budget.reserve) || 0;
  const dailyCredits = Number(budget.dailyCredits) || 0;
  return { lanes, laneSum, reserve, dailyCredits, total: laneSum + reserve };
}

// How many credits the current-price refresh may still spend today.
// usageAlready is only the current lane (from a previous refresh log), never all-lane spend.
export function currentRunBudget(budget, ledger, day, { usageAlready = 0 } = {}) {
  const base = ledgerFor(ledger, day);
  const lanes = { ...(base.lanes || {}) };
  const already = Math.max(Number(lanes.current) || 0, Number(usageAlready) || 0);
  lanes.current = already;
  const cap = laneCap("current", budget);
  const total = Object.values(lanes).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const dailyRoom = Math.max(0, Number(budget.dailyCredits) - Number(budget.reserve || 0) - total);
  const laneRoom = Math.max(0, cap - already);
  return {
    already,
    cap,
    budget: Math.min(laneRoom, dailyRoom),
    ledger: { ...base, day, lanes },
    total,
    dailyRoom,
    laneRoom,
  };
}

