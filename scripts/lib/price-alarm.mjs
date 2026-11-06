// Freshness alarm and the red-run fix branch. Pure decisions. No GitHub calls.
export const STALE_HOURS = 36;
export const STALE_TITLE = "PRICES STALE";
export const FIX_TITLE = "Fix red Update sealed prices run";

export function priceStamp(doc) {
  if (!doc || typeof doc !== "object") return "";
  const asOf = typeof doc.asOf === "string" ? doc.asOf.trim() : "";
  if (asOf) return asOf;
  return typeof doc.updatedAt === "string" ? doc.updatedAt.trim() : "";
}

export function priceAgeHours(doc, now = Date.now()) {
  const at = Date.parse(priceStamp(doc));
  if (!Number.isFinite(at)) return null;
  return (now - at) / 36e5;
}

export function pricesAreStale(doc, now = Date.now()) {
  const age = priceAgeHours(doc, now);
  return age == null || age > STALE_HOURS;
}

export function staleIssueAction(openNumbers, stale) {
  const open = (openNumbers || []).filter((n) => Number.isInteger(n) && n > 0);
  if (stale) return open.length ? { action: "update", number: open[0] } : { action: "open" };
  return open.length ? { action: "close", number: open[0] } : { action: "none" };
}

export function failingLines(log) {
  const lines = String(log || "").split("\n").map((line) => line.replace(/\r$/, ""));
  const kept = lines.filter((line) => /FAIL|✗|Prices did not publish/.test(line));
  return kept.slice(0, 80).join("\n");
}

export function fixPrAction(openPrs) {
  const open = (openPrs || []).filter((pr) => pr && Number.isInteger(pr.number));
  if (open.length) return { action: "update", number: open[0].number, branch: String(open[0].branch || "") };
  return { action: "open" };
}

export function fixBody({ runUrl, tests }) {
  const text = failingLines(tests) || "No failing test line was in the log.";
  return [
    `Run: ${runUrl || ""}`,
    "",
    "Update sealed prices went red. This branch records the failing test output. It does not change a price.",
    "",
    "Failing tests:",
    text.slice(0, 12000),
  ].join("\n");
}

export function staleBody({ runUrl, doc, now, tests }) {
  const stamp = priceStamp(doc) || "(missing)";
  const age = priceAgeHours(doc, now);
  const ageLine = age == null ? "Age: no asOf and no updatedAt on sealed-prices.json." : `Age: ${age.toFixed(1)} hours. Limit: ${STALE_HOURS} hours.`;
  const testsLine = failingLines(tests) || "No failing test line was in the log.";
  return [
    `Run: ${runUrl || ""}`,
    "",
    `sealed-prices.json stamp: ${stamp}`,
    ageLine,
    "",
    "Failing tests:",
    testsLine.slice(0, 12000),
  ].join("\n");
}
