// ── OBSERVED POSTS — a permanent archive of other people's work ────────────
// Fed by two things, deliberately: Tyler pasting a URL, and the daily research
// pass noting standout posts from web sources. NOT by polling. See
// research/x-api-access.md for what the API can actually do and what it costs —
// the answer turned out to be more capable and more expensive than expected.
//
// ── THE TWO RULES THAT MATTER ─────────────────────────────────────────────
//
// 1. OBSERVED IS NEVER OURS. Anything not from @LongedEth is stamped OBSERVED
//    and can never enter our own outcome analysis. Five settled posts is a thin
//    enough evidence base without borrowing somebody else's numbers into it, and
//    an account's results are a property of that account — its followers, its
//    history, its timing — not of the mechanic alone.
//
// 2. EVERY READING CARRIES ITS AGE. A 13-minute reading and a 48-hour reading
//    are not comparable, and this project has already withdrawn a stated law
//    over exactly that: 18,800 views was recorded mid-climb and settled at
//    127,200, which is 6.8x. A metric without an age attached is not a
//    measurement, it is a screenshot.
//
// We record MECHANICS. Never phrasing, voice or personality — those belong to
// the account that built them.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/observed-posts.json");
const OUR_ACCOUNT = "LongedEth";

// Below this, a reading is early enough that it says more about the first
// minutes than about the post. Matches SETTLED_HOURS used elsewhere.
const SETTLED_HOURS = 48;
const FLOOR_HOURS = 1;

const EMPTY = {
  note: "Posts from OTHER accounts, archived for their mechanics. Never mixed into our own outcome analysis.",
  rules: [
    "OBSERVED entries never count toward our own results. The separation is permanent.",
    "Every metric reading carries the age of the reading. A 13-minute number and a 48-hour number are different kinds of fact.",
    "Mechanics only. Phrasing, voice and personality belong to the account that built them.",
    "Computability is recorded as a FIELD, never used as a filter — the two strongest shapes we have seen are ones we cannot build.",
  ],
  posts: [],
};

const load = async () => {
  try { return JSON.parse(await readFile(FILE, "utf-8")); } catch { return structuredClone(EMPTY); }
};

export async function observe(entry) {
  const store = await load();

  const account = String(entry.account || "").replace(/^@/, "");
  if (!account) throw new Error("an observed post needs an account");

  // THE SEPARATION, ENFORCED IN CODE RATHER THAN REMEMBERED.
  const provenance = account.toLowerCase() === OUR_ACCOUNT.toLowerCase() ? "OURS" : "OBSERVED";
  if (provenance === "OURS") {
    throw new Error(
      `${account} is our own account. Our posts belong in data/post-outcomes.json, ` +
      `which is where outcome analysis reads from. Mixing them is how a borrowed ` +
      `number ends up in our own record.`);
  }

  // A reading with no age is not a reading.
  const m = entry.metrics ?? null;
  if (m && entry.readingAgeHours == null) {
    throw new Error(
      "metrics were supplied with no readingAgeHours. A 13-minute reading and a 48-hour " +
      "reading are not comparable — this project withdrew a law over exactly that. " +
      "Pass readingAgeHours, or pass no metrics.");
  }
  const age = m ? Number(entry.readingAgeHours) : null;
  const confidence = age == null ? null
    : age < FLOOR_HOURS ? "BELOW FLOOR — too early to mean anything"
    : age < SETTLED_HOURS ? "UNSETTLED — still climbing, not comparable to a settled reading"
    : "SETTLED";

  const rec = {
    url: entry.url ?? null,
    account,
    provenance,
    capturedAt: new Date().toISOString(),
    postedAt: entry.postedAt ?? null,
    text: entry.text ?? null,              // verbatim, for the record
    metrics: m,
    readingAgeHours: age,
    readingConfidence: confidence,
    shape: entry.shape ?? "NEW",           // from research/post-shapes.md, or NEW
    whatMadeItWork: entry.whatMadeItWork ?? null,
    // A SEPARATE FIELD, NOT A FILTER. An earlier review of shotgun's account
    // missed his two strongest formats because it was looking for what it could
    // automate, so a non-computable shape did not register at all.
    computable: entry.computable ?? "UNKNOWN",
    computableVia: entry.computableVia ?? null,
    source: entry.source ?? "manual",      // manual | daily-research
  };

  const dupe = store.posts.find(p => p.url && rec.url && p.url === rec.url);
  if (dupe) {
    // A SECOND READING OF THE SAME POST IS EVIDENCE, NOT A DUPLICATE. It is how
    // a climb becomes visible instead of being overwritten by whichever reading
    // happened last.
    dupe.readings = dupe.readings || [];
    if (rec.metrics) dupe.readings.push({ at: rec.capturedAt, ageHours: age, confidence, metrics: rec.metrics });
    if (rec.shape && rec.shape !== "NEW") dupe.shape = rec.shape;
    await writeFile(FILE, JSON.stringify(store, null, 1) + "\n");
    return dupe;
  }

  store.posts.unshift(rec);
  await writeFile(FILE, JSON.stringify(store, null, 1) + "\n");
  return rec;
}

// ── CLI ────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const v = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };

  if (args[0] === "add") {
    try {
      const r = await observe({
        url: v("url"), account: v("account"), postedAt: v("posted"), text: v("text"),
        metrics: v("views") || v("replies") ? {
          views: v("views") ? Number(v("views")) : null,
          replies: v("replies") ? Number(v("replies")) : null,
          likes: v("likes") ? Number(v("likes")) : null,
        } : null,
        readingAgeHours: v("age") != null ? Number(v("age")) : null,
        shape: v("shape"), whatMadeItWork: v("why"),
        computable: v("computable"), computableVia: v("via"), source: v("source") || "manual",
      });
      console.log(`\n  ARCHIVED — @${r.account} · ${r.shape} · ${r.provenance}`);
      if (r.readingConfidence) console.log(`  reading: ${r.readingAgeHours}h old · ${r.readingConfidence}`);
      console.log(`  computable: ${r.computable}${r.computableVia ? " (" + r.computableVia + ")" : ""}\n`);
    } catch (e) { console.error("\n  ✗ " + e.message + "\n"); process.exit(1); }
  } else if (args[0] === "list") {
    const s = await load();
    console.log(`\n  ${s.posts.length} observed post(s)\n`);
    for (const p of s.posts.slice(0, 20))
      console.log(`  @${(p.account + "").padEnd(16)} ${(p.shape + "").padEnd(18)} ${p.readingConfidence ?? "no metrics"}`);
    console.log("");
  } else {
    console.log(`
  observe-post — archive another account's post for its MECHANIC.

    node scripts/observe-post.mjs add --account parkyspokestop \\
      --url https://x.com/... --text "Is Team Up actually a good set..." \\
      --views 15000 --replies 17 --age 72 --shape SET_DOUBT \\
      --why "doubts a set rather than a person, and does not answer itself" \\
      --computable yes --via SET_DEPTH

    node scripts/observe-post.mjs list

  Metrics REQUIRE --age. Our own account is refused: it belongs in
  data/post-outcomes.json, and the two never mix.
`);
  }
}
