import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { valueOn } from "../lib/deep-reads.mjs";
import { realLabel } from "../lib/deep-reads-2.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BANNED = /\b(buy|sell|hold|held|holding|support|resistance|bottom|printed|play|target|invest|moon|pump|dump|hodl|crypto)\b/i;

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const pts = [["2026-09-01", 10], ["2026-09-10", 20]];
  t("valueOn uses the last real point inside 8 days", valueOn(pts, "2026-09-12") === 20 && valueOn(pts, "2026-09-30") == null);
  t("SV Illustration Rare stays IR, SIR stays SIR", realLabel({ rarity: "Illustration Rare", release: "2024-03-22" }) === "Illustration Rare" && realLabel({ rarity: "Special Illustration Rare", release: "2024-03-22" }) === "Special Illustration Rare");
  t("Alternate Art only on Sword & Shield", realLabel({ rarity: "Secret Rare", release: "2021-08-27" }, ["Alternate Art"]) === "Alternate Art" && realLabel({ rarity: "Ultra Rare", release: "2019-02-01" }, ["Alternate Art"]) === "Ultra Rare");
  t("SM Tag Team alt art is Tag Team (Alternate Art), never Alternate Art", realLabel({ rarity: "Ultra Rare", release: "2019-02-01" }, ["Tag Team (Alternate Art)", "Alternate Art", "Tag Team"]) === "Tag Team (Alternate Art)");
  t("Trainer Gallery and Galarian Gallery only on Sword & Shield", realLabel({ rarity: "Ultra Rare", release: "2022-09-09" }, ["Trainer Gallery"]) === "Trainer Gallery" && realLabel({ rarity: "Ultra Rare", release: "2023-01-20" }, ["Galarian Gallery"]) === "Galarian Gallery" && realLabel({ rarity: "Ultra Rare", release: "2024-01-01" }, ["Trainer Gallery"]) === "Ultra Rare");
  const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
  const rows = doc.reads || [];
  const deep = rows.filter((r) => r.readKind === "deep");
  const price = rows.filter((r) => r.board !== "v3" || r.priceRead === true);
  t("board is 200 to 400 reads", rows.length >= 200 && rows.length <= 400);
  t("price reads are at most 40%", price.length <= Math.floor(rows.length * 0.4) + 1);
  t("deep reads exist", deep.length >= 20);
  t("each deep read has 3 to 6 lines, a source and a date", deep.every((r) => Array.isArray(r.lines) && r.lines.length >= 3 && r.lines.length <= 6 && r.source && /^\d{4}-\d{2}-\d{2}$/.test(r.asOf)));
  t("deep charts carry points or bars", deep.every((r) => !r.chart || (Array.isArray(r.chart.points) && r.chart.points.length >= 2) || (Array.isArray(r.chart.bars) && r.chart.bars.length >= 2)));
  t("deep text has no em dash or banned word", deep.every((r) => ![r.headline, ...r.lines].some((s) => /\u2014/.test(s) || BANNED.test(s))));
  const ir = deep.find((r) => r.deep === "irlife");
  t("Pokemon spotlights name a real species", deep.filter((r) => r.deep === "pokemon").every((r) => String(r.name).length >= 3));
  t("sealed gap lines say how they matched and never call a pack a box", deep.filter((r) => r.deep === "sealedgap").every((r) => !/the box/.test(r.headline) && !/product id/.test(r.lines.join(" "))));
  t("IR lifecycle names the holo baseline", !ir || ir.lines.some((l) => /holo/i.test(l)));
  const artists = JSON.parse(await readFile(join(ROOT, "research/assets/public/artists.json"), "utf8"));
  const slugs = new Set((artists.artists || []).map((a) => a.slug));
  t("artist spotlights link to a real artist page", deep.filter((r) => r.deep === "artist").every((r) => slugs.has(String(r.href).replace("/artists/", ""))));
  const keys = rows.map((r) => r.href || r.id);
  t("no two reads share a link, so the Feed keeps every one", new Set(keys).size === keys.length);
  const cardKinds = new Set(["card", "recovery", "slump", "printings", "samelabel", "chase", "artist", "pokemon", "steady", "bigyear"]);
  t("card reads never mention sealed data", deep.filter((r) => cardKinds.has(r.deep)).every((r) => ![r.headline, ...r.lines, r.source].some((s) => /\b(sealed|booster|elite trainer box|etb)\b/i.test(String(s)) && !/singles only/.test(String(s)))));
  t("no 'peer' jargon on the board", rows.every((r) => ![r.headline, r.path, r.source, r.why, ...(r.lines || [])].some((s) => /\bpeers?\b/i.test(String(s || "")))));
  t("new deep types are on the board", ["printings", "samelabel", "chase", "slump"].every((k) => deep.some((r) => r.deep === k)));
  t("an IR or SIR label only on a Scarlet & Violet or later card", deep.filter((r) => ["printings", "samelabel", "chase", "slump"].includes(r.deep)).every((r) => r.lines.every((l) => !/Illustration Rare/.test(l) || !/(Evolving Skies|Team Up|Hidden Fates|Cosmic Eclipse|Brilliant Stars)/.test(l))));
  if (ir) {
    const headHolo = (ir.headline.match(/Plain holos from the same sets: (-?\d+)%/) || [])[1];
    const lineHolo = ir.lines.map((l) => (l.match(/^Holo baseline: plain holos from those 2023-24 sets rose a median (-?\d+)%/) || [])[1]).find(Boolean);
    t("IR lifecycle: the expanded holo baseline matches the headline", headHolo != null && headHolo === lineHolo && String(Math.round(ir.receipt.h1 * 100)) === headHolo);
    t("IR lifecycle: the 6-month holo line names its own window", ir.lines.every((l) => !/same sets and window/.test(l)) && ir.lines.some((l) => /^Holo baseline for those newer sets, same first 6 months: -?\d+% \(\d+ cards\)\.$/.test(l)));
  }
  const numbered = deep.filter((r) => r.deep === "printings" || r.deep === "samelabel");
  t("printings and same-rarity lines are not twins", numbered.every((r) => new Set(r.lines).size === r.lines.length));
  t("printings and same-rarity card lines show the card number", numbered.every((r) => r.lines.filter((l) => /\$[\d,.]+/.test(l) && !/^(Lowest|Most common|TCGplayer)/.test(l)).every((l) => /#[A-Za-z0-9]+(\/[A-Za-z0-9]+)?/.test(l))));
  const publicBits = (r) => [r.headline, r.path, r.why, r.whyItMatters, r.source, r.chart?.label, ...(r.lines || []), ...(r.variants || [])].map((s) => String(s || ""));
  t("public read text does not say printing or printings", rows.every((r) => publicBits(r).every((s) => !/\bprintings?\b/i.test(s))));
  t("the renamed headline counts every card we price", deep.filter((r) => r.deep === "printings").every((r) => /^Every .+ card we price: \d+ cards, from \$[\d,.]+ to \$[\d,.]+ tonight\.$/.test(r.headline)));
  t("year-range, year-ago, and season reads are on the board", ["year-range", "year-ago", "season"].every((k) => rows.some((r) => r.readKind === k)));
  const ids = rows.map((r) => r.id);
  t("no duplicate ids", new Set(ids).size === ids.length);
  t("no same family side by side", rows.every((r, i) => i === 0 || (r.family || r.readKind) !== (rows[i - 1].family || rows[i - 1].readKind)));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("deep-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
