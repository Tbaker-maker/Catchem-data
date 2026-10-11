// One shape for every read detector. A missing field is a broken detector, not a read.

const NEED = ["id", "inputs", "rule", "minimums", "copy", "take", "wrongIf"];

export function checkDetector(det) {
  const id = det && det.id ? String(det.id) : "?";
  for (const key of NEED) {
    if (!det || det[key] == null || det[key] === "") {
      throw new Error(`detector ${id} missing ${key}`);
    }
  }
  if (typeof det.take !== "function") throw new Error(`detector ${id} take is not a function`);
  return det;
}
