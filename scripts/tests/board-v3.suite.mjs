import { cleanCopy, eraOf, laggingFor, groupClimbReads, listingReads, newsReads, releaseReads, rotationSetReads, rotationPhrase, mixBoard, isPriceRead, buildSealedLag, sealedEra, fillSlots, fitBoard, PRICE_SHARE_MAX, keepPriceRead, keepReleaseRead, priceBoardDay } from "../lib/board-mix.mjs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("advice phrases are caught", !cleanCopy("buy now") && !cleanCopy("you should sell") && !cleanCopy("load up on boxes") && !cleanCopy("a \u2014 b"));
  t("shopping words pass", cleanCopy("Buy on eBay") && cleanCopy("a play here") && cleanCopy("price target") && cleanCopy("Shop the set"));
  t("thin-market triple is dropped", keepPriceRead({ readKind: "sealed", headline: "Since Sep 26, X went from $10.00 to $35.00, up 250%.", price: 35 }) === false);
  t("a normal 8% move is kept", keepPriceRead({ readKind: "sealed", headline: "Since Sep 26, X went from $300.96 to $326.03, up 8.3%.", price: 326.03 }) === true);
  t("em dash is caught", !cleanCopy("a \u2014 b"));
  t("era from TCGplayer group", eraOf("SWSH07: Evolving Skies") === "SWSH" && eraOf("SM - Dragon Majesty") === "SM" && eraOf("SV09: Journey Together") === "SV" && eraOf("Base Set") === "");
  t("sealed era from set id", sealedEra("swsh7") === "SWSH" && sealedEra("sv3pt5") === "SV" && sealedEra("base1") === "");

  const card = { id: 1, from: 10, to: 20, kind: "SIR", era: "SV", group: "A" };
  const pool = [card,
    { id: 2, from: 20, to: 20.1, kind: "SIR", era: "SV", group: "A" },
    { id: 3, from: 30, to: 30, kind: "SIR", era: "SV", group: "B" },
    { id: 4, from: 20, to: 20, kind: "IR", era: "SV", group: "A" },
    { id: 5, from: 20, to: 20, kind: "SIR", era: "SWSH", group: "C" },
    { id: 6, from: 10, to: 15, kind: "SIR", era: "SV", group: "A" }];
  const lag = laggingFor(card, pool);
  t("lagging keeps same kind and era only, same set first", lag.map((p) => p.id).join(",") === "2,3");
  t("lagging never includes a mover", !lag.some((p) => p.id === 6));
  t("lagging caps at 6", laggingFor(card, Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, from: 9, to: 9, kind: "SIR", era: "SV", group: "A" }))).length === 6);

  const up = Array.from({ length: 4 }, (_, i) => ({ id: 10 + i, name: `Up${i}`, group: "G", from: 10, to: 12, kind: "SIR", era: "SV" }));
  const flat = [{ id: 20, name: "Flat", group: "G", from: 11, to: 11, kind: "SIR", era: "SV" }];
  const climbs = groupClimbReads([...up, ...flat], { start: "2026-10-05", end: "2026-10-12" });
  t("group climb names the flat id with both dates", climbs.length === 1 && climbs[0].headline.includes("Not moved yet: Flat") && climbs[0].headline.includes("Oct 5 to Oct 12"));
  t("group climb needs 4 up", groupClimbReads([...up.slice(0, 3), ...flat], { start: "2026-10-05", end: "2026-10-12" }).length === 0);

  const lc = { skippedParents: ["sv5-etb"], products: [
    { id: "a", name: "A Box", listingsCounted: { n: 168, date: "2026-10-10", prev: { n: 212, date: "2026-10-03" } } },
    { id: "sv5-etb", name: "Shared", listingsCounted: { n: 10, date: "2026-10-10", prev: { n: 90, date: "2026-10-03" } } },
    { id: "b", name: "Small", listingsCounted: { n: 3, date: "2026-10-10", prev: { n: 9, date: "2026-10-03" } } }] };
  const lr = listingReads(lc);
  t("listing line is stated exactly", lr.length === 1 && lr[0].headline.includes("eBay listings 212 to 168 (Oct 3 to Oct 10)"));
  t("listing lines never say supply alone", !lr.some((r) => /\bsupply\b/i.test(r.headline)));

  const news = { filters: { news: { items: [
    { title: "x", titleEn: "Japan: New deck", originalTitle: "y", language: "ja", region: "jp", url: "u1", date: "2026-10-11", source: "Pokémon Card (Japan)" },
    { title: "untranslated", language: "zh", region: "cn", url: "u2", date: "2026-10-11", source: "CN" },
    { title: "EN item", url: "u3", date: "2026-10-12", source: "Siliconera" }] } } };
  const nr = newsReads(news, "2026-10-12");
  t("translated news names the country, untranslated is skipped", nr.length === 2 && nr[0].headline.startsWith("Japan:") && !nr.some((r) => r.url === "u2"));

  const rel = releaseReads({ releases: [
    { name: "JP: Thing", date: "2026-10-16", source: "s", checked: "2026-10-09", market: { id: "jp-thing", name: "Japan: Thing", price: 12.5, date: "2026-10-12" } },
    { name: "JP: Thing copy", date: "2026-10-18", source: "s", checked: "2026-10-09", market: { id: "jp-thing", name: "Japan: Thing", price: 13, date: "2026-10-12" } },
    { name: "No Price Deck", date: "2026-10-20", source: "s", checked: "2026-10-09" },
    { name: "Old", date: "2026-01-01", source: "s", checked: "x" },
  ] }, "2026-10-12");
  t("release reads are upcoming only, country named", rel.length === 1 && rel[0].headline.startsWith("Japan: Thing is out Oct 16"));
  t("a release with no price is not published", !rel.some((r) => /No price/i.test(r.headline) || r.name === "No Price Deck"));
  t("one product id is one release read", rel.length === 1 && rel[0].sku === "jp-thing" && /\$12\.50/.test(rel[0].headline));

  const price = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, headline: "p" }));
  const fresh = Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, headline: "f", board: "v3", family: i % 2 ? "news" : "fact" }));
  const board = mixBoard(price, fresh, "2026-10-12");
  const share = board.filter(isPriceRead).length / board.length;
  t("price reads are at most one third of the board", share <= PRICE_SHARE_MAX + 1e-9);
  t("mix is the same for the same day", JSON.stringify(mixBoard(price, fresh, "2026-10-12")) === JSON.stringify(board));
  const spilled = fillSlots([
    { id: "m1", readKind: "mixed" },
    { id: "n1", readKind: "newsline" },
    { id: "n2", readKind: "newsline" },
  ], [{ kind: "rip", n: 2 }, { kind: "mixed", n: 1 }]);
  t("an empty kind hands its slots to the next kind", spilled.map((r) => r.id).join(",") === "m1,n1,n2");
  const fitted = fitBoard(Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` })), Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, readKind: "newsline", board: "v3" })), { maxBoard: 30 });
  const fittedShare = fitted.price.length / (fitted.price.length + fitted.fresh.length);
  t("fit keeps the board inside the cap and the price share", fitted.price.length + fitted.fresh.length <= 30 && fittedShare <= PRICE_SHARE_MAX + 1e-9);

  const sealed = buildSealedLag({
    products: [{ id: "a", name: "A", subtype: "booster-box", setId: "swsh7" }, { id: "b", name: "B", subtype: "booster-box", setId: "swsh9" }, { id: "c", name: "C", subtype: "etb", setId: "swsh9" }, { id: "swsh7-etb", name: "Shared", subtype: "booster-box", setId: "swsh7" }],
    histories: new Map([["a", [{ date: "2026-10-05", market: 100 }, { date: "2026-10-12", market: 130 }]], ["b", [{ date: "2026-10-05", market: 200 }, { date: "2026-10-12", market: 201 }]], ["c", [{ date: "2026-10-05", market: 50 }, { date: "2026-10-12", market: 50 }]], ["swsh7-etb", [{ date: "2026-10-05", market: 99 }, { date: "2026-10-12", market: 99 }]]]),
    start: "2026-10-05", end: "2026-10-12" });
  t("sealed lag keeps product type and skips shared-art parents", sealed.risers.a && sealed.risers.a.lagging.map((x) => x.id).join(",") === "b");
  const withV = groupClimbReads([...up, ...flat], { start: "2026-10-05", end: "2026-10-12" })[0];
  t("climb wordings use the same numbers and pass the copy rules", withV.variants.length >= 2 && withV.variants.every((v) => cleanCopy(v) && v.includes("Flat") && v.includes("Oct 5")));
  t("release wordings pass the copy rules", rel[0].variants.length === 2 && rel[0].variants.every(cleanCopy) && rel[0].variants.every((v) => /\$12\.50/.test(v)));
  {
    const seen = new Set();
    const priced = { readKind: "release", sku: "mega-greninja-ex-league-battle-deck", headline: "Mega Greninja ex League Battle Deck is out Nov 13, 0 days from Nov 13. Mega Greninja ex League Battle Deck is listed at $44.00 on TCGplayer (Nov 13)." };
    const bare = { readKind: "release", sku: "mega-greninja-ex-league-battle-deck", headline: "Mega Greninja ex League Battle Deck is dated Nov 13 on the release file (checked Nov 13). No price on this line." };
    const other = { readKind: "deep", sku: "tcgcsv-1", headline: "A price read stays." };
    t("a no-price release does not publish", keepReleaseRead(bare, seen) === false && seen.size === 0);
    t("the same product id publishes once", keepReleaseRead(priced, seen) === true && keepReleaseRead(priced, seen) === false);
    t("a non-release read is left alone", keepReleaseRead(other, seen) === true);
  }
  {
    const root = await mkdtemp(join(tmpdir(), "board-day-"));
    await mkdir(join(root, "data/catalog"), { recursive: true });
    await mkdir(join(root, "research/assets/public/feed"), { recursive: true });
    await writeFile(join(root, "research/assets/public/feed/catalogue.json"), JSON.stringify({ asOf: "2026-11-13" }));
    await writeFile(join(root, "data/catalog/tcgcsv-latest.json"), JSON.stringify({ asOf: "2026-11-14" }));
    await writeFile(join(root, "data/sealed-prices.json"), JSON.stringify({ updatedAt: "2026-11-14T12:40:27.302Z" }));
    const lines = [];
    const orig = console.log;
    console.log = (...args) => { lines.push(args.join(" ")); };
    let stayed = "";
    try { stayed = await priceBoardDay(root, "2026-11-13"); }
    finally { console.log = orig; }
    t("the stamp stays on the catalogue day when sealed prices are newer", stayed === "2026-11-13" && lines.some((line) => line.includes("stays 2026-11-13") && line.includes("data/sealed-prices.json 2026-11-14")));
    const matched = await mkdtemp(join(tmpdir(), "board-day-"));
    await mkdir(join(matched, "research/assets/public/feed"), { recursive: true });
    await mkdir(join(matched, "data"), { recursive: true });
    await writeFile(join(matched, "research/assets/public/feed/catalogue.json"), JSON.stringify({ asOf: "2026-11-14" }));
    await writeFile(join(matched, "data/sealed-prices.json"), JSON.stringify({ updatedAt: "2026-11-14T12:40:27.302Z" }));
    const quiet = [];
    console.log = (...args) => { quiet.push(args.join(" ")); };
    let same = "";
    try { same = await priceBoardDay(matched, "2026-11-13"); }
    finally { console.log = orig; }
    t("matching catalogue and sealed days stamp that day and do not log", same === "2026-11-14" && quiet.length === 0);
    const older = await mkdtemp(join(tmpdir(), "board-day-"));
    t("with no price file the reads stamp is the fallback", await priceBoardDay(older, "2026-11-13") === "2026-11-13");
    const ahead = await mkdtemp(join(tmpdir(), "board-day-"));
    await mkdir(join(ahead, "data"), { recursive: true });
    await writeFile(join(ahead, "data/sealed-prices.json"), JSON.stringify({ updatedAt: "2026-11-14T12:40:27.302Z" }));
    const aheadLog = [];
    console.log = (...args) => { aheadLog.push(args.join(" ")); };
    let held = "";
    try { held = await priceBoardDay(ahead, "2026-11-13"); }
    finally { console.log = orig; }
    t("with no catalogue a newer sealed file does not move the reads stamp", held === "2026-11-13" && aheadLog.some((line) => line.includes("stays 2026-11-13")));
    const sets = rotationSetReads({ asOf: "2026-08-24", sets: [{ name: "SV03: Obsidian Flames", slug: "obsidian-flames", mark: "G", status: "Rotated april 10, 2026" }] }, "2026-11-14");
    t("a rotated set line capitalizes the month", rotationPhrase("Rotated april 10, 2026") === "rotated April 10, 2026" && sets.length === 1 && sets[0].headline.includes("rotated April 10, 2026") && !/april/.test(sets[0].headline));
    await rm(root, { recursive: true, force: true });
    await rm(matched, { recursive: true, force: true });
    await rm(older, { recursive: true, force: true });
    await rm(ahead, { recursive: true, force: true });
  }
  return fail;
}
