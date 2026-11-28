// When a price-run feature step fails, keep last-good files and continue.
// Pure decisions. The wrapper in scripts/run-last-good.mjs applies them.
import { join } from "node:path";
import { tmpdir } from "node:os";

export function recordPath(env = process.env) {
  const fromEnv = env.CATCHEM_NEVER_BLOCK_RECORD || env.NEVER_BLOCK_RECORD || "";
  if (fromEnv) return fromEnv;
  return join(tmpdir(), "catchem-never-block.jsonl");
}


export function parsePorcelain(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    if (!line) continue;
    const xy = line.slice(0, 2);
    let rest = line.slice(3);
    if (xy.includes("R") && rest.includes(" -> ")) {
      const [from, to] = rest.split(" -> ");
      rows.push({ path: to, from, untracked: false, deleted: false, renamed: true });
      continue;
    }
    rows.push({
      path: rest,
      from: "",
      untracked: xy === "??",
      deleted: xy.includes("D"),
      renamed: false,
    });
  }
  return rows;
}

export function restorePlan(beforeText, afterText) {
  const before = new Set(parsePorcelain(beforeText).map((r) => r.path));
  const checkout = [];
  const remove = [];
  for (const row of parsePorcelain(afterText)) {
    if (before.has(row.path) || (row.from && before.has(row.from))) continue;
    if (row.untracked) remove.push(row.path);
    else if (row.renamed) {
      if (row.from) checkout.push(row.from);
      if (row.path) remove.push(row.path);
    } else checkout.push(row.path);
  }
  return { checkout: [...new Set(checkout)], remove: [...new Set(remove)] };
}

export function lastGoodResult({ exitCode, before, after } = {}) {
  if (exitCode === 0) {
    return { action: "keep", exitCode: 0, skip: false, restore: { checkout: [], remove: [] } };
  }
  const restore = restorePlan(before, after);
  return { action: "restore", exitCode: 0, skip: true, restore };
}

export function skipRecord({ step, restore, code, fingerprint } = {}) {
  return {
    step: step || "unknown step",
    fingerprint: fingerprint || `nightly-step:${step || "unknown step"}`,
    skipped: true,
    commandExit: code ?? 1,
    checkout: restore?.checkout || [],
    remove: restore?.remove || [],
  };
}
