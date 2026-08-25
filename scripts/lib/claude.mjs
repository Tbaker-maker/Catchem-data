// ── ONE PLACE THAT READS WHAT THE API SAID ─────────────────────────────────
// Four scripts call the Anthropic API and every one of them wrote the same
// twenty lines: build the body, check res.ok, join the text blocks. Three of
// the four then dropped stop_reason, and daily-research's version of that
// omission cost eight days of a silently dead radar — a green run every
// morning, a digest written every morning, and the file it was supposed to
// produce untouched since the 19th.
//
// The failure is not that somebody forgot. It is that FORGETTING WAS POSSIBLE
// FOUR TIMES OVER. A shared caller cannot be forgotten in one file and
// remembered in another, and when the next completeness signal turns out to
// matter it gets handled here once rather than in four places three of which
// will be missed.
//
// WHAT THIS REFUSES:
//   res.ok false              the call failed; the body is an error page
//   stop_reason max_tokens    the answer is cut off; a truncated answer that
//                             looks well-formed is worse than no answer,
//                             because it gets written to a file
//   stop_reason refusal       the model declined; empty text is not a result
//   no text blocks            tool calls only, or nothing at all
//
// Callers that genuinely want a truncated answer pass allowTruncated: true and
// receive stopReason so they can say so in their own output. Nobody gets it by
// accident.
const FETCH_TIMEOUT_MS = 120000;

export async function callClaude({
  apiKey,
  model = "claude-sonnet-4-6",
  maxTokens = 12000,
  messages,
  tools,
  system,
  allowTruncated = false,
  label = "anthropic",
} = {}) {
  if (!apiKey) throw new Error(`${label}: no API key`);

  const body = { model, max_tokens: maxTokens, messages };
  if (tools) body.tools = tools;
  if (system) body.system = system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // fetch resolves on a 4xx. Without this the error page becomes the answer.
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`${label}: API ${res.status} — ${detail}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  // THE FIELD THAT COST EIGHT DAYS. The provider states whether it finished.
  if (data.stop_reason === "max_tokens" && !allowTruncated) {
    throw new TruncatedError(
      `${label}: response hit max_tokens (${maxTokens}) and is incomplete. ` +
      `Raise maxTokens or shorten the prompt — do NOT write this to a file.`,
      text, data.stop_reason);
  }
  if (data.stop_reason === "refusal") {
    throw new Error(`${label}: the model declined to answer. Nothing was produced.`);
  }
  if (!text.trim() && !allowTruncated) {
    throw new Error(`${label}: no text in the response (stop_reason: ${data.stop_reason}).`);
  }

  return { text, stopReason: data.stop_reason, usage: data.usage ?? null, raw: data };
}

// Carries the partial text, so a caller can SAVE what arrived for a human to
// read while still refusing to treat it as a result. daily-research does
// exactly that: the digest is worth reading even when the radar block is cut.
export class TruncatedError extends Error {
  constructor(message, partialText, stopReason) {
    super(message);
    this.name = "TruncatedError";
    this.partialText = partialText;
    this.stopReason = stopReason;
  }
}
