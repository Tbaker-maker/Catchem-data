// The rotation line for a set. Month names print capitalized.

const MONTH_WORDS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// "Rotated april 10, 2026" and "Rotated April 10, 2026" both print with the month capitalized.
export function rotationPhrase(status) {
  const raw = String(status || "").trim();
  if (!raw) return "";
  if (raw === "Standard") return "still Standard legal";
  let phrase = raw.replace(/^rotated\b/i, "rotated");
  for (const name of MONTH_WORDS) {
    phrase = phrase.replace(new RegExp(`\\b${name}\\b`, "i"), name.charAt(0).toUpperCase() + name.slice(1));
  }
  return phrase;
}
