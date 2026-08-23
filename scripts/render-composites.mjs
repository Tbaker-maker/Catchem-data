// render-composites.mjs — render the day's best composites to our own domain.
//
// Tyler, 2026-08-23: "These images should be coming off our app so it forces
// people onto our products and/or into Discord."
//
// Strategically right, and it removes the technical problem as a side effect:
// same-origin images need no CORS permission, so the canvas dance and every
// download failure with it simply disappears. A served PNG is just a file.
//
// This drives card-composite.mjs rather than reimplementing it, because the
// watermark and the illustrator credit are locked by design and a second
// implementation is a second place for them to drift. One renderer, one set of
// rules, called once per formula.
import { readFile, mkdir, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/assets/img");
const TOP = Number(process.env.COMPOSITE_TOP || 12);

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export async function renderTop(limit = TOP) {
  const formulas = JSON.parse(await readFile(join(ROOT, "research/pulse/formulas.json"), "utf-8")).formulas ?? [];
  await mkdir(OUT, { recursive: true });
  const done = [], failed = [];
  const t0 = Date.now();

  for (const f of formulas.slice(0, limit)) {
    const cards = (f.cards ?? []).filter(Boolean);
    // The layout table is the authority on which counts have a measured frame.
    // Asking for an unsupported one produces a refusal, not a guess.
    if (!cards.length) { failed.push({ title: f.title, why: "no cards" }); continue; }
    const name = `${slug(f.kind)}-${slug(f.title)}.png`;
    const outPath = join(OUT, name);
    try {
      const { stdout, stderr } = await run("node",
        [join(ROOT, "scripts/card-composite.mjs"), ...cards, "--label", f.title],
        { cwd: ROOT, env: { ...process.env, COMPOSITE_OUT: outPath }, timeout: 300000, maxBuffer: 1 << 24 });
      const out = stdout + stderr;
      // A refusal is a correct outcome, not a failure — record it as such.
      if (/no layout|refus/i.test(out)) { failed.push({ title: f.title, why: `refused: ${cards.length} cards` }); continue; }
      const { size } = await stat(outPath);
      done.push({ title: f.title, kind: f.kind, cards: cards.length, file: name, kb: Math.round(size / 1024) });
    } catch (e) {
      failed.push({ title: f.title, why: (e.message || "render failed").split("\n")[0].slice(0, 100) });
    }
  }
  return { done, failed, seconds: Math.round((Date.now() - t0) / 1000) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { done, failed, seconds } = await renderTop();
  const bytes = done.reduce((a, d) => a + d.kb, 0);
  for (const d of done) console.log(`  ✓ ${String(d.cards).padStart(2)} cards · ${String(d.kb).padStart(4)} KB · ${d.file}`);
  for (const f of failed) console.log(`  – ${f.title}: ${f.why}`);
  console.log(`\n✓ ${done.length} composite(s) → research/assets/img/ · ${(bytes / 1024).toFixed(1)} MB · ${seconds}s`);
  if (failed.length) console.log(`  ${failed.length} not rendered`);
}
