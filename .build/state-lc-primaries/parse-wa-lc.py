#!/usr/bin/env python3
"""WA Legislative Council first-preference counts, 2001-2025.

Sources (all official WAEC, mirrored in .build/state-flow-src/wa/lc/; see
README.md in this folder for the URLs — the catalogue entry for each
State General Election links its result workbooks):
  2001/2005: "sg<year> LC Detailed Results - <region>.xls", Count Summary
             sheet — row "1st Preferences" under per-party header groups
  2008:      "<region>_LCDetailedResults2008.xls" — same shape, plus a
             printed "Formal Votes:" total to guard against
  2013:      "<region>_FirstPrefAnalysis.xls", Region_Summary sheet —
             TOTALS row under per-party Ticket/Pref header pairs
             (Agricultural ships as the identical Agricultural_FirstPrefbyPP.xls)
  2017:      "<region>_LCDetailedResults2017.xlsx" — "First Preferences" row
  2021:      "<region>_FirstPreferences.xlsx" — TOTALS row, Ticket/Pref pairs
  2025:      "Whole_of_State First_Preference_Analysis_Report_by_Candidate
             .xlsx" — TOTALS row, ATL/BTL pairs (the LC's last region-based
             count before the single statewide electorate; guarded against
             the Whole_of_State Calculation Steps report's printed formal)

Party identification: each group is the code the workbook prints ("LIB",
"NATS", "SAP", …) keyed through FAMS as "{code}:{year}" so the same code in
two elections can never be silently conflated (e.g. NAT = the Nationals
since their 2005 re-entry, but *One Nation* (NSW) in 2001; SAP = the
Shooters, Fishers & Farmers in 2013 but the Sustainable Australia Party in
2025). A code with no key for its year is a hard STOP, never a silent
OTHER.

Guards (per region): where the layout prints a Formal Votes / TOTALS-with-
informal figure, the party-vote sum must EQUAL it; every year totals to a
formal that is then guarded against the state's published count where
independent (2025 = the Calculation Steps report's printed figure; 2013
region total = per-region detailed-workbook Formal Votes).

Output: wa.json — {"events": {year: {formal, byParty, byPartyCase, byFamily}}}.

Run from the repo root:  python3 .build/state-lc-primaries/parse-wa-lc.py
(stdlib + xlrd + openpyxl; writes wa.json beside itself)
"""
import glob
import json
import os
import re

import xlrd
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "state-flow-src", "wa", "lc"))
OUT = os.path.join(HERE, "wa.json")

# {code}:{year} -> family. Codes are the workbook's own printed codes
# (year-qualified so a recycled code can never silently mis-map).
_F = {
    "ALP": "ALP",
    "LIB": "COAL", "NAT": "COAL", "NATS": "COAL", "NP": "COAL",  # NP = the Nationals, 2001
    "GRN": "GRN",
    "PHO": "ONP", "PHON": "ONP",
    "ONP": "OTHER",  # 2005: One Nation (WA) — split incarnations, both book OTHER
    "IND": "OTHER", "DEM": "OTHER", "CDP": "OTHER", "CEC": "OTHER",
    "FFP": "OTHER", "FHS": "OTHER", "L4F": "OTHER", "NCO": "OTHER", "PHS": "OTHER",
    "DSP": "OTHER", "ACP": "OTHER", "SFP": "OTHER",  # SFP = SFFP pre-2017
    "AJP": "OTHER", "FFWA": "OTHER", "FLUX": "OTHER", "JMWA": "OTHER",
    "LDP": "OTHER", "MBP": "OTHER", "SA": "OTHER",
    "GAP": "OTHER", "HAP": "OTHER", "LCWA": "OTHER", "LFC": "OTHER",
    "NMV": "OTHER", "SAPSOC": "OTHER", "WAP": "OTHER", "WAXIT": "OTHER",
    "SFFP": "OTHER", "SFF": "OTHER", "AC": "OTHER", "SPPk": "OTHER",
    "Libertarian": "OTHER",
}
KNOWN = {
    "2001": ["ALP", "CDP", "DEM", "GRN", "IND", "LIB", "NP", "PHO"],
    "2005": ["ALP", "CDP", "CEC", "DEM", "FFP", "FHS", "GRN", "IND", "L4F",
             "LIB", "NAT", "NCO", "ONP", "PHS"],
    "2008": ["ALP", "CDP", "CEC", "DSP", "FFP", "GRN", "IND", "LIB", "NAT", "NCO", "ONP"],
    "2013": ["ACP", "ALP", "FFP", "GRN", "IND", "LIB", "NAT", "SFP"],
    "2017": ["ACP", "AJP", "ALP", "DSP", "FFP", "FFWA", "FLUX", "GRN", "IND",
             "JMWA", "LDP", "LIB", "MBP", "NAT", "PHON", "SA", "SFP"],
    "2021": ["ACP", "AJP", "ALP", "DSP", "GAP", "GRN", "HAP", "IND", "LCWA",
             "LDP", "LFC", "LIB", "NAT", "NMV", "PHON", "SA", "SAPSOC",
             "SFFP", "WAP", "WAXIT"],
    "2025": ["AC", "AJP", "ALP", "GRN", "IND", "LCWA", "LIB", "NATS", "PHON",
             "SAP", "SFF", "SPPk", "Libertarian"],
}
# year-specific overrides
FAMS = {f"{k}:{y}": _F[k] for y, codes in KNOWN.items() for k in codes if k in _F}
FAMS["SAP:2025"] = "OTHER"  # Sustainable Australia Party (2025) — SAP in 2013 was S&F

TRAIL_RE = re.compile(r"^(Totals|Formal|Informal|TOTALS|Total Formal)", re.I)


def rows_xls(path, sheet=0):
    wb = xlrd.open_workbook(path)
    sh = wb.sheet_by_index(sheet) if isinstance(sheet, int) else wb.sheet_by_name(sheet)
    return [[sh.cell_value(r, c) for c in range(sh.ncols)] for r in range(sh.nrows)]


def rows_xlsx(path, sheet=0):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sh = wb[wb.sheetnames[sheet] if isinstance(sheet, int) else wb[sheet]]
    out = [list(r) for r in sh.iter_rows(values_only=True)]
    wb.close()
    return out


def group_spans(header_row, cand_row=None):
    """Forward-fill party merges; returns {col: code} for candidate columns.
    The span ends at the first Totals/Formal/Informal label in the party row,
    or — count layouts with interleaved meta columns (2008's status tallies
    between groups) — at `Lost Fractions`/`TOTALS`/`Outcome` in the candidate
    header row, whichever comes first."""
    stop = None
    if cand_row is not None:
        for c, v in enumerate(cand_row):
            h = str(v or "").strip().replace("\xa0", " ")
            if h in ("Lost Fractions", "TOTALS", "Outcome"):
                stop = c
                break
    spans = {}
    cur = None
    for c, v in enumerate(header_row):
        h = str(v or "").strip().replace("\xa0", " ")
        if stop is not None and c >= stop:
            break
        if TRAIL_RE.match(h):
            break
        if h:
            cur = h
        if cur:
            spans[c] = cur
    return spans


def _num(v):
    """A vote figure as a number, or None — the 2013 detailed books store
    numbers as text ('1250'); multi-line progress cells ('0\\n13856'),
    blanks and labels stay None."""
    if isinstance(v, (int, float)):
        return v
    s = str(v).replace(",", "").strip()
    if s.isdigit():
        return int(s)
    return None


def parse_count_sheet(rows, party_row, fp_col0, fp_key, cand_row=None):
    """2001/2005/2008/2013-detailed/2017 count-workbook shape: forward-filled
    party header above candidate headers, the `fp_key` row in column
    `fp_col0`; the row's trailing numeric cell (the TOTALS column) is the
    region's formal-ballot total."""
    spans = group_spans(rows[party_row], rows[cand_row] if cand_row is not None else None)
    formal = None
    fp = None
    for row in rows:
        a0 = str(row[0] or "").replace("\xa0", " ")
        if a0.startswith("Formal Votes:"):
            formal = int(re.sub(r"[^0-9]", "", a0))
        if str(row[fp_col0] or "").strip() == fp_key:
            fp = row
    if fp is None:
        raise SystemExit("no First Preferences row")
    nums = [n for n in (_num(v) for v in fp) if n is not None]
    row_total = nums[-1] if nums else None
    if formal is None:
        formal = row_total
    cand_cols = sorted(c for c in spans if c > fp_col0 + 1 and c < len(fp))
    by_party = {}
    for c in cand_cols:
        v = _num(fp[c])
        if v is None:
            continue
        by_party[spans[c]] = by_party.get(spans[c], 0) + int(v)
    return formal, by_party, row_total


def parse_ticket_pref(rows, party_row, first_col, totals_row):
    """2013/2021/2025 shape: party group = Ticket (or ATL) + Pref(BTL) column
    pairs; grand totals on the row starting 'TOTALS', with
    formal/informal/total riding the last three figures of the row (never
    labelled in the party header — excluded from the spans by position)."""
    spans = group_spans(rows[party_row])
    tot = rows[totals_row]
    num_at = {c: _num(v) for c, v in enumerate(tot)}
    idxs = [c for c, n in num_at.items() if n is not None]
    formal, informal, _grand = (num_at[idxs[-3]], num_at[idxs[-2]],
                                num_at[idxs[-1]])
    csum = sum(n for c, n in num_at.items() if n is not None and c < idxs[-3])
    if round(csum) != round(formal):
        raise SystemExit(f"TOTALS row: candidate cells {csum:,} != "
                         f"formal cell {formal:,}")
    by_party = {}
    for c in sorted(spans):
        if c < first_col or c >= idxs[-3]:
            continue
        v = num_at[c]
        if v is None:
            continue
        by_party[spans[c]] = by_party.get(spans[c], 0) + int(v)
    return formal, by_party


def book(events, year, formal, by_party, region):
    e = events.setdefault(year, {"formal": 0, "byParty": {}})
    e["formal"] += formal
    for p, v in by_party.items():
        e["byParty"][p] = e["byParty"].get(p, 0) + v
    return e


def main():
    events = {}

    # 2001/2005: Count Summary sheet of each region workbook — the fp row's
    # TOTALS cell is the region's formal total (no separate formal row).
    for year in ("2001", "2005"):
        for path in sorted(glob.glob(os.path.join(SRC, f"sg{year}*.xls"))):
            formal, by, total = parse_count_sheet(
                rows_xls(path), 5, 0, "1st Preferences", cand_row=6)
            if formal != sum(by.values()):
                raise SystemExit(f"{path}: parties {sum(by.values()):,} != "
                                 f"TOTALS {total:,}")
            book(events, year, formal, by, os.path.basename(path))

    # 2008: single-sheet detailed workbooks, printed Formal Votes guard.
    for path in sorted(glob.glob(os.path.join(SRC, "*LCDetailedResults2008.xls"))):
        formal, by, _ = parse_count_sheet(
            rows_xls(path), 4, 0, "First Preferences", cand_row=5)
        if formal != sum(by.values()):
            raise SystemExit(f"{path}: parties {sum(by.values()):,} != "
                             f"Formal Votes {formal:,}")
        book(events, "2008", formal, by, os.path.basename(path))

    # 2013: Region_Summary sheet of each FirstPrefAnalysis workbook
    # (Agricultural ships as Agricultural_FirstPrefbyPP.xls, same shape).
    p13 = sorted(glob.glob(os.path.join(SRC, "*FirstPrefAnalysis.xls")))
    p13.append(os.path.join(SRC, "Agricultural_FirstPrefbyPP.xls"))
    if len(p13) != 6:
        raise SystemExit(f"2013: expected 6 region files, got {len(p13)}")
    region_formals = {}
    for path in p13:
        wb = xlrd.open_workbook(path)
        sh_rows = None
        for name in wb.sheet_names():
            if "Region" in name:
                sh_rows = [[wb.sheet_by_name(name).cell_value(r, c)
                            for c in range(wb.sheet_by_name(name).ncols)]
                           for r in range(wb.sheet_by_name(name).nrows)]
                break
        if sh_rows is None:
            raise SystemExit(f"{path}: no Region sheet")
        totals_row = next(i for i, row in enumerate(sh_rows)
                          if str(row[0]).strip() == "TOTALS")
        formal, by = parse_ticket_pref(sh_rows, 1, 2, totals_row)
        book(events, "2013", formal, by, os.path.basename(path))
        region_formals[os.path.basename(path)] = formal
    # 2013 detailed workbooks (a third shape: party row 1, candidates row 2,
    # "First Preferences" row 3, no printed formal cell) — guard each
    # FirstPrefAnalysis region total against the detailed book's fp-row
    # TOTALS cell.
    det13 = glob.glob(os.path.join(SRC, "*LCDetailedResults2013.xls"))
    if len(det13) != 6:
        raise SystemExit(f"2013: expected 6 detailed files, got {len(det13)}")
    for path in det13:
        rows = rows_xls(path, 0)
        _, det_by, det_total = parse_count_sheet(
            rows, 1, 0, "First Preferences", cand_row=2)
        if det_total != sum(det_by.values()):
            raise SystemExit(f"{path}: detailed parties {sum(det_by.values()):,} "
                             f"!= TOTALS {det_total:,}")
        if det_total not in region_formals.values():
            raise SystemExit(f"{path}: detailed total {det_total:,} matches no "
                             f"FirstPrefAnalysis region total")
        region_formals = {k: v for k, v in region_formals.items() if v != det_total}

    # 2017: single-sheet detailed workbooks (row 4 header, First Preferences
    # row at col 0; formal cell at row 9).
    for path in sorted(glob.glob(os.path.join(SRC, "*LCDetailedResults2017.xlsx"))):
        formal, by, _ = parse_count_sheet(
            rows_xlsx(path), 4, 0, "First Preferences", cand_row=5)
        if formal != sum(by.values()):
            raise SystemExit(f"{path}: parties {sum(by.values()):,} != "
                             f"Formal Votes {formal:,}")
        book(events, "2017", formal, by, os.path.basename(path))

    # 2021: <region>_FirstPreferences.xlsx, TOTALS row on the first sheet.
    for path in sorted(glob.glob(os.path.join(SRC, "*FirstPreferences.xlsx"))):
        rows = rows_xlsx(path, 0)
        totals_row = next(i for i, row in enumerate(rows)
                          if str(row[0]).strip() == "TOTALS")
        formal, by = parse_ticket_pref(rows, 1, 2, totals_row)
        book(events, "2021", formal, by, os.path.basename(path))

    # 2025: single whole-of-state workbook, guarded against the Calculation
    # Steps report's printed Formal Votes figure.
    rows = rows_xlsx(os.path.join(
        SRC, "Whole_of_State_First_Preference_Analysis_Report_by_Candidate.xlsx"), 0)
    totals_row = next(i for i, row in enumerate(rows)
                      if str(row[0]).strip() == "TOTALS")
    formal, by = parse_ticket_pref(rows, 2, 2, totals_row)
    calc = rows_xlsx(os.path.join(SRC, "Whole_of_State-Calculation_Steps_Report.xlsx"), 0)
    calc_formal = None
    for row in calc[6:12]:
        a0 = str(row[0] or "").replace("\xa0", " ")
        if a0.startswith("Formal Votes:"):
            calc_formal = int(re.sub(r"[^0-9]", "", a0))
            break
    if calc_formal != formal:
        raise SystemExit(f"2025: analysis formal {formal:,} != calc report "
                         f"{calc_formal:,}")
    book(events, "2025", formal, by, "whole of state")

    for year, e in events.items():
        mapped, unmapped = {}, []
        for code, v in e["byParty"].items():
            fam = FAMS.get(f"{code}:{year}")
            if fam is None:
                unmapped.append(code)
                continue
            mapped[fam] = mapped.get(fam, 0) + v
        if unmapped:
            raise SystemExit(f"{year}: unmapped party codes {unmapped} — "
                             f"add a FAMS key, never silently OTHER")
        by_family = mapped
        for k in ("ALP", "COAL", "GRN", "ONP", "OTHER"):
            by_family.setdefault(k, 0)
        if sum(by_family.values()) != e["formal"]:
            raise SystemExit(f"{year}: family sum mismatch")
        e["byFamily"] = by_family
        print(f"{year}: formal {e['formal']:,}, {len(e['byParty'])} parties")
        for p, v in sorted(e["byParty"].items(), key=lambda kv: -kv[1])[:8]:
            fam = FAMS[f"{p}:{year}"]
            print(f"   {v / e['formal'] * 100:6.2f}%  [{fam}] {p}")
        if by_family["OTHER"] / e["formal"] * 100 >= 20:
            print(f"   NOTE {year}: OTHER is "
                  f"{by_family['OTHER'] / e['formal'] * 100:.1f}% of the vote")

    with open(OUT, "w") as f:
        json.dump({"events": events}, f, indent=1, sort_keys=True)
        f.write("\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
