// x-auth.mjs — OAuth 1.0a request signing for the X API.
//
// X still requires OAuth 1.0a HMAC-SHA1 for posting as a user; the bearer-token
// path is read-only app context and cannot tweet. So the four credentials in
// .env are consumer key/secret plus an access token/secret bound to the account.
//
// The signature is fiddly and fails silently in a specific way: a wrong encoding
// or an unsorted parameter produces a valid-looking 401, which reads exactly
// like a bad key. So this is written once, here, and everything else calls it.
import { createHmac, randomBytes } from "node:crypto";
import { loadEnv } from "./load-env.mjs";

// RFC 3986, not encodeURIComponent. The four characters ! * ' ( ) are left
// alone by encodeURIComponent and MUST be escaped for the signature to match —
// this is the single commonest reason a correct key returns 401.
const enc = (s) =>
  encodeURIComponent(String(s)).replace(/[!*'()]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase());

export function authHeader({ method, url, params = {}, key, secret, token, tokenSecret }) {
  const oauth = {
    oauth_consumer_key: key,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };
  // Query params and oauth params are signed together, sorted by encoded key.
  const all = { ...params, ...oauth };
  const base = Object.keys(all).sort()
    .map((k) => enc(k) + "=" + enc(all[k])).join("&");
  const sigBase = [method.toUpperCase(), enc(url), enc(base)].join("&");
  const signingKey = enc(secret) + "&" + enc(tokenSecret);
  oauth.oauth_signature = createHmac("sha1", signingKey).update(sigBase).digest("base64");
  return "OAuth " + Object.keys(oauth).sort()
    .map((k) => enc(k) + '="' + enc(oauth[k]) + '"').join(", ");
}

export function creds(env = process.env) {
  const c = {
    key: env.X_API_KEY, secret: env.X_API_SECRET,
    token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_SECRET,
  };
  const missing = Object.entries(c).filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
  return { ...c, ok: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// signedFetch — one signed request, for everything that is not token minting.
//
// WHY THIS EXISTS AND authHeader IS NOT ENOUGH. In OAuth 1.0a the query string
// is part of what gets signed, so a GET has to put its parameters in TWO places
// that must agree byte for byte: the signature base and the url. Append them to
// the url by hand and forget to pass them to the signer and X returns a 401 —
// which reads exactly like a bad key, and sent us hunting credentials that were
// fine. This function is the only place that knows a signed request has two
// landing sites for one set of params, so that mistake is no longer available
// to callers.
//
// The query string is rebuilt here with the SAME RFC-3986 encoder the signature
// used, not URLSearchParams. URLSearchParams writes a space as "+" and leaves
// ! * ' ( ) alone; the server re-encodes what it receives before checking the
// signature, so the two normally survive, and "normally" is not a property you
// want in an auth path that fails as a 401.
//
// It does NOT throw on an HTTP error. A 404 on a deleted post and a 429 on a
// rate limit are ordinary outcomes that callers need to tell apart, and turning
// both into exceptions pushes them into a catch block that can only guess.
// Network and timeout failures still throw, because there is no status to read.
export async function signedFetch(method, url, params = {}, {
  body, headers = {}, timeoutMs = 30000, credentials,
} = {}) {
  const c = credentials ?? (loadEnv(), creds());
  if (!c.ok) {
    throw new Error(
      `missing X credentials: ${c.missing.join(", ")}\n` +
      `  Add them to .env in the repo root (.env is gitignored — it cannot be committed).`);
  }
  const auth = authHeader({ method, url, params, ...c });
  const qs = Object.keys(params).sort()
    .map((k) => enc(k) + "=" + enc(params[k])).join("&");
  const r = await fetch(qs ? url + "?" + qs : url, {
    method: method.toUpperCase(),
    headers: { Authorization: auth, ...headers },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON — text is the whole record */ }
  return { ok: r.ok, status: r.status, headers: r.headers, text, json };
}
