# Experience walk — the eight questions, and the rule that ate the page (2026-08-22)

`node scripts/audit.mjs` → **20/20** · `node scripts/negative-tests.mjs` → **30/30**

## The finding that reframes everything

Before the walk, Today was **26 screens of scroll on a 390px phone for 3.5
screens of content.** Not 17 sections competing — one CSS declaration.

`.c3` carried `height:100%` on its base rule. That belongs to the desktop grid,
where it makes cards in a row match heights. On a phone `.tk-phone` is a block
inside a **row** flex parent, so it has a definite height, and `100%` resolved
against the whole page. Every direct-child card became ~2,880px tall.

Seven cards — Rip or Hold plus all six movers — at **2,882px each**. The
Rip-or-Hold card is one sentence of text and was 2,882px tall.

| | before | after |
|---|---|---|
| page height | 21,906px | **2,966px** |
| screens (390×844) | 26 | **3.5** |
| cards over 1,500px | 7 | **0** |
| Rip-or-Hold card | 2,882px | **94px** |

Desktop verified unchanged at 1280px: three columns, equal heights within each
row. **Block 2's premise was wrong** — ranking sections would have moved deck
chairs past a reader who was meeting six cards each taller than their phone.

## BLOCK 1 — the eight questions

Caveat first: **no phone, no mobile data, and no screenshots** — the browser
pane here does not composite, so every "does it look right" answer below is
measurement plus code reading, not eyes. Questions 3–8 are exactly the ones
that need eyes. I answer what I can measure and say plainly where I cannot.

**1. Scrolls to the first number you'd act on.** The first `$` is at y=275,
**0.33 scrolls** — above the fold. But it is `$1,499.99`, a Sun & Moon *era
band* figure, not something you act on. The first *actionable* number — a
product with a price you could watch or buy — is the Daily Three sealed pick at
y≈429, **0.51 scrolls**. Both above the fold; neither was, before the fix,
followed by anything scannable.

**2. Seconds to anything readable.** domInteractive **33ms**, load **79ms**,
feed **30ms** — call it ~0.3s here. That is a fast line off a warm CDN, so read
it as a floor, not a phone. The feed is 189KB; on genuinely poor mobile data
that is seconds, still inside the three-second bar. **Not measured on mobile
data** — Tyler's leg.

**3. Do the Daily Three look like siblings?** Measured: **240 / 168 / 150px** —
a 90px spread, and the CHASE card carries **no photo** because the feed's
`dailyThree.raw` has no `imageUrl` key at all. So: three sizes, two with
photos, one without. Mechanically they are not siblings. Whether that reads as
sloppy or as variety needs eyes.

**4. Is the index the first thing the eye lands on?** Cannot answer — that is
a visual-weight question. Structurally it is first: `SEALED INDEX` at y=123,
above everything. What competes is directly beneath it — four era bands each
carrying a large price, the biggest of which (`$1,499.99`) is numerically
louder than the index level (`100`).

**5. Squint test — which three things stand out?** Cannot answer without eyes.

**6. Does anything look like an ad, a warning, or an error?** Cannot judge
appearance. One structural candidate: the mode picker block ("SET THE APP UP
FOR YOU") sat at screen **25.5 of 26** before the fix — an onboarding prompt
below everything. It is now at the end of a 3.5-screen page, which is a very
different thing.

**7. Anywhere a first-timer wouldn't know what to do next?** Yes, and it is
structural: **the Today screen has zero links.** Discord is named in text and is
not clickable; there is no path to the site. Reported in the rehearsal, still
true.

**8. Same company as the site?** The palette is now provably identical — all 11
hardcoded hex values routed through the same tokens the site uses. Beyond
colour, this is a judgment call I cannot make.

## BLOCK 2 — the ranking, reported and NOT implemented

Instruction was to report before implementing. I am reporting, and
recommending **we do not implement it yet**, because the fix above changed the
problem: 17 sections across 3.5 screens is a different page from 17 across 26.

Ranked by how often a reader would plausibly act:
1. **Sealed Index + breadth** — the one-number reason to open the app daily
2. **The Daily Three** — the editorial pick, the thing to come back for
3. **Biggest movers** — the "did anything happen" scan
4. **Rip or Hold** — participation, cheap and habitual
5. **Era bands** — orientation, read once then rarely
6. **Release radar / print watch** — acted on monthly, not daily
7. **Mode picker** — acted on *once*, then never again
8. **Did-you-know / fact** — pleasant, never actionable
9. **Newsletter capture** — acted on once
10. **Disclosure/footer copy** — never acted on, must remain reachable

Bottom third by that ranking: mode picker, fact, newsletter capture, footer.
**My recommendation:** move only the **mode picker** behind a tap (it is
one-time onboarding occupying permanent space) and leave the rest — at 3.5
screens the page no longer needs surgery, and hiding things has its own cost.
That is a product call, so it is Tyler's.

## BLOCK 3 — one of three done, deliberately

**(c) Eleven hardcoded colours → tokens: DONE.** All eleven mapped 1:1 to
existing tokens, so it is pixel-identical today (verified live: body still
`rgb(11,13,20)`) and from now on a site palette change reaches the app instead
of drifting. 45 literal occurrences replaced, zero remaining.

**(a) emoji and (b) accent colours: NOT DONE, on purpose.** Both are the exact
class the brief warned about — "most likely to look worse than they measure,
trust your eyes over the counts" — and **I have no eyes here.** Making
32 count-driven deletions and a four-colour reduction blind, with no way to
look at the result, is how a measurable improvement becomes an ugly page. These
need either Tyler's eyes or a session where screenshots work.

## BLOCK 4 — the retention feature: it works, but the signal is wrong

Mechanically it is correct on every point asked:
- **First-timer: 0 dots, no explanatory line.** Correct.
- **Returning visitor: 2 dots** (The Daily Three, Biggest movers), line reads
  *"Last here 2026-08-21. A ● marks what has changed since."* Clear.
- **Stamp: `setTimeout(…, 4000)`** confirmed in source, one-shot per page load,
  so the first paint keeps its markers.
- **Clearing localStorage resets cleanly** — key gone, no residue.

**But it is crying wolf by construction, and you asked me to say so.** Both
call sites pass `feed.generatedAt`. Nothing in the condition looks at whether
that section changed — it asks "was the feed rebuilt since your last visit",
which is true every day regardless. Two concrete consequences:
- The CHASE pick was **identical on Aug 20 and Aug 21** (Umbreon VMAX both
  days), and the Daily Three dot would still have fired.
- This repo does routine **regen commits** — I have made several today — which
  bump `generatedAt` with byte-identical content. Every one of those lights
  every dot on a page where nothing changed.

**I would not pull it — I would fix the input.** Pass each section its own
content identity (the pick's card id, or a hash of the section's rendered
figures) instead of the feed timestamp. Same feature, same code shape, honest
signal. As built it is right most days by luck and cannot ever tell that it is
wrong.

## Wrong assumptions
All three held. One correction to the framing rather than the facts:
"nothing else has been touched" was true, but the deferred item #1 (17
sections) was misdiagnosed at source — the experience agent counted sections,
which is all it can see, and the actual defect was a CSS rule it had no way to
measure.

## Needs Tyler
1. **Emoji and accent-colour passes** — need eyes, mine do not work here.
2. **The mode picker** — behind a tap, or leave it?
3. **The retention dot** — fix the input as recommended, or pull it.
4. **The CHASE card has no photo** because the feed carries no `imageUrl` for
   raw picks. Data-contract gap, not a render bug.
5. **The Today screen still has zero links** — carried over from the rehearsal.

## Roads not taken
- Did not implement the section ranking (asked to report first, and the fix
  changed the calculus).
- Did not do the emoji or colour passes blind.
- Did not touch chat's retention code — collision-checked first; chat had
  edited the file 24 minutes earlier but not the line I changed.

## Surprises, including my own
- **`collision-guard.mjs` cannot see the catchem-app repo.** It runs `git log`
  with `cwd` pinned to Catchem-data, so any app path returns "touched by:
  nobody · already exists: no" — a false all-clear on the exact repo the fence
  was protecting. I did the check by hand instead. Worth fixing before someone
  trusts it.
- The page was seven times longer than its own content and every guard we own
  reported green, because nothing measures rendered geometry.

## Uncommitted / unverified
- No screenshots anywhere in this session; every visual question is unanswered.
- Timings are a fast line, not mobile data.
- The 4s stamp is verified in source and by behaviour, not by catching the
  exact millisecond across a reload.
- Emoji count (32) and accent-colour count (4) are the agent's figures, not
  re-measured by me.
