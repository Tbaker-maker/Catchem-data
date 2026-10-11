import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { libraryOn } from "../lib/second-library.mjs";
import {
  ROTATION_LINE,
  SITE_FG,
  attachRotation,
  fresherSource,
  loadSetMarks,
  rotationDisagreements,
} from "../lib/rotation-line.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LINE = "Rotated sets historically stop getting new print runs. What's already out there is the supply.";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const flags = JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf8"));
  t("reads.library stays off", flags.flags["reads.library"].value === false && libraryOn() === false);
  t("the sentence is the required text", ROTATION_LINE === LINE && SITE_FG.length === 11);

  const marks = await loadSetMarks(ROOT);
  t("the site list is the fresher source", marks.generatedAt.startsWith("2026-08-18") && fresherSource(marks.generatedAt) === "site");
  const disagree = rotationDisagreements(marks);
  t("Crown Zenith is F in the data file and absent on the site", disagree.some((row) => row.id === "swsh12pt5" && row.name === "Crown Zenith" && row.dataMark === "F" && row.siteMark === "absent"));
  t("Stellar Crown is G in the data file and H on the site", disagree.some((row) => row.id === "sv7" && row.name === "Stellar Crown" && row.dataMark === "G" && row.siteMark === "H"));
  t("the two files disagree on those two sets only", disagree.length === 2);

  const head = "Lost Origin TCGplayer market: $12.00 (2026-10-10), from $10.00 (2026-10-03).";
  let lineFails = 0;
  for (const row of SITE_FG) {
    const attached = attachRotation({ qualified: true, set: row.names[0], setId: row.ids[0], headline: head });
    if (!attached || attached.rotationLine !== LINE || attached.headline !== head || attached.headline.includes(LINE)) {
      lineFails += 1;
      console.error(`  FAIL line on ${row.slug}`);
    }
  }
  t("each of the 11 F/G sets gets the field and not the headline", lineFails === 0);

  const stellar = attachRotation({ qualified: true, set: "Stellar Crown", setId: "sv7", headline: head });
  t("Stellar Crown gets no line", stellar && stellar.rotationLine == null && stellar.headline === head && !JSON.stringify(stellar).includes(LINE));
  const crown = attachRotation({ qualified: true, set: "Crown Zenith", setId: "swsh12pt5", headline: head });
  t("Crown Zenith gets no line", crown && crown.rotationLine == null && !JSON.stringify(crown).includes(LINE));
  const sparks = attachRotation({ qualified: true, set: "Surging Sparks", setId: "sv8", headline: head });
  t("an H set gets no line", sparks && sparks.rotationLine == null);
  const voltage = attachRotation({ qualified: true, set: "Vivid Voltage", setId: "swsh4", headline: head });
  t("a D set gets no line", voltage && voltage.rotationLine == null);
  const early = attachRotation({ qualified: false, set: "Lost Origin", headline: head });
  t("a read that did not qualify gets no line", early && early.rotationLine == null && early.headline === head);
  const bare = attachRotation({ set: "Brilliant Stars", headline: head });
  t("a read with no qualified flag gets no line", bare && bare.rotationLine == null);
  const published = attachRotation({ publish: true, set: "Obsidian Flames", headline: "Sealed moved." });
  t("a read that already published keeps the line off the headline", published && published.rotationLine === LINE && published.headline === "Sealed moved.");
  const stolen = attachRotation({ qualified: true, set: "Paldean Fates", headline: LINE });
  t("the sentence is removed from the headline", stolen && stolen.rotationLine === LINE && stolen.headline !== LINE && !stolen.headline.includes(LINE));

  return fail;
}

const isMain = process.argv[1] && process.argv[1].endsWith("rotation-line.suite.mjs");
if (isMain) {
  const n = await run();
  if (n) process.exit(1);
}
