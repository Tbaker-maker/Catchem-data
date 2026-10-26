// Test tiers for the nightly. Decides what a failing test does to the run.
//
//   block    price safety: price data, copy rules, sealed has no condition
//            label, nothing private published. Stops the run before anything
//            is committed. Every test not named below lands here (fail closed).
//   withhold a reads or feature test. Prices still fetch, commit and publish.
//            Only that group's public files are put back to the last committed
//            copy, so a file that failed its own test is never published.
//   monitor  main's own artifact freshness. The nightly is what fixes a stale
//            main, so a stale main must never stop the nightly (the Oct 23 to
//            Oct 26 deadlock) or any pull request.
//
// No limits or cutoffs live here. This file only names tests and paths.

const PUB = "research/assets/public/";

// Any failing test whose own name says it guards one of these is price safety,
// whatever group it sits in. Copy rules never degrade to a withhold.
export const SAFETY_WORDS = /em dash|en dash|banned|condition label|\bNM\b|private|creator|collectr|\bsold\b|advice|PPT history|invented/i;

export const MONITOR_TESTS = [
  /reader files are within \d+ days of the nightly date/i,
  /files? (are |is )?more than \d+ runs? stale/i,
  /^artifact freshness/i,
];

// Group order matters: the first match wins.
export const GROUPS = [
  {
    key: "set-value",
    label: "set value pages",
    match: /^(feature-data|set-value|set-master)\.suite\.mjs$/,
    paths: [PUB + "feed/set-value.json", PUB + "set-value"],
  },
  {
    key: "track-record",
    label: "track record",
    match: /^track-record\.suite\.mjs$/,
    paths: [PUB + "track-record.json", PUB + "premium-proof.json"],
  },
  {
    key: "condition-ladder",
    label: "loose card condition prices",
    match: /^condition-ladder\.suite\.mjs$/,
    paths: [PUB + "condition-prices.json"],
  },
  {
    key: "market-meter",
    label: "market meter",
    match: /^market-meter\.suite\.mjs$/,
    paths: [PUB + "market-meter.json"],
  },
  {
    key: "ir-sir",
    label: "IR and SIR watch",
    match: /^(ir-sir-watch|ir-cycle)\.suite\.mjs$|^IR and SIR watch suite$/,
    paths: [PUB + "feed/ir-sir.json", PUB + "feed/ir-cycle.json"],
  },
  {
    key: "sparks",
    label: "30 day sparklines",
    match: /^spark suite$/,
    paths: [PUB + "sparks"],
  },
  {
    key: "supply",
    label: "supply lists",
    match: /^(held-products|supply-lead)\.suite\.mjs$/,
    paths: [PUB + "feed/supply-lead.json", PUB + "feed/not-moved.json"],
  },
  {
    key: "reads",
    label: "reads",
    match: /(^|-)reads?(-|\.)|^(board-v3|board-determinism|deep-reads|rd6|rd7|takes|morning-card|signal-chips|phase2-reads|fact-reads|held-reads|feed-rank|feed-sections|feed-extras-nightly|read-library|read-quality|read-scorer|second-library|trend-context|weekly-movers|weekly-read|path-tags|shape-reads|span-reads|rich-reads|history-reads|outlier-dive-reads|research-reads|extra-reads|editor-copy|pattern-lab|call-patterns|proven-signal|hype-crowd|face-stamp-subject|seller-stage)\.suite\.mjs$|^(feed lead rank suite|custom reads suites|face stamp subject suite|signal chips suite|seller tag and run stage suite|reads subprocess: .*)$/,
    paths: [
      PUB + "reads.json", PUB + "today.json", PUB + "reads-preview.json", PUB + "signal-chips.json",
      PUB + "feed/item-reads", PUB + "feed/read-synth.json", PUB + "feed/extra-reads.json",
      PUB + "feed/read-library.json", PUB + "feed/lead-order.json", PUB + "feed/facts", PUB + "feed/facts.json",
      PUB + "feed/today",
    ],
  },
];

const SECTION = /^── (.+) ──$/;
const TOP_FAIL = /^ {2}✗ (.+?)(?: — (.*))?$/;
const INNER_FAIL = /^\s*(?:FAIL|✗)\s+(.+?)\s*$/;
const DONE = /^\d+ passed · (\d+) failed$/;

/** Reads run-tests.mjs output. Each failure carries the inner test names it rolled up. */
export function parseLog(text) {
  const failures = [];
  let section = "";
  let inner = [];
  let finished = false;
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/\r$/, "");
    const sec = line.match(SECTION);
    if (sec) { section = sec[1]; inner = []; continue; }
    if (DONE.test(line.trim())) { finished = true; continue; }
    if (/^ {2}✓ /.test(line)) { inner = []; continue; }
    const top = line.match(TOP_FAIL);
    if (top) {
      failures.push({ name: top[1].trim(), detail: top[2] || "", section, inner });
      inner = [];
      continue;
    }
    const sub = line.match(INNER_FAIL);
    if (sub) inner.push(sub[1].replace(/\s+—.*$/, ""));
  }
  return { failures, finished };
}

function groupOf(name) {
  return GROUPS.find((g) => g.match.test(name)) || null;
}

/** One failure → its tier. Unknown names block. */
export function tierOf(failure) {
  const names = [failure.name, ...(failure.inner || [])];
  if (names.some((n) => SAFETY_WORDS.test(n))) return { tier: "block" };
  const leaves = failure.inner && failure.inner.length ? failure.inner : [failure.name];
  if (leaves.every((n) => MONITOR_TESTS.some((re) => re.test(n)))) return { tier: "monitor" };
  const g = groupOf(failure.name);
  if (g) return { tier: "withhold", group: g };
  return { tier: "block" };
}

/**
 * The whole run. mode "nightly": safety blocks, groups withhold, freshness is
 * reported only. mode "pr": everything but freshness blocks, because a pull
 * request must be fully green on its own code, and main's staleness is not its code.
 */
export function triage(text, mode = "nightly") {
  const { failures, finished } = parseLog(text);
  const out = { mode, finished, blocked: [], withheld: [], monitor: [], paths: [] };
  if (!finished) {
    out.blocked.push({ name: "the test runner stopped before its summary line", inner: [] });
    return out;
  }
  const byGroup = new Map();
  for (const f of failures) {
    const r = tierOf(f);
    if (r.tier === "monitor") { out.monitor.push(f); continue; }
    if (r.tier === "withhold" && mode === "nightly") {
      if (!byGroup.has(r.group.key)) byGroup.set(r.group.key, { key: r.group.key, label: r.group.label, paths: r.group.paths, tests: [] });
      byGroup.get(r.group.key).tests.push(f);
      continue;
    }
    out.blocked.push(f);
  }
  out.withheld = [...byGroup.values()];
  out.paths = [...new Set(out.withheld.flatMap((g) => g.paths))];
  return out;
}

const names = (f) => (f.inner && f.inner.length ? `${f.name} (${f.inner.join("; ")})` : f.name);

/** Plain words for the run summary and the issue. No dashes as punctuation. */
export function describe(result) {
  const lines = [];
  if (result.blocked.length) {
    lines.push("Prices did not publish tonight. A price safety test failed:");
    for (const f of result.blocked) lines.push(`- ${names(f)}`);
  } else {
    lines.push("Prices fetch, commit and publish tonight.");
  }
  for (const g of result.withheld) {
    lines.push(`Withheld: ${g.label}. The site keeps the last good copy of ${g.paths.join(", ")}. Failing tests:`);
    for (const f of g.tests) lines.push(`- ${names(f)}`);
  }
  for (const f of result.monitor) lines.push(`Freshness only, not blocking: ${names(f)}`);
  if (!result.blocked.length && !result.withheld.length && !result.monitor.length) lines.push("Every test passed. Nothing withheld.");
  return lines.join("\n");
}
