// image-override-guard.mjs — stops chat guessing at images.
//
// 2026-08-22: chat set xy12-etb's override from the catalogue shot (which
// showed four boxes for a one-box SKU) to the SELLER photo — an image it
// also could not see — and reported it fixed. Tyler had to report the same
// bug twice. The lesson is not "be more careful": chat has no network access
// to any image CDN, so ANY choice between two unseen sources is a guess.
//
// RULE ENFORCED HERE: an override authored by chat may only be "none", or a
// URL a human supplied. Anything else must carry humanVerified:true, meaning
// a person or CC actually looked at the resulting image.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let ov;
try { ov = JSON.parse(await readFile(join(ROOT, "data/image-overrides.json"), "utf-8")); }
catch { console.log("· image-override-guard: no overrides file, nothing to check"); process.exit(0); }

const bad = [];
for (const [id, o] of Object.entries(ov.products || {})) {
  const authoredByChat = o.setBy === "chat" || !o.setBy;
  const isSafe = o.use === "none" || Boolean(o.url);          // none, or a supplied URL
  const verified = o.humanVerified === true;
  if (authoredByChat && !isSafe && !verified)
    bad.push(`${id}: use="${o.use}" was chosen by chat without a human looking at the result — chat cannot see images, so this is a guess. Set use:"none", supply a url, or mark humanVerified:true after someone checks it.`);
  if (!o.reason) bad.push(`${id}: override has no reason recorded`);
  if (!o.reviewed) bad.push(`${id}: override has no review date`);
}

if (bad.length) {
  console.error(`\n✗ IMAGE OVERRIDE GUARD — ${bad.length} unsafe override(s):`);
  for (const b of bad) console.error(`   ${b}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ image override guard: ${Object.keys(ov.products || {}).length} override(s), all safe or human-verified`);
