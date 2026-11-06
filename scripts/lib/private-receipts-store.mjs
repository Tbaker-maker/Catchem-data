// Scored reads stay append-only. The public file is a stub. History lives here.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openPrivate } from "./private-store.mjs";

export const SCORECARD_DIR = "reads-scorecard";
export const SCORECARD_JSONL = "reads-scorecard/receipts.jsonl";
export const SCORECARD_LATEST = "reads-scorecard/latest.json";
export const ACCURACY_JSONL = "reads-scorecard/accuracy.jsonl";
export const ACCURACY_LATEST = "reads-scorecard/accuracy-latest.json";

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

export async function storePrivateReceipts({ root, doc, token = "", priorPublic = null, accuracyDoc = null, priorAccuracy = null } = {}) {
  const localDir = join(root, "data", "private", SCORECARD_DIR);
  await mkdir(localDir, { recursive: true });
  const localPath = join(localDir, "receipts.jsonl");
  let local = "";
  try { local = await readFile(localPath, "utf8"); } catch { local = ""; }
  const localNext = foldReceipts(local, doc, priorPublic);
  await writeFile(localPath, localNext.text);
  await writeFile(join(localDir, "latest.json"), `${JSON.stringify(doc, null, 1)}\n`);
  let accuracyNext = null;
  if (accuracyDoc) {
    let acc = "";
    try { acc = await readFile(join(localDir, "accuracy.jsonl"), "utf8"); } catch { acc = ""; }
    accuracyNext = foldReceipts(acc, accuracyDoc, priorAccuracy);
    await writeFile(join(localDir, "accuracy.jsonl"), accuracyNext.text);
    await writeFile(join(localDir, "accuracy-latest.json"), `${JSON.stringify(accuracyDoc, null, 1)}\n`);
  }
  if (!token) {
    return { pushed: false, appended: localNext.appended, lines: localNext.lines, accuracyAppended: accuracyNext?.appended ?? false, accuracyLines: accuracyNext?.lines ?? 0, reason: "PRIVATE_DATA_TOKEN is not set. Kept in gitignored data/private/." };
  }
  let store;
  try {
    store = await openPrivate({ root, token });
  } catch (err) {
    return { pushed: false, appended: localNext.appended, lines: localNext.lines, accuracyAppended: accuracyNext?.appended ?? false, accuracyLines: accuracyNext?.lines ?? 0, reason: err.message };
  }
  try {
    let remote = "";
    try { remote = await readFile(join(store.dir, SCORECARD_JSONL), "utf8"); } catch { remote = ""; }
    const remoteNext = foldReceipts(remote, doc, priorPublic);
    await mkdir(join(store.dir, SCORECARD_DIR), { recursive: true });
    await writeFile(join(store.dir, SCORECARD_JSONL), remoteNext.text);
    await writeFile(join(store.dir, SCORECARD_LATEST), `${JSON.stringify(doc, null, 1)}\n`);
    const paths = [SCORECARD_JSONL, SCORECARD_LATEST];
    let remoteAccuracy = null;
    if (accuracyDoc) {
      let remoteAcc = "";
      try { remoteAcc = await readFile(join(store.dir, ACCURACY_JSONL), "utf8"); } catch { remoteAcc = ""; }
      remoteAccuracy = foldReceipts(remoteAcc, accuracyDoc, priorAccuracy);
      await writeFile(join(store.dir, ACCURACY_JSONL), remoteAccuracy.text);
      await writeFile(join(store.dir, ACCURACY_LATEST), `${JSON.stringify(accuracyDoc, null, 1)}\n`);
      paths.push(ACCURACY_JSONL, ACCURACY_LATEST);
    }
    const closed = await store.close(paths, "Append private reads scorecard");
    return { ...closed, appended: remoteNext.appended, lines: remoteNext.lines, accuracyAppended: remoteAccuracy?.appended ?? false, accuracyLines: remoteAccuracy?.lines ?? 0 };
  } catch (err) {
    return { pushed: false, appended: localNext.appended, lines: localNext.lines, accuracyAppended: accuracyNext?.appended ?? false, accuracyLines: accuracyNext?.lines ?? 0, reason: err.message };
  }
}
