# Creator Onboarding — the Morning Pulse in YOUR server (§14b, v0)
WHAT YOU GET: one branded embed in your #market channel every morning —
the Sealed Index, the Daily Three, our track record on yesterday's
watches, the Rip-or-Hold question, and any new gaps. Free. Your community
wakes up to fresh market talk without you lifting a finger.
HOW TO JOIN (2 minutes): 1) In your server: Settings → Integrations →
Webhooks → New Webhook → pick your channel → Copy URL. 2) Send that URL
to Tyler privately (never post it publicly — a webhook URL lets anyone
post to your channel). 3) We add it to our encrypted store; embeds start
next morning. Leave anytime — one message, hook deleted same day.
HOUSE RULES: your webhook URL never appears in any public file · 3
delivery failures auto-mutes until we reconnect · content follows our
public methodology (catchemtcg.com/methodology) — no calls, receipts on
everything · caps: one Pulse/day + rare major-signal pings.
OPERATOR NOTE (Tyler): add each creator as {"id":"name","url":"..."} in
the CREATOR_WEBHOOKS_JSON GitHub secret ({"hooks":[...]}); mirror the id
in data/creator-registry.json for the public roster.
