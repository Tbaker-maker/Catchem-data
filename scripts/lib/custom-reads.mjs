// Per-follow slices for one day. A day with no matching reads is quiet and is not written.

export function matchesFollow(follow, read) {
  if (!follow || !read) return false;
  if (Array.isArray(follow.cards) && follow.cards.includes(read.cardId)) return true;
  if (Array.isArray(follow.sets) && follow.sets.includes(read.set)) return true;
  if (Array.isArray(follow.kinds) && follow.kinds.includes(read.kind)) return true;
  return false;
}

export function sliceFollow(follow, reads, day) {
  const matched = (reads || []).filter((read) => matchesFollow(follow, read));
  if (!matched.length) {
    return { followId: follow.id, day, quiet: true, skipped: true, reads: [] };
  }
  return {
    followId: follow.id,
    day,
    quiet: false,
    skipped: false,
    reads: matched.map((read) => ({
      id: read.id,
      set: read.set || "",
      cardId: read.cardId || "",
      kind: read.kind || "",
      line: read.line || "",
    })),
  };
}

export function buildFollowSlices({ follows = [], reads = [], day = "" } = {}) {
  const slices = [];
  const quiet = [];
  for (const follow of follows) {
    const slice = sliceFollow(follow, reads, day);
    if (slice.quiet) quiet.push(slice.followId);
    else slices.push(slice);
  }
  return { day, slices, quiet };
}
