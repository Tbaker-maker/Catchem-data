// Premium ratio flags. Fixture bands only. The live bands stay in the private spec.
import { readFileSync } from "node:fs";
import { flagForItem, flagFromSeries, flagWord, boardPill, setKeys, setsFromBoxes, boosterBoxFlagGap } from "../lib/premium-ratio.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail++; console.error("  FAIL " + name); } };

const spec = { minDays: 4, below: 0.5, above: 1.5 };
const days = (vals) => vals.map((v, i) => ["2026-10-" + String(i + 1).padStart(2, "0"), v]);
t("a drop against the earlier days is below", flagFromSeries(days([10, 10, 10, 4]), spec) === "below");
t("a jump against the earlier days is above", flagFromSeries(days([10, 10, 10, 20]), spec) === "above");
t("a small move is no flag", flagFromSeries(days([10, 10, 10, 11]), spec) === "");
t("a short series is no flag", flagFromSeries(days([10, 4]), spec) === "");
t("a bad spec is no flag", flagFromSeries(days([10, 10, 10, 4]), {}) === "");

const doc = {
  byProduct: { "tcgcsv-77": "above", "etb-1": "above" },
  bySet: { "evolving skies": { flag: "below", boxId: "tcgcsv-10" } },
  sealed: ["tcgcsv-77", "etb-1"],
};
t("a single inherits the booster box", flagForItem({ id: "tcgcsv-1", set: "SWSH07: Evolving Skies", kind: "single", href: "/c/tcgcsv-1" }, doc) === "below");
t("a base set name still finds that box", flagForItem({ set: "SV01: Scarlet & Violet Base Set", kind: "single" }, { bySet: { "scarlet and violet": "below" }, sealed: [] }) === "below");
t("151 does not use the base set box", flagForItem({ set: "Scarlet & Violet 151", kind: "single" }, { bySet: { "scarlet and violet": "below" }, sealed: [] }) === "");
t("prismatic has no box so no flag", flagForItem({ set: "SV: Prismatic Evolutions", kind: "single", href: "/c/tcgcsv-3" }, doc) === "");
t("shrouded fable has no box so no flag", flagForItem({ set: "Shrouded Fable", kind: "single" }, doc) === "");
t("an ETB uses its own flag and is not the single fallback", flagForItem({ id: "tcgcsv-77", set: "SV: Prismatic Evolutions", kind: "sealed", href: "/p/tcgcsv-77" }, doc) === "above");
t("a sealed id in the sealed list does not inherit the set", flagForItem({ id: "etb-1", set: "Evolving Skies", kind: "single", href: "/p/etb-1" }, doc) === "above");
t("words stay the two labels", flagWord("below") === "Below its usual premium" && flagWord("above") === "Above its usual premium" && flagWord("") === "");
t("the dark board pill is empty without a flag", boardPill("") === "" && boardPill("below").includes("Below its usual premium") && boardPill("above").includes("#f6dc86"));
t("set keys keep 151 off the base set", setKeys("SV: Scarlet & Violet 151").includes("scarlet and violet") === false && setKeys("SV01: Scarlet & Violet Base Set").includes("scarlet and violet"));
const pill = boardPill("below") + boardPill("above") + flagWord("below") + flagWord("above");
t("labels have no dashes", !/[\u2013\u2014]/.test(pill));

t("a dash era name finds the set box", flagForItem({ set: "SM - Team Up", kind: "single", href: "/c/x" }, { bySet: { "team up": { flag: "below", boxId: "tcgcsv-1" } }, sealed: [] }) === "below");
t("a colon era name still finds that box", flagForItem({ set: "SM: Team Up", kind: "single" }, { bySet: { "team up": "below" }, sealed: [] }) === "below");

const products = JSON.parse(readFileSync(new URL("../../data/sealed-products.json", import.meta.url), "utf8"));
const box = (set, nameRe) => products.find((r) => r?.subtype === "booster-box" && r.tcgPlayerId && r.set === set && nameRe.test(String(r.name || "")));
const evolving = box("Evolving Skies", /^Evolving Skies Booster Box$/);
const evolvingHalf = box("SWSH07: Evolving Skies", /half booster/i);
const paldea = box("Paldea Evolved", /^Paldea Evolved Booster Box$/);
const obsidian = box("Obsidian Flames", /^Obsidian Flames Booster Box$/);
const journey = box("Journey Together", /^Journey Together Booster Box$/);
const journeyEnhanced = box("SV09: Journey Together", /enhanced/i);
const etb = products.find((r) => r?.subtype === "etb" && r.tcgPlayerId && /evolving skies/i.test(String(r.name || "")));
const tin = products.find((r) => r?.subtype === "tin" && r.tcgPlayerId && /prismatic evolutions/i.test(String(r.set || "")));
const bundle = products.find((r) => r?.subtype === "booster-bundle" && r.tcgPlayerId && /prismatic evolutions/i.test(String(r.set || "")));
t("fixture boxes exist", !!(evolving && evolvingHalf && paldea && obsidian && journey && journeyEnhanced && etb && tin && bundle));
const dayCount = new Map([
  [String(evolving.tcgPlayerId), 20],
  [String(evolvingHalf.tcgPlayerId), 20],
  [String(paldea.tcgPlayerId), 20],
  [String(obsidian.tcgPlayerId), 20],
  [String(journey.tcgPlayerId), 10],
  [String(journeyEnhanced.tcgPlayerId), 30],
]);
const flags = new Map([
  [String(evolving.tcgPlayerId), "below"],
  [String(evolvingHalf.tcgPlayerId), "above"],
  [String(paldea.tcgPlayerId), "above"],
  [String(obsidian.tcgPlayerId), "below"],
  [String(journey.tcgPlayerId), "above"],
  [String(journeyEnhanced.tcgPlayerId), "below"],
  [String(etb.tcgPlayerId), "above"],
  [String(tin.tcgPlayerId), "below"],
  [String(bundle.tcgPlayerId), "above"],
]);
const built = setsFromBoxes(products, flags, dayCount);
t("a flagged booster box fills bySet", built.bySet["evolving skies"]?.flag === "below" && built.bySet["evolving skies"]?.boxId === `tcgcsv-${evolving.tcgPlayerId}`);
t("the half box does not take evolving skies", built.bySet["evolving skies"].boxId !== `tcgcsv-${evolvingHalf.tcgPlayerId}`);
t("the plain journey box wins over the enhanced box", built.bySet["journey together"]?.boxId === `tcgcsv-${journey.tcgPlayerId}` && built.bySet["journey together"]?.flag === "above");
t("an ETB, tin, or bundle does not create a set flag", !Object.values(built.bySet).some((row) => [`tcgcsv-${etb.tcgPlayerId}`, `tcgcsv-${tin.tcgPlayerId}`, `tcgcsv-${bundle.tcgPlayerId}`].includes(row.boxId)));
t("prismatic and shrouded are absent from the built set flags", !Object.keys(built.bySet).some((k) => /prismatic|shrouded/.test(k)));
const halfOnly = setsFromBoxes(products, new Map([[String(evolvingHalf.tcgPlayerId), "above"], [String(etb.tcgPlayerId), "below"], [String(tin.tcgPlayerId), "above"], [String(bundle.tcgPlayerId), "below"]]), dayCount);
t("a half box, ETB, tin, or bundle leaves bySet empty while the plain box is neutral", !halfOnly.bySet["evolving skies"] && !Object.keys(halfOnly.bySet).some((k) => /prismatic|shrouded|evolving/.test(k)));
const inherit = {
  byProduct: {
    [`tcgcsv-${etb.tcgPlayerId}`]: "above",
    [`tcgcsv-${tin.tcgPlayerId}`]: "below",
    [`tcgcsv-${bundle.tcgPlayerId}`]: "above",
    [`tcgcsv-${evolvingHalf.tcgPlayerId}`]: "above",
  },
  bySet: built.bySet,
  sealed: [`tcgcsv-${etb.tcgPlayerId}`, `tcgcsv-${tin.tcgPlayerId}`, `tcgcsv-${bundle.tcgPlayerId}`, `tcgcsv-${evolvingHalf.tcgPlayerId}`],
};
t("umbreon vmax inherits the evolving skies box", flagForItem({ id: "tcgcsv-246723", set: "SWSH07: Evolving Skies", kind: "single", href: "/c/tcgcsv-246723" }, inherit) === "below");
t("floragato inherits the paldea evolved box", flagForItem({ id: "tcgcsv-497600", set: "SV02: Paldea Evolved", kind: "single", href: "/c/tcgcsv-497600" }, inherit) === "above");
t("lechonk inherits the obsidian flames box", flagForItem({ id: "tcgcsv-509957", set: "SV03: Obsidian Flames", kind: "single", href: "/c/tcgcsv-509957" }, inherit) === "below");
t("janine stays empty because prismatic has no booster box", flagForItem({ id: "tcgcsv-610528", set: "SV: Prismatic Evolutions", kind: "single", href: "/c/tcgcsv-610528" }, inherit) === "");
t("a single does not inherit the ETB when bySet is empty", flagForItem({ id: "tcgcsv-246723", set: "SWSH07: Evolving Skies", kind: "single", href: "/c/tcgcsv-246723" }, { byProduct: inherit.byProduct, bySet: {}, sealed: inherit.sealed }) === "");
const missing = { byProduct: { [`tcgcsv-${evolving.tcgPlayerId}`]: "below", [String(evolving.id)]: "below" }, bySet: {}, sealed: [] };
t("the gate fails when a booster box flag never reaches bySet", boosterBoxFlagGap(missing, products, dayCount).failed === true);
t("the gate passes when bySet carries that box", boosterBoxFlagGap({ byProduct: missing.byProduct, bySet: built.bySet }, products, dayCount).failed === false);
t("the gate does not fail for an ETB, tin, bundle, or half box alone", boosterBoxFlagGap({ byProduct: inherit.byProduct, bySet: {}, sealed: inherit.sealed }, products, dayCount).failed === false);

try {
  const raw = readFileSync(new URL("../../research/assets/public/premium-ratio.json", import.meta.url), "utf8");
  const live = JSON.parse(raw);
  const flags = [...Object.values(live.byProduct || {}), ...Object.values(live.bySet || {}).map((row) => row?.flag || row)];
  t("public file stores flags only", flags.every((v) => v === "below" || v === "above") && !/"minDays"/.test(raw) && !/\b0\.\d+\b/.test(raw));
  t("prismatic and shrouded are not booster box flags", !Object.keys(live.bySet || {}).some((k) => /prismatic|shrouded/.test(k)));
  t("the live file is not a booster box gap", boosterBoxFlagGap(live, products, new Map()).failed === false);
} catch {
  t("public file is optional until the build writes it", true);
}

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("premium ratio ok");
