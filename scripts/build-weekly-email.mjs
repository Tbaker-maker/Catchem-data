// Builds the weekly email. Never sends.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shell, tile, cta, footer, toText, esc, num, SITE } from "./lib/email.mjs";
import { dedupeNames } from "./lib/weekly-read.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

const weekly = await read("data/derived/weekly-read.json");
const reads = await read("research/assets/public/reads.json");
const counts = await read("research/assets/public/counts.json");
const asOf = weekly.asOf;

const boardReads = Array.isArray(reads.reads) ? reads.reads.length : 0;
const tiles = [
  tile("Reads on the board", boardReads, "reads.json", reads.asOf),
  tile("Products priced", counts.priced, "counts.json", counts.asOf),
  tile("Sets covered", counts.sets, "counts.json", counts.asOf),
].join("");

const sections = [];

const sealed = (weekly.keepsShowingUp?.sealed || []).filter((r) => r.days7 > 0);
if (sealed.length >= 3) {
  const rows = sealed.map((r) => `<tr><td style="padding:8px 0;color:#efe9de;font:15px/1.4 Arial,Helvetica,sans-serif;">${esc(r.name)}<br><span style="color:#c4baab;font-size:13px;">${num(r.days7, "weekly-read.json", r.lastSeen)} this week, ${num(r.days30, "weekly-read.json", r.lastSeen)} this month</span></td></tr>`).join("");
  sections.push(`<tr><td style="padding:18px 0 6px;font:700 18px Georgia,serif;color:#efe9de;">Keeps showing up</td></tr><tr><td><table role="presentation" width="100%">${rows}</table></td></tr>`);
}

const lines = (weekly.sealedAndChase || []).filter((s) => s.set);
if (lines.length >= 3) {
  const rows = lines.map((s) => {
    const names = dedupeNames(s.chaseNames);
    const sealedBit = s.sealedStatus === "live" ? num(s.sealed, "weekly-read.json", asOf) : "building history";
    const chaseBit = s.chaseStatus === "live" ? num(s.chase, "weekly-read.json", asOf) : "building history";
    const nameBit = names.length ? ` (${esc(names.join(", "))})` : "";
    const setName = /\d/.test(String(s.set)) ? num(s.set, "weekly-read.json", asOf) : esc(s.set);
    return `<tr><td style="padding:8px 0;color:#efe9de;font:15px/1.4 Arial,Helvetica,sans-serif;">${setName}<br><span style="color:#c4baab;font-size:13px;">sealed ${sealedBit}; chase ${chaseBit}${nameBit}</span></td></tr>`;
  }).join("");
  sections.push(`<tr><td style="padding:18px 0 6px;font:700 18px Georgia,serif;color:#efe9de;">Sealed line and chase line</td></tr><tr><td style="color:#c4baab;font:14px Arial,Helvetica,sans-serif;padding-bottom:6px;">These are two lines. They are not one number.</td></tr><tr><td><table role="presentation" width="100%">${rows}</table></td></tr>`);
}

const body = `
<tr><td style="padding:0 0 8px;color:#c4baab;font:15px/1.4 Arial,Helvetica,sans-serif;">Weekly read, ${esc(asOf)}.</td></tr>
<tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tiles}</tr></table>
</td></tr>
${sections.join("\n")}
<tr><td>${cta("Open the site")}</td></tr>
<tr><td>${footer({ asOf, sources: ["reads.json", "counts.json", "weekly-read.json"] })}</td></tr>
`;

const subject = `Catch'em weekly, ${asOf}`;
const html = shell({ subject, preheader: `Board, priced products, and sets. ${asOf}.`, body });
const txt = toText(html);
const dir = join(ROOT, "newsletter/out");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `weekly-${asOf}.html`), html);
await writeFile(join(dir, `weekly-${asOf}.txt`), txt);
console.log(`weekly email: newsletter/out/weekly-${asOf}.html`);
console.log(`board reads ${boardReads} (${reads.asOf}), priced ${counts.priced}, sets ${counts.sets}`);
