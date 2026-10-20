// Interest order for the feed lead. No cutoff numbers live here.
// A missing dollar side or a quiet kind scores nothing, so it cannot open the feed.

const QUIET_KINDS = new Set(["news", "newsline", "wave", "pokemon", "rotation", "release"]);
const MOVE_KINDS = new Set(["single", "sealed", "plain", "streak", "mover", "solddown", "soldflat", "askmove", "mktmove", "turned", "mixed", "year", "year-ago", "season", "pattern-forming", "pattern-ending", "sealedchase", "high", "backto"]);
const FLOOR_KINDS = new Set(["solddown", "soldflat", "single", "plain", "askmove", "mktmove", "streak", "mover", "turned", "mixed"]);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pair(a, b) {
  const x = num(a);
  const y = num(b);
  return x != null && y != null ? [x, y] : null;
}

export function readMove(read) {
  const rec = read && read.receipt && typeof read.receipt === "object" ? read.receipt : {};
  let got = null;
  if (typeof rec.from !== "string" && typeof rec.to !== "string") got = pair(rec.from, rec.to);
  if (!got) got = pair(rec.fromPrice, rec.toPrice);
  if (!got && rec.then && typeof rec.then === "object") got = pair(rec.then.price, rec.now && rec.now.price);
  if (!got && rec.start && typeof rec.start === "object") got = pair(rec.start.price, rec.end && rec.end.price);
  if (!got) got = pair(rec.askFrom, rec.askTo);
  if (!got) got = pair(rec.marketFrom, rec.marketTo);
  if (!got) got = pair(rec.sealedFrom, rec.sealedTo);
  if (!got) got = pair(rec.chaseFrom, rec.chaseTo);
  let from = got ? got[0] : 0;
  let to = got ? got[1] : 0;
  let price = num(read && read.price);
  if (!(price > 0) && to > 0) price = to;
  if (!(price > 0) && rec.now && typeof rec.now === "object") price = num(rec.now.price);
  if (!(price > 0)) price = num(rec.now);
  if (!(price > 0)) price = num(rec.price);
  let dollars = from > 0 && to > 0 ? Math.abs(to - from) : 0;
  let pct = Math.abs(num(read && read.changePct) || 0);
  if (!(pct > 0) && from > 0 && dollars > 0) pct = Math.abs((to - from) / from) * 100;
  if (!(pct > 0)) pct = Math.abs(num(rec.pct) || num(rec.week) || 0);
  function textMove(text) {
    const s = String(text || "");
    if (!s) return null;
    const mv = s.match(/\$(\d[\d,]*(?:\.\d+)?)[^$]{0,48}?\bto\b[^$]{0,24}?\$(\d[\d,]*(?:\.\d+)?)/i);
    if (!mv) return null;
    const tf = Number(mv[1].replace(/,/g, ""));
    const tt = Number(mv[2].replace(/,/g, ""));
    if (!(tf > 0) || !(tt > 0)) return null;
    let tp = 0;
    const pm = s.match(/(?:Up|Down|\()\s*([+-]?\d+(?:\.\d+)?)\s*%/i);
    if (pm) tp = Math.abs(Number(pm[1]));
    return { from: tf, to: tt, dollars: Math.abs(tt - tf), pct: tp };
  }
  const kind = String((read && (read.readKind || read.kind)) || "");
  const moveKind = MOVE_KINDS.has(kind) || /^move-/.test(String((read && read.id) || ""));
  let told = textMove(read && read.headline);
  if (!told || !(told.pct > 0)) {
    const alt = textMove(read && read.path);
    if (alt && (alt.pct > 0 || !told)) told = alt;
  }
  if (told && (!(from > 0) || !(to > 0)) && (pct > 0 || told.pct > 0 || moveKind)) {
    from = told.from;
    to = told.to;
    if (!(dollars > 0)) dollars = told.dollars;
    if (!(pct > 0) && told.pct > 0) pct = told.pct;
    if (!(pct > 0) && from > 0) pct = Math.abs((to - from) / from) * 100;
  }
  if (!(price > 0) && to > 0) price = to;
  return { price: price > 0 ? price : 0, dollars, pct, from, to };
}

export function interestScore(read) {
  if (!read || typeof read !== "object") return 0;
  const kind = String(read.readKind || read.kind || "");
  if (QUIET_KINDS.has(kind)) return 0;
  const m = readMove(read);
  if (!(m.dollars > 0) || !(m.pct > 0)) return 0;
  let score = m.dollars * m.pct;
  if (m.price > 0) score += Math.log10(m.price + 1) * Math.max(m.pct, 1);
  const tags = Array.isArray(read.tags) ? read.tags.join(" ") : "";
  const sealed = kind === "sealed" || kind === "listings" || kind === "rip" || kind === "sealedchase" || /^\/p\//.test(String(read.href || ""));
  const chase = /illustration rare|special illustration|hyper rare|secret rare/i.test(tags) || kind === "sealedchase";
  if (sealed) score *= 1.35;
  if (chase) score *= 1.15;
  const strength = (Array.isArray(read.signals) ? read.signals : []).reduce((max, s) => Math.max(max, Number(s && s.strength) || 0), 0);
  if (strength) score *= 1 + strength / 20;
  if (!MOVE_KINDS.has(kind) && !/^move-/.test(String(read.id || ""))) score *= 0.15;
  return score;
}

// True when a price-move read is a cheap card with a tiny dollar move.
// No config means no opinion: the caller does not invent a cutoff.
export function lowValueMove(read, cfg) {
  if (!cfg || !read) return false;
  const cheap = Number(cfg.maxCheapPrice);
  const tiny = Number(cfg.maxCheapMove);
  if (!(cheap > 0) || !(tiny > 0)) return false;
  const kind = String(read.readKind || read.kind || "");
  if (!FLOOR_KINDS.has(kind) && !/^move-/.test(String(read.id || ""))) return false;
  const m = readMove(read);
  if (!(m.price > 0)) return false;
  return m.price < cheap && m.dollars < tiny;
}

export function leadIds(reads, cfg, n = 8) {
  const rows = (reads || []).filter((row) => row && row.id && !lowValueMove(row, cfg));
  rows.sort((a, b) => interestScore(b) - interestScore(a) || String(a.id).localeCompare(String(b.id)));
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const id = String(row.id);
    if (seen.has(id) || !(interestScore(row) > 0)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= n) break;
  }
  return out;
}
