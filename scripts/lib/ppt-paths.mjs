// Where PPT files live after they leave the public repo.
// A missing file is a log line, not a throw.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const PPT_PRIVATE_DIR = "data/history/ppt-sealed-private";
export const PPT_PUBLIC_DIR = "data/history/ppt-sealed";

export async function readJsonIfPresent(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return null; }
}

export async function readCrosscheck(root, name) {
  for (const rel of [`ppt-raw-private/crosscheck/${name}`, `data/private/${name}`]) {
    const doc = await readJsonIfPresent(join(root, rel));
    if (doc) return doc;
  }
  console.log(`No ${name} on the private path. The public copy was removed. Skipping, not crashing.`);
  return null;
}
