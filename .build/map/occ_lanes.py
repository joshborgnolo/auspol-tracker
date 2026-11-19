#!/usr/bin/env python3
"""occ_lanes — the Occupation select-lens class system for /map/'s census
People view.

Seven Oesch-style classes keyed from ANZSCO sub-major (2-digit) groups —
the split that follows political cleavages (the GCP's own 1-digit majors
are too coarse, which is why this module exists):

  socprof  Sociocultural professionals       21, 24, 25, 27
  biztech  Corporate professionals/managers  11, 13, 22, 23, 26
  farmer   Farmers                           12
  farmwrk  Farm workers                      84
  hospmgr  Hospitality/retail managers       14
  trades   Tradespeople                      32, 33, 34
  routine  Routine manual workers            71–74, 81–83, 85, 86

The remaining 19 sub-major groups (technicians 31/35/36/39 and the
community-service/clerical/sales non-manuals 41–45, 51–56/59, 61–63) carry
NO class — the user decision of 2026-11-11: class shares are NOT a
partition, they never sum to 100, and no junk residual lane is shown.

SOURCE DATA. The GCP/BCP packs top out at 1-digit occupation (B45B 2011,
G57B 2016, G60B 2021), so the 2-digit counts arrive as manual ABS
TableBuilder exports committed unedited at `.build/map/src/census-occ/`
(provenance JSON beside). One pair per census edition, employed usual
residents aged 15+, occupation at 2-digit level (OCCP 2011–2021, OCC06P
2006 — all three print ANZSCO sub-majors on the canonical 43-code grid) ×
the edition's small areas and × CED (federal frames + the drift anchor):
sa2-2021/ced-2021 (SA2 codes roll into SA1 exactly: the SA2 is the leading
9 digits of its 11-digit SA1 codes), sa2-2016/ced-2016, sa2-2011/ced-2011
and cd-2006/ced-2006 (the 2006 edition reports on collection districts,
the map's own 7-digit unit — no spread needed). TableBuilder's random cell
perturbation is left in the file and NEVER re-normalised against GCP;
class shares are computed inside the export's own stated-occupation basis
(the sum of the 43 sub-major groups — the same basis GCP G60B's blue lane
carries), and a per-edition publication guard compares Σ(43 sub-majors)
plus the major-level nfd cells against the edition's own GCP/BCP stated
total within ±3% (perturbation slack), a HARD fail before assemble. ABS
pseudo-codes and supplementary ("not further defined") output rows never
enter the basis. The small-area→SA1 spread assumes within-area class
homogeneity, weights proportional to each SA1's own GCP/BCP stated-
occupation workers; that is a documented modelling limit, unverified below
the source-area grain.

Small-area to SA1 code joins are edition-native and code-only (the
geography is always a strict subset of the SA1 string, so no join file):
  2021  SA2 = SA1_CODE_2021[:9] (11-digit SA1 codes)
  2016/2011  the 7-digit SA1 code carries the 9-digit SA2's state digit
        plus its trailing 4-digit ordinal — SA1[:5] == SA2[0]+SA2[-4:]
        (SA1 1100701 belongs to SA2 101021007; the SA1 codes are
        nationally unique, so the (state + ordinal) key identifies one
        SA2 — a collision is a hard fail). Verified against every
        committed SA2 row 2026-11-19.
  2006  collection district rows ARE the map's own 7-digit unit
        (identity).

The publication guards are edition-native too — the export is checked
against the edition's own published profile, never a neighbouring
census's:
  2021  ced-2021 v GCP gcp-ced.zip G60B per CED (155 real divisions)
  2016  ced-2016 v GCP gcp-ced-2016.zip G57B per CED
  2011  ced-2011 v BCP bcp-sa1-2011.zip B45B summed SA1→CED through ABS's
        own CED↔SA1 allocation (1270055003_ced_2011_aust_csv.zip; no 2011
        CED-g profile survives on the datapacks endpoint)
  2006  ced-2006 v the committed 2006-BCP CD extracts' B44 majors summed
        to STATES (no CED datapack and no CED-code↔name register survives
        for the edition)

usage: python3 .build/map/occ_lanes.py     # self-test on the testdata fixture
"""
import csv
import hashlib
import json
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SRC = os.path.join(REPO, ".build", "map", "src", "census-occ")

# ---- the canonical 43 ANZSCO sub-major groups (cat. 1220.0) -----------
# Census 2021 OCCP output codes its classified occupations at these exact
# 43 sub-major groups. Transcribed; keys are ints.
SUBMAJORS = {
    11: "Chief Executives, General Managers and Legislators",
    12: "Farmers and Farm Managers",
    13: "Specialist Managers",
    14: "Hospitality, Retail and Service Managers",
    21: "Arts and Media Professionals",
    22: "Business, Human Resource and Marketing Professionals",
    23: "Design, Engineering, Science and Transport Professionals",
    24: "Education Professionals",
    25: "Health Professionals",
    26: "ICT Professionals",
    27: "Legal, Social and Welfare Professionals",
    31: "Engineering, ICT and Science Technicians",
    32: "Automotive and Engineering Trades Workers",
    33: "Construction Trades Workers",
    34: "Electrotechnology and Telecommunications Trades Workers",
    35: "Food Trades Workers",
    36: "Skilled Animal and Horticultural Workers",
    39: "Other Technicians and Trades Workers",
    41: "Health and Welfare Support Workers",
    42: "Carers and Aides",
    43: "Hospitality Workers",
    44: "Protective Service Workers",
    45: "Sports and Personal Service Workers",
    51: "Office Managers and Program Administrators",
    52: "Personal Assistants and Secretaries",
    53: "General Clerical Workers",
    54: "Inquiry Clerks and Receptionists",
    55: "Numerical Clerks",
    56: "Clerical and Office Support Workers",
    59: "Other Clerical and Administrative Workers",
    61: "Sales Representatives and Agents",
    62: "Sales Assistants and Salespersons",
    63: "Sales Support Workers",
    71: "Machine and Stationary Plant Operators",
    72: "Mobile Plant Operators",
    73: "Road and Rail Drivers",
    74: "Storepersons",
    81: "Cleaners and Laundry Workers",
    82: "Construction and Mining Labourers",
    83: "Factory Process Workers",
    84: "Farm, Forestry and Garden Workers",
    85: "Food Preparation Assistants",
    89: "Other Labourers",
}

# ---- the seven classes (menu order) -----------------------------------
OCC_CLASSES = {
    "socprof": {"title": "Sociocultural professionals", "codes": (21, 24, 25, 27)},
    "biztech": {"title": "Business & technical professionals and managers", "codes": (11, 13, 22, 23, 26)},
    "farmer": {"title": "Farmers", "codes": (12,)},
    "farmwrk": {"title": "Farm workers", "codes": (84,)},
    "hospmgr": {"title": "Hospitality, retail & service managers", "codes": (14,)},
    "trades": {"title": "Tradespeople", "codes": (32, 33, 34)},
    "routine": {"title": "Routine manual workers", "codes": (71, 72, 73, 74, 81, 82, 83, 85, 89)},
}
OCC_KEYS = list(OCC_CLASSES)
OCC_RESIDUAL = (31, 35, 36, 39, 41, 42, 43, 44, 45,
                51, 52, 53, 54, 55, 56, 59, 61, 62, 63)

_CLASS_BY_CODE = {}
for _k, _v in OCC_CLASSES.items():
    for _c in _v["codes"]:
        if _c in _CLASS_BY_CODE:
            raise SystemExit(f"occ_lanes: sub-major {_c} in two classes")
        _CLASS_BY_CODE[_c] = _k
if set(_CLASS_BY_CODE) | set(OCC_RESIDUAL) != set(SUBMAJORS):
    raise SystemExit("occ_lanes: classes + residual do not cover the 43 sub-major groups")
if len(SUBMAJORS) != 43:
    raise SystemExit("occ_lanes: sub-major table drifted off 43")

# ABS supplementary output codes shipped beside the 43 real groups (the
# 2021 valueset at src/census-occ/occp-valueset-2021.csv carries them
# verbatim): two-digit nfd placeholders ("10 Managers, nfd" .. "80
# Labourers, nfd"), 09 Inadequately described, and the wordy &&/@@
# placeholders. They fold OUT of the basis, never into a class; an
# unrecognised code hard-fails instead — a shifted spreadsheet needs eyes.
_CODE_RE = re.compile(r"^\s*[\"']?(\d{2,6})")
_CED_RE = re.compile(r"(?i)\bCED\s*(\d{3})\b")
_CED07_RE = re.compile(r"(?i)\bCED07(\d{3})\b")
_SA2_RE = re.compile(r"(?<!\d)(\d{9})(?!\d)")
_CD_RE = re.compile(r"(?<!\d)(\d{7})(?!\d)")

# the committed exports' census era by file stem (testdata/toy.csv and any
# caller-supplied path default to the 2021 code scheme, which the toy
# fixture's 11-digit SA1s and CED101 rows also read)
EXPORT_ERA = {
    "sa2-2021": "2021", "ced-2021": "2021",
    "sa2-2016": "2016", "ced-2016": "2016",
    "sa2-2011": "2011", "ced-2011": "2011",
    "cd-2006": "2006", "ced-2006": "2006",
}


def _fail(msg):
    raise SystemExit(f"OCC_LANES FAIL: {msg}")


def _fold_code(raw):
    """Classify one TableBuilder header label's numeric code.

    Returns (submajor:int|None, fold_out:bool). Any code whose leading
    2-digit prefix is a real sub-major group folds to that parent (3–6
    digit detail levels come along free); ABS supplementary cells fold out
    of the basis via fold_out=True; anything else is a hard fail."""
    s = str(raw).strip()
    m = _CODE_RE.match(s)
    if not m:
        return None, True            # wordy cell (geography, "&&"/"@@" placeholders)
    body = m.group(1)
    digits = int(body)
    if digits == 0:
        return None, True            # 0000-style placeholders
    sub = int(body[:2])
    if sub in SUBMAJORS:
        return sub, False
    if sub % 10 == 0 or sub == 9 or sub >= 90 or digits >= 900:
        return None, True            # nfd / 09 inadequately-described / supplementary
    _fail(f"unrecognised ANZSCO code {body!r} in header")


def _fold_lax(raw):
    """Lenient sibling of _fold_code for header DETECTION only: data rows
    under a candidate header can carry anything (counts, totals), so an
    unrecognised code means the row isn't a header — never a fatal."""
    try:
        sub, _ = _fold_code(raw)
        return sub
    except SystemExit:
        return None


def _geo_of(rowcells):
    """Pick the row's geography id out of its first few cells. The
    2006-edition codes fold onto the shared shapes: CED07### (Commonwealth
    Electoral Division 2007) normalises to the same CED### key the newer
    editions print, and bare 7-digit collection-district codes ride the
    CD_RE arm (no edition mixes shapes inside one file)."""
    for cell in rowcells:
        t = str(cell).strip()
        m = _CED07_RE.search(t)
        if m:
            return "CED" + m.group(1)
        m = _CED_RE.search(t)
        if m:
            return "CED" + m.group(1)
        m = _SA2_RE.search(t)
        if m:
            return m.group(1)
        m = _CD_RE.search(t)
        if m:
            return m.group(1)
    return None


def parse_tb_csv(path):
    """Read one TableBuilder export at `path` (the committed source CSV).

    Returns {geo: {class: count, "stated": n}}; class columns are the seven
    lattice classes with counts summed from the export's printed sub-major
    (or finer) columns, and "stated" the Σ(43 sub-majors) basis the shares
    divide by. Header columns resolve through _fold_code; supplementary
    columns carry -1 and are skipped; the file's own printed totals are
    never trusted as the basis.
    """
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = [r for r in csv.reader(f) if any(str(c).strip() for c in r)]
    if not rows:
        _fail(f"{path}: empty file")
    # header row = the row carrying the most recognised sub-major codes
    # (detect leniently; the winner is then folded STRICTLY)
    best_i, best_map, best_n = None, None, -1
    for i, row in enumerate(rows[:40]):
        cols = {j: s for j, cell in enumerate(row)
                for s in [_fold_lax(cell)] if s is not None}
        n = len(cols)
        if n > best_n:
            best_i, best_map, best_n = i, cols, n
    if best_i is None or best_n < 20:
        _fail(f"{path}: no header row with ≥20 recognisable sub-major "
              f"codes; is this really the 2-digit OCCP export? (compare "
              f"layouts against .build/map/src/census-occ/testdata/toy.csv)")
    col_sub = {j: s for j, s in best_map.items() if s >= 0}
    out = {}
    for row in rows[best_i + 1:]:
        geo = _geo_of(row[:5])
        if geo is None:
            continue
        if geo in out:
            _fail(f"{path}: geography {geo} appears twice")
        counts = {k: 0 for k in OCC_KEYS}
        stated = 0
        for j, sub in col_sub.items():
            raw = row[j] if j < len(row) else ""
            try:
                v = int(float(str(raw).replace(",", "") or 0))
            except ValueError:
                _fail(f"{path} {geo} col {j}: {raw!r} is not a count")
            if v < 0:
                _fail(f"{path} {geo} col {j}: negative count {v}")
            key = _CLASS_BY_CODE.get(sub)
            if key:
                counts[key] += v
            stated += v
        if stated <= 0:
            continue
        counts["stated"] = stated
        out[geo] = counts
    if not out:
        _fail(f"{path}: no data rows resolved to a CED/SA2 geography")
    return out


def sha16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def check_valueset(path=None):
    """Benchmark SUBMAJORS against ABS's own OCCP valueset at
    src/census-occ/occp-valueset-2021.csv (the FactTable metadata download
    the module's table was corrected to: 2026-11-11 — code 89 "Other
    Labourers" (never 86), 36's census-output title, every supplementary
    output row). Fails on any set or title drift; nothing about the
    2021-era OCCP output may change without touching ABS's own file."""
    p = path or os.path.join(SRC, "occp-valueset-2021.csv")
    with open(p, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    vals = {r["ValueCode"].strip(): r["ValueName"].strip()
            for r in rows
            if r.get("GroupName", "").strip() == "2021 2-digit occupations"}
    real_codes = set()
    for code_s, name in vals.items():
        if code_s.isdigit() and int(code_s) in SUBMAJORS:
            real_codes.add(int(code_s))
            if name != SUBMAJORS[int(code_s)]:
                _fail(f"valueset {code_s}: ABS titles it {name!r} vs "
                      f"{SUBMAJORS[int(code_s)]!r} in SUBMAJORS")
    if real_codes != set(SUBMAJORS):
        _fail(f"valueset real-code set {sorted(real_codes)} != SUBMAJORS")
    supp = set(vals) - {str(c) for c in SUBMAJORS}
    want_supp = {f"{m}0" for m in range(1, 9)} | {"09", "&&", "@@"}
    if supp != want_supp:
        _fail(f"valueset supplementary rows drifted: {sorted(supp)} "
              f"!= {sorted(want_supp)} documented ones")
    return True


def load_occ(name, path=None):
    """load_occ("sa2-2021") → (counts, provenance) for the committed
    source at .build/map/src/census-occ/<name>.csv (+ <name>.json)."""
    p = path or os.path.join(SRC, f"{name}.csv")
    if not os.path.exists(p):
        _fail(f"no source CSV at {p}; the TableBuilder export (plan Phase "
              f"B1) hasn't landed — see .build/map/src/census-occ/README.md")
    counts = parse_tb_csv(p)
    provp = p.replace(".csv", ".json")
    prov = json.load(open(provp)) if os.path.exists(provp) else {}
    return counts, {"file": os.path.relpath(p, REPO), "sha16": sha16(p),
                    "geos": len(counts), **prov}


def spread_to_sa1(sa2_counts, sa1_stated):
    """Spread SA2-level class counts onto SA1s proportionally to each
    SA1's own G60B stated-occupation workers (`sa1_stated`, from
    gcp_newlanes.demo_base's occ8 sum). Allocation inherits the parent
    SA2's class mix (the documented within-SA2 homogeneity assumption) and
    conserves every SA2's totals: SA2 codes are the first 9 digits of
    their SA1 codes, so membership is a code-prefix read, no join file.
    """
    by_sa2 = {}
    for sa1, w in sa1_stated.items():
        sa2 = str(sa1)[:9]
        if w > 0:
            by_sa2.setdefault(sa2, []).append((str(sa1), w))
    out = {}
    for sa2, ents in by_sa2.items():
        c = sa2_counts.get(sa2)
        if not c:
            continue
        wsum = sum(w for _, w in ents)
        if wsum <= 0:
            continue
        for sa1, w in ents:
            f = w / wsum
            out[sa1] = {k: c[k] * f for k in OCC_KEYS}
    return out


def _nfd_sums(path):
    """{geo: Σ of the export's 'nfd' columns (codes 10/20/…/80, plus 09
    'inadequately described' excluded)} — the major-group detail the
    43-sub-major basis leaves out, read only so the drift guard can put
    the export on G60B's own footing (G60B's majors carry their nfd)."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = [r for r in csv.reader(f) if any(str(c).strip() for c in r)]
    hdr_i = next(i for i, r in enumerate(rows[:40])
                 if sum(1 for c in r if _fold_lax(c) is not None) >= 20)
    nfd_cols = [j for j, c in enumerate(rows[hdr_i])
                if re.fullmatch(r"\s*[1-8]0\s*", str(c))]
    out = {}
    for row in rows[hdr_i + 1:]:
        geo = _geo_of(row[:5])
        if geo is None:
            continue
        out[geo] = sum(int(float(row[j] or 0)) for j in nfd_cols
                       if j < len(row) and str(row[j]).strip())
    return out


def drift_guard(gcp_ced_zip, tol=0.03):
    """The publication gate: every real CED's Σ(43 sub-majors + the nine
    major-level nfd cells) must sit within ±tol of GCP G60B's stated
    occupation total (Σ of its eight majors). A hard fail otherwise —
    the export is from the wrong universe or shifted."""
    import zipfile
    import io
    ced, _ = load_occ("ced-2021")
    nfd = _nfd_sums(os.path.join(SRC, "ced-2021.csv"))
    z = zipfile.ZipFile(gcp_ced_zip)
    m = [n for n in z.namelist() if n.endswith("G60B_AUST_CED.csv")][0]
    majors = ["P_Tot_Managers", "P_Tot_Professionals",
              "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
              "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
              "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
    worst, n = 0.0, 0
    for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")):
        code = row["CED_CODE_2021"]
        g = sum(int(row[c]) for c in majors)
        if g < 1000:
            continue            # no-usual-address / migratory pseudo-CEDs
        if code not in ced:
            _fail(f"drift guard: {code} missing from ced-2021.csv")
        t = ced[code]["stated"] + nfd.get(code, 0)
        d = abs(t - g) / g
        worst = max(worst, d)
        n += 1
        if d > tol:
            _fail(f"drift guard: {code} export {t} v G60B {g} ({d:.1%})")
    print(f"occ drift guard ok: {n} CEDs, worst {worst:.2%} (tol {tol:.0%})")
    return worst


# the eight 1-digit major groups' GCP/BCP column names — every GCP
# edition's occupation block prints this exact family (G60B 2021, G57B
# 2016, B45B 2011); local to the guards the way drift_guard's majors are
_MAJ_COLS = ("P_Tot_Managers", "P_Tot_Professionals",
             "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
             "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
             "P_Tot_Mach_oper_drivers", "P_Tot_Labourers")


def drift_guard_2016(gcp_ced_zip, tol=0.03):
    """drift_guard's 2016 twin: ced-2016's Σ(43 sub-majors + nfd) per
    division v GCP G57B's eight majors (gcp-ced-2016.zip, the 2016 GCP
    CED profile — the 2016 election-era divisions the vintages' state
    frames run beside)."""
    import zipfile
    import io
    ced, _ = load_occ("ced-2016")
    nfd = _nfd_sums(os.path.join(SRC, "ced-2016.csv"))
    z = zipfile.ZipFile(gcp_ced_zip)
    m = [n for n in z.namelist() if n.endswith("G57B_AUS_CED.csv")][0]
    worst, n = 0.0, 0
    for row in csv.DictReader(io.TextIOWrapper(z.open(m), encoding="utf-8-sig")):
        code = row["CED_CODE_2016"]
        g = sum(int(row[c]) for c in _MAJ_COLS)
        if g < 1000:
            continue
        if code not in ced:
            _fail(f"drift guard 2016: {code} missing from ced-2016.csv")
        t = ced[code]["stated"] + nfd.get(code, 0)
        d = abs(t - g) / g
        worst = max(worst, d)
        n += 1
        if d > tol:
            _fail(f"drift guard 2016: {code} export {t} v G57B {g} ({d:.1%})")
    print(f"occ drift guard 2016 ok: {n} CEDs, worst {worst:.2%} "
          f"(tol {tol:.0%})")
    return worst


def drift_guard_2011(bcp_zip, alloc_zip, tol=0.03):
    """ced-2011's Σ(43 sub-majors + nfd) per division v the 2011 BCP's
    B45B majors summed SA1→CED through ABS's own CED↔SA1 allocation
    (1270055003_ced_2011_aust_csv.zip). The SA1_MAINCODE→region_id decode
    is the voter pipeline's maincode[0]+maincode[5:]."""
    import zipfile
    import io
    ced, _ = load_occ("ced-2011")
    nfd = _nfd_sums(os.path.join(SRC, "ced-2011.csv"))
    member = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
              "2011Census_B45B_AUST_SA1_short.csv")
    z = zipfile.ZipFile(bcp_zip)
    stated = {}
    for row in csv.DictReader(io.TextIOWrapper(z.open(member), encoding="utf-8-sig")):
        stated[row["region_id"]] = sum(int(row[c]) for c in _MAJ_COLS)
    truth = {}
    za = zipfile.ZipFile(alloc_zip)
    a_member = [n for n in za.namelist() if n.endswith(".csv")][0]
    for row in csv.DictReader(io.TextIOWrapper(za.open(a_member), encoding="utf-8-sig")):
        mc = row["SA1_MAINCODE_2011"]
        rid = mc[0] + mc[5:]
        w = stated.get(rid, 0)
        if w:
            truth["CED" + row["CED_CODE_2011"]] = \
                truth.get("CED" + row["CED_CODE_2011"], 0) + w
    worst, n = 0.0, 0
    for code, g in truth.items():
        if g < 1000:
            continue
        if code not in ced:
            _fail(f"drift guard 2011: {code} missing from ced-2011.csv")
        t = ced[code]["stated"] + nfd.get(code, 0)
        d = abs(t - g) / g
        worst = max(worst, d)
        n += 1
        if d > tol:
            _fail(f"drift guard 2011: {code} export {t} v B45B-sum {g} "
                  f"({d:.1%})")
    print(f"occ drift guard 2011 ok: {n} CEDs, worst {worst:.2%} "
          f"(tol {tol:.0%})")
    return worst


# the 2006 BCP's B44_B occupation majors cells, persons block (the
# committed .matilda CD extracts' column names; the voter pipeline's
# B44_COLS read verbatim)
_B44_MAJORS = tuple(f"B{i}" for i in range(7153, 7161))
_B44_STATE = {"NSW": "1", "VIC": "2", "QLD": "3", "SA": "4", "WA": "5",
              "TAS": "6", "NT": "7", "ACT": "8"}


def drift_guard_2006(cd06_extract_dir, tol=0.03):
    """ced-2006's Σ(43 sub-majors + nfd) v the 2006 BCP's B44 majors,
    both folded to STATES (the division-code↔name register and a CED-g
    datapack don't survive for 2006; the state grain still fails loud on
    a shifted sheet — measured slack is hundredths of a point)."""
    ced, _ = load_occ("ced-2006")
    nfd = _nfd_sums(os.path.join(SRC, "ced-2006.csv"))
    exp = {}
    for code, c in ced.items():
        st = code[-3]
        tot = c["stated"] + nfd.get(code, 0)
        exp[st] = exp.get(st, 0) + tot
    truth = {}
    for st, digit in _B44_STATE.items():
        p = os.path.join(cd06_extract_dir, f"CD_{st}_B44_B.csv")
        if not os.path.exists(p):
            _fail(f"drift guard 2006: missing {p} (extract census06bcp.zip "
                  f"per derive-booth-demo-2006.py's header)")
        s = 0
        with open(p, newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                s += sum(int(row[c]) for c in _B44_MAJORS)
        truth[digit] = s
    worst, n = 0.0, 0
    for digit, g in truth.items():
        t = exp.get(digit, 0)
        d = abs(t - g) / g
        worst = max(worst, d)
        n += 1
        if d > tol:
            _fail(f"drift guard 2006: state {digit} export {t} v B44 {g} "
                  f"({d:.1%})")
    print(f"occ drift guard 2006 ok: {n} states, worst {worst:.2%} "
          f"(tol {tol:.0%})")
    return worst


def _sa2_parent_index(sa2_keys):
    """The 2016/2011-era parent lookup: a 7-digit SA1 code's first five
    digits equal its SA2's state digit plus the SA2's trailing 4-digit
    ordinal ({state+ordinal: 9-digit SA2}). ABS SA1 codes are nationally
    unique per edition, so the key identifies exactly one SA2 — a
    collision means the lattice assumption broke and is a hard fail."""
    idx = {}
    for k in sa2_keys:
        key5 = k[0] + k[-4:]
        if key5 in idx and idx[key5] != k:
            _fail(f"SA2 codes {idx[key5]} and {k} collide on the "
                  f"state+ordinal key {key5}")
        idx[key5] = k
    return idx


def _sa1_occ_era(sa1_stated, area_counts, era):
    """The era-dispatched engine of sa1_occ (self-test's entry point):
    `area_counts` the parsed export at its native small-area grain,
    `sa1_stated` {sa1: stated workers} the GCP/BCP footing those SA1s'
    class mixes average over. The parent map is edition-native:
    2021 prefix, 2016/2011 state+ordinal, 2006 identity."""
    sh = shares(area_counts)
    era = str(era)
    if era == "2021":
        parent = lambda c: str(c)[:9]
    elif era in ("2016", "2011"):
        idx = _sa2_parent_index(area_counts)
        parent = lambda c: idx.get(str(c)[:5])
    elif era == "2006":
        parent = lambda c: str(c)
    else:
        _fail(f"sa1_occ: no SA1 code join for era {era!r}")
    out = {}
    for sa1, w in sa1_stated.items():
        s = sh.get(parent(sa1))
        out[sa1] = (None if s is None or w <= 0 else
                    (tuple(s[k] * w for k in OCC_KEYS), float(w)))
    return out


def sa1_occ(sa1_stated, name="sa2-2021"):
    """{sa1: (classvec in OCC_KEYS order, stated)} — each SA1's GCP/BCP
    stated-occupation workers (`sa1_stated`) carrying its parent's class
    mix from the export `name` (the documented within-area homogeneity
    limit; the parent join is the era's own code scheme — see the module
    docstring). Counts land on the GCP/BCP footing, so every caller can
    weight-add them like any other GCP count and share over Σstated.
    SA1s whose parent the export doesn't print (or prints empty) get
    None."""
    counts, _ = load_occ(name)
    era = EXPORT_ERA.get(os.path.splitext(os.path.basename(name))[0],
                         "2021")
    return _sa1_occ_era(sa1_stated, counts, era)


def shares(counts):
    """{geo: {class: share}} — class counts over the stated-occupation
    total; NOT a partition by design (19 residual sub-majors unclassed).
    """
    return {g: {k: c[k] / c["stated"] for k in OCC_KEYS}
            for g, c in counts.items() if c["stated"] > 0}


def self_test():
    check_valueset()
    toy = os.path.join(SRC, "testdata", "toy.csv")
    counts = parse_tb_csv(toy)
    assert set(counts) == {"CED101", "CED102", "101011001"}, \
        f"fixture geographies: {sorted(counts)}"
    # fixture byline: every class column carries its sub-major CODE as its
    # count, so class sums are algebraically checkable by hand.
    want = {k: sum(v["codes"]) for k, v in OCC_CLASSES.items()}
    c = counts["CED101"]
    for k, w in want.items():
        assert c[k] == w, f"CED101 {k}: {c[k]} != {w}"
    residual_sum = sum(OCC_RESIDUAL)
    assert c["stated"] == sum(want.values()) + residual_sum, \
        f"CED101 stated drift: {c['stated']}"
    for geo, c2 in counts.items():
        assert isinstance(c2["stated"], int) and c2["stated"] > 0
    sh = shares(counts)["CED101"]
    assert abs(sh["routine"] - want["routine"] / c["stated"]) < 1e-12
    assert counts["101011001"]["farmwrk"] == 84, "84 must land in farmwrk"
    # the SA2 row spreads onto its SA1s conserving mass
    sa1s = {"10101100101": 400, "10101100102": 600, "10101100103": 0}
    sp = spread_to_sa1(counts, sa1s)
    got = sp.get("10101100101")
    assert got, "SA2 101011001 did not spread onto its SA1s"
    b = counts["101011001"]
    for k in OCC_KEYS:
        assert abs(got[k] - b[k] * 0.4) < 1e-9, f"spread {k} drift"
    for k in OCC_KEYS:
        tot = sum(sp[s][k] for s in ("10101100101", "10101100102"))
        assert abs(tot - b[k]) < 1e-9, f"SA2 {k} mass not conserved"
    # the era-dispatched engine carries each SA1's own stated weight
    e21 = _sa1_occ_era(sa1s, counts, "2021")
    sh21 = shares(counts)["101011001"]
    assert e21["10101100101"] is not None and e21["10101100103"] is None
    for i, k in enumerate(OCC_KEYS):
        assert abs(e21["10101100101"][0][i] - sh21[k] * 400) < 1e-9, \
            "2021-era sa1_occ: shares × own stated drifted"
    # 2016/2011: the state+ordinal key joins 7-digit SA1s to the export
    e11 = _sa1_occ_era({"1100101": 400, "1100102": 600, "1100103": 0,
                        "9999999": 50}, counts, "2011")
    assert e11["1100101"] is not None and e11["9999999"] is None, \
        "2011-era parent join"
    g11 = e11["1100101"][0]
    for i, k in enumerate(OCC_KEYS):
        assert abs(g11[i] - shares(counts)["101011001"][k] * 400) < 1e-9
    # 2006: the CD export is already at unit grain (identity join)
    d = dict(next(iter(counts.items()))[1])
    e06 = _sa1_occ_era({"CED101": 100.0}, counts, "2006")
    assert e06["CED101"][1] == 100.0
    # the 2006-era geography folds are read off rows
    assert _geo_of(['"CED07101"']) == "CED101"
    assert _geo_of(['"1091601"']) == "1091601"
    assert _geo_of(['"101021007"']) == "101021007"
    print("occ_lanes self-test ok: 43 sub-majors, 7 classes, residual 19, "
          "reader + spread + era joins + shares green")
    return True


if __name__ == "__main__":
    self_test()
