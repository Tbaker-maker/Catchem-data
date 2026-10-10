// The raw TCGCSV archive keeps every field of every row, and stores a group's
// products again only when they changed.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { writeRawDay } from "../fetch-tcgcsv-catalog.mjs";

export async function runTcgcsvRawTests() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };
  const root = await mkdtemp(join(tmpdir(), "raw-"));
  const lines = async (day, f) => gunzipSync(await readFile(join(root, "data/history/tcgcsv-daily/raw", day, f))).toString().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const man = async (day) => JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily/raw", day, "manifest.json"), "utf8"));
  const price = { productId: 1, lowPrice: 1, midPrice: 2, highPrice: 3, marketPrice: 2.5, directLowPrice: null, subTypeName: "Reverse Holofoil" };
  const a = { groupId: 10, products: [{ productId: 1, name: "A" }], prices: [price, { ...price, subTypeName: "Normal" }] };
  const b = { groupId: 11, products: [{ productId: 2, name: "B" }], prices: [] };
  try {
    await writeRawDay(root, "2026-10-09", { groups: [{ groupId: 10 }, { groupId: 11 }], parts: [a, b], failedGroups: [] });
    const p = await lines("2026-10-09", "prices.ndjson.gz");
    t("every printing row kept", p.length === 2);
    t("every price field kept", ["lowPrice", "midPrice", "highPrice", "marketPrice", "directLowPrice", "subTypeName"].every((k) => k in p[0]));
    t("first day stores all product groups", (await lines("2026-10-09", "products.ndjson.gz")).length === 2);
    const b2 = { ...b, products: [{ productId: 2, name: "B2" }] };
    await writeRawDay(root, "2026-10-10", { groups: [], parts: [a, b2], failedGroups: [] });
    const pr = await lines("2026-10-10", "products.ndjson.gz");
    t("unchanged group not stored again", pr.length === 1 && pr[0].name === "B2");
    const m = await man("2026-10-10");
    t("manifest points unchanged group at the earlier day", m.productGroups[10].day === "2026-10-09" && m.productGroups[11].day === "2026-10-10");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  console.log(fail ? `${fail} failed` : "tcgcsv raw ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (await runTcgcsvRawTests()) process.exit(1);
}
