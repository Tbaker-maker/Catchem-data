import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listingRead, SHARED_ART } from "../lib/listing-reads.mjs";
import { libraryOn } from "../lib/second-library.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function pair(start, end, extra = {}) {
  return {
    id: "sv1-etb",
    name: "Scarlet and Violet ETB",
    start: { date: "2026-10-03", filteredTotal: start },
    end: { date: "2026-10-10", filteredTotal: end },
    ...extra,
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const flags = JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf8"));
  t("reads.library stays off", flags.flags["reads.library"].value === false && libraryOn() === false);
  t("ten shared-art parents are skipped", SHARED_ART.size === 10 && ["me1-etb", "sv5-etb", "swsh7-etb", "swsh1-etb", "xy12-etb", "me2pt5-tin", "sm1-etb", "swsh6-etb", "sv8-bb", "swsh5-etb"].every((id) => listingRead(pair(80, 50, { id })) === null));

  const down = listingRead(pair(80, 50));
  t("a qualified filtered pair is a listing sentence and does not publish", down && down.publish === false && down.headline === "eBay listings 80 to 50 (Oct 3 to Oct 10)." && down.take === "watch");
  t("the sentence does not name Browse or listingCount", down && !/Browse|listingCount|browseTotal|because/i.test(down.lines.join(" ")));
  t("a browse total without filteredTotal is not a read", listingRead({ id: "sv1-etb", start: { date: "2026-10-03", browseTotal: 400 }, end: { date: "2026-10-10", browseTotal: 200 } }) === null);
  t("listingCount is not the count", listingRead({ id: "sv1-etb", start: { date: "2026-10-03", listingCount: 80 }, end: { date: "2026-10-10", listingCount: 50 } }) === null);
  t("start under 40 does not qualify", listingRead(pair(39, 20)) === null);
  t("a move under 15 does not qualify", listingRead(pair(80, 70)) === null);
  t("a move under 20% does not qualify", listingRead(pair(100, 85)) === null);
  t("six days is not the pair", listingRead(pair(80, 50, { end: { date: "2026-10-09", filteredTotal: 50 } })) === null);

  const both = listingRead(pair(80, 50, { browseTotal: 900, listingCount: 77, price: { from: 10, to: 12, start: "2026-10-03", end: "2026-10-10" } }));
  t("price comes first and both numbers show when they point opposite ways", both && both.publish === false && both.readKind === "listings-price" && both.headline.startsWith("TCGplayer market: $12.00 (2026-10-10), from $10.00 (2026-10-03).") && both.headline.includes("eBay listings 80 to 50 (Oct 3 to Oct 10).") && !/\bbecause\b/i.test(both.lines.join(" ")) && !both.lines.join(" ").includes("900") && !both.lines.join(" ").includes("77"));
  const same = listingRead(pair(80, 50, { price: { from: 20, to: 16, start: "2026-10-03", end: "2026-10-10" } }));
  t("a same-way price still leads and does not say because", same && same.headline.startsWith("TCGplayer market:") && same.headline.includes("eBay listings 80 to 50") && !/\bbecause\b/i.test(same.headline));

  const src = await readFile(join(ROOT, "scripts/lib/listing-reads.mjs"), "utf8");
  t("the writer does not write a public file", !/writeFile|reads\.json/.test(src));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("listing-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
