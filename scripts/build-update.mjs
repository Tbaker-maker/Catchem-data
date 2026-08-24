// build-update.mjs — Catch'em Update. The institution format, on an empty beat.
//
// Tyler, 2026-08-24, after reviewing @SerebiiNet: "Agreed with all of it. Let's
// do."
//
// WHAT WE AGREED: Serebii's model is the opposite of what works on @LongedEth —
// no voice, no questions, fixed prefix, links in the post — and its own
// documented weakness is that replies are modest because engagement is
// informational rather than conversational. That is the wrong trade for a
// personal account whose entire asset is voice.
//
// But a CATCH'EM account can run it, because **Serebii reports news and does
// not report the sealed market**, and we track 207 products daily. The format
// only works when there is an archive behind the link, which is exactly what
// the database gives us.
//
// THE THING THAT DECIDES WHETHER THIS SURVIVES: Tyler runs two jobs and has two
// young children. Serebii posts multiple times a day. **A daily-cadence
// institution account is only sustainable at ZERO marginal effort**, so this
// generates from the bot and produces nothing on a quiet day rather than
// manufacturing something.
//
// AND IT REFUSES ON STALE DATA. A news account runs on freshness — Serebii's
// whole reputation is speed and accuracy. A market update built on two-day-old
// prices is the perishable-claim error again, on the one surface whose entire
// value is being current.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const MAX_AGE_HOURS = 26;   // one daily run plus a little slack
const MIN_MOVE = 8;         // below this it is noise, and a news post about noise is filler

const sp = await J("data/sealed-prices.json");
if (!sp) { console.error("  no sealed price data"); process.exit(1); }

const ageH = (Date.now() - Date.parse(sp.updatedAt ?? sp.generatedAt)) / 3600000;
if (ageH > MAX_AGE_HOURS) {
  // REFUSE, LOUDLY. The alternative is publishing a market update that is
  // quietly two days old, which is the exact failure this account's whole
  // premise is supposed to be immune to.
  console.error(`\n✗ DATA IS ${ageH.toFixed(1)}h OLD — no update generated.\n`);
  console.error(`   A news account runs on freshness. Publishing a market update on`);
  console.error(`   stale prices is the perishable-claim error on the one surface`);
  console.error(`   whose entire value is being current.\n`);
  console.error(`   The bot has to be reliable BEFORE this account exists.\n`);
  process.exit(1);
}

// THE REAL SCHEMA. I first wrote this against `price` and `prevPrice`, and
// NEITHER EXISTS — the fields are `priceUsd` and a `priceHistory` array of
// dated points. The generator would have reported "nothing moved" every day and
// looked correct doing it, which is a check that passes while doing nothing.
const products = (sp.products ?? []).filter(p => p.dataStatus === "live" && p.priceUsd != null);
const WINDOW_DAYS = 7;
const movers = products.map(p => {
  const hist = (p.priceHistory ?? []).filter(h => h.price != null);
  if (hist.length < 2) return null;
  // Compare against the oldest point inside the window, not simply the previous
  // one — a day-on-day move is noise and a week is a story.
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const older = hist.filter(h => h.date >= cutoff)[0] ?? hist[0];
  if (!older?.price) return null;
  const pct = (p.priceUsd - older.price) / older.price * 100;
  return { name: p.name, price: p.priceUsd, prevPrice: older.price, from: older.date, pct };
}).filter(m => m && Math.abs(m.pct) >= MIN_MOVE)
  .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

// A MOVE THAT LARGE IS A DATA ERROR, NOT A MARKET EVENT. Sealed product does
// not move 7500% in a week — it barely moves 50%. The history still contains
// figures from the era when the bot sorted by price and took the fifty cheapest
// listings, so a 151 UPC reads as $13 a week ago. Structurally valid,
// contextually absurd: the exact class Tyler catches and machines miss, and it
// would have gone out as the account's first post.
const SANE_CEILING = 60;
const absurd = movers.filter(m => Math.abs(m.pct) > SANE_CEILING);
const sane = movers.filter(m => Math.abs(m.pct) <= SANE_CEILING);
if (absurd.length) {
  // Reported, not silently dropped — a quietly filtered anomaly hides a broken
  // history that still needs fixing.
  console.error(`\n✗ ${absurd.length} product(s) show moves above ${SANE_CEILING}% — that is a DATA ERROR, not a market event.\n`);
  for (const m of absurd.slice(0, 3)) console.error(`   ${m.name}: ${Math.round(m.prevPrice)} → ${Math.round(m.price)} (${m.pct.toFixed(0)}%) since ${m.from}`);
  console.error(`\n   The price history still contains figures from the broken-bot era.\n   No update generated: publishing these would end the account's premise\n   on its first post.\n`);
  process.exit(1);
}
movers.length = 0;
movers.push(...sane);

if (!movers.length) {
  // NOTHING HAPPENED IS A VALID ANSWER. Serebii's discipline is "post
  // frequently when there is real news; do not manufacture content", and a
  // market account that posts every day regardless is a market account nobody
  // believes.
  console.log(`✓ nothing moved ${MIN_MOVE}% or more. No update — a market account that posts on a quiet day is one nobody believes.`);
  process.exit(0);
}

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const arrow = (p) => p > 0 ? "up" : "down";
const top = movers[0];
const date = new Date().toISOString().slice(0, 10);

// THE FORMAT, borrowed deliberately: fixed prefix, the fact, the actionable
// detail, the deep link. No adjectives, no questions, no hype — the two things
// worth stealing from Serebii are the prefix and the media, not the neutrality
// as a personality.
const post = [
  `Catch'em Update: ${top.name} is ${arrow(top.pct)} ${Math.abs(top.pct).toFixed(0)}% this week.`,
  ``,
  `${money(top.prevPrice)} → ${money(top.price)}`,
  movers.length > 1 ? `\n${movers.length - 1} other product${movers.length > 2 ? "s" : ""} moved ${MIN_MOVE}%+ today.` : ``,
  ``,
  `Full table: catchemtcg.com/board`,
].filter(Boolean).join("\n");

const board = movers.slice(0, 8).map(p =>
  `${p.pct > 0 ? "▲" : "▼"} ${p.name} — ${money(p.prevPrice)} → ${money(p.price)} (${p.pct > 0 ? "+" : ""}${p.pct.toFixed(0)}%)`).join("\n");

await writeFile(join(ROOT, "research/pulse/update-draft.json"), JSON.stringify({
  generatedAt: new Date().toISOString(), dataAgeHours: Math.round(ageH * 10) / 10,
  note: "Generated from the bot, not written. Refuses on data older than 26h and produces nothing when nothing moved — a market account that posts on a quiet day is one nobody believes.",
  post, board, movers: movers.length, tracked: products.length }, null, 1));

console.log(`✓ update drafted · data ${ageH.toFixed(1)}h old · ${movers.length} mover(s) of ${products.length} tracked\n`);
console.log(post.split("\n").map(l => "  " + l).join("\n"));
console.log(`\n  reply with the full board:\n` + board.split("\n").map(l => "    " + l).join("\n"));
