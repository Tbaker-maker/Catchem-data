// Synthesized item reads. Fixture limits only. The live limits stay in the private repo.
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findings, validSynth, loadContext, synthesizeReads, openingKey, isItemRead } from "../lib/read-synthesis.mjs";
import { hasBannedWord } from "../lib/copy-rules.mjs";
import { dayNum, addDays } from "../lib/history-reads.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };
const CFG = validSynth(JSON.parse(readFileSync(new URL("./fixtures/read-synthesis-limits.json", import.meta.url), "utf8")));
console.log("read synthesis");
t("fixture limits load", CFG != null);
t("missing limits do not load", validSynth({}) === null && validSynth({ ...CFG, weights: {} }) === null);

const asOf = "2026-10-23";
const root = await mkdtemp(join(tmpdir(), "synth-"));
const pub = join(root, "research/assets/public");
await mkdir(join(pub, "hist-long"), { recursive: true });
await mkdir(join(pub, "buckets"), { recursive: true });
await mkdir(join(pub, "set-value"), { recursive: true });
await mkdir(join(root, "data"), { recursive: true });
// Twelve singles in one set with different shapes, plus one sealed product.
const T = dayNum("2026-10-23") - dayNum("2024-02-08");
const shapes = [
  (t) => 10 * (1 + t / 300),                                   // long climb to a new high
  (t) => 80 * Math.exp(-t / 600),                              // long slide to a new low
  (t) => (t < 400 ? 20 + t * 0.1 : Math.max(8, 60 - (t - 400) * 0.06)), // peak, then a long fall
  (t) => (t < T - 45 ? 30 : 30 + (t - (T - 45)) * 0.4),        // flat, then a fresh jump
];
const long = {}; const bucket = []; const reads = [];
const start = dayNum("2024-02-08");
const end = dayNum(asOf);
for (let k = 0; k < 12; k += 1) {
  const id = `tcgcsv-${1000 + k}`;
  const f = shapes[k % shapes.length];
  const pts = [];
  for (let d = start; d <= end; d += 3) pts.push([d, Math.round(f(d - start) * (1 + k / 10) * 100) / 100]);
  const lp = pts.filter((p) => p[0] <= dayNum("2026-09-15"));
  long[id] = lp.map((p) => `${p[0]}:${p[1]}`).join(",");
  const night = []; for (let d = dayNum("2026-09-26"); d <= end; d += 1) { const near = pts.reduce((m, p) => (Math.abs(p[0] - d) < Math.abs(m[0] - d) ? p : m)); night.push([new Date(d * 864e5).toISOString().slice(0, 10), near[1]]); }
  bucket.push({ id, name: `Card ${k}`, num: `${k + 1}/100`, kind: "single", set: "Test Set", setSlug: "test-set", release: "2023-03-31", rarity: "Illustration Rare", printing: "Holofoil", hist: night });
  reads.push({ id: `year-${id}`, sku: id, readKind: "year", kind: "year", board: "hist", family: "price", name: `Card ${k}`, set: "Test Set", asOf, headline: `One year on: Card ${k}, up.`, receipt: { startDate: addDays(asOf, -365) } });
}
const sealedNight = []; for (let d = dayNum("2026-09-26"); d <= end; d += 1) sealedNight.push([new Date(d * 864e5).toISOString().slice(0, 10), Math.round((100 + (d - dayNum("2026-09-26")) * 1.5) * 100) / 100]);
bucket.push({ id: "tcgcsv-9000", name: "Test Set Elite Trainer Box", kind: "sealed", set: "Test Set", setSlug: "test-set", hist: sealedNight });
reads.push({ id: "sealed-tcgcsv-9000", sku: "tcgcsv-9000", readKind: "sealed", kind: "sealed", name: "Test Set Elite Trainer Box", asOf, headline: "Test Set Elite Trainer Box moved." });
reads.push({ id: "set-x", readKind: "rotation", kind: "rotation", name: "Rotation", asOf, headline: "Rotation watch: Test Set." });
await writeFile(join(pub, "hist-long/00.json"), JSON.stringify({ rows: long }));
await writeFile(join(pub, "buckets/00.json"), JSON.stringify(bucket));
await writeFile(join(pub, "sets.json"), JSON.stringify({ sets: [{ slug: "test-set", name: "Test Set", release: "2023-03-31" }] }));
await writeFile(join(pub, "set-value/test-set.json"), JSON.stringify({ master: { total: 512.5, priced: 12 } }));
await writeFile(join(pub, "rotation-status.json"), JSON.stringify({ sets: [{ slug: "test-set", status: "Standard" }] }));
await writeFile(join(pub, "listings-counted.json"), JSON.stringify({ products: [{ id: "test-etb", listingsCounted: { n: 30, date: asOf, prev: { n: 50, date: "2026-10-19" } } }] }));
await writeFile(join(root, "data/sealed-prices.json"), JSON.stringify({ updatedAt: `${asOf}T10:00:00Z`, products: [{ id: "test-etb", tcgPlayerId: "9000", ebayMedianAsk: 260, ebayMedianCount: 40 }] }));

const ctx = await loadContext(root, asOf, CFG);
const { reads: out, report } = synthesizeReads(reads, ctx, CFG);
const items = out.filter(isItemRead);
const done = items.filter((r) => r.synth);
t("every item read with data is rewritten", report.rewritten === items.length && done.length === items.length);
t("reads that are not about one item keep their copy", out.find((r) => r.id === "set-x").headline === "Rotation watch: Test Set.");

const open = new Map();
for (const r of done) { const k = openingKey(r.headline, [r.receipt.synth.title]); open.set(k, (open.get(k) || 0) + 1); }
const capN = Math.max(1, Math.floor(CFG.maxOpeningShare * items.length));
t("no single opening goes over the share cap", [...open.values()].every((n) => n <= capN));
t("the old one year opening is gone", done.every((r) => !r.headline.startsWith("One year on")));
t("each read cites at least 2 distinct signals", done.every((r) => new Set(r.receipt.synth.signals).size >= 2));
t("2 to 3 sentences", done.every((r) => { const n = r.headline.split(/(?<=[.])\s(?=[A-Z])/).length; return n >= 2 && n <= 3; }));
t("no advice, dashes, sold or sales", done.every((r) => !hasBannedWord(r.headline) && !/[\u2014\u2013]/.test(r.headline) && !/\b(sold|sales)\b/i.test(r.headline)));
const etb = done.find((r) => r.sku === "tcgcsv-9000");
t("sealed never gets a condition label", etb && !/\b(NM|Near Mint)\b/.test(etb.headline));
t("sealed read says listings counted or eBay asks from the files", etb && (/Listings counted|listings counted/.test(etb.headline) || /eBay asks/.test(etb.headline)));

// Every "$X on <date>" in the copy is a real point in that item's series, the ask, or set value.
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
let checked = 0; let bad = [];
for (const r of done) {
  const pts = ctx.series.get(r.sku);
  const ok = new Set(pts.map((p) => `${p[0]}|${p[1].toFixed(2)}`));
  for (const m of r.headline.matchAll(/\$([\d,]+\.\d{2}) on (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(?:, (\d{4}))?/g)) {
    const iso = `${m[4] || asOf.slice(0, 4)}-${String(MON[m[2]]).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    checked += 1;
    if (!ok.has(`${iso}|${Number(m[1].replace(/,/g, "")).toFixed(2)}`)) bad.push(`${r.id} ${m[0]}`);
  }
  const money = [...r.headline.matchAll(/\$([\d,]+\.\d{2})/g)].map((m) => Number(m[1].replace(/,/g, "")));
  const known = new Set([...pts.map((p) => p[1].toFixed(2)), "260.00", "512.50", CFG.peerMinPrice.toFixed(2)]);
  for (const v of money) if (!known.has(v.toFixed(2))) bad.push(`${r.id} $${v}`);
}
t(`dated prices match the source files (${checked} checked)`, checked > 0 && bad.length === 0);
if (bad.length) console.error(bad.slice(0, 5));
await rm(root, { recursive: true, force: true });

// Wording: "in line" only for a small set gap, and a one day spike is not a peak.
{
  const W = { ...CFG, peerInlineMaxPts: 2, spikeRatio: 1.6 };
  const day = (n) => addDays("2026-10-23", -n);
  const series = (fn) => { const pts = []; for (let n = 400; n >= 0; n -= 1) pts.push([day(n), fn(n)]); return pts; };
  const item = (pts) => ({ id: "x", pts, title: "Test Card", asOf: "2026-10-23", set: "Test Set", setSlug: "ts" });
  const ctx = { peers: new Map([["ts", { n: 40, median: -1.6 }]]), market: { n: 9000, median: 0.4 } };
  const shorts = (pts) => findings(item(pts), ctx, W).map((f) => f.short || "").join(" ");
  const down4 = series((n) => (n > 20 ? 15.27 : 14.66));
  t("a 2.4 point set gap is not called in line", !/in line/.test(shorts(down4)) && /trailing a -1\.6% median/.test(shorts(down4)));
  const down2 = series((n) => (n > 20 ? 10 : 9.8));
  t("a small set gap is still in line", /in line with a -1\.6% median/.test(shorts(down2)));
  const spiky = series((n) => (n === 200 ? 80 : n > 30 ? 6 : 5.5));
  const fs = findings(item(spiky), ctx, W);
  t("a one day spike is not used as the peak", !fs.some((f) => /\$80\.00/.test((f.text || "") + (f.short || ""))));
  const real = series((n) => (n > 150 && n < 220 ? 80 : n > 30 ? 6 : 5.5));
  t("a peak that held for weeks still counts", findings(item(real), ctx, W).some((f) => f.type === "drawdown" && /\$80\.00/.test(f.text)));
  t("without the private limits nothing changes", /in line/.test(findings(item(down4), ctx, { ...CFG, peerInlineMaxPts: undefined, spikeRatio: undefined }).map((f) => f.short || "").join(" ")));
}

if (fail) { console.error(`read synthesis: ${fail} failed`); process.exitCode = 1; }
