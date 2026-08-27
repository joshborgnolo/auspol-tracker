/* extract-netsat-once.mjs — ONE-TIME extraction: pull Ministers' net
   satisfaction (Newspoll) out of the pasted sheet JSON and write
   data/newspoll-leader-net-satisfaction.csv (wide: one row per poll date,
   one column per leader, blank where that leader wasn't rated). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = "/Users/joshuaborgnolo/Documents/Matilda/sessions/260828-can-you-extract-the-leaders-net-satisfaction-dat/attachments/1ef05ce7-0130-4963-9a9d-55abc0816852_pasted-text-10.txt";
const OUT = path.join(ROOT, "data", "newspoll-leader-net-satisfaction.csv");

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const sheet = raw.data[0];
const header = sheet[0];
if (header[0] !== "Date") throw new Error("unexpected header: " + header[0]);

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function toIso(s) {
  const m = s.trim().toLowerCase().match(/^([a-z]+)\.?\s*(\d{1,2}),\s*(\d{4})$/);
  if (!m) throw new Error("unparseable date: " + JSON.stringify(s));
  const mm = MONTHS[m[1].slice(0, 3)];
  if (!mm) throw new Error("unknown month: " + m[1]);
  return `${m[3]}-${String(mm).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
const dates = header.slice(1).map(toIso);

const rows = new Map(); // leader -> {date: net}
let issues = [];
for (const r of sheet.slice(1)) {
  const leader = r[0], vals = r.slice(1);
  if (vals.length !== dates.length) issues.push(`${leader}: ${vals.length} values vs ${dates.length} dates`);
  const recs = {};
  vals.forEach((v, i) => {
    if (v === "") return;
    const n = Number(v);
    if (!Number.isInteger(n)) { issues.push(`${leader} @${dates[i]}: non-integer ${v}`); return; }
    recs[dates[i]] = n;
  });
  rows.set(leader, recs);
}

// Drop leaders with no readings at all (e.g. Turnbull predates this window).
const leaders = [...rows.keys()].filter((l) => Object.keys(rows.get(l)).length > 0);
const lines = ["date," + leaders.map((l) => l.toLowerCase().replace(/ /g, "_")).join(",")];
for (const d of dates) {
  lines.push(d + "," + leaders.map((l) => rows.get(l)[d] ?? "").join(","));
}
fs.writeFileSync(OUT, lines.join("\n") + "\n");

const fmt = (n) => (n >= 0 ? "+" : "") + n;
console.log("leaders found:", [...rows.keys()].join(", "));
console.log("all-empty columns dropped:", [...rows.keys()].filter((l) => !leaders.includes(l)).join(", ") || "none");
for (const l of leaders) {
  const es = Object.entries(rows.get(l)).sort();
  console.log(`${l}: ${es.length} readings, ${es[0][0]} ${fmt(es[0][1])} -> ${es.at(-1)[0]} ${fmt(es.at(-1)[1])}`);
}
console.log("poll dates:", dates.length, dates[0], "->", dates.at(-1));
console.log("sheet refreshed:", raw.refreshed);
console.log("issues:", issues.length ? issues.join("; ") : "none");
console.log("wrote", OUT);
