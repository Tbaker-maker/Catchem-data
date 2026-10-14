// Catalogue set logos the Post Office can serve at /img/{setId}/logo.png.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const ORIGINAL = ["me55", "me2pt5", "me3", "me4", "me5", "mee", "me55c"];

function pngSize(buf) {
  if (buf.length < 24) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export async function run() {
  let fail = 0;
  const t = (name, ok, detail = "") => {
    if (ok) console.log("  ok  ", name);
    else { fail++; console.error("  FAIL", name, detail); }
  };
  const root = new URL("../../", import.meta.url);
  const report = JSON.parse(await readFile(new URL("research/assets/img/set-logo-files.json", root), "utf8"));
  const tileDoc = JSON.parse(await readFile(new URL("research/assets/img/set-logo-tiles.json", root), "utf8"));
  const official = JSON.parse(await readFile(new URL("data/set-logos.json", root), "utf8"));
  const published = JSON.parse(await readFile(new URL("research/assets/public/set-logos.json", root), "utf8"));
  const present = new Map((report.present || []).map((row) => [row.id, row]));
  const missing = new Map((report.missing || []).map((row) => [row.id, row]));
  const tiles = new Map((tileDoc.tiles || []).map((row) => [row.id, row]));
  const listed = new Set(report.listed || []);
  t("the original seven ids are still listed", ORIGINAL.every((id) => listed.has(id)));
  t("me6 is an official file", present.has("me6") && listed.has("me6"));
  t("me55c exists in data/set-logos.json", Boolean(official.sets && official.sets.me55c));
  t("mee is not a pokemontcg.io set id in data/set-logos.json", !(official.sets && official.sets.mee));
  const publishedIds = new Set();
  for (const row of Object.values(published.logos || {})) {
    const src = String(row && row.src || "");
    const m = src.match(/^\/img\/([A-Za-z0-9]+)\/logo\.png$/);
    if (m) publishedIds.add(m[1]);
  }
  t("every published logo set id is present, missing, or a branded tile", [...publishedIds].every((id) => present.has(id) || missing.has(id) || tiles.has(id)));
  const ids = [...new Set([...present.keys(), ...missing.keys(), ...ORIGINAL])];
  let matched = 0;
  for (const id of ids) {
    const row = present.get(id);
    const gap = missing.get(id);
    const tile = tiles.get(id);
    if (row && (gap || tile)) {
      t(`${id} is present or missing, not both`, false);
      continue;
    }
    let buf = null;
    try {
      buf = await readFile(new URL(`research/assets/img/${id}/logo.png`, root));
    } catch {
      buf = null;
    }
    if (row) {
      const size = buf ? pngSize(buf) : null;
      const sha = buf ? createHash("sha256").update(buf).digest("hex") : "";
      const ok = Boolean(size) && size.width === row.width && size.height === row.height && buf.length === row.bytes && sha === row.sha256;
      if (!ok) t(`${id} file is the reported png`, false, sha.slice(0, 12));
      else matched += 1;
      if (!String(row.source || "").startsWith("https://www.pokemon.com/")) t(`${id} source is pokemon.com`, false, row.source);
    } else if (tile) {
      const size = buf ? pngSize(buf) : null;
      const sha = buf ? createHash("sha256").update(buf).digest("hex") : "";
      const ok = Boolean(size) && size.width === tile.width && size.height === tile.height && buf.length === tile.bytes && sha === tile.sha256;
      if (!ok) t(`${id} branded tile is the reported png`, false, sha.slice(0, 12));
    } else {
      if (buf) t(`${id} has no logo.png`, false);
      if (!gap || !gap.reason) t(`${id} missing reason is recorded`, false);
    }
  }
  t("every present file matches size and sha256", matched === present.size, `${matched} of ${present.size}`);
  return fail;
}
