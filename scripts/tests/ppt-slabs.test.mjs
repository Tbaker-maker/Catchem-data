import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mediansFromEbaySold, qualifyingCount, slabCandidates, slabStatus } from "../lib/ppt-slabs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

const row = (id, vol, extra = {}) => ({
  cardId: id,
  name: id,
  number: "1",
  tcgPlayerId: "9",
  raw: { vol30: vol, market: 50 },
  ...extra,
});

export async function runSlabTests() {
  fail = 0;
  const picked = slabCandidates([row("b", 1), row("a", 5), row("c", 5), { cardId: "d", name: "D", raw: {} }], 2);
  t("higher sales come first and a tie breaks by id", picked.map((item) => item.id).join(",") === "a,c");
  t("a card with no sales count is left out", picked.length === 2);
  t("the candidate does not carry the raw market price", !("market" in picked[0]) && picked[0].vol30 === 5);

  const thin = qualifyingCount({ a: [{ date: "2026-09-01" }, { date: "2026-09-02" }] });
  t("two days do not qualify", thin.qualifying === 0 && thin.index === "not built");
  const days = Array.from({ length: 30 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}` }));
  const ready = qualifyingCount(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`c${i}`, days])));
  t("30 slabs with 30 days would be ready", ready.qualifying === 30 && ready.index === "ready");

  const medians = mediansFromEbaySold({
    psa10: { median: 12, count: 4, min: 1, max: 99 },
    note: { median: 3, count: 1 },
  });
  t("only a graded median is kept", medians.length === 1 && medians[0].grade === "PSA10" && medians[0].n === 4 && !("min" in medians[0]));

  const status = slabStatus({ asOf: "2026-09-26", candidates: picked, historyByCard: {}, creditsUsed: 0 });
  t("short of 300 is stated", status.shortfall === 298 && status.qualifying === 0 && status.creditsUsed === 0);

  const file = JSON.parse(await readFile(join(ROOT, "data/history/slabs/status.json"), "utf8"));
  t("the status file qualified nobody", file.qualifying === 0 && file.index === "not built" && file.creditsUsed === 0 && file.mediansWritten === 0);
  t("the status file is not a singles index", file.separateFromSingles === true && !JSON.stringify(file).includes("\"market\""));

  console.log(fail ? `${fail} failed` : "slabs ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runSlabTests();
  if (n) process.exit(1);
}
