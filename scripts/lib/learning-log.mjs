// One immutable call row per Feed read. Not a public Pages file.
import { appendFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const DEADBAND_7D = 0.03;

export function printedOnPT(bundle) {
  const asOf = String(bundle?.asOf || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return asOf;
  const t = Date.parse(bundle?.updatedAt || "");
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
}

export function skuId(read) {
  const blob = `${read?.href || ""} ${read?.id || ""}`;
  const hit = blob.match(/tcgcsv-\d+/);
  return hit ? hit[0] : "";
}

export function kindOf(read) {
  const k = String(read?.kind || "");
  if (k === "single" || k === "singles") return "singles";
  if (k === "sealed") return "sealed";
  const href = String(read?.href || "");
  if (href.includes("/p/")) return "sealed";
  if (href.includes("/c/")) return "singles";
  return "";
}

export function priceSource(read) {
  const s = String(read?.source || "");
  if (/ebay\s*ask/i.test(s)) return "ebay_ask";
  if (/tcgplayer\s*market/i.test(s)) return "tcgplayer_market";
  return "";
}

export function pointsInChart(read) {
  const hist = Array.isArray(read?.hist) ? read.hist : Array.isArray(read?.history) ? read.history : [];
  return hist.length;
}

export function labelOf(read, points) {
  const c = String(read?.confidence || "").toLowerCase();
  if (c === "tracked") return "tracked";
  if (c === "early") return "early";
  return points > 3 ? "tracked" : "early";
}

export function mapTemplate(read) {
  const type = String(read?.type || "");
  const headline = String(read?.headline || read?.claim || "");
  const pct = Number(read?.changePct);
  const src = priceSource(read);
  const pack = /a pack|pack-out|pack out|works out/i.test(headline);
  const revisit = type === "receipt" || /revisited|checked again|wrote this watch down/i.test(headline);
  if (!revisit && (type === "heating" || /heating up/i.test(headline))) {
    return { read_type: "daily", pattern: "heat_1d", direction: "up" };
  }
  if (!revisit && (type === "cooling" || /cooling off/i.test(headline))) {
    return { read_type: "daily", pattern: "cool_1d", direction: "down" };
  }
  if (revisit) {
    let direction = "none";
    if (/\bheating up\b/i.test(headline)) direction = "up";
    else if (/\bcooling off\b/i.test(headline) || /\bnow down\b/i.test(headline)) direction = "down";
    else if (/\bnow up\b/i.test(headline)) direction = "up";
    return { read_type: "watch", pattern: "watch_revisit", direction };
  }
  if (type === "chase" || /top card in/i.test(headline)) {
    return { read_type: "cook", pattern: "chase_top", direction: "none" };
  }
  if (type === "box" || pack) {
    const pattern = src === "ebay_ask" || /ebay ask/i.test(headline)
      ? "box_packout_ask"
      : pack
        ? "box_packout_market"
        : "box_on_list";
    return { read_type: "cook", pattern, direction: "none" };
  }
  const direction = Number.isFinite(pct) ? (pct > 0 ? "up" : pct < 0 ? "down" : "none") : "none";
  const windowed = /\b(over|in) \d+ days\b/i.test(headline);
  const stem = windowed ? "nd" : "1d";
  const pattern = direction === "down" ? `mover_down_${stem}` : direction === "up" ? `mover_up_${stem}` : `mover_flat_${stem}`;
  return { read_type: "daily", pattern, direction };
}

export function isCopied(claim, sku, price, prior) {
  const prev = (prior || []).filter((row) => row.sku_id === sku).at(-1);
  if (!prev) return false;
  if (String(prev.claim) !== String(claim)) return false;
  const a = Number(prev.price_at_flag);
  const b = Number(price);
  if (!(a > 0) || !(b > 0)) return true;
  return Math.abs((b - a) / a) < DEADBAND_7D;
}

export function gradeableOf(row, changePct) {
  if (!["up", "down", "sideways"].includes(row.direction)) return false;
  if (row.price_source !== "tcgplayer_market") return false;
  if (!(Number(row.price_at_flag) > 0)) return false;
  if (row.copied) return false;
  const pct = Number(changePct);
  if (Number.isFinite(pct) && Math.abs(pct) >= 25 && row.points_in_chart <= 3) return false;
  return true;
}

export function callFromRead(read, bundle, prior = []) {
  const sku = skuId(read);
  const mapped = mapTemplate(read);
  const points = pointsInChart(read);
  const printed = printedOnPT(bundle);
  const claim = String(read?.headline || read?.claim || "");
  const price = Number(read?.price);
  const copied = isCopied(claim, sku, price, prior);
  const row = {
    call_id: `${printed}_${sku}_${mapped.pattern}`,
    printed_on: printed,
    sku_id: sku,
    kind: kindOf(read),
    read_type: mapped.read_type,
    pattern: mapped.pattern,
    claim,
    direction: mapped.direction,
    price_at_flag: price,
    price_source: priceSource(read),
    price_as_of: String(read?.asOf || printed),
    points_in_chart: points,
    label: labelOf(read, points),
    gradeable: false,
    copied,
  };
  row.gradeable = gradeableOf(row, read?.changePct);
  return row;
}

export function callsFromBundle(bundle, prior = []) {
  const reads = Array.isArray(bundle?.reads) ? bundle.reads : [];
  const out = [];
  const seen = prior.slice();
  for (const read of reads) {
    const row = callFromRead(read, bundle, seen);
    out.push(row);
    seen.push(row);
  }
  return out;
}

export async function readCallLog(file) {
  try {
    const text = await readFile(file, "utf8");
    return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
}

export async function appendLearningLog(file, bundle) {
  const prior = await readCallLog(file);
  const have = new Set(prior.map((row) => row.call_id));
  const fresh = callsFromBundle(bundle, prior).filter((row) => row.call_id && !have.has(row.call_id));
  const missing = fresh.filter((row) => !row.sku_id);
  if (missing.length) {
    const err = new Error(`sku_id missing on ${missing.length} reads`);
    err.missing = missing.map((row) => row.claim);
    throw err;
  }
  if (!fresh.length) return { added: 0, total: prior.length };
  await mkdir(dirname(file), { recursive: true });
  const body = fresh.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await appendFile(file, body, "utf8");
  return { added: fresh.length, total: prior.length + fresh.length };
}

export async function writeCallLog(file, rows) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}
