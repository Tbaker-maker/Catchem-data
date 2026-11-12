// Writes a throwaway repo root holding the made-up PkmnPrices fixture, own
// TCGplayer days, listings counted, MSRP and ECB rates. Tests only.
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureCatalog, fixtureDocs } from "./make-fixture.mjs";

export async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), "ppp-reads-"));
  const cat = fixtureCatalog();
  await mkdir(join(root, "data/history/tcgcsv-daily"), { recursive: true });
  for (const d of cat.daily) await writeFile(join(root, "data/history/tcgcsv-daily", `${d.date}.json`), JSON.stringify({ date: d.date, prices: d.prices }));
  await mkdir(join(root, "data/derived/listing-counts/history"), { recursive: true });
  for (const l of cat.listings) await writeFile(join(root, "data/derived/listing-counts/history", `${l.date}.json.gz`), gzipSync(JSON.stringify({ date: l.date, rows: l.rows })));
  await writeFile(join(root, "data/msrp-sourced.json"), JSON.stringify(cat.msrp));
  await mkdir(join(root, "data/derived/fx"), { recursive: true });
  await writeFile(join(root, "data/derived/fx/ecb-eur-usd.json"), JSON.stringify({ source: "fixture", rates: cat.fx }));
  await mkdir(join(root, "data/private/ppp/reads-input"), { recursive: true });
  const docs = fixtureDocs();
  for (const [i, doc] of docs.entries()) await writeFile(join(root, "data/private/ppp/reads-input", `night-${i}.json`), JSON.stringify(doc));
  return { root, catalog: { asOf: cat.asOf, items: cat.items } };
}
