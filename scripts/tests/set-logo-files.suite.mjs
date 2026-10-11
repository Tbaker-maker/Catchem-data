// Catalogue set logos the Post Office can serve at /img/{setId}/logo.png.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const LISTED = ["me55", "me2pt5", "me3", "me4", "me5", "mee", "me55c"];

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
  const official = JSON.parse(await readFile(new URL("data/set-logos.json", root), "utf8"));
  const present = new Map((report.present || []).map((row) => [row.id, row]));
  const missing = new Map((report.missing || []).map((row) => [row.id, row]));
  t("the report lists the six sets and me55c", JSON.stringify(report.listed) === JSON.stringify(LISTED));
  t("me55c exists in data/set-logos.json", Boolean(official.sets && official.sets.me55c));
  t("mee is not a pokemontcg.io set id in data/set-logos.json", !(official.sets && official.sets.mee));
  for (const id of LISTED) {
    const row = present.get(id);
    const gap = missing.get(id);
    t(`${id} is present or missing, not both`, Boolean(row) !== Boolean(gap));
    let buf = null;
    try {
      buf = await readFile(new URL(`research/assets/img/${id}/logo.png`, root));
    } catch {
      buf = null;
    }
    if (row) {
      const size = buf ? pngSize(buf) : null;
      const sha = buf ? createHash("sha256").update(buf).digest("hex") : "";
      t(`${id} file is the reported png`, Boolean(size) && size.width === row.width && size.height === row.height && buf.length === row.bytes && sha === row.sha256, sha.slice(0, 12));
      t(`${id} source is pokemon.com`, typeof row.source === "string" && row.source.startsWith("https://www.pokemon.com/static-assets/"));
    } else {
      t(`${id} has no logo.png`, buf == null);
      t(`${id} missing reason is recorded`, Boolean(gap && gap.reason));
    }
  }
  return fail;
}
