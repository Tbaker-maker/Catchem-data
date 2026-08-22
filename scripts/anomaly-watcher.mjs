// anomaly-watcher.mjs — the first agent that watches the MARKET, not us.
//
// Every other agent in this fleet examines our own work: are the numbers right,
// are the guards wired, is the copy honest, does the app hold together. Not one
// of them looks outward. So the market can do something genuinely strange and
// the only thing that notices is Tyler, by eye, if he happens to look.
//
// This asks a different question: is today unusual COMPARED TO OUR OWN RECENT
// HISTORY? Not "is this number wrong" — the QA gate owns that — but "is this
// number surprising", which is the beginning of every story worth telling.
//
// THE DISCIPLINE THAT KEEPS IT HONEST: unusual is not the same as meaningful.
// A thin market produces outliers constantly. Everything here is a READ, every
// finding carries how much history it is judging against, and when the history
// is too short it says so instead of manufacturing significance from four days.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rotate } from "./rotate.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const hh = await J("data/heat-history.json") ?? [];
const der = await J("data/derived-insights.json") ?? {};
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const ixh = await J("research/pulse/index-history.json") ?? { entries: [] };
const nameOf = Object.fromEntries((sp.products || []).map(p => [p.id, p.name]));

// How much history are we judging against? Everything downstream is scaled by
// this, and stated in every finding, because a "2-sigma move" against four days
// of tape is not a finding — it is arithmetic with a costume on.
const days = [...new Set(hh.filter(r => r.price).map(r => r.date))].sort();
const DEPTH = days.length;
const MIN_DEPTH = 8;

const findings = [];
const A = (kind, what, why, confidence) => findings.push({ kind, what, why, confidence, chip: "READ", historyDays: DEPTH });

if (DEPTH < MIN_DEPTH) {
  A("not yet", `Only ${DEPTH} days of tape.`,
    `Anomaly detection compares today against a distribution, and ${DEPTH} days is not a distribution. Saying so is the honest answer; a "2-sigma move" measured against four days would be arithmetic wearing a costume.`,
    "none");
} else {
  // Build each product's return series from the clean cut.
  const byId = {};
  for (const r of hh) if (r.price) (byId[r.id] ||= []).push({ date: r.date, price: r.price });
  for (const k of Object.keys(byId)) byId[k].sort((a, b) => a.date < b.date ? -1 : 1);

  const todaysReturns = [];
  const stats = {};
  for (const [id, s] of Object.entries(byId)) {
    if (s.length < MIN_DEPTH) continue;
    const rets = [];
    for (let i = 1; i < s.length; i++) if (s[i - 1].price) rets.push(s[i].price / s[i - 1].price - 1);
    if (rets.length < MIN_DEPTH - 1) continue;
    const today = rets[rets.length - 1];
    const prior = rets.slice(0, -1);
    const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
    const sd = Math.sqrt(prior.reduce((a, r) => a + (r - mean) ** 2, 0) / prior.length);
    stats[id] = { today, mean, sd, n: prior.length };
    todaysReturns.push({ id, ret: today, z: sd > 0 ? (today - mean) / sd : 0 });
  }

  // 1 — A PRODUCT BEHAVING UNLIKE ITSELF. Judged against its OWN history, so a
  // normally volatile product is not flagged for being volatile.
  for (const t of todaysReturns.filter(t => Math.abs(t.z) >= 3 && Math.abs(t.ret) >= 0.08).slice(0, 5))
    A("product", `${nameOf[t.id] ?? t.id} moved ${(t.ret * 100).toFixed(1)}% — about ${Math.abs(t.z).toFixed(1)}× its own typical daily swing.`,
      `Measured against its own ${stats[t.id].n} days of history, not against other products. A product that normally moves a lot is not flagged for moving a lot.`,
      DEPTH >= 20 ? "reasonable" : "thin");

  // 2 — A WHOLE CLASS MOVING TOGETHER. One product moving is noise; a class
  // moving in step is the market deciding something.
  {
    const bySub = {};
    for (const t of todaysReturns) {
      const p = (sp.products || []).find(x => x.id === t.id);
      if (p?.subtype) (bySub[p.subtype] ||= []).push(t.ret);
    }
    for (const [sub, rets] of Object.entries(bySub)) {
      if (rets.length < 5) continue;
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const sameWay = rets.filter(r => Math.sign(r) === Math.sign(mean) && Math.abs(r) > 0.01).length;
      if (Math.abs(mean) >= 0.03 && sameWay / rets.length >= 0.75)
        A("class", `${sub} moved ${(mean * 100).toFixed(1)}% on average, with ${sameWay} of ${rets.length} going the same way.`,
          `One product moving is noise. A class moving together is usually the market deciding something about the whole shelf, and it is the shape worth a second look.`,
          "reasonable");
    }
  }

  // 3 — THE INDEX MOVING WITHOUT BREADTH, OR BREADTH WITHOUT THE INDEX.
  // A divergence between the two means a few products are carrying the day.
  {
    const six = der.sealedIndex;
    if (six && six.ddPct != null && six.breadth) {
      const { up, down } = six.breadth;
      const netBreadth = (up - down) / Math.max(1, up + down);
      if (Math.abs(six.ddPct) >= 0.5 && Math.sign(six.ddPct) !== Math.sign(netBreadth) && Math.abs(netBreadth) > 0.1)
        A("index", `The index moved ${six.ddPct > 0 ? "up" : "down"} ${Math.abs(six.ddPct)}% while more products went the other way (${up} up, ${down} down).`,
          `That means a small number of products carried the whole move. Worth knowing before anyone reads the index as "the market did X" — on a day like this it did not.`,
          "reasonable");
    }
  }

  // 4 — UNUSUAL STILLNESS. Nothing moving is also information, and nobody
  // reports it because it does not look like news.
  {
    const moved = todaysReturns.filter(t => Math.abs(t.ret) >= 0.01).length;
    const share = todaysReturns.length ? moved / todaysReturns.length : 1;
    if (todaysReturns.length >= 20 && share <= 0.1)
      A("stillness", `Only ${moved} of ${todaysReturns.length} products moved at all today.`,
        `Unusual stillness is real information and almost nobody reports it, because it does not look like news. A market holding its breath is a market waiting for something.`,
        "reasonable");
  }
}

const VOICE = ["Looked at the market rather than at us for once.",
  "What did the market do today that it does not usually do?",
  "Everything else here checks our work. This one checks the world."];
const out = { generatedAt: new Date().toISOString(),
  watches: "the market, not us — the first agent in this fleet pointed outward",
  historyDays: DEPTH,
  discipline: "Unusual is not the same as meaningful. Everything is a READ, every finding says how much history it is judging against, and too little history produces an honest refusal rather than manufactured significance.",
  findings };
await writeFile(join(ROOT, "research/pulse/anomaly-report.json"), JSON.stringify(out, null, 1));
console.log(`\n  ${rotate(VOICE)}\n`);
console.log(`✓ anomaly watcher: ${findings.length} finding(s) against ${DEPTH} days of history`);
for (const f of findings.slice(0, 6)) console.log(`  ${String(f.kind).padEnd(10)} ${f.what}`);
