// A set with no logo file and no tile is left out of publish.
// The log entry has no image and no placeholder. Other sets still publish.
import { access } from "node:fs/promises";
import { join } from "node:path";

export const QUARANTINE_REASON = "No logo or tile on file. Left out of this publish.";

// Published sets are a subset of catalog set names. A new TCGCSV set raises
// both, or only the catalog when that set is quarantined. The floor catches
// an empty publish. The slack covers a folded name. A floor by itself would
// still pass if most of the catalog was left out, so the published count also
// has to stay within that slack of the catalog count.
const SET_COUNT_FLOOR = 150;
const SET_COUNT_SLACK = 20;
const LOGO_FILE = /^\/img\/([A-Za-z0-9._-]+)\/logo\.png$/;

export function quarantineEntry(set) {
  return {
    slug: String(set?.slug || ""),
    name: String(set?.name || ""),
    reason: QUARANTINE_REASON,
  };
}

export async function logoOnDisk(root, logo) {
  const match = String(logo || "").match(LOGO_FILE);
  if (!match) return false;
  try {
    await access(join(root, "research/assets/img", match[1], "logo.png"));
    return true;
  } catch {
    return false;
  }
}

export async function shouldQuarantine(root, logo) {
  return !(await logoOnDisk(root, logo));
}

export function catalogSetCount(catalog) {
  const names = new Set();
  for (const item of catalog?.items || []) {
    const name = String(item?.set || "").trim();
    if (name) names.add(name);
  }
  return names.size;
}

export function setCountFollowsCatalog(published, catalogSets) {
  const publishedN = Number(published);
  const catalogN = Number(catalogSets);
  if (!Number.isFinite(publishedN) || !Number.isFinite(catalogN)) return false;
  if (publishedN < SET_COUNT_FLOOR || catalogN < SET_COUNT_FLOOR) return false;
  if (publishedN < catalogN - SET_COUNT_SLACK) return false;
  return publishedN <= catalogN + SET_COUNT_SLACK;
}
