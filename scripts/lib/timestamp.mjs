// timestamp.mjs — a Z means UTC, or it means nothing.
//
// Tyler, 2026-08-25: "our timestamps are local time wearing a Z."
//
// He is right, and it was load-bearing. data/post-outcomes.json recorded
// "2026-08-22T21:18:00Z" for a post made at 9:18pm in Vancouver. 21:18 Pacific
// is 04:18 UTC the NEXT DAY. Every hand-typed timestamp in that file was a wall
// clock with a Z stapled on, so posting-hour analysis was reading a number that
// was seven hours from the truth and on the wrong date a third of the time.
//
// HOW WE PROVED WHICH WAS WHICH, rather than guessing: git commit times are
// real UTC. Entry 1 recorded a reading at "2026-08-22T21:30:00Z" and the commit
// carrying it landed at 04:30:16Z — sixteen seconds later, once you read 21:30
// as Pacific. Entry 2 recorded "2026-08-23T19:37:31.524Z" and its commit landed
// at 19:39:04Z — ninety-three seconds later with no conversion at all. So the
// file mixes both conventions, and the tell is MILLISECONDS: values written by
// new Date().toISOString() are genuine UTC, values typed by a human are round
// seconds and are local. A file where the meaning of a field depends on whether
// it has a decimal point is a file that will be misread again.
//
// THE RULE FROM HERE: nothing writes a timestamp without saying what zone it
// came from. A bare Z is accepted only when it is genuinely UTC.
const ZONE = "America/Vancouver";

// The offset has to come from the zone database, not a constant. Vancouver is
// UTC-7 in August and UTC-8 in January, and half our log predates a DST change
// that will silently break any hardcoded seven.
function offsetMs(date, zone = ZONE) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asIfUTC - date.getTime();
}

// A wall clock reading plus a zone gives exactly one instant. Applied twice
// because the first offset is looked up at the wrong instant near a DST edge.
export function localToUTC(wallClock, zone = ZONE) {
  const naive = Date.parse(String(wallClock).replace(/Z$/, "") + "Z");
  if (Number.isNaN(naive)) throw new Error(`unparseable timestamp: ${wallClock}`);
  let guess = naive - offsetMs(new Date(naive), zone);
  guess = naive - offsetMs(new Date(guess), zone);
  return new Date(guess).toISOString();
}

// The hour a human would say they posted at. Kept alongside the UTC instant
// because "9pm" is the thing being tested and no one thinks in 04:18Z.
export function hourLocal(utcISO, zone = ZONE) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour12: false, hour: "2-digit" })
    .formatToParts(new Date(utcISO)).find((x) => x.type === "hour");
  return +p.value % 24;
}

export function localStamp(utcISO, zone = ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(utcISO)).replace(", ", " ");
}

export const ageHours = (postedAt, readAt) =>
  (Date.parse(readAt) - Date.parse(postedAt)) / 3600000;

// ---------------------------------------------------------------------------
// THE GUARD. Called by anything that writes a post timestamp.
//
// It cannot look at "2026-08-22T21:18:00Z" and know whether the human meant UTC
// — that information is not in the string, which is the entire bug. So it does
// not try to be clever. It demands the zone up front and fails loudly without
// it, then checks the things that ARE decidable: a post cannot be in the
// future, and cannot be read before it was posted.
// ---------------------------------------------------------------------------

export class TimestampError extends Error {
  constructor(msg, code) { super(msg); this.name = "TimestampError"; this.code = code; }
}

// Rounding tolerance. Tyler logged the Slakoth post as "02:00" when the commit
// proves it went out at 01:56 local — a real post rounded to the nearest five
// minutes, not a zone error. Anything worse than a quarter hour backwards is a
// genuine inversion and must fail.
const ROUNDING_TOLERANCE_MIN = 15;

export function resolvePostedAt({ at, tz, now = Date.now() }) {
  if (at === null || at === undefined || at === "") {
    const iso = new Date(now).toISOString();
    return { postedAt: iso, hourLocal: hourLocal(iso), tz: "UTC" };
  }
  if (!tz) {
    throw new TimestampError(
      `refusing to record "${at}" without a tz.\n` +
      `  A trailing Z is not evidence of UTC — every timestamp in post-outcomes.json\n` +
      `  carried one and five of six were Pacific wall clocks.\n` +
      `  Pass --tz local   (${ZONE}, what you read off your own clock)\n` +
      `    or --tz UTC     (only if the value genuinely came from a machine in UTC)`,
      "TZ_REQUIRED");
  }
  const zone = tz === "local" ? ZONE : tz;
  const postedAt = zone === "UTC"
    ? new Date(Date.parse(at)).toISOString()
    : localToUTC(at, zone);

  if (Date.parse(postedAt) > now + 60000) {
    throw new TimestampError(
      `${at} (${zone}) resolves to ${postedAt}, which is in the future.\n` +
      `  This is what a local time read as UTC looks like when the zone is west of Greenwich.`,
      "FUTURE_POST");
  }
  return { postedAt, hourLocal: hourLocal(postedAt, zone === "UTC" ? ZONE : zone), tz: zone };
}

export function assertReadingAfterPost(postedAt, readAt, label = "reading") {
  const mins = (Date.parse(readAt) - Date.parse(postedAt)) / 60000;
  if (mins < -ROUNDING_TOLERANCE_MIN) {
    throw new TimestampError(
      `${label} at ${readAt} precedes its post at ${postedAt} by ${Math.round(-mins)} minutes.\n` +
      `  A reading cannot happen before the post. One of the two is a local time wearing a Z.`,
      "READING_BEFORE_POST");
  }
  return mins;
}

// The law, as code. Two readings are comparable when they are the same age, not
// when they are of the same post.
// THE AGE AT WHICH A POST HAS FINISHED MOVING. Declared here because two files
// were each keeping their own copy of it, and a threshold that means one thing
// to the reader and another to the comparator is the shape of the bug below.
export const SETTLED_HOURS = 48;

// ── AMENDED 2026-08-25, AND THIS WAS AN OVER-CORRECTION ───────────────────
// The rule read "only comparable at equal age" with a 10% tolerance, and it was
// written after comparing a TWELVE MINUTE reading against a TWENTY-TWO HOUR one
// - two orders of magnitude apart on a curve that was still climbing steeply.
// That lesson was right.
//
// Applied without a ceiling it then refused to compare a 48.2h reading against
// an 85h one, while the same report called BOTH of them settled. Both cannot be
// true. 48h was chosen precisely because views have largely flattened by then,
// so the whole point of the threshold is that readings past it ARE comparable.
// The guard was discarding valid data and calling it rigour.
//
// A GUARD THAT THROWS AWAY GOOD DATA IS A FAILURE TOO, just a quieter one than
// a guard that lets bad data through: nobody files a bug about an answer they
// never saw. Logged in data/corrections-log.json.
//
// What does NOT change: a settled reading may still never be compared against
// an unsettled one. That was the actual defect and it is still refused.
export function assertComparable(a, b, tolerance = 0.25) {
  if (a >= SETTLED_HOURS && b >= SETTLED_HOURS) return;
  const ratio = Math.max(a, b) / Math.max(Math.min(a, b), 1 / 60);
  if (Math.abs(a - b) > Math.max(tolerance, 0.1 * Math.max(a, b))) {
    throw new TimestampError(
      `comparing a reading at ${a.toFixed(2)}h against one at ${b.toFixed(2)}h ` +
      `(${ratio.toFixed(0)}x apart in age).\n` +
      `  Readings are only comparable at equal age. This comparison is measuring age.`,
      "UNEQUAL_AGE");
  }
}

export { ZONE, ROUNDING_TOLERANCE_MIN };
