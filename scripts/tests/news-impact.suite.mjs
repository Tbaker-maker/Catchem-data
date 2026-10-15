import { addDays, buildImpacts, impactFor } from "../lib/news-impact.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("day offsets stay on the calendar", addDays("2026-10-01", 1) === "2026-10-02" && addDays("2026-10-01", 30) === "2026-10-31");
  const item = { title: "A box note", url: "https://press.pokemon.com/en/a", product: "Example", date: "2026-10-01" };
  const row = impactFor(item, {
    asOf: "2026-10-10",
    prices: [{ date: "2026-10-02", price: 12.5 }, { date: "2026-10-08", price: 11 }],
    listings: [{ date: "2026-10-02", listingsCounted: 40 }, { date: "2026-10-08", listingsCounted: 28 }],
  });
  const d1 = row.windows.find((window) => window.days === 1);
  const d7 = row.windows.find((window) => window.days === 7);
  const d30 = row.windows.find((window) => window.days === 30);
  t("day 1 copies price and listings counted", d1.price === 12.5 && d1.listingsCounted === 40);
  t("day 7 copies the later point", d7.price === 11 && d7.listingsCounted === 28);
  t("day 30 is not filled before that day", d30.due === false && d30.price == null && d30.listingsCounted == null);
  const gap = impactFor(item, { asOf: "2026-10-10", prices: [{ date: "2026-10-03", price: 9 }], listings: [] });
  t("a missing day stays empty instead of using a neighbor", gap.windows[0].price == null && gap.windows[1].price == null);
  const built = buildImpacts([item], { Example: { prices: [{ date: "2026-10-02", price: 3 }], listings: [] } }, "2026-10-03");
  t("a product book is used only for that product", built.length === 1 && built[0].windows[0].price === 3 && built[0].windows[0].listingsCounted == null);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("news-impact.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
