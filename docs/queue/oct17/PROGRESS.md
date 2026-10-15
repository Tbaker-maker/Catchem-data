# P-1017 progress

A fresh chat resumes at the first job that is not SHIPPED or SKIPPED.

## RD15b
- repo: Catchem-data
- status: SHIPPED
- PR: #292
- merged SHA: pending squash of #292
- changed: Nightly feed step publishes research/assets/public as one orphan commit on public-data and checks the file list before the force-push.
- left: The branch is created on the next nightly run. Main still receives the public files until RD15c.
