// card-guard.mjs — does this card say anything?
//
// 2026-08-23, second instance of the same root cause in one day. I minted two
// post cards outside the pipeline. I viewed the first, caught two layout bugs,
// fixed them. I never opened the second. It went to Tyler as an "art post" and
// was a price table with a stranger's username on top.
//
// The first instance was a wrong PRICE on an ungated card. This is meaningless
// CONTENT on an ungated card. Same path, same absence of any check, twice.
//
// WHAT THIS CHECKS, all from that specific failure:
//  - a headline nobody can parse (an alias, an ID, an unexplained string)
//  - an ART card whose content is mostly prices, which is the opposite of art
//  - an empty value rendered as a dash, which is a blank pretending to be data
//  - a claim of significance the numbers do not support
//  - the chip: a card asserting VERIFIED must carry a source
//
// WHAT IT CANNOT CHECK, and this is the important half: whether the card LOOKS
// right. Clipping, overlap, contrast, whether the wordmark collides with a stat
// row — none of that is visible from the SVG source in any reliable way. That
// requires eyes on the rendered image, every time, and the rule is absolute:
// nothing goes to a person that I have not looked at.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const dir = join(ROOT, "research/pulse/cards");
const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith(".svg"));
const problems = [];
const P = (card, what, why) => problems.push({ card, what, why });

for (const f of files) {
  // Composites are art posts by definition: images, a caption, no figures.
  // The price checks below would be meaningless on them and the alias check
  // would fire on any short artist name.
  if (/^composite/.test(f)) continue;
  const svg = await readFile(join(dir, f), "utf-8").catch(() => "");
  if (!svg) continue;
  const texts = [...svg.matchAll(/>([^<>{}]{2,90})</g)].map(m => m[1].trim()).filter(Boolean);
  const kicker = texts[0] ?? "";
  const body = texts.join(" ");

  // 1 — A HEADLINE NOBODY CAN PARSE. "USGMEN" is an alias, and an alias with no
  // explanation is a string, not a subject. A reader cannot care about a name
  // they cannot place.
  if (/^[A-Z0-9]{4,12}$/.test(kicker) && !/·/.test(kicker))
    P(f, `the kicker is "${kicker}" — an unexplained alias`,
      "A reader cannot care about a name they cannot place. If a subject needs context, the card must carry it; if it cannot, that is not a subject worth a card.");

  // 2 — AN ART CARD MADE OF PRICES. The exact miss: asked for art, sent stats.
  const priceTokens = (body.match(/\$[\d,]+/g) ?? []).length;
  const isArt = /illustrat|artist|drew|body of work|cards\./i.test(body);
  if (isArt && priceTokens >= 2)
    P(f, `an art card carrying ${priceTokens} price figures`,
      "Art content is about the work and the person. A card that answers 'what is it worth' three times is a stats card with an artist's name on it, which is what it was explicitly not meant to be.");

  // 3 — A BLANK PRETENDING TO BE DATA.
  if (/>—<|>-<|>N\/A</.test(svg))
    P(f, "a value renders as a dash",
      "An empty slot with a dash in it looks like a measurement and is not one. Either the value exists or the slot should not.");

  // 4 — A CLAIM THE NUMBERS DO NOT SUPPORT.
  const yearsClaimed = /(\d+)\s*year/i.exec(body);
  if (yearsClaimed && Number(yearsClaimed[1]) <= 2 && /span|end to end|career|still/i.test(body))
    P(f, `describes ${yearsClaimed[1]} years as a span`,
      "Two years is not a career or a span. Framing a short interval as a long one is the kind of small overclaim that makes a reader distrust the large ones.");

  // 5 — VERIFIED WITH NO SOURCE.
  if (/VERIFIED/.test(svg) && !/(sales|credits|listings|indexed|via|sourced|observed|\d{4}-\d{2}-\d{2}|USD)/i.test(body))
    P(f, "chipped VERIFIED with no source line",
      "The chip promises somebody could check this. A card needs at minimum a date, and ideally where the number came from — without either it is a promise with nothing behind it.");
}

// ── CONSTRUCTED IMAGE URL ─────────────────────────────────────────────────
// A card back reached a post because I built an image path from a card ID and
// assumed one host. Newer sets serve from a different host entirely, so the
// URL 404'd and the host returned a placeholder - a perfectly valid image of
// the wrong thing, which is the hardest kind of wrong to catch.
{
  const scripts = await readdir(join(ROOT, "scripts"));
  for (const f of scripts.filter(x => x.endsWith(".mjs") && x !== "card-guard.mjs")) {
    const src = await readFile(join(ROOT, "scripts", f), "utf-8").catch(() => "");
    if (/`https:\/\/images\.[a-z]+\.[a-z]+\/\$\{/.test(src))
      P(f, "builds an image URL from a template",
        "Image hosts differ per set. A constructed path 404s silently and the host answers with a card back, which renders fine and checks fine. Read the URL from the source data instead.");
  }
}

const out = { generatedAt: new Date().toISOString(),
  checked: files.length,
  cannotCheck: "Whether the card LOOKS right — clipping, overlap, contrast, collisions. That needs eyes on the rendered PNG, every time, without exception.",
  problems };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/card-guard.json"), JSON.stringify(out, null, 1));

if (problems.length) {
  console.error(`\n✗ CARD GUARD — ${problems.length} problem(s) across ${files.length} card(s):`);
  for (const p of problems) console.error(`   ${p.card}: ${p.what}\n     ${p.why}`);
  console.error("\n   And none of this covers whether it LOOKS right. Open the PNG.\n");
  process.exitCode = 1;
} else {
  console.log(`✓ card guard: ${files.length} card(s) say something · looking at them is still required`);
}
