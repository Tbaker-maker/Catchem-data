// PPT_OFF skips the request. The public logs still have to move, or a
// freshness check cannot tell a skipped night from a dead writer.
// Credits stay zero. Resume ids are kept. No price is written.

import { slabStatus } from "./ppt-slabs.mjs";

export function pptOffUsage(prior, now = new Date()) {
  const asOf = now.toISOString().slice(0, 10);
  const usedToday = prior && prior.asOf === asOf && Number.isFinite(Number(prior.credits?.usedToday))
    ? Number(prior.credits.usedToday)
    : 0;
  return {
    asOf,
    status: "skipped",
    reason: "PPT_OFF is set. No request was sent. No PPT file was read.",
    credits: {
      used: { sealed: 0, singles: 0, slabs: 0, intraday: 0, crosscheck: 0, total: 0 },
      usedToday,
      usedThisRun: 0,
      remaining: null,
    },
    items: { sealed: 0, singles: 0, slabs: 0 },
    errors: [],
    raw: "not fetched",
    note: "Public log only. No API key and no raw prices. This run did not call PPT.",
  };
}

export function pptOffCursor(prior, now = new Date()) {
  const asOf = now.toISOString().slice(0, 10);
  const done = Array.isArray(prior?.done) ? prior.done.filter((id) => typeof id === "string") : [];
  return {
    asOf,
    done,
    advanced: false,
    note: "PPT_OFF. Resume point kept. Ids only. Not a price. No request was sent.",
  };
}

export function skippedSlabStatus(asOf = new Date().toISOString().slice(0, 10)) {
  const status = slabStatus({
    asOf,
    candidates: [],
    historyByCard: {},
    creditsUsed: 0,
    enabled: false,
  });
  status.status = "skipped";
  status.reason = "PPT_OFF: no request was sent. No PPT file was read. No median was written.";
  status.shortfallReason = "PPT_OFF: the candidate list was not read.";
  status.cards = [];
  status.candidates = 0;
  status.withProductId = 0;
  return status;
}
