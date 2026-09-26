import { rejectReason, rowAcceptable } from "../lib/tcgcsv-match.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name); }
};

const etb = { name: "Evolutions Elite Trainer Box", subtype: "etb", set: "Evolutions" };
t("prismatic is not evolutions", rejectReason(etb, "Prismatic Evolutions Elite Trainer Box"));
t("charizard cover is not the generic etb", rejectReason(etb, "XY Evolutions Elite Trainer Box [Mega Charizard Y]"));
t("plain evolutions box can match", rejectReason({ name: "Evolutions Booster Box", subtype: "booster-box" }, "XY Evolutions Booster Box") === null);

const skies = { name: "Evolving Skies Elite Trainer Box", subtype: "etb" };
t("jolteon cover is not the generic skies etb", rejectReason(skies, "Evolving Skies Elite Trainer Box [Flareon/Jolteon/Umbreon/Leafeon]"));
t("skies booster box name is clean", rejectReason({ name: "Evolving Skies Booster Box", subtype: "booster-box" }, "Evolving Skies Booster Box") === null);

t("center box is not a regular etb", rejectReason(
  { name: "Prismatic Evolutions Pokemon Center Elite Trainer Box", subtype: "pc-etb" },
  "Prismatic Evolutions Elite Trainer Box",
));
t("regular etb is not a center box", rejectReason(
  { name: "Prismatic Evolutions Elite Trainer Box", subtype: "etb" },
  "Prismatic Evolutions Pokemon Center Elite Trainer Box",
));
t("mini pack box rejected", rejectReason(
  { name: "Team Up Booster Box", subtype: "booster-box" },
  "Pokemon Team Up Mini Pack Booster Box",
));
t("japanese rejected", rejectReason(
  { name: "Sun & Moon Booster Box", subtype: "booster-box" },
  "Pokemon Japanese Sun & Moon Booster Box",
));
t("bundle is not a box", rejectReason(
  { name: "151 Booster Bundle", subtype: "booster-bundle" },
  "151 Booster Box",
));
t("black bolt etb accepted", rejectReason(
  { name: "Black Bolt Elite Trainer Box", subtype: "etb" },
  "Black Bolt Elite Trainer Box",
) === null);
t("pokemon go etb accepted", rejectReason(
  { name: "Pokemon GO Elite Trainer Box", subtype: "etb" },
  "Pokemon GO Elite Trainer Box",
) === null);

t("low confidence rejected", rowAcceptable({ matchConfidence: "low", reviewed: true, tcgPlayerId: "1" }));
t("unreviewed rejected", rowAcceptable({ matchConfidence: "high", reviewed: false, tcgPlayerId: "1" }));
t("excluded rejected", rowAcceptable({ matchConfidence: "high", reviewed: true, tcgPlayerId: "1", exclude: true }));
t("high reviewed accepted", rowAcceptable({ matchConfidence: "high", reviewed: true, tcgPlayerId: "123" }) === null);

console.log(fail ? `${fail} failed` : "tcgcsv match ok");
if (fail) process.exit(1);
