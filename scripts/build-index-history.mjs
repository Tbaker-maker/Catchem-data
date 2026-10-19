// Long history for the sitewide singles and sealed index lines.
// Runs after build-public-bundle.mjs. Reads tonight's index members from the
// published set files, the TCGplayer market archive (hist-long) and the approved
// chart fill sources, and computes the chain-linked line back as far as those
// prices go (scripts/lib/index-history.mjs).
// The full computed series, link counts and guard values stay in
// catchem-data-private (data/private/index-history/). Only the chart series
// [day, level, source] is added to research/assets/public/indexes.json as "history".
// With no PRIVATE_DATA_TOKEN or no private guard file, indexes.json is left as it is.
import { readFile, writeFile, readdir, appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadFillMap } from "./lib/fill-history.mjs";
import { openPrivate } from "./lib/private-store.mjs";
import { archiveCadence, chartSeries, indexDays, longIndexLine, splice, unpackLong } from "./lib/index-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const niceDay = (d) => `${M[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}, ${d.slice(0, 4)}`;

export async function loadMembers(root = ROOT) {
  const dir = join(root, "research/assets/public/sets");
  const out = { single: [], sealed: [] };
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".json")).sort()) {
    const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
    for (const it of doc.items || []) {
      if (!it || !it.id) continue;
      // Cards in tonight's index that also carry a price tonight. A card with no
      // price tonight (held or unpriced) is left out of the earlier days too.
      if (!(Number(it.price) > 0) || it.priceStatus === "checking") continue;
      if (it.kind === "sealed") out.sealed.push(it);
      else if (it.kind === "single") out.single.push(it);
    }
  }
  return out;
}

export async function loadLong(root = ROOT) {
  const dir = join(root, "research/assets/public/hist-long");
  const map = new Map();
  let files = [];
  try { files = (await readdir(dir)).filter((f) => /^\d\d\.json$/.test(f)); } catch { return map; }
  for (const f of files) {
    const doc = JSON.parse(await readFile(join(dir, f), "utf8"));
    for (const [id, packed] of Object.entries(doc.rows || {})) map.set(id, unpackLong(packed));
  }
  return map;
}

// Plain lines for the chart's About box, from the series itself.
export function aboutLines(series, cadence) {
  const real = series.filter((p) => p[1] > 0);
  if (!real.length) return [];
  const span = (tag) => { const s = real.filter((p) => p[2] === tag); return s.length ? [s[0][0], s.at(-1)[0], s.length] : null; };
  const out = [];
  const a = span("a");
  const f = span("f");
  const n = span("n");
  if (a) {
    const weeklyEnd = real.filter((p) => p[2] === "a" && p[0] < cadence.dailyFrom).at(-1);
    out.push(weeklyEnd
      ? `TCGplayer market price via the tcgcsv daily archive: weekly from ${niceDay(a[0])} to ${niceDay(weeklyEnd[0])}, then daily to ${niceDay(a[1])}.`
      : `TCGplayer market price via the tcgcsv daily archive, ${niceDay(a[0])} to ${niceDay(a[1])}.`);
  }
  if (f) out.push(`Public fan-site data (PokeVizInvestor, TCGplayer market), ${niceDay(f[0])} to ${niceDay(f[1])}. These days are the soft line.`);
  if (n) out.push(`TCGplayer market price via tcgcsv, our nightly pull, ${niceDay(n[0])} to ${niceDay(n[1])}.`);
  return out;
}

export function gapLines(series, cadence) {
  const real = series.filter((p) => p[1] > 0);
  const out = [];
  for (let i = 1; i < real.length; i += 1) {
    const a = real[i - 1][0];
    const b = real[i][0];
    const gap = (Date.parse(b) - Date.parse(a)) / 86400000;
    const weekly = b <= cadence.dailyFrom && gap === 7;
    if (gap > 1 && !weekly) out.push([a, b, gap - 1]);
  }
  if (!out.length) return [];
  const days = out.reduce((s, g) => s + g[2], 0);
  return [days === 1 ? "1 day with no price file holds the last level and shows as the soft line." : `${days} days with no price file hold the last level and show as the soft line.`];
}

export async function buildHistory({ root = ROOT, guard, members, long, fan, index }) {
  const cadence = archiveCadence([...long.values()].flatMap((s) => s.map((p) => p[0])));
  if (!cadence.dailyFrom) return null;
  const days = indexDays({ weeklyDays: cadence.weeklyDays, dailyFrom: cadence.dailyFrom, end: index.asOf });
  const opts = { days, dailyFrom: cadence.dailyFrom, archiveEnd: cadence.archiveEnd, guard };
  const out = { cadence, sides: {} };
  for (const [side, kind] of [["singles", "single"], ["sealed", "sealed"]]) {
    const cards = members[kind].map((m) => ({
      own: m.hist || [],
      long: kind === "single" ? long.get(m.id) || [] : [],
      fan: fan.get(Number(m.pid))?.points || [],
    }));
    const line = longIndexLine(cards, opts);
    const joined = splice(line.points, index[side]);
    out.sides[side] = { full: joined.points, diag: { ...line.diag, members: cards.length, joined: joined.joined, scale: joined.scale ?? null }, chart: chartSeries(joined.points) };
  }
  return out;
}

export function publicHistory(built) {
  const doc = {
    method: "Chain-linked and value-weighted. Earlier days use the cards in tonight's index that have a price on both days of each step, so a card added later does not move the line.",
    weeklyUntil: built.cadence.dailyFrom,
  };
  for (const side of ["singles", "sealed"]) {
    const s = built.sides[side];
    if (!s?.diag.joined || s.chart.length < 2) continue;
    const ownFirst = s.chart.find((p) => p[2] === "n");
    doc[side] = s.chart;
    doc[`${side}About`] = [
      ...aboutLines(s.chart, built.cadence),
      ...gapLines(s.chart, built.cadence),
      ownFirst ? `Level ${ownFirst[1]} is ${niceDay(ownFirst[0])}, our first nightly day.` : "",
    ].filter(Boolean);
  }
  return doc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  const store = await openPrivate({ root: ROOT, token });
  let guard = null;
  try { guard = JSON.parse(await readFile(join(store.dir, "index-history/config.json"), "utf8")).guard; } catch { /* no private guard file */ }
  if (!guard) {
    await store.close([], "index history: nothing to store").catch(() => {});
    console.log("index history: no private guard file, indexes.json left as it is");
    process.exit(0);
  }
  const indexFile = join(PUB, "indexes.json");
  const index = JSON.parse(await readFile(indexFile, "utf8"));
  const built = await buildHistory({ guard, members: await loadMembers(), long: await loadLong(), fan: loadFillMap(ROOT), index });
  if (!built) {
    await store.close([], "index history: nothing to store").catch(() => {});
    console.log("index history: no archive days, indexes.json left as it is");
    process.exit(0);
  }
  const pub = publicHistory(built);
  index.history = pub;
  await writeFile(indexFile, JSON.stringify(index, null, 1) + "\n");
  const dir = join(store.dir, "index-history");
  await mkdir(dir, { recursive: true });
  const paths = [];
  for (const side of ["singles", "sealed"]) {
    const s = built.sides[side];
    await writeFile(join(dir, `${side}.json`), JSON.stringify({ asOf: index.asOf, updatedAt: index.updatedAt, cadence: { dailyFrom: built.cadence.dailyFrom, archiveEnd: built.cadence.archiveEnd }, guard, diag: s.diag, points: s.full }) + "\n");
    paths.push(`index-history/${side}.json`);
  }
  const last = (side) => built.sides[side].full.filter((p) => p.v > 0).at(-1) || null;
  await appendFile(join(dir, "runs.jsonl"), JSON.stringify({ asOf: index.asOf, at: new Date().toISOString(), singles: { first: built.sides.singles.full[0]?.d || null, last: last("singles"), diag: built.sides.singles.diag }, sealed: { first: built.sides.sealed.full[0]?.d || null, last: last("sealed"), diag: built.sides.sealed.diag } }) + "\n");
  paths.push("index-history/runs.jsonl");
  const res = await store.close(paths, `Store index history for ${index.asOf}`);
  console.log(JSON.stringify({ singles: pub.singles ? [pub.singles[0][0], pub.singles.length] : null, sealed: pub.sealed ? [pub.sealed[0][0], pub.sealed.length] : null, private: res.pushed ? "stored" : res.reason }));
}
