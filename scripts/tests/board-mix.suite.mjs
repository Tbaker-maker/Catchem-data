import { BOARD_MAX, PLAIN_CAP, buildReadLibrary, mixBoard } from "../lib/read-library.mjs";

function row(id, signal, lane) {
  return { id, sku: id, signal, lane: lane || signal, readKind: lane || signal };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const price = ["tcgcsv-1", "tcgcsv-2", "tcgcsv-3"].map((id) => row(id, "mover"));
  const one = mixBoard({ price, nonPrice: [row("group-1", "group", "group")] });
  t("one qualifying non-price is boarded and not padded to 8", one.length === 4 && one.filter((item) => item.lane === "group").length === 1 && one.length < BOARD_MAX);
  const none = mixBoard({ price: price.slice(0, 2), nonPrice: [] });
  t("zero non-price reads add nothing", none.length === 2 && none.every((item) => item.signal === "mover"));
  const full = Array.from({ length: 8 }, (_, i) => row(`tcgcsv-${i + 10}`, "mover"));
  const two = mixBoard({
    price: full,
    nonPrice: [row("group-a", "group", "group"), row("group-b", "group", "group")],
  });
  t("two qualifying non-price reads stay on a full price list", two.filter((item) => item.lane === "group").length === 2 && two.length === BOARD_MAX);
  const blocked = mixBoard({
    price,
    nonPrice: [{ ...row("group-no", "group", "group"), qualified: false }, row("group-yes", "group", "group")],
  });
  t("an unqualified non-price row is not added", !blocked.some((item) => item.id === "group-no") && blocked.some((item) => item.id === "group-yes") && blocked.filter((item) => item.lane === "group").length === 1);
  t("a mover cannot fill a non-price seat", mixBoard({ price: [], nonPrice: [row("tcgcsv-9", "mover")] }).length === 0);
  t("a qualified listing trend can take a seat", mixBoard({ price: [], nonPrice: [row("list-1", "listing", "listing")] }).length === 1);
  const plains = ["p1", "p2", "p3"].map((id) => row(id, "plain"));
  const capped = mixBoard({ price: [], plains, nonPrice: [] });
  t("at most two plains", capped.length === PLAIN_CAP && capped.every((item) => item.signal === "plain"));

  const group = {
    id: "group-v",
    sku: "group-v",
    readKind: "group",
    kind: "group",
    name: "V cards",
    headline: "Five V cards are up.",
    why: "Both series have a price on the two dates.",
    asOf: "2026-10-08",
    windowDays: 7,
    fromDate: "2026-10-01",
    toDate: "2026-10-08",
  };
  const lib = buildReadLibrary({
    catalogue: {
      asOf: "2026-10-08",
      cards: {
        a: {
          id: "move-tcgcsv-1-7", sku: "tcgcsv-1", kind: "single", name: "Pikachu", set: "Base",
          headline: "Pikachu is up 20% over 7 days.", price: 12, changePct: 20, windowDays: 7, asOf: "2026-10-08",
        },
      },
    },
    extra: { lag: { reads: [] }, group: { reads: [group] } },
    series: new Map([[1, new Map([["2026-10-01", 10], ["2026-10-08", 12]])]]),
  });
  t("a proved group lag boards and a second one is not invented", lib.board.filter((item) => item.lane === "group").length === 1 && lib.board.some((item) => item.sku === "tcgcsv-1") && lib.board.length === 2);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("board-mix.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
