#!/usr/bin/env node
/* mine-agb-mcnair.mjs — extract pre-1996 AGB McNair poll mentions from the
   local Trove harvest into a committed data file:

     data/trove-poll-articles.csv       article metadata (refresh-trove-archive.mjs)
     .matilda/trove-harvest/text/<id>.txt  full OCR text (harvest-trove-text.mjs)
     → data/agb-mcnair-mentions.csv     id,date,masthead,title,match,excerpt,url

     node .build/mine-agb-mcnair.mjs

   AGB McNair was Fairfax's national pollster 1992–mid-1995 (face-to-face) —
   the AC Nielsen precursor; the Nielsen series starts at 1996. This mines the
   newspaper record for where the press actually reported the AGB McNair waves:
   full-text OCR matches on the AGB/McNair house name near poll/survey language.
   "McNair Anderson" (radio ratings) is a different firm and is excluded unless
   it co-occurs with AGB. Saulwick's Age poll is a sibling series, not matched
   here — see the acnielsen lineage note. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HARVEST = path.join(ROOT, ".matilda", "trove-harvest");
const ARTICLES = path.join(ROOT, "data", "trove-poll-articles.csv");
const OUT = path.join(ROOT, "data", "agb-mcnair-mentions.csv");
const CUTOFF = "1996-01-01";

const HOUSE = [ // [pattern, match label]
  [/\ba\.?\s?g\.?\s?b\.?\s*[:\-–]?\s*mcnair/i, "AGB McNair"],
  [/\ba\.?\s?g\.?\s?b\.?\s+(poll|survey|research)/i, "AGB poll"],
  [/mcnair\s+(poll|survey)/i, "McNair poll"],
  [/saulwick[^a-zA-Z]{0,30}(a\.?\s?g\.?\s?b\.?|mcnair)/i, "Saulwick AGB McNair"],
];

/* minimal CSV reader — matches the csvCell writer in refresh-trove-archive.mjs */
const parseCsv = (text) => {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
      if (c === '"') { inQ = false; continue; }
      cell += c;
    } else {
      if (c === '"') { inQ = true; continue; }
      if (c === ",") { row.push(cell); cell = ""; continue; }
      if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
      cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
};

const ENTITIES = { "&#8212;": "—", "&mdash;": "—", "&#8211;": "–", "&ndash;": "–", "&#8217;": "’", "&rsquo;": "’", "&#8216;": "‘", "&lsquo;": "‘", "&#8220;": "“", "&ldquo;": "“", "&#8221;": "”", "&rdquo;": "”", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&nbsp;": " " };
const plain = (s) => String(s)
  .replace(/<[^>]+>/g, " ")
  .replace(/&[#a-z]+;/gi, (m) => ENTITIES[m] ?? " ")
  .replace(/\s+/g, " ")
  .trim();

if (!fs.existsSync(ARTICLES)) {
  console.error(`no ${ARTICLES} — run .build/refresh-trove-archive.mjs first`);
  process.exit(1);
}

const [header, ...rows] = parseCsv(fs.readFileSync(ARTICLES, "utf8"));
if (header.join(",") !== "id,date,masthead,title,page,words,pollster,url") {
  console.error("unexpected trove-poll-articles.csv header: " + header.join(","));
  process.exit(1);
}
const ID = 0, DATE = 1, MASTHEAD = 2, TITLE = 3, POLLSTER = 6, URL = 7;

const ACN_PAGE = path.join(ROOT, "archives", "acnielsen", "index.html");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hits = [];
let scanned = 0, noText = 0;
for (const r of rows) {
  const id = r[ID], date = r[DATE];
  if (!id || !date || date >= CUTOFF) continue;
  scanned++;
  const txtPath = path.join(HARVEST, "text", `${id}.txt`);
  let hay = "";
  if (fs.existsSync(txtPath)) hay = plain(fs.readFileSync(txtPath, "utf8"));
  else noText++;
  /* structured column counts as a hit too: the triage regex matched the
     article's own metadata when the refresh ran */
  const metaHay = `${r[TITLE]} ${r[POLLSTER]}`;
  let best = null;
  for (const [re, label] of HOUSE) {
    const m = hay && hay.match(re);
    if (m) { best = { label, hay, idx: m.index }; break; }
    const mm = metaHay.match(re);
    if (mm) { best = { label, hay: metaHay, idx: mm.index }; break; }
  }
  if (!best) continue;
  const lo = Math.max(0, best.idx - 180);
  const excerpt = (lo > 0 ? "…" : "") + best.hay.slice(lo, best.idx + 500).trim() + "…";
  hits.push({ id, date, masthead: r[MASTHEAD], title: plain(r[TITLE]), match: best.label, excerpt, url: r[URL], csvPollster: r[POLLSTER] });
}

hits.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const out = ["id,date,masthead,title,match,excerpt,url",
  ...hits.map((h) => [h.id, h.date, h.masthead, h.title, h.match, h.excerpt, h.url].map(csvCell).join(",")),
].join("\n") + "\n";
fs.writeFileSync(OUT, out);

const byYear = {}, byMasthead = {};
for (const h of hits) {
  const y = h.date.slice(0, 4);
  byYear[y] = (byYear[y] || 0) + 1;
  byMasthead[h.masthead] = (byMasthead[h.masthead] || 0) + 1;
}
console.log(`scanned ${scanned} pre-${CUTOFF.slice(0, 4)} articles (${noText} missing OCR text)`);
console.log(`AGB McNair mentions: ${hits.length} (${hits[0]?.date ?? "—"} → ${hits.at(-1)?.date ?? "—"})`);
console.log("by year:", Object.entries(byYear).map(([y, n]) => `${y}:${n}`).join("  "));
console.log("top mastheads:", Object.entries(byMasthead).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([m, n]) => `${m} (${n})`).join(" | "));
console.log(`wrote ${OUT}`);

/* splice a generated section into the hand-maintained acnielsen page.
   Markers make the splice idempotent; without them the section is inserted
   before "The archive". Prose explains the 1996 floor (AC Nielsen–branded
   telephone series starts 1996; AGB McNair was the face-to-face precursor). */
const rowsHtml = hits.map((h) =>
  `    <li><a href="${h.url}">${h.date} — ${esc(h.title)}</a><span class="note">${esc(h.match)}</span></li>`
).join("\n");
const year0 = hits[0]?.date.slice(0, 4) ?? "", year1 = hits.at(-1)?.date.slice(0, 4) ?? "";
const block = `<!--AGB-MENTIONS-->
  <h2>Before 1996: AGB McNair</h2>
  <p>Fairfax&rsquo;s national poll before 1996 was conducted by AGB McNair — the face-to-face precursor of AC Nielsen. Kevin Bonham&rsquo;s <a href="https://kevinbonham.blogspot.com/2018/03/the-keating-aggregation-1990-1993.html">Keating aggregation (1990&ndash;1993)</a> streams it alongside Newspoll and Morgan from January 1992. AC Nielsen took over the Fairfax contract in 1996 and switched the series to telephone, so no Nielsen-branded federal poll exists before that year — which is why the archive starts at 1996.</p>
  <p>The ${hits.length} contemporary newspaper reports below (${year0}&ndash;${year1}) were located by scanning the full text of the repo&rsquo;s Trove harvest — every poll-naming newspaper article, 1803&ndash;2025 — for the AGB McNair house name. All ${hits.length} are from The Canberra Times, the only Fairfax-stable masthead Trove digitised into the 1990s (The Age and the SMH are not in the corpus; their AGB McNair reports are only accessible via those papers&rsquo; own archives). Rows with quoted excerpts: <a href="/data/agb-mcnair-mentions.csv">agb-mcnair-mentions.csv</a>; vote figures parsed from those same articles: <a href="/data/agb-mcnair-figures.csv">agb-mcnair-figures.csv</a>. Irving Saulwick&rsquo;s &ldquo;Age poll&rdquo; (Saulwick Research) is the sibling Victorian series; it is catalogued under &ldquo;Saulwick&rdquo; in the same harvest — see the <a href="/archives/trove/">Trove newspaper archive</a>.</p>
  <ul class="archive-list">
${rowsHtml}
  </ul>
  <!--/AGB-MENTIONS-->
  `;
const page = fs.readFileSync(ACN_PAGE, "utf8");
const splice = /[ \t]*<!--AGB-MENTIONS-->[\s\S]*?<!--\/AGB-MENTIONS-->\n?[ \t]*/;
const nextPage = splice.test(page)
  ? page.replace(splice, block)
  : page.replace("  <h2>The archive</h2>", block + "\n  <h2>The archive</h2>");
/* a no-op is fine: re-running with an unchanged corpus yields the same
   string. Failure = no markers placed. */
if (!splice.test(nextPage)) {
  console.error(`could not place AGB section in ${ACN_PAGE}`);
  process.exit(1);
}
fs.writeFileSync(ACN_PAGE, nextPage);
console.log(`spliced ${hits.length} rows into archives/acnielsen/index.html`);
