// Loads everything the PkmnPrices pathways read, once per nightly process.
// Inputs, in order: PPP_READS_INPUT_DIR, data/private/ppp/reads-input (local or
// the gitignored private folder), ../catchem-data-private/data/private/ppp/reads-input,
// then the same folder in catchem-data-private over the GitHub API when
// PRIVATE_DATA_TOKEN is set. The enrich store (ppp-raw-private/ from
// scripts/ppp-enrich.mjs) is read too, see raw-shards.mjs. No input means
// every pathway is idle.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LIMITS, mergeLimits } from "./limits.mjs";
import { INPUT_KIND, attachPopHistory, loadInputDocs, mergeInputs } from "./inputs.mjs";
import { loadFx } from "./fx.mjs";
import { loadRawShardDoc } from "./raw-shards.mjs";
import { thinDaysOf } from "./pathways.mjs";

export const PRIVATE_INPUT_DIR = "data/private/ppp/reads-input";
export const PRIVATE_LIMITS = "data/private/ppp-reads/limits.json";
export const PRIVATE_POP_HISTORY = "data/private/ppp-reads/pop-history.json";
const API = "https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents";

const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

async function apiJson(path, token, raw = true) {
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json", "User-Agent": "catchem-ppp-reads" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function remoteDocs(token) {
  const list = await apiJson(PRIVATE_INPUT_DIR, token, false).catch(() => null);
  if (!Array.isArray(list)) return [];
  const docs = [];
  for (const f of list.filter((x) => x?.type === "file" && x.name.endsWith(".json")).sort((a, b) => (a.name < b.name ? -1 : 1)).slice(-14)) {
    const doc = await apiJson(f.path, token).catch(() => null);
    if (doc?.kind === INPUT_KIND) docs.push(doc);
  }
  return docs;
}

export async function loadMsrp(root) {
  const doc = await J(join(root, "data/msrp-sourced.json"), null);
  const map = new Map();
  for (const row of Object.values(doc?.products || {})) {
    const pid = Number(row?.tcgPlayerId);
    if (pid > 0 && Number(row.msrpUsd) > 0 && row.currency === "USD") map.set(pid, { usd: Number(row.msrpUsd), source: row.sourceUrl || "", checked: row.dateChecked || "", confidence: row.confidence || "" });
  }
  return map;
}

let cached = null;
export async function loadPppContext(root, { token = process.env.PRIVATE_DATA_TOKEN || "", env = process.env, fresh = false } = {}) {
  if (cached && !fresh && cached.root === root) return cached.ctx;
  const dirs = [env.PPP_READS_INPUT_DIR, join(root, PRIVATE_INPUT_DIR), join(root, "..", "catchem-data-private", PRIVATE_INPUT_DIR)].filter(Boolean);
  const local = await loadInputDocs(dirs);
  let docs = local.docs;
  let from = local.files.length ? "local" : "";
  // The enrich store (ppp-raw-private/, or the private repo's ppp/) adds its rows.
  const raw = await loadRawShardDoc(root, env);
  if (raw) { docs = [...docs, raw.doc]; from = from ? `${from} + raw store` : "raw store"; }
  if (!docs.length && token && env.PPP_READS_NO_NET !== "1") {
    docs = await remoteDocs(token);
    if (docs.length) from = "private repo";
  }
  const { asOf, items } = mergeInputs(docs);
  let limitsOver = await J(join(root, PRIVATE_LIMITS), null) || await J(join(root, "..", "catchem-data-private", PRIVATE_LIMITS), null);
  if (!limitsOver && token && docs.length && env.PPP_READS_NO_NET !== "1") limitsOver = await apiJson(PRIVATE_LIMITS, token).catch(() => null);
  let popHistory = await J(join(root, PRIVATE_POP_HISTORY), null) || await J(join(root, "..", "catchem-data-private", PRIVATE_POP_HISTORY), null);
  if (!popHistory && token && docs.length && env.PPP_READS_NO_NET !== "1") popHistory = await apiJson(PRIVATE_POP_HISTORY, token).catch(() => null);
  attachPopHistory(items, popHistory);
  const L = mergeLimits(LIMITS, limitsOver);
  const ctx = {
    L,
    thinDays: thinDaysOf([...items.values()].map((it) => it.volume), L),
    items,
    inputAsOf: asOf,
    inputFiles: docs.length,
    inputFrom: from,
    popHistory,
    fx: await loadFx(root),
    msrp: await loadMsrp(root),
  };
  cached = { root, ctx };
  return ctx;
}

export function resetPppContext() { cached = null; }

// Puts the PkmnPrices rows on scanner or board items that share a TCGplayer id.
export function attachPpp(items, ctx) {
  let n = 0;
  for (const item of items || []) {
    const p = ctx?.items?.get(item.id);
    if (!p) continue;
    item.ppp = { volume: p.volume || [], comps: p.comps || [], history: p.history || [], pop: p.pop || [], volumeFrom: p.volumeFrom || "", compsFrom: p.compsFrom || "", gradedFrom: p.gradedFrom || "", thinDays: ctx.thinDays || new Set() };
    if (p.jp?.length) item.ppp.jp = p.jp;
    if (p.printing && !item.printing) item.printing = p.printing;
    n += 1;
  }
  return n;
}
