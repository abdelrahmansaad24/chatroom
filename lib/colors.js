// Deterministic, simple color per name so old browsers (no JS) still work —
// colors are computed server-side and inlined as plain style attributes.
const PALETTE = [
  "#c0392b",
  "#2980b9",
  "#27ae60",
  "#8e44ad",
  "#d35400",
  "#16a085",
  "#2c3e50",
  "#c2185b",
  "#00838f",
  "#6d4c41",
];

export function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
