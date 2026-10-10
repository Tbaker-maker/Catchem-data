// Count half-price copies from price series already in the repo.
// A number is written only when it is the value in a file, or the length of
// ids classified from those values. If two files disagree, both readings are
// kept and that product is not counted. No network. No invented drop.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dropTiledCycles, separateHalfCopies } from "./lib/public-bundle.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) out[name] = true;
    else { out[name] = value; i += 1; }
  }
  return out;
}

function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function classifySeries(days) {
  const sorted = [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const hist = dropTiledCycles(sorted);
  if (hist.length < 4) return null;
  const split = separateHalfCopies(hist);
  if (split.ambiguous) return "tooEven";
  if (split.dropped.length) return "halfPrice";
  return null;
}

export async function loadPriceSeries(root) {
  const series = new Map();
  const rawId = new Map();
  const latest = new Map();
  let sawDir = false;

  function bump(dir, day) {
    const prev = latest.get(dir);
    if (!prev || day > prev) latest.set(dir, day);
  }

  function add(pidRaw, day, value, source, dir) {
    const pid = Number(pidRaw);
    if (!Number.isInteger(pid) || pid <= 0 || !isDay(day) || typeof value !== "number" || !(value > 0)) return false;
    if (!rawId.has(pid)) rawId.set(pid, String(pidRaw));
    if (!series.has(pid)) series.set(pid, new Map());
    const days = series.get(pid);
    const reading = { source, value };
    const cell = days.get(day);
    if (!cell) days.set(day, { readings: [reading] });
    else if (!cell.readings.some((row) => row.source === source && row.value === value)) cell.readings.push(reading);
    bump(dir, day);
    return true;
  }

  // PPT Near Mint history (data/history/market-backfill) moved to the private repo on 2026-10-10.
  // Public builds use TCGCSV days only. A day TCGCSV does not have stays a gap.

  const watchDir = join(root, "data/history/tcgplayer-market");
  try {
    const files = (await readdir(watchDir)).filter((name) => name.endsWith(".json")).sort();
    sawDir = true;
    for (const file of files) {
      const doc = await readJson(join(watchDir, file));
      const source = `data/history/tcgplayer-market/${file}`;
      for (const pt of doc.points || []) {
        if (pt?.source && !/tcgcsv|tcgplayer market/i.test(String(pt.source))) continue;
        add(doc.tcgplayerProductId, pt?.date, pt?.market, source, "data/history/tcgplayer-market");
      }
    }
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }

  const dailyDir = join(root, "data/history/tcgcsv-daily");
  try {
    const files = (await readdir(dailyDir)).filter((name) => name.endsWith(".json")).sort();
    sawDir = true;
    for (const file of files) {
      const day = file.slice(0, 10);
      if (!isDay(day)) continue;
      const doc = await readJson(join(dailyDir, file));
      const source = `data/history/tcgcsv-daily/${file}`;
      for (const row of doc.prices || []) add(row?.id, day, row?.market, source, "data/history/tcgcsv-daily");
    }
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }

  const sourceDays = [...latest.entries()].map(([source, day]) => ({ source, latest: day })).sort((a, b) => a.source < b.source ? -1 : 1);
  return { series, rawId, sourceDays, sawDir };
}

async function catalogIds(root) {
  try {
    const doc = await readJson(join(root, "data/catalog/tcgcsv-latest.json"));
    const ids = new Map();
    for (const item of doc.items || []) {
      const pid = item?.tcgplayerProductId;
      if (typeof pid !== "number" || !item?.id) continue;
      const list = ids.get(pid) || [];
      list.push(String(item.id));
      ids.set(pid, list);
    }
    return ids;
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
    return new Map();
  }
}

function productId(pid, rawId, ids) {
  const fromCatalog = ids.get(pid) || [];
  if (fromCatalog.length === 1) return { id: fromCatalog[0], catalogIds: fromCatalog };
  if (fromCatalog.length > 1) return { id: null, catalogIds: [...fromCatalog].sort() };
  return { id: rawId.get(pid) || null, catalogIds: [] };
}

export async function checkHalfPrice({ root = ROOT, out = "", date = "" } = {}) {
  const loaded = await loadPriceSeries(root);
  const stamp = isDay(date) ? date : localDay();
  if (!loaded.series.size) {
    const path = out || join(root, "data/learning", `half-price-${stamp}.json`);
    const body = { source: "missing", note: "source missing" };
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(body, null, 2) + "\n", "utf8");
    return { exitCode: 0, sentence: "Source missing.", path, body };
  }

  const ids = await catalogIds(root);
  const halfPriceIds = [];
  const tooEvenIds = [];
  const unresolved = [];
  for (const [pid, days] of loaded.series) {
    const named = productId(pid, loaded.rawId, ids);
    const conflicts = [];
    const agreed = new Map();
    for (const [day, cell] of days) {
      const values = new Set(cell.readings.map((row) => row.value));
      if (values.size > 1) {
        conflicts.push({
          day,
          readings: [...cell.readings].sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0),
        });
      } else if (values.size === 1) {
        agreed.set(day, cell.readings[0].value);
      }
    }
    if (named.catalogIds.length > 1 || conflicts.length) {
      if (!named.id && named.catalogIds.length === 0) continue;
      const row = { days: conflicts };
      if (named.catalogIds.length > 1) row.catalogIds = named.catalogIds;
      else row.id = named.id;
      unresolved.push(row);
      continue;
    }
    if (!named.id) continue;
    const bucket = classifySeries(agreed);
    if (bucket === "tooEven") tooEvenIds.push(named.id);
    else if (bucket === "halfPrice") halfPriceIds.push(named.id);
  }
  halfPriceIds.sort();
  tooEvenIds.sort();
  unresolved.sort((a, b) => String(a.id || a.catalogIds?.[0] || "").localeCompare(String(b.id || b.catalogIds?.[0] || "")));

  const latestDays = loaded.sourceDays.map((row) => row.latest);
  const agreedDay = latestDays.length > 0 && latestDays.every((day) => day === latestDays[0]) ? latestDays[0] : "";
  const body = {
    sourceDays: loaded.sourceDays,
    halfPriceCount: halfPriceIds.length,
    halfPriceIds,
    tooEvenCount: tooEvenIds.length,
    tooEvenIds,
  };
  if (agreedDay) body.asOf = agreedDay;
  if (unresolved.length) {
    body.unresolvedCount = unresolved.length;
    body.unresolved = unresolved;
  }
  if (body.halfPriceCount !== halfPriceIds.length || body.tooEvenCount !== tooEvenIds.length) {
    return { exitCode: 0, sentence: "Refused the half-price counts because they do not match the traced ids.", path: "", body: { source: "missing", note: "source missing" } };
  }

  const path = out || join(root, "data/learning", `half-price-${agreedDay || stamp}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(body, null, 2) + "\n", "utf8");
  const dayClause = agreedDay
    ? `from the series as of ${agreedDay}`
    : `source days were kept as written (${loaded.sourceDays.map((row) => `${row.source} ${row.latest}`).join("; ")}) and no series day was chosen`;
  const unresolvedClause = unresolved.length ? `, and ${unresolved.length} products were not counted because two files disagree` : "";
  const sentence = `Half-price copies on ${body.halfPriceCount} products, and ${body.tooEvenCount} products left out because the two copies are too even to call, ${dayClause}${unresolvedClause}.`;
  return { exitCode: 0, sentence, path, body };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const result = await checkHalfPrice({ root: args.root || ROOT, out: args.out || "", date: args.date || "" });
  console.log(result.sentence);
  process.exit(result.exitCode);
}
