// Build transparent sealed cutouts for every sealed product the public site
// shows from the priced file, the public feed, and the named feed holes.
// Factors are read from the private scale file. Without that file this exits
// and does not invent sizes. A failed cut is removed. It is not shipped.
import { readFile, writeFile, mkdir, unlink, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { productTypeOf, nameAgrees, sourceFor, targetHeight, judgeCut, cutoutRow, showableProducts } from "./lib/sealed-cutouts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_PX = 960;
const ONLY = new Set(String(process.env.ONLY_IDS || "").split(",").map((s) => s.trim()).filter(Boolean));

function scalePath() {
  if (process.env.CUTOUT_SCALE_FILE) return process.env.CUTOUT_SCALE_FILE;
  return join(ROOT, "..", "catchem-data-private", "data", "private", "cutout-scale.json");
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

// A source under the cutter's 360px floor is blocked. No size is invented.
async function sourceTooSmall(url) {
  if (!url) return false;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      return h < 360 || w < 70;
    }
    // JPEG: scan for a SOF marker.
    for (let i = 2; i < buf.length - 9; i++) {
      if (buf[i] !== 0xff) continue;
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const h = buf.readUInt16BE(i + 5), w = buf.readUInt16BE(i + 7);
        return h < 360 || w < 70;
      }
    }
    return false;
  } catch { return false; }
}

function runPython(jobPath, outPath) {
  const script = join(ROOT, "scripts", "sealed-cutout-cut.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [script, jobPath, outPath], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("cutter exited " + code))));
  });
}

let scale = null;
try { scale = JSON.parse(await readFile(scalePath(), "utf8")); }
catch {
  if (!ONLY.size) {
    console.error("cutout scale file is missing. No sizes were invented and no file was rewritten.");
    process.exit(1);
  }
  console.log("cutout scale file is missing. Named ids with no traced build are blocked. No sizes were invented.");
}
const prices = await loadJson(join(ROOT, "data/sealed-prices.json"));
const catalog = await loadJson(join(ROOT, "data/sealed-products.json")).catch(() => []);
const reads = await loadJson(join(ROOT, "research/assets/public/reads.json")).catch(() => ({ reads: [] }));
let overrides = {};
try { overrides = (await loadJson(join(ROOT, "data/image-overrides.json"))).products || {}; } catch { overrides = {}; }
let crosscheck = {};
try {
  const cm = await loadJson(join(ROOT, "data/crosscheck-id-map.json"));
  for (const e of cm.entries || []) if (e.reviewed && !e.exclude && e.tcgPlayerId) crosscheck[e.id] = e.tcgPlayerId;
} catch { crosscheck = {}; }

const wantsOnly = (p) => ONLY.has(p.id) || ONLY.has("tcgcsv-" + (Number(p.tcgPlayerId) || ""));
const showable = showableProducts(prices.products || [], Array.isArray(catalog) ? catalog : [], reads);
// ONLY_IDS may name catalogue ids that tonight's reads will show but the
// checked-in reads file does not mention yet, so look them up in the catalogue too.
const extraOnly = ONLY.size && Array.isArray(catalog)
  ? catalog.filter((p) => p && p.id && wantsOnly(p) && !showable.some((s) => s.id === p.id))
  : [];
const products = showable.concat(extraOnly).filter((p) => p && p.id && (!ONLY.size || wantsOnly(p)));
const job = [];
const skipped = [];
for (const product of products) {
  const type = productTypeOf(product);
  if (!type || !nameAgrees(product.name, type)) {
    skipped.push({ product, type, reason: "name does not match the product type" });
    continue;
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(product.id)) {
    skipped.push({ product, type, reason: "product id cannot be a file name" });
    continue;
  }
  const height = targetHeight(type, scale, BASE_PX);
  if (height == null) {
    if (scale) {
      skipped.push({ product, type, reason: "no scale for this product type" });
      continue;
    }
    // No scale file: do not invent a size. The row is blocked below as no traced build.
    skipped.push({ product, type, reason: "no traced cutout build", noScale: true });
    continue;
  }
  const src = sourceFor(product, { overrides, crosscheck });
  if (!src.url) {
    skipped.push({ product, type, reason: src.reason || "no allowed photo" });
    continue;
  }
  job.push({ id: product.id, url: src.url, height, productType: type });
}

const outDir = join(ROOT, "research/assets/public/cutouts");
await mkdir(outDir, { recursive: true });
const jobPath = join(ROOT, "data/.sealed-cutout-job.json");
const metricsPath = join(ROOT, "data/.sealed-cutout-metrics.json");
await writeFile(jobPath, JSON.stringify({ outDir, items: job }));
if (job.length) await runPython(jobPath, metricsPath);
const metrics = job.length ? JSON.parse(await readFile(metricsPath, "utf8")) : {};

const rows = [];
const review = [];
for (const product of products) {
  const skip = skipped.find((s) => s.product.id === product.id);
  if (skip) {
    let reason = skip.reason;
    if (skip.noScale) {
      const tiny = await sourceTooSmall(sourceFor(product, { overrides, crosscheck }).url);
      if (tiny) reason = "source photo is too small";
    }
    rows.push(cutoutRow(product, { pass: false, productType: skip.type || "" }));
    review.push({ id: product.id, productType: skip.type || "", reason, kept: "not shipped" });
    continue;
  }
  const hit = metrics[product.id] || {};
  const traced = Object.prototype.hasOwnProperty.call(metrics, product.id);
  const reasons = traced ? judgeCut(hit.flags || { download: false }) : [];
  const pass = traced && reasons.length === 0 && hit.pass === true;
  if (!pass) {
    await unlink(join(outDir, product.id + ".png")).catch(() => {});
    await unlink(join(outDir, product.id + ".webp")).catch(() => {});
    let reason = traced ? (reasons.join(", ") || "no cutout") : "no traced cutout build";
    if (!traced) {
      const tiny = await sourceTooSmall(sourceFor(product, { overrides, crosscheck }).url);
      if (tiny) reason = "source photo is too small";
    }
    rows.push(cutoutRow(product, { pass: false, productType: hit.productType || productTypeOf(product) }));
    review.push({ id: product.id, productType: hit.productType || productTypeOf(product), reason, kept: "not shipped" });
    continue;
  }
  rows.push(cutoutRow(product, {
    pass: true,
    productType: hit.productType,
    file: `cutouts/${product.id}.webp`,
    png: `cutouts/${product.id}.png`,
    width: hit.width,
    height: hit.height,
  }));
}

// ONLY_IDS rebuilds a few products. Keep every other row as it was instead of
// writing a file that holds only those few.
if (ONLY.size) {
  const done = new Set(rows.map((r) => r.id));
  let oldCuts = { products: [] };
  let oldReview = { products: [] };
  try { oldCuts = await loadJson(join(ROOT, "data/sealed-cutouts.json")); } catch {}
  try { oldReview = await loadJson(join(ROOT, "data/sealed-cutout-review.json")); } catch {}
  for (const row of oldCuts.products || []) if (!done.has(row.id)) rows.push(row);
  for (const row of oldReview.products || []) if (!done.has(row.id)) review.push(row);
}
rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
review.sort((a, b) => String(a.id).localeCompare(String(b.id)));
const doc = {
  asOf: String(prices.updatedAt || "").slice(0, 10),
  note: "Cutouts for sealed products the site can show. A fail is listed and the file is not shipped. Pixel height already includes the shared scale. Factors are not in this repo.",
  passed: rows.filter((r) => r.pass).length,
  failed: rows.filter((r) => !r.pass).length,
  products: rows,
};
const reviewDoc = {
  asOf: doc.asOf,
  note: "These sealed products have no cutout. A broken cutout was not written.",
  count: review.length,
  products: review,
};
const text = JSON.stringify(doc, null, 2) + "\n";
await writeFile(join(ROOT, "data/sealed-cutouts.json"), text);
await mkdir(join(ROOT, "research/assets/public"), { recursive: true });
await writeFile(join(ROOT, "research/assets/public/sealed-cutouts.json"), text);
await writeFile(join(ROOT, "data/sealed-cutout-review.json"), JSON.stringify(reviewDoc, null, 2) + "\n");
await unlink(jobPath).catch(() => {});
await unlink(metricsPath).catch(() => {});
if (!ONLY.size) {
  const keep = new Set();
  for (const row of rows) if (row.pass) {
    keep.add(row.id + ".png");
    keep.add(row.id + ".webp");
  }
  for (const name of await readdir(outDir)) {
    if (!/^[A-Za-z0-9._-]+\.(png|webp)$/i.test(name)) continue;
    if (!keep.has(name)) await unlink(join(outDir, name)).catch(() => {});
  }
}
console.log(`passed ${doc.passed} review ${review.length} of ${products.length}`);
