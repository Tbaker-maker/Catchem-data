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

## DC4
- repo: catchem-bot
- status: SHIPPED
- PR: #76
- merged SHA: 323117a41cd65ff2298f23c7518cd1caa6e0311d
- changed: News cog reads the shared digest, posts official items first, caps at 4 a day, and skips a quiet day. Posted links are remembered.
- left: Tyler sets NEWS_CHANNEL_ID to the #news channel. Until that is set, the cog posts nothing.

## RD5
- repo: Catchem-data
- status: SHIPPED
- PR: #298
- merged SHA: 119c621565def073051dc1de41ab380d822caf30
- changed: Nightly step writes dated listing-call and PPT credit shares. A source with no dated file is omitted. A status warning is added at 85 percent, after the status file is rewritten.
- left: YouTube and Railway stay hidden until a dated usage file exists. No extra API calls were added.

## RD3
- repo: Catchem-data
- status: SHIPPED
- PR: #300
- merged SHA: 33e31d23166fb589d51dc47af698c9ac70e2dc82
- changed: Nightly scout writes dated set and product stubs from Pokemon press only, with a release date and a day-one flag. A known name is skipped. A blocked robots file writes an empty list.
- left: The 2026-10-15 file has no stubs. The digest had no official item with a stated date. Stubs stay out of the live product file until they have a product id, so they do not spend listing calls.

## RD16
- repo: Catchem-data
- status: SHIPPED
- PR: #301
- merged SHA: 401f74fb69296b6c0056458af12c1dedcf30b84f
- changed: Nightly step writes a dated Canada gap file from the hand-kept CAD list, the newest US market point, and the Bank of Canada rate. An empty list writes an empty file.
- left: Tyler adds rows to config/cad-retail.json before any product gap appears. No new price calls were added.

## RD8
- repo: Catchem-data
- status: SHIPPED
- PR: #305
- merged SHA: 0358e014a6b3c65d43d5aaecd97294f55896a67f
- changed: Sunday 8 AM Pacific workflow writes a dated founder brief from merged PR titles, the status file, and the limit file. The 12 newest merges are listed. A missing source is omitted.
- left: The first file is 2026-10-15. Later Sundays write the next file. YouTube and Railway stay hidden until a dated usage file exists.

## DC1
- repo: catchem-bot
- status: SHIPPED
- PR: #79
- merged SHA: cb4a7624c5f0b8d01b182926600330131c1bd8c7
- changed: Weekly member pulse counts rooms, slash commands, and features. Message text is never stored. A quiet week posts nothing.
- left: Tyler sets MEMBER_PULSE_CHANNEL_ID to the private staff room. Until that is set, the cog posts nothing.





