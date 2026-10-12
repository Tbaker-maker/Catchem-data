// Flags a detector for RD. Does not change a minimum.

export function scoreFlag(row, { scoreMin = 20, hitFloor = 40 } = {}) {
  const scored = Number(row?.scored) || 0;
  const hits = Number(row?.hits) || 0;
  const hitRate = scored > 0 ? Math.round((hits / scored) * 1000) / 10 : null;
  const review = scored >= scoreMin && hitRate != null && hitRate < hitFloor;
  return {
    id: String(row?.id || ""),
    produced: row?.produced ?? null,
    boarded: row?.boarded ?? null,
    scored14: row?.scored14 ?? null,
    scored28: row?.scored28 ?? null,
    scored56: row?.scored56 ?? null,
    scored,
    hits,
    hitRate: scored >= scoreMin ? hitRate : null,
    averageLaterMove: row?.averageLaterMove ?? null,
    review,
    public: false,
  };
}

export function learningNight(rows, limits) {
  const before = (rows || []).map((row) => (row?.minimums ? { ...row.minimums } : null));
  const out = (rows || []).map((row) => scoreFlag(row, limits));
  for (let i = 0; i < before.length; i += 1) {
    const min = rows[i]?.minimums;
    if (!min || !before[i]) continue;
    for (const key of Object.keys(before[i])) {
      if (min[key] !== before[i][key]) throw new Error("a minimum changed");
    }
  }
  return { public: false, rows: out };
}
