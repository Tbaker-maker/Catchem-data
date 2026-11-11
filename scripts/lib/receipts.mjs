// A read is something we already tracked. Hit means the next observed ask
// moved the same way as the move into the read. Miss is the other way.
// Dollars stay out of the public file.
export function gradeRead({ start, later, direction }) {
  if (typeof start !== "number" || typeof later !== "number" || !(start > 0)) return "open";
  if (direction !== "up" && direction !== "down") return "open";
  if (later === start) return "miss";
  const movedUp = later > start;
  return (direction === "up" ? movedUp : !movedUp) ? "hit" : "miss";
}

export function movePct(start, later) {
  if (typeof start !== "number" || typeof later !== "number" || !(start > 0)) return null;
  return Math.round(((later - start) / start) * 1000) / 10;
}

export function summarizeReads(reads) {
  const graded = reads.filter((r) => r.result === "hit" || r.result === "miss");
  const hits = graded.filter((r) => r.result === "hit");
  const misses = graded.filter((r) => r.result === "miss");
  const byMove = (rows) => [...rows].sort((a, b) => Math.abs(b.movePct || 0) - Math.abs(a.movePct || 0));
  const take = Math.max(hits.length, misses.length, 0);
  const shown = Math.min(5, take);
  return {
    tracked: reads.length,
    graded: graded.length,
    hits: hits.length,
    misses: misses.length,
    hitRate: graded.length ? Math.round((hits.length / graded.length) * 1000) / 10 : null,
    biggestHits: byMove(hits).slice(0, shown).map(publicRead),
    biggestMisses: byMove(misses).slice(0, shown).map(publicRead),
    open: reads.filter((r) => r.result === "open").length,
  };
}

function publicRead(r) {
  return {
    id: r.id || null,
    name: r.name,
    kind: r.kind,
    date: r.date,
    result: r.result,
    movePct: r.movePct,
  };
}

// Decides whether an empty receipts file is a failure. An empty file fails only
// when the watch log had picks inside the window and none of them became a read.
// A log with no pick in the window is stale, not broken: the log is committed by
// the late "Commit updated prices" step, which cannot run while an earlier step
// keeps the job red. Failing here on a stale log held that loop shut from
// 2026-10-31 on. Nothing is filled in; the file stays empty and a warning names
// the newest log day.
export function receiptsProblem({ entries, reads, weekAgo }) {
  if (Array.isArray(reads) && reads.length > 0) return { fail: false, warn: "" };
  const inWindow = (entries || []).filter((e) => e?.date && e.date >= weekAgo);
  if (inWindow.length > 0) return { fail: true, warn: "" };
  const newest = (entries || []).map((e) => e?.date).filter(Boolean).sort().pop() || "none";
  return { fail: false, warn: `watch log has no pick since ${weekAgo} (newest day ${newest}); receipts left empty` };
}
