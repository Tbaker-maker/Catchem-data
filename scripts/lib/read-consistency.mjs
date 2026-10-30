// Checks that a read uses one window, spoken dates, a range that matches
// the price, a 7 day span that is 7 days, and gone language only when a
// private minimum was applied. Flags are counts. This file does not rewrite.
import { dayNum } from "./history-reads.mjs";

const ISO = /\b20\d{2}-\d{2}-\d{2}\b/;

function bits(read) {
  const out = [];
  for (const key of ["headline", "path", "why", "whyItMatters", "source", "blurb"]) {
    if (typeof read?.[key] === "string") out.push(read[key]);
  }
  for (const line of read?.lines || []) if (typeof line === "string") out.push(line);
  for (const line of read?.variants || []) if (typeof line === "string") out.push(line);
  for (const chip of read?.signals || []) {
    if (typeof chip?.label === "string") out.push(chip.label);
    if (typeof chip?.text === "string") out.push(chip.text);
  }
  const tile = read?.tiles?.price;
  if (tile && !tile.dash) {
    if (Number(tile.days) > 0) out.push(`${tile.days} day price tile`);
  }
  return out;
}

function textOf(read) {
  return bits(read).join("\n");
}

function classesIn(text) {
  const hit = new Set();
  const s = String(text || "");
  if (/\b7\s*[- ]?days?\b|\b7D\b|\bin a week\b|\bthis week\b|\bover a week\b/i.test(s)) hit.add(7);
  if (/\b30\s*[- ]?days?\b|\b30D\b|\bover 30 days\b/i.test(s)) hit.add(30);
  if (/\b90\s*[- ]?days?\b|\b90D\b/i.test(s)) hit.add(90);
  if (/\b365\s*[- ]?days?\b|\bon the year\b|\bin a year\b|\bover the year\b|\bover a year\b|\b1 year\b/i.test(s)) hit.add(365);
  return hit;
}

function chipClasses(read) {
  const hit = new Set();
  const add = (days) => {
    const n = Number(days);
    if (n === 7 || n === 30 || n === 90 || n === 365) hit.add(n);
  };
  add(read?.windowDays);
  for (const chip of read?.signals || []) {
    if (chip?.kind === "move" || chip?.kind === "range") add(chip.days);
    const label = `${chip?.text || ""} ${chip?.label || ""}`;
    for (const n of classesIn(label)) hit.add(n);
  }
  add(read?.tiles?.price?.days);
  return hit;
}

export function mixedWindows(read) {
  const hit = classesIn(textOf(read));
  for (const n of chipClasses(read)) hit.add(n);
  // The read's own window is the one window. A chip or sentence that names
  // another of 7, 30, 90 or 365 is a second window.
  return hit.size > 1;
}

export function rawDate(read) {
  return bits(read).some((line) => ISO.test(line));
}

export function rangePlace(read) {
  const price = Number(read?.price);
  if (!(price > 0)) return false;
  const cents = Math.round(price * 100);
  for (const chip of read?.signals || []) {
    if (chip?.kind !== "range") continue;
    const label = String(chip.label || "");
    const high = Number(chip.high);
    const low = Number(chip.low);
    if (Number.isFinite(high) && Math.round(high * 100) === cents && /lower part|middle/.test(label)) return true;
    if (Number.isFinite(low) && Math.round(low * 100) === cents && /upper part/.test(label) && !(Number.isFinite(high) && Math.round(high * 100) === cents)) return true;
  }
  return false;
}

function spanOf(a, b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b || ""))) return null;
  return dayNum(b) - dayNum(a);
}

export function weekSpan(read) {
  const text = textOf(read);
  const says7 = /\b7\s*[- ]?days?\b|\b7D\b|\bin a week\b|\bthis week\b/i.test(text) || Number(read?.windowDays) === 7 || Number(read?.tiles?.price?.days) === 7;
  if (!says7) return false;
  if (Number(read?.windowDays) === 7) {
    const span = spanOf(read.startDate, read.endDate || read.asOf);
    if (span != null && span !== 7) return true;
  }
  for (const chip of read?.signals || []) {
    if (chip?.kind !== "move") continue;
    const named = Number(chip.days) === 7 || /\b7\s*[- ]?days?\b|\b7D\b/i.test(`${chip.text || ""} ${chip.label || ""}`);
    if (!named) continue;
    const span = spanOf(chip.thenDate, chip.nowDate);
    if (span != null && span !== 7) return true;
  }
  const tile = read?.tiles?.price;
  if (tile && Number(tile.days) === 7) {
    const span = spanOf(tile.fromDate, read.asOf || tile.asOf);
    if (span != null && span !== 7) return true;
  }
  return false;
}

export function oneNightWeek(read) {
  const text = textOf(read);
  const saysWeek = /\b7\s*[- ]?days?\b|\b7D\b|\bin a week\b|\bthis week\b/i.test(text) || Number(read?.windowDays) === 7;
  if (!saysWeek) return false;
  const span = spanOf(read?.startDate, read?.endDate);
  if (span === 1) return true;
  for (const chip of read?.signals || []) {
    if (chip?.kind !== "move") continue;
    const named = Number(chip.days) >= 7 || /\b7\s*[- ]?days?\b|\b7D\b/i.test(`${chip.text || ""} ${chip.label || ""}`);
    if (named && spanOf(chip.thenDate, chip.nowDate) === 1) return true;
  }
  return false;
}

function listingDrop(read) {
  const text = textOf(read);
  const counted = text.match(/Listings counted\s+(\d+)\b[\s\S]{0,80}?\bto\s+(\d+)\b/i);
  if (counted) return { from: Number(counted[1]), to: Number(counted[2]) };
  const plain = text.match(/listings\s+(\d+)\s+to\s+(\d+)/i);
  if (plain) return { from: Number(plain[1]), to: Number(plain[2]) };
  return null;
}

// Gone language with no private minimum on the read, or a drop under that
// minimum. A missing minimum fails closed: the chip should not be there.
export function goneTooSmall(read, minDrop) {
  const text = textOf(read);
  const gone = (read?.signals || []).some((chip) => chip?.kind === "gone") || /Listings gone/i.test(text);
  if (!gone) return false;
  const floor = Number(minDrop);
  if (!(floor > 0)) return true;
  const drop = listingDrop(read);
  if (!drop) return true;
  return drop.from - drop.to < floor;
}

export function auditRead(read, opts = {}) {
  return {
    mixed: mixedWindows(read),
    rawDate: rawDate(read),
    rangePlace: rangePlace(read),
    weekSpan: weekSpan(read),
    oneNight: oneNightWeek(read),
    gone: goneTooSmall(read, opts.minDrop),
  };
}

export function auditReads(reads, opts = {}) {
  const counts = { mixed: 0, rawDate: 0, rangePlace: 0, weekSpan: 0, oneNight: 0, gone: 0, total: 0 };
  const ids = { mixed: [], rawDate: [], rangePlace: [], weekSpan: [], oneNight: [], gone: [] };
  for (const read of reads || []) {
    counts.total += 1;
    const hit = auditRead(read, opts);
    for (const key of Object.keys(counts)) {
      if (key === "total") continue;
      if (hit[key]) {
        counts[key] += 1;
        if (ids[key].length < 8) ids[key].push(read?.id || "");
      }
    }
  }
  return { counts, ids };
}
