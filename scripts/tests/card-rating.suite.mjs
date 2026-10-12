import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bare, RATING_WEIGHTS, peerValue, verdictOf, buildRatings, ratingReads, cleanCopy, shardOf, GROUPS, artistPremiums } from "../lib/card-rating.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

export async function run() {
  fail = 0;
  t("read names drop number and variant suffixes", bare("Pheromosa & Buzzwole GX (192) (Alternate Full Art)") === "Pheromosa & Buzzwole GX" && bare("Fuecoco ex - 147/128") === "Fuecoco ex" && bare("Houndoom (H11)") === "Houndoom" && bare("Umbreon VMAX (Alternate Art Secret)") === "Umbreon VMAX" && bare("Mr. Mime") === "Mr. Mime");
  t("weights add to 100", Object.values(RATING_WEIGHTS).reduce((a, b) => a + b, 0) === 100);
  t("peer value at median is 0.5", peerValue(10, 10) === 0.5);
  t("half the median scores 0.75", peerValue(5, 10) === 0.75);
  t("no median, no peer value", peerValue(5, null) === null);
  t("verdict wording", verdictOf(0.5) === "Priced below similar cards" && verdictOf(2) === "Priced above similar cards" && verdictOf(1) === "Priced in line with similar cards");
  t("banned words caught", !cleanCopy("a good time to buy") && !cleanCopy("stack these") && !cleanCopy("a \u2014 b") && cleanCopy("Priced below similar cards"));
  t("shard stable", shardOf("tcgcsv-130") === "02");
  const today = "2026-10-12";
  const mk = (i, p, extra = {}) => ({ id: `tcgcsv-${i}`, name: `Mon${i} - ${i}/100`, num: `${i}/100`, kind: "single", rarity: "Special Illustration Rare", set: "SV: Test", setSlug: "sv-test", release: "2024-01-01", artist: i % 2 ? "A" : "B", printing: "Holofoil", printings: [], hist: [["2026-07-10", p], ["2026-10-12", p]], asOf: today, ...extra });
  const rows = [mk(1, 2), ...Array.from({ length: 8 }, (_, i) => mk(i + 2, 20)), mk(20, 2000), mk(30, 0.5, { rarity: "Common" })];
  const list = buildRatings({ rows, today });
  const a = list.find((r) => r.id === "tcgcsv-1");
  t("cheap card is below peers", a.verdict === "Priced below similar cards" && a.peers.median === 20);
  t("price carries date and source", a.price.date === today && a.price.source === "TCGplayer market");
  t("10x outlier held for a check", list.find((r) => r.id === "tcgcsv-20").check === true && list.find((r) => r.id === "tcgcsv-20").verdict === null);
  t("common is not rated", !list.find((r) => r.id === "tcgcsv-30"));
  t("every factor is 0 to 1", list.every((r) => Object.values(r.factors).every((f) => f.v >= 0 && f.v <= 1)));
  const reads = ratingReads(list, { asOf: today });
  t("group read path", reads.some((r) => /^Priced below similar Special Illustration Rares: Mon1/.test(r.headline)));
  t("reads clean and say not advice", reads.every((r) => cleanCopy(r.headline) && r.lines.every(cleanCopy) && r.lines.some((l) => /not advice/.test(l))));
  t("outlier never in a read", !reads.some((r) => /Mon20/.test(r.headline)));
  t("1st Edition below unlimited is held", (() => { const w = { ...mk(40, 50, { rarity: "Holo Rare", set: "Jungle", setSlug: "jungle", release: "1999-06-16", printing: "1st Edition Holofoil", printings: [{ name: "1st Edition Holofoil", price: 50, asOf: today }, { name: "Unlimited Holofoil", price: 90, asOf: today }] }) }; return buildRatings({ rows: [w], today }).every((r) => r.check); })());
  t("groups cover the brief", ["tagteam-alt", "tagteam", "swsh-alt", "tg", "wotc-holo", "gold-star", "shining", "prism", "radiant", "gold", "ex-era-ex"].every((k) => GROUPS.some((g) => g.key === k)));
  t("artist premium needs 8 cards", artistPremiums([{ artist: "X", price: 1, setSlug: "s", rarity: "r" }]).size === 0);
  // Committed file: ids verified, reads clean.
  try {
    const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/card-rating.json"), "utf-8"));
    t("committed reads clean", (doc.reads || []).every((r) => cleanCopy(r.headline) && r.lines.every(cleanCopy)));
    t("committed weights match", JSON.stringify(doc.weights) === JSON.stringify(RATING_WEIGHTS));
  } catch { t("committed file readable", false); }
  return fail;
}
