import { pathToFileURL } from "node:url";
import { pickMorning } from "../lib/morning-card.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

const reads = [
  { id: "a", price: 2.63, changePct: 74.2, headline: "Pidgey is up 74.2% this month: $1.51 → $2.63.", href: "/c/a", readKind: "price" },
  { id: "b", price: 12.55, changePct: 33.5, headline: "Rebel Clash Booster Pack hit a 6-month high: $12.55.", href: "/p/b", readKind: "price" },
  { id: "c", price: null, changePct: null, headline: "Pidgey (#16): 17 cards, 14 artists.", readKind: "pokemon" },
];
const news = [
  { kind: "release", title: "Delta Reign", url: "https://www.serebii.net/card/deltareign", date: "2026-11-06", source: "Serebii" },
  { kind: "release", title: "Mega Evolution - Delta Reign", url: "https://www.pokeguardian.com/3231721", date: "2026-11-06", source: "PokeGuardian" },
  { kind: "news", title: "Sign-ups for the Puebla Regional are open again!", url: "https://victoryroad.pro/2027-puebla/", date: "2026-10-08", source: "Victory Road" },
];
const doc = pickMorning({ reads, news, asOf: "2026-10-09", supplyOn: false });
t("the supply line stays off", doc.supply === "off" && !doc.lines.some((line) => line.slot === "supply"));
t("the biggest priced move leads", doc.lines[0].text.includes("74.2%"));
t("the 6-month high is its own line", doc.lines.some((line) => line.slot === "high" && line.text.includes("6-month high")));
t("the species fact is not called a set move", doc.lines.find((line) => line.slot === "fact").note.includes("No set move"));
t("news is the longer release, not a regional signup", doc.lines.find((line) => line.slot === "news").text.startsWith("Mega Evolution - Delta Reign") && !JSON.stringify(doc).includes("Puebla"));

if (fail) console.log(fail + " failed");
else console.log("morning card ok");
// run-tests.mjs imports every *.suite.mjs and counts a missing run() as a
// failure, which stopped the nightly. The checks above run on import; run()
// reports their count. Run directly, a failure still exits non-zero.
export async function run() { return fail; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && fail) process.exit(1);

