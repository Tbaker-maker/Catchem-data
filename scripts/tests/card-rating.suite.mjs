import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { peerPools, bare, RATING_WEIGHTS, peerValue, verdictOf, buildRatings, ratingReads, cleanCopy, shardOf, GROUPS, artistPremiums } from "../lib/card-rating.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

export async function run() {
  fail = 0;
  t("read names drop number and variant suffixes", bare("Pheromosa & Buzzwole GX (192) (Alternate Full Art)") === "Pheromosa & Buzzwole GX" && bare("Fuecoco ex - 147/128") === "Fuecoco ex" && bare("Houndoom (H11)") === "Houndoom" && bare("Umbreon VMAX (Alternate Art Secret)") === "Umbreon VMAX" && bare("Mr. Mime") === "Mr. Mime");
  {
    const today0 = "2026-10-12";
    const mk0 = (i, p, extra = {}) => ({ id: `tcgcsv-${900 + i}`, name: `Mon${i}`, num: `${i}/9`, kind: "single", rarity: "Illustration Rare", set: "SV: T", setSlug: "sv-t", release: "2024-01-01", printing: "Holofoil", printings: [], hist: [["2026-07-10", p / 2], ["2026-10-12", p]], asOf: today0, ...extra });
    // Pikachu headliner alone in its band against 6 low-band cards: no verdict.
    const l0 = buildRatings({ rows: [mk0(1, 50, { name: "Pikachu" }), ...Array.from({ length: 6 }, (_, i) => mk0(i + 2, 10))], today: today0 });
    const pk = l0.find((r) => r.name === "Pikachu");
    t("unmatched popularity gives no verdict", pk.verdict === null && pk.verdictNote === "Not enough similar cards for a fair comparison" && !pk.factors.peer);
    t("near its own high is flagged", pk.nearHigh && pk.nearHigh.price === 50 && pk.nearHigh.date === today0);
    t("matched band still gets a verdict", l0.filter((r) => r.name !== "Pikachu").every((r) => r.verdict === "Priced in line with similar cards" && r.peers.matched));
    t("pool lists every comparison card with price and date", (() => { const p = (peerPools(l0)["ir-low"] || []); return p.length === 6 && p.every((x) => x[0] && x[4] > 0 && /^\d{4}-/.test(x[5])); })());
  }
  t("weights add to 100", Object.values(RATING_WEIGHTS).reduce((a, b) => a + b, 0) === 100);
  t("peer value at median is 0.5", peerValue(10, 10) === 0.5);
  t("half the median scores 0.75", peerValue(5, 10) === 0.75);
  t("no median, no peer value", peerValue(5, null) === null);
  t("verdict wording", verdictOf(0.5) === "Priced below similar cards" && verdictOf(2) === "Priced above similar cards" && verdictOf(1) === "Priced in line with similar cards");
  t("banned words caught", !cleanCopy("a good time to buy") && !cleanCopy("stack these") && !cleanCopy("a \u2014 b") && cleanCopy("Priced below similar cards"));
  t("shard stable", shardOf("tcgcsv-130") === "02");
  const today = "2026-10-12";
  const mk = (i, p, extra = {}) => ({ id: `tcgcsv-${i}`, name: `Mon${i} - ${i}/100`, num: `${i}/100`, kind: "single", rarity: "Special Illustration Rare", set: "SV: Test", setSlug: "sv-test", release: "2024-01-01", artist: i % 2 ? "A" : "B", printing: "Holofoil", printings: [], hist: [["2026-07-10", p], ["2026-10-12", p]], asOf: today, ...extra });
  const rows = [mk(1, 2, { name: "Mon1 - 1/100" }), ...Array.from({ length: 8 }, (_, i) => mk(i + 2, 20)), mk(20, 2000), mk(30, 0.5, { rarity: "Common" })];
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
  t("SM tag team alt art gets its own tag", (await import("../lib/variant-tags.mjs")).variantTags({ name: "Latias & Latios GX (Alternate Full Art)", rarity: "Secret Rare", number: "170/181" }, { subtypes: ["TAG TEAM"] }).join() === "Tag Team (Alternate Art)");
  // Label audit: every rated row's group must match the card's own variant tag, rarity or era.
  try {
    const PUBD = join(ROOT, "research/assets/public");
    const tags = JSON.parse(await readFile(join(PUBD, "feed/card-variants.json"), "utf-8")).cards || {};
    const { readdir } = await import("node:fs/promises");
    const own = new Map();
    for (const f of (await readdir(join(PUBD, "buckets"))).filter((f) => f.endsWith(".json"))) for (const r of JSON.parse(await readFile(join(PUBD, "buckets", f), "utf-8"))) own.set(r.id, r);
    const rows = [];
    for (const f of (await readdir(join(PUBD, "feed/rating"))).filter((f) => f.endsWith(".json"))) rows.push(...JSON.parse(await readFile(join(PUBD, "feed/rating", f), "utf-8")).rows);
    const bad = [];
    for (const r of rows) {
      const g = GROUPS.find((x) => x.key === r.group);
      const tg = tags[r.id]?.tags || [];
      const card = own.get(r.id) || {};
      if (!g) continue;
      if (g.tag && !tg.includes(g.tag)) bad.push(`${r.id} in ${g.key} lacks tag ${g.tag}`);
      if (g.rarity && card.rarity !== g.rarity) bad.push(`${r.id} in ${g.key} is ${card.rarity}`);
      if (tg.some((x) => /Tag Team/.test(x)) && !/^tagteam/.test(g.key)) bad.push(`${r.id} is a Tag Team labeled ${g.key}`);
      if (g.key === "swsh-alt" && !(card.release >= "2020-02" && card.release < "2023-03")) bad.push(`${r.id} alt art outside Sword & Shield`);
      if (/\b(IR|SIR|alt arts?)\b/.test(r.groupLabel + " " + r.groupOne)) bad.push(`${r.id} public label ${r.groupLabel}`);
    }
    t(`rating labels match each card's own tag or era (${bad.slice(0, 3).join("; ")})`, rows.length > 0 && bad.length === 0);
    const ir = JSON.parse(await readFile(join(PUBD, "feed/ir-cycle.json"), "utf-8")).rows || [];
    const irBad = ir.filter((r) => ((tags[r.id]?.tags || []).some((x) => /Tag Team/.test(x)) && r.kind !== "TTALT") || (r.kind === "TTALT" && !(tags[r.id]?.tags || []).includes("Tag Team (Alternate Art)")) || r.setListings);
    t(`watchlist rows: Tag Teams never labeled IR, SIR or Alternate Art, no sealed data (${irBad.slice(0, 3).map((r) => r.id).join()})`, irBad.length === 0);
  } catch (e) { t("label audit ran: " + e.message, false); }
  // Committed file: ids verified, reads clean.
  try {
    const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/card-rating.json"), "utf-8"));
    t("committed reads clean", (doc.reads || []).every((r) => cleanCopy(r.headline) && r.lines.every(cleanCopy)));
    t("no supply factor", !("supply" in RATING_WEIGHTS));
    t("committed weights match", JSON.stringify(doc.weights) === JSON.stringify(RATING_WEIGHTS));
  } catch { t("committed file readable", false); }
  return fail;
}
