// Visible run stamp. The clock is the pipeline's finishedAt, not "now",
// so a page rebuilt from an old report cannot pretend the tape is new.
export const FRESH_HOURS = 36;

export function formatPt(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
  return `${clock} PT`;
}

export function freshnessFrom(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return { label: "Data delayed", delayed: true, at: null, ageHours: null };
  const ageHours = (now - t) / 3600000;
  if (ageHours > FRESH_HOURS) return { label: "Data delayed", delayed: true, at: new Date(t).toISOString(), ageHours };
  return { label: `Updated ${formatPt(iso)}`, delayed: false, at: new Date(t).toISOString(), ageHours };
}

export function freshnessFromReport(report, now = Date.now()) {
  const iso = report?.finishedAt || report?.startedAt || null;
  return freshnessFrom(iso, now);
}

export function formatDay(day) {
  const t = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(t));
}

// A file that only has a calendar day. Noon UTC keeps that day in Pacific time.
// No hour is added.
export function freshnessFromDay(day, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) return freshnessFrom(null, now);
  const end = Date.parse(`${day}T23:59:59Z`);
  const ageHours = (now - end) / 3600000;
  const labelDay = formatDay(day);
  if (!labelDay || ageHours > FRESH_HOURS) return { label: "Data delayed", delayed: true, at: null, ageHours, day };
  return { label: `Updated ${labelDay}`, delayed: false, at: null, ageHours, day };
}
