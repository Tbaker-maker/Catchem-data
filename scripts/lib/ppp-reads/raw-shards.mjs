// Reads the PkmnPrices enrich store (scripts/ppp-enrich.mjs: ppp-raw-private/
// <lane>/<bucket>.json keyed by TCGplayer id, synced to catchem-data-private
// ppp/) and turns it into one "ppp-reads-input" doc. Raw rows pass through
// unchanged; only the wrapping differs. Any missing lane leaves its pathways idle.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { INPUT_KIND } from "./inputs.mjs";

export const RAW_LANES = ["comps", "volume", "pop", "detail", "history"];
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
const day = (s) => String(s || "").slice(0, 10);
const addDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

export function rawDirs(root, env = process.env) {
  return [env.PPP_RAW_DIR, join(root, "ppp-raw-private"), join(root, "..", "catchem-data-private", "ppp")].filter(Boolean);
}

async function laneRows(dir, lane) {
  let names = [];
  try { names = (await readdir(join(dir, lane))).filter((n) => n.endsWith(".json")); } catch { return null; }
  const out = {};
  for (const n of names.sort()) Object.assign(out, await J(join(dir, lane, n), {}));
  return out;
}

// detail.prices[] (current Cardmarket EUR rows) -> history-shaped rows dated by created_at.
export function detailToHistory(body) {
  return (body?.prices || [])
    .filter((p) => p?.source === "cardmarket" && String(p?.currency).toUpperCase() === "EUR" && Number(p.market_price) > 0 && day(p.created_at))
    .map((p) => ({ date: day(p.created_at), avg: Number(p.market_price), currency: "EUR", source: "cardmarket", condition: p.condition ?? null, variant: p.variant ?? null }));
}

export function shardsToInput(lanes, idMap = {}) {
  const items = {};
  let asOf = "";
  const kindOf = (pid) => (idMap?.sealed?.[pid] ? "sealed" : "single");
  const item = (pid) => (items[`tcgcsv-${pid}`] ||= { pppId: idMap?.single?.[pid] || idMap?.sealed?.[pid] || null, kind: kindOf(pid) });
  const seen = (at) => { const d = day(at); if (d > asOf) asOf = d; };
  for (const [pid, e] of Object.entries(lanes.comps || {})) {
    if (!e) continue;
    const it = item(pid);
    it.comps = [...(e.rows || []), ...(e.gradedRows || [])];
    // A page that says there is more holds only the newest comps: the day of
    // its oldest comp may be partial, so coverage starts the day after.
    const oldest = (rows) => rows.map((r) => day(r?.sold_at)).filter(Boolean).sort()[0];
    if (e.more && oldest(e.rows || [])) it.compsFrom = addDay(oldest(e.rows));
    if (e.gradedMore && oldest(e.gradedRows || [])) it.gradedFrom = addDay(oldest(e.gradedRows));
    seen(e.at);
  }
  for (const [pid, e] of Object.entries(lanes.volume || {})) {
    if (!e) continue;
    const it = item(pid);
    it.volume = e.rows || [];
    // A truncated page cannot vouch for its oldest days.
    const dates = it.volume.map((r) => day(r?.date)).filter(Boolean).sort();
    if (dates.length && !e.more) it.volumeFrom = dates[0];
    seen(e.at);
  }
  for (const [pid, e] of Object.entries(lanes.pop || {})) {
    if (!e?.body) continue;
    item(pid).population = { ...e.body, fetchedAt: e.at };
    seen(e.at);
  }
  for (const [pid, e] of Object.entries(lanes.history || {})) {
    if (!e) continue;
    item(pid).history = [...(item(pid).history || []), ...(e.rows || [])];
  }
  for (const [pid, e] of Object.entries(lanes.detail || {})) {
    if (!e?.body) continue;
    item(pid).history = [...(item(pid).history || []), ...detailToHistory(e.body)];
  }
  return { kind: INPUT_KIND, asOf, from: "ppp-raw-private", items };
}

export async function loadRawShardDoc(root, env = process.env) {
  for (const dir of rawDirs(root, env)) {
    const lanes = {};
    let any = false;
    for (const lane of RAW_LANES) {
      const rows = await laneRows(dir, lane);
      if (rows) { lanes[lane] = rows; any = true; }
    }
    if (!any) continue;
    const doc = shardsToInput(lanes, await J(join(dir, "id-map.json"), {}));
    if (Object.keys(doc.items).length) return { doc, dir };
  }
  return null;
}
