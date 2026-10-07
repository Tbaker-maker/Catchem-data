// scripts/lib/research-reads.mjs — the two reads of the research layer.
//
// LATEST DIGEST MEANS A DATED DIGEST. research/digests/ holds more than the
// daily digests: news.json, weekly-news.json and notes such as
// news-sources-2026-10-02.md. Every reader picked "the last *.md by sort", and
// "n" sorts after "2", so from 2026-10-02 the "latest digest" fed to
// compute-derived (catalysts, narrative vs tape, topic hits) was a source
// methodology note. Only research/digests/YYYY-MM-DD.md is a digest.
//
// THE RADAR LIVES IN upcoming[]. data/release-radar.json has always written
// its rows to `upcoming`; generate-pulse and generate-post-ideas read `items`
// or `releases`, found nothing, and rendered no radar at all. Past-dated rows
// are dropped at read time, so a radar the research run has not yet pruned
// never shows a release that already happened as "next up".
import { readdir } from "node:fs/promises";

export const DIGEST_NAME = /^\d{4}-\d{2}-\d{2}\.md$/;

export function isDigestName(name) {
  return DIGEST_NAME.test(String(name ?? ""));
}

// Pure: newest-last list of dated digest file names, at most n.
export function pickDigestNames(names, n = 1) {
  const dated = (names || []).filter(isDigestName).sort();
  return n > 0 ? dated.slice(-n) : [];
}

// Reads a directory and returns the newest n dated digest names (newest last).
export async function latestDigestNames(dir, n = 1) {
  return pickDigestNames(await readdir(dir), n);
}

export function radarRows(radar) {
  if (!radar || typeof radar !== "object") return [];
  for (const key of ["upcoming", "items", "releases"]) {
    if (Array.isArray(radar[key])) return radar[key];
  }
  return [];
}

export function rowDate(row) {
  return String(row?.date || row?.releaseDate || "").slice(0, 10);
}

// Future-or-today rows, soonest first. A row with no parseable date is not
// "upcoming" and is left out rather than sorted to the top.
// A row is confirmed only when its source list cites an official page:
// pokemon.com, pokemon-card.com, or the publisher's own shop
// (pokemoncenter.com / pokemon-center.com). A news index cited to say the
// product is not on it does not count. PokeBeach, SNKRDUNK and retailer
// trackers are not official.
const OFFICIAL_HOST = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:pokemon\.com|pokemon-card\.com|pokemoncenter\.com|pokemon-center\.com)(?=\/|[^a-z0-9-]|$)/gi;
const SENTENCE_NEG = /\b(no|not|without|404|unconfirmed|provisional|rumor|rumour)\b/i;
const DENIED_OFFICIAL = /carries no|no announcement|returns 404|lists no|not on pokemon|no pokemon-card\.com page|no tpc\/pokemon-card\.com page|no official/i;

function officialHits(text) {
  return [...String(text || "").matchAll(new RegExp(OFFICIAL_HOST.source, "gi"))].map((m) => m[0]);
}

function indexOnly(hit) {
  const path = String(hit).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[.,;]+$/, "");
  return /^(?:[a-z0-9-]+\.)*(?:pokemon\.com|pokemon-card\.com|pokemoncenter\.com|pokemon-center\.com)(?:\/info\/?)?$/i.test(path);
}

export function officialSources(row) {
  const note = String(row?.note || "");
  const chunks = String(note).split(/(?<=[.!?])\s+/).filter((sentence) => !SENTENCE_NEG.test(sentence));
  if (Array.isArray(row?.sources)) chunks.push(...row.sources.map((src) => String(src)));
  const hits = chunks.flatMap((chunk) => officialHits(chunk));
  const denied = DENIED_OFFICIAL.test(note);
  if (denied && hits.every(indexOnly)) return [];
  return hits;
}

// "verified" and "confirmed" are the same public claim. Both require an
// official source. Anything else stays off the public radar.
export function canConfirm(row) {
  const label = String(row?.confidence || "").toLowerCase();
  if (label === "unconfirmed" || label === "single-source" || label === "rumor") return false;
  if (label && label !== "verified" && label !== "confirmed") return false;
  return officialSources(row).length > 0;
}

export function upcomingRadar(radar, today, { limit = Infinity, verifiedOnly = false } = {}) {
  const day = String(today).slice(0, 10);
  return radarRows(radar)
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(rowDate(r)) && rowDate(r) >= day)
    .filter((r) => !verifiedOnly || canConfirm(r))
    .sort((a, b) => rowDate(a).localeCompare(rowDate(b)))
    .slice(0, limit);
}
