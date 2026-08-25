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
