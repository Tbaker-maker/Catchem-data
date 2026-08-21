# WORKQUEUE — the fleet's shared backlog (REPO = DATABASE law)
Any session (chat, CC, desktop, mobile) pulls the TOP unclaimed item,
marks it CLAIMED(who,date), works it, marks DONE(commit). Pull before
write, push after. Tyler adds items in plain English anywhere here.

## NEXT UP FOR CC → research/CC-PROMPT-QUEUE.md (ordered, paste one at a time)

## CLAIMED / IN FLIGHT
- (CC, Aug 20) Utilities IA overhaul (APPROVED): Tools hub tab, Watch tab, Pack Math + Print Watch first surfaces, question-grammar tool screens. Spec section 15 + mockup v4.
- (chat, Aug 19)  Net Proceeds Truth — engine side.

## READY (priority order
0. THE PROFESSOR + /wish (post-Sunday, one session): navigator cog + wishlist-demand v0 (Discord /wish, aggregate-only, MIN-N gate 25/50) — spec: professor-spec-v1.md + wishlist-demand-spec-v1.md.
0b. WAS: /ask navigator cog — grounded on house docs + live feed, simple-first, no-advice law, question-log flywheel; needs ANTHROPIC_API_KEY (Tyler). Spec: professor-spec-v1.md. — Tyler, Aug 19: TOOLS BEFORE UI)
1. [DONE chat Aug 19 — app 256b6d0] Net Proceeds on product detail (eBay+TCG in-pocket
   "if sold on eBay ≈ $X after fees" — CC after marathon).
2. [DONE chat Aug 19 — app ca50587] Deal Check deepened (seller-nets line = show-floor settlement's number).
3. [DONE chat Aug 19 — same commit] Compare deepened: premium(thin-aware) + in-pocket + Δ rows added; lifecycle/legality were already in.
4. [DONE chat Aug 19 — home card live] Rip-or-Hold: results loop = Discord poll reactions (Tyler posts or bot later).
5. [ENGINE DONE — chat Aug 19] Creator webhook network: sender+fanout+mute live; ARMS on first CREATOR_WEBHOOKS_JSON secret / house DISCORD_WEBHOOK_URL.
6. Depth-reads 🍭 before first verdicts (~Aug 21).
7. Heat-state debut (Aug 26): verify 8 clean days; labels wired dark.
8. Buttondown flip (blocked: Tyler claims username).
9. Graded Index activation (blocked: PPT licensing).
10. Deal Check: consume feed.products instead of a separate full-tape fetch
    (one fetch, smaller payload; keep the offline-cache posture).
11. methodology.html copy into catchem-app/public/ → stable
    app.catchemtcg.com/methodology.html URL (newsletter link target).

## WATCH
- sv8pt5-pack kept-count swung 22→7 intraday (query variance, NOT the filter
  fix — pre-fix inspection also kept 7). If tomorrow trips query_error,
  investigate pagination/result ordering.
- me1-pack thinness (n≈7): thin-gate live; revisit if still thin past Aug 25.

## BLOCKED / WAITING ON TYLER
- ✅ RESOLVED Aug 20: app.catchemtcg.com LIVE with the real Ticker — deployed via wrangler + CLOUDFLARE_API_TOKEN (masked, User env). Dashboard Workers-Builds path still broken (Git-disconnect + wrangler crash on Windows OAuth) — future: GitHub Action with the token for auto-deploy on push; .html URLs 307 to pretty URLs (regenerate sitemap/canonicals extensionless, small follow-up).
- Buttondown test email: confirm receipt + phone render (draft em_1rx3…).
- /pulse-now + /roh-now: two slash taps in Discord for today's first posts.
- Railway deploy: GREENLIT 'very soon' (Aug 19) — ~/mo Hobby confirmed,
  ledger it on deploy. Tyler's 10 min: railway.app → connect catchem-bot repo
  → token in masked field → volume at /data. RUNBOOK-ALPHA.md has the rest.
  Until then the bot only runs while his PC session is up.
- CF_DEPLOY_HOOK secret (CF Pages → Deploy hooks → repo secret) — until then
  landers refresh only on app pushes.
- Newsletter 001 send (checklist + linked-preview decision, before Aug 24).
- swsh5 −26% read: investigation says genuine discount — confirm or annotate.
- Name decision Gate 2 (attorney) — knockout evidence in repo.

## YEAR-2 PILLARS (captured, not queued)
- Giveaway marketplace + EDEN ticket-rain (free+paid, compliance-walled; Eden = engagement faucet — concept doc filed;
  v0 = bot raffle cog at alpha; attorney gates the paid shape)

## PARKED (Tyler, Aug 19: tools before UI)
- Claude Design session (brief: design-brief-claude-design.md, evergreen)
- Visual polish beyond shipped P0 + Lighthouse pass

## DONE (recent)
- CLOUD SESSION Aug 20 (CC desk): bot on Railway is now THE VOICE —
  morning_pulse cog (6:00 PT, Mock 1, staleness law: >26h feed = silence) +
  rip_loop cog (6:01 PT question w/ 💥🧊, next-day tally, crowd record owned
  in roh_results) + /pulse-now + /roh-now staff triggers. Raffle 001
  REHEARSED on hosted-DB copy: PASSED, caught cheat-card id bug
  (sv3pt5-booster-bundle→sv3pt5-bb, fixed) — Sunday is a rerun. Hosted-DB
  ledger verified (Tyler's real mints), provision tree matches Arch v1.
  ⚠ AUDIT CATCH: app.catchemtcg.com serves an ANCIENT pre-Ticker build —
  CF Pages project not building from main; needs Tyler in the CF dashboard
  (build cmd npm run build, output dist, branch main, then retry deploy).
- Launch ammo (chat, Aug 20): Video 001 full shooting script + Raffle 001 rules FILLED + admin cheat-card.
- §15 UTILITIES IA Aug 20 (CC desk): four-tab nav (Today/Tools/Watch/Board),
  Tools hub = 6 question-cards w/ live teasers (mock v4 matched line-for-
  line), Pack Math + Print Watch app surfaces born (engines were invisible),
  Net Proceeds calculator, question grammar on Check/Compare, legacy routes
  redirect. Feed: packMath.all + printWatch top-8 + tcgModel fees (108KB).
  methodology#print-watch 🍭 anchor. Lighthouse 95/100 held, 61.4kB gzip.
- Aug 20 pair (CC desk): 001 SEND-READY (47224a8 — proof-pass, links all 200,
  PE-ETB refreshed vs feed, 🌐 online drop dates on all 4 waves w/ 2-source
  labels; Tyler's Aug-24 'send' gate holds) · Berry Rot 🍂 live in bot
  (28 tests; 30d/7d/10%wk config, /hold audit-logged, Frozen eternal;
  bot restarted w/ cog, 36 cogs).
- SERVER PROVISIONED Aug 19 (priority insert): Catch'Em Collectables built
  per server-architecture-v1 — 6 categories/18 channels/6 roles, announcement
  types, overwrites, slowmode, rules pinned, reaction ping-roles live,
  Eden no-drop synced; provisioner idempotent (2 passes); tooling in
  catchem-bot/tools/. Bot LIVE in-server, all cogs incl. eden/raffle_wizard/
  reaction_roles. Tyler-verified 'looks great'. Residual: hidden #rules/
  #moderator-only (Discord-designated, tucked in META); live demo (🍓 +
  first raffle) whenever Tyler plays; Railway = RUNBOOK-ALPHA.md.
- BOT PACKAGE Aug 19 (CC desk, freeze lifted for this package): PRIVATE repo
  Tbaker-maker/catchem-bot live (visibility verified pre-push). POP ledger
  (Fresh🍓+Frozen🧊, free_tickets sacred = Fresh 1:1, Frozen backfilled from
  rewards_log lifetime) · Eden cog (Daily Berry + 2% bonus rolls + /eden rain,
  silent guards, all thresholds in config) · Raffle machine v2 (wizard modal,
  pulse-feed VERIFIED-value oracle, provably-fair draws w/ published seed,
  ship/cash-65% winner flow, prizes-ledger, redraw, templates, audit,
  max-concurrent) · governance stub (/featured-vote weight=Frozen, softcap
  OFF) · 81/81 tests + live-fire sim transcript. BLOCKED on Tyler: bot token
  (masked, RUNBOOK-ALPHA.md) → live server demo + Railway go/no-go.
- MEGA-SESSION Aug 19 (CC desk), all 7 work blocks:
  swsh5 lane QA (7bf4533 — pollution small, −26% GENUINE, lane-wide
  promo/coin/album excludes, 15/15 re-validated) · tests-in-CI (575536b —
  scripts/lib/instruments.mjs one-equation canon + 37-test fail-fast step,
  GREEN run 32308355655) · landers v2 (app 7106e57 — 62 set hubs, link mesh,
  methodology mirrored to app domain, sitemap 232) · story kits 5/day +
  /studio/archive (8368b4b + app d0c3abd) · sandbox prep DARK (de1e2d8 —
  heat/depth 🍭 + labels gated Aug 26 / Aug 21) · weekly SLOT-7/8 wired +
  dry-run clean (7c2f9d6) · newsletter LINKED PREVIEW (b33712f, canonical
  untouched — Tyler's one-look approval).
- Suite pass Aug 19: subtype indexes · watch-outcomes logger · premium
  history · TCGplayer net variant (tool-audit-aug19.md).
- Sealed/Raw index family · daily card mint · methodology + 🍭 · Studio
  v0 (overlay + kits) · Lighthouse 95/100 · write-vs-commit law ·
  outputs rescue (57) · thin-n premium gate (me1 ⚠n=7) · full premium
  table in feed.
