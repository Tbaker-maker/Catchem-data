# Launch rehearsal — walk, guards, go/no-go (2026-08-22)

`node scripts/audit.mjs` → **20/20 passed** · negative tests **30/30**

## BLOCK 4 FIRST — GO / NO-GO: **NO-GO for tomorrow.**

Not because anything is broken mechanically — the site is up, the app renders
in about 290ms, every link resolves. It is a no-go because **the front door
makes claims the product does not support, and one of them contradicts our own
methodology page on the same domain.**

The single thing most likely to embarrass us in front of a first visitor:
**catchemtcg.com claims a daily-refreshed valuation model that does not exist.**
The landing page says *"a sample of cards our model currently surfaces as
undervalued — real picks, updated daily"*, tags it *"SAMPLED · REFRESHED
DAILY"*, and prints price targets: Dragonite ex SIR, **MARKET $145 → MODEL
$225** (+55%). Those cards are **hardcoded in site-landing.html**. There is no
model: the feed carries no `undervalued`, no `modelPrice`, and no such card.
The figures carry no provenance chip, and the app's own Learn tab says in so
many words that you *"can't turn a READ into a promise or attach a price target
to it — we don't make calls."* The landing page makes calls.

Worse, it is checkable in thirty seconds by the exact person we are trying to
win: a collector who reads the methodology page — our trust pillar, the thing
we point people to — finds *"We do not have sold-price data and we don't pretend
to."* The landing page, one click away, promises *"real sold-listing history on
eBay — see what your card actually transacted for."* Two pages, one domain,
opposite claims about the most important data question in the hobby.

**Fixable before Sunday? Yes, easily — it is copy, not engineering.** Delete or
honestly relabel the Signals section, drop the sold-history line, and resolve
the "Try Pro free for 14 days" button. A day's delay costs nothing; launching
into an audience with a fabricated model on the front page costs the one thing
this whole project is built on. Tyler would rather delay a day — this is that day.

## BLOCK 1 — the walk, in journey order

I could not run the walk as specified and will not pretend otherwise. **I have
no phone and no mobile data**; I walked it in a headless browser at a 375×812
mobile viewport, cold cache, logged out. Timings below are a fast connection off
a warm CDN — a floor, not a phone. Legs 1, 5 and 6-human are Tyler's per the
doc's own routing, and **Leg 2 asks for a real Discord message, which my fences
forbid**. What follows is Legs 3, 4 and the mechanical half of 6.

**LEG 3 · SITE** — all green mechanically: landing, methodology, corrections,
pulse, board, landers, www — every one 200. Then:
1. **The landing page has six links and five are anchors.** `#rotation`,
   `#features`, `#signals`, `#pricing`, plus one mailto. **Nothing links to
   methodology, corrections, pulse, board or any lander.** Those pages are live
   and orphaned — reachable only by typing a URL or arriving from the
   newsletter. The receipts pillar is invisible from the front door.
2. **The fabricated model section** (see go/no-go above).
3. **"Every card links to real sold-listing history on eBay"** — contradicts the
   methodology page directly.
4. **"Try Pro free for 14 days" and "Join waitlist →"** sit next to "Free
   forever · No credit card". A stranger cannot tell whether this is free. It
   also collides with the PPT licensing trigger, which is explicitly "re-decide
   BEFORE the first dollar" — a Pro button is the first dollar.
5. **"Collectr & Shiny import — done in 30 seconds"** appears only in the
   preserved prototype (`CatchEm.jsx`), not in the shipped `Ticker.jsx`.
   Flagged, not confirmed — Tyler should say whether that feature ships.
6. Hesitation: the header says "Pricing" before it says what the product is.

**LEG 4 · APP** — loads clean, no page errors, 8/8 images load.
7. **Time to first useful number ≈ 290ms** (254ms DOM + 30ms feed, first figure
   on screen `$1,499.99`). Comfortably under the 60s bar — but on a fast line.
   The feed is 189KB; on genuinely bad mobile data that is seconds, still well
   inside the bar.
8. **The Daily Three are not equal heights: 240 / 188 / 150px, a 90px spread.**
   The doc asks about this explicitly.
9. **The CHASE card has no photo** while the other two do. Not a render bug —
   the feed's `dailyThree.raw` carries no `imageUrl` key at all, so the app has
   nothing to draw. A data-contract gap.

**LEG 6 · THE LOOP** — it is not a loop.
10. **The app's Today screen has zero links of any kind.** Discord is mentioned
    once in text and is **not clickable**. There is no path back to the site.
11. The landing page has no path to the app.
    So: site ↛ app, app ↛ site, app ↛ Discord. Every surface is an island. A
    stranger who lands anywhere can only leave by closing the tab.

## Wrong assumptions
All three were substantially right, with one caveat: I verified the newsletter's
**links** (all public-host, all 200, none quarantined) but **not that a
send-ready draft exists in Buttondown** — that needs API access I do not have.
Assumption 1 is unverified on its Buttondown half.

## Needs Tyler
1. **The Signals section** — delete, relabel as illustrative, or build the model.
2. **The sold-history claim** — remove it, or amend the methodology. They cannot
   both stand.
3. **"Try Pro free for 14 days"** — does a paid tier exist? If yes, PPT
   licensing must be re-decided first, by his own recorded trigger.
4. **Does the CSV import ship?** It is advertised and lives only in the prototype.
5. **The loop** — the app is deliberately unlisted, so is the missing site→app
   link intended? If so, the newsletter is the only door, and that is a choice
   worth making on purpose.

## Roads not taken
- Fixed nothing during the walk (doc rule 3). Everything above is noted, not
  patched — fixing mid-walk hides the seams downstream.
- Did not post to Discord (fence), so Leg 2's Daily Berry test is unrun.
- Did not touch the landing copy. It is Tyler's lane per the routing table, and
  it is judgment, not mechanics.

## Surprises, including my own
- The site is mechanically flawless and rhetorically the weakest part. Every
  guard we built points at the data; nobody had pointed one at the marketing.
- **My grep missed five unguarded fetches** that the new guard-audit rule then
  found. That is the argument for the rule over the sweep, made against me.
- The `/tmp` rule I added yesterday flagged the negative test written to prove
  it works — a guard catching its own test fixture.
- `data/derived-insights.json` — Sealed Index, Daily Three, pack math — had **no
  schema at all**. Neither shape nor plausibility covered the numbers the app
  actually renders.

## Uncommitted / unverified
- Timings are from a fast connection, not a phone on mobile data.
- The Buttondown draft state is unverified.
- Legs 1, 2, 5 and the human half of 3/4/6 are unwalked and belong to Tyler.
- The CSV-import claim is flagged, not confirmed.
