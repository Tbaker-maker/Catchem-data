# LAUNCH REHEARSAL — walk the real journey, in order, as a stranger
*Tyler, Aug 22 2026: "using our product in real time as if it was a
scheduled launch."*

## WHY A JOURNEY, NOT A CHECKLIST
Every piece has been tested alone. Nobody has walked the SEAMS — and the
seams are where launches die: a link that points at the gated app, a
Discord invite that expired, a berry that never lands, a newsletter that
renders fine in a browser and breaks in Gmail. A stranger meets all of
those in ninety seconds and leaves without telling you why.

## WHO RUNS WHICH LEG (per FLEET-ROUTING.md)
- **CC**: anything mechanical — does it load, does it link, does it
  render, does it deploy, what is the HTTP status, what does the DOM say.
- **Tyler**: anything human — does it feel right, is the copy right,
  would a stranger understand it, does it look professional.
- **Chat**: cannot walk any of it (no browser, no domain access). Chat
  writes the script, reads the findings, and fixes the data and copy.

## THE WALK — in the order a stranger meets it

### LEG 1 · THE POST (Tyler)
Open the video/post as a viewer, not the author. Does the first line make
sense with no context? Is the CTA obvious? Does the link work from the
platform's in-app browser (not just desktop Chrome)?

### LEG 2 · THE DISCORD (Tyler + CC)
Invite link valid and non-expiring? Landing channel makes sense to
someone who just arrived? Rules readable in under a minute? Post one real
message: **does the Daily Berry actually drop**, and is it obvious what
just happened? Does anything reference a feature that does not exist yet?

### LEG 3 · THE SITE (CC mechanical, Tyler human)
catchemtcg.com loads · www resolves · methodology and corrections open
and link to each other · a product lander loads and its numbers match the
app · nothing links to the gated app · nothing says "gated" or "locked".

### LEG 4 · THE APP (both)
app.catchemtcg.com on a PHONE, on real mobile data, cold cache. Time to
first useful number. Do the Daily Three all render with photos and equal
heights? Do images enlarge? Does Show Mode work offline after loading?
Does the mode picker read as an invitation rather than a gate?

### LEG 5 · THE NEWSLETTER (Tyler)
Open the test send **in Gmail on a phone**, not a browser preview. Dark
background holds? Links resolve to public pages? Nothing renders as a
bracket or a broken image? Would you forward it to a collector friend?

### LEG 6 · THE LOOP BACK (Tyler)
From the app, can a stranger find the Discord? From the Discord, can they
find the app? From the newsletter, both? A launch is a loop, and a loop
with one broken edge leaks everyone who walks it.

## RULES FOR THE WALK
1. **Cold eyes.** Log out, clear the cache, use a phone. You are not you.
2. **Write down every hesitation**, not just every error. A pause is a
   defect — it is the moment a stranger would have left.
3. **Do not fix anything mid-walk.** Note it, keep walking. Fixing breaks
   the sequence and hides the seams that come after.
4. **Time it.** How long from seeing the post to seeing a real number?
   Under sixty seconds is the bar.
5. Anything found goes to the party who can fix it, per the routing
   table — not to whoever noticed it.
