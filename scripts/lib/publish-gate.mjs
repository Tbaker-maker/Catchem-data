// Publish gate. Runs over every published read before publish (nightly) and in
// PR CI. Each rule names a bug class seen in a reads check. A single bad read
// is dropped with a logged reason; only systemic breakage fails the run.
import { flagLine } from "./copy-rules.mjs";

export const SHORT_MAX = 35; // same short window cap as the Price tile (#374)
export const VINTAGE_CUTOFF = "2003-06-01";
const DASH = /[\u2014\u2013]/g;
const CATEGORY_NAME = /^(?:Sealed )?Rating:|^(?:Illustration Rares?|Special Illustration Rares?|Ultra Rares?|Hyper Rares?|Booster Box(?:es)?|Elite Trainer Box(?:es)?)$/i;
export const RAW_CODE = /#[A-Z]{1,4}\/[A-Z]{2,}\b|\bare #[A-Za-z0-9/]+ at \$/;
const DUP_NUM = /(\d+\/\d+)\s*#\1\b/;
const CONDITION = /\b(?:NM|Near Mint|LP|Lightly Played|MP|Moderately Played|HP|Heavily Played|DMG|Damaged)\b/;
const COPY_FIELDS = ["name", "headline", "path", "blurb", "why", "whyItMatters", "whatWouldMakeThisWrong"];

export const RULES = [
  ["dash", "Em or en dash in copy (stripped, read kept)"],
  ["title", "Malformed title: category words as the name, a doubled card number, or a dash"],
  ["direction", "Headline direction disagrees with the Price tile or run stage over the same window"],
  ["window", "Price tile window longer than the short window cap"],
  ["fact-date", "Same high or low shown with two different dates"],
  ["stale", "Read dated before the latest nightly data for that product"],
  ["condition", "Condition label on a sealed product"],
  ["listings-zero", "Zero or missing listings counted shown"],
  ["image", "Image URL missing or malformed (field removed so the page falls back)"],
  ["era", "Vintage tag inconsistent with release date (Vintage is WOTC before 2003-06-01)"],
  ["repeat", "Same read as the previous day"],
  ["advice", "Advice wording from the shared copy rules"],
  ["tiles", "Priced card or sealed read with no flip tiles"],
  ["pattern-rate", "Pattern headline leads with a bare rate under 50%"],
];

const isSealed = (r) => r.kind === "sealed" || r.readKind === "sealed" || r.readKind === "listings" || r.kind === "listings" || /^\/p\//.test(r.href || "") || (r.sku && !/^tcgcsv-/.test(r.sku) && r.family === "listings");
const headDir = (s) => { const m = /\b(Up|Down|up|down|fell|rose)\b/.exec(String(s || "")); return m ? (/^(up|rose)$/i.test(m[1]) ? "up" : "down") : ""; };
const pricedProduct = (r) => {
  const price = Number(r?.price);
  if (!(price > 0)) return false;
  if (/price being checked/i.test(String(r?.headline || ""))) return false;
  const kind = String(r?.kind || r?.readKind || "");
  return kind === "single" || kind === "sealed" || kind === "listings" || kind === "move" || /^\/(?:c|p)\//.test(String(r?.href || ""));
};
const hasTiles = (chip) => {
  const t = chip?.tiles;
  return !!(t && typeof t === "object" && (t.data || t.price || t.listings));
};

function stripDashes(v) {
  if (typeof v === "string") return v.replace(/\s*[\u2014\u2013]\s*/g, (m) => (/\s/.test(m) ? ": " : "-"));
  if (Array.isArray(v)) return v.map(stripDashes);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = stripDashes(v[k]); return o; }
  return v;
}

// ctx: { chips (signal-chips byId), facts(id) -> facts doc|null, listings (id -> {date,n}), sets (name -> release), prev (id -> read from the previous day), asOf }

// A pattern headline whose first sentence is a bare percent under 50, and not an Nx lift.
// Price headlines such as "Down 17%" are not pattern copy, so they stay.
function bareLowPattern(read) {
  const head = String(read?.headline || "").trim();
  if (!head) return false;
  const first = head.split(/[!?]|\.(?:\s|$)/)[0].trim();
  if (/^\d+(?:\.\d+)?x\b/.test(first)) return false;
  const m = first.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m || !(Number(m[1]) < 50)) return false;
  const kind = String(read.readKind || read.kind || "");
  return /^pattern/i.test(kind) || /\b(were right|was right|past cases|normally|this pattern|pattern)\b/i.test(head);
}

export function checkRead(read, ctx = {}) {
  const flags = [];
  let r = read;
  if (DASH.test(JSON.stringify(r))) { DASH.lastIndex = 0; r = stripDashes(r); flags.push({ rule: "dash", action: "fix" }); }
  DASH.lastIndex = 0;
  const name = String(r.name || "");
  if (CATEGORY_NAME.test(name) || DUP_NUM.test(name)) flags.push({ rule: "title", action: "drop", note: name });
  else if (COPY_FIELDS.concat(["line"]).some((k) => typeof r[k] === "string" && RAW_CODE.test(r[k])) || (r.lines || []).some((l) => RAW_CODE.test(String(l)))) flags.push({ rule: "title", action: "drop", note: "raw card code instead of a name" });
  const chip = ctx.chips?.[r.id];
  const tile = chip?.tiles?.price;
  const hd = headDir(r.headline);
  const rw = Number(r.windowDays) || 0;
  if (tile && !tile.dash) {
    if (Number(tile.days) > Math.max(SHORT_MAX, rw + 3)) flags.push({ rule: "window", action: "drop", note: `${tile.days}D` });
    else if (hd && rw && Number(tile.days) === rw && tile.dir && tile.dir !== "flat" && tile.dir !== hd) flags.push({ rule: "direction", action: "drop", note: `headline ${hd}, tile ${tile.dir}` });
    const st = tile.stage;
    if (st && hd && rw === 7 && st.dir && st.dir !== hd && st.word === "Building") flags.push({ rule: "direction", action: "drop", note: `headline ${hd}, stage ${st.word} ${st.dir}` });
  }
  const between = r.receipt?.between;
  if (between?.date && ctx.facts) {
    const f = ctx.facts(r.id);
    for (const k of ["high", "low"]) {
      const x = f?.range?.[k];
      if (x && Number(x.price) === Number(between.price) && x.date !== between.date) flags.push({ rule: "fact-date", action: "drop", note: `${between.date} vs ${x.date}` });
    }
  }
  if ((r.readKind === "listings" || r.kind === "listings") && ctx.listings) {
    const lc = ctx.listings[r.sku];
    if (lc?.date && r.asOf && r.asOf < lc.date) flags.push({ rule: "stale", action: "drop", note: `${r.asOf} < ${lc.date}` });
  }
  if ((r.readKind === "listings" || r.kind === "listings") && !(Number(r.receipt?.n) > 0)) flags.push({ rule: "listings-zero", action: "drop" });
  if (isSealed(r)) {
    const text = COPY_FIELDS.map((k) => r[k]).concat(r.lines || [], r.tags || []).filter((s) => typeof s === "string").join(" \n ");
    if (CONDITION.test(text)) flags.push({ rule: "condition", action: "drop" });
  }
  if (r.image != null && r.image !== "" && !(typeof r.image === "string" && /^(https:\/\/|\/)[^\s"'<>]+$/.test(r.image))) {
    r = { ...r }; delete r.image; flags.push({ rule: "image", action: "fix" });
  }
  if ((r.tags || []).includes("Vintage") && ctx.sets) {
    const rel = ctx.sets[r.set];
    if (rel && rel >= VINTAGE_CUTOFF) flags.push({ rule: "era", action: "drop", note: `${r.set} ${rel}` });
  }
  const p = ctx.prev?.[r.id];
  const dated = r.endDate || r.readKind === "listings" || r.readKind === "sealed";
  if (dated && p && ctx.asOf && p.asOf && p.asOf < ctx.asOf && p.headline === r.headline && p.endDate === r.endDate) flags.push({ rule: "repeat", action: "drop" });
  for (const k of COPY_FIELDS) {
    const v = r[k];
    if (typeof v !== "string") continue;
    const hit = flagLine(v, { field: k, id: r.id });
    if (hit.length) { flags.push({ rule: "advice", action: "drop", note: hit[0].phrase }); break; }
  }
  for (const l of r.lines || []) { const hit = flagLine(l, { field: "lines", id: r.id }); if (hit.length) { flags.push({ rule: "advice", action: "drop", note: hit[0].phrase }); break; } }
  if (pricedProduct(r) && !hasTiles(chip)) flags.push({ rule: "tiles", action: "drop", note: "priced read with no tiles" });
  if (bareLowPattern(r)) flags.push({ rule: "pattern-rate", action: "drop", note: String(r.headline || "").slice(0, 80) });
  const drop = flags.some((f) => f.action === "drop");
  return { read: drop ? null : r, flags };
}

export function gateReads(reads, ctx = {}, { maxDropShare = 0.25 } = {}) {
  const kept = [], log = [];
  const counts = Object.fromEntries(RULES.map(([id]) => [id, 0]));
  for (const read of reads || []) {
    const { read: out, flags } = checkRead(read, ctx);
    for (const f of flags) { counts[f.rule] += 1; log.push({ id: read.id, ...f }); }
    if (out) kept.push(out);
  }
  const dropped = (reads?.length || 0) - kept.length;
  const systemic = reads?.length > 20 && dropped / reads.length > maxDropShare;
  return { kept, dropped, counts, log, systemic };
}
