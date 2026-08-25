// send-gate.mjs — the policy half of the send confirmation.
//
// Separated from post-queue.mjs because that file dispatches on argv at import
// time, so anything living inside it can only be tested by running the command
// — and the command needs a terminal and a live account. The prompting is I/O.
// This is the RULE, and the rule is the part that must not be wrong.
//
// WHY THE RULE MATTERS MORE THAN USUAL: X's Original Content Rewards program
// states that content created or posted by automated means is ineligible
// (data/compliance-register.json, retrieved 2026-08-25). So "did a human
// actually confirm this" is not a UX question, it is the eligibility question,
// and the answer has to be decidable and auditable rather than implied by the
// fact that somebody usually runs it by hand.
//
// DEFAULT IS REFUSE. Every path that is not an explicit, present, correct answer
// returns proceed:false — including the empty string, the timeout, and a step
// name this function does not recognise.

export function evaluateConfirmation({ step, timedOut, answer }) {
  if (timedOut)
    return { proceed: false, code: "TIMEOUT",
      reason: "Timed out after 5 minutes with no answer. Nothing sent. A post nobody was present to press send on is the exact thing this gate exists to prevent." };

  const a = String(answer ?? "").trim();

  if (step === "time") {
    // The thirty-minute question IS the feature. A post that goes out when
    // nobody can answer replies does worse than one that waits an hour.
    if (/^(y|yes)$/i.test(a)) return { proceed: true, code: "OK", reason: "" };
    return { proceed: false, code: "NO_TIME",
      reason: `Answered "${a || "nothing"}". Nothing sent — come back when you have the half hour. The replies are where the post is won, and a post nobody can answer for does worse than one that waits.` };
  }

  if (step === "confirm") {
    // Must be the word itself. "y" is a reflex; typing send is a decision.
    if (/^send$/i.test(a)) return { proceed: true, code: "OK", reason: "" };
    return { proceed: false, code: "NOT_CONFIRMED",
      reason: `You typed "${a || "nothing"}", not 'send'. Cancelled, nothing was posted.` };
  }

  return { proceed: false, code: "UNKNOWN_STEP",
    reason: `unknown confirmation step "${step}" — refusing by default` };
}
