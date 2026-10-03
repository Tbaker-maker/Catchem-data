import { countBottoms, leadTotal, readBottom, withActiveTotal } from "../lib/active-total.mjs";

function day(n) {
  return new Date(Date.parse("2026-01-01T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
}

function series(spec) {
  return spec.map((row, i) => ({ date: day(i), total: row[0], price: row[1] }));
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  t("a filtered page count is not a browse total by itself", leadTotal(undefined) == null);
  t("zero is a real total", leadTotal(0) === 0);
  t("a fractional field is not a count", leadTotal(3.5) == null);

  const prior = { id: "a", listingCount: 40, priceHistory: [{ date: "2026-09-27", price: 12 }] };
  const blank = withActiveTotal(prior, { date: "2026-10-03", total: 40, failed: true });
  t("a failed query does not keep the prior count", blank.blank === true && blank.product.listingCount == null && blank.product.activeTotal == null);
  t("a failed query does not add a day", blank.product.priceHistory.length === 1 && blank.product.priceHistory[0].total == null);

  const saved = withActiveTotal(prior, { date: "2026-10-03", total: 180, failed: false });
  t("a real total sits beside the price day", saved.blank === false && saved.product.listingCount === 180 && saved.product.priceHistory.at(-1).total === 180 && saved.product.priceHistory.at(-1).price == null);
  t("the prior price day is unchanged", saved.product.priceHistory[0].price === 12 && saved.product.priceHistory[0].total == null);

  const beside = withActiveTotal(
    { id: "b", listingCount: 39, priceMedian: 13.65, priceHistory: [{ date: "2026-10-03", price: 13.65 }] },
    { date: "2026-10-03", total: 509, failed: false },
  );
  t("today's total sits beside today's price", beside.product.priceHistory.at(-1).price === 13.65 && beside.product.priceHistory.at(-1).total === 509 && beside.product.priceMedian === 13.65);
  t("the filtered page count is not the lead", beside.product.listingCount === 509 && beside.product.activeTotal === 509);

  const failedToday = withActiveTotal(
    { id: "c", listingCount: 40, activeTotal: 40, priceHistory: [{ date: "2026-10-02", price: 9, total: 40 }, { date: "2026-10-03", price: 8 }] },
    { date: "2026-10-03", total: 40, failed: true },
  );
  t("a failed query leaves today blank and does not copy yesterday", failedToday.blank === true && failedToday.product.activeTotal == null && failedToday.product.priceHistory.at(-1).price === 8 && failedToday.product.priceHistory.at(-1).total == null && failedToday.product.priceHistory[0].total === 40);

  t("one day is not a bottom", readBottom([{ date: day(0), total: 10, price: 5 }]).call == null);
  t("listings still rising is not a bottom", readBottom(series([[10, 9], [12, 8]])).reason === "listings still rising");

  const earlyPrice = series([[10, 9], [8, 10], [8, 10]]);
  t("a price that turns while the span is short is not a bottom", readBottom(earlyPrice).call == null);

  const rows = [];
  rows.push([5, 20]);
  rows.push([8, 19]);
  for (let i = 0; i < 21; i += 1) rows.push([8, 19 - (i + 1) * 0.1]);
  rows.push([8, 16.9]);
  const built = series(rows.map((row) => [row[0], Math.round(row[1] * 100) / 100]));
  const called = readBottom(built);
  t("weeks of flat listings, then a price that stops falling, is a take", called.call === "base" && called.scored === false && called.laterPrice == null && called.take.total === 8);
  const later = built.concat([{ date: day(built.length), total: 8, price: 16.4 }]);
  const scored = readBottom(later);
  t("a take with a later price can be scored", scored.call === "base" && scored.scored === true && scored.laterPrice === 16.4 && scored.take.date === called.take.date);
  const july = built.map((row) => ({ ...row, date: row.date.replace("-01-", "-07-") }));
  t("the same path in another month is the same call", readBottom(july).call === "base");
  t("a release date is not a bottom", readBottom(built, { releaseDate: called.take.date }).call == null);

  const text = JSON.stringify(called);
  t("the take is not a buy or sell line", !/\b(buy|sell|stored|printed|last print)\b/i.test(text));
  t("no bottom on an empty book", countBottoms([{ id: "x", setId: "sv1", priceHistory: [{ date: "2026-10-03", total: 12, price: 4 }] }]).length === 0);
  return fail;
}
