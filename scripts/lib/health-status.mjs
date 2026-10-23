// Health numbers come from files already on disk. A missing file is omitted.
// Nothing here estimates a count or marks a step passed when the file does not say so.

export const STALE_HOURS = 36;
export const FRESH_DAYS = 2;

export function dayOf(value) {
  const m = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

export function daysBetween(earlier, later) {
  const a = dayOf(earlier);
  const b = dayOf(later);
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

export function missingDays(dates) {
  const have = [...new Set((dates || []).map(dayOf).filter(Boolean))].sort();
  if (have.length < 2) return [];
  const out = [];
  let cursor = Date.parse(`${have[0]}T00:00:00Z`);
  const end = Date.parse(`${have[have.length - 1]}T00:00:00Z`);
  const set = new Set(have);
  while (cursor <= end) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    if (!set.has(day)) out.push(day);
    cursor += 86400000;
  }
  return out;
}

export function formatPt(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(t));
  return parts.replace(", ", " ").replace(",", " ") + " PT";
}

export function priceBannerLine(updatedAt, nowMs = Date.now()) {
  const raw = String(updatedAt || "");
  let t = Date.parse(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) t = Date.parse(`${raw}T04:00:00Z`);
  if (!Number.isFinite(t)) return "";
  if (nowMs - t <= STALE_HOURS * 3600 * 1000) return "";
  const day = formatPt(new Date(t).toISOString()).slice(0, 10);
  return day ? `Prices last updated ${day}.` : "";
}

export function hoursOld(iso, nowMs = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  return Math.round(((nowMs - t) / 3600000) * 10) / 10;
}

function fileStep(name, file, present, detail) {
  if (!present) return { name, file, result: "not in the files" };
  return { name, file, result: "file is present", detail: detail || "" };
}

export function buildStatus(input) {
  const src = input && typeof input === "object" ? input : {};
  const days = (src.tcgcsvDays || []).map(dayOf).filter(Boolean).sort();
  const newestPriceDay = days.length ? days[days.length - 1] : "";
  const counts = src.counts && typeof src.counts === "object" ? src.counts : {};
  const countOut = {};
  for (const key of ["items", "single", "sealed", "slab", "sets", "priced", "artists"]) {
    if (Number.isFinite(Number(counts[key]))) countOut[key] = Number(counts[key]);
  }
  const times = [];
  const pushTime = (file, iso) => {
    if (Date.parse(iso || "")) times.push({ file, at: iso });
  };
  pushTime("data/sealed-prices.json", src.sealedUpdatedAt);
  pushTime("research/assets/public/counts.json", counts.updatedAt);
  for (const row of src.heartbeat || []) pushTime(row.file, row.at);
  times.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const last = times.length ? times[times.length - 1] : null;
  const steps = [
    fileStep("TCGCSV day", newestPriceDay ? `data/history/tcgcsv-daily/${newestPriceDay}.json` : "data/history/tcgcsv-daily/", Boolean(newestPriceDay), newestPriceDay),
    fileStep("eBay sealed prices", "data/sealed-prices.json", Boolean(src.sealedUpdatedAt), src.sealedUpdatedAt || ""),
    fileStep("Public counts", "research/assets/public/counts.json", Boolean(counts.asOf), counts.asOf || ""),
    fileStep("Reads", "research/assets/public/reads.json", Boolean(src.readsAsOf), src.readsAsOf || ""),
    fileStep("Movers", "research/assets/public/movers.json", Boolean(src.moversAsOf), src.moversAsOf || ""),
    fileStep("Accuracy", "research/assets/public/accuracy.json", Boolean(src.accuracyAsOf), src.accuracyAsOf || ""),
    fileStep("Track record", "research/assets/public/track-record.json", Boolean(src.trackAsOf), src.trackAsOf || ""),
    fileStep("Today", "research/assets/public/today.json", Boolean(src.todayAsOf), src.todayAsOf || ""),
  ];
  if (src.ppt && typeof src.ppt === "object") {
    const failed = Number(src.ppt.callsFailed);
    steps.push({
      name: "PPT refresh",
      file: "data/ppt/run-report.json",
      result: Number.isFinite(failed) ? `file says calls.failed is ${failed}` : "not in the files",
      detail: src.ppt.finishedAt || "",
    });
  } else {
    steps.push({ name: "PPT refresh", file: "data/ppt/run-report.json", result: "not in the files", detail: "" });
  }
  for (const row of src.heartbeat || []) {
    steps.push({
      name: row.name,
      file: "data/heartbeat.json",
      result: row.at ? "time is in the file, pass or fail is not" : "not in the files",
      detail: row.at || "",
    });
  }
  const out = {
    note: "A step is marked from the file it writes. Pass or fail is stated only when that file says it. A missing file stays missing.",
    missingDays: missingDays(days),
    steps,
  };
  if (newestPriceDay) out.newestPriceDay = newestPriceDay;
  if (last) {
    out.lastFileTime = last.at;
    out.lastFileTimePt = formatPt(last.at);
    out.lastFile = last.file;
  }
  if (src.sealedUpdatedAt) out.ebayUpdatedAt = src.sealedUpdatedAt;
  if (Object.keys(countOut).length) out.counts = countOut;
  if (typeof src.imagesTcgplayer === "boolean") out.images = { tcgplayer: src.imagesTcgplayer };
  const banner = priceBannerLine(counts.updatedAt || src.sealedUpdatedAt || newestPriceDay, src.nowMs);
  if (banner) out.banner = banner;
  return out;
}

// A row with a flag key is skipped while that flag is false in data/flags.json.
// flags is the "flags" object from data/flags.json. A flag missing from it is treated as on.
export function flagOff(row, flags) {
  if (!row || !row.flag || !flags) return false;
  const entry = flags[row.flag];
  return Boolean(entry) && entry.value === false;
}

export function freshnessFailures(rows, nightlyDay, maxDays = FRESH_DAYS, flags = null) {
  const failures = [];
  const night = dayOf(nightlyDay);
  if (!night) return ["no nightly date"];
  for (const row of rows || []) {
    if (!row || !row.live) continue;
    if (flagOff(row, flags)) continue;
    const asOf = dayOf(row.asOf);
    if (!asOf) {
      if (row.dateRequired) failures.push(`${row.file} has no date`);
      continue;
    }
    const gap = daysBetween(asOf, night);
    if (gap == null) continue;
    if (gap > maxDays) failures.push(`${row.file} is ${gap} days behind ${night}`);
    // A file written earlier in tonight's run can be one day ahead of counts.json,
    // which the feed build only rewrites later. More than a day ahead is still wrong.
    if (gap < -1) failures.push(`${row.file} is dated ${asOf}, after the nightly date ${night}`);
  }
  return failures;
}

// Staleness must never block the job that refreshes the stale file (Oct 20 to 22:
// sealed-prices.json and pulse-feed.json were 3 days behind, the pre-test rebuild
// failed on that, and the refresh never ran). Inside the price run the feed build
// sets FEED_FRESHNESS_WARN_ONLY=1 and the strict check runs after the refresh.
// Only "N days behind" lines are warnings. A missing date or a future date still fails.
export function freshnessExit(failures, env = {}) {
  const list = failures || [];
  if (env.FEED_FRESHNESS_WARN_ONLY !== "1") return { fail: list, warn: [] };
  const behind = (line) => / is \d+ days behind \d{4}-\d{2}-\d{2}$/.test(line);
  return { fail: list.filter((l) => !behind(l)), warn: list.filter(behind) };
}
