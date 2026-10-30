import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { flagLine } from "../lib/copy-rules.mjs";
import { assertPrivateOut } from "../build-momentum.mjs";
import {
  ABOUT,
  DEMAND_MISSING,
  addDays,
  backtestProduct,
  callFor,
  forwardMove,
  iconFor,
  iconKey,
  readProduct,
  signalOn,
  summarize,
} from "../lib/momentum.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const limits = JSON.parse(readFileSync(join(HERE, "fixtures/momentum-limits.json"), "utf8"));

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

const days = (start, ns) => ns.map((n, i) => ({ date: addDays(start, i), n }));

const fasterDown = days("2026-10-01", [100, 99, 98, 96, 92]);
const slowerDown = days("2026-10-01", [100, 90, 80, 75, 74]);
const quiet = days("2026-10-01", [10, 10, 10, 10, 10]);
const samePattern = days("2026-10-01", [10, 11, 12, 13, 14]);
const otherPattern = days("2026-10-01", [10, 11, 12, 11, 10]);

const fast = readProduct(fasterDown, limits);
const slow = readProduct(slowerDown, limits);
const flat = readProduct(quiet, limits);
t("a faster drop is picking up", fast.momentum.state === "picking-up" && fast.momentum.direction === "down" && fast.momentum.icon === "momentum-picking-up");
t("a slower drop is slowing", slow.momentum.state === "slowing" && slow.momentum.direction === "down");
t("a quiet series is flat, not a missing series", flat.momentum.state === "flat" && flat.momentum.missing == null);
t("the same inputs read the same way twice", JSON.stringify(readProduct(fasterDown, limits)) === JSON.stringify(fast));

const empty = readProduct([], limits);
t("empty history is no signal", empty.momentum.state == null && empty.duration.state == null && empty.pattern.state == null && empty.momentum.missing === "empty history");
t("empty history is not called flat", empty.momentum.state !== "flat");
t("one point is no signal", readProduct([{ date: "2026-10-01", n: 4 }], limits).momentum.state == null);

const gapped = [
  { date: "2026-10-01", n: 10 },
  { date: "2026-10-02", n: 20 },
  { date: "2026-10-12", n: 1 },
  { date: "2026-10-13", n: 1 },
];
const gapRead = readProduct(gapped, limits);
t("a long gap does not feed the latest pace", gapRead.momentum.missing === "not enough listings counted" || (gapRead.momentum.inputs && gapRead.momentum.inputs.cur.from >= "2026-10-12"));

t("same steps match the prior steps", readProduct(samePattern, limits).pattern.state === "same");
t("turned steps differ from the prior steps", readProduct(otherPattern, limits).pattern.state === "different" && readProduct(otherPattern, limits).pattern.direction === "down");

const withFuture = fasterDown.concat([{ date: "2026-11-01", n: 1 }]);
t("a later count does not change the earlier read", JSON.stringify(signalOn(withFuture, "2026-10-05", limits)) === JSON.stringify(signalOn(fasterDown, "2026-10-05", limits)));

const prices = [
  { date: "2026-10-01", price: 100, source: "TCGplayer market" },
  { date: "2026-10-04", price: 50, source: "TCGplayer market" },
  { date: "2026-10-08", price: 110, source: "TCGplayer market" },
];
const fwd = forwardMove(prices, "2026-10-01", limits);
t("the forward price skips the day inside the window", fwd.from === 100 && fwd.to === 110 && fwd.toDate === "2026-10-08" && fwd.direction === "up");
t("a short window is not a full forward move", forwardMove(prices.slice(0, 2), "2026-10-01", limits) == null);
t("no price on or before the date means no forward move", forwardMove([{ date: "2026-10-20", price: 10, source: "TCGplayer market" }], "2026-10-01", limits) == null);

const scoredPrices = [];
for (let i = 0; i <= 20; i += 1) scoredPrices.push({ date: addDays("2026-10-01", i), price: 100, source: "TCGplayer market" });
const scored = backtestProduct("box", fasterDown, scoredPrices, limits);
const scoredLater = backtestProduct(
  "box",
  withFuture,
  scoredPrices.concat([{ date: "2026-11-20", price: 1, source: "TCGplayer market" }]),
  limits,
);
const early = (rows) => rows.filter((row) => row.asOf <= "2026-10-05");
t("a later price and count do not change earlier scored rows", JSON.stringify(early(scored.events)) === JSON.stringify(early(scoredLater.events)) && early(scored.events).length > 0);
t("a later price does not change earlier universe rows", JSON.stringify(early(scored.universe)) === JSON.stringify(early(scoredLater.universe)) && early(scored.universe).length > 0);

const longer = days("2026-10-01", [10, 9, 9, 8, 8, 7, 6, 5]);
const longerRead = readProduct(longer, limits);
t("a move past the usual length is longer", longerRead.duration.state === "longer" && longerRead.duration.inputs.usualDays === 1 && longerRead.duration.inputs.current.days === 3);

const tiny = { ...limits, minN: 1, minLift: 0.51 };
const oneHit = [{ signal: "momentum", call: "up", hit: true }];
const uni = [{ actual: "up" }, { actual: "down" }];
t("a single hit under the lift is not proven", summarize(oneHit, uni, tiny).momentum.proven === false && summarize(oneHit, uni, tiny).momentum.lift === 0.5);
t("n under the bar is not proven", summarize(oneHit, uni, { ...limits, minN: 5, minLift: 0 }).momentum.proven === false);
const mixed = [{ actual: "up" }, { actual: "down" }, { actual: "down" }];
const threeHits = [
  { signal: "pattern", call: "up", hit: true },
  { signal: "pattern", call: "up", hit: true },
  { signal: "pattern", call: "up", hit: true },
];
t("three hits against a lower base clear a small bar", summarize(threeHits, mixed, { ...limits, minN: 3, minLift: 0.05 }).pattern.proven === true);
const flatLater = forwardMove([
  { date: "2026-10-01", price: 100, source: "TCGplayer market" },
  { date: "2026-10-08", price: 100.4, source: "TCGplayer market" },
], "2026-10-01", limits);
t("a later price inside the flat band is not a hit direction", flatLater.direction === "flat");
const call = callFor("momentum", { state: "picking-up", direction: "down" }, limits);
t("picking up while listings counted fall calls the later price up", call === "up");
t("a flat state is not a call", callFor("momentum", flat.momentum, limits) == null);

const icons = iconKey();
t("the icon key has one row per state", icons.icons.length === 8 && icons.icons.every((row) => iconFor(row.id) === row));
const prose = [ABOUT, DEMAND_MISSING, icons.about, ...icons.icons.flatMap((row) => [row.label, row.meaning])];
let flagged = "";
for (const line of prose) {
  const flags = flagLine(line, { house: true });
  if (flags.length) flagged = `${line} :: ${flags.map((f) => f.reason).join("; ")}`;
}
t("icon labels and meanings are not flagged", flagged === "");
if (flagged) console.log("   ", flagged);
const rawIcons = readFileSync(join(HERE, "../lib/momentum-icons.json"), "utf8");
t("icon key has no em or en dash", !rawIcons.includes("\u2013") && !rawIcons.includes("\u2014"));
const lib = readFileSync(join(HERE, "../lib/momentum.mjs"), "utf8");
t("the lib does not keep a live cutoff", !/minLift\s*=/.test(lib) && !/flatAbsPerDay\s*=/.test(lib));
let threw = false;
try { assertPrivateOut("research/assets/public/momentum.json"); } catch (err) { threw = err.code === "PUBLIC_OUT"; }
t("a public output path is refused", threw === true);

const builder = readFileSync(join(HERE, "../build-momentum.mjs"), "utf8");
t("the builder reads kept listing counts, not a sale count", builder.includes("listingCount") && !builder.includes("priceMedian") && !builder.includes("askMedian"));
t("the builder prices from the market field", builder.includes("row.market") || builder.includes(".market"));

export async function run() { return fail; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && fail) process.exit(1);
