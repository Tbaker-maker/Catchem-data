// correction-hunter.mjs — THE AGENT THAT AUDITS OUR PAST SELF.
//
// We publish our misses, but only the ones somebody remembers to revisit.
// This makes the record complete: it re-reads what we said on earlier days and
// checks it against what those numbers turned out to be. Where a published
// figure has drifted materially, it drafts a correction and files it for
// review — the corrections page stops depending on human memory.
//
// IT IS NOT A SCOREKEEPER FOR PREDICTIONS. We do not make predictions. It
// checks whether the FACTS we published were right: did the price we printed
// hold up, did a product we called liquid stay liquid, did a figure we showed
// as measured turn out to be an artefact of our own filters.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rotate } from "./rotate.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };


// VOICE: this agent audits our past self, so its tone is a colleague checking
// your work rather than an auditor writing you up. Kind, dry, and always
// pointed at us — never at a reader who trusted the number.
const pickLine = (a, salt = 0) => rotate(a, salt);
const VOICE = {
  clean: [
    "Went back through everything we published and found nothing to take back. Rare and pleasant.",
    "Re-read our own numbers looking for a mistake. Came up empty this time.",
    "Nothing to correct today. Enjoy it; the streak never lasts.",
  ],
  suspect: [
    "Found a few of our own figures that moved faster than any market should. Checking which one of them was us.",
    "Some numbers we published look more like our measuring than the market. Worth a second pair of eyes.",
    "A handful of suspicious jumps in our own history. Probably ours, not the market's — that is the usual answer.",
  ],
  vanished: [
    "We put something in front of readers and can no longer price it. That is the kind of thing worth noticing before somebody asks.",
    "A product we featured has gone quiet on us. Either it stopped trading or we broke its query, and we should know which.",
  ],
};

const hh = await J("data/heat-history.json") ?? [];
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const wlog = await J("research/pulse/watch-log.json") ?? { entries: [] };
const today = new Date().toISOString().slice(0, 10);
const nameOf = Object.fromEntries((sp.products || []).map(p => [p.id, p.name]));
const nowPrice = Object.fromEntries((sp.products || []).filter(p => p.priceMedian).map(p => [p.id, p.priceMedian]));

// A published figure is suspect if it moved far enough, fast enough, that the
// market almost certainly did not do it — the same signature as a filter bug.
// 40% inside 3 days on a sealed product is not a market event; it is us.
const IMPLAUSIBLE = 0.40, WINDOW_DAYS = 3;

const byId = {};
for (const r of hh) if (r.price) (byId[r.id] ||= []).push({ date: r.date, price: r.price });
for (const id of Object.keys(byId)) byId[id].sort((a, b) => a.date < b.date ? -1 : 1);

const findings = [];
for (const [id, series] of Object.entries(byId)) {
  if (series.length < 2) continue;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1], cur = series[i];
    const days = Math.round((Date.parse(cur.date) - Date.parse(prev.date)) / 86400000);
    if (days > WINDOW_DAYS || !prev.price) continue;
    const move = cur.price / prev.price - 1;
    if (Math.abs(move) < IMPLAUSIBLE) continue;
    // A jump this size on a sealed product in this window is far more likely to
    // be our measurement changing than the market moving. Flag it as suspect
    // rather than asserting either — the No-Guessing Law applies to us too.
    findings.push({ id, name: nameOf[id] ?? id, from: prev.date, to: cur.date,
      was: prev.price, became: cur.price, movePct: Math.round(move * 1000) / 10,
      published: true,
      read: `A ${Math.abs(Math.round(move * 100))}% move over ${days} day(s) on a sealed product is more consistent with a change in how we measured it than with the market. Both figures were published.`,
      action: "verify against listings; if the earlier figure was an artefact, file a correction" });
  }
}

// Second pass: did anything we FEATURED turn out to be unmeasurable afterwards?
const featured = (wlog.entries || []).flatMap(e => [e.sealed, e.raw].filter(Boolean).map(p => ({ ...p, date: e.date })));
const vanished = featured.filter(f => f.id && !nowPrice[f.id] && f.date < today);

const mood = findings.length ? pickLine(VOICE.suspect)
  : vanished.length ? pickLine(VOICE.vanished, 1)
  : pickLine(VOICE.clean);
const report = { generatedAt: new Date().toISOString(), date: today, mood,
  note: "Re-checks numbers we already published. Flags are SUSPECT, not proven wrong — each needs a human or CC to verify against listings before a correction is filed.",
  window: `${IMPLAUSIBLE * 100}% inside ${WINDOW_DAYS} days`,
  suspectFigures: findings.sort((a, b) => Math.abs(b.movePct) - Math.abs(a.movePct)).slice(0, 20),
  featuredThenUnmeasurable: vanished.map(v => ({ name: v.name, featuredOn: v.date,
    read: "we put this in front of readers and can no longer price it — either it stopped trading or our query broke" })),
  draftCorrections: findings.slice(0, 5).map(f => ({ product: f.name,
    draft: `We published ${f.name} at $${f.was} on ${f.from} and $${f.became} on ${f.to}. A ${Math.abs(f.movePct)}% move in that window is unlikely to be the market. One of those two figures was probably ours rather than the market's, and we are checking which.` })) };

await writeFile(join(ROOT, "research/pulse/correction-hunt.json"), JSON.stringify(report, null, 1));
console.log(`\n  ${mood}\n`);
console.log(`✓ correction hunter: ${findings.length} suspect figure(s), ${vanished.length} featured-then-unmeasurable`);
for (const f of report.suspectFigures.slice(0, 6)) console.log(`  ${f.movePct > 0 ? "+" : ""}${f.movePct}%  ${f.name.slice(0, 34).padEnd(34)} $${f.was} → $${f.became} (${f.from}→${f.to})`);
if (vanished.length) for (const v of report.featuredThenUnmeasurable.slice(0, 3)) console.log(`  GONE   ${v.name} — featured ${v.featuredOn}, no price today`);
