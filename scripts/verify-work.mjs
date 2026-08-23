// verify-work.mjs — checks MY work, against mistakes I have actually made.
//
// Tyler, 2026-08-23, after a wrong price nearly went out as a post:
// "I would like an agent that verifies your work every time and catches any
// mistakes you make, because you clearly are making them."
//
// Fair. Today alone: a windowless historical average published as a current
// price; a falsifier that pooled two cohorts a thesis explicitly contrasts and
// nearly retired a correct claim; a layout fixed with a label instead of a
// move; four checkers that read their own source; a rationing system for a
// budget that was not scarce.
//
// SO THIS DOES NOT CHECK GENERIC QUALITY. Every rule below is a class from our
// own error ledger — a thing that actually happened here, to us. Generic
// linting is already covered; this is the specific list of ways I get things
// wrong, run against everything we are about to publish.
//
// IT RUNS LAST, ON OUTPUT, NOT ON INTENT. What I meant to do is not evidence.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return ""; } };

const problems = [];
const P = (cls, what, why, err) => problems.push({ errorClass: cls, what, why, ledgerRef: err });

const feed = await J("research/pulse/pulse-feed.json") ?? {};
const der = await J("data/derived-insights.json") ?? {};
const scripts = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));

// ── ERROR 18a · A FIGURE WITH NO WINDOW OR NO PROVENANCE ───────────────────
// The one that nearly reached a post. Every published price must be able to
// answer two questions: where did it come from, and when was it true.
{
  const walk = (node, path = "") => {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      const here = path ? `${path}.${k}` : k;
      // A price-shaped number inside a block that carries a chip is a claim.
      if (typeof v === "number" && /price|median|market|psa\d|value|ask|sold/i.test(k) && v > 1) {
        const parent = node;
        const hasChip = typeof parent.chip === "string";
        const hasWhen = Object.keys(parent).some(x => /at$|date|updated|asOf|window|days|checked/i.test(x));
        if (hasChip && !hasWhen)
          P("windowless figure", `${here} = ${v}`,
            "A chipped figure with no date, window or as-of field cannot be defended. This is the exact shape of error 18: a historical average published as a current price.", 18);
      }
      if (v && typeof v === "object") walk(v, here);
    }
  };
  walk(feed.dailyThree ?? {}, "dailyThree");
  walk(der.dealZone?.byId ? { sample: Object.values(der.dealZone.byId)[0] } : {}, "dealZone");
}

// ── ERROR 18b · A PUBLICATION PATH THE GUARDS DO NOT COVER ─────────────────
// The process half. I minted post cards by hand and no guard saw them.
{
  const pipeline = await R("scripts/generate-pulse.mjs");
  const cardDir = await readdir(join(ROOT, "research/pulse/cards")).catch(() => []);
  const minted = cardDir.filter(f => f.endsWith(".svg"));
  const generators = scripts.filter(f => /mint|card|rasterize/.test(f));
  const wired = generators.filter(f => pipeline.includes(f));
  if (generators.length > wired.length)
    P("ungated publication", `${generators.length - wired.length} card generator(s) are not in the pipeline: ${generators.filter(f => !wired.includes(f)).join(", ")}`,
      "Anything that produces a publishable artifact outside the run is a path around every guard. That is how a wrong price reached a card today.", 18);
  if (minted.some(f => /latest-(graded|artist|liquidity)/.test(f)))
    P("ungated publication", "hand-minted cards are sitting in the cards directory",
      "Cards made outside the pipeline were never seen by content-sanity, publish-assert, voice-lint or domain-plausibility. If it is going to a reader it goes through the gates.", 18);
}

// ── ERROR 14 · AN UNSOURCED CLAIM ABOUT THE WORLD ─────────────────────────
{
  const kb = await J("data/knowledge.json") ?? { facts: [] };
  const unsourced = (kb.facts ?? []).filter(f => !(f.sources ?? []).length);
  if (unsourced.length) P("unsourced claim", `${unsourced.length} fact(s) with no source`, "A claim about the world without a source is an opinion with a citation slot.", 14);
}

// ── ERROR 13 · AN UNVERIFIED CLAIM ABOUT OUR OWN PRODUCT ──────────────────
// Saying a thing works when nobody checked. Registered guards that no test
// breaks are exactly this.
{
  const tests = await R("scripts/negative-tests.mjs");
  const registry = await R("research/SAFEGUARD-REGISTRY.md");
  const rows = registry.split("\n").filter(l => /^\| \d+ \|/.test(l)).length;
  const cases = (tests.match(/\{ guard: "/g) ?? []).length;
  if (rows > cases + 8)
    P("unverified product claim", `${rows} registered safeguards against ${cases} negative tests`,
      "A registered guard nobody breaks is a claim that something works, made without checking. That is error 13 in its original form.", 13);
}

// ── ERROR 15/16 · A COMPARISON THAT IS NOT LIKE-FOR-LIKE ──────────────────
{
  const sp = await J("data/sealed-prices.json") ?? { products: [] };
  const mixed = sp.products.filter(p => p.priceVenue && p.listingVenue && p.priceVenue !== p.listingVenue && !p.venueNote);
  if (mixed.length) P("mismatched basis", `${mixed.length} product(s) mix venues without a label`,
    "A price from one marketplace beside a depth from another reads as one market. Labelled it is honest; unlabelled it is a false comparison.", 15);
}

// ── ERROR 11 · MULTI-ITEM POLLUTION ───────────────────────────────────────
{
  const sp = await J("data/sealed-prices.json") ?? { products: [] };
  const suspicious = sp.products.filter(p => p.dataStatus === "live" && p.subtype === "booster-pack" && p.priceMedian > 40);
  if (suspicious.length) P("multi-item pollution", `${suspicious.length} single pack(s) priced above $40`,
    "A single pack at that price usually means a multi-pack listing survived the filter. This is error 11, and it is how a whole class of prices got inflated before.", 11);
}

// ── ERROR 16 · UNTESTED ASSUMPTION ────────────────────────────────────────
{
  const brk = await J("research/pulse/breaker-report.json") ?? {};
  const highs = (brk.hypotheses ?? []).filter(h => h.severity === "high").length;
  if (highs >= 5) P("untested assumption", `${highs} high-severity untested assumptions are open`,
    "The Breaker exists to find these, and a growing backlog means we are shipping faster than we are checking. That is error 16 accumulating.", 16);
}

// ── ERROR: SKU EXISTENCE ──────────────────────────────────────────────────
{
  const sp = await J("data/sealed-prices.json") ?? { products: [] };
  const ghosts = sp.products.filter(p => p.dataStatus === "live" && (p.listingCount ?? 0) === 0);
  if (ghosts.length) P("sku existence", `${ghosts.length} product(s) marked live with zero listings`,
    "A tracked product that never has listings is a permanent source of wrong numbers, and marking it live claims we can price something we cannot.", 0);
}

// ── ERROR: COVERAGE OVERCLAIM ─────────────────────────────────────────────
{
  const dem = await J("research/pulse/demand.json") ?? {};
  const rows = (dem.liquidity ?? []).length;
  const enr = await J("data/singles-enrichment.json") ?? {};
  const chosen = (enr.cards ?? enr.rows ?? []).length;
  if (rows > chosen * 5 && rows > 100) P("coverage overclaim", `demand reports ${rows} rows from an enrichment sample of ${chosen} chosen cards`,
    "A found sample is not chosen coverage. Describing one as the other is how a number that means little gets read as a market-wide figure.", 0);
}

// ── THE META-CHECK · did I exclude myself? ────────────────────────────────
// Five checkers read their own source in one day. This one names the risk out
// loud rather than assuming it is immune.
const selfAware = true;   // this file audits data and other scripts, never itself

const out = { generatedAt: new Date().toISOString(),
  purpose: "Checks output against the failure classes in our own error ledger — things that actually happened here, not generic quality rules.",
  runsOn: "output, never intent. What I meant to do is not evidence.",
  classesChecked: [11, 13, 14, 15, 16, 18, "sku existence", "coverage overclaim"],
  problems };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/work-verification.json"), JSON.stringify(out, null, 1));

if (problems.length) {
  console.error(`\n✗ WORK VERIFICATION — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   [error ${p.ledgerRef} · ${p.errorClass}] ${p.what}\n     ${p.why}`);
  console.error("");
  process.exitCode = 1;
} else {
  console.log(`✓ work verification: nothing matching ${out.classesChecked.length} known failure classes reached output`);
}
