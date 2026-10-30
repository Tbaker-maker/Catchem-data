// Fail if the Post Office editor file brings back banned copy or picture hosts.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond, extra) => {
    if (cond) console.log("  ok ", name);
    else { fail++; console.log("  FAIL", name, extra || ""); }
  };
  const html = await readFile(join(ROOT, "research/assets/play.html"), "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  t("play.html has one inline script", scripts.length === 1, String(scripts.length));
  const banned = [
    ["$9", /\$9/],
    ["NFT", /NFT/],
    ["nft", /nft/i],
    ["monetize", /monetize/i],
    ["Tonight's parent straight", /Tonight's parent/],
    ["Tonight's parent curly", /Tonight\u2019s parent/],
    ["pokemontcg", /pokemontcg/i],
    ["limitless", /limitless/i],
    ["serebii", /serebii/i],
  ];
  for (const [name, re] of banned) {
    const n = html.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    t("play.html has no " + name, !n, n ? String(n.length) : "");
  }
  t("Tonight's post is the button", (html.match(/Tonight's post/g) || []).length === 1);
  t("catalogue pictures load by id", html.includes('fetch("/data/catalogue-images.json")') && html.includes("function catalogueShot(") && html.includes("function editorTileSrc("));
  t("catalogue shot is tried before the tile", /function thumbOf\(c\) \{\s*var shot = catalogueShot\(c\);\s*if \(shot\) return shot;/.test(html));
  t("share image blanks kicker fact and credits", html.includes("function shareImageLine(") && html.includes("shareImageLine(boardKicker(sel))") && html.includes("shareImageLine(boardFact(sel))") && html.includes("credits = shareImageLine(credits)"));
  t("share image blanks a dollar amount", /function shareImageLine\(text\) \{[\s\S]*?\$\\s\?\\d/.test(html));
  t("share image blanks odds", /function shareImageLine\(text\) \{[\s\S]*?\\bodds\\b/.test(html));
  t("share image blanks a countdown", /function shareImageLine\(text\) \{[\s\S]*?\\bcountdown\\b/.test(html));
  t("tcg image helper returns empty", /function tcgImg\(\) \{\s*return "";\s*\}/.test(html));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("play-copy.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("play copy ok");
}
