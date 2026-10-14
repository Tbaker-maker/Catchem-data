// Grade "Where's it heading?" votes against a later price. Private signal
// only. The public gate is unchanged: n under 20 does not pass.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function movePct(from, to) {
  const a = Number(from);
  const b = Number(to);
  if (!(a > 0) || !(b > 0)) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

export function voteHit(dir, pct) {
  if (pct == null || !Number.isFinite(pct)) return false;
  if (dir === "flat") return Math.abs(pct) <= 3;
  if (dir === "down") return pct <= -3;
  if (dir === "up") return pct >= 3;
  return false;
}

export function gradeVote(vote, later) {
  const dir = vote?.dir === "down" || vote?.dir === "flat" ? vote.dir : vote?.dir === "up" ? "up" : "";
  const pct = movePct(vote?.price, later?.price);
  return {
    id: String(vote?.id || ""),
    itemId: String(vote?.itemId || ""),
    dir,
    from: DAY.test(vote?.date || "") ? vote.date : "",
    to: DAY.test(later?.date || "") ? later.date : "",
    price: Number(vote?.price) || null,
    later: Number(later?.price) || null,
    pct,
    hit: Boolean(dir) && voteHit(dir, pct),
  };
}

export function summarizeVotes(graded, { minN = 20 } = {}) {
  const rows = (graded || []).filter((row) => row.dir && row.pct != null);
  const byDir = {};
  for (const dir of ["up", "down", "flat"]) {
    const side = rows.filter((row) => row.dir === dir);
    const hits = side.filter((row) => row.hit).length;
    byDir[dir] = {
      n: side.length,
      hits,
      rate: side.length ? Math.round((hits / side.length) * 1000) / 10 : null,
      passed: side.length >= minN,
    };
  }
  return {
    n: rows.length,
    passed: rows.length >= minN,
    minN,
    byDir,
    note: "Private scanner signal. A direction is a hit when the later price moved at least 3% that way, or stayed within 3% for flat. Under 20 graded votes it does not pass.",
  };
}
