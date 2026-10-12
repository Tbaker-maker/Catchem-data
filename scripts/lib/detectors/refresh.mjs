// Which detectors to rerun when an input file's hash changes.
// No paid call. eBay files refresh nothing.

export const INPUT_DETECTORS = {
  "tcgcsv-daily": ["mover", "set", "high", "streak", "low", "plain"],
  "release-radar": ["release"],
  news: ["release"],
  "ebay-listings": [],
  "ebay-solds": [],
};

export function refreshPlan(prev = {}, next = {}) {
  const changed = [];
  for (const input of Object.keys(INPUT_DETECTORS)) {
    if (prev[input] === next[input]) continue;
    changed.push({ input, detectors: INPUT_DETECTORS[input] });
  }
  return {
    changed,
    paidCalls: 0,
    ebayInReads: false,
  };
}
