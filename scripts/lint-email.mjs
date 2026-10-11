// Email lint. Fails the process if a draft breaks a rule.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANNED = /\b(resistance|support|bottom|buy|sell|holding|printed|play|target|invest)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

export function lintEmail(name, html) {
  const errors = [];
  const subject = (html.match(/<!-- SUBJECT: (.*?) -->/) || [, ""])[1];
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
  if (BANNED.test(text)) errors.push(`${name}: banned word`);
  if (html.includes("\u2014") || html.includes("\u2013")) errors.push(`${name}: em dash`);
  if (EMOJI.test(subject)) errors.push(`${name}: emoji in subject`);
  if (/tcgcsv-|\/data\//i.test(html)) errors.push(`${name}: internal path`);
  if (/og:image|images\.pokemontcg|ebayimg|i\.ebayimg/i.test(html)) errors.push(`${name}: third-party image`);
  if (!html.includes("An ask is a listing price. A listing is not a sale.")) errors.push(`${name}: missing ask line`);
  if (!html.includes("This is market data. It is not advice.")) errors.push(`${name}: missing advice line`);
  if (!html.includes("{{unsubscribe_url}}")) errors.push(`${name}: missing unsubscribe`);
  if (!/As of \d{4}-\d{2}-\d{2}/.test(text)) errors.push(`${name}: missing as-of date`);
  const affiliate = html.match(/<a [^>]*href="[^"]*(?:tag=|aff|partner)[^"]*"[^>]*>/gi) || [];
  for (const tag of affiliate) {
    const i = html.indexOf(tag);
    const near = html.slice(Math.max(0, i - 40), i + tag.length + 40);
    if (!near.includes("Paid link")) errors.push(`${name}: affiliate without Paid link`);
  }
  const cited = html.replace(/<span data-src="[^"]+" data-asof="\d{4}-\d{2}-\d{2}">[\d.,]+<\/span>/g, "");
  const visible = cited.replace(/<[^>]+>/g, " ").replace(/&#\d+;/g, " ").replace(/\d{4}-\d{2}-\d{2}/g, "");
  if (/\d/.test(visible)) errors.push(`${name}: number not tied to a source file and date`);
  return errors;
}

const dir = join(ROOT, "newsletter");
const names = [];
async function walk(p) {
  for (const ent of await readdir(p, { withFileTypes: true })) {
    const full = join(p, ent.name);
    if (ent.isDirectory()) await walk(full);
    else if (/\.(html|txt)$/.test(ent.name) && !ent.name.includes("001") && !ent.name.includes("MOCKUP") && !ent.name.includes("skeleton")) names.push(full);
  }
}
await walk(dir);
const errors = [];
for (const file of names) {
  const html = await readFile(file, "utf8");
  if (file.endsWith(".txt")) continue;
  errors.push(...lintEmail(file.replace(ROOT + "/", ""), html));
}
if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log(`lint-email: ${names.filter((n) => n.endsWith(".html")).length} html files ok`);
