// Nightly X learning loop (script only, no AI). Runs from build-feed.mjs after YouTube.
// Official X API v2 with process.env.X_BEARER_TOKEN only; no scraping. Missing token = no-op.
// Reads only tracked call accounts plus restock accounts, capped at limits.nightlyCallBudget (150).
// Private (catchem-data-private when PRIVATE_DATA_TOKEN is set, else gitignored data/private/):
//   x/posts.jsonl.gz, x/claims.json, x/accounts.json, x/state.json
//   restocks/events.json, restocks/study.json, restocks/accounts.json
// Public-safe (data/derived/x-status.json): counts and dates only.
// Backfill: node scripts/x-learn.mjs --import <dir of saved X API JSON responses>
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { loadPriceBook } from "./self-check.mjs";
import { buildCatalogueIndex } from "./lib/youtube.mjs";
import { postClaims, scoreXClaims, rateAccounts, parseRestock, dedupeRestocks, restockStudy, rateRestockAccounts } from "./lib/x-accounts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.x.com/2";
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

export function makeXClient({ token, fetchFn = fetch, budget = 150 }) {
  let used = 0;
  return {
    used: () => used,
    async get(path, params) {
      if (used >= budget) { const e = new Error("nightly call budget reached"); e.budget = true; throw e; }
      used++;
      const res = await fetchFn(`${API}/${path}?${new URLSearchParams(params)}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`x ${path}: ${res.status}`);
      return res.json();
    },
  };
}

// Pull posts out of any saved X API response (search or timeline), with the handle.
export function postsFromResponse(doc, idToHandle) {
  const users = new Map((doc?.includes?.users || []).map((u) => [u.id, u.username]));
  return (doc?.data || []).filter((p) => p && p.id && p.text && p.created_at).map((p) => ({ id: String(p.id), created_at: p.created_at, text: p.text, handle: idToHandle.get(p.author_id) || users.get(p.author_id) || null, author_id: p.author_id }));
}

export async function runXLearn({ root = ROOT, token = process.env.X_BEARER_TOKEN || "", privToken = process.env.PRIVATE_DATA_TOKEN || "", fetchFn = fetch, now = new Date(), importDir = null, store: givenStore = null } = {}) {
  const cfg = await J(join(root, "config/x-accounts.json"), { accounts: [], limits: {} });
  const limits = { nightlyCallBudget: 150, postsPerCall: 100, ...cfg.limits };
  const catalog = await J(join(root, "data/catalog/tcgcsv-latest.json"), {});
  const today = String(catalog.asOf || "").slice(0, 10) || now.toISOString().slice(0, 10);
  const base = { asOf: today, generatedAt: now.toISOString(), note: "Counts and dates only. Account names, text and scores stay private." };
  if (!token && !importDir) { const doc = { ...base, tokenPresent: false, status: "token_missing", callsUsed: 0 }; await writePublic(root, doc); return doc; }

  let store = givenStore;
  if (!store) { try { store = await openPrivate({ root, token: privToken }); } catch (err) { console.error(`x: ${err.message}; using local data/private`); store = await openPrivate({ root, token: "" }); } }
  const xdir = join(store.dir, "x"), rdir = join(store.dir, "restocks");
  await mkdir(xdir, { recursive: true }); await mkdir(rdir, { recursive: true });
  const state = await J(join(xdir, "state.json"), { sinceId: {}, calls: [] });
  const prevAcc = await J(join(xdir, "accounts.json"), { accounts: [] });
  let posts = [];
  try { posts = gunzipSync(await readFile(join(xdir, "posts.jsonl.gz"))).toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch {}
  const seen = new Set(posts.map((p) => p.id));
  const accounts = (cfg.accounts || []).filter((a) => a.enabled !== false);
  const idToHandle = new Map(accounts.map((a) => [a.id, a.handle]));
  const errors = [];
  const add = (p) => { if (!p.handle || seen.has(p.id)) return; seen.add(p.id); posts.push({ ...p, fetchedOn: today }); };

  let client = null;
  if (importDir) {
    for (const f of (await readdir(importDir)).filter((f) => /\.(txt|json)$/.test(f))) {
      const t = await readFile(join(importDir, f), "utf8"), i = t.indexOf("{"), j = t.lastIndexOf("}");
      try { for (const p of postsFromResponse(JSON.parse(t.slice(i, j + 1)), idToHandle)) add(p); } catch { errors.push(`import ${f}: unreadable`); }
    }
  } else {
    client = makeXClient({ token, fetchFn, budget: limits.nightlyCallBudget });
    const tracked = new Set((prevAcc.accounts || []).filter((a) => a.status === "tracked").map((a) => a.handle));
    const toRead = accounts.filter((a) => a.category === "restock" || tracked.has(a.handle));
    try {
      for (const a of toRead) {
        const params = { max_results: String(limits.postsPerCall), exclude: "retweets,replies", "tweet.fields": "created_at,author_id" };
        if (state.sinceId[a.handle]) params.since_id = state.sinceId[a.handle];
        try {
          const doc = await client.get(`users/${a.id}/tweets`, params);
          for (const p of postsFromResponse(doc, idToHandle)) add(p);
          if (doc?.meta?.newest_id) state.sinceId[a.handle] = doc.meta.newest_id;
        } catch (err) { if (err.budget) throw err; errors.push(`${a.handle}: ${err.message}`); }
      }
    } catch (err) { errors.push(err.message); }
  }

  const idx = buildCatalogueIndex(catalog.items || []);
  const byHandle = Object.fromEntries(accounts.map((a) => [a.handle, posts.filter((p) => p.handle === a.handle)]));
  const book = await loadPriceBook(root);
  // Price calls: creator accounts only. Others are sources.
  const callHandles = new Set(accounts.filter((a) => a.category === "creator").map((a) => a.handle));
  const claims = scoreXClaims(posts.filter((p) => callHandles.has(p.handle)).flatMap((p) => postClaims(p, p.handle, idx)), book, idx, today);
  const rated = rateAccounts(accounts, claims, byHandle);
  // Restocks.
  const restockHandles = accounts.filter((a) => a.category === "restock");
  const raw = restockHandles.flatMap((a) => byHandle[a.handle].map((p) => parseRestock(p, a.handle, idx, a.region || "US")));
  const events = dedupeRestocks(raw);
  const study = restockStudy(events, book.priceOn);
  const rr = rateRestockAccounts(events, restockHandles.map((a) => a.handle), byHandle);
  const callsUsed = client ? client.used() : 0;
  state.calls = [...(state.calls || []).filter((c) => c.date !== today), { date: today, calls: callsUsed, posts: posts.length }].slice(-60);

  await writeFile(join(xdir, "posts.jsonl.gz"), gzipSync(posts.map((p) => JSON.stringify(p)).join("\n") + "\n"));
  await writeFile(join(xdir, "claims.json"), JSON.stringify({ asOf: today, private: true, scoring: { band: 0.03, minConfidence: 0.5, horizons: [7, 30, 90], minRated: 20, hit: "same rules as youtube claims" }, rule: "An X claim is never fact. Mapped by catalogue id only.", claims }, null, 1) + "\n");
  await writeFile(join(xdir, "accounts.json"), JSON.stringify({ asOf: today, private: true, rule: "tracked = creator with 20+ scored calls and hit rate >= 55%; trial = fewer scored calls; rejected = spam/giveaway or under the bar; source = news/data/app/ai/restock (not scored).", accounts: rated }, null, 1) + "\n");
  await writeFile(join(rdir, "events.json"), JSON.stringify({ asOf: today, private: true, fields: "timestamp (UTC), retailer, product (sealed id only when verified, else null + productText), region, handle, postId, seenBy", events }, null, 1) + "\n");
  await writeFile(join(rdir, "study.json"), JSON.stringify({ asOf: today, private: true, note: "Sample from X posts we have read, not every restock. Day and hour in America/Los_Angeles.", ...study }, null, 1) + "\n");
  await writeFile(join(rdir, "accounts.json"), JSON.stringify({ asOf: today, private: true, accounts: rr }, null, 1) + "\n");
  await writeFile(join(xdir, "state.json"), JSON.stringify(state, null, 1) + "\n");
  const pushed = await store.close(["x/posts.jsonl.gz", "x/claims.json", "x/accounts.json", "x/state.json", "restocks/events.json", "restocks/study.json", "restocks/accounts.json"], `X learn ${today}`);
  const doc = { ...base, tokenPresent: Boolean(token), status: errors.length ? "partial" : "ok", callsUsed, posts: posts.length, claims: claims.length, scored: claims.filter((c) => !c.unscored && (c.h7 || c.h30 || c.h90)).length, accounts: rated.length, tracked: rated.filter((a) => a.status === "tracked").length, restockEvents: events.length, errors: errors.map((e) => (token ? e.split(token).join("[token]") : e)).slice(0, 20), privatePushed: Boolean(pushed?.pushed) };
  await writePublic(root, doc);
  return { ...doc, rated, events, study, restockAccounts: rr, claimsList: claims };
}

async function writePublic(root, doc) {
  await mkdir(join(root, "data/derived"), { recursive: true });
  const { asOf, generatedAt, note, tokenPresent, status, callsUsed = 0, posts = 0, claims = 0, scored = 0, accounts = 0, tracked = 0, restockEvents = 0 } = doc;
  await writeFile(join(root, "data/derived/x-status.json"), JSON.stringify({ asOf, generatedAt, note, tokenPresent, status, callsUsed, posts, claims, scored, accounts, tracked, restockEvents }, null, 1) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--import");
  const d = await runXLearn({ importDir: i > 0 ? process.argv[i + 1] : null });
  console.log(JSON.stringify({ status: d.status, callsUsed: d.callsUsed, posts: d.posts, claims: d.claims, scored: d.scored, restockEvents: d.restockEvents, errors: d.errors || [] }));
}
