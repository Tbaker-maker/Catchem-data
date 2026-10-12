// Applies the tuner's weights (data/derived/rating-weights.json) to the Card
// Rating before it builds. A missing, frozen-at-base or invalid file leaves the
// shipped weights alone. Called once per process, before build-card-rating.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validWeights } from "./rating-tuner.mjs";

export function sameWeights(a, b) {
  const ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
  return ka.join() === kb.join() && ka.every((k) => a[k] === b[k]);
}

export async function applyTunedWeights(root, target) {
  try {
    const doc = JSON.parse(await readFile(join(root, "data/derived/rating-weights.json"), "utf8"));
    const base = { ...target };
    // The shipped weights changed since the tuner seeded: ignore the file, the tuner reseeds.
    if (!doc?.base || !sameWeights(doc.base, base)) return { applied: false, reason: "shipped weights changed; tuner will reseed" };
    if (!validWeights(base, doc.weights)) return { applied: false, reason: "weights file failed validation" };
    Object.assign(target, doc.weights);
    return { applied: true, version: doc.version };
  } catch {
    return { applied: false, reason: "no weights file" };
  }
}
