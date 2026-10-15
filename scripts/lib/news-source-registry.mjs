// Trust tiers and logged robots / terms checks. A failed check drops the source.
// This does not fetch a page and does not try to get past a block.

export const TIERS = ["Official", "Confirmed", "Unconfirmed"];

export function robotsDecision(text, path = "/") {
  const raw = String(text || "");
  if (!raw.trim()) return { checked: false, allowed: null, reason: "no robots text logged" };
  let star = false;
  let sawStar = false;
  const rules = [];
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const agent = trimmed.match(/^user-agent:\s*(.+)$/i);
    if (agent) {
      star = agent[1].trim() === "*";
      if (star) sawStar = true;
      continue;
    }
    if (!star) continue;
    const disallow = trimmed.match(/^disallow:\s*(.*)$/i);
    const allow = trimmed.match(/^allow:\s*(.*)$/i);
    if (disallow) rules.push({ allow: false, path: disallow[1].trim() });
    if (allow) rules.push({ allow: true, path: allow[1].trim() });
  }
  if (!sawStar) return { checked: true, allowed: null, reason: "no rules for every agent" };
  let best = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    if (path.startsWith(rule.path) && (!best || rule.path.length >= best.path.length)) best = rule;
  }
  if (!best) return { checked: true, allowed: true, reason: "no matching disallow" };
  return { checked: true, allowed: best.allow, reason: best.allow ? "allow matches" : "disallow matches" };
}

const TERMS_BLOCK = /no automated|do not (?:scrape|crawl)|must not (?:scrape|crawl)|forbidden to (?:scrape|crawl)|without prior written consent/i;

export function termsDecision(text) {
  const raw = String(text || "");
  if (!raw.trim()) return { checked: false, allowed: null, reason: "no terms text logged" };
  if (TERMS_BLOCK.test(raw)) return { checked: true, allowed: false, reason: "terms do not allow automated reading" };
  return { checked: true, allowed: true, reason: "logged terms do not forbid automated reading" };
}

export function reviewSource(source, { robotsText = "", termsText = "", path = "/", checkedAt = "" } = {}) {
  const tier = TIERS.includes(source?.tier) ? source.tier : "Unconfirmed";
  const robots = robotsDecision(robotsText, path);
  const terms = termsDecision(termsText);
  const dropped = robots.allowed === false || terms.allowed === false;
  let dropReason = "";
  if (robots.allowed === false) dropReason = robots.reason;
  else if (terms.allowed === false) dropReason = terms.reason;
  return {
    id: source?.id || source?.name || "",
    name: source?.name || source?.id || "",
    tier,
    checkedAt,
    robots,
    terms,
    dropped,
    dropReason,
  };
}

export function applyRegistry(items, reviews) {
  const dropped = new Set((reviews || []).filter((row) => row.dropped).map((row) => row.name));
  const kept = [];
  const removed = [];
  for (const item of items || []) {
    if (dropped.has(item.source)) removed.push(item);
    else kept.push(item);
  }
  return { kept, removed };
}
