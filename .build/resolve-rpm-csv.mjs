// CSV row helpers for data/resolve-political-monitor.csv, shared by
// extract-resolve-rpm.mjs and resolve-rpm-repairs.mjs so both read and write
// the file byte-for-byte the same way.
export const csvCell = (x) => {
  const s = String(x ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Rows stay objects until the end so the repair passes can rewrite values and
// labels; stringified only at write time.
export const ROW_KEYS = ["dataset", "question_id", "question", "visual", "answer", "dimension", "key", "date", "value_pct", "parties"];
export const rowToLine = (r) => ROW_KEYS.map((k) => csvCell(r[k] ?? "")).join(",");
export const parseLine = (line) => {
  const cells = [];
  let cell = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { cells.push(cell); cell = ""; }
    else cell += c;
  }
  cells.push(cell);
  return Object.fromEntries(cells.map((v, i) => [ROW_KEYS[i], v]));
};
