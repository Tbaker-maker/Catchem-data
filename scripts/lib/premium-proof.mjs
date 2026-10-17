// Small public counts for /premium. Names only, no method, no headline.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { addDays } from "./track-record.mjs";

const SKIP = new Set(["news", "newsline", "wave"]);

export async function buildPremiumProof(root, today = "") {
  const reads = JSON.parse(await readFile(join(root, "research/assets/public/reads.json"), "utf8"));
  const asOf = String(today || reads.asOf || "").slice(0, 10);
  const d30 = asOf ? addDays(asOf, -30) : "";
  const d7 = asOf ? addDays(asOf, -7) : "";
  const list = Array.isArray(reads.reads) ? reads.reads : [];
  const in30 = list.filter((row) => row && String(row.asOf || "") >= d30 && String(row.asOf || "") <= asOf);
  const week = [];
  for (const row of in30) {
    const kind = String(row.readKind || row.kind || "");
    if (SKIP.has(kind)) continue;
    const name = String(row.name || "").trim();
    if (!name || week.some((item) => item.name === name)) continue;
    week.push({ name, asOf: String(row.asOf || "").slice(0, 10), kind: row.kind === "sealed" ? "sealed" : "single" });
    if (week.length >= 3) break;
  }
  return {
    asOf,
    reads30: in30.length,
    source: "Catch'em reads file",
    week,
  };
}
