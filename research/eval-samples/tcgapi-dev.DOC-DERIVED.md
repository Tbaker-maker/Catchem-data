# tcgapi.dev — DOC-DERIVED response shape (NOT a raw capture)
# Source: tcgapi.dev/docs, read 2026-08-18. Do NOT build the adapter from this;
# capture a real authenticated response first (free key required, 100 req/day).
Request: GET https://api.tcgapi.dev/v1/search?q=<query>&game=pokemon  (X-API-Key header)
Documented response fields:
  name, set_name, rarity, product_type,
  market_price, low_price, median_price,
  total_listings, lowest_with_shipping,
  image_url, foil_only, printing,
  pagination: total, page, per_page, has_more,
  rate info: daily_limit, daily_remaining
Notes: sealed explicitly supported ("booster boxes, tins, ETBs, and cases").
NO update timestamp in documented shape — verify in raw capture before use.
