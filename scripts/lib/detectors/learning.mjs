// Per-detector score sheet. Does not change a minimum. Does not publish.

function rate(hit, scored, min) {
  if (!(scored >= min)) return null;
  return Math.round((100 * hit) / scored);
}

export function learningReport(track, { scoreMin = 20 } = {}) {
  const min = Number(scoreMin) > 0 ? Number(scoreMin) : 20;
  const detectors = (track?.types || []).map((row) => {
    const scored14 = Number(row?.scored14) || 0;
    const hit14 = Number(row?.hit14) || 0;
    const scored28 = Number(row?.scored28) || 0;
    const hit28 = Number(row?.hit28) || 0;
    const scored56 = Number(row?.scored56) || 0;
    const hit56 = Number(row?.hit56) || 0;
    return {
      id: String(row?.type || ""),
      reads: Number(row?.reads) || 0,
      tooEarly: Number(row?.tooEarly) || 0,
      scored14,
      hit14,
      hitRate14: rate(hit14, scored14, min),
      scored28,
      hit28,
      hitRate28: rate(hit28, scored28, min),
      scored56,
      hit56,
      hitRate56: rate(hit56, scored56, min),
      review: (scored14 >= min && hit14 === 0) || (scored28 >= min && hit28 === 0) || (scored56 >= min && hit56 === 0),
      minimums: "unchanged",
    };
  });
  return {
    public: false,
    asOf: String(track?.asOf || ""),
    scoreMin: min,
    detectors,
    note: "Hit rate stays hidden under the score minimum. A review flag is for RD. This file does not raise or loosen a minimum.",
  };
}
