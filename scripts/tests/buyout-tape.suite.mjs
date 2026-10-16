import { readFile } from "node:fs/promises";
import { applyBrowseLevels, browseLevel, FLAT_BAND } from "../buyout-tape.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  t("flat band is the existing 5%", FLAT_BAND === 0.05);
  t("a null total stays unscored", browseLevel(null, 10) === "unscored" && browseLevel(10, null) === "unscored");
  t("a change inside 5% is flat", browseLevel(2391, 2377) === "flat" && browseLevel(100, 103) === "flat");
  t("a drop past 5% is down and a rise past 5% is up", browseLevel(90, 100) === "down" && browseLevel(110, 100) === "up");

  const tape = {
    rows: [
      { id: "a-etb", level: "unscored", browseTotalNow: 1, browseTotalBefore: 1, listedNow: 4, countSource: "filtered-page-listingCount" },
      { id: "b-etb", level: "unscored", listedNow: 9, listedBefore: 8, countSource: "filtered-page-listingCount" },
    ],
  };
  const sealed = {
    products: [
      {
        id: "a-etb",
        priceHistory: [
          { date: "2026-10-04", price: 10, total: 100, listingCount: 3 },
          { date: "2026-10-05", price: 10, total: 140, listingCount: 9 },
        ],
      },
      { id: "b-etb", priceHistory: [{ date: "2026-10-05", price: 10, listingCount: 9 }] },
    ],
  };
  const scored = applyBrowseLevels(tape, sealed);
  const a = scored.rows.find((row) => row.id === "a-etb");
  const b = scored.rows.find((row) => row.id === "b-etb");
  t("level comes from the Browse total change, not the filtered page count", a.level === "up" && a.browseTotalNow === 140 && a.browseTotalBefore === 100 && a.listedNow == null);
  t("a row with no Browse total stays unscored", b.level === "unscored" && b.browseTotalNow == null && b.listedNow == null);
  t("asOfDates are the nights that have a Browse total", scored.asOfDates.join() === "2026-10-04,2026-10-05");

  const src = await readFile(new URL("../buyout-tape.mjs", import.meta.url), "utf8");
  t("the script stays plain ESM for Node 20", !/\.ts["']/.test(src) && !src.includes("experimental-strip-types"));
  return fail;
}

// buyout signal (High / Medium / Low from listings counted + price change)
{
  const { buyoutSignal, applyBrowseLevels } = await import("../buyout-tape.mjs");
  const a = (await import("node:assert/strict")).default;
  a.equal(buyoutSignal(-12, 6), "High");
  a.equal(buyoutSignal(-6, 0), "Medium");
  a.equal(buyoutSignal(-6, -3), "Low");
  a.equal(buyoutSignal(3, 10), "Low");
  a.equal(buyoutSignal(null, 1), null);
  const doc = applyBrowseLevels({ rows: [{ id: "a" }, { id: "b" }] }, { products: [
    { id: "a", priceHistory: [{ date: "2026-10-14", price: 100, total: 100 }, { date: "2026-10-15", price: 106, total: 88 }] },
    { id: "b", priceHistory: [{ date: "2026-10-14", price: 100, total: 100 }, { date: "2026-10-15", price: 100, total: 101 }] },
  ] });
  a.equal(doc.rows[0].signal, "High");
  a.equal(doc.rows[1].signal, "Low");
  a.deepEqual(doc.reportRows.map((r) => r.id), ["a"]);
  a.equal(doc.signalCounts.High, 1);
  console.log("buyout signal ok");
}
