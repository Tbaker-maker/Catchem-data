import { dedupeNews, storyKey } from "../lib/news-dedupe.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const tierOf = (name) => ({ "Pokémon press": "Official", PokeBeach: "Confirmed", Blog: "Unconfirmed" }[name] || "Unconfirmed");
  t("the same headline matches with different punctuation", storyKey({ title: "New set: Delta!" }) === storyKey({ title: "new set delta" }));
  const rows = dedupeNews([
    { title: "Delta Reign dated", url: "https://blog.example/a", date: "2026-10-01", source: "Blog" },
    { title: "Delta Reign dated!", url: "https://www.pokebeach.com/a", date: "2026-10-02", source: "PokeBeach" },
    { title: "Press note", url: "https://press.pokemon.com/en/b", date: "2026-10-03", source: "Pokémon press" },
    { title: "Lone rumor", url: "https://blog.example/c", date: "2026-10-04", source: "Blog" },
  ], tierOf);
  t("two reports of one headline become one row", rows.length === 3);
  const delta = rows.find((row) => row.title.startsWith("Delta") || row.sources.includes("PokeBeach"));
  t("two sources make the row Confirmed and keep the higher tier url", delta.label === "Confirmed" && delta.url.includes("pokebeach") && delta.sources.length === 2);
  t("an official source is labeled Official", rows.find((row) => row.source === "Pokémon press").label === "Official");
  t("one unofficial source stays Unconfirmed", rows.find((row) => row.title === "Lone rumor").label === "Unconfirmed");
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("news-dedupe.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
