// copy-rules.mjs: the one place that decides which lines a reader may not see.
// The rules live in rules/advice-phrases.json and the logic in ./advice-intent.mjs.
// catchem-site keeps byte-for-byte copies of both, catchem-bot keeps the JSON and a
// Python port, and each fails a test when its copy drifts.
//
// What is flagged: a line that tells the reader to buy, sell, hold or flip (you should
// sell, time to buy, grab one now), a promise of a result (guaranteed, can't lose, will
// double, to the moon), crypto or investment framing, and em or en dashes. Market facts,
// questions, past-tense reporting, quoted product names and button labels (Buy on
// TCGplayer, Buy on eBay, Shop, Sell your cards) pass.
//
// A flag names the line, the rule, the matched span and the reason. Nothing is ever rewritten.
// Ids, slugs, keys, urls, paths and dates are machine text and are never checked.
import { readFileSync } from "node:fs";
import { makeChecker } from "./advice-intent.mjs";

export const RULES_URL = new URL("../../rules/advice-phrases.json", import.meta.url);
export const ADVICE = JSON.parse(readFileSync(RULES_URL, "utf8"));
export const ALLOWED = Object.freeze([...ADVICE.allowed]);
const CHECKER = makeChecker(ADVICE);

// Data-read house rules that are not about money words. Flag only.
const HOUSE = [
  { id: "supply", kind: "house", re: /\bsupply\b/i, reason: "Say listings counted, not supply." },
  { id: "no-data", kind: "house", re: /\bno data\b/i, reason: "Hide the section instead of saying No data." },
];

function looksMachine(s) {
  return /^(https?:\/\/|\/|\.\/)/.test(s) || /^[\w.-]+\/[\w./-]+$/.test(s) || /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s);
}

// Every rule a line breaks. Each flag carries the line, the rule, the span, the phrase and the reason.
export function flagLine(input, { field = "", id = "", house = false } = {}) {
  const line = String(input ?? "");
  if (!line.trim() || looksMachine(line.trim())) return [];
  const flags = CHECKER.flagLine(line).map((f) => ({ ...f, field, id }));
  if (house) {
    for (const r of HOUSE) {
      const m = r.re.exec(line);
      if (m) flags.push({ line, rule: r.id, kind: r.kind, span: [m.index, m.index + m[0].length], phrase: m[0], reason: r.reason, field, id });
    }
  }
  return flags;
}

const clip = (s) => (s.length > 160 ? `${s.slice(0, 157)}...` : s);
export const formatFlag = (f) => `flagged "${clip(f.line)}"${f.field ? ` in field "${f.field}"` : ""}${f.id ? ` of read ${f.id}` : ""}: rule ${f.rule} matched "${f.phrase}". ${f.reason}`;

// Log each flagged line once per run, so a dropped line is never dropped silently.
const SEEN = new Set();
export function reportFlags(flags, label = "copy") {
  for (const f of flags) {
    const msg = `[copy-rules] ${label}: ${formatFlag(f)}`;
    if (SEEN.has(msg)) continue;
    SEEN.add(msg);
    console.log(msg);
  }
  return flags;
}

export const isClean = (text, opts) => flagLine(text, opts).length === 0;
export const hasBannedWord = (text, opts) => !isClean(text, opts);

// Drop-in for the old per-file BANNED regexes: BANNED.test(line) is true when the
// line breaks a rule, and the flag is logged with its reason.
export function banGuard(label = "copy", opts = {}) {
  return Object.freeze({ test: (s) => reportFlags(flagLine(s, opts), label).length > 0 });
}
export const BANNED = banGuard("copy");

// Kept for older callers. text is always returned unchanged; fixes is always empty.
// house adds the data-read rules (supply, No data). Emails and other prose pass house: false.
export function cleanText(input, { field = "text", id = "", house = true } = {}) {
  const text = String(input ?? "");
  const flags = flagLine(text, { field, id, house });
  return { text, fixes: [], flags, errors: flags.map(formatFlag) };
}

// Field names a reader sees. Anything else is treated as machine text.
export const VISIBLE_FIELDS = new Set([
  "title", "headline", "why", "whyItMatters", "whatWouldMakeThisWrong", "body", "text", "line", "lines",
  "label", "labels", "note", "notes", "sentence", "summary", "caption", "description", "embed", "embedText",
  "subtitle", "wording", "path", "footer", "message", "chip", "chips", "source", "shipSource", "status",
]);

// Walk a document. Only visible fields (and string arrays under them) are checked.
// Returns the same document plus every flag. Never mutates or rewrites.
export function cleanDoc(doc, { idOf = (o) => o?.id || "", visible = VISIBLE_FIELDS } = {}) {
  const flags = [];
  const walk = (node, id, field) => {
    if (Array.isArray(node)) { for (const v of node) walk(v, id, field); return; }
    if (node && typeof node === "object") {
      const ownId = String(idOf(node) || id || "");
      for (const [k, v] of Object.entries(node)) walk(v, ownId, k);
      return;
    }
    if (typeof node === "string" && field && visible.has(field)) flags.push(...cleanText(node, { field, id }).flags);
  };
  walk(doc, "", null);
  return { doc, fixes: [], flags, errors: flags.map(formatFlag) };
}

// Throw with every flagged line and its reason. Never rewrites.
export function enforceCopy(doc, label = "copy", opts = {}) {
  const r = cleanDoc(doc, opts);
  if (r.errors.length) throw new Error(`${label} broke a copy rule: ${r.errors.slice(0, 5).join("; ")}`);
  return doc;
}
