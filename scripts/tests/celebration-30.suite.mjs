// 30th Celebration (groups 24722 and 24837) stays separate from 2021 Celebrations.
// Numbers and printings come from the tcgcsv catalog. Era comes from the ME set, not the card name.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eraOf } from "../lib/public-bundle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CONDITION = /\b(NM|LP|MP|HP|DMG)\b|\bnear mint\b|\blightly played\b|\bmoderately played\b|\bheavily played\b|\bdamaged\b|\bplayed\b/i;

// pokemon.com product pages and the September and October 2026 release posts.
const DATED = new Map([
  [704145, "2026-09-16"], [704146, "2026-09-16"],
  [704152, "2026-09-16"], [704153, "2026-09-16"],
  [704155, "2026-09-16"], [704168, "2026-09-16"],
  [704143, "2026-09-16"], [704144, "2026-09-16"],
  [704169, "2026-12-04"], [704171, "2026-10-02"],
  [704176, "2026-10-02"], [704177, "2026-10-02"], [704178, "2026-10-02"], [704179, "2026-10-02"], [704180, "2026-10-02"],
  [704181, "2026-10-02"], [704182, "2026-10-02"], [704183, "2026-10-02"], [704184, "2026-10-02"], [704185, "2026-10-02"],
  [704187, "2026-10-30"], [704188, "2026-10-30"],
  [704189, "2026-11-06"], [704190, "2026-11-06"], [704191, "2026-11-06"],
  [704193, "2026-11-06"], [704194, "2026-11-06"],
]);

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const catalogue = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf8"));
  const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const sealed = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
  const logos = JSON.parse(await readFile(join(ROOT, "data/set-logos.json"), "utf8")).sets;
  const cards = catalogue.cards || {};

  const byPid = new Map();
  for (const [id, card] of Object.entries(cards)) {
    if (card.tcgPlayerId) byPid.set(String(card.tcgPlayerId), id);
  }
  const singles = catalog.items.filter((item) => (item.groupId === 24722 || item.groupId === 24837) && item.kind === "single");
  t("both 30th groups are in the tcgcsv catalog as 191 singles", singles.length === 191);
  let exact = 0;
  for (const item of singles) {
    const id = byPid.get(String(item.tcgplayerProductId));
    const card = id && cards[id];
    const wantSet = item.groupId === 24722 ? "me55" : "me55c";
    const prints = (item.printings || []).map((p) => p.name);
    if (!card || card.setId !== wantSet || !card.setName || card.number !== item.number || card.printing !== item.printing || prints.length !== 1 || card.printing !== "Holofoil") continue;
    if (card.era !== "ME" || card.eraName !== "Mega Evolution") continue;
    if (card.price != null) continue;
    exact += 1;
  }
  t("every 30th single has its set, exact card number, Holofoil printing, and ME era", exact === 191);

  const charizard = Object.values(cards).find((card) => card.setId === "me55c" && card.name === "Charizard");
  t("a classic Charizard takes the set era, not an older era from its name", charizard && charizard.era === "ME" && charizard.eraName === "Mega Evolution" && charizard.number === "4/102");
  t("the set records carry ME, Mega Evolution", catalogue.sets.me55.era === "ME" && catalogue.sets.me55.eraName === "Mega Evolution" && catalogue.sets.me55c.era === "ME" && catalogue.sets.me55c.eraName === "Mega Evolution" && !catalogue.sets.cel25.era);
  t("eraOf reads the set, and 2021 Celebrations stays Sword & Shield", eraOf("ME: 30th Celebration") === "Mega Evolution" && eraOf("ME: 30th Celebration Classic Collection") === "Mega Evolution" && eraOf("30th Celebration") === "Mega Evolution" && eraOf("30th Celebration: Classic Collection") === "Mega Evolution" && eraOf("Celebrations") === "Sword & Shield" && eraOf("Celebrations: Classic Collection") === "Sword & Shield" && eraOf("Charizard") === "Other");

  const meIds = Object.keys(cards).filter((id) => id.startsWith("me55"));
  const celIds = new Set(Object.keys(cards).filter((id) => id.startsWith("cel25")));
  const mePids = new Set(meIds.map((id) => String(cards[id].tcgPlayerId || "")));
  const celPids = new Set([...celIds].map((id) => String(cards[id].tcgPlayerId || "")));
  t("no 30th id collides with a 2021 Celebrations id", meIds.length === 191 && celIds.size === 50 && meIds.every((id) => !celIds.has(id)) && [...mePids].every((pid) => pid && !celPids.has(pid)));
  t("30th logos are not the 2021 Celebrations logos", logos.me55.series === "Mega Evolution" && logos.me55c.series === "Mega Evolution" && logos.cel25.series === "Sword & Shield" && logos.cel25c.series === "Sword & Shield" && logos.me55.logo !== logos.cel25.logo && logos.me55c.logo !== logos.cel25c.logo && logos.me55.logo !== logos.me55c.logo);

  const rows = sealed.filter((row) => row.groupId === 24722);
  t("the 52 sealed 30th rows are still there", rows.length === 52 && new Set(rows.map((row) => row.id)).size === 52);
  const dated = rows.filter((row) => DATED.has(Number(row.tcgPlayerId)));
  t("each official sealed product is present once with its launch date", dated.length === DATED.size && dated.every((row) => row.launchDate === DATED.get(Number(row.tcgPlayerId)) && row.officialName && row.launchSource.startsWith("https://www.pokemon.com/") && !/[\u2013\u2014]/.test(row.officialName)));
  const undated = rows.filter((row) => !DATED.has(Number(row.tcgPlayerId)));
  t("a row with no pokemon.com product keeps its TCGplayer source and gains no date", undated.length === 52 - DATED.size && undated.every((row) => !row.launchDate && !row.officialName && String(row.source || "").includes("tcgcsv.com") && row.tcgPlayerId));
  const labeled = rows.filter((row) => CONDITION.test([row.name, row.officialName, row.subtype, row.condition, row.grade].join(" ")));
  t("no sealed 30th row carries a condition label", labeled.length === 0);
  const oldSealed = new Set(sealed.filter((row) => row.groupId === 2867 || row.groupId === 2931).map((row) => row.id));
  t("2021 Celebrations sealed ids stay separate", oldSealed.size > 0 && rows.every((row) => !oldSealed.has(row.id)));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("celebration-30.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
