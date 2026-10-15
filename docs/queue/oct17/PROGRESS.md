# P-1017 progress

A fresh chat skips jobs marked SHIPPED, SKIPPED, or BLOCKED when the date in that job has not arrived. Resume at the next job.

## RD15b
- repo: Catchem-data
- status: SHIPPED
- PR: #292
- merged SHA: 22de19d83b84c3e18de1a9c2abebdfd9616b13db
- changed: Nightly feed step publishes research/assets/public as one orphan commit on public-data and checks the file list before the force-push.
- left: Main still receives the public files until RD15c.

## TF7
- repo: catchem-site
- status: SHIPPED
- PR: #208
- merged SHA: 5fef508e9e87f0cf3ccf27fdebd86cd3e5de8e71
- changed: Server fetches try public-data first and fall back to main. A missing branch locks the session to main. Browser image URLs stay on main.
- left: none. Live pages loaded at 390 and 1280.

## RD15c
- repo: Catchem-data
- status: BLOCKED
- PR: none
- merged SHA: none
- changed: not started
- left: Can run on 2026-10-18 after the 04:00 UTC nightly, once public-data has published on 2026-10-16, 2026-10-17, and 2026-10-18. First publish was 2026-10-15 (d838c336). Tyler does nothing unless one of those nights fails to publish.

## PO2
- repo: catchem-site
- status: SHIPPED
- PR: #209
- merged SHA: 73df8251aeb10d40825e87f08934987b6b64ce21
- changed: Post Office iframe fits the screen, the editor dock stays put, paper rows with prices skip the heavy patch, and invite-only sessions show a line instead of controls.
- left: none. Live pages loaded at 390 and 1280. paper-rows.json returned 200 ten times.

## TF8
- repo: catchem-site
- status: SKIPPED
- PR: none
- merged SHA: none
- changed: not started
- left: Set pages have no Include promos toggle because set files have no promo parent. Tyler must name the parent set for each promo group. Promo-only sets stay as they are.

## RD10
- repo: Catchem-data
- status: SHIPPED
- PR: #295
- merged SHA: 28c0035e251e39eff39dc4bf1e9b90373e9057b1
- changed: Nightly custom reads build writes dated news and games files from the digest. Only allow-list sources are kept. Member slices attach them when news, games, or all is on.
- left: The 2026-10-15 files are empty. No digest row is on the allow list. Pokemon press is the only allowed source.

## TF1
- repo: catchem-site
- status: SHIPPED
- PR: #210
- merged SHA: fd5b6ea90591b453d0212bf8cd2a316e4747df3d
- changed: /reads picker saves follows, a weekly or premium schedule, Discord by default, and optional email. A plain line becomes a plan. Card and sealed pages link in. Email is not sent without READS_EMAIL_KEY.
- left: Tyler adds READS_EMAIL_KEY before any email can go out. Live pages loaded at 390 and 1280, including /reads, with no console errors. The signed-out click ping was removed in #211 (affa319b2b5220fff1b9cb2c20b33dc938b7b984).

## DC3
- repo: catchem-bot
- status: SHIPPED
- PR: #75
- merged SHA: 8ce4c0ee4fa1b607757da8c9a1d309a32bbf9844
- changed: Custom Reads DMs render watchlist first, skip quiet days, and never post in a channel. The loop stays off until CUSTOM_READS_ENABLED=1.
- left: Tyler sets CUSTOM_READS_ENABLED=1 and CUSTOM_READS_FILE to the member payload file before any DM goes out. Discord does not report link taps, so tap counts are not stored yet.



