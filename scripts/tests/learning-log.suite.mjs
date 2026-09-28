import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { appendLearningLog, callsFromBundle, readCallLog } from "../lib/learning-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGINAL = "11b6d67d12a52a7b5294626f7638f6c6683b9457ac5b20754bba5e62d6018e8f";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  const day = { asOf: "2026-09-27", updatedAt: "2026-09-27T10:19:31.933Z" };
  const section6 = [
    ["Primarina is heating up, up 47.1% since yesterday.", "heating", "single", "TCGplayer market", 3, 47.1, 2, "tcgcsv-1001", "heat_1d", "daily", "up", "singles", false, "spike"],
    ["Weavile is cooling off, down 33.4% since yesterday.", "cooling", "single", "TCGplayer market", 29.99, -33.4, 2, "tcgcsv-1002", "cool_1d", "daily", "down", "singles", false, "spike"],
    ["30th Celebration Booster Bundle is down 7.5% since yesterday.", "mover", "sealed", "TCGplayer market", 113.79, -7.5, 4, "tcgcsv-1003", "mover_down_1d", "daily", "down", "sealed", true, null],
    ["Top card in SM Team Up: Latias & Latios GX.", "chase", "single", "TCGplayer market", 3913.85, -13, 2, "tcgcsv-1004", "chase_top", "cook", "none", "singles", false, "no_direction"],
    ["Evolutions Booster Box works out to $20 a pack.", "box", "sealed", "eBay ask", 3474.26, 0, 2, "tcgcsv-1005", "box_packout_ask", "cook", "none", "sealed", false, "ask"],
    ["Celebrations UPC, checked again. No direction was promised.", "receipt", "sealed", "eBay ask", 1319.99, -1.4, 3, "tcgcsv-1006", "watch_revisit", "watch", "none", "sealed", false, "ask"],
    ["Pikachu is heating up, up 45.1% since yesterday.", "heating", "single", "TCGplayer market", 119.95, 45.1, 2, "tcgcsv-1007", "heat_1d", "daily", "up", "singles", false, "spike"],
    ["Enriching Energy is cooling off, down 32.7% since yesterday.", "cooling", "single", "TCGplayer market", 3.7, -32.7, 2, "tcgcsv-1008", "cool_1d", "daily", "down", "singles", false, "spike"],
    ["Deluxe Battle Deck is up 6.8% since yesterday.", "mover", "sealed", "TCGplayer market", 32.87, 6.8, 4, "tcgcsv-1009", "mover_up_1d", "daily", "up", "sealed", true, null],
    ["Top card in EX Unseen Forces: Raikou Star.", "chase", "single", "TCGplayer market", 1600, 0, 2, "tcgcsv-1010", "chase_top", "cook", "none", "singles", false, "no_direction"],
    ["Black Bolt Booster Bundle works out to $4 a pack.", "box", "sealed", "eBay ask", 100, 0, 2, "tcgcsv-1011", "box_packout_ask", "cook", "none", "sealed", false, "ask"],
    ["Umbreon VMAX, checked again. No direction was promised.", "receipt", "single", "TCGplayer market", 2283.14, 0, 6, "tcgcsv-1012", "watch_revisit", "watch", "none", "singles", false, "no_direction"],
  ];
  const fixtureReads = section6.map((row, i) => ({
    headline: row[0],
    type: row[1],
    kind: row[2],
    source: row[3],
    price: row[4],
    changePct: row[5],
    hist: Array.from({ length: row[6] }, (_, n) => [`2026-09-${String(20 + n).padStart(2, "0")}`, row[4]]),
    id: `${row[1]}-${row[7]}`,
    href: `/${row[2] === "sealed" ? "p" : "c"}/${row[7]}`,
    asOf: "2026-09-27",
    confidence: "Early",
    n: i + 1,
  }));
  const logged = callsFromBundle({ ...day, reads: fixtureReads });
  t("section 6 twelve reproduce from the log rules", logged.length === 12 && section6.every((row, i) => {
    const got = logged[i];
    return got.pattern === row[8] && got.read_type === row[9] && got.direction === row[10] && got.kind === row[11] && got.gradeable === row[12] && got.exclude_reason === row[13] && got.sku_id === row[7] && got.price_source === (row[3] === "eBay ask" ? "ebay_ask" : "tcgplayer_market") && got.copied === false;
  }));
  t("ask is never gradeable", logged.filter((row) => row.price_source === "ebay_ask").every((row) => row.gradeable === false && row.exclude_reason === "ask"));
  t("a copied claim is not gradeable", callsFromBundle({ ...day, reads: [fixtureReads[2]] }, [logged[2]]).every((row) => row.copied === true && row.gradeable === false && row.exclude_reason === "copied"));

  const dir = await mkdtemp(join(tmpdir(), "learn-"));
  const file = join(dir, "calls.jsonl");
  const first = await appendLearningLog(file, { ...day, reads: fixtureReads });
  const second = await appendLearningLog(file, { ...day, reads: fixtureReads });
  const back = await readCallLog(file);
  t("append writes twelve and does not duplicate", first.added === 12 && second.added === 0 && second.skipped.length === 12 && back.length === 12);
  t("the log has no member key", !JSON.stringify(back).includes("member"));

  const raw = await readFile(join(ROOT, "data/learning/calls.jsonl"), "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const first24 = lines.slice(0, 24).join("\n") + "\n";
  const hash = createHash("sha256").update(first24).digest("hex");
  t("the first 24 rows are unchanged", hash === ORIGINAL && !first24.includes("exclude_reason"));
  const snap = JSON.parse(await readFile(join(ROOT, "data/learning/snapshots/2026-09-27.json"), "utf8"));
  t("the snapshot is the original 24", snap.length === 24 && snap.every((row, i) => row.call_id === JSON.parse(lines[i]).call_id) && snap.every((row) => !("exclude_reason" in row)));
  const shipped = lines.map((line) => JSON.parse(line));
  const added = shipped.slice(24);
  t("new rows are appended only", added.length === 11 && shipped.length === 35);
  t("every new sku starts with tcgcsv-", added.every((row) => String(row.sku_id).startsWith("tcgcsv-") && "exclude_reason" in row));
  t("Evolving Skies was skipped, not rewritten", shipped.filter((row) => row.call_id === "2026-09-27_tcgcsv-242436_mover_down_1d").length === 1 && JSON.parse(lines[17]).claim.includes("down 1.4%"));
  const publicReads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
  t("public reads are not the call log", !JSON.stringify(publicReads).includes("call_id") && !JSON.stringify(publicReads).includes("exclude_reason"));
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("learning-log.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("learning log ok");
}
