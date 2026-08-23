# Go live — the complete list

Everything is built and audited. **Two files, one deploy.**

## THE FILES
| file | goes to | why |
|---|---|---|
| `research/assets/index-landing.html` | **`/index.html`** at the root | the page |
| `research/assets/og.png` | **`/og.png`** at the root | the share card |

`og.png` is **1200×630, 43 KB, already rasterised.** Without it, X renders the
link as a **wide grey box** — `summary_large_image` with no image is the worst
combination available, because X reserves the big area and finds nothing to put
in it. On a post going to twenty thousand people that is the whole first
impression.

## THE ONE GATE THAT STILL MATTERS
**Cloudflare Access in front of every path except `/`.** Noindex stops search
engines listing `/build`; it does not stop anybody who types it. Until Access is
on, the builder is public to anyone who guesses.

## AUDITED, ALL GREEN
- negative tests **63/64** · guard audit **16 wired, 24 steps** · pre-mortem
  **24 declared** · tease · slop · designer · memory · agent contract **18/18**
- claims: **16,468 / 130 / 385**, all exact against the index
- **no frequency claim** — the thing that was false this morning is gone
- nothing described as usable · the product name is nowhere on the page
- form submits without leaving the page, and falls back to a native POST if the
  fetch fails, because **a lost email during a spike is not recoverable**

## AFTER IT IS UP — three checks, in this order
1. **Submit an email and confirm it arrives.** Tyler has already tested the form
   itself; test it again against the LIVE url, because the deployed origin is
   what Formspree sees.
2. **Paste the url into a draft post** and look at the preview card. If it is
   grey, `og.png` did not deploy.
3. **Try `/build` in a private window.** If it loads, Access is not on.

## WHAT IS DELIBERATELY NOT ON THE PAGE
No product access, no product name, no refresh cadence, no specific product
count. Each of those was removed for a reason and each reason is in
`house-theses.md`. **Adding any of them back is a decision, not a tidy-up.**
