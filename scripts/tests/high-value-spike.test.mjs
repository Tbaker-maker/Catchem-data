import { highValueSpike } from "../lib/public-bundle.mjs";
let fail = 0;
const t = (n, c) => { if (c) console.log("  ok ", n); else { fail++; console.error("  FAIL", n); } };
export function runHighValueSpikeTests() {
  fail = 0;
  t("a one-day $500+ spike is skipped", highValueSpike([["a", 100], ["b", 100], ["c", 600]], 100, 600) === true);
  t("a $500+ move that held two real days ships", highValueSpike([["a", 100], ["b", 580], ["c", 600]], 100, 600) === false);
  t("a 1st Edition one-day spike is skipped", highValueSpike([["a", 50], ["b", 50], ["c", 300]], 50, 300, { name: "Lugia 1st Edition Holofoil" }) === true);
  t("a cheap card is not held to it", highValueSpike([["a", 5], ["b", 5], ["c", 9]], 5, 9) === false);
  return fail;
}
if (process.argv[1]?.endsWith("high-value-spike.test.mjs")) process.exit(runHighValueSpikeTests() ? 1 : 0);
