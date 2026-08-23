// log-outcome.mjs — close the loop, or keep guessing forever.
//
// Tyler, 2026-08-23: "If we can hone down great post quality it could be a game
// changer." He is right, and the blocker is not a modelling problem.
//
// We can generate 84 formulas. We have outcome data on ONE post. The
// pairing-finder ranked that post first unprompted, which is genuinely
// encouraging and is still a sample of one. **Nothing currently connects a post
// that went out to the formula that produced it**, so posting more teaches the
// ranker nothing at all - a hundred posts and we would know exactly as much as
// we do now.
//
// This is the cheapest possible fix: log what shape went out, and its numbers.
// After roughly twenty entries the ranking stops being a hypothesis.
//
//   node scripts/log-outcome.mjs --shape "the pair" --views 154 --likes 9 \
//     --replies 1 --note "Arita Charizard/Blastoise"
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/post-outcomes.json");

const arg = (k, d = null) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };

const store = JSON.parse(await readFile(FILE, "utf-8").catch(() => '{"posts":[]}'));

if (process.argv.includes("--report") || process.argv.length <= 2) {
  const posts = store.posts ?? [];
  const byShape = {};
  for (const p of posts) {
    const s = p.shape ?? "unrecorded";
    (byShape[s] ||= []).push(p.measured?.views ?? 0);
  }
  console.log(`\n  ${posts.length} post(s) logged.\n`);
  if (!posts.length) { console.log("  Nothing to compare yet."); }
  else {
    const rows = Object.entries(byShape).map(([s, v]) => ({ shape: s, n: v.length,
      median: v.sort((a, b) => a - b)[Math.floor(v.length / 2)] }))
      .sort((a, b) => b.median - a.median);
    for (const r of rows) console.log(`   ${String(r.median).padStart(5)} median views   ${String(r.n).padStart(2)} post(s)   ${r.shape}`);
  }
  // The honest read of a small sample, stated rather than implied. Twenty is
  // where a median across shapes starts meaning something; below that we are
  // reading noise and calling it a signal.
  const need = 20 - posts.length;
  console.log(need > 0
    ? `\n  ${need} more before this means anything. Under twenty, a difference between shapes is noise wearing a number.\n`
    : `\n  Enough to rank on. Feed this back into pairing-finder rather than the assumptions it currently uses.\n`);
} else {
  const shape = arg("shape");
  if (!shape) { console.error("  --shape is required. Which formula produced this post?"); process.exitCode = 1; }
  else {
    store.posts = store.posts ?? [];
    store.posts.push({
      id: `${new Date().toISOString().slice(0, 10)}-${(arg("note", "post")).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 32)}`,
      postedAt: arg("at", new Date().toISOString()),
      platform: arg("platform", "X"),
      shape,
      note: arg("note", null),
      measured: { at: new Date().toISOString(),
        views: Number(arg("views", 0)), likes: Number(arg("likes", 0)),
        replies: Number(arg("replies", 0)), reposts: Number(arg("reposts", 0)) },
      confidence: (store.posts.length + 1) < 20
        ? `SAMPLE OF ${store.posts.length + 1} - not yet enough to rank shapes against each other`
        : "part of a rankable sample",
    });
    await writeFile(FILE, JSON.stringify(store, null, 1));
    console.log(`  logged: ${shape} · ${arg("views", 0)} views · ${store.posts.length} total`);
    if (store.posts.length < 20) console.log(`  ${20 - store.posts.length} more before the ranking can stop guessing.`);
  }
}
