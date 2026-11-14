// Last pass on reads.json, after the board, variant tags, and the trend line.
// Puts the full collector number on every card name we can point at a bucket
// row, marks TCGplayer amounts Near Mint, and labels eBay asks. Does not
// invent a number: a card with no num on the bucket is left unnamed.
import { banGuard } from "./copy-rules.mjs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  barLabel,
  cardTitle,
  cleanCardName,
  fullNumber,
  hasNumber,
  labelPrices,
  priceRecord,
  CONDITION_NOTE,
} from "./card-face.mjs";
import { boardImage, loadBoardImageInputs, BRAND_TILE, pictureForRead } from "./read-library.mjs";
import { speciesToken } from "./fact-reads.mjs";

const BANNED = banGuard("card face stamp");
const EM = /[\u2014\u2013]/;
const SKIP_KIND = new Set(["pokemon"]);

function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function shortSet(set) {
  return String(set || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
}

function wordHas(hay, needle) {
  const h = norm(hay);
  const n = norm(needle);
  if (!n || n.length < 3) return false;
  let i = 0;
  while ((i = h.indexOf(n, i)) >= 0) {
    const before = i > 0 ? h[i - 1] : "";
    const after = h[i + n.length] || "";
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    i += n.length;
  }
  return false;
}

function safeChange(before, after) {
  if (after === before) return after;
  if (EM.test(after) && !EM.test(before)) return before;
  if (BANNED.test(after) && !BANNED.test(before)) return before;
  if (after.includes("@@ASK")) return before;
  return after;
}

export async function loadFaceIndex(root) {
  const dir = join(root, "research/assets/public/buckets");
  let files = [];
  try { files = (await readdir(dir)).filter((f) => /^\d\d\.json$/.test(f)).sort(); } catch { files = []; }
  const cards = [];
  const byId = new Map();
  const bySet = new Map();
  const byArtist = new Map();
  const bySpecies = new Map();
  const push = (map, key, card) => {
    const k = norm(key);
    if (!k || k.length < 3) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(card);
  };
  for (const f of files) {
    let rows = [];
    try { rows = JSON.parse(await readFile(join(dir, f), "utf8")); } catch { continue; }
    for (const r of rows) {
      if (!r || r.kind !== "single" || !r.id) continue;
      const card = {
        id: String(r.id),
        name: String(r.name || ""),
        number: fullNumber(r.num || ""),
        set: String(r.set || ""),
        setShort: shortSet(r.set || ""),
        artist: String(r.artist || ""),
        rarity: String(r.rarity || ""),
      };
      card.clean = cleanCardName(card.name);
      const base = baseName(card.clean);
      if (base !== card.clean) card.base = base;
      cards.push(card);
      byId.set(card.id, card);
      push(bySet, card.set, card);
      push(bySet, card.setShort, card);
      push(byArtist, card.artist, card);
      const species = speciesToken(card.name);
      if (species) push(bySpecies, species, card);
    }
  }
  return { cards, byId, bySet, byArtist, bySpecies };
}

// "Latios EX (113 Full Art)" is written "Latios EX ... 113/116" in a read. The
// base name lets that line find its own card, but only when the written
// collector number confirms it.
export function baseName(clean) {
  return String(clean || "").replace(/\s*\(\d+[A-Za-z]?(?:\s[^)]*)?\)\s*$/, "").trim();
}

// A set number ("113/116") or a subset or promo code ("SL5", "SWSH006",
// "SM168", "TG05", "H22").
const NUMBER = "[A-Z]*\\d+[a-z]?\\/[A-Z]*\\d+|[A-Z]{1,5}\\d+[a-z]?";

// The collector number written right after a card name, past any variant or
// set tags: "Latios EX (Plasma Freeze) 113/116" gives 113/116, "Ho-Oh (Call of
// Legends) SL5" gives SL5, "Rillaboom - SWSH006 [Staff]" gives SWSH006.
function writtenNumber(text, end) {
  const m = String(text || "").slice(end).match(new RegExp(`^(?:\\s+${VARIANT})*(?:\\s*\\([^)]+\\))*(?:\\s+-)?\\s+(${NUMBER})(?![\\w/])`));
  return m ? m[1] : "";
}

// The number as its own token, so "7" is not found inside "$248.72".
function tokenHas(text, num) {
  const n = String(num || "");
  if (!n) return true;
  const s = String(text || "");
  let i = 0;
  while ((i = s.indexOf(n, i)) >= 0) {
    // "Rayquaza - 016/110" already carries 16/110.
    let j = i;
    while (j > 0 && s[j - 1] === "0") j -= 1;
    const before = j > 0 ? s[j - 1] : "";
    const after = s[i + n.length] || "";
    if (!/[\w/.$]/.test(before) && !/[\w/]/.test(after) && !(after === "." && /\d/.test(s[i + n.length + 1] || ""))) return true;
    i += n.length;
  }
  return false;
}

function idsOf(read) {
  const ids = [];
  const add = (v) => {
    const s = String(v || "");
    if (s && !ids.includes(s)) ids.push(s);
  };
  add(read.sku);
  add(read.cardId);
  const rec = read.receipt || {};
  add(rec.lead?.id);
  add(rec.chaseId);
  add(rec.id);
  const cards = Array.isArray(rec.cards) ? rec.cards : [];
  for (const c of cards) add(c && typeof c === "object" ? c.id : c);
  const ups = Array.isArray(rec.up) ? rec.up : [];
  for (const u of ups) add(u && typeof u === "object" ? u.id : "");
  return ids;
}

function poolFor(read, index) {
  const map = new Map();
  const add = (list) => { for (const c of list || []) if (c) map.set(c.id, c); };
  for (const id of idsOf(read)) add([index.byId.get(id)]);
  const kind = read.deep || read.readKind || "";
  if (kind === "artist") add(index.byArtist.get(norm(read.name)));
  if (kind === "printings" || kind === "samelabel" || kind === "pokemon") add(index.bySpecies.get(norm(speciesToken(read.name) || read.name)));
  const blob = [read.name, read.headline, read.path, ...(read.lines || []), ...(read.variants || [])].join("\n");
  for (const [key, list] of index.bySet) {
    if (wordHas(blob, key)) add(list);
  }
  if (map.size < 8 && (kind === "chase" || kind === "set" || kind === "bigyear")) {
    add(index.bySet.get(norm(read.name)));
  }
  return [...map.values()];
}

// The card's name before any tag: "Ho-Oh (Shiny)" gives "Ho-Oh", "Rillaboom -
// SWSH006 (Prerelease) [Staff]" gives "Rillaboom".
function stem(clean) {
  return String(clean || "").replace(/\s+-\s.*$/, "").replace(/\s*[([].*$/, "").trim();
}

function insideParens(text, i) {
  let depth = 0;
  for (let k = 0; k < i; k += 1) {
    if (text[k] === "(") depth += 1;
    else if (text[k] === ")" && depth > 0) depth -= 1;
  }
  return depth > 0;
}

function tags(text) {
  return (String(text || "").match(/\[[^\]]+\]/g) || []).map((t) => t.toLowerCase());
}

const MECHANIC = /^ (?:EX|ex|GX|V|VMAX|VSTAR|V-UNION|LV\.X|Lv\.X|BREAK|Prime|LEGEND|Star|Prism Star|δ)(?![A-Za-z0-9])/;

function occurrences(text, pool) {
  const found = [];
  for (const card of pool) {
    if (!card.number) continue;
    const names = [[card.clean, false]];
    if (card.base && card.base !== card.clean) names.push([card.base, true]);
    for (const [clean, viaBase] of names) {
      if (!clean || clean.length < 3) continue;
      let i = 0;
      while ((i = text.indexOf(clean, i)) >= 0) {
        const before = i > 0 ? text[i - 1] : "";
        const after = text[i + clean.length] || "";
        // "Primal Kyogre" inside "Primal Kyogre EX" is a different card, and a
        // name inside a set tag ("Rayquaza ex (EX Deoxys)") is not a card.
        const tail = text.slice(i + clean.length, i + clean.length + 12);
        if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after) && !MECHANIC.test(tail) && !insideParens(text, i)) {
          found.push({ i, end: i + clean.length, card, viaBase });
        }
        i += Math.max(1, clean.length);
      }
    }
  }
  found.sort((a, b) => (b.end - b.i) - (a.end - a.i) || a.i - b.i);
  const taken = [];
  const chosen = [];
  for (const hit of found) {
    if (taken.some((t) => !(hit.end <= t.i || hit.i >= t.end))) continue;
    const same = found.filter((o) => o.i === hit.i && o.end === hit.end);
    const written = writtenNumber(text, hit.end);
    // A number already written after the name decides the card. With none, a
    // base name alone is not enough to name a variant printing.
    let fits = written ? same.filter((o) => o.card.number === written) : same.filter((o) => !o.viaBase);
    if (!fits.length && written) {
      // "Ho-Oh ... SL5" is Ho-Oh (Shiny), not plain Ho-Oh: a printing of the
      // same name that carries the written number.
      fits = pool
        .filter((c) => c.number === written)
        .map((card) => {
          const st = stem(card.clean);
          const i = hit.end - st.length;
          if (st.length < 3 || i < 0 || text.slice(i, hit.end) !== st || /[A-Za-z0-9]/.test(text[i - 1] || "")) return null;
          return { ...hit, i, card };
        })
        .filter(Boolean);
      if (fits.length && taken.some((t) => !(hit.end <= t.i || fits[0].i >= t.end))) fits = [];
    }
    if (!fits.length) {
      // The name is followed by a number no card here carries. Leave the span
      // alone: a shorter name inside it ("Pikachu" in "Pikachu & Zekrom GX")
      // is a different card.
      if (written) taken.push(hit);
      continue;
    }
    const uniq = [];
    const seen = new Set();
    for (const o of fits) if (!seen.has(o.card.id)) { seen.add(o.card.id); uniq.push(o.card); }
    const after = text.slice(hit.end, hit.end + 80);
    let card = uniq.length === 1 ? uniq[0] : null;
    if (!card) {
      // "Rillaboom - SWSH006 [Staff]" is the staff stamp, not the plain one.
      const seg = after.slice(0, Math.max(0, after.search(/[:,]|$/)));
      const want = tags(seg);
      const byTag = uniq.filter((c) => {
        const have = tags(c.clean);
        return have.length === want.length && have.every((t) => want.includes(t));
      });
      if (byTag.length === 1 && byTag.length < uniq.length) card = byTag[0];
    }
    if (!card) {
      const byNum = uniq.filter((c) => c.number && after.includes(c.number));
      const bySet = uniq.filter((c) => c.setShort && wordHas(after, c.setShort));
      const byR = (bySet.length ? bySet : uniq).filter((c) => c.rarity && after.includes(c.rarity));
      if (byNum.length === 1) card = byNum[0];
      else if (bySet.length === 1) card = bySet[0];
      else if (byR.length === 1) card = byR[0];
    }
    if (!card) continue;
    const at = fits.find((o) => o.card === card) || hit;
    taken.push(at);
    chosen.push({ ...at, card });
  }
  return chosen;
}

const VARIANT = "(?:Special Illustration Rare|Illustration Rare|Tag Team \\(Alternate Art\\)|Alternate Art|Trainer Gallery|Galarian Gallery|Full Art|Secret Rare)";

function isSpeciesCountLine(text) {
  return /^Number\s+\d+\s+of\s+\d+\s+.+\s+cards we price/i.test(String(text || "").trim());
}

function placeNumbers(text, pool, prefer, subject) {
  const body = String(text || "");
  if (!body || !pool.length) return { text: body, cards: [] };
  // A species count line is about the group, not one printing. Stamping any
  // collector number there (especially a different Umbreon) is wrong.
  if (isSpeciesCountLine(body)) return { text: body, cards: [] };
  // A group read's own subject ("Every Pikachu card we price") is the group,
  // not one card, unless a collector number is written right after it.
  const hits = occurrences(body, pool)
    .filter((h) => !(subject && body.slice(h.i, h.end) === subject && !writtenNumber(body, h.end)))
    .sort((a, b) => b.i - a.i);
  let out = body;
  const cards = [];
  for (const hit of hits) {
    let card = hit.card;
    // On a single-card read, never stamp a different printing's number.
    if (prefer?.number && card.number && card.number !== prefer.number) {
      const sameName = prefer.clean && card.clean && (
        prefer.clean === card.clean
        || prefer.clean.startsWith(card.clean)
        || card.clean.startsWith(prefer.clean.split(" ")[0])
      );
      if (sameName) card = prefer;
      else continue;
    }
    const local = out.slice(hit.i, Math.min(out.length, hit.end + 64));
    if (tokenHas(local, card.number)) { cards.push(card); continue; }
    let end = hit.end;
    const rest = out.slice(end);
    const m = rest.match(new RegExp(`^(?:\\s+${VARIANT})*(?:\\s*\\([^)]+\\))*`));
    if (m) end += m[0].length;
    const next = `${out.slice(0, end)} ${card.number}${out.slice(end)}`;
    if (safeChange(out, next) !== next) continue;
    out = next;
    cards.push(card);
  }
  // Hits ran right to left so inserts keep earlier offsets; cards read left to right.
  return { text: out, cards: cards.reverse() };
}

function faceText(text, pool, prefer, subject) {
  const placed = placeNumbers(text, pool, prefer, subject);
  const priced = labelPrices(placed.text);
  return { text: safeChange(placed.text, priced), cards: placed.cards };
}

function picture(card, images) {
  if (!card) return "";
  const url = boardImage({ sku: card.id, id: card.id }, images.images, images.tcgOn, images.sealedPid);
  if (!url || url === BRAND_TILE) return "";
  return url;
}

function moneyHits(text) {
  return (String(text || "").match(/\$\d/g) || []).length;
}

function collectorNums(text) {
  const out = [];
  const re = /(?:^|[^A-Za-z0-9/])([A-Z]*\d+[a-z]?\/[A-Z]*\d+|[A-Z]{1,5}\d+[a-z]?)(?![\w/])/g;
  let m;
  while ((m = re.exec(String(text || "")))) out.push(m[1]);
  return [...new Set(out)];
}

// One priced card, not a "top cards" list. Zero matches, or two collector
// numbers on that one name, is not a card. The line is removed, not left blank.
function dropUnmatchedCardLine(text, cards) {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (/^Top cards tonight/i.test(trimmed)) return false;
  if (moneyHits(text) >= 3) return false;
  const nums = collectorNums(text);
  if (!nums.length || !/\$\d/.test(text)) return false;
  if ((cards || []).length >= 2) return false;
  if (cards?.length === 1 && nums.length === 1) return false;
  if (/^\d+\.\s/.test(trimmed) || nums.length > 1) return true;
  return false;
}

function renumberLines(lines) {
  let n = 0;
  return lines.map((line) => {
    if (typeof line !== "string" || !/^\d+\.\s/.test(line)) return line;
    n += 1;
    return line.replace(/^\d+\./, `${n}.`);
  });
}

function carriedCard(read, index, i) {
  const id = Array.isArray(read?.lineIds) ? String(read.lineIds[i] || "") : "";
  return id ? index.byId.get(id) || null : null;
}

function lineFromCarried(line, card) {
  const text = String(line || "");
  if (!card?.number || hasNumber(text, card.number)) return text;
  if (/:\s*\$/.test(text)) return text.replace(/:\s*\$/, ` ${card.number}: $`);
  return `${text} ${card.number}`;
}

function dollars(text, asOf, tonight) {
  const out = [];
  const ask = /eBay asks \(\$([\d,]+(?:\.\d{2})?)\)/g;
  let m;
  const night = Number(tonight);
  while ((m = ask.exec(text))) {
    out.push(priceRecord(Number(m[1].replace(/,/g, "")), asOf, "ebay"));
  }
  const tcg = /\$([\d,]+(?:\.\d{2})?)\s+NM\b/g;
  while ((m = tcg.exec(text))) {
    const amount = Number(m[1].replace(/,/g, ""));
    const date = Number.isFinite(night) && Math.abs(amount - night) < 0.001 ? asOf : "";
    out.push(priceRecord(amount, date, "tcgplayer", "NM"));
  }
  return out;
}

function singleCard(read) {
  const kind = read.deep || read.readKind || "";
  const list = new Set(["artist", "chase", "printings", "samelabel", "pokemon", "bigyear", "set", "rating", "steady", "tiers", "era", "market", "prerelease", "irlife", "rotation", "anniversary", "sealedgap"]);
  return !list.has(kind);
}

export function stampRead(read, index, images) {
  if (!read || typeof read !== "object") return read;
  if (read.dex || read.cardCount || read.oneIn || SKIP_KIND.has(read.readKind) && !read.deep) return read;
  const pool = poolFor(read, index);
  const direct = index.byId.get(String(read.sku || "")) || index.byId.get(String(read.cardId || ""));
  if (direct?.number && !read.number) read.number = direct.number;
  if (direct && singleCard(read) && direct.number && !hasNumber(read.name || "", direct.number)) {
    const titled = cardTitle({ name: read.name || direct.name, set: read.set || direct.set, number: direct.number });
    if (safeChange(read.name || "", titled) === titled) read.name = titled;
  }
  const fields = ["headline", "path", "why", "whyItMatters"];
  // A set, label, or species read names a group, not one card. Its own name at
  // the start of a headline stays as written ("Detective Pikachu deep dive",
  // "Charizard Secret Rare cards by set"), so no single card's number lands there.
  const subject = !singleCard(read) && typeof read.name === "string" && read.name.length >= 3 ? read.name : "";
  for (const key of fields) {
    if (typeof read[key] !== "string" || !read[key]) continue;
    const text = read[key];
    const next = subject && text.startsWith(subject)
      ? subject + faceText(text.slice(subject.length), pool, direct, subject).text
      : faceText(text, pool, direct, subject).text;
    read[key] = safeChange(read[key], next);
  }
  if (Array.isArray(read.lines)) {
    const lineCards = [];
    const mapped = read.lines.map((line, i) => {
      if (typeof line !== "string") { lineCards.push({ text: line, cards: [] }); return line; }
      const carried = carriedCard(read, index, i);
      if (carried) {
        const text = safeChange(line, labelPrices(lineFromCarried(line, carried)));
        const image = picture(carried, images);
        lineCards.push({ text, cards: [{ id: carried.id, number: carried.number, title: cardTitle(carried), ...(image ? { image } : {}) }] });
        return text;
      }
      const faced = faceText(line, pool, direct, subject);
      const cards = [];
      const seen = new Set();
      for (const c of faced.cards) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const image = picture(c, images);
        cards.push({ id: c.id, number: c.number, title: cardTitle(c), ...(image ? { image } : {}) });
      }
      lineCards.push({ text: faced.text, cards });
      return safeChange(line, faced.text);
    });
    const keptLines = [];
    const keptCards = [];
    const keptIds = [];
    const srcIds = Array.isArray(read.lineIds) ? read.lineIds : [];
    for (let i = 0; i < mapped.length; i += 1) {
      const line = mapped[i];
      const row = lineCards[i] || { text: line, cards: [] };
      if (dropUnmatchedCardLine(line, row.cards)) continue;
      keptLines.push(line);
      keptCards.push(row);
      keptIds.push(srcIds[i] || "");
    }
    const dropped = keptLines.length < mapped.length;
    read.lines = dropped ? renumberLines(keptLines) : keptLines;
    if (srcIds.length) read.lineIds = keptIds;
    if (keptCards.some((row) => row.cards.length)) read.lineCards = keptCards;
    else if (read.lineCards) delete read.lineCards;
    if (dropped && (read.readKind === "deep" || read.kind === "deep" || read.deep) && read.lines.length < 3) read.omit = true;
  }
  if (Array.isArray(read.variants)) {
    read.variants = read.variants.map((line) => (typeof line === "string" ? safeChange(line, faceText(line, pool, direct).text) : line));
  }
  const bars = read.chart?.bars;
  if (Array.isArray(bars)) {
    for (const bar of bars) {
      if (!Array.isArray(bar) || typeof bar[0] !== "string") continue;
      const raw = bar[0].replace(/\.{3}.*$/, "").trim();
      const hits = pool.filter((c) => c.clean && c.number && (bar[0].includes(c.number) || c.clean === raw || c.clean.startsWith(raw)));
      const seen = new Set();
      const uniq = [];
      for (const c of hits) if (!seen.has(c.id)) { seen.add(c.id); uniq.push(c); }
      const exact = uniq.filter((c) => c.clean === raw || bar[0].includes(c.number));
      const prefix = uniq.filter((c) => c.clean.startsWith(raw) && c.clean !== raw);
      const pick = exact.length === 1 ? exact : (exact.length === 0 && prefix.length === 1 ? prefix : []);
      if (pick.length !== 1) continue;
      const card = pick[0];
      const label = barLabel(card, 18);
      if (safeChange(bar[0], label) === label) bar[0] = label;
      const image = picture(card, images);
      if (image) bar[2] = image;
    }
  }
  if (direct && singleCard(read)) {
    const image = picture(direct, images);
    if (image && (!read.image || String(read.image).endsWith("/og.png"))) read.image = image;
  }
  if ((read.readKind === "deep" || read.kind === "deep" || read.deep) && (!read.image || String(read.image).endsWith("/og.png"))) {
    const next = pictureForRead(read, images.images, images.tcgOn, images.sealedPid, images.logos);
    if (next && next !== BRAND_TILE) read.image = next;
  }
  const blob = [...new Set([read.headline, read.path, ...(read.lines || [])].filter((s) => typeof s === "string"))].join("\n");
  const prices = dollars(blob, read.asOf || "", read.price);
  if (prices.length) read.prices = prices;
  return read;
}

export async function stampReadsDoc(doc, root) {
  const index = await loadFaceIndex(root);
  const images = await loadBoardImageInputs(root);
  const reads = Array.isArray(doc?.reads) ? doc.reads : [];
  let numbered = 0;
  let missed = 0;
  const kept = [];
  for (const read of reads) {
    stampRead(read, index, images);
    if (read.omit) continue;
    kept.push(read);
    const card = index.byId.get(String(read.sku || ""));
    if (!card?.number || read.dex || read.cardCount) continue;
    const blob = `${read.name || ""} ${read.headline || ""} ${(read.lines || []).join(" ")}`;
    if (hasNumber(blob, card.number)) numbered += 1;
    else if (singleCard(read) && cleanCardName(card.name) && String(read.headline || read.name || "").includes(cleanCardName(read.name || card.name).slice(0, 8))) missed += 1;
  }
  doc.reads = kept;
  doc.conditionNote = CONDITION_NOTE;
  return { reads: kept.length, cards: index.cards.length, numbered, missed };
}

export async function stampReadsFile(root) {
  const path = join(root, "research/assets/public/reads.json");
  const doc = JSON.parse(await readFile(path, "utf8"));
  const summary = await stampReadsDoc(doc, root);
  const body = JSON.stringify(doc, null, 1) + "\n";
  if (body.includes("@@ASK")) throw new Error("card face left an ask token in reads.json");
  await writeFile(path, body);
  return summary;
}
