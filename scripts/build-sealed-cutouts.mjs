// Build transparent sealed cutouts for every priced product.
// Factors are read from the private scale file. Without that file this exits
// and does not invent sizes. A failed cut is listed and the old image stays.
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { productTypeOf, nameAgrees, sourceFor, targetHeight, judgeCut, cutoutRow } from "./lib/sealed-cutouts.mjs";

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

function runPython(jobPath, outPath) {
  const script = join(ROOT, "scripts", "sealed-cutout-cut.py");
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [script, jobPath, outPath], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("cutter exited " + code))));
  });
}

const scale = JSON.parse(await readFile(scalePath(), "utf8"));
const prices = await loadJson(join(ROOT, "data/sealed-prices.json"));
let overrides = {};
try { overrides = (await loadJson(join(ROOT, "data/image-overrides.json"))).products || {}; } catch { overrides = {}; }
let crosscheck = {};
try {
  const cm = await loadJson(join(ROOT, "data/crosscheck-id-map.json"));
  for (const e of cm.entries || []) if (e.reviewed && !e.exclude && e.tcgPlayerId) crosscheck[e.id] = e.tcgPlayerId;
} catch { crosscheck = {}; }

const products = (prices.products || []).filter((p) => p && p.id && (!ONLY.size || ONLY.has(p.id)));
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
    skipped.push({ product, type, reason: "no scale for this product type" });
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
    rows.push(cutoutRow(product, { pass: false, productType: skip.type || "" }));
    review.push({ id: product.id, productType: skip.type || "", reason: skip.reason, kept: "old image" });
    continue;
  }
  const hit = metrics[product.id] || {};
  const reasons = judgeCut(hit.flags || { download: false });
  const pass = reasons.length === 0 && hit.pass === true;
  if (!pass) {
    rows.push(cutoutRow(product, { pass: false, productType: hit.productType || productTypeOf(product) }));
    review.push({ id: product.id, productType: hit.productType || productTypeOf(product), reason: reasons.join(", ") || "no cutout", kept: "old image" });
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

rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
review.sort((a, b) => String(a.id).localeCompare(String(b.id)));
const doc = {
  asOf: String(prices.updatedAt || "").slice(0, 10),
  note: "Cutouts for priced sealed products. A fail keeps the old image and is also on the review list. Pixel height already includes the shared scale. Factors are not in this repo.",
  passed: rows.filter((r) => r.pass).length,
  failed: rows.filter((r) => !r.pass).length,
  products: rows,
};
const reviewDoc = {
  asOf: doc.asOf,
  note: "These priced sealed products kept their old image. A broken cutout was not written.",
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
console.log(`passed ${doc.passed} review ${review.length} of ${products.length}`);
