import { cleanCopy, eraOf, laggingFor, groupClimbReads, listingReads, newsReads, releaseReads, mixBoard, isPriceRead, buildSealedLag, sealedEra } from "../lib/board-mix.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("banned words are caught", !cleanCopy("time to buy") && !cleanCopy("a play here") && !cleanCopy("price target") && !cleanCopy("well printed"));
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

  const rel = releaseReads({ releases: [{ name: "JP: Thing", date: "2026-10-16", source: "s", checked: "2026-10-09" }, { name: "Old", date: "2026-01-01", source: "s", checked: "x" }] }, "2026-10-12");
  t("release reads are upcoming only, country named", rel.length === 1 && rel[0].headline.startsWith("Japan: Thing is out Oct 16"));

  const price = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, headline: "p" }));
  const fresh = Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, headline: "f", board: "v3", family: i % 2 ? "news" : "fact" }));
  const board = mixBoard(price, fresh, "2026-10-12");
  const share = board.filter(isPriceRead).length / board.length;
  t("price reads are at most 40% of the board", share <= 0.4 + 1e-9);
  t("mix is the same for the same day", JSON.stringify(mixBoard(price, fresh, "2026-10-12")) === JSON.stringify(board));

  const sealed = buildSealedLag({
    products: [{ id: "a", name: "A", subtype: "booster-box", setId: "swsh7" }, { id: "b", name: "B", subtype: "booster-box", setId: "swsh9" }, { id: "c", name: "C", subtype: "etb", setId: "swsh9" }, { id: "swsh7-etb", name: "Shared", subtype: "booster-box", setId: "swsh7" }],
    histories: new Map([["a", [{ date: "2026-10-05", market: 100 }, { date: "2026-10-12", market: 130 }]], ["b", [{ date: "2026-10-05", market: 200 }, { date: "2026-10-12", market: 201 }]], ["c", [{ date: "2026-10-05", market: 50 }, { date: "2026-10-12", market: 50 }]], ["swsh7-etb", [{ date: "2026-10-05", market: 99 }, { date: "2026-10-12", market: 99 }]]]),
    start: "2026-10-05", end: "2026-10-12" });
  t("sealed lag keeps product type and skips shared-art parents", sealed.risers.a && sealed.risers.a.lagging.map((x) => x.id).join(",") === "b");
  return fail;
}
