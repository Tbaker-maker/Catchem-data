import { buildPostOfficeCatalogue, catalogueGuard } from "../lib/post-office-catalogue.mjs";

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
  const guard = catalogueGuard(doc, { expected: sets });
  t("the fixture passes the guard", guard.ok === true && guard.share < 0.02);

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
  t("more than 2 percent unpriced fails", over.ok === false && over.problems.some((row) => row.code === "unpriced"));
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
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("post-office-catalogue.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
