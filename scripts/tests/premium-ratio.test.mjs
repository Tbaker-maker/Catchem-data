// Premium ratio flags. Fixture bands only. The live bands stay in the private spec.
import { readFileSync } from "node:fs";
import { flagForItem, flagFromSeries, flagWord, boardPill, setKeys } from "../lib/premium-ratio.mjs";

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

try {
  const raw = readFileSync(new URL("../../research/assets/public/premium-ratio.json", import.meta.url), "utf8");
  const live = JSON.parse(raw);
  const flags = [...Object.values(live.byProduct || {}), ...Object.values(live.bySet || {}).map((row) => row?.flag || row)];
  t("public file stores flags only", flags.every((v) => v === "below" || v === "above") && !/"minDays"/.test(raw) && !/\b0\.\d+\b/.test(raw));
  t("prismatic and shrouded are not booster box flags", !Object.keys(live.bySet || {}).some((k) => /prismatic|shrouded/.test(k)));
} catch {
  t("public file is optional until the build writes it", true);
}

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("premium ratio ok");
