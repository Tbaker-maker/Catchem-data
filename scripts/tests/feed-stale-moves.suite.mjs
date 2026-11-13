// Reads check Nov 11 (2): the Nov 11 feed's "down" list was two rows from
// Oct 31, e.g. "Pikachu ex #107 (Mega Evolution Promo) is down 29.2% this week,
// from $206.71 to $146.27." Its prices stopped on Oct 31 under that group; the
// same card was $41.36 on Nov 11 under 30th Celebration. A move must end near
// the catalogue day.
import { assembleCatalogue, staleMove, FEED_STALE_DAYS } from "../lib/feed-catalogue.mjs";
import { separateHalfCopies } from "../lib/public-bundle.mjs";
import { catalogueImageUrl } from "../catalogue-images.mjs";

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
  // Reads check Nov 12, after #540. This fixture is 29 days from 2026-10-08:
  // eight days at $400, then down $15 a day to $160 on 2026-10-31, then
  // 2026-11-01 $41, 11-02 $40, 11-03 $39, 11-04 $38, 11-05 $37.30.
  // The median is $295, so half is $147.50. Those five November days sit under
  // that line. #540 puts back every dropped day after the last kept day.
  // The last kept day is 2026-10-31 at $160, so Nov 1 through Nov 5 stay.
  // Nothing is dropped, so this is not a newest-day drop.
  // No window qualifies. The 7-day step from $160 on Oct 31 to $41 on Nov 1
  // is most of that move. The 30-day start is 2026-10-06 and the 90-day start
  // is 2026-08-07. Neither day is in the series, and a later day is never
  // used as the start.
  const crash = [];
  for (let i = 0; i < 24; i++) crash.push(i < 8 ? 400 : 400 - (i - 7) * 15);
  crash.push(41, 40, 39, 38, 37.3);
  const pika = { id: "tcgcsv-713257", name: "Pikachu ex - 107", set: "ME: Mega Evolution Promo", kind: "single", hist: series("2026-10-08", crash) };
  const end = pika.hist[pika.hist.length - 1][0];
  const split = separateHalfCopies(pika.hist);
  const c = assembleCatalogue([pika, fresh], [], { asOf: end });
  t("the cheaper tail after the last kept day stays", split.dropped.length === 0 && !split.ambiguous && split.keep.at(-1)[0] === "2026-11-05" && split.keep.at(-1)[1] === 37.3 && split.keep.find((pt) => pt[0] === "2026-10-31")[1] === 160);
  t("that item is not a newest-day drop", !c.halfDropped.some((row) => row.id === "tcgcsv-713257" && row.reason === "newest-day"));
  t("no window is built once the tail is kept", !Object.keys(c.cards).some((id) => id.startsWith("move-tcgcsv-713257-")));
  t("no card quotes an older price than the newest day", Object.values(c.cards).every((card) => card.sku !== "tcgcsv-713257" || card.price === 37.3));
  // Delta Reign Single Pack Blister [Spritzee]: only Nov 12 ($10.51) was set
  // aside, so the read said $12.29 on Nov 11. One day behind passes the stale
  // check, so this needs the newest-day rule.
  const blister = { id: "tcgcsv-712108", name: "Delta Reign Single Pack Blister [Spritzee]", set: "ME06: Delta Reign", kind: "sealed", hist: [["2026-09-26", 33.12], ["2026-09-27", 33.12], ["2026-10-03", 26.94], ["2026-10-05", 26.24], ["2026-10-06", 25.74], ["2026-10-07", 25.74], ["2026-10-08", 25.36], ["2026-10-09", 25.06], ["2026-10-10", 24.18], ["2026-10-11", 24.18], ["2026-10-12", 24.18], ["2026-10-13", 24.06], ["2026-10-14", 23.92], ["2026-10-15", 23.69], ["2026-10-16", 23.69], ["2026-10-17", 23.12], ["2026-10-18", 23.12], ["2026-10-19", 22.96], ["2026-10-20", 22.67], ["2026-10-21", 22.55], ["2026-10-22", 22.55], ["2026-10-23", 22.42], ["2026-10-24", 21.18], ["2026-10-25", 21.07], ["2026-10-26", 20.8], ["2026-10-27", 20.79], ["2026-10-28", 20.38], ["2026-10-29", 19.95], ["2026-10-30", 19.35], ["2026-10-31", 19.15], ["2026-11-06", 17.12], ["2026-11-07", 14.49], ["2026-11-08", 13.08], ["2026-11-09", 13], ["2026-11-10", 12.96], ["2026-11-11", 12.29], ["2026-11-12", 10.51]] };
  const d = assembleCatalogue([blister], [], { asOf: "2026-11-12" });
  t("a read one day behind the page price is not built", Object.values(d.cards).every((card) => card.price === 10.51 || card.sku !== "tcgcsv-712108") && !Object.values(d.cards).some((card) => card.asOf === "2026-11-11"));
  // Feed images: a TCGplayer photo URL is cleared as foreign, so the Feed
  // builder uses the catalogue picture instead.
  const pics = { "tcgcsv-1": "/img/sv4pt5/130", "tcgcsv-2": "/cards/full/x.png", "tcgcsv-3": "https://tcgplayer-cdn.tcgplayer.com/product/3_in_400x400.jpg" };
  t("a catalogue /img/ path becomes the site picture URL", catalogueImageUrl(pics, "tcgcsv-1") === "/data/editor/tcg/sv4pt5/130_hires.png");
  t("a catalogue /cards/ path stays on the data repo", catalogueImageUrl(pics, "tcgcsv-2").endsWith("/research/assets/cards/full/x.png"));
  t("a foreign URL or a missing id gives no picture", catalogueImageUrl(pics, "tcgcsv-3") === "" && catalogueImageUrl(pics, "tcgcsv-9") === "");
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("feed-stale-moves.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("feed stale moves ok");
}
