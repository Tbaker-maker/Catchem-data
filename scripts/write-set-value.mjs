import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "./flags.mjs";
import { buildSetValue, dayBefore } from "./lib/set-value.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dailyDir = join(ROOT, "data/history/tcgcsv-daily");
const files = (await readdir(dailyDir)).filter((name) => name.endsWith(".json")).sort();
const days = files.map((name) => name.slice(0, 10));
const latest = days[days.length - 1] || "";
const start = latest ? dayBefore(latest, 30) : "";
const index = JSON.parse(await readFile(join(ROOT, "research/assets/public/sets.json"), "utf8"));
const sets = [];
for (const row of index.sets || []) {
  const doc = JSON.parse(await readFile(join(ROOT, "research/assets/public/sets", `${row.slug}.json`), "utf8"));
  const ids = [];
  for (const item of doc.items || []) {
    if (!item || item.kind === "sealed") continue;
    const hit = String(item.id || "").match(/^tcgcsv-(\d+)$/);
    if (hit) ids.push(Number(hit[1]));
  }
  sets.push({ slug: row.slug, name: row.name, ids });
}
const priceDays = {};
if (days.includes(start) && days.includes(latest)) {
  for (const day of [start, latest]) {
    const doc = JSON.parse(await readFile(join(dailyDir, `${day}.json`), "utf8"));
    const map = new Map();
    for (const row of doc.prices || []) {
      if (row && Number(row.market) > 0) map.set(Number(row.id), Number(row.market));
    }
    priceDays[day] = map;
  }
}
const enabled = flag("set.valueReads") === true;
const doc = buildSetValue(sets, priceDays, { enabled, endDate: latest });
doc.priceDaysOnFile = days;
await writeFile(join(ROOT, "research/assets/public/feed/set-value.json"), JSON.stringify(doc, null, 2) + "\n");
console.log(JSON.stringify({
  enabled: doc.enabled,
  asOf: doc.asOf,
  exactStart: doc.exactStart,
  exactStartOnFile: doc.exactStartOnFile,
  sets: doc.sets,
  wouldQualify: doc.wouldQualify,
  published: doc.reads.length,
  priceDays: days,
}, null, 2));
