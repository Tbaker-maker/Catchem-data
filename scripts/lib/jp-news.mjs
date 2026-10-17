// Leaves region-only news out of the public digest (North America first).
// Rules: rules/jp-news.json. An item with any region-only signal is dropped
// unless it also has an English, NA, worldwide or international signal. When
// unsure, it stays out. Same rules run in catchem-site and catchem-bot.
import { readFileSync } from "node:fs";

export const JP_RULES = JSON.parse(readFileSync(new URL("../../rules/jp-news.json", import.meta.url), "utf8"));
export const REGION_RULES = JP_RULES;

const rx = (r) => new RegExp(r.pattern, r.flags || "");
const REGION = (JP_RULES.regionRules || []).map((r) => ({ ...r, rx: rx(r) }));
const KEEP = (JP_RULES.keepRules || []).map((r) => ({ ...r, rx: rx(r) }));
const NOT_KEEP = (JP_RULES.notKeepPhrases || []).map((r) => new RegExp(r.pattern, (r.flags || "") + "g"));
const SOURCES = new Map(Object.entries(JP_RULES.sources || {}).map(([k, v]) => [k.toLowerCase(), v]));
const HOSTS = Object.entries(JP_RULES.hosts || {}).map(([k, v]) => [k.toLowerCase(), v]).sort((a, b) => b[0].length - a[0].length);
const LANGS = new Map(Object.entries(JP_RULES.languages || {}).map(([k, v]) => [k.toLowerCase(), v]));
const REGION_FIELD = rx(JP_RULES.regionField);
const REGION_KEEP = rx(JP_RULES.keepRegionPattern);

function host(url) {
  try { return new URL(String(url || "")).hostname.toLowerCase(); } catch { return ""; }
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function newsText(item) {
  const row = item || {};
  return [row.title, row.titleEn, row.originalTitle, row.headline, row.sentence, row.line, row.product, row.setDate, row.url]
    .filter(Boolean).map(String).join(" ");
}

// { keep, rule, region, reason }. keep is true when the item is not region-only.
export function jpNewsDecision(item) {
  const row = item || {};
  const text = newsText(row);
  const region = String(row.region || "").trim();
  const source = String(row.source || "").trim();
  const h = host(row.url);
  const hostHit = HOSTS.find(([k]) => h === k || h.endsWith("." + k));
  const lang = LANGS.get(String(row.language || "").toLowerCase());
  let hit = null;
  let strong = true;
  if (SOURCES.has(source.toLowerCase())) hit = { rule: "region-source", region: SOURCES.get(source.toLowerCase()), reason: `Region-only source (${source}, ${SOURCES.get(source.toLowerCase())}).` };
  else if (hostHit) hit = { rule: "region-host", region: hostHit[1], reason: `Region-only site (${h}, ${hostHit[1]}).` };
  else if (region && REGION_FIELD.test(region)) hit = { rule: "region-field", region, reason: `Item is marked region ${region}.` };
  else if (lang) hit = { rule: "region-language", region: lang, reason: `Item is marked ${lang} language.` };
  else {
    strong = false;
    for (const r of REGION) {
      const m = r.rx.exec(text);
      if (m) { hit = { rule: r.id, region: r.region, reason: `${cap(r.reason)} ("${m[0]}")` }; break; }
    }
  }
  if (!hit) return { keep: true, rule: "", region: "", reason: "" };
  if (region && REGION_KEEP.test(region)) return { keep: true, rule: "na-region", region: hit.region, reason: `Region item kept: marked region ${region}.` };
  let scan = text;
  for (const n of NOT_KEEP) scan = scan.replace(n, " ");
  for (const r of KEEP) {
    if (r.weak && strong) continue;
    const m = r.rx.exec(scan);
    if (m) return { keep: true, rule: r.id, region: hit.region, reason: `Region item kept: ${r.reason} ("${m[0]}")` };
  }
  return { keep: false, rule: hit.rule, region: hit.region, reason: hit.reason };
}

export const isNaRelevant = (item) => jpNewsDecision(item).keep;

// Splits rows into kept and dropped. Dropped rows carry the reason for the private QA log.
export function splitJpNews(rows) {
  const kept = [];
  const dropped = [];
  for (const row of rows || []) {
    const d = jpNewsDecision(row);
    if (d.keep) kept.push(row);
    else dropped.push({ title: row.titleEn || row.title || "", url: row.url || "", source: row.source || "", date: row.date || "", rule: d.rule, region: d.region, reason: d.reason });
  }
  return { kept, dropped };
}
