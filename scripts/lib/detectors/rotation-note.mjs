// Attaches a rotation line only when the read already qualified and the set
// mark is F or G. Does not read a file that is not on main yet.

export function rotationMark(status, setName) {
  const name = String(setName || "");
  if (!name || !status) return "";
  const rows = Array.isArray(status.sets) ? status.sets : [];
  const hit = rows.find((row) => row && (row.name === name || row.slug === name || row.id === name));
  const mark = String(hit?.mark || "");
  return mark === "F" || mark === "G" ? mark : "";
}

export function attachRotation(read, status) {
  if (!read || !read.headline || read.qualified === false) return null;
  const mark = rotationMark(status, read.set);
  if (!mark) return { ...read };
  return { ...read, rotation: `Marked ${mark} on the rotation list.` };
}
