#!/usr/bin/env node
// Forward ledger for read pathways. Every pathway read on tonight's board is
// stored once (read id, day, version id, config hash, price) in
// catchem-data-private pathway-ledger/ledger.json, or gitignored
// data/private/ when PRIVATE_DATA_TOKEN is not set. Outcomes are scored
// later against the version's pre-registered horizon. Publishes nothing.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { appendLedger, ledgerRows } from "./lib/read-pathways.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

const doc = await J(join(ROOT, "research/assets/public/reads.json"), {});
const rows = ledgerRows(doc?.reads || []);
if (!rows.length) { console.log("pathway ledger: no pathway reads tonight, nothing logged"); process.exit(0); }
let store;
try { store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" }); }
catch (err) { console.error(`pathway ledger: ${err.message}; using local data/private`); store = await openPrivate({ root: ROOT, token: "" }); }
const rel = "pathway-ledger/ledger.json";
const path = join(store.dir, rel);
const { doc: ledger, added } = appendLedger(await J(path, null), rows);
ledger.private = true;
ledger.asOf = doc.asOf || "";
ledger.rule = "One row per pathway read, day and version, stored on the read day with tonight's TCGplayer market. Scored later against the version's pre-registered horizon and bars (catchem-data-private config/read-pathways.json).";
await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(ledger, null, 1) + "\n");
const res = await store.close([rel], `Pathway ledger ${doc.asOf || ""}: ${added} new`);
console.log(`pathway ledger: ${added} new, ${ledger.calls.length} on file${res?.pushed === false ? ` (not pushed: ${res.reason})` : ""}`);
