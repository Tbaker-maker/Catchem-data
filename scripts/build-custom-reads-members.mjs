// Member Custom Reads. Reads saved follows from the site worker, builds the
// night's DMs, and stores them back on the worker for the bot. Nothing about
// a member is written to this repo. Skips cleanly when the secret is not set.
// Never prints the token.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOutbox, fetchFollows, poolFromData, putOutbox } from "./lib/custom-reads-pipe.mjs";
import { selectAddons } from "./lib/custom-reads-addons.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const token = String(process.env.CUSTOM_READS_TOKEN || "").trim();
const base = String(process.env.CUSTOM_READS_URL || "https://catchemtcg.com").trim();
const dry = process.argv.includes("--dry");
const J = (p, fallback) => readFile(join(ROOT, p), "utf8").then(JSON.parse).catch(() => fallback);

if (!token) {
  console.log("member reads: CUSTOM_READS_TOKEN is not set, skipping.");
  process.exit(0);
}
const follows = await fetchFollows({ base, token });
const pool = poolFromData({ catalogue: await J("data/derived/post-office-catalogue.json", null), sealed: await J("data/sealed-prices.json", null) });
const newsDoc = await J("research/digests/news.json", {});
const allow = await J("data/derived/custom-reads/sources/allow-list.json", { sources: [] });
const premium = await J("research/assets/public/premium-ratio.json", null);
const outbox = buildOutbox({ follows, pool, news: selectAddons(newsDoc.items || [], allow), games: selectAddons(newsDoc.videoGames || [], allow), premium });
if (dry) {
  console.log(JSON.stringify({ day: outbox.day, ...outbox.counts, dry: true }));
  process.exit(0);
}
const stored = await putOutbox({ base, token, outbox });
console.log(JSON.stringify({ day: outbox.day, ...outbox.counts, stored: stored.members }));
