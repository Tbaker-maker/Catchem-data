// Product pictures use two hosts: images.pokemontcg.io and tcgplayer-cdn.tcgplayer.com.
// A curated set logo stays at catchemtcg.com/img/{setId}/logo.png. That file is ours.
// A catalogue path is copied onto the first host. A product id uses the second.
// A set logo is not a product photo. A mismatched catalogue id is not used.
// A top slot with no reachable allowed picture moves down. The reason is logged.

export const ALLOWED_IMAGE_HOSTS = ["images.pokemontcg.io", "tcgplayer-cdn.tcgplayer.com"];
export const IMAGE_REASONS = ["id-mismatch", "missing-sealed-map", "dead-host", "no-image"];

const STRIP = /^(move|mover|streak|plain|high|low|set|spread|askmove|mktmove)-/;

export function isCuratedLogoUrl(url) {
  return /^https:\/\/catchemtcg\.com\/img\/[A-Za-z0-9]+\/logo\.png$/.test(String(url || ""));
}

export function allowedImageHost(url) {
  try {
    const u = new URL(String(url || ""));
    return u.protocol === "https:" && ALLOWED_IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export function isSetLogoUrl(url) {
  return /\/logo\.png(?:\?|$)/i.test(String(url || ""));
}

function normNum(value) {
  const left = String(value || "").split("/")[0].trim();
  const m = left.match(/^0*(\d+[a-z]?)$/i);
  return m ? m[1].toLowerCase() : left.toLowerCase();
}

export function allowedCatalogueUrl(raw) {
  const path = String(raw || "").trim().split(/[?#]/)[0];
  if (!path || path.includes("..")) return "";
  if (allowedImageHost(path)) return path;
  if (path.includes("//")) return "";
  const m = path.match(/^\/(?:img|thumb|cards)\/([A-Za-z0-9]+)\/([A-Za-z0-9._-]+)$/);
  if (!m) return "";
  const file = /\.[A-Za-z0-9]+$/.test(m[2]) ? m[2] : `${m[2]}_hires.png`;
  return `https://images.pokemontcg.io/${m[1]}/${file}`;
}

function pathIdentity(raw) {
  const path = String(raw || "").trim().split(/[?#]/)[0];
  const local = path.match(/\/(?:img|thumb|cards)\/([A-Za-z0-9]+)\/([A-Za-z0-9._-]+)$/);
  const remote = path.match(/images\.pokemontcg\.io\/([A-Za-z0-9]+)\/([A-Za-z0-9._-]+)$/);
  const m = local || remote;
  if (!m) return null;
  const file = m[2].replace(/_hires\.png$/i, "").replace(/\.png$/i, "");
  return { setId: m[1], number: file };
}

function idsOf(row, sealedPid) {
  const ids = [row?.sku, row?.id, row?.sourceLine]
    .map((v) => String(v || "").replace(STRIP, ""))
    .filter(Boolean);
  for (const id of [...ids]) {
    const pid = sealedPid && sealedPid.get(id);
    if (pid) ids.push(`tcgcsv-${pid}`);
  }
  return ids;
}

function productPid(row, ids, sealedPid) {
  for (const id of ids) {
    const hit = String(id).match(/^tcgcsv-(\d+)$/);
    if (hit) return hit[1];
  }
  for (const id of [row?.sku, row?.id, row?.sourceLine].map((v) => String(v || ""))) {
    const bare = id.replace(STRIP, "");
    if (sealedPid && sealedPid.get(bare)) return String(sealedPid.get(bare));
    if (sealedPid && sealedPid.get(id)) return String(sealedPid.get(id));
  }
  const direct = String(row?.tcgPlayerId || "");
  if (/^\d+$/.test(direct)) return direct;
  return "";
}

function isSealedRead(row) {
  const kind = String(row?.kind || row?.readKind || "").toLowerCase();
  return kind === "sealed";
}

function tileUrl(url) {
  const s = String(url || "");
  return !s || s.endsWith("/og.png");
}

function usable(url, reachable) {
  if (!allowedImageHost(url) && !isCuratedLogoUrl(url)) return false;
  if (typeof reachable === "function" && reachable(url) === false) return false;
  return true;
}

// url is an allowed reachable product picture, or "".
// reason is empty when url is set. Otherwise one of IMAGE_REASONS.
export function mapReadImage(row, opts = {}) {
  const images = opts.images || {};
  const tcgOn = opts.tcgOn !== false;
  const sealedPid = opts.sealedPid || new Map();
  const reachable = opts.reachable;
  const ids = idsOf(row, sealedPid);
  const declaredSet = String(row?.setId || "");
  const declaredNum = row?.number != null && row.number !== "" ? String(row.number) : "";
  let sawMismatch = false;
  let sawDead = false;
  let url = "";

  const take = (candidate) => {
    if (!candidate || url) return;
    if (isSetLogoUrl(candidate) || tileUrl(candidate)) return;
    if (!allowedImageHost(candidate)) {
      sawDead = true;
      return;
    }
    if (typeof reachable === "function" && reachable(candidate) === false) {
      sawDead = true;
      return;
    }
    url = candidate;
  };

  for (const id of ids) {
    const raw = typeof images[id] === "string" ? images[id] : "";
    if (!raw) continue;
    const ident = pathIdentity(raw);
    if (declaredSet && declaredNum && ident && (ident.setId !== declaredSet || normNum(ident.number) !== normNum(declaredNum))) {
      sawMismatch = true;
      continue;
    }
    take(allowedCatalogueUrl(raw));
  }

  if (tcgOn) {
    const pid = productPid(row, ids, sealedPid);
    if (pid) take(`https://tcgplayer-cdn.tcgplayer.com/product/${pid}_in_400x400.jpg`);
  }

  take(String(row?.image || ""));

  if (url) return { url, reason: "" };

  const pid = productPid(row, ids, sealedPid);
  const sealedIds = opts.sealedImageIds;
  const inSealedMap = sealedIds ? ids.some((id) => sealedIds.has(id)) : false;
  if (sawMismatch) return { url: "", reason: "id-mismatch" };
  if (isSealedRead(row) && sealedIds && !inSealedMap && !pid) return { url: "", reason: "missing-sealed-map" };
  if (sawDead) return { url: "", reason: "dead-host" };
  return { url: "", reason: "no-image" };
}

export async function leadDeadSet(urls, reachable) {
  const dead = new Set();
  const check = typeof reachable === "function" ? reachable : headReachable;
  for (const url of urls || []) {
    if (!(await check(url))) dead.add(url);
  }
  return dead;
}

export async function headReachable(url) {
  if (isCuratedLogoUrl(url)) return true;
  if (!allowedImageHost(url)) return false;
  const once = async (method) => {
    const res = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(8000) });
    return res.status;
  };
  try {
    let status = await once("HEAD");
    if (status === 405 || status === 403) status = await once("GET");
    if (status >= 200 && status < 400) return true;
    return false;
  } catch {
    return true;
  }
}

// After pictures are attached, a top slot with no reachable allowed picture
// moves down. Later reads with a picture fill the slot. The log is id + reason.
export function settleReadImages(reads, opts = {}) {
  const boardMax = Number.isFinite(opts.boardMax) ? opts.boardMax : 8;
  const reachable = opts.reachable;
  const prepared = (reads || []).map((row) => {
    const pictured = typeof opts.picture === "function" ? opts.picture(row) : "";
    const pick = mapReadImage(row, opts);
    let image = "";
    if (usable(pictured, reachable)) image = pictured;
    else if (usable(pick.url, reachable)) image = pick.url;
    const reason = image ? "" : (pick.reason || "no-image");
    const next = { ...row, image };
    return { next, reason };
  });

  const qualified = [];
  const deferred = [];
  const tail = [];
  const log = [];
  let filling = true;
  for (const item of prepared) {
    const ok = usable(item.next.image, reachable);
    if (filling && qualified.length < boardMax) {
      if (ok) qualified.push(item.next);
      else {
        log.push({ id: String(item.next.id || ""), reason: item.reason });
        deferred.push(item.next);
      }
    } else {
      filling = false;
      tail.push(item.next);
    }
  }
  for (const line of log) if (opts.logLines !== false) console.log(`read-image ${line.id} ${line.reason}`);
  return { reads: [...qualified, ...deferred, ...tail], log };
}
