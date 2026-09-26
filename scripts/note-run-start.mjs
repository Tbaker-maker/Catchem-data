// Stamp the start of the daily price run. No prices. Gitignored.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function noteRunStart(root = ROOT, startedAt = new Date().toISOString()) {
  const dir = join(root, "data/ppt");
  await mkdir(dir, { recursive: true });
  const body = { startedAt };
  await writeFile(join(dir, "run-started.json"), `${JSON.stringify(body, null, 2)}\n`);
  return body;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const body = await noteRunStart();
  console.log(`run start ${body.startedAt}`);
}
