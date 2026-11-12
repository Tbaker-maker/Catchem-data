// ECB euro reference rates (US dollars per euro), one GET a night.
// https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml
// Kept in data/derived/fx/ecb-eur-usd.json with the source and fetch day.
// A failed fetch keeps the last file. A day the ECB did not publish has no rate.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

export const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml";
export const FX_FILE = "data/derived/fx/ecb-eur-usd.json";

export function parseEcb(xml) {
  const out = [];
  const re = /<Cube time="(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/Cube>/g;
  let m;
  while ((m = re.exec(String(xml || "")))) {
    const usd = m[2].match(/currency="USD" rate="([\d.]+)"/);
    if (usd && Number(usd[1]) > 0) out.push({ date: m[1], usdPerEur: Number(usd[1]) });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function mergeRates(prev, fresh) {
  const map = new Map((prev || []).map((r) => [r.date, r]));
  for (const r of fresh || []) map.set(r.date, r);
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-800);
}

export async function loadFx(root) {
  try { return JSON.parse(await readFile(join(root, FX_FILE), "utf8")).rates || []; } catch { return []; }
}

export async function refreshFx(root, { fetchImpl = fetch, now = new Date() } = {}) {
  const prev = await loadFx(root);
  let fresh = [];
  let status = "kept";
  try {
    const res = await fetchImpl(ECB_URL, { headers: { "User-Agent": "catchem-data (ECB reference rates, one request a night)" }, signal: AbortSignal.timeout(30000) });
    if (res.ok) { fresh = parseEcb(await res.text()); status = fresh.length ? "fetched" : "empty"; } else status = `http ${res.status}`;
  } catch (err) { status = `error ${String(err?.message || err).slice(0, 80)}`; }
  const rates = mergeRates(prev, fresh);
  if (fresh.length) {
    await mkdir(dirname(join(root, FX_FILE)), { recursive: true });
    await writeFile(join(root, FX_FILE), JSON.stringify({ source: "European Central Bank euro foreign exchange reference rates", url: ECB_URL, fetched: now.toISOString().slice(0, 10), unit: "US dollars per euro", rates }) + "\n");
  }
  return { status, rates };
}
