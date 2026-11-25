// Member Custom Reads. Reads saved follows from the site worker, builds the
// night's letters, and stores them back on the worker. Nothing about a member
// is written into the repo. Skips cleanly when the secret is not set.
// Never prints the token. A dry run writes a masked artifact and does not post.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOutbox, fetchFollows, letterSummary, lettersSafe, poolFromData, putOutbox, renderDryLetters, writeLetterFile } from "./lib/custom-reads-pipe.mjs";
import { selectAddons } from "./lib/custom-reads-addons.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const token = String(process.env.CUSTOM_READS_TOKEN || "").trim();
const base = String(process.env.CUSTOM_READS_URL || "https://catchemtcg.com").trim();
const dry = process.argv.includes("--dry") || process.env.READS_LETTER_DRY === "1";
const summaryPath = String(process.env.READS_LETTER_SUMMARY || "").trim();
const artifactPath = String(process.env.READS_LETTER_ARTIFACT || "").trim();
const J = (p, fallback) => readFile(join(ROOT, p), "utf8").then(JSON.parse).catch(() => fallback);

async function emit(summary) {
  const text = letterSummary(summary);
  console.log(text);
  if (summaryPath) await writeLetterFile(summaryPath, text);
  return text;
}

if (!token) {
  await emit({
    day: new Date().toISOString().slice(0, 10),
    counts: {},
    posted: false,
    email: { armed: false, sent: 0, skipped: 0, reasons: { "token unset": 1 } },
    note: "CUSTOM_READS_TOKEN is not set",
  });
  process.exit(0);
}

let follows;
try {
  follows = await fetchFollows({ base, token });
} catch {
  await emit({
    day: new Date().toISOString().slice(0, 10),
    counts: {},
    posted: false,
    email: { armed: false, sent: 0, skipped: 0, reasons: { "follows export failed": 1 } },
    note: "follows export failed",
  });
  process.exit(1);
}

const pool = poolFromData({ catalogue: await J("data/derived/post-office-catalogue.json", null), sealed: await J("data/sealed-prices.json", null) });
const newsDoc = await J("research/digests/news.json", {});
const allow = await J("data/derived/custom-reads/sources/allow-list.json", { sources: [] });
const premium = await J("research/assets/public/premium-ratio.json", null);
const outbox = buildOutbox({ follows, pool, news: selectAddons(newsDoc.items || [], allow), games: selectAddons(newsDoc.videoGames || [], allow), premium });

if (dry) {
  // Local render only. Do not POST ?dry=1 until that handler is on the worker.
  // The current worker would store the outbox on any POST.
  let letters = renderDryLetters(outbox);
  if (!lettersSafe(letters)) letters = { dry: true, armed: false, sent: 0, letters: [] };
  if (artifactPath) await writeLetterFile(artifactPath, letters);
  await emit({
    day: outbox.day,
    counts: outbox.counts,
    posted: false,
    email: { armed: false, sent: 0, skipped: letters.letters.length, reasons: { "dry run": letters.letters.length } },
    note: "dry run, zero sends",
  });
  process.exit(0);
}

let stored;
try {
  stored = await putOutbox({ base, token, outbox });
} catch {
  await emit({
    day: outbox.day,
    counts: outbox.counts,
    posted: false,
    email: { armed: false, sent: 0, skipped: 0, reasons: { "post failed": 1 } },
    note: "outbox post failed",
  });
  process.exit(1);
}

const email = stored?.email && typeof stored.email === "object"
  ? stored.email
  : { armed: false, sent: 0, skipped: 0, reasons: {} };
await emit({ day: outbox.day, counts: outbox.counts, posted: true, email });
