// The small news file the site Feed reads live: public lists only, no Japan-only item, same day as news.json.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { feedNewsDoc } from "../fetch-tcg-news.mjs";
import { jpNewsDecision } from "../lib/jp-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => { console.log(`    ${ok ? "✓" : "✗"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail++; };
  const a = { url: "https://example.com/a", title: "A" };
  const b = { url: "https://example.com/b", title: "B" };
  const doc = feedNewsDoc({ updated: "u", timezone: "America/Vancouver", asOf: "2026-10-16", items: [a], filters: { news: { items: [a, b] } }, catalog: [a, b, { url: "https://example.com/c" }] });
  t("feed news joins items and the news filter once each, and skips the catalog", doc.items.length === 2 && !("catalog" in doc) && doc.asOf === "2026-10-16");
  const prior = { items: [{ url: "https://example.com/old", title: "Old", date: "2026-10-10" }, { url: "https://example.com/stale", title: "Stale", date: "2026-09-01" }, { url: "https://www.pokemon-card.com/info/9.html", source: "Pokémon Card (Japan)", title: "Japan: x", date: "2026-10-12" }, { url: "https://example.com/a", title: "A old copy", date: "2026-10-11" }] };
  const carried = feedNewsDoc({ asOf: "2026-10-16", items: [a] }, prior);
  t("a blocked night keeps the last 14 days of stories", carried.items.some((r) => r.url === "https://example.com/old"));
  t("carried stories older than 14 days drop off", !carried.items.some((r) => r.url === "https://example.com/stale"));
  t("carried stories still pass the region filter", !carried.items.some((r) => r.url.includes("pokemon-card.com")));
  t("tonight's copy of a story wins over the carried one", carried.items.filter((r) => r.url === "https://example.com/a").length === 1 && carried.items.find((r) => r.url === "https://example.com/a").title === "A");
  let file = null;
  let news = null;
  try {
    file = JSON.parse(await readFile(join(ROOT, "research/digests/feed-news.json"), "utf8"));
    news = JSON.parse(await readFile(join(ROOT, "research/digests/news.json"), "utf8"));
  } catch {}
  t("research/digests/feed-news.json exists", !!file);
  if (file && news) {
    t("feed-news.json is the same day as news.json", file.asOf === news.asOf, `${file.asOf} vs ${news.asOf}`);
    t("feed-news.json has news", Array.isArray(file.items) && file.items.length > 0);
    t("feed-news.json has no region-only item", file.items.every((row) => jpNewsDecision(row).keep));
    t("feed-news.json stays small (under 200 KB)", JSON.stringify(file).length < 200000);
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("feed-news.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
