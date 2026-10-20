// Feed lead rank and the cheap-move floor. Fixture cutoffs only.
import { readFileSync } from "node:fs";
import { interestScore, leadIds, lowValueMove, readMove } from "../lib/feed-rank.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const cent = {
    id: "solddown-cheap",
    readKind: "solddown",
    kind: "solddown",
    name: "Cheap ex",
    price: 0.9,
    receipt: { fromPrice: 0.91, toPrice: 0.9 },
    headline: "Cheap ex went from $0.91 to $0.90.",
  };
  const box = {
    id: "sealed-box",
    readKind: "sealed",
    kind: "sealed",
    name: "Mini Tin Display",
    price: 1800,
    changePct: -17,
    receipt: { from: 2200, to: 1800 },
    headline: "Mini Tin Display: $2,200 to $1,800. Down 17%.",
    href: "/p/mini-tin",
    signals: [{ kind: "move", strength: 5 }],
  };
  const mid = {
    id: "single-mid",
    readKind: "single",
    kind: "single",
    name: "Mid",
    price: 12,
    changePct: 40,
    receipt: { from: 8, to: 12 },
    headline: "Mid: $8 to $12. Up 40%.",
  };
  t("a cent move scores under a sealed dollar move", interestScore(cent) > 0 && interestScore(cent) < interestScore(mid) && interestScore(mid) < interestScore(box));
  t("the dollar move is the receipt pair, not a long window chip", readMove(cent).dollars < 0.05 && readMove(box).dollars === 400);
  const floor = { maxCheapPrice: 10, maxCheapMove: 1 };
  t("the fixture floor drops the cent move and keeps the mid move", lowValueMove(cent, floor) === true && lowValueMove(mid, floor) === false && lowValueMove(box, floor) === false);
  t("no floor means no drop", lowValueMove(cent, null) === false);
  const ids = leadIds([cent, mid, box, { id: "news-1", readKind: "news", headline: "A note." }], floor, 8);
  t("the lead ids skip the cheap move and open on the sealed read", ids[0] === "sealed-box" && ids[1] === "single-mid" && !ids.includes("solddown-cheap") && !ids.includes("news-1"));
  const src = readFileSync(new URL("../lib/feed-rank.mjs", import.meta.url), "utf8") + readFileSync(new URL("../lib/feed-floor.mjs", import.meta.url), "utf8");
  t("public rank files do not bake a cutoff", !/maxCheapPrice\s*[:=]\s*\d/.test(src) && !/maxCheapMove\s*[:=]\s*\d/.test(src));
  return fail;
}
