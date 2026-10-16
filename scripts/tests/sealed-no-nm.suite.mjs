import { readFile } from "node:fs/promises";
import { dropSealedNm, mixedLeaks, plainSealedText, publishedFiles, scrubTree, sealedLeaks } from "../lib/sealed-condition.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  t("a sealed feed line drops NM and the arrow", plainSealedText("First Partner Pack (Alola) (First Partner Pack) is up 5% this week: $23.54 NM → $24.71 NM.", "First Partner Pack (Alola)") === "First Partner Pack (Alola) is up 5% this week, from $23.54 to $24.71.");
  t("a sealed dated line drops NM", plainSealedText("Box: $380.00 NM (Oct 7) to $516.33 NM (Oct 14) on TCGplayer market.") === "Box: $380.00 (Oct 7) to $516.33 (Oct 14) on TCGplayer market.");
  t("a repeated set name is dropped", plainSealedText("Delta Reign Elite Trainer Box (Delta Reign) is down 8.6%.", "Delta Reign Elite Trainer Box") === "Delta Reign Elite Trainer Box is down 8.6%.");
  const doc = { rows: [{ kind: "sealed", name: "ETB", headline: "ETB $10.00 NM" }, { kind: "single", name: "Pikachu", headline: "Pikachu $5.00 NM" }] };
  scrubTree(doc);
  t("singles keep NM, sealed lose it", doc.rows[0].headline === "ETB $10.00" && doc.rows[1].headline === "Pikachu $5.00 NM");
  t("a sealed vs top card line keeps NM only on the card", dropSealedNm("Sealed vs its top card, Booster Boxes: Chaos Rising Booster Box is $185.71 NM (Sep 26) and its set's top card Mew is $600.00 NM, 3.2x.") === "Sealed vs its top card, Booster Boxes: Chaos Rising Booster Box is $185.71 (Sep 26) and its set's top card Mew is $600.00 NM, 3.2x.");
  t("a sealed dated pair drops NM", dropSealedNm("Chaos Rising Booster Box: $185.71 NM (Sep 26) to $183.74 NM (Oct 16).") === "Chaos Rising Booster Box: $185.71 (Sep 26) to $183.74 (Oct 16).");
  t("rip value keeps NM, the box price drops it", dropSealedNm("Team Up Booster Box: rip value $284.04 NM is 2.4% of the $11,650.00 NM market price.") === "Team Up Booster Box: rip value $284.04 NM is 2.4% of the $11,650.00 market price.");
  t("a single from a Collection set keeps NM", dropSealedNm("Charizard (Legendary Collection) 003/110, Holo Rare: $899.99 NM.") === "Charizard (Legendary Collection) 003/110, Holo Rare: $899.99 NM.");
  t("a single keeps NM", dropSealedNm("Dark Blastoise (Legendary Collection) 004/110: $213.49 NM (Sep 13) to $274.99 NM (Oct 16).").includes("$274.99 NM"));
  t("a singles total keeps NM", dropSealedNm("Chaos Rising: 119 singles add up to 2.51x the Chaos Rising Booster Box tonight. 119 singles: $537.55 NM (Sep 26).").includes("$537.55 NM"));
  const mixed = [];
  for (const path of await publishedFiles(process.cwd())) {
    let d; try { d = JSON.parse(await readFile(path, "utf8")); } catch { continue; }
    mixedLeaks(d, mixed, path);
  }
  t(`no published text pairs a sealed price with NM (${mixed.length})`, mixed.length === 0);
  if (mixed.length) console.error(mixed.slice(0, 10).join("\n"));
  const leaks = [];
  for (const path of await publishedFiles(process.cwd())) {
    let d; try { d = JSON.parse(await readFile(path, "utf8")); } catch { continue; }
    sealedLeaks(d, leaks, path);
  }
  t(`no published sealed text says NM or Near Mint (${leaks.length})`, leaks.length === 0);
  if (leaks.length) console.error(leaks.slice(0, 10).join("\n"));
  return fail;
}
