// Weekly list of cards, sets, and sealed products missing a picture or logo.
// The list goes to catchem-data-private. A tile logo is replaced only when
// images.pokemontcg.io has a logo for that set id. Official files stay put.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { catalogueHit, ptcgHit } from "./lib/image-gap.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = "https://github.com/Tbaker-maker/catchem-data-private.git";
const PRIVATE_REL = "data/image-coverage/latest.json";
const LOCAL_REL = "data/private/image-coverage.json";

// No pokemon.com fetches (2026-10-27). Logos come from images.pokemontcg.io only.
export const WATCH = [];

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    let out = "";
    child.stderr.on("data", (buf) => { err += buf.toString(); });
    child.stdout.on("data", (buf) => { out += buf.toString(); });
    child.on("close", (code) => resolve({ code, err, out }));
  });
}

const redact = (text, token) => (token ? String(text || "").split(token).join("[token]") : String(text || ""));

export function shouldFill(entry, probe) {
  if (!probe || probe.status !== 200 || probe.png !== true) return false;
  if (!entry || entry.kind === "tile" || !entry.logo) return true;
  return false;
}

export function buildCoverage({ sets, logos, images, rows }) {
  const logoBySlug = logos && logos.logos ? logos.logos : {};
  const imageMap = images && images.images ? images.images : (images || {});
  const setsMissing = [];
  const setsTile = [];
  const seen = new Set();
  for (const set of (sets && sets.sets) || []) {
    if (!set || seen.has(set.slug)) continue;
    seen.add(set.slug);
    const logo = String(set.logo || "");
    const entry = logoBySlug[set.slug] || {};
    if (!/^\/img\/[a-z0-9]+\/logo\.png$/i.test(logo)) {
      setsMissing.push({ slug: set.slug || "", name: set.name || "", logo, reason: logo ? "bad path" : "empty" });
    } else if (entry.kind === "tile") {
      setsTile.push({ slug: set.slug, name: set.name || entry.name || "", setId: entry.setId || "", logo });
    }
  }
  const cards = [];
  const sealed = [];
  for (const row of rows || []) {
    const id = Array.isArray(row) ? row[0] : row && row.id;
    const name = Array.isArray(row) ? row[1] : row && row.name;
    const set = Array.isArray(row) ? row[2] : row && row.set;
    const num = Array.isArray(row) ? row[3] : row && row.num;
    const kind = Array.isArray(row) ? row[5] : row && row.kind;
    if (catalogueHit(imageMap, id) || ptcgHit(id)) continue;
    const item = { id: String(id || ""), name: String(name || ""), set: String(set || ""), num: String(num || "") };
    if (kind === "sealed") sealed.push(item);
    else cards.push(item);
  }
  return {
    setsMissing,
    setsTile,
    cards,
    sealed,
    counts: {
      sets: seen.size,
      setsMissing: setsMissing.length,
      setsTile: setsTile.length,
      cards: cards.length,
      sealed: sealed.length,
    },
  };
}

export async function assertEverySetLogo(root) {
  const sets = JSON.parse(await readFile(join(root, "research/assets/public/sets.json"), "utf8"));
  let official = {};
  try {
    official = JSON.parse(await readFile(join(root, "data/set-logos.json"), "utf8")).sets || {};
  } catch {
    official = {};
  }
  const missing = [];
  for (const set of sets.sets || []) {
    const logo = String(set.logo || "");
    const m = logo.match(/^\/img\/([a-z0-9]+)\/logo\.png$/i);
    if (!m) {
      missing.push(set.slug || logo || "(blank)");
      continue;
    }
    let onDisk = false;
    try {
      await access(join(root, "research/assets/img", m[1], "logo.png"));
      onDisk = true;
    } catch {
      onDisk = false;
    }
    if (!onDisk && !official[m[1]]) missing.push(set.slug || m[1]);
  }
  return missing;
}

export async function probeLogo(row, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(row.url, {
    signal: AbortSignal.timeout(20000),
    headers: { "user-agent": "Catchem-data" },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const png = res.status === 200 && buf.length >= 8 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG";
  return { id: row.id, slug: row.slug, url: row.url, status: res.status, png };
}

async function cropOfficial(root, url, dest) {
  const py = join(root, "scripts/build-set-logo-tiles.py");
  const once = () => run("python3", [py, "--crop", url, dest], process.env);
  let result = await once();
  if (result.code !== 0 && /PIL|pillow/i.test(`${result.err}\n${result.out}`)) {
    await run("python3", ["-m", "pip", "install", "pillow"], process.env);
    result = await once();
  }
  if (result.code !== 0) return { ok: false, reason: result.err || result.out || "crop failed" };
  try {
    return { ok: true, meta: JSON.parse(result.out.trim().split("\n").pop()) };
  } catch {
    return { ok: false, reason: "crop did not print a result" };
  }
}

async function rememberFill(root, id, meta, slug) {
  const tilePath = join(root, "research/assets/img/set-logo-tiles.json");
  const tileDoc = JSON.parse(await readFile(tilePath, "utf8"));
  let touched = false;
  for (const row of tileDoc.tiles || []) {
    if (row.id !== id && row.slug !== slug) continue;
    row.width = meta.width;
    row.height = meta.height;
    row.bytes = meta.bytes;
    row.sha256 = meta.sha256;
    touched = true;
  }
  if (touched) await writeFile(tilePath, JSON.stringify(tileDoc, null, 2) + "\n");
  const filledPath = join(root, "research/assets/img/set-logo-filled.json");
  let filled = { ids: [] };
  try { filled = JSON.parse(await readFile(filledPath, "utf8")); } catch { filled = { ids: [] }; }
  const ids = new Set(filled.ids || []);
  ids.add(id);
  await writeFile(filledPath, JSON.stringify({
    note: "These ids were replaced with an official pokemon.com crop. The tile rebuild must keep the file.",
    ids: [...ids].sort(),
  }, null, 2) + "\n");
  return [tilePath, filledPath, join(root, "research/assets/img", id, "logo.png")].map((p) => p.slice(root.length + 1));
}

async function pushPrivate({ token, text, env = process.env, git = run }) {
  if (!token) return { pushed: false, reason: "PRIVATE_DATA_TOKEN is not set. Kept in gitignored data/private/." };
  const netrc = join(homedir(), ".netrc");
  const clone = await mkdtemp(join(tmpdir(), "catchem-images-"));
  const childEnv = {
    ...env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "catchem-bot",
    GIT_AUTHOR_EMAIL: "bot@catchem.app",
    GIT_COMMITTER_NAME: "catchem-bot",
    GIT_COMMITTER_EMAIL: "bot@catchem.app",
  };
  try {
    await writeFile(netrc, `machine github.com\nlogin x-access-token\npassword ${token}\n`, { mode: 0o600 });
    const cloned = await git("git", ["clone", "--depth", "1", REMOTE, clone], childEnv);
    if (cloned.code !== 0) return { pushed: false, reason: `Private repo was not cloned (${redact(cloned.err, token) || "clone failed"}).` };
    const file = join(clone, PRIVATE_REL);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
    await git("git", ["-C", clone, "add", "--", PRIVATE_REL], childEnv);
    if ((await git("git", ["-C", clone, "diff", "--cached", "--quiet"], childEnv)).code === 0) {
      return { pushed: true, reason: "Private repo already has this image coverage list." };
    }
    const committed = await git("git", ["-C", clone, "commit", "-m", "Store the weekly image coverage list"], childEnv);
    if (committed.code !== 0) return { pushed: false, reason: `Commit failed (${redact(committed.err || committed.out, token)}).` };
    const pushed = await git("git", ["-C", clone, "push", "origin", "HEAD:main"], childEnv);
    if (pushed.code !== 0) return { pushed: false, reason: `Push failed (${redact(pushed.err || pushed.out, token)}).` };
    return { pushed: true, reason: "Stored the weekly image coverage list." };
  } catch (err) {
    return { pushed: false, reason: redact(err.message, token) };
  } finally {
    await rm(netrc, { force: true }).catch(() => {});
    await rm(clone, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runImageCoverage({ root = ROOT, token = process.env.PRIVATE_DATA_TOKEN || "", fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const sets = JSON.parse(await readFile(join(root, "research/assets/public/sets.json"), "utf8"));
  const logos = JSON.parse(await readFile(join(root, "research/assets/public/set-logos.json"), "utf8"));
  const images = JSON.parse(await readFile(join(root, "research/assets/public/catalogue-images.json"), "utf8"));
  const rows = JSON.parse(await readFile(join(root, "research/assets/public/search-lite.json"), "utf8"));
  const coverage = buildCoverage({ sets, logos, images, rows });
  const logoFilesMissing = await assertEverySetLogo(root);
  const probes = [];
  const filled = [];
  const publicPaths = [];
  for (const watch of WATCH) {
    let probe;
    try {
      probe = await probeLogo(watch, fetchImpl);
    } catch (err) {
      probe = { id: watch.id, slug: watch.slug, url: watch.url, status: 0, png: false, error: String(err && err.message || err) };
    }
    const entry = (logos.logos || {})[watch.slug] || null;
    const fill = shouldFill(entry, probe);
    const row = { ...probe, filled: false };
    if (fill) {
      const dest = join(root, "research/assets/img", watch.id, "logo.png");
      const cropped = await cropOfficial(root, watch.url, dest);
      if (cropped.ok) {
        const paths = await rememberFill(root, watch.id, cropped.meta, watch.slug);
        publicPaths.push(...paths);
        row.filled = true;
        filled.push({ id: watch.id, slug: watch.slug, file: `research/assets/img/${watch.id}/logo.png` });
      } else {
        row.error = String(cropped.reason || "crop failed").slice(0, 200);
      }
    }
    probes.push(row);
  }
  const doc = {
    asOf: now.toISOString(),
    note: "Cards and sealed products with no catalogue path and no pokemontcg id. Sets with an empty or bad logo. Sets whose logo is a branded tile, not an official series logo.",
    counts: { ...coverage.counts, logoFilesMissing: logoFilesMissing.length },
    setsMissingLogo: coverage.setsMissing,
    setsTileOnly: coverage.setsTile,
    cardsMissing: coverage.cards,
    sealedMissing: coverage.sealed,
    logoFilesMissing,
    probes,
    filled,
  };
  const text = JSON.stringify(doc) + "\n";
  const local = join(root, LOCAL_REL);
  await mkdir(dirname(local), { recursive: true });
  await writeFile(local, text);
  const pushed = await pushPrivate({ token, text });
  return { doc, pushed, publicPaths };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { doc, pushed } = await runImageCoverage();
  console.log(JSON.stringify({
    asOf: doc.asOf,
    counts: doc.counts,
    probes: doc.probes.map((row) => ({ id: row.id, status: row.status, png: row.png, filled: row.filled })),
    filled: doc.filled,
    privatePushed: Boolean(pushed.pushed),
    privateReason: pushed.reason,
  }));
  if (process.env.IMAGE_COVERAGE_REQUIRE_PUSH === "1" && !pushed.pushed) process.exit(1);
}
