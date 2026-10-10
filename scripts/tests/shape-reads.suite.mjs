import { cardFacts, quietFact } from "../lib/shape-facts.mjs";
import {
  ASK_CLAUSE,
  MIX_CLAUSE,
  MOVE_CLAUSE,
  MKT_CLAUSE,
  PAIR_CLAUSE,
  SHARE_CLAUSE,
  SPREAD_CLAUSE,
  STILL_CLAUSE,
  gapRead,
  pickNight,
  quietRead,
  spreadRead,
  stillRead,
} from "../lib/night-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const days = [];
  for (let i = 0; i < 200; i += 1) {
    const date = new Date(Date.parse("2026-04-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    days.push(date);
  }
  const nm = days.map((date) => ({ date, market: 2.5, volume: null }));
  t("a full quiet window names the days and the price", quietFact(nm, "2026-10-06")?.days === 30 && quietFact(nm, "2026-10-06")?.price === 2.5);
  const gapped = nm.filter((point) => point.date !== "2026-10-01");
  t("a gap is not called a quiet window", quietFact(gapped, "2026-10-06") == null);

  const sold = days.map((date, i) => ({ date, market: i > 180 ? 2 : 4, volume: i > 180 ? 1 : null }));
  const item = { id: "tcgcsv-1", tcgplayerProductId: 1, kind: "single", name: "Pikachu", number: "1", set: "Base", printing: "Normal", groupId: 9 };
  const card = {
    tcgPlayerId: "1",
    cardNumber: "1",
    ebay: { salesByGrade: { psa10: { count: 4 } } },
    priceHistory: { variants: { Normal: {
      "Near Mint": { history: sold },
      "Lightly Played": { history: days.map((date) => ({ date, market: 1.5, volume: date >= "2026-09-28" ? 2 : null })) },
    } } },
  };
  const fact = cardFacts(card, item, "2026-10-06");
  t("a grade block in the raw is not a read", fact && !fact.grade);
  const cheap = quietRead({ quiet: { days: 7, price: 2.5, from: "2026-09-28", to: "2026-10-04" }, printing: "Normal" }, item, "2026-10-06");
  t("a quiet read under $5 does not ship", cheap == null);
  const quiet = quietRead({ quiet: { days: 7, price: 12.5, from: "2026-09-28", to: "2026-10-04" }, printing: "Normal" }, item, "2026-10-06");
  t("the quiet line keeps its clause on the why line", quiet && quiet.path.includes("No TCGplayer sales recorded in 7 days.") && quiet.path.includes("$12.50") && quiet.why.includes("That is not a scarcity claim.") && !quiet.path.includes("That is not a scarcity claim."));
  t("mix, pair, and move clauses stay word for word", [MIX_CLAUSE, PAIR_CLAUSE, MOVE_CLAUSE, SHARE_CLAUSE, SPREAD_CLAUSE, ASK_CLAUSE, MKT_CLAUSE, STILL_CLAUSE].every((line) => line.length > 10));

  const spread = spreadRead({ id: "me5-etb", name: "Pitch Black ETB", set: "ME", dataStatus: "live", priceLow: 70, priceHigh: 90, lastSeen: "2026-10-06" });
  t("an asking spread uses both ends", spread.path.includes("$70.00") && spread.path.includes("$90.00") && spread.why.includes(SPREAD_CLAUSE) && !spread.path.includes(SPREAD_CLAUSE));
  t("a missing high is not a spread", spreadRead({ id: "me5-etb", name: "Pitch Black ETB", dataStatus: "live", priceLow: 70, lastSeen: "2026-10-06" }) == null);

  const heat = [
    { id: "me5-etb", date: "2026-10-05", price: 80, listingCount: 12 },
    { id: "me5-etb", date: "2026-10-06", price: 80, listingCount: 12 },
  ];
  const still = stillRead("me5-etb", heat, "Pitch Black ETB", "ME");
  t("an unchanged ask keeps the listing count on the why line", still && still.path.includes("12") && still.why.includes(STILL_CLAUSE) && !still.path.includes(STILL_CLAUSE));
  t("a missing listing count stays off", stillRead("me5-etb", heat.map((row) => ({ ...row, listingCount: null })), "Pitch Black ETB", "ME") == null);

  const market = { id: "me5-etb", name: "Pitch Black ETB", tcgplayerProductId: 5, points: [{ date: "2026-10-05", market: 40 }, { date: "2026-10-06", market: 40 }] };
  const moved = heat.map((row, i) => ({ ...row, price: i ? 88 : 80 }));
  const ask = gapRead("me5-etb", moved, market, { id: "me5-etb", tcgplayerProductId: 5 });
  t("the ask clause is used only when the market price stayed", ask.readKind === "askmove" && ask.why.includes(ASK_CLAUSE) && !ask.path.includes(ASK_CLAUSE) && ask.path.includes("$40.00"));
  const reverse = gapRead("me5-etb", heat, { ...market, points: [{ date: "2026-10-05", market: 40 }, { date: "2026-10-06", market: 44 }] }, { id: "me5-etb", tcgplayerProductId: 5 });
  t("the reverse names the market move and the still ask", reverse.readKind === "mktmove" && reverse.why.includes(MKT_CLAUSE) && !reverse.path.includes(MKT_CLAUSE));
  t("a different product id is not a pair", gapRead("me5-etb", moved, market, { id: "other", tcgplayerProductId: 5 }) == null);

  const clean = [];
  for (let n = 0; n < 6; n += 1) {
    clean.push({ id: `quiet-c${n}`, sku: `c${n}`, readKind: "quiet", kind: "quiet", path: "One quiet line.", name: `c${n}`, lane: "single" });
    clean.push({ id: `setshare-s${n}`, sku: `s${n}`, readKind: "setshare", kind: "setshare", path: "One share line.", name: `s${n}`, lane: "single", rank: 6 - n });
    clean.push({ id: `spread-e${n}`, sku: `e${n}`, readKind: "spread", kind: "spread", path: "One ask line.", name: `e${n}`, lane: "sealed", rank: n });
    clean.push({ id: `fact-f${n}`, sku: `f${n}`, readKind: "mix", kind: "mix", path: "One mix line.", name: `f${n}`, lane: "single" });
  }
  const night1 = pickNight(clean, { shown: [] }, "2026-10-01");
  const night2 = pickNight(clean, night1.state, "2026-10-02");
  const ids = (night) => night.reads.map((row) => row.sku).sort().join();
  const overlap = night2.reads.some((row) => night1.reads.some((prev) => prev.sku === row.sku));
  t("two nights do not ship the same feed", ids(night1) !== ids(night2) && night1.reads.length > 0 && night2.reads.length > 0);
  t("a card does not repeat inside the cooldown", !overlap);
  const shares = night1.byKind.setshare.items.map((row) => row.rank);
  t("a ranked filter keeps its order", shares.every((rank, i) => i === 0 || rank <= shares[i - 1]));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("shape-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
