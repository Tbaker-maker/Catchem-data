// Rebuild nightly sealed "listings counted" from the git history of
// data/sealed-prices.json. Pure helpers; the CLI is
// scripts/backfill-listing-counts-git.mjs. No network, no API calls.
//
// Method note: these are the sealed price step's own listingCount values
// (eBay Browse sample after the step's filters). That is the "sealed-step"
// method, not the daily-tier browseTotal in data/derived/listing-counts/history.
// Keep the two series apart; never splice them into one line.

export const CAP = 50;

// Before Aug 18 2026 the step stopped counting at 50, so most rows read 50.
// A night is "capped" when no row is above the cap and at least half sit on it.
export function cappedNight(counts) {
  if (!counts.length) return true;
  const over = counts.some((n) => n > CAP);
  const atCap = counts.filter((n) => n === CAP).length;
  return !over && atCap * 2 >= counts.length;
}

// One sealed-prices doc -> rows { id, tcgPlayerId, listingsCounted }.
export function rowsFromDoc(doc) {
  const raw = doc && doc.products;
  const products = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  const out = [];
  for (const p of products) {
    if (!p || typeof p !== "object" || !p.id) continue;
    const n = p.listingCount;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) continue;
    out.push({ id: p.id, tcgPlayerId: p.tcgPlayerId ?? null, listingsCounted: n });
  }
  return out;
}

// commits: [{ day, at, doc }] in any order. The last commit of each day wins.
// Returns { nights: { day: { at, capped, rows } }, skipped: [{ day, reason }] }.
export function buildNights(commits) {
  const byDay = new Map();
  for (const c of commits) {
    const prev = byDay.get(c.day);
    if (!prev || c.at > prev.at) byDay.set(c.day, c);
  }
  const nights = {};
  const skipped = [];
  for (const day of [...byDay.keys()].sort()) {
    const c = byDay.get(day);
    const rows = rowsFromDoc(c.doc);
    if (!rows.length) { skipped.push({ day, reason: "no listingCount rows" }); continue; }
    const capped = cappedNight(rows.map((r) => r.listingsCounted));
    if (capped) { skipped.push({ day, reason: `capped at ${CAP}` }); continue; }
    nights[day] = { at: c.at, rows };
  }
  return { nights, skipped };
}
