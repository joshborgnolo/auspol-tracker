// Extract every polling series from the Resolve Political Monitor interactive
// (https://www.smh.com.au/national/resolve-political-monitor-20210322-p57cvx.html,
// data source https://www.smh.com.au/interactive/2021/political-monitor/data/data.json)
// and merge with the rows already in data/resolve-political-monitor.csv.
//
// Datasets produced from the live file (question ids are the interactive's):
//   Q5  primary_vote             federal primary vote, 2021-04 -> latest, National + regions
//   Q17 pm_performance           PM job rating (series starts Aug 2022)
//   Q15 opp_leader_performance   opposition-leader job rating (series starts Aug 2022)
//   Q22 who_will_win             expected election winner ("two group preffered bar")
//   Q21a party_attributes        "which party would perform best" per policy area
//   Q21b party_descriptors       statements describing each party
//   Q11 well_being_index         Self / State / Country wellbeing
//   Q25NSW primary_vote_nsw      NSW state primary vote
//   Q28NSW preferred_premier_nsw NSW premier vs opposition leader
//   Q29VIC primary_vote_vic      VIC state primary vote
//   Q32VIC preferred_premier_vic VIC premier vs opposition leader
//
// Existing CSV rows are kept verbatim: `leader_performance` carries the PM
// series back to Apr 2021 with finer precision, and `Q444_*` whom-would-win
// rows come from a newer app generation whose answer slots do not line up
// numerically with the legacy Q22 slots.
//
// Values/questions are CryptoJS passphrase format ("!e!...!e!", passphrase
// "sacho", from the interactive's own bundle), decrypted here with node:crypto.
// Usage: node .build/extract-resolve-rpm.mjs [url-or-file]
import { createHash, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const SRC = process.argv[2] || "https://www.smh.com.au/interactive/2021/political-monitor/data/data.json";
const OUT = "data/resolve-political-monitor.csv";

const DATASETS = {
  Q5: "primary_vote",
  Q11: "well_being_index",
  Q17: "pm_performance",
  Q15: "opp_leader_performance",
  Q21a: "party_attributes",
  Q21b: "party_descriptors",
  Q22: "who_will_win",
  Q25NSW: "primary_vote_nsw",
  Q28NSW: "preferred_premier_nsw",
  Q29VIC: "primary_vote_vic",
  Q32VIC: "preferred_premier_vic",
};

async function loadSource(src) {
  let buf;
  if (existsSync(src)) buf = readFileSync(src);
  else {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`fetch ${src}: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  return JSON.parse(buf.toString("utf8"));
}

// CryptoJS open-file format: base64("Salted__"<8-byte salt><ciphertext>),
// key+iv via EVP_BytesToKey (MD5 chain) — AES-256-CBC.
function decodeCryptoJS(b64, passphrase) {
  const raw = Buffer.from(b64, "base64");
  if (raw.toString("utf8", 0, 8) !== "Salted__") throw new Error("not a salted cipher");
  const salt = raw.subarray(8, 16);
  const ct = raw.subarray(16);
  const pass = Buffer.from(passphrase, "utf8");
  let derived = Buffer.alloc(0);
  let next = Buffer.alloc(0);
  while (derived.length < 48) {
    next = createHash("md5").update(Buffer.concat([next, pass, salt])).digest();
    derived = Buffer.concat([derived, next]);
  }
  const d = createDecipheriv("aes-256-cbc", derived.subarray(0, 32), derived.subarray(32, 48));
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

const decrypt = (v) => {
  if (typeof v !== "string" || !v.includes("!e!")) return v;
  return decodeCryptoJS(v.replace(/!e!/g, ""), "sacho");
};

const isoDate = (dmy) => {
  const [d, m, y] = String(dmy).split("/");
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const num = (v) => {
  const n = parseFloat(decrypt(v));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : "";
};

const csvCell = (x) => {
  const s = String(x ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const stripTags = (s) => s.replace(/<[^>]*>/g, "").trim();

const rowsOut = [];
const push = (r) => rowsOut.push(r.map(csvCell).join(","));

function pushSeries(dataset, q, answer, dim, key, series) {
  for (const p of series || []) {
    const value = num(p.value);
    if (value === "") continue;
    const parties = (p.parties || []).map((x) => String(x).trim()).join("; ");
    push([dataset, q.id, stripTags(decrypt(q.question) || ""), q.visual || "", answer, dim, key.trim(), isoDate(p.date), value, parties]);
  }
}

const data = await loadSource(SRC);
for (const sec of data.sections || []) {
  const dataset = DATASETS[sec.id];
  if (!dataset) throw new Error(`unknown section id ${sec.id}`);
  const question = stripTags(decrypt(sec.question) || "");
  const meta = { id: sec.id, question, visual: sec.visual || "" };
  for (const ans of sec.answers || []) {
    for (const [dim, segs] of [["region", ans.states], ["age", ans.age], ["gender", ans.gender], ["category", ans.categories]])
      for (const seg of segs || []) pushSeries(dataset, meta, ans.answer, dim, seg.key, seg.timeseries);
  }
}

// Merge: existing CSV rows (previous extractions) stay on top, new rows beneath.
const header = "dataset,question_id,question,visual,answer,dimension,key,date,value_pct,parties";
const existing = existsSync(OUT) ? readFileSync(OUT, "utf8").trim().split("\n") : [];
const existingBody = existing[0] && existing[0].startsWith("dataset,") ? existing.slice(1) : [];
const all = new Set([...existingBody, ...rowsOut]);
writeFileSync(OUT, [header, ...all].join("\n") + "\n");
console.log(`updated ${OUT}: kept ${existingBody.length} existing rows, added ${rowsOut.length}, wrote ${all.size} total`);

const counts = {};
for (const r of rowsOut) {
  const ds = r.split(",")[0];
  counts[ds] = (counts[ds] || 0) + 1;
}
console.log("new rows per dataset:", counts);
const dates = [...new Set(rowsOut.map((r) => r.split(",")[7]))].sort();
console.log("dates:", dates[0], "->", dates.at(-1));
console.log("source updated:", data.updated);
