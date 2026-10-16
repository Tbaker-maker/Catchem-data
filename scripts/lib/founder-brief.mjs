// Weekly founder brief. Every number names the dated file it came from.
// Empty sections are omitted. No network.

const BANNED = /\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|load up|crypto)\b/i;

function houseOk(text) {
  return !BANNED.test(String(text || "")) && !/[—–]/.test(String(text || ""));
}
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function weekWindow(asOf) {
  const end = new Date(`${asOf}T00:00:00Z`);
  const start = new Date(end.getTime() - 6 * 86400000);
  return { start: start.toISOString().slice(0, 10), end: asOf };
}

function dayKey(value) {
  const raw = String(value || "");
  if (raw.length > 10) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
    }
  }
  return raw.slice(0, 10);
}

function inWindow(date, window) {
  const key = dayKey(date);
  return DAY.test(key) && key >= window.start && key <= window.end;
}

export function shippedLines(prs, window) {
  const rows = (prs || []).filter((row) => row && inWindow(row.mergedAt, window) && row.title && row.number && houseOk(row.title));
  const shown = rows.slice(0, 12);
  const lines = shown.map((row) => `- #${row.number} ${clean(row.title)} (${dayKey(row.mergedAt)}, ${row.repo || "Catchem-data"})`);
  if (rows.length) lines.push(`- ${shown.length} listed of ${rows.length} merges as of ${window.end} (data/derived/brief/merged-prs.json).`);
  return lines;
}

export function brokeLines(status, drift) {
  const lines = [];
  const asOf = status?.asOf;
  if (DAY.test(String(asOf || "")) && Array.isArray(status?.failures)) {
    for (const id of status.failures) {
      if (id) lines.push(`- ${id} failed on ${asOf} (data/derived/status.json).`);
    }
  }
  if (drift?.drift === true && DAY.test(String(drift.asOf || ""))) {
    lines.push(`- Drift flagged on ${drift.asOf} (data/derived/drift-plan.json).`);
  }
  return lines;
}

export function numberLines({ limits, listings } = {}) {
  const lines = [];
  const listing = (limits?.sources || []).find((row) => row.id === "ebay-browse");
  if (listing && DAY.test(String(listing.asOf || "")) && Number.isFinite(listing.used) && Number.isFinite(listing.limit)) {
    lines.push(`- Listing calls used ${listing.used} of ${listing.limit} as of ${listing.asOf} (data/derived/limits/latest.json).`);
  }
  const ppt = (limits?.sources || []).find((row) => row.id === "ppt");
  if (ppt && DAY.test(String(ppt.asOf || "")) && Number.isFinite(ppt.used) && Number.isFinite(ppt.limit)) {
    lines.push(`- PPT credits used ${ppt.used} of ${ppt.limit} as of ${ppt.asOf} (data/derived/limits/latest.json).`);
  }
  if (listings && DAY.test(String(listings.asOf || "")) && Number.isFinite(Number(listings.rows))) {
    lines.push(`- Listings counted rows ${listings.rows} as of ${listings.asOf} (data/derived/listing-counts/latest.json).`);
  }
  return lines;
}

function promptBlock(title, body) {
  return [`### ${title}`, "", "```", body.trim(), "```"].join("\n");
}

export function prsFromLog(text, repo = "Catchem-data") {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const hit = line.match(/^(\d{4}-\d{2}-\d{2}(?:T[^\t]+)?)\t(.+?)\s+\(#(\d+)\)\s*$/);
    if (!hit) continue;
    out.push({ number: Number(hit[3]), title: clean(hit[2]), mergedAt: hit[1], repo });
  }
  return out;
}

export function pendingBuilds(queue, progressText) {
  const done = new Set();
  for (const block of String(progressText || "").split(/\n(?=## )/)) {
    const id = (block.match(/^##\s+(\S+)/) || [])[1];
    if (id && /status:\s*(SHIPPED|SKIPPED)/.test(block)) done.add(id);
  }
  return nextBuilds((queue || []).filter((row) => !done.has(row.id)));
}
export function nextBuilds(queue) {
  const open = (queue || []).filter((row) => row && row.id && row.title && row.prompt && row.status !== "SHIPPED" && row.status !== "SKIPPED");
  return open.slice(0, 3);
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").replace(/[—–]/g, "-").trim();
}

export function renderBrief({ asOf, prs = [], status = null, drift = null, limits = null, listings = null, queue = [], progressText = "" } = {}) {
  if (!DAY.test(String(asOf || ""))) throw new Error("brief needs a dated day");
  const window = weekWindow(asOf);
  const shipped = shippedLines(prs, window);
  const broke = brokeLines(status, drift);
  const numbers = numberLines({ limits, listings });
  const builds = pendingBuilds(queue, progressText);
  const parts = [`# Founder brief, ${asOf}`, "", `Week ${window.start} to ${window.end}. Cadence is Sunday 8 AM PT.`, ""];
  if (shipped.length) parts.push("## Shipped", "", ...shipped, "");
  if (broke.length) parts.push("## Broke", "", ...broke, "");
  if (numbers.length) parts.push("## Numbers", "", ...numbers, "");
  if (builds.length) {
    parts.push("## Next builds", "");
    builds.forEach((row, i) => {
      parts.push(promptBlock(`${i + 1}. ${row.id} ${row.title}`, row.prompt), "");
    });
  }
  const text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  if (!houseOk(text)) throw new Error("brief copy failed the house check");
  return text;
}

export function citedFiles(text) {
  return [...String(text || "").matchAll(/\(([^()]+\.json)\)/g)].map((hit) => hit[1]);
}
