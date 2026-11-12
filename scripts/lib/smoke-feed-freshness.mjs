// Pulse-feed freshness for the smoke test.
// Generate Morning Pulse runs after public-data publish, and it refuses to
// write a new dated edition when the catalogue is stale (eBay missed a
// cycle). The post-publish smoke must not treat a stale pulse-feed as a
// failed price publish when tonight's published reads are fresh.
export const FRESH_HOURS = 48;

export function feedFreshnessVerdict({ ageHours, prepublish = false, publishedReadsAgeHours = null }) {
  if (ageHours < FRESH_HOURS) {
    return { fail: false, kind: "fresh", message: `feed fresh (${ageHours.toFixed(1)}h)` };
  }
  if (prepublish) {
    return { fail: false, kind: "prepublish", message: `feed freshness not checked before publish (${Math.round(ageHours)}h old; checked after)` };
  }
  if (publishedReadsAgeHours != null && publishedReadsAgeHours < FRESH_HOURS) {
    return {
      fail: false,
      kind: "pulse-skipped",
      message: `pulse feed ${Math.round(ageHours)}h old; published reads are ${publishedReadsAgeHours.toFixed(1)}h old; pulse edition was not refreshed`,
    };
  }
  return { fail: true, kind: "stale", message: `${Math.round(ageHours)}h old` };
}
