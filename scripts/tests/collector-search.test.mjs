import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rankCatalog } from "../lib/collector-search.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const rows = JSON.parse(await readFile(join(ROOT, "research/assets/public/search-lite.json"), "utf8"));
const top = (q) => rankCatalog(q, rows, 1)[0];
const fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
const text = (row) => row ? fold(`${row[1]} ${row[2]} ${row[3]} ${row[4] || ""} ${row[8] || ""}`) : "";

const cases = [
  ["moonbreon", (r) => /umbreon vmax/.test(text(r)) && /215/.test(text(r))],
  ["moonbrean", (r) => /umbreon vmax/.test(text(r)) && /215/.test(text(r))],
  ["van gogh pikachu", (r) => /grey felt hat/.test(text(r))],
  ["vangogh pikachu", (r) => /grey felt hat/.test(text(r))],
  ["151 etb", (r) => /151 elite trainer box/.test(text(r)) && !/costco|pokemon center/.test(text(r))],
  ["151 ETB", (r) => /elite trainer box/.test(text(r)) && /151/.test(text(r)) && !/costco/.test(text(r))],
  ["pc etb 151", (r) => /pokemon center/.test(text(r)) && /elite trainer/.test(text(r)) && /151/.test(text(r))],
  ["evolving skies bb", (r) => /evolving skies/.test(text(r)) && /booster box/.test(text(r))],
  ["es bb", (r) => /evolving skies/.test(text(r)) && /booster box/.test(text(r))],
  ["pe etb", (r) => /prismatic evolutions/.test(text(r)) && /elite trainer box/.test(text(r))],
  ["cosmic eclipse booster box", (r) => /cosmic eclipse/.test(text(r)) && /booster box/.test(text(r))],
  ["box booster eclipse cosmic", (r) => /cosmic eclipse/.test(text(r)) && /booster box/.test(text(r))],
  ["neo genesis", (r) => /neo genesis/.test(text(r))],
  ["charizard base set", (r) => /charizard/.test(text(r)) && /base set/.test(text(r))],
  ["215/203", (r) => /215/.test(String(r?.[3] || ""))],
  ["umbreon 215", (r) => /umbreon/.test(text(r)) && /215/.test(text(r))],
  ["alt art umbreon", (r) => /umbreon/.test(text(r)) && /alternate/.test(text(r))],
  ["keiichiro ito", (r) => /keiichiro ito/.test(text(r))],
  ["celebrations upc", (r) => /celebrations/.test(text(r)) && /ultra/.test(text(r))],
  ["fusion strike etb", (r) => /fusion strike/.test(text(r)) && /elite trainer/.test(text(r))],
  ["cz etb", (r) => /crown zenith/.test(text(r)) && /elite trainer/.test(text(r))],
  ["lo bb", (r) => /lost origin/.test(text(r)) && /booster box/.test(text(r))],
  ["shrouded fable etb", (r) => /shrouded fable/.test(text(r)) && /elite trainer/.test(text(r))],
  ["paldean fates etb", (r) => /paldean fates/.test(text(r)) && /elite trainer/.test(text(r))],
  ["surging sparks booster box", (r) => /surging sparks/.test(text(r)) && /booster box/.test(text(r))],
  ["destined rivals etb", (r) => /destined rivals/.test(text(r)) && /elite trainer/.test(text(r))],
  ["mega evolution etb", (r) => /mega evolution/.test(text(r)) && /elite trainer/.test(text(r))],
  ["prismatic evolutions etb", (r) => /prismatic evolutions/.test(text(r)) && /elite trainer box/.test(text(r)) && !/costco|sam|dollar/.test(text(r))],
  ["obsidian flames etb", (r) => /obsidian flames/.test(text(r)) && /elite trainer/.test(text(r))],
  ["temporal forces booster box", (r) => /temporal forces/.test(text(r)) && /booster box/.test(text(r))],
  ["twilight masquerade etb", (r) => /twilight masquerade/.test(text(r)) && /elite trainer/.test(text(r))],
  ["journey together etb", (r) => /journey together/.test(text(r)) && /elite trainer/.test(text(r))],
  ["stellar crown booster box", (r) => /stellar crown/.test(text(r)) && /booster box/.test(text(r))],
  ["paradox rift etb", (r) => /paradox rift/.test(text(r)) && /elite trainer/.test(text(r))],
  ["paldea evolved booster box", (r) => /paldea evolved/.test(text(r)) && /booster box/.test(text(r))],
  ["silver tempest etb", (r) => /silver tempest/.test(text(r)) && /elite trainer/.test(text(r))],
  ["brilliant stars booster box", (r) => /brilliant stars/.test(text(r)) && /booster box/.test(text(r))],
  ["chilling reign etb", (r) => /chilling reign/.test(text(r)) && /elite trainer/.test(text(r))],
  ["darkness ablaze booster box", (r) => /darkness ablaze/.test(text(r)) && /booster box/.test(text(r))],
  ["vivid voltage etb", (r) => /vivid voltage/.test(text(r)) && /elite trainer/.test(text(r))],
  ["shining fates etb", (r) => /shining fates/.test(text(r)) && /elite trainer/.test(text(r))],
  ["hidden fates etb", (r) => /hidden fates/.test(text(r)) && /elite trainer/.test(text(r))],
  ["evolving skies etb", (r) => /evolving skies/.test(text(r)) && /elite trainer/.test(text(r))],
  ["umbrean vmax", (r) => /umbreon vmax/.test(text(r))],
  ["sir charizard", (r) => /charizard/.test(text(r)) && /special illustration/.test(text(r))],
  ["charizard 4/102", (r) => /charizard/.test(text(r)) && /4/.test(String(r?.[3] || ""))],
  ["trainer elite box 151", (r) => /151/.test(text(r)) && /elite trainer/.test(text(r)) && !/costco/.test(text(r))],
  ["151 booster bundle", (r) => /151/.test(text(r)) && /booster bundle/.test(text(r))],
  ["base set charizard", (r) => /charizard/.test(text(r)) && /base set/.test(text(r))],
  ["lost origin booster box", (r) => /lost origin/.test(text(r)) && /booster box/.test(text(r))],
];

let pass = 0;
const fails = [];
for (const [q, pred] of cases) {
  const row = top(q);
  if (pred(row)) pass += 1;
  else fails.push(`${q} -> ${row ? row[1] + " | " + row[2] : "none"}`);
}
console.log(`${pass}/${cases.length}`);
for (const line of fails) console.log("  FAIL", line);
if (pass < 45 || cases.length < 50) process.exit(1);
console.log("collector search ok");
