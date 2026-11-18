// Catalogue set logos are static art. The nightly git add lists
// research/assets/img/*/logo.png, and the freshness guard then names the
// newest matching file. On 2026-11-17 that file was
// research/assets/img/baseset/logo.png, last moved 10 days earlier.
// A logo does not have to move on every price run. A data file does.

export function staticAssetExcuse(path) {
  const p = String(path || "").replace(/\\/g, "/");
  if (p === "research/assets/img/*/logo.png" || /^research\/assets\/img\/[^/*]+\/logo\.png$/.test(p)) {
    return "catalogue set logos are static art. They change when a set is added, not on each price run. Data files stay on the freshness check.";
  }
  return "";
}

// A path blocks when it has missed two or more runs and nothing excuses it.
// slowExcuse is the SLOW reason for that exact path, or empty.
export function freshnessBlocks(path, runsMissed, slowExcuse) {
  if (slowExcuse || staticAssetExcuse(path)) return false;
  return Number(runsMissed) >= 2;
}
