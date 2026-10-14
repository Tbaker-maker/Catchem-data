// Shared email shell. Table layout, inline CSS, dark-first, max 620px.
// Never sends. Numbers must arrive already cited.
import { CONDITION_NOTE } from "./read-quality.mjs";

export const SITE = "https://catchemtcg.com";

export const FOOTER_LINES = [
  "An ask is a listing price. A listing is not a sale.",
  "This is market data. It is not advice.",
  CONDITION_NOTE,
];

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&" + "#39;");
}

export function num(value, source, asOf) {
  return `<span data-src="${esc(source)}" data-asof="${esc(asOf)}">${esc(value)}</span> <span style="color:#c4baab;font-size:12px;">${esc(source)}, ${esc(asOf)}</span>`;
}

export function footer({ asOf, sources }) {
  const src = (sources || []).map((s) => esc(s)).join("; ");
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #2f2b26;">
  <tr><td style="padding:18px 0 6px;color:#c4baab;font:14px/1.5 Arial,Helvetica,sans-serif;">Sources: ${src}. As of ${esc(asOf)}.</td></tr>
  ${FOOTER_LINES.map((line) => `<tr><td style="padding:4px 0;color:#c4baab;font:14px/1.5 Arial,Helvetica,sans-serif;">${line}</td></tr>`).join("\n")}
  <tr><td style="padding:4px 0 18px;color:#c4baab;font:14px/1.5 Arial,Helvetica,sans-serif;">Unsubscribe: {{unsubscribe_url}}</td></tr>
</table>`;
}

export function cta(label = "Open Catch'em") {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center" bgcolor="#d9b779" style="border-radius:10px;">
    <a href="${SITE}" style="display:inline-block;padding:14px 22px;color:#1a1407;font:700 16px Arial,Helvetica,sans-serif;text-decoration:none;">${esc(label)}</a>
  </td></tr>
</table>`;
}

export function tile(label, value, source, asOf) {
  return `
<td width="33%" valign="top" style="padding:6px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1815" style="border:1px solid #2f2b26;border-radius:10px;">
    <tr><td style="padding:14px 10px;text-align:center;">
      <div style="color:#efe9de;font:700 22px Arial,Helvetica,sans-serif;">${num(value, source, asOf)}</div>
      <div style="color:#c4baab;font:13px/1.3 Arial,Helvetica,sans-serif;margin-top:6px;">${esc(label)}</div>
    </td></tr>
  </table>
</td>`;
}

export function shell({ subject, preheader, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(subject)}</title>
<!-- SUBJECT: ${esc(subject)} -->
</head>
<body style="margin:0;padding:0;background:#12100e;color:#efe9de;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#12100e" style="background:#12100e;">
  <tr><td align="center" style="padding:16px 12px;">
    <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
      <tr><td style="padding:8px 0 16px;font:700 28px Georgia,'Times New Roman',serif;color:#efe9de;">Catch'em<span style="color:#d9b779;">.</span></td></tr>
      ${body}
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

export function brandedTile(kind) {
  return `<table role="presentation" width="72" cellpadding="0" cellspacing="0" bgcolor="#1a1815" style="border:1px solid #2f2b26;border-radius:8px;">
    <tr><td align="center" style="padding:16px 6px;color:#d9b779;font:700 11px Arial,Helvetica,sans-serif;">Catch'em.</td></tr>
    <tr><td align="center" style="padding:0 6px 12px;color:#c4baab;font:11px Arial,Helvetica,sans-serif;">${esc(kind || "Card")}</td></tr>
  </table>`;
}

export function catalogueImg(map, id, kind) {
  const raw = map && id != null ? map[id] : "";
  const path = typeof raw === "string" ? raw.trim().split(/[?#]/)[0] : "";
  if (/^(?:\/img\/|\/cards\/|\/thumb\/)/.test(path) && !path.includes("..") && !path.includes("//")) {
    const m = path.match(/^\/(?:img|thumb)\/([A-Za-z0-9]+)\/([A-Za-z0-9._-]+)$/);
    let src = "";
    if (m) {
      const file = /\.[A-Za-z0-9]+$/.test(m[2]) ? m[2] : m[2] + "_hires.png";
      src = `${SITE}/data/editor/tcg/${m[1]}/${file}`;
    } else if (/^\/cards\/[A-Za-z0-9._/-]+$/.test(path)) {
      src = `${SITE}${path}`;
    }
    if (src && !/tcgcsv-|pokemontcg|ebayimg|og:image/i.test(src)) {
      return `<img src="${esc(src)}" alt="" width="72" height="100" style="display:block;border:0;border-radius:8px;">`;
    }
  }
  return brandedTile(kind);
}

export function toText(html) {
  return html
    .replace(/<!-- SUBJECT: (.*?) -->/, "SUBJECT: $1\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}
