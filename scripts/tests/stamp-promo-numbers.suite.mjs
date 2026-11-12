// Reads check Nov 11 (2): a card line's thumbnail and link must be the card
// whose price the line quotes. Real lines from the Nov 11 build.
import { stampRead } from "../lib/card-face-stamp.mjs";
import { barLabel } from "../lib/card-face.mjs";

function card(id, name, number, set, rarity = "") {
  const setShort = set.replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
  const clean = name.replace(/\s+-\s+[A-Z]*\d+[a-z]?(?:\/[A-Z]*\d+)?\s*$/i, "").trim();
  const base = clean.replace(/\s*\(\d+[A-Za-z]?(?:\s[^)]*)?\)\s*$/, "").trim();
  return { id: `tcgcsv-${id}`, name, clean, ...(base !== clean ? { base } : {}), number, set, setShort, rarity, artist: "" };
}

function index(cards) {
  const byId = new Map(), bySet = new Map(), bySpecies = new Map(), byArtist = new Map();
  const push = (m, k, c) => { k = k.toLowerCase(); if (!m.has(k)) m.set(k, []); m.get(k).push(c); };
  for (const c of cards) {
    byId.set(c.id, c);
    push(bySet, c.set, c);
    push(bySet, c.setShort, c);
    push(bySpecies, c.clean.split(" ")[0], c);
  }
  return { cards, byId, bySet, bySpecies, byArtist };
}
const images = { images: {}, tcgOn: false, sealedPid: new Map() };
const ids = (row) => (row?.cards || []).map((c) => c.id);

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const col = [
    card(86126, "Ho-Oh", "9/95", "Call of Legends", "Holo Rare"),
    card(86127, "Ho-Oh (Shiny)", "SL5", "Call of Legends", "Shiny Holo Rare"),
    card(85925, "Groudon", "6/95", "Call of Legends", "Holo Rare"),
    card(85926, "Groudon (Shiny)", "SL4", "Call of Legends", "Shiny Holo Rare"),
  ];
  const chase = stampRead({ id: "deep-chase-call-of-legends", deep: "chase", readKind: "deep", name: "Call of Legends", headline: "Call of Legends chase list.", lines: [
    "Ho-Oh (Call of Legends) SL5, Shiny Holo Rare: $833.32.",
    "Groudon (Call of Legends) 6/95, Holo Rare: $54.67.",
  ] }, index(col), images);
  t("a Shiny Legend line links the SL card, not the plain holo", ids(chase.lineCards?.[0]).join() === "tcgcsv-86127");
  t("no set number is written in front of an SL number", chase.lines[0] === "Ho-Oh (Call of Legends) SL5, Shiny Holo Rare: $833.32.");
  t("the plain holo line still links the plain holo", ids(chase.lineCards?.[1]).join() === "tcgcsv-85925");

  const promos = [
    card(475621, "Rillaboom - SWSH277", "SWSH277", "SWSH: Sword & Shield Promo Cards", "Promo"),
    card(208260, "Rillaboom - SWSH006 (Prerelease) [Staff]", "SWSH006", "SWSH: Sword & Shield Promo Cards", "Promo"),
    card(208261, "Rillaboom - SWSH006 (Prerelease)", "SWSH006", "SWSH: Sword & Shield Promo Cards", "Promo"),
  ];
  const big = stampRead({ id: "deep-bigyear-swsh", deep: "bigyear", readKind: "deep", name: "Sword & Shield", headline: "Big year.", lines: [
    "2. Rillaboom - SWSH006 [Staff] (Sword & Shield Promo Cards): $50.07 to $171.13, up 242%.",
  ] }, index(promos), images);
  t("a staff promo line keeps its own code", big.lines[0].startsWith("2. Rillaboom - SWSH006 [Staff]") && !big.lines[0].includes("SWSH277"));
  t("a staff promo line links the staff stamp", ids(big.lineCards?.[0]).join() === "tcgcsv-208260");

  const pika = [
    card(88096, "Pikachu", "7", "Rumble", "Promo"),
    card(183804, "Pikachu & Zekrom GX", "33/181", "SM - Team Up", "Ultra Rare"),
    card(183806, "Pikachu & Zekrom GX (Secret)", "184/181", "SM - Team Up", "Secret Rare"),
  ];
  const pr = stampRead({ id: "deep-printings-pikachu", deep: "printings", readKind: "deep", name: "Pikachu", headline: "Every Pikachu card we price: 86 cards, from $2.15 to $947.45 tonight.", lines: [
    "Pikachu & Zekrom GX (Team Up) 184/181, Secret Rare: $248.72, up 27% in a year.",
  ] }, index(pika), images);
  t("a tag-team line links its secret printing, not a Pikachu named inside it", ids(pr.lineCards?.[0]).join() === "tcgcsv-183806");
  t("a one-digit number is not found inside a price", !ids(pr.lineCards?.[0]).includes("tcgcsv-88096"));
  t("the group subject gets no card number", pr.headline === "Every Pikachu card we price: 86 cards, from $2.15 to $947.45 tonight.");

  const holon = [card(88634, "Rayquaza - 016/110 (Delta Species)", "16/110", "EX Holon Phantoms", "Holo Rare")];
  const hp = stampRead({ id: "deep-chase-ex-holon-phantoms", deep: "chase", readKind: "deep", name: "EX Holon Phantoms", headline: "Chase list.", lines: [
    "Rayquaza - 016/110 (Delta Species) (EX Holon Phantoms), Holo Rare: $631.22.",
  ] }, index(holon), images);
  t("a zero-padded number in the name counts as written", hp.lines[0] === "Rayquaza - 016/110 (Delta Species) (EX Holon Phantoms), Holo Rare: $631.22.");

  const primal = [
    card(95951, "Primal Kyogre", "53/160", "XY - Primal Clash"),
    card(96046, "Kyogre EX (148 Full Art)", "148/160", "XY - Primal Clash"),
    card(95952, "Kyogre EX", "54/160", "XY - Primal Clash"),
    card(96047, "Primal Kyogre EX (Alpha - 149 Full Art)", "149/160", "XY - Primal Clash"),
  ];
  const pc = stampRead({ id: "deep-set-xy-primal-clash", deep: "set", readKind: "deep", name: "Primal Clash", headline: "Top cards.", lines: [
    "Top cards tonight: Primal Kyogre EX (Primal Clash) 149/160 $363.35, Kyogre EX (Primal Clash) 148/160 $184.45.",
  ] }, index(primal), images);
  t("a different card's number is never put inside a name", !pc.lines[0].includes("Primal Kyogre 53/160"));
  t("cards on a line follow the order they are named", ids(pc.lineCards?.[0]).join() === "tcgcsv-96047,tcgcsv-96046");

  const dx = [
    card(84757, "Deoxys", "2/95", "Call of Legends", "Holo Rare"),
    card(88643, "Rayquaza ex", "102/107", "EX Deoxys", "Ultra Rare"),
  ];
  const ray = stampRead({ id: "deep-printings-rayquaza", deep: "printings", readKind: "deep", name: "Rayquaza", headline: "Every Rayquaza card.", lines: [
    "Rayquaza ex (EX Deoxys) 102/107, Ultra Rare: $999.00.",
  ] }, index(dx), images);
  t("a card name inside a set tag is not a card", ray.lines[0] === "Rayquaza ex (EX Deoxys) 102/107, Ultra Rare: $999.00." && ids(ray.lineCards?.[0]).join() === "tcgcsv-88643");

  t("a bar drops the catalogue tag that repeats its number", barLabel({ name: "Garchomp (120 Secret)", number: "120/116" }, 16) === "Garchomp 120/116");
  t("a bar drops tags before cutting a name", barLabel({ name: "Deoxys EX (Team Plasma) (Full Art)", number: "111/116" }, 16) === "Deoxys EX 111/116");
  t("a bar drops an inner number code", barLabel({ name: "Rayquaza - 016/110 (Delta Species)", number: "16/110" }, 18) === "Rayquaza 16/110");
  t("a bar never cuts a word in half", /^Fusion Strike\.\.\. 244\/264$/.test(barLabel({ name: "Fusion Strike Energy", number: "244/264" }, 18)));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("stamp-promo-numbers.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("stamp promo numbers ok");
}
