// Applies the test model spec (test values, not the private ones) for suites
// that build ratings or popularity.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applySpecDoc } from "../lib/model-spec.mjs";
export const TEST_SPEC = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/model-spec.test.json"), "utf8"));
export function useTestSpec() { return applySpecDoc(TEST_SPEC); }
