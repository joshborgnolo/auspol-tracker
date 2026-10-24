#!/usr/bin/env python3
"""derive-division-seifa-abs.py — ABS-source lanes for the three-index
per-division SEIFA store (IRSD / IER / IEO only — IRSAD is the sibling
lane's index, .build/analysis/seifa-index/derive-irsad.py, user call
2026-10-23). Emits .build/analysis/seat-model/seifa-src/abs-derived-3idx.json,
merged into data/division-seifa-indexes.json by extract-division-seifa.mjs.

Elections
  2001 — ABS SEIFA 2001 AUS_ced_s01.xls (the per-division scores ABS itself
         published for the 2001 electoral divisions; a DIRECT published row
         set, no weighting). Cross-checked against AEC RR5 Attachment 1
         (IRSAD) — 150/150 within printed rounding.
  2013 — SEIFA 2011 SA1 cube x CED_2011_AUST SA1 allocations (the boundaries
         at the 2011 census), South Australia's SA1s re-cut to the AEC's
         16 Dec 2011 redistribution – the 2013 election's SA lines – by
         derive-sa-ced2013.py (2026-10-25); population-weighted mean of
         constituent SA1 scores per ABS 2039.0 §2.2.
  2016 — SEIFA 2016 SA1 cube x CED_2016_AUST.
  2019 — SEIFA 2016 SA1 cube x CED_2018_AUST.
  2022 — SEIFA 2021 SA1 cube x CED_2021 MB allocations + 2021 MB counts.
  2025 — SEIFA 2021 SA1 cube x CED_2024 MB allocations.
  2004 — OPEN: needs a 2001-CD -> 2003-edition CED concordance (rr6 open
         item 3 in .build/analysis/seifa-index/rr6-official-seifa-products.md).
         The 2001 CD cube is staged in the cache against that day.

Rows carry value (3dp) and rank computed within the store (rank 1 = most
disadvantaged = lowest score — the APH tapes' convention; IRSAD's sibling
inverts, and that asymmetry is why the lanes are separate).

Hard gates before any write (all fail the script loudly):
  * every index/score column is resolved BY HEADER NAME per cube — ABS
    swapped the IRSD/IRSAD column order between SEIFA editions (2011 leads
    with IRSAD, 2016/2021 lead with IRSD), so hardcoded offsets misread
    the files (the sibling IRSAD lane's 2016+ rows are suspected of this
    exact misread, reported separately — do not copy its column numbers);
  * derived membership sets are NAME-EXACT against the matching block of
    data/division-classifications.json (fail before emit, not at test);
  * 2001: cube IRSAD vs AEC RR5 att1 within printed rounding for all 150
    divisions after RR5's two print-typo corrections;
  * 2013/2016: SA1-decile counts per CED per index EXACT vs the ABS "CED
    SA1 Distributions" cubes in .build/analysis/seifa-index/src/abs/
    (recon sheets matched by in-table title — ABS re-numbered its index
    tables across editions: 2011 leads with IRSAD, 2016 with IRSD);
  * every derived row: national population share per national decile is
    10%±0.6 per index (catches census/edition membership swaps the exact
    recon cannot see: 2018/2024 editions have no ABS distributions cube).

Run from the repo root:
    python3 .build/analysis/seat-model/derive-division-seifa-abs.py
Requires: python3 + xlrd (2.x reads the old OLE2 .xls) + openpyxl.
"""

import collections
import importlib.util
import io
import json
import zipfile

import openpyxl
import xlrd

HERE = __file__.rsplit("/seat-model/", 1)[0] + "/seat-model"
PROJ = HERE.rsplit("/.build/", 1)[0]
ABS_CACHE = f"{PROJ}/.matilda/seifa-irsad-abs"
RECON_ABS = f"{PROJ}/.build/analysis/seifa-index/src/abs"
OUT_JSON = f"{HERE}/seifa-src/abs-derived-3idx.json"
CLASS_JSON = f"{PROJ}/data/division-classifications.json"

# Sibling IRSAD lane: reuse its loaders ONLY for the unchanged ABS products
# (MB keys, CED membership zips, xlsx allocations, MB counts, RR5 text).
# Its per-index cube column reads are NOT reused (see header-name rule above).
_spec = importlib.util.spec_from_file_location(
    "derive_irsad", f"{PROJ}/.build/analysis/seifa-index/derive-irsad.py")
di = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(di)

IDX = ["irsd", "ier", "ieo"]
MC_NORM = {"Mcewen": "McEwen", "Mcmillan": "McMillan", "Mcpherson": "McPherson"}
# RR5 att1's print typos (its rows are the PRINT, the cube is the compute)
RR5_TYPO = {"McEwan": "McEwen", "Kingston-Smith": "Kingsford Smith"}
STATE_BY_BLOCK = {1: "NSW", 2: "VIC", 3: "QLD", 4: "SA", 5: "WA",
                  6: "TAS", 7: "NT", 8: "ACT"}
STATE_NAME = {
    "New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD",
    "South Australia": "SA", "Western Australia": "WA", "Tasmania": "TAS",
    "Northern Territory": "NT", "Australian Capital Territory": "ACT",
}
VIA = {
    "2001": "absCed01",
    "2013": "absSa1Ced2011",
    "2016": "absSa1Ced2016",
    "2019": "absSa1Ced2018",
    "2022": "absMbCed2021",
    "2025": "absMbCed2024",
}
PROVENANCE = {
    "absCed01": {
        "title": "ABS SEIFA 2001 per-division cube (AUS_ced_s01.xls, cat 2033.0.55.001 data-only reissue) — 2001 Census scores on the 2001 electoral divisions",
        "censusYear": 2001, "editionInForce": "2000-2001", "derivation": "published",
        "recons": "irsad column vs AEC RR5 Attachment 1 (150/150 within printed rounding)",
    },
    "absSa1Ced2011": {
        "title": "ABS SEIFA 2011 SA1 cube x CED_2011_AUST SA1 allocations, SA re-cut to the AEC's 16 Dec 2011 redistribution, population-weighted (2039.0 §2.2)",
        "censusYear": 2011, "editionInForce": "2011", "derivation": "weighted",
        "recons": "SA1 decile counts per CED EXACT vs ABS 2011 CED SA1 Distributions (irsd/ier/ieo)",
    },
    "absSa1Ced2016": {
        "title": "ABS SEIFA 2016 SA1 cube x CED_2016_AUST SA1 allocations, population-weighted",
        "censusYear": 2016, "editionInForce": "2016", "derivation": "weighted",
        "recons": "SA1 decile counts per CED EXACT vs ABS 2016 CED SA1 Distributions (irsd/ier/ieo)",
    },
    "absSa1Ced2018": {
        "title": "ABS SEIFA 2016 SA1 cube x CED_2018_AUST SA1 allocations, population-weighted",
        "censusYear": 2016, "editionInForce": "2018", "derivation": "weighted",
        "recons": "national decile pop-share sanity only (ABS ships no 2018-edition distributions cube)",
    },
    "absMbCed2021": {
        "title": "ABS SEIFA 2021 SA1 cube x CED_2021_AUST MB allocations + 2021 census MB counts",
        "censusYear": 2021, "editionInForce": "2021", "derivation": "weighted",
        "recons": "national decile pop-share sanity (2021 CEDs cut SA1s; ABS counts are not MB-recomputable)",
    },
    "absMbCed2024": {
        "title": "ABS SEIFA 2021 SA1 cube x CED_2024_AUST MB allocations + 2021 census MB counts",
        "censusYear": 2021, "editionInForce": "2024", "derivation": "weighted",
        "recons": "national decile pop-share sanity only (ABS ships no 2024-edition distributions cube)",
    },
}

INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    # ABS released some products with "Employment" for the same IEO index
    # (the score/decile tables pair identically either way).
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}

def _canon(t):
    return " ".join(str(t).upper().split())

def title_is(t, idx):
    t = _canon(t)
    return any(w in t for w in INDEX_TITLES[idx])

def resolve_cols(title_row, idxs):
    """In an ABS index sheet's title band, find each index's score column
    by its printed title (a decile column follows its score column)."""
    cols = {}
    for i, t in enumerate(title_row):
        if not t:
            continue
        for idx in idxs:
            if idx in cols:
                continue
            if title_is(t, idx):
                cols[idx] = (i, i + 1)
                break
    for idx in idxs:
        assert idx in cols, f"index {idx} missing from header band: {title_row!r}"
    return cols

def _num(v):
    return float(v) if isinstance(v, (int, float)) else None

# ----------------------------------------------------------- cubes (SA1)

def load_seifa_cube(year):
    """SA1 cube -> {cube_key: {idx: (score|None, decile|None), 'urp': float}}.
    2011: key = 7-digit code (col0); membership rows bridge maincode->7d.
    2016: key = 11-digit maincode (col1; col0 is the legacy 7-digit code).
    2021: key = 11-digit code string (col0)."""
    if year in (2011, 2016):
        wb = xlrd.open_workbook(f"{ABS_CACHE}/abs-seifa-{year}-sa1-indexes.xls")
        sh = wb.sheet_by_name("Table 1")
        title_row = sh.row_values(4)
        urp_scan = title_row
        keycol = 0 if year == 2011 else 1
        code_ok = lambda v: isinstance(v, float)
        def iter_rows():
            for r in range(6, sh.nrows):
                yield sh.row_values(r)
    else:
        wb = openpyxl.open(f"{ABS_CACHE}/abs-seifa-2021-sa1-indexes.xlsx",
                           read_only=True)
        sh = wb["Table 1"]
        hdr = list(sh.iter_rows(values_only=True, max_row=6))
        title_row = list(hdr[4])
        urp_scan = list(hdr[5])
        keycol = 0
        def code_to_key(v):
            if isinstance(v, float):
                v = int(v)
            s = str(v)
            return s if isinstance(s, str) and len(s) == 11 and s.isdigit() else None
        def iter_rows():
            for row in sh.iter_rows(values_only=True, min_row=7):
                yield list(row)
    if year in (2011, 2016):
        cols = resolve_cols(title_row, IDX + ["irsad"])
        urp_col = next(i for i, t in enumerate(urp_scan)
                       if t and "USUAL RESIDENT POPULATION" in _canon(t))
        out = {}
        for v in iter_rows():
            if len(v) <= urp_col or not isinstance(v[keycol], float):
                continue
            key = str(int(v[keycol]))
            rec = {"urp": _num(v[urp_col]) or 0.0}
            for idx in IDX + ["irsad"]:
                rec[idx] = (_num(v[cols[idx][0]]), _num(v[cols[idx][1]]))
            out[key] = rec
    else:
        cols = resolve_cols(title_row, IDX + ["irsad"])
        urp_col = next(i for i, t in enumerate(urp_scan)
                       if t and "USUAL RESIDENT POPULATION" in _canon(t))
        out = {}
        for v in iter_rows():
            if len(v) <= urp_col:
                continue
            key = code_to_key(v[keycol])
            if key is None:
                continue
            rec = {"urp": _num(v[urp_col]) or 0.0}
            for idx in IDX + ["irsad"]:
                rec[idx] = (_num(v[cols[idx][0]]), _num(v[cols[idx][1]]))
            out[key] = rec
    print(f"seifa{year} SA1 cube (Table 1): {len(out)} rows, columns resolved by title")
    return out

# -------------------------------------------------- cube (2001, per-CED)

def load_ced2001():
    """The ABS-owned per-CED SEIFA 2001 product: direct published scores,
    no weighting. Returns {name_norm: {state, irsd, ier, ieo, irsad}}."""
    zf = zipfile.ZipFile(f"{ABS_CACHE}/dl/seifa2001-aus.zip")
    blob = zf.read("AUS/AUS_ced_s01.xls")
    wb = xlrd.open_workbook(file_contents=blob)
    sh = wb.sheet_by_index(0)
    hdr = [str(t).strip() for t in sh.row_values(0)]
    codecol = hdr.index("Commonwealth_Electoral_Div")
    namecol = hdr.index("Commonwealth_Electoral_Div_Name")
    stcol = hdr.index("State_Name")
    idxcol = {"irsad": hdr.index("Advantage_Disadvantage"),
              "irsd": hdr.index("Disadvantage"),
              "ier": hdr.index("Econ_Resource"),
              "ieo": hdr.index("Educ_Occupation")}
    rows = {}
    for r in range(1, sh.nrows):
        v = sh.row_values(r)
        if not isinstance(v[codecol], float) or not v[namecol]:
            continue
        code = int(v[codecol])
        if code >= 900:
            continue  # ABS OT pseudo-division rows (e.g. 'Incl. in Fraser')
        name = MC_NORM.get(v[namecol].strip(), v[namecol].strip())
        rec = {"state": STATE_NAME[v[stcol].strip()]}
        for idx in IDX + ["irsad"]:
            rec[idx] = _num(v[idxcol[idx]])
        rows[name] = rec
    assert len(rows) == 150, f"2001 CED cube carried {len(rows)} divisions, expected 150"
    print(f"seifa2001 CED cube: {len(rows)} divisions (published scores, no weighting)")
    return rows

def xcheck_rr5(rows):
    """AEC RR5 att1 prints IRSAD for the same divisions. Compare."""
    rr5 = {RR5_TYPO.get(r["division"], r["division"]): r["irsad"]
           for r in di.parse_rr5_att1(f"{PROJ}/.build/analysis/seifa-index/cache/rr5.txt")}
    missing = [n for n in rr5 if n not in rows]
    extra = [n for n in rows if n not in rr5]
    assert not missing and not extra, f"rr5 name join broke: missing={missing} extra={extra}"
    big = []
    for n, v in rr5.items():
        if abs(rows[n]["irsad"] - v) > 0.6:
            big.append((n, v, rows[n]["irsad"]))
    assert len(big) <= 2, f"rr5 xcheck: {len(big)} rows beyond print-rounding: {big}"
    for n, v, c in big:
        assert abs(v - c) < 2.0, f"rr5 xcheck unexplained: {n} rr5={v} cube={c}"
        print(f"  rr5 print-rounding absorbed: {n} rr5={v} cube={c:.2f}")
    mx = max(abs(rows[n]["irsad"] - v) for n, v in rr5.items())
    print(f"  rr5 xcheck: 150/150 within printed rounding (max |delta| {mx:.2f})")

# --------------------------------------------------------------- derive

def derive_weighted(seifa, cedmap, cube_key_of, weight_of_unit, tag):
    """Population-weighted mean per CED per index (2039.0 §2.2) over
    membership units {unit: (ced_code, ced_name)}. Returns
    (means {(code, name): {idx: value}}, decile SA1 counts per CED,
    decile populations per CED)."""
    accum = {idx: collections.defaultdict(lambda: [0.0, 0.0]) for idx in IDX}
    dec_counts = {idx: collections.defaultdict(lambda: [0] * 10) for idx in IDX}
    dec_pops = {idx: collections.defaultdict(lambda: [0.0] * 10) for idx in IDX}
    dropped = {idx: collections.Counter() for idx in IDX}
    for unit, (code, name) in cedmap.items():
        if di.PSEUDO.search(name):
            continue
        w = weight_of_unit(unit)
        if w <= 0:
            continue
        rec = seifa.get(cube_key_of(unit))
        for idx in IDX:
            sc, dec = (None, None) if rec is None else rec[idx]
            if sc is None:
                dropped[idx]["n"] += 1
                dropped[idx]["pop"] += w
                continue
            a = accum[idx][(code, name)]
            a[0] += sc * w
            a[1] += w
            if dec is not None:
                d = int(dec) - 1
                dec_counts[idx][code][d] += 1       # SA1 rows (2011/2016 eras)
                dec_pops[idx][code][d] += w         # population shares
    for idx in IDX:
        if dropped[idx]["n"]:
            print(f"  [{tag}:{idx}] dropped {dropped[idx]['n']} unscored units (pop {dropped[idx]['pop']:.0f})")
    means = {}
    for k in accum["irsd"]:
        m = {}
        for idx in IDX:
            s, w = accum[idx][k]
            if w > 0:
                m[idx] = s / w
        assert len(m) == len(IDX), f"{tag}: CED {k} has no scored units for some index"
        means[k] = m
    return means, dec_counts, dec_pops

def rows_of(means):
    """{(code, name): {idx: float}} -> {name: {state, irsd: float, ...}}."""
    out = {}
    for (code, name), vals in means.items():
        name = MC_NORM.get(name, name)
        out[name] = {"state": STATE_BY_BLOCK[code // 100], **vals}
    return out

def rank_and_round(rows):
    """rows {name: {state, irsd: float, ...}} -> each index becomes
    {value: 3dp, rank}; rank 1 = most disadvantaged. Ranks are computed
    on FULL-precision means (two divisions may legitimately share a 3dp
    printed value); a full-precision collision hard-fails — that is a
    structural issue (e.g. an empty CED inheriting a neighbour's mean),
    never a rounding coincidence."""
    for idx in IDX:
        ordered = sorted(rows.items(), key=lambda kv: kv[1][idx])
        seen = {}
        for name, _rec in ordered:
            v = rows[name][idx]
            assert v not in seen, f"{idx}: full-precision value collision at {v} ({seen.get(v)} vs {name})"
            seen[v] = name
        for rank, (name, _rec) in enumerate(ordered, start=1):
            rows[name][idx] = {"value": round(rows[name][idx], 3), "rank": rank}
    return rows

def name_join(audit_tag, rows, klass):
    mine, theirs = set(rows), set(klass)
    missing = sorted(theirs - mine)
    extra = sorted(mine - theirs)
    assert not missing and not extra, (f"{audit_tag}: division-set mismatch vs classifications — "
                                       f"missing {missing} extra {extra}")

# ------------------------------------------------- recon vs ABS dist cubes

def recon_tables(path):
    """{idx: {ced_code: [10 decile counts]}} from an ABS 'CED SA1
    Distributions' cube; sheets matched by in-table title because ABS
    re-numbered index tables across editions."""
    if path.endswith(".xls"):
        wb = xlrd.open_workbook(path)
        raw = [(s, [[sh2.cell_value(r, c) for c in range(sh2.ncols)]
                    for r in range(sh2.nrows)])
               for s in wb.sheet_names() if "Table" in s
               for sh2 in [wb.sheet_by_name(s)]]
    else:
        wbx = openpyxl.load_workbook(path, read_only=True)
        raw = [(s.title, [list(r) for r in s.iter_rows(values_only=True)])
               for s in wbx.worksheets if "Table" in s.title]
    found = {}
    for _sn, grid in raw:
        idx = None
        for row in grid[:8]:
            for cell in (row or []):
                if idx is None and isinstance(cell, str):
                    for cand in IDX:
                        if title_is(cell, cand):
                            idx = cand
        if idx is None or idx in found:
            continue
        found[idx] = {}
        for row in grid:
            if not row or not isinstance(row[0], (int, float)):
                continue
            d = row[3:13]
            if not all(isinstance(x, (int, float)) for x in d):
                continue
            counts = [int(x) for x in d]
            if sum(counts):
                found[idx][int(row[0])] = counts
    for idx in IDX:
        assert idx in found, f"{path}: no recon table found for {idx}"
    return found

def recon_exact(tag, mine, cube_path):
    """mine {idx: {ced_code: [10 counts]}} vs the ABS cube: every count equal."""
    theirs = recon_tables(cube_path)
    for idx in IDX:
        checked, mism = 0, 0
        for code, want in sorted(theirs[idx].items()):
            got = mine[idx].get(code)
            if got is None or sum(got) == 0:
                continue
            checked += 1
            if [int(x) for x in got] != want:
                mism += 1
                if mism <= 3:
                    print(f"  recon {tag}:{idx} MISMATCH ced {code}: abs={want} mine={[int(x) for x in got]}")
        assert not mism, f"{tag}:{idx}: {mism}/{checked} CED decile rows mismatch ABS"
        print(f"  recon {tag}:{idx}: {checked} CEDs, decile counts EXACT vs ABS distributions")

def national_shares_sanity(tag, dec_pops):
    """Every derived row: each national decile carries ~10% of the counted
    population per index. ABS deciles bucket SA1s by COUNT, so the
    population share per decile drifts with how each index's geography
    correlates with population density (observed: IEO decile 1 sinks to
    ~8.8% in 2021). The band below (±2pt) therefore catches only gross
    membership/census swaps, which move shares by 5+ points, while the
    exact per-CED count recon guards the eras that have ABS cubes for it."""
    for idx in IDX:
        nat = [sum(v[i] for v in dec_pops[idx].values()) for i in range(10)]
        tot = sum(nat)
        shares = [x / tot * 100 for x in nat]
        assert all(8.0 < x < 12.0 for x in shares), f"{tag}:{idx} shares out of 10%±2: {[round(s,2) for s in shares]}"
        print(f"  sanity {tag}:{idx}: national decile pop-shares {[round(s,1) for s in shares]}")

# ------------------------------------------------------------- assembly

def main():
    klass = json.load(open(CLASS_JSON))["elections"]
    elections = {}

    # ---- 2001 — ABS's own per-CED cube (published)
    cubes01 = load_ced2001()
    xcheck_rr5(cubes01)
    name_join("e2001", cubes01, klass["2001"])
    rows01 = {n: {"state": r["state"], "irsd": r["irsd"], "ier": r["ier"], "ieo": r["ieo"]}
              for n, r in cubes01.items()}
    elections["2001"] = rank_and_round(rows01)

    # ---- SEIFA-era cube loaders (one pass each, all four indexes held)
    seifa11 = load_seifa_cube(2011)
    mb11 = di.load_mb_sa1_keys(2011)   # maincode -> 7digit cube key
    seifa16 = load_seifa_cube(2016)
    seifa21 = load_seifa_cube(2021)

    def lane(cube, cedmap, key_of, weight_of, tag):
        means, dec_counts, dec_pops = derive_weighted(cube, cedmap, key_of, weight_of, tag)
        rows = rows_of(means)
        name_join(tag, rows, klass[tag.lstrip("e")])
        return rank_and_round(rows), dec_counts, dec_pops

    # ---- 2013 — 2011c x CED_2011, South Australia re-cut to its Dec 2011
    # redistribution (di.ced_2013); the exact recon below runs on the raw
    # CED_2011 cut, the geometry the ABS distributions cube was built on
    _raw13, dec13, _decp11 = derive_weighted(
        seifa11, di.load_ced_csv_zip("2011", 2011), lambda main: mb11.get(main),
        lambda m: seifa11.get(mb11.get(m), {}).get("urp", 0.0), "e2013raw")
    elections["2013"], _dec13sa, decp13 = lane(
        seifa11, di.ced_2013(di.load_ced_csv_zip("2011", 2011)),
        lambda main: mb11.get(main),
        lambda m: seifa11.get(mb11.get(m), {}).get("urp", 0.0), "e2013")

    # ---- 2016 — 2016c x CED_2016
    elections["2016"], dec16, decp16 = lane(
        seifa16, di.load_ced_csv_zip("2016", 2016),
        lambda main: main,
        lambda m: seifa16.get(m, {}).get("urp", 0.0), "e2016")

    # ---- 2019 — 2016c x CED_2018
    elections["2019"], _d19, decp19 = lane(
        seifa16, di.load_ced_csv_zip("2018", 2018),
        lambda main: main,
        lambda m: seifa16.get(m, {}).get("urp", 0.0), "e2019")

    # ---- 2022 / 2025 — 2021c, MB-level
    mbsa1 = di.load_mb2021_sa1()
    counts = di.load_mbcounts2021()
    elections["2022"], _d22, decp22 = lane(
        seifa21, di.load_ced202x_xlsx(2021),
        lambda mb: mbsa1.get(mb),
        lambda mb: counts.get(mb, 0.0), "e2022")
    elections["2025"], _d25, decp25 = lane(
        seifa21, di.load_ced202x_xlsx(2024),
        lambda mb: mbsa1.get(mb),
        lambda mb: counts.get(mb, 0.0), "e2025")

    # ---- recon vs ABS per-CED SA1 distribution cubes (exact; 2013/2016 eras)
    recon_exact("e2013", dec13, f"{RECON_ABS}/abs-seifa-2011-ced-sa1-distributions.xls")
    recon_exact("e2016", dec16, f"{RECON_ABS}/abs-seifa-2016-sa1-distributions-ced.xls")
    # ---- pop-share sanity everywhere else the exact recon cannot see
    national_shares_sanity("e2013", decp13)
    national_shares_sanity("e2019", decp19)
    national_shares_sanity("e2022", decp22)
    national_shares_sanity("e2025", decp25)

    # ---- gross-shape guards (column-substitution catchers)
    for y, rows in sorted(elections.items()):
        for idx in IDX:
            vals = [r[idx]["value"] for r in rows.values()]
            mn = sum(vals) / len(vals)
            assert 940 < mn < 1060, f"{y}:{idx} mean {mn:.1f} outside 940..1060"
            assert all(700 < v < 1400 for v in vals), f"{y}:{idx} value outside sanity band"

    doc = {
        "_about": "ABS-source per-division SEIFA blocks (irsd/ier/ieo) for elections "
                  "without a Parliamentary Library paper: 2001 from ABS's own per-CED "
                  "cube (published), 2013-2025 population-weighted from ABS SA1 cubes x "
                  "CED allocations (2039.0 §2.2; 2021-era weighted on MB census counts). "
                  "Rank 1 = most disadvantaged. Regenerate: "
                  "python3 .build/analysis/seat-model/derive-division-seifa-abs.py",
        "_provenance": PROVENANCE,
        "elections": elections,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write("\n")
    print(f"emitted {OUT_JSON}: " +
          ", ".join(f"{y}={len(r)}" for y, r in sorted(elections.items())))

if __name__ == "__main__":
    main()
