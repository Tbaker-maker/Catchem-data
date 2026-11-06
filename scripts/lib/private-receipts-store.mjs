// Scored reads stay append-only. The public file is a stub. History lives here.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openPrivate } from "./private-store.mjs";

export const SCORECARD_DIR = "reads-scorecard";
export const SCORECARD_JSONL = "reads-scorecard/receipts.jsonl";
export const SCORECARD_LATEST = "reads-scorecard/latest.json";

function linesOf(text) {
  return String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function hasRows(doc) {
  return Array.isArray(doc?.rows) && doc.rows.length > 0;
}

// Existing lines stay in order. A prior public file is copied only when the
// log is empty. The same document is not written twice in a row.
export function foldReceipts(existingText, doc, priorPublic = null) {
  const lines = linesOf(existingText);
  const priorLine = hasRows(priorPublic) ? JSON.stringify(priorPublic) : "";
  if (!lines.length && priorLine) lines.push(priorLine);
  const line = JSON.stringify(doc);
  let appended = false;
  if (lines.at(-1) !== line) {
    lines.push(line);
    appended = true;
  }
  return { text: `${lines.join("\n")}\n`, appended, lines: lines.length, kept: lines[0] || "" };
}

export async function storePrivateReceipts({ root, doc, token = "", priorPublic = null } = {}) {
  const localDir = join(root, "data", "private", SCORECARD_DIR);
  await mkdir(localDir, { recursive: true });
  const localPath = join(localDir, "receipts.jsonl");
  let local = "";
  try { local = await readFile(localPath, "utf8"); } catch { local = ""; }
  const localNext = foldReceipts(local, doc, priorPublic);
  await writeFile(localPath, localNext.text);
  await writeFile(join(localDir, "latest.json"), `${JSON.stringify(doc, null, 1)}\n`);
  if (!token) {
    return { pushed: false, appended: localNext.appended, lines: localNext.lines, reason: "PRIVATE_DATA_TOKEN is not set. Kept in gitignored data/private/." };
  }
  let store;
  try {
    store = await openPrivate({ root, token });
  } catch (err) {
    return { pushed: false, appended: localNext.appended, lines: localNext.lines, reason: err.message };
  }
  try {
    let remote = "";
    try { remote = await readFile(join(store.dir, SCORECARD_JSONL), "utf8"); } catch { remote = ""; }
    const remoteNext = foldReceipts(remote, doc, priorPublic);
    await mkdir(join(store.dir, SCORECARD_DIR), { recursive: true });
    await writeFile(join(store.dir, SCORECARD_JSONL), remoteNext.text);
    await writeFile(join(store.dir, SCORECARD_LATEST), `${JSON.stringify(doc, null, 1)}\n`);
    const closed = await store.close(
      [SCORECARD_JSONL, SCORECARD_LATEST],
      "Append private reads scorecard",
    );
    return { ...closed, appended: remoteNext.appended, lines: remoteNext.lines };
  } catch (err) {
    return { pushed: false, appended: localNext.appended, lines: localNext.lines, reason: err.message };
  }
}
