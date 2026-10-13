// Nightly: hype-effect public reads + crowded-call flags at set / single / sealed.
// Private first. Each level needs n≥20 holdout. Singles and sealed stay in
// separate public files so card pages never see sealed data (and vice versa).
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { loadLongHistoryPriceBook } from "./lib/tcgci-score.mjs";
import {
  LEVELS, subjectsOf, weeklyAttention, weeklyCrowded,
  buildHypeEffect, buildCrowdedCalls,
} from "./lib/hype-crowd.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };

async function loadMeta(root) {
  const sealed = await J(join(root, "data/sealed-products.json"), []);
  const catalog = await J(join(root, "data/catalog/tcgcsv-latest.json"), {});
  const metaByPid = new Map();
  for (const s of sealed) {
    const pid = Number(s.tcgPlayerId || s.tcgplayerProductId);
    if (!pid) continue;
    metaByPid.set(pid, {
      kind: "sealed", name: s.name, set: s.set, groupId: s.groupId || null, id: s.id,
    });
  }
  for (const it of catalog.items || []) {
    const pid = Number(it.tcgplayerProductId || it.id);
    if (!pid || metaByPid.has(pid)) continue;
    metaByPid.set(pid, {
      kind: it.kind === "sealed" ? "sealed" : "single",
      name: it.name, set: it.set, groupId: it.groupId || null,
    });
  }
  return metaByPid;
}

function writeLevelDocs(root, prefix, publicByLevel, gates, today, note) {
  const paths = [];
  for (const level of LEVELS) {
    const rel = `data/derived/${prefix}-${level}.json`;
    const doc = {
      asOf: today,
      generatedAt: new Date().toISOString(),
      level,
      note,
      surface: level === "set" ? "set" : level === "single" ? "card" : "sealed",
      // Card pages: read only hype-effect-singles / crowded-calls-singles.
      // Sealed pages: sealed files only. Set pages: set files only.
      neverMix: "Singles and sealed stay in separate files. Never show sealed on card pages.",
      holdout: gates[level],
      count: (publicByLevel[level] || []).length,
      items: publicByLevel[level] || [],
    };
    paths.push({ rel, doc });
  }
  return paths;
}

export async function runMineHypeCrowd({
  root = ROOT,
  token = process.env.PRIVATE_DATA_TOKEN || "",
  now = new Date(),
  store: givenStore = null,
} = {}) {
  const today = now.toISOString().slice(0, 10);
  let store = givenStore;
  let ownsStore = false;
  if (!store) {
    ownsStore = true;
    try { store = await openPrivate({ root, token }); }
    catch (err) {
      console.error(`hype-crowd: ${err.message}; using local data/private`);
      store = await openPrivate({ root, token: "" });
    }
  }

  const tcgci = await J(join(store.dir, "tcgci/rescored-claims.json"), { claims: [] });
  const yt = await J(join(store.dir, "youtube/claims.json"), { claims: [] });
  const claims = [...(tcgci.claims || []), ...(yt.claims || [])];
  const metaByPid = await loadMeta(root);
  const subjects = [];
  for (const c of claims) subjects.push(...subjectsOf(c, metaByPid));

  // Set → pids for broader 30d set moves (sealed + singles in that set).
  const pidsByKey = new Map();
  for (const [pid, m] of metaByPid) {
    if (!m.set && m.groupId == null) continue;
    const keys = [];
    if (m.groupId != null) keys.push(`group:${m.groupId}`);
    if (m.set) keys.push(`set:${m.set}`);
    for (const k of keys) {
      if (!pidsByKey.has(k)) pidsByKey.set(k, []);
      pidsByKey.get(k).push(pid);
    }
  }

  const { priceOn } = await loadLongHistoryPriceBook(root);

  const windows = weeklyAttention(subjects);
  const clusters = weeklyCrowded(subjects);

  const hype = buildHypeEffect({ windows, priceOn, today, pidsByKey });
  const crowded = buildCrowdedCalls({ clusters, priceOn, today, pidsByKey });

  await mkdir(join(root, "data/derived"), { recursive: true });
  const hypePaths = writeLevelDocs(
    root, "hype-effect", hype.public, hype.gates, today,
    "Hype-effect public reads. Neutral, data-only. Passed n≥20 holdout only. No creator names. Not advice.",
  );
  const crowdPaths = writeLevelDocs(
    root, "crowded-calls", crowded.public, crowded.gates, today,
    "Crowded-call flags. Neutral, data-only. Passed n≥20 holdout only. Singles/sealed/set separated. Not advice.",
  );
  for (const { rel, doc } of [...hypePaths, ...crowdPaths]) {
    await writeFile(join(root, rel), JSON.stringify(doc, null, 1) + "\n");
  }

  // Index file for flagger convenience
  const index = {
    asOf: today,
    generatedAt: now.toISOString(),
    note: "Index of three-level hype-effect and crowded-call outputs. Per-level files are authoritative for page surfaces.",
    hypeEffect: Object.fromEntries(LEVELS.map((l) => [l, {
      file: `data/derived/hype-effect-${l}.json`,
      count: hype.public[l].length,
      passedHoldout: Boolean(hype.gates[l]?.passedHoldout),
      testN: hype.gates[l]?.testN ?? 0,
    }])),
    crowdedCalls: Object.fromEntries(LEVELS.map((l) => [l, {
      file: `data/derived/crowded-calls-${l}.json`,
      count: crowded.public[l].length,
      passedHoldout: Boolean(crowded.gates[l]?.passedHoldout),
      testN: crowded.gates[l]?.testN ?? 0,
    }])),
  };
  await writeFile(join(root, "data/derived/hype-crowd-index.json"), JSON.stringify(index, null, 1) + "\n");

  const privDir = join(store.dir, "call-patterns");
  await mkdir(privDir, { recursive: true });
  await writeFile(join(privDir, "hype-effect.json"), JSON.stringify({
    asOf: today, private: true, gates: hype.gates, rows: hype.private,
    windows: windows.slice(0, 200),
  }, null, 1) + "\n");
  await writeFile(join(privDir, "crowded-calls.json"), JSON.stringify({
    asOf: today, private: true, gates: crowded.gates, rows: crowded.private,
    clusters: clusters.slice(0, 200),
  }, null, 1) + "\n");

  const privPaths = ["call-patterns/hype-effect.json", "call-patterns/crowded-calls.json"];
  let pushed = { pushed: false, reason: "store owned by caller" };
  if (ownsStore) {
    pushed = await store.close(privPaths, `Hype/crowd levels ${today}`);
  }

  const levelsPassed = {
    hypeEffect: Object.fromEntries(LEVELS.map((l) => [l, Boolean(hype.gates[l]?.passedHoldout)])),
    crowdedCalls: Object.fromEntries(LEVELS.map((l) => [l, Boolean(crowded.gates[l]?.passedHoldout)])),
  };

  return {
    status: "ok",
    asOf: today,
    subjects: subjects.length,
    windows: windows.length,
    clusters: clusters.length,
    levelsPassed,
    publicCounts: {
      hypeEffect: Object.fromEntries(LEVELS.map((l) => [l, hype.public[l].length])),
      crowdedCalls: Object.fromEntries(LEVELS.map((l) => [l, crowded.public[l].length])),
    },
    sampleLines: [
      ...LEVELS.flatMap((l) => (hype.public[l][0] ? [hype.public[l][0].line] : [])),
      ...LEVELS.flatMap((l) => (crowded.public[l][0] ? [crowded.public[l][0].line] : [])),
    ].slice(0, 6),
    privatePushed: Boolean(pushed?.pushed),
    gates: { hype: hype.gates, crowded: crowded.gates },
  };
}

if (process.argv[1] && process.argv[1].endsWith("mine-hype-crowd.mjs")) {
  const d = await runMineHypeCrowd();
  console.log(JSON.stringify({
    hypeCrowd: {
      status: d.status,
      levelsPassed: d.levelsPassed,
      publicCounts: d.publicCounts,
      sampleLines: d.sampleLines,
    },
  }, null, 2));
}
