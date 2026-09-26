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
