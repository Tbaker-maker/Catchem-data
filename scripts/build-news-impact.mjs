import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildImpacts } from "./lib/news-impact.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const news = JSON.parse(await readFile(join(ROOT, "research/digests/news.json"), "utf8"));
const books = await readFile(join(ROOT, "data/derived/news-price-book.json"), "utf8").then(JSON.parse).catch(() => ({}));
const items = (news.catalog || []).filter((item) => item.product && item.date && item.url);
const rows = buildImpacts(items, books.books || books, news.asOf || "");
const filled = rows.reduce((sum, row) => sum + row.windows.filter((window) => window.price != null || window.listingsCounted != null).length, 0);
const out = {
  asOf: news.asOf || "",
  rule: "Windows are 1, 7, and 30 days after the item date. Price and listings counted are copied from the book for that product on that exact day. A day that is not in the book, or a day after asOf, stays empty.",
  items: rows.length,
  filled,
  rows,
};
const dest = join(ROOT, "data/derived/news-impact.json");
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(out));
console.log(JSON.stringify({ asOf: out.asOf, items: out.items, filled: out.filled }));
