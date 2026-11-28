// One GitHub issue per fingerprint. Label catchem-alert. Update, do not duplicate.
export const ALERT_LABEL = "catchem-alert";
export const ASSIGNEE = "Tbaker-maker";
export const PRIVATE_ALERT_REPO = "Tbaker-maker/catchem-data-private";
export const PUBLIC_ALERT_REPO = "Tbaker-maker/Catchem-data";

const RANK = { P0: 0, P1: 1, P2: 2 };

export function fingerprintTitle(fingerprint) {
  return `Catch'em alert: ${String(fingerprint || "").replace(/[\r\n]/g, " ").slice(0, 180)}`;
}

export function alertBody({ happened, impact, alreadyDid, ask } = {}) {
  return [
    `What happened: ${happened || ""}`,
    `Impact: ${impact || ""}`,
    `What the system already did: ${alreadyDid || ""}`,
    `Exact ask: ${ask || "Nothing needed"}`,
  ].join("\n");
}

export function alertRepo({ privateToken } = {}) {
  if (privateToken) return { repo: PRIVATE_ALERT_REPO, redactPrivate: false, reason: "private-token" };
  return { repo: PUBLIC_ALERT_REPO, redactPrivate: true, reason: "public-fallback" };
}

export function shouldAssign({ isNew, severity, needsYes, fixed, severityUp } = {}) {
  if (needsYes || fixed || severityUp) return true;
  if (isNew && (severity === "P0" || severity === "P1")) return true;
  return false;
}

function severityFromLabels(labels) {
  const names = (labels || []).map((l) => (typeof l === "string" ? l : l && l.name)).filter(Boolean);
  if (names.includes("sev:P0")) return "P0";
  if (names.includes("sev:P1")) return "P1";
  if (names.includes("sev:P2")) return "P2";
  return "";
}

export function decideAlertAction({
  issues = [],
  fingerprint,
  severity = "P2",
  needsYes = false,
  fixed = false,
} = {}) {
  const title = fingerprintTitle(fingerprint);
  const matches = (issues || []).filter((i) => i && i.title === title);
  const open = matches.filter((i) => String(i.state || "").toUpperCase() === "OPEN");
  const closed = matches.filter((i) => String(i.state || "").toUpperCase() !== "OPEN");

  if (fixed) {
    if (!open.length) return { action: "none", title, reason: "already-closed", openNew: false };
    return {
      action: "close",
      number: open[0].number,
      title,
      assign: shouldAssign({ fixed: true, severity }),
      comment: true,
      openNew: false,
    };
  }

  if (open.length) {
    const previous = severityFromLabels(open[0].labels) || severity;
    const severityUp = (RANK[severity] ?? 9) < (RANK[previous] ?? 9);
    return {
      action: "update",
      number: open[0].number,
      title,
      comment: true,
      assign: shouldAssign({ severity, needsYes, severityUp }),
      severityUp,
      needsYes,
      openNew: false,
    };
  }

  if (closed.length) {
    return {
      action: "reopen",
      number: closed[0].number,
      title,
      assign: shouldAssign({ isNew: true, severity, needsYes }),
      comment: true,
      needsYes,
      openNew: false,
    };
  }

  return {
    action: "open",
    title,
    assign: shouldAssign({ isNew: true, severity, needsYes }),
    needsYes,
    openNew: true,
  };
}

export function sevLabel(severity) {
  if (severity === "P0" || severity === "P1" || severity === "P2") return `sev:${severity}`;
  return "sev:P2";
}
