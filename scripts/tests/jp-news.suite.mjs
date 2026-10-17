// Japan-only news stays out of public news. Real headlines from the digest.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JP_RULES, jpNewsDecision, splitJpNews } from "../lib/jp-news.mjs";
import { scrubDoc } from "../scrub-jp-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Shared with catchem-site and catchem-bot: both run these same cases.
export const CASES = [
  // Dropped: Japan-only sets, products, promos, events, tournaments, JP-only sources.
  { keep: false, rule: "jp-source", row: { source: "Pokémon Card (Japan)", region: "jp", language: "ja", title: "Japan: Winner interview for \"Champions League 2027 Yokohama\"", url: "https://www.pokemon-card.com/info/009999.html" } },
  { keep: false, rule: "jp-source", row: { source: "Pokémon Card (Japan)", title: "拡張パック「30th CELEBRATION」の収録カード公開！", url: "https://www.30th.pokemon-card.com/product/m6a" } },
  { keep: false, rule: "jp-host", row: { source: "Somewhere", title: "Card list for Storm Emeralda", url: "https://www.pokemon-card.com/ex/storm/" } },
  { keep: false, rule: "japan-event", row: { source: "PokeGuardian", title: "New 6th MEGA Pokemon Card Gym Promo Cards Revealed, Features Mega Heatran ex", url: "https://www.pokeguardian.com/1_gym-promos" } },
  { keep: false, rule: "japan-event", row: { source: "PokeGuardian", title: "Mega Gallade ex SAR Get Battle Revealed, Win Limited Mega Gallade ex SAR Promo", url: "https://www.pokeguardian.com/2_get-battle" } },
  { keep: false, rule: "japan-event", row: { source: "Limitless", title: "Champions League Osaka", url: "https://limitlesstcg.com/tournaments/1" } },
  { keep: false, rule: "japan-word", row: { source: "Limitless", title: "Japan Championships 2026", url: "https://limitlesstcg.com/tournaments/2" } },
  { keep: false, rule: "japan-word", row: { source: "Siliconera", title: "McDonald’s Japan Reveals New Pokemon Happy Meal Toys", url: "https://www.siliconera.com/mcdonalds-japan/" } },
  { keep: false, rule: "japan-place", row: { source: "Limitless", title: "CL Aichi Open League", url: "https://limitlesstcg.com/tournaments/3" } },
  { keep: false, rule: "jp-region", row: { source: "PokeGuardian", region: "Japanese Sets", title: "MEGA Expansion Pack 30th CELEBRATION", url: "https://www.pokeguardian.com/3203041_x" } },
  { keep: false, rule: "japanese-text", row: { source: "Somewhere", title: "ポケカ 新弾の情報", url: "https://example.com/a" } },
  // Kept: English, NA, international or global, or no Japan angle at all.
  { keep: true, rule: "global", row: { source: "Pokémon Card (Japan)", region: "jp", title: "Japan: It has been decided that Pokémon Card Game 30th-anniversary products will go on sale worldwide", url: "https://www.pokemon-card.com/info/1.html" } },
  { keep: true, rule: "english", row: { source: "PokeBeach", title: "Japan's Mega Dream ex Coming to English as Ascended Heroes in January", url: "https://www.pokebeach.com/forums/threads/x.1/" } },
  { keep: true, rule: "north-america", row: { source: "PokeBeach", title: "Japanese Nihil Zero Reprint Confirmed for North America on March 6", url: "https://www.pokebeach.com/forums/threads/x.2/" } },
  { keep: true, rule: "na-url", row: { source: "Play! Pokémon", title: "Japanese Pokémon TCG Star Yoshiyuki Yamaguchi Shines Abroad", url: "https://www.pokemon.com/us/features/champions-spotlight-yoshiyuki-yamaguchi-shines-abroad" } },
  { keep: true, rule: "na-region", row: { source: "PokeGuardian", region: "US, CA", title: "Japanese-style Premium Collection hits stores", url: "https://www.pokeguardian.com/3_x" } },
  { keep: true, rule: "", row: { source: "Victory Road", title: "New Regional Championships have been confirmed in the United States!", url: "https://victoryroad.pro/2027-season-calendar/" } },
  { keep: true, rule: "", row: { source: "Pokémon press", title: "MEDIA ALERT: Pokémon Trading Card Game: 30th Celebration Expansion Launches Today, Commemorating 30 Years of Pokémon", url: "https://press.pokemon.com/en/releases/1" } },
  { keep: true, rule: "", row: { source: "Pokémon Card (Asia)", title: "Asia English expansion info", url: "https://asia.pokemon-card.com/sg/archives/1" } },
  { keep: true, rule: "", row: { source: "Siliconera", title: "New Pokemon Crocs Clogs Will Appear Worldwide", url: "https://www.siliconera.com/crocs/" } },
];

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => { console.log(`    ${ok ? "✓" : "✗"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail++; };
  for (const c of CASES) {
    const d = jpNewsDecision(c.row);
    t(`${c.keep ? "keeps" : "drops"}: ${c.row.title}`, d.keep === c.keep && d.rule === c.rule, JSON.stringify(d));
    if (!c.keep) t(`  reason is plain: ${d.reason}`, d.reason.length > 10 && !/[\u2013\u2014]/.test(d.reason));
  }
  t("an empty row is kept (no Japan signal)", jpNewsDecision({}).keep === true);
  t("every rule pattern compiles without the u flag", [...JP_RULES.jpRules, ...JP_RULES.keepRules].every((r) => new RegExp(r.pattern, r.flags || "") && !/u/.test(r.flags || "")));
  const split = splitJpNews(CASES.map((c) => c.row));
  t("split logs a reason for every drop", split.dropped.length === CASES.filter((c) => !c.keep).length && split.dropped.every((d) => d.reason && d.rule && d.url));
  const scrub = scrubDoc({ items: [CASES[0].row, CASES[16].row], filters: { news: { items: [CASES[0].row] } }, catalog: [CASES[0].row] });
  t("scrub leaves the catalog whole and clears public lists", scrub.doc.items.length === 1 && scrub.doc.filters.news.items.length === 0 && scrub.doc.catalog.length === 1 && scrub.dropped.length === 1);
  // The committed public digest has no Japan-only item.
  for (const rel of ["research/digests/news.json", "research/digests/weekly-news.json"]) {
    let doc = {};
    try { doc = JSON.parse(await readFile(join(ROOT, rel), "utf8")); } catch { continue; }
    const rows = [...(doc.items || []), ...((doc.filters && doc.filters.news && doc.filters.news.items) || [])];
    const bad = rows.filter((row) => !jpNewsDecision(row).keep);
    t(`${rel} public lists have no Japan-only item`, bad.length === 0, bad.slice(0, 3).map((r) => r.title).join(" | "));
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("jp-news.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
