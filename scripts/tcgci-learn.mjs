// Nightly TCG Card Investor ledger fetch. One polite GET of their public
// calls.json (linked from /track-record/). robots.txt Allows /; only /api/ and
// /go/ are disallowed. No login. Never republish their text.
//
// Private (catchem-data-private when PRIVATE_DATA_TOKEN is set, else gitignored
// data/private/):
//   data/private/tcgci/calls.json       normalized ledger (includes claim text)
//   data/private/tcgci/crosscheck.json  their 30d verdict vs our YouTube scoring
//   data/private/tcgci/state.json       last fetch meta
//   data/private/tcgci/fetch-log.jsonl   every fetch: date + URL (+ status/counts)
// Public-safe (data/derived/tcgci-status.json): counts and dates only.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import {
  TCGCI_CALLS_URL,
  TCGCI_USER_AGENT,
  parseLedger,
  crossCheck,
  publicSafeStatus,
} from "./lib/tcgci.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

async function appendFetchLog(dir, row) {
  const p = join(dir, "fetch-log.jsonl");
  let prev = "";
  try { prev = await readFile(p, "utf8"); } catch {}
  await writeFile(p, prev + JSON.stringify(row) + "\n");
}


async function writePublic(root, doc) {
  await mkdir(join(root, "data/derived"), { recursive: true });
  await writeFile(join(root, "data/derived/tcgci-status.json"), JSON.stringify(doc, null, 1) + "\n");
}

export async function runTcgciLearn({
  root = ROOT,
  token = process.env.PRIVATE_DATA_TOKEN || "",
  fetchFn = fetch,
  now = new Date(),
  store: givenStore = null,
  url = TCGCI_CALLS_URL,
} = {}) {
  const today = now.toISOString().slice(0, 10);
  const errors = [];
  let store = givenStore;
  if (!store) {
    try { store = await openPrivate({ root, token }); }
    catch (err) {
      console.error(`tcgci: ${err.message}; using local data/private`);
      store = await openPrivate({ root, token: "" });
    }
  }
  const dir = join(store.dir, "tcgci");
  await mkdir(dir, { recursive: true });

  let raw = null;
  let status = "ok";
  try {
    const res = await fetchFn(url, {
      headers: {
        "User-Agent": TCGCI_USER_AGENT,
        Accept: "application/json",
      },
      redirect: "follow",
    });
    if (res.status === 403 || res.status === 401 || res.status === 429) {
      status = "blocked";
      errors.push(`HTTP ${res.status}; not retrying past a block`);
    } else if (!res.ok) {
      status = "error";
      errors.push(`HTTP ${res.status}`);
    } else {
      const ct = String(res.headers?.get?.("content-type") || "");
      raw = await res.json();
      if (!raw || !Array.isArray(raw.calls)) {
        status = "error";
        errors.push("response was not a calls ledger");
        raw = null;
      } else if (ct && !/json/i.test(ct) && !raw.calls) {
        status = "error";
        errors.push(`unexpected content-type ${ct}`);
        raw = null;
      }
    }
  } catch (err) {
    status = "error";
    errors.push(err.message || String(err));
  }

  if (!raw) {
    const prev = await J(join(dir, "calls.json"), null);
    const cross = await J(join(dir, "crosscheck.json"), { matched: 0, agreePct: null });
    const doc = publicSafeStatus({
      asOf: today,
      fetchedAt: now.toISOString(),
      status,
      counts: prev?.counts || { total: 0, byVerdict: {} },
      cross,
      errors,
    });
    await writePublic(root, doc);
    await writeFile(join(dir, "state.json"), JSON.stringify({
      asOf: today, fetchedAt: now.toISOString(), status, url, errors, lastOkUpdated: prev?.updated || null,
    }, null, 1) + "\n");
    await appendFetchLog(dir, { fetchedAt: now.toISOString(), asOf: today, url, status, httpOk: false, errors });
    await store.close(["tcgci/state.json", "tcgci/fetch-log.jsonl"], `TCGCI learn ${today} (${status})`);
    return doc;
  }

  const parsed = parseLedger(raw);
  // Load our YouTube claims from the same private store for cross-check.
  const ytClaims = (await J(join(store.dir, "youtube/claims.json"), { claims: [] })).claims || [];
  const cross = crossCheck(parsed.calls, ytClaims);

  await writeFile(join(dir, "calls.json"), JSON.stringify({
    asOf: today,
    fetchedAt: now.toISOString(),
    source: url,
    updated: parsed.updated,
    scoring: parsed.scoring,
    counts: parsed.counts,
    calls: parsed.calls,
    note: "Private. Do not publish claim text or republish TCG Card Investor content.",
  }, null, 1) + "\n");

  await writeFile(join(dir, "crosscheck.json"), JSON.stringify({
    asOf: today,
    fetchedAt: now.toISOString(),
    theirBandPct: parsed.scoring.flatBandPct,
    ourBand: "3% + market-relative (scripts/lib/youtube.mjs)",
    matched: cross.matched,
    agree: cross.agree,
    disagree: cross.disagree,
    agreePct: cross.agreePct,
    byChannel: cross.byChannel,
    rows: cross.rows,
    note: "Private method research. Their text is never copied to a public path.",
  }, null, 1) + "\n");

  await writeFile(join(dir, "state.json"), JSON.stringify({
    asOf: today,
    fetchedAt: now.toISOString(),
    status: "ok",
    url,
    updated: parsed.updated,
    calls: parsed.counts.total,
    crossMatched: cross.matched,
    crossAgreePct: cross.agreePct,
    errors: [],
  }, null, 1) + "\n");
  await appendFetchLog(dir, {
    fetchedAt: now.toISOString(), asOf: today, url, status: "ok",
    calls: parsed.counts.total, updated: parsed.updated,
  });

  const pushed = await store.close(
    ["tcgci/calls.json", "tcgci/crosscheck.json", "tcgci/state.json", "tcgci/fetch-log.jsonl"],
    `TCGCI learn ${today}: ${parsed.counts.total} calls`,
  );

  const doc = publicSafeStatus({
    asOf: today,
    fetchedAt: now.toISOString(),
    status: "ok",
    counts: parsed.counts,
    cross,
    errors: [],
  });
  doc.privatePushed = Boolean(pushed?.pushed);
  await writePublic(root, doc);
  return doc;
}

if (process.argv[1] && process.argv[1].endsWith("tcgci-learn.mjs")) {
  const d = await runTcgciLearn();
  console.log(JSON.stringify({ tcgci: { status: d.status, calls: d.calls, scored: d.scored, crossMatched: d.crossMatched, crossAgreePct: d.crossAgreePct } }));
}
