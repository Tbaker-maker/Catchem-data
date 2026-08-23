// tease-guard.mjs — a withheld thing must actually be withheld.
//
// Tyler, 2026-08-23: "'Guard' in the name is a mistake and we need to catch
// those things."
//
// He is right twice. The name gave the product away while a ??? tag sat beside
// it pretending otherwise, and then "not a toploader, not a binder" narrowed it
// back to the exact category — a denial that names the neighbourhood is worse
// than saying nothing, because it reads as a clue.
//
// The deeper miss is that NOBODY WAS CHECKING. We have guards for prices,
// layout, claims, jargon, slop and design, and none of them ask the simplest
// question about a teaser: does this actually withhold what it says it is
// withholding?
//
// So: any block marked ??? gets scanned for words that identify a product, and
// for the negation pattern, which is the subtler failure of the two.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Nouns that identify what we are making. Deliberately broad: the cost of a
// false positive is rewording one sentence; the cost of a miss is the whole
// tease.
const NAMES = /\b(guard|guards|toploader|top loader|sleeve|slab case|protector|holder|magnetic|acrylic|binder page|case|pack|blind box|loot)\b/i;
// "Not a X" tells the reader the answer is next to X. A denial that names the
// neighbourhood is a clue wearing a disclaimer.
const DENIAL = /\bnot (a|an|the|just|only|what)\b/i;

const findings = [];
const files = (await readdir(join(ROOT, "research/assets")).catch(() => []))
  .filter(f => f.endsWith(".html") && !/mock|v[0-9]\.html/.test(f));

for (const file of files) {
  const src = await readFile(join(ROOT, "research/assets", file), "utf-8").catch(() => "");
  if (!src.includes("???")) continue;
  // Take the feature block containing the ??? tag: from its heading to the next.
  for (const m of src.matchAll(/<div class="feat">([\s\S]*?)<\/div>/g)) {
    const block = m[1];
    if (!block.includes("???")) continue;
    const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const named = text.match(NAMES);
    if (named) findings.push({ file, issue: `a ??? block contains "${named[0]}"`,
      why: "The tag says withheld and the copy names the product. Anybody in this hobby reads that word and knows exactly what it is, which makes the ??? decoration on an answer we already gave.",
      text: text.slice(0, 110) });
    const denies = text.match(DENIAL);
    if (denies) findings.push({ file, issue: `a ??? block uses the negation pattern ("${denies[0]}…")`,
      why: "A denial that names the neighbourhood is a clue wearing a disclaimer. 'Not a toploader, not a binder' told everyone the category while sounding like it was withholding it.",
      text: text.slice(0, 110) });
  }
}

if (findings.length) {
  console.error(`\n✗ TEASE — ${findings.length} leak(s) in copy marked ???:\n`);
  for (const f of findings) console.error(`   ${f.file}: ${f.issue}\n     ${f.why}\n     "${f.text}…"`);
  console.error(`\n   Say what somebody will FEEL, not what the thing IS, and never say what it is not.\n`);
  process.exitCode = 1;
} else {
  console.log(`✓ tease: nothing marked ??? gives itself away · ${files.length} page(s) checked`);
}
