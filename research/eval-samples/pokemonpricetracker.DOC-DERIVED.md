# PokemonPriceTracker — DOC-DERIVED response shape (NOT a raw capture)
# Source: pokemonpricetracker.com/api docs, read 2026-08-18. Do NOT build the
# adapter from this; capture a real authenticated response first (free key:
# signup only, 100 credits/day, 60 req/min, 3-day history on free).
Request: GET /api/v2/sealed-products  (auth header per docs)
Documented response fields:
  market price, low price,
  sellers (count), listings (count),
  lastUpdated (per record)
Notes: dedicated sealed endpoint. Credit cost per sealed lookup NOT verified
(must confirm 1 credit/call so 70/day fits the 100/day free budget).
