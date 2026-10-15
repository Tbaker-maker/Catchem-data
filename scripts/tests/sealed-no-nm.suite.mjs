import { readFile } from "node:fs/promises";
import { plainSealedText, publishedFiles, scrubTree, sealedLeaks } from "../lib/sealed-condition.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  t("a sealed feed line drops NM and the arrow", plainSealedText("First Partner Pack (Alola) (First Partner Pack) is up 5% this week: $23.54 NM → $24.71 NM.", "First Partner Pack (Alola)") === "First Partner Pack (Alola) is up 5% this week, from $23.54 to $24.71.");
  t("a sealed dated line drops NM", plainSealedText("Box: $380.00 NM (Oct 7) to $516.33 NM (Oct 14) on TCGplayer market.") === "Box: $380.00 (Oct 7) to $516.33 (Oct 14) on TCGplayer market.");
  t("a repeated set name is dropped", plainSealedText("Delta Reign Elite Trainer Box (Delta Reign) is down 8.6%.", "Delta Reign Elite Trainer Box") === "Delta Reign Elite Trainer Box is down 8.6%.");
  const doc = { rows: [{ kind: "sealed", name: "ETB", headline: "ETB $10.00 NM" }, { kind: "single", name: "Pikachu", headline: "Pikachu $5.00 NM" }] };
  scrubTree(doc);
  t("singles keep NM, sealed lose it", doc.rows[0].headline === "ETB $10.00" && doc.rows[1].headline === "Pikachu $5.00 NM");
  const leaks = [];
  for (const path of await publishedFiles(process.cwd())) {
    let d; try { d = JSON.parse(await readFile(path, "utf8")); } catch { continue; }
    sealedLeaks(d, leaks, path);
  }
  t(`no published sealed text says NM or Near Mint (${leaks.length})`, leaks.length === 0);
  if (leaks.length) console.error(leaks.slice(0, 10).join("\n"));
  return fail;
}
