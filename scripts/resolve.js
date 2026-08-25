// resolve.js — the prompt picks the cards. Nothing else gets to override it.
//
// Tyler, 2026-08-24: "It's still showing the wrong cards. How do we keep coming
// into this problem?"
//
// THE ANSWER TO THAT QUESTION IS UNCOMFORTABLE AND WORTH WRITING DOWN. I put
// this in ask-smoke's own blind-spot file and never closed it:
//
//   "Whether the cards it returns are the RIGHT ones. It proves every prompt
//    fills the tray; it has no view on whether 'something dark' returned
//    anything actually dark."
//
// So the test went green on every build while the output was wrong. **I
// documented the exact gap and then trusted the test that declared it.**
//
// THE BUG ITSELF: a parsed prompt set filters AND selected a theme, then handed
// off to the theme builder — which picks from its own pool and never consults
// those filters. "charizard through the years" parsed Charizard correctly and
// returned Alakazam. "fire types" returned Gyarados, which is Water.
//
// THE FIX: the prompt resolves its own cards. Every constraint is applied as a
// filter, in order, and each one can only ever REMOVE cards. A theme may
// suggest an ordering; it may never widen the pool past what was asked for.

function resolvePrompt(found, INDEX, helpers) {
  const { monName, attrs, ratingOf, HERO_RX } = helpers;
  const why = [];

  // START WIDE, NARROW ONLY. Every clause below removes cards and none adds
  // any. That property is what makes the result explainable — and it is exactly
  // what the theme handoff broke.
  let pool = INDEX.slice();
  const narrow = (fn, label) => {
    const next = pool.filter(fn);
    // NEVER NARROW TO NOTHING SILENTLY. Dropping a constraint is sometimes
    // right, but doing it without saying so is how you get confident wrong
    // output — which is the whole complaint.
    if (!next.length) { why.push(label + " (skipped — nothing matched)"); return; }
    pool = next; why.push(label);
  };

  // THE POKEMON IS THE HARDEST CONSTRAINT. If somebody names one, every card
  // returned must be it. This is the clause the theme handoff ignored.
  if (found.mon) narrow(c => monName(c.n) === found.mon, found.mon);

  // POKEMON ONLY, unless a Trainer was explicitly asked for. "Cards nobody
  // talks about" returned Erika's Invitation and Giovanni's Charisma — both
  // Trainers, neither a card anybody means by that phrase.
  if (!found.trainerOk) narrow(c => { const a = attrs[c.i]; return a && a.dex; }, "Pokémon only");

  if (found.artist) narrow(c => c.a === found.artist, found.artist);
  if (found.set) narrow(c => c.s === found.set, found.set);

  // THE PRINTED TYPE, from the type field — not from the name, and not from
  // what the video game says. "Fire types" returned Gyarados because the type
  // was parsed and then never applied.
  if (found.type) narrow(c => { const a = attrs[c.i]; return a && (a.t || []).indexOf(found.type) >= 0; }, found.type + " type");

  if (found.rating) narrow(c => (ratingOf(c.i, found.rating) || 0) >= 6, found.rating);

  // OBSCURE IS A REAL QUERY, not a vibe: a Pokémon with few printings, an
  // illustrated card, and not one of the names everybody already says.
  if (found.shape === "obscure") {
    const counts = {};
    for (const c of INDEX) { const m = monName(c.n); if (m) counts[m] = (counts[m] || 0) + 1; }
    const FAMOUS = /Charizard|Pikachu|Eevee|Umbreon|Mewtwo|Rayquaza|Lugia|Gengar|Blastoise|Venusaur|Sylveon|Espeon|Snorlax/i;
    narrow(c => counts[monName(c.n)] <= 8 && !FAMOUS.test(c.n) && HERO_RX.test(c.r || ""), "rarely printed");
  }

  // Everything shown must be worth showing, and must credit its artist.
  narrow(c => c.a, "credited");
  const withHero = pool.filter(c => HERO_RX.test(c.r || ""));
  if (withHero.length >= (found.count || 2)) { pool = withHero; why.push("hero rarities"); }

  const n = found.count || (found.shape === "evo-line" ? 3 : 2);

  // ONE CARD PER POKEMON, unless the shape is about one Pokémon over time.
  // Nine Charizards is a composition; nine different Pokémon is a set.
  const acrossTime = found.shape === "eras" || found.shape === "power-creep" || found.mon;
  let picked;
  if (acrossTime && found.mon) {
    // Oldest to newest, spread across the years rather than clustered.
    const byYear = pool.slice().sort((a, b) => String(a.y).localeCompare(String(b.y)));
    if (byYear.length <= n) picked = byYear;
    else {
      picked = [];
      const step = (byYear.length - 1) / (n - 1);
      for (let i = 0; i < n; i++) picked.push(byYear[Math.round(i * step)]);
    }
    why.push("spread across the years");
  } else {
    const best = {};
    for (const c of pool) { const k = monName(c.n);
      if (!best[k] || (c.p || 0) > (best[k].p || 0)) best[k] = c; }
    picked = Object.values(best).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, n);
  }

  return { cards: picked, why, poolSize: pool.length };
}

if (typeof window !== "undefined") window.resolvePrompt = resolvePrompt;
