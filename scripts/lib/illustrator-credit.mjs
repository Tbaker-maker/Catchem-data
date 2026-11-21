// A credit needs a letter or a number. A dash, or any other mark with neither, is no credit.
export function illustratorCredit(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || !/\p{L}|\p{N}/u.test(text)) return "";
  return text;
}

// Catalogue rows store null when there is no credit, so a later fill can add one.
export function catalogueArtist(value) {
  const credit = illustratorCredit(value);
  return credit || null;
}

// Rewrites artist fields only. A dash inside a name or a note stays.
// A sourced credit is kept, with whitespace folded. Only a sourceless value becomes null.
export function scrubArtistJson(text) {
  return String(text).replace(/"artist"\s*:\s*(null|"(?:\\.|[^"\\])*")/g, (full, token) => {
    if (token === "null") return full;
    const value = JSON.parse(token);
    const credit = catalogueArtist(value);
    if (credit === value) return full;
    if (!credit) return '"artist":null';
    return `"artist":${JSON.stringify(credit)}`;
  });
}
