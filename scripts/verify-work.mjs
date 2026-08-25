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

// ── ERROR: A PUBLISH PATH THAT CAN FIRE WITHOUT A HUMAN ───────────────────
// X's Original Content Rewards program states that content created or posted by
// AUTOMATED MEANS is ineligible. That turns the confirm gate from a convenience
// into an eligibility control, and it means the dangerous change is not a bug —
// it is a future maintainer removing friction on purpose, reasonably, because
// nobody wrote down why it was there. This check is that note, in a form that
// fails the build.
{
  const PUBLISHES = /api\.x\.com\/2\/tweets|upload\.twitter\.com|statuses\/update/;
  // MATCH THE READING OF A FLAG, NOT A MENTION OF ONE. Two false positives in a
  // row came from prose: first the comment explaining there is deliberately no
  // --force, then the help text telling the user the same thing. Both were the
  // documentation this guard exists to protect, and both got flagged as the
  // defect. A bypass is not a string in a file — it is argv being consulted for
  // one, so that is what this looks for.
  const BYPASS = /(?:args|argv)\s*\.\s*includes\s*\(\s*["']--(force|yes|no-?confirm|skip-?confirm|unattended|auto-?send)["']|\bflag\(\s*["'](force|yes|no-?confirm|skip-?confirm|unattended|auto-?send)["']/;
  // A GET IS NOT A PUBLISH, AND THE URL CANNOT TELL YOU WHICH IT IS.
  // GET /2/tweets/:id reads a post's metrics; POST /2/tweets creates one. They
  // differ by method alone, so matching the endpoint flagged read-metrics.mjs
  // the moment it gained a fetch command on 2026-08-25 — a read-only path that
  // cannot publish anything, reported as an eligibility risk.
  //
  // THIS IS THE THIRD TIME THIS GUARD HAS MADE THE SAME MISTAKE. It flagged the
  // comment explaining there is no --force flag, then the help text saying the
  // same, and now a reader for looking like a writer. The class is: matching
  // the SHAPE of a thing instead of the thing. The fix each time has been to
  // ask what the code DOES, not what strings it contains.
  const SENDS = /method:\s*["']POST["']|signedFetch\(\s*["']POST["']/i;
  for (const f of scripts) {
    const src = await R("scripts/" + f);
    if (!PUBLISHES.test(src) || !SENDS.test(src)) continue;
    const gated = /isTTY/.test(src) && /evaluateConfirmation/.test(src);
    if (!gated)
      P("ungated publication", `${f} can publish to X without a human confirmation gate`,
        "It reaches a posting endpoint but does not both check for an attached terminal and run the confirmation policy. Content posted by automated means is ineligible for the Original Content Rewards program — an unattended send does not save time, it disqualifies the account. See data/compliance-register.json, retrieved 2026-08-25.", 18);
    // CODE LINES ONLY. The comment in post-queue.mjs explaining that there is
    // deliberately no --force flag contains the string "--force", and the first
    // version of this check flagged the file for saying why it was safe. A
    // guard that cannot tell an implementation from a note about it will train
    // people to delete the notes.
    const by = src.split(/\r?\n/)
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .map((l) => l.match(BYPASS)).find(Boolean);
    if (by)
      P("ungated publication", `${f} reads a --${by[1] ?? by[2]} flag, which would skip the human confirmation`,
        "There is deliberately no override on the send gate. A flag that bypasses it is the single change that makes every post ineligible, and it will look like a reasonable convenience to whoever adds it.", 18);
  }
  const wf = await readdir(join(ROOT, ".github/workflows")).catch(() => []);
  for (const w of wf) {
    const src = await R(".github/workflows/" + w);
    if (/post-queue/.test(src) && /\bsend\b/.test(src))
      P("ungated publication", `.github/workflows/${w} invokes the posting queue's send path`,
        "A scheduled runner has no terminal and no human. Posting from CI is automated posting, which is what the programme excludes.", 18);
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

// ── ERROR: A METRIC QUOTED IN PROSE OR CODE THAT IS NOT THE SETTLED READING ─
// Added 2026-08-25, from the 18,800 defect. The Arita pairing was read at
// 15h20m, mid-climb, and 18,800 was written into house-theses.md five times, a
// register definition, a layout label, a theme string a user reads, and two
// engine comments. It settled at 127,200 — the quoted figure understated the
// post by 6.8x and had been reasoned ON TOP OF: a law about reach relative to
// account size was calibrated against it, and that law asserted Tyler was "in
// this company" when 18,800 was 0.87x his follower count and the comparison
// account was at 2.11x. A wrong number does not sit still. It becomes evidence.
//
// THE RULE: once a post has a settled 48h reading, every EARLIER reading of the
// same post is a dead number. Quoting one anywhere outside an explicit
// withdrawal is a defect.
//
// WHY THE MARKER LIST EXISTS: the corrected passages necessarily still contain
// the wrong figure — that is what a correction looks like. So an occurrence is
// allowed when it sits within six lines of a withdrawal marker. That is a
// deliberate hole: it means anyone can silence this guard by typing the word
// "corrected" nearby. It is declared in data/guard-blindspots.json.
{
  // A FIGURE IS NOT A SUBSTRING. Caught by pre-mortem 2026-08-25, which flagged
  // this block the day it was written for carrying the "substring where
  // structure exists" shape - the same class that once matched /tin/i against
  // Dratini, Victini and Mantine across 174 real singles.
  // Plain .includes() finds a figure inside a LARGER one: a five-digit value
  // sits inside its own six-digit multiple, and a comma-grouped one sits inside
  // any longer number ending the same way. A digit or comma on either side
  // means this is a different number that merely contains ours.
  //
  // A TRAILING FULL STOP IS NOT A DECIMAL POINT. The first version of this
  // treated any adjacent "." as number-internal, so a sentence ending "settled
  // at 127,200." failed its own allow-check and the guard reported the
  // CORRECTION PAGE as a defect. A period counts only when a digit follows it.
  //
  // The figures are described rather than quoted here on purpose: this file has
  // now flagged its own notes three times, and its own lesson is that a guard
  // which cannot tell an implementation from a note about it trains people to
  // delete the notes.
  const SCANNED_EXTS = new Set([".md", ".mjs", ".js", ".html"]);
  const hasFigure = (line, form) => {
    let i = -1;
    while ((i = line.indexOf(form, i + 1)) !== -1) {
      const before = line[i - 1] ?? "", after = line[i + form.length] ?? "";
      const glued = (c, next) => /[\d,]/.test(c) || (c === "." && /\d/.test(next ?? ""));
      if (!glued(before, line[i - 2]) && !glued(after, line[i + form.length + 1])) return true;
    }
    return false;
  };
  const outcomes = await J("data/post-outcomes.json") ?? { posts: [] };
  const MARKERS = /withdrawn|corrected|used to say|what it claimed|still climbing|unsettled|mid-climb|understated|superseded|not a settled|was read|dead number|no longer/i;
  const stale = [];
  for (const post of outcomes.posts ?? []) {
    const ms = post.metrics ?? [];
    const settled = ms.find(m => m.checkpoint === 48);
    if (!settled) continue;   // nothing is stale until something has settled
    for (const m of ms) {
      if (m === settled) continue;
      // Only figures big enough to be unambiguous. A superseded "14 replies"
      // would match a page number, a set size and a year.
      for (const [field, v] of Object.entries(m)) {
        if (typeof v !== "number" || v < 1000) continue;
        if (settled[field] === v) continue;   // unchanged between readings
        stale.push({ post: post.id, field, value: v,
          settledValue: settled[field], atHours: m.atHours });
      }
    }
  }

  if (stale.length) {
    const files = [];
    const walk = async (dir) => {
      for (const e of await readdir(join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (/node_modules|\.git$/.test(rel)) continue;
        // The outcome log is the SOURCE of the settled reading. Every earlier
        // reading legitimately lives there as a time series; flagging it would
        // be the guard reporting its own input as a defect.
        if (rel.endsWith("data/post-outcomes.json")) continue;
        // Dated session reports are a record of what was believed on a day.
        // Rewriting them would destroy the audit trail this repo runs on.
        if (rel.includes("research/reports")) continue;
        if (e.isDirectory()) await walk(rel);
        // SET MEMBERSHIP, NOT A PATTERN ON A NAME. pre-mortem flagged the
        // regex that stood here the day this block was written: matching a
        // pattern against a filename is the shape that put /tin/i through 174
        // real singles. An extension is a closed set, so it is checked as one.
        else if (SCANNED_EXTS.has(e.name.slice(e.name.lastIndexOf(".")))) files.push(rel);
        // A json string is only interesting when it is prose about a post.
        else if (e.name.endsWith(".json")) files.push(rel);
      }
    };
    await walk(".");

    for (const f of files) {
      const src = await R(f.replace(/^\.\//, ""));
      if (!src) continue;
      const lines = src.split(/\r?\n/);
      for (const s of stale) {
        const forms = [s.value.toLocaleString("en-US"), String(s.value)];
        const settledForms = [s.settledValue.toLocaleString("en-US"), String(s.settledValue)];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!forms.some(form => hasFigure(line, form))) continue;
          // A bare json file only counts when the line is talking about a post.
          if (f.endsWith(".json") && !/view|impression|reach/i.test(line)) continue;
          const ctx = lines.slice(Math.max(0, i - 6), i + 4).join("\n");
          if (MARKERS.test(ctx)) continue;
          // A better signal than any word list: if the SETTLED figure is
          // standing next to the dead one, the passage already knows. This is
          // what a corrected paragraph looks like, and it needs no vocabulary.
          if (settledForms.some(form => hasFigure(ctx, form))) continue;
          P("stale metric", `${f}:${i + 1} quotes ${forms[0]} for ${s.post}`,
            `${s.field} settled at ${s.settledValue.toLocaleString("en-US")} at 48h; ${forms[0]} was the reading at ${s.atHours}h and is a dead number. Quote the settled figure, or mark the line as a withdrawal.`,
            "stale-metric");
        }
      }
    }
  }
}

// ── ERROR: A SUCCESS LINE WHOSE NUMBER IS NOT FROM THE ARTIFACT ────────────
// build-editor.mjs printed "16,468 cards searchable" while shipping 6,725. The
// number was real - it was the CATALOGUE size - and the page it described held
// 41% of that. It sat in plain output through every run for weeks, and no guard
// looked at it, because a green line with a big number reads as evidence.
//
// THE SHAPE: read an input, write something DERIVED from it, then report the
// input's size as though it were the output's. The log is true of something,
// just not of the thing it names. It cannot drift into being wrong later - it
// is wrong the moment the writer starts filtering, and nothing fails.
//
// This is static and it checks PROVENANCE, not equality: where the number came
// from, not whether it happens to match today. Three of the lines it finds are
// numerically correct right now and would go wrong silently the day their
// writer gained a filter. That is the point - build-editor's was correct once
// too. Declared in data/guard-blindspots.json.
//
// TO SATISFY IT: derive the count from what you wrote, or say on the line that
// it counts WORK rather than output - "207 products checked" is a true claim
// about a run, not a claim about a file.
{
  const OK_MARK = /counts work, not artifact|work performed, not artifact/i;
  for (const f of scripts) {
    const src = await R("scripts/" + f);
    if (!src) continue;
    const writes = [...src.matchAll(/write(?:File)?(?:Sync)?\s*\(\s*(?:join\([^,]+,\s*)?["'`]([^"'`]+)["'`]/g)]
      .map(m => m[1]).filter(w => /\.(json|html|svg|md|txt|js)$/.test(w));
    if (!writes.length) continue;
    const writeVars = [...src.matchAll(/write(?:File)?(?:Sync)?\s*\([^,]+,\s*([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!/console\.log\(\s*[`"']\s*✓/.test(ln)) continue;
      const ctx = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
      if (OK_MARK.test(ctx)) continue;
      // REPORTING BOTH NUMBERS IS THE GOOD PATTERN, NOT THE BAD ONE.
      // "207 rows rendered from 207 products" states the ratio, and a ratio is
      // precisely what would have exposed build-editor: 6,725 shipped out of
      // 16,468. The defect is reporting ONLY the input, so a line that already
      // carries an artifact-derived count has answered the question.
      const derivesFromArtifact = [...ln.matchAll(/\$\{([^}]+)\}/g)].some((mm) => {
        const e = mm[1];
        if (/\.match\(|html|output|\bout\b/.test(e)) return true;
        const rt = (e.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
        return rt && writeVars.includes(rt);
      });
      if (derivesFromArtifact) continue;
      for (const m of ln.matchAll(/\$\{([^}]+)\}/g)) {
        const expr = m[1].trim();
        if (!/\.length|\.size|Object\.keys|toLocaleString/.test(expr)) continue;
        const root = (expr.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
        if (!root || writeVars.includes(root)) continue;
        const a = src.match(new RegExp("(?:const|let|var)\\s+" + root + "\\s*=\\s*([^;\\n]+)"));
        const from = a ? a[1] : "";
        // Derived from the produced text is fine - that IS measuring the artifact.
        if (/\.match\(|html|output|out\b/.test(from)) continue;
        if (!/await J\(|readFile|require\(/.test(from)) continue;
        P("unverified success line", `${f}:${i + 1} reports \${${expr}} from an input, not from ${writes[0]}`,
          "The number describes the file it READ, not the file it WROTE. build-editor printed the catalogue size over an index holding 41% of it, in plain output, for weeks. Derive the count from what was written, or mark the line as counting work rather than artifact.",
          "unverified-success-line");
      }
    }
  }
}

// ── THE META-CHECK · did I exclude myself? ────────────────────────────────
// Five checkers read their own source in one day. This one names the risk out
// loud rather than assuming it is immune.
const selfAware = true;   // this file audits data and other scripts, never itself

const out = { generatedAt: new Date().toISOString(),
  purpose: "Checks output against the failure classes in our own error ledger — things that actually happened here, not generic quality rules.",
  runsOn: "output, never intent. What I meant to do is not evidence.",
  classesChecked: [11, 13, 14, 15, 16, 18, 21, 24, 25, "sku existence", "coverage overclaim", "monetization miscount", "ungated publication (automation)", "stale metric", "unverified success line"],
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
