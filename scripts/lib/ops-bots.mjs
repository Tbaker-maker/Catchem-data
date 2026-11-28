// Pure checks for the freshness, self-heal, janitor, and coverage bots.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function dayOf(value) {
  const day = String(value || "").slice(0, 10);
  return DAY.test(day) ? day : "";
}

export function daysBetween(from, to) {
  if (!DAY.test(String(from || "")) || !DAY.test(String(to || ""))) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

// Alert only when the price day is more than one day behind the calendar day.
// A file from yesterday is still the last closed day. Two days behind is late.
export function priceDayStale(priceDay, today) {
  const ageDays = daysBetween(priceDay, today);
  if (ageDays == null || ageDays <= 1) return null;
  return {
    id: "price-day-stale",
    priceDay,
    today,
    ageDays,
    alert: `price day ${priceDay} is ${ageDays} days behind ${today}`,
  };
}

export function freshnessReport({ today, priceDay, countsDay, readsDay, scannerDay }) {
  const board = dayOf(today);
  const checks = [
    { id: "price-day", path: "data/history/tcgcsv-daily", date: dayOf(priceDay) },
    { id: "listings-counted", path: "data/derived/listing-counts/latest.json", date: dayOf(countsDay) },
    { id: "reads", path: "research/assets/public/reads.json", date: dayOf(readsDay) },
    { id: "scanner", path: "data/private/scanner/summary.json", date: dayOf(scannerDay) },
  ].map((row) => ({
    ...row,
    ok: Boolean(board && row.date && row.date === board),
    detail: !row.date ? "missing" : row.date === board ? "fresh" : `dated ${row.date}`,
  }));
  return {
    asOf: board,
    checks,
    failures: checks.filter((row) => !row.ok).map((row) => row.id),
  };
}

// A freshness inventory line names every promised path, including the ones
// that just moved. That list is not the failing check. The failing check is
// the line that starts with a cross or FAIL, plus the detail under it.
const INVENTORY_LINE = /\d+(?:\.\d+)?d ago\s*·\s*~\d+\s*run/;

function isInventoryLine(line) {
  return INVENTORY_LINE.test(String(line || ""));
}

function isFailureLine(line) {
  return /✗|\bFAIL\b/.test(String(line || ""));
}

function failureKey(line) {
  return String(line || "")
    .replace(/^[^\n]*?\d{4}-\d{2}-\d{2}T[0-9:.]+Z\s*/, "")
    .replace(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z/g, "TIME")
    .replace(/\d{4}-\d{2}-\d{2}/g, "DATE")
    .replace(/\s+/g, " ")
    .trim();
}

function failureKeys(log) {
  const keys = new Set();
  for (const line of String(log || "").split("\n")) {
    if (isFailureLine(line)) keys.add(failureKey(line));
  }
  return keys;
}

// Text a rewritten file can be blamed from. Inventory lines are dropped.
// When priorKeys is set, a failure already in that set is dropped too,
// along with the detail that follows it.
export function blameText(log, priorKeys = null) {
  const lines = String(log || "").split("\n");
  const hasFailure = lines.some(isFailureLine);
  if (!hasFailure) return lines.filter((line) => !isInventoryLine(line)).join("\n");
  const kept = [];
  let keep = false;
  for (const line of lines) {
    if (isInventoryLine(line)) {
      keep = false;
      continue;
    }
    if (isFailureLine(line)) {
      keep = !priorKeys || !priorKeys.has(failureKey(line));
      if (keep) kept.push(line);
      continue;
    }
    if (keep && line.trim()) kept.push(line);
    else if (!line.trim()) keep = false;
  }
  return kept.join("\n");
}

// failLog: text of the failed steps. When given, only files the failure
// names (full path or file name) are restored, so an unrelated rewrite is
// left alone. priorLog: the failed log already on main before this commit.
// The same failure, dates aside, opens nothing.
export function healPlan(files, failLog = null, priorLog = null) {
  let data = [...new Set((files || []).filter((f) => /^(data|research\/assets\/public)\//.test(String(f))))];
  if (!data.length) return { action: "none", files: [], reason: "the red commit did not rewrite a data file" };
  if (failLog != null) {
    const currentKeys = failureKeys(failLog);
    const priorKeys = priorLog != null ? failureKeys(priorLog) : null;
    if (priorKeys && currentKeys.size && [...currentKeys].every((key) => priorKeys.has(key))) {
      return { action: "none", files: [], reason: "the same failure was already on main before this commit" };
    }
    const log = blameText(failLog, priorKeys);
    data = data.filter((f) => log.includes(f) || log.includes(f.split("/").pop()));
    if (!data.length) return { action: "none", files: [], reason: "the failing steps do not name any file this commit rewrote" };
  }
  return { action: "restore", files: data, reason: "restore the last copy of the data files this commit rewrote" };
}

const CLOCK_KEYS = new Set([
  "generatedAt",
  "updatedAt",
  "finishedAt",
  "createdAt",
  "stampedAt",
  "ranAt",
  "checkedAt",
  "timestamp",
  "generated_at",
  "updated_at",
]);

const DATE_TOKEN = /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?/g;
const ISO_TS = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;

function isEmptyBlob(text) {
  if (text == null) return true;
  const raw = String(text).replace(/^\uFEFF/, "").trim();
  if (!raw) return true;
  try {
    const value = JSON.parse(raw);
    if (value == null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  } catch {
    return false;
  }
}

function parseJsonBlob(text) {
  try {
    return { ok: true, value: JSON.parse(String(text)) };
  } catch {
    return { ok: false, value: null };
  }
}

function dateMs(token) {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(token)) return null;
  const iso = token.includes("T") ? token : `${token}T00:00:00Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function dateTokens(text) {
  return [...String(text).matchAll(DATE_TOKEN)].map((hit) => hit[0]);
}

// Parent string is earlier than main when a whole value is a date, or when
// the same number of dates inside the two strings all line up and one is earlier.
function stringMovesBackward(parent, main) {
  const parentMs = dateMs(parent);
  const mainMs = dateMs(main);
  if (parentMs != null && mainMs != null) return parentMs < mainMs;
  const parentDates = dateTokens(parent);
  const mainDates = dateTokens(main);
  if (!parentDates.length || parentDates.length !== mainDates.length) return false;
  for (let i = 0; i < parentDates.length; i++) {
    const from = dateMs(parentDates[i]);
    const to = dateMs(mainDates[i]);
    if (from != null && to != null && from < to) return true;
  }
  return false;
}

function anyDateBackward(parent, main) {
  if (parent === main) return false;
  if (typeof parent === "string" && typeof main === "string") return stringMovesBackward(parent, main);
  if (parent == null || main == null || typeof parent !== "object" || typeof main !== "object") return false;
  if (Array.isArray(parent) || Array.isArray(main)) {
    if (!Array.isArray(parent) || !Array.isArray(main)) return false;
    const n = Math.min(parent.length, main.length);
    for (let i = 0; i < n; i++) if (anyDateBackward(parent[i], main[i])) return true;
    return false;
  }
  for (const key of Object.keys(parent)) {
    if (!Object.prototype.hasOwnProperty.call(main, key)) continue;
    if (anyDateBackward(parent[key], main[key])) return true;
  }
  return false;
}

function stripClocks(value) {
  if (Array.isArray(value)) return value.map(stripClocks);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (CLOCK_KEYS.has(key)) continue;
      out[key] = stripClocks(child);
    }
    return out;
  }
  return value;
}

function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canon(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function clocksOnly(parent, main) {
  return canon(stripClocks(parent)) === canon(stripClocks(main));
}

function textClocksOnly(parent, main) {
  const strip = (text) => String(text).replace(ISO_TS, "TIME");
  return strip(parent) === strip(main);
}

// "restore" or "none". Parent is the blob a heal would put back. Main is the
// file on main now. Rolling any date or generatedAt backward is noise, and so
// is a diff that only moves clock fields. A missing or empty main file is a
// real restore when the parent still has the content.
export function healRewind(parentText, mainText, unknown = false) {
  if (unknown) return "restore";
  if (isEmptyBlob(parentText)) return "none";
  if (isEmptyBlob(mainText)) return "restore";
  const parentJson = parseJsonBlob(parentText);
  const mainJson = parseJsonBlob(mainText);
  if (parentJson.ok && mainJson.ok) {
    if (anyDateBackward(parentJson.value, mainJson.value)) return "none";
    if (clocksOnly(parentJson.value, mainJson.value)) return "none";
    return "restore";
  }
  if (stringMovesBackward(String(parentText), String(mainText))) return "none";
  if (textClocksOnly(parentText, mainText)) return "none";
  return "restore";
}

// Drop files whose restore would rewind the morning. Keep a lost-file restore.
export function healRewindPlan(plan, blobs = {}) {
  if (!plan || plan.action !== "restore") return plan;
  const files = [];
  for (const file of plan.files || []) {
    const blob = blobs[file] || {};
    if (healRewind(blob.parent, blob.main, Boolean(blob.unknown)) === "restore") files.push(file);
  }
  if (!files.length) {
    return {
      action: "none",
      files: [],
      reason: "the restore only moves a timestamp or rolls a date backward",
    };
  }
  if (files.length === (plan.files || []).length) return plan;
  return { action: "restore", files, reason: plan.reason };
}

export function janitorRows(prs, now = new Date()) {
  const ms = now instanceof Date ? now.getTime() : Date.parse(now);
  const out = [];
  for (const pr of prs || []) {
    const created = Date.parse(pr.createdAt || "");
    const ageDays = Number.isFinite(created) ? Math.floor((ms - created) / 86400000) : null;
    const failing = (pr.checks || []).filter((c) => c.conclusion === "failure" || c.status === "failure" || c.state === "FAILURE").map((c) => c.name).filter(Boolean);
    const old = ageDays != null && ageDays >= 3;
    if (!old && !failing.length) continue;
    out.push({
      number: pr.number,
      title: pr.title || "",
      url: pr.url || "",
      ageDays,
      old,
      failing,
    });
  }
  return out.sort((a, b) => (a.number || 0) - (b.number || 0));
}

export function flagCoverageDrops(prev, next) {
  if (!prev) return [];
  const drops = [];
  for (const key of ["priced", "yearHistory", "listingsCounted"]) {
    if (prev[key] > 0 && next[key] < prev[key]) drops.push({ key, from: prev[key], to: next[key] });
  }
  if (prev.imageGaps > 0 && next.imageGaps > prev.imageGaps) {
    drops.push({ key: "imageGaps", from: prev.imageGaps, to: next.imageGaps, note: "image gaps went up" });
  }
  return drops;
}
