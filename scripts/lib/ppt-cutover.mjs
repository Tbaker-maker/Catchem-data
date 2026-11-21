// Decides whether a PPT dataset can move to a PkmnPrices file we already have.
// A missing limits file, or a count under that minimum, does not write and
// does not copy the PPT file. PPT_OFF does not open the PPT path at all.
import { join } from "node:path";
import { countJsonFiles, loadReplaceLimits, HISTORY_PPP, HISTORY_PPT, SHAPE_PPP, SHAPE_PPT, VOLUME_PPP, VOLUME_PPT, CROSS_PPP, CROSS_PPT } from "./ppp-replace.mjs";
import { isPptDataPath, pptOff } from "./ppt-off.mjs";

export const DATASETS = [
  {
    id: "listings-counted",
    label: "listings counted volume",
    ppt: VOLUME_PPT,
    ppp: VOLUME_PPP,
    minKey: "volumeMinCards",
    kind: "cards",
    fallback: "Drop the field. eBay sales rows are not TCGplayer Near Mint listings counted, and our eBay listings counted table is a different count.",
  },
  {
    id: "shape-facts",
    label: "shape facts",
    ppt: SHAPE_PPT,
    ppp: SHAPE_PPP,
    minKey: "shapeMinCards",
    kind: "cards",
    fallback: "Drop the field. A sealed unopened history row is not a card shape fact.",
  },
  {
    id: "crosscheck",
    label: "PPP versus PPT crosscheck",
    ppt: CROSS_PPT,
    ppp: CROSS_PPP,
    minKey: "crosscheckMinProducts",
    kind: "products",
    fallback: "Do not invent the missing sealed prices. Public sealed prices already come from TCGCSV. The Spread stays held.",
  },
  {
    id: "sealed-history",
    label: "sealed price history",
    ppt: HISTORY_PPT,
    ppp: HISTORY_PPP,
    minKey: "sealedHistoryMinProducts",
    kind: "files",
    fallback: "Keep chartFill off. TCGCSV days we already store are a separate series. Do not fill gaps from PPT.",
  },
];

function cardCount(doc) {
  if (!doc || typeof doc !== "object") return 0;
  if (Number.isInteger(doc?.counts?.cards)) return doc.counts.cards;
  if (doc.cards && typeof doc.cards === "object") return Object.keys(doc.cards).length;
  return 0;
}

function productCount(doc) {
  if (!doc || typeof doc !== "object") return 0;
  if (Array.isArray(doc.products)) return doc.products.length;
  return 0;
}

export async function datasetCoverage(root, { readJson, env = process.env } = {}) {
  if (typeof readJson !== "function") throw new Error("datasetCoverage needs readJson");
  const limits = await loadReplaceLimits(root);
  const off = pptOff(env);
  const rows = [];
  for (const ds of DATASETS) {
    const pppPath = join(root, ds.ppp);
    let pppN = 0;
    if (ds.kind === "files") pppN = await countJsonFiles(pppPath);
    else if (ds.kind === "products") pppN = productCount(await readJson(pppPath));
    else pppN = cardCount(await readJson(pppPath));
    let pptN = null;
    if (!off) {
      const pptPath = join(root, ds.ppt);
      if (ds.kind === "files") pptN = await countJsonFiles(pptPath);
      else if (ds.kind === "products") pptN = productCount(await readJson(pptPath));
      else pptN = cardCount(await readJson(pptPath));
    }
    const min = limits ? limits[ds.minKey] : null;
    const switched = min != null && pppN >= min;
    rows.push({
      id: ds.id,
      label: ds.label,
      ppt: ds.ppt,
      ppp: ds.ppp,
      pptRead: !off,
      pptN,
      pppN,
      min,
      switched,
      use: switched ? ds.ppp : null,
      fallback: switched ? "" : ds.fallback,
    });
  }
  return {
    pptOff: off,
    limits: limits ? "present" : "missing",
    ready: rows.every((row) => row.switched),
    rows,
  };
}

export function coverageReadsPpt(paths) {
  return (paths || []).some((path) => isPptDataPath(path) && !String(path).includes("-ppp"));
}
