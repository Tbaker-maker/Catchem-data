// Rebuilds the public news lists and research/digests/feed-news.json from the catalog
// already in research/digests/news.json, with today's rules. No network: use it when the
// rules change between nightly runs. Dropped region-only items go to the private QA log.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicNewsCandidate, pickDefault, pickNews, pickWeekly, publicNewsRecord } from "./lib/tcg-news.mjs";
import { splitJpNews } from "./lib/jp-news.mjs";
import { writeFeedNews, writeJpDropLog } from "./fetch-tcg-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEWS = join(ROOT, "research/digests/news.json");
const WEEKLY = join(ROOT, "research/digests/weekly-news.json");

export function rebuildLists(doc) {
  const today = doc.asOf;
  const split = splitJpNews((doc.catalog || []).filter(isPublicNewsCandidate));
  const pool = split.kept.map(publicNewsRecord);
  const out = { ...doc, items: pickDefault(pool, today, 8), filters: { ...(doc.filters || {}), news: { ...((doc.filters && doc.filters.news) || { kind: "news", windowDays: 90 }), items: pickNews(pool, today) } } };
  return { doc: out, weekly: pickWeekly(pool, today), dropped: split.dropped };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const news = JSON.parse(await readFile(NEWS, "utf8"));
  const weeklyDoc = JSON.parse(await readFile(WEEKLY, "utf8"));
  const built = rebuildLists(news);
  await writeFile(NEWS, JSON.stringify(built.doc, null, 2) + "\n");
  await writeFile(WEEKLY, JSON.stringify({ ...weeklyDoc, asOf: news.asOf, items: built.weekly }, null, 2) + "\n");
  await writeFeedNews(built.doc);
  await writeJpDropLog(built.dropped, news.asOf, new Date().toISOString());
  console.log(`news ${built.doc.items.length} · news filter ${built.doc.filters.news.items.length} · weekly ${built.weekly.length} · left out ${built.dropped.length}`);
}
