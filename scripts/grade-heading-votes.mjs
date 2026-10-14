// Grade stored "Where's it heading?" votes against later prices. Private only.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gradeVote, summarizeVotes } from "./lib/heading-votes.mjs";
import { openPrivate } from "./lib/private-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => { try { return JSON.parse(await readFile(join(ROOT, p), "utf8")); } catch { return null; } };
const votesDoc = await read("data/derived/heading-votes.json");
const prices = await read("data/derived/heading-outcomes.json");
const later = new Map((prices?.rows || []).map((row) => [row.id, row]));
const graded = (votesDoc?.votes || []).map((vote) => gradeVote(vote, later.get(vote.id) || later.get(vote.itemId)));
const summary = summarizeVotes(graded);
const asOf = String(votesDoc?.asOf || new Date().toISOString()).slice(0, 10);
const doc = { asOf, summary, graded: graded.filter((row) => row.dir) };
let store;
try { store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" }); }
catch { store = await openPrivate({ root: ROOT, token: "" }); }
await mkdir(join(store.dir, "scanner"), { recursive: true });
await writeFile(join(store.dir, "scanner/heading-votes.json"), JSON.stringify(doc, null, 1) + "\n");
const pushed = await store.close(["scanner/heading-votes.json"], `heading votes ${asOf}`);
console.log(JSON.stringify({ headingVotes: { asOf, n: summary.n, passed: summary.passed, pushed: Boolean(pushed?.pushed) } }));
