import { buildPostOfficeCatalogue, cardRows, catalogueGuard } from "../lib/post-office-catalogue.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => {
    if (ok) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const sets = [
    { slug: "base-set", name: "Base Set", release: "1999-01-09" },
    { slug: "jungle", name: "Jungle", release: "1999-06-16" },
    { slug: "later", name: "Later", release: "2026-12-01" },
  ];
  const groups = [
    { groupId: 604, name: "Base Set", abbreviation: "BS" },
    { groupId: 635, name: "Jungle", abbreviation: "JU" },
  ];
  const cardsBySlug = {
    "base-set": [
      { id: "tcgcsv-1", num: "1/102", kind: "single", price: 1.5 },
      ...Array.from({ length: 98 }, (_, i) => ({ id: `tcgcsv-b${i}`, num: `${i}/102`, kind: "single", price: 1 })),
      { id: "tcgcsv-2", num: "2/102", kind: "single", price: null },
      { id: "tcgcsv-box", num: "", kind: "sealed", price: 400 },
    ],
    jungle: [
      { id: "tcgcsv-3", num: "1/64", kind: "single", price: 2 },
    ],
    later: [
      { id: "tcgcsv-4", num: "1/100", kind: "single", price: null },
    ],
  };
  const doc = buildPostOfficeCatalogue({ sets, groups, cardsBySlug, asOf: "2026-10-14" });
  const base = doc.sets.find((set) => set.slug === "base-set");
  t("prices are stored on the card and a sealed row is not a card", base.prices.length === 100 && base.prices[0].price === 1.5 && base.prices[0].id === "tcgcsv-1" && base.groupId === 604);
  t("a card with no price is counted unpriced", base.unpriced === 1 && base.priced === 99 && base.cards === 100);
  t("a set dated after the catalog day is not released", doc.sets.find((set) => set.slug === "later").released === false);
  const guard = catalogueGuard(doc, { expected: sets, limits: { maxGapShare: 0.05 } });
  t("the fixture passes the guard", guard.ok === true);

  const dropped = {
    ...doc,
    sets: doc.sets.filter((set) => set.slug !== "jungle"),
  };
  const missing = catalogueGuard(dropped, { expected: sets });
  t("a released set that is absent fails", missing.ok === false && missing.problems.some((row) => row.code === "missing-set" && row.slug === "jungle"));

  const thin = buildPostOfficeCatalogue({
    sets: [{ slug: "thin", name: "Thin", release: "2020-01-01" }],
    groups: [],
    cardsBySlug: {
      thin: [
        { id: "a", kind: "single", price: 1 },
        { id: "b", kind: "single", price: null },
        { id: "c", kind: "single", price: null },
      ],
    },
    asOf: "2026-10-14",
  });
  const over = catalogueGuard(thin, { expected: thin.sets });
  t("a gap with no limits loaded fails", over.ok === false && over.problems.some((row) => row.code === "unpriced-gap"));
  const LIM = { maxGapShare: 0.5 };
  t("gaps under the private limit pass", catalogueGuard(thin, { expected: thin.sets, limits: { maxGapShare: 0.9 } }).ok === true);
  t("gaps over the private limit fail", catalogueGuard(thin, { expected: thin.sets, limits: { maxGapShare: 0.1 } }).ok === false);
  const reasoned = buildPostOfficeCatalogue({
    sets: [{ slug: "thin", name: "Thin", release: "2020-01-01" }],
    groups: [],
    cardsBySlug: { thin: [{ id: "tcgcsv-1", kind: "single", price: 1 }, { id: "tcgcsv-2", kind: "single", price: null }, { id: "tcgcsv-3", kind: "single", price: null }, { id: "tcgcsv-4", kind: "single", price: null }] },
    asOf: "2026-10-14",
    marketIds: new Set(["tcgcsv-1", "tcgcsv-2", "tcgcsv-4"]),
    heldIds: new Set(["tcgcsv-2"]),
  });
  const rs = reasoned.sets[0];
  t("a held card is held, not a gap", rs.prices.find((c) => c.id === "tcgcsv-2").why === "held");
  t("a card with no market today is no-market", rs.prices.find((c) => c.id === "tcgcsv-3").why === "no-market");
  t("a card with a market price and no hold is a gap", rs.prices.find((c) => c.id === "tcgcsv-4").why === "gap");
  t("no price is invented for any of them", rs.prices.filter((c) => c.id !== "tcgcsv-1").every((c) => c.price == null));
  const g = catalogueGuard(reasoned, { expected: reasoned.sets, limits: LIM });
  t("held and no-market cards do not fail the build", g.ok === true && g.why.held === 1 && g.why["no-market"] === 1 && g.why.gap === 1);
  t("only gaps count against the limit", catalogueGuard(reasoned, { expected: reasoned.sets, limits: { maxGapShare: 0.2 } }).ok === false);
  const allHeld = buildPostOfficeCatalogue({ sets: [{ slug: "v", name: "V", release: "1999-01-09" }], groups: [], cardsBySlug: { v: [{ id: "tcgcsv-9", kind: "single", price: null }] }, asOf: "2026-10-14", marketIds: new Set(["tcgcsv-9"]), heldIds: new Set(["tcgcsv-9"]) });
  t("a fully held vintage set passes with no limits loaded", catalogueGuard(allHeld, { expected: allHeld.sets }).ok === true);
  const sealedOnly = buildPostOfficeCatalogue({
    sets: [{ slug: "partner", name: "First Partner", release: "2026-03-30", single: 0 }],
    groups: [],
    cardsBySlug: { partner: [{ id: "box", kind: "sealed", price: 60 }] },
    asOf: "2026-10-14",
  });
  const sealedGuard = catalogueGuard(sealedOnly, { expected: [{ slug: "partner", name: "First Partner", release: "2026-03-30", single: 0 }] });
  t("a released sealed-only set is present even with no cards", sealedGuard.ok === true && sealedOnly.sets[0].cards === 0);
  const emptyCards = buildPostOfficeCatalogue({
    sets: [{ slug: "jungle", name: "Jungle", release: "1999-06-16" }],
    groups: [],
    cardsBySlug: { jungle: [] },
    asOf: "2026-10-14",
  });
  const claimed = catalogueGuard(emptyCards, { expected: [{ slug: "jungle", name: "Jungle", release: "1999-06-16", single: 64 }] });
  t("a released set that claims cards but has none fails", claimed.ok === false && claimed.problems.some((row) => row.slug === "jungle"));
  t("a future set is not required", catalogueGuard(doc, { expected: sets }).problems.every((row) => row.slug !== "later"));
  const typed = cardRows([{ id: "tcgcsv-9", num: "161/131", kind: "single", price: 10, name: "Umbreon ex - 161/131", rarity: "Special Illustration Rare" }]);
  t("a special illustration rare keeps the art type and the card name", typed[0].art === "Special Illustration Rare" && typed[0].name === "Umbreon ex - 161/131" && typed[0].price === 10);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("post-office-catalogue.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
