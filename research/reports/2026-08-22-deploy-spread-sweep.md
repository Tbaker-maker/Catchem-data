# Session report — deploy, Spread retirement, SKU pass, duplicate sweep (2026-08-22)

Six blocks. Block 3 skipped as already done. `node scripts/audit.mjs` →
**19/19 passed · report: research/audits/2026-08-22-audit.md**

## Wrong assumptions

**Assumption 4 was false: the darkroom's output HAS been looked at.** It was
verified last session on 12 real photos — three were destroyed (the 151 box
came back navy, the Prismatic wordmark half eaten), a threshold sweep proved
tuning cannot fix it, a centre-breach guard was added, and the app-path
recommendation was delivered. Report:
`research/reports/2026-08-22-darkroom-verification.md`, fix in 8e6829e.
Per PROMPT-CONVENTION's STOP vs SKIP ruling — false because the work is
already done — block 3 was skipped, not stopped on. Its findings are now
recorded in the flag registry (`images.darkroom.why`) so the next reader
does not have to find the report.

Assumptions 1, 2 and 3 held. The Sealed Index reset is real; `entries` is
empty because today is day one of the new series, which is expected, not a
fault.

**Block 2's premise was half-overtaken.** The Spread had already been held
from publication (4b61c82) — but only in the signal list. The Daily Three
card was still publishing "Spread +19.7% · TCG $208.77" on the Today screen.
The hold had shipped; the leak had not been noticed.

## Needs Tyler

1. **swsh1-bundle is the one genuine retirement candidate.** After the fix
   below it still keeps **0 of 150** fetched, and the rejects are Chinese
   imports, other SWSH sets and ETBs — no genuine listing at all. But whether
   that means "stopped trading" or "this product never existed in this era"
   is a domain fact, and you are the validator. It stays quarantined
   meanwhile, because `query_error` preserves its old contaminated $198.48.
2. **The SWSH booster-bundle class as a whole** — swsh2/3/35/4/45/5/8/9 all
   keep 0, swsh6/7/10 keep 1–2. The type rejections are correct (loose packs,
   pack-art sets, blisters), so the market is genuinely thin rather than
   mis-filtered. Drop the class, or keep it publishing honest nulls?
3. **I did not retire anything.** See below — the evidence changed under me.

## Surprises, including my own bugs

**I was one step from retiring a live product.** sv1-bundle and swsh1-bundle
both read zero listings, which looked like the dead-market signature block 4
describes. It was a query problem in my own code: "Base Set" is how sellers
disambiguate an era-base product — "Scarlet & Violet **Base Set** Booster
Bundle" is precisely the sv1 listing we want — and it is *also* a tracked
vintage set name, so my eraBaseSet sibling rule from yesterday threw those
listings away. After the fix, on 150 fetched each:

| SKU | before | after |
|---|---|---|
| sv1-bundle | 0 | **7** |
| sv1-pack | — | 11 |
| swsh1-pack | — | 8 |
| swsh1-etb | — | 9 |
| swsh1-booster-box | — | 7 |
| sm1-booster-box | — | 9 |

Six SKUs I was preparing to propose for retirement are simply alive. The
verification step in block 4 is the only reason this was caught.

**The duplicate-gate bug had reproduced inside the registry built to prevent
it.** `flags.json` carried `ppt.publicDisplay` AND `pptLicensed` — two keys,
one condition, two owner files, both binding `CATCHEM_PPT_LICENSED`. Setting
either key's `value` moved nothing; only the env var moved both. Merged, and
a new guard now fails when two flags bind the same env name.

**Third instance of that pattern, and it was mine.** The Spread caveat renders
in four places in the app. My first pass labelled exactly one — the same
one-condition-in-N-places failure, committed *while running the sweep for it*.
Now one `SpreadNote` component.

**Tap-to-enlarge was dead on the only screen with photos.** `<Lightbox />` was
mounted on three route branches but not the main return, so every product
photo set the zoom state and rendered nothing. The cursor said `zoom-in` and
the handler fired, which is exactly why it read as working. Only visible by
driving the deployed app.

**Retiring the Spread nearly shipped three NaN leaks.** With `spreadPct` off
the card, the share card would have rendered "eBay asks NaN% undefined than
TCGplayer", the midday social lens would have **posted that sentence to a
public account**, and Rip-or-Hold — which selected off signal rows — went
silently dead. All three found by regenerating rather than by reading.

**`/tmp` again**, this time in `audit.mjs`'s new agent-crash check, in a file
that already imports `tmpdir()` and uses it correctly four lines above. That
is at least the fourth instance of this gotcha. It crashed the audit outright.

**Two files passed a hostname through a boolean.** `flag("site")` returns
`Boolean`, so `SITE` became `true` and every methodology link
`true/methodology.html`; `social-posts` also threw on an unregistered key and
broke the pipeline every run. Chat fixed this independently and better while
I was fixing it — I dropped my parallel `value()` export and took theirs.
That is a *fourth* duplicate-effort collision today, between two authors who
were both explicitly hunting duplicate effort.

## Roads not taken

- **Did not retire any SKU.** Block 4 said verify first; verification
  dissolved five of the six candidates and turned the sixth into a domain
  question. Retiring on the pre-fix evidence would have deleted live products.
- **Did not keep my own `value()` design** for config-vs-gate separation, even
  though it enforces the distinction more strictly. Upstream's `type: "value"`
  was already wired into their guard, and shipping a second mechanism for one
  job during a duplicate-mechanism sweep would have been absurd.
- **Did not remove the Spread from product pages.** Tyler ruled footnote, not
  deletion — "keep it in our back pocket". It is still computed internally.
- **Did not touch the vintage `no-active-market` SKUs** (base1/base2/base3/
  neo1/hgss1/bw1). They read as zero-listing candidates but are deliberate:
  they publish honest nulls pending a sold-comps source. They are not a source
  of wrong numbers — that mechanism is exactly what protects them.

## Uncommitted / unverified

- **`swsh1-bundle`, `sm1-booster-box` and four others sit in `query_error`,
  which preserves their last price.** Quarantine keeps them off public
  surfaces, but the underlying numbers are still stale and wrong in the file.
- **The 22 light-packaging photos the darkroom must skip** keep white
  backgrounds. Unchanged from the last report; no pixel method can fix them.
- **The app's Spread label is only exercised where `spreadPct` still reaches
  the client.** With the instrument retired the feed rarely carries it, so
  most label paths are correct-by-construction rather than observed.
- The `per-pack` jargon warning in `post-bank.json` predates this session and
  is still open (0 blocking).
