// The repeatable half of the "Catch'em daily research" routine, as a script.
// Reads files the nightly already fetched from free sources (news.json from the
// news step, release-radar.json, tcgcsv group dates and the TCGCSV catalog) and
// writes leads in the routine's five check categories. No web search, no AI.
// Leads, not published facts: it never edits the radar. A date seen in only one
// source is marked single-source, the same rule as the routine.

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/^jp:\s*/, "").replace(/\(.*?\)/g, " ").replace(/30th celebration\s*[—-]\s*/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set(["the", "and", "of", "pokemon", "tcg", "set", "ex", "a", "mega", "evolution", "collection", "box", "me", "sv"]);
const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
export function nameMatch(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}

export const NEWS_RULES = [
  { type: "SUPPLY_EVENT", re: /\b(reprint|reprinted|restock|re-?stock|print run|print-run|allocation|out of print|production (increase|update)|shortage|sold out|limit(ed)? (of|to) \d|purchase limit|lottery)\b/i },
  { type: "GRADING_NEWS", re: /\b(PSA|CGC|Beckett|BGS|TAG grading|SGC)\b.*\b(grading|backlog|turnaround|price|pricing|tier|pause|paused|reopen|pop(ulation)? report|acquisition)\b|\bgrading (backlog|price|tiers?)\b/i },
  { type: "NEW_SET", re: /\b(announc\w*|reveal\w*|revealed|first look|officially|new (expansion|set|product)|pre-?order)\b.*\b(expansion|set|booster|elite trainer box|etb|collection|tin|premium|special set|deck)\b/i },
  { type: "BIG_MARKET_NEWS", re: /\b(Target|Walmart|Costco|Best Buy|Amazon|GameStop)\b.*\b(policy|limit|stop|pull|ban|allocation)\b|\bscalp\w*|\bcounterfeit|\bfake cards?\b|\bTPCi? statement|\bThe Pok[eé]mon Company (statement|says|responds)/i },
];

// Events and tournaments are not product news even when they say "announced".
const NOT_PRODUCT = /\b(championships?|regional|tournament|challenge|cup|stream|livestream|pok[eé]mon go|scarlet|violet|legends|switch|anime|episode)\b/i;

// `published` is when the item went out; `date` can be an event date in the future.
export function newsLeads(items, { since, until = "9999-12-31" }) {
  const out = [];
  const seen = new Set();
  for (const it of items || []) {
    const date = String(it.published || it.date || "").slice(0, 10);
    if (!date || date < since || date > until || !it.url || it.kind === "tournament") continue;
    const text = `${it.title || ""} ${it.sentence || ""}`;
    for (const rule of NEWS_RULES) {
      if (!rule.re.test(text)) continue;
      if (rule.type === "NEW_SET" && NOT_PRODUCT.test(text)) continue;
      const key = `${rule.type}|${it.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: rule.type, date, title: String(it.title || "").slice(0, 200), source: it.source || "", url: it.url });
    }
  }
  return out;
}

// Radar check: one line per item within 45 days. A calendar entry from a
// news source that names the same product with another date is a DATE_CHANGE lead.
export function radarCheck({ radar, calendar = [], groupDates = {}, groups = [], today, windowDays = 45 }) {
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + windowDays * 86400000).toISOString().slice(0, 10);
  const lines = [], leads = [];
  const isJpSource = (src) => /japan|pokemon-card|\(jp\)|asia/i.test(String(src || ""));
  for (const item of radar?.upcoming || []) {
    if (!item.date || item.date < today) continue;
    // A JP radar item only matches Japanese sources, and an English one only English
    // sources. TCGCSV groups are English.
    const jp = /^JP:/i.test(item.name) || /^jp-/.test(String(item.type || ""));
    const cal = calendar.filter((c) => isJpSource(c.source) === jp && nameMatch(item.name, c.title || c.product) >= 0.6);
    const grp = (jp ? [] : groups).filter((g) => nameMatch(item.name, g.name) >= 0.6 && groupDates[String(g.id)]).map((g) => ({ source: "TCGCSV group", date: groupDates[String(g.id)], title: g.name, url: `https://tcgcsv.com/tcgplayer/3/groups` }));
    const seenAll = [...cal.map((c) => ({ source: c.source, date: String(c.date).slice(0, 10), title: c.title, url: c.url })), ...grp];
    const seenIn = [];
    const seenKeys = new Set();
    for (const x of seenAll) { const k = `${x.source}|${x.date}`; if (!seenKeys.has(k)) { seenKeys.add(k); seenIn.push(x); } }
    const same = seenIn.filter((s) => s.date === item.date);
    const other = seenIn.filter((s) => s.date !== item.date);
    for (const o of other) leads.push({ type: "DATE_CHANGE", name: item.name, radarDate: item.date, seenDate: o.date, source: o.source, url: o.url, confidence: "single-source" });
    if (item.date <= end) {
      const status = other.length ? `possible move: ${other.map((o) => `${o.date} (${o.source})`).join(", ")}` : same.length ? `on schedule, matched in ${[...new Set(same.map((s) => s.source))].join(", ")}` : "no second source in tonight's files";
      lines.push({ date: item.date, name: item.name, confidence: item.confidence || "", status, urls: [...same, ...other].map((s) => s.url).filter(Boolean).slice(0, 3) });
    }
  }
  // Future calendar products not on the radar.
  for (const c of calendar) {
    const d = String(c.date || "").slice(0, 10);
    if (!d || d < today || NOT_PRODUCT.test(c.title || "")) continue;
    if ((radar?.upcoming || []).some((u) => nameMatch(u.name, c.title || c.product) >= 0.6)) continue;
    leads.push({ type: "NEW_SET", name: c.title, seenDate: d, source: c.source, url: c.url, confidence: "single-source", note: "future product in a news calendar, not on the radar" });
  }
  return { lines, leads };
}

export function renderDigest(scan) {
  const L = [`# Script research scan — ${scan.asOf}`, "", "Leads from files the nightly already fetched. No web search, no AI. Verify before publishing.", "", "## Flags"];
  const flagged = [...scan.radarLeads, ...scan.newsLeads];
  if (!flagged.length) L.push("No flags.");
  for (const f of flagged) L.push(`- ${f.type}: ${f.name || f.title}${f.seenDate ? ` (${f.radarDate ? `radar ${f.radarDate}, seen ${f.seenDate}` : f.seenDate})` : ""} — ${f.source} ${f.url}`);
  L.push("", "## Radar check");
  if (!scan.radar.length) L.push("Nothing in the next 45 days.");
  for (const r of scan.radar) L.push(`- ${r.date} ${r.name} — ${r.status}${r.urls.length ? ` (${r.urls.join(" ; ")})` : ""}`);
  L.push("", "## Left for the weekly AI review", ...scan.leftForAi.map((x) => `- ${x}`));
  return L.join("\n") + "\n";
}

export const LEFT_FOR_AI = [
  "Japanese product pages with no feed (pokemon-card.com product posts beyond the news list).",
  "Second-source confirmation for single-source dates.",
  "Grading backlog numbers that live only on tracker pages.",
  "The Pokémon-account pass (observed accounts): judgment on mechanics, never voice, never reply text.",
  "Standing watch: print capacity and specialty-set cadence sentiment.",
];
