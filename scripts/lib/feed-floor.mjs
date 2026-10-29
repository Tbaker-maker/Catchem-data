// Cheap-move floor and the sealed lead floor. The numbers live in
// catchem-data-private (config/feed-floor.json). This file never stores them.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function valid(cfg) {
  const maxCheapPrice = Number(cfg?.maxCheapPrice);
  const maxCheapMove = Number(cfg?.maxCheapMove);
  if (!(maxCheapPrice > 0) || !(maxCheapMove > 0)) return null;
  const out = { maxCheapPrice, maxCheapMove };
  // Optional. A sealed market lead needs both. Missing means that lead stays off.
  const usd = Number(cfg?.minSealedLeadUsd);
  const pct = Number(cfg?.minSealedLeadPct);
  if (usd > 0) out.minSealedLeadUsd = usd;
  if (pct > 0) out.minSealedLeadPct = pct;
  return out;
}

export async function loadFeedFloor(root = ROOT) {
  const candidates = [
    process.env.FEED_FLOOR_FILE,
    join(root, "..", "catchem-data-private", "config", "feed-floor.json"),
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
    const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/feed-floor.json", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-feed-floor" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return valid(await res.json());
  } catch {
    return null;
  }
}
