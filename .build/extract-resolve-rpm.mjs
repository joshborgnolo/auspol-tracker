// Extract all embedded polling series from the pasted Resolve Political Monitor
// JS bundle (pasted-text-1.txt) into data/resolve-political-monitor.csv.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "/Users/joshuaborgnolo/.craft-agent/workspaces/4. auspol/sessions/260828-is-there-data-here/attachments/f9c2af7d-f038-4620-af5c-b1dbe477059c_pasted-text-1.txt";
const OUT = "/Users/joshuaborgnolo/Documents/4. auspol/data/resolve-political-monitor.csv";

const text = readFileSync(SRC, "utf8");

function matchLiteral(s, startIdx) {
  let depth = 0, inStr = false, quote = null;
  for (let i = startIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = true; quote = c; continue; }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return s.slice(startIdx, i + 1);
    }
  }
  return null;
}

function loadAssign(name) {
  const re = new RegExp(`(^|[^$\\w])${name}=`, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    const at = m.index + m[1].length;
    const openAt = at + name.length + 1;
    const first = text[openAt];
    if (first === "[" || first === "{") {
      const lit = matchLiteral(text, openAt);
      if (lit && lit.includes("timeseries:[")) {
        return new Function(`"use strict"; return (${lit});`)();
      }
    }
  }
  throw new Error("data assignment not found: " + name);
}

// Bundle's own deobfuscator: Ux(e, t=123) — base36-decoded int XOR 123 per segment
function decode(v, seed = 123) {
  const s = String(v);
  const dec = (seg) => parseInt(seg, 36) ^ seed;
  if (s.includes(".")) {
    const [a, b] = s.split(".");
    return parseFloat(`${dec(a)}.${b}`);
  }
  return dec(s);
}

function isoDate(dmy) {
  const [d, m, y] = String(dmy).split("/").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function csvCell(x) {
  const s = String(x ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function num(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : "";
}

const rows = [["dataset", "question_id", "question", "visual", "answer", "dimension", "key", "date", "value_pct", "parties"].join(",")];
const push = (r) => rows.push(r.map(csvCell).join(","));

// ---- Dataset 1: DC — leader performance ratings (Very good..Very poor) ----
const DC = loadAssign("DC");
for (const entry of DC) {
  const a = entry[0];
  const lastDate = isoDate(a.timeseries.at(-1).date);
  for (const p of a.timeseries) {
    push(["leader_performance", "", "", "", a.answer, "overall", "National", isoDate(p.date), num(p.value), (p.parties || []).join("; ")]);
  }
  for (const band of a.age || []) {
    push(["leader_performance", "", "", "", a.answer, "age", String(band.age), lastDate, num(band.value), ""]);
  }
}

// ---- Dataset 2: ip — ad-hoc question (Q444, encrypted title) ----
const ip = loadAssign("ip");
const qText = s => (s && s.startsWith("!e!") ? "(AES-encrypted in source)" : s || "");
const DIMS = [["states", "region"], ["age", "age"], ["gender", "gender"]];
for (const ans of ip.answers) {
  for (const [prop, dim] of DIMS) {
    for (const seg of ans[prop] || []) {
      for (const p of seg.timeseries || []) {
        push([`Q444_${ip.visual || "adhoc"}`, ip.id, qText(ip.question), ip.visual || "", ans.answer, dim, seg.key, isoDate(p.date), num(decode(p.value)), (p.parties || []).join("; ")]);
      }
    }
  }
}

writeFileSync(OUT, rows.join("\n") + "\n");
console.log(`wrote ${OUT} — ${rows.length - 1} data rows`);

// quick verification summary
const counts = {};
for (const r of rows.slice(1)) counts[r.split(",")[0]] = (counts[r.split(",")[0]] || 0) + 1;
console.log("rows per dataset:", counts);
const dates = [...new Set(rows.slice(1).map(r => r.split(",")[7]).filter(Boolean))].sort();
console.log("dates:", dates.length, dates[0], "->", dates.at(-1));
console.log("Q444 answers:", ip.answers.map(a => a.answer));
console.log("decoded sample (2f ->", decode("2f"), ", 31 ->", decode("31"), ")");
