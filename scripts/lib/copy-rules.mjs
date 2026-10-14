// copy-rules.mjs: the one place that decides which words a reader may see.
// Only reader-visible text fields are checked. Ids, slugs, keys, urls, paths,
// pattern keys and dates are machine text and are never checked.
// Matching is whole word, so a banned word inside another word does not trip it.

// Words a reader must never see. A word with a safe replacement is rewritten
// and logged. A word with no replacement fails, naming the field and the read id.
export const BANNED_WORDS = [
  "buy", "buys", "buying", "sell", "sells", "selling", "hold", "holds", "holding",
  "support", "resistance", "bottom", "bottoms", "bottomed", "breakout", "breakouts",
  "printed", "play", "plays", "target", "targets", "invest", "invests", "investing",
  "investment", "investor", "investors", "stack", "stacks", "stacking", "load up",
  "crypto", "moon", "mooning", "hodl", "pump", "dump", "bullish", "bearish", "nft", "nfts", "web3",
  "cheap", "crash",
];

// Approved swaps. Only words whose meaning survives the swap are here.
export const REPLACEMENTS = {
  "breakout": "climb past its range",
  "breakouts": "climbs past their range",
  "bottom": "low",
  "bottoms": "lows",
  "bottomed": "hit a low",
  "support": "recent low range",
  "resistance": "recent high range",
  "printed": "recorded",
  "cheap": "low priced",
  "crash": "sharp drop",
  "mooning": "climbing fast",
  "bullish": "rising",
  "bearish": "falling",
};

// Field names a reader sees. Anything else is treated as machine text.
export const VISIBLE_FIELDS = new Set([
  "title", "headline", "why", "whyItMatters", "whatWouldMakeThisWrong", "body", "text", "line", "lines",
  "label", "labels", "note", "notes", "sentence", "summary", "caption", "description", "embed", "embedText",
  "subtitle", "wording", "path", "footer", "message", "chip", "chips", "source", "shipSource", "status",
]);
// "path" above is the reader sentence some reads use; real file paths are caught by looksMachine.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
const WORD_RE = new RegExp(`\\b(${[...BANNED_WORDS].sort((a, b) => b.length - a.length).map(esc).join("|")})\\b`, "gi");
const DASH_RE = /\s*[\u2014\u2013]\s*/g;
const NO_DATA_RE = /\bno data\b/i;
// "supply" alone is banned. "listings counted" is the approved phrase.
const SUPPLY_RE = /\bsupply\b/gi;

function looksMachine(s) {
  return /^(https?:\/\/|\/|\.\/)/.test(s) || /^[\w.-]+\/[\w./-]+$/.test(s) || /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s);
}

function matchCase(src, rep) {
  return src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase() ? rep[0].toUpperCase() + rep.slice(1) : rep;
}

// Check one visible string. Returns { text, fixes, errors }.
export function cleanText(input, { field = "text", id = "" } = {}) {
  let text = String(input ?? "");
  const fixes = [];
  const errors = [];
  if (!text || looksMachine(text)) return { text, fixes, errors };
  if (DASH_RE.test(text)) {
    text = text.replace(DASH_RE, ", ");
    fixes.push({ id, field, from: "dash", to: ", " });
  }
  text = text.replace(SUPPLY_RE, (m) => {
    fixes.push({ id, field, from: m, to: "listings counted" });
    return matchCase(m, "listings counted");
  });
  text = text.replace(WORD_RE, (m) => {
    const rep = REPLACEMENTS[m.toLowerCase().replace(/\s+/g, " ")];
    if (!rep) {
      errors.push(`banned word "${m}" in field "${field}"${id ? ` of read ${id}` : ""}`);
      return m;
    }
    fixes.push({ id, field, from: m, to: rep });
    return matchCase(m, rep);
  });
  if (NO_DATA_RE.test(text)) errors.push(`"No data" in field "${field}"${id ? ` of read ${id}` : ""}; hide the section instead`);
  return { text, fixes, errors };
}

// True when a visible string breaks no rule and needs no rewrite.
export function isClean(text) {
  const r = cleanText(text);
  return r.errors.length === 0 && r.fixes.length === 0;
}
export const hasBannedWord = (text) => !isClean(text);

// Walk a document. Only VISIBLE_FIELDS (and string arrays under them) are checked.
// Returns a rewritten copy plus the log. Never mutates the input.
export function cleanDoc(doc, { idOf = (o) => o?.id || "", visible = VISIBLE_FIELDS } = {}) {
  const fixes = [];
  const errors = [];
  const walk = (node, id, field) => {
    if (Array.isArray(node)) return node.map((v) => walk(v, id, field));
    if (node && typeof node === "object") {
      const ownId = String(idOf(node) || id || "");
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v, ownId, k);
      return out;
    }
    if (typeof node === "string" && field && visible.has(field)) {
      const r = cleanText(node, { field, id });
      fixes.push(...r.fixes);
      errors.push(...r.errors);
      return r.text;
    }
    return node;
  };
  const out = walk(doc, "", null);
  return { doc: out, fixes, errors };
}

// Rewrite where safe, log each swap, throw only when no swap exists.
export function enforceCopy(doc, label = "copy", opts = {}) {
  const r = cleanDoc(doc, opts);
  for (const f of r.fixes) console.log(`[copy-rules] ${label}: ${f.id ? `read ${f.id} ` : ""}${f.field}: "${f.from}" -> "${f.to}"`);
  if (r.errors.length) throw new Error(`${label} used a banned word: ${r.errors.slice(0, 5).join("; ")}`);
  return r.doc;
}
