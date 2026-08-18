# eBay Marketplace Insights API — application draft (2026-08-18)

Status: DRAFT for Tyler to file from his own eBay developer account when
convenient. Not submitted. Fill bracketed fields before filing.

---

**Application / business name:** Catch'em (catchemtcg.com)

**Applicant:** Tyler Baker, sole proprietor [adjust if entity changes]

**Current API usage:** Production consumer of the Browse API
(client-credentials OAuth) since [May 2026 — confirm from developer console];
one scheduled job per day aggregating active-listing prices for ~70 Pokémon
TCG sealed products in category 2536, EBAY_US.

**Use case (what we do):**
Catch'em is a price-transparency platform for Pokémon TCG collectors. Once
daily we compute aggregate statistics (trimmed median, low, high, listing
count) per sealed product from active listings, publish those aggregates on
our site and in a collector newsletter, and retain daily aggregate history to
show price trends. Every published number carries provenance ("eBay active
listings, <date>").

**Why Marketplace Insights:**
Active-listing prices are ask prices. Sold-transaction data would let us
publish what collectors actually pay — materially more honest numbers,
especially for low-liquidity vintage sealed products where active listings
are sparse or absent (we currently suspend pricing on those SKUs rather than
publish misleading asks; sold data would let us price them responsibly).

**What we would request:** item_sales search for category 2536 (CCG sealed),
EBAY_US, ~70 queries/day on a fixed nightly schedule — the same cadence and
scope as our existing Browse usage.

**Data handling commitments:**
- Aggregates only are published (median/low/high/count per product per day).
- No resale, redistribution, or licensing of raw listing or transaction data.
- No exposure of seller identities, individual transactions, or per-listing
  data in any published surface.
- Data retained as daily aggregates; raw responses discarded after
  aggregation [confirm retention wording against current program ToS].
- Attribution to eBay as the data source on every published figure.

**Traffic estimate:** ≤100 calls/day, ≤3,100/month, single server-side
scheduled job, no client-side API access.

---

Filing notes for Tyler (not part of the application):
- File from the same developer account that holds the production keyset so
  the reviewer sees the existing legitimate Browse usage.
- The program has been effectively partner-gated (Terapeak consolidation) —
  expect rejection or silence; this is a lottery ticket, not a plan. The
  free-tier cross-check provider (see crosscheck-eval-results.md) is the
  actual path; PriceCharting remains the paid fallback for vintage sold
  comps post-revenue.
- If a call/interview is offered, the Trust Standard doc is the best single
  artifact to show — it documents the no-misleading-numbers posture the
  application claims.
