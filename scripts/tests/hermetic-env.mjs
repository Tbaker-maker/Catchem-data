// scripts/tests/hermetic-env.mjs: imported first by run-tests.mjs.
// Tests must not inherit run switches from the job that calls them. The
// nightly sets PPT_OFF=1 for the whole job, and the PPT plan tests then had
// their own fake calls refused (run 45849779862, 2026-11-26). Tests that check
// the switch set it themselves and restore it.
delete process.env.PPT_OFF;
