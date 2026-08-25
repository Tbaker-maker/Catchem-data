# CC: verify the editor on a real device

**Everything below is what I can prove from a sandbox. What I cannot prove is
whether any of it is true on a phone — and I have been wrong about that three
times, so treat my green as unverified until you have seen it.**

## THE AUDIT, run just now
All sixteen pass: audit-honesty · journey-smoke · offline-smoke · theme-smoke ·
ask-smoke · evo-smoke · editor-hostile · editor-copy-rules · editor-claim-match ·
editor-money-credit · rating-guard · crop-guard · tease-guard · slop-guard ·
memory-guard · knowledge-guard.

Guard audit 16 wired / 37 pipeline steps. Pre-mortem 37 with declared blind
spots. Negative tests 64/66.

Fixed this round:
- **One failed image killed the whole image.** The compose threw on the first
  card that would not load, so one blocked request produced NOTHING. It now
  leaves a labelled gap and names the missing cards.
- **`pichu evolution` returned one card.** A Pikachu card is a Basic and never
  prints "evolves from Pichu" — the game rule and the card rule differ, like the
  type field. Eighteen baby links added from a closed, documented list.
  **16 of 16 named evolution lines now resolve.**

## WHAT I NEED FROM YOU — screenshots, not descriptions
Open `research/assets/build.html` on a real phone. **I have burned four rounds
on inference; a screenshot ends it.**

1. **Does it load?** Screenshot the amber status panel at the top. It reports
   the real counts or the actual error and line number.
2. **Type `charizard evolution from 151`.** How many cards appear?
3. **Press "Make the image."** Screenshot whatever appears, including the status
   line underneath.
4. **Press and hold the image.** Does "Save Image" appear?
5. **If images are blank**, open the console and screenshot it. I need to know
   whether it is `net::ERR_` on `images.pokemontcg.io` or something else — those
   are different problems with different fixes.

## THEN FIX WHAT YOU FIND
You have the device and the browser; I have neither. **If the fix is obvious,
make it and push.** If it is not, send me the screenshot and I will.

## THE STANDING INSTRUCTION
When I report a surface as audited, **check whether the test drove the FAILING
path** before believing it. Three times I reported green on a test that faked
the thing that actually breaks: a fetch that always succeeded, a desktop DOM
standing in for mobile, and images that always loaded.

`audit-honesty.mjs` now fails the build when a guard fakes a dependency it
exercises without testing that dependency failing — but **it only knows the
failure modes we have already hit.** You are the check on the ones we have not.
