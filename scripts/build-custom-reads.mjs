import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFollowSlices } from "./lib/custom-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const followsDoc = await readFile(join(ROOT, "config/custom-reads.json"), "utf8").then(JSON.parse).catch(() => ({ follows: [] }));
const readsDoc = await readFile(join(ROOT, "data/derived/custom-read-pool.json"), "utf8").then(JSON.parse).catch(() => ({ day: "", reads: [] }));
const day = readsDoc.day || new Date().toISOString().slice(0, 10);
const built = buildFollowSlices({ follows: followsDoc.follows || [], reads: readsDoc.reads || [], day });
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
console.log(JSON.stringify({ day, written: index.written.length, quiet: index.quiet.length }));
