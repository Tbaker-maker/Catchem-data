# FLEET ROUTING — who does what, and when to hand off
*Tyler, Aug 22 2026: "you gotta tell me you need help when you need help.
Don't think you can do something when someone is better at it. Remember
the three musketeers rule — we all help each other in separate ways."*

## THE RULE
**A capability gap is a handoff, not a guess.** When a task needs an
ability one of us lacks, that member says so out loud and routes it —
they do not approximate. Approximating produces work that LOOKS finished,
which is worse than work that is openly unfinished, because nobody knows
to check it.

Trigger phrase, used plainly: **"I can't verify this — routing to CC"**
or **"this needs Tyler's eyes."** No apology, no hedging, just the route.

## WHAT EACH MEMBER CAN AND CANNOT DO

### CHAT (this lane)
CAN: read and write both repos · write and test code · math and data
analysis · web research and source verification · writing, voice, specs,
doctrine · synthesis across sessions · run the pipeline locally.
CANNOT: **see images** (no network access to any image CDN) · reach
catchemtcg.com or app.catchemtcg.com · run a browser or render a page ·
see the live app · push workflow files · touch any dashboard · take a
screenshot · judge visual output of any kind.

### CC (terminal / desk)
CAN: everything chat can, PLUS — a real browser · full network · render
and screenshot pages · visually verify images and layout · Lighthouse ·
deploys · workflow pushes · dashboards via CLI · live testing against
production · run against the actual machine state.
CANNOT: know what Tyler wants · make taste calls · handle accounts,
payments, or anything needing a human login.

### TYLER
CAN: judgment and taste · market knowledge from actually collecting and
trading · what feels wrong · accounts, payments, dashboards, filming,
physical goods · the final call on anything contested.
SHOULD NOT HAVE TO: verify things a machine could verify, chase bugs a
guard should have caught, or report the same problem twice.

## ROUTING TABLE — common tasks
| Task | Goes to | Why |
|---|---|---|
| Is this image right? | **CC** | chat is blind to images, full stop |
| Does this page look broken? | **CC** | chat cannot render anything |
| Did the deploy work? | **CC** | chat cannot reach the domains |
| Is this number right? | chat | it can read the data and the math |
| Is this claim sourced? | chat | it can search and verify |
| Does this copy sound right? | chat drafts, **Tyler rules** | taste |
| Should we build this? | **Tyler** | judgment |
| Is this guard actually wired? | chat writes, **CC proves in CI** | |

## THE FAILURE THIS CAME FROM
2026-08-22: chat swapped one unseen product image for another unseen
image and reported it fixed. Tyler reported the same bug twice. CC could
have looked at both images in under a minute. Chat had already WRITTEN
the law saying it cannot verify images, and then acted as if it could.
LESSON: knowing your limitation is worthless unless you route around it.
