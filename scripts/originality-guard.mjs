// originality-guard.mjs — does this post contain work of our own?
//
// X's Original Content Rewards program pays for PRIMARY WORK: original
// reporting, self-shot photography, custom illustration, or genuine analytical
// commentary. Using someone else's work requires adding real value through
// substantive analysis or creative editing. It states four things that are
// explicitly NOT enough: copying, reuploading, adding watermarks, and basic text
// overlays that merely describe what is happening.
// (data/compliance-register.json, retrieved 2026-08-25 — dated facts, not law.)
//
// OUR EXPOSURE, SAID PLAINLY. The best post this project has produced is
// Pokémon's copyrighted card art, composited, with a text overlay and a Catch'em
// watermark. Read uncharitably that is third-party art + watermark + descriptive
// overlay: the excluded pattern, item for item. Read charitably the PAIRING is
// the original work — a 24-year illustrator continuity nobody else surfaced,
// found in our own catalogue. Both readings are available from the same image,
// and we do not get to pick which one a reviewer applies.
//
// SO THIS GUARD DOES NOT JUDGE THE POST. It cannot. It makes us write down what
// the original contribution IS, in advance, in a sentence, and it refuses to let
// anything ship that has no answer. The value is not the checking — it is that
// "we cropped a card" is very hard to type into a field labelled 'what is
// original here', and noticing that you cannot answer is the entire point.
//
// WHAT IT CANNOT DO, stated here and in data/guard-blindspots.json rather than
// left implied: it cannot tell whether X agrees with the claim we stored. It
// checks that a claim exists and is specific. A confident, well-written, wrong
// claim passes everything below. It also never sees the image.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const J = async (p, d) => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return d; } };
const CLAIMS = "data/originality-claims.json";

// ── the four questions ────────────────────────────────────────────────────
export const QUESTIONS = [
  { key: "contribution", ask: "What is the original contribution here, in one sentence?" },
  { key: "analyzes", ask: "Does the caption ANALYZE or merely DESCRIBE what is visible?" },
  { key: "derivedFrom", ask: "Is the insight derivable from our own catalogue/enrichment data? Cite the source." },
  { key: "standsAsPlainText", ask: "Would this still be interesting as plain text with no image?" },
];

// Phrases that describe handling somebody else's work rather than making our
// own. Not a blocklist of words — a list of the things that are not answers.
const NON_CONTRIBUTION = /\b(cropp?(ed|ing)?|crop of|zoom(ed)?|watermark(ed|ing)?|re-?upload(ed)?|screenshot(ted)?|repost(ed)?|just (posted|shared)|added (a )?(text|caption|overlay)|nice art|cool card|the art is)\b/i;

// External provenance. If the insight came from another account or an article,
// it is their analysis with our watermark on it — the exact excluded pattern.
const EXTERNAL_SOURCE = /\b(saw (it )?on|from|via)\s*@|\b@\w+\s+(said|posted|pointed out)|\b(reddit|tiktok|instagram|youtube|a thread|an article|someone (said|posted|noted))\b/i;

// Markers of a claim rather than a label: a number, a span of years, a
// comparison, a causal or contrastive connective, a named relation.
const ANALYTICAL = /\b\d+\b|\b(years?|decades?)\b|\bsame\b|\bdifferent\b|\bbecause\b|\bwhich means\b|\bso\b|\bwhile\b|\bstill\b|\bfirst\b|\blast\b|\bonly\b|\bnever\b|\bmore than\b|\bfewer\b|\bbetween\b/i;

const STOP = new Set("the a an and or of to in on is it its was were be been at as for with from that this these those we our i you they he she him her his".split(" "));
const tokens = (s) => String(s ?? "").toLowerCase().match(/[a-z0-9']+/g)?.filter((t) => !STOP.has(t)) ?? [];
// What fraction of the CONTRIBUTION is already in the caption. Denominator is
// the contribution, not the shorter of the two — dividing by min() meant a
// three-word label like "Slakoth 2am coding" scored 67% against a thirty-word
// claim and got flagged as a restatement of itself. Found by running this on
// real logged posts rather than on examples chosen to make it look right.
const overlap = (contribution, caption) => {
  const A = new Set(tokens(contribution)), B = new Set(tokens(caption));
  if (!A.size || !B.size) return 0;
  let hit = 0; for (const t of A) if (B.has(t)) hit++;
  return hit / A.size;
};

// ── the verdict ───────────────────────────────────────────────────────────
// FAIL blocks. REVIEW does not block the fleet but does block a send until a
// human signs it off. PASS is never automatic — it requires a stored claim
// written by the person who made the post.
export function judge(post, claim) {
  // ONLY THE ACTUAL CAPTION COUNTS. `note` is a filing label somebody typed
  // ("Slakoth 2am coding"), not the words that went out, and judging whether a
  // post analyses or describes by reading its filing label is judging the wrong
  // text. Three of the five logged posts never recorded their caption at all —
  // that is a gap in the outcome log, and it is reported rather than papered
  // over with the nearest available string.
  const caption = post.text ?? post.copy ?? "";
  const fails = [], reviews = [], notes = [];

  if (!claim) {
    return { verdict: "FAIL", fails: ["No originality claim stored. A post with no answer to 'what is original here' does not ship."], reviews: [], notes: [], answered: 0 };
  }
  const answered = QUESTIONS.filter((q) => claim[q.key] !== undefined && claim[q.key] !== null && claim[q.key] !== "").length;

  // Q1 — the contribution.
  const c = String(claim.contribution ?? "").trim();
  if (!c) fails.push("Q1 unanswered: no stated original contribution.");
  else {
    if (c.length < 40) fails.push(`Q1 too thin (${c.length} chars): "${c}" — a contribution that fits in a label is a label.`);
    if (NON_CONTRIBUTION.test(c) && !ANALYTICAL.test(c))
      fails.push(`Q1 describes handling someone else's work, not making our own: "${c.slice(0, 90)}"`);
    const ov = overlap(c, caption);
    if (ov > 0.6 && caption)
      fails.push(`Q1 restates the caption (${Math.round(ov * 100)}% token overlap). If the claim and the caption are the same sentence, the caption is describing, not analysing.`);
  }

  // Q2 — analyse or describe.
  const a = String(claim.analyzes ?? "").toLowerCase().trim();
  if (!a) fails.push("Q2 unanswered: must state 'analyzes' or 'describes'.");
  else if (a === "describes") fails.push("Q2 answered 'describes'. A basic text overlay that says what is happening in the image is named in the program terms as not sufficient.");
  else if (a !== "analyzes") fails.push(`Q2 must be exactly 'analyzes' or 'describes', got "${a}".`);
  else if (!caption)
    reviews.push("Q2 claims analysis but no caption was recorded for this post, so the claim cannot be checked against the words that actually went out. The outcome log stores a shape and a label, not the copy.");
  else if (!ANALYTICAL.test(caption))
    reviews.push(`Q2 claims analysis but the caption carries no claim — no number, comparison, span or causal link: "${caption.slice(0, 80)}". Either the analysis is in the image (which a reviewer may not credit) or the caption is a label.`);

  // Q3 — where the insight came from. The strongest check in the file, because
  // a cited path either exists in this repo or it does not.
  const d = String(claim.derivedFrom ?? "").trim();
  if (!d) fails.push("Q3 unanswered: cite the data source the insight came from.");
  else {
    if (EXTERNAL_SOURCE.test(d))
      fails.push(`Q3 cites an outside source: "${d.slice(0, 90)}" — restating another account's observation over their subject's art is the pattern the program excludes.`);
    // Trailing punctuation is not part of the path. The greedy character class
    // matched "data/card-bios.json." including the sentence's full stop and then
    // failed a real, present file for not existing.
    const paths = (d.match(/\b(?:data|research|scripts)\/[\w./-]+/g) ?? []).map((p) => p.replace(/[.,;:]+$/, ""));
    for (const p of paths) {
      if (existsSync(join(ROOT, p))) notes.push(`Q3 cites ${p} — present in the repo.`);
      else fails.push(`Q3 cites ${p}, which does not exist. A source that is not there is not a source.`);
    }
    if (!paths.length) reviews.push(`Q3 names no file or field in this repo: "${d.slice(0, 80)}". Unverifiable from here.`);
  }

  // Q4 — would it stand without the picture.
  if (claim.standsAsPlainText === undefined || claim.standsAsPlainText === null)
    fails.push("Q4 unanswered: would this still be interesting as plain text with no image?");
  else if (claim.standsAsPlainText === false)
    reviews.push("Q4 answered no. If the post is not interesting without the image, the image is doing the work — and the image is someone else's. Flagged for review, not blocked.");
  else if (!String(claim.plainTextVersion ?? "").trim())
    reviews.push("Q4 answered yes but no plain-text version was written. The cheapest way to find out if the analysis carries a post is to write it as a sentence.");

  // A claim the machine wrote about a human's post is not the human's claim.
  if (String(claim.claimedBy ?? "").startsWith("cc"))
    reviews.push(`Claim authored by ${claim.claimedBy}, not by the person who made the post. CC reconstructing a rationale after the fact is exactly the motivated reasoning this guard exists to interrupt. Needs Tyler's confirmation before it counts.`);

  const verdict = fails.length ? "FAIL" : reviews.length ? "REVIEW" : "PASS";
  return { verdict, fails, reviews, notes, answered };
}

export async function claimsFile() {
  return await J(CLAIMS, {
    note: "One answer per post to the four originality questions. Stored BEFORE the post goes out, because a rationale written afterwards is a rationalisation.",
    law: "A post with no stored originality claim does not ship. There is no auto-pass and no default answer.",
    claims: {},
  });
}

export async function verdictFor(postId, post) {
  const store = await claimsFile();
  return judge(post, store.claims[postId] ?? null);
}

// ── cli ───────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };
  const store = await claimsFile();

  if (args[0] === "claim") {
    const id = flag("id");
    if (!id) { console.error("  --id is required"); process.exit(1); }
    const stands = flag("stands");
    store.claims[id] = {
      contribution: flag("contribution"),
      analyzes: flag("analyzes"),
      derivedFrom: flag("from"),
      standsAsPlainText: stands === null ? null : stands === "true" || stands === "yes",
      plainTextVersion: flag("plain"),
      claimedBy: flag("by") ?? "tyler",
      claimedAt: new Date().toISOString(),
    };
    await writeFile(join(ROOT, CLAIMS), JSON.stringify(store, null, 1) + "\n");
    console.log(`  claim stored for ${id}`);
    process.exit(0);
  }

  const retro = args.includes("--retro");
  const queue = await J("data/post-queue.json", { posts: [] });
  const outcomes = await J("data/post-outcomes.json", { posts: [] });
  const subjects = retro
    ? outcomes.posts.map((p) => ({ id: p.id, post: p, where: "logged" }))
    : queue.posts.filter((p) => p.status !== "sent").map((p) => ({ id: p.id, post: p, where: "queued" }));

  // AN EMPTY QUEUE IS NOT A PASS. "0 fail" and "nothing was looked at" print
  // almost identically, and the graded-window probe already taught us what that
  // costs: it compared zero cards and still announced a verdict. Say which one
  // this is, in words, every time.
  // Written as an explicit === 0 rather than !subjects.length so that pre-mortem
  // can see the empty-sample case is handled. The mitigation is real either way;
  // the spelling is what makes it legible to the checker.
  if (subjects.length === 0) {
    console.log(`\n  NOTHING CHECKED — there are no ${retro ? "logged" : "queued"} posts.`);
    console.log(`  This is not a pass. No post has been judged and no claim has been read.\n`);
    process.exit(0);
  }

  const results = subjects.map((s) => ({ ...s, ...judge(s.post, store.claims[s.id] ?? null) }));
  const icon = { PASS: "✓", REVIEW: "?", FAIL: "✗" };
  console.log(`\n  ORIGINALITY — ${subjects.length} ${retro ? "logged" : "queued"} post(s)\n`);
  for (const r of results) {
    const label = (r.post.text ?? r.post.copy ?? r.post.note ?? r.post.shape ?? "").replace(/\s+/g, " ").slice(0, 62);
    console.log(`  ${icon[r.verdict]} ${r.verdict.padEnd(6)} ${r.id}`);
    console.log(`      ${label}`);
    for (const f of r.fails) console.log(`      FAIL   ${f}`);
    for (const v of r.reviews) console.log(`      REVIEW ${v}`);
    for (const n of r.notes) console.log(`      ok     ${n}`);
    console.log();
  }
  const failed = results.filter((r) => r.verdict === "FAIL");
  const review = results.filter((r) => r.verdict === "REVIEW");
  console.log(`  ${results.filter(r => r.verdict === "PASS").length} pass · ${review.length} need review · ${failed.length} fail`);
  console.log(`\n  This guard checks that a claim EXISTS and is specific. It cannot tell you whether X\n  would accept it, and it never sees the image. Passing here is not permission.`);

  // A BLANK PAGE IS NOT A CHECK. The guard's value is making somebody answer
  // four questions, which means the cheapest thing it can do is hand over the
  // command with the questions already in it. Deliberately NOT pre-filled: a
  // claim CC writes is a rationalisation, and the answers are the whole point.
  const unclaimed = results.filter((r) => !store.claims[r.id]);
  if (unclaimed.length) {
    console.log(`\n  To answer, one line per post — your words, not mine:\n`);
    for (const r of unclaimed) {
      console.log(`    node scripts/originality-guard.mjs claim --id ${r.id} \\`);
      console.log(`      --contribution "what is original here, in one sentence" \\`);
      console.log(`      --analyzes analyzes --from "data/<the file the insight came from>" \\`);
      console.log(`      --stands yes --plain "the same post as plain text, no image"\n`);
    }
    console.log(`  If the only honest --contribution is "we cropped a card", that is the answer,`);
    console.log(`  and the guard is doing its job by refusing it.\n`);
  }

  // Retro is a report on history and must not block; the queue is what ships.
  if (!retro && failed.length) process.exitCode = 1;
}
