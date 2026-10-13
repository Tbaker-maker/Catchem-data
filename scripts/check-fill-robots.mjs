// Nightly: re-check robots.txt for every allowed fill source. Terms are checked once (config/fill-sources.json).
// A source whose robots now blocks us is marked blocked and is not used. Never bypasses a block.
import { readFile, writeFile } from "node:fs/promises";
const P = new URL("../config/fill-sources.json", import.meta.url);
const cfg = JSON.parse(await readFile(P, "utf8"));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
for (const src of cfg.allowed) {
  const host = src.site.split(" ")[0];
  try {
    const res = await fetch(`https://${host}/robots.txt`, { headers: { "user-agent": "CatchEm/1.0 (catchemtcg.com)" }, signal: AbortSignal.timeout(10000) });
    const text = res.ok ? await res.text() : "";
    const star = text.split(/\n(?=user-agent)/i).find((b) => /^user-agent:\s*\*/im.test(b)) || "";
    src.robotsBlocked = /^disallow:\s*\/\s*$/im.test(star);
    src.robotsChecked = today;
  } catch (err) { src.robotsChecked = today; src.robotsError = String(err.message || err).slice(0, 120); }
  await new Promise((r) => setTimeout(r, 10000));
}
await writeFile(P, JSON.stringify(cfg, null, 2) + "\n");
console.log(cfg.allowed.map((s) => `${s.site}: ${s.robotsBlocked ? "blocked" : "ok"}`).join("\n"));
