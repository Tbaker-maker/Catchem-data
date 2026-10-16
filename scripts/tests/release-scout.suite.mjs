import { parseRelease, scoutReleases, toIsoDate } from "../lib/release-scout.mjs";

const FIXTURE = {
  title: "The Ascended Heroes expansion arrives for the Pokemon Trading Card Game",
  sentence: "The Ascended Heroes expansion launches on March 20, 2027. Rotation follows on April 10, 2027.",
  url: "https://press.pokemon.com/en/releases/ascended-heroes",
  date: "2026-10-15",
  source: "Pokémon press",
};

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  t("a written month becomes a dated day", toIsoDate("March 20, 2027") === "2027-03-20");
  const stub = parseRelease(FIXTURE);
  t("one press item becomes a set stub with both dates and a day-one flag", stub && stub.kind === "set" && stub.name === "Ascended Heroes" && stub.releaseDate === "2027-03-20" && stub.rotationDate === "2027-04-10" && stub.dayOne === true && stub.sourceDate === "2026-10-15");
  const known = scoutReleases({ items: [FIXTURE], knownSets: [{ name: "Ascended Heroes" }], asOf: "2026-10-15" });
  t("a set we already have is not added again", known.stubs.length === 0);
  const fan = scoutReleases({ items: [{ ...FIXTURE, source: "Victory Road", url: "https://victoryroad.pro/x" }], asOf: "2026-10-15" });
  t("a non-press source is left out", fan.stubs.length === 0);
  const quiet = scoutReleases({ items: [], asOf: "2026-10-15" });
  t("an empty digest hides the stub list content", quiet.stubs.length === 0 && !JSON.stringify(quiet).includes("No data"));
  const product = parseRelease({
    title: "A new Elite Trainer Box is dated",
    sentence: "The Elite Trainer Box arrives on May 1, 2027.",
    url: "https://press.pokemon.com/en/releases/etb",
    date: "2026-10-15",
    source: "Pokémon press",
  });
  t("a product line becomes a product stub", product && product.kind === "product" && product.releaseDate === "2027-05-01" && product.dayOne === true);
  t("a line with no date is not a stub", parseRelease({ ...FIXTURE, sentence: "More news later." }) === null);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("release-scout.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("release scout ok");
}
