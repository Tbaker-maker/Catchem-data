// The Updated line uses the timestamp already on the price file.
// A missing or unreadable clock stays blank. Nothing here makes up a date.

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function priceFileStamp(doc) {
  const iso = doc && typeof doc.updatedAt === "string" ? doc.updatedAt : "";
  if (!ISO.test(iso) || !Number.isFinite(Date.parse(iso))) return null;
  return iso;
}

export function priceFileDay(doc) {
  const stamp = priceFileStamp(doc);
  if (stamp) return stamp.slice(0, 10);
  const day = doc && typeof doc.asOf === "string" ? doc.asOf.slice(0, 10) : "";
  return DAY.test(day) ? day : null;
}

// Newest calendar day already present on the committed files. Never invents.
export function newestCommittedDay(...docs) {
  let best = null;
  for (const doc of docs) {
    const day = priceFileDay(doc);
    if (day && (!best || day > best)) best = day;
  }
  return best;
}

// The homepage line uses the price-file clock. If that clock is missing,
// the previous counts.json line stays. No other clock is filled in.
export function nextCountsUpdatedAt(priceDoc, previousUpdatedAt) {
  const stamp = priceFileStamp(priceDoc);
  if (stamp) return stamp;
  if (typeof previousUpdatedAt === "string" && previousUpdatedAt) return previousUpdatedAt;
  return null;
}

export function stampCountsText(raw, stamp, day = null) {
  if (!stamp && !day) return null;
  let text = String(raw ?? "");
  if (!/"updatedAt": "[^"]*"/.test(text) && !/"asOf": "[^"]*"/.test(text)) return null;
  if (stamp && /"updatedAt": "[^"]*"/.test(text)) {
    text = text.replace(/"updatedAt": "[^"]*"/, `"updatedAt": ${JSON.stringify(stamp)}`);
  }
  if (day && DAY.test(day) && /"asOf": "[^"]*"/.test(text)) {
    text = text.replace(/"asOf": "[^"]*"/, `"asOf": ${JSON.stringify(day)}`);
  }
  return text;
}
