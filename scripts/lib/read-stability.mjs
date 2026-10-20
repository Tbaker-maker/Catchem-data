// Card-story bar. The numbers live in catchem-data-private
// (config/read-stability.json). This file never stores them.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function valid(cfg) {
  const minPoints = Number(cfg?.minPoints);
  const maxRatio = Number(cfg?.maxRatio);
  if (!(minPoints >= 2) || !(maxRatio > 1)) return null;
  return { minPoints, maxRatio };
}

export async function loadReadStability(root = ROOT) {
  const candidates = [
    process.env.READ_STABILITY_FILE,
    join(root, "..", "catchem-data-private", "config", "read-stability.json"),
  ].filter(Boolean);
  for (const path of candidates) {
    try {
      const cfg = valid(JSON.parse(await readFile(path, "utf8")));
      if (cfg) return cfg;
    } catch { /* next place */ }
  }
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/read-stability.json", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-read-stability" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return valid(await res.json());
  } catch {
    return null;
  }
}

// True when the series misses the private point floor or the high/low ratio.
// No config means no opinion: the caller does not invent a cutoff.
export function storyUnstable(points, peak, low, cfg) {
  if (!cfg) return false;
  const n = Number(points);
  const hi = Number(peak);
  const lo = Number(low);
  if (Number.isFinite(Number(cfg.minPoints)) && !(n >= Number(cfg.minPoints))) return true;
  if (Number.isFinite(Number(cfg.maxRatio)) && lo > 0 && hi / lo > Number(cfg.maxRatio)) return true;
  return false;
}
