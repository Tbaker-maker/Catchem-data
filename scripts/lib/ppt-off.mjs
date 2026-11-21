// PPT_OFF skips every Pokemon Price Tracker HTTP call and every PPT file read.
// Unset, empty, or any other value leaves PPT on. This is the default.
// A skipped dataset is omitted. Nothing here invents a count or a price.

export function pptOff(env = process.env) {
  const v = String(env.PPT_OFF ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function pptOffBanner(script) {
  return `PPT_OFF: ${script} skipped. No request was sent. No PPT file was read.`;
}

export function isPptDataPath(path) {
  const p = String(path || "").replace(/\\/g, "/");
  if (p.includes("/raw/ppp/") || p.includes("ppp-raw-private") || p.includes("/data/ppp/")) return false;
  if (/(^|\/)data\/ppt(\/|$)/.test(p)) return true;
  if (p.includes("ppt-raw-private")) return true;
  if (p.includes("ppt-history-raw")) return true;
  if (/(^|\/)data\/history\/ppt-sealed-private(\/|$)/.test(p)) return true;
  if (/(^|\/)data\/history\/ppt-sealed(\/|$)/.test(p)) return true;
  if (/(^|\/)raw\/\d{4}-\d{2}-\d{2}(\/|$)/.test(p)) return true;
  return false;
}

export function assertPptCallAllowed() {
  if (!pptOff()) return;
  const err = new Error("PPT_OFF: refused a Pokemon Price Tracker request. No request was sent.");
  err.code = "PPT_OFF";
  throw err;
}
