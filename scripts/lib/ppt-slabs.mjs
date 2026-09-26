// Slab candidate list and the index gate. No network. No prices copied through.

export const SLAB_TARGET = 300;
export const MIN_SLABS = 30;
export const MIN_DAYS = 30;

export function slabCandidates(rows, limit = SLAB_TARGET) {
  return (rows || [])
    .filter((row) => row && row.cardId && row.name && typeof row.raw?.vol30 === "number" && row.raw.vol30 >= 0)
    .slice()
    .sort((a, b) => b.raw.vol30 - a.raw.vol30 || String(a.cardId).localeCompare(String(b.cardId)))
    .slice(0, limit)
    .map((row) => ({
      id: row.cardId,
      name: row.name,
      number: row.number || null,
      tcgPlayerId: row.tcgPlayerId ? String(row.tcgPlayerId) : null,
      vol30: row.raw.vol30,
    }));
}

export function mediansFromEbaySold(ebaySold) {
  if (!ebaySold || typeof ebaySold !== "object") return [];
  const out = [];
  for (const [grade, row] of Object.entries(ebaySold)) {
    if (!/^(psa|bgs|cgc)\s*\d+/i.test(grade)) continue;
    if (typeof row?.median !== "number" || typeof row?.count !== "number") continue;
    out.push({ grade: grade.toUpperCase().replace(/\s+/g, ""), median: row.median, n: row.count });
  }
  return out.sort((a, b) => a.grade.localeCompare(b.grade));
}

export function qualifyingCount(historyByCard, { minCards = MIN_SLABS, minDays = MIN_DAYS } = {}) {
  let qualifying = 0;
  for (const days of Object.values(historyByCard || {})) {
    const dates = new Set((days || []).map((point) => point?.date).filter(Boolean));
    if (dates.size >= minDays) qualifying += 1;
  }
  return {
    qualifying,
    requiredSlabs: minCards,
    requiredDays: minDays,
    index: qualifying >= minCards ? "ready" : "not built",
  };
}

export function slabStatus({ asOf, candidates, historyByCard, creditsUsed = 0, enabled = false }) {
  const gate = qualifyingCount(historyByCard);
  const withProductId = candidates.filter((row) => row.tcgPlayerId).length;
  return {
    asOf,
    status: enabled ? "enabled" : "not-collected",
    creditsUsed,
    candidatesWanted: SLAB_TARGET,
    candidates: candidates.length,
    withProductId,
    shortfall: Math.max(0, SLAB_TARGET - candidates.length),
    shortfallReason: candidates.length < SLAB_TARGET
      ? `Measured 30-day sales exist for ${candidates.length} cards. The other ${SLAB_TARGET - candidates.length} were not filled in, because ranking by price is not demand.`
      : "The measured-demand list covers the 300.",
    ...gate,
    mediansWritten: 0,
    separateFromSingles: true,
    grades: ["PSA 10", "PSA 9", "CGC", "BGS"],
    cards: candidates,
    note: "No slab median was written. Raw pulls are not in this file. Singles files were not touched.",
  };
}
