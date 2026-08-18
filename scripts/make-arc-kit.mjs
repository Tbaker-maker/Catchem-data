// scripts/make-arc-kit.mjs <dayN> — emits a posting kit for that arc day.
// Reads research/x-launch-arc-drafts.md, extracts the day's LEAD/REPLY (or
// numbered-thread) blocks, char-stamps each, writes research/arc-kits/dayN.txt.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const n = process.argv[2]; if(!n){console.log("usage: make-arc-kit.mjs <day>");process.exit(0);}
const s = await readFile(join(ROOT,"research/x-launch-arc-drafts.md"),"utf-8");
const m = s.match(new RegExp(`## Day ${n} ·([^\\n]*)\\n([\\s\\S]*?)(?=\\n---\\n## Day|$)`));
if(!m){console.error("day not found");process.exit(1);}
let kit = `🗓 DAY ${n} —${m[1]}\npost LEAD, then each REPLY as replies · numbered blocks post top-to-bottom\n${"═".repeat(56)}\n\n`;
const blocks = [...m[2].matchAll(/\*\*(LEAD|REPLY \d+|\d+\/)[^*]*\*\*:?\s*\n([\s\S]*?)(?=\n\*\*(?:LEAD|REPLY|\d+\/)|$)/g)];
for(const b of blocks){ const t=b[2].trim(); kit+=`─── ${b[1].replace("/"," of thread")} (${t.replace(/\n/g," ").length}c) ───\n${t}\n\n`; }
await mkdir(join(ROOT,"research/arc-kits"),{recursive:true});
await writeFile(join(ROOT,`research/arc-kits/day${n}.txt`), kit);
console.log(`✓ research/arc-kits/day${n}.txt (${blocks.length} blocks)`);
