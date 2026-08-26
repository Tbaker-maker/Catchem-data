// ── REVEAL WATCH ───────────────────────────────────────────────────────────
// release-radar.json tracks PRODUCT RELEASES: set dates, tin SKUs, distributor
// confirmations. Stable facts with long shelf lives — a release date is useful
// for months and a six-day-old radar entry is still true.
//
// A CARD REVEAL RUNS ON A DIFFERENT CLOCK. It is useful for a day, sometimes an
// afternoon, and most of the value is in being early. Same pipeline, wrong
// cadence, wrong shape — so it gets its own file rather than being bolted onto
// a radar built for things that do not move.
//
// WHAT WE ARE ACTUALLY FOR, and it is not speed. We will never win the race to
// post a reveal first: dedicated news accounts are faster, they are staffed for
// it, and it is their whole job. Competing on that is choosing a fight we lose
// every time.
//
// What we hold that they do not is the illustrator's ENTIRE BACK CATALOGUE, in
// a form we can query in milliseconds. The moment a card is revealed we can say
// "Uninori also drew these" with six cards and their sets — a post nobody else
// can make within minutes of a reveal, and education through surprise rather
// than a race. THAT is the post. The reveal is the trigger, not the product.
//
// NOTHING HERE POSTS. Reveals land in a queue for Tyler. The confirm gate exists
// for compliance reasons and a fast-moving feed is exactly the place somebody
// would be tempted to skip it — so this file does not import the send path, and
// reveal-watch-guard.mjs fails the build if it ever does.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCards, artistRevisits } from "./card-relations.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/reveal-watch.json");

// The run this repo actually has. Used to compute what our cadence WOULD have
// caught, which is the measurement that decides whether to change it.
const RUN_HOUR_UTC = 13;

const EMPTY = {
  note: "Individual CARD reveals, which run on a different clock from product releases. Nothing here posts; everything is queued for Tyler.",
  sources: [],
  reveals: [],
  cadence: { runHourUtc: RUN_HOUR_UTC, note: "Lag is measured before the schedule is touched. See lagReport().", samples: [] },
};

const load = async () => {
  try { return JSON.parse(await readFile(FILE, "utf-8")); } catch { return structuredClone(EMPTY); }
};
const save = async (s) => writeFile(FILE, JSON.stringify(s, null, 1) + "\n");

// ── THE ANGLE ──────────────────────────────────────────────────────────────
// Given a freshly revealed card's illustrator, what else have they drawn? This
// is the whole reason the watch exists, so it runs on every record rather than
// being an optional extra somebody remembers to invoke.
export async function illustratorAngle(artist, { limit = 8 } = {}) {
  if (!artist) return { artist: null, held: 0, why: "the reveal carried no illustrator credit" };
  const { cards, index } = await loadCards();
  const ids = index.byArtist.get(artist) ?? [];
  if (!ids.length) {
    // A NEW ILLUSTRATOR IS A FINDING, NOT A FAILURE. "This is the first card
    // they have drawn for the game" is itself a post, and saying nothing
    // because a lookup came back empty would waste it.
    return { artist, held: 0, firstAppearance: true,
      why: `${artist} has no other cards in our catalogue — on our data this is their first.` };
  }
  const all = ids.map(i => cards.get(i)).filter(Boolean);
  const withYear = all.filter(c => c.year).sort((a, b) => a.year - b.year);
  const dearest = [...all].filter(c => typeof c.price === "number")
    .sort((a, b) => b.price - a.price).slice(0, limit);
  const revisits = (await artistRevisits({ minGap: 10, limit: 200 }))
    .filter(r => r.evidence.artist === artist);

  return {
    artist,
    held: all.length,
    span: withYear.length >= 2 ? { from: withYear[0].year, to: withYear[withYear.length - 1].year } : null,
    sets: [...new Set(all.map(c => c.set).filter(Boolean))].sort(),
    dearest: dearest.map(c => ({ id: c.id, name: c.name, set: c.set, year: c.year, price: c.price })),
    revisits: revisits.map(r => ({ pokemon: r.evidence.name, gap: r.evidence.gap, cards: r.cards })),
    // The line is assembled from counted values only. It states and does not
    // judge, for the same reason the SET_DEPTH reason line does.
    line: `${artist} has ${all.length} card${all.length === 1 ? "" : "s"} in our catalogue` +
      (withYear.length >= 2 ? `, from ${withYear[0].year} to ${withYear[withYear.length - 1].year}` : "") +
      (revisits.length ? `, and has drawn the same Pokémon twice ${revisits.length} time${revisits.length === 1 ? "" : "s"}` : "") + ".",
  };
}

// ── RECORD A REVEAL ────────────────────────────────────────────────────────
export async function record(reveal) {
  const state = await load();
  const now = new Date().toISOString();

  const key = (r) => `${(r.name || "").toLowerCase()}|${(r.set || "").toLowerCase()}|${r.number || ""}`;
  const existing = state.reveals.find(r => key(r) === key(reveal));
  if (existing) {
    // Merge, never duplicate. A second sighting of the same card on another
    // site is evidence about SOURCE SPEED, which is the thing being measured.
    existing.alsoSeenAt = existing.alsoSeenAt || [];
    if (reveal.source && reveal.source !== existing.source &&
        !existing.alsoSeenAt.some(s => s.source === reveal.source)) {
      existing.alsoSeenAt.push({ source: reveal.source, at: reveal.publishedAt || now, url: reveal.url || null });
    }
    await save(state);
    return existing;
  }

  const angle = await illustratorAngle(reveal.illustrator);
  const published = reveal.publishedAt ? new Date(reveal.publishedAt) : null;

  const entry = {
    name: reveal.name,
    set: reveal.set ?? null,
    number: reveal.number ?? null,
    illustrator: reveal.illustrator ?? null,
    hp: reveal.hp ?? null,
    attacks: reveal.attacks ?? [],
    revealedAt: reveal.source ?? null,
    url: reveal.url ?? null,
    publishedAt: reveal.publishedAt ?? null,
    firstSeenAt: now,
    // The angle is stored WITH the reveal, so the post can be written from the
    // record without re-deriving it and getting a different answer later.
    angle,
    status: "QUEUED FOR TYLER",
    posted: false,
  };

  // ── THE CADENCE MEASUREMENT ──────────────────────────────────────────────
  // Recorded per reveal rather than argued about. If the median gap turns out
  // to be hours, cadence is the problem. If reveals cluster in Japanese
  // business hours, the run TIME is the problem and running twice as often
  // fixes nothing. The schedule is not touched until this says which.
  if (published && !isNaN(published)) {
    const next = new Date(published);
    next.setUTCHours(RUN_HOUR_UTC, 0, 0, 0);
    if (next < published) next.setUTCDate(next.getUTCDate() + 1);
    const lagHours = (next - published) / 3600000;
    state.cadence.samples.push({
      card: reveal.name,
      source: reveal.source ?? null,
      publishedAt: reveal.publishedAt,
      publishedHourUtc: published.getUTCHours(),
      wouldHaveCaughtAt: next.toISOString(),
      lagHours: Math.round(lagHours * 10) / 10,
    });
  }

  state.reveals.unshift(entry);
  await save(state);
  return entry;
}

// ── WHAT THE SAMPLES SAY ───────────────────────────────────────────────────
export async function lagReport() {
  const state = await load();
  const s = state.cadence.samples;
  if (s.length < 5) {
    return { verdict: "NOT ENOUGH DATA", n: s.length,
      says: `${s.length} sample(s). This needs a week of reveals before it can say anything. Changing the schedule now would be guessing with extra steps.` };
  }
  const lags = s.map(x => x.lagHours).sort((a, b) => a - b);
  const median = lags[Math.floor(lags.length / 2)];
  // Japanese business hours are roughly 00:00–09:00 UTC (09:00–18:00 JST).
  const jp = s.filter(x => x.publishedHourUtc >= 0 && x.publishedHourUtc < 9).length;
  const jpShare = jp / s.length;

  return {
    verdict: jpShare >= 0.6 ? "RUN TIME, NOT FREQUENCY" : median >= 8 ? "CADENCE" : "CURRENT CADENCE IS FINE",
    n: s.length,
    medianLagHours: median,
    publishedInJapaneseBusinessHours: `${jp}/${s.length} (${Math.round(jpShare * 100)}%)`,
    says: jpShare >= 0.6
      ? `${Math.round(jpShare * 100)}% of reveals publish between 00:00 and 09:00 UTC. Running more often does not help; moving the run to just after that window does. Running twice a day at the wrong two times is the same miss twice.`
      : median >= 8
        ? `Median lag ${median}h with reveals spread across the clock. This is a frequency problem.`
        : `Median lag ${median}h. The current 13:00 UTC run is catching reveals about as fast as a daily run can.`,
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const val = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };

  if (cmd === "add") {
    const e = await record({
      name: val("name"), set: val("set"), number: val("number"),
      illustrator: val("illustrator"), hp: val("hp") ? Number(val("hp")) : null,
      attacks: (val("attacks") || "").split(",").map(s => s.trim()).filter(Boolean),
      source: val("source"), url: val("url"), publishedAt: val("published"),
    });
    console.log(`\n  RECORDED — ${e.name}${e.set ? " · " + e.set : ""}`);
    console.log(`  ${e.status}\n`);
    console.log(`  THE ANGLE: ${e.angle.line || e.angle.why}`);
    if (e.angle.dearest?.length) {
      console.log(`  also drew:`);
      for (const c of e.angle.dearest.slice(0, 6))
        console.log(`     ${c.name} · ${c.set} · ${c.year}${c.price ? " · $" + c.price : ""}`);
    }
    console.log("");
  } else if (cmd === "lag") {
    const r = await lagReport();
    console.log(`\n  CADENCE — ${r.verdict}`);
    console.log(`  ${r.says}\n`);
  } else if (cmd === "list") {
    const state = await load();
    console.log(`\n  ${state.reveals.length} reveal(s) · ${state.reveals.filter(r => !r.posted).length} queued for Tyler\n`);
    for (const r of state.reveals.slice(0, 15))
      console.log(`  ${r.firstSeenAt.slice(0, 16)}  ${r.name} · ${r.illustrator ?? "no credit"} · ${r.status}`);
    console.log("");
  } else {
    console.log(`
  reveal-watch — individual card reveals, queued for Tyler, never posted.

    node scripts/reveal-watch.mjs add --name Slowpoke --set "30th Celebration" \\
        --illustrator Uninori --hp 80 --attacks "Well-Hidden,Water Gun" \\
        --source pokebeach --published 2026-08-25T04:10:00Z
    node scripts/reveal-watch.mjs lag     what the cadence samples say
    node scripts/reveal-watch.mjs list    what is queued
`);
  }
}
