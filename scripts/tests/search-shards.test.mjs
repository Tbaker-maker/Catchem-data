import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { searchItems } from "../lib/search-rank.mjs";
import { buildShardMap, shardIdsForItem, shardIdsForQuery, trimItem } from "../lib/search-shards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

const rows = [
  { id: "swsh7-215", name: "Umbreon VMAX", set: "Evolving Skies", number: "215", kind: "single", aliases: ["moonbreon"], price: 1, history: "nope", setId: "swsh7" },
  { id: "base3-51", name: "Krabby", set: "Fossil", kind: "single", aliases: [], price: 2 },
  { id: "sv3pt5-etb", name: "151 Elite Trainer Box", set: "151", kind: "sealed", subtype: "etb", aliases: ["etb"], price: 3 },
];

function loaded(map, query, kind = "all") {
  const seen = new Set();
  const items = [];
  for (const id of shardIdsForQuery(query, kind)) {
    for (const item of map.get(id) || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

export async function runSearchShardTests() {
  fail = 0;
  const map = buildShardMap(rows);
  t("moonbreon lives in the alias shard", shardIdsForItem(rows[0]).includes("single-mo"));
  t("krabby is not in the bb shard", !(map.get("single-bb") || []).some((row) => row.id === "base3-51"));
  t("a trimmed row drops the history path", !("history" in trimItem(rows[0])) && trimItem(rows[0]).aliases[0] === "moonbreon");

  const moon = searchItems(loaded(map, "moonbreon"), "moonbreon");
  t("a shard query still finds moonbreon", moon[0]?.id === "swsh7-215" && moon[0].kind === "single");
  const etb = searchItems(loaded(map, "151 etb"), "151 etb");
  t("a shard query still finds a sealed etb", etb[0]?.id === "sv3pt5-etb" && etb[0].kind === "sealed");
  t("bb does not load krabby", searchItems(loaded(map, "bb"), "bb").length === 0);

  const manifest = JSON.parse(await readFile(join(ROOT, "data/search/manifest.json"), "utf8"));
  const bytesFor = (query) => shardIdsForQuery(query).reduce((sum, id) => sum + (manifest.shards[id]?.bytes || 0), 0);
  t("moonbreon stays under 300kb", bytesFor("moonbreon") > 0 && bytesFor("moonbreon") < 300000, String(bytesFor("moonbreon")));
  t("151 etb stays under 300kb", bytesFor("151 etb") > 0 && bytesFor("151 etb") < 300000, String(bytesFor("151 etb")));

  const mo = JSON.parse(await readFile(join(ROOT, "data/search", manifest.shards["single-mo"].file), "utf8"));
  t("the published moonbreon shard finds the card", searchItems(mo, "moonbreon")[0]?.id === "swsh7-215");
  const etbShards = ["sealed-15", "single-15", "sealed-et", "single-et"].flatMap((id) => {
    const file = manifest.shards[id]?.file;
    return file ? [file] : [];
  });
  const etbRows = [];
  for (const file of etbShards) etbRows.push(...JSON.parse(await readFile(join(ROOT, "data/search", file), "utf8")));
  const found = searchItems(etbRows, "151 etb");
  t("the published shards find a sealed 151 etb", found[0]?.kind === "sealed" && /151/.test(found[0].name));
  const bb = manifest.shards["single-bb"]
    ? JSON.parse(await readFile(join(ROOT, "data/search", manifest.shards["single-bb"].file), "utf8"))
    : [];
  t("the published bb shard does not return krabby", searchItems(bb, "bb").every((row) => !/krabby/i.test(row.name)));

  console.log(fail ? `${fail} failed` : "search shards ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runSearchShardTests();
  if (n) process.exit(1);
}
