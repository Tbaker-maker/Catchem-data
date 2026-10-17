import { readFileSync } from "node:fs";
import { buildFollowSlices, followsFromDocs, matchesFollow } from "../lib/custom-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const follow = { id: "sv", sets: ["scarlet"], cards: [], kinds: [] };
  t("a set on the follow matches", matchesFollow(follow, { set: "scarlet" }) === true);
  t("another set does not match", matchesFollow(follow, { set: "base" }) === false);
  const built = buildFollowSlices({
    day: "2026-10-17",
    follows: [follow, { id: "quiet-one", sets: ["jungle"], cards: [], kinds: [] }],
    reads: [{ id: "r1", set: "scarlet", cardId: "c1", kind: "single", line: "Abra is $1.50 on the catalog day." }],
  });
  t("a follow with reads is kept", built.slices.length === 1 && built.slices[0].followId === "sv" && built.slices[0].reads[0].id === "r1");
  t("a quiet day is skipped and not written as a slice", built.quiet.length === 1 && built.quiet[0] === "quiet-one" && built.slices.every((slice) => slice.followId !== "quiet-one"));
  const sharedNews = [{ headline: "New set dated", line: "The set page names the day.", url: "https://press.pokemon.com/en/example", source: "Pokémon press", date: "2026-10-15" }];
  const withNews = buildFollowSlices({
    day: "2026-10-17",
    follows: [{ id: "news-only", sets: [], cards: [], kinds: [], news: true, watch: ["set page"] }],
    reads: [],
    news: sharedNews,
  });
  t("a news toggle attaches the shared feed and is not quiet", withNews.slices.length === 1 && withNews.slices[0].news.length === 1 && withNews.quiet.length === 0);
  const off = buildFollowSlices({
    day: "2026-10-17",
    follows: [{ id: "off", sets: [], cards: [], kinds: [] }],
    reads: [],
    news: sharedNews,
  });
  t("news stays off when the follow did not toggle it", off.quiet[0] === "off" && off.slices.length === 0);
  t("member follows file wins", followsFromDocs({ follows: [{ id: "a" }] }, { follows: [] }).length === 1);
  t("missing member file uses the config list", followsFromDocs(null, { follows: [{ id: "b" }] })[0].id === "b");
  t("both missing is an empty list", followsFromDocs(null, null).length === 0);
  const buildSrc = readFileSync(new URL("../build-custom-reads.mjs", import.meta.url), "utf8");
  t("nightly reads the member follows file first", buildSrc.includes("data/custom-reads/follows.json") && buildSrc.includes("followsFromDocs"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("custom-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
