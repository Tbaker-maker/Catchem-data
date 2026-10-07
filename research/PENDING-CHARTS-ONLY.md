# Charts-only path — deferred

The charts-only hub (a dedicated index of every product chart) is **deferred**. Launch-lean path now is the per-product deep-dive at `/dive/<id>`: a small JSON payload from `heat-history` (date, price, listingCount), the latest `sealed-prices` row, and buyout Browse totals when present, rendered as a simple SVG chart plus table that a read can open via “Deeper look” / “See the chart.” Sold volume stays `null` until Marketplace Insights scope exists (listing counts are not solds). Do not build the full charts-only UI yet.
