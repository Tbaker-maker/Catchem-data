// A set with no logo file and no tile is left out of publish.
// The log entry has no image and no placeholder. Other sets still publish.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
// images.pokemontcg.io art that is the shared TCG logo or the promo star, not a set.
const GENERIC_SHA_PREFIX = ["d2055b7a", "31c11685"];
// Scrydex serves these two images for ids that are not a real set logo.
// Same values as research/assets/public/set-logos.json rejectSha256.
export const REJECT_SHA256 = {
  genericSet: "97bd74b939562df8df81ca5adb37db55632fea64eca631208e02152344c6ee3b",
  genericPromo: "7d7c739c448dfb28d03b38310f834e0cfdd748d8a37dcc34169a4f8c33bd2dd7",
};

export function isRejectedLogoSha(digest, extra) {
  const full = String(digest || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(full)) return false;
  if (GENERIC_SHA_PREFIX.some((prefix) => full.startsWith(prefix))) return true;
  const banned = new Set([REJECT_SHA256.genericSet, REJECT_SHA256.genericPromo]);
  if (extra && typeof extra === "object") {
    for (const value of Object.values(extra)) {
      const hex = String(value || "").toLowerCase();
      if (/^[0-9a-f]{64}$/.test(hex)) banned.add(hex);
    }
  }
  return banned.has(full);
}

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
    const buf = await readFile(join(root, "research/assets/img", match[1], "logo.png"));
    const digest = createHash("sha256").update(buf).digest("hex");
    if (isRejectedLogoSha(digest)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function shouldQuarantine(root, logo) {
  return !(await logoOnDisk(root, logo));
}

function catalogueLogo(map, id) {
  if (!map || id == null || id === "") return "";
  const path = map[id];
  return typeof path === "string" && LOGO_FILE.test(path.trim()) ? path.trim() : "";
}

// Prefer a logo file that is already on disk. A same-run registration updates
// the in-memory row before the startup catalogue map, so the row wins when
// its file exists. A stale catalogue path is used only when nothing on disk
// matches. A rejected generic image is not a logo.
export async function resolveSetLogo(slugName, { logos = {}, catalogueImages = {}, root } = {}) {
  const row = logos[slugName];
  const fromRow = row && typeof row.logo === "string" ? row.logo.trim() : "";
  const byId = row && row.setId ? catalogueLogo(catalogueImages, row.setId) : "";
  const bySlug = catalogueLogo(catalogueImages, slugName);
  const ordered = [];
  if (LOGO_FILE.test(fromRow)) ordered.push(fromRow);
  if (byId) ordered.push(byId);
  if (bySlug) ordered.push(bySlug);
  const seen = new Set();
  for (const path of ordered) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (root && await logoOnDisk(root, path)) return path;
  }
  if (byId || bySlug) return byId || bySlug;
  if (LOGO_FILE.test(fromRow)) return fromRow;
  return "";
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
