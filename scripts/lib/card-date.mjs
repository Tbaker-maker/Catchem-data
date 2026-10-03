// The share-card date is the catalogue day already on file, not the clock.
export function catalogueCardDate(doc) {
  const day = String(doc && doc.asOf || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}
