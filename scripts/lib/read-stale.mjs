// Build-time stale flag. A read is stale when its own end date is before the
// board day. Nothing here invents a date.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readEnd(read) {
  const day = String(read?.endDate || read?.asOf || "").slice(0, 10);
  return DAY.test(day) ? day : "";
}

export function stampStale(doc, boardDay = "") {
  const builtOn = DAY.test(String(boardDay || "").slice(0, 10))
    ? String(boardDay).slice(0, 10)
    : (DAY.test(String(doc?.asOf || "").slice(0, 10)) ? String(doc.asOf).slice(0, 10) : "");
  let stale = 0;
  for (const read of doc?.reads || []) {
    const end = readEnd(read);
    const isStale = Boolean(builtOn && end && end < builtOn);
    read.stale = isStale;
    read.builtOn = builtOn;
    if (isStale) stale += 1;
  }
  if (doc && typeof doc === "object") doc.builtOn = builtOn;
  return { builtOn, reads: (doc?.reads || []).length, stale };
}
