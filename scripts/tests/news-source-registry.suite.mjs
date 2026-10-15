import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyRegistry, reviewSource, robotsDecision, termsDecision, TIERS } from "../lib/news-source-registry.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const robots = "User-agent: *\nDisallow: /secret\nAllow: /news\n";
  t("a disallowed path is refused", robotsDecision(robots, "/secret").allowed === false);
  t("an allowed path is kept", robotsDecision(robots, "/news").allowed === true);
  t("missing robots text is not treated as a pass", robotsDecision("", "/").checked === false);
  t("terms that forbid automated reading are refused", termsDecision("You must not scrape this site.").allowed === false);
  t("terms with no such line are not a reason to drop", termsDecision("Copyright 2026.").allowed === true);

  const blocked = reviewSource(
    { id: "example", name: "Example", tier: "Confirmed" },
    { robotsText: "User-agent: *\nDisallow: /\n", termsText: "Fine.", path: "/feed", checkedAt: "2026-10-17" },
  );
  t("a disallow drops the source and keeps the tier", blocked.dropped === true && blocked.tier === "Confirmed" && blocked.dropReason === "disallow matches");
  const open = reviewSource({ id: "press", name: "Pokémon press", tier: "Official" }, { checkedAt: "2026-10-17" });
  t("an unchecked source is not dropped", open.dropped === false && open.tier === "Official");
  const odd = reviewSource({ id: "x", name: "X", tier: "friend" }, {});
  t("an unknown tier becomes Unconfirmed", odd.tier === "Unconfirmed");

  const items = [
    { title: "A", source: "Example", url: "https://example.com/a" },
    { title: "B", source: "Pokémon press", url: "https://press.pokemon.com/en/b" },
  ];
  const applied = applyRegistry(items, [blocked, open]);
  t("dropped sources leave the list and the rest stay", applied.removed.length === 1 && applied.kept.length === 1 && applied.kept[0].source === "Pokémon press");

  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const registry = JSON.parse(await readFile(join(root, "config/news-source-registry.json"), "utf8"));
  t("the registry only uses the three trust tiers", (registry.sources || []).every((row) => TIERS.includes(row.tier)) && registry.sources.length >= 10);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("news-source-registry.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
