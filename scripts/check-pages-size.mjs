// Pages publishes the tip of main (source path /). Fail when that tree
// exceeds 900 MiB. GitHub's site cap is 1 GiB, and deploys already time out.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const LIMIT_BYTES = 900 * 1024 * 1024;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function publishBytes(root = ROOT) {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  let bytes = 0;
  let count = 0;
  for (const rel of out.toString("utf8").split("\0")) {
    if (!rel) continue;
    bytes += statSync(join(root, rel)).size;
    count += 1;
  }
  return { bytes, count };
}

export function formatMb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function main() {
  const { bytes, count } = publishBytes();
  const line = `pages publish tree ${formatMb(bytes)} MiB across ${count} files, limit ${formatMb(LIMIT_BYTES)} MiB`;
  console.log(line);
  if (bytes > LIMIT_BYTES) {
    console.error(`FAIL ${line}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
