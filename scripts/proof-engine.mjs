#!/usr/bin/env node
// Proof engine, lifecycle curves, move receipts, listing runway.
// Limits: node scripts/proof-engine.mjs --config path/to/proof.json
// Scores stay in data/private. Public files have receipts and curves only.
// Does not publish and does not edit the publish script.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import {
  assertLimits, joinSeries, buildMoveCalls, buildMonthCalls, scoreCalls, summarize,
  publicReceipts, curveFor, weekIndex, placeOnCurve, nearestCause, whyLine, runwayDays,
  priceNear, median, round4, publicTextOk, monthName, swingBefore,
} from "./lib/proof-engine.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = ["booster-box", "etb", "pc-etb", "booster-bundle", "upc"];
const ERAS = new Set(["Sword & Shield", "Scarlet & Violet", "Mega Evolution"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function configArg() {
  const i = process.argv.indexOf("--config");
  return i >= 0 ? process.argv[i + 1] : "";
}

function loadLimits(path) {
  if (!path || !existsSync(path)) {
    console.error("proof limits not loaded");
    process.exit(1);
  }
  try { return assertLimits(readJson(path)); }
  catch {
    console.error("proof limits not loaded");
    process.exit(1);
  }
}

function loadDaily(ids) {
  const dir = join(ROOT, "data/history/tcgcsv-daily");
  const by = new Map();
  if (!existsSync(dir)) return by;
  for (const name of readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()) {
    const doc = readJson(join(dir, name));
    const date = doc.date || name.slice(0, 10);
    for (const row of doc.prices || []) {
      const id = String(row.id);
      if (!ids.has(id) || !(row.market > 0)) continue;
      const list = by.get(id) || [];
      list.push({ date, price: row.market, source: "tcgcsv-daily" });
      by.set(id, list);
    }
  }
  return by;
}

function loadArchive(ids) {
  const path = join(ROOT, "data/backfill/pokeviz/raw.json");
  const by = new Map();
  if (!existsSync(path)) return by;
  const doc = readJson(path);
  for (const item of doc.items || []) {
    const id = String(item.pid);
    if (!ids.has(id)) continue;
    by.set(id, item.points || []);
  }
  return by;
}

function loadListings(ids) {
  const dir = join(ROOT, "data/derived/listing-counts/history");
  const by = new Map();
  if (!existsSync(dir)) return by;
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json") || n.endsWith(".json.gz")).sort()) {
    const raw = readFileSync(join(dir, name));
    const text = name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    let doc;
    try { doc = JSON.parse(text); } catch { continue; }
    const date = doc.date || name.slice(0, 10);
    for (const row of doc.rows || []) {
      if (!ids.has(row.id) || row.listingsCounted == null || !Number.isFinite(row.listingsCounted)) continue;
      const list = by.get(row.id) || [];
      list.push({ date, count: row.listingsCounted });
      by.set(row.id, list);
    }
  }
  for (const list of by.values()) list.sort((a, b) => (a.date < b.date ? -1 : 1));
  return by;
}

function releaseIndex(sets) {
  const byLogo = new Map();
  for (const set of sets) {
    const logo = String(set.logo || "");
    const m = logo.match(/\/img\/([^/]+)\//);
    if (m) byLogo.set(m[1], set);
  }
  return byLogo;
}

function productRelease(product, setsById) {
  if (product.launchDate && /^\d{4}-\d{2}-\d{2}$/.test(product.launchDate)) return product.launchDate;
  const set = setsById.get(product.setId);
  return set && /^\d{4}-\d{2}-\d{2}$/.test(set.release) ? set.release : null;
}

function productEra(product, setsById) {
  const set = setsById.get(product.setId);
  if (set && ERAS.has(set.era)) return set.era;
  const id = String(product.setId || "");
  if (id.startsWith("swsh") || id.startsWith("cel")) return "Sword & Shield";
  if (id.startsWith("sv")) return "Scarlet & Violet";
  if (id.startsWith("me")) return "Mega Evolution";
  if (product.launchDate) return "Mega Evolution";
  return null;
}

function loadRetail() {
  const path = join(ROOT, "data/sealed-msrp.json");
  const out = new Map();
  if (!existsSync(path)) return out;
  const doc = readJson(path);
  for (const row of doc.products || []) {
    if (row && row.id && row.msrpUsd > 0) out.set(row.id, row.msrpUsd);
  }
  return out;
}

function readDirection(read) {
  const signals = Array.isArray(read.signals) ? read.signals : [];
  const move = signals.find((s) => s && s.kind === "move" && (s.dir === "up" || s.dir === "down" || s.dir === "flat"));
  if (move) return move.dir;
  const pts = read.chart?.points;
  if (Array.isArray(pts) && pts.length >= 2) {
    const a = Number(pts[0]?.[1]);
    const b = Number(pts[pts.length - 1]?.[1]);
    if (a > 0 && b > 0 && a !== b) return b > a ? "up" : "down";
  }
  return null;
}

function spotCall(product, direction, date, limits) {
  const spot = priceNear(product.points, date, limits.dateSlackDays);
  const listings = (product.listings || []).filter((r) => r.date <= date);
  return {
    type: null,
    direction,
    productId: product.id,
    name: product.name,
    date,
    windowDays: null,
    price: spot ? spot.price : null,
    fromPrice: null,
    priorPct: null,
    swing: swingBefore(product.points, date, limits),
    listingsCounted: listings.length ? listings[listings.length - 1].count : null,
  };
}

function buildReadCalls(reads, products, limits) {
  const byNum = new Map(products.map((p) => [String(p.tcgId), p]));
  const calls = [];
  for (const read of reads) {
    const direction = readDirection(read);
    if (!direction) continue;
    const sku = String(read.sku || "");
    const num = sku.replace(/^tcgcsv-/, "");
    const product = byNum.get(num);
    if (!product) continue;
    const date = String(read.asOf || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const call = spotCall(product, direction, date, limits);
    call.type = `read-${direction}`;
    calls.push(call);
  }
  return calls;
}

function buildChipCalls(doc, products, limits) {
  const byNum = new Map(products.map((p) => [String(p.tcgId), p]));
  const date = String(doc.asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const calls = [];
  for (const chip of Object.values(doc.byId || {})) {
    const sku = String(chip?.sku || "");
    const product = byNum.get(sku.replace(/^tcgcsv-/, ""));
    if (!product) continue;
    const move = (chip.signals || []).find((s) => s && s.kind === "move" && (s.dir === "up" || s.dir === "down" || s.dir === "flat"));
    if (!move) continue;
    const call = spotCall(product, move.dir, date, limits);
    call.type = `chip-${move.dir}`;
    calls.push(call);
  }
  return calls;
}

function chartSvg(title, weeks, unit) {
  const rows = weeks.filter((w) => w.n >= 3 && w.median != null);
  const w = 920;
  const h = 460;
  if (rows.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f4efe4"/><text x="40" y="80" fill="#1c1915" font-family="Georgia, serif" font-size="22">${title}</text><text x="40" y="120" fill="#5c564c" font-size="16">Not enough weeks on file to draw this curve.</text></svg>`;
  }
  const pad = { l: 64, r: 24, t: 64, b: 48 };
  const xs = rows.map((r) => r.week);
  const ys = rows.flatMap((r) => [r.low, r.high, r.median]).filter((n) => n != null);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.12;
  const X = (week) => pad.l + ((week - xs[0]) / (xs[xs.length - 1] - xs[0])) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
  const band = rows.map((r) => `${X(r.week).toFixed(1)},${Y(r.high ?? r.median).toFixed(1)}`).join(" ")
    + " " + rows.slice().reverse().map((r) => `${X(r.week).toFixed(1)},${Y(r.low ?? r.median).toFixed(1)}`).join(" ");
  const line = rows.map((r, i) => `${i ? "L" : "M"}${X(r.week).toFixed(1)} ${Y(r.median).toFixed(1)}`).join(" ");
  const zero = rows.some((r) => r.week === 0) ? X(0) : null;
  const ticks = rows.filter((_, i) => i === 0 || i === rows.length - 1 || rows[i].week === 0).map((r) => {
    const label = r.week < 0 ? `${r.week}` : `wk ${r.week}`;
    return `<text x="${X(r.week).toFixed(1)}" y="${h - 16}" text-anchor="middle" fill="#5c564c" font-size="13">${label}</text>`;
  }).join("");
  const earlyNote = rows.some((r) => r.early)
    ? `<text x="${pad.l}" y="${h - 2}" fill="#8a3b2c" font-size="12">Weeks before 0 are before the release date. They are not part of the usual curve.</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="#f4efe4"/>
  <text x="${pad.l}" y="36" fill="#1c1915" font-family="Georgia, serif" font-size="26">${title}</text>
  <text x="${pad.l}" y="54" fill="#5c564c" font-size="13">${unit} The band is the middle of products that week. A week needs 3 products.</text>
  <polygon points="${band}" fill="#d9c7a2" opacity="0.85"/>
  <path d="${line}" fill="none" stroke="#1c1915" stroke-width="2.5"/>
  ${zero == null ? "" : `<line x1="${zero}" x2="${zero}" y1="${pad.t}" y2="${h - pad.b}" stroke="#8a3b2c" stroke-dasharray="4 4"/>`}
  ${ticks}
  ${earlyNote}
</svg>`;
}

function writePng(weeksPath, pngPath, title) {
  const py = `
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
def money(v):
    return str(int(round(v)))
doc = json.load(open(sys.argv[1], encoding="utf-8"))
rows = [r for r in doc if r.get("n", 0) >= 3 and r.get("median") is not None]
w, h = 1100, 560
im = Image.new("RGB", (w, h), "#f4efe4")
d = ImageDraw.Draw(im)
def font(size):
    for path in Path("/usr/share/fonts").rglob("*.ttf"):
        name = path.name.lower()
        if "liberationsans-regular" in name or name == "dejavusans.ttf":
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()
title_font = font(28)
body = font(16)
small = font(14)
d.text((56, 18), sys.argv[3], fill="#1c1915", font=title_font)
d.text((56, 54), "Market price. Week 0 is the release. A week is drawn when at least 3 products have a price.", fill="#5c564c", font=small)
if len(rows) < 2:
    d.text((56, 120), "Not enough weeks on file to draw this curve.", fill="#5c564c", font=body)
    im.save(sys.argv[2])
    raise SystemExit
pad = (78, 96, 28, 64)
ys = [v for r in rows for v in (r.get("low"), r.get("high"), r["median"]) if v is not None]
lo, hi = min(ys), max(ys)
if lo == hi:
    lo, hi = lo - 1, hi + 1
span = hi - lo
lo -= span * 0.08
hi += span * 0.12
xs = [r["week"] for r in rows]
def X(week):
    return pad[0] + (week - xs[0]) / (xs[-1] - xs[0]) * (w - pad[0] - pad[2])
def Y(v):
    return pad[1] + (1 - (v - lo) / (hi - lo)) * (h - pad[1] - pad[3])
band = [(X(r["week"]), Y(r.get("high") if r.get("high") is not None else r["median"])) for r in rows]
band += [(X(r["week"]), Y(r.get("low") if r.get("low") is not None else r["median"])) for r in reversed(rows)]
d.polygon(band, fill="#d9c7a2")
line = [(X(r["week"]), Y(r["median"])) for r in rows]
d.line(line, fill="#1c1915", width=3)
if 0 in xs:
    x = X(0)
    d.line([(x, pad[1]), (x, h - pad[3])], fill="#8a3b2c", width=2)
    d.text((x + 6, pad[1] + 4), "release", fill="#8a3b2c", font=small)
for v in (min(ys), max(ys)):
    y = Y(v)
    d.line([(pad[0] - 6, y), (pad[0], y)], fill="#5c564c")
    d.text((8, y - 8), "$" + money(v), fill="#5c564c", font=small)
for r in rows:
    if r["week"] in (xs[0], 0, xs[-1]) or r["week"] % 4 == 0:
        label = str(r["week"])
        d.text((X(r["week"]) - 8, h - 40), label, fill="#5c564c", font=small)
d.text((56, h - 22), "Weeks before 0 are before the release date. They are not part of the usual curve.", fill="#8a3b2c", font=small)
im.save(sys.argv[2])
`;
  const r = spawnSync("python3", ["-c", py, weeksPath, pngPath, title], { encoding: "utf8" });
  if (r.status !== 0) console.error(r.stderr || r.stdout || "chart png failed");
}

function main() {
  const limits = loadLimits(configArg());
  const sealed = readJson(join(ROOT, "data/sealed-products.json"));
  const setsDoc = existsSync(join(ROOT, "research/assets/public/sets.json"))
    ? readJson(join(ROOT, "research/assets/public/sets.json"))
    : { sets: [] };
  const setsById = releaseIndex(setsDoc.sets || []);
  const retail = loadRetail();
  const products = [];
  for (const row of sealed) {
    if (!TYPES.includes(row.subtype)) continue;
    const era = productEra(row, setsById);
    if (!era) continue;
    const tcgId = String(row.tcgPlayerId || "");
    if (!tcgId) continue;
    products.push({
      id: row.id,
      tcgId,
      name: row.name,
      subtype: row.subtype,
      set: row.set,
      setId: row.setId || "",
      era,
      release: productRelease(row, setsById),
      retail: retail.get(row.id) || null,
    });
  }
  const idSet = new Set(products.map((p) => p.tcgId));
  const daily = loadDaily(idSet);
  const archive = loadArchive(idSet);
  const listings = loadListings(new Set(products.map((p) => `tcgcsv-${p.tcgId}`)));
  let newest = null;
  for (const p of products) {
    const joined = joinSeries(daily.get(p.tcgId) || [], archive.get(p.tcgId) || []);
    p.points = joined.points;
    p.usedArchive = joined.usedArchive;
    p.listings = listings.get(`tcgcsv-${p.tcgId}`) || [];
    const last = p.points.at(-1)?.date;
    if (last && (!newest || last > newest)) newest = last;
  }
  const tracked = products.filter((p) => p.points.length >= 2);
  const moveCalls = buildMoveCalls(tracked, limits);
  const monthCalls = buildMonthCalls(tracked, limits);
  let readCalls = [];
  const readsPath = join(ROOT, "research/assets/public/reads.json");
  if (existsSync(readsPath)) {
    const doc = readJson(readsPath);
    readCalls = buildReadCalls(doc.reads || [], tracked, limits);
  }
  let chipCalls = [];
  const chipsPath = join(ROOT, "research/assets/public/signal-chips.json");
  if (existsSync(chipsPath)) {
    chipCalls = buildChipCalls(readJson(chipsPath), tracked, limits);
  }
  const scored = scoreCalls([...moveCalls, ...monthCalls, ...readCalls, ...chipCalls], tracked, limits);
  const summary = summarize(scored, limits);
  const receipts = publicReceipts(summary);
  receipts.asOf = newest;
  receipts.source = "TCGplayer market";
  const receiptBlob = JSON.stringify(receipts);
  if (!publicTextOk(receiptBlob)) {
    console.error("public receipt text failed the copy check");
    process.exit(1);
  }

  const curves = {};
  for (const subtype of TYPES) {
    curves[subtype] = curveFor(tracked.filter((p) => p.subtype === subtype), limits);
  }
  const pc = tracked.find((p) => p.tcgId === "704144");
  const case30 = pc ? caseStudy(pc, curves["pc-etb"] || [], limits) : { missing: "30th Celebration Pokemon Center ETB is not in the sealed file" };

  const gaps = [
    "Sourced retail prices are not on file, so times retail is missing. The curves use market price.",
    "Creator video files count videos, not views, so a view spike is not a cause.",
    "Reprint notes in the catalyst log are not tied to a product id, so they are not used as a cause.",
    "Listing nights on file do not cover a full runway window. The runway stays private.",
    "Most Sword and Shield launch weeks are before the archived market prices, so those weeks are missing rather than filled.",
    "Pulse month calls are the month-end market direction. The sealed market pulse page is a separate branch and is not read here.",
    "Reads and chips for products outside Sword and Shield through Mega Evolution are not scored here.",
    "Today's reads and chips are too new to score at 7, 30, or 90 days. The move rows are the backtest of that same direction.",
  ];

  const restocks = loadRestocks();
  const rotationDates = loadRotation();
  const outside = bandBreaks(tracked, curves, limits);
  const examples = pickExamples(outside.map((move) => explainMove(move, tracked, restocks, rotationDates, limits)));

  const lifecycle = {
    asOf: newest,
    source: "TCGplayer market",
    about: "History before our own first price for a product comes from archived TCGplayer market prices. A shared day keeps our price. Weeks before the release date are marked and are left out of the usual curve.",
    retail: "missing",
    types: Object.fromEntries(TYPES.map((t) => [t, { weeks: curves[t], products: tracked.filter((p) => p.subtype === t && p.release).length }])),
    case30,
    examples,
    gaps,
  };
  const lifeText = JSON.stringify(lifecycle);
  if (!publicTextOk(lifeText) || /pokeviz|collectr/i.test(lifeText)) {
    console.error("lifecycle text failed the copy check");
    process.exit(1);
  }

  const pub = join(ROOT, "research/assets/public");
  const shot = join(pub, "proof");
  mkdirSync(shot, { recursive: true });
  mkdirSync(join(ROOT, "data/private"), { recursive: true });
  writeFileSync(join(pub, "proof-receipts.json"), `${JSON.stringify(receipts, null, 2)}\n`);
  writeFileSync(join(pub, "lifecycle-curves.json"), `${JSON.stringify(lifecycle, null, 2)}\n`);
  const etbWeeks = join(shot, "lifecycle-etb.weeks.json");
  const boxWeeks = join(shot, "lifecycle-box.weeks.json");
  writeFileSync(etbWeeks, JSON.stringify(curves.etb || []));
  writeFileSync(boxWeeks, JSON.stringify(curves["booster-box"] || []));
  const etbSvg = chartSvg("ETB market price by week from release", curves.etb || [], "Market price, not times retail.");
  const boxSvg = chartSvg("Booster box market price by week from release", curves["booster-box"] || [], "Market price, not times retail.");
  writeFileSync(join(shot, "lifecycle-etb.svg"), etbSvg);
  writeFileSync(join(shot, "lifecycle-box.svg"), boxSvg);
  writePng(etbWeeks, join(shot, "lifecycle-etb.png"), "ETB market price by week from release");
  writePng(boxWeeks, join(shot, "lifecycle-box.png"), "Booster box market price by week from release");

  const runway = tracked.filter((p) => p.subtype === "booster-box" || p.subtype === "etb").map((p) => ({
    id: p.id,
    name: p.name,
    subtype: p.subtype,
    ...runwayDays(p.listings, limits.runwayNights),
  }));
  const scores = {
    private: true,
    asOf: newest,
    summary,
    runway,
    examples,
    case30,
  };
  writeFileSync(join(ROOT, "data/private/proof-scores.json"), JSON.stringify(scores));
  console.log(`asOf ${newest} products ${tracked.length} calls ${scored.length}`);
  for (const row of summary.types) {
    const h = row.publicHorizon ? row.horizons[String(row.publicHorizon)] : row.horizons[String(limits.horizons[0])];
    console.log(`${row.type}\tn=${h?.n ?? 0}\thit=${h?.hitRate}\tlift=${h?.lift}\tpublic=${row.public ? "yes" : "no"}`);
  }
  console.log(`receipts ${receipts.lines.length}`);
  console.log(`examples ${examples.length}`);
}

function caseStudy(product, curve) {
  const august = product.points.filter((p) => p.date.startsWith("2026-08")).map((p) => p.price);
  const release = product.points.find((p) => p.date === "2026-09-16") || null;
  const week = product.release ? weekIndex(product.release, "2026-09-16") : null;
  const band = curve.find((w) => w.week === week) || null;
  const place = placeOnCurve(release ? release.price : null, band);
  return {
    id: product.id,
    name: product.name,
    launch: product.release,
    augustDays: august.length,
    augustMedian: round4(median(august)),
    augustMin: august.length ? round4(Math.min(...august)) : null,
    augustMax: august.length ? round4(Math.max(...august)) : null,
    releaseDate: "2026-09-16",
    releasePrice: release ? release.price : null,
    releaseSource: release ? release.source : null,
    retail: product.retail,
    timesRetail: null,
    earlyWindow: "before release",
    releasePlace: place,
    note: product.retail
      ? "Times retail uses the sourced retail price. August prices are before the release date."
      : "Retail is not on file, so times retail is missing. August prices are before the release date and are not on the usual curve.",
  };
}

function bandBreaks(products, curves, limits) {
  const rows = [];
  for (const product of products) {
    if (!product.release || product.points.length < 2) continue;
    const end = product.points[product.points.length - 1];
    const week = weekIndex(product.release, end.date);
    if (week == null || week < 0) continue;
    const weekRow = (curves[product.subtype] || []).find((row) => row.week === week);
    const place = placeOnCurve(end.price, weekRow);
    if (place !== "above" && place !== "below") continue;
    const prev = [...product.points].reverse().find((p) => p.date <= addDaysSafe(end.date, -limits.moveWindowDays));
    const pct = prev && prev.price > 0 ? ((end.price - prev.price) / prev.price) * 100 : null;
    rows.push({
      id: product.id,
      tcgId: product.tcgId,
      name: product.name,
      subtype: product.subtype,
      set: product.set,
      release: product.release,
      date: end.date,
      from: prev ? prev.date : null,
      pct: round4(pct),
      price: end.price,
      direction: pct == null ? null : (pct > 0 ? "up" : pct < 0 ? "down" : "flat"),
      place,
      week,
    });
  }
  rows.sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0));
  return rows;
}

function addDaysSafe(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function loadRestocks() {
  const paths = [
    join(ROOT, "..", "catchem-data-private", "data/private/restocks/events.json"),
    join(ROOT, "..", "pulse-limits", "data/private/restocks/events.json"),
    "/tmp/prem/pulse-limits/data/private/restocks/events.json",
  ];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const doc = readJson(path);
      return (doc.events || []).filter((e) => e && e.product && e.timestamp).map((e) => ({
        product: String(e.product),
        date: String(e.timestamp).slice(0, 10),
      }));
    } catch { /* next */ }
  }
  return [];
}

function loadRotation() {
  const path = join(ROOT, "research/assets/public/rotation-status.json");
  if (!existsSync(path)) return [];
  const doc = readJson(path);
  return (doc.sources || []).filter((s) => s && s.date).map((s) => ({ date: s.date, mark: s.mark || "" }));
}

const TYPE_WORD = {
  "booster-box": "booster box",
  etb: "ETB",
  "pc-etb": "Pokemon Center ETB",
  "booster-bundle": "bundle",
  upc: "UPC",
};

function explainMove(move, products, restocks, rotationDates, limits) {
  const causes = [];
  for (const event of restocks) {
    if (event.product !== move.tcgId) continue;
    causes.push({ date: event.date, kind: "restock", line: `A restock was recorded on ${monthName(event.date)}.` });
  }
  if (move.release) {
    causes.push({ date: move.release, kind: "release", line: `The set release date is ${monthName(move.release)}.` });
  }
  for (const rot of rotationDates) {
    causes.push({ date: rot.date, kind: "rotation", line: `A rotation date on file is ${monthName(rot.date)}.` });
  }
  const product = products.find((p) => p.id === move.id);
  if (product) {
    const nights = product.listings.filter((r) => r.date <= move.date && r.date >= addDaysSafe(move.date, -limits.causeWindowDays));
    if (nights.length >= 2) {
      const a = nights[0].count;
      const b = nights[nights.length - 1].count;
      if (a > 0) {
        const pct = ((b - a) / a) * 100;
        if (Math.abs(pct) >= limits.listingsJumpPct) {
          causes.push({
            date: nights[nights.length - 1].date,
            kind: "listings",
            line: `Listings counted moved ${round4(pct)} percent by ${monthName(nights[nights.length - 1].date)}.`,
          });
        }
      }
    }
  }
  const near = [
    ...nearestCause(move.from || move.date, causes, limits.causeWindowDays),
    ...nearestCause(move.date, causes, limits.causeWindowDays),
  ];
  const seenKind = new Set();
  const unique = [];
  for (const cause of near.sort((a, b) => a.daysApart - b.daysApart || a.date.localeCompare(b.date))) {
    const kind = cause.kind || cause.line;
    if (seenKind.has(kind)) continue;
    seenKind.add(kind);
    unique.push(cause);
  }
  const line = whyLine(unique);
  const kind = TYPE_WORD[move.subtype] || "product";
  const moveBit = move.pct == null || !move.from
    ? ""
    : ` It ${move.pct < 0 ? "fell" : "rose"} ${formatPct(move.pct)} from ${monthName(move.from)} to ${monthName(move.date)}.`;
  const where = move.place === "above" ? "above" : "below";
  return {
    name: move.name,
    date: move.date,
    from: move.from,
    direction: move.direction,
    pct: move.pct,
    price: move.price,
    place: move.place,
    week: move.week,
    line,
    text: `${move.name} is ${where} the usual ${kind} curve at week ${move.week}, at ${money(move.price)} on ${monthName(move.date)}.${moveBit} ${line}`,
  };
}

function formatPct(n) {
  if (n == null) return "a missing amount";
  const abs = Math.abs(n).toFixed(1).replace(/\.0$/, "");
  return `${abs} percent`;
}

function money(n) {
  if (!(n > 0)) return "a missing price";
  return `$${n.toFixed(2)}`;
}

function pickExamples(rows) {
  const withCause = rows.filter((r) => r.line !== "no clear cause on file");
  const without = rows.filter((r) => r.line === "no clear cause on file");
  const picked = [];
  for (const row of withCause) {
    if (picked.length >= 2) break;
    if (publicTextOk(row.text)) picked.push(row);
  }
  for (const row of without) {
    if (picked.length >= 3) break;
    if (publicTextOk(row.text)) picked.push(row);
  }
  for (const row of rows) {
    if (picked.length >= 3) break;
    if (!picked.includes(row) && publicTextOk(row.text)) picked.push(row);
  }
  return picked.slice(0, 3);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
