// Small per-item lookups for the site's card pages, so a page never parses the
// big shared files (catalogue-images 0.9 MB, ir-cycle 1.2 MB, condition-prices
// 0.4 MB) on each request. Cloudflare error 1102 came from that weight.
//   feed/card/img/<NN>.json   tcgcsv ids in bucket NN (id % 100) + set logos
//   feed/card/ir/<NN>.json    ir-cycle header + rows in bucket NN
//   feed/card/condition-note.json
//   feed/rating/peers/*.json  gain imgs {id: path} for their own rows
import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bucketOf } from "./write-item-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = (root) => join(root, "research/assets/public");
const readJ = async (p) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };
const isId = (k) => /^tcgcsv-\d+$/.test(k);

export function splitImages(images) {
  const logos = {};
  const out = {};
  for (const [k, v] of Object.entries(images || {})) {
    if (typeof v !== "string") continue;
    if (isId(k)) (out[bucketOf(k)] ||= {})[k] = v;
    else if (/\/logo\.png$/i.test(v)) logos[k] = v;
  }
  const all = {};
  for (let i = 0; i < 100; i++) { const b = String(i).padStart(2, "0"); all[b] = { ...logos, ...(out[b] || {}) }; }
  return all;
}

export function splitIr(doc) {
  if (!doc || !Array.isArray(doc.rows)) return {};
  const { rows, ...head } = doc;
  const out = {};
  for (let i = 0; i < 100; i++) out[String(i).padStart(2, "0")] = { ...head, rows: [] };
  for (const r of rows) if (r && isId(String(r.id || ""))) out[bucketOf(r.id)].rows.push(r);
  return out;
}

export async function writeCardLookups(root = ROOT) {
  const pub = PUB(root);
  const dir = join(pub, "feed/card");
  await rm(dir, { recursive: true, force: true });
  await mkdir(join(dir, "img"), { recursive: true });
  await mkdir(join(dir, "ir"), { recursive: true });
  const cat = await readJ(join(pub, "catalogue-images.json"));
  const images = cat?.images || {};
  if (cat) for (const [b, map] of Object.entries(splitImages(images))) await writeFile(join(dir, "img", `${b}.json`), JSON.stringify({ images: map }));
  const ir = await readJ(join(pub, "feed/ir-cycle.json"));
  for (const [b, doc] of Object.entries(splitIr(ir))) await writeFile(join(dir, "ir", `${b}.json`), JSON.stringify(doc));
  const cond = await readJ(join(root, "data/derived/condition-prices.json"));
  if (cond) await writeFile(join(dir, "condition-note.json"), JSON.stringify({ asOf: cond.asOf || "", note: cond.note || "", source: cond.source || "", nmDefault: cond.nmDefault === true }));
  const peersDir = join(pub, "feed/rating/peers");
  let pools = 0;
  for (const f of await readdir(peersDir).catch(() => [])) {
    if (!f.endsWith(".json")) continue;
    const doc = await readJ(join(peersDir, f));
    if (!doc || !Array.isArray(doc.rows)) continue;
    const imgs = {};
    for (const r of doc.rows) { const id = Array.isArray(r) ? r[0] : r?.id; if (typeof images[id] === "string") imgs[id] = images[id]; }
    doc.imgs = imgs;
    await writeFile(join(peersDir, f), JSON.stringify(doc));
    pools++;
  }
  return { images: !!cat, ir: !!ir, cond: !!cond, pools };
}

if (process.argv[1] && process.argv[1].endsWith("write-card-lookups.mjs")) console.log("card lookups:", JSON.stringify(await writeCardLookups()));
