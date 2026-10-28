// Per-item breakdown from that item's facts only.
// Lead signal + supporting signals pick both phrasing and section order, so two
// products with different stories do not share a template. Empty when nothing is backed.
// No hype, no advice words, no em/en dashes, no creator names, no NM on sealed.
import { banGuard } from "./copy-rules.mjs";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const day = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : "");
export const shortDay = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || "") ? `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}` : "");
export const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const absPct = (n) => Math.abs(Math.round(Number(n)));
const signed = (n) => `${Number(n) > 0 ? "+" : ""}${Math.round(Number(n) * 10) / 10}%`;

export const BANNED = banGuard("what we see", { house: true });

// Stable pick so the same item keeps the same phrasing night to night.
export function pick(id, key, options) {
  const list = Array.isArray(options) ? options.filter(Boolean) : [];
  if (!list.length) return "";
  const s = `${String(id || "")}|${String(key || "")}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return list[Math.abs(h) % list.length];
}

function clean(text) {
  const out = String(text || "").replace(/\s+/g, " ").trim();
  if (!out || BANNED.test(out) || /[\u2014\u2013]/.test(out)) return "";
  // Creator / Collectr names never appear in public breakdown copy.
  if (/\bcollectr\b/i.test(out)) return "";
  return out;
}

function spanDays(r) {
  if (!r?.from || !r?.now?.date) return 0;
  return (Date.parse(r.now.date) - Date.parse(r.from)) / 86400000;
}

function windowLabel(key) {
  return { d7: "7 days", d30: "30 days", d90: "90 days", y1: "a year" }[key] || key;
}


function collectSignals(f) {
  const id = f.item?.id || f.id || "";
  const sealed = f.item?.kind === "sealed" || f.kind === "sealed" || f.gap?.condition === "Sealed";
  const out = [];
  const r = f.range;
  const ch = f.change || {};
  const l = f.listings;
  const m = f.setMomentum;
  const g = f.gap;
  const rank = f.rank;
  const rot = f.rotation;
  const rip = f.rip;
  const span = spanDays(r);

  // At high.
  if (r && span >= 90 && r.daysSinceHigh === 0 && r.high?.date && r.high.date !== r.low?.date && day(r.from)) {
    const phrases = [
      `At its highest price in our history, which starts ${day(r.from)}.`,
      `New high on file: ${money(r.high.price)} on ${day(r.high.date)}, the top mark since ${day(r.from)}.`,
      `Tonight matches the high on file (${money(r.high.price)}), first reached ${day(r.high.date)}.`,
      `Sitting at the high of ${money(r.high.price)} across a history that starts ${day(r.from)}.`,
    ];
    out.push({
      kind: "at_high",
      score: 90,
      title: "At the high",
      note: `TCGplayer market, ${day(r.from)} to ${day(r.now?.date || f.asOf)}`,
      phrases,
      text: pick(id, "at_high", phrases),
    });
  }

  // Near low (within 5% of low, not also at high).
  if (r && span >= 90 && r.daysSinceHigh !== 0 && r.low?.price > 0 && r.now?.price > 0) {
    const fromLow = ((r.now.price - r.low.price) / r.low.price) * 100;
    if (fromLow >= 0 && fromLow <= 5 && day(r.low.date)) {
      const phrases = fromLow < 0.5 ? [
        `At its low on file: ${money(r.now.price)} on ${day(r.now.date)}, matching ${day(r.low.date)}.`,
        `Tonight is the low on file at ${money(r.low.price)} (also ${day(r.low.date)}).`,
        `Low on file tonight: ${money(r.now.price)}, first printed ${day(r.low.date)}.`,
      ] : [
        `Near its low on file: ${money(r.now.price)} tonight vs ${money(r.low.price)} on ${day(r.low.date)}.`,
        `Within ${Math.round(fromLow)}% of the low of ${money(r.low.price)} set on ${day(r.low.date)}.`,
        `Close to the floor: low ${money(r.low.price)} (${day(r.low.date)}), now ${money(r.now.price)}.`,
      ];
      out.push({
        kind: "near_low",
        score: 88,
        title: "Near the low",
        note: `TCGplayer market, ${day(r.from)} to ${day(r.now.date)}`,
        phrases,
        text: pick(id, "near_low", phrases),
      });
    }
  }

  // Drawdown from high.
  if (r && span >= 90 && Number.isFinite(r.fromHighPct) && r.fromHighPct <= -20 && r.daysSinceHigh > 0 && day(r.high.date)) {
    const n = absPct(r.fromHighPct);
    const hi = money(r.high.price);
    const when = day(r.high.date);
    const ago = r.daysSinceHigh;
    const phrases = [
      `${n}% under its high of ${hi} on ${when}, ${ago} days ago.`,
      `Off ${n}% from the high of ${hi} (${when}), now ${ago} days later.`,
      `The high was ${hi} on ${when}. Tonight is ${n}% under that mark after ${ago} days.`,
      `${ago} days after the ${hi} high (${when}), the market sits ${n}% lower.`,
    ];
    // Fresher highs score higher; deep cuts also score high.
    const freshness = ago <= 60 ? 20 : ago <= 180 ? 10 : 0;
    const depth = n >= 50 ? 15 : n >= 35 ? 8 : 0;
    out.push({
      kind: "drawdown",
      score: 70 + depth + freshness,
      title: "From the high",
      note: `TCGplayer market, ${day(r.from)} to ${day(r.now?.date || f.asOf)}`,
      phrases,
      text: pick(id, "drawdown", phrases),
    });
  }

  // Window moves: prefer the most extreme available window.
  for (const [key, minAbs, base] of [["d7", 8, 55], ["d30", 10, 65], ["d90", 15, 60], ["y1", 20, 58]]) {
    const c = ch[key];
    if (!c || !Number.isFinite(c.pct) || Math.abs(c.pct) < minAbs || !day(c.from)) continue;
    const label = windowLabel(key);
    const phrases = [
      `${c.pct > 0 ? "Up" : "Down"} ${absPct(c.pct)}% over ${label}, ${day(c.from)} to ${day(c.to)}.`,
      `TCGplayer market ${c.pct > 0 ? "rose" : "fell"} ${absPct(c.pct)}% from ${day(c.from)} to ${day(c.to)} (${label}).`,
      `${absPct(c.pct)}% ${c.pct > 0 ? "higher" : "lower"} across ${label}: ${money(c.p0)} on ${day(c.from)}, ${money(c.p1)} on ${day(c.to)}.`,
      `From ${day(c.from)} to ${day(c.to)} the market moved ${signed(c.pct)} over ${label}.`,
    ];
    out.push({
      kind: `move_${key}`,
      score: base + Math.min(25, Math.abs(c.pct) / 2),
      title: key === "y1" ? "One-year move" : `${label[0].toUpperCase()}${label.slice(1)} move`,
      note: `TCGplayer market, ${day(c.from)} to ${day(c.to)}`,
      phrases,
      text: pick(id, `move_${key}`, phrases),
      pct: c.pct,
      window: key,
    });
  }

  // Window contrast: short vs longer disagreeing in direction or magnitude.
  if (ch.d7 && ch.d30 && day(ch.d7.from) && day(ch.d30.from)) {
    const a = ch.d7.pct;
    const b = ch.d30.pct;
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) >= 5 && Math.abs(b) >= 8 && (a * b < 0 || Math.abs(Math.abs(a) - Math.abs(b)) >= 12)) {
      const phrases = [
        `Last 7 days ${signed(a)} (${shortDay(ch.d7.from)} to ${shortDay(ch.d7.to)}), while 30 days sits at ${signed(b)} (${shortDay(ch.d30.from)} to ${shortDay(ch.d30.to)}).`,
        `Short window and 30-day window split: ${signed(a)} over 7 days vs ${signed(b)} over 30 days.`,
        `7-day move ${signed(a)} against a 30-day ${signed(b)}, dates ${shortDay(ch.d7.from)}/${shortDay(ch.d30.from)} to ${shortDay(ch.d7.to)}.`,
      ];
      out.push({
        kind: "window_contrast",
        score: 72,
        title: "Windows disagree",
        note: "TCGplayer market",
        phrases,
        text: pick(id, "window_contrast", phrases),
      });
    }
  }

  // Listings counted shift.
  if (l && Number.isFinite(l.pct) && Math.abs(l.pct) >= 15 && l.prev > 0 && day(l.date) && day(l.prevDate)) {
    const up = l.pct > 0;
    const phrases = [
      `Listings counted went from ${l.prev} on ${day(l.prevDate)} to ${l.n} on ${day(l.date)}.`,
      `Listings counted ${up ? "rose" : "fell"} ${absPct(l.pct)}% from ${l.prev} (${day(l.prevDate)}) to ${l.n} (${day(l.date)}).`,
      `${l.prev} listings counted on ${day(l.prevDate)}, then ${l.n} on ${day(l.date)} (${signed(l.pct)}).`,
      `eBay listings counted moved ${signed(l.pct)} over ${l.span || "those"} days: ${l.prev} to ${l.n}.`,
    ];
    out.push({
      kind: "listings",
      score: 68 + Math.min(20, Math.abs(l.pct) / 3),
      title: "Listings counted",
      note: `eBay listings counted, ${day(l.prevDate)} to ${day(l.date)}. Listings are not sales.`,
      phrases,
      text: pick(id, "listings", phrases),
    });
  }

  // Item vs set momentum divergence.
  if (m && Number.isFinite(m.pct) && ch.d30 && Number.isFinite(ch.d30.pct) && day(m.from) && day(ch.d30.from)) {
    const diff = ch.d30.pct - m.pct;
    if (Math.abs(diff) >= 12 && Math.abs(ch.d30.pct) >= 8) {
      const ahead = diff > 0;
      const phrases = [
        `This item ${ahead ? "outran" : "trailed"} its set over 30 days: ${signed(ch.d30.pct)} vs the ${m.kind || "singles"} index at ${signed(m.pct)} (${shortDay(m.from)} to ${shortDay(m.to)}).`,
        `30-day item move ${signed(ch.d30.pct)} against ${m.set || "its set"} ${m.kind || "singles"} index ${signed(m.pct)}.`,
        `${m.set || "Set"} ${m.kind || "singles"} index ${signed(m.pct)} while this product printed ${signed(ch.d30.pct)} over the same window.`,
      ];
      out.push({
        kind: "vs_set",
        score: 74 + Math.min(15, Math.abs(diff) / 2),
        title: "Against the set",
        note: `TCGplayer market, ${day(m.from)} to ${day(m.to)}`,
        phrases,
        text: pick(id, "vs_set", phrases),
      });
    }
  }

  // eBay ask vs TCGplayer gap (no NM label on sealed).
  if (g && g.ebay > 0 && g.tcg > 0 && Number.isFinite(g.pct) && Math.abs(g.pct) >= 8 && day(g.ebayDate)) {
    const phrases = sealed
      ? [
          `Median ask ${money(g.ebay)} vs TCGplayer market ${money(g.tcg)} (${signed(g.pct)}), ${day(g.ebayDate)}.`,
          `eBay median ask sits ${absPct(g.pct)}% ${g.pct > 0 ? "above" : "under"} the TCGplayer market on ${day(g.ebayDate)}.`,
          `Ask ${money(g.ebay)} against market ${money(g.tcg)} on ${day(g.ebayDate)} (${signed(g.pct)}).`,
        ]
      : [
          `eBay ask ${money(g.ebay)} vs TCGplayer ${money(g.tcg)} (${signed(g.pct)}), ${day(g.ebayDate)}.`,
          `The eBay ask is ${absPct(g.pct)}% ${g.pct > 0 ? "above" : "under"} TCGplayer on ${day(g.ebayDate)}.`,
          `Ask ${money(g.ebay)} against TCGplayer ${money(g.tcg)} (${day(g.ebayDate)}).`,
        ];
    out.push({
      kind: "gap",
      score: 62 + Math.min(18, Math.abs(g.pct) / 2),
      title: sealed ? "Ask vs market" : "eBay ask vs TCGplayer",
      note: sealed ? `eBay listings counted and TCGplayer market, ${day(g.ebayDate)}` : `eBay ask and TCGplayer market, ${day(g.ebayDate)}`,
      phrases,
      text: pick(id, "gap", phrases),
    });
  }

  // Rank in set (top or notable).
  if (rank && rank.rank > 0 && rank.of > 5 && day(rank.asOf)) {
    if (rank.rank === 1) {
      const phrases = [
        `No. 1 of ${rank.of} by price in ${rank.set}, as of ${day(rank.asOf)}.`,
        `Top price in ${rank.set} tonight among ${rank.of} priced cards (${day(rank.asOf)}).`,
        `Leads ${rank.set} by market price: rank 1 of ${rank.of} on ${day(rank.asOf)}.`,
      ];
      out.push({ kind: "rank", score: 64, title: "Set rank", note: `TCGplayer market, ${day(rank.asOf)}`, phrases, text: pick(id, "rank1", phrases) });
    } else if (rank.rank <= 3 || rank.rank / rank.of <= 0.05) {
      const phrases = [
        `No. ${rank.rank} of ${rank.of} by price in ${rank.set}, as of ${day(rank.asOf)}.`,
        `Among the top prices in ${rank.set}: rank ${rank.rank} of ${rank.of} on ${day(rank.asOf)}.`,
      ];
      out.push({ kind: "rank", score: 50, title: "Set rank", note: `TCGplayer market, ${day(rank.asOf)}`, phrases, text: pick(id, "rank", phrases) });
    }
  }

  // Rotation (factual mark/status only).
  if (rot && (rot.mark || rot.status) && day(rot.asOf)) {
    const mark = rot.mark ? `Mark ${rot.mark}` : "";
    const status = rot.status ? String(rot.status) : "";
    const label = [mark, status].filter(Boolean).join(", ");
    const phrases = [
      `Rotation file: ${label}, as of ${day(rot.asOf)}.`,
      `${label} in the rotation file dated ${day(rot.asOf)}.`,
    ];
    out.push({
      kind: "rotation",
      score: /rotated|previous/i.test(status) ? 58 : 40,
      title: "Rotation",
      note: `Rotation status, ${day(rot.asOf)}`,
      phrases,
      text: pick(id, "rotation", phrases),
    });
  }

  // Rip value for sealed.
  if (sealed && rip && rip.contentsEV > 0 && rip.price > 0 && day(rip.asOf)) {
    const phrases = [
      `Expected contents ${money(rip.contentsEV)} vs ${money(rip.price)} sealed (${signed(rip.roiPct)}), as of ${day(rip.asOf)}.`,
      `Rip math on file: contents ${money(rip.contentsEV)}, sealed ${money(rip.price)} (${signed(rip.roiPct)}), ${day(rip.asOf)}.`,
    ];
    out.push({
      kind: "rip",
      score: 66,
      title: "Rip value",
      note: `History-based estimate from dated pull rates, ${day(rip.asOf)}. Not advice`,
      phrases,
      text: pick(id, "rip", phrases),
    });
  }

  // Flat / quiet when nothing else strong.
  if (ch.d30 && Number.isFinite(ch.d30.pct) && Math.abs(ch.d30.pct) < 5 && day(ch.d30.from)) {
    const phrases = [
      `Mostly flat over 30 days: ${signed(ch.d30.pct)} from ${day(ch.d30.from)} to ${day(ch.d30.to)}.`,
      `Little net move over 30 days (${signed(ch.d30.pct)}, ${day(ch.d30.from)} to ${day(ch.d30.to)}).`,
      `30-day market change stays inside 5%: ${signed(ch.d30.pct)} between ${day(ch.d30.from)} and ${day(ch.d30.to)}.`,
    ];
    out.push({
      kind: "flat",
      score: 25,
      title: "Quiet window",
      note: `TCGplayer market, ${day(ch.d30.from)} to ${day(ch.d30.to)}`,
      phrases,
      text: pick(id, "flat", phrases),
    });
  }

  return out
    .map((s) => ({ ...s, text: clean(s.text) }))
    .filter((s) => s.text);
}

function family(kind) {
  if (kind.startsWith("move_")) return "move";
  if (kind === "drawdown" || kind === "at_high" || kind === "near_low") return "range";
  return kind;
}

export function buildBreakdown(f) {
  if (!f || typeof f !== "object") return { line: "", sections: [], order: [] };
  const signals = collectSignals(f).sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind));
  if (!signals.length) return { line: "", sections: [], order: [] };

  const picked = [];
  const seen = new Set();
  for (const s of signals) {
    const fam = family(s.kind);
    if (seen.has(fam)) continue;
    // Prefer at most one move_* window in the lead pair.
    seen.add(fam);
    picked.push(s);
    if (picked.length >= 3) break;
  }

  // Line = lead (+ support when it adds a different family).
  const lineParts = [picked[0].text];
  if (picked[1] && family(picked[1].kind) !== family(picked[0].kind)) lineParts.push(picked[1].text);
  const line = clean(lineParts.join(" "));
  if (!line) return { line: "", sections: [], order: [] };

  const sections = picked.map((s) => ({
    id: s.kind,
    title: s.title,
    text: s.text,
    note: s.note || "",
  }));
  // Panel order: lead families first, then remaining high-score signals of other families.
  const order = [];
  const orderSeen = new Set();
  for (const s of [...picked, ...signals]) {
    const fam = family(s.kind);
    // Map to site card ids used by factCards.
    const cardId =
      fam === "range" ? "range"
        : fam === "listings" ? "listings"
          : fam === "vs_set" || s.kind === "move_d30" && f.setMomentum ? "momentum"
            : fam === "gap" ? "gap"
              : fam === "rip" ? "rip"
                : fam === "rotation" ? "rotation"
                  : fam === "rank" ? "rank"
                    : fam === "move" ? "change"
                      : fam;
    if (orderSeen.has(cardId)) continue;
    orderSeen.add(cardId);
    order.push(cardId);
  }
  // Always allow the usual cards after the lead ones.
  for (const id of ["range", "change", "listings", "momentum", "gap", "rip", "rotation", "rank", "pattern", "rarity", "variants", "similar"]) {
    if (!orderSeen.has(id)) order.push(id);
  }

  return { line, sections, order, lead: picked[0].kind };
}

export function whatWeSee(f) {
  return buildBreakdown(f).line;
}

// Digit-stripped shape for uniqueness tests.
export function breakdownShape(text) {
  return String(text || "")
    .replace(/\$[\d,]+(?:\.\d+)?/g, "$")
    .replace(/\b\d+(?:\.\d+)?%?/g, "N")
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+N(?:,\s+N)?/g, "DATE")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function shapeTokens(text) {
  return new Set(breakdownShape(text).split(/[^a-z$]+/).filter((t) => t && t !== "n"));
}

export function shapeSimilarity(a, b) {
  const A = shapeTokens(a);
  const B = shapeTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}
