// Cover every sealed id the site can show. A real cut runs only when the
// private scale file is present. Without it, the id is blocked with that
// reason. No size is invented and no pass is written.
import { access, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { showableProducts, uncoveredCutouts } from "./sealed-cutouts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function scalePath(root) {
  if (process.env.CUTOUT_SCALE_FILE) return process.env.CUTOUT_SCALE_FILE;
  return join(root, "..", "catchem-data-private", "data", "private", "cutout-scale.json");
}

async function load(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function writeBlocked(root, prices, cuts, review, missing, reason) {
  const extra = uncoveredCutouts(missing, [], review.products || [], reason);
  const products = [...(cuts.products || []), ...extra.rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const notes = [...(review.products || []), ...extra.notes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const doc = {
    asOf: String(prices.updatedAt || cuts.asOf || "").slice(0, 10),
    note: cuts.note || "Cutouts for sealed products the site can show. A fail is listed and the file is not shipped. Pixel height already includes the shared scale. Factors are not in this repo.",
    passed: products.filter((row) => row.pass).length,
    failed: products.filter((row) => !row.pass).length,
    products,
  };
  const reviewDoc = {
    asOf: doc.asOf,
    note: review.note || "These sealed products have no cutout. A broken cutout was not written.",
    count: notes.length,
    products: notes,
  };
  const text = JSON.stringify(doc, null, 2) + "\n";
  await writeFile(join(root, "data/sealed-cutouts.json"), text);
  await writeFile(join(root, "research/assets/public/sealed-cutouts.json"), text);
  await writeFile(join(root, "data/sealed-cutout-review.json"), JSON.stringify(reviewDoc, null, 2) + "\n");
  return extra.rows.length;
}

export async function ensureShowableCutouts(root = ROOT) {
  const prices = await load(join(root, "data/sealed-prices.json"), { products: [] });
  const catalog = await load(join(root, "data/sealed-products.json"), []);
  const reads = await load(join(root, "research/assets/public/reads.json"), { reads: [] });
  const cuts = await load(join(root, "data/sealed-cutouts.json"), { products: [] });
  const review = await load(join(root, "data/sealed-cutout-review.json"), { products: [] });
  const show = showableProducts(prices.products || [], Array.isArray(catalog) ? catalog : [], reads);
  const have = new Set((cuts.products || []).map((row) => row && row.id).filter(Boolean));
  const missing = show.filter((product) => product && product.id && !have.has(product.id));
  if (!missing.length) return { missing: 0, blocked: 0, cut: false };
  let scaleOk = false;
  try { await access(scalePath(root)); scaleOk = true; } catch { scaleOk = false; }
  if (!scaleOk) {
    const reason = "no scale file, so no cutout was built";
    const blocked = await writeBlocked(root, prices, cuts, review, missing, reason);
    return { missing: missing.length, blocked, cut: false, reason };
  }
  const ids = missing.map((product) => product.id).join(",");
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, "scripts/build-sealed-cutouts.mjs")], {
      cwd: root,
      env: { ...process.env, ONLY_IDS: ids },
      stdio: "inherit",
    });
    child.on("error", () => resolve(1));
    child.on("exit", (status) => resolve(status ?? 1));
  });
  if (code !== 0) {
    const reason = "cutout build failed, so no cutout was built";
    const again = await load(join(root, "data/sealed-cutouts.json"), cuts);
    const againReview = await load(join(root, "data/sealed-cutout-review.json"), review);
    const still = missing.filter((product) => !(again.products || []).some((row) => row.id === product.id));
    const blocked = await writeBlocked(root, prices, again, againReview, still, reason);
    return { missing: missing.length, blocked, cut: false, reason };
  }
  return { missing: missing.length, blocked: 0, cut: true };
}
