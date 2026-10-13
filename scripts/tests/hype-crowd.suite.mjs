// hype-crowd.suite.mjs — three-level hype-effect + crowded-call (set/single/sealed).
import { isBanned } from "../lib/youtube.mjs";
import {
  subjectsOf, attentionWindows, crowdClusters, scoreMove30,
  buildHypeEffect, buildCrowdedCalls, holdoutGate,
  hypeEffectLineForLevel, crowdedCallLine,
  hypeEffectFlags, crowdedCallFlags, MIN_N,
} from "../lib/hype-crowd.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

  const meta = new Map([
    [1, { kind: "single", name: "Pikachu ex", set: "SV08: Surging Sparks", groupId: 100 }],
    [2, { kind: "sealed", name: "Surging Sparks ETB", set: "SV08: Surging Sparks", groupId: 100 }],
    [3, { kind: "single", name: "Other Card", set: "SV10: Destined Rivals", groupId: 200 }],
  ]);

  const s1 = subjectsOf({ pid: 1, date: "2026-09-01", dir: 1, channel: "a", target: "card", item: "Pikachu ex", set: "SV08: Surging Sparks" }, meta);
  t("subjects include set+single", s1.some((x) => x.level === "set") && s1.some((x) => x.level === "single") && !s1.some((x) => x.level === "sealed"));
  const s2 = subjectsOf({ pid: 2, date: "2026-09-01", dir: 1, channel: "b", target: "sealed", item: "ETB", set: "SV08: Surging Sparks" }, meta);
  t("subjects include set+sealed", s2.some((x) => x.level === "sealed") && !s2.some((x) => x.level === "single"));

  // Build enough historical attention windows per level for holdout n≥20 on test (~30% → need ~70 scored events)
  const subjects = [];
  const price = new Map(); // pid|day -> px
  const put = (pid, day, v) => price.set(`${pid}|${day}`, v);
  const priceOn = (pid, day) => price.get(`${pid}|${day}`) ?? null;

  for (let i = 0; i < 120; i++) {
    const start = new Date(Date.parse("2024-01-01T00:00:00Z") + i * 7 * 86400000).toISOString().slice(0, 10);
    const pidS = 1000 + i; // single
    const pidZ = 2000 + i; // sealed
    // prices: +10% over 30d for singles, -5% for sealed, +2% for set (use both)
    put(pidS, start, 10);
    put(pidS, new Date(Date.parse(start + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10), 11);
    put(pidZ, start, 50);
    put(pidZ, new Date(Date.parse(start + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10), 47.5);
    for (let c = 0; c < 3; c++) {
      const day = new Date(Date.parse(start + "T00:00:00Z") + c * 86400000).toISOString().slice(0, 10);
      subjects.push({ level: "single", key: `single:${pidS}`, label: `Card ${i}`, pid: pidS, date: day, dir: 1, channel: `ch${c}` });
      subjects.push({ level: "sealed", key: `sealed:${pidZ}`, label: `Sealed ${i}`, pid: pidZ, date: day, dir: 1, channel: `ch${c}` });
      subjects.push({ level: "set", key: `set:Set${i}`, label: `Set ${i}`, pid: pidS, date: day, dir: 1, channel: `ch${c}` });
    }
  }
  // This week current attention (today = 2026-10-12)
  const today = "2026-10-12";
  for (let c = 0; c < 4; c++) {
    subjects.push({ level: "single", key: "single:9999", label: "Hot Card", pid: 9999, date: "2026-10-10", dir: 1, channel: `now${c}` });
    subjects.push({ level: "sealed", key: "sealed:8888", label: "Hot ETB", pid: 8888, date: "2026-10-10", dir: 1, channel: `now${c}` });
    subjects.push({ level: "set", key: "set:HotSet", label: "Hot Set", pid: 9999, date: "2026-10-10", dir: 1, channel: `now${c}` });
  }
  put(9999, "2026-10-10", 20);
  put(8888, "2026-10-10", 40);

  const wins = attentionWindows(subjects);
  t("attention windows exist", wins.length >= 50);
  const hype = buildHypeEffect({ windows: wins, priceOn, today });
  t("hype set holdout passed", hype.gates.set.passedHoldout === true && hype.gates.set.testN >= MIN_N);
  t("hype single holdout passed", hype.gates.single.passedHoldout === true);
  t("hype sealed holdout passed", hype.gates.sealed.passedHoldout === true);
  t("hype public set has line", hype.public.set.length >= 1 && /Heavy creator attention/.test(hype.public.set[0].line));
  t("hype public single separate", hype.public.single.length >= 1 && /Past cards/.test(hype.public.single[0].line));
  t("hype public sealed separate", hype.public.sealed.length >= 1 && /Past sealed products/.test(hype.public.sealed[0].line));
  t("hype lines not banned", [...hype.public.set, ...hype.public.single, ...hype.public.sealed].every((r) => !isBanned(r.line) && !/\u2014/.test(r.line)));
  t("hype no creator names", [...hype.public.set, ...hype.public.single, ...hype.public.sealed].every((r) => !/now0|ch0|alphainvestments/i.test(r.line)));

  const clusters = crowdClusters(subjects);
  const crowded = buildCrowdedCalls({ clusters, priceOn, today });
  t("crowded set holdout", crowded.gates.set.passedHoldout === true);
  t("crowded single holdout", crowded.gates.single.passedHoldout === true);
  t("crowded sealed holdout", crowded.gates.sealed.passedHoldout === true);
  t("crowded surfaces tagged", crowded.public.single.every((f) => f.surface === "card") && crowded.public.sealed.every((f) => f.surface === "sealed"));
  t("crowded lines not banned", [...crowded.public.set, ...crowded.public.single, ...crowded.public.sealed].every((f) => !isBanned(f.line)));

  // Separated outputs: sealed items never appear in single public list
  t("no sealed keys in single public", !hype.public.single.some((r) => String(r.key).startsWith("sealed:")));
  t("no single keys in sealed public", !hype.public.sealed.some((r) => String(r.key).startsWith("single:")));

  const hFlags = hypeEffectFlags(hype.public);
  const cFlags = crowdedCallFlags(crowded.public);
  t("flag types", hFlags.every((f) => f.type === "HYPE_EFFECT") && cFlags.every((f) => f.type === "CROWDED_CALL"));
  t("flag data has surface", hFlags.every((f) => f.data.surface) && cFlags.every((f) => f.data.surface));

  // Level that fails holdout stays private
  const tiny = buildHypeEffect({
    windows: wins.filter((w) => w.level === "set").slice(0, 5),
    priceOn, today, minN: 20,
  });
  t("tiny set stays private", tiny.gates.set.passedHoldout === false && tiny.public.set.length === 0);

  // Line helpers
  const hl = hypeEffectLineForLevel("set", { label: "Destined Rivals", medianPct: -3.5, n: 24, from: "2025-01-01", to: "2026-06-01" });
  t("line shape", /Heavy creator attention on Destined Rivals/.test(hl) && /n=24/.test(hl));
  const cl = crowdedCallLine("single", {
    label: "Pikachu ex", creators: 4, calls: 6, start: "2026-10-01", end: "2026-10-08",
    direction: "up", histMedianPct: 2.5, histN: 30, histFrom: "2025-01-01", histTo: "2026-05-01",
  });
  t("crowded line shape", /Crowded up-direction attention/.test(cl) && !isBanned(cl));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("hype-crowd.suite.mjs")) {
  const n = await run();
  console.log(n ? `${n} failed` : "all ok");
  process.exit(n ? 1 : 0);
}
