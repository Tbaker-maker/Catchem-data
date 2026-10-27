// Catalogue set logos at research/assets/img/{setId}/logo.png come from an
// allowed image host only: images.pokemontcg.io (the logo listed for that set
// id in data/set-logos.json). pokemon.com files are no longer used (Tyler,
// 2026-10-27). A set with no allowed logo is listed under missing, or keeps
// its branded tile. Paced, one request at a time.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMG = join(ROOT, "research/assets/img");
export const ALLOWED_LOGO_HOSTS = ["images.pokemontcg.io"];
const PACE_MS = 400;

export function allowedLogoUrl(url) {
  try {
    const u = new URL(String(url || ""));
    return u.protocol === "https:" && ALLOWED_LOGO_HOSTS.includes(u.hostname) ? u.href : "";
  } catch {
    return "";
  }
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function trimPng(raw) {
  const meta = await sharp(raw).metadata();
  const png = await sharp(raw).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer();
  const out = await sharp(png).metadata();
  return { png, rawWidth: meta.width, rawHeight: meta.height, width: out.width, height: out.height };
}

async function main() {
  const sets = JSON.parse(await readFile(join(ROOT, "data/set-logos.json"), "utf8")).sets || {};
  const reportPath = join(IMG, "set-logo-files.json");
  const prev = JSON.parse(await readFile(reportPath, "utf8"));
  const tiles = new Set((JSON.parse(await readFile(join(IMG, "set-logo-tiles.json"), "utf8")).tiles || []).map((t) => t.id));
  const ids = [...new Set([...(prev.listed || []), ...(prev.present || []).map((r) => r.id), ...(prev.missing || []).map((r) => r.id), ...Object.keys(sets)])].sort();
  const present = [];
  const missing = [];
  for (const id of ids) {
    if (tiles.has(id)) continue;
    const src = allowedLogoUrl(sets[id]?.logo);
    if (!src) {
      missing.push({ id, reason: "No logo on an allowed image host (images.pokemontcg.io) for this id. Left on the tile." });
      continue;
    }
    await sleep(PACE_MS);
    let raw;
    try {
      const res = await fetch(src, { headers: { "user-agent": "catchem-data set logos (polite, paced)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      missing.push({ id, reason: `The allowed logo did not load (${err.message}). Left on the tile.` });
      continue;
    }
    const { png, rawWidth, rawHeight, width, height } = await trimPng(raw);
    const file = `research/assets/img/${id}/logo.png`;
    await mkdir(join(IMG, id), { recursive: true });
    await writeFile(join(ROOT, file), png);
    present.push({ id, file, source: src, rawBytes: raw.length, rawWidth, rawHeight, bytes: png.length, width, height, sha256: sha(png) });
    console.log(`  ok ${id} ${width}x${height}`);
  }
  const report = {
    rule: "A Post Office catalogue logo is research/assets/img/{setId}/logo.png. The file is the images.pokemontcg.io logo for that set id, trimmed to the artwork. No pokemon.com file is used. A set with no allowed logo file is listed under missing and is left on the tile.",
    listed: [...new Set([...(prev.listed || []), ...present.map((r) => r.id)])].sort(),
    present,
    missing,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`present ${present.length}, missing ${missing.length}`);
}

if (process.argv[1] && process.argv[1].endsWith("fetch-set-logo-files.mjs")) await main();
