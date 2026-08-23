# One public URL, everything else private (CC — this is the blocker)

Tyler, 2026-08-23: *"Make it a URL I can post that's live but doesn't take them
to our websites. Let's make it so the websites are only public to us other than
this waitlist URL."*

Traffic is live and climbing — 11.1k impressions in under 16 hours against a
previous best of 791. **Every hour this is not up is the spike passing.**

## THE URL TO POST
**`catchemtcg.com`** — the root, serving only the waitlist. It is the domain he
already owns, it is short, it looks legitimate in a post, and there is nothing
to explain.

Alternative if the root is awkward to repoint quickly: **`catchemtcg.com/early`**
as a single file. Either works; the root is better.

## WHAT I HAVE ALREADY DONE
- `research/assets/index-landing.html` — 9 KB, links to **nothing** but
  `mailto:support@catchemtcg.com`. It cannot leak a private page because it
  references none.
- **Sixteen pages marked `noindex,nofollow,noarchive`**, and the same tag added
  at **eight generators** so tomorrow's 04:00 rebuild does not undo it.

## WHAT NOINDEX DOES NOT DO — read this part
**It stops search engines listing the pages. It does not stop anybody who has
the URL.** Anyone who guesses `/build` still gets the builder. Treating noindex
as a lock is the whole danger here, and I would rather say so plainly than let
it read as solved.

## THE ACTUAL GATE — pick one
**1 · Cloudflare Access (recommended).** Free for small teams, sits in front of
Pages, and takes minutes. Add a policy allowing only Tyler's email, applied to
every path **except** the root. He signs in once; everyone else gets a login
screen instead of the builder. **This is the only option that is genuinely
private.**

**2 · Deploy only the waitlist.** Do not publish the other pages at all — build
them locally, ship one file. **Nothing is more private than absent.** Slower to
iterate, and CC loses the ability to check live pages.

**3 · Obscure paths.** Move `/build` to an unguessable path. **This is not
security**, it is a delay, and it is the option to choose only if the other two
cannot happen in the next hour.

## THE MOMENT IT IS LIVE — three checks, in this order
1. **Submit a test email and confirm it arrives.** A silent form during a spike
   is the worst possible failure and it is completely invisible from here.
2. **Open it on a real phone** at 390px. Nothing clipped, the button reachable
   with a thumb.
3. **Try `/build` in a private window.** If it loads, the gate is not on.

## SPEED OVER POLISH ON THIS ONE
Normally we finish properly before shipping. **This is the exception, and it is
worth naming as one:** the traffic is happening now, it will not repeat, and a
waitlist that is live and plain beats a waitlist that is perfect and late.
