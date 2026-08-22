# PSA Public API — recon (2026-08-22, no account created)

Read live from psacard.com/publicapi/documentation this session. Recon
only — registration requires signing in with PSA login credentials, so
nothing was created and no token exists. NOTE: psacard.com/pop (the pop
report front door) now ALSO redirects to a Collectors sign-in (found
2026-08-20) — the free-browse era documented in pop-data-options.md is
over on PSA's own site; GemRate remains our free front door.

## What the free public API actually is
- Base: `https://api.psacard.com/publicapi/` (HTTPS only).
- Auth: bearer token generated FROM PSA LOGIN CREDENTIALS — sign in or
  register at psacard.com, accept the PSA API End User Agreement.
- **The only offered method: Cert Verification, single item** —
  `GET /cert/GetByCertNumber/{certNo}`, bearer header.
  Their own words: "We currently offer access to data from Cert
  Verification for single item searches by cert number."
- Error dialect: 500 usually = bad credentials; 200 + `IsValidRequest` /
  `ServerMessage` envelope ("No data found" vs "Request successful").
- Contact: collectors-apis@collectors.com.

## Population data: NOT available here
No population endpoints exist. The cert response historically carries
pop-shaped fields, and community reports (matching our own Aug-2026
verification in pop-data-options.md) say they come back null/zeroed on
the free tier — Reported, unverifiable without a token. Treat the free
API as CERT VERIFICATION ONLY; pop stays on the GemRate lane.

## What cert verification enables for us
- **Raffle integrity**: before a graded prize ships (or when a winner
  claims), the bot verifies the cert number → confirms the slab's
  card/grade match what the raffle advertised. Zero-cost trust receipt,
  fits the provably-fair raffle doctrine.
- **Future marketplace**: a `/verify-slab` step on any graded listing —
  cert number in, PSA's own record out, mismatches refused.
- **Content**: "we verified the cert" lines on graded stories (Verified
  class — primary source).

## Registration requirements + next step (Tyler's call)
PSA/Collectors account + End User Agreement acceptance → token. Free.
If/when raffles start shipping graded prizes, register with the existing
account and wire `GetByCertNumber` into the bot's prize flow (single
calls, trivially inside any rate cap). No reason to do it before then.
