// Creator talk reads. Consumes the private YouTube engine candidate feed
// (catchem-data-private research/yt/read-candidates.json). Behind flag
// reads.creatorTalk, OFF by default. No AI. The feed is unnamed and built from
// approved calls only; this file re-runs the copy guard and drops anything that
// fails or lacks a traceable source row.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REL = "research/yt/read-candidates.json";

const BANNED = /\b(buy now|you should|should (buy|sell)|load up|guarantee\w*|can'?t lose|to the moon|sold|sales?|selling out|must buy|don'?t miss|act fast)\b/i;
const DASH = /[\u2013\u2014]/;
const COND = /\b(NM|near mint|LP|MP|HP|PSA ?\d+)\b/;

export function guardLines(lines, productKind, names = []) {
  const why = [];
  for (const l of lines || []) {
    if (BANNED.test(l)) why.push("advice or sales wording");
    if (DASH.test(l)) why.push("dash");
    if (productKind !== "single" && COND.test(l)) why.push("condition on sealed");
    for (const n of names) if (n && l.toLowerCase().includes(n.toLowerCase())) why.push("creator name");
  }
  return why;
}

function traced(c) {
  const src = c.sources || [];
  const prices = src.filter((s) => s.file && s.row && s.date && typeof s.value === "number");
  return prices.length >= 2 && (c.lines || []).every((l) => !/\$\d/.test(l) || prices.some((s) => l.includes(s.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))));
}

export async function loadCandidates(root = ROOT, env = process.env) {
  const local = [env.CREATOR_TALK_FILE, join(root, "..", "catchem-data-private", REL)].filter(Boolean);
  for (const p of local) {
    try { return JSON.parse(await readFile(p, "utf8")); } catch { /* next */ }
  }
  const token = env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/${REL}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-creator-talk" },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

export function toReads(doc, { asOf = "", maxAgeDays = 2, names = [] } = {}) {
  const out = [], dropped = [];
  if (!doc || doc.version !== 1) return { reads: out, dropped: [{ why: "no feed" }] };
  if (asOf && doc.asOf && (Date.parse(asOf) - Date.parse(doc.asOf)) / 864e5 > maxAgeDays) return { reads: out, dropped: [{ why: `feed stale (${doc.asOf})` }] };
  for (const c of [...(doc.talkVsData || []), ...(doc.talkingAbout || [])]) {
    const why = guardLines(c.lines, c.productKind, names);
    if (!traced(c)) why.push("number without a source row");
    if (why.length) { dropped.push({ product: c.product, why }); continue; }
    const kind = c.kind === "talk_vs_data" ? "talk" : "talking";
    out.push({
      id: `${kind}-${c.product}-${doc.asOf}`,
      readKind: kind, kind, family: "creator-talk",
      name: c.name,
      headline: c.lines[0],
      lines: c.lines.slice(1).concat([`${c.priceSource || "TCGplayer market"}. Creator count from tracked YouTube channels, unnamed.`]),
      asOf: doc.asOf,
      source: c.priceSource || "TCGplayer market",
      sku: c.product,
      href: `/p/${c.product}`,
      sourceRows: c.sources,
    });
  }
  return { reads: out, dropped };
}
