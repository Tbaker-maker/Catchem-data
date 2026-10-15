# P-1017 progress

A fresh chat resumes at the first job that is not SHIPPED or SKIPPED.

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
