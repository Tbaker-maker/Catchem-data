import { readFile } from "node:fs/promises";
// ATTACK 4: THE MONEY AND THE CREDIT. Two things on this tool can cost somebody
// something real — a wrong price on a want list they take to a card show, and a
// missing artist credit on an image they post publicly. Neither has ever been
// checked end to end.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const idx = JSON.parse(js.match(/const CARD_INDEX = (\[[\s\S]*?\]);\n/)[1]);
const problems = [];

// 1 · PRICE SANITY. A want list totals these; a wrong one sends somebody to a
// table with the wrong budget.
const priced = idx.filter(c => c.p != null);
const absurdHigh = priced.filter(c => c.p > 20000);
const absurdLow = priced.filter(c => c.p <= 0);
const noPrice = idx.length - priced.length;
if (absurdHigh.length) problems.push(`${absurdHigh.length} card(s) priced over $20,000 — e.g. ${absurdHigh[0].n} at $${absurdHigh[0].p}`);
if (absurdLow.length) problems.push(`${absurdLow.length} card(s) priced at or below zero`);
console.log(`prices: ${priced.length.toLocaleString()} of ${idx.length.toLocaleString()} · ${noPrice.toLocaleString()} unpriced`);

// 2 · THE UNPRICED SHARE. A total built from partial data must say so, and if
// most cards are unpriced the total is decoration.
const share = noPrice / idx.length;
if (share > 0.1) problems.push(`${Math.round(share*100)}% of cards have NO price — a page total built from these is mostly a guess unless the count of unpriced is shown`);
const showsUnpriced = /unpriced/.test(js);
if (!showsUnpriced) problems.push("the tally never says how many cards are unpriced — a partial total presented as a whole one");

// 3 · ARTIST CREDIT. Every composed image carries a credit line. What happens
// when nothing in the tray has an artist?
const credited = idx.filter(c => c.a).length;
console.log(`credits: ${credited.toLocaleString()} of ${idx.length.toLocaleString()} cards have an artist`);
const fallback = /artist not recorded|illustrator not recorded/.test(js);
if (!fallback) problems.push("no fallback text when NO card in the tray has an artist — the credit line would be blank on a public image");

// 4 · Could a whole idea be built from uncredited cards? That ships an image
// with an empty credit line, which is the one thing we said we would never do.
const uncredited = idx.filter(c => !c.a);
console.log(`uncredited cards that can still be added: ${uncredited.length.toLocaleString()}`);
if (uncredited.length && !/NO artist credit/.test(js))
  problems.push("uncredited cards are addable but the UI never flags them at compose time");

console.log(problems.length ? `\n✗ MONEY & CREDIT — ${problems.length}:\n` : "\n✓ money and credit both handle their edge cases");
for (const p of problems) console.log("   " + p);
