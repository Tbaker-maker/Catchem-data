// Loads the private model spec (catchem-data-private data/private/model-spec/
// spec.json) at build time: Card Rating weights and verdict bands, popularity tag
// weights, cap and bands, sealed rating verdict cutoffs. Then applies the
// self-check tuner's weights (private self-check/rating-weights.json) when valid.
// A missing or invalid spec leaves every model unset: the builds that need it
// write nothing new, and no weight, band or cutoff is ever published.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { openPrivate } from "./private-store.mjs";
import { setRatingSpec, ratingSpecReady, RATING_WEIGHTS } from "./card-rating.mjs";
import { setPopularitySpec } from "./popular-pokemon.mjs";
import { setSealedSpec } from "./sealed-rating.mjs";
import { applyTunedWeights } from "./rating-weights.mjs";
import { meterSpecOf } from "./market-meter.mjs";

export const SPEC_REL = "model-spec/spec.json";
let cached = null;

export function applySpecDoc(doc, tuned = null) {
  const out = {
    cardRating: setRatingSpec(doc?.cardRating),
    popularity: setPopularitySpec(doc?.popularity),
    sealedRating: setSealedSpec(doc?.sealedRating),
    marketMeter: meterSpecOf(doc),
  };
  out.tuned = tuned && ratingSpecReady() ? applyTunedWeights(tuned, RATING_WEIGHTS) : { applied: false, reason: "no tuner file" };
  return out;
}

const readJson = async (p) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };

export async function applyModelSpec({ root, token = process.env.PRIVATE_DATA_TOKEN || "", tuned = true, force = false } = {}) {
  if (cached && !force) return cached;
  let spec = null, tunedDoc = null, from = "none";
  const local = join(root, "data/private");
  spec = await readJson(join(local, SPEC_REL));
  if (spec) { from = "local"; tunedDoc = await readJson(join(local, "self-check/rating-weights.json")); }
  else if (token) {
    try {
      const store = await openPrivate({ root, token });
      try {
        spec = await readJson(join(store.dir, SPEC_REL));
        tunedDoc = await readJson(join(store.dir, "self-check/rating-weights.json"));
        from = spec ? "private repo" : "none";
      } finally { await store.close([], "model spec read only"); }
    } catch { spec = null; }
  }
  const res = applySpecDoc(spec, tuned ? tunedDoc : null);
  cached = { loaded: Boolean(spec), from, ...res };
  return cached;
}
