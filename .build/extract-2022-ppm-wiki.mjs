// One-off source-mirror for the 2022–2025 term's preferred-PM readings:
// Wikipedia, "Opinion polling for the 2025 Australian federal election" →
// "Preferred prime minister and leadership polling table" (the four per-year
// sections). Fetches the section wikitext live from the MediaWiki API and
// writes data/wiki-2025-election-ppm.csv (date,firm,albanese,dutton).
//
// Table quirks handled here (verified 3 Sep 2026 against the live page):
//   - rows group on the date-start line (a leading !-cell ending in a 4-digit
//     year); this page's header and some rows interleave |- separators per
//     line, so row boundaries can't be found by splitting on |-
//   - the 2025 sub-table carries a FOURTH ppm column (Net) after Don't Know;
//     the first three cells still hold Albanese / Dutton / Don't Know
//   - firm cells come as [[Firm]], [Firm], and [url Firm] external links, all
//     normalised to this repo's canonical firm names
//   - Don't Know is NOT archived: it is unused downstream, its header hides
//     behind colspan variants, and one Spectre Strategy row does not sum with
//     it (47/35/27 with a printed +12 net)
//
// The assimilator is .build/assimilate-2022-ppm-wiki.mjs — this script's only
// output is the CSV. Re-running rewrites the CSV wholesale (no state); the
// page is frozen post-election, so the file should be stable.
import { writeFileSync } from "node:fs";

const PAGE = "Opinion_polling_for_the_2025_Australian_federal_election";
const SECTIONS = [16, 17, 18, 19];               // 2025 / 2024 / 2023 / 2022 tables
const OUT = "data/wiki-2025-election-ppm.csv";

const CANON = new Map([
  ["Freshwater Strategy", "Freshwater"],
  ["Resolve Strategic", "Resolve"],
  ["Spectre Strategy/Dynata", "Spectre Strategy"],
  ["Newspoll", "Newspoll"],
  ["YouGov", "YouGov"],
  ["Essential", "Essential"],
  ["DemosAU", "DemosAU"],
  ["Ipsos", "Ipsos"],
  ["Roy Morgan", "Morgan"],
]);

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function parseDate(text) {
  const t = text.replace(/−/g, "–").trim();
  const M = "([A-Za-z]+)", D = "(\\d{1,2})", Y = "(\\d{4})";
  let m = t.match(new RegExp(`^${D}\\s*${M}?\\s*[-–—]\\s*${D}\\s+${M}\\s+${Y}$`));
  if (m) return iso(m[5], MONTHS[m[4].toLowerCase()], m[3]);
  m = t.match(new RegExp(`^${D}\\s+${M}\\s*[-–—]\\s*${D}\\s+${M}\\s+${Y}$`));
  if (m) return iso(m[5], MONTHS[m[4].toLowerCase()], m[3]);
  m = t.match(new RegExp(`^${D}\\s+${M}\\s+${Y}\\s*[-–—]\\s*${D}\\s+${M}\\s+${Y}$`));
  if (m) return iso(m[6], MONTHS[m[5].toLowerCase()], m[4]);
  m = t.match(new RegExp(`^${D}\\s+${M}\\s+${Y}$`));
  if (m) return iso(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  return null;
}

const strip = (s) => s
  .replace(/<ref[^>]*\/>/g, "")
  .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
  .replace(/\{\{efn[^}]*\}\}/g, "")
  .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1")   // external link → label
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
  .replace(/\[+([^\]\[]+)\]+/g, "$1")
  .replace(/'''/g, "")
  .trim();

const cells = (line) => line.replace(/^[!|]/, "").split(/(?:\|\||!!)/).map((p) => {
  const cut = p.indexOf("|");
  const hasAttr = cut > 0 && /^[^<>=%]*(?:=|style|rowspan|colspan|class|background|width|align)/.test(p.slice(0, cut));
  return strip(hasAttr ? p.slice(cut + 1) : p);
});

const pct = (s) => {
  const m = s.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  return m ? +m[1] : null;
};

const wikitext = async (section) => {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${PAGE}&prop=wikitext&section=${section}&format=json&formatversion=2`;
  const r = await fetch(url, { headers: { "user-agent": "auspol-tracker/1.0 (data mirror; contact: site owner)" } });
  if (!r.ok) throw new Error(`section ${section}: HTTP ${r.status}`);
  const j = await r.json();
  return j.parse.wikitext;
};

const rows = [];
const skipped = [];
for (const sec of SECTIONS) {
  const wt = await wikitext(sec);
  let cur = null;
  const flush = () => { if (cur) rows.push(cur); cur = null; };
  for (const line of wt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\|}/.test(trimmed)) { flush(); continue; }
    if (/^!/.test(trimmed)) {
      const text = cells(trimmed)[0];
      const d = /\d{4}/.test(text) ? parseDate(text) : null;
      if (d) { flush(); cur = { date: d, dateText: text, cells: [] }; continue; }
    }
    if (cur && /^[|!]/.test(trimmed)) cur.cells.push(...cells(trimmed));
  }
  flush();
}

const out = [];
for (const r of rows) {
  const [firmRaw, , , alb, opp] = r.cells;
  if (!firmRaw) { skipped.push("no-firm: " + r.dateText); continue; }
  const firm = CANON.get(firmRaw) || firmRaw.replace(/\[|\]/g, "");
  if (!CANON.has(firmRaw) && !CANON.has(firm)) console.log("note: unmapped firm name kept raw:", JSON.stringify(firmRaw));
  const albanese = pct(alb ?? ""), dutton = pct(opp ?? "");
  if (albanese == null && dutton == null) continue;          // approval-only wave
  if (albanese == null || dutton == null) { skipped.push("half-pair: " + r.dateText + " " + firmRaw); continue; }
  out.push({ date: r.date, firm, albanese, dutton });
}
out.sort((a, b) => a.date.localeCompare(b.date));

// guards: unique date+firm, sane pairs
const seen = new Set();
const bad = [];
for (const r of out) {
  const k = r.date + "|" + r.firm;
  if (seen.has(k)) bad.push("dup " + k);
  seen.add(k);
  if (r.albanese <= 0 || r.dutton <= 0 || r.albanese + r.dutton > 100) bad.push("sane " + JSON.stringify(r));
}
if (bad.length) { console.error("aborting:\n  " + bad.join("\n  ")); process.exit(1); }

const byFirm = {};
for (const r of out) byFirm[r.firm] = (byFirm[r.firm] || 0) + 1;
const csv = "date,firm,albanese,dutton\n" +
  out.map((r) => `${r.date},${r.firm},${r.albanese},${r.dutton}`).join("\n") + "\n";
writeFileSync(OUT, csv);
console.log(`wrote ${OUT}: ${out.length} rows · ${out[0].date} → ${out.at(-1).date}`);
console.log("byFirm:", JSON.stringify(byFirm));
if (skipped.length) console.log("skipped:", skipped.join("; "));
