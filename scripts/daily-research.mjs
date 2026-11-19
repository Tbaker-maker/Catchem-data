// scripts/daily-research.mjs
// Weekday research digest for Catch'em.
// Calls the xAI Responses API with live web search, validates the model
// output against a schema, then writes the digest, the radar, and the
// public releases file. A missing key or a bad response writes nothing.
//
// Key: XAI_API_KEY (repo secret). Model: XAI_MODEL, or grok-4.7 when unset.
// grok-4.7 is the id in https://docs.x.ai/developers/models
// and https://docs.x.ai/developers/grok-4-7 . Web search is the Responses tool.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FETCH_TIMEOUT_MS = 120000;
const URL_TIMEOUT_MS = 8000;
const WINDOW_DAYS = 45;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RADAR_FILE = join(ROOT, "data", "release-radar.json");
const PROMPT_FILE = join(ROOT, "research", "RESEARCH_PROMPT.md");
const DIGEST_DIR = join(ROOT, "research", "digests");
const NEWS_FILE = join(DIGEST_DIR, "news.json");
const PUBLIC_RELEASES = join(ROOT, "research", "assets", "public", "releases.json");

const CHECKED_BY = "research-script";
// Confirmed against https://docs.x.ai/developers/models (2026-11-17).
export const MODEL_DEFAULT = "grok-4.7";
const BLOCK_STATUS = new Set([401, 403, 429]);
const GONE_STATUS = new Set([404, 410]);

// Parts 1 and 2 only. Part 3 is the account pass and is not this job.
function partsOneAndTwo(text) {
  const cut = text.indexOf("## PART 3");
  return cut === -1 ? text : text.slice(0, cut).trim();
}

function dayNum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000;
}

function isHttpUrl(s) {
  return typeof s === "string" && /^https?:\/\/[^\s]+$/i.test(s.trim());
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

// Two sources are independent when their hosts differ.
function independentCount(sources) {
  const hosts = new Set();
  for (const s of sources || []) {
    const h = hostOf(s);
    if (h) hosts.add(h);
  }
  return hosts.size;
}

function validateOutput(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "model output is not a JSON object";
  if (typeof obj.digest !== "string" || !obj.digest.trim()) return "digest is missing or empty";
  if (!Array.isArray(obj.claims)) return "claims is not an array";
  for (const c of obj.claims) {
    if (!c || typeof c !== "object") return "a claim is not an object";
    if (c.text != null && typeof c.text !== "string") return "claim text is not a string";
  }
  if (obj.radar != null) {
    if (typeof obj.radar !== "object" || Array.isArray(obj.radar)) return "radar is not an object";
    if (!Array.isArray(obj.radar.upcoming)) return "radar.upcoming is not an array";
  }
  return null;
}

function parseModelText(text) {
  const raw = String(text || "").trim();
  if (!raw) return { error: "empty model response" };
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    const obj = JSON.parse(candidate);
    const err = validateOutput(obj);
    if (err) return { error: err };
    return { obj };
  } catch (e) {
    return { error: "model output is not valid JSON: " + e.message };
  }
}

function extractText(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (typeof item?.content === "string") parts.push(item.content);
      else if (Array.isArray(item?.content)) {
        for (const c of item.content) if (typeof c?.text === "string") parts.push(c.text);
      } else if (typeof item?.text === "string") parts.push(item.text);
    }
    if (parts.length) return parts.join("\n");
  }
  const choice = data.choices?.[0]?.message?.content;
  if (typeof choice === "string") return choice;
  return "";
}

function headerGet(res, name) {
  const h = res?.headers;
  if (!h) return "";
  if (typeof h.get === "function") return String(h.get(name) || "");
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? String(h[key] || "") : "";
}

// 401, 403, 429, and a bot challenge mean the host answered. Keep the claim
// and tag it. Drop only 404, 410, a DNS failure, or a timeout.
export function classifyHttp(res) {
  const status = Number(res?.status);
  if (GONE_STATUS.has(status)) return { keep: false, reason: String(status) };
  const mitigated = headerGet(res, "cf-mitigated");
  const datadome = headerGet(res, "x-datadome");
  const hint = String(res?.bodyHint || "").toLowerCase();
  const challenge = Boolean(mitigated || datadome || /captcha|cf-challenge|just a moment|attention required|bot challenge/.test(hint));
  if (BLOCK_STATUS.has(status) || challenge) return { keep: true, tag: "exists, unverified" };
  if (status === 405) return { keep: null, reason: "head-not-allowed" };
  if (res?.ok || (status >= 200 && status < 400)) return { keep: true, tag: null };
  if (status > 0) return { keep: true, tag: "exists, unverified" };
  return { keep: false, reason: "no-status" };
}

export function asVerdict(value) {
  if (value === true) return { keep: true, tag: null };
  if (value === false || value == null) return { keep: false, reason: "no" };
  return value;
}

// One request. A second request happens only when HEAD is not allowed.
// A block, a 404, a DNS error, or a timeout is never retried.
export async function defaultResolveUrl(url, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), URL_TIMEOUT_MS);
  const once = (method) => fetchImpl(url, { method, signal: ctrl.signal, redirect: "follow" });
  try {
    let res;
    try {
      res = await once("HEAD");
    } catch {
      return { keep: false, reason: "dns-or-timeout" };
    }
    let verdict = classifyHttp(res);
    if (verdict.reason !== "head-not-allowed") return verdict;
    try {
      res = await once("GET");
    } catch {
      return { keep: false, reason: "dns-or-timeout" };
    }
    verdict = classifyHttp(res);
    if (verdict.reason === "head-not-allowed") return { keep: true, tag: "exists, unverified" };
    return verdict;
  } finally {
    clearTimeout(timer);
  }
}

function loadNewsUrls(news) {
  const urls = new Set();
  for (const item of news?.items || []) {
    if (item?.url) urls.add(String(item.url).trim());
  }
  return urls;
}

function rowsWithin(upcoming, today, days) {
  const base = dayNum(today);
  return (upcoming || []).filter((row) => {
    const d = dayNum(row?.date);
    return Number.isFinite(d) && d >= base && d <= base + days;
  });
}

function stripBookkeeping(o) {
  if (!o) return "";
  const { updated, checkedAt, checkedBy, lastCheck, notes, ...rest } = o;
  return JSON.stringify(rest);
}

function applyRadar(prev, proposed, today) {
  const base = dayNum(today);
  const incoming = Array.isArray(proposed?.upcoming) ? proposed.upcoming : (prev.upcoming || []);
  const kept = [];
  const droppedPast = [];
  for (const row of incoming) {
    if (!row || typeof row !== "object") continue;
    if (!row.name || !row.type || !row.date) continue;
    const d = dayNum(row.date);
    if (!Number.isFinite(d) || d < base) {
      droppedPast.push(row.name || row.date);
      continue;
    }
    const sources = Array.isArray(row.sources) ? row.sources.filter(isHttpUrl) : [];
    const next = { ...row, sources };
    if (independentCount(sources) < 2) next.confidence = "single-source";
    kept.push(next);
  }
  const nextRadar = {
    ...prev,
    upcoming: kept,
    checkedAt: new Date().toISOString(),
    checkedBy: CHECKED_BY,
  };
  const changed = stripBookkeeping({ upcoming: kept }) !== stripBookkeeping({ upcoming: prev.upcoming || [] });
  if (changed) {
    nextRadar.updated = today;
    nextRadar.lastCheck = "updated";
  } else {
    nextRadar.updated = prev.updated;
    nextRadar.lastCheck = "checked, no change";
  }
  return { radar: nextRadar, changed, droppedPast };
}

function buildUserMessage(brief, today, radar, nearRows, newsUrls) {
  return `${brief}

Today's date (UTC): ${today}

Current release radar (data/release-radar.json):
${JSON.stringify(radar)}

Rows dated within ${WINDOW_DAYS} days (recheck every one):
${JSON.stringify(nearRows)}

Already in research/digests/news.json (do not repeat these URLs as new):
${JSON.stringify([...newsUrls].slice(0, 40))}

Return ONLY a JSON object, no prose around it, matching this shape:
{
  "digest": "markdown following Part 1 of the brief. First heading is the digest title. Sections: Flags, New since yesterday, Radar check, Notable but not urgent. Nothing new today is a valid answer.",
  "claims": [ { "text": "one claim", "url": "https://...", "sources": ["https://a", "https://b"] } ],
  "radar": null or { "upcoming": [ { "name": "", "type": "", "date": "YYYY-MM-DD", "confidence": "verified or single-source", "note": "", "sources": ["https://..."] } ] },
  "nothingNew": false
}

Rules for the object:
- Every claim carries a url. A claim with no url is dropped.
- A date on a radar row needs 2 independent source hosts, else confidence is single-source.
- Drop any radar row whose date has passed.
- Emit radar only when the list changes. Otherwise set radar to null.
- Do not invent products, dates, or prices. Cite a URL for every claim.
- No money-advice wording. No creator names. No Collectr.`;
}

async function callXai({ apiKey, model, input, fetchImpl }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: input }],
        tools: [{ type: "web_search" }],
      }),
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) return { error: "xAI API " + res.status + ": " + body.slice(0, 300) };
    let data;
    try { data = JSON.parse(body); }
    catch { return { error: "xAI API returned non-JSON" }; }
    return { data, text: extractText(data) };
  } catch (e) {
    return { error: "xAI API call failed: " + (e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

// Copies radar.updated into research/assets/public/releases.json.
// writePublicReleases reads the radar file, so the radar write has to land
// first. A skipped write is a failed run: the caller restores the radar
// and does not write the digest, so yesterday's files stay.
export async function stampPublicReleases(root, writePublic) {
  let wrote = false;
  if (typeof writePublic === "function") {
    wrote = await writePublic(root);
  } else {
    const { writePublicReleases } = await import("./lib/feature-data.mjs");
    wrote = await writePublicReleases(root);
  }
  if (!wrote) return { ok: false, error: "public releases were not written from the radar" };
  return { ok: true };
}

export async function runDailyResearch(opts = {}) {
  const {
    apiKey = process.env.XAI_API_KEY,
    model = process.env.XAI_MODEL || MODEL_DEFAULT,
    root = ROOT,
    today = new Date().toISOString().slice(0, 10),
    fetchImpl = globalThis.fetch,
    resolveUrl = (url) => defaultResolveUrl(url, fetchImpl),
    writePublic,
    log = console,
  } = opts;

  const radarPath = join(root, "data", "release-radar.json");
  const promptPath = join(root, "research", "RESEARCH_PROMPT.md");
  const digestDir = join(root, "research", "digests");
  const newsPath = join(digestDir, "news.json");
  const digestPath = join(digestDir, today + ".md");

  if (!apiKey) {
    const error = "Missing XAI_API_KEY. Add the secret in the repo settings. No digest written.";
    log.error(error);
    return { ok: false, error, wrote: false };
  }

  let radar, brief, news;
  try {
    radar = JSON.parse(await readFile(radarPath, "utf8"));
    brief = partsOneAndTwo(await readFile(promptPath, "utf8"));
    try { news = JSON.parse(await readFile(newsPath, "utf8")); }
    catch { news = { items: [] }; }
  } catch (e) {
    const error = "Could not read research inputs: " + e.message;
    log.error(error);
    return { ok: false, error, wrote: false };
  }

  const newsUrls = loadNewsUrls(news);
  const nearRows = rowsWithin(radar.upcoming, today, WINDOW_DAYS);
  const userMsg = buildUserMessage(brief, today, radar, nearRows, newsUrls);

  const called = await callXai({ apiKey, model, input: userMsg, fetchImpl });
  if (called.error) {
    log.error(called.error);
    return { ok: false, error: called.error, wrote: false };
  }

  const parsed = parseModelText(called.text);
  if (parsed.error) {
    log.error("Schema rejected model output: " + parsed.error);
    return { ok: false, error: parsed.error, wrote: false };
  }

  const obj = parsed.obj;
  const keptClaims = [];
  const dropped = [];
  for (const claim of obj.claims) {
    const url = typeof claim.url === "string" ? claim.url.trim() : "";
    if (!isHttpUrl(url)) {
      dropped.push({ reason: "no URL", text: claim.text || "" });
      log.error("dropped claim with no URL: " + String(claim.text || "").slice(0, 120));
      continue;
    }
    if (newsUrls.has(url)) {
      dropped.push({ reason: "already in news.json", url });
      continue;
    }
    const verdict = asVerdict(await resolveUrl(url));
    if (!verdict.keep) {
      dropped.push({ reason: verdict.reason || "URL did not resolve", url });
      log.error("dropped claim, URL did not resolve: " + url + " (" + (verdict.reason || "no") + ")");
      continue;
    }
    keptClaims.push({
      text: claim.text || "",
      url,
      sources: (claim.sources || []).filter(isHttpUrl),
      urlStatus: verdict.tag || "ok",
    });
  }

  const { radar: nextRadar, changed, droppedPast } = applyRadar(radar, obj.radar, today);
  for (const name of droppedPast) log.error("dropped passed date: " + name);

  const note = changed ? "radar updated" : "radar checked, no change";
  const head = "> RADAR: " + note + "\n\n";
  const unverified = keptClaims.filter((c) => c.urlStatus === "exists, unverified");
  const tagBlock = unverified.length
    ? "\n\n## Source check\n" + unverified.map((c) => "- exists, unverified: " + c.url).join("\n") + "\n"
    : "";
  const body = String(obj.digest).trim();
  const digestText = head + body + tagBlock + (tagBlock ? "" : "\n");

  // Write only after the schema passed and the drops are decided.
  // A rerun the same day overwrites the same path.
  // Radar first, then stampPublicReleases copies radar.updated into the
  // public releases file. If that copy does not land, restore the radar
  // and skip the digest.
  await mkdir(digestDir, { recursive: true });
  const prevRadarText = await readFile(radarPath, "utf8");
  await writeFile(radarPath, JSON.stringify(nextRadar, null, 2) + "\n");
  const stamped = await stampPublicReleases(root, writePublic);
  if (!stamped.ok) {
    await writeFile(radarPath, prevRadarText);
    log.error(stamped.error);
    return { ok: false, error: stamped.error, wrote: false };
  }
  await writeFile(digestPath, digestText);

  const usage = called.data?.usage || null;
  const searches = called.data?.server_side_tool_usage?.SERVER_SIDE_TOOL_WEB_SEARCH || 0;
  log.log("wrote " + digestPath + " (" + note + ", " + keptClaims.length + " claims kept, " + dropped.length + " dropped)");
  log.log("public releases checked date copied from the radar");
  if (usage || searches) log.log("usage: " + JSON.stringify({ usage, searches }));

  return {
    ok: true,
    wrote: true,
    digestPath,
    radarPath,
    note,
    changed,
    keptClaims,
    dropped,
    droppedPast,
    publicWrote: true,
    usage,
    searches,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runDailyResearch().then((r) => {
    if (!r.ok) process.exit(1);
  }).catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}
