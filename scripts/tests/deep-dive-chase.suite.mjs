// Set deep dives: the chase basket is the set's top-priced fresh singles, a
// pricier stale card flags the basket as partial, and any move compares the
// same cards with real prices on both dates.
import { chaseBasket, windowMove, setDeepDives, repairSetDive, diveCoversNamed, scrubCutoff } from "../lib/deep-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const asOf = "2026-10-16", ago = "2025-10-16";
  const mk = (i, now, old, rarity = "Holo Rare", last = asOf) => ({ id: `tcgcsv-${i}`, name: `Card ${i}`, number: `${i}`, setSlug: "x", set: "X", rarity, printing: "Holofoil", pts: [...(old != null ? [[ago, old]] : []), [last, now]] });
  // 12 pricey holos with no year-ago point, 6 cheap rares with one.
  const cards = [];
  for (let i = 0; i < 12; i += 1) cards.push(mk(i, 500 + i, null));
  for (let i = 12; i < 18; i += 1) cards.push(mk(i, 20, 10, "Rare"));
  cards.push(mk(99, 5000, null, "Common"));
  const bk = chaseBasket(cards, asOf);
  t("chase is the top-priced fresh non-common singles", bk.chase.length === 15 && bk.chase[0].id === "tcgcsv-11" && !bk.chase.some((c) => c.id === "tcgcsv-99"));
  t("cheap cards with a long history never replace pricier chase cards", bk.chase.filter((c) => c.rarity === "Rare").length === 3);
  t("yearly move is dropped when matched cards carry little of the value", windowMove(bk.chase, ago, asOf) === null);
  const all = cards.map((c) => ({ ...c, pts: [[ago, c.pts.at(-1)[1] / 2], ...c.pts.filter((p) => p[0] === asOf)] }));
  const full = windowMove(chaseBasket(all, asOf).chase, ago, asOf);
  t("yearly move compares the same cards on both dates", full && full.n === 15 && Math.round(full.ch) === 100);
  const stale = [...cards, mk(50, 9000, null, "Holo Rare", "2026-09-27")];
  const sb = chaseBasket(stale, asOf, { stale });
  t("a pricier card without a fresh price marks the basket partial", !sb.complete && sb.missing[0].id === "tcgcsv-50");
  const [row] = setDeepDives(stale, { asOf, sets: { sets: [] }, rotation: { sets: [] } });
  t("partial basket says 'we price tonight' and has no yearly %", row && /we price tonight/.test(row.headline) && !/in a year/.test(row.headline));
  t("headline total equals the listed chase prices", row && Math.abs(row.receipt.now - row.receipt.cards.reduce((a, c) => a + c.price, 0)) < 0.01 && row.receipt.cards.every((c) => c.date === asOf));
  t("no em dashes or sales wording", row && !/[\u2014\u2013]|\bsales?\b/i.test([row.headline, ...row.lines].join(" ")));
  t("a fresh dive total covers the cards it names", row && diveCoversNamed(row));
  const broken = {
    deep: "set", name: "Secret Wonders", asOf: "2026-10-16",
    headline: "Secret Wonders deep dive: its 27 tracked chase cards are worth $755.62 NM together, up 100% in a year.",
    lines: [
      "Together: $755.62 NM (Oct 16). Same 27 cards on every date, TCGplayer market.",
      "Top cards tonight: Lugia $376.20 NM, Gardevoir LV.X $267.59 NM, Mew $241.32 NM.",
      "Released Nov 7, 2007.",
    ],
    lineCards: [{ text: "Top cards tonight: Lugia", cards: [{ id: "tcgcsv-86908" }] }],
    receipt: { n: 27 }, chart: { points: [] },
  };
  const fixed = repairSetDive(broken);
  t("a short total is replaced by the named cards", fixed.changed && fixed.row.headline.includes("$885.11") && !/755\.62|NM together|in a year/.test(fixed.row.headline));
  t("the repaired total covers every named price", diveCoversNamed(fixed.row) && fixed.row.lines.some((line) => line.startsWith("Released ")));
  t("a repaired dive does not publish a one-point chart", fixed.row.chart == null);
  t("cutoff wording comes out of a public line", scrubCutoff("6 of 6 fell at least 3%, median -20%.") === "6 of 6 fell, median -20%.");
  t("a rise hit line drops the cutoff without a broken of", scrubCutoff("A hit is a later rise of at least 3% that also beats the market median.") === "A hit is a later rise that also beats the market median.");
  return fail;
}
