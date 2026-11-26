// Names only. A missing secret turns a feature off; it never fails the run.
import { appendFileSync } from "node:fs";

export function preflight(manifest, env = {}) {
  return (manifest || []).map((row) => {
    const name = String(row.name || "");
    const raw = env[name];
    const present = typeof raw === "string" ? raw.length > 0 : Boolean(raw);
    return {
      name,
      feature: row.feature || "",
      required: Boolean(row.required),
      present,
      outputKey: `has_${name}`,
    };
  });
}

export function missingAlerts(rows) {
  return (rows || [])
    .filter((r) => !r.present)
    .map((r) => ({
      fingerprint: `secret-missing:${r.name}`,
      severity: "P2",
      needsYes: true,
      happened: `${r.name} is not set.`,
      impact: `${r.feature || "That feature"} is off. Last-good public data stays as it is.`,
      alreadyDid: "The price run skipped work that needs this secret and kept going.",
      ask: `Set ${r.name} in repo secrets (name only).`,
    }));
}

export function writeOutputs(rows, outputPath) {
  if (!outputPath) return;
  const lines = (rows || []).map((r) => `${r.outputKey}=${r.present ? "true" : "false"}\n`).join("");
  appendFileSync(outputPath, lines);
}

export function presentFixes(rows) {
  return (rows || [])
    .filter((r) => r.present)
    .map((r) => ({
      fingerprint: `secret-missing:${r.name}`,
      severity: "P2",
      fixed: true,
      happened: `${r.name} is set again.`,
      impact: `${r.feature || "That feature"} can run.`,
      alreadyDid: "Closed the missing-secret alert.",
      ask: "Nothing needed",
    }));
}

