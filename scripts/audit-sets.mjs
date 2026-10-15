// Writes data/private/set-audit.json: every public set checked against
// its TCGplayer source groups. Run: node scripts/audit-sets.mjs
import { readFile, writeFile } from "node:fs/promises";
import { auditGroups } from "./lib/set-audit.mjs";
import { FOLD_GROUPS } from "./lib/set-master.mjs";

const cat = JSON.parse(await readFile("data/catalog/tcgcsv-latest.json", "utf8"));
const groups = JSON.parse(await readFile("data/tcgcsv-groups.json", "utf8")).groups;
const pub = JSON.parse(await readFile("research/assets/public/sets.json", "utf8")).sets;
const gName = new Map(groups.map((g) => [g.groupId, g.name]));
const { sets, problems } = auditGroups(cat.items);
const bare = (n) => String(n).replace(/^[A-Z0-9]+:\s*/, "").toLowerCase();
const nameToGroup = new Map(groups.map((g) => [bare(g.name), g.groupId]));
const rows = [];
for (const [gid, s] of sets) {
  const flags = [];
  const merged = [...s.groups.keys()].filter((g) => g !== gid);
  if (merged.length) flags.push({ kind: "merges groups", detail: merged.map((g) => `${g} ${gName.get(g) || "?"} (${FOLD_GROUPS.has(g) ? "allowlisted fold" : "sealed attach"})`) });
  const stamped = {};
  for (const it of s.items) {
    const m = String(it.name).match(/\(([^)]+)\)\s*(\[[^\]]*\])?\s*$/);
    if (!m) continue;
    const other = nameToGroup.get(m[1].toLowerCase());
    if (other && other !== gid && !s.groups.has(other)) (stamped[m[1]] ||= []).push(it.name);
  }
  for (const [k, v] of Object.entries(stamped)) flags.push({ kind: "name stamp of another group", stamp: k, count: v.length, sample: v.slice(0, 4), note: "TCGplayer itself lists these in this group" });
  if (s.items.length < 5) flags.push({ kind: "near-empty", count: s.items.length });
  rows.push({ groupId: gid, name: gName.get(gid) || s.items[0].set, items: s.items.length, flags });
}
const pubFlags = [];
const seen = new Map();
for (const p of pub) {
  const k = bare(p.name);
  if (seen.has(k)) pubFlags.push({ kind: "duplicate name", a: seen.get(k), b: p.slug });
  seen.set(k, p.slug);
  if (!p.release) pubFlags.push({ kind: "no release date", slug: p.slug });
  if (p.single + p.sealed === 0) pubFlags.push({ kind: "empty", slug: p.slug });
  if (p.era === "Other") pubFlags.push({ kind: "era Other", slug: p.slug, name: p.name });
}
const out = { asOf: cat.asOf, catalogSets: rows.length, publicSets: pub.length, unlistedMerges: problems, flaggedSets: rows.filter((r) => r.flags.length), publicFlags: pubFlags };
await writeFile("data/private/set-audit.json", JSON.stringify(out, null, 1) + "\n");
console.log(`sets ${rows.length}, unlisted merges ${problems.length}, flagged ${out.flaggedSets.length}, public flags ${pubFlags.length}`);
