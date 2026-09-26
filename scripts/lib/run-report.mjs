// Public PPT run report. Counts and ids only. No prices.

export function pushField(push) {
  if (push?.pushed && push.sha) return String(push.sha);
  const reason = String(push?.reason || "no push status");
  if (reason.startsWith("skipped:") || reason.startsWith("failed:")) return reason;
  if (push?.expected) return `failed: ${reason}`;
  return `skipped: ${reason}`;
}

export function buildRunReport({ startedAt = null, finishedAt, usage = {}, mount = {}, push = {} } = {}) {
  const run = usage.run || {};
  const credits = usage.credits || {};
  const used = Number.isFinite(run.creditsUsed) ? run.creditsUsed : (credits.used?.total ?? 0);
  const left = Number.isFinite(credits.remaining) ? credits.remaining : null;
  const itemSum = (usage.items?.sealed || 0) + (usage.items?.singles || 0) + (usage.items?.slabs || 0);
  const succeeded = run.itemsDone != null ? run.itemsDone : itemSum;
  const failed = run.itemsSkipped != null ? run.itemsSkipped : (Array.isArray(usage.errors) ? usage.errors.length : 0);
  const rateLimitHits = run.rateLimitCount != null
    ? run.rateLimitCount
    : (Array.isArray(usage.errors) ? usage.errors.filter((err) => /rate/i.test(String(err))).length : 0);
  const startMs = Date.parse(startedAt || "");
  const endMs = Date.parse(finishedAt || "");
  const durationSec = Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, Math.round((endMs - startMs) / 1000)) : null;
  return {
    asOf: String(finishedAt || "").slice(0, 10),
    startedAt,
    finishedAt,
    durationSec,
    items: {
      attempted: succeeded + failed,
      succeeded,
      failed,
    },
    credits: { used, left },
    rateLimitHits,
    retries: run.retries || 0,
    historyRestored: { yes: mount.restored === true, files: mount.files || 0 },
    privatePush: pushField(push),
  };
}

export function reportLine(report) {
  const history = report.historyRestored?.yes ? "yes" : "no";
  const files = report.historyRestored?.files || 0;
  const left = report.credits?.left == null ? "unknown" : report.credits.left;
  return `PPT run: attempted ${report.items.attempted}, succeeded ${report.items.succeeded}, failed ${report.items.failed}, credits ${report.credits.used} used / ${left} left, rate limits ${report.rateLimitHits}, retries ${report.retries}, history ${history} (${files} files), private push ${report.privatePush}, duration ${report.durationSec == null ? "unknown" : report.durationSec + "s"}`;
}

const RAW_FILE = /(?:^|\/)ppt-[^/]*RAW\.json$/i;

export function isRawPublicPath(path) {
  const p = String(path || "").replace(/\\/g, "/");
  if (p === "data/history/ppt-sealed" || p.startsWith("data/history/ppt-sealed/")) return true;
  if (p === "data/sealed-crosscheck.json" || p === "data/crosscheck-history.json") return true;
  if (p === "ppt-raw-private" || p.startsWith("ppt-raw-private/")) return true;
  if (p === "ppt-history-raw" || p.startsWith("ppt-history-raw/")) return true;
  if (p.startsWith("research/eval-samples/") && RAW_FILE.test(p)) return true;
  return false;
}

export const PPT_PRICE_KEYS = new Set(["tcgMarket", "unopenedPrice", "pptMarket"]);

export function findPptPriceKeys(value, path = "$", hits = []) {
  if (!value || typeof value !== "object") return hits;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) findPptPriceKeys(value[i], `${path}[${i}]`, hits);
    return hits;
  }
  for (const [key, child] of Object.entries(value)) {
    if (PPT_PRICE_KEYS.has(key)) hits.push(`${path}.${key}`);
    findPptPriceKeys(child, `${path}.${key}`, hits);
  }
  return hits;
}

export function safetyVerdict({ push = {}, tracked = [], fieldHits = [] } = {}) {
  const leaks = tracked.filter(isRawPublicPath);
  const reasons = [];
  if (push.expected && !push.pushed) reasons.push(`private push was expected and failed: ${push.reason || "no reason"}`);
  if (leaks.length) reasons.push(`raw PPT is tracked in the public tree: ${leaks.slice(0, 8).join(", ")}`);
  if (fieldHits.length) reasons.push(`PPT price fields are in public JSON: ${fieldHits.slice(0, 8).join(", ")}`);
  return { ok: reasons.length === 0, reasons, leaks, fieldHits };
}
