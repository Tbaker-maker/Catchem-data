// Turn official press items into set and product stubs. No network.
// A date is kept only when the text states it. A known name is not a new stub.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

const SET_WORDS = /\b(expansion|booster set|trading card game set|new set|set launches|set arrives|will release|releases?)\b/i;
const PRODUCT_WORDS = /\b(elite trainer box|booster box|booster bundle|ultra-premium collection|premium collection|tin|collection box)\b/i;
const ROTATION_WORDS = /\brotat(?:e|es|ion)\b/i;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tidyName(value) {
  return clean(value).replace(/^(?:the|a|an)\s+/i, "");
}

function slug(value) {
  return tidyName(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function toIsoDate(text) {
  const raw = clean(text);
  const named = raw.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!named) return "";
  const month = MONTHS[named[1].toLowerCase()];
  const day = String(named[2]).padStart(2, "0");
  const iso = `${named[3]}-${month}-${day}`;
  return DAY.test(iso) ? iso : "";
}

function firstDate(text, pattern) {
  const hit = clean(text).match(pattern);
  return hit ? toIsoDate(hit[0]) : "";
}

export function parseRelease(item) {
  const title = clean(item?.title);
  const line = clean(item?.sentence || item?.line || "");
  const text = `${title}. ${line}`.replace(/\s+/g, " ").trim();
  if (!title || !item?.url || !DAY.test(String(item?.date || ""))) return null;
  if (!/^https:\/\/press\.pokemon\.com\/en\//.test(item.url)) return null;
  const setName = (text.match(/\b([A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,5})\s+(?:expansion|booster set|trading card game)/) || [])[1] || "";
  const productName = (text.match(/\b((?:Elite Trainer Box|Booster Box|Booster Bundle|Ultra-Premium Collection|Premium Collection|[A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,4}\s+(?:Tin|Collection Box)))\b/) || [])[1] || "";
  const releaseDate = firstDate(text, /\b(?:launches?|arrives?|releases?|available|on sale)\s+(?:on\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i)
    || firstDate(text, /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i);
  const rotationDate = ROTATION_WORDS.test(text)
    ? firstDate(text, /\brotat(?:e|es|ion)\b[\s\S]{0,40}?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i)
    : "";
  const kind = productName && PRODUCT_WORDS.test(text) && !SET_WORDS.test(title) ? "product" : (SET_WORDS.test(text) ? "set" : "");
  const name = tidyName(kind === "product" ? productName : setName);
  if (!kind || !name || !releaseDate) return null;
  return {
    id: `press-${slug(name)}`,
    kind,
    name,
    releaseDate,
    rotationDate: rotationDate || undefined,
    dayOne: true,
    sourceUrl: item.url,
    sourceDate: item.date,
    source: "Pokémon press",
  };
}

function knownKey(row) {
  return slug(row?.name || row?.set || "");
}

export function scoutReleases({ items = [], knownSets = [], knownProducts = [], asOf = "" } = {}) {
  const known = new Set([...knownSets, ...knownProducts].map(knownKey).filter(Boolean));
  const stubs = [];
  const seen = new Set();
  for (const item of items) {
    if (item?.source && item.source !== "Pokémon press") continue;
    const stub = parseRelease(item);
    if (!stub) continue;
    if (known.has(slug(stub.name)) || seen.has(stub.id)) continue;
    seen.add(stub.id);
    stubs.push(stub);
  }
  const out = { asOf, source: "Pokémon press", stubs };
  if (!stubs.length) out.note = "No new official release with a stated date.";
  return out;
}
