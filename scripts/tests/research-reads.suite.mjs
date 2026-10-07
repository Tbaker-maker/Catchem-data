// research-reads.suite.mjs — the latest digest is a dated digest, and the
// radar renders from upcoming[] with past rows dropped.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDigestName, pickDigestNames, radarRows, upcomingRadar, canConfirm } from "../lib/research-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  // ── latest digest ──
  const names = ["2026-09-26.md", "2026-09-28.md", "news-sources-2026-10-02.md", "news.json", "weekly-news.json", "README.md", "2026-09-28.md.bak"];
  t("a dated digest is a digest", isDigestName("2026-10-07.md"));
  t("a note with a date inside is not a digest", !isDigestName("news-sources-2026-10-02.md"));
  t("news JSON is not a digest", !isDigestName("news.json") && !isDigestName("weekly-news.json"));
  t("latest digest skips notes that sort after the dates", pickDigestNames(names, 1)[0] === "2026-09-28.md");
  t("last n digests are dated and newest last", JSON.stringify(pickDigestNames(names, 3)) === JSON.stringify(["2026-09-26.md", "2026-09-28.md"]));
  t("no dated digest gives an empty pick", pickDigestNames(["news.json", "notes.md"], 2).length === 0);
  const onDisk = pickDigestNames(await readdir(join(ROOT, "research", "digests")), 1)[0];
  t("the repo's latest digest is date-named", isDigestName(onDisk));

  // ── radar read ──
  const radar = { upcoming: [
    { name: "Past wave", type: "wave", date: "2026-10-02", confidence: "verified" },
    { name: "Later set", type: "main-set", date: "2026-11-06", confidence: "verified" },
    { name: "Lead", type: "tins", date: "2026-12-04", confidence: "single-source" },
    { name: "Today", type: "product", date: "2026-10-07", confidence: "verified" },
    { name: "Undated", type: "product", date: "TBA", confidence: "verified" },
  ] };
  const up = upcomingRadar(radar, "2026-10-07");
  t("upcoming[] is read", up.length === 3);
  t("past-dated rows drop at read time", !up.some((r) => r.name === "Past wave"));
  t("a row dated today still shows", up[0].name === "Today");
  t("undated rows are not upcoming", !up.some((r) => r.name === "Undated"));
  t("rows come soonest first", up.map((r) => r.date).join() === "2026-10-07,2026-11-06,2026-12-04");
  t("limit applies after sorting", upcomingRadar(radar, "2026-10-07", { limit: 1 })[0].name === "Today");
  t("verifiedOnly leaves single-source leads out", !upcomingRadar(radar, "2026-10-07", { verifiedOnly: true }).some((r) => r.confidence === "single-source"));
  t("verified without an official source is not public", upcomingRadar({ upcoming: [{ name: "Rumor", date: "2026-12-01", confidence: "verified", note: "Sources: PokeBeach." }] }, "2026-10-07", { verifiedOnly: true }).length === 0);
  t("an official pokemon.com page can confirm a row", canConfirm({ confidence: "verified", note: "Sources: pokemon.com/us/pokemon-tcg/product-gallery/example." }));
  t("a news index cited as missing the product does not confirm", !canConfirm({ confidence: "verified", note: "pokemon-card.com's news list carries no announcement. Sources add: pokemon-card.com/info." }));
  t("unconfirmed stays off the public radar", upcomingRadar({ upcoming: [{ name: "Aura", date: "2026-11-27", confidence: "unconfirmed", note: "Sources: pokemon.com/us/news/example." }] }, "2026-10-07", { verifiedOnly: true }).length === 0);
  t("items[] still works as a fallback", upcomingRadar({ items: [{ name: "A", date: "2027-01-01" }] }, "2026-10-07").length === 1);
  t("releases[] with releaseDate still works", upcomingRadar({ releases: [{ title: "B", releaseDate: "2027-01-01" }] }, "2026-10-07").length === 1);
  t("upcoming[] wins over items[]", radarRows({ upcoming: [{ name: "U" }], items: [{ name: "I" }] })[0].name === "U");
  t("a missing radar is an empty radar", upcomingRadar(null, "2026-10-07").length === 0);

  // ── the committed radar and the readers ──
  const committed = JSON.parse(await readFile(join(ROOT, "data", "release-radar.json"), "utf-8"));
  t("data/release-radar.json keeps its rows in upcoming[]", Array.isArray(committed.upcoming));
  t("every confirmed row cites an official source", committed.upcoming.every((row) => {
    const label = String(row.confidence || "").toLowerCase();
    if (label !== "verified" && label !== "confirmed") return true;
    return canConfirm(row);
  }));
  t("Aura Seeker is unconfirmed and off the public radar", committed.upcoming.some((row) => /Aura Seeker/.test(row.name) && row.confidence === "unconfirmed") && !upcomingRadar(committed, "2026-10-07", { verifiedOnly: true }).some((row) => /Aura Seeker/.test(row.name)));
  const src = async (rel) => readFile(join(ROOT, rel), "utf-8");
  for (const rel of ["scripts/generate-pulse.mjs", "scripts/generate-post-ideas.mjs"]) {
    const s = await src(rel);
    t(`${rel} reads the radar through upcomingRadar`, s.includes("upcomingRadar(") && !/\(rad(ar)?\?\.items\|\|/.test(s));
  }
  for (const rel of ["scripts/compute-derived.mjs", "scripts/draft-newsletter.mjs", "scripts/generate-content.mjs"]) {
    const s = await src(rel);
    t(`${rel} picks dated digests only`, s.includes("pickDigestNames(") && !/filter\(\s*f\s*=>\s*f\.endsWith\("\.md"\)\s*\)/.test(s));
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("research-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
