import { newsItem, selectAddons, attachAddons } from "../lib/custom-reads-addons.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const allow = { sources: [{ name: "Pokémon press", allowed: true }, { name: "Blocked", allowed: false }] };
  const rows = [
    { title: "New set dated", sentence: "The set page names the day.", url: "https://press.pokemon.com/en/example", source: "Pokémon press", date: "2026-10-15" },
    { title: "Blocked item", sentence: "Do not keep this.", url: "https://example.test/no", source: "Blocked", date: "2026-10-15" },
    { title: "Body", sentence: "x".repeat(300), url: "https://press.pokemon.com/en/long", source: "Pokémon press", date: "2026-10-15" },
  ];
  const picked = selectAddons(rows, allow);
  t("an allowed item is headline, one line, and a link", picked.length === 1 && picked[0].headline === "New set dated" && picked[0].line === "The set page names the day." && picked[0].url.endsWith("/example"));
  t("a blocked source is skipped", picked.every((row) => row.source !== "Blocked"));
  t("a long body is not kept", picked.every((row) => row.line.length <= 220) && !picked.some((row) => row.headline === "Body"));
  const watched = selectAddons(rows, allow, ["set page"]);
  t("a watchlist keeps only the name match", watched.length === 1 && watched[0].headline === "New set dated");
  const missed = selectAddons(rows, allow, ["Charizard"]);
  t("a watchlist with no match is empty", missed.length === 0);
  const shared = selectAddons(rows, allow);
  const attached = attachAddons({ news: true, watch: ["set"] }, shared, []);
  t("a news add-on attaches the shared match only", attached.news && attached.news.length === 1 && attached.news[0].headline === "New set dated" && !attached.games);
  const open = attachAddons({ news: true }, shared, []);
  t("a news toggle uses the shared feed with no second allow list", open.news && open.news.length === 1);
  const all = attachAddons({ all: true }, shared, [{ headline: "Game day", line: "A game update.", url: "https://press.pokemon.com/en/game", source: "Pokémon press", date: "2026-10-15" }]);
  t("all in one attaches news and games", all.news && all.news.length === 1 && all.games && all.games.length === 1);
  const quiet = attachAddons({ id: "plain" }, rows, rows);
  t("an off add-on attaches nothing", !quiet.news && !quiet.games);
  t("a bad url is dropped", newsItem({ title: "X", sentence: "Y", url: "/relative", source: "Pokémon press" }) === null);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("custom-reads-addons.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("custom-reads add-ons ok");
}
