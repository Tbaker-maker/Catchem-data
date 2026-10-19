import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ADVICE, ALLOWED, BANNED, cleanText, cleanDoc, enforceCopy, flagLine, formatFlag, isClean } from "../lib/copy-rules.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

async function jsonFiles(dir) {
  const out = [];
  for (const f of await readdir(dir)) {
    const p = join(dir, f);
    if ((await stat(p)).isDirectory()) out.push(...(await jsonFiles(p)));
    else if (p.endsWith(".json")) out.push(p);
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, ok, extra = "") => { console.log(`  ${ok ? "ok " : "FAIL"} ${name}${ok ? "" : ` ${extra}`}`); if (!ok) fail += 1; };

  // The one shared rules file.
  const raw = JSON.parse(await readFile(join(ROOT, "rules/advice-phrases.json"), "utf8"));
  t("the rules live in rules/advice-phrases.json", JSON.stringify(raw) === JSON.stringify(ADVICE));
  const patterned = [...ADVICE.promises, ...ADVICE.framing];
  t("every pattern rule has an id, pattern and reason", patterned.every((r) => r.id && r.pattern && r.reason && new RegExp(r.pattern, "i")));
  t("rule ids are unique", new Set([...patterned.map((r) => r.id), ...Object.keys(ADVICE.reasons)]).size === patterned.length + Object.keys(ADVICE.reasons).length);
  t("no reason uses a dash", [...patterned.map((r) => r.reason), ...Object.values(ADVICE.reasons)].every((r) => !/[\u2014\u2013]/.test(r)));
  for (const a of ["Buy", "Shop", "Sell your cards", "price target", "Buy on TCGplayer", "Buy on eBay"]) t(`"${a}" is on the allowed list and passes`, ALLOWED.includes(a) && isClean(a));

  // The labelled set: every line gives exactly its expected rule ids.
  const { cases } = JSON.parse(await readFile(join(ROOT, "rules/advice-cases.json"), "utf8"));
  const live = cases.filter((c) => c.source.startsWith("live:"));
  t("the labelled set has at least 80 real lines", live.length >= 80, String(live.length));
  const wrong = cases.filter((c) => JSON.stringify([...new Set(flagLine(c.text).map((f) => f.rule))].sort()) !== JSON.stringify(c.expect));
  t(`all ${cases.length} labelled lines match (100%)`, wrong.length === 0, wrong.slice(0, 5).map((c) => `${JSON.stringify(c.text)} expected [${c.expect}] got [${flagLine(c.text).map((f) => f.rule)}]`).join(" | "));

  // Each flag names the line, rule, span, phrase and reason.
  const f = flagLine("Honestly, you should sell this now.");
  t("a flag carries line, rule, span, phrase and reason", f.length === 1 && f[0].rule === "directive" && f[0].line.slice(...f[0].span) === f[0].phrase && f[0].phrase === "you should sell" && f[0].reason.length > 10);
  t("a button label inside a line is not what trips it", isClean("Buy on eBay or Buy on TCGplayer") && !isClean("Buy on eBay. Buy it now."));

  // Never rewritten.
  const r = cleanText("Up 4% \u2014 buy it now", { field: "why", id: "r-1" });
  t("cleanText never rewrites", r.text === "Up 4% \u2014 buy it now" && r.fixes.length === 0);
  t("each flag names the line, field, read, rule and reason", r.errors.length === 2 && r.errors.every((e) => e.includes('"Up 4% \u2014 buy it now"') && e.includes('field "why"') && e.includes("read r-1") && /rule [\w-]+ matched/.test(e)));
  t("formatFlag carries the reason", formatFlag(r.flags[0]).endsWith(r.flags[0].reason));
  const doc = { reads: [{ id: "x-8", why: "A breakout from the bottom" }] };
  t("old jargon words pass and nothing is swapped", enforceCopy(doc, "reads") === doc && doc.reads[0].why === "A breakout from the bottom");
  let thrown = "";
  try { enforceCopy({ reads: [{ id: "x-9", why: "You should sell now" }] }, "reads"); } catch (e) { thrown = e.message; }
  t("enforceCopy throws with the line, field, read and reason", /flagged "You should sell now" in field "why" of read x-9/.test(thrown) && /Tells the reader/.test(thrown));
  const idDoc = { id: "scan-pattern-forming-breakout-tcgcsv-84658", key: "buy-now", slug: "load-up", url: "https://x.test/buy-now", file: "data/crypto/play.json", headline: "Up 4% since Oct 1" };
  t("ids, keys, slugs, urls and paths are machine text", cleanDoc(idDoc).errors.length === 0);
  t("house rules: supply and No data are flagged in reads", cleanText("supply fell").errors.length === 1 && cleanText("No data yet").errors.length === 1);
  t("BANNED.test is a drop-in guard", BANNED.test("load up on boxes") === true && BANNED.test("Buy on eBay") === false);

  // Tonight's published files: no false blocks on live copy.
  const flags = [];
  for (const p of await jsonFiles(join(ROOT, "research/assets/public"))) {
    let d; try { d = JSON.parse(await readFile(p, "utf8")); } catch { continue; }
    flags.push(...cleanDoc(d).flags.filter((x) => x.kind !== "house"));
  }
  t("no advice, promise, crypto or dash flag in research/assets/public", flags.length === 0, flags.slice(0, 5).map(formatFlag).join(" | "));
  // The Pulse "Phase:" line comes from compute-derived.mjs lifecycle phases.
  const derived = await readFile(join(ROOT, "scripts/compute-derived.mjs"), "utf8");
  const phases = [...derived.matchAll(/phase = "([^"]+)"/g)].map((m) => `Phase: ${m[1]}`);
  t("lifecycle phase lines pass the copy rules", phases.length >= 3 && phases.every((x) => flagLine(x, { house: true }).length === 0), phases.join(" | "));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("copy-rules.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
