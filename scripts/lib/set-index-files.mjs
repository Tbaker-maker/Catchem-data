// Compact chain-linked set index for the sparkline and the Indexes set chart.
// Same points as sets/<slug>.json singleIndex and sealedIndex. Null days are
// left out. A missing day is a gap on the chart, not a new series.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function compactSide(raw) {
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.points) ? raw.points : []);
  const out = [];
  for (const p of rows) {
    const d = String(Array.isArray(p) ? p[0] : p?.d || "").slice(0, 10);
    const v = Number(Array.isArray(p) ? p[1] : p?.v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !(v > 0)) continue;
    out.push([d, v]);
  }
  return out;
}

export async function writeSetIndexFile(outDir, { slug, name, asOf, single, sealed }) {
  const doc = {
    slug,
    name: name || slug,
    asOf: asOf || "",
    single: compactSide(single),
    sealed: compactSide(sealed),
  };
  const dir = join(outDir, "feed", "set-index");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${slug}.json`), JSON.stringify(doc));
  return { slug, name: doc.name, single: doc.single.length, sealed: doc.sealed.length };
}
