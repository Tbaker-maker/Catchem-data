// The Updated line uses the timestamp already on the price file.
// A missing or unreadable clock stays blank. Nothing here makes up a date.

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function priceFileStamp(doc) {
  const iso = doc && typeof doc.updatedAt === "string" ? doc.updatedAt : "";
  if (!ISO.test(iso) || !Number.isFinite(Date.parse(iso))) return null;
  return iso;
}

// The homepage line uses the price-file clock. If that clock is missing,
// the previous counts.json line stays. No other clock is filled in.
export function nextCountsUpdatedAt(priceDoc, previousUpdatedAt) {
  const stamp = priceFileStamp(priceDoc);
  if (stamp) return stamp;
  if (typeof previousUpdatedAt === "string" && previousUpdatedAt) return previousUpdatedAt;
  return null;
}

export function stampCountsText(raw, stamp) {
  if (!stamp) return null;
  const text = String(raw ?? "");
  if (!/"updatedAt": "[^"]*"/.test(text)) return null;
  return text.replace(/"updatedAt": "[^"]*"/, `"updatedAt": ${JSON.stringify(stamp)}`);
}
