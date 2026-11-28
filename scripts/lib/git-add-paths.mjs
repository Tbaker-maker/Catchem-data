// A shell word on a `git add` line is not an output path.
// `git add research/assets/img/*/logo.png || true` promises one glob.
// It does not promise files named "||" and "true".
// `git add "$p"` is a shell variable, not a file. The paths are the words
// assigned to the loop (`for p in $SET_PATHS`), not `$p` itself.
// A glob stays a glob. It is not replaced by one expanded file.
// A real path on that line, and a later `git add` of a missing file, still count.

const SHELL = new Set([
  "fi", "then", "else", "elif", "do", "done", "if", "esac", "in",
  "true", "false",
]);

const HALT = new Set(["||", "&&", "|", "&", ";"]);

const VAR_NAME = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/;

export function shellVarName(token) {
  let p = String(token || "").trim().replace(/;+$/g, "");
  if ((p.startsWith("\"") && p.endsWith("\"")) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }
  const match = p.match(VAR_NAME);
  return match ? match[1] : "";
}

export function cleanAddToken(raw) {
  let p = String(raw || "").trim();
  if (!p) return "";
  p = p.replace(/;+$/g, "");
  if ((p.startsWith("\"") && p.endsWith("\"")) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }
  p = p.replace(/;+$/g, "");
  if (!p || p === "\\" || p.startsWith("-") || p.startsWith(">") || SHELL.has(p) || HALT.has(p)) return "";
  if (shellVarName(p)) return "";
  return p;
}

// Paths from the right-hand side of one `git add` line. Stops at a shell
// operator so `|| true` is not tokenized. Does not decide whether a path exists.
export function collectGitAddPaths(rest) {
  const paths = [];
  for (const token of String(rest || "").trim().split(/\s+/)) {
    if (!token) continue;
    const bare = token.replace(/^['"]+|['"]+$/g, "");
    if (HALT.has(token) || HALT.has(bare)) break;
    const cleaned = cleanAddToken(token);
    if (!cleaned) {
      if (token.includes(";")) break;
      continue;
    }
    paths.push(cleaned);
    if (token.includes(";")) break;
  }
  return paths;
}

function assignmentPaths(src, name) {
  const re = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, "g");
  const paths = [];
  for (const match of String(src || "").matchAll(re)) {
    const body = match[1] ?? match[2] ?? match[3] ?? "";
    for (const part of body.split(/\s+/)) {
      if (!part || part.includes("$") || /[*?\[]/.test(part)) continue;
      paths.push(part);
    }
  }
  return paths;
}

function pathsForShellVar(src, name, atIndex) {
  const before = String(src || "").slice(0, atIndex);
  const re = new RegExp(`\\bfor\\s+${name}\\s+in\\s+([^\\n;]+)`, "g");
  let list = "";
  for (const match of before.matchAll(re)) list = match[1].trim();
  if (!list) return assignmentPaths(src, name);
  const paths = [];
  for (const part of list.split(/\s+/)) {
    const inner = shellVarName(part);
    if (inner) paths.push(...assignmentPaths(src, inner));
    else {
      const cleaned = cleanAddToken(part);
      if (cleaned) paths.push(cleaned);
    }
  }
  return paths;
}

// Every path a workflow's `git add` lines promise. Shell variables expand to
// the literal assignment in this same text. Globs are not expanded on disk.
export function collectPromisedEntries(src) {
  const text = String(src || "");
  const out = [];
  const seen = new Set();
  const push = (path, line, from) => {
    if (!path || seen.has(path)) return;
    seen.add(path);
    out.push({ path, line, from });
  };
  for (const match of text.matchAll(/git add ([^\n]+)/g)) {
    const line = text.slice(0, match.index).split("\n").length;
    const rest = match[1];
    for (const token of rest.trim().split(/\s+/)) {
      const bare = token.replace(/^['"]+|['"]+$/g, "").replace(/;+$/g, "");
      if (HALT.has(token) || HALT.has(bare)) break;
      const name = shellVarName(token);
      if (!name) continue;
      for (const resolved of pathsForShellVar(text, name, match.index)) {
        push(resolved, line, `$${name}`);
      }
    }
    for (const cleaned of collectGitAddPaths(rest)) push(cleaned, line, cleaned);
  }
  return out;
}

export function collectPromisedPaths(src) {
  return collectPromisedEntries(src).map((entry) => entry.path);
}
