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
  const ap = a.published || a.date || "";
  const bp = b.published || b.date || "";
  if (ap !== bp) return ap < bp ? 1 : -1;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

const MONTH_INDEX = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_NAME = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?|september|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

function isoDay(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function monthNumber(name) {
  return MONTH_INDEX[String(name || "").toLowerCase().replace(/\./g, "")] || 0;
}

function addDays(found, year, month, start, end) {
  const from = Number(start);
  const to = Number(end);
  const step = from <= to ? 1 : -1;
  for (let day = from; step > 0 ? day <= to : day >= to; day += step) {
    const value = isoDay(year, month, day);
    if (value) found.add(value);
    if (Math.abs(to - from) > 31) break;
  }
}

// Specific days a page actually wrote. Vague phrases such as "early October" stay empty.
export function preciseDays(phrase) {
  const found = new Set();
  let text = ` ${String(phrase || "")} `;
  const take = (re, fn) => {
    text = text.replace(re, (full, ...args) => {
      fn(full, args);
      return " ";
    });
  };
  take(new RegExp(`\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*[-–—]\\s*(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(\\d{4})`, "gi"), (_full, args) => {
    const start = isoDay(args[4], monthNumber(args[0]), args[1]);
    const end = isoDay(args[4], monthNumber(args[2]), args[3]);
    if (start) found.add(start);
    if (end) found.add(end);
  });
  take(new RegExp(`\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*[-–—]\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(\\d{4})`, "gi"), (_full, args) => {
    addDays(found, args[3], monthNumber(args[0]), args[1], args[2]);
  });
  take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*[-–—]\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAME})\\.?\\s+(\\d{4})`, "gi"), (_full, args) => {
    addDays(found, args[3], monthNumber(args[2]), args[0], args[1]);
  });
  take(new RegExp(`\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(\\d{4})`, "gi"), (_full, args) => {
    const value = isoDay(args[2], monthNumber(args[0]), args[1]);
    if (value) found.add(value);
  });
  take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAME})\\.?\\s+(\\d{4})`, "gi"), (_full, args) => {
    const value = isoDay(args[2], monthNumber(args[1]), args[0]);
    if (value) found.add(value);
  });
  take(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_full, args) => {
    const value = isoDay(args[0], args[1], args[2]);
    if (value) found.add(value);
  });
  return [...found].sort();
}

export function productKey(name) {
  let text = String(name || "").toLowerCase().replace(/pokémon/g, "pokemon");
  text = text.replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  text = text.replace(/^(?:pokemon tcg|mega evolution|mega expansion pack)\s+/, "");
  text = text.replace(/^pokemon tcg\s+/, "");
  return text;
}

const RELEASE_WORDS = "(?:releas(?:e|es|ed|ing)|launch(?:es|ed|ing)?|ships|shipping|ship date|available)";

export function extractStated(text) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  const out = {};
  const wave = flat.match(/\bwave\s*#?\s*(\d+)\b/i);
  if (wave) out.wave = `Wave ${wave[1]}`;
  const reprint = flat.match(/\b(reprints?(?:\s+of)?\s+[^.]{0,140})/i);
  if (reprint) out.reprint = reprint[1].replace(/\s+/g, " ").trim();
  const quoted = flat.match(/[“"]([^”"]{2,80})[”"]/);
  if (quoted && /\b(set|box|pack|collection|deck|tin|etb|product)\b/i.test(flat)) out.product = quoted[1].trim();
  const dated = flat.match(new RegExp(
    `${RELEASE_WORDS}\\s+(?:on\\s+|in\\s+)?(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\\s+)?((?:${MONTH_NAME})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,)?\\s+\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAME})\\.?\\s+\\d{4}|(?:${MONTH_NAME})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?)`,
    "i",
  ));
  if (dated) out.setDate = dated[1].replace(/\s+/g, " ").trim();
  return out;
}

const TAG_ORDER = ["cards", "sealed", "video-games", "tournaments", "release"];

export function tagsFor(text) {
  const value = String(text || "");
  const tags = new Set();
  if (/\b(trading card|tcg|booster|elite trainer|promo card|expansion pack|set list)\b/i.test(value) || /カード|拡張パック|プロモ/.test(value)) tags.add("cards");
  if (/\b(elite trainer box|booster box|booster bundle|booster display|mini tins?|pre-?orders?)\b/i.test(value) || /パック|ボックス|カートン|デッキセット/.test(value)) tags.add("sealed");
  if (/\b(nintendo switch|video games?|fan game|dlc|pokémon go|pokemon go|pokopia|legends:\s*z-a|pokémon unite|pokemon unite)\b/i.test(value)) tags.add("video-games");
  if (/\b(tournaments?|championships?|regionals?|invitational|league cup|worlds)\b/i.test(value) || /大会|リーグ|チャンピオン/.test(value)) tags.add("tournaments");
  if (new RegExp(RELEASE_WORDS, "i").test(value) || /\bto release\b|\bto launch\b/i.test(value)) tags.add("release");
  return TAG_ORDER.filter((tag) => tags.has(tag));
}

export function annotate(item) {
  const text = [item.title, item.sentence, item.sentenceText, item.product, item.setDate, item.statedDate].filter(Boolean).join(" ");
  const stated = extractStated(text);
  if (!item.product && stated.product) item.product = stated.product;
  if (!item.wave && stated.wave) item.wave = stated.wave;
  if (!item.reprint && stated.reprint) item.reprint = stated.reprint;
  if (!item.setDate && stated.setDate) item.setDate = stated.setDate;
  const tags = new Set([...(item.tags || []), ...tagsFor(text)]);
  if (item.setDate) tags.add("release");
  item.tags = TAG_ORDER.filter((tag) => tags.has(tag));
  return item;
}

export function applyDisagreements(items) {
  const groups = new Map();
  for (const item of items) {
    const key = productKey(item.product);
    if (!key || !item.setDate) continue;
    const region = item.region || "";
    const id = `${key}@@${region.toLowerCase()}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  }
  for (const group of groups.values()) {
    const dated = group.filter((item) => preciseDays(item.setDate).length > 0);
    const conflicting = [];
    for (let i = 0; i < dated.length; i++) {
      for (let j = i + 1; j < dated.length; j++) {
        if (dated[i].source === dated[j].source) continue;
        const left = preciseDays(dated[i].setDate);
        const right = preciseDays(dated[j].setDate);
        const overlap = left.some((day) => right.includes(day));
        if (!overlap) {
          conflicting.push(dated[i], dated[j]);
        }
      }
    }
    if (!conflicting.length) continue;
    const unique = [];
    const seen = new Set();
    for (const item of conflicting) {
      const mark = `${item.source}|${item.setDate}|${item.url}`;
      if (seen.has(mark)) continue;
      seen.add(mark);
      unique.push(item);
    }
    const detail = unique.map((item) => `${item.source} says ${item.setDate}`).join("; ");
    const note = `Sources disagree on the date for ${unique[0].product}. ${detail}.`;
    for (const item of unique) {
      item.note = item.note ? `${item.note} ${note}` : note;
    }
  }
  return items;
}

export function blockedUrlReason(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return "not a url"; }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  if (host === "pokemon.com" || host === "www.pokemon.com") return "pokemon.com is not fetched";
  if (host === "www.pokemoncenter.com") return "www.pokemoncenter.com is not fetched";
  if ((host === "pokebeach.com" || host === "www.pokebeach.com") && (path === "/feed" || path.startsWith("/feed/"))) {
    return "pokebeach.com/feed is not fetched";
  }
  if (host.endsWith("pokeguardian.com") && (path === "/feed" || path.startsWith("/feed/") || path === "/rss" || path.startsWith("/rss/"))) {
    return "PokeGuardian feed is not fetched";
  }
  if (host.endsWith("nintendolife.com")) return "Nintendo Life is not fetched";
  if (host.endsWith("gematsu.com") && (path === "/feed" || path.startsWith("/feed/"))) return "Gematsu all-games feed is not fetched";
  return null;
}

export function shapeNewsItem(item) {
  const out = {
    title: item.title,
    url: item.url,
    source: item.source,
  };
  if (item.date) out.date = item.date;
  if (item.dateEnd) out.dateEnd = item.dateEnd;
  if (item.statedDate && item.statedDate !== item.date) out.statedDate = item.statedDate;
  if (item.sentence) out.sentence = item.sentence;
  out.kind = item.kind || "news";
  if (item.tags?.length) out.tags = item.tags;
  if (item.product) out.product = item.product;
  if (item.wave) out.wave = item.wave;
  if (item.reprint) out.reprint = item.reprint;
  if (item.setDate) out.setDate = item.setDate;
  if (item.region) out.region = item.region;
  if (item.published) out.published = item.published;
  if (item.note) out.note = item.note;
  if (item.listUrl) out.listUrl = item.listUrl;
  return out;
}
