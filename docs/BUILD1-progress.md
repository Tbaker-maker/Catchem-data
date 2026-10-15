# BUILD1 progress

Started from origin/main. Workflow files are not edited. A step that needs a workflow edit is marked BLOCKED after the rest of that item is merged.

1. Post Office catalogue builder: SHIPPED, PR #273, SHA e6da04e2dedc60ba36e1aba665b91f99eb4bfbe6. Nightly workflow hook BLOCKED. Script: scripts/build-post-office-catalogue.mjs.
2. News shared file: SHIPPED, PR #275, SHA 55733b3de99fdf16cd0e5a099473b7c9c18ca82d. Midday schedule BLOCKED (needs a workflow edit). The night job stamps research/digests/news.json.
3. News source registry: in this PR. Logged robots and terms checks drop a source. An empty log does not drop one. No pages are fetched.
4. News dedupe labels: not started
5. News impact record: not started
6. Pattern lab: not started
7. Read scorer: not started
8. Data drift bot: not started
9. Custom reads: not started
