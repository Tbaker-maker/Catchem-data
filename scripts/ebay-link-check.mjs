// One-off QA: do the site's eBay search links find listings? Reads
// data/qa/ebay-link-sample.json ({ id, before, after } rows), asks the eBay
// Browse API for the total on each query (same words as the site link, no
// extra filters), and writes data/qa/ebay-link-check-result.json.
// Polite: one call every 2 s. Shares the listing-count rolling budget: it
// logs its calls in data/derived/listing-counts/state.json and keeps a
// reserve for the nightly sealed price step. Stops at the first 429.
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { used24 } from "./lib/listing-counts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAFE = 4900, RESERVE = Number(process.env.RESERVE || 700), GAP_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = async (p, d) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

async function token() {
  const { EBAY_APP_ID: a, EBAY_CERT_ID: c } = process.env;
  if (!a || !c) throw new Error("no eBay app keys");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${a}:${c}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope" });
  if (!res.ok) throw new Error(`OAuth ${res.status}`);
  return (await res.json()).access_token;
}

const statePath = join(ROOT, "data/derived/listing-counts/state.json");
const state = await J(statePath, { last: {}, log: [] });
state.log ||= [];
const now = new Date();
const used = used24(state.log, now);
const allowance = Math.max(0, SAFE - RESERVE - used);
const rows = await J(join(ROOT, "data/qa/ebay-link-sample.json"), []);
const fields = (process.env.FIELDS || "before,after").split(",");
const n = Math.min(rows.length, Math.floor(allowance / fields.length));
console.log(`ebay link check: used ${used}/${SAFE} in 24h, reserve ${RESERVE}, checking ${n} of ${rows.length} items x ${fields.length}`);
const out = { at: now.toISOString(), used24Before: used, checked: 0, rows: [] };
let calls = 0;
if (n > 0) {
  const tok = await token();
  outer: for (const row of rows.slice(0, n)) {
    const r = { id: row.id, bucket: row.bucket };
    for (const f of fields) {
      const q = row[f];
      if (!q) continue;
      const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tok}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
      calls++;
      if (res.status === 429) { console.log("429, stopping"); break outer; }
      if (!res.ok) r[f] = { error: res.status, body: (await res.text()).slice(0, 200) };
      else r[f] = { total: Number((await res.json()).total) || 0 };
      await sleep(GAP_MS);
    }
    out.rows.push(r);
  }
}
out.checked = out.rows.length;
out.calls = calls;
for (const f of fields) {
  const done = out.rows.filter((r) => r[f] && "total" in r[f]);
  out[f] = { checked: done.length, zero: done.filter((r) => r[f].total === 0).length, errors: out.rows.filter((r) => r[f]?.error).length };
}
console.log(JSON.stringify({ calls, before: out.before, after: out.after }));
if (calls) state.log.push({ at: new Date().toISOString(), n: calls, source: "ebay-link-check" });
await writeFile(statePath, JSON.stringify(state) + "\n");
await writeFile(join(ROOT, "data/qa/ebay-link-check-result.json"), JSON.stringify(out, null, 1) + "\n");
