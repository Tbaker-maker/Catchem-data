// Read-only cost and limit watcher. Numbers come from files the caller already
// loaded. Missing sources are omitted. No network.
import { used24 } from "./listing-counts.mjs";

export const LISTING_CALL_BUDGET = 4277;
export const WARN_SHARE = 0.85;
export const YOUTUBE_DAILY_QUOTA = 10000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function shareOf(used, limit) {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return null;
  return Math.round((used / limit) * 1000) / 1000;
}

function pct(share) {
  return Math.round(share * 100);
}

export function listingSource(log, now = new Date(), limit = LISTING_CALL_BUDGET) {
  if (!Array.isArray(log)) return null;
  const used = used24(log, now);
  const share = shareOf(used, limit);
  if (share == null) return null;
  const asOf = now.toISOString().slice(0, 10);
  return {
    id: "ebay-browse",
    label: "eBay Browse listing calls",
    asOf,
    used,
    limit,
    share,
    window: "rolling 24 hours",
  };
}

export function pptSource(report) {
  const credits = report?.credits;
  const asOf = typeof report?.asOf === "string" && DAY.test(report.asOf) ? report.asOf : "";
  const used = Number(credits?.usedToday);
  const left = Number(credits?.left);
  if (!asOf || !Number.isFinite(used) || !Number.isFinite(left) || used < 0 || left < 0) return null;
  const limit = used + left;
  const share = shareOf(used, limit);
  if (share == null) return null;
  return { id: "ppt", label: "PPT credits", asOf, used, limit, share, window: "UTC day" };
}

export function youtubeSource(state, limit = YOUTUBE_DAILY_QUOTA) {
  const rows = Array.isArray(state?.quota) ? state.quota : null;
  if (!rows || !rows.length) return null;
  const row = [...rows].reverse().find((q) => q && DAY.test(String(q.date || "")) && Number.isFinite(Number(q.units)));
  if (!row) return null;
  const used = Number(row.units);
  const share = shareOf(used, limit);
  if (share == null) return null;
  const out = { id: "youtube", label: "YouTube quota", asOf: String(row.date), used, limit, share, window: "UTC day" };
  if (Number.isFinite(Number(row.videos))) out.videos = Number(row.videos);
  return out;
}

export function warningLine(source) {
  if (!source || !(source.share >= WARN_SHARE)) return "";
  const counted = Number(source.limit).toLocaleString("en-US");
  if (source.id === "ebay-browse") {
    return `eBay Browse is at ${pct(source.share)}% of the ${counted} daily listing calls as of ${source.asOf}.`;
  }
  if (source.id === "ppt") {
    return `PPT credits are at ${pct(source.share)}% of the ${counted} daily credits as of ${source.asOf}.`;
  }
  if (source.id === "youtube") {
    return `YouTube quota is at ${pct(source.share)}% of the ${counted} daily units as of ${source.asOf}.`;
  }
  return "";
}

export function buildLimits({ now = new Date(), listingLog = null, ppt = null, youtube = null, youtubeLimit = YOUTUBE_DAILY_QUOTA } = {}) {
  const sources = [
    listingSource(listingLog, now),
    pptSource(ppt),
    youtubeSource(youtube, youtubeLimit),
  ].filter(Boolean);
  const warnings = sources.map(warningLine).filter(Boolean);
  return {
    asOf: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    warnAt: WARN_SHARE,
    sources,
    warnings,
  };
}

export function mergeAlerts(existing = [], warnings = []) {
  const prior = Array.isArray(existing) ? existing.filter((line) => typeof line === "string" && line && !warnings.includes(line)) : [];
  return [...prior, ...warnings];
}
