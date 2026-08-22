// domain-plausibility.mjs — does this number make sense for THIS product?
//
// We have three layers of checking and none of them would catch what Tyler
// caught by eye:
//   schema-guard  — is the shape right?          (yes)
//   impossibility — is the value possible?       (yes, 26 is a fine number)
//   qa-gate       — is the data fresh and thick? (yes, 26 clears the floor)
//
// And yet 8 listings for an in-print Prismatic Evolutions booster pack is
// obviously wrong to anybody who knows the hobby. The set is 19 months old, in
// active circulation, one of the most opened products on the market. There are
// hundreds of those listings. A number can be structurally valid, numerically
// possible, statistically unremarkable, and still absurd in context.
//
// THIS CHECKS CONTEXT. Every rule is domain knowledge stated explicitly, with
// the reasoning attached, so it can be argued with rather than trusted. And
// every finding names the most likely CAUSE, because the answer is almost never
// "the market did that" — it is nearly always our own filter.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const sp = await J("data/sealed-prices.json") ?? { products: [] };
const der = await J("data/derived-insights.json") ?? {};
const lifecycle = Object.fromEntries((der.printWatch ?? []).map(p => [p.setId, p]));

const findings = [];
const F = (id, name, what, expected, likelyCause, severity) =>
  findings.push({ id, name, what, expected, likelyCause, severity, chip: "READ" });

for (const p of sp.products) {
  if (p.dataStatus !== "live") continue;
  const fr = p.filterReport ?? {};
  const fetched = fr.fetched ?? 0, kept = fr.kept ?? p.listingCount ?? 0;
  const life = lifecycle[p.setId];
  const ageMonths = life?.ageMonths ?? null;
  const activePrint = /active print|late print/i.test(life?.phase ?? "");

  // ── RULE 1 · An in-print modern product cannot be scarce ──────────────────
  // A set still in circulation, especially a popular one, has deep listings.
  // Single-digit or low-double-digit counts on a current product mean our
  // filter ate the market, not that the market vanished.
  if (ageMonths != null && ageMonths <= 30 && activePrint && kept < 30 && fetched >= 60)
    F(p.id, p.name, `${kept} listings kept from ${fetched} fetched`,
      "an in-print product this recent should hold dozens of listings at minimum",
      `${Math.round((1 - kept / fetched) * 100)}% of fetched listings were rejected — check filterReport.excludeTerms and failType before believing this is the market`,
      "high");

  // ── RULE 2 · Rejecting most of what you fetched is a filter fault ─────────
  // Above roughly 70% the filter is deciding the answer rather than finding it.
  if (fetched >= 50 && kept / fetched < 0.30)
    F(p.id, p.name, `${Math.round((1 - kept / fetched) * 100)}% rejection rate (${kept}/${fetched})`,
      "a healthy query keeps most of what it fetches",
      `largest bucket: ${Object.entries({ type: fr.failType ?? 0, exclude: fr.failExclude ?? 0, set: fr.failSet ?? 0, multi: fr.failMulti ?? 0 }).sort((a, b) => b[1] - a[1])[0].join(" = ")}. A single over-broad term can eat a market.`,
      "high");

  // ── RULE 3 · A pack cannot cost more than its own box ────────────────────
  if (p.subtype === "booster-pack" && p.priceMedian) {
    const box = sp.products.find(x => x.setId === p.setId && x.subtype === "booster-box" && x.priceMedian);
    if (box && p.priceMedian > box.priceMedian * 0.5)
      F(p.id, p.name, `a single pack at $${p.priceMedian} against a box at $${box.priceMedian}`,
        "one pack should cost a small fraction of a whole box",
        "either the pack query is catching multi-packs, or the box query is catching something cheap",
        "high");
  }

  // ── RULE 4 · Vintage should be thinner than modern, not the reverse ──────
  if (ageMonths != null && ageMonths >= 120 && kept > 100)
    F(p.id, p.name, `${kept} listings on a product ${Math.round(ageMonths / 12)} years old`,
      "genuinely vintage sealed product is scarce; hundreds of listings suggests reprints, fakes or a wrong match",
      "the query is probably matching a modern reprint or a different product with a similar name",
      "medium");

  // ── RULE 5 · A price that moved further than a market can in a day ───────
  const prev = p.prevPriceMedian;
  if (prev && p.priceMedian && Math.abs(p.priceMedian / prev - 1) > 0.5)
    F(p.id, p.name, `price moved ${Math.round((p.priceMedian / prev - 1) * 100)}% in one day`,
      "sealed markets do not move 50% overnight without an event",
      "a filter change, a query change, or a different set of listings — check what changed on our side first",
      "high");
}

// WHICH TERM IS EATING THE MARKET? Fifty-four thin products is not fifty-four
// problems — it is usually one over-broad term repeated everywhere. Ranking the
// terms turns a wall of symptoms into a short list of suspects.
const termKills = {};
for (const p of sp.products) for (const [t, n] of Object.entries(p.filterReport?.excludeTerms ?? {})) termKills[t] = (termKills[t] ?? 0) + n;
const suspects = Object.entries(termKills).sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([term, kills]) => ({ term, kills,
    // Terms that describe a SINGLE unit are the dangerous ones — they read as
    // multi-item but are how sellers title one item.
    suspicious: /^(packs|sleeved|single|pack)$/i.test(term),
    note: /^packs$/i.test(term) ? "a single pack is often titled 'Booster Packs' — plural in the title, one in the box"
        : /^sleeved$/i.test(term) ? "a sleeved booster IS a single pack, just with a foil sleeve"
        : "" }));

const out = { generatedAt: new Date().toISOString(),
  termSuspects: suspects,
  principle: "A number can be structurally valid, numerically possible, statistically unremarkable, and still absurd to anybody who knows the hobby. This checks CONTEXT — and always names our own filter as the first suspect, because it nearly always is.",
  rules: 5, findings: findings.sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1)).slice(0, 25),
  counts: { high: findings.filter(f => f.severity === "high").length, medium: findings.filter(f => f.severity === "medium").length } };
await writeFile(join(ROOT, "research/pulse/domain-plausibility.json"), JSON.stringify(out, null, 1));

if (out.counts.high) {
  console.error(`\n✗ DOMAIN PLAUSIBILITY — ${out.counts.high} implausible value(s):`);
  for (const f of out.findings.filter(f => f.severity === "high").slice(0, 6))
    console.error(`   ${f.name}: ${f.what}\n     expected: ${f.expected}\n     likely cause: ${f.likelyCause}`);
  console.error("");
  console.error("   Advisory: this does not block the run. 54 findings on day one would stop every build, and a guard that must be switched off to ship is a guard that gets switched off.\n");
  const bad = suspects.filter(s => s.suspicious);
  if (bad.length) { console.error(`   SUSPECT TERMS — these describe a SINGLE unit and may be eating real listings:`);
    for (const b of bad) console.error(`     "${b.term}" killed ${b.kills} listings — ${b.note}`); console.error(""); }
} else {
  console.log(`✓ domain plausibility: ${sp.products.length} products checked against 5 context rules${out.counts.medium ? ` · ${out.counts.medium} worth a look` : ""}`);
}
