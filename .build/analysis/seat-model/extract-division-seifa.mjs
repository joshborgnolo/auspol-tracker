#!/usr/bin/env node
/* extract-division-seifa.mjs — per-division SEIFA indexes IRSD (pure
   disadvantage), IER (economic resources) and IEO (education & occupation)
   per election, published-source layer, plus IRSAD spliced from the sibling
   pipeline's irsad-cells.json (derive-irsad.py's companion emit — the
   combined store IS the single-file SEIFA-by-division record).

   Sources (all population-published per-division tables — ABS never prints a
   division score; the Parliamentary Library and AEC commissioned them):
   - APH RP 2/2008-09 (Nelson): 2006 Census x 2006 boundaries -> 2007 election
     block, aph09rp02 (.build/analysis/seifa-index/src/aph/aph-09rp02.txt)
   - APH RP 1/2010-11 (Nelson): 2006 Census x 2009 boundaries -> 2010 election
     block, aph11rp01 (same dir) — the pre-2010-election re-issue.
   - APH CIB 13/2000-01 (Newman & Kopras): 1996 Census x 2000 boundaries,
     aph01cib13 — parsed into the fixture as xcheck for the 2001-census
     derivation lane, never shipped into election rows (its census is 1996;
     the 2001-census lane derives those elections itself).
   - APH CIB 1/2004-05 (Newman & Kopras): 2001 Census x 2003 boundaries ->
     2004 election block, aph05cib01 — the ONLY published four-index
     per-division table on the 2003 edition (closes the 2004 election's
     lane; earlier notes wrongly claimed no 2001-census APH paper existed).
     Prints NO alphabetical scores tables and NO summary table — only the
     four ranked two-column tables (captions "Ranked by the Index of …" in
     fixed IRSAD/IRSD/IER/IEO order). Scores are read from the ranked rows;
     ranks are printed and authoritative.
   - APH CIB 4/1998-99 (Newman & Kopras): 1996 Census x 1997 boundaries ->
     1998 election block, aph98cib04 — the five-index-era paper. Its first
     two tables carry the era's Urban+Rural "Advantage" composite, NOT the
     2001-census-era IRSAD, so the fixture keeps them under an `adv` key
     and the store drops them (1998 rows carry irsd/ier/ieo only — the
     store's third row shape). The one committed source served as HTML
     (Wayback id_ capture of the live APH page, fmt:"html" — converted to
     the shared line grammar by aphHtmlLines): eight <h2>-captioned
     tables, every <tr> two division packs split by an empty spacer <td>.
   AEC RR5 att1 (2001 census, IR SAD only) is the gold standard the
   2001-census derivation cross-checks against — not a source here.

   Layout notes that matter to the parser (all verified 2026-10-23):
   - Each paper prints per index: an alphabetical 2-column scores table, a
     ranked 2-column table, and (09rp02/11rp01 only) a joint "Summary of
     Index Rankings" table-5 with four rank columns in printed order
     Advantage/Disadvantage, Disadvantage, Economic Resources, Education &
     Occupation. aph01cib13/aph05cib01 instead name their tables in prose
     form ("Index of Relative Socioeconomic Advantage by Electoral Division"
     etc; note its IEO ranked caption lacks the word "the": "Ranked by Index
     of Education and Occupation"). aph05cib01 has four such captions,
     "Ranked by the Index of …", in the fixed order above.
   - 09rp02 scores are integers; 11rp01, 01cib13 and 05cib01 are one-decimal.
   - 11rp01 abbreviates states as Vic./Tas. (dot); 09rp02/01cib13/05cib01 as Vic/Tas.
   - Party tokens: 09rp02/11rp01 ALP|LP|NP|Ind(+CLP); 01cib13/05cib01
     ALP|LIB|NP|IND(+GRN|CLP).
   - Table 5 clips long name cells at the column edge, EATING the closing
     " )" of the state abbreviation on two rows per paper (Kingsford Smith,
     Melbourne Ports) — row regexes therefore make that ')' optional.
   - 98cib04 is HTML: each table is headed by its <h2> caption followed by
     the lines "1997 Electoral Boundaries" / "1996 Census of Population
     and Housing" (bare text — aphHtmlLines never emits them), values
     one-decimal with thousands separators, states "Vic"/"Tas" (no dot);
     its ranked IEO caption drops "the", exactly like 01cib13's.
   - pdftotext form feeds (\f) prefix some rows; stripped before parsing.

   Doctrine: the store carries APH-PRINTED ranks verbatim (never recomputed —
   the papers' tie rule is page order, unobservable), scores from the a-
   tables, and ranks from table 5 where present; the 4-way internal cross-
   check (a-value vs b-value, b-rank vs table5 rank) must pass loudly or the
   extractor fails. Fixture (aph-fixtures.json) additionally records irsad,
   party and rating columns for reuse/cross-check — the store strips them.

   Run from the repo root:
     node .build/analysis/seat-model/extract-division-seifa.mjs
   Then: node .build/analysis/seat-model/test-division-seifa.mjs          */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC_DIR = ".build/analysis/seat-model/seifa-src";
const APH_DIR = ".build/analysis/seifa-index/src/aph";
const ABS_DERIVED = `${SRC_DIR}/abs-derived-3idx.json`; // derive-division-seifa-abs.py
const IRSAD_CELLS = `${SRC_DIR}/irsad-cells.json`;       // derive-irsad.py (companion emit)
const OUT_STORE = "data/division-seifa-indexes.json";
const OUT_FIXTURE = `${SRC_DIR}/aph-fixtures.json`;

const STATE_MAP = {
  NSW: "NSW", Vic: "VIC", "Vic.": "VIC", Qld: "QLD", SA: "SA",
  WA: "WA", Tas: "TAS", "Tas.": "TAS", NT: "NT", ACT: "ACT",
};
const ST = "NSW|Vic\\.?|Qld|SA|WA|Tas\\.?|NT|ACT";
const PT = "ALP|LP|LIB|NP|CLP|KAP|Independents?|Ind|IND|GRN";
/* Index-score token: bare integer or one-decimal with optional thousands
   separators (09rp02's integers, 11rp01/01cib13's one-decimal, 05cib01's
   one-decimal with "1,000.5" commas). Number() strips nothing — use
   .replace(/,/g, "") at the call-site conversion. */
const NUM = "\\d{1,2}(?:,\\d{3})+(?:\\.\\d+)?|\\d{3,}(?:\\.\\d+)?";

// scores row: Name (ST) PT VAL [  Name2 (ST) PT VAL]
const A_ROW = new RegExp(
  `^\\s*(.+?)\\s+\\((${ST})\\)?\\s+(${PT})\\s+(${NUM})(?:\\s{2,}(.+?)\\s+\\((${ST})\\)?\\s+(${PT})\\s+(${NUM}))?\\s*$`,
);
// ranked row: RANK Name (ST) PT VAL [  RANK Name2 (ST) PT VAL]
const B_ROW = new RegExp(
  `^\\s*(\\d{1,3})\\s+(.+?)\\s+\\((${ST})\\)?\\s+(${PT})\\s+(${NUM})(?:\\s{2,}(\\d{1,3})\\s+(.+?)\\s+\\((${ST})\\)?\\s+(${PT})\\s+(${NUM}))?\\s*$`,
);
// summary row: Name (ST) PT Rating R_AdvDis R_Dis R_IER R_IEO
const T5_ROW = new RegExp(
  `^\\s*(.+?)\\s+\\((${ST})\\)?\\s+(${PT})\\s+(Inner Metropolitan|Outer Metropolitan|Provincial|Rural)\\s+(\\d{1,3})\\s+(\\d{1,3})\\s+(\\d{1,3})\\s+(\\d{1,3})\\s*$`,
);

const IM = { irsd: "irsd", irsad: "irsad", ier: "ier", ieo: "ieo" };
const INDEXES = ["irsd", "irsad", "ier", "ieo"]; // fixture carries all four

// Table marker -> table descriptor, per paper. 09rp02/11rp01: numbered.
// 01cib13: prose captions (fixed index order, verified in the PDF).
const T1 = (id, idx, kind) => ({ id, idx, kind });
const PAPERS = [
  {
    via: "aph09rp02",
    file: `${APH_DIR}/aph-09rp02.txt`,
    title: "Socio-economic indexes for electoral divisions: 2006 Census (APH RP 2/2008-09, Nelson, 15 Aug 2008)",
    censusYear: 2006, editionInForce: "2006", elections: ["2007"],
    markers: [
      T1("1a", "irsd", "scores"), T1("1b", "irsd", "ranked"),
      T1("2a", "irsad", "scores"), T1("2b", "irsad", "ranked"),
      T1("3a", "ier", "scores"), T1("3b", "ier", "ranked"),
      T1("4a", "ieo", "scores"), T1("4b", "ieo", "ranked"),
      T1("5", null, "summary"),
    ],
  },
  {
    via: "aph11rp01",
    file: `${APH_DIR}/aph-11rp01.txt`,
    title: "Socio-economic indexes for 2009 electoral divisions: 2006 Census (APH RP 1/2010-11, Nelson, 28 Jul 2010)",
    censusYear: 2006, editionInForce: "2009", elections: ["2010"],
    markers: [
      T1("1a", "irsd", "scores"), T1("1b", "irsd", "ranked"),
      T1("2a", "irsad", "scores"), T1("2b", "irsad", "ranked"),
      T1("3a", "ier", "scores"), T1("3b", "ier", "ranked"),
      T1("4a", "ieo", "scores"), T1("4b", "ieo", "ranked"),
      T1("5", null, "summary"),
    ],
  },
  {
    via: "aph01cib13", xcheck: true,
    file: `${APH_DIR}/aph-01cib13.txt`,
    title: "Socioeconomic Indexes for Electoral Divisions (2000 Electoral Boundaries), 1996 Census (APH CIB 13/2000-01, Newman & Kopras, 3 Apr 2001)",
    censusYear: 1996, editionInForce: "2000", elections: [],
    markers: [
      T1("adv_a", "irsad", "scores"), T1("adv_b", "irsad", "ranked"),
      T1("dis_a", "irsd", "scores"), T1("dis_b", "irsd", "ranked"),
      T1("ier_a", "ier", "scores"), T1("ier_b", "ier", "ranked"),
      T1("ieo_a", "ieo", "scores"), T1("ieo_b", "ieo", "ranked"),
    ],
    terminals: true, // its tables are FOLLOWED by an Appendix narrative
  },
  {
    via: "aph05cib01",
    file: `${APH_DIR}/aph-05cib01.txt`,
    title: "Socio-economic indexes for electoral divisions: 2001 Census (2003 boundaries) (APH CIB 1/2004-05, Newman & Kopras, 12 Jul 2004)",
    censusYear: 2001, editionInForce: "2003", elections: ["2004"],
    markers: [
      T1("adv_a", "irsad", "scores"), T1("adv_b", "irsad", "ranked"),
      T1("dis_a", "irsd", "scores"), T1("dis_b", "irsd", "ranked"),
      T1("ier_a", "ier", "scores"), T1("ier_b", "ier", "ranked"),
      T1("ieo_a", "ieo", "scores"), T1("ieo_b", "ieo", "ranked"),
    ],
    terminals: true, // Appendix narrative follows the IEO ranked table
  },
  {
    via: "aph98cib04", fmt: "html",
    file: `${APH_DIR}/aph-98cib04.htm`,
    title: "Socio-Economic Indexes for Electoral Divisions, 1997 Electoral Boundaries, 1996 Census (APH CIB 4/1998-99, Newman & Kopras, 8 Dec 1998)",
    censusYear: 1996, editionInForce: "1997", elections: ["1998"],
    // Five-index-era paper: two of its eight tables carry the era's
    // Urban+Rural Advantage composite (NOT the 2001-on IRSAD), so the
    // fixture reads them under an `adv` key and the store never sees them.
    indexes: ["adv", "irsd", "ier", "ieo"],
    markers: [
      T1("adv_a", "adv", "scores"), T1("adv_b", "adv", "ranked"),
      T1("dis_a", "irsd", "scores"), T1("dis_b", "irsd", "ranked"),
      T1("ier_a", "ier", "scores"), T1("ier_b", "ier", "ranked"),
      T1("ieo_a", "ieo", "scores"), T1("ieo_b", "ieo", "ranked"),
    ],
    terminals: true, // Appendix follows the IEO ranked table
  },
];
/* Marker discriminators: 09rp02/11rp01 anchor on "Table Na:/Nb:/N:" labels.
   01cib13 has no labels — its captions are unique full prose lines —
   matched as exact trimmed lines in the FIXED printed order below. */
const CAPTIONS_01CIB13 = [
  /^Index of Relative Socioeconomic Advantage by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by the Index of Relative Socioeconomic Advantage\s*$/,
  /^Index of Relative Socioeconomic Disadvantage by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by the Index of Relative Socioeconomic Disadvantage\s*$/,
  /^Index of Economic Resources by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by the Index of Economic Resources\s*$/,
  /^Index of Education and Occupation by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by Index of Education and Occupation\s*$/,
];
/* 05cib01's layout: a TOC block (lines 82–97, captions carried with dot
   leaders and repeated bare) — at LEAST one caption cycle must be consumed
   before a "restart" can be taken seriously, so the restart gate requires
   >0 collected rows; then four (scores, ranked) pairs in fixed index order
   irsad→irsd→ier→ieo. Alpha scores captions are "Index of <name>" plain
   lines; ranked captions are "Ranked by the Index of <name>". */
const CAPTIONS_05CIB01 = [
  /^Index of Relative Socio-Economic Advantage\/Disadvantage\s*$/,
  /^Ranked by the Index of Relative Socio-Economic Advantage\/Disadvantage\s*$/,
  /^Index of Relative Socio-Economic Disadvantage\s*$/,
  /^Ranked by the Index of Relative Socio-Economic Disadvantage\s*$/,
  /^Index of Economic Resources\s*$/,
  /^Ranked by the Index of Economic Resources\s*$/,
  /^Index of Education and Occupation\s*$/,
  /^Ranked by the Index of Education and Occupation\s*$/,
];
/* 98cib04's captions are the <h2> heads of the served HTML tables in fixed
   order (its ranked IEO caption drops "the", exactly like 01cib13's). The
   front-matter <h2>s (Introduction/Highlights/Appendix) never match — only
   these eight do, once each, in this order. */
const CAPTIONS_98CIB04 = [
  /^Index of Relative Socio-Economic Advantage by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by the Index of Relative Socio-Economic Advantage\s*$/,
  /^Index of Relative Socio-Economic Disadvantage by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by the Index of Relative Socio-Economic Disadvantage\s*$/,
  /^Index of Economic Resources by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by the Index of Economic Resources\s*$/,
  /^Index of Education and Occupation by Electoral Division\s*$/,
  /^Electoral Divisions Ranked by Index of Education and Occupation\s*$/,
];

const HEADER_TOKENS = new Set([
  "Rank", "Electoral Division", "2009 Electoral Division", "2000 Electoral Division",
  "2006 Electoral Division", "Division", "Party", "Rating", "Index",
  "Advantage/", "Advantage/ Disadvantage", "Disadvantage", "Economic",
  "Resources", "Education &", "Education & Occupation", "Occupation",
  "Socio-Demographic", "Seat Status", "Classification", "Status", "Code",
  "Summary of Index Rankings", "and",
]);

const noiseLine = (line) => {
  const t = line.trim();
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true; // page number
  if (t.startsWith("Socio-economic indexes for")) return true; // footer
  if (t === "Socioeconomic Indexes for Electoral Divisions") return true;
  if (t === "2000 Electoral Boundaries") return true;
  if (t === "2006 Electoral Boundaries") return true;
  if (t === "2009 Electoral Boundaries") return true;
  if (/^(1996|2006) Census of Population and Housing$/.test(t)) return true;
  // a line composed entirely of table furniture tokens (header runs, incl.
  // continuation-page repacks like "Advantage/   Economic   Education &").
  // Blanket-strip known tokens in any order; noise iff nothing else remains.
  let rest = ` ${t} `.replace(/\s+/g, " ");
  const STRIP = [
    "Socio-Demographic", "Seat Status", "Classification", "Electoral Division",
    "Electoral division",
    "Division", "Party", "Rating", "Index", "Advantage/", "Disadvantage",
    "Economic", "Resources", "Education &", "Education & Occupation",
    "Occupation", "Rank", "Code", "Status", "Summary of Index Rankings",
    "and", "2009", "2006", "2000",
  ];
  for (let pass = 0; pass < 2; pass++) {
    for (const tok of STRIP) {
      rest = rest.split(` ${tok} `).join(" ").replace(/\s+/g, " ");
    }
    if (!rest.trim()) break;
  }
  if (!rest.trim()) return true;
  return false;
};

const fail = (msg) => { console.error(`\nFAIL: ${msg}`); process.exit(1); };

const TERMINAL = /^Appendix\b|^Endnotes\b|^Bibliography\b|^Conclusion\b|^Sources\b/;

/* 98cib04 is the one committed source captured as SERVED HTML (a Wayback
   id_ snapshot of the live APH page), not a pdftotext dump. Reduce it to
   the same line grammar the other papers use: every <h2> becomes its
   caption line; every <tr> becomes one line, its two division packs
   joined by three spaces where the empty spacer <td> sat. Header rows
   reduce to furniture tokens and noiseLine drops them; the edition and
   census lines between caption and table are bare text and never become
   lines. A <tr> shapes out to exactly 6 (scores, 2 x 3) or 8 (ranked,
   2 x 4) non-empty cells — anything else fails loudly as a layout shift. */
const ENTITIES = { nbsp: "\xa0", amp: "&", lt: "<", gt: ">", quot: "\"" };
const deEnt = (s) => s.replace(/&(nbsp|amp|lt|gt|quot);|&#(\d+);/gi, (m, n, d) =>
  d ? String.fromCharCode(+d) : ENTITIES[n.toLowerCase()] ?? m);
const cellText = (s) => deEnt(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
function aphHtmlLines(raw) {
  const HALVES = { 6: 3, 8: 4 };
  const lines = [];
  for (const m of raw.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>|<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (m[1] != null) { lines.push(cellText(m[1])); continue; }
    const cells = [...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((c) => cellText(c[1])).filter(Boolean);
    if (!cells.length) continue;
    const w = HALVES[cells.length];
    if (!w) fail(`aph98cib04: ${cells.length} cells in a <tr> — table layout changed?`);
    lines.push(cells.slice(0, w).join(" ") + "   " + cells.slice(w).join(" "));
  }
  return lines;
}

function parsePaper(cfg) {
  const raw = readFileSync(cfg.file, "utf8").replace(/\f/g, "\n");
  const lines = cfg.fmt === "html"
    ? aphHtmlLines(raw)
    : raw.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const useCaptions = cfg.via === "aph01cib13" || cfg.via === "aph05cib01" || cfg.via === "aph98cib04";
  const CAPTIONS = cfg.via === "aph05cib01" ? CAPTIONS_05CIB01
    : cfg.via === "aph98cib04" ? CAPTIONS_98CIB04 : CAPTIONS_01CIB13;
  const numbered = !useCaptions;
  const IDX_LIST = cfg.indexes ?? INDEXES;

  // Walk lines, assigning each to a block once a marker fires. A terminal
  // heading (Appendix etc.) closes the current block permanently. For
  // 01cib13 a caption is an exact trimmed line, matched in fixed printed
  // order. For 05cib01 the same eight captions recur in prose (TOC with
  // dot leaders, narrative section headings) so a caption only counts
  // when the very next line is the table header (`Electoral division` for
  // a scores page, `Rank` + `Electoral division` for a ranked page); each
  // caption may match at most once.
  const blocks = new Map(); // tableId -> {idx, kind, rows:[]}
  let cur = null, captionPos = 0, closed = false;
  const headerAfter = (idx, li) => {
    const NEXT = 5;
    for (let k = li + 1; k < Math.min(lines.length, li + 1 + NEXT); k++) {
      const tt = lines[k].trim();
      if (!tt) continue;
      if (idx === "scores") return /^Electoral division\b/.test(tt);
      return /^Rank\b/.test(tt) && /Electoral division\b/.test(tt);
    }
    return false;
  };
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li], t = line.trim();
    if (cfg.terminals && cur && TERMINAL.test(t)) { closed = true; cur = null; continue; }
    let hit = null;
    if (numbered) {
      const m = /^(?:Table\s+)?([1-4])([ab])\s*[:\.]/.exec(t) || (/^Table\s+5\s*[:\.]/.test(t) ? ["", "5", ""] : null);
      if (m) hit = `${m[1]}${m[2]}`.replace(/^5$/, "5");
    } else if (cfg.via === "aph01cib13" || cfg.via === "aph98cib04") {
      if (captionPos < CAPTIONS.length && CAPTIONS[captionPos].test(t)) { hit = cfg.markers[captionPos].id; captionPos++; }
    } else {
      for (let p = 0; p < CAPTIONS.length; p++) {
        if (blocks.has(cfg.markers[p].id)) continue;
        if (!CAPTIONS[p].test(t)) continue;
        if (!headerAfter(cfg.markers[p].kind, li)) continue;
        hit = cfg.markers[p].id; captionPos++;
        break;
      }
    }
    if (hit) {
      const desc = cfg.markers.find((mk) => mk.id === hit);
      if (!desc) fail(`${cfg.via}: unmatched table marker '${hit}' line ${li + 1}`);
      const prior = blocks.get(hit);
      if (prior) {
        if (JSON.stringify([prior.idx, prior.kind]) !== JSON.stringify([desc.idx, desc.kind]))
          fail(`${cfg.via}: conflicting duplicate table marker '${hit}' line ${li + 1}`);
        cur = prior; // "(cont.)" page re-headers carry the same label
      } else {
        cur = { ...desc, rows: [] };
        blocks.set(hit, cur);
      }
      continue;
    }
    if (cur && !closed) cur.rows.push({ line, li: li + 1 });
  }
  const expected = cfg.markers.map((m) => m.id);
  const missing = expected.filter((id) => !blocks.has(id));
  if (missing.length) fail(`${cfg.via}: missing tables ${missing.join(",")} (got ${[...blocks.keys()].join(",")})`);
  if (useCaptions && captionPos !== CAPTIONS.length)
    fail(`${cfg.via}: caption cycle did not complete (matched ${captionPos}/${CAPTIONS.length}) — layout changed?`);

  // Parse rows inside each block.
  const scores = {}; // idx -> Map name -> {state, party, value}
  const ranked = {}; // idx -> Map name -> {rank, state, party, value}
  const summary = new Map(); // name -> {state, party, rating, ranks:{irsad,irsd,ier,ieo}}
  const unparsed = [];
  const pushIdx = (tbl, name, st, party, value, rank) => {
    // 05cib01's PDF sets O'Connor with a typographic apostrophe; every other
    // paper (and data/division-classifications.json) uses the straight one.
    const canonical = name.replace(/’/g, "'").replace(/\s+/g, " ").trim();
    const state = STATE_MAP[st];
    if (!state) fail(`${cfg.via}: unknown state '${st}' line ${name}`);
    const map = tbl === "scores" ? scores : tbl === "ranked" ? ranked : null;
    const idx = cur?.idx ?? null;
    const dict = map[idx] || (map[idx] = new Map());
    if (dict.has(canonical)) fail(`${cfg.via} ${cur.id}: duplicate row for '${canonical}'`);
    dict.set(canonical, { state, party, value: Number(String(value).replace(/,/g, "")), rank: rank ? Number(rank) : undefined });
  };

  for (const [tid, blk] of blocks) {
    cur = blk;
    scores[blk.idx] ||= new Map(); ranked[blk.idx] ||= new Map();
    for (const { line, li } of blk.rows) {
      if (noiseLine(line)) continue;
      if (blk.kind === "scores") {
        const m = A_ROW.exec(line);
        if (m) { pushIdx("scores", m[1], m[2], m[3], m[4], null);
                 if (m[5]) pushIdx("scores", m[5], m[6], m[7], m[8], null); continue; }
      } else if (blk.kind === "ranked") {
        const m = B_ROW.exec(line);
        if (m) { pushIdx("ranked", m[2], m[3], m[4], m[5], m[1]);
                 if (m[6]) pushIdx("ranked", m[7], m[8], m[9], m[10], m[6]); continue; }
      } else {
        const m = T5_ROW.exec(line);
        if (m) {
          const name = m[1].replace(/\s+/g, " ").trim();
          const state = STATE_MAP[m[2]] ?? fail(`${cfg.via} table 5: unknown state '${m[2]}' line ${li}`);
          if (summary.has(name)) fail(`${cfg.via} table 5: duplicate '${name}' line ${li}`);
          summary.set(name, { state, party: m[3], rating: m[4],
            ranks: { irsad: +m[5], irsd: +m[6], ier: +m[7], ieo: +m[8] } });
          continue;
        }
      }
      unparsed.push({ tid, li, line });
    }
  }
  if (unparsed.length) {
    for (const u of unparsed.slice(0, 8)) console.error(`  unparSED ${u.tid} line ${u.li}: ${u.line}`);
    fail(`${cfg.via}: ${unparsed.length} unparsed table lines`);
  }

  // Internal consistency: scores-a rows must exactly equal ranked rows per index.
  // Printed RANKS are NOT recomputed: table 5 (the joint summary) is canonical;
  // 1b-rank deltas within an equal-rounded-score band are recorded as conflicts
  // (the papers never state a tie rule and the two printed tables were ranked
  // with different precision). Value-vs-rank cross computation never happens.
  const conflicts = [];
  for (const idx of IDX_LIST) {
    const a = scores[idx], b = ranked[idx];
    if (!a.size) fail(`${cfg.via}: empty scores table for ${idx}`);
    if (a.size !== b.size) fail(`${cfg.via} ${idx}: scores n=${a.size} vs ranked n=${b.size}`);
    for (const [name, s] of a) {
      const r = b.get(name) ?? fail(`${cfg.via} ${idx}: '${name}' in scores but not ranked`);
      if (s.value !== r.value) fail(`${cfg.via} ${idx} ${name}: a-value ${s.value} != b-value ${r.value}`);
      if (s.party !== r.party) fail(`${cfg.via} ${idx} ${name}: party mismatch ${s.party} vs ${r.party}`);
    }
  }
  if (summary.size) {
    for (const idx of IDX_LIST) {
      for (const [name, r] of ranked[idx]) {
        const s5 = summary.get(name);
        if (!s5) fail(`${cfg.via} ${idx}: '${name}' ranked but absent from table 5`);
        if (s5.ranks[idx] !== r.rank)
          conflicts.push({ idx, name, value: r.value, rankB: r.rank, rankT5: s5.ranks[idx] });
      }
      for (const name of summary.keys())
        if (!ranked[idx].has(name)) fail(`${cfg.via} ${idx}: '${name}' in table 5 but no ranked row`);
    }
    // Every rank conflict must be benign: all divisions sharing that rounded
    // score must hold, between them, THE SAME set of rank positions in both
    // printed tables (a pure within-band shuffle, not a real disagreement).
    for (const idx of IDX_LIST) {
      const conflictValues = new Set(conflicts.filter((c) => c.idx === idx).map((c) => c.value));
      for (const value of conflictValues) {
        const band = [...ranked[idx].entries()].filter(([, r]) => r.value === value).map(([n]) => n);
        if (band.length < 2) fail(`${cfg.via} ${idx}: rank conflict at value ${value} with no tie-band`);
        const bRanks = band.map((n) => ranked[idx].get(n).rank).sort((x, y) => x - y);
        const t5Ranks = band.map((n) => summary.get(n).ranks[idx]).sort((x, y) => x - y);
        if (JSON.stringify(bRanks) !== JSON.stringify(t5Ranks))
          fail(`${cfg.via} ${idx}: rank conflict at value ${value} is NOT a pure tie-band shuffle — band=${band.join("/")} b=${bRanks} t5=${t5Ranks}`);
      }
    }
  }
  if (conflicts.length)
    console.warn(`${cfg.via}: ${conflicts.length} tie-band rank reorderings (table5 canonical)`);

  // Assemble rows.
  const names = [...scores.irsd.keys()];
  const rows = {};
  for (const name of names) {
    const row = { state: scores.irsd.get(name).state };
    const party = scores.irsd.get(name).party;
    if (party) row.party = party;
    const rating = summary.get(name)?.rating;
    if (rating) row.rating = rating;
    for (const idx of IDX_LIST) {
      const s = scores[idx].get(name), r = ranked[idx].get(name);
      const rank = summary.size ? summary.get(name).ranks[idx] : r.rank;
      row[idx] = { value: s.value, rank };
      if (r.rank !== rank) row[idx].rankB = r.rank; // printed 1b rank, tie-band-reordered
    }
    rows[name] = row;
  }
  console.log(`${cfg.via}: ${names.length} divisions x ${IDX_LIST.length} indexes parsed (${cfg.title})`);
  return {
    via: cfg.via, title: cfg.title, censusYear: cfg.censusYear,
    editionInForce: cfg.editionInForce, xcheck: !!cfg.xcheck, tieRankConflicts: conflicts, rows,
  };
}

mkdirSync(SRC_DIR, { recursive: true });
const fixtures = {};
for (const cfg of PAPERS) fixtures[cfg.via] = parsePaper(cfg);

writeFileSync(OUT_FIXTURE, JSON.stringify(fixtures, null, 2) + "\n");
console.log(`wrote ${OUT_FIXTURE} (${Object.keys(fixtures).join(", ")})`);

// Store: election blocks, division-keyed; irsd/ier/ieo from the two lanes
// below, irsad from the sibling pipeline's cells fixture.
const ABOUT =
  "SEIFA (ABS Socio-Economic Indexes for Areas) per federal electoral division, all four indexes: " +
  "IRSD = Index of Relative Socio-Economic Disadvantage (pure disadvantage; HIGH score = LESS disadvantaged), " +
  "IER = Index of Economic Resources, IEO = Index of Education and Occupation, IRSAD = Index of Relative " +
  "Socio-Economic Advantage and Disadvantage. irsd/ier/ieo ranks run 1 = MOST disadvantaged (the APH tapes' own " +
  "order); an irsad cell instead carries TWO ranks — `rank` = 1 most ADVANTAGED (the sibling pipeline's and the " +
  "index's natural read), `rankDis` = 1 most disadvantaged (this store's convention, = N+1-rank). Every index " +
  "cell ALSO carries pct, its within-census percentile rank (rankDis/N), and the bracketed-in-time elections " +
  "additionally carry pcti, the census-night-distance interpolation of the two bracketing censuses' pct — " +
  "the cross-census comparable quantity (percentiles are; raw scores never are, ABS re-deriving the indexes " +
  "per census). pcti lanes shipped: 2013/2016/2019 (concordance-based); 2004/2007/2010 await the CD-era CED " +
  "polygons (see _pcti.pending). IRSAD lands " +
  "from the sibling pipeline's irsad-cells.json (derive-irsad.py), which also owns the display store at " +
  ".build/analysis/seifa-index/irsad-by-division.json. APH lanes carry scores/ranks as PRINTED by the papers; " +
  "ABS lanes rank from their carried scores. Indexes are re-derived by the ABS per census (PCA weights " +
  "recomputed), so scores and ranks compare WITHIN a census year, never across them. Census-year and " +
  "boundary-edition provenance ride each election block (_provenance). APH-lane elections are 1998 " +
  "(aph98cib04, 1996 census x the 1997-in-force boundaries) and 2004 (aph05cib01, 2001 census x the 2003 " +
  "edition). 2001 is the ABS's own published 2001-CED cube (scores as printed, ranks computed from them; " +
  "AEC RR5 att1 prints IRSAD only). 2013-2025 are ABS-cube derivations " +
  "per 2039.0 (SA1 2011/2016 cubes x their CED allocation for 2013-2019, MB-level 2021 cube x allocation for " +
  "2022/2025), exact-verified against the ABS CED SA1-distribution cubes for 2013/2016. 2028 is an " +
  "irsad-only forward block (2021-census derivation on the 2025 gazetted boundaries; the other three " +
  "indexes await a census), 1998 an irsd/ier/ieo-only one — IRSAD did not exist until the 2001 census and " +
  "the five-index-era Advantage composite the paper prints is NOT IRSAD (fixture-only, key `adv`). " +
  "1987-1993 (five-index era) out of scope. Full map: .build/analysis/seifa-index/rr6-official-seifa-products.md.";

const provenance = {};
const elections = {};
for (const cfg of PAPERS) {
  const fx = fixtures[cfg.via];
  provenance[cfg.via] = { title: cfg.title, censusYear: cfg.censusYear, editionInForce: cfg.editionInForce };
  for (const y of cfg.elections) {
    if (elections[y]) fail(`election ${y} claimed by two papers`);
    const block = {};
    for (const [name, row] of Object.entries(fx.rows)) {
      const out = { state: row.state };
      for (const idx of ["irsd", "ier", "ieo"]) out[idx] = { value: row[idx].value, rank: row[idx].rank };
      out.via = cfg.via;
      block[name] = out;
    }
    elections[y] = block;
    console.log(`${y}: ${Object.keys(block).length} divisions (via ${cfg.via})`);
  }
}

// ABS-derived lanes (derive-division-seifa-abs.py output; ranks computed
// by that script from its 3dp values — the store's derived rule: APH lanes
// carry printed ranks, ABS lanes compute). IRSAD arrives separately below.
const ABS_VIA_BY_ELECTION = {
  2001: "absCed01", 2013: "absSa1Ced2011", 2016: "absSa1Ced2016",
  2019: "absSa1Ced2018", 2022: "absMbCed2021", 2025: "absMbCed2024",
};
{
  const d = JSON.parse(readFileSync(ABS_DERIVED, "utf8"));
  for (const [via, rec] of Object.entries(d._provenance))
    provenance[via] = { title: rec.title, censusYear: rec.censusYear, editionInForce: rec.editionInForce, derivation: rec.derivation, recons: rec.recons };
  for (const [y, block] of Object.entries(d.elections)) {
    if (elections[y]) fail(`election ${y} claimed by both a paper and the ABS lanes`);
    const via = ABS_VIA_BY_ELECTION[y];
    if (!via || !provenance[via]) fail(`election ${y}: no ABS provenance registered`);
    const out = {};
    for (const [name, row] of Object.entries(block)) {
      const rec = { state: row.state, via };
      for (const idx of ["irsd", "ier", "ieo"]) rec[idx] = row[idx];
      out[name] = rec;
    }
    elections[y] = out;
    console.log(`${y}: ${Object.keys(out).length} divisions (via ${via})`);
  }
}

/* IRSAD splice — the store's own indexes rank 1 = MOST DISADVANTAGED (the
   APH tapes' order), while a SEIFA IRSAD rank's natural read is 1 = most
   ADVANTAGED, so the cell carries both: `rank` is the sibling pipeline's
   rank-1-most-advantaged figure (descending score — matches an exact
   descending recompute on every election, so no lane re-derives it), and
   `rankDis` = N+1-rank puts the cell in the store's own convention for any
   consumer lining IRSAD up against irsd/ier/ieo. Elections present in the
   cells file but not yet in the store (the forward 2028 block) land as
   irsad-only rows. test-division-seifa pins every piece of this. */
{
  const cells = JSON.parse(readFileSync(IRSAD_CELLS, "utf8"));
  const forward = [];
  for (const [y, block] of Object.entries(cells)) {
    const meta = block._meta;
    const names = Object.keys(block).filter((n) => n !== "_meta");
    if (!meta?.provName) fail(`irsad-cells ${y}: no _meta provName`);
    let provKey = meta.provName;
    // Two blocks can share a census+derivation lane (2001 and 2004 both ride
    // the 2001 census's published tables) — the editionInForce splits them.
    if (provenance[provKey]) provKey = `${meta.provName}-e${meta.editionInForce}`;
    if (provenance[provKey]) fail(`irsad-cells ${y}: provName ${provKey} collides`);
    provenance[provKey] = {
      title: `IRSAD lane — ${meta.sourceProduct}`,
      censusYear: meta.censusYear,
      editionInForce: meta.editionInForce,
      derivation: meta.derivation,
      sourceProduct: meta.sourceProduct,
    };
    if (meta.forward === true) {
      if (elections[y]) fail(`irsad-cells ${y}: forward flag on a shared election`);
      forward.push(y);
    } else if (meta.forward !== undefined)
      fail(`irsad-cells ${y}: unexpected forward ${JSON.stringify(meta.forward)}`);
    const N = names.length;
    const existing = elections[y] ? new Set(Object.keys(elections[y])) : null;
    if (existing) {
      const got = new Set(names);
      const missing = [...existing].filter((n) => !got.has(n));
      const extra = [...got].filter((n) => !existing.has(n));
      if (missing.length || extra.length)
        fail(`irsad-cells ${y}: name-set drift — missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}`);
    }
    for (const n of names) {
      const c = block[n];
      const cell = { value: c.value, rank: c.rank, rankDis: N + 1 - c.rank };
      if (existing) {
        if (elections[y][n].state !== c.state)
          fail(`irsad-cells ${y} ${n}: state ${c.state} != ${elections[y][n].state}`);
        elections[y][n].irsad = cell;
      } else {
        (elections[y] ||= {})[n] = { state: c.state, irsad: cell, via: provKey };
      }
    }
    if (!existing) console.log(`${y}: ${N} divisions (irsad-only forward block, via ${provKey})`);
  }
  if (forward.join(",") !== "2028")
    fail(`irsad-cells forward flags = ${forward.join(",") || "(none)"}, expected exactly 2028`);
}

/* Percentile layer (2026-10-24 user directive: measured values stay, and
   each cell ALSO carries its within-chamber percentile rank — the only
   cross-census-comparable quantity, since ABS re-derives the indexes per
   census). pct = rankDis/N for EVERY cell every election (rankDis is the
   store convention: 1/N = most disadvantaged, N/N = most advantaged).
   Bracketed-in-time elections (2004/2007/2010 CD-era pending polygons;
   2013/2016/2019 concordance lanes, derive-division-seifa-interp.py) add
   pcti, the census-night-distance interpolation of the two sides' pct —
   div-interp.json's pct0/pct1 must equal THIS store's pct on whichever
   side is the measured one (asserted per cell: 2013's c0, 2016's c1,
   2019's c0 are the measured sides). */
const PCTI = `${SRC_DIR}/div-interp.json`;
const interpOf = {};
const _pcti = {
  method: "pct = rankDis/N per cell (1/N most disadvantaged … N/N most advantaged); " +
          "pcti = (1-f)*pct(c0) + f*pct(c1) on the two bracketing censuses' own " +
          "geometries, f by census-night distance (derive-division-seifa-interp.py; " +
          "c0 side always the measured store row)",
};
{
  const d = JSON.parse(readFileSync(PCTI, "utf8"));
  const factors = d.factors;
  for (const [via, rec] of Object.entries(d._provenance))
    provenance[via] = { title: rec.title, censusYear: null, derivation: "interp lattice",
                        files: rec.files };
  for (const [y, block] of Object.entries(d.elections)) interpOf[y] = block;
  provenance.pcti = {
    title: "Between-census percentile interpolation (derive-division-seifa-interp.py): " +
           "pcti = (1-f)*pct(c0) + f*pct(c1), f by census-night distance (2011-08-09, " +
           "2016-08-09, 2021-08-10); c0 side always the measured store row. CD-era " +
           `elections pending CED polygons: ${JSON.stringify(d._pending.elections)}`,
    censusYear: null,
  };
  _pcti.factors = factors;
  _pcti.pending = d._pending.elections;
}

const MEASURED_SIDE = { 2013: "pct0", 2016: "pct1", 2019: "pct0" };
let pctCells = 0, pctiCells = 0;
for (const [y, block] of Object.entries(elections)) {
  const N = Object.keys(block).length;
  for (const [name, cell] of Object.entries(block)) {
    for (const idx of INDEXES) {
      const idxCell = cell[idx];
      if (!idxCell) continue;
      const rankDis = idx === "irsad" ? idxCell.rankDis : idxCell.rank;
      if (typeof rankDis !== "number" || rankDis < 1 || rankDis > N || !Number.isInteger(rankDis))
        fail(`${y} ${name} ${idx}: rank ${JSON.stringify(rankDis)} outside 1..${N}`);
      idxCell.pct = Math.round((rankDis / N) * 1e6) / 1e6;
      pctCells++;
    }
    const interp = interpOf[y];
    if (!interp) continue;
    const irow = interp[name];
    if (!irow) fail(`${y} ${name}: present in the store but absent from div-interp.json`);
    const sideKey = MEASURED_SIDE[y];
    if (!sideKey) fail(`${y}: interp row exists but no measured-side contract declared`);
    for (const idx of INDEXES) {
      const icell = irow[idx];
      if (!icell) fail(`${y} ${name}: div-interp.json missing ${idx}`);
      if (icell[sideKey] !== cell[idx].pct)
        fail(`${y} ${name} ${idx}: div-interp ${sideKey} ${icell[sideKey]} != store pct ${cell[idx].pct}`);
      cell[idx].pcti = icell.pcti;
    }
    pctiCells++;
  }
}
for (const [y, block] of Object.entries(interpOf)) {
  if (!elections[y]) fail(`div-interp.json offers election ${y} the store lacks`);
  const extra = Object.keys(block).filter((n) => !elections[y][n]);
  if (extra.length) fail(`div-interp.json ${y}: names absent from the store — ${JSON.stringify(extra)}`);
}
console.log(`pct: ${pctCells} index cells; pcti: ${pctiCells} divisions (${Object.keys(interpOf).join(", ")})`);

const YEARS = Object.keys(elections).sort();
const ELECTIONS_SORTED = {};
for (const y of YEARS) ELECTIONS_SORTED[y] = elections[y];
writeFileSync(OUT_STORE, JSON.stringify({ _about: ABOUT, _provenance: provenance, _pcti, elections: ELECTIONS_SORTED }, null, 2) + "\n");
console.log(`wrote ${OUT_STORE}: elections [${YEARS.join(", ")}]`);
