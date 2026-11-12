// Reads check Nov 11 (2): the Nov 11 feed's "down" list was two rows from
// Oct 31, e.g. "Pikachu ex #107 (Mega Evolution Promo) is down 29.2% this week,
// from $206.71 to $146.27." Its prices stopped on Oct 31 under that group; the
// same card was $41.36 on Nov 11 under 30th Celebration. A move must end near
// the catalogue day.
import { assembleCatalogue, staleMove, FEED_STALE_DAYS } from "../lib/feed-catalogue.mjs";

function series(start, values) {
  const t0 = Date.parse(`${start}T00:00:00Z`);
  return values.map((v, i) => [new Date(t0 + i * 86400000).toISOString().slice(0, 10), v]);
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  // 24 days to Oct 31: flat, then a steady 7-day slide.
  const vals = [];
  for (let i = 0; i < 24; i++) vals.push(i < 16 ? 210 : 210 - (i - 15) * 8);
  const old = { id: "tcgcsv-713257", name: "Pikachu ex - 107", set: "ME: Mega Evolution Promo", kind: "single", hist: series("2026-10-08", vals) };
  const fresh = { ...old, id: "tcgcsv-1", hist: series("2026-10-19", vals) };
  t("the fixture's last day is Oct 31", old.hist[old.hist.length - 1][0] === "2026-10-31" && fresh.hist[fresh.hist.length - 1][0] === "2026-11-11");
  const a = assembleCatalogue([old, fresh], [], { asOf: "2026-11-11" });
  const ids = Object.keys(a.cards);
  t("a move that ended eleven days ago is left out", !ids.some((id) => id.startsWith("move-tcgcsv-713257-")));
  t("the same move ending tonight is kept", ids.some((id) => id.startsWith("move-tcgcsv-1-")));
  const b = assembleCatalogue([old], []);
  t("with no catalogue day nothing is dropped", Object.keys(b.cards).some((id) => id.startsWith("move-tcgcsv-713257-")));
  t("two days behind is still current", !staleMove("2026-11-09", "2026-11-11") && FEED_STALE_DAYS === 2);
  t("three days behind is stale", staleMove("2026-11-08", "2026-11-11"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("feed-stale-moves.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("feed stale moves ok");
}
