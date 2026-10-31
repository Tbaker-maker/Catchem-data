import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run as catalog } from "../sealed-cutout-catalog.test.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function ensurePy() {
  const probe = spawnSync("python3", ["-c", "import numpy, PIL, scipy"], { encoding: "utf8" });
  if (probe.status === 0) return;
  const args = ["-m", "pip", "install", "--quiet", "pillow", "numpy", "scipy"];
  let inst = spawnSync("python3", args, { encoding: "utf8" });
  if (inst.status !== 0) {
    inst = spawnSync("python3", args.concat(["--break-system-packages"]), { encoding: "utf8" });
  }
  if (inst.status !== 0) {
    if (inst.stdout) process.stdout.write(inst.stdout);
    if (inst.stderr) process.stderr.write(inst.stderr);
  }
}

export async function run() {
  let fail = await catalog();
  ensurePy();
  const py = spawnSync("python3", [join(ROOT, "scripts/sealed-cutout-qa.test.py")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (py.stdout) process.stdout.write(py.stdout);
  if (py.stderr) process.stderr.write(py.stderr);
  if (py.status !== 0) {
    fail += 1;
    console.error("  FAIL pixel test exit " + py.status);
  }
  return fail;
}
