// Applies rules/jp-news.json to the digest files already on disk, so the public
// news drops Japan-only items without waiting for the next fetch. The catalog is
// left whole for research leads. Dropped items go to the private QA log only.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitJpNews } from "./lib/jp-news.mjs";
import { writeFeedNews, writeJpDropLog } from "./fetch-tcg-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEWS = join(ROOT, "research/digests/news.json");
const WEEKLY = join(ROOT, "research/digests/weekly-news.json");

export function scrubDoc(doc) {
  const dropped = [];
  const take = (rows) => { const s = splitJpNews(rows || []); dropped.push(...s.dropped); return s.kept; };
  const out = { ...doc };
  if (Array.isArray(doc.items)) out.items = take(doc.items);
  if (doc.filters && doc.filters.news && Array.isArray(doc.filters.news.items)) {
    out.filters = { ...doc.filters, news: { ...doc.filters.news, items: take(doc.filters.news.items) } };
  }
  const seen = new Set();
  return { doc: out, dropped: dropped.filter((row) => (seen.has(row.url + row.title) ? false : seen.add(row.url + row.title))) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const news = scrubDoc(JSON.parse(await readFile(NEWS, "utf8")));
  const weekly = scrubDoc(JSON.parse(await readFile(WEEKLY, "utf8")));
  await writeFile(NEWS, JSON.stringify(news.doc, null, 2) + "\n");
  await writeFile(WEEKLY, JSON.stringify(weekly.doc, null, 2) + "\n");
  await writeFeedNews(news.doc);
  const all = [...news.dropped, ...weekly.dropped.filter((w) => !news.dropped.some((n) => n.url === w.url && n.title === w.title))];
  await writeJpDropLog(all, news.doc.asOf || "", new Date().toISOString());
  console.log(`news ${news.doc.items.length} · news filter ${news.doc.filters?.news?.items?.length ?? 0} · weekly ${weekly.doc.items?.length ?? 0} · left out ${all.length}`);
}
