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
G57B 2016, G60B 2021), so the 2-digit counts arrive as a manual ABS
TableBuilder export committed unedited at `.build/map/src/census-occ/`
(provenance JSON beside): 2021 census, employed usual residents aged 15+,
OCCP at 2-digit level × SA2 (rolls into SA1 exactly: SA2 codes are the
leading 9 digits of their SA1 codes) and × CED (federal frames + the G60B
drift anchor). TableBuilder's random cell perturbation is left in the file
and NEVER re-normalised against GCP; class shares are computed inside the
export's own stated-occupation basis (the sum of the 43 sub-major groups —
the same basis GCP G60B's blue lane carries), and a per-division guard at
the publication gate compares Σ(43 sub-majors) with G60B's stated total
within ±3% (perturbation slack), a HARD fail before assemble. ABS pseudo-
codes and supplementary ("not further defined") output rows never enter
the basis. The SA2→SA1 spread assumes within-SA2 class homogeneity,
weights proportional to each SA1's G60B stated-occupation workers; that is
a documented modelling limit, unverified below the SA2 grain.

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
_SA2_RE = re.compile(r"(?<!\d)(\d{9})(?!\d)")


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
    """Pick the row's geography id out of its first few cells."""
    for cell in rowcells:
        t = str(cell).strip()
        m = _CED_RE.search(t)
        if m:
            return "CED" + m.group(1)
        m = _SA2_RE.search(t)
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
    print("occ_lanes self-test ok: 43 sub-majors, 7 classes, residual 19, "
          "reader + spread + shares green")
    return True


if __name__ == "__main__":
    self_test()
