// Pure selection for the free TCG news job. No network. No prices.

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";

export function ptDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftDay(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function hasSourceUrl(item) {
  return typeof item?.url === "string" && /^https?:\/\/\S+$/.test(item.url);
}

export function isPriceText(text) {
  return /\$\s?\d|\bprices?\b|\bvaluable\b|\bsold for\b|\bmarket value\b/i.test(text || "");
}

const NAMED = {
  quot: '"', apos: "'", amp: "&", lt: "<", gt: ">", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "...", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", eacute: "é", Eacute: "É", aacute: "á",
  ntilde: "ñ", uacute: "ú", iacute: "í", oacute: "ó", middot: "·",
};

export function decodeEntities(s) {
  let out = String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([A-Za-z]+);/g, (m, name) => (name in NAMED ? NAMED[name] : m));
  }
  return out;
}

export function htmlToText(html) {
  const stripped = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

// First plain sentence taken from source text. Never a price line.
function splitSentences(flat) {
  const raw = flat.split(/(?<=[.!?])\s+/);
  const parts = [];
  for (const part of raw) {
    const prev = parts[parts.length - 1];
    if (prev && /(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|Mr|Mrs|Ms|Dr|Jr|Sr)\.$/.test(prev)) {
      parts[parts.length - 1] = `${prev} ${part}`;
    } else parts.push(part);
  }
  return parts;
}

export function firstPlainSentence(text) {
  const cut = String(text || "").split(/Click to expand|Continue reading|About The Pokémon Company/i)[0];
  const flat = cut.replace(/\s+/g, " ").replace(/^#+\s*/, "").trim();
  if (!flat || /bigger last step/i.test(flat)) return null;
  for (let part of splitSentences(flat)) {
    part = part.trim().replace(/^(?:[>"“”]\s*)+/, "").replace(/["“”]+$/, "").replace(/\s+([,!?;:])/g, "$1").replace(/\s+\./g, ".").trim();
    if (part.length < 40 || part.length > 420) continue;
    if (!/[.!?]$/.test(part)) continue;
    if (isPriceText(part) || /bigger last step/i.test(part)) continue;
    if (/^#|About The Pokémon Company|&[A-Za-z]+;/.test(part)) continue;
    return part;
  }
  return null;
}

export function sentenceForItem(bodyText, title) {
  const fromBody = firstPlainSentence(bodyText);
  if (fromBody) return fromBody;
  const t = String(title || "").replace(/\s+/g, " ").trim();
  if (t.length >= 20 && t.length <= 220 && /[.!?]$/.test(t) && !isPriceText(t) && !/bigger last step/i.test(t)) return t;
  return null;
}

// Older weekly items are allowed only when the source text itself says so.
export function sourceAllowsOlderWeekly(text) {
  const parts = String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  const release = new RegExp(
    "\\b(to release|to launch|will release|will launch|will be released|set to release|set to launch|pre-?orders? now live|launches on|releases on)\\b" +
      `|\\b(?:launch(?:es|ing)?|releases|releasing) in (?:early |mid |late )?(?:${MONTHS})\\b`,
    "i",
  );
  const development = /\b(new details|update on|further details)\b|\bmore\b[^.]{0,80}\b(revealed|announced)\b|\badditional\b[^.]{0,80}\b(revealed|announced)\b/i;
  return parts.some((part) => {
    if (/\b(not|n't|no longer|never)\b/i.test(part)) return false;
    return release.test(part) || development.test(part);
  });
}

export function pickDefault(items, today, cap = 8) {
  const cutoff = shiftDay(today, -14);
  return items
    .filter((item) => item.date >= cutoff && item.date <= today)
    .sort(byNewest)
    .slice(0, cap);
}

export function pickNews(items, today) {
  const cutoff = shiftDay(today, -90);
  return items
    .filter((item) => item.kind === "news" && item.date >= cutoff && item.date <= today)
    .sort(byNewest);
}

export function pickWeekly(items, today) {
  const recent = pickDefault(items, today, 8);
  const recentUrls = new Set(recent.map((item) => item.url));
  const cutoff = shiftDay(today, -14);
  const floor = shiftDay(today, -90);
  const older = items
    .filter((item) => item.date < cutoff && item.date >= floor && !recentUrls.has(item.url))
    .filter((item) => sourceAllowsOlderWeekly(`${item.title} ${item.sentence}`))
    .sort(byNewest);
  return [...recent, ...older];
}

function byNewest(a, b) {
  if (a.published !== b.published) return a.published < b.published ? 1 : -1;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}
