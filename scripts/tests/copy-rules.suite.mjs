import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ADVICE, ALLOWED, BANNED, cleanText, cleanDoc, enforceCopy, flagLine, formatFlag, isClean } from "../lib/copy-rules.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => { console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail += 1; };

  // The one shared list.
  const raw = JSON.parse(await readFile(join(ROOT, "rules/advice-phrases.json"), "utf8"));
  t("the list lives in rules/advice-phrases.json", JSON.stringify(raw) === JSON.stringify(ADVICE));
  t("every rule has an id, pattern and reason", ADVICE.rules.every((r) => r.id && r.pattern && r.reason && new RegExp(r.pattern, "i")));
  t("rule ids are unique", new Set(ADVICE.rules.map((r) => r.id)).size === ADVICE.rules.length);
  t("no reason uses a dash", ADVICE.rules.every((r) => !/[\u2014\u2013]/.test(r.reason)));
  for (const a of ["Buy", "Shop", "Sell your cards", "price target", "Buy on TCGplayer", "Buy on eBay"]) t(`"${a}" is on the allowed list and passes`, ALLOWED.includes(a) && isClean(a));

  // Shopping and button words always pass.
  for (const s of ["Buy on TCGplayer", "Buy on eBay", "Shop sealed", "Sell your cards", "Set a price target", "Looks like a buy", "Holo rare", "Sun & Moon booster box", "Best Buy restock", "Hold to see the chart", "Support Box", "Up 4% from Oct 1 to Oct 8"]) {
    t(`passes: ${s}`, isClean(s), JSON.stringify(flagLine(s)));
  }
  // Money advice, crypto words and dashes are flagged.
  const bad = { "Buy now": "buy-now", "Sell it today": "buy-now", "You should buy this box": "you-should", "you need to sell": "you-should", "Load up on ETBs": "load-up", "Guaranteed to climb": "guaranteed", "You can't lose": "cant-lose", "you can\u2019t lose": "cant-lose", "Headed to the moon": "to-the-moon", "Pay in crypto": "crypto", "Bitcoin and NFTs": "crypto", "Up 4% \u2014 since Oct 1": "dash" };
  for (const [s, rule] of Object.entries(bad)) {
    const f = flagLine(s);
    t(`flags ${rule}: ${s}`, f.length >= 1 && f[0].rule === rule && f[0].line === s && f[0].reason.length > 10);
  }
  t("a button label inside a line is not what trips it", isClean("Buy on eBay or Buy on TCGplayer") && !isClean("Buy on eBay. Buy now."));

  // Never rewritten.
  const r = cleanText("Up 4% \u2014 buy now", { field: "why", id: "r-1" });
  t("cleanText never rewrites", r.text === "Up 4% \u2014 buy now" && r.fixes.length === 0);
  t("each flag names the line, field, read and reason", r.errors.length === 2 && r.errors.every((e) => e.includes('"Up 4% \u2014 buy now"') && e.includes('field "why"') && e.includes("read r-1")));
  t("formatFlag carries the reason", formatFlag(r.flags[0]).endsWith(r.flags[0].reason));
  const doc = { reads: [{ id: "x-8", why: "A breakout from the bottom" }] };
  t("old jargon words pass and nothing is swapped", enforceCopy(doc, "reads") === doc && doc.reads[0].why === "A breakout from the bottom");
  let thrown = "";
  try { enforceCopy({ reads: [{ id: "x-9", why: "You should sell now" }] }, "reads"); } catch (e) { thrown = e.message; }
  t("enforceCopy throws with the line, field, read and reason", /flagged "You should sell now" in field "why" of read x-9/.test(thrown) && /Tells people/.test(thrown));
  const idDoc = { id: "scan-pattern-forming-breakout-tcgcsv-84658", key: "buy-now", slug: "load-up", url: "https://x.test/buy-now", file: "data/crypto/play.json", headline: "Up 4% since Oct 1" };
  t("ids, keys, slugs, urls and paths are machine text", cleanDoc(idDoc).errors.length === 0);
  t("house rules: supply and No data are flagged in reads", cleanText("supply fell").errors.length === 1 && cleanText("No data yet").errors.length === 1);
  t("BANNED.test is a drop-in guard", BANNED.test("load up") === true && BANNED.test("Buy on eBay") === false);

  // Today's real board: report flags, never fail on them here.
  const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
  const live = cleanDoc(reads);
  console.log(`  reads.json visible-text flags: ${live.errors.length}`);
  for (const h of live.errors.slice(0, 40)) console.log(`    ${h}`);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("copy-rules.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
