// Builds the daily morning email from reads.json only. Never sends.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shell, cta, footer, toText, esc, num, catalogueImg, SITE } from "./lib/email.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
const images = JSON.parse(await readFile(join(ROOT, "research/assets/public/catalogue-images.json"), "utf8")).images || {};
const asOf = reads.asOf;

function pair(row) {
  const r = row.receipt || {};
  if (r.fromPrice != null && r.toPrice != null && r.from && r.to) {
    return { a: r.fromPrice, aDate: r.from, b: r.toPrice, bDate: r.to, label: "price" };
  }
  if (r.askFrom != null && r.askTo != null && r.from && r.to) {
    return { a: r.askFrom, aDate: r.from, b: r.askTo, bDate: r.to, label: "ask" };
  }
  if (r.marketFrom != null && r.marketTo != null && r.from && r.to) {
    return { a: r.marketFrom, aDate: r.from, b: r.marketTo, bDate: r.to, label: "market" };
  }
  return null;
}

function linkFor(row) {
  const href = String(row.href || "");
  if (/^\/p\/[a-z0-9-]+$/i.test(href) && !/tcgcsv-|\/data\//i.test(href)) return SITE + href;
  return SITE;
}

const ready = (reads.reads || []).map((row) => ({ row, pair: pair(row) })).filter((x) => x.pair);

let rows = "";
if (ready.length < 3) {
  rows = `<tr><td style="padding:16px 0;color:#efe9de;font:16px/1.5 Arial,Helvetica,sans-serif;">Quiet night. Fewer than 3 reads had both prices and both dates. No padding.</td></tr>`;
} else {
  rows = ready.map(({ row, pair: p }) => {
    const img = catalogueImg(images, row.sku || row.id, row.kind === "sealed" ? "Sealed" : "Card");
    const href = linkFor(row);
    return `<tr><td style="padding:12px 0;border-top:1px solid #2f2b26;">
      <table role="presentation" width="100%"><tr>
        <td width="84" valign="top">${img}</td>
        <td valign="top" style="padding-left:12px;color:#efe9de;font:15px/1.4 Arial,Helvetica,sans-serif;">
          <a href="${esc(href)}" style="color:#efe9de;text-decoration:none;font-weight:700;">${esc(row.name)}</a><br>
          <span style="color:#c4baab;font-size:13px;">${esc(p.label)} ${num(p.a, "reads.json", p.aDate)} on ${esc(p.aDate)}. ${esc(p.label)} ${num(p.b, "reads.json", p.bDate)} on ${esc(p.bDate)}.</span>
        </td>
      </tr></table>
    </td></tr>`;
  }).join("");
}

const body = `
<tr><td style="padding:0 0 8px;color:#c4baab;font:15px/1.4 Arial,Helvetica,sans-serif;">Morning board, ${esc(asOf)}.</td></tr>
${rows}
<tr><td>${cta("Open the board")}</td></tr>
<tr><td>${footer({ asOf, sources: ["reads.json"] })}</td></tr>
`;

const subject = `Catch'em morning, ${asOf}`;
const html = shell({ subject, preheader: `Board reads with both prices and both dates. ${asOf}.`, body });
const dir = join(ROOT, "newsletter/out");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `daily-${asOf}.html`), html);
await writeFile(join(dir, `daily-${asOf}.txt`), toText(html));
console.log(`daily email: newsletter/out/daily-${asOf}.html, qualifying ${ready.length}`);
