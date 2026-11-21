// Prints a visible alert when the reads board is not the sealed-prices day,
// or when the reads group was withheld. Exit 0 either way. The ::error::
// annotation is the alert. Price publish is not stopped.
import { appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReadsDayAlerts } from "./lib/reads-day-alert.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const alerts = await loadReadsDayAlerts(root);
if (!alerts.length) {
  console.log("reads day: reads.json asOf matches the sealed-prices day, and the reads group was not withheld");
  process.exit(0);
}
console.error(`\n✗ READS DAY: ${alerts.length} alert(s). Price publish is not stopped.`);
for (const line of alerts) {
  console.error(`   ${line}`);
  console.error(`::error::${line}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Reads day\n\n${alerts.map((line) => `- ${line}`).join("\n")}\n\nPrice publish is not stopped.\n`);
}
process.exit(0);
