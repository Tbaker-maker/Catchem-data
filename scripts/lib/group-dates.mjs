// Release dates for TCGplayer groups, from TCGCSV publishedOn.
// A real release date comes as midnight ("2025-09-26T00:00:00"). Groups with no
// release date (POP Series, promo groups) carry the time the file was built,
// down to the fraction of a second. That is not a release date, so the group
// is left out and readers say the release date is unknown.
export function releaseDayOf(publishedOn) {
  const m = String(publishedOn || "").match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z?$/);
  return m ? m[1] : null;
}

export function groupDatesFrom(results) {
  const out = {};
  for (const group of results || []) {
    const id = group && group.groupId != null ? String(group.groupId) : "";
    const day = releaseDayOf(group && group.publishedOn);
    if (id && day) out[id] = day;
  }
  return out;
}

// Same layout as the file already in the repo: one line, ", " and ": ".
export function formatGroupDates(dates) {
  return "{" + Object.entries(dates).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + "}";
}
