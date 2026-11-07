// When the catalog gains a set, register its logo before the nightly tests.
// An official logo is fetched only from images.pokemontcg.io. Anything else
// becomes a text tile and is flagged. This never throws and never fails the run.
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { isRejectedLogoSha } from "./set-quarantine.mjs";

export const ALLOWED_LOGO_HOSTS = ["images.pokemontcg.io"];
const API = "https://api.pokemontcg.io/v2/sets";
const PACE_MS = 400;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function normName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function allowedLogoUrl(url) {
  try {
    const u = new URL(String(url || ""));
    return u.protocol === "https:" && ALLOWED_LOGO_HOSTS.includes(u.hostname) ? u.href : "";
  } catch {
    return "";
  }
}

export function safeId(id) {
  const s = String(id || "");
  return /^[A-Za-z0-9]+$/.test(s) ? s : "";
}

export function tileIdFor(slug) {
  return safeId(String(slug || "").replace(/-/g, ""));
}

export function pickOfficial(name, officialSets) {
  const want = normName(name);
  if (!want) return null;
  const hits = [];
  for (const [id, meta] of Object.entries(officialSets || {})) {
    if (!meta || normName(meta.name) !== want) continue;
    const url = allowedLogoUrl(meta.logo);
    const setId = safeId(id);
    if (!url || !setId) continue;
    hits.push({ id: setId, url, name: meta.name });
  }
  const ids = new Set(hits.map((row) => row.id));
  if (ids.size !== 1) return null;
  return hits[0];
}

export function officialFromApi(catalogName, doc) {
  const want = normName(catalogName);
  const hits = [];
  for (const row of doc?.data || []) {
    if (normName(row?.name) !== want) continue;
    const url = allowedLogoUrl(row?.images?.logo);
    const id = safeId(row?.id);
    if (!url || !id) continue;
    hits.push({ id, url, name: String(row.name || "") });
  }
  const ids = new Set(hits.map((row) => row.id));
  if (ids.size !== 1) return null;
  return hits[0];
}

function escapeXml(text) {
  return String(text || "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
}

function wrapName(name) {
  const words = String(name || "Set").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (trial.length <= 28) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export function textTileSvg(name) {
  const lines = wrapName(name);
  const texts = lines.map((line, i) => (
    `<text x="320" y="${86 + i * 36}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#efe9de">${escapeXml(line)}</text>`
  )).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="220" viewBox="0 0 640 220">
  <rect x="4" y="4" width="632" height="212" rx="28" fill="#1a1815" stroke="#d4af37" stroke-width="3"/>
  <text x="320" y="40" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="18" fill="#d4af37">Catch'em</text>
  ${texts}
</svg>`;
}

async function pngFromSvg(name) {
  const png = await sharp(Buffer.from(textTileSvg(name))).png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(png).metadata();
  return { png, width: meta.width || 640, height: meta.height || 220 };
}

async function cropPng(raw) {
  try {
    const png = await sharp(raw).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer();
    const meta = await sharp(png).metadata();
    if (png.length >= 8 && meta.width > 0 && meta.height > 0) return { png, width: meta.width, height: meta.height };
  } catch {
    // A trim that throws falls through to the uncropped png. The run still gets a file.
  }
  const png = await sharp(raw).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(png).metadata();
  return { png, width: meta.width || 0, height: meta.height || 0 };
}

function idTaken(id, slug, logos, tiles) {
  for (const [key, row] of Object.entries(logos || {})) {
    if (!row || row.slug === slug) continue;
    if (row.setId === id || key === id) return true;
  }
  return (tiles || []).some((row) => row && row.id === id && row.slug !== slug);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function logoPath(id) {
  return `/img/${id}/logo.png`;
}

function publishEntry(target, entry) {
  if (!target || typeof target !== "object") return;
  target[entry.slug] = entry;
  if (entry.setId) target[entry.setId] = entry;
  for (const [key, row] of Object.entries(target)) {
    if (row && row.slug === entry.slug) target[key] = entry;
  }
}

export function registrationFor(slug, { logos = {}, tiles = [] } = {}) {
  const logo = logos[slug];
  const tile = (tiles || []).find((row) => row && row.slug === slug);
  const path = String(logo?.logo || "");
  const official = /^\/img\/[A-Za-z0-9]+\/logo\.png$/.test(path);
  const recorded = Boolean(tile && tile.sha256 && tile.width && tile.height);
  const text = Boolean((tile && (tile.text === true || tile.kind === "text" || tile.flag)) || logo?.text === true);
  if (text && (recorded || official)) return "text";
  if (official) return "logo";
  if (recorded) return "text";
  return "";
}

async function fetchOfficial(name, officialSets, fetchImpl) {
  const local = pickOfficial(name, officialSets);
  if (local) return local;
  const q = encodeURIComponent(`name:"${String(name || "").replace(/"/g, "")}"`);
  let res;
  try {
    res = await fetchImpl(`${API}?q=${q}&pageSize=5`, {
      signal: AbortSignal.timeout(20000),
      headers: { accept: "application/json", "user-agent": "catchem-data/set-logos" },
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  try {
    return officialFromApi(name, await res.json());
  } catch {
    return null;
  }
}

async function fetchLogo(url, fetchImpl) {
  const allowed = allowedLogoUrl(url);
  if (!allowed) return { ok: false, reason: "logo host is not allowed" };
  let res;
  try {
    res = await fetchImpl(allowed, {
      signal: AbortSignal.timeout(20000),
      headers: { accept: "image/png", "user-agent": "catchem-data set logos (polite, paced)" },
      redirect: "follow",
    });
  } catch (err) {
    return { ok: false, reason: `logo did not load (${err.message})` };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: `logo host blocked the fetch (${res.status})` };
  if (!res.ok) return { ok: false, reason: `logo host returned ${res.status}` };
  if (res.url && allowedLogoUrl(res.url) === "") return { ok: false, reason: "logo redirect left the allowed host" };
  const raw = Buffer.from(await res.arrayBuffer());
  if (raw.length < 8 || raw[0] !== 0x89 || raw.toString("ascii", 1, 4) !== "PNG") {
    return { ok: false, reason: "allowed host did not return a png" };
  }
  return { ok: true, raw };
}

// Register catalog sets that have no logo yet. Names and ids stay as the catalog wrote them.
export async function registerMissingSets({
  root,
  sets = [],
  logos = null,
  fetchImpl = globalThis.fetch,
  pace = sleep,
} = {}) {
  const result = { entries: [], flagged: [], registered: [], skipped: [] };
  if (!root) return result;
  const logoPathFile = join(root, "research/assets/public/set-logos.json");
  const tilePath = join(root, "research/assets/img/set-logo-tiles.json");
  const flagPath = join(root, "research/assets/img/set-logo-flags.json");
  const filledPath = join(root, "research/assets/img/set-logo-filled.json");
  const officialPath = join(root, "data/set-logos.json");
  const logoDoc = await readJson(logoPathFile, { logos: {} });
  if (!logoDoc.logos || typeof logoDoc.logos !== "object") logoDoc.logos = {};
  const map = logos && typeof logos === "object" ? logos : logoDoc.logos;
  const tileDoc = await readJson(tilePath, {
    rule: "A branded tile is the set name on a rounded Catch'em plate. It is used only when no allowed image host (images.pokemontcg.io) has a logo for that set. It is not an official logo and not fan art.",
    tiles: [],
  });
  if (!Array.isArray(tileDoc.tiles)) tileDoc.tiles = [];
  const flagDoc = await readJson(flagPath, {
    rule: "A text tile means no images.pokemontcg.io logo was available for this catalog set. The name is the catalog name. A flag is not a failure.",
    flagged: [],
  });
  if (!Array.isArray(flagDoc.flagged)) flagDoc.flagged = [];
  const filledDoc = await readJson(filledPath, { ids: [] });
  if (!Array.isArray(filledDoc.ids)) filledDoc.ids = [];
  const official = (await readJson(officialPath, { sets: {} })).sets || {};
  let changed = false;
  let networked = false;

  for (const set of sets || []) {
    const slug = String(set?.slug || "");
    const name = String(set?.name || "");
    if (!slug || !name) continue;
    try {
      const existing = map[slug];
      const existingPath = String(existing?.logo || "");
      const existingId = existingPath.match(/^\/img\/([A-Za-z0-9]+)\/logo\.png$/)?.[1] || "";
      if (existingId && await fileExists(join(root, "research/assets/img", existingId, "logo.png"))) {
        const buf = await readFile(join(root, "research/assets/img", existingId, "logo.png"));
        if (!isRejectedLogoSha(sha256(buf), logoDoc.rejectSha256)) {
          result.skipped.push(slug);
          continue;
        }
      }
      if (networked) await pace(PACE_MS);
      networked = true;
      const officialHit = await fetchOfficial(name, official, fetchImpl);
      let chosen = null;
      let flag = "";
      if (officialHit && !idTaken(officialHit.id, slug, map, tileDoc.tiles)) {
        const got = await fetchLogo(officialHit.url, fetchImpl);
        if (got.ok) {
          const rawDigest = sha256(got.raw);
          const cropped = await cropPng(got.raw);
          const digest = sha256(cropped.png);
          if (isRejectedLogoSha(rawDigest, logoDoc.rejectSha256) || isRejectedLogoSha(digest, logoDoc.rejectSha256)) {
            flag = "the allowed host returned the generic logo for this id, not a set logo";
          } else {
            chosen = { id: officialHit.id, ...cropped, kind: "official", source: officialHit.url, digest };
          }
        } else {
          flag = got.reason;
        }
      } else if (!officialHit) {
        flag = "no allowed logo";
      } else {
        flag = "official id already belongs to another set";
      }
      if (!chosen) {
        const id = tileIdFor(slug);
        if (!id || idTaken(id, slug, map, tileDoc.tiles)) {
          result.flagged.push({ slug, name, id: id || "", reason: flag || "no free tile id" });
          continue;
        }
        const plate = await pngFromSvg(name);
        chosen = { id, ...plate, kind: "text", source: "", digest: sha256(plate.png), flag: flag || "no allowed logo" };
      }
      const rel = `research/assets/img/${chosen.id}/logo.png`;
      await mkdir(join(root, "research/assets/img", chosen.id), { recursive: true });
      await writeFile(join(root, rel), chosen.png);
      const entry = {
        setId: chosen.id,
        slug,
        name,
        logo: logoPath(chosen.id),
        src: logoPath(chosen.id),
        width: chosen.width,
        height: chosen.height,
        bytes: chosen.png.length,
        sha256: chosen.digest,
      };
      if (chosen.kind === "text") {
        entry.kind = "tile";
        entry.text = true;
        entry.flag = chosen.flag;
      }
      map[slug] = entry;
      publishEntry(map, entry);
      if (logoDoc.logos !== map) publishEntry(logoDoc.logos, entry);
      const tile = {
        slug,
        id: chosen.id,
        name,
        file: rel,
        width: chosen.width,
        height: chosen.height,
        bytes: chosen.png.length,
        sha256: chosen.digest,
        kind: chosen.kind,
      };
      if (chosen.kind === "text") {
        tile.text = true;
        tile.flag = chosen.flag;
      } else if (chosen.source) {
        tile.source = chosen.source;
      }
      const at = tileDoc.tiles.findIndex((row) => row && row.slug === slug);
      if (at >= 0) tileDoc.tiles[at] = tile;
      else tileDoc.tiles.push(tile);
      tileDoc.tiles.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
      if (chosen.kind === "official" && !filledDoc.ids.includes(chosen.id)) filledDoc.ids.push(chosen.id);
      if (chosen.kind === "text") {
        const flagged = { slug, name, id: chosen.id, reason: chosen.flag };
        const fi = flagDoc.flagged.findIndex((row) => row && row.slug === slug);
        if (fi >= 0) flagDoc.flagged[fi] = flagged;
        else flagDoc.flagged.push(flagged);
        flagDoc.flagged.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
        result.flagged.push(flagged);
      }
      result.entries.push({ slug, logo: entry });
      result.registered.push(slug);
      changed = true;
    } catch (err) {
      result.flagged.push({ slug, name, id: "", reason: `register left this set on a missing logo (${String(err.message || err).slice(0, 160)})` });
    }
  }

  if (changed) {
    filledDoc.ids.sort();
    await mkdir(join(root, "research/assets/public"), { recursive: true });
    await mkdir(join(root, "research/assets/img"), { recursive: true });
    await writeFile(logoPathFile, `${JSON.stringify(logoDoc, null, 2)}\n`);
    await writeFile(tilePath, `${JSON.stringify(tileDoc, null, 2)}\n`);
    await writeFile(flagPath, `${JSON.stringify(flagDoc, null, 2)}\n`);
    await writeFile(filledPath, `${JSON.stringify(filledDoc, null, 2)}\n`);
  }
  return result;
}
