// Whether the 06:00 UTC backup should leave the price job alone.
// Pure: callers pass the schedule, commit subjects, and the price-file day.

export const PRIMARY_CRON = "0 4 * * *";
export const BACKUP_CRON = "0 6 * * *";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// data/sealed-prices.json stamps the day on updatedAt. No other field is read.
export function sealedDateOf(doc) {
  if (!doc || typeof doc !== "object") return null;
  if (typeof doc.updatedAt !== "string") return null;
  const day = doc.updatedAt.slice(0, 10);
  return DAY.test(day) ? day : null;
}

function dayOf(value) {
  if (typeof value !== "string") return null;
  const day = value.trim().slice(0, 10);
  return DAY.test(day) ? day : null;
}

function todayCommitted({ subjects, today, sealedDate }) {
  const day = typeof today === "string" ? today.trim() : "";
  if (!DAY.test(day)) return false;
  const want = new Set([
    `data: sealed prices ${day}`,
    `Update sealed prices (${day})`,
  ]);
  const list = Array.isArray(subjects) ? subjects : [];
  if (list.some((subject) => want.has(String(subject).trim()))) return true;
  return dayOf(sealedDate) === day;
}

export function skipBackup({ schedule, subjects, today, sealedDate } = {}) {
  if (schedule !== BACKUP_CRON) return false;
  return todayCommitted({ subjects, today, sealedDate });
}
