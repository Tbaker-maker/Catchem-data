// Stamps the shared news file with this run's slot.
// Does not fetch pages. The night job already writes this file from scripts/fetch-tcg-news.mjs.
// A midday schedule would need a workflow edit, so that hook is not added here.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHARED_NEWS_PATH, newsSlot, stampSharedNews } from "./lib/shared-news.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(ROOT, SHARED_NEWS_PATH);
const doc = JSON.parse(await readFile(path, "utf8"));
const slot = newsSlot();
const next = stampSharedNews(doc, { slot: slot.slot, day: slot.day, at: new Date().toISOString() });
await writeFile(path, JSON.stringify(next, null, 2) + "\n");
console.log(JSON.stringify({ path: SHARED_NEWS_PATH, day: slot.day, slot: slot.slot, runs: next.runs.length }));
