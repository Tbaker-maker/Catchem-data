// Builds the daily morning email from the published board only. Never sends.
// A read is in only when both TCGplayer market prices sit in that exact day's daily file
// (history starts 2026-09-26) and the move clears the board minimums.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shell, cta, footer, toText, esc, SITE } from "./lib/email.mjs";
import { provenBoard, makeDayLoader, loadSealedPid, isRotatedSet, ROTATION_LINE, MIN_PCT, MIN_USD, MIN_USD_SEALED } from "./lib/email-proof.mjs";
import { askBoxLines } from "./lib/real-listing.mjs";

// --root <dir> renders a sample from another tree (used for the newsletter/out/samples render).
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > 0 ? process.argv[rootArg + 1] : join(dirname(fileURLToPath(import.meta.url)), "..");
const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
const asOf = reads.asOf;
const sealedPid = await loadSealedPid(ROOT);
const { kept, dropped } = await provenBoard(reads, { day: makeDayLoader(ROOT), sealedPid });
const sealedByPid = new Map();
try {
  const tape = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
  for (const product of tape.products || []) {
    const pid = String(product.tcgPlayerId || "");
    if (/^\d+$/.test(pid)) sealedByPid.set(pid, product);
    if (product.id) sealedByPid.set(String(product.id), product);
  }
} catch { /* no sealed tape */ }

// A number shown in the email, tied to the file and day it came from.
const n = (value, src, date) => `<span data-src="${esc(src)}" data-asof="${esc(date)}">${esc(value)}</span>`;
const name = (s) => `<span data-name="1">${esc(s)}</span>`;
const usd = (v) => Number(v).toFixed(2);
const dayFile = (d) => `TCGCSV daily ${d}`;

function imageFor(row) {
  const src = String(row.image || "");
  const ok = /^https:\/\/(catchemtcg\.com\/|tcgplayer-cdn\.tcgplayer\.com\/product\/\d+_in_\d+x\d+\.jpg$)/.test(src) && !/og\.png$/.test(src);
  if (ok) return `<img src="${esc(src)}" alt="" width="72" style="display:block;border:0;border-radius:8px;max-width:72px;height:auto;">`;
  return `<table role="presentation" width="72" cellpadding="0" cellspacing="0" bgcolor="#1a1815" style="border:1px solid #2f2b26;border-radius:8px;"><tr><td align="center" style="padding:22px 4px;color:#d9b779;font:700 12px Arial,Helvetica,sans-serif;">Catch'em.</td></tr></table>`;
}
function siteLink(row) {
  const href = String(row.href || "");
  return /^\/(p|c)\/[A-Za-z0-9-]+$/.test(href) ? SITE + href : SITE;
}

const items = kept.map(({ row, proof: p }) => {
  const dir = p.up ? "Up" : "Down";
  const pct = Math.round(p.pct);
  const line = `${dir} $${n(usd(p.usd), dayFile(p.bDate), p.bDate)} (${n(pct, dayFile(p.bDate), p.bDate)}%): ${name(row.name)}, $${n(usd(p.a), dayFile(p.aDate), p.aDate)} on ${esc(p.aDate)} to $${n(usd(p.b), dayFile(p.bDate), p.bDate)} on ${esc(p.bDate)}.`;
  // The board's why line, with its dollar figures tied to the later day's file.
  let whyRaw = String(row.why || row.whyItMatters || "").replace(/tcgcsv-\S+|data\/\S+/g, "").trim();
  // A why that only repeats the move adds nothing; say what it is and where both prices came from.
  if (!whyRaw || /^(Up|Down) \$[\d,.]+ on (those two dates|the [a-z ]+)\.?$/i.test(whyRaw)) {
    whyRaw = `${p.sealed ? "Sealed" : "Single"}${row.set ? ", \u0000SET\u0000" : ""}. Both prices are TCGplayer market from our daily files.`;
  }
  const why = esc(whyRaw).replace(/\$([\d,]+(?:\.\d+)?)/g, (_, v) => `$${n(v, dayFile(p.bDate), p.bDate)}`).replace(/(\d+(?:\.\d+)?)%/g, (_, v) => `${n(v, dayFile(p.bDate), p.bDate)}%`).replace("\u0000SET\u0000", name(String(row.set || "").replace(/^[A-Z0-9]+:\s*/, "")));
  const sealedRow = p.sealed ? (sealedByPid.get(String(p.pid)) || sealedByPid.get(String(row.sku || row.id || ""))) : null;
  const box = sealedRow ? askBoxLines(sealedRow, p.b).map((line) => {
    const hit = String(line).match(/https:\/\/www\.ebay\.com\/itm\/\d+/);
    if (!hit) return esc(line);
    const url = hit[0];
    return esc(line.slice(0, hit.index)) + `<a href="${esc(url)}">${esc(url)}</a>` + esc(line.slice(hit.index + url.length));
  }).join("<br>") : "";
  const rot = isRotatedSet(row.set) ? `<br><span style="color:#d9b779;font-size:13px;">${ROTATION_LINE}</span>` : "";
  const tcg = `https://www.tcgplayer.com/product/${p.pid}`;
  const ebay = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(row.name)}`;
  const html = `<tr><td style="padding:12px 0;border-top:1px solid #2f2b26;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="84" valign="top">${imageFor(row)}</td>
    <td valign="top" style="padding-left:12px;color:#efe9de;font:15px/1.45 Arial,Helvetica,sans-serif;">
      <a href="${esc(siteLink(row))}" style="color:#efe9de;text-decoration:none;font-weight:700;">${line}</a><br>
      <span style="color:#c4baab;font-size:13px;">${why}</span>${rot}${box ? `<br><span style="color:#efe9de;font-size:13px;">${box}</span>` : ""}<br>
      <span style="font-size:13px;"><a href="${esc(siteLink(row))}" style="color:#d9b779;">Chart on Catch'em</a> &middot; <a href="${esc(tcg)}" style="color:#d9b779;">TCGplayer</a> <span style="color:#c4baab;">Paid link</span> &middot; <a href="${esc(ebay)}" style="color:#d9b779;">eBay</a> <span style="color:#c4baab;">Paid link</span></span>
    </td>
  </tr></table>
</td></tr>`;
  return { row, p, html };
});

const quiet = items.length < 3;
const top = items[0];
const subject = quiet
  ? `Catch'em morning ${asOf}: quiet night`
  : `${top.p.up ? "Up" : "Down"} $${usd(top.p.usd)}: ${top.row.name}`;
const preheader = quiet
  ? `Fewer than three board reads cleared the bar on ${asOf}. No padding.`
  : `${["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][items.length] || "Several"} board reads, every price from that day's TCGplayer market file.`;

const rows = quiet
  ? `<tr><td style="padding:16px 0;color:#efe9de;font:16px/1.5 Arial,Helvetica,sans-serif;">Quiet night. Fewer than three board reads had both prices in that day's TCGplayer market file and cleared the bar. A thin board is the whole board.</td></tr>`
  : items.map((x) => x.html).join("\n");

const body = `
<tr><td style="padding:0 0 8px;color:#c4baab;font:15px/1.4 Arial,Helvetica,sans-serif;">Morning board, ${esc(asOf)}.</td></tr>
${rows}
<tr><td>${cta("Open the board")}</td></tr>
<tr><td>${footer({ asOf, sources: ["Catch'em board (reads.json)", "TCGplayer market via TCGCSV daily files"] })}</td></tr>
`;

const html = shell({ subject, preheader, body });
const dir = join(ROOT, "newsletter/out");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `daily-${asOf}.html`), html);
const text = toText(html).replace(/&middot;/g, "|").split("\n").map((l) => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n");
await writeFile(join(dir, `daily-${asOf}.txt`), `PREHEADER: ${preheader}\n` + text);
console.log(JSON.stringify({ file: `newsletter/out/daily-${asOf}.html`, subject, board: reads.count, kept: items.map((x) => ({ name: x.row.name, a: x.p.a, aDate: x.p.aDate, b: x.p.b, bDate: x.p.bDate })), dropped: dropped.map((d) => ({ id: d.row.id, why: d.proof.reason })), mins: { pct: MIN_PCT, usd: MIN_USD, sealed: MIN_USD_SEALED } }, null, 1));
