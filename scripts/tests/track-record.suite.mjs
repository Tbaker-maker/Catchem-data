import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shipPriceMap } from "../lib/second-library.mjs";
import { buildTrackRecord, publicTrackRecord, scoreRead, siteTrack } from "../lib/track-record.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function upRead(id, sku) {
  return { id, sku, name: "Example", asOf: "2026-08-01", take: "up", headline: "Copied headline about rain.", price: 99, direction: "up" };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.log("  FAIL", name); }
  };

  const read = { id: "r1", sku: "tcgcsv-1", name: "Example", asOf: "2026-10-01", price: 99, direction: "down", headline: "Copied headline about rain.", take: "dip" };
  const ship = { market: 10, source: "TCGplayer market price" };
  t("under 14 days is too early", scoreRead(read, { "2026-10-15": 8 }, "2026-10-10", ship).status === "too-early");
  t("no later price is not a miss", scoreRead(read, {}, "2026-11-20", ship).status === "no-later-price" && scoreRead(read, {}, "2026-11-20", ship).note === "no later price, so no score");
  t("ship price comes from the file, not the headline", scoreRead(read, {}, "2026-11-20", ship).price === 10);
  t("a missing file price is not a score", scoreRead(read, { "2026-10-15": 8 }, "2026-12-01", null).status === "no-score" && scoreRead(read, { "2026-10-15": 8 }, "2026-12-01", null).price === null);
  const hit = scoreRead(read, { "2026-10-15": 8, "2026-10-29": 12, "2026-11-26": 9 }, "2026-12-01", ship);
  t("exact days 14, 28, and 56 score", hit.marks["14"].day === "2026-10-15" && hit.marks["14"].sameDirection === true && hit.marks["28"].day === "2026-10-29" && hit.marks["28"].sameDirection === false && hit.marks["56"].day === "2026-11-26" && hit.marks["56"].sameDirection === true);
  t("a missing exact day is not filled", scoreRead(read, { "2026-10-16": 8 }, "2026-12-01", ship).marks["14"].price === null && scoreRead(read, { "2026-10-16": 8 }, "2026-12-01", ship).status === "no-later-price");
  const early = buildTrackRecord([read], {}, "2026-10-02", { "tcgcsv-1": { "2026-10-01": ship } });
  t("a young read has no percent", early.public === false && early.tooEarly === 1 && early.scored14 === 0 && early.types[0].percent14 == null && early.types[0].line14 === "0 scored so far");
  const book = buildTrackRecord([
    read,
    { id: "r2", sku: "tcgcsv-2", name: "Other", asOf: "2026-09-01", price: 1, direction: "up", headline: "Copied headline about rain.", take: "up" },
  ], { "tcgcsv-1": { "2026-10-15": 9 } }, "2026-10-20", {
    "tcgcsv-1": { "2026-10-01": ship },
    "tcgcsv-2": { "2026-09-01": { market: 5, source: "TCGplayer market price" } },
  });
  t("newest row is first", book.rows[0].id === "r1" && book.rows[1].id === "r2");
  t("only the priced later day scores", book.scored14 === 1 && book.types.find((row) => row.type === "up").noLaterPrice === 1);
  t("under 20 of a code stays a count", book.types.every((row) => row.percent14 == null && !Object.hasOwn(row, "percent14")));
  t("a headline is not copied into the file", !JSON.stringify(book).includes("Copied headline"));
  t("private rows have no card line and no sentence", book.cardLines == null && book.rows.every((row) => row.sentence == null && row.cardLine == null));

  const watched = scoreRead({ ...read, take: "watch" }, { "2026-10-15": 1, "2026-10-29": 1, "2026-11-26": 1 }, "2026-12-01", ship);
  t("watch is not scored", watched.status === "no-score" && watched.note === "watch is not scored" && watched.marks == null);
  const noCode = scoreRead({ ...read, take: "" }, { "2026-10-15": 8 }, "2026-12-01", ship);
  t("a read with no take code is not scored", noCode.status === "no-score");
  const up = scoreRead({ ...read, take: "up" }, { "2026-10-15": 12 }, "2026-10-20", ship);
  const avoid = scoreRead({ ...read, take: "avoid" }, { "2026-10-15": 8 }, "2026-10-20", ship);
  const stretched = scoreRead({ ...read, take: "stretched" }, { "2026-10-15": 11 }, "2026-10-20", ship);
  t("up scores higher and avoid and stretched score lower", up.marks["14"].sameDirection === true && avoid.marks["14"].sameDirection === true && stretched.marks["14"].sameDirection === false);

  const many = [];
  for (let i = 0; i < 19; i += 1) many.push(upRead(`u${i}`, "tcgcsv-20"));
  many.push({ id: "w", sku: "tcgcsv-21", name: "Watcher", asOf: "2026-08-01", take: "watch" });
  const under = buildTrackRecord(many, { "tcgcsv-20": { "2026-08-15": 12 } }, "2026-10-01", { "tcgcsv-20": { "2026-08-01": ship }, "tcgcsv-21": { "2026-08-01": ship } });
  const underUp = under.types.find((row) => row.type === "up");
  t("19 scored reads of a code have no percent", underUp.scored14 === 19 && underUp.percent14 == null);
  t("watch does not add a scored read", under.types.find((row) => row.type === "watch").scored14 === 0 && under.scored14 === 19);
  many.push(upRead("u19", "tcgcsv-20"));
  const full = buildTrackRecord(many, { "tcgcsv-20": { "2026-08-15": 12 } }, "2026-10-01", { "tcgcsv-20": { "2026-08-01": ship }, "tcgcsv-21": { "2026-08-01": ship } });
  const fullUp = full.types.find((row) => row.type === "up");
  t("20 scored reads of a code store a percent", fullUp.scored14 === 20 && fullUp.hit14 === 20 && fullUp.percent14 === 100);
  const stub = publicTrackRecord(full);
  const stubText = JSON.stringify(stub);
  t("public stub has no rows", stub.public === false && stub.rows.length === 0 && stub.types.length === 0 && stub.count === 0);
  t("public stub has no card line, sentence, or percent", stub.cardLines == null && !stubText.includes("sentence") && !stubText.includes("Track record:") && !stubText.includes("percent") && !stubText.includes("%"));
  const hidden = siteTrack(stub);
  const hiddenPrivate = siteTrack(full);
  t("the site renders no page, card line, or score while public is false", hidden.page === false && hidden.cardLine === "" && hidden.score == null && hiddenPrivate.page === false && hiddenPrivate.cardLine === "" && hiddenPrivate.score == null);

  let banned = false;
  try {
    buildTrackRecord([{ id: "b", sku: "tcgcsv-9", name: "support", asOf: "2026-08-01", take: "up" }], { "tcgcsv-9": { "2026-08-15": 12 } }, "2026-10-01", { "tcgcsv-9": { "2026-08-01": ship } });
  } catch (err) {
    banned = err.message === "track record used a banned word";
  }
  t("a banned word fails anywhere in the file", banned);
  let sourceBanned = false;
  try {
    buildTrackRecord([upRead("s", "tcgcsv-8")], { "tcgcsv-8": { "2026-08-15": 12 } }, "2026-10-01", { "tcgcsv-8": { "2026-08-01": { market: 10, source: "printed" } } });
  } catch (err) {
    sourceBanned = err.message === "track record used a banned word";
  }
  t("a banned word in the source fails the file", sourceBanned);
  let idOk = true;
  try {
    buildTrackRecord([{ id: "scan-pattern-forming-breakout-tcgcsv-7", sku: "tcgcsv-7", name: "Example", asOf: "2026-08-01", take: "up" }], { "tcgcsv-7": { "2026-08-15": 12 } }, "2026-10-01", { "tcgcsv-7": { "2026-08-01": ship } });
  } catch {
    idOk = false;
  }
  t("a pattern name inside a read id does not fail the file", idOk);

  const day = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily/2026-10-03.json"), "utf8"));
  const row = (day.prices || []).find((item) => item.id === 124072);
  const prices = await shipPriceMap(ROOT, [{ id: "machamp", sku: "tcgcsv-124072", asOf: "2026-10-03", take: "up" }]);
  const fromFile = scoreRead(
    { id: "machamp", sku: "tcgcsv-124072", name: "Machamp", asOf: "2026-10-03", take: "up", headline: "not the ship price 99" },
    prices.later["tcgcsv-124072"] || {},
    "2026-10-17",
    prices.ship["tcgcsv-124072"]?.["2026-10-03"] || null,
  );
  t("the ship price is the daily file market", row.market === 4.41 && fromFile.price === 4.41);
  t("a missing later daily file is no score", fromFile.marks["14"].day === "2026-10-17" && fromFile.marks["14"].price === null && fromFile.status === "no-later-price");

  const pub = JSON.parse(await readFile(join(ROOT, "research/assets/public/track-record.json"), "utf8"));
  const onDisk = siteTrack(pub);
  t("the committed public file is a stub", pub.public === false && Array.isArray(pub.rows) && pub.rows.length === 0 && pub.cardLines == null && !JSON.stringify(pub).includes("Track record:") && !JSON.stringify(pub).includes('"sentence"'));
  t("the committed public file renders nothing", onDisk.page === false && onDisk.cardLine === "" && onDisk.score == null);

  if (fail) console.log(fail + " failed");
  else console.log("track record ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await run();
  if (n) process.exit(1);
}
