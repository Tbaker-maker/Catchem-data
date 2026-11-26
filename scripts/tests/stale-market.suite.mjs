// A frozen TCGplayer market while lows move is stale. Fake N only.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cardStories } from "../lib/deep-reads.mjs";
import { lastMarketChange, loadStaleMarket, staleMarket, validStaleMarket } from "../lib/stale-market.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name); } };

  const cfg = { unchangedDays: 14 };
  const markets = [
    ["2026-09-26", 752.74],
    ["2026-10-09", 817.16],
    ["2026-10-20", 817.16],
    ["2026-11-01", 817.16],
    ["2026-11-17", 817.16],
    ["2026-11-25", 817.16],
  ];
  const lows = [
    ["2026-10-31", 849.50],
    ["2026-11-08", 849.49],
    ["2026-11-11", 825],
    ["2026-11-17", 700.09],
    ["2026-11-25", 825],
  ];
  const hit = staleMarket(markets, lows, "2026-11-25", cfg);
  t("a frozen market with moving lows is stale", hit.stale === true && hit.lastChange === "2026-10-09" && hit.price === 817.16);
  t("lastMarketChange is the first day of the current level", lastMarketChange(markets, "2026-11-25")?.date === "2026-10-09");
  t("the same market with no low movement is not stale", staleMarket(markets, [["2026-11-25", 825]], "2026-11-25", cfg).stale === false);
  t("a recent market change is not stale", staleMarket([["2026-11-20", 800], ["2026-11-25", 817.16]], lows, "2026-11-25", cfg).stale === false);
  t("no rule leaves the price alone", staleMarket(markets, lows, "2026-11-25", null).stale === false);
  t("validStaleMarket rejects a missing N", validStaleMarket({}) == null && validStaleMarket({ unchangedDays: 14 }).unchangedDays === 14);
  t("a missing low series is not called stale", staleMarket(markets, [], "2026-11-25", cfg).stale === false);

  const pts = [["2024-02-01", 200], ["2025-05-12", 300], ["2026-01-15", 400], ["2026-10-09", 817.16], ["2026-11-25", 817.16]];
  const card = { id: "tcgcsv-9", name: "Umbreon", set: "Neo Discovery", number: "13/75", rarity: "Rare Holo", printing: "Unlimited Holofoil", pts };
  const kept = cardStories([card], { asOf: "2026-11-25" });
  t("a story with no stale rule is kept", kept.length === 1 && /tonight/.test(kept[0].headline) && /Tonight/.test(kept[0].lines.join(" ")));
  const held = cardStories([card], { asOf: "2026-11-25", staleMarketRule: cfg, lowsOf: () => lows });
  t("a stale market story is held and does not say tonight", held.length === 0);
  const freshPts = [["2024-02-01", 200], ["2025-05-12", 300], ["2026-01-15", 400], ["2026-11-18", 700], ["2026-11-25", 817.16]];
  const moving = cardStories([{ ...card, pts: freshPts }], { asOf: "2026-11-25", staleMarketRule: cfg, lowsOf: () => lows });
  t("a market that moved recently still publishes tonight", moving.length === 1 && /tonight/.test(moving[0].headline));
  t("a missing private rule changes nothing", (await loadStaleMarket(join(ROOT, "scripts/tests"))) == null);
  const board = readFileSync(join(ROOT, "scripts/lib/board-mix.mjs"), "utf8");
  t("board-mix holds stale market stories", board.includes("loadStaleMarket") && board.includes("staleMarketRule") && board.includes("lowsOf"));
  const lib = readFileSync(join(ROOT, "scripts/lib/stale-market.mjs"), "utf8");
  t("the stale market helper does not call a network API", !/\bfetch\s*\(/.test(lib) && !/api\.github\.com/.test(lib));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("stale-market.suite.mjs")) {
  const n = await run();
  console.log(n ? `${n} failed` : "all ok");
  process.exit(n ? 1 : 0);
}
