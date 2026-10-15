// One news file for the night run and the midday run.
// Both slots write research/digests/news.json. Neither run creates a second file.

export const SHARED_NEWS_PATH = "research/digests/news.json";

export function vancouverParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function newsSlot(now = new Date()) {
  const { day, hour } = vancouverParts(now);
  const slot = hour >= 10 && hour <= 14 ? "midday" : "nightly";
  return { day, slot, path: SHARED_NEWS_PATH };
}

export function stampSharedNews(doc, { slot, at, day } = {}) {
  const when = newsSlot(at ? new Date(at) : new Date());
  const useSlot = slot || when.slot;
  const useDay = day || when.day;
  const runs = (Array.isArray(doc?.runs) ? doc.runs : []).filter((row) => !(row.day === useDay && row.slot === useSlot));
  runs.push({ day: useDay, slot: useSlot, at: at || new Date().toISOString(), path: SHARED_NEWS_PATH });
  runs.sort((a, b) => (a.day + a.slot).localeCompare(b.day + b.slot));
  return { ...doc, runs };
}
