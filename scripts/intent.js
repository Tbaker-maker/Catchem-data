// intent.js — one box instead of six panels.
//
// Tyler, 2026-08-24: "Our UI is way too sloppy and confusing… maybe do prompts
// just like Claude does so it doesn't feel overwhelming. At the moment it does."
//
// He is right, and my own research said so before I built it: **"one clear
// primary action, never more than one CTA"** — and the editor opens with six
// panels competing. I read that finding, wrote it into house-theses, and then
// shipped the opposite.
//
// BUT A BARE TEXT BOX FAILS TOO, for a reason the research also names:
// **"capability ambiguity is the last failure point — users cannot see what the
// system understands, so without visible examples it starts with guesswork."**
// So: one box, example chips that fill it in a tap, and a recovery path that
// SUGGESTS rather than erroring, because redirecting unclear queries to
// structured suggestions "reduced abandonment significantly".
//
// AND IT IS NOT AN LLM. This is a static file with no key and no network. Every
// match here is against data already in the page — Pokémon names, artists, sets,
// types, ratings, moods — which means it can only find things that genuinely
// exist. That is a feature: it cannot hallucinate a card.
//
// WHEN IT DOES NOT UNDERSTAND, it says what it DID find and offers the nearest
// real thing. "I don't know that one" is the sentence that loses a user.

function parseIntent(text, ctx) {
  const q = String(text || "").toLowerCase().trim();
  if (!q) return null;
  const found = { count: null, mon: null, artist: null, set: null, type: null,
    rating: null, mood: null, shape: null, matched: [], missed: [] };

  // COUNT. People say "four cards" and "a pair" and "9" — all the same thing.
  const words = { one: 1, two: 2, three: 3, four: 4, six: 6, nine: 9, pair: 2, single: 1 };
  const num = q.match(/\b(\d+)\s*(cards?|of them)?\b/);
  if (num && [1, 2, 3, 4, 6, 8, 9].includes(Number(num[1]))) { found.count = Number(num[1]); found.matched.push(found.count + " cards"); }
  else for (const [w, n] of Object.entries(words)) if (new RegExp("\\b" + w + "\\b").test(q)) { found.count = n; found.matched.push(n + " cards"); break; }

  // POKÉMON. Longest name first, so "mr. mime" beats "mime".
  // NOT CREATURE NAMES. "Dark", "Light", "Team" and "Mega" are form prefixes,
  // and "dark" in a sentence means the mood, not Dark Charizard. Fifth time the
  // prefix problem has surfaced.
  const NOT_MON = /^(dark|light|team|mega|shadow|crystal|shining|radiant|energy|great|iron|roaring|walking|raging|scream|brute|flutter|sandy|gouging|slither)$/i;
  const mons = (ctx.monNames || []).filter(m => !NOT_MON.test(m)).slice().sort((a, b) => b.length - a.length);
  for (const m of mons) {
    if (m.length < 4) continue;
    if (new RegExp("\\b" + m.toLowerCase().replace(/[^a-z0-9']/g, ".") + "\\b").test(q)) { found.mon = m; found.matched.push(m); break; }
  }

  // ARTIST. Surname alone is how people actually refer to them.
  for (const a of (ctx.artists || [])) {
    const last = a.split(" ").pop().toLowerCase();
    if (last.length >= 5 && q.includes(last)) { found.artist = a; found.matched.push(a); break; }
  }

  // SET.
  for (const s of (ctx.sets || []).slice().sort((a, b) => b.length - a.length)) {
    if (s.length >= 5 && q.includes(s.toLowerCase())) { found.set = s; found.matched.push(s); break; }
  }

  // TYPE — the printed card type, which differs from the game type.
  for (const t of ["fire", "water", "grass", "lightning", "psychic", "fighting", "darkness", "metal", "dragon", "fairy", "colorless"])
    if (new RegExp("\\b" + t + "\\b").test(q)) { found.type = t[0].toUpperCase() + t.slice(1); found.matched.push(found.type + " type"); break; }

  // RATINGS, in the words people use rather than our field names.
  const RATING = [
    [/\b(cute|adorable|sweet|wholesome)\b/, "cute", "cute"],
    [/\b(funny|silly|joke|stupid|ridiculous)\b/, "comedy", "funny"],
    [/\b(dark|grim|creepy|scary|unsettling|sinister)\b/, "serious", "dark"],
    [/\b(cheap|budget|under a|affordable|low.cost)\b/, "cheap", "cheap"],
    [/\b(expensive|dear|grail|pricey|chase)\b/, "dear", "expensive"],
    [/\b(rare|scarce|hard to find)\b/, "scarce", "scarce"],
    [/\b(beautiful|gorgeous|art|artwork|stunning|pretty)\b/, "artprem", "art people pay for"],
  ];
  for (const [rx, id, label] of RATING) if (rx.test(q)) { found.rating = id; found.matched.push(label); break; }

  // MOOD.
  for (const m of (ctx.moods || []))
    if (q.includes(m.label.toLowerCase()) || (m.id === "tired" && /\b(tired|wiped|exhausted|late night|sleepy)\b/.test(q))
      || (m.id === "bright" && /\b(good morning|morning|sunrise|gm)\b/.test(q))) { found.mood = m.id; found.matched.push(m.label); break; }

  // SHAPE — the phrasing that names a format.
  const SHAPE = [
    [/\b(nobody talks about|obscure|underrated|forgotten|no one mentions|unknown)\b/, "obscure", "cards nobody talks about"],
    [/\b(evolution|whole line|evolves|line)\b/, "evo-line", "the evolution line"],
    [/\b(years apart|over time|through the years|across eras|decades)\b/, "eras", "across the years"],
    [/\b(same artist|one artist|by the same)\b/, "artist-span", "one artist, years apart"],
    [/\b(power creep|hp over time|stronger)\b/, "power-creep", "power creep"],
    [/\b(story|lore|says about itself|flavou?r text)\b/, "lore-self", "what the card says"],
    [/\b(vs|versus|or |battle|which is better)\b/, "battle", "a battle"],
  ];
  for (const [rx, id, label] of SHAPE) if (rx.test(q)) { found.shape = id; found.matched.push(label); break; }

  found.understood = found.matched.length > 0;
  return found;
}

// WHAT IT DID NOT UNDERSTAND, said usefully. The research is explicit that
// redirecting an unclear query to structured suggestions rather than a generic
// failure "reduced abandonment significantly" — so this never says "I don't
// know that one", which is the sentence that loses a user.
function intentReply(found, ctx) {
  if (!found || !found.understood) {
    return { ok: false,
      say: "I didn't catch anything I hold data on. Try naming a Pokémon, an artist, a set, or a feeling — or tap one of the examples.",
      suggest: ctx.examples.slice(0, 4) };
  }
  const bits = found.matched.join(" · ");
  return { ok: true, say: "Showing " + bits + ".", found };
}

if (typeof window !== "undefined") { window.parseIntent = parseIntent; window.intentReply = intentReply; }
