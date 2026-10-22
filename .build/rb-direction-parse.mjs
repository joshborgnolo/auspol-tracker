// RedBridge/Accent's APC-statement NATIONAL-DIRECTION section parser — reads
// the cached pdftotext of a statement (.build/redbridge-src/<slug>.txt) and
// extracts the "Is Australia heading in the right direction?" tables:
// the all-voters row plus every printed demographic cut, as
// { total:{r,w,u}, dims:{dim:{group:{r,w,u}}}, tables:[n…] }.
//
// Section presence is two-fold (belt and braces):
//   1. the option lines "1. Generally headed in the right direction" /
//      "2. Generally headed in the wrong direction" of the question block;
//   2. a "Table <n>:" caption whose wrapped caption text carries the word
//      "direction" (wordings drift: "…headed in the right or wrong
//      direction…" vs May-2026's "Voters' views on the direction Australia
//      is heading in…"). The caption is never trusted alone — the table's
//      own header stack must carry "headed in the … right direction",
//      "…wrong direction" and "Not sure" (header wraps/truncations ride
//      along: May-2026 prints "Generally headed in the wrong / direction"
//      split over two lines).
// Table NUMBERS are never an anchor — they drift per statement (Nov-2025
// Tables 47–48, Jan-2026 Table 27, May-2026 Table 38).
//
// Failure contract: parseDirectionTables() never throws on layout drift;
// it returns { guard: "<why>" } for anything structurally off (the caller
// treats that as an exit-2 guard trip — never a silent repair, never a
// completed cell). A printed dim header the taxonomy doesn't know, or a
// printed group row it doesn't recognise, is NOT a guard: the dim/row is
// skipped and surfaced via `notes[]` (adopting a new cut is a code change
// here, consciously). A dim that ends up with zero kept rows files nothing.
//
// Row grammar (verbatim figures only): a row is INTENT + label + 2+ spaces
// + int + 2+ spaces + int + 2+ spaces + int. Labels may contain digits and
// commas ("$2,000 to $2,999 per week") but never the double-space run the
// layout puts before the first figure. Group headers are label-only lines
// mapped to dims by DIM_OF_HEADER; "All voters" is the table's total and
// must sit before any group header. Every printed cell sums 100±1 (the
// statements' integer rounding), checked here and again in validate.mjs.
// A bare page-number line (footer) ends the table: every committed
// statement's table completes before its footer, and the next page
// resumes with a col-0 caption or question heading.

export const DIM_OF_HEADER = {
  "Federal vote intention": "vote",
  "Vote softness": "softness",
  "Household income": "income",
  "Home ownership": "ownership",
  "Financial stress": "stress",
  "Generation": "generation",
  "Gender": "gender",
  "Location": "location",
  "Religion": "religion",
  "Education": "education",
  "Language spoken at home": "language",
  "Birthplace": "birthplace",
};

// Known printed rows per dim — a row outside the vocabulary is noted and
// skipped, never banked under an invented label (gen-data surfaces unknown
// vote labels literally, so banking one would leak an unreviewed cut into
// the group select).
export const KNOWN_GROUPS = {
  vote: ["Labor", "Coalition", "Liberal", "CLP/LNP/Nat", "One Nation", "Greens",
    "Other parties and candidates", "Undecided / will not vote"],
  softness: ["Solid", "Soft", "Very soft"],
  income: ["$3,000 or more per week", "$2,000 to $2,999 per week", "$1,000 to $1,999 per week",
    "Less than $1,000 per week", "Prefer not to say"],
  ownership: ["Owned outright", "Owned with a mortgage", "Renting and other"],
  stress: ["A great deal of stress", "Some stress", "Not much stress", "No stress at all"],
  generation: ["Gen-Z", "Millennials", "Gen-X", "Baby Boomers"],
  gender: ["Women", "Men"],
  location: ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"],
  religion: ["Protestant", "Catholic", "Other religions", "No religion"],
  education: ["Less than year 12", "Year 12 or equivalent", "TAFE, trade or vocational", "University degree"],
  language: ["English only", "Other languages"],
  birthplace: ["Australia", "Another country"],
};

const OPT_R = /Generally headed in the right direction/;
const OPT_W = /Generally headed in the wrong direction/;
const QUESTION_HEADING = /Is Australia heading in the right direction\?/;
const CAPTION_RE = /^\s*Table (\d+):/;
const FIGURE_RE = /^\s*Figure \d+:/;
const FOOTER_RE = /^\s*\d+\s*$/;
const ROW_RE = /^\s{2,}(\S(?:.*?\S)?)\s{2,}(\d{1,3})\s{2,}(\d{1,3})\s{2,}(\d{1,3})\s*$/;
const SUM_TOL = 1; // the statements print integers; observed cells sum 100±1

const collapse = (s) => s.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- tables
// Split the text into table blocks keyed on their "Table <n>:" captions.
// The caption block = the caption line plus any immediately-following
// non-blank lines (captions wrap); the first blank line closes it and
// everything after it is table body.
function tableBlocks(lines) {
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    const m = CAPTION_RE.exec(line);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { n: +m[1], caption: [line.replace(/^\s*Table \d+:\s*/, "").trim()], body: [], captionDone: false };
      continue;
    }
    if (!cur) continue;
    if (!cur.captionDone) {
      if (line.trim() === "") cur.captionDone = true;
      else cur.caption.push(line.trim());
      continue;
    }
    cur.body.push(line);
  }
  if (cur) blocks.push(cur);
  return blocks;
}

// One candidate table → rows, or a guard string. Returns
// { allVoters:{r,w,u}, dims:{}, notes:[] } with dims in print order.
function parseRows(block, notes) {
  const body = block.body;
  // the header stack: everything up to the "All voters" row
  const headIdx = body.findIndex((l) => ROW_RE.test(l) && ROW_RE.exec(l)[1] === "All voters");
  if (headIdx < 0)
    return `Table ${block.n}: no "All voters" row after the caption — the header stack or the total row moved`;
  const header = collapse(body.slice(0, headIdx).join(" ")).toLowerCase();
  if (!/headed in the/.test(header) || !/right direction/.test(header) ||
      !/wrong direction/.test(header) || !/not sure/.test(header))
    return `Table ${block.n}: caption names direction but the header stack doesn't read as the right/wrong/not-sure triple`;
  const dims = {};
  let dim = null;
  let allVoters = null;
  for (const l of body.slice(headIdx)) {
    if (CAPTION_RE.test(l) || FIGURE_RE.test(l)) break;
    if (FOOTER_RE.test(l)) break;            // page footer ends the table body
    if (l.trim() === "") continue;
    const m = ROW_RE.exec(l);
    if (m) {
      const [, label, a, b, c] = m;
      const cell = { r: +a, w: +b, u: +c };
      if (Math.abs(cell.r + cell.w + cell.u - 100) > SUM_TOL)
        return `Table ${block.n}: printed row "${label}" sums to ${cell.r + cell.w + cell.u} (beyond 100±${SUM_TOL}) — mis-read columns?`;
      if (label === "All voters") {
        if (allVoters) return `Table ${block.n}: a second "All voters" row`;
        if (dim) return `Table ${block.n}: "All voters" appears inside the "${dim.id ?? "?"}" groups, not at the table's head`;
        allVoters = cell;
        continue;
      }
      if (!dim) return `Table ${block.n}: row "${label}" prints before any group header`;
      if (dim.id == null) continue;          // under an unknown header: noted there
      if (!KNOWN_GROUPS[dim.id].includes(label)) {
        notes.push(`Table ${block.n}: printed row "${label}" (${dim.id}) is not in the known vocabulary — skipped, not banked`);
        continue;
      }
      if (dims[dim.id][label]) return `Table ${block.n}: the row "${label}" prints twice`;
      dims[dim.id][label] = cell;
    } else if (/^\s{2,}\S/.test(l)) {
      const headerLabel = collapse(l);
      if (Object.hasOwn(DIM_OF_HEADER, headerLabel)) {
        const id = DIM_OF_HEADER[headerLabel];
        if (dims[id]) return `Table ${block.n}: the "${id}" groups print twice`;
        dims[id] = {};
        dim = { id };
      } else if (/[a-z]/i.test(headerLabel)) {
        notes.push(`Table ${block.n}: printed group header "${headerLabel}" is not in the dim taxonomy — skipped, not banked`);
        dim = { id: null };                  // rows beneath it are inert
      }
    } else if (/^\S/.test(l) && !/\d/.test(l)) break; // a col-0 heading ends the table
  }
  if (!allVoters) return `Table ${block.n}: no "All voters" figures row parsed`;
  const dimsOut = {};
  for (const [id, rows] of Object.entries(dims))
    if (rows && Object.keys(rows).length) dimsOut[id] = rows;
  return { allVoters, dims: dimsOut, notes };
}

// ---------------------------------------------------------------- the wave
// txt → { section:false } | { guard } | { section:true, tables, total, dims, notes }
export function parseDirectionTables(txt) {
  const notes = [];
  const hasR = OPT_R.test(txt), hasW = OPT_W.test(txt);
  if (!hasR && !hasW) return { section: false, notes };
  if (hasR !== hasW)
    return { guard: "the question's option lines half-printed (right without wrong) — layout change?" };
  if (!QUESTION_HEADING.test(txt))
    notes.push("the option lines print without the question heading — section taken on the options alone");

  const candidates = tableBlocks(txt.split("\n"))
    .map((b) => ({ ...b, captionText: collapse(b.caption.join(" ")) }))
    .filter((b) => /\bdirection\b/i.test(b.captionText) || /\bheading in\b/i.test(b.captionText));
  if (!candidates.length)
    return { guard: "the question section prints but no table caption carries the direction wording — layout change?" };

  let total = null;
  const dims = {};
  const tables = [];
  for (const b of candidates) {
    const got = parseRows(b, notes);
    if (typeof got === "string") return { guard: got };
    tables.push(b.n);
    if (!total) total = got.allVoters;
    else if (total.r !== got.allVoters.r || total.w !== got.allVoters.w || total.u !== got.allVoters.u)
      return { guard: `the direction tables disagree on the all-voters row (${total.r}/${total.w}/${total.u} vs ${got.allVoters.r}/${got.allVoters.w}/${got.allVoters.u} in Table ${b.n})` };
    for (const [id, rows] of Object.entries(got.dims)) {
      if (dims[id]) return { guard: `the "${id}" groups print in more than one table of the wave` };
      dims[id] = rows;
    }
  }
  return { section: true, tables, total, dims, notes };
}
