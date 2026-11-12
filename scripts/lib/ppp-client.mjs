// Minimal PkmnPrices client. The key comes from PKMNPRICES_API_KEY (CI secret) or a
// local file path in PKMNPRICES_KEY_FILE. It is never printed, logged or written.
import { readFileSync } from "node:fs";

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
