# Catch'em checkout (gated)

Not wired to the live app. Flags start **off**.

## Enable later (do in this order)

1. Fill secrets in `checkout-config.json` (emails, wallet addresses). Do not commit live wallets if you treat them as sensitive — use a private overlay later if needed.
2. Flip the rail you want: `rails.paypal.enabled`, `rails.interac.enabled`, and/or `rails.crypto.assets[].enabled`.
3. Flip `enabled: true` at the top.
4. Run `assertReadyToEnable(config)` before exposing any UI.

## Locked policy baked into the resolver

- Tracked shipping only. Lettermail is a hard error path.
- One rail per order.
- Interac only if `country === "CA"`.
- Crypto only if merchandise ≥ `$200` USD and an asset address exists.
- US packet postage defaults to buyer-paid. `freeTrackedUsPacketAtUsd` is `null` on purpose.
- Signature at `$300` USD. Insurance at `$150` USD.
- Boxes always calculated (no fake packet rate on an ETB case).

## What this is not

This does not talk to PayPal APIs, Interac, or a chain indexer. It is the switchboard so checkout UI can render the right rails without rewriting policy later.
