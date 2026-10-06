import { assertValidCss, brokenNumbers, feedStyle, money, moveLabel, sparkPrices, cleanLine } from "../lib/public-chrome.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail++; console.log("  FAIL", name); }
  };

  const css = feedStyle();
  const cssErrors = assertValidCss(css);
  t("feed css parses", cssErrors.length === 0);
  t("feed css quotes only family names", css.includes("'Fraunces'") && css.includes("'IBM Plex Sans'") && !css.includes("'Sora,system-ui"));
  t("feed css keeps the reading column", !/html\s*,\s*body\s*\{[^}]*max-width\s*:\s*100%/.test(css) && css.includes("max-width:680px"));
  t("stray quote cannot hide", assertValidCss("h2{font-family:'JetBrains Mono',ui-monospace,monospace',monospace}").length > 0);
  t("quoted stack cannot hide", assertValidCss("body{font:15px 'Sora,system-ui,sans-serif',sans-serif}").length > 0);
  t("missing money is hidden", money(undefined) === null && money(NaN) === null && money(0) === null);
  t("dollars always have two decimals", money(272.8) === "$272.80" && money(520.1) === "$520.10");
  t("zero percent is not a down arrow", moveLabel(0) === "unchanged" && moveLabel(-1.2) === "▼ 1.2%");
  t("markdown tables drop", cleanLine("| item | date | orderable as of september 14") === "");
  t("sparkline drops a near-zero point", sparkPrices([580, 580, 21.88, 575]).every((n) => n > 100));
  t("rendered html fails on undefined and NaN", brokenNumbers("<p>$undefined</p><p>NaN%</p>").length >= 2);
  t("rendered html fails on the word floor", brokenNumbers("<p>A floor that far below</p>").includes("floor wording"));
  t("clean html passes", brokenNumbers(`<p>${money(12.5)}</p>`).length === 0);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("pulse-html.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("pulse html ok");
}
