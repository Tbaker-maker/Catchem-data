# What the X API can actually do for us

**Checked 2026-08-26 by probing our own credentials, not by reading docs alone.**
Four read-only calls, no credential printed.

---

## The expectation was wrong on two of three counts

The brief expected that reading other accounts needs a paid tier we do not have.
**It does not.** Our OAuth 1.0a user-context credentials on `@LongedEth` reach
other accounts' timelines today.

| probe | endpoint | result |
|---|---|---|
| 1 | `GET /2/users/by/username/:name` | **200** · 900 per 15 min |
| 2 | `GET /2/users/:id/tweets` — another account's posts | **200** · 900 per 15 min |
| 3 | `GET /2/tweets/search/recent` — platform-wide, 7 days | **200** · 300 per 15 min |
| 4 | `GET /2/tweets/search/all` — full archive | **403** |

Probe 2 returned shotgun's real timeline with `public_metrics` attached. Probe 3
returned live platform-wide results for a Pokémon TCG query.

**The one real refusal is full-archive search, and it is not a tier problem:**

> `Unsupported Authentication` — "Authenticating with OAuth 1.0a User Context is
> forbidden for this endpoint. Supported authentication types are
> [OAuth 2.0 Application-Only]."

That is an **auth-type** message, not a plan message. Whether an app-only bearer
token on our plan would reach it is untested — worth knowing before anyone
concludes we need to buy something.

---

## So the constraint is COST, not capability

X moved to **pay-per-use as the default in February 2026**, retiring the free
tier; legacy Basic ($200/mo) and Pro ($5,000/mo) are closed to new signups and
Basic subscribers have been migrating to pay-per-use since June 2026. Published
pay-per-use rates: **$0.005 per post read**, capped at 2M reads/month, and
$0.015 per post created ($0.20 with a link).

**I cannot tell from here which plan we are on.** Rate-limit headers are not
plan labels, and `research/pulse/api-strategy.json` already says the honest
thing: quotas and tier boundaries are dashboard facts. What the probes prove is
the capability and the request ceiling — not the bill.

What the numbers say about the shape of the thing:

| pattern | requests/day | posts read/mo (at 5 each) | at $0.005 |
|---|---:|---:|---:|
| 20 accounts **hourly** | 480 | ~72,000 | **~$360/mo** |
| 20 accounts **daily** | 20 | ~3,000 | **~$15/mo** |
| Tyler pastes a URL | 1 per paste | ~30 | **~$0.15/mo** |

**The brief's conclusion holds even though its premise did not.** Hourly polling
of twenty accounts is not something to build — not because we are locked out,
but because it costs a few hundred dollars a month to re-read timelines that
mostly have not changed, and because it would gather far more than anyone reads.

The rate limits are not the binding constraint at any of these volumes. Money is.

---

## What we do instead

**The archive is fed by hand and by the daily pass**, exactly as the brief
specified, and that design survives the correction:

1. **Tyler pastes a URL.** One read. Effectively free. He has already decided
   the post is interesting, which is the judgement no poller makes.
2. **The daily research pass** notes standout posts from web sources it is
   already reading.

**Cheap and already wired:** our own mentions and our own metrics.

**Left deliberately unbuilt, and worth naming so nobody rediscovers it as new:**
a once-daily pass over the nine accounts in `data/observed-accounts.json` would
cost single-digit dollars a month and is technically available now. That is a
spending decision, not an engineering one, so it is Tyler's — queued rather than
assumed.

---

## Sources

Probes run against our own credentials, 2026-08-26. Pricing and tier background:
[X API docs](https://docs.x.com/x-api/introduction),
[Blotato](https://www.blotato.com/blog/twitter-api-pricing),
[Postproxy](https://postproxy.dev/blog/x-api-pricing-2026/),
[SocialCrawl](https://www.socialcrawl.dev/blog/x-twitter-api-2026),
[Sorsa](https://api.sorsa.io/blog/twitter-api-pricing-2026).

Third-party pricing pages agree with each other, which is worth one caution:
sources agreeing is often one source repeated. The probe results are ours and
are not subject to that.
