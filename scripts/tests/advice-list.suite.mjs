// The shared advice list. Plain Buy, Sell, Shop and price target stay.
// A line that tells someone what to do with money is flagged, never rewritten.
import { adviceFlags as lifeFlags, banned as lifeBanned, assertPublicCopy as lifeAssert } from "../lib/lifecycle-curves.mjs";
import { adviceFlags, banned, assertPublicCopy, cleanClaim, safeClaim } from "../lib/read-ledger.mjs";

const LINES = ["buy now", "You should sell this.", "load up", "guaranteed", "can't lose", "to the moon"];

function checkAllowed(t, label, bannedFn) {
  t(`${label} plain Buy is allowed`, bannedFn("Buy") === false);
  t(`${label} plain Sell is allowed`, bannedFn("Sell") === false);
  t(`${label} plain Shop is allowed`, bannedFn("Shop") === false);
  t(`${label} price target is allowed`, bannedFn("price target") === false);
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  checkAllowed(t, "lifecycle", lifeBanned);
  t("lifecycle Sell your cards is allowed", lifeBanned("Sell your cards") === false);
  for (const line of LINES) {
    const flags = lifeFlags(line, "about", "sample");
    t(`lifecycle ${line} names the line and the reason`, flags.length > 0 && flags[0].line === line && Boolean(flags[0].reason));
  }
  const lifeDoc = { about: "Shop the page.", name: "Buy", title: "Sell", source: "price target", retailNote: null };
  const lifeBefore = JSON.stringify(lifeDoc);
  let lifePassed = false;
  try {
    lifeAssert(lifeDoc, "lifecycle");
    lifePassed = true;
  } catch { lifePassed = false; }
  t("lifecycle allowed words pass the public check", lifePassed && JSON.stringify(lifeDoc) === lifeBefore);
  const lifeBad = { claim: "You should sell this.", name: "Lugia" };
  const lifeBadBefore = JSON.stringify(lifeBad);
  let lifeMessage = "";
  let lifeCode = "";
  try { lifeAssert(lifeBad, "lifecycle"); }
  catch (err) { lifeMessage = err.message; lifeCode = err.code; }
  t("lifecycle flagged document is not rewritten", JSON.stringify(lifeBad) === lifeBadBefore);
  t("lifecycle flag shows the line and the reason", lifeCode === "BANNED" && lifeMessage.includes("You should sell this.") && lifeMessage.includes("Tells the reader what to do with their money"));

  checkAllowed(t, "ledger", banned);
  for (const line of LINES) {
    const flags = adviceFlags(line, "claim", "sample");
    t(`ledger ${line} names the line and the reason`, flags.length > 0 && flags[0].line === line && Boolean(flags[0].reason));
  }
  const sale = "25 listings counted. A listing is not a sale.";
  t("a listing sentence is kept", cleanClaim(sale) === sale);
  t("a listing sentence is not money advice", adviceFlags(sale).length === 0);
  const row = { id: "lugia", claim: "You should sell this.", name: "Lugia" };
  const kept = safeClaim(row);
  t("safeClaim does not rewrite the claim", kept === row && kept.claim === "You should sell this.");
  const dashed = "Price moved \u2013 then settled.";
  const dashRow = safeClaim({ id: "dash", claim: dashed, name: "Lugia" });
  const dashFlags = adviceFlags(dashed, "claim", "dash");
  t("an en dash is flagged and not rewritten", dashRow.claim === dashed && dashFlags.some((f) => f.rule === "dash" && f.line === dashed && f.reason));
  let message = "";
  let code = "";
  const bad = { claim: "You should sell this.", name: "Lugia" };
  const badBefore = JSON.stringify(bad);
  try { assertPublicCopy(bad, "read ledger"); }
  catch (err) { message = err.message; code = err.code; }
  t("a flagged document is not rewritten", JSON.stringify(bad) === badBefore);
  t("the flag shows the line and the reason", code === "BANNED" && message.includes("You should sell this.") && message.includes("Tells the reader what to do with their money"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("advice-list.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
