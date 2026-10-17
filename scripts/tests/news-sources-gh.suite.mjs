// The nightly news still works when PokeBeach and Bulbagarden answer 403 on GitHub runners.
// Those two are never fetched another way. Other sources fill in (docs/NEWS-SOURCES.md).
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIcv2 } from "../lib/news-sources.mjs";
import { TITLE_ONLY_SOURCES, isPublicNewsCandidate, pickDefault, pickNews, publicNewsRecord } from "../lib/tcg-news.mjs";
import { splitJpNews } from "../lib/jp-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RSS = `<rss><channel><title>ICv2</title>
<item><title>'Pokémon TCG' Allocation Update for 'Ascended Heroes'</title><link>https://icv2.com/articles/news/view/1/pokemon-allocation</link><description>Retailers get more boxes.</description><pubDate>Fri, 16 Oct 2026 20:39:28 CST</pubDate></item>
<item><title>Games Workshop Reveals New 'Warhammer 40,000' Holiday Miniature</title><link>https://icv2.com/articles/news/view/2/warhammer</link><description>A mini.</description><pubDate>Fri, 16 Oct 2026 13:15:11 CST</pubDate></item>
</channel></rss>`;

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => { console.log(`    ${ok ? "✓" : "✗"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail++; };
  const icv2 = parseIcv2(RSS);
  t("ICv2 keeps Pokémon headlines only", icv2.length === 1 && icv2[0].url.includes("pokemon-allocation"), JSON.stringify(icv2.map((r) => r.title)));
  t("ICv2 keeps no body text", icv2.every((r) => !r.sentenceText && !r.sentence));
  t("title-only sources include the GitHub-friendly ones", ["PokeGuardian", "Serebii", "Play! Pokémon", "ICv2"].every((s) => TITLE_ONLY_SOURCES.has(s)));
  const bare = { title: "MEGA Special Deck Set Mega Feraligatr, Mega Dragonite, Mega Gengar Revealed", url: "https://www.pokeguardian.com/1_x", source: "PokeGuardian", date: "2026-10-16", kind: "news" };
  t("a dated PokeGuardian headline with no sentence is public", isPublicNewsCandidate(bare));
  t("a headline with no sentence from another source stays out", !isPublicNewsCandidate({ ...bare, source: "Somewhere" }));
  t("PokeBeach and Bulbagarden are never title-only fallbacks", !TITLE_ONLY_SOURCES.has("PokeBeach") && !TITLE_ONLY_SOURCES.has("Bulbagarden"));
  const press = await readFile(join(ROOT, "scripts/fetch-tcg-news.mjs"), "utf8");
  t("press.pokemon.com pages wait the robots Crawl-Delay of 5 seconds", /Crawl-Delay: 5[\s\S]{0,80}sleep\(5000\)/.test(press));
  // A night with PokeBeach and Bulbagarden blocked still gives a card-news Feed.
  let doc = null;
  try { doc = JSON.parse(await readFile(join(ROOT, "research/digests/news.json"), "utf8")); } catch {}
  if (doc && Array.isArray(doc.catalog)) {
    const blocked = doc.catalog.filter((row) => row.source !== "PokeBeach" && row.source !== "Bulbagarden");
    const pool = splitJpNews(blocked.filter(isPublicNewsCandidate)).kept.map(publicNewsRecord);
    const rows = [...pickDefault(pool, doc.asOf, 8), ...pickNews(pool, doc.asOf)];
    const floor = new Date(Date.parse(doc.asOf + "T00:00:00Z") - 14 * 86400000).toISOString().slice(0, 10);
    const card = new Set(rows.filter((row) => row.date >= floor && /tcg|trading card|deck|card|promo|collection|booster/i.test(row.title)).map((row) => row.url));
    t("with PokeBeach and Bulbagarden blocked, the last 14 days still have 3+ card stories", card.size >= 3, String(card.size));
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("news-sources-gh.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
