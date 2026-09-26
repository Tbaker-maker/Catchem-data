import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadMarketHistory } from "../lib/market-history.mjs";
import { readCrosscheck } from "../lib/ppt-paths.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export async function runPptPathTests() {
  fail = 0;
  const root = await mkdtemp(join(tmpdir(), "ppt-paths-"));
  const missing = await readCrosscheck(root, "sealed-crosscheck.json");
  t("missing crosscheck is null", missing === null);
  const hist = await loadMarketHistory(root);
  t("missing history does not throw", hist.coverage.pptProducts === 0 && hist.ids.length === 0);
  await mkdir(join(root, "data/history/ppt-sealed-private"), { recursive: true });
  await writeFile(join(root, "data/history/ppt-sealed-private", "box.json"), JSON.stringify({
    id: "box",
    points: [{ date: "2026-09-26", market: 10 }],
  }));
  const mounted = await loadMarketHistory(root);
  t("private mount is read", mounted.coverage.pptProducts === 1 && mounted.priceMap.get("box").get("2026-09-26") === 10);
  console.log(fail ? `${fail} failed` : "ppt paths ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runPptPathTests();
  if (n) process.exit(1);
}
