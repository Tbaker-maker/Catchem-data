// Guard: PkmnPrices (PPP) raw responses stay private (catchem-data-private ppp/).
// The public repo carries only the deliberate derived fields in
// research/assets/public/market-depth/: sold median/count/quartiles, graded medians,
// sold comps per day, population counts and the Cardmarket EUR price, each with a date.
// No comp titles, listing urls, comp ids, seller countries or raw rows.
import { readFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ITEM_KEYS, PUBLIC_SOLD_KEYS, PUBLIC_GRADED_KEYS, PUBLIC_POP_KEYS, PUBLIC_EUR_KEYS, soldStats, keepComps, dailySold, popSummary, offItem, deriveItem, gradedStats, readCompBand, marketOnDate } from "../lib/ppp-derive.mjs";
import { checkBudget, loadBudget } from "../lib/ppp-budget.mjs";
import { priorityOrder } from "../ppp-enrich.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond, detail = "") => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name, detail); } };

const RAW_KEYS = /^(title|listing_url|url|seller_country|ingested_at|updated_at|sale_type|attribution|image_url|cardmarket_url|pop_report_url|spec_id|description|rows|data|body)$/;
const TOP_KEYS = new Set(["asOf", "source", "popSource", "eurSource", "items"]);

export function badMarketDepthDoc(doc) {
  const bad = [];
  for (const k of Object.keys(doc || {})) if (!TOP_KEYS.has(k)) bad.push(`top key ${k}`);
  for (const [id, item] of Object.entries(doc?.items || {})) {
    if (!/^tcgcsv-\d+$/.test(id)) bad.push(`id ${id}`);
    for (const [k, v] of Object.entries(item || {})) {
      if (!PUBLIC_ITEM_KEYS.has(k)) { bad.push(`${id} key ${k}`); continue; }
      if (k === "sold") for (const s of Object.keys(v)) if (!PUBLIC_SOLD_KEYS.has(s)) bad.push(`${id} sold.${s}`);
      if (k === "graded") for (const g of v) for (const s of Object.keys(g)) if (!PUBLIC_GRADED_KEYS.has(s)) bad.push(`${id} graded.${s}`);
      if (k === "pop") for (const s of Object.keys(v)) if (!PUBLIC_POP_KEYS.has(s)) bad.push(`${id} pop.${s}`);
      if (k === "eur") for (const s of Object.keys(v)) if (!PUBLIC_EUR_KEYS.has(s)) bad.push(`${id} eur.${s}`);
      if (k === "daily" && !(Array.isArray(v) && v.every((p) => Array.isArray(p) && p.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && Number.isInteger(p[1])))) bad.push(`${id} daily shape`);
      if (k === "sold" && !(v.n >= 5 && v.median > 0)) bad.push(`${id} thin sold`);
    }
    const walk = (v, d) => { if (!v || typeof v !== "object" || d > 6) return; for (const [k, x] of Object.entries(v)) { if (RAW_KEYS.test(k)) bad.push(`${id} raw ${k}`); walk(x, d + 1); } };
    walk(item, 0);
    if (/ebay\.com\/itm|https?:\/\//i.test(JSON.stringify(item))) bad.push(`${id} url`);
  }
  return bad;
}

export async function runNoPppRawPublicTests() {
  fail = 0;
  // unit: derivation rules
  const asOf = "2026-11-12";
  const row = (price, day = "2026-11-10", extra = {}) => ({ price, currency: "USD", sold_at: day, attribution: "exact", title: "Charizard ex 223/197", grader: null, ...extra });
  const wide = { low: 0.01, high: 100, lowGradeMax: 6, lowGradeHigh: 2 };
  const band = { low: 0.5, high: 2, lowGradeMax: 6, lowGradeHigh: 2 };
  t("fewer than 5 comps is hidden", soldStats([row(10), row(11), row(12), row(13)], { asOf, band: wide, marketOn: () => 12 }) === null);
  const s = soldStats([row(10), row(11), row(12), row(13), row(14), row(2), row(90)], { asOf, band: wide, marketOn: () => 12 });
  t("half-price filter drops 2 and 90", s && s.n === 5 && s.median === 12 && s.dropped === 2, JSON.stringify(s));
  t("graded titles are not raw comps", offItem("PSA 10 Charizard ex", "Charizard ex"));
  t("a Booster Bundle may say bundle", !offItem("Surging Sparks Booster Bundle sealed", "Surging Sparks Booster Bundle"));
  t("a single promo is not an ETB comp", offItem("PSA 10 Charizard V Champion's Path Elite Trainer Box Promo", "Champion's Path Elite Trainer Box"));
  const gate = { asOf, band, marketOn: () => 10 };
  t("shared attribution is not this card", keepComps([row(10, "2026-11-10", { attribution: "shared" })], gate).kept.length === 0);
  t("EUR rows are not in the USD median", keepComps([row(10, "2026-11-10", { currency: "EUR" })], gate).kept.length === 0);
  t("comps outside 90 days are out", keepComps([row(10, "2026-07-01")], gate).kept.length === 0);
  t("a sold median with no comp in 45 days is hidden", soldStats([1, 2, 3, 4, 5].map(() => row(10, "2026-09-01")), { asOf, band: wide, marketOn: () => 10 }) === null);
  t("dated market band drops a comp under half the market that day", keepComps([row(9), row(40), row(41), row(42)], { asOf, band, marketOn: () => 40 }).kept.length === 3);
  t("a comp over double the dated market is dropped even inside 4x", keepComps([row(100), row(40), row(41), row(42), row(43)], { asOf, band, marketOn: () => 40 }).kept.length === 4);
  t("no band withholds every raw comp", keepComps([row(40)], { asOf, marketOn: () => 40 }).closed === true && soldStats([row(40), row(41), row(42), row(43), row(44)], { asOf, marketOn: () => 40 }) === null);
  t("no dated market drops the comp", keepComps([row(40), row(41), row(42), row(43), row(44)], { asOf, band, marketOn: () => null }).kept.length === 0);
  t("fewer than 5 comps after the band is hidden", soldStats([row(40), row(41), row(42), row(90), row(91)], { asOf, band, marketOn: () => 40 }) === null);
  t("a missing band config is not a band", readCompBand(null) === null && readCompBand({ rawVsDatedMarket: { low: 2, high: 1 }, lowGradeMax: 6, lowGradeVsRawMarket: 2 }) === null);
  t("market on a gap day is the latest earlier day", marketOnDate([{ date: "2026-09-26", market: 1333.56 }, { date: "2026-10-21", market: 1300.35 }], "2026-09-28") === 1333.56);
  t("a sale before any market has none", marketOnDate([{ date: "2026-09-26", market: 1333.56 }], "2026-08-28") === null);
  const gradedRow = (price, grade) => ({ price, currency: "USD", sold_at: "2026-11-10", attribution: "exact", title: "x", grader: "PSA", grade });
  t("a low grade far above the raw market is held", gradedStats([gradedRow(5100, "1"), gradedRow(5300, "1"), gradedRow(4850, "1")], { asOf, band, marketOn: () => 1300.35 }).length === 0);
  t("a high grade above the raw market is kept", gradedStats([gradedRow(5000, "10"), gradedRow(5100, "10"), gradedRow(4900, "10")], { asOf, band, marketOn: () => 1300 }).length === 1);
  t("no band holds every graded median", gradedStats([gradedRow(100, "10"), gradedRow(110, "10"), gradedRow(120, "10")], { asOf, marketOn: () => 100 }).length === 0);
  t("one day of volume is hidden", dailySold([{ date: "2026-11-10", sales: 9 }], { asOf }) === null);
  t("volume sums raw and graded per day", JSON.stringify(dailySold([{ date: "2026-11-10", sales: 2 }, { date: "2026-11-10", sales: 1 }, { date: "2026-11-11", sales: 3 }], { asOf: "2026-11-14" })) === JSON.stringify([["2026-11-10", 3], ["2026-11-11", 3]]));
  t("the newest 3 days are left out (comps arrive late)", dailySold([{ date: "2026-11-08", sales: 3 }, { date: "2026-11-09", sales: 3 }, { date: "2026-11-11", sales: 3 }], { asOf }).length === 2);
  t("no graded copies means no pop", popSummary({ variants: [] }) === null);
  t("pop keeps counts, not urls", !JSON.stringify(popSummary({ variants: [{ variant: "Holofoil", total_population: 3, total_gems: 1, updated_at: "2026-11-01T21:00:00+00:00", graders: { PSA: { total: 3, gems: 1, grades: { "10": 1 }, pop_report_url: "https://x" } } }] })).includes("http"));
  const pop = popSummary({ variants: [{ variant: "Holofoil", total_population: 414, total_gems: 1, gem_rate: 1, updated_at: "2026-11-01T00:00:00Z", graders: { PSA: { total: 200, gems: 1, grades: { "10": 1 } }, BGS: { total: 119, gems: 0, grades: {} } } }] });
  t("pop label is the total across graders with its date", pop && pop.total === 319 && pop.label === "319 graded across PSA and BGS, as of 2026-11-01", JSON.stringify(pop));
  t("a raw comp row is caught", badMarketDepthDoc({ asOf, items: { "tcgcsv-1": { sold: { n: 5, median: 1, title: "x" } } } }).length > 0);
  t("a listing url is caught", badMarketDepthDoc({ asOf, items: { "tcgcsv-1": { graded: [{ label: "https://www.ebay.com/itm/1", n: 3, median: 1, last: asOf }] } } }).length > 0);
  t("a clean doc passes", badMarketDepthDoc({ asOf, source: "x", items: { "tcgcsv-1": { sold: { n: 5, median: 1, p25: 1, p75: 1, first: asOf, last: asOf, dropped: 0, days: 90, currency: "USD", truncated: false }, daily: [[asOf, 2]] } } }).length === 0);
  t("a Cardmarket price 5x our market is hidden", !deriveItem({ detail: { body: { prices: [{ source: "cardmarket", currency: "EUR", market_price: 17500, created_at: "2026-11-11T00:00:00Z" }] } } }, { asOf, kind: "sealed", name: "x", market: 3265.81 }));
  t("a Cardmarket price near our market is kept", deriveItem({ detail: { body: { prices: [{ source: "cardmarket", currency: "EUR", market_price: 310, created_at: "2026-11-11T00:00:00Z" }] } } }, { asOf, kind: "sealed", name: "x", market: 463.02 })?.eur?.market === 310);
  t("sealed come first in priority", priorityOrder([{ pid: 1, kind: "single", market: 900 }, { pid: 2, kind: "sealed", market: 5 }])[0].pid === 2);
  t("PPP lanes fit the daily plan", checkBudget(loadBudget()).length === 0, checkBudget(loadBudget()).join("; "));

  // repo: raw never tracked, only derived files public
  let tracked = [];
  try { tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean); } catch {}
  const rawTracked = tracked.filter((f) => f.startsWith("ppp-raw-private/") || /(^|\/)ppp-raw/.test(f));
  t("no raw PkmnPrices file is tracked", rawTracked.length === 0, rawTracked.slice(0, 5).join(", "));
  const gi = await readFile(join(ROOT, ".gitignore"), "utf8");
  t("ppp-raw-private/ is gitignored", /^ppp-raw-private\/$/m.test(gi));
  const dir = join(ROOT, "research/assets/public/market-depth");
  let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith(".json")); } catch {}
  const bad = [];
  for (const f of files) {
    if (f === "meta.json") continue;
    if (!/^\d\d\.json$/.test(f)) { bad.push(`file ${f}`); continue; }
    bad.push(...badMarketDepthDoc(JSON.parse(await readFile(join(dir, f), "utf8"))).map((b) => `${f} ${b}`));
  }
  t("market-depth files carry only the derived fields", bad.length === 0, bad.slice(0, 5).join("; "));
  // No other public file names PkmnPrices with raw comp fields.
  const leaks = [];
  for (const f of tracked.filter((n) => n.startsWith("research/assets/public/") && n.endsWith(".json") && !n.startsWith("research/assets/public/market-depth/"))) {
    try {
      const head = (await readFile(join(ROOT, f), "utf8")).slice(0, 200000);
      if (/pkmnprices/i.test(head) && /"(listing_url|ingested_at|seller_country)"/.test(head)) leaks.push(f);
    } catch {}
  }
  t("no other public file carries raw PkmnPrices rows", leaks.length === 0, leaks.slice(0, 5).join(", "));
  return fail;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await runNoPppRawPublicTests() ? 1 : 0);
