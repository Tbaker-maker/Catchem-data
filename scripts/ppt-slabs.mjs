// Slab status. Off by default. Does not call the API and does not write a median.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { slabCandidates, slabStatus } from "./lib/ppt-slabs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function enabledFlag() {
  return /^(1|true|yes|on)$/i.test(String(process.env.PPT_SLABS_ENABLED || ""));
}

export async function writeSlabStatus(root = ROOT) {
  const enrich = JSON.parse(await readFile(join(root, "data/singles-enrichment.json"), "utf8"));
  const candidates = slabCandidates(enrich.cards || []);
  const status = slabStatus({
    asOf: new Date().toISOString().slice(0, 10),
    candidates,
    historyByCard: {},
    creditsUsed: 0,
    enabled: enabledFlag() && Boolean(process.env.POKEMONPRICETRACKER_API_KEY),
  });
  if (status.status === "enabled") {
    status.status = "not-collected";
    status.reason = "PPT_SLABS_ENABLED is set, but this script does not pull yet. A pull would need a tested parser and a private raw path. Credits stayed 0. No median was invented.";
  }
  const dir = join(root, "data/history/slabs");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "status.json"), `${JSON.stringify(status, null, 2)}\n`);
  console.log(`ppt-slabs ${status.status} credits=${status.creditsUsed} candidates=${status.candidates} qualifying=${status.qualifying}`);
  return status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeSlabStatus();
}
