// Lists the detector registry. Not a workflow step.
// Does not write a public read file and does not turn reads.library on.

import { detectors, SWITCH } from "./lib/detectors/registry.mjs";

const rows = detectors().map((det) => ({
  id: det.id,
  gate: det.gate,
  status: det.status || "wired-to-existing-board",
  inputs: det.inputs,
}));

console.log(JSON.stringify({ switch: SWITCH, wiredIntoNightly: false, detectors: rows }));
