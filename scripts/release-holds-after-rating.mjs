// Runs after write-feature-data. Releases price holds that tonight's card rating
// no longer flags, so a steady chase card is priced tonight, not a night later.
// Writes released=<n> to GITHUB_OUTPUT; the next workflow step rebuilds the set
// pages and feature data only when n > 0. Never fails the run.
import { appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseAfterRating } from "./lib/price-hold-live.mjs";
import { isVintageRelease } from "./lib/price-trust.mjs";

const PUB = join(dirname(fileURLToPath(import.meta.url)), "..", "research/assets/public");
let released = [];
try { released = await releaseAfterRating(PUB, isVintageRelease); } catch (err) { console.error(`hold release after rating skipped: ${String(err.message || err).slice(0, 200)}`); released = []; }
console.log(JSON.stringify({ priceHoldAfterRating: { released: released.length } }));
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `released=${released.length}\n`);
