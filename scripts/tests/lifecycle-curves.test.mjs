// Run: node scripts/tests/lifecycle-curves.test.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLifecycle } from "../build-lifecycle-curves.mjs";
import {
  joinSeries, weekIndex, weeklyPoints, median, round4, vsRetail, banned, isFilled, FILLED_BEFORE,
} from "../lib/lifecycle-curves.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let failed = 0;
function t(name, cond) {
  if (cond) console.log(`  ok ${name}`);
  else { failed += 1; console.error(`  FAIL ${name}`); }
}

t("missing retail ratio is null", vsRetail(10, null) === null && vsRetail(10, 0) === null);
t("filled before Sep 25", isFilled("2026-09-24", "tcgcsv-daily") === true && isFilled("2026-09-25", "tcgcsv-daily") === false);
t("archive stays filled", isFilled("2026-10-01", "archived-market") === true);
t("cutoff date is the archive line", FILLED_BEFORE === "2026-09-25");

const joined = joinSeries(
  [{ date: "2026-10-01", price: 12 }],
  [["2026-09-01", 10], ["2026-10-01", 99], ["2026-10-02", 15]],
);
t("shared day keeps our print", joined.find((p) => p.date === "2026-10-01").price === 12 && joined.find((p) => p.date === "2026-10-01").source === "tcgcsv-daily");
t("archive after our first day is left out", !joined.some((p) => p.date === "2026-10-02"));
t("earlier archive day is kept", joined.some((p) => p.date === "2026-09-01" && p.source === "archived-market"));
t("week index", weekIndex("2021-08-27", "2021-08-27") === 0 && weekIndex("2021-08-27", "2021-08-26") === -1);
t("median of two", median([1, 3]) === 2 && round4(median([1, 2, 10])) === 2);

const weeks = weeklyPoints("2021-08-27", joined);
t("one price per week", weeks.length === new Set(weeks.map((w) => w.week)).size);

const { doc } = buildLifecycle(ROOT);
t("flag off", doc.LIFECYCLE === "off" && doc.enabled === false && doc.flag === "LIFECYCLE");
t("no banned words", !banned(JSON.stringify(doc)));
t("sealed rows have no condition", doc.products.every((p) => !("condition" in p) && p.points.every((pt) => !("condition" in pt))));
t("missing retail is null", doc.counts.withRetail === 0 && doc.products.every((p) => p.retail.n === null && p.vsRetail.n === null));
t("a missing price is null not zero", doc.products.some((p) => p.latest.n === null) && doc.products.every((p) => p.latest.n !== 0 || p.latest.receipt.source));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Independent read of the raw files. Not the builder's join.
function rawFor(ids) {
  const want = new Set(ids.map(String));
  const own = new Map();
  const dir = join(ROOT, "data/history/tcgcsv-daily");
  for (const name of readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()) {
    const day = readJson(join(dir, name));
    const date = day.date || name.slice(0, 10);
    for (const row of day.prices || []) {
      const id = String(row.id);
      if (!want.has(id) || !(row.market > 0)) continue;
      const list = own.get(id) || [];
      list.push({ date, price: Number(row.market), source: "tcgcsv-daily" });
      own.set(id, list);
    }
  }
  const archDoc = readJson(join(ROOT, "data/backfill/pokeviz/raw.json"));
  const archive = new Map();
  for (const item of archDoc.items || []) {
    const id = String(item.pid);
    if (want.has(id)) archive.set(id, item.points || []);
  }
  const out = new Map();
  for (const id of want) {
    const mine = (own.get(id) || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const by = new Map();
    for (const p of mine) by.set(p.date, p);
    const first = mine[0]?.date || null;
    for (const row of archive.get(id) || []) {
      const date = row[0];
      const price = Number(row[1]);
      if (!date || !(price > 0) || by.has(date)) continue;
      if (first && date >= first) continue;
      by.set(date, { date, price, source: "archived-market" });
    }
    out.set(id, [...by.values()].sort((a, b) => (a.date < b.date ? -1 : 1)));
  }
  return out;
}

const sealed = readJson(join(ROOT, "data/sealed-prices.json"));
const byId = new Map(doc.products.map((p) => [p.id, p]));
const candidates = sealed.products.filter((p) => p.tcgPlayerId && byId.get(p.id)?.points?.length);
function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rnd(20261025);
const picks = [];
const used = new Set();
while (picks.length < 20 && used.size < candidates.length) {
  const product = candidates[Math.floor(rand() * candidates.length)];
  const row = byId.get(product.id);
  const pt = row.points[Math.floor(rand() * row.points.length)];
  const key = `${product.id}:${pt.week}`;
  if (used.has(key)) continue;
  used.add(key);
  picks.push({ product, row, pt });
}

console.log("HAND");
let mismatches = 0;
const raw = rawFor(picks.map((p) => p.product.tcgPlayerId));
for (const { product, row, pt } of picks) {
  const series = raw.get(String(product.tcgPlayerId)) || [];
  const release = row.release;
  let expected = null;
  let expectedDate = null;
  let expectedSource = null;
  for (const p of series) {
    const week = weekIndex(release, p.date);
    if (week !== pt.week) continue;
    if (!expectedDate || p.date > expectedDate) {
      expected = p.price;
      expectedDate = p.date;
      expectedSource = p.source === "archived-market" ? "Archived TCGplayer market prices" : "TCGplayer market";
    }
  }
  const ok = pt.price.n === expected && pt.date === expectedDate && pt.price.receipt.source === expectedSource && pt.price.receipt.date === expectedDate && (pt.price.n == null || pt.price.receipt.method);
  if (!ok) mismatches += 1;
  console.log(`${product.id}\tweek ${pt.week}\t${expectedDate}\t${expected}\t${pt.price.n}\t${ok ? "match" : "MISS"}`);
  t(`hand ${product.id} week ${pt.week}`, ok);
}

const era = doc.eras.find((e) => e.weeks.length > 4);
if (era) {
  const week = era.weeks[Math.floor(era.weeks.length / 2)];
  const prices = doc.products
    .filter((p) => p.era === era.era && p.subtype === era.subtype)
    .map((p) => p.points.find((pt) => pt.week === week.week)?.price.n)
    .filter((n) => n != null);
  const again = round4(median(prices));
  t(`era median ${era.era} ${era.subtype} week ${week.week}`, again === week.median.n && week.count.n === prices.length);
}

t("hand check mismatches", mismatches === 0);
if (!existsSync(join(ROOT, "research/assets/public/sealed-era-paths.json"))) t("output written", false);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("lifecycle curves tests passed");
