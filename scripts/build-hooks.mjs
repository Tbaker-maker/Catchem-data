// build-hooks.mjs — the first second, and the shot list under it.
//
// Tyler, 2026-08-25: "I want to work on our YouTube/TikTok/Instagram video
// creator editor… whether it's an idea or visual we need to help the creators
// which will then market us for free."
//
// WHAT THIS DOES NOT DO, stated first: **we cannot render video.** Static HTML,
// no server, no encoder. A tool promising a finished clip would be lying.
//
// WHAT IT DOES: the hardest part of a video is not editing, it is knowing what
// the video is ABOUT and why anyone watches past one second. We hold 16,468
// cards with prices, artists, HP and counts — so we can hand a creator a hook
// that is TRUE, a shot list built from real cards, and the images to record.
//
//   The data supplies the hook and the shot list.
//   The creator supplies the voice and the face.
//
// THE LAW THIS FILE EXISTS TO ENFORCE: **every claim must survive their comment
// section.** The first draft of this generator produced "Tyranitar: $0 → $4,250,
// a 17,000x gap" — which is a division by a MISSING price, not a fact. And
// "Team: 40HP → 280HP", which is the prefix bug for the sixth time. A creator
// reading either of those on camera gets corrected in their own comments, and it
// costs them credibility with an audience they spent years building. **A wrong
// hook is worse than no hook.**
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT, p), "utf-8"));

const idx = await J("research/assets/card-index.json");
const attrs = (await J("data/card-attrs.json")).cards;

// THE PREFIX BUG, SIXTH APPEARANCE. Form and owner prefixes are not creatures,
// and "Team" is not a Pokémon.
const FORM = new RegExp("^(Galarian|Alolan|Hisuian|Paldean|Dark|Light|Shining|Radiant|Team Aqua's|Team Magma's|Team Rocket's|Rocket's|Misty's|Brock's|Erika's|Sabrina's|Blaine's|Koga's|Giovanni's|Lillie's|N's|Marnie's|Ethan's|Cynthia's|Steven's|Iono's|Arven's|Hop's|Bea's|Crystal|Shadow|Mega)\\s+", "i");
const MECH = new RegExp("\\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV.X|-EX|-GX)$");
const NOT_MON = /^(Team|Energy|Trainer|Item|Supporter|Stadium|Tool|Professor|Pok)/i;
// GROUP BY DEX NUMBER, NOT BY NAME. Seven appearances of the prefix bug means
// the approach was wrong rather than the list — every previous fix extended a
// vocabulary that can never be complete, and the next set adds a prefix nobody
// thought of. The dex number is printed on the card and unambiguous: White
// Kyurem and Black Kyurem are both 646.
const dexOf = (c) => (attrs[c.i] && attrs[c.i].dex) || null;
// The display name is the SHORTEST name in the dex group, which is the base
// form — "Kyurem" rather than "White Kyurem-EX".
const DEX_NAME = {};
for (const c of idx) {
  const d = dexOf(c);
  if (!d) continue;
  let x = String(c.n);
  for (let i = 0; i < 2; i++) x = x.replace(FORM, "");
  x = x.replace(MECH, "").replace(/\s*\(.*$/, "").trim();
  if (!DEX_NAME[d] || x.length < DEX_NAME[d].length) DEX_NAME[d] = x;
}
const mon = (n) => String(n);   // kept for messages only; grouping uses dex
// A card is a Pokémon if it carries a dex number. Not if its name looks like one.
const isMon = (c) => !!(attrs[c.i] && attrs[c.i].dex) && !NOT_MON.test(mon(c.n));

// A PRICE FLOOR, because $0 means UNKNOWN not free. Every ratio in the first
// draft was a division by a missing price.
const PRICED = 2;
const priced = idx.filter(c => isMon(c) && (c.p || 0) >= PRICED && c.a);

const hooks = [];
const n = (x) => "$" + Math.round(x).toLocaleString("en-US");

// 1. THE SAME POKÉMON, WILDLY DIFFERENT PRICES. This works on camera because
// the viewer sees two cards of the same creature and cannot explain the gap —
// which is the question that keeps them watching.
{
  const by = {};
  for (const c of priced) { const d = dexOf(c); if (!d) continue; (by[d] = by[d] || []).push(c); }
  for (const [dex, list] of Object.entries(by)) {
    const m = DEX_NAME[dex] || list[0].n;
    if (list.length < 6) continue;
    const s = list.slice().sort((a, b) => a.p - b.p);
    const lo = s[0], hi = s[s.length - 1];
    const mult = hi.p / lo.p;
    if (mult < 40 || mult > 3000) continue;   // above 3000x, suspect the data
    hooks.push({
      kind: "price-gap",
      hook: `Same Pokémon. ${n(lo.p)} and ${n(hi.p)}.`,
      say: `Both of these are ${m}. One costs ${n(lo.p)}. The other costs ${n(hi.p)}. Nothing about the Pokémon changed — only the printing.`,
      shots: [lo.i, hi.i],
      seconds: [1.5, 4],
      check: `${m}: ${list.length} priced cards, lowest ${n(lo.p)} (${lo.s}), highest ${n(hi.p)} (${hi.s})`,
    });
  }
}

// 2. POWER CREEP. A number that moves in one direction over 25 years is a
// story anybody can follow without knowing the game.
{
  const by = {};
  for (const c of idx) {
    if (!isMon(c)) continue;
    const a = attrs[c.i];
    if (!a || !a.hp || !c.y) continue;
    const d = dexOf(c); if (!d) continue; (by[d] = by[d] || []).push({ i: c.i, y: c.y, hp: Number(a.hp), n: c.n, s: c.s });
  }
  for (const [dex, list] of Object.entries(by)) {
    const m = DEX_NAME[dex] || list[0].n;
    if (list.length < 8) continue;
    const s = list.slice().sort((a, b) => String(a.y).localeCompare(String(b.y)));
    const first = s[0], last = s[s.length - 1];
    if (!first.hp || last.hp / first.hp < 2.5) continue;
    hooks.push({
      kind: "power-creep",
      hook: `${m} had ${first.hp} HP in ${first.y}. Now it has ${last.hp}.`,
      say: `${first.y}: ${first.hp} HP. ${last.y}: ${last.hp}. That is ${Math.round(last.hp / first.hp * 10) / 10} times tougher, and it happened one set at a time.`,
      shots: [first.i, last.i],
      seconds: [1.5, 4],
      check: `${m}: ${list.length} cards with printed HP, ${first.hp} (${first.s}, ${first.y}) → ${last.hp} (${last.s}, ${last.y})`,
    });
  }
}

// 3. THE COUNTED FACT. Nobody else can make these, because nobody else counted.
{
  const counts = {};
  for (const c of idx) { if (!isMon(c)) continue; const d = dexOf(c); if (d) counts[d] = (counts[d] || 0) + 1; }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const once = ranked.filter(([, v]) => v === 1).length;
  const zard = counts[6] || 0;   // Charizard is dex 6
  const top = ranked[0];
  const topName = DEX_NAME[top[0]] || top[0];
  const pool = priced.filter(c => String(dexOf(c)) === String(top[0])).sort((a, b) => b.p - a.p);
  hooks.push({
    kind: "counted",
    hook: `${topName} has ${top[1]} cards. ${once} Pokémon have one.`,
    say: `Out of ${idx.length.toLocaleString("en-US")} English cards, ${topName} has been printed ${top[1]} times. ${once} Pokémon have exactly one card. Ever.`,
    shots: pool.slice(0, 2).map(c => c.i),
    seconds: [2, 4],
    check: `counted across ${idx.length} cards with a dex number; Charizard ${zard}`,
  });
}

// 4. THE ARTIST NOBODY NAMES. Requires the second card to be PRICED — the first
// draft compared against $0 and produced nonsense.
{
  const by = {};
  for (const c of priced) (by[c.a] = by[c.a] || []).push(c);
  for (const [artist, list] of Object.entries(by)) {
    if (list.length < 4 || list.length > 25) continue;
    const s = list.slice().sort((a, b) => b.p - a.p);
    if (!s[1] || s[1].p < PRICED) continue;
    const ratio = s[0].p / s[1].p;
    if (ratio < 6 || ratio > 200) continue;
    hooks.push({
      kind: "one-hit",
      hook: `${artist} drew ${list.length} cards. One of them is ${n(s[0].p)}.`,
      say: `${artist} has ${list.length} cards in the whole game. This one is ${n(s[0].p)}. The next closest is ${n(s[1].p)}.`,
      shots: [s[0].i, s[1].i],
      seconds: [2, 4],
      check: `${artist}: ${list.length} priced cards, top ${n(s[0].p)} (${s[0].n}), second ${n(s[1].p)}`,
    });
  }
}

hooks.sort(() => Math.random() - 0.5);
await writeFile(join(ROOT, "data/video-hooks.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: "Every hook carries a `check` field naming the counted basis, because a creator reading a wrong number on camera gets corrected in their own comments and it costs THEM credibility. A wrong hook is worse than no hook. Prices below $2 are treated as UNKNOWN, not free — the first draft divided by missing prices and produced a 17,000x gap.",
  priceFloor: PRICED,
  hooks,
}, null, 1));

const byKind = {};
for (const h of hooks) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
console.log(`✓ hooks: ${hooks.length} across ${Object.keys(byKind).length} kinds — ${Object.entries(byKind).map(([k, v]) => k + " " + v).join(", ")}\n`);
for (const h of hooks.slice(0, 4)) {
  console.log(`  "${h.hook}"`);
  console.log(`     ${h.check}\n`);
}
