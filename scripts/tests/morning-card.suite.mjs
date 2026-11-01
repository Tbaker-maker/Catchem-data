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

const year = { id: "ray", price: 40, changePct: 300, windowDays: 365, headline: "Rayquaza is up 300% over the year: $10 to $40.", href: "/c/ray", readKind: "price" };
const weekUp = { id: "resh", price: 20, changePct: 113.4, windowDays: 7, signal: "mover", headline: "Reshiram is up 113.4% over 7 days: $9.37 to $20.", href: "/c/resh", readKind: "price" };
const weekDown = { id: "gol", price: 3, changePct: -41.9, windowDays: 7, headline: "Golbat is down 41.9% over 7 days: $5.16 to $3.", href: "/c/gol", readKind: "price" };
const weekMid = { id: "pik", price: 8, changePct: 80, windowDays: 7, headline: "Pikachu is up 80% over 7 days: $4.44 to $8.", href: "/c/pik", readKind: "price" };
const weekSmall = { id: "zub", price: 2, changePct: 10, signal: "mover", headline: "Zubat is up 10% over 7 days: $1.82 to $2.", href: "/c/zub", readKind: "price" };

const beat = pickMorning({ reads: [year, weekUp], news: [], asOf: "2026-10-30" });
const beatMovers = beat.lines.filter((line) => line.slot === "mover");
t("a 7-day mover beats a bigger year read", beatMovers.length === 1 && beatMovers[0].id === "resh" && !beat.lines.some((line) => line.slot === "mover" && line.id === "ray"));

const signaled = pickMorning({
  reads: [year, { id: "odd", price: 5, changePct: 20, signal: "mover", headline: "Oddish is up 20% over 7 days: $4.17 to $5.", href: "/c/odd", readKind: "price" }],
  news: [],
  asOf: "2026-10-30",
});
t("a mover signal beats a bigger year read", signaled.lines.find((line) => line.slot === "mover").id === "odd");

const fallback = pickMorning({
  reads: [year, { id: "pid", price: 2, changePct: 12, windowDays: 30, headline: "Pidgey is up 12% this month: $1.79 to $2.", href: "/c/pid", readKind: "price" }],
  news: [],
  asOf: "2026-10-30",
});
const fallbackMovers = fallback.lines.filter((line) => line.slot === "mover");
t("fallback is the current biggest move when no week mover qualifies", fallbackMovers.length === 1 && fallbackMovers[0].id === "ray");

const counted = pickMorning({ reads: [year, weekUp, weekDown, weekMid, weekSmall], news: [], asOf: "2026-10-30" });
const countedMovers = counted.lines.filter((line) => line.slot === "mover");
t("the mover slot shows at most 3", countedMovers.length === 3);
t("largest week move is first", countedMovers[0].id === "resh");
t("one up and one down when both exist", countedMovers.some((line) => line.id === "resh") && countedMovers.some((line) => line.id === "gol"));
t("the year read does not fill a spare mover slot", !countedMovers.some((line) => line.id === "ray") && countedMovers.map((line) => line.id).join(",") === "resh,pik,gol");

if (fail) console.log(fail + " failed");
else console.log("morning card ok");
// run-tests.mjs imports every *.suite.mjs and counts a missing run() as a
// failure, which stopped the nightly. The checks above run on import; run()
// reports their count. Run directly, a failure still exits non-zero.
export async function run() { return fail; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && fail) process.exit(1);

