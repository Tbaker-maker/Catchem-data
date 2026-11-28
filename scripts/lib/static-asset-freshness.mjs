// Catalogue set logos are static art. The nightly git add lists
// research/assets/img/*/logo.png, and the freshness guard then names the
// newest matching file. On 2026-11-17 that file was
// research/assets/img/baseset/logo.png, last moved 10 days earlier.
// A logo does not have to move on every price run. A data file does.
// The logo json indexes are the same art. They are not price files.

const LOGO_INDEX = new Set([
  "research/assets/public/set-logos.json",
  "research/assets/img/set-logo-tiles.json",
  "research/assets/img/set-logo-flags.json",
  "research/assets/img/set-logo-filled.json",
]);

export function staticAssetExcuse(path) {
  const p = String(path || "").replace(/\\/g, "/");
  if (p === "research/assets/img/*/logo.png" || /^research\/assets\/img\/[^/*]+\/logo\.png$/.test(p)) {
    return "catalogue set logos are static art. They change when a set is added, not on each price run. Data files stay on the freshness check.";
  }
  if (LOGO_INDEX.has(p)) {
    return "catalogue set logo indexes are static art. They change when a set is added, not on each price run. Data files stay on the freshness check.";
  }
  return "";
}

// A path blocks when it has missed two or more runs and nothing excuses it.
// slowExcuse is the SLOW reason for that exact path, or empty.
export function freshnessBlocks(path, runsMissed, slowExcuse) {
  if (slowExcuse || staticAssetExcuse(path)) return false;
  return Number(runsMissed) >= 2;
}

export function runsSince(iso, nowMs, hours) {
  const days = (Number(nowMs) - Date.parse(iso)) / 86400000;
  if (!Number.isFinite(days) || !(Number(hours) > 0)) return null;
  return Math.floor((days * 24) / Number(hours));
}

// Fixture clock. lastChanged is a map of path to ISO, not a live git call.
export function stalePromisedPaths(paths, { lastChanged = {}, nowMs, hours, excuseFor = () => "" } = {}) {
  const stale = [];
  for (const entry of paths || []) {
    const path = typeof entry === "string" ? entry : entry.path;
    const excuse = excuseFor(path) || "";
    const iso = lastChanged[path];
    if (!iso) {
      if (!excuse && !staticAssetExcuse(path)) stale.push({ path, why: "never committed" });
      continue;
    }
    const missed = runsSince(iso, nowMs, hours);
    if (freshnessBlocks(path, missed, excuse)) stale.push({ path, why: "stale", runsMissed: missed });
  }
  return stale;
}
