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
export function laneMeter(name, budget = loadBudget(), already = 0) {
  const cap = laneCap(name, budget);
  const reserve = Number(budget.reserve) || 0;
  let spent = Number(already) || 0;
  let remaining = null;
  return {
    name,
    cap,
    get spent() { return spent; },
    get remaining() { return remaining; },
    // can we afford a request that may cost up to `cost` credits?
    canSpend(cost = 1) {
      if (spent + cost > cap) return false;
      if (remaining != null && remaining - cost < reserve) return false;
      return true;
    },
    charge(charged, left) {
      spent += Number(charged) || 0;
      if (Number.isFinite(Number(left)) && left !== null && left !== "") remaining = Number(left);
    },
  };
}

// Per-UTC-day spend ledger, so a second run on the same day keeps to the same caps.
export function ledgerFor(ledger, day) {
  return ledger && ledger.day === day ? ledger : { day, lanes: {} };
}
