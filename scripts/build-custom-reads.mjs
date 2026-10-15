import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFollowSlices } from "./lib/custom-reads.mjs";
import { selectAddons } from "./lib/custom-reads-addons.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const followsDoc = await readFile(join(ROOT, "config/custom-reads.json"), "utf8").then(JSON.parse).catch(() => ({ follows: [] }));
const readsDoc = await readFile(join(ROOT, "data/derived/custom-read-pool.json"), "utf8").then(JSON.parse).catch(() => ({ day: "", reads: [] }));
const newsDoc = await readFile(join(ROOT, "research/digests/news.json"), "utf8").then(JSON.parse).catch(() => ({}));
const allowDoc = await readFile(join(ROOT, "data/derived/custom-reads/sources/allow-list.json"), "utf8").then(JSON.parse).catch(() => ({ sources: [] }));
const day = readsDoc.day || newsDoc.asOf || new Date().toISOString().slice(0, 10);
const news = selectAddons(newsDoc.items || [], allowDoc);
const games = selectAddons(newsDoc.videoGames || [], allowDoc);
const built = buildFollowSlices({ follows: followsDoc.follows || [], reads: readsDoc.reads || [], day, news, games });
const dir = join(ROOT, "data/derived/custom-reads", day);
await mkdir(dir, { recursive: true });
for (const slice of built.slices) {
  await writeFile(join(dir, `${slice.followId}.json`), JSON.stringify(slice, null, 2) + "\n");
}
const index = {
  day,
  rule: "A follow with no matching reads is a quiet day and no file is written.",
  written: built.slices.map((slice) => slice.followId),
  quiet: built.quiet,
};
await writeFile(join(ROOT, "data/derived/custom-reads.json"), JSON.stringify(index, null, 2) + "\n");
await mkdir(join(ROOT, "data/derived/custom-reads/news"), { recursive: true });
await mkdir(join(ROOT, "data/derived/custom-reads/games"), { recursive: true });
await writeFile(join(ROOT, "data/derived/custom-reads/news", `${day}.json`), JSON.stringify({ asOf: day, items: news }, null, 2) + "\n");
await writeFile(join(ROOT, "data/derived/custom-reads/games", `${day}.json`), JSON.stringify({ asOf: day, items: games }, null, 2) + "\n");
console.log(JSON.stringify({ day, written: index.written.length, quiet: index.quiet.length, news: news.length, games: games.length }));
