// A shell word on a `git add` line is not an output path.
// `git add research/assets/img/*/logo.png || true` promises one glob.
// It does not promise files named "||" and "true".
// A real path on that line, and a later `git add` of a missing file, still count.

const SHELL = new Set([
  "fi", "then", "else", "elif", "do", "done", "if", "esac", "in",
  "true", "false",
]);

const HALT = new Set(["||", "&&", "|", "&", ";"]);

export function cleanAddToken(raw) {
  let p = String(raw || "").trim();
  if (!p) return "";
  if ((p.startsWith("\"") && p.endsWith("\"")) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }
  p = p.replace(/;+$/g, "");
  if (!p || p === "\\" || p.startsWith("-") || p.startsWith(">") || SHELL.has(p) || HALT.has(p)) return "";
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
