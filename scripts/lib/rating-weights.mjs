// Applies the tuner's weights (private self-check/rating-weights.json, passed in
// as a parsed doc) to the Card Rating before it builds. A missing, frozen-at-base
// or invalid doc leaves the private base weights alone.
import { validWeights } from "./rating-tuner.mjs";

export function sameWeights(a, b) {
  const ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
  return ka.join() === kb.join() && ka.every((k) => a[k] === b[k]);
}

export function applyTunedWeights(doc, target) {
  if (!doc) return { applied: false, reason: "no weights file" };
  const base = { ...target };
  // The base weights changed since the tuner seeded: ignore the file, the tuner reseeds.
  if (!doc.base || !sameWeights(doc.base, base)) return { applied: false, reason: "base weights changed; tuner will reseed" };
  if (!validWeights(base, doc.weights)) return { applied: false, reason: "weights file failed validation" };
  Object.assign(target, doc.weights);
  return { applied: true, version: doc.version };
}
