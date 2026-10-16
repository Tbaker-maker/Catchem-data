// Read the shared news digest and write dated release stubs.
// Only Pokémon press is read. Other sources stay out. A blocked robots file
// writes an empty stub list. This does not edit sealed products or set files.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { robotsAllows } from "./lib/tcgci.mjs";
import { scoutReleases } from "./lib/release-scout.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRESS = "https://press.pokemon.com/robots.txt";
const PATH = "/en";

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function robotsText() {
  const res = await fetch(PRESS, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Catch'em release scout" } });
  if (!res.ok) return "";
  return await res.text();
}

const digest = await readJson(join(ROOT, "research/digests/news.json"), { items: [] });
const asOf = digest.asOf || new Date().toISOString().slice(0, 10);
const products = await readJson(join(ROOT, "data/sealed-products.json"), []);
const sets = await readJson(join(ROOT, "research/assets/public/sets.json"), []);
const setRows = Array.isArray(sets) ? sets : (sets.sets || sets.items || []);

let allowed = false;
let reason = "robots check failed";
try {
  const text = await robotsText();
  const decision = robotsAllows(text, PATH);
  allowed = decision.allowed === true;
  reason = decision.reason || reason;
} catch (err) {
  reason = err.message || reason;
}

const doc = allowed
  ? scoutReleases({ items: digest.items || [], knownSets: setRows, knownProducts: products, asOf })
  : { asOf, source: "Pokémon press", stubs: [], note: "Official press was not read. Robots did not allow it." };
doc.robots = { url: PRESS, path: PATH, asOf, allowed, reason };

const dir = join(ROOT, "data/derived/releases");
await mkdir(dir, { recursive: true });
const path = join(dir, `${asOf}.json`);
await writeFile(path, JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify({ releases: { asOf, stubs: doc.stubs.length, allowed, path: `data/derived/releases/${asOf}.json` } }));
