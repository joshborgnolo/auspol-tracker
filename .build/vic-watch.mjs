#!/usr/bin/env node
/* Vicpoll watch / backfill — the Victorian poll tracker's data-boundary module.
 *
 * Three jobs, one parsing layer:
 *
 *   --emit-backfill [--wiki-file=PATH] [--csv-file=PATH]
 *     Parse Wikipedia's "Opinion polling for the 2026 Victorian state
 *     election" wikitext (Legislative Assembly tables 2023–2026, the
 *     three-party-preferred table, and every leadership pair table) and the
 *     electiontracker.au polls.csv, merge on firm+end-date, and print the
 *     merged candidate JSON to stdout. Used for the initial data/vicpoll-
 *     polls.json assembly and any re-import; output is INSPECTED by a human
 *     before it lands — this script never writes the data file itself.
 *
 *   --cross-check [--json]
 *     Weekly witness pass (vic-watch.yml): diff data/vicpoll-polls.json
 *     against the same two sources. Exit 2 with machine-readable findings
 *     when a wave or leadership row exists upstream that we lack.
 *
 *   --discovery [--json]
 *     Daily release discovery: Roy Morgan findings feed (RM_LIB helpers),
 *     plus per-house release-page fingerprints in .build/vicpoll-src/
 *     seen.json (committed) for DemosAU, Freshwater, RedBridge/Accent, and
 *     a Bing News RSS scan for Newspoll and Resolve coverage.
 *
 * Wikipedia table anatomy this file must survive (learnt 2026-10-03):
 *  - 2023–2025 tables: 5 primary columns ALP/LNP/GRN/IND/OTH + 2-cell
 *    classic 2PP block. 2026: 6 primary columns (ONP broken out between
 *    GRN and IND) + a 3-cell pairing grid [ALP][LNP][ONP].
 *  - Roy Morgan waves span THREE wikitext rows (rowspan=3 on the ten
 *    leading cells): row 1 = ALP v LNP, row 2 = ALP v ONP, row 3 =
 *    LNP v ONP, unused cells literal {{N/A}} placeholders.
 *  - IND+OTH may be merged as a single colspan="2" cell in 2026 rows.
 *  - Cell values are attribute-tagged ("style=... | 26%"), may carry
 *    named/unnamed refs (harvest canonical URL from cite web url=), bold
 *    '''markup''', {{nowrap}}, <br />-joined split fieldwork ranges, and
 *    month-only dates ("May – Jun").
 *  - Event rows ("Ben Carroll becomes … Premier") are big-colspan rows
 *    with no % values — skipped, not data.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const DATA_FILE = ROOT + "/data/vicpoll-polls.json";
const SEEN_DIR = ROOT + "/.build/vicpoll-src";
const SEEN_FILE = SEEN_DIR + "/seen.json";
const WIKI_PAGE = "Opinion_polling_for_the_2026_Victorian_state_election";
const WIKI_API = `https://en.wikipedia.org/w/api.php?action=parse&page=${WIKI_PAGE}&prop=wikitext&format=json`;
const ET_CSV = "https://electiontracker.au/data/vic2026/polls.csv";
const UA = { "User-Agent": "auspoltracker-vicpoll/1.0 (contact via github)" };

const argv = process.argv.slice(2);
const FLAG = (n) => argv.includes("--" + n);
const ARGV = (n) => { const a = argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : null; };

// ---------- generic fetch -------------------------------------------------
const fetchText = async (url) => {
  const r = await fetch(url, { headers: UA, redirect: "follow" });
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status}`);
  return r.text();
};
const getWiki = async (file) => {
  if (file) return readFileSync(file, "utf8");
  const j = JSON.parse(await fetchText(WIKI_API));
  return j.parse.wikitext["*"];
};
const getCsv = async (file) => {
  if (file) return readFileSync(file, "utf8");
  return fetchText(ET_CSV);
};

// ---------- wikitext cell cleaning ---------------------------------------
const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };

/* Harvest URLs before stripping markup: canonical release link is the first
   cite-web url= / archive-url= / [https… ] that is not the Wayback host. */
const harvestUrls = (cell) => {
  const urls = [];
  for (const m of cell.matchAll(/(?:url|archive-url)\s*=\s*(https?:\/\/[^\s|}]+)|\[(https?:\/\/[^\s\]]+)/g))
    urls.push(m[1] || m[2]);
  return urls.filter((u) => !u.includes("web.archive.org"));
};

const cleanCell = (raw) => {
  let s = raw
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[Nn]\/a\}\}/gi, "")
    .replace(/\{\{n\/a\}\}/gi, "")
    .replace(/\{\{nowrap\|([\s\S]*?)\}\}/gi, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)/g, "$2")
    .replace(/\]\]/g, "")
    .replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/''+/g, "")
    .replace(/\]+$/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return s;
};

/* Split a wikitext cell into {attrs, value}. Only an attribute-looking head
   (starts with a known attribute keyword and contains '=') is attrs — URLs
   and templates can contain '=' so require the keyword at position 0. */
const splitAttrs = (cell) => {
  const m = cell.match(/^((?:rowspan|colspan|style|align|width|class|scope|data-sort-type)[^|]*)\|\s?([\s\S]*)$/i);
  if (m) return cellAttrs(m[1], m[2]);
  /* Malformed cells drop the separator pipe: `rowspan="3" {{n/a}}`
     (and `;`-as-separator variants: `rowspan="2" ; {{n/a}}`). */
  const bare = cell.match(/^((?:rowspan|colspan)="?\d+"?)\s+;?\s*([\s\S]*)$/i);
  if (bare) return cellAttrs(bare[1], bare[2]);
  return { attrs: {}, value: cell };
};
const cellAttrs = (attrTxt, value) => {
  const attrs = {};
  if (/rowspan="?(\d+)/i.test(attrTxt)) attrs.rowspan = +attrTxt.match(/rowspan="?(\d+)/i)[1];
  if (/colspan="?(\d+)/i.test(attrTxt)) attrs.colspan = +attrTxt.match(/colspan="?(\d+)/i)[1];
  return { attrs, value };
};

const pctVal = (s) => {
  if (s == null) return null;
  const m = cleanCell(s).match(/^([<>≈~]*)\s*(-?\d+(?:\.\d+)?)\s*%?\s*$/);
  return m ? +m[2] : null;
};
const numVal = (s) => {
  if (s == null) return null;
  const m = cleanCell(s).replace(/,/g, "").match(/^[≈~]?\s*(\d+(?:\.\d+)?)\s*$/);
  return m ? +m[1] : null;
};

// ---------- date parsing ---------------------------------------------------
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/* "24–28 Sep", "16 Jun - 10 July", "13 Sep", "5 Aug–7 Aug",
   "12–16 Jan & 8–14 Feb", "31 Jul–3 Aug", "May – Jun", "24 Nov – 8 Dec 2025",
   "3 Aug 2026". Returns {start, end, approx}. */
function parseDateLabel(raw, yearDefault) {
  const s = raw.replace(/<br\s*\/?>/gi, " & ").replace(/\s+/g, " ").replace(/–/g, "-").replace(/(\d)-(\d)/g, "$1~$2").trim();
  const yrMatch = s.match(/\b(20\d{2})\b/);
  const year = yrMatch ? +yrMatch[1] : yearDefault;
  const monthRe = Object.keys(MONTHS).join("|");
  const parts = s.split(/\s*&\s*/);
  const segs = [];
  const segRe = new RegExp(`^(?:(\\d{1,2})\\s*(?:\\s*[-~]\\s*)?)?(?:(${monthRe})(?:\\w*)?\\.?\\s*(\\d{4})?\\s*)?(?:[-~]\\s*(\\d{1,2})\\s*)?(?:(${monthRe})(?:\\w*)?\\.?\\s*(\\d{4})?)?$`, "i");
  const altRe = new RegExp(`(${monthRe})`, "ig");
  for (const part of parts) {
    const m = part.trim().match(segRe);
    if (!m || (!m[1] && !m[2] && !m[4])) {
      const months = [...part.matchAll(altRe)].map((x) => MONTHS[x[1].toLowerCase()]);
      const yrs = [...part.matchAll(/\b(20\d{2})\b/g)].map((x) => +x[1]);
      if (months.length === 2) {
        const y1 = yrs[0] || year, y2 = yrs[1] || (months[1] < months[0] ? y1 + 1 : y1);
        segs.push({ start: iso(y1, months[0], 1), end: iso(y2, months[1], daysIn(y2, months[1])), approx: true });
        continue;
      }
      return null;
    }
    let [, d1, m1, y1s, d2, m2, y2s] = m;
    m1 = m1 ? MONTHS[m1.toLowerCase()] : null;
    m2 = m2 ? MONTHS[m2.toLowerCase()] : null;
    const y1 = y1s ? +y1s : year, y2 = y2s ? +y2s : y1;
    const mm = m2 || m1;
    if (!mm) return null;
    const sd = d1 ? +d1 : 1;
    const ed = d2 ? +d2 : (d1 ? +d1 : daysIn(y2, mm));
    segs.push({ start: iso(y1, m1 || mm, sd), end: iso(m1 && m2 && mm < m1 ? y2 + 1 : y2, mm, ed), approx: !(d1 && (d2 || part.trim().match(/^\d{1,2}\s/))) });
  }
  return { start: segs[0].start, end: segs[segs.length - 1].end, approx: segs.some((x) => x.approx) };
}

// ---------- table extraction ----------------------------------------------
const FIRM_IDS = [
  [/newspoll/i, "newspoll"],
  [/roy ?morgan/i, "roymorgan"],
  [/demosau/i, "demosau"],
  [/resolve/i, "resolve"],
  [/fresh ?water|freshwater/i, "freshwater"],
  [/redbridge/i, "redbridge-accent"],
  [/yougov.*mrp/i, "yougov-mrp"],
  [/yougov/i, "yougov"],
  [/ucomms/i, "ucomms"],
  [/spectre/i, "spectre"],
  [/demos au/i, "demosau"],
];
const firmId = (s) => {
  const t = cleanCell(s);
  for (const [re, id] of FIRM_IDS) if (re.test(t)) return id;
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
};

/* Year: table section order is newest first, typically descending. */
const findStubs = (t, beginRe, endRe) => {
  const b = t.search(beginRe);
  if (b < 0) return "";
  const rest = t.slice(b);
  const e = rest.search(endRe);
  return e < 0 ? rest : rest.slice(0, e);
};

/* Rows of a wikitable body: array of {cells:[{attrs?,value}], urls, headerish}.
   Data cells may open with `|` OR `!` (styled cells like `! style=… | 52%`);
   true header chunks are still `!`-only across the row and carry thead words. */
function tableRows(block) {
  const rows = [];
  const chunks = block.split(/^\|-.*$/m);
  for (const chunk of chunks) {
    const cells = [];
    const urls = [];
    const lines = chunk.split("\n");
    let cur = null;
    const flush = () => { if (cur != null && cur.trim() !== "") cells.push(cur.trim()); cur = null; };
    for (const ln of lines) {
      if (/^\s*\|}/.test(ln)) { flush(); continue; }
      if (/^\s*!!/.test(ln)) continue;                       // sub-header splitter line
      const m = ln.match(/^\s*([|!])(.*)$/);
      if (m) {
        const body = m[2];
        if (body.includes("||")) { flush(); for (const p of body.split("||")) cells.push(p.trim()); continue; }
        if (body.includes("!!")) { flush(); for (const p of body.split("!!")) cells.push(p.trim()); continue; }
        flush(); cur = body; continue;
      }
      if (cur != null) cur += "\n" + ln;
    }
    flush();
    if (!cells.length) continue;
    /* Header-keyword test on REF-STRIPPED text: article titles inside <ref>
       citations have said "primary vote" (Herald Sun, Oct 2026) and killed a
       whole data row. Attribute text stays — the keywords live there. */
    const blob = cells.join(" ").replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
    if (/data-sort-type|class=unsortable|Primary vote|2PP vote|polling firm/i.test(blob)) continue;   // header chunk
    for (const c of cells) urls.push(...harvestUrls(c));
    const parsed = cells.map((raw) => { const { attrs, value } = splitAttrs(raw); return { attrs, value }; });
    rows.push({ cells: parsed, urls });
  }
  return rows;
}

/* Walk rows applying rowspan carries: carried[i] = {left, cell}. Rows that
   consumed a carried cell are flagged nested=true — they belong to the wave
   above them (RM/RedBridge pairing rows), never their own wave. */
function applyRowspans(rows) {
  const out = [];
  let carried = [];
  for (const { cells, urls } of rows) {
    const full = [];
    let srcI = 0, usedCarry = false;
    const newCarry = [];
    for (let i = 0; ; i++) {
      const c = carried.find((x) => x.col === i);
      if (c) {
        full.push(c.cell);
        usedCarry = true;
        if (c.left > 1) newCarry.push({ col: i, left: c.left - 1, cell: c.cell });
        continue;
      }
      const src = cells[srcI++];
      if (!src) break;
      full.push(src);
      if (src.attrs.rowspan > 1) newCarry.push({ col: i, left: src.attrs.rowspan - 1, cell: src });
      if (full.length >= 20) break;
    }
    out.push({ cells: full, urls, nested: usedCarry && carried.length > 0 });
    carried = newCarry;
  }
  return out;
}

// ---------- LA voting-intention tables --------------------------------------
function parseLaTables(wt) {
  const sec = findStubs(wt, /^===\s*Legislative Assembly\s*===\s*$/m, /^===\s*Legislative Council\s*===\s*$/m);
  const polls = [], annotations = [];
  const yearRe = /^====\s*(20\d{2})\s*====\s*$/mg;
  const heads = [...sec.matchAll(yearRe)];
  for (let h = 0; h < heads.length; h++) {
    const year = +heads[h][1];
    const seg = sec.slice(heads[h].index, heads[h + 1] ? heads[h + 1].index : sec.length);
    const tb = seg.match(/\{\|[\s\S]*?\n\|\}/);
    if (!tb) continue;
    const rows = applyRowspans(tableRows(tb[0]));
    const cols2026 = year >= 2026;                       // 6 primary + 3 pairing
    /* Primary-block width varies by TABLE, not year: 2023 splits L/NP into
       LIB+NAT (colspan=6 header), 2024–25 merge it (5), 2026 adds ONP (6).
       Read the "Primary vote" header colspan as the width of record. */
    const headM = tb[0].match(/colspan="?(\d+)"?[^|]*\|\s*Primary vote/i);
    const wantCols = headM ? +headM[1] : (cols2026 ? 6 : 5);
    let group = null;                                     // current rowspan group
    for (const { cells, urls, nested } of rows) {
      const vals = cells.map((c) => pctVal(c.value));
      const hasPct = vals.filter((v) => v != null).length;
      const texts = cells.map((c) => cleanCell(c.value));
      if (hasPct <= 1) {                                  // annotation / event row
        if (texts.length <= 3 && texts.join(" ").length > 4) annotations.push({ year, text: texts.join(" ").replace(/\s+/g, " ") });
        continue;
      }
      /* Election-result conclusion rows ("2022 election") are anchors, not
         polls — their figures are the certified result, handled separately. */
      if (/election/i.test(texts.slice(0, 3).join(" "))) continue;
      /* Nested rows consumed a carried cell (RM's 3-row pairing grid,
         RedBridge's extra pairing row): they extend the wave above them. */
      if (nested) {
        if (group) group.pairRows.push(cells.slice(group.pairOff).map((c) => pctVal(c.value)));
        continue;
      }
      /* Leading cells that carry date-like text mark a NEW wave. */
      const dateText = texts[0] && parseDateLabel(texts[0], year) ? texts[0] : null;
      if (dateText) {
        if (group) polls.push(group);
        const dates = parseDateLabel(texts[0], year);
        const clientUrl = [];
        for (const u of urls) clientUrl.push(u);
        const primOff = 4;
        /* Primary block width in PHYSICAL cells: colspan merges (IND+OTH in
           2026, LIB+NAT in 2023) take two logical columns in one cell, so
           count logical span to find the pairing-grid offset. */
        const primCells = [];
        let logical = 0, j = primOff;
        for (; j < cells.length && logical < wantCols; j++) {
          primCells.push(cells[j]);
          logical += cells[j].attrs.colspan || 1;
        }
        const pairOff = j;
        let primaries;
        if (cols2026) {
          const indJoin = !!(primCells[4] && primCells[4].attrs.colspan === 2);
          primaries = {
            alp: pctVal(primCells[0]?.value), lnp: pctVal(primCells[1]?.value),
            grn: pctVal(primCells[2]?.value), onp: pctVal(primCells[3]?.value),
            ind: indJoin ? null : pctVal(primCells[4]?.value),
            oth: pctVal((indJoin ? primCells[4] : primCells[5])?.value),
          };
        } else if (wantCols === 6) {
          /* 2023 layout: L/NP is either a colspan=2 merged cell at [1], or
             LIB and NAT as two separate cells (sum them). */
          const vals = primCells.map((c) => pctVal(c?.value));
          const lnpMerged = (primCells[1]?.attrs.colspan || 1) >= 2;
          const off = lnpMerged ? 0 : 1;
          primaries = {
            alp: vals[0],
            lnp: lnpMerged ? vals[1] : (vals[1] == null && vals[2] == null ? null : (vals[1] || 0) + (vals[2] || 0)),
            grn: vals[2 + off], onp: null,
            ind: vals[3 + off],
            oth: vals[4 + off],
          };
        } else {
          const indJoin = !!(primCells[3] && primCells[3].attrs.colspan === 2);
          primaries = {
            alp: pctVal(primCells[0]?.value), lnp: pctVal(primCells[1]?.value),
            grn: pctVal(primCells[2]?.value), onp: null,
            ind: indJoin ? null : pctVal(primCells[3]?.value),
            oth: pctVal((indJoin ? primCells[3] : primCells[4])?.value),
          };
        }
        const block = cells.slice(pairOff);
        group = {
          firmRaw: texts[1] || "", firm: firmId(texts[1] || ""),
          client: cleanCell(texts[2] || ""),
          sample: numVal(texts[3] || ""),
          dateLabel: texts[0],
          fwStart: dates.start, fwEnd: dates.end, approxDate: dates.approx,
          primary: primaries, year, pairOff,
          pairRows: [block.map((c) => pctVal(c.value))],
          urls: [...urls],
        };
        continue;
      }
    }
    if (group) polls.push(group);
  }
  /* Pairing grid → tpp2 (alp v lnp), alpVOnp, lnpVOnp. Grid cols = [ALP][LNP][ONP]. */
  return polls.map((g) => {
    const tpp2 = {}, alt = {};
    for (const row of g.pairRows) {
      const filled = row.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
      if (g.year >= 2026) {
        if (filled.includes(0) && filled.includes(1) && tpp2.alp == null) tpp2.alp = row[0];
        if (filled.includes(0) && filled.includes(2) && !filled.includes(1) && alt.alpVOnp == null) alt.alpVOnp = row[0];
        if (filled.includes(1) && filled.includes(2) && !filled.includes(0) && alt.lnpVOnp == null) alt.lnpVOnp = row[1];
      } else {
        if (row[0] != null && tpp2.alp == null) tpp2.alp = row[0];
      }
    }
    const { pairRows, pairOff, ...rest } = g;
    return { ...rest, tpp2: tpp2.alp != null ? tpp2 : null, alt };
  });
}

// ---------- three-party-preferred -------------------------------------------
function parse3pp(wt) {
  const sec = findStubs(wt, /^==\s*Three-party-preferred vote\s*==\s*$/m, /^==\s*Leadership polling\s*==\s*$/m);
  if (!sec) return [];
  const tb = sec.match(/\{\|[\s\S]*?\n\|\}/);
  if (!tb) return [];
  const rows = applyRowspans(tableRows(tb[0]));
  const out = [];
  for (const { cells, urls } of rows) {
    const texts = cells.map((c) => cleanCell(c.value));
    const d = parseDateLabel(texts[0] || "", 2026);
    const vals = cells.slice(4, 7).map((c) => pctVal(c.value)).filter((v) => v != null);
    if (!d || vals.length < 3) continue;
    out.push({ dateLabel: texts[0], fwEnd: d.end, firm: firmId(texts[1] || ""), sample: numVal(texts[3] || ""), alp: vals[0], lnp: vals[1], onp: vals[2], urls: [...urls] });
  }
  return out;
}

// ---------- leadership tables -------------------------------------------------
function parseLeadership(wt) {
  const sec = findStubs(wt, /^==\s*Leadership polling\s*==\s*$/m, /^==\s*Sub-state results\s*==\s*$/m);
  if (!sec) return [];
  const out = [];
  const kinds = [
    [/^===\s*Preferred premier\s*===\s*$/m, "preferredPremier"],
    [/^===\s*Leadership approval\s*===\s*$/m, "approval"],
  ];
  for (const [kindRe, series] of kinds) {
    /* The family body runs from its own === heading to the NEXT level-2/3
       heading — /^={2,3}[^=]/ so the level-4 era pair headings inside it
       (====Allan vs Wilson====) pass through instead of clipping the body. */
    const kstart = sec.search(kindRe);
    if (kstart < 0) continue;
    const bodyStart = sec.indexOf("\n", kstart);
    if (bodyStart < 0) continue;
    const tail = sec.slice(bodyStart + 1);
    const kend = tail.search(/^={2,3}[^=]/m);
    const body = kend < 0 ? tail : tail.slice(0, kend);
    const subRe = /^====\s*(.+?)\s*====\s*$/mg;
    const subs = [...body.matchAll(subRe)];
    for (let s = 0; s < subs.length; s++) {
      const pairName = subs[s][1];
      const seg = body.slice(subs[s].index, subs[s + 1] ? subs[s + 1].index : body.length);
      const tb = seg.match(/\{\|[\s\S]*?\n\|\}/);
      if (!tb) continue;
      /* Leader names come from the thead `!` lines ONLY — data rows link the
         polling firm ([[Resolve (poll)|Resolve]] → ghost "resolve" leader). */
      const thead = tb[0].split("\n").filter((l) => l.startsWith("!")).join("\n");
      const leaderNames = [...thead.matchAll(/\[\[(?:[^\]|]*\|)?([A-Z][a-z]+)\]\]/g)].map((m) => m[1]);
      const leaders = [...new Set(leaderNames.map((n) => n.toLowerCase()))];
      const rows = applyRowspans(tableRows(tb[0]));
      for (const { cells, urls } of rows) {
        const texts = cells.map((c) => cleanCell(c.value));
        const d = parseDateLabel(texts[0] || "", 2026);
        if (!d) continue;
        const firm = firmId(texts[1] || "");
        const nums = cells.slice(4).map((c) => {
          const v = cleanCell(c.value);
          const m = v.match(/^([+−-]?\d+(?:\.\d+)?)\s*%?$/);
          return m ? +m[1].replace("−", "-") : null;
        });
        if (nums.every((v) => v == null)) continue;
        /* Column-count guard: a table under the preferred-premier heading must
           carry leaders + DK + net columns; approval must carry 4 per leader.
           A Wikipedia layout rework fails HERE, loudly, instead of silently
           filing the wrong family's figures (the Sep-2026 federal blindness). */
        const wantCols = series === "preferredPremier" ? leaders.length + 2 : leaders.length * 4;
        if (nums.length !== wantCols)
          throw new Error(`vic leadership ${series} ${pairName}: row "${texts[0]}" has ${nums.length} value cols, want ${wantCols}`);
        if (series === "preferredPremier") {
          const values = {};
          leaders.forEach((L, i) => { values[L] = nums[i] ?? null; });
          const dkStart = leaders.length;
          out.push({ series, dateLabel: texts[0], date: d.end, fwStart: d.start, firm, pair: pairName.toLowerCase().replace(/\s+/g, "-"), sample: numVal(texts[3] || ""), values, dk: nums[dkStart] ?? null, net: nums[dkStart + 1] ?? null, urls: [...urls] });
        } else {
          leaders.forEach((L, i) => {
            const b = i * 4;
            if ([nums[b], nums[b + 1], nums[b + 2], nums[b + 3]].every((v) => v == null)) return;
            /* Wiki prints a zero/omitted Net as a bare dash — recover net from
               pos − neg when both are there (48.5/48.5 → 0). */
            const net = nums[b + 3] != null ? nums[b + 3]
              : nums[b] != null && nums[b + 1] != null ? +(nums[b] - nums[b + 1]).toFixed(1) : null;
            out.push({ series, dateLabel: texts[0], date: d.end, fwStart: d.start, firm, pair: pairName.toLowerCase().replace(/\s+/g, "-"), sample: numVal(texts[3] || ""), leader: L, pos: nums[b], neg: nums[b + 1], dk: nums[b + 2], net, urls: [...urls] });
          });
        }
      }
    }
  }
  return out;
}

// ---------- electiontracker CSV ----------------------------------------------
function parseEtCsv(text) {
  const lines = text.trim().split("\n");
  const head = lines[0].split(",");
  const idx = Object.fromEntries(head.map((h, i) => [h.replace(/"/g, ""), i]));
  const rowsOut = [];
  for (const ln of lines.slice(1)) {
    const cells = [];
    for (const m of ln.matchAll(/"([^"]*)"(?:,|$)/g)) cells.push(m[1]);
    if (cells.length < head.length) continue;
    const g = (k) => cells[idx[k]];
    const firm = g("pollster") === "redbridge-accent" ? "redbridge-accent" : firmId(g("pollster"));
    rowsOut.push({
      firm,
      client: g("commissioner"),
      fwStart: g("fieldwork_start"), fwEnd: g("fieldwork_end"),
      sample: +g("sample_size") || null,
      primary: {
        alp: +g("alp") || null, lnp: +g("lnp") || null, grn: +g("grn") || null,
        onp: +g("onp") || null,
        oth: (+g("others")) || null,
      },
      primaryIndOth: +g("others") != null ? +g("others") : null,
      eligible: g("eligible_for_average") === "true",
      sourceUrl: g("source_url"),
    });
  }
  return rowsOut;
}

// ---------- merge ---------------------------------------------------------------
const closeDate = (a, b, slack = 5) => a && b && Math.abs(Date.parse(a) - Date.parse(b)) <= slack * 864e5;

/* A wiki row merges a CSV row when firm matches and the END dates are close.
   Approx wiki dates ("May – Jun") can sit weeks from the CSV fieldwork end —
   widen to 45 days for approx rows, preferring CSV dates after a merge. */
function mergeRows(wikiPolls, csvRows) {
  const merged = wikiPolls.map((w) => {
    const slack = w.approxDate ? 45 : 5;
    const c = csvRows.find((r) => r.firm === w.firm && closeDate(r.fwEnd, w.fwEnd, slack));
    const provenance = c ? ["wikipedia", "electiontracker"] : ["wikipedia"];
    const out = { ...w, provenance, sourceUrl: w.urls.filter(Boolean)[0] || (c ? c.sourceUrl : null) };
    delete out.urls;
    if (c) {
      out.csvSample = c.sample;
      out.csvDates = { start: c.fwStart, end: c.fwEnd };
      if (w.approxDate) { out.fwStart = c.fwStart; out.fwEnd = c.fwEnd; out.approxDate = false; }
      out.sourceUrl = c.sourceUrl || out.sourceUrl;
      /* figure agreement (primaries) — used by cross-check */
      out.figCheck = ["alp", "lnp", "grn", "onp"].map((k) => {
        const wv = w.primary[k], cv = c.primary[k];
        return wv == null || cv == null ? null : Math.abs(wv - cv) <= 1.0;
      });
    }
    return out;
  });
  /* Cross-year waves sit in BOTH the 2024 and 2025 year tables on the page —
     dedupe, keeping the row whose section year matches the fieldwork end. */
  const byKey = new Map();
  for (const w of merged) {
    const k = `${w.firm}|${w.fwStart}|${w.fwEnd}`;
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, w); continue; }
    const endYear = +w.fwEnd.slice(0, 4);
    if (prev.year !== endYear && w.year === endYear) byKey.set(k, w);
  }
  return [...byKey.values()].sort((a, b) => Date.parse(a.fwEnd) - Date.parse(b.fwEnd));
}

// ---------- CLI ----------------------------------------------------------------
const emitBackfill = async () => {
  const wt = await getWiki(ARGV("wiki-file"));
  const csv = await getCsv(ARGV("csv-file"));
  const polls = mergeRows(parseLaTables(wt), parseEtCsv(csv));
  const threeParty = parse3pp(wt).map((r) => ({ ...r, sourceUrl: r.urls.filter(Boolean)[0] || null, urls: undefined }));
  const leadership = parseLeadership(wt).map((r) => ({ ...r, sourceUrl: r.urls.filter(Boolean)[0] || null, urls: undefined }));
  console.log(JSON.stringify({ polls, threeParty, leadership }, null, 2));
};

const crossCheck = async () => {
  const ours = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const wt = await getWiki(ARGV("wiki-file"));
  const csv = await getCsv(ARGV("csv-file"));
  const wikiPolls = parseLaTables(wt);
  const csvRows = parseEtCsv(csv);
  const leaders = parseLeadership(wt);
  const have = new Set(ours.polls.map((p) => `${p.firm}|${p.fwEnd}`));
  const missingPolls = wikiPolls.filter((w) => !have.has(`${w.firm}|${w.fwEnd}`)).map((w) => ({ firm: w.firm, fwEnd: w.fwEnd, pollster: w.firmRaw }));
  const csvMissing = csvRows.filter((c) => !ours.polls.some((p) => p.firm === c.firm && closeDate(p.fwEnd, c.fwEnd))).map((c) => ({ firm: c.firm, fwEnd: c.fwEnd }));
  const haveLead = new Set(ours.leadership.map((l) => `${l.series}|${l.firm}|${l.date}|${l.leader || l.pair}`));
  const missingLead = leaders.filter((l) => !haveLead.has(`${l.series}|${l.firm}|${l.date}|${l.leader || l.pair}`)).map((l) => ({ series: l.series, firm: l.firm, date: l.date }));
  const findings = { missingPolls, csvMissing, missingLead };
  const n = missingPolls.length + csvMissing.length + missingLead.length;
  if (FLAG("json")) console.log(JSON.stringify({ missing: n, ...findings }));
  else {
    console.log(`VIC_CROSSCHECK missing=${n}`);
    if (n) console.log(JSON.stringify(findings, null, 2));
  }
  process.exit(n ? 2 : 0);
};

// ---------- discovery ------------------------------------------------------------
const loadSeen = () => { try { return JSON.parse(readFileSync(SEEN_FILE, "utf8")); } catch { return { pages: {} }; } };
const saveSeen = (s) => { mkdirSync(SEEN_DIR, { recursive: true }); writeFileSync(SEEN_FILE + ".tmp", JSON.stringify(s, null, 2) + "\n"); };

const PAGE_WATCH = [
  { id: "roymorgan", url: "https://www.roymorgan.com/findings", match: /victorian state voting intention/i },
  { id: "demosau", url: "https://demosau.com/news/", match: /victoria|vic /i },
  { id: "freshwater", url: "https://freshwaterstrategy.com/category/insights/", match: /vic(toria(n)?)? /i },
  { id: "redbridge-accent", url: "https://www.accent-research.com/projects", match: /victoria/i },
];

const discovery = async () => {
  const seen = loadSeen();
  const news = [];
  for (const p of PAGE_WATCH) {
    try {
      const html = await fetchText(p.url);
      const titles = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{8,140})<\/a>/g)]
        .map((m) => ({ href: m[1], text: m[2].replace(/\s+/g, " ").trim() }))
        .filter((t) => p.match.test(t.text) && /voting intention|poll|state election|support/i.test(t.text));
      const prev = new Set(seen.pages[p.id] || []);
      const found = titles.map((t) => t.href);
      for (const t of titles) if (!prev.has(t.href)) news.push({ house: p.id, ...t });
      seen.pages[p.id] = [...new Set([...found, ...prev])].slice(0, 60);
    } catch (e) {
      console.error(`WARN discovery ${p.id}: ${e.message}`);
    }
  }
  try {
    const rss = await fetchText("https://www.bing.com/news/search?q=newspoll+OR+resolve+victoria+poll&format=rss");
    for (const m of rss.matchAll(/<item>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?<\/item>/g)) {
      const key = m[2];
      const prev = new Set(seen.pages["bing"] || []);
      if (prev.has(key)) continue;
      if (/victoria/i.test(m[1]) && /poll|newspoll|resolve|voting/i.test(m[1])) news.push({ house: "press", text: m[1], href: m[2], date: m[3] });
      seen.pages["bing"] = [...new Set([key, ...prev])].slice(0, 80);
    }
  } catch (e) {
    console.error(`WARN discovery bing: ${e.message}`);
  }
  if (!FLAG("json") || news.length) console.log(`VIC_WATCH ${JSON.stringify({ newItems: news.length, items: news })}`);
  if (FLAG("json")) console.log(JSON.stringify({ newItems: news.length, items: news }));
  saveSeen(seen);
  const { writeFileSync: w, renameSync: rn } = await import("node:fs");
  rn(SEEN_FILE + ".tmp", SEEN_FILE);
  process.exit(news.length ? 2 : 0);
};

// ---------- main -----------------------------------------------------------------
const main = async () => {
  if (FLAG("emit-backfill")) return emitBackfill();
  if (FLAG("cross-check")) return crossCheck();
  if (FLAG("discovery")) return discovery();
  console.log("usage: vic-watch.mjs --emit-backfill|--cross-check|--discovery [--json] [--wiki-file=PATH] [--csv-file=PATH]");
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
}

export { parseLaTables, parse3pp, parseLeadership, parseEtCsv, parseDateLabel, firmId, mergeRows };
