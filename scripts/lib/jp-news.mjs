// Leaves Japan-only news out of the public digest. Rules: rules/jp-news.json.
// An item with any Japan signal is dropped unless it also has an NA or English
// signal. When unsure, it stays out. Same rules run in catchem-site and catchem-bot.
import { readFileSync } from "node:fs";

export const JP_RULES = JSON.parse(readFileSync(new URL("../../rules/jp-news.json", import.meta.url), "utf8"));

const compile = (list) => (list || []).map((r) => ({ ...r, rx: new RegExp(r.pattern, r.flags || "") }));
const JP = compile(JP_RULES.jpRules);
const KEEP = compile(JP_RULES.keepRules);
const lower = (list) => new Set((list || []).map((s) => String(s).toLowerCase()));
const SOURCES = lower(JP_RULES.jpSources);
const HOSTS = [...lower(JP_RULES.jpHosts)];
const NOT_HOSTS = [...lower(JP_RULES.notJpHosts)];
const REGION_JP = new RegExp(JP_RULES.jpRegionPattern.pattern, JP_RULES.jpRegionPattern.flags || "");
const REGION_KEEP = new RegExp(JP_RULES.keepRegionPattern.pattern, JP_RULES.keepRegionPattern.flags || "");
const onHost = (h, list) => list.some((x) => h === x || h.endsWith("." + x));
const REGIONS = lower(JP_RULES.jpRegions);
const LANGS = lower(JP_RULES.jpLanguages);

function host(url) {
  try { return new URL(String(url || "")).hostname.toLowerCase(); } catch { return ""; }
}

export function newsText(item) {
  const row = item || {};
  return [row.title, row.titleEn, row.originalTitle, row.headline, row.sentence, row.line, row.product, row.setDate, row.url]
    .filter(Boolean).map(String).join(" ");
}

// { keep, rule, reason }. keep is true when the item is not Japan-only.
export function jpNewsDecision(item) {
  const row = item || {};
  const text = newsText(row);
  let jp = null;
  const region = String(row.region || "").trim();
  const source = String(row.source || "").trim().toLowerCase();
  if (SOURCES.has(source)) jp = { rule: "jp-source", reason: `JP-only source (${row.source}).` };
  else if (onHost(host(row.url), HOSTS) && !onHost(host(row.url), NOT_HOSTS)) jp = { rule: "jp-host", reason: `JP-only site (${host(row.url)}).` };
  else if (REGIONS.has(region.toLowerCase()) || REGION_JP.test(region)) jp = { rule: "jp-region", reason: `Item is marked region ${region}.` };
  else if (LANGS.has(String(row.language || "").toLowerCase())) jp = { rule: "jp-language", reason: "Item is marked Japanese language." };
  else {
    for (const r of JP) {
      const m = r.rx.exec(text);
      if (m) { jp = { rule: r.id, reason: `${r.reason[0].toUpperCase()}${r.reason.slice(1)} ("${m[0]}")` }; break; }
    }
  }
  if (!jp) return { keep: true, rule: "", reason: "" };
  if (region && REGION_KEEP.test(region)) return { keep: true, rule: "na-region", reason: `Japan item kept: marked region ${region}.` };
  for (const r of KEEP) {
    const m = r.rx.exec(text);
    if (m) return { keep: true, rule: r.id, reason: `Japan item kept: ${r.reason} ("${m[0]}")` };
  }
  return { keep: false, rule: jp.rule, reason: jp.reason };
}

export const isNaRelevant = (item) => jpNewsDecision(item).keep;

// Splits rows into kept and dropped. Dropped rows carry the reason for the private QA log.
export function splitJpNews(rows) {
  const kept = [];
  const dropped = [];
  for (const row of rows || []) {
    const d = jpNewsDecision(row);
    if (d.keep) kept.push(row);
    else dropped.push({ title: row.titleEn || row.title || "", url: row.url || "", source: row.source || "", date: row.date || "", rule: d.rule, reason: d.reason });
  }
  return { kept, dropped };
}
