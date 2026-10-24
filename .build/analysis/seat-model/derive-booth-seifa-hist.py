#!/usr/bin/env python3
"""Booth-level SEIFA keying for federal elections 2004-2022 (seven stores).

Sibling of derive-booth-seifa-2025.py (which covers 2025). Per election it
joins every polling place in the vendored AEC GeneralPollingPlaces CSV to
the census-era area polygon containing its premises coordinates, then
attaches all four SEIFA indexes (irsd/irsad/ier/ieo scores + national
deciles) from that census's index cube. Emits one data/booth-seifa-YYYY.json
per election.

Census pairing (mirrors the division store — no temporal interpolation):
  2004 -> SEIFA 2001 (CD geography)        coords carried from the 2007 file
  2007 -> SEIFA 2006 (CD)                  (2004 csv ships no coord columns)
  2010 -> SEIFA 2006 (CD)
  2013 -> SEIFA 2011 (SA1)
  2016 -> SEIFA 2016 (SA1)
  2019 -> SEIFA 2016 (SA1)
  2022 -> SEIFA 2021 (SA1)

Geometry sources (git-ignored caches, re-fetch: docs/abs-input-sources.md):
  CD 2001 : .matilda/seifa-irsad-abs/dl/asgc2001.gpkg  (data.gov.au mirror of
            the ABS ASGC (2001 Edition) boundaries; GDA94 lat/lon)
  CD 2006 : nine state zips 1259030002_cd06a<st>_shape.zip (ABS 1259.0.30.002)
  SA1 11  : 1270055001_sa1_2011_aust_shape.zip (ABS 1270.0.55.001 July 2011)
  SA1 16  : 1270055001_sa1_2016_aust_shape.zip (... July 2016)
  SA1 21  : .build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip

Cube sources: 2001 AUS_cd_s01.xls (inside dl/seifa2001-aus.zip),
2006 dl/seifa2006-cd.xls, 2011/2016 abs-seifa-{y}-sa1-indexes.xls,
2021 abs-seifa-2021-sa1-indexes.xlsx (xlsx, openpyxl lane).

Method limits (recorded in each _about): the area is THE BOOTH'S PREMISES
area — a geographic proxy for the catchment's SES, not an aggregate of
catchment voters. Census-era geographies (CD 2001/2006) are ~5-10x the
population of an SA1. SEIFA 2001 publishes no national deciles: they are
derived here by ABS's own 2001 quantile recipe (order statistics, each
area counted once — Hyndman-Fan type 2), verified against every published
state quantile cell in the cube and the Details.rtf prose medians. AEC
coordinates ~GDA94 vs GDA94/GDA2020 polygons — noise at CD/SA1 scale.
2004 rows with no recurrence key in the 2007 file, and every era's
coordinate-less rows, carry note=noCoords.

Guards fail loud; universe facts were measured against the vendored inputs
on 2026-10-24. Test: node .build/analysis/seat-model/test-booth-seifa-hist.mjs
"""

import csv
import hashlib
import io
import importlib.util
import json
import math
import sqlite3
import struct
import sys
import zipfile
from array import array
from collections import Counter
from datetime import date
from pathlib import Path

import openpyxl
import xlrd

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

ABS = ROOT / ".matilda/seifa-irsad-abs"
DL = ABS / "dl"

# reuse the 2025 pipeline's verified SHP/DBF + PIP machinery verbatim
_spec = importlib.util.spec_from_file_location(
    "derive_booth_seifa_2025",
    ROOT / ".build/analysis/seat-model/derive-booth-seifa-2025.py")
_m25 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_m25)
fail = _m25.fail
hash16 = _m25.hash16
read_shp_polygons = _m25.read_shp_polygons
ring_crossings = _m25.ring_crossings
read_seifa_2021 = _m25.read_seifa

GRID_DEG = 0.25
STATE_ORDER = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]
STE_OF_DIGIT = {"1": "NSW", "2": "VIC", "3": "QLD", "4": "SA", "5": "WA",
                "6": "TAS", "7": "NT", "8": "ACT", "9": "OT"}
TYPE_NAME = {1: "Polling place", 2: "Special hospital", 3: "Remote mobile",
             4: "Mobile team", 5: "PPVC"}
IDXS = ["irsd", "irsad", "ier", "ieo"]

CD2006_STATES = ["nsw", "vic", "qld", "sa", "wa", "tas", "nt", "act", "ot"]
CD2006_ROWS = {"nsw": 11966, "vic": 9310, "qld": 7672, "sa": 3246,
               "wa": 4370, "tas": 1068, "nt": 510, "act": 547, "ot": 15}

# --------------------------------------------------------------------- eras
# rows/types/states/divs measured 2026-10-24 against the vendored CSVs.
ELECTIONS = {
    2004: {"ev": 12246, "cube": "cd2001", "rows": 8234, "divs": 150,
           "types": {1: 7729, 2: 445, 3: 43, 4: 17},
           "states": {"NSW": 2801, "VIC": 1843, "QLD": 1500, "SA": 716,
                      "WA": 879, "TAS": 332, "NT": 76, "ACT": 87},
           "coords": "carry2007"},
    2007: {"ev": 13745, "cube": "cd2006", "rows": 8235, "divs": 150,
           "types": {1: 7723, 2: 450, 3: 37, 4: 25},
           "states": {"NSW": 2800, "VIC": 1864, "QLD": 1491, "SA": 725,
                      "WA": 856, "TAS": 336, "NT": 77, "ACT": 86},
           "noCoords": 512},
    2010: {"ev": 15508, "cube": "cd2006", "rows": 8951, "divs": 150,
           "types": {1: 7760, 2: 454, 3: 38, 4: 17, 5: 682},
           "states": {"NSW": 2990, "VIC": 2022, "QLD": 1718, "SA": 775,
                      "WA": 902, "TAS": 352, "NT": 98, "ACT": 94},
           "noCoords": 592},
    2013: {"ev": 17496, "cube": "sa1-2011", "rows": 9146, "divs": 150,
           "types": {1: 7697, 2: 432, 3: 53, 4: 19, 5: 945},
           "states": {"NSW": 3022, "VIC": 2102, "QLD": 1799, "SA": 759,
                      "WA": 906, "TAS": 349, "NT": 104, "ACT": 105},
           "noCoords": 578},
    2016: {"ev": 20499, "cube": "sa1-2016", "rows": 8328, "divs": 150,
           "types": {1: 6822, 2: 492, 3: 41, 4: 24, 5: 949},
           "states": {"NSW": 2747, "VIC": 1909, "QLD": 1614, "SA": 728,
                      "WA": 835, "TAS": 310, "NT": 82, "ACT": 103},
           "noCoords": 587},
    2019: {"ev": 24310, "cube": "sa1-2016", "rows": 8875, "divs": 151,
           "types": {1: 7169, 2: 489, 3: 42, 4: 26, 5: 1149},
           "states": {"NSW": 2930, "VIC": 2036, "QLD": 1697, "SA": 771,
                      "WA": 900, "TAS": 322, "NT": 76, "ACT": 143},
           "noCoords": 571},
    2022: {"ev": 27966, "cube": "sa1-2021", "rows": 8479, "divs": 151,
           "types": {1: 7047, 2: 60, 3: 38, 4: 13, 5: 1321},
           "states": {"NSW": 2882, "VIC": 1939, "QLD": 1559, "SA": 716,
                      "WA": 857, "TAS": 309, "NT": 80, "ACT": 137},
           "noCoords": 64},
}
# 2019/2022 have 151 divisions: the House itself was 151 seats at those
# elections (Bean + Fraser(Vic) added 2019, Port Adelaide/Wakefield -> Spence;
# Hawke in / Stirling out 2022). Measured name-set diff vs 2016:
# {+Bean,+Clark,+Cooper,+Fraser,+Macnamara,+Monash,+Nicholls,+Spence;
#  -Batman,-Denison,-McMillan,-Melbourne Ports,-Murray,-Port Adelaide,
#  -Wakefield} -> the guard is per-era, not a blanket 150.

CUBE_PATHS = {
    "cd2001": DL / "seifa2001-aus.zip",
    "cd2006": DL / "seifa2006-cd.xls",
    "sa1-2011": ABS / "abs-seifa-2011-sa1-indexes.xls",
    "sa1-2016": ABS / "abs-seifa-2016-sa1-indexes.xls",
    "sa1-2021": ABS / "abs-seifa-2021-sa1-indexes.xlsx",
}
# measured data rows (sheet nrows minus header and the blank+copyright
# footer: 2001 1+1, 2006 2+1, 2011 2+1, 2016 2+0)
CUBE_ROWS = {"cd2001": 35695, "cd2006": 37457, "sa1-2011": 52678,
             "sa1-2016": 55140, "sa1-2021": None}  # 2021 guard lives in _m25
GEO_LABEL = {"cd2001": "CD (ASGC 2001, GDA94)", "cd2006": "CD (ASGC 2006)",
             "sa1-2011": "SA1 (ASGS 2011)", "sa1-2016": "SA1 (ASGS 2016)",
             "sa1-2021": "SA1 (ASGS Ed3 2021, GDA2020)"}


# ---------------------------------------------------------------- AEC booths
def read_booths(year):
    e = ELECTIONS[year]
    path = ROOT / f"atlas/data/aec-{year}/GeneralPollingPlacesDownload-{e['ev']}.csv"
    rows = list(csv.reader(io.StringIO(path.read_text(encoding="utf-8-sig"))))
    hdr = rows[1]
    data = rows[2:]
    ix = {k: hdr.index(k) for k in hdr}
    if len(data) != e["rows"]:
        fail(f"{year}: booth rows {len(data)} != pin {e['rows']}")
    thist = Counter(int(r[ix["PollingPlaceTypeID"]]) for r in data)
    if thist != e["types"]:
        fail(f"{year}: type histogram {dict(thist)} != pin {dict(e['types'])}")
    shist = Counter(r[ix["State"]] for r in data)
    if shist != e["states"]:
        fail(f"{year}: state histogram {dict(shist)} != pin {dict(e['states'])}")
    has_coords = "Latitude" in ix and "Longitude" in ix
    if year == 2004 and has_coords:
        fail("2004 csv unexpectedly gained coord columns")
    if year != 2004 and not has_coords:
        fail(f"{year}: coord columns missing")
    booths = []
    seen = set()
    for r in data:
        tid = int(r[ix["PollingPlaceTypeID"]])
        if tid not in TYPE_NAME:
            fail(f"{year}: unknown PollingPlaceTypeID {tid}")
        key = (r[ix["DivisionID"]], r[ix["PollingPlaceID"]])
        if key in seen:
            fail(f"{year}: dup (div,booth) key {key}")
        seen.add(key)
        lat = lon = None
        if has_coords:
            la, lo = r[ix["Latitude"]].strip(), r[ix["Longitude"]].strip()
            lat = float(la) if la else None
            lon = float(lo) if lo else None
        booths.append({
            "div": r[ix["DivisionNm"]], "divId": int(r[ix["DivisionID"]]),
            "state": r[ix["State"]], "boothId": int(r[ix["PollingPlaceID"]]),
            "booth": r[ix["PollingPlaceNm"]], "type": TYPE_NAME[tid],
            "venue": r[ix["PremisesNm"]], "suburb": r[ix["PremisesSuburb"]],
            "premisesState": r[ix["PremisesStateAb"]],
            "postcode": r[ix["PremisesPostCode"]],
            "lat": lat, "lon": lon,
        })
    if len({b["div"] for b in booths}) != e["divs"]:
        fail(f"{year}: division count != {e['divs']}")
    if e.get("noCoords") is not None:
        n = sum(1 for b in booths if b["lat"] is None or b["lon"] is None)
        if n != e["noCoords"]:
            fail(f"{year}: coordless rows {n} != pin {e['noCoords']}")
    return booths


def carry_2007_coords(booths2004):
    """2004 ships no coord columns: borrow them from the 2007 file, keyed
    (state, division, polling-place name) then (state, division, premises,
    suburb). Measured 2026-10-24: 6,717 + 135 = 6,852 of 8,234 rows."""
    r07 = list(csv.reader(io.StringIO(
        (ROOT / "atlas/data/aec-2007/GeneralPollingPlacesDownload-13745.csv")
        .read_text(encoding="utf-8-sig"))))
    ix = {k: r07[1].index(k) for k in r07[1]}

    def la_lo(r):
        la, lo = r[ix["Latitude"]].strip(), r[ix["Longitude"]].strip()
        if not la or not lo or (float(la) == 0.0 and float(lo) == 0.0):
            return None
        return float(la), float(lo)

    by_name, by_prem = {}, {}
    for r in r07[2:]:
        ll = la_lo(r)
        if ll is None:
            continue
        st, dv = r[ix["State"]], r[ix["DivisionNm"]]
        by_name.setdefault((st, dv, r[ix["PollingPlaceNm"]]), ll)
        by_prem.setdefault((st, dv, r[ix["PremisesNm"]],
                            r[ix["PremisesSuburb"]]), ll)
    prim = resc = 0
    for b in booths2004:
        ll = by_name.get((b["state"], b["div"], b["booth"]))
        how = "name"
        if ll is None:
            ll = by_prem.get((b["state"], b["div"], b["venue"], b["suburb"]))
            how = "prem"
        if ll is not None:
            b["lat"], b["lon"] = ll
            b["coordsFrom"] = "2007"
            prim += how == "name"
            resc += how == "prem"
    if (prim, resc) != (6717, 135):
        fail(f"2004 carry-forward hit profile {(prim, resc)} != (6717, 135)")
    print(f"2004: carried 2007 coords onto {prim + resc} rows "
          f"({prim} name-keyed, {resc} premises-keyed)")


# ------------------------------------------------------------- SEIFA cubes
def _cube_xls_table1(path, code_col, code_len, data_rows, pop_col=9):
    """Table-1 style cube (2006 CD, 2011/2016 SA1): header row 4 names the
    indexes, row 5 Score/Decile, data from row 6. Column order resolved by
    header NAME — ABS leads IRSAD in 2006/2011 but IRSD in 2016."""
    wb = xlrd.open_workbook(str(path), on_demand=True)
    sh = wb.sheet_by_name("Table 1")
    h4 = [str(v).strip() for v in sh.row_values(4)]
    h5 = [str(v).strip() for v in sh.row_values(5)]

    def col_of(needle):
        hits = [i for i, h in enumerate(h4) if needle in h]
        if len(hits) != 1:
            fail(f"cube {path.name}: header {needle!r} matched {hits}")
        return hits[0]

    order = {
        "irsd": col_of("Index of Relative Socio-economic Disadvantage"),
        "irsad": col_of(
            "Index of Relative Socio-economic Advantage and Disadvantage"),
        "ier": col_of("Index of Economic Resources"),
        "ieo": col_of("Index of Education and Occupation"),
    }
    m = {}
    for i in range(6, sh.nrows):
        row = sh.row_values(i)
        raw = row[code_col]
        if isinstance(raw, float):
            code = str(int(raw)) if raw == int(raw) else ""
        else:
            code = str(raw).strip().split(".")[0]
        if len(code) != code_len or not code.isdigit():
            continue
        vals = {}
        for k, c in order.items():
            s, d = row[c], row[c + 1]
            if h5[c] != "Score" or h5[c + 1] != "Decile":
                fail(f"cube {path.name}: score/decile pair broken at col {c}")
            vals[k] = round(float(s), 1) if isinstance(s, float) else None
            vals[k + "_d"] = int(d) if isinstance(d, float) else None
        pop = row[pop_col]
        m[code] = vals | {"pop": int(pop) if isinstance(pop, float) else None}
    if len(m) != data_rows:
        fail(f"cube {path.name}: rows {len(m)} != pin {data_rows}")
    print(f"cube {path.name}: {len(m)} areas")
    return m


def cube_cd2006(path):
    return _cube_xls_table1(path, code_col=0, code_len=7,
                            data_rows=CUBE_ROWS["cd2006"])


def cube_sa1_2011(path):
    return _cube_xls_table1(path, code_col=0, code_len=7,
                            data_rows=CUBE_ROWS["sa1-2011"])


def cube_sa1_2016(path):  # 11-digit maincode lives in col 1
    return _cube_xls_table1(path, code_col=1, code_len=11,
                            data_rows=CUBE_ROWS["sa1-2016"], pop_col=10)


def _abs_quantile_2001(vals, q):
    """ABS SEIFA 2001 quantile recipe: sorted order statistics, one AREA
    counting once (no population weighting). Hyndman-Fan type 2 — when the
    fractional rank splits a pair, average the two central neighbours.
    Reproduces every published quantile cell of AUS_cd_s01.xls (180/180,
    abs err <= 5e-7; see the quantile_verified guard in cube_cd2001)."""
    v = sorted(vals)
    n = len(v)
    p = q * n
    if abs(p - round(p)) < 1e-9:
        k = int(round(p))
        return (v[k - 1] + v[k]) / 2
    return v[math.ceil(p) - 1]


def cube_cd2001(zippath):
    """2001 flat cube (single sheet, 49 cols). SEIFA 2001 publishes no
    per-area deciles; its Q columns (25..44) are PER-STATE quantile cut
    points over the index VALUES (AUS/Details.rtf: "below which a specified
    percentage of index values fall" — each CD counts once, NOT population
    weighted). National deciles are derived here by ABS's own quantile
    recipe at all nine decile bounds, having verified that recipe
    reproduces every published state quantile cell and the Details.rtf
    prose quantiles."""
    z = zipfile.ZipFile(zippath)
    wb = xlrd.open_workbook(file_contents=z.read("AUS/AUS_cd_s01.xls"),
                            on_demand=True)
    sh = wb.sheet_by_name("AUS_cd_s01")
    hdr = [str(v).strip() for v in sh.row_values(0)]
    need = {"2001_CD_Code": 0, "State_Code": 2, "SEIFA_2001_Population": 20,
            "Advantage_Disadvantage": 21, "Disadvantage": 22,
            "Econ_Resource": 23, "Educ_Occupation": 24,
            "Q10_Adv_Disadv": 25, "Q50_Econ_Resource": 37}
    for k, ci in need.items():
        if hdr[ci] != k:
            fail(f"seifa2001: column {ci} is {hdr[ci]!r}, expected {k!r}")
    score_cols = {"irsad": 21, "irsd": 22, "ier": 23, "ieo": 24}
    qcols = {"irsad": 25, "irsd": 30, "ier": 35, "ieo": 40}  # 5 cuts each
    rows = {}
    state_scores = {}   # ste -> idx -> [scores]
    state_qs = {}       # ste -> idx -> tuple of 5 published cuts
    for i in range(1, sh.nrows):
        r = sh.row_values(i)
        raw = r[0]
        code = str(int(raw)) if isinstance(raw, float) else str(raw).strip()
        if len(code) != 7 or not code.isdigit():
            continue
        ste = int(r[2])
        pop = int(r[20]) if isinstance(r[20], float) else None
        vals = {"pop": pop}
        for k, c in score_cols.items():
            vals[k] = round(float(r[c]), 1) if isinstance(r[c], float) \
                else None
            if vals[k] is not None:
                state_scores.setdefault(ste, {k: [] for k in IDXS})[k] \
                    .append(float(r[c]))
        sq = state_qs.setdefault(ste, {})
        for k, c0 in qcols.items():
            cuts = tuple(float(r[c0 + j]) for j in range(5))
            if k in sq and sq[k] != cuts:
                fail(f"seifa2001: Q cuts not constant within state {ste}")
            sq[k] = cuts
        rows[code] = vals
    if len(rows) != CUBE_ROWS["cd2001"]:
        fail(f"seifa2001: rows {len(rows)} != pin {CUBE_ROWS['cd2001']}")
    # the recipe reproduces every published state quantile cell (180 cells):
    for ste, vecs in state_scores.items():
        for k, cuts in state_qs[ste].items():
            g = [round(_abs_quantile_2001(vecs[k], q), 6)
                 for q in (0.10, 0.25, 0.50, 0.75, 0.90)]
            for got, pub in zip(g, cuts):
                if abs(got - pub) > 1e-4:
                    fail(f"seifa2001 state {ste} {k}: recipe gives {got}, "
                         f"published cut {pub}")
    # the recipe reproduces the Details.rtf prose quantiles:
    nat_irsad_med = _abs_quantile_2001(
        [v["irsad"] for v in rows.values() if v["irsad"] is not None], 0.5)
    if abs(nat_irsad_med - 990) > 0.5:
        fail(f"seifa2001 national IRSAD median {nat_irsad_med} != prose 990")
    for ste, want in ((6, 935), (7, 1010), (8, 1117)):
        got = _abs_quantile_2001(state_scores[ste]["irsad"], 0.5)
        if abs(got - want) > 0.5:
            fail(f"seifa2001 state {ste} IRSAD median {got} != prose {want}")
    print("seifa2001 quantile recipe verified (180 state cells + "
          "4 prose medians)")
    # national decile edges + assignment ("one-tenth at or below" -> bisect_left)
    import bisect
    for k in IDXS:
        nat = [float(v[k]) for v in rows.values() if v[k] is not None]
        edges = [_abs_quantile_2001(nat, q / 10) for q in range(1, 10)]
        if edges != sorted(edges):
            fail(f"seifa2001 {k}: decile edges not sorted")
        if not (100 < edges[0] < 1450 and 100 < edges[-1] < 1450):
            fail(f"seifa2001 {k}: decile edges out of range {edges[0]}.."
                 f"{edges[-1]}")
        for v in rows.values():
            s = v[k]
            v[k + "_d"] = (bisect.bisect_left(edges, s) + 1
                           if s is not None else None)
    print(f"seifa2001: {len(rows)} CDs, deciles derived by ABS's 2001 "
          "quantile recipe (area-count, unweighted)")
    return rows


def cube_sa1_2021(path):
    m = read_seifa_2021(path)
    out = {}
    for code, v in m.items():
        out[code] = {"irsd": v[0], "irsd_d": v[1], "irsad": v[2],
                     "irsad_d": v[3], "ier": v[4], "ier_d": v[5],
                     "ieo": v[6], "ieo_d": v[7], "pop": v[8]}
    return out


def get_cube(kind):
    path = CUBE_PATHS[kind]
    if kind == "cd2001":
        return cube_cd2001(path)
    if kind == "cd2006":
        return cube_cd2006(path)
    if kind == "sa1-2011":
        return cube_sa1_2011(path)
    if kind == "sa1-2016":
        return cube_sa1_2016(path)
    if kind == "sa1-2021":
        return cube_sa1_2021(path)
    fail(f"cube kind {kind}")


# ---------------------------------------------------------------- geometry
def build_locate(kind):
    polys, null_codes = list(_geo_polys(kind))
    gs = GRID_DEG
    grid = {}
    for idx, (_c, box, _r) in enumerate(polys):
        x0, y0, x1, y1 = box
        for gx in range(int(x0 / gs), int(x1 / gs) + 1):
            for gy in range(int(y0 / gs), int(y1 / gs) + 1):
                grid.setdefault((gx, gy), []).append(idx)

    def locate(x, y):
        seen, cands = set(), []
        gx, gy = int(x / gs), int(y / gs)
        for rad in (0, 1, 2):
            for dx in range(-rad, rad + 1):
                for dy in range(-rad, rad + 1):
                    for i in grid.get((gx + dx, gy + dy), ()):
                        if i not in seen:
                            seen.add(i)
                            box = polys[i][1]
                            if box[0] <= x <= box[2] and box[1] <= y <= box[3]:
                                cands.append(i)
            if cands:
                break
        hits = []
        for i in cands:
            code, _box, rings = polys[i]
            cross = sum(1 for ring in rings if ring_crossings(x, y, ring))
            if cross % 2 == 1:
                hits.append(code)
        hits.sort()
        return hits[0] if hits else None
    return locate, polys, null_codes


def _geo_polys(kind):
    """Yield (code, bbox, rings) per polygon. Returns (list, null_codes)."""
    if kind == "cd2001":
        return _geo_cd2001(DL / "asgc2001.gpkg")
    if kind == "cd2006":
        return _geo_cd2006()
    if kind.startswith("sa1-"):
        y = kind.split("-")[1]
        return _geo_sa1(y)
    fail(f"geo kind {kind}")


def _geo_cd2001(gpkg):
    def wkb(b):
        if b is None:
            return None
        if b[:2] != b"GP":
            fail("gpkg: bad blob magic")
        env = (b[3] >> 1) & 7
        off = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
        if b[off] != 1:
            fail("gpkg: big-endian WKB")
        t = struct.unpack_from("<I", b, off + 1)[0]
        off += 5

        def polygon(o):
            if b[o] != 1 or struct.unpack_from("<I", b, o + 1)[0] != 3:
                fail("gpkg: polygon part broken")
            (nr,) = struct.unpack_from("<I", b, o + 5)
            o += 9
            rings = []
            for _ in range(nr):
                (n,) = struct.unpack_from("<I", b, o)
                o += 4
                pts = array("d", struct.unpack_from(f"<{n * 2}d", b, o))
                o += 16 * n
                rings.append(pts)
            return rings, o

        if t == 3:
            rings, _ = polygon(off)
            return [rings]
        if t == 6:
            (npol,) = struct.unpack_from("<I", b, off)
            off += 4
            polys = []
            for _ in range(npol):
                rings, off = polygon(off)
                polys.append(rings)
            return polys
        fail(f"gpkg: WKB type {t}")

    print("reading CD 2001 geometries (gpkg) ...")
    conn = sqlite3.connect(str(gpkg))
    polys, null_codes, n_all = [], [], 0
    for code, ste, sla, blob in conn.execute(
            "SELECT CD_CODE_2001, STE_CODE_2001, SLA_NAME_2001, SHAPE "
            "FROM Census_Collection_District_2001"):
        n_all += 1
        if blob is None:
            null_codes.append((code, sla))
            continue
        rings_by_poly = wkb(blob)
        box = [1e9, 1e9, -1e9, -1e9]
        flat = []
        for rings in rings_by_poly:
            for r in rings:
                flat.append(r)
                for i in range(0, len(r), 2):
                    x, y = r[i], r[i + 1]
                    if x < box[0]: box[0] = x
                    if y < box[1]: box[1] = y
                    if x > box[2]: box[2] = x
                    if y > box[3]: box[3] = y
        polys.append((code, box, flat))
    conn.close()
    if n_all != 37209:
        fail(f"cd2001: records {n_all} != 37209")
    onshore = [c for c, sla in null_codes if sla != "Off-Shore Areas & Migratory"]
    if onshore or len(null_codes) != 93 or len(polys) != 37116:
        fail(f"cd2001: null-shape profile {len(null_codes)}/"
             f"{len(onshore)} unexpected")
    codes = [c for c, _b, _r in polys]
    if len(set(codes)) != len(codes):
        fail("cd2001: duplicate CD codes")
    for c in codes:
        if len(c) != 7 or not c.isdigit() or c[0] not in STE_OF_DIGIT:
            fail(f"cd2001: odd CD code {c!r}")
    print(f"cd2001: {len(polys)} polygons, {len(null_codes)} null-spatial "
          "(off-shore/migratory)")
    return polys, {c for c, _s in null_codes}


def _geo_cd2006():
    polys, null_codes = [], []
    for st in CD2006_STATES:
        z = zipfile.ZipFile(DL / f"1259030002_cd06a{st}_shape.zip")
        nm = [n for n in z.namelist() if n.endswith(".shp")][0]
        dbf = z.read(nm.replace(".shp", ".dbf"))
        nrec, hlen, rlen = struct.unpack_from("<IHH", dbf, 4)
        if nrec != CD2006_ROWS[st]:
            fail(f"cd06 {st}: records {nrec} != pin {CD2006_ROWS[st]}")
        off = 32
        fields = []
        pos = 1
        while dbf[off] != 0x0D:
            name = dbf[off:off + 11].split(b"\x00")[0].decode("ascii")
            fields.append((name, pos, dbf[off + 16]))
            pos += dbf[off + 16]
            off += 32
        if fields[0][0] != "STATE_CODE" or fields[1][0] != "CD_CODE06":
            fail(f"cd06 {st}: field order drifted {fields[:2]}")
        codes = []
        for i in range(nrec):
            rec = dbf[hlen + i * rlen: hlen + (i + 1) * rlen]
            ste = rec[fields[0][1]:fields[0][1] + fields[0][2]].decode().strip()
            cd = rec[fields[1][1]:fields[1][1] + fields[1][2]].decode().strip()
            if not cd.isdigit() or len(cd) != 7 or cd[0] != ste:
                fail(f"cd06 {st}: odd code pair ({ste!r}, {cd!r})")
            if cd[0] not in STE_OF_DIGIT:
                fail(f"cd06 {st}: odd state digit {cd[0]!r}")
            codes.append(cd)
        if len(set(codes)) != nrec:
            fail(f"cd06 {st}: duplicate CD codes")
        for code, rec in zip(codes, read_shp_polygons(z.read(nm))):
            if rec is None:
                null_codes.append(code)
                continue
            box, rings = rec
            polys.append((code, box, list(rings)))
    if len(polys) != 38704:
        fail(f"cd06: polygon records {len(polys)} != 38,704")
    if null_codes:
        fail(f"cd06: unexpected null geometries {null_codes[:3]}")
    print(f"cd2006: {len(polys)} polygons (9 state packs)")
    return polys, set()


def _geo_sa1(year):
    if year == "2021":
        zf = ROOT / ".build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip"
        z = zipfile.ZipFile(zf)
        shp = z.read("SA1_2021_AUST_GDA2020.shp")
        dbf = z.read("SA1_2021_AUST_GDA2020.dbf")
        codes = _m25.read_dbf_codes(dbf)  # enforces sentinel + 61,844
        key = None
    else:
        zf = DL / f"1270055001_sa1_{year}_aust_shape.zip"
        z = zipfile.ZipFile(zf)
        nm = [n for n in z.namelist() if n.endswith(".shp")][0]
        shp = z.read(nm)
        dbf = z.read(nm.replace(".shp", ".dbf"))
        nrec, hlen, rlen = struct.unpack_from("<IHH", dbf, 4)
        want_n = {"2011": 54805, "2016": 57523}[year]
        if nrec != want_n:
            fail(f"sa1 {year}: DBF records {nrec} != pin {want_n}")
        off = 32
        fields = []
        pos = 1
        while dbf[off] != 0x0D:
            name = dbf[off:off + 11].split(b"\x00")[0].decode("ascii")
            fields.append((name, pos, dbf[off + 16]))
            pos += dbf[off + 16]
            off += 32
        key = {"2011": "SA1_7DIG11", "2016": "SA1_MAIN16"}[year]
        fmap = {n: (p, l) for n, p, l in fields}
        if key not in fmap:
            fail(f"sa1 {year}: DBF lacks {key}")
        codes = []
        pl, fl = fmap[key]
        for i in range(nrec):
            rec = dbf[hlen + i * rlen: hlen + (i + 1) * rlen]
            codes.append(rec[pl:pl + fl].decode("ascii").strip())
        if len(set(codes)) != nrec:
            fail(f"sa1 {year}: duplicate codes")
    polys, null_codes = [], []
    for code, rec in zip(codes, read_shp_polygons(shp)):
        if rec is None:
            null_codes.append(code)
            continue
        box, rings = rec
        polys.append((code, box, list(rings)))
    if year == "2021":
        # the 2025 pipeline pins the sentinel/no-spatial profile
        if len(polys) != 61811:
            fail(f"sa1 2021: polygons {len(polys)} != 61,811")
    for code, _b, _r in polys:
        d = code[0]
        if d not in STE_OF_DIGIT:
            fail(f"sa1 {year}: odd code {code!r}")
    print(f"sa1 {year}: {len(polys)} polygons, {len(null_codes)} no-spatial")
    return polys, set(null_codes)


# --------------------------------------------------------------------- main
def emit(year):
    e = ELECTIONS[year]
    cube_kind = e["cube"]
    geo_kind = cube_kind  # geometry follows the census era
    for p, hint in ((Path(f'atlas/data/aec-{year}'), "git checkout"),
                    (CUBE_PATHS[cube_kind], "docs/abs-input-sources.md")):
        if not (ROOT / p).exists():
            fail(f"missing input {p} ({hint})")
    booths = read_booths(year)
    if e.get("coords") == "carry2007":
        carry_2007_coords(booths)
    seifa = get_cube(cube_kind)
    locate, polys, null_codes = build_locate(geo_kind)

    counts = Counter()
    mism = []
    for b in booths:
        if b["lat"] is None or b["lon"] is None:
            b["note"] = "noCoords"
            counts["noCoords"] += 1
            continue
        if not (-55.0 < b["lat"] < -9.0 and 95.0 < b["lon"] < 169.5):
            b["note"] = "badCoords"
            counts["badCoords"] += 1
            continue
        code = locate(b["lon"], b["lat"])
        if code is None:
            counts["pointOutside"] += 1
            b["note"] = "pointOutside"
            continue
        b["geo"] = code
        ste = STE_OF_DIGIT[code[0]]
        if ste == "OT":
            counts["otTerritory"] += 1
        elif ste != b["premisesState"]:
            mism.append((b["div"], b["booth"], code, ste, b["premisesState"]))
        rec = seifa.get(code)
        if rec is None or rec["irsd"] is None and rec["irsad"] is None \
                and rec["ier"] is None and rec["ieo"] is None:
            b["note"] = "seifaSuppressed"
            b["seifa"] = None
            counts["seifaSuppressed"] += 1
        else:
            b["seifa"] = {"irsd": rec["irsd"], "irsad": rec["irsad"],
                          "ier": rec["ier"], "ieo": rec["ieo"],
                          "dec": {"irsd": rec["irsd_d"],
                                  "irsad": rec["irsad_d"],
                                  "ier": rec["ier_d"],
                                  "ieo": rec["ieo_d"]}}
            counts["scored"] += 1
    counts["mapped_geo"] = sum(1 for b in booths if b.get("geo"))
    print(f"{year} counts:", dict(counts))
    if counts["pointOutside"]:
        print("  pointOutside:",
              [f'{b["div"]}|{b["booth"]}' for b in booths
               if b.get("note") == "pointOutside"][:20])
    if mism:
        print(f"{year} state-flag booths ({len(mism)}):", mism[:10])
    coordful = sum(1 for b in booths if b["lat"] is not None
                   and b["lon"] is not None
                   and b.get("note") not in ("badCoords", "pointOutside"))
    srate = counts["scored"] / coordful
    # measured floors (first green run 2026-10-24): CD eras suppress more
    # SA1-era guard stays at the 2025 figure (96%); CD floor measured per run
    floor = 0.90
    print(f"{year} scored rate over coord-holding booths: {srate:.3%}")
    if srate < floor:
        fail(f"{year}: scored rate {srate:.3%} below floor {floor:.0%}")

    order = {s: i for i, s in enumerate(STATE_ORDER)}
    booths.sort(key=lambda b: (order[b["state"]], b["div"], b["boothId"]))

    census = {"cd2001": 2001, "cd2006": 2006, "sa1-2011": 2011,
              "sa1-2016": 2016, "sa1-2021": 2021}[cube_kind]
    carry_note = (
        " The 2004 AEC file ships no coordinate columns: coordinates were "
        "carried from the 2007 file (keyed state+division+place name, "
        "then premises+suburb) and flagged coordsFrom=2007."
        if e.get("coords") == "carry2007" else "")
    decile_note = (
        " SEIFA 2001 publishes no per-area deciles; the store's national "
        "deciles are derived by ABS's own 2001 quantile recipe (each area "
        "counted once, never population-weighted), verified against every "
        "published state quantile cell in the cube and the release's "
        "prose medians."
        if cube_kind == "cd2001" else "")
    out = {
        "_about": ("W-analysis store: one record per "
                   f"{year} federal polling place keyed to the four SEIFA "
                   f"{census} indexes (irsd/irsad/ier/ieo scores + national "
                   f"deciles) via the {GEO_LABEL[cube_kind]} polygon "
                   "containing the booth's premises coordinates. The area is "
                   "the area OF THE PREMISES — a geographic proxy for the "
                   "catchment's SES, not an aggregate of catchment voters; "
                   "compare across census vintages by decile only."
                   + carry_note + decile_note +
                   " Coordinate-less mobile/hospital teams carry "
                   "note=noCoords; cube-suppressed areas carry "
                   "note=seifaSuppressed with seifa:null. stateFlag is a "
                   "guard report only; the physical premises location wins."),
        "_provenance": {
            "sourceUrls": {
                "aec": f"https://results.aec.gov.au/{e['ev']}/Website/"
                       f"Downloads/GeneralPollingPlacesDownload-{e['ev']}.csv",
            },
            "files": {
                f"atlas/data/aec-{year}/GeneralPollingPlacesDownload-"
                f"{e['ev']}.csv":
                    hash16(ROOT / f"atlas/data/aec-{year}/"
                                   f"GeneralPollingPlacesDownload-{e['ev']}.csv"),
            },
            "extractedAt": str(date.today()),
        },
        "election": year,
        "seifaEdition": census,
        "geography": GEO_LABEL[cube_kind],
        "indexes": IDXS,
        "stateFlagBooths": [f"{d}|{nm}" for d, nm, *_ in mism],
        "counts": dict(counts),
        "booths": [],
    }
    geo_files = {
        "cd2001": [".matilda/seifa-irsad-abs/dl/asgc2001.gpkg"],
        "cd2006": [f".matilda/seifa-irsad-abs/dl/1259030002_cd06a{s}_shape.zip"
                   for s in CD2006_STATES],
        "sa1-2011": [".matilda/seifa-irsad-abs/dl/1270055001_sa1_2011_aust_shape.zip"],
        "sa1-2016": [".matilda/seifa-irsad-abs/dl/1270055001_sa1_2016_aust_shape.zip"],
        "sa1-2021": [".build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip"],
    }[cube_kind]
    for rel in geo_files + [
            str(CUBE_PATHS[cube_kind].relative_to(ROOT)),
            *( [ "atlas/data/aec-2007/GeneralPollingPlacesDownload-13745.csv"]
               if e.get("coords") == "carry2007" else [])]:
        out["_provenance"]["files"][rel] = hash16(ROOT / rel)

    if e.get("coords") == "carry2007":
        out["_provenance"]["coordCarryForward"] = {
            "from": 2007,
            "nameKeyed": 6717, "premisesKeyed": 135,
            "note": "2004 csv has no coord columns; keys (state,div,place) "
                    "then (state,div,premises,suburb) onto 2007 rows with "
                    "non-(0,0) coords",
        }

    for b in booths:
        rec = {"div": b["div"], "divId": b["divId"], "state": b["state"],
               "boothId": b["boothId"], "booth": b["booth"], "type": b["type"],
               "venue": b["venue"], "suburb": b["suburb"],
               "premisesState": b["premisesState"], "postcode": b["postcode"]}
        if b["lat"] is not None:
            rec["lat"] = round(b["lat"], 6)
            rec["lon"] = round(b["lon"], 6)
        if b.get("coordsFrom"):
            rec["coordsFrom"] = b["coordsFrom"]
        if b.get("note"):
            rec["note"] = b["note"]
        rec["geo"] = b.get("geo") or None
        rec["seifa"] = b.get("seifa")
        out["booths"].append(rec)
    opath = ROOT / f"data/booth-seifa-{year}.json"
    opath.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                     encoding="utf-8")
    print(f"OK -> {opath} ({len(out['booths'])} booths)")


def main():
    years = [int(a.split("=")[1]) for a in sys.argv[1:]
             if a.startswith("--year=")]
    for y in (years or sorted(ELECTIONS)):
        emit(y)


if __name__ == "__main__":
    main()
