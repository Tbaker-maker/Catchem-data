// Shallow clone of catchem-data-private without raw/.
// raw/ holds the nightly PPT pulls: about 19 of the repo's 20.5 GB on
// 2026-11-11, growing about 1 GB a night. A plain depth 1 clone checked all of
// it out for every private read or write, several times per build-feed pass
// (about 3.5 minutes each on the runner). Run 43111961381 then lost its runner
// in the rebuild. These clones only read and write data/, config/, research/
// and docs/, so raw/ is never fetched or checked out. push-private-ppt.mjs,
// which writes raw/<date>/, uses the same clone and adds only that day's
// folder back to the sparse set (it never needs older days on disk).
// Run 43126099936 lost its runner in "Dated reads, rip value, and status",
// five back-to-back private clones that each checked out all 21 GB.
export const PRIVATE_SPARSE = ["/*", "!/raw/"];

// git(cmd, args, env) resolves { code, err, out? }, the same shape every caller
// already passes. Returns the first failed step, or the checkout result.
// include: extra sparse patterns, e.g. ["/raw/2026-11-12/"] for the push step.
export async function clonePrivate(git, remote, dir, env, { include = [] } = {}) {
  const cloned = await git("git", ["clone", "--depth", "1", "--filter=blob:none", "--no-checkout", remote, dir], env);
  if (cloned.code !== 0) return cloned;
  const sparse = await git("git", ["-C", dir, "sparse-checkout", "set", "--no-cone", ...PRIVATE_SPARSE, ...include], env);
  if (sparse.code !== 0) return sparse;
  return git("git", ["-C", dir, "checkout"], env);
}
