// After a scheduled job: check today's price day, listings counted, reads, and
// the scanner file. Rerun a missing light step once. Write data/derived/status.json.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dayOf, freshnessReport, priceDayStale } from "./lib/ops-bots.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "data/derived/status.json";

function runNode(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(ROOT, script)], { cwd: ROOT, stdio: "inherit" });
    child.on("close", (code) => resolve(code === 0));
  });
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

async function newestDay(dir) {
  const names = (await readdir(dir).catch(() => [])).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  return names.length ? names[names.length - 1].slice(0, 10) : "";
}

const catalog = await readJson(join(ROOT, "data/catalog/tcgcsv-latest.json"));
const counts = await readJson(join(ROOT, "data/derived/listing-counts/latest.json"));
const reads = await readJson(join(ROOT, "research/assets/public/reads.json"));
const scanner = await readJson(join(ROOT, "data/private/scanner/summary.json"));
const priceDay = (await newestDay(join(ROOT, "data/history/tcgcsv-daily"))) || dayOf(catalog?.asOf);
const today = dayOf(catalog?.asOf) || priceDay;
let report = freshnessReport({
  today,
  priceDay,
  countsDay: counts?.asOf,
  readsDay: reads?.asOf,
  scannerDay: scanner?.asOf,
});
const reran = [];
const allow = new Set((process.env.FRESHNESS_RERUN || "").split(",").map((s) => s.trim()).filter(Boolean));
const commands = {
  "price-day": "scripts/fetch-tcgcsv-catalog.mjs",
  "listings-counted": "scripts/fetch-listing-counts.mjs",
};
let seenPriceDay = priceDay;
if (process.argv.includes("--rerun")) {
  for (const id of report.failures) {
    if (!commands[id] || (allow.size && !allow.has(id))) continue;
    const ok = await runNode(commands[id]);
    reran.push({ id, ok });
  }
  if (reran.length) {
    const counts2 = await readJson(join(ROOT, "data/derived/listing-counts/latest.json"));
    const priceDay2 = (await newestDay(join(ROOT, "data/history/tcgcsv-daily"))) || priceDay;
    seenPriceDay = priceDay2;
    report = freshnessReport({ today, priceDay: priceDay2, countsDay: counts2?.asOf, readsDay: reads?.asOf, scannerDay: scanner?.asOf });
  }
}
const calendar = new Date().toISOString().slice(0, 10);
const stale = priceDayStale(seenPriceDay, calendar);
const doc = {
  asOf: report.asOf,
  generatedAt: new Date().toISOString(),
  checks: report.checks,
  failures: report.failures,
  alerts: stale ? [stale] : [],
  reran,
  note: report.failures.includes("reads") ? "Reads rebuild is not rerun here. It belongs to the nightly feed, which has to fit the 20 minute test job." : "Checked the dated files. A missing light step can be rerun once with --rerun.",
};
await mkdir(join(ROOT, "data/derived"), { recursive: true });
await writeFile(join(ROOT, OUT), JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify({ status: { asOf: doc.asOf, failures: doc.failures, reran: doc.reran.length, path: OUT } }));
if (report.failures.length && process.argv.includes("--strict")) process.exit(1);
