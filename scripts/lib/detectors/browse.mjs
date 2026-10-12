// Qualified reads for the browse library. The board is not touched.
// Same day and same rows always shuffle the same way.

export function daySeed(asOf) {
  let n = 2166136261;
  for (const ch of String(asOf || "")) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return n >>> 0;
}

export function shuffleDay(rows, asOf) {
  const out = (rows || []).filter((row) => row && row.headline).slice();
  let seed = daySeed(asOf) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}
