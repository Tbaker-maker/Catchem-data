// Nightly listings-led tracker v1. Private only: writes to the private store (catchem-data-private
// when PRIVATE_DATA_TOKEN is set, else gitignored data/private/). No public output.
//   tracker/picks/YYYY-MM-DD.json   top picks for the night
//   tracker/backtest.json           hit rates at 7, 30, 90 days, shown only when n >= 20
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { scoreItems, backtest } from "./lib/tracker.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOP = 25;
const J = async (p, d) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

export async function loadInputs(root = ROOT) {
  const listings = new Map();
  const pidOf = new Map(((await J(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] })).items || []).map((it) => [it.id, Number(it.tcgplayerProductId)]));
  const hdir = join(root, "data/derived/listing-counts/history");
  for (const f of (await readdir(hdir).catch(() => [])).filter((n) => /\.json\.gz$/.test(n)).sort()) {
    const doc = JSON.parse(gunzipSync(await readFile(join(hdir, f))).toString());
    for (const r of doc.rows || []) {
      const pid = pidOf.get(r.id) || Number(String(r.id).replace(/^tcgcsv-/, "")) || null;
      if (!pid || !(r.listingsCounted >= 0)) continue;
      if (!listings.has(pid)) listings.set(pid, []);
      listings.get(pid).push([doc.date || r.date, r.listingsCounted]);
    }
  }
  const prices = new Map();
  const ddir = join(root, "data/history/tcgcsv-daily");
  const days = (await readdir(ddir)).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  for (const f of days) {
    const doc = await J(join(ddir, f), { prices: [] });
    for (const r of doc.prices || []) {
      if (!(r.market > 0)) continue;
      if (!prices.has(r.id)) prices.set(r.id, []);
      prices.get(r.id).push([f.slice(0, 10), r.market]);
    }
  }
  const heat = new Map();
  const tcgOf = new Map(((await J(join(root, "data/sealed-products.json"), [])) || []).map((p) => [p.id, Number(p.tcgPlayerId)]));
  for (const r of (await J(join(root, "data/heat-report.json"), { reads: [] })).reads || []) if (tcgOf.get(r.id)) heat.set(tcgOf.get(r.id), r.state);
  return { listings, prices, heat, asOf: days.at(-1)?.slice(0, 10) || null };
}

async function main() {
  const { listings, prices, heat, asOf } = await loadInputs();
  let store;
  try { store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" }); }
  catch (err) { console.error(`tracker: ${err.message}; using local data/private`); store = await openPrivate({ root: ROOT, token: "" }); }
  const dir = join(store.dir, "tracker");
  await mkdir(join(dir, "picks"), { recursive: true });
  const scored = asOf ? scoreItems({ listings, prices, heat, asOf }) : [];
  const picks = scored.slice(0, TOP);
  await writeFile(join(dir, "picks", `${asOf}.json`), JSON.stringify({ asOf, version: 1, lead: "listings counted falling, price stable or rising", itemsWithListings: listings.size, scored: scored.length, picks }, null, 1) + "\n");
  const all = [];
  for (const f of (await readdir(join(dir, "picks"))).filter((n) => n.endsWith(".json"))) {
    const d = await J(join(dir, "picks", f), { picks: [] });
    for (const p of d.picks || []) all.push({ date: d.asOf, pid: p.pid });
  }
  const bt = { asOf, picksLogged: all.length, nights: new Set(all.map((p) => p.date)).size, horizons: backtest(all, prices, asOf) };
  await writeFile(join(dir, "backtest.json"), JSON.stringify(bt, null, 1) + "\n");
  const r = await store.close([`tracker/picks/${asOf}.json`, "tracker/backtest.json"], `tracker: picks ${asOf}`);
  console.log(JSON.stringify({ tracker: { asOf, itemsWithListings: listings.size, scored: scored.length, picks: picks.length, backtest: bt.horizons, pushed: r.pushed, reason: r.reason || null } }));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
