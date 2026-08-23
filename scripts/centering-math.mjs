// centering-math.mjs — the arithmetic, separated from the image.
//
// Written while CC works the API and the deploy. The split is deliberate and it
// is the reason two lanes can run at once here: THIS FILE NEVER TOUCHES AN
// IMAGE. It takes four margins in any unit and returns ratios, thresholds and a
// verdict. CC supplies the four numbers from pixels; everything downstream is
// arithmetic that can be proven correct with no camera, no network and no card.
//
// It also means the hard part is testable today. Edge detection is fiddly and
// lighting-dependent, but the maths underneath it either matches PSA's published
// tolerances or it does not, and that is checkable against hand-measured
// examples from their own documentation.
//
// WHAT IT WILL NOT DO: name a grade. PSA scores four criteria and the lowest
// anchors the result; three of the four are invisible in a photograph. This
// reports centering and what centering alone permits — never what PSA will say.

// PSA's published tolerances. Stored with the disagreement intact, because the
// sources genuinely disagree and pretending otherwise would be the worse error:
// most say 55/45 front for a 10, at least one says PSA tightened it from 60/40
// in early 2025, and PSA's own wording says "approximately".
export const PSA = {
  source: "psacard.com/gradingstandards",
  checked: "2026-08-23",
  note: "PSA says 'approximately' and allows grader variance on eye appeal. Sources disagree on whether the front-10 threshold is 55/45 or 60/40; at least one reports a tightening in early 2025. We use the stricter reading and say so.",
  tiers: [
    { grade: 10, label: "Gem Mint", front: 55, back: 75 },
    { grade: 9,  label: "Mint",     front: 60, back: 90 },
    { grade: 8,  label: "NM-MT",    front: 65, back: 90 },
    { grade: 7,  label: "NM",       front: 70, back: 90 },
  ],
};

// A ratio is the wider border as a percentage of the pair. 2.2mm against 1.8mm
// is 55/45. Units do not matter as long as both come from the same measurement.
export function ratio(a, b) {
  if (!(a >= 0) || !(b >= 0) || a + b === 0) return null;
  const wide = Math.max(a, b), total = a + b;
  return Math.round((wide / total) * 1000) / 10;
}

// THE WORST AXIS DECIDES. A card perfectly centred left-to-right and 60/40
// top-to-bottom is not a 10 - both axes must pass independently, and this is
// the single thing collectors most often get wrong about their own cards.
export function centering({ left, right, top, bottom }) {
  const lr = ratio(left, right), tb = ratio(top, bottom);
  if (lr == null || tb == null) return null;
  return { leftRight: lr, topBottom: tb, worst: Math.max(lr, tb),
    worstAxis: lr >= tb ? "left-to-right" : "top-to-bottom" };
}

// What centering ALONE permits. Never a grade - the ceiling centering sets,
// which is a different and defensible claim.
export function ceiling(front, back = null) {
  const f = front?.worst, b = back?.worst;
  if (f == null) return null;
  for (const t of PSA.tiers) {
    if (f <= t.front && (b == null || b <= t.back)) {
      // Near a boundary the outcome is genuinely uncertain, and saying so is
      // more useful than a confident number. Within one point, the next tier
      // down is a real possibility and we do not sell a coin flip as a reading.
      const margin = Math.round((t.front - f) * 10) / 10;
      return { ceiling: t.grade, label: t.label, frontRatio: f,
        backRatio: b ?? null, margin,
        borderline: margin <= 1,
        says: margin <= 1
          ? `${f}/${Math.round((100 - f) * 10) / 10} front is inside the ${t.grade} threshold by ${margin} of a point. That is close enough that a grader going the other way is a real outcome, not a bad-luck story.`
          : `${f}/${Math.round((100 - f) * 10) / 10} front, worst axis. Centering does not cap this below a ${t.grade}.`,
        neverSays: "what grade PSA will assign. Corners, edges and surface are unmeasurable from a photograph and the lowest of the four anchors the result." };
    }
  }
  return { ceiling: null, frontRatio: f, backRatio: b ?? null, borderline: false,
    says: `${f}/${Math.round((100 - f) * 10) / 10} front is outside every published tolerance down to a 7. Centering alone caps this card low.`,
    neverSays: "what grade PSA will assign." };
}

// THE DECISION, which is the part nobody else has. Not "what grade" but "is it
// worth sending" - and it needs a graded price we can defend. If we do not have
// one it says so and stops, rather than substituting a guess for the number the
// whole calculation turns on.
export function worthSubmitting({ raw, graded, fee = 25, centering: c }) {
  if (raw == null) return { verdict: "unknown", why: "no raw price for this card" };
  if (!graded || !Object.keys(graded).length)
    return { verdict: "cannot say", why: "no graded prices we can defend. The centering reading stands on its own; the money question needs sale figures with a known window, which we do not currently have.",
      centering: c ?? null };
  const cap = c?.ceiling;
  const attainable = Object.entries(graded)
    .map(([g, price]) => ({ grade: Number(g), price }))
    .filter(x => cap == null || x.grade <= cap)
    .sort((a, b) => b.price - a.price);
  if (!attainable.length) return { verdict: "no", why: "no graded price at or below the ceiling centering permits" };
  const best = attainable[0];
  const upside = Math.round((best.price - raw - fee) * 100) / 100;
  return {
    verdict: upside > 0 ? "worth considering" : "no",
    ceiling: cap, raw, bestAttainable: best, fee, upside,
    why: upside > 0
      ? `At the best grade centering permits (${best.grade}), it sells around $${Math.round(best.price).toLocaleString()} against $${Math.round(raw).toLocaleString()} raw. After the $${fee} fee that is $${Math.round(upside).toLocaleString()} of room.`
      : `At the best grade centering permits (${best.grade}), it sells around $${Math.round(best.price).toLocaleString()} against $${Math.round(raw).toLocaleString()} raw. After the $${fee} fee you are ${upside === 0 ? "even" : "down $" + Math.abs(Math.round(upside)).toLocaleString()}.`,
    // The framing compliance asked for: what the numbers show, never what to do.
    framing: "This is what the numbers show. It is not advice, and grading outcomes depend on three criteria no photograph can measure.",
  };
}
