// x-authorize.mjs — mint a real X access token/secret without the dev portal.
//
// The consumer key/secret in .env are valid; the access token/secret were not
// (both 91 chars, neither carrying the "{userid}-" prefix every real access
// token has, so a different credential pair had been pasted into those slots).
//
// Rather than send Tyler back into the developer portal to hunt for "Access
// Token and Secret", this runs the standard OAuth 1.0a three-legged flow in
// PIN mode: it asks X for a temporary token, hands over ONE url to click, and
// exchanges the PIN he gets back for the real pair — then writes them into .env
// itself. His entire job is one click and seven digits.
//
//   node scripts/x-authorize.mjs           -> prints the authorize url
//   node scripts/x-authorize.mjs <PIN>     -> exchanges it and saves to .env
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "./lib/load-env.mjs";
import { authHeader } from "./lib/x-auth.mjs";

loadEnv();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV = join(ROOT, ".env");
const TMP = join(ROOT, "data/.x-request-token.json");   // gitignored via data/? no — see below

const key = (process.env.X_API_KEY || "").trim();
const secret = (process.env.X_API_SECRET || "").trim();

async function form(url, header, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: header, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ?? "",
    signal: AbortSignal.timeout(25000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
  return Object.fromEntries(new URLSearchParams(text));
}

// Step 1 — a temporary token. oauth_callback=oob is what puts X into PIN mode,
// which matters because we have no web server to receive a redirect.
export async function requestToken() {
  const url = "https://api.twitter.com/oauth/request_token";
  const params = { oauth_callback: "oob" };
  const header = authHeader({ method: "POST", url, params, key, secret, token: "", tokenSecret: "" });
  return form(url + "?oauth_callback=oob", header);
}

// Step 3 — trade the PIN for the real thing.
export async function accessToken(reqToken, reqSecret, pin) {
  const url = "https://api.twitter.com/oauth/access_token";
  const params = { oauth_verifier: pin };
  const header = authHeader({ method: "POST", url, params, key, secret, token: reqToken, tokenSecret: reqSecret });
  return form(url, header, "oauth_verifier=" + encodeURIComponent(pin));
}

// Write the pair back into .env in place, touching nothing else in the file.
export async function saveToEnv(token, tokenSecret) {
  const src = await readFile(ENV, "utf-8");
  const nl = src.includes("\r\n") ? "\r\n" : "\n";
  const out = src.split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (t.startsWith("X_ACCESS_TOKEN=")) return "X_ACCESS_TOKEN=" + token;
    if (t.startsWith("X_ACCESS_SECRET=")) return "X_ACCESS_SECRET=" + tokenSecret;
    return line;
  }).join(nl);
  await writeFile(ENV, out);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!key || !secret) { console.error("X_API_KEY / X_API_SECRET missing from .env"); process.exit(1); }
  const pin = process.argv[2];
  if (!pin) {
    const t = await requestToken();
    await writeFile(TMP, JSON.stringify({ token: t.oauth_token, secret: t.oauth_token_secret }));
    console.log("Open this, click Authorize, and copy the 7-digit PIN:\n");
    console.log("  https://api.twitter.com/oauth/authorize?oauth_token=" + t.oauth_token + "\n");
    console.log("Then run:  node scripts/x-authorize.mjs <PIN>");
  } else {
    const saved = JSON.parse(await readFile(TMP, "utf-8"));
    const a = await accessToken(saved.token, saved.secret, pin.trim());
    await saveToEnv(a.oauth_token, a.oauth_token_secret);
    console.log(`✓ authorized as @${a.screen_name} (id ${a.user_id})`);
    console.log(`  access token  ${a.oauth_token.length} chars, saved to .env`);
    console.log(`  access secret ${a.oauth_token_secret.length} chars, saved to .env`);
  }
}
