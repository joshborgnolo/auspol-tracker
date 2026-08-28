/* extract-roymorgan-archive.mjs — ONE-TIME extraction: pull every poll wave and
   election result out of the Roy Morgan pages (saved copies in
   .build/roymorgan-src/*.html) and write two wide CSVs into data/:

     roymorgan-primary-vote.csv        (1901 -> May 2025; ALP/Coalition + splits + minors + undecided)
     roymorgan-two-party-preferred.csv (1901 -> Apr 2025; ALP/L-NP + election-flow variant)

   Sources (fetched 2026-08-28; pages are static):
     primary-lt.html        Primary Voting Intention Long-term Trend (1901-2022) — 9-col long table
     primary-current.html   Primary Voting Intention (2013-2025) — 3 tables: elections 1996-2025 (6-col),
                            "Latest" polls 2022-2025 (9-col with Can't say), "Earlier" polls 2013-2022 (6-col)
     tpp-lt.html            Two Party Preferred Long-term Trend (1901-2022) — 2-col long table
     tpp-current.html       Two Party Preferred (2016-2025) — 4 tables: elections 1996-2025,
                            weekly 2024-25 dual-method, weekly 2022-24 single-method,
                            2016-2022 dual-method (respondent prefs vs 2016/19-flow)

   Conventions:
   - date = period-ending day (RM waves end on the labelled last day), ISO
   - election=1 marks official-election rows; an RM poll wave dated on election day keeps election blank
   - lib/nat: taken from the printed Liberal/National columns where present, else derived from the
     6-col rows' "L-NP (Nat)" parenthetical (lib = coalition - nat); printed-vs-derived disagreements logged
   - "<0.5" and "##" kept as literal transcript strings ("##" = no TPP, pre-preferential voting)
   - "n/a"/"N/A"/empty -> blank cell
   - mode column normalises the (Multi-mode)/(Face : Face)/(Phone)/(SMS ...) label suffixes
   - the 2025-04-27 wave prints a COMBINED Independents & Other Parties figure of 18.5* (includes One
     Nation 7.5% per RM's footnote) in both columns; transcribed verbatim into both cells (flagged in log)

   Known divergences between this archive and data/polls.json (all DELIBERATE —
   the archive is a verbatim RM transcript; polls.json is AEC-authoritative for
   elections and release-sourced for 2025+ waves):
   - election primaries: RM's own election table occasionally departs from AEC —
     2010 L-NP 43.6 / others 6.4 (tracker AEC-based 43.3 / 7.0); 2013 L-NP 45.5
     vs 45.6, others 12.2 vs 12.3; 2016 NXT printed separately (1.9) so others
     9.9 vs tracker's combined 11.8 (same content, different presentation);
     2019 printed to 1dp vs tracker's full AEC precision; 2022 GRN 12.3 vs
     AEC 12.25 (-> tracker 12.2), others 14.1 vs 14.5
   - election TPP: 2016 RM prints 50.3/49.7 (AEC 50.36/49.64 -> tracker 50.4/49.6);
     2025 RM prints 55.3/44.7 (AEC 55.27/44.73 -> tracker 55.2/44.8)
   - boundary wave: archive 2025-05-31 is the SAME four-week wave as tracker's
     2025-06-01 poll (RM release #9901: n=5,128, field period "May 5 - June 1,
     2025"). RM's table label truncates the end date to the month's last day;
     the tracker uses the true Sunday field end. The minor-party split differs
     identifiably too: RM's printed row (Ind 8.5, OtherParties 14.5) does not
     sum to RM's own "Total Others" 32.0; the tracker's split (onp 6 / ind
     14.5, undec 6) comes from the release text and sums to 100.

   Known source quirks kept verbatim (each also warned/noted at runtime):
   - TPP rows not summing to 100: 1996-06-22, 1996-10-10, 1998-09-06 (all 101,
     lt table); 2024-04-14 (102), 2024-07-07 (101), 2023-01-29 (115.8 — an RM
     typo in the weekly table; intended components unverifiable)
   - duplicated row labels in the tpp-current weekly table: "May 14" (2023,
     twice with different values — first 57/43 kept, second was 58.4/41.6) and
     "December 11" (2022, twice — first 56.6/43.4 kept, second 58.5/41.5)
   - cur-latest "Total Others" column != GRN+IND+OTH parts on ~80 rows (RM's
     TotalOthers there is "Others ex-Greens"; not transcribed as a CSV column)
   - 2022-12-04 cur-latest row: components Lib+Nat = 37.5 vs printed Total
     L-NP 33.5 (printed total kept; components unverifiable)
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(HERE, "roymorgan-src");
const OUT_P = path.join(ROOT, "data", "roymorgan-primary-vote.csv");
const OUT_T = path.join(ROOT, "data", "roymorgan-two-party-preferred.csv");
// tpp flow columns: RM labels post-2016 waves with two 2PP variants —
// "how electors say they will vote" (respondent preferences -> alp/coalition, matching
// the lt table's historical convention) and election-flow allocations (-> flow_alp/flow_coalition)

const warnings = [];
const notes = [];
const warn = (m) => warnings.push(m);
const note = (m) => notes.push(m);

// ---------- HTML helpers ----------
function decodeEnts(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function tablesOf(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
}
function rowsOf(tableHtml) {
  return [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) =>
    [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeEnts(c[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
    ),
  );
}

// ---------- value helpers ----------
function cellNum(v, ctx) {
  const s = String(v ?? "").trim().replace(/\*$/, "").replace(/%$/, "").trim().replace(/([\d.]+)(?:%|p)>$/i, "$1");
  // "0.5p>" — markup remnant in one lt cell (one_nation, ~2005-02-27 wave) -> 0.5
  // trailing "%" — the tpp-weekly tables suffix values (e.g. "53.0%")
  if (s === "" || /^n\/?a$/i.test(s)) return "";
  if (s === "##" || s.startsWith("<")) return s; // literal transcript
  const n = Number(s);
  if (Number.isNaN(n)) { warn(`non-numeric "${v}" (${ctx})`); return ""; }
  return String(n);
}
function coalitionAndNat(cell, ctx) {
  // "31.8 (4.0)" -> { coalition: "31.8", natParen: "4.0" }
  const m = String(cell ?? "").trim().match(/^([+-]?[\d.]+|<[\d.]+|##|n\/?a)?\s*(?:\(([\d.]+)\))?$/i);
  if (!m) { warn(`bad L-NP cell "${cell}" (${ctx})`); return { coalition: "", natParen: "" }; }
  const coalition = cellNum(m[1] ?? "", ctx);
  const natParen = m[2] != null ? cellNum(m[2], ctx) : "";
  return { coalition, natParen };
}

// ---------- date parsing ----------
const MONTHS = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9,
  sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};
const MODE_MAP = [
  [/multi-?mode/i, "multi-mode"],
  [/face\s*:\s*face/i, "face"], [/face-to-face/i, "face"], [/^\(?face\)?$/i, "face"],
  [/exit poll/i, "sms"], [/snap sms/i, "sms"], [/^sms/i, "sms"],
  [/phone/i, "phone"],
];
function parseLabel(raw, cursor) {
  // returns { iso, election, mode, year } or null for non-data labels
  let label = String(raw).trim();
  if (!label) return null;
  if (/^(19|20)\d{2}$/.test(label)) return null; // bare year-header row
  const election = /^(\d{4}\s+)?(federal\s+election|election)\b/i.test(label);
  label = label.replace(/^(\d{4}\s+)?federal\s+election[\s,-]*/i, "").replace(/^election[\s,-]*/i, "");
  let mode = "";
  const parens = label.match(/\(([^()]*)\)/g) ?? [];
  for (const p of parens) {
    for (const [re, m] of MODE_MAP) if (re.test(p)) { mode = m; break; }
  }
  // strip annotations: parens, footnote marks, stray text after " - "
  label = label
    .replace(/\([^()]*\)/g, " ")
    .replace(/[\^*#†‡§]/g, " ")
    .replace(/\s+-\s+.*$/, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[a-z]/i.test(label) || !/\d/.test(label)) return null; // annotation-only row

  const yearToks = [...label.matchAll(/(19|20)\d{2}(?!\d{2})/g)].map((m) => +m[0]);
  let year = yearToks.length ? yearToks.at(-1) : cursor.year;
  let s = label.replace(/(19|20)\d{2}(?!\d{2})/g, " ").trim();

  const monthToks = [...s.matchAll(/[A-Za-z]{3,9}\.?/g)]
    .map((m) => ({ idx: m.index, mon: MONTHS[m[0].replace(/\.$/, "").toLowerCase()] }))
    .filter((m) => m.mon);
  if (!monthToks.length || year == null) return null;
  const mon = monthToks.at(-1).mon;
  const tail = s.slice(monthToks.at(-1).idx).replace(/[A-Za-z]{3,9}\.?/g, " ");
  const dayToks = [...tail.matchAll(/\d{1,2}/g)].map((m) => +m[0]).filter((d) => d >= 1 && d <= 31);
  if (!dayToks.length) return null;
  const day = dayToks.at(-1);

  if (yearToks.length) {
    if (year < 1900 || year > 2026) { warn(`year ${year} out of range in "${raw}"`); return null; }
  } else {
    // year-less label (tpp-lt 2004-2008 stretch; primary-lt 1996-2008 stretch between
    // election anchors): infer year by choosing the candidate year whose date is closest
    // to the previous row's date. Rows are ~fortnightly; RM scrambled pockets of the table
    // (e.g. Sept-Nov 2000), so strict-descent comparison corrupts a year at a time — closest-
    // date matching survives both year-boundary wraps and reordered blocks.
    if (cursor.year == null) { warn(`year-less label with no cursor: "${raw}"`); return null; }
    const cands = [year, year - 1].map((y) => toIso(y, mon, day)).filter(Boolean);
    if (!cands.length) return null;
    let best = cands[0], bestDist = Infinity;
    for (const iso of cands) {
      const d = cursor.prev ? Math.abs(Date.parse(iso) - Date.parse(cursor.prev)) : 0;
      // tie-break: prefer the earlier (older) date only when distances are near-equal
      if (d < bestDist - 86400000 || (bestDist === Infinity && d < bestDist)) { best = iso; bestDist = d; }
    }
    if (bestDist > 120 * 86400000) warn(`year inference jump ${(bestDist / 86400000).toFixed(0)}d at "${raw}" -> ${best}`);
    year = +best.slice(0, 4);
  }
  const iso = toIso(year, mon, day);
  if (!iso) return null;
  cursor.year = year;
  cursor.prev = iso;
  return { iso, election, mode, year };
}
function toIso(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) { warn(`bad date ${y}-${m}-${d}`); return null; }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------- row store ----------
const P_COLS = ["alp", "coalition", "lib", "nat", "greens", "one_nation", "nxt", "family_first", "democrats", "independents", "other_parties", "other", "undecided"];
const primary = new Map(); // `${iso}|${elec}|${mode||"-"}` -> {src, mode, lab, cols}
const tpp = new Map();
// first record wins wholesale (never splice columns across sources/sources' variants —
// that would break each row's internal sum); conflicting duplicates are surfaced in warnings
// with both labels so a human can adjudicate; identically-valued reprints are noted quietly.
function put(map, key, rec) {
  if (map.has(key)) {
    const old = map.get(key);
    const diffs = [];
    for (const c of Object.keys(rec.cols)) {
      if (rec.cols[c] === old.cols[c]) continue;
      if (old.cols[c] !== "" && rec.cols[c] !== "") diffs.push(`${c}: ${old.cols[c]} vs ${rec.cols[c]}`);
    }
    if (diffs.length)
      warn(`COLLISION ${key} — kept [${old.src}] "${old.lab}" over [${rec.src}] "${rec.lab}": ${diffs.join("; ")}`);
    return;
  }
  map.set(key, rec);
}
const keyOf = (lab) => `${lab.iso}|${lab.election ? 1 : 0}|${lab.mode || "-"}`;

// ---------- parsers per table ----------
const sources = [];

function parseLtPrimary(rows, srcName) {
  // 9 value cols: ALP L-NP Liberal National Greens FamilyFirst Dems OneNation Other
  const cursor = { year: null, prev: null };
  let n = 0;
  for (const cells of rows) {
    const lab = parseLabel(cells[0] ?? "", cursor);
    if (!lab || !lab.iso) continue;
    if (cells.length < 10) { note(`${srcName}: short row skipped "${cells[0]}"`); continue; }
    const [, alp, lnp, lib, nat, grn, ff, dems, onp, oth] = cells;
    const rec = {
      src: srcName, mode: lab.mode, lab: cells[0],
      cols: {
        alp: cellNum(alp, cells[0]), coalition: cellNum(lnp, cells[0]), lib: cellNum(lib, cells[0]),
        nat: cellNum(nat, cells[0]), greens: cellNum(grn, cells[0]), one_nation: cellNum(onp, cells[0]),
        nxt: "", family_first: cellNum(ff, cells[0]), democrats: cellNum(dems, cells[0]),
        independents: "", other_parties: "", other: cellNum(oth, cells[0]), undecided: "",
      },
    };
    put(primary, keyOf(lab), rec);
    n++;
  }
  note(`${srcName}: ${n} rows parsed`);
}

function parseCurrentElections(rows, srcName) {
  // 6 value cols: ALP L-NP(Nat) Greens OneNation NXT Ind./Others
  for (const cells of rows) {
    const cursor = { year: null, prev: null };
    const lab = parseLabel(cells[0] ?? "", cursor);
    if (!lab || !lab.iso) continue;
    if (cells.length < 7) continue;
    const { coalition, natParen } = coalitionAndNat(cells[2], cells[0]);
    const coalitionN = coalition === "" ? null : Number(coalition);
    const natN = natParen === "" ? null : Number(natParen);
    const lib = coalitionN != null && natN != null ? String(+(coalitionN - natN).toFixed(2)) : "";
    const rec = {
      src: srcName, mode: lab.mode, lab: cells[0],
      cols: {
        alp: cellNum(cells[1], cells[0]), coalition, lib, nat: natParen,
        greens: cellNum(cells[3], cells[0]), one_nation: cellNum(cells[4], cells[0]),
        nxt: cellNum(cells[5], cells[0]), family_first: "", democrats: "",
        independents: "", other_parties: "", other: cellNum(cells[6], cells[0]), undecided: "",
      },
    };
    put(primary, keyOf({ ...lab, election: true }), rec);
  }
}

function parseCurrentLatest(rows, srcName) {
  // 9 value cols: ALP Lib Nat TotalLNP TotalOthers Greens Ind OtherParties CantSay
  const cursor = { year: null, prev: null };
  let headerYear = null, n = 0;
  for (const cells of rows) {
    const label = String(cells[0] ?? "").trim();
    if (cells.length === 1) {
      const y = label.match(/^(19|20)\d{2}$/);
      if (y) headerYear = +label;
      continue;
    }
    if (/^change$/i.test(label)) continue;
    const scoped = { year: headerYear, prev: cursor.prev };
    const lab = parseLabel(label, scoped);
    cursor.prev = scoped.prev ?? cursor.prev;
    if (!lab || !lab.iso) { note(`${srcName}: skipped label "${label}"`); continue; }
    if (cells.length < 10) { note(`${srcName}: short row "${label}"`); continue; }
    const [, alp, lib, nat, tlnp, toth, grn, ind, othp, cant] = cells;
    // even the "May 3 (Federal Election)" row here is an RM poll wave (values differ from
    // the official result, which comes from the elections table) -> always election=0
    const cols = {
      alp: cellNum(alp, label), coalition: cellNum(tlnp, label), lib: cellNum(lib, label),
      nat: cellNum(nat, label), greens: cellNum(grn, label), one_nation: "",
      nxt: "", family_first: "", democrats: "",
      independents: cellNum(ind, label), other_parties: cellNum(othp, label), other: "",
      undecided: cellNum(cant, label),
    };
    if (String(ind).includes("18.5") && String(othp).includes("18.5") && String(label).includes("April 27"))
      warn(`2025-04-27 wave: RM prints combined Ind+OtherParties 18.5 (incl. ONP 7.5) in BOTH cells — transcribed verbatim`);
    if (toth !== "" && grn !== "" && ind !== "" && othp !== "") {
      const sum = +(Number(grn) + Number(ind) + Number(othp)).toFixed(1);
      if (Math.abs(sum - Number(toth)) > 0.51)
        note(`${srcName}: ${lab.iso} TotalOthers ${toth} != GRN+IND+OTH ${sum}`);
    }
    put(primary, keyOf({ ...lab, election: false }), { src: srcName, mode: lab.mode, lab: label, cols });
    n++;
  }
  note(`${srcName}: ${n} poll rows parsed`);
}

function parseCurrentEarlier(rows, srcName) {
  // 6 value cols: ALP L-NP(Nat) Greens OneNation NXT Ind./Others
  const cursor = { year: null, prev: null };
  let n = 0;
  for (const cells of rows) {
    const label = String(cells[0] ?? "").trim();
    if (cells.length < 7) continue; // year headers / annotation rows
    if (/^(19|20)\d{2}$/.test(label)) { cursor.year = +label; continue; } // padded year-header row
    const scoped = { year: cursor.year, prev: cursor.prev };
    const lab = parseLabel(label, scoped);
    cursor.year = scoped.year; cursor.prev = scoped.prev ?? cursor.prev;
    if (!lab || !lab.iso) { note(`${srcName}: skipped label "${label}"`); continue; }
    const { coalition, natParen } = coalitionAndNat(cells[2], label);
    const coalitionN = coalition === "" ? null : Number(coalition);
    const natN = natParen === "" ? null : Number(natParen);
    const lib = coalitionN != null && natN != null ? String(+(coalitionN - natN).toFixed(2)) : "";
    const rec = {
      src: srcName, mode: lab.mode, lab: label,
      cols: {
        alp: cellNum(cells[1], label), coalition, lib, nat: natParen,
        greens: cellNum(cells[3], label), one_nation: cellNum(cells[4], label),
        nxt: cellNum(cells[5], label), family_first: "", democrats: "",
        independents: "", other_parties: "", other: cellNum(cells[6], label), undecided: "",
      },
    };
    put(primary, keyOf(lab), rec);
    n++;
  }
  note(`${srcName}: ${n} poll rows parsed`);
}

function parseLtTpp(rows, srcName) {
  const cursor = { year: null, prev: null };
  let n = 0;
  for (const cells of rows) {
    const scoped = { year: cursor.year, prev: cursor.prev };
    const lab = parseLabel(cells[0] ?? "", scoped);
    cursor.year = scoped.year; cursor.prev = scoped.prev ?? cursor.prev;
    if (!lab || !lab.iso) continue;
    if (cells.length < 3) { note(`${srcName}: short row "${cells[0]}"`); continue; }
    put(tpp, keyOf(lab), {
      src: srcName, mode: lab.mode, lab: cells[0],
      cols: { alp: cellNum(cells[1], cells[0]), coalition: cellNum(cells[2], cells[0]), flow_alp: "", flow_coalition: "" },
    });
    n++;
  }
  note(`${srcName}: ${n} rows parsed`);
}

function parseCurTppElections(rows, srcName) {
  // 2 value cols, order REVERSED vs lt: L-NP, ALP — every row is an election result
  for (const cells of rows) {
    const lab = parseLabel(cells[0] ?? "", { year: null, prev: null });
    if (!lab || !lab.iso) continue;
    if (cells.length < 3) continue;
    put(tpp, keyOf({ ...lab, election: true }), {
      src: srcName, mode: lab.mode, lab: cells[0],
      cols: { alp: cellNum(cells[2], cells[0]), coalition: cellNum(cells[1], cells[0]), flow_alp: "", flow_coalition: "" },
    });
  }
}

function parseCurTppLatest(rows, srcName) {
  // 6 value cols: ALP L-NP MARGIN (respondent preferences) + ALP L-NP MARGIN (2022-election-flow prefs)
  let n = 0;
  for (const cells of rows) {
    const label = String(cells[0] ?? "").trim();
    if (label === "" || /^date$/i.test(label)) continue;
    const lab = parseLabel(label, { year: null, prev: null });
    if (!lab || !lab.iso) { note(`${srcName}: skipped label "${label}"`); continue; }
    if (cells.length < 6) { note(`${srcName}: short row "${label}"`); continue; }
    put(tpp, keyOf({ ...lab, election: false }), {
      src: srcName, mode: lab.mode, lab: label,
      cols: {
        alp: cellNum(cells[1], label), coalition: cellNum(cells[2], label),
        flow_alp: cellNum(cells[4], label), flow_coalition: cellNum(cells[5], label),
      },
    });
    n++;
  }
  note(`${srcName}: ${n} poll rows parsed`);
}

function parseCurTppWeekly(rows, srcName) {
  // 2 value cols: Total ALP TPP, Total L-NP TPP; padded bare-year header rows
  const cursor = { year: null, prev: null };
  let n = 0;
  for (const cells of rows) {
    const label = String(cells[0] ?? "").trim();
    if (/^(19|20)\d{2}$/.test(label)) { cursor.year = +label; continue; }
    if (/^date$/i.test(label)) continue;
    const scoped = { year: cursor.year, prev: cursor.prev };
    const lab = parseLabel(label, scoped);
    cursor.year = scoped.year; cursor.prev = scoped.prev ?? cursor.prev;
    if (!lab || !lab.iso) { note(`${srcName}: skipped label "${label}"`); continue; }
    if (cells.length < 3) { note(`${srcName}: short row "${label}"`); continue; }
    put(tpp, keyOf({ ...lab, election: false }), {
      src: srcName, mode: lab.mode, lab: label,
      cols: { alp: cellNum(cells[1], label), coalition: cellNum(cells[2], label), flow_alp: "", flow_coalition: "" },
    });
    n++;
  }
  note(`${srcName}: ${n} poll rows parsed`);
}

function parseCurTppSplit(rows, srcName) {
  // 4 value cols: L-NP, ALP (respondent/"how electors say") + L-NP, ALP (2016/19-election-flow) —
  // column order REVERSED vs the 2024-25 weekly table; annotation rows have <5 cells
  const cursor = { year: null, prev: null };
  let n = 0;
  for (const cells of rows) {
    const label = String(cells[0] ?? "").trim();
    if (!label || /^(19|20)\d{2}$/.test(label) || /^date$/i.test(label)) continue;
    const scoped = { year: cursor.year, prev: cursor.prev };
    const lab = parseLabel(label, scoped);
    cursor.year = scoped.year; cursor.prev = scoped.prev ?? cursor.prev;
    if (!lab || !lab.iso) { note(`${srcName}: skipped label "${label}"`); continue; }
    if (cells.length < 5) { note(`${srcName}: annotation/short row "${label}"`); continue; }
    put(tpp, keyOf(lab), {
      src: srcName, mode: lab.mode, lab: label,
      cols: {
        alp: cellNum(cells[2], label), coalition: cellNum(cells[1], label),
        flow_alp: cellNum(cells[4], label), flow_coalition: cellNum(cells[3], label),
      },
    });
    n++;
  }
  note(`${srcName}: ${n} rows parsed`);
}

// ---------- run ----------
const ltP = tablesOf(fs.readFileSync(path.join(SRC, "primary-lt.html"), "utf8"));
const curP = tablesOf(fs.readFileSync(path.join(SRC, "primary-current.html"), "utf8"));
const ltT = tablesOf(fs.readFileSync(path.join(SRC, "tpp-lt.html"), "utf8"));
const curT = tablesOf(fs.readFileSync(path.join(SRC, "tpp-current.html"), "utf8"));

// precedence (first parse wins a key): the current page's consolidated "Recent Election
// Results" table is more accurate than the lt page's election rows (checked against AEC:
// e.g. 2001 GRN 4.4 & OTH 9.6 vs lt's 5/4.5; 1996 GRN 1.7 vs 2.9; 2010 OTH 6.4 vs 4.3),
// then the richer 9-col lt table, then the 6-col reprints, then the 2022-2025 weekly table
parseCurrentElections(rowsOf(curP[0]).slice(1), "cur-elections");
parseLtPrimary(rowsOf(ltP[1]).slice(1), "primary-lt");          // row 0 = header
parseCurrentEarlier(rowsOf(curP[2]).slice(1), "cur-earlier");
parseCurrentLatest(rowsOf(curP[1]).slice(1), "cur-latest");
parseLtTpp(rowsOf(ltT[0]).slice(1), "tpp-lt");
// tpp-current: lt wins where they overlap (identical values, silent); current page adds
// 2017-2025 weekly waves and the 2025 election row; cur[1]/[2]/[3] parse whole (self-skipping headers)
parseCurTppElections(rowsOf(curT[0]).slice(1), "cur-tpp-elections");
parseCurTppLatest(rowsOf(curT[1]), "cur-tpp-latest");
parseCurTppWeekly(rowsOf(curT[2]), "cur-tpp-weekly");
parseCurTppSplit(rowsOf(curT[3]), "cur-tpp-2016-22");

// ---------- QA ----------
function check(map, cols, name) {
  let bad = 0;
  for (const [key, r] of map) {
    if (name === "primary" && !/<|##/.test([r.cols.alp, r.cols.coalition].join(","))) {
      const a = Number(r.cols.alp), c = Number(r.cols.coalition);
      if (r.cols.alp !== "" && r.cols.coalition !== "" && (a + c > 100.0001)) {
        warn(`sum>100 primary ${key}: ALP ${a} + LNP ${c}`); bad++;
      }
      if (r.cols.lib !== "" && r.cols.nat !== "" && r.cols.coalition !== "") {
        const s = +(Number(r.cols.lib) + Number(r.cols.nat)).toFixed(2);
        if (Math.abs(s - Number(r.cols.coalition)) > 0.51)
          note(`split-mismatch primary ${key}: LIB+NAT ${s} vs Total L-NP ${r.cols.coalition} (${r.src})`);
      }
    }
    if (name === "tpp") {
      for (const [a, b] of [[r.cols.alp, r.cols.coalition], [r.cols.flow_alp, r.cols.flow_coalition]]) {
        if (a === "" || b === "" || /<|##/.test(a + b)) continue;
        const s = Number(a) + Number(b);
        if (Math.abs(s - 100) > 0.51) { note(`tpp sum ${key}: ${s} (${r.src})`); bad++; }
      }
    }
  }
  return bad;
}
check(primary, P_COLS, "primary");
check(tpp, ["alp", "coalition", "flow_alp", "flow_coalition"], "tpp");

// ---------- write ----------
function csvRows(map, dateCol, cols) {
  const rows = [[dateCol, "election", ...cols, "mode"]];
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, r] of sorted) {
    const [iso, elec] = key.split("|");
    rows.push([iso, elec === "1" ? "1" : "", ...cols.map((c) => r.cols[c]), r.mode]);
  }
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}
fs.writeFileSync(OUT_P, csvRows(primary, "date", P_COLS));
fs.writeFileSync(OUT_T, csvRows(tpp, "date", ["alp", "coalition", "flow_alp", "flow_coalition"]));

const pDates = [...primary.keys()].map((k) => k.split("|")[0]).sort();
const tDates = [...tpp.keys()].map((k) => k.split("|")[0]).sort();
console.log(`primary: ${primary.size} rows (${pDates[0]} .. ${pDates.at(-1)}) -> ${path.relative(ROOT, OUT_P)}`);
console.log(`tpp:     ${tpp.size} rows (${tDates[0]} .. ${tDates.at(-1)}) -> ${path.relative(ROOT, OUT_T)}`);
console.log("\nnotes:\n- " + notes.join("\n- "));
console.log("\nwarnings (" + warnings.length + "):\n- " + warnings.join("\n- "));
