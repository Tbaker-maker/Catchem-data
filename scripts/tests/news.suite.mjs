import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasSourceUrl,
  pickDefault,
  pickNews,
  pickWeekly,
  sourceAllowsOlderWeekly,
} from "../lib/tcg-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function item(over) {
  return {
    title: "A public TCG note.",
    date: "2026-10-01",
    url: "https://www.pokebeach.com/forums/threads/example.1/",
    sentence: "The source says this is a public TCG note.",
    kind: "news",
    source: "PokeBeach",
    published: "2026-10-01T12:00:00.000Z",
    ...over,
  };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const missing = item({ url: "" });
  t("an item with no source URL fails", hasSourceUrl(missing) === false);
  t("an item with a source URL passes", hasSourceUrl(item({})) === true);

  const today = "2026-10-02";
  const rows = [
    item({ title: "New today.", date: "2026-10-02", published: "2026-10-02T18:00:00.000Z", url: "https://press.pokemon.com/en/a" }),
    item({ title: "Edge of the window.", date: "2026-09-18", published: "2026-09-18T18:00:00.000Z", url: "https://press.pokemon.com/en/b" }),
    item({ title: "Too old for the mix.", date: "2026-09-17", published: "2026-09-17T18:00:00.000Z", url: "https://press.pokemon.com/en/c", sentence: "The source says a product is to launch in November." }),
    item({ title: "Inside ninety days.", date: "2026-08-01", published: "2026-08-01T18:00:00.000Z", url: "https://press.pokemon.com/en/d", sentence: "More English cards were revealed for the set." }),
    item({ title: "Past ninety days.", date: "2026-06-01", published: "2026-06-01T18:00:00.000Z", url: "https://press.pokemon.com/en/e", sentence: "The source says the product is to release in July." }),
    item({ title: "Opinion only.", date: "2026-08-20", published: "2026-08-20T18:00:00.000Z", url: "https://press.pokemon.com/en/f", sentence: "The column looks at how a deck felt at the event." }),
  ];
  for (let i = 0; i < 10; i++) {
    rows.push(item({
      title: `Fill ${i}.`,
      date: "2026-10-01",
      published: `2026-10-01T${String(i).padStart(2, "0")}:00:00.000Z`,
      url: `https://www.pokebeach.com/forums/threads/fill.${i}/`,
    }));
  }
  const def = pickDefault(rows, today, 8);
  t("default mix caps at 8", def.length === 8);
  t("default mix drops anything older than 14 days", def.every((row) => row.date >= "2026-09-18"));
  const news = pickNews(rows, today);
  t("news filter keeps kind news inside 90 days", news.some((row) => row.date === "2026-08-01") && news.every((row) => row.date >= "2026-07-04"));
  t("news filter drops anything older than 90 days", news.every((row) => row.date !== "2026-06-01"));
  const weekly = pickWeekly(rows, today);
  t("weekly letter can keep an older release the source states", weekly.some((row) => row.url.endsWith("/c")));
  t("weekly letter can keep an older development the source states", weekly.some((row) => row.url.endsWith("/d")));
  t("weekly letter leaves out an older item the source does not qualify", weekly.every((row) => !row.url.endsWith("/f")));
  t("weekly letter leaves out an item older than 90 days", weekly.every((row) => !row.url.endsWith("/e")));
  t("release wording is the source, not a guess", sourceAllowsOlderWeekly("Pokemon to release a new box on January 27th.") === true);
  t("a plain older recap is not treated as important", sourceAllowsOlderWeekly("The column looks at how a deck felt at the event.") === false);

  for (const rel of ["research/digests/news.json", "research/digests/weekly-news.json"]) {
    let doc;
    try { doc = JSON.parse(await readFile(join(ROOT, rel), "utf8")); }
    catch (err) { t(`${rel} readable`, false); continue; }
    const groups = rel.endsWith("news.json") && !rel.endsWith("weekly-news.json")
      ? [doc.items, doc.filters?.news?.items]
      : [doc.items];
    let bare = 0;
    for (const group of groups) {
      if (!Array.isArray(group)) { bare += 1; continue; }
      for (const row of group) if (!hasSourceUrl(row)) bare += 1;
    }
    t(`${rel} items all have a source URL`, bare === 0);
  }
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("news.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
