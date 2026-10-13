import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withFill, loadFillMap, enabledFills } from "../lib/fill-history.mjs";
import { robotsAllows, parsePoints, matchUrls } from "../backfill-pokeviz.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

const own = [["2026-09-26", 100], ["2026-09-27", 101]];
const fill = { key: "pokeviz", points: [["2026-09-01", 90], ["2026-09-25", 95], ["2026-09-26", 1], ["2026-09-27", 2], ["2026-10-01", 3]] };
{
  const r = withFill(own, fill);
  t("fill adds only days before our first own day", r.points.map((p) => p[0]).join() === "2026-09-01,2026-09-25,2026-09-26,2026-09-27");
  t("our own price wins on shared days", r.points.find((p) => p[0] === "2026-09-26")[1] === 100);
  t("fillTo is our first own day", r.fillTo === "2026-09-26" && r.fillKey === "pokeviz");
  t("no own data means no fill", withFill([], fill).points.length === 0);
  t("no fill source leaves the line alone", withFill(own, null).fillTo === null);
}
{
  const root = mkdtempSync(join(tmpdir(), "fill-"));
  mkdirSync(join(root, "config")); mkdirSync(join(root, "raw"));
  writeFileSync(join(root, "raw/pv.json"), JSON.stringify({ items: [{ pid: 7, points: [["2026-01-01", 5]] }] }));
  const cfg = (extra) => writeFileSync(join(root, "config/fill-sources.json"), JSON.stringify({ allowed: [{ site: "x", key: "pokeviz", rawFile: "raw/pv.json", ...extra }] }));
  cfg({ chartFill: true, robotsBlocked: false });
  t("enabled source loads", loadFillMap(root).get(7)?.points.length === 1);
  cfg({ chartFill: false });
  t("one flag turns the source off", loadFillMap(root).size === 0 && enabledFills(root).length === 0);
  cfg({ chartFill: true, robotsBlocked: true });
  t("a robots block turns the source off", loadFillMap(root).size === 0);
}
{
  t("robots allow all", robotsAllows("User-agent: *\nAllow: /\n", "/mew/sealed/x"));
  t("robots disallow all", !robotsAllows("User-agent: *\nDisallow: /\n", "/mew/sealed/x"));
  t("robots disallow path", !robotsAllows("User-agent: *\nDisallow: /mew/\n", "/mew/sealed/x"));
  const html = '<script>{"a":1}</script><script>[{"name":"Market price","points":[["2026-07-01",500.05],["bad",1],["2026-07-02",0]]}]</script>';
  t("chart points parse and drop bad rows", JSON.stringify(parsePoints(html)) === '[["2026-07-01",500.05]]');
  const m = matchUrls(["https://h/mew/sealed/151-booster-bundle", "https://h/mew/sealed/dup", "https://h/mew/cards/x"],
    [{ name: "151 Booster Bundle", tcgPlayerId: 1 }, { name: "Dup", tcgPlayerId: 2 }, { tcgplayerName: "dup", tcgPlayerId: 3 }]);
  t("match by name slug, one id only", m.length === 1 && m[0].pid === 1);
}
process.exit(fail ? 1 : 0);
