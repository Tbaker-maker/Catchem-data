// Shared PkmnPrices HTTP client. The key is never printed, logged, or returned.
// Enrichment uses pppClient / loadKey / redactKey. The current-price refresh
// uses fetchPpp / buildUrl / pppLimiter / redact.

import { readFileSync } from "node:fs";
import { createLimiter, retryDelayMs } from "./ppt-plan.mjs";

export const PPP_BASE = "https://api.pkmnprices.com";

export function loadKey(env = process.env) {
  if (env.PKMNPRICES_API_KEY) return env.PKMNPRICES_API_KEY.trim();
  if (env.PKMNPRICES_KEY_FILE) return readFileSync(env.PKMNPRICES_KEY_FILE, "utf8").trim();
  return "";
}

export function redactKey(text, key) {
  const s = String(text ?? "");
  return key ? s.split(key).join("[REDACTED]") : s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One client per process. Requests are serial and paced so the account stays under
// the per-minute limit. A daily 429 stops everything; a per-minute 429 waits once.
export function pppClient({ key, minGapMs = 1100, fetchImpl = fetch, log = () => {} } = {}) {
  if (!key) throw new Error("PkmnPrices key missing");
  let last = 0;
  let dailyOut = false;
  const stats = { requests: 0, credits: 0, errors: 0 };
  async function get(path, params = {}, meter = null, { expect = 1 } = {}) {
    if (dailyOut) return { ok: false, status: 429, daily: true };
    if (meter && !meter.canSpend(expect)) return { ok: false, status: 0, budget: true };
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString();
    const url = `${PPP_BASE}${path}${qs ? `?${qs}` : ""}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = last + minGapMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      let res;
      try {
        res = await fetchImpl(url, { headers: { "X-API-Key": key, Accept: "application/json" } });
      } catch (err) {
        stats.errors++;
        log(`network ${path}: ${redactKey(err.message, key)}`);
        if (attempt === 0) { await sleep(3000); continue; }
        return { ok: false, status: 0 };
      }
      stats.requests++;
      const charged = Number(res.headers.get("x-credits-charged") || 0);
      const left = res.headers.get("x-credits-remaining");
      stats.credits += charged;
      if (meter) meter.charge(charged, left);
      if (res.status === 429) {
        let body = null; try { body = await res.json(); } catch {}
        const type = body?.error?.limit_type;
        if (type === "daily") { dailyOut = true; log("daily credit limit reached; stopping"); return { ok: false, status: 429, daily: true }; }
        const after = Number(res.headers.get("retry-after") || 30);
        log(`per-minute 429, waiting ${after}s`);
        await sleep(Math.min(90, after) * 1000);
        continue;
      }
      let body = null;
      try { body = await res.json(); } catch {}
      if (!res.ok) stats.errors++;
      return { ok: res.ok, status: res.status, body, charged, remaining: left == null ? null : Number(left) };
    }
    return { ok: false, status: 429 };
  }
  return { get, stats, get dailyOut() { return dailyOut; } };
}

export const BASE = "https://api.pkmnprices.com";
export const REQ_PER_MIN = 55;

export function redact(text, secrets = []) {
  let out = String(text || "");
  for (const secret of secrets) {
    if (secret && String(secret).length > 3) out = out.split(secret).join("[redacted]");
  }
  return out.slice(0, 240);
}

export function creditsCharged(headers) {
  const raw = headers?.get?.("x-credits-charged") ?? headers?.["x-credits-charged"];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function pickCreditHeaders(headers) {
  const get = (name) => headers?.get?.(name) ?? headers?.[name] ?? null;
  const out = {};
  for (const name of [
    "x-credits-charged",
    "x-credits-limit",
    "x-credits-remaining",
    "x-credits-balance",
    "x-credits-reset",
    "x-rate-limit",
    "x-rate-remaining",
    "x-rate-reset",
    "retry-after",
    "content-type",
  ]) {
    const value = get(name);
    if (value != null) out[name] = value;
  }
  return out;
}

export function isDailyCap(status, body, retryAfter) {
  if (status !== 429) return false;
  const typ = body?.error?.limit_type || body?.error?.limitType || body?.limit_type || body?.limitType;
  if (typ === "daily") return true;
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 300;
}

export function buildUrl(path, query = {}) {
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function pppLimiter(opts = {}) {
  return createLimiter({ unitsPerMinute: REQ_PER_MIN, ...opts });
}

export async function fetchPpp(url, key, {
  request,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
  now = Date.now,
  maxAttempts = 5,
} = {}) {
  if (typeof request !== "function") throw new Error("request is required");
  let rateLimits = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await request(url, key);
    const status = res?.status ?? 0;
    const headers = res?.headers || {};
    const body = res?.body && typeof res.body === "object" ? res.body : {};
    const retryAfter = res?.retryAfter ?? headers["retry-after"] ?? headers["Retry-After"];
    const charged = creditsCharged(headers);
    if (status === 429 || status >= 500) {
      rateLimits += 1;
      if (status === 429 && isDailyCap(status, body, retryAfter)) {
        const err = new Error("daily cap");
        err.daily = true;
        err.status = status;
        err.rateLimits = rateLimits;
        err.charged = charged || 0;
        err.body = body;
        err.headers = headers;
        throw err;
      }
      if (attempt === maxAttempts - 1) {
        const err = new Error(status === 429 ? "rate limited" : `http ${status}`);
        err.status = status;
        err.rateLimits = rateLimits;
        err.charged = charged || 0;
        err.body = body;
        err.headers = headers;
        throw err;
      }
      await sleep(retryDelayMs(attempt, retryAfter, now(), random));
      continue;
    }
    return { status, body, headers, charged, retryAfter, rateLimits };
  }
  const err = new Error("rate limited");
  err.status = 429;
  err.rateLimits = rateLimits;
  err.charged = 0;
  throw err;
}

export async function defaultRequest(url, key, timeoutMs = 30000) {
  const res = await fetch(url, {
    headers: { "X-API-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body = {};
  try { body = await res.json(); } catch { body = {}; }
  return {
    status: res.status,
    body,
    headers: pickCreditHeaders(res.headers),
    retryAfter: res.headers.get("retry-after"),
  };
}
