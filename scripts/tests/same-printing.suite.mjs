// Price moves stay on one printing. Fake Holofoil and Normal prices only.
import { samePrintingPoints } from "../lib/public-bundle.mjs";
import { mixedReads } from "../lib/rich-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => {
    if (ok) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const both = new Map([
    ["2026-04-01", { printing: "Holofoil", prices: new Map([["Holofoil", 40], ["Normal", 8]]) }],
    ["2026-04-08", { printing: "Normal", prices: new Map([["Normal", 9], ["Holofoil", 41]]) }],
  ]);
  const locked = samePrintingPoints([["2026-04-01", 40], ["2026-04-08", 9]], both);
  t("the move keeps the end day's printing on both days", locked.length === 2 && locked[0][1] === 8 && locked[1][1] === 9);

  const missing = new Map([
    ["2026-04-01", { printing: "Holofoil", prices: new Map([["Holofoil", 40]]) }],
    ["2026-04-08", { printing: "Normal", prices: new Map([["Normal", 9], ["Holofoil", 41]]) }],
  ]);
  const skipped = samePrintingPoints([["2026-04-01", 40], ["2026-04-08", 9]], missing);
  t("a day missing that printing is left out", skipped.length === 1 && skipped[0][0] === "2026-04-08" && skipped[0][1] === 9);

  const archive = samePrintingPoints(
    [["2024-05-01", 12], ["2026-04-08", 9]],
    new Map([["2026-04-08", { printing: "Holofoil", prices: new Map([["Holofoil", 15]]) }]]),
  );
  t("an archive day with no daily row stays", archive.some((p) => p[0] === "2024-05-01" && p[1] === 12) && archive.some((p) => p[0] === "2026-04-08" && p[1] === 15));

  const asOf = "2026-04-08";
  const none = mixedReads({ cards: [{ id: "tcgcsv-1", name: "Fake Pair", pts: skipped }], asOf });
  t("a price move is skipped when one side of that printing is missing", none.length === 0);
  const shown = mixedReads({ cards: [{ id: "tcgcsv-1", name: "Fake Pair", pts: locked }], asOf });
  t("the published move uses that printing, not the other", shown.length === 1 && shown[0].headline.includes("$8.00") && shown[0].headline.includes("$9.00") && !shown[0].headline.includes("$40"));
  return fail;
}
