// Writes the intraday test result. Does not call PokemonPriceTracker.
// The 4-hour workflow stays disabled until a real paired test says prices moved.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { intradayResult, selectSample } from "./lib/ppt-intraday.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function writeIntraday(root = ROOT) {
  const heat = JSON.parse(await readFile(join(root, "data/heat-check.json"), "utf8"));
  const sample = selectSample(heat.products || []);
  const keySet = Boolean(process.env.POKEMONPRICETRACKER_API_KEY);
  const result = intradayResult({
    sample,
    asOf: heat.asOf || new Date().toISOString().slice(0, 10),
    keySet,
    pairedPulls: 0,
  });
  const dir = join(root, "data/ppt");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "intraday-test.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`ppt-intraday ${result.status} credits=${result.creditsUsed} sample=${result.sampleSize} workflow=${result.workflow}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeIntraday();
}
