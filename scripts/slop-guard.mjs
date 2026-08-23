// slop-guard.mjs — is this grouping in the data, or did I make it up?
//
// Tyler, 2026-08-23: "ZERO AI SLOP. That's the quickest way to screw everything
// up." He is right, and slop has a precise meaning here rather than a vague one:
//
//   SLOP IS A GROUPING THAT IS NOT IN THE DATA.
//
// "Cute cards" is slop. "The nine Eeveelutions" is not — one is an adjective I
// chose, the other is a list somebody can argue with. "Iconic" is slop.
// "Drawn by the same artist" is a field. The difference matters because the
// moment a reader checks one claim and finds nothing behind it, every other
// claim we have made becomes suspect at once.
//
// This checks that every published grouping is derivable, and that no claim
// leans on an adjective doing work a field should be doing.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const FIELDS = ["name", "artist", "setId", "setName", "number", "rarity", "releaseDate", "price", "supertype"];
// Words that assert taste or significance without anything behind them. Each of
// these has been used, by me, in a sentence that could not be checked.
const ASSERTIONS = /\b(cute|iconic|beautiful|stunning|underrated|hidden gem|must-have|legendary art|best|greatest|most beautiful|perfect|amazing|incredible)\b/i;

const problems = [];
const P = (where, what, why) => problems.push({ where, what, why });

const f = await J("research/pulse/formulas.json");
if (f) {
  for (const x of f.formulas ?? []) {
    // 1 — every basis must name real fields.
    const named = FIELDS.filter(fl => (x.basis ?? "").toLowerCase().includes(fl.toLowerCase()));
    if (!named.length && !/named list/.test(x.basis ?? ""))
      P(x.title, "basis names no real field", `"${x.basis}" — a grouping has to come from a column or from a list stored openly. Otherwise it is taste presented as a finding.`);
    // 2 — no adjective doing a field's job.
    for (const t of [x.title, x.why, x.angle]) {
      const hit = ASSERTIONS.exec(t ?? "");
      if (hit) P(x.title, `asserts "${hit[0]}"`, "That word claims significance nothing in the data supports. Say what IS true and let the images argue.");
    }
    // 3 — a grouping of one or two is not a grouping.
    if ((x.count ?? 0) < 2) P(x.title, `only ${x.count} card(s)`, "A pattern needs more than one instance or it is a coincidence with a caption.");
  }
  // 4 — judgment lists must exist and be visible, not implied.
  if (!f.judgmentLists || !Object.keys(f.judgmentLists).length)
    P("formulas", "no judgment lists published", "Where a theme needs a human decision, the decision must be stored where somebody can disagree with it. An adjective cannot be argued with; a list can.");
}

// 5 — the same check across published copy, since slop leaks into sentences
// long after it has been kept out of groupings.
const feed = await J("research/pulse/pulse-feed.json");
if (feed) {
  const walk = (n, path = "") => {
    if (!n || typeof n !== "object") return;
    for (const [k, v] of Object.entries(n)) {
      if (typeof v === "string" && v.length > 25) {
        const hit = ASSERTIONS.exec(v);
        if (hit) P(`feed.${path}${k}`, `asserts "${hit[0]}"`, "Published copy claiming significance the data does not carry.");
      }
      if (v && typeof v === "object") walk(v, `${path}${k}.`);
    }
  };
  walk(feed.dailyThree ?? {}, "dailyThree.");
}

if (problems.length) {
  console.error(`\n✗ SLOP — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 10)) console.error(`   ${p.where}: ${p.what}\n     ${p.why}`);
  console.error("\n   A grouping that is not in the data is the fastest way to lose a reader's trust in all the ones that are.\n");
  process.exitCode = 1;
} else {
  console.log(`✓ slop guard: every grouping derives from a real field or an openly stored list${f ? ` · ${(f.formulas ?? []).length} formulas checked` : ""}`);
}
