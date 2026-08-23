// backfill-artists.mjs — fill the illustrator gap our usual source has not.
//
// data/knowledge.json → artist-credit-backfill-gap, VERIFIED: 1–4% of cards are
// missing an illustrator every year from 2002 to 2023, then 43.7% of 2024. The
// credit is printed on the face of every physical card, so it is not a Pokémon
// decision — the community dataset simply has not caught up. And the gap sits
// in exactly the sets people are opening right now.
//
// TCGdex publishes the illustrator per card and has all four: sv08 Surging
// Sparks (252), me01 Mega Evolution (188), sv08.5 Prismatic Evolutions (180),
// sv07 Stellar Crown (175) — card counts identical to ours, which is the first
// evidence the sets align rather than merely share a name.
//
// MERGE BY ID, NEVER WHOLESALE (the overwrite pathogen, 2026-08-18). This only
// ever ADDS an artist to a card that has none. It will not overwrite a credit we
// already hold, because a disagreement between two sources is something to look
// at, not something to silently resolve in favour of whoever ran last.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.tcgdex.net/v2/en";
const TIMEOUT = 20000;

// ourSetName → their set id. Verified by exact name AND exact card count.
const SETS = {
  "Surging Sparks": "sv08",
  "Mega Evolution": "me01",
  "Prismatic Evolutions": "sv08.5",
  "Stellar Crown": "sv07",
  // The next two largest gaps after the four named in the pending doc — 223 of
  // the 434 credits still missing after the first pass. Same verification: the
  // name matches exactly and so does the card count.
  "Perfect Order": "me03",
  "Shrouded Fable": "sv06.5",
};

const get = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`);
  return r.json();
};

// Modest concurrency against a free community API we are asking a favour of.
async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } }
  }));
  return out;
}

export async function backfill({ apply = false } = {}) {
  const cat = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf-8"));
  const report = [];
  let filled = 0, conflicts = 0, unmatched = 0;

  for (const [ourName, theirId] of Object.entries(SETS)) {
    const ours = Object.entries(cat.cards).filter(([, c]) => c.setName === ourName);
    const brief = await get(`${API}/sets/${theirId}`);
    const details = await pool(brief.cards ?? [], 4, c => get(`${API}/cards/${c.id}`));

    // Their localId is the printed card number, which is what we key on too —
    // but the two catalogues pad it differently. Ours writes "001", theirs "1",
    // so a raw string compare failed for cards 1–99 and succeeded from 100 up:
    // exactly 99 misses per set, in all four sets, which is what gave it away.
    // Numeric-looking numbers compare numerically; promo suffixes like "TG12"
    // or "SV01" stay strings and compare case-insensitively.
    const key = n => {
      const s = String(n ?? "").trim();
      return /^\d+$/.test(s) ? String(Number(s)) : s.toUpperCase();
    };
    const byNumber = new Map();
    for (const d of details) if (d?.localId) byNumber.set(key(d.localId), d.illustrator ?? null);

    let setFilled = 0, setMissing = 0, setNoMatch = 0;
    for (const [id, c] of ours) {
      const their = byNumber.get(key(c.number));
      if (their === undefined) { setNoMatch++; unmatched++; continue; }
      if (!their) { setMissing++; continue; }
      if (c.artist && c.artist !== their) { conflicts++; continue; }   // never overwrite
      if (!c.artist) { if (apply) cat.cards[id].artist = their; setFilled++; filled++; }
    }
    report.push({ set: ourName, theirId, ours: ours.length, theirs: details.filter(Boolean).length,
      filled: setFilled, theyLackToo: setMissing, noNumberMatch: setNoMatch });
  }

  if (apply) {
    cat.artistBackfill = { at: new Date().toISOString(), source: "TCGdex api.tcgdex.net/v2/en",
      note: "Illustrator credits added ONLY where we held none. Existing credits were never overwritten.",
      filled };
    await writeFile(join(ROOT, "data/card-catalogue.json"), JSON.stringify(cat, null, 1) + "\n");
  }
  return { report, filled, conflicts, unmatched, applied: apply };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes("--apply");
  const { report, filled, conflicts, unmatched, applied } = await backfill({ apply });
  for (const r of report)
    console.log(`  ${r.set.padEnd(22)} ours ${String(r.ours).padStart(3)} · theirs ${String(r.theirs).padStart(3)} · filled ${String(r.filled).padStart(3)}` +
      `${r.theyLackToo ? ` · they lack ${r.theyLackToo}` : ""}${r.noNumberMatch ? ` · no number match ${r.noNumberMatch}` : ""}`);
  console.log(`\n${applied ? "✓ applied" : "DRY RUN"}: ${filled} credit(s)${conflicts ? ` · ${conflicts} conflict(s) left alone` : ""}${unmatched ? ` · ${unmatched} unmatched` : ""}`);
  if (!applied) console.log("  re-run with --apply to write them");
}
