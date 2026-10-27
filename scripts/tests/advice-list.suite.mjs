// The shared advice list. Plain Buy, Sell, Shop and price target stay.
// A line that tells someone what to do with money is flagged, never rewritten.
import { adviceFlags, banned, assertPublicCopy } from "../lib/lifecycle-curves.mjs";

const LINES = ["buy now", "You should sell this.", "load up", "guaranteed", "can't lose", "to the moon"];

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("plain Buy is allowed", banned("Buy") === false);
  t("plain Sell is allowed", banned("Sell") === false);
  t("plain Shop is allowed", banned("Shop") === false);
  t("price target is allowed", banned("price target") === false);
  t("Sell your cards is allowed", banned("Sell your cards") === false);

  for (const line of LINES) {
    const flags = adviceFlags(line, "about", "sample");
    t(`${line} names the line and the reason`, flags.length > 0 && flags[0].line === line && Boolean(flags[0].reason));
  }

  const doc = { about: "Shop the page.", name: "Buy", title: "Sell", source: "price target", retailNote: null };
  const before = JSON.stringify(doc);
  let passed = false;
  try {
    assertPublicCopy(doc, "lifecycle");
    passed = true;
  } catch { passed = false; }
  t("allowed words pass the public check", passed && JSON.stringify(doc) === before);

  const bad = { claim: "You should sell this.", name: "Lugia" };
  const badBefore = JSON.stringify(bad);
  let message = "";
  let code = "";
  try { assertPublicCopy(bad, "lifecycle"); }
  catch (err) { message = err.message; code = err.code; }
  t("a flagged document is not rewritten", JSON.stringify(bad) === badBefore);
  t("the flag shows the line and the reason", code === "BANNED" && message.includes("You should sell this.") && message.includes("Tells the reader what to do with their money"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("advice-list.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
