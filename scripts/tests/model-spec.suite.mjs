// Weights, bands and cutoffs are private. With no spec nothing is ranked,
// rated or given a verdict, and no public code carries the real values.
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applySpecDoc, applyModelSpec } from "../lib/model-spec.mjs";
import { RATING_WEIGHTS, RATING_BANDS, ratingSpecReady, verdictOf, buildRatings } from "../lib/card-rating.mjs";
import { popularity, popularityReady } from "../lib/popular-pokemon.mjs";
import { verdictOf as sealedVerdict, sealedSpecReady } from "../lib/sealed-rating.mjs";
import { useTestSpec, TEST_SPEC } from "./use-test-spec.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.log("  FAIL", name); } };

  applySpecDoc(null);
  t("no spec: rating weights empty and bands unset", Object.keys(RATING_WEIGHTS).length === 0 && RATING_BANDS.below == null && !ratingSpecReady());
  t("no spec: no card verdict", verdictOf(0.1) === null && verdictOf(5) === null);
  t("no spec: popularity has tags but no weight", !popularityReady() && popularity("Charizard ex - 199/165").weight === null && popularity("Charizard ex - 199/165").tags.includes("headliner"));
  t("no spec: no sealed verdict", !sealedSpecReady() && sealedVerdict(0.99, "tins") === null);
  let threw = false;
  try { buildRatings({ rows: [], today: "2026-10-19" }); } catch { threw = true; }
  t("no spec: the card rating does not build", threw);

  const bad = applySpecDoc({ cardRating: { weights: { ...TEST_SPEC.cardRating.weights, peer: 99 }, below: 0.8, above: 1.2 }, popularity: { weights: {}, cap: 5 }, sealedRating: { low: 0.2, high: 0.8 } });
  t("an invalid spec is refused whole", !bad.cardRating && !bad.popularity && !bad.sealedRating && !ratingSpecReady());

  const tmp = await mkdtemp(join(tmpdir(), "spec-"));
  const none = await applyModelSpec({ root: tmp, token: "", force: true });
  t("missing private file and no token: nothing loaded", none.loaded === false && !ratingSpecReady());
  await mkdir(join(tmp, "data/private/model-spec"), { recursive: true });
  await writeFile(join(tmp, "data/private/model-spec/spec.json"), JSON.stringify(TEST_SPEC));
  const got = await applyModelSpec({ root: tmp, token: "", force: true });
  t("a local private file loads", got.loaded && got.from === "local" && ratingSpecReady() && popularityReady() && sealedSpecReady());
  await rm(tmp, { recursive: true, force: true });

  const code = (await Promise.all(["lib/card-rating.mjs", "lib/popular-pokemon.mjs", "lib/sealed-rating.mjs"].map((f) => readFile(join(ROOT, "scripts", f), "utf8")))).join("\n");
  t("public code has no weight table or verdict cutoff", !/peer:\s*\d/.test(code) && !/headliner:\s*\d/.test(code) && !/ratio <= 0\.|p >= 0\.\d/.test(code));
  let pubWeights = true;
  try { await readFile(join(ROOT, "data/derived/rating-weights.json")); } catch { pubWeights = false; }
  t("tuned weights are not in the public repo", !pubWeights);

  useTestSpec();
  return fail;
}
