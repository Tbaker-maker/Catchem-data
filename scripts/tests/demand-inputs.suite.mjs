import { readFile } from "node:fs/promises";
import { GOOGLE_TRENDS_SKIPPED, YOUTUBE_TRAIL_SKIPPED } from "../lib/heat-check.mjs";
import { publicLine, sealedTrail, setTrail, trailZ, uniqueSealedId } from "../lib/youtube-mention-trail.mjs";
import { mapTitle, pageviewZ, publicWikiRows } from "../lib/wiki-heat.mjs";
import { publicSupplyLine } from "../lib/supply-watch-line.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };
  const writer = await readFile(new URL("../compute-heat-check.mjs", import.meta.url), "utf8");
  const heat = await readFile(new URL("../lib/heat-check.mjs", import.meta.url), "utf8");
  const method = await readFile(new URL("../../data/heat-check-methodology.md", import.meta.url), "utf8");
  t("googleTrends reason is the missing official API", heat.includes(GOOGLE_TRENDS_SKIPPED) && writer.includes("GOOGLE_TRENDS_SKIPPED") && GOOGLE_TRENDS_SKIPPED.includes("No official Google Trends API"));
  t("writer does not install or call pytrends", !writer.includes("pytrends") && !heat.includes("pytrends"));
  t("writer does not blame a missing youtube key", !writer.includes("No YouTube API key") && !heat.includes("No YouTube API key") && writer.includes("YOUTUBE_TRAIL_SKIPPED") && heat.includes(YOUTUBE_TRAIL_SKIPPED));
  t("methodology matches the trends reason", method.includes("no official Google Trends API") && method.includes("Wikipedia pageviews do not fill this slot"));

  const rundown = { id: "r", date: "2030-01-15", mentions: [{ id: "1", kind: "sealed", reason: "product_link" }, { id: "2", kind: "sealed", reason: "set_sealed_kind" }] };
  t("an ambiguous rundown counts for nothing", uniqueSealedId(rundown) === null && sealedTrail([rundown], "1", "2030-01-15", 3).every((d) => d.n === 0));
  const unique = { id: "u", date: "2030-01-15", mentions: [{ id: "9", kind: "sealed", reason: "product_link" }, { id: "sv", kind: "set" }] };
  t("a unique product link counts", sealedTrail([unique], "9", "2030-01-15", 1)[0].n === 1 && setTrail([unique], "sv", "2030-01-15", 1)[0].n === 1);
  t("a short trail leaves z null", trailZ([{ date: "2030-01-01", n: 2 }, { date: "2030-01-02", n: 1 }]).z === null);
  const filled = Array.from({ length: 30 }, (_, i) => ({ date: `2030-03-${String(i + 1).padStart(2, "0")}`, n: i === 29 ? 5 : 0 }));
  const z = trailZ(filled);
  t("a filled trail gives a z", z.days === 30 && z.z != null && z.partial === false);
  const line = publicLine({ n: 3, product: "Sample ETB", end: "2030-01-15", asOf: "2030-01-16" });
  t("public youtube line names the source and no creator", line.includes("YouTube Data API v3") && line.startsWith("3 tracked videos uniquely named Sample ETB"));

  t("franchise title maps", mapTitle("Pokémon Trading Card Game")?.title === "Pokémon_Trading_Card_Game");
  t("surging sparks and prismatic have no page", mapTitle("Surging Sparks") === null && mapTitle("Prismatic Evolutions") === null);
  t("a list title maps to nothing", mapTitle("List of Pokémon Trading Card Game sets") === null);
  t("a missing set title fails closed", mapTitle("Invented Set Name") === null);
  t("a known unique set maps", mapTitle("Fake Set", { "Fake Set": { unique: true, title: "Fake_Set", groupId: 7 } })?.kind === "set");
  t("pageviews under 30 days fail closed", pageviewZ([{ views: 10 }, { views: 12 }]).z === null);
  const views = Array.from({ length: 30 }, (_, i) => ({ views: i === 29 ? 40 : 8 }));
  t("filled pageviews give a z", pageviewZ(views).z != null);
  t("wiki rows stay off while the flag is off", publicWikiRows([{ z: 1.2, days: 30 }], false).length === 0);

  const supply = publicSupplyLine({ before: 41, after: 53, start: "Nov 18", end: "Nov 25", market: 10 }, false);
  t("supply line stays off while the flag is off", supply === null);
  const shown = publicSupplyLine({ before: 41, after: 53, start: "Nov 18", end: "Nov 25", market: 10 }, true);
  t("supply line is listings counted, not sold", shown && shown.includes("Listings counted up 12") && !/\b(sold|supply|will|buy)\b/i.test(shown));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("demand-inputs.suite.mjs")) process.exit(await run() ? 1 : 0);
