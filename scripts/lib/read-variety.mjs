// Neighboring reads should not repeat a boilerplate 4-word phrase.
// Proper names and set names are not boilerplate and may repeat.
// Alternates only rearrange facts already written on that read.
// Short words stay in the gram so a date stamp cannot hide inside them.

const GLUE = new Set(`a an the of in on to from for and or its it is still under over about
more less than with against by as at vs last this that those two date dates week weeks days
day year years went up down flat priced above below similar typical price prices cards card
market tcgplayer story way low high tonight median fell rose illustrated chase ahead behind
set listings counted peak range file back since out came era both only same start end running
higher lower one night sealed top between within held barely moved not no after before into
across while each their was were has have together add dated level near line percent jan feb
mar apr may jun jul aug sep oct nov dec our list standard legal left rotated points then
through reads moved pair print reaching using window shows source ends after`.split(/\s+/));

const MD = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{1,2}";
const MDY = `${MD}, \\d{4}`;
const BANNED = /[\u2014\u2013]|\b(?:sold|sales|buy now|load up|guaranteed)\b/i;

export function wordsOf(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9$%+'-]+/g, " ").split(/\s+/).filter(Boolean);
}

export function glueGrams(text) {
  const w = wordsOf(text);
  const out = new Set();
  for (let i = 0; i <= w.length - 4; i += 1) {
    const g = w.slice(i, i + 4);
    if (g.every((t) => GLUE.has(t) || /^\$?\d+(?:\.\d+)?%?$/.test(t))) out.add(g.join(" "));
  }
  return out;
}

function voiceOf(read) {
  const parts = [read?.headline, read?.path, read?.why, read?.blurb, read?.whyItMatters];
  for (const ln of read?.lines || []) if (typeof ln === "string") parts.push(ln);
  return parts.filter(Boolean).join(" ");
}

function shares(a, b) {
  const gb = glueGrams(voiceOf(b));
  for (const g of glueGrams(voiceOf(a))) if (gb.has(g)) return true;
  return false;
}

function overlap(text, avoid) {
  let n = 0;
  for (const g of glueGrams(text)) if (avoid.has(g)) n += 1;
  return n;
}

function amounts(text) {
  return new Set(String(text || "").match(/\$[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?%/g) || []);
}

function safe(orig, alt) {
  if (!alt || BANNED.test(alt)) return false;
  const have = amounts(orig);
  for (const n of amounts(alt)) if (!have.has(n)) return false;
  return true;
}

function familyOf(read) {
  return String(read?.family || read?.readKind || "");
}

function pushAlt(list, orig, alt) {
  const text = String(alt || "").replace(/\s+/g, " ").trim();
  if (!text || text === orig || list.includes(text) || !safe(orig, text)) return;
  list.push(text);
}

function specificAlts(text) {
  const out = [text];
  let m = text.match(new RegExp(`^TCGplayer market is (flat|up|down)(?: ([0-9.]+)%)? over (\\d+) days, as of (${MD})\\.$`));
  if (m) {
    const dir = m[1];
    const pct = m[2] ? ` ${m[2]}%` : "";
    const days = m[3];
    const date = m[4];
    pushAlt(out, text, `Across ${days} days, TCGplayer market shows ${dir}${pct}. Dated ${date}.`);
    pushAlt(out, text, `Dated ${date}: TCGplayer market shows ${dir}${pct} across ${days} days.`);
    pushAlt(out, text, `${date} TCGplayer market line: ${dir}${pct}, ${days} day window.`);
  }
  m = text.match(new RegExp(`^From ([^,]+), (.+) and (${MD}(?:, \\d{4})?)\\.$`));
  if (m) {
    pushAlt(out, text, `${m[1]} points: ${m[2]} then ${m[3]}.`);
    pushAlt(out, text, `${m[2]} then ${m[3]}. Source: ${m[1]}.`);
  }
  m = text.match(/^(Up|Down) (\$[\d,.]+) on those two dates\.$/);
  if (m) {
    pushAlt(out, text, `${m[1]} ${m[2]} across that pair of dates.`);
    pushAlt(out, text, `The pair of dates is ${m[1].toLowerCase()} ${m[2]}.`);
  }
  m = text.match(new RegExp(`^(.+): (\\d+) of (\\d+) (fell|rose), median ([+-]?[0-9.]+%), (${MD}) to (${MD})\\.$`));
  if (m) {
    const sub = m[1];
    const a = m[2];
    const b = m[3];
    const dir = m[4];
    const med = m[5];
    const d1 = m[6];
    const d2 = m[7];
    pushAlt(out, text, `${sub} ${dir} on ${a} of ${b} cards. Median ${med}. Ends ${d2}, after ${d1}.`);
    pushAlt(out, text, `${a} of ${b} ${dir} among ${sub}. Median ${med}, from ${d1} through ${d2}.`);
  }
  m = text.match(new RegExp(`^(Up|Down) ([0-9.]+%) on the year: (.+?) went from (\\$[\\d,.]+) on (${MDY}) to (\\$[\\d,.]+) on (${MD})\\.(.*)$`));
  if (m) {
    const dir = m[1];
    const pct = m[2];
    const name = m[3];
    const p0 = m[4];
    const d0 = m[5];
    const p1 = m[6];
    const d1 = m[7];
    const tail = String(m[8] || "").trim();
    const rest = tail ? ` ${tail}` : "";
    pushAlt(out, text, `${name} moved from ${p0} dated ${d0}, reaching ${p1} dated ${d1}, ${dir.toLowerCase()} ${pct} across the year.${rest}`);
    pushAlt(out, text, `Across the year, ${name} is ${dir.toLowerCase()} ${pct}: ${p0} (${d0}) then ${p1} (${d1}).${rest}`);
  }
  m = text.match(new RegExp(`^The story of (.+): (\\$[\\d,.]+) tonight, (\\d+(?:\\.\\d+)?%) of the way from its 1-year low to its 1-year high\\.$`));
  if (m) {
    pushAlt(out, text, `${m[1]} is at ${m[2]} tonight. Between its 1-year low and its 1-year high, the spot is ${m[3]}.`);
    pushAlt(out, text, `${m[1]}: ${m[3]} separates its 1-year low and its 1-year high. Tonight the price is ${m[2]}.`);
  }
  return out;
}

function genericPass(text) {
  let s = text;
  s = s.replace(new RegExp(`\\bas of (${MD})\\b`, "g"), "dated $1");
  s = s.replace(/\bover (\d+) days\b/g, "across $1 days");
  s = s.replace(/\bon those two dates\b/g, "across that pair of dates");
  s = s.replace(new RegExp(`^From ([^,]+),\\s*`), "$1 points: ");
  s = s.replace(new RegExp(`\\b(${MDY}) to\\b`, "g"), "$1, reaching");
  s = s.replace(new RegExp(`\\b(${MD}) to (${MD})\\b`, "g"), "ends $2, after $1");
  s = s.replace(/\bTCGplayer market is\b/g, "TCGplayer market shows");
  s = s.replace(/\bwent from\b/g, "moved from");
  s = s.replace(new RegExp(`\\bon (${MDY})\\b`, "g"), "dated $1");
  s = s.replace(new RegExp(`\\((${MD})\\) on TCGplayer market`, "g"), "TCGplayer market for $1");
  s = s.replace(/, (\d{4}) and\b/g, ", $1 then");
  s = s.replace(/\band ([A-Z][a-z]{2,9} \d{1,2})\b/g, "then $1");
  return s.replace(/\s+/g, " ").trim();
}

function secondPass(text) {
  let s = genericPass(text);
  s = s.replace(new RegExp(`\\bdated (${MD})\\b`, "g"), "on $1");
  s = s.replace(/\bacross (\d+) days\b/g, "in a $1 day span");
  s = s.replace(/\bTCGplayer market shows\b/g, "TCGplayer market,");
  s = s.replace(/\bthen\b/g, "followed by");
  return s.replace(/\s+/g, " ").trim();
}

function candidates(text) {
  const out = specificAlts(text);
  pushAlt(out, text, genericPass(text));
  pushAlt(out, text, secondPass(text));
  for (const base of specificAlts(text)) {
    pushAlt(out, text, genericPass(base));
    pushAlt(out, text, secondPass(base));
  }
  return out;
}

function rewriteField(text, avoid, salt) {
  if (typeof text !== "string" || !text || overlap(text, avoid) === 0) return text;
  const alts = candidates(text);
  let best = text;
  let bestN = overlap(text, avoid);
  for (let k = 0; k < alts.length; k += 1) {
    const alt = alts[(salt + k) % alts.length];
    if (!safe(text, alt)) continue;
    const n = overlap(alt, avoid);
    if (n < bestN) { best = alt; bestN = n; }
    if (n === 0) return alt;
  }
  return best;
}

const FIELDS = ["headline", "why", "blurb", "whyItMatters"];

function applySalt(read, avoid, salt) {
  const next = { ...read };
  if (Array.isArray(read.lines)) {
    next.lines = read.lines.map((ln) => (typeof ln === "string" ? rewriteField(ln, avoid, salt) : ln));
  }
  for (const key of FIELDS) {
    if (typeof read[key] === "string") next[key] = rewriteField(read[key], avoid, salt);
  }
  if (read.path === read.headline) next.path = next.headline;
  else if (typeof read.path === "string") next.path = rewriteField(read.path, avoid, salt);
  return next;
}

function avoidOf(read) {
  return glueGrams(voiceOf(read));
}

function retell(read, avoid, salt) {
  let best = read;
  let bestN = overlap(voiceOf(read), avoid);
  for (let n = 0; n < 6; n += 1) {
    const next = applySalt(read, avoid, salt + n + 1);
    const left = overlap(voiceOf(next), avoid);
    if (left < bestN) { best = next; bestN = left; }
    if (left === 0) return next;
  }
  return best;
}

// Same shape as spaceFamilies: take the next read that can sit here.
// A different family wins, so this pass does not undo that spacer.
// When every remaining read shares boilerplate, swap the template instead.
export function spaceSimilar(reads) {
  const left = (reads || []).slice();
  const out = [];
  let run = 0;
  while (left.length) {
    const last = out[out.length - 1];
    let idx = 0;
    if (last) {
      const lastFam = familyOf(last);
      const both = left.findIndex((r) => familyOf(r) !== lastFam && !shares(last, r));
      const fam = left.findIndex((r) => familyOf(r) !== lastFam);
      const any = left.findIndex((r) => !shares(last, r));
      if (both >= 0) idx = both;
      else if (fam >= 0) idx = fam;
      else if (any >= 0) idx = any;
    }
    let row = left.splice(idx, 1)[0];
    if (last && shares(last, row)) {
      run += 1;
      row = retell(row, avoidOf(last), run);
    } else {
      run = 0;
    }
    out.push(row);
  }
  return out;
}
