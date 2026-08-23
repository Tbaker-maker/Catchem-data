# Deploy the landing page — traffic is live NOW (CC, urgent)

Tyler, 2026-08-23: *"This post is going viral. 11.1k impressions in under 16
hours."* Against a previous best of 791. **Fourteen times, still climbing.**

`scripts/build-waitlist.mjs` → `research/assets/index-landing.html`, 8 KB.

## DEPLOY IT AT THE ROOT
`catchemtcg.com` currently serves the old static landing. **Replace it.** The
builder stays at `/build` and the page's primary button points there.

## WHY IT IS BUILT THE WAY IT IS
- **Mobile first, not mobile too.** X traffic is phones. Every measurement
  assumes 390px; desktop is the adaptation.
- **The primary action is the LIVE TOOL, not the form.** We have something that
  works right now with 16,468 cards in it. A tool somebody uses in five seconds
  converts better than a form — and every image it makes carries our mark back
  onto the timeline the traffic came from. The waitlist is the second ask.
- **Nothing unshipped is described as available.** Guards have no manufacturing
  quote; the newsletter has not sent. Both are tagged IN DEVELOPMENT. **The
  fastest way to waste fourteen times your normal traffic is to promise it
  something that is not there.**
- **The form submits without leaving the page.** A redirect to a Formspree
  confirmation screen loses somebody who arrived from a timeline, and it falls
  back to a normal submit if the fetch fails — a lost email during a spike is
  not recoverable.

## VERIFIED BEFORE SHIPPING
- Every number on the page checked against the index: 16,468 cards, 130 sets,
  385 illustrators. All exact.
- No unshipped feature carries a LIVE tag.
- `--faint` contrast raised from 3.2:1 to **5.1:1** — it fails AA at 3.2 and
  this page is read on phones in daylight, which is precisely where it fails.
  It carries the privacy line and the footer, both of which people read *before*
  handing over an email.
- Unaffiliated notice and illustrator credit in the footer.

## WHAT TO CHECK THE MOMENT IT IS UP
1. **Submit a test email and confirm it arrives.** A silent form during a spike
   is the worst possible failure and it is invisible from here.
2. **Open it on a real phone** at 390px. Nothing clipped, button reachable.
3. **Watch `/build` load time** under real traffic — the index is 1.7MB and that
   is fine on wifi and worth measuring on cellular.

## IF TRAFFIC IS HEAVY
The card index is 1.7MB and served on every builder load. If that becomes the
bottleneck, the fix is a slimmer first payload — not a smaller catalogue.
