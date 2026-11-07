// Watchdog retry gate. Does not dispatch. The workflow dispatches only when
// this check prints dispatch=true, and records only after that call succeeds.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { decideDispatch, listActiveRuns, recordAfterDispatch } from "./lib/watchdog-retry.mjs";

function emit(lines) {
  const text = lines.join("\n") + "\n";
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  process.stdout.write(text);
}

async function check() {
  const repo = String(process.env.GITHUB_REPOSITORY || "");
  const [owner, name] = repo.split("/");
  const token = process.env.GH_TOKEN || "";
  const listed = await listActiveRuns({ owner, repo: name, token });
  const decision = decideDispatch({ alreadyRetried: false, check: listed });
  emit([
    `dispatch=${decision.dispatch ? "true" : "false"}`,
    `reason=${decision.reason}`,
  ]);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const flag = process.argv[2];
  if (flag === "--record-ok") {
    const decision = recordAfterDispatch(process.argv[3] === "true");
    console.log(`record=${decision.record ? "true" : "false"}`);
    console.log(`reason=${decision.reason}`);
    process.exit(decision.record ? 0 : 3);
  }
  if (flag === "--check") {
    try {
      await check();
    } catch (err) {
      const token = process.env.GH_TOKEN || "";
      const msg = String(err?.message || err).split(token).join("[token]").slice(0, 200);
      console.error(msg);
      emit(["dispatch=false", "reason=check-failed"]);
    }
    process.exit(0);
  }
  console.error("Usage: node scripts/watchdog-retry.mjs --check|--record-ok true|false");
  process.exit(2);
}
