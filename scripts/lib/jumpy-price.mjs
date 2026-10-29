// A jumpy lead price cannot open a read. The swing limit lives in
// catchem-data-private (config/read-jumpy.json). With no limit, nothing changes.
// A price that crosses the limit more than once in the window, or that sits
// past the limit from the steady price before the first cross, falls back to
// that steady point. That point is a real print on file. If there is no steady
// point, the card is held and cannot lead.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { addDays } from "./history-reads.mjs";

export function validJumpy(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const windowDays = Number(cfg.windowDays);
  const swingPct = Number(cfg.swingPct);
  const minSwings = Number(cfg.minSwings);
  if (!(windowDays > 0) || !(swingPct > 0) || !(minSwings >= 1)) return null;
  return { windowDays, swingPct, minSwings };
}

export async function loadJumpy(root) {
  const paths = [join(root, "..", "catchem-data-private", "config", "read-jumpy.json")];
  for (const p of paths) {
    try {
      const got = validJumpy(JSON.parse(await readFile(p, "utf8")));
      if (got) return got;
    } catch { /* next */ }
  }
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/read-jumpy.json", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-read-jumpy" },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? validJumpy(await res.json()) : null;
  } catch { return null; }
}

// Quote for a lead. No limit: tonight's price. Jumpy: the last steady print
// before the first cross, or held when that print does not exist.
export function jumpyQuote(pts, asOf, cfg) {
  const last = pts?.[pts.length - 1];
  if (!last || !(last[1] > 0)) return { held: true };
  const limit = validJumpy(cfg);
  if (!limit) return { price: last[1], date: last[0], jumpy: false };
  if (last[0] !== asOf) return { held: true };
  const cut = addDays(asOf, -limit.windowDays);
  const recent = pts.filter((p) => p[0] >= cut && p[0] <= asOf && p[1] > 0);
  if (recent.length < 2) return { price: last[1], date: last[0], jumpy: false };
  const swings = [];
  for (let i = 1; i < recent.length; i += 1) {
    const a = recent[i - 1][1];
    const b = recent[i][1];
    if (a > 0 && Math.abs(b - a) / a * 100 >= limit.swingPct) swings.push(i);
  }
  const pre = swings.length ? recent.slice(0, swings[0]) : recent;
  const steady = pre.length ? pre[pre.length - 1] : null;
  const far = !!(steady && steady[1] > 0 && Math.abs(last[1] - steady[1]) / steady[1] * 100 >= limit.swingPct);
  const tooMany = swings.length >= limit.minSwings;
  if (!tooMany && !far) return { price: last[1], date: last[0], jumpy: false };
  if (!steady || !(steady[1] > 0) || Math.round(steady[1] * 100) === Math.round(last[1] * 100)) return { held: true, jumpy: true };
  return { price: steady[1], date: steady[0], jumpy: true, swings: swings.length };
}
