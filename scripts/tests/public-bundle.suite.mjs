import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED, changePct, headlineFor, money, rankReads } from "../lib/public-bundle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("money drops zero, blank, and NaN", money(0) === null && money(null) === null && money("nope") === null && money(12.5) === "$12.50");
  t("a cheap base or a wild move is not a percent", changePct(1.5, 3) === null && changePct(10, 20) === null && changePct(10, 12) === 20);
  const banned = headlineFor({ name: "Charizard", price: 12, changePct: 10, type: "heating" });
  t("a real headline has a name and a direction", banned.includes("heating up") && !BANNED.test(banned));
  const dropped = rankReads([
    { type: "mover", price: 10, headline: "This is a buy.", set: "A", score: 9 },
    { type: "mover", price: 10, headline: "Pikachu is up 4% since yesterday.", set: "A", score: 2 },
  ], 5);
  t("a banned headline never ranks", dropped.length === 1 && !BANNED.test(dropped[0].headline));
  const mixed = rankReads([
    { type: "heating", price: 10, headline: "A is heating up, up 10% since yesterday.", set: "S1", score: 3 },
    { type: "heating", price: 10, headline: "B is heating up, up 9% since yesterday.", set: "S1", score: 2 },
    { type: "cooling", price: 10, headline: "C is cooling off, down 8% since yesterday.", set: "S2", score: 3 },
  ], 3);
  t("the same type does not sit back to back when another type exists", mixed[0].type !== mixed[1].type);

  try {
    const counts = JSON.parse(await readFile(join(ROOT, "research/assets/public/counts.json"), "utf8"));
    const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
    t("counts add up and slabs stay at zero", counts.items === counts.single + counts.sealed && counts.slab === 0 && counts.single > 20000);
    t("the day has 15 to 30 reads", reads.reads.length >= 15 && reads.reads.length <= 30);
    const bad = reads.reads.filter((row) => !money(row.price) || !row.headline || BANNED.test(row.headline) || row.price === 0);
    t("every read has a price and a clean headline", bad.length === 0);
    const types = new Set(reads.reads.map((row) => row.type));
    t("reads mix kinds of story", types.has("heating") && types.has("chase") && types.has("box") && types.has("receipt"));
    const kinds = new Set(reads.reads.map((row) => row.kind));
    t("a read is one kind", [...kinds].every((k) => k === "single" || k === "sealed"));
  } catch (err) {
    t("public bundle is on disk", false);
    console.error(err);
  }
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("public-bundle.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
