// The shared advice list. Plain Buy, Sell, Shop and price target stay.
// A line that tells someone what to do with money is flagged, never rewritten.
import { adviceFlags, banned, assertPublicCopy, dropIfAdvice } from "../lib/explore-index.mjs";

const LINES = ["buy now", "You should sell this.", "load up", "guaranteed", "can't lose", "to the moon"];

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("plain Buy is allowed", banned("Buy") === false && dropIfAdvice("Buy", "title", "n") === false);
  t("plain Sell is allowed", banned("Sell") === false);
  t("plain Shop is allowed", banned("Shop") === false);
  t("price target is allowed", banned("price target") === false);

  for (const line of LINES) {
    const flags = adviceFlags(line, "title", "sample");
    t(`${line} names the line and the reason`, flags.length > 0 && flags[0].line === line && Boolean(flags[0].reason) && dropIfAdvice(line, "title", "sample") === true);
  }

  const dashed = "Moved \u2013 then listed.";
  t("an en dash is flagged and the text stays", dashed.includes("\u2013") && dropIfAdvice(dashed, "headline", "d") === true && adviceFlags(dashed)[0].line === dashed && adviceFlags(dashed)[0].reason);

  const doc = { about: "Reads on file.", name: "Shop", title: "Buy", source: "price target" };
  const before = JSON.stringify(doc);
  let passed = false;
  try { assertPublicCopy(doc, "explore reads"); passed = true; } catch { passed = false; }
  t("allowed words pass and are not rewritten", passed && JSON.stringify(doc) === before);

  const bad = { name: "to the moon" };
  const badBefore = JSON.stringify(bad);
  let message = "";
  let code = "";
  try { assertPublicCopy(bad, "explore news"); }
  catch (err) { message = err.message; code = err.code; }
  t("a flagged document is not rewritten", JSON.stringify(bad) === badBefore);
  t("the flag shows the line and the reason", code === "BANNED" && message.includes("to the moon") && message.includes("Hype that promises a climb"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("advice-list.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
