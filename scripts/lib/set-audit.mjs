// Set grouping audit. One public set = one TCGplayer group, except the
// folds and sealed attachments named in set-master.mjs (the allowlist).
import { ATTACH_SEALED, FOLD_GROUPS } from "./set-master.mjs";

export function homeGroup(item, groupsPresent) {
  const attach = ATTACH_SEALED.get(Number(item.tcgplayerProductId));
  if (attach && groupsPresent.has(attach)) return { gid: attach, via: "attach" };
  const fold = FOLD_GROUPS.get(Number(item.groupId));
  if (fold && groupsPresent.has(fold.parent)) return { gid: fold.parent, via: "fold" };
  return { gid: Number(item.groupId), via: "own" };
}

// Returns { sets: Map<homeGid, {groups:Set, items}>, problems: [] }.
export function auditGroups(items) {
  const present = new Set(items.map((i) => Number(i.groupId)));
  const sets = new Map();
  for (const item of items) {
    const h = homeGroup(item, present);
    if (!sets.has(h.gid)) sets.set(h.gid, { groups: new Map(), items: [] });
    const s = sets.get(h.gid);
    const g = Number(item.groupId);
    s.groups.set(g, h.via === "own" ? "own" : h.via);
    s.items.push(item);
  }
  const problems = [];
  for (const [gid, s] of sets) {
    for (const [g, via] of s.groups) {
      if (g !== gid && via === "own") problems.push({ set: gid, group: g, kind: "unlisted merge" });
    }
  }
  return { sets, problems };
}

// Groups in a published set that are not its home group, a fold of it, or
// an attached sealed product. items carry pid; pidGroup maps pid to groupId.
export function foreignGroups(items, pidGroup) {
  const count = new Map();
  for (const it of items) {
    const g = pidGroup.get(Number(it.pid));
    if (g) count.set(g, (count.get(g) || 0) + 1);
  }
  if (!count.size) return [];
  const folded = (g) => FOLD_GROUPS.get(g)?.parent;
  let home = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (folded(home) && count.has(folded(home))) home = folded(home);
  const out = [];
  for (const it of items) {
    const g = pidGroup.get(Number(it.pid));
    if (!g || g === home || folded(g) === home) continue;
    if (ATTACH_SEALED.get(Number(it.pid)) === home) continue;
    out.push(`${g}:${it.pid}`);
  }
  return [...new Set(out.map((x) => x.split(":")[0]))];
}
