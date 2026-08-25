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

// ── UNVIEWED IMAGE ────────────────────────────────────────────────────────
// The rule I broke twice in one day: I minted two cards, viewed one, and sent
// both. The unviewed one was nonsense. No automated check can see clipping,
// overlap or collision — only eyes can — so the process rule is absolute and
// the guard's job is to state it every run rather than to enforce it.
{
  const cardDir = await readdir(join(ROOT, "research/pulse/cards")).catch(() => []);
  const pngs = cardDir.filter(f => f.endsWith(".png"));
  if (pngs.length) P("unviewed image", `${pngs.length} rendered card(s) exist`,
    "Nothing here can tell whether they LOOK right — clipping, overlap, a wordmark colliding with a stat row. Every card shown to a person must be opened and looked at first. That rule was broken twice today and both failures reached Tyler.", 18);
}

// ── SECONDARY CONSENSUS CONTRADICTED BY PRIMARY DATA (error 21) ───────────
// Three sources agreed Kadabra vanished for twenty-six years. Our own catalogue
// said twenty-one. Agreement between secondary sources is not evidence - it is
// frequently one source repeated - and the only cure is checking our own data
// before publishing, which is free and which we nearly skipped.
{
  const kb = await J("data/knowledge.json");
  const unchecked = (kb?.facts ?? []).filter(f =>
    (f.sources ?? []).length >= 2 &&
    !(f.sources ?? []).some(s => /our own|catalogue|catchem|primary/i.test(s)));
  if (unchecked.length)
    P("secondary consensus", unchecked.length + " fact(s) rest only on secondary sources",
      "Sources agreeing with each other is often one source repeated. Anything we can check against our own data must be checked before it is published.", 21);
}

// ── SIZED FOR THE CANVAS, SEEN AT THUMBNAIL (error 24) ────────────────────
// CC measured what I had reasoned about: price text at 26px on a 2535px canvas
// is 4.1px in a 400px Discord preview. A nine-card want list read as "nine
// cards" rather than "which ones and what they cost" — it failed at the working
// half of a working document, and every number in the source looked fine.
{
  const gens = (await readdir(join(ROOT, "scripts"))).filter(f => /^build-|card-composite/.test(f) && f.endsWith(".mjs"));
  for (const f of gens) {
    const src = await readFile(join(ROOT, "scripts", f), "utf-8").catch(() => "");
    // A fixed font size drawn onto a canvas whose width is variable is the shape.
    const fixedOnCanvas = /g\.font\s*=\s*"[^"]*\d+px/.test(src) && /canvas|createElement\("canvas"\)|cv\.width/.test(src);
    const scales = /thumbScale|400 \/ W|\/ W\b/.test(src);
    if (fixedOnCanvas && !scales)
      P("thumbnail legibility", f + " draws fixed-size text onto a variable-width canvas",
        "Text sized for the full canvas vanishes in a feed preview, where the image is actually seen and decided on. Scale to the canvas or the words are decoration.", 24);
  }
}

// ── PERISHABLE CLAIM ON A PUBLIC PAGE (error 25) ─────────────────────────
// I shipped "repriced every single day" onto a landing page while the heartbeat
// was reporting that day's run as FAILED and the data was 25.6 hours old. I
// verified the COUNT and never verified the FREQUENCY — I checked the noun and
// skipped the verb.
//
// A frequency claim is perishable: it is true until a cron fails, and then it is
// a lie on a page nobody is watching. A COUNT is perishable too, in the other
// direction — it goes stale the moment coverage grows.
{
  const files = (await readdir(join(ROOT, "research/assets"))).filter(f => f.endsWith(".html") && !/mock/.test(f));
  for (const f of files) {
    const src = await readFile(join(ROOT, "research/assets", f), "utf-8").catch(() => "");
    const visible = src.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
    // NARROWED after flagging five false positives on the first run: "post from
    // it daily" is advice to a user, "The Daily Three" is a product name,
    // "Daily Berry" is a rule. None promises the READER a cadence. The claim
    // that perishes is OUR DATA plus a FREQUENCY, in that order, close together.
    const freq = visible.match(/\b(priced|repriced|updated|refreshed|tracked|scanned)\b[^.<]{0,28}\b(every (single )?day|daily|every hour|hourly)\b/i)
             ?? visible.match(/\b(every (single )?day|daily|hourly)\b[^.<]{0,28}\b(priced|repriced|updated|refreshed|tracked)\b/i);
    if (freq)
      P("perishable claim", f + ' claims a refresh frequency ("' + freq[0] + '")',
        "A frequency claim is true until a cron fails, and then it is a lie on a public page nobody is watching. State what is TRACKED and how we behave when wrong — behaviour does not break when a job does.", 25);
  }
}

// ── ERROR: RAW VIEWS MEASURED AGAINST THE MONETIZATION THRESHOLD ──────────
// X pays on QUALIFIED impressions: unique Home Timeline impressions from X
// Premium subscribers with at least half the post visible. Replies excluded,
// repeat viewers excluded, promoted excluded. public_metrics.impression_count
// is none of those things — it is a strict SUPERSET, so measuring it against
// 500,000 does not approximate progress, it overstates it by an unknown factor.
// The failure this prevents is not arithmetic. It is applying to the program
// believing we cleared a bar we have no instrument to measure.
{
  const THRESHOLD = /\b500[_,]?000\b|\b500\s?k\b/i;
  const RAW = /\bviews\b|impression_count/;
  const COMPARISON = /[<>]=?|\bMath\.(min|max)\b|>=|<=/;
  for (const f of scripts) {
    const src = await R("scripts/" + f);
    if (!THRESHOLD.test(src)) continue;
    src.split(/\r?\n/).forEach((line, i) => {
      if (!THRESHOLD.test(line) || !RAW.test(line) || !COMPARISON.test(line)) return;
      if (/qualifiedImpressions/.test(line)) return;        // the correct quantity
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;          // prose about the rule
      P("monetization miscount", `${f}:${i + 1} compares raw views against the ${THRESHOLD.exec(line)[0]} threshold`,
        "Raw impression_count is a strict superset of qualified impressions — it counts replies, non-subscribers, repeat viewers and promoted placement, none of which qualify. Only Creator Studio reports the qualifying figure. Comparing raw views to this threshold overstates eligibility by an unknown factor. See data/compliance-register.json, retrieved 2026-08-25.", "monetization");
    });
  }
  // The same error in prose is the same error. A doc that tells a future
  // maintainer we are "N views from monetization" teaches the bug.
  for (const f of ["SYSTEM-README.md", "HANDOVER.md", "PICK-UP-HERE.md"]) {
    const src = await R(f);
    src.split(/\r?\n/).forEach((line, i) => {
      if (!THRESHOLD.test(line) || !RAW.test(line)) return;
      if (/qualified/i.test(line)) return;
      P("monetization miscount", `${f}:${i + 1} states raw views against the monetization threshold`,
        "Written down, this becomes the number somebody acts on. Qualified impressions are the only figure the program counts and they are not visible from here.", "monetization");
    });
  }
}

// ── THE META-CHECK · did I exclude myself? ────────────────────────────────
// Five checkers read their own source in one day. This one names the risk out
// loud rather than assuming it is immune.
const selfAware = true;   // this file audits data and other scripts, never itself

const out = { generatedAt: new Date().toISOString(),
  purpose: "Checks output against the failure classes in our own error ledger — things that actually happened here, not generic quality rules.",
  runsOn: "output, never intent. What I meant to do is not evidence.",
  classesChecked: [11, 13, 14, 15, 16, 18, 21, 24, 25, "sku existence", "coverage overclaim", "monetization miscount"],
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
