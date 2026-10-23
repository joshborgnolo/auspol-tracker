#!/usr/bin/env python3
"""derive-irsad.py — build .build/analysis/seifa-index/irsad-by-division.json

IRSAD per federal electoral division per election, per the skill's output
contract (IRSAD ONLY, user call 2026-10-23):
  {division, censusYear, editionInForce, irsad, rank, decile, quartile,
   derivation: 'published'|'weighted', sourceProduct}

Sources
  published   AEC RR5 Attachment 1        cache/rr5.txt        (2001c x 2000b)
              APH CIB 05cib01 IRSAD tbl   src/aph/aph-05cib01.txt (2001c x 2003b)
              APH RP 09rp02 Table 2a      src/aph/aph-09rp02.txt (2006c x 2006b)
              APH RP 11rp01 Table 2a      src/aph/aph-11rp01.txt (2006c x 2009b)
  derived     ABS SEIFA SA1 cubes + MB/CED anallocation products, per ABS
              2039.0 §2.2 (population-weighted mean of constituent area
              scores). Inputs cached in .matilda/seifa-irsad-abs/ (gitignored,
              re-fetchable — see docs/abs-input-sources.md).

Derivation weights come from each census in-cube Usual Resident Population
(2011/2016 era) or per-Mesh-Block census person counts (2021 era, where the
CED allocation products are MB-level rather than SA1-level).

Run:  python3 .build/analysis/seifa-index/derive-irsad.py
Deps: python3 + xlrd (2.x reads the old OLE2 .xls) + openpyxl.
"""

import io, json, re, sys, zipfile
import collections, csv

import xlrd
import openpyxl

ROOT = __file__.rsplit("/seifa-index/", 1)[0] + "/seifa-index"
PROJ = ROOT.rsplit("/.build/", 1)[0]
DL = f"{PROJ}/.matilda/seifa-irsad-abs/dl"
CUBES = f"{PROJ}/.matilda/seifa-irsad-abs"

OUT_JSON = f"{ROOT}/irsad-by-division.json"

# ---------------------------------------------------------------- helpers

def chunk(ranks, n):
    """1-based rank list -> bucket index 1..n (near-equal, rank order kept)."""
    pos = {r: i for i, r in enumerate(sorted(ranks))}
    m = len(ranks)
    return {r: (pos[r] * n) // m + 1 for r in ranks}

def norm(s):
    return re.sub(r"\s+", " ", s.replace("’", "'")).strip()

# ------------------------------------------------------- published parsers

_RR5_SEG = re.compile(
    r"(\d{1,3})\s+([A-Za-z'. \-]+?\((?:NSW|Vic|Qld|SA|WA|Tas|NT|ACT)\))\s+(\d{3,4})(?=\s|$)"
)
_RR5_BAND = re.compile(r"\b(?:LOW|LOWER MIDDLE|UPPER MIDDLE|HIGH)\b")

def parse_rr5_att1(path):
    """RR5 Attachment 1: 150 rows, up to two `rank name (ST) score` pairs per
    pdftotext line. Quartile band headers (LOW/LOWER MIDDLE/UPPER MIDDLE/
    HIGH) appear inline and \f page breaks glue to names (Wentworth/Groom);
    both are stripped before segment matching. Quartiles computed by rank
    bucket (37/38/38/37)."""
    out = {}
    for line in open(path, encoding="utf-8"):
        line = _RR5_BAND.sub(" ", line.replace("\f", " ").replace("’", "'"))
        for m in _RR5_SEG.finditer(line):
            rank, name, val = int(m.group(1)), norm(m.group(2)), int(m.group(3))
            out[rank] = (name, val)
    assert len(out) == 150, f"rr5 att1 parsed {len(out)} rows, expected 150"
    assert sorted(out) == list(range(1, 151)), "rr5 att1 ranks not 1..150"
    qu, de = chunk(list(out), 4), chunk(list(out), 10)
    rows = []
    for rank, (name, val) in sorted(out.items()):
        div, st = name.rsplit("(", 1)
        rows.append(dict(division=norm(div[:-1]), state=st[:-1], irsad=val,
                         rank=rank, quartile=qu[rank], decile=de[rank]))
    return rows

_APH_STATE = r"(?:NSW|Vic\.?|Qld|SA|WA|Tas\.?|NT|ACT)"
_APH_SEG = re.compile(
    r"([A-Za-z'. \-]+?\(" + _APH_STATE + r"\))\s+"
    r"(?:ALP|LP|NP|Ind|Ind\.)\s+(\d{3,4}(?:\.\d+)?)(?=\s|$)"
)

def parse_aph_table2a(path, tag):
    """APH Table 2a only: alphabetical IRSAD rows inside the `Table 2a` →
    `Table 2a`→(next `Table` header) slice; tables 2b/3/4 share the row
    layout and must not leak in."""
    lines = open(path, encoding="utf-8").read().splitlines()
    starts = [i for i, l in enumerate(lines) if re.match(r"\s*Table 2a\b", l)]
    rows = []
    for start in starts:
        stop = next((i for i, l in enumerate(lines[start + 1 :], start + 1)
                     if re.match(r"\s*Table \d", l)), len(lines))
        rows = []
        for line in lines[start:stop]:
            line = line.replace("\f", " ").replace("’", "'")
            for m in _APH_SEG.finditer(line):
                name, val = norm(m.group(1)), float(m.group(2))
                div, st = name.rsplit("(", 1)
                st = st[:-1].rstrip(".")
                rows.append(dict(division=norm(div[:-1]), state=st, irsad=val))
        if len(rows) >= 150:
            break
    assert len(rows) == 150, f"{tag}: parsed {len(rows)} rows, expected 150"
    return rows

_CIB_CAP_ALPHA = "Index of Relative Socio-Economic Advantage/Disadvantage"
_CIB_CAP_RANKED = "Ranked by the Index of Relative Socio-Economic Advantage/Disadvantage"
_CIB_STATE = r"(?:NSW|Vic|Qld|SA|WA|Tas|NT|ACT)"
_CIB_PARTY = r"(?:LIB|ALP|NP|CLP|IND|GRN|DEM)"
_CIB_SCORE = r"(\d{1,2},\d{3}\.\d|\d{3}\.\d)"  # four-figure scores print 1,059.3
_CIB_ALPHA_SEG = re.compile(
    r"([A-Za-z'.\- ]+?\(" + _CIB_STATE + r"\))\s+" + _CIB_PARTY + r"\s+" + _CIB_SCORE
)
_CIB_RANK_SEG = re.compile(
    r"\b(\d{1,3})\s+([A-Za-z'.\- ]+?\(" + _CIB_STATE + r"\))\s+" + _CIB_PARTY + r"\s+" + _CIB_SCORE
)

def parse_aph05cib01(path):
    """APH CIB 1/2004-05 (05cib01): IRSAD only. The paper prints one
    alphabetical score table (`Index of Relative … Advantage/Disadvantage`,
    two name/party/score segments per line, thousands-separated scores) and a
    ranked re-print (`Ranked by the Index …`, ascending-disadvantage ranks).
    Parse both and require per-division score agreement — the ranked table is
    the cross-check, never the source. Header lines can't match the segment
    grammar (no `Name (ST) PARTY score` triple), so captions alone bracket
    the slices."""
    lines = open(path, encoding="utf-8").read().splitlines()
    norm_lines = [l.replace("\f", " ").replace("’", "'") for l in lines]
    stripped = [re.sub(r"\s+", " ", l).strip() for l in norm_lines]
    try:
        a0 = stripped.index(_CIB_CAP_ALPHA)
        r0 = stripped.index(_CIB_CAP_RANKED)
    except ValueError:
        raise AssertionError("05cib01: caption(s) not found")
    r1 = next((i for i in range(r0 + 1, len(stripped))
               if stripped[i].startswith("Index of Relative Socio-Economic Disadvantage")),
              len(stripped))
    def cibrows(line_iter, seg, tag):
        rows = {}
        for line in line_iter:
            for m in seg.finditer(line):
                if seg is _CIB_ALPHA_SEG:
                    name, val = m.group(1), m.group(2)
                else:
                    rank, name, val = int(m.group(1)), m.group(2), m.group(3)
                div, st = norm(name).rsplit("(", 1)
                key = norm(div[:-1])
                assert key not in rows, f"{tag}: duplicate division {key}"
                row = dict(division=key, state=st[:-1],
                           irsad=float(val.replace(",", "")))
                if seg is _CIB_RANK_SEG:
                    row["printedRank"] = rank
                rows[key] = row
        assert len(rows) == 150, f"{tag}: parsed {len(rows)} divisions, expected 150"
        return rows
    alpha = cibrows(norm_lines[a0:r0], _CIB_ALPHA_SEG, "05cib01-alpha")
    ranked = cibrows(norm_lines[r0:r1], _CIB_RANK_SEG, "05cib01-ranked")
    order = sorted(ranked.values(), key=lambda r: r["printedRank"])
    assert [r["printedRank"] for r in order] == list(range(1, 151)), \
        "05cib01: printed ranks not 1..150"
    scores = [r["irsad"] for r in order]
    assert all(a <= b for a, b in zip(scores, scores[1:])), \
        "05cib01: printed ranked table not ascending in IRSAD (rank 1 = most disadvantaged)"
    for div, r in ranked.items():
        assert alpha[div]["irsad"] == r["irsad"], \
            f"05cib01: {div} alpha/ranked score mismatch"
    return list(alpha.values())

# ------------------------------------------------------------- ABS loaders

PSEUDO = re.compile(r"No usual address|Migratory|Shipping", re.I)

def _sheet_rows_xls(path, summary_only=False):
    """Sheet picker for ABS SEIFA cubes. summary_only=True selects the
    'SEIFA Summary' table (Table 1: all four indexes + URP) — never fall
    back to the largest sheet (that's the Geographic Information table)."""
    wb = xlrd.open_workbook(path)
    sh = None
    for sn in wb.sheet_names():
        s = wb.sheet_by_name(sn)
        if summary_only and s.nrows > 3 and "SEIFA Summary" in str(s.row_values(3)[0]):
            sh = s
            break
        if s.nrows > 100:
            sh = s if sh is None or s.nrows > sh.nrows else sh
    if sh is None:
        raise RuntimeError(f"no target sheet found in {path}")
    return [sh.row_values(r) for r in range(sh.nrows)], sh.name

def _data_start(rows, codepred):
    for i, r in enumerate(rows):
        if r and codepred(r[0]) and len(r) > 1:
            return i
    raise RuntimeError("no data start found")

def load_seifa2011():
    """SEIFA 2011 SA1 cube Table* (all-index sheet):
    col0 = 7-digit SA1 code, col1 = IRSAD score (may be ''), col9 = URP."""
    rows, name = _sheet_rows_xls(f"{CUBES}/abs-seifa-2011-sa1-indexes.xls", summary_only=True)
    i0 = _data_start(rows, lambda c: isinstance(c, float) and c > 1e6)
    m = {}
    for r in rows[i0:]:
        if not isinstance(r[0], float) or r[0] < 1e6:
            continue
        sa1 = str(int(r[0]))
        score = r[1] if isinstance(r[1], float) else None
        dec = r[2] if isinstance(r[2], float) else None
        urp = r[9] if isinstance(r[9], float) else 0.0
        m[sa1] = (score, urp, dec)
    print(f"seifa2011 cube ({name}): {len(m)} SA1 rows")
    return m  # sa1_7digit_code -> (irsad|None, urp, decile|None)

def load_seifa2016():
    """SEIFA 2016 SA1 cube: col0 = 7-digit name, col1 = 11-digit SA1 code,
    col2 = IRSAD score, col10 = URP."""
    rows, name = _sheet_rows_xls(f"{CUBES}/abs-seifa-2016-sa1-indexes.xls", summary_only=True)
    i0 = _data_start(rows, lambda c: isinstance(c, float) and 1e6 < c < 1e10)
    m = {}
    for r in rows[i0:]:
        if len(r) < 11 or not isinstance(r[1], float):
            continue
        sa1 = str(int(r[1]))
        score = r[2] if isinstance(r[2], float) else None
        dec = r[3] if isinstance(r[3], float) else None
        urp = r[10] if isinstance(r[10], float) else 0.0
        m[sa1] = (score, urp, dec)
    print(f"seifa2016 cube ({name}): {len(m)} SA1 rows")
    return m  # sa1_maincode -> (irsad|None, urp, decile|None)

def load_seifa2021():
    """SEIFA 2021 SA1 cube Table 1: col0 = 11-digit SA1 (string),
    col1 = IRSAD score, col9 = URP."""
    wb = openpyxl.load_workbook(f"{CUBES}/abs-seifa-2021-sa1-indexes.xlsx",
                                read_only=True)
    sh = None
    for s in wb.worksheets:
        if s.title == "Table 1":
            sh = s
            break
    if sh is None:
        sh = max((s for s in wb.worksheets if s.max_row > 1000),
                 key=lambda s: s.max_row)
    m = {}
    for idx, row in enumerate(sh.iter_rows(values_only=True)):
        if idx < 6:
            continue
        c0 = row[0]
        if c0 is None or not re.fullmatch(r"\d{11}", str(c0)):
            continue
        score = row[1] if isinstance(row[1], (int, float)) else None
        dec = row[2] if isinstance(row[2], (int, float)) else None
        urp = row[9] if isinstance(row[9], (int, float)) else 0.0
        m[str(c0)] = (float(score) if score is not None else None,
                      float(urp), float(dec) if dec is not None else None)
    print(f"seifa2021 cube ({sh.title}): {len(m)} SA1 rows")
    return m  # sa1_maincode -> (irsad|None, urp, decile|None)

def load_mb_sa1_keys(year):
    """MB_20xx state allocation zips -> {sa1_maincode: sa1_7digit} (2011-2016)."""
    out = {}
    for st in "nsw vic qld sa wa tas nt act ot".split():
        z = zipfile.ZipFile(f"{DL}/1270055001_mb_{year}_{st}_csv.zip")
        inner = z.namelist()[0]
        with z.open(inner) as fh:
            rd = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig"))
            for row in rd:
                out[row[f"SA1_MAINCODE_{year}"]] = row[f"SA1_7DIGITCODE_{year}"]
    print(f"mb keys {year}: {len(out)} SA1 codes")
    return out

def load_ced_csv_zip(name, year):
    """CED_{year}_AUST.csv -> {sa1_maincode: (ced_code:int, ced_name)}."""
    z = zipfile.ZipFile(f"{DL}/1270055003_ced_{year}_aust_csv.zip")
    inner = z.namelist()[0]
    out = {}
    with z.open(inner) as fh:
        rd = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig"))
        k = list(rd.fieldnames)
        sa1col = next(c for c in k if c.startswith("SA1_MAINCODE"))
        ced = next(c for c in k if c.startswith("CED_CODE"))
        nam = next(c for c in k if c.startswith("CED_NAME"))
        for row in rd:
            out[row[sa1col]] = (int(row[ced]), row[nam])
    # drop pseudo-divisions for real-seat filtering
    real = {k: v for k, v in out.items() if not PSEUDO.search(v[1])}
    print(f"ced {year}: {len(out)} SA1 rows, {len(real)} mapped to real divisions")
    return out

def load_ced202x_xlsx(year):
    """CED_{year}_AUST.xlsx -> {MB_CODE_2021: (ced_code, ced_name)}."""
    wb = openpyxl.load_workbook(f"{DL}/ced{year}.xlsx", read_only=True)
    sh = wb.active
    it = sh.iter_rows(values_only=True)
    hdr = [str(h) for h in next(it)]
    ci = hdr.index(f"CED_CODE_{year}")
    ni = hdr.index(f"CED_NAME_{year}")
    mb = hdr.index("MB_CODE_2021")
    out = {}
    for row in it:
        if row[mb] is None or not str(row[ci]).isdigit():
            continue
        out[str(row[mb])] = (int(row[ci]), str(row[ni]))
    real = {k: v for k, v in out.items() if not PSEUDO.search(v[1])}
    print(f"ced {year}: {len(out)} MB rows, {len(real)} to real divisions")
    return out

def load_mb2021_sa1():
    """MB_2021_AUST.xlsx -> {MB_CODE_2021: SA1_CODE_2021}."""
    wb = openpyxl.load_workbook(f"{DL}/mb2021.xlsx", read_only=True)
    sh = wb.active
    it = sh.iter_rows(values_only=True)
    hdr = [str(h) for h in next(it)]
    mb, sa1 = hdr.index("MB_CODE_2021"), hdr.index("SA1_CODE_2021")
    out = {}
    for row in it:
        if row[mb] is not None:
            out[str(row[mb])] = str(row[sa1])
    print(f"mb2021->sa1: {len(out)} MB rows")
    return out

def load_mbcounts2021():
    """mbcounts2021.xlsx -> {MB_CODE_2021: persons}."""
    wb = openpyxl.load_workbook(f"{DL}/mbcounts2021.xlsx", read_only=True)
    out = {}
    for sh in wb.worksheets:
        if not sh.title.startswith("Table "):
            continue
        for idx, row in enumerate(sh.iter_rows(values_only=True)):
            if idx < 7 or row[0] is None:
                continue
            code = row[0]
            if isinstance(code, (int, float)) and 1e10 < float(code) < 1e11:
                code = str(int(code))
            if isinstance(code, str) and len(code) == 11 and code.isdigit():
                persons = row[4]
                out[code] = float(persons) if isinstance(persons, (int, float)) else 0.0
    print(f"mb counts 2021: {len(out)} MB rows")
    return out

# ------------------------------------------------------------ derivations

STATE_BY_BLOCK = {1: "NSW", 2: "Vic", 3: "Qld", 4: "SA", 5: "WA",
                  6: "Tas", 7: "NT", 8: "ACT", 9: "OT"}

def _finish_rows(accum):
    """{(ced_code, ced_name): [sum_ws, sum_w]} -> ranked rows."""
    ordered = sorted(((k[0], k[1], s / w) for k, (s, w) in accum.items() if w > 0),
                     key=lambda t: -t[2])
    ranks = list(range(1, len(ordered) + 1))
    qu, de = chunk(ranks, 4), chunk(ranks, 10)
    rows = []
    for rank, (code, name, score) in enumerate(ordered, start=1):
        st = STATE_BY_BLOCK.get(code // 100, "??")
        rows.append(dict(division=norm(name), state=st, irsad=round(score, 1),
                         rank=rank, quartile=qu[rank], decile=de[rank]))
    return rows

def derive_sa1_weighted(seifa, cedmap, sa1_key_of, tag):
    """Per-CED population-weighted IRSAD from SA1-level members.
    sa1_key_of: fn mapping a cedmap key -> a seifa-cube key.
    Returns (rows, dec_counts{ced_code:[10]}, pops{ced_code:float})."""
    accum = collections.defaultdict(lambda: [0.0, 0.0])
    dec_counts = collections.defaultdict(lambda: [0] * 10)
    dropped = collections.Counter()
    for sa1key, (code, name) in cedmap.items():
        if PSEUDO.search(name):
            continue
        cube_key = sa1_key_of(sa1key)
        score, urp, dec = seifa.get(cube_key, (None, 0.0, None))
        if score is None or urp <= 0:
            dropped["n"] += 1
            dropped["pop"] += urp
            continue
        a = accum[(code, name)]
        a[0] += score * urp
        a[1] += urp
        if dec is not None:
            dec_counts[code][int(dec) - 1] += 1
    print(f"  [{tag}] dropped {dropped['n']} unscored SA1s (pop {dropped['pop']:.0f})")
    rows = _finish_rows(accum)
    pops = {code: w for (code, _n), (_s, w) in accum.items()}
    return rows, dec_counts, pops

def derive_2011():
    seifa = load_seifa2011()
    keys = load_mb_sa1_keys(2011)                 # 7d -> maincode
    ced = load_ced_csv_zip("2011", 2011)          # maincode -> CED
    return derive_sa1_weighted(seifa, ced, lambda main: keys.get(main), "2013-row")

def derive_2016(edition):
    seifa = load_seifa2016()
    ced = load_ced_csv_zip(str(edition), edition) # maincode -> CED
    return derive_sa1_weighted(seifa, ced, lambda main: main, f"edition-{edition}")

def derive_2021(edition):
    seifa = load_seifa2021()
    mbsa1 = load_mb2021_sa1()
    counts = load_mbcounts2021()
    ced = load_ced202x_xlsx(edition)              # MB -> CED
    accum = collections.defaultdict(lambda: [0.0, 0.0])
    dec_pops = collections.defaultdict(lambda: [0.0] * 10)
    dropped = collections.Counter()
    for mb, (code, name) in ced.items():
        if PSEUDO.search(name):
            continue
        sa1 = mbsa1.get(mb)
        score, _u, dec = seifa.get(sa1, (None, 0.0, None)) if sa1 else (None, 0.0, None)
        w = counts.get(mb, 0.0)
        if score is None or w <= 0:
            if w > 0:
                dropped["pop"] += w
                dropped["n"] += 1
            continue
        a = accum[(code, name)]
        a[0] += score * w
        a[1] += w
        if dec is not None:
            dec_pops[code][int(dec) - 1] += w
    print(f"  [edition-{edition}] dropped {dropped['n']} unscored MBs (pop {dropped['pop']:.0f})")
    rows = _finish_rows(accum)
    pops = {code: w for (code, _n), (_s, w) in accum.items()}
    return rows, dec_pops, pops

# ------------------------------------------------------------ recon (QA)

def recon_sa1_deciles(tag, dist_xlsx, table_cols, mine, year):
    """Compare recomputed SA1-decile counts per CED with the ABS CED SA1
    Distributions cube table (IRSAD table). Exact-equality expected — any
    delta means a parse/membership defect, not methodology disagreement."""
    rows, _sheet = _sheet_rows_xls(dist_xlsx) if dist_xlsx.endswith(".xls") else (None, None)
    if rows is None:
        wbx = openpyxl.load_workbook(dist_xlsx, read_only=True)
        sh = max((s for s in wbx.worksheets if s.max_row > 40), key=lambda s: s.max_row)
        rows = [list(r) for r in sh.iter_rows(values_only=True)]
    # data rows: first col numeric CED code, then name, blank, 10x decile counts
    c0 = table_cols[0] if isinstance(table_cols, (list, tuple)) else int(table_cols)
    mismatches, checked = 0, 0
    for r in rows:
        if not r or not isinstance(r[0], float):
            continue
        code = int(r[0])
        if code not in mine:
            continue
        vals = [int(v) for v in r[c0:c0 + 10]]
        if sum(vals) == 0:
            continue
        checked += 1
        if vals != list(mine[code]):
            mismatches += 1
            if mismatches <= 5:
                print(f"  recon {tag} MISMATCH ced {code}: abs={vals} mine={list(mine[code])}")
    print(f"  recon {tag}: {checked} CEDs compared, {mismatches} mismatched")
    assert mismatches == 0, f"{tag}: {mismatches}/{checked} CED decile rows mismatch ABS distributions"

def pop_shares_2021(rows_counted):
    out = {}
    for code, vec in rows_counted.items():
        t = sum(vec)
        out[code] = [v / t * 100 for v in vec] if t else None
    return out

# ------------------------------------------------------- assembly and emit

import functools
for _f in (load_seifa2011, load_seifa2016, load_seifa2021, load_mb_sa1_keys,
           load_ced_csv_zip, load_ced202x_xlsx, load_mb2021_sa1, load_mbcounts2021):
    globals()[_f.__name__] = functools.lru_cache(maxsize=None)(_f)

def ranks_for(rows):
    """Give rows[{division,state,irsad}] rank/decile/quartile by score."""
    ordered = sorted(rows, key=lambda r: -r["irsad"])
    ranks = list(range(1, len(ordered) + 1))
    qu, de = chunk(ranks, 4), chunk(ranks, 10)
    for rank, r in enumerate(ordered, start=1):
        r.update(rank=rank, quartile=qu[rank], decile=de[rank])
    return ordered

def assert_names(tag, rows, inside, outside, count):
    names = {r["division"] for r in rows}
    missing = [n for n in inside if n not in names]
    stray = [n for n in outside if n in names]
    assert not missing, f"{tag}: expected divisions missing: {missing}"
    assert not stray, f"{tag}: unexpected divisions present: {stray}"
    assert not count or len(rows) == count, f"{tag}: {len(rows)} seats != {count}"

def main():
    # -- published tables
    rr5 = parse_rr5_att1(f"{ROOT}/cache/rr5.txt")
    aph04 = parse_aph05cib01(f"{ROOT}/src/aph/aph-05cib01.txt")
    aph06 = parse_aph_table2a(f"{ROOT}/src/aph/aph-09rp02.txt", "09rp02")
    aph10 = parse_aph_table2a(f"{ROOT}/src/aph/aph-11rp01.txt", "11rp01")
    assert_names("e2004", aph04, inside=["Bonner", "Gorton"],
                 outside=["Bonython", "Burke"], count=150)

    # -- ABS-cube derivations
    d13, dec13, pop13 = derive_2011()
    assert_names("e2013", d13, inside=["Wright", "Charlton", "Hunter", "Fraser",
                                       "Throsby"],
                 outside=["Fenner", "Whitlam"], count=150)
    recon_sa1_deciles("2011ced", f"{ROOT}/src/abs/abs-seifa-2011-ced-sa1-distributions.xls",
                      3, dec13, 2011)
    d16, dec16, pop16 = derive_2016(2016)
    assert_names("e2016set", d16, inside=["Burt", "Fenner", "Whitlam", "Hunter"],
                 outside=["Charlton", "Throsby", "Fraser"], count=150)
    recon_sa1_deciles("2016ced", f"{ROOT}/src/abs/abs-seifa-2016-sa1-distributions-ced.xls",
                      3, dec16, 2016)
    d19, _dec18, pop19 = derive_2016(2018)
    assert_names("e2019", d19, inside=["Cooper", "Macnamara", "Monash", "Fraser",
                                       "Bean", "Spence"],
                 outside=["Batman", "Melbourne Ports", "McMillan", "Port Adelaide"],
                 count=151)
    d22, dcp22, pop22 = derive_2021(2021)
    assert_names("e2022", d22, inside=["Bean", "Fenner", "Hawke"],
                 outside=["Stirling"], count=151)
    d25, _dcp24, pop25 = derive_2021(2024)
    assert_names("e2025set", d25, inside=["Bullwinkel"],
                 outside=["Higgins", "North Sydney"], count=150)
    d28, _dcp25, pop28 = derive_2021(2025)
    assert_names("e2028set", d28, inside=["Bullwinkel"],
                 outside=["Higgins", "North Sydney"], count=150)
    # national-scale population sanity for the 2021-era rows: each national
    # decile should carry ~10% of the counted population.
    nat = [sum(v[i] for v in dcp22.values() if v) for i in range(10)]
    tot = sum(nat)
    shares = [x / tot * 100 for x in nat]
    print("  e2022 national decile pop shares:", [round(x, 2) for x in shares])
    assert all(9.5 < x < 10.5 for x in shares), "2021 decile national pop shares out of 10%±0.5"

    elections = {
        2001: dict(censusYear=2001, editionInForce=2000, derivation="published",
                   sourceProduct="AEC Research Report No. 5 (2005), Attachment 1 — 2001 Census, 2001 boundaries",
                   rows=ranks_for(rr5)),
        2004: dict(censusYear=2001, editionInForce=2003, derivation="published",
                   sourceProduct="APH Current Issues Brief no.1 2004-05 (2001 Census, 2003 boundaries) — "
                                 "Index of Relative Socio-Economic Advantage/Disadvantage table",
                   rows=ranks_for(aph04)),
        2007: dict(censusYear=2006, editionInForce=2006, derivation="published",
                   sourceProduct="APH Research Paper no.2 2008-09, Table 2a — 2006 Census, 2006 boundaries",
                   rows=ranks_for(aph06)),
        2010: dict(censusYear=2006, editionInForce=2009, derivation="published",
                   sourceProduct="APH Research Paper no.1 2010-11, Table 2a — 2006 Census, 2009 boundaries",
                   rows=ranks_for(aph10)),
        2013: dict(censusYear=2011, editionInForce=2010, derivation="weighted",
                   sourceProduct="ABS SEIFA 2011 SA1 cube × CED_2011_AUST allocations (ABS 2039.0 §2.2 weighted derivation)",
                   rows=d13),
        2016: dict(censusYear=2016, editionInForce=2016, derivation="weighted",
                   sourceProduct="ABS SEIFA 2016 SA1 cube × CED_2016_AUST allocations",
                   rows=d16),
        2019: dict(censusYear=2016, editionInForce=2018, derivation="weighted",
                   sourceProduct="ABS SEIFA 2016 SA1 cube × CED_2018_AUST allocations",
                   rows=d19),
        2022: dict(censusYear=2021, editionInForce=2021, derivation="weighted",
                   sourceProduct="ABS SEIFA 2021 SA1 cube × CED_2021_AUST MB allocations + 2021 census MB counts",
                   rows=d22),
        2025: dict(censusYear=2021, editionInForce=2024, derivation="weighted",
                   sourceProduct="ABS SEIFA 2021 SA1 cube × CED_2024_AUST MB allocations + 2021 census MB counts",
                   rows=d25),
        2028: dict(censusYear=2021, editionInForce=2025, derivation="weighted", forward=True,
                   sourceProduct="ABS SEIFA 2021 SA1 cube × CED_2025_AUST MB allocations + 2021 census MB counts",
                   rows=d28),
    }

    doc = {
        "product": "irsad-by-division",
        "generated": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "description": "IRSAD per Commonwealth electoral division per election — published "
                       "tables (AEC RR5 Att1; APH CIB 1/2004-05 and the 2008/2010 research "
                       "papers) plus ABS-cube population-weighted derivations (ABS guidance "
                       "2039.0 §2.2).",
        "comparability": "Index definitions are recomputed each census — compare across "
                         "eras via rank/decile/quartile only, never raw scores.",
        "rankConvention": "rank 1 = most advantaged (highest IRSAD score); decile/quartile "
                          "ascend with disadvantage. RR5's printed ranks (1 = most "
                          "disadvantaged) are re-ranked by score on ingest.",
        "elections": elections,
    }
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    counts = {y: len(e["rows"]) for y, e in elections.items()}
    print("emitted", OUT_JSON, counts)

if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "selftest":
    r5 = parse_rr5_att1(f"{ROOT}/cache/rr5.txt")
    assert r5[0]["division"] == "Bonython" and r5[0]["irsad"] == 882
    assert r5[-1]["irsad"] == 1204 and r5[-1]["division"] == "Bradfield"
    q04 = parse_aph05cib01(f"{ROOT}/src/aph/aph-05cib01.txt")
    by04 = {r["division"]: r["irsad"] for r in q04}
    assert by04["Lingiari"] == 987.0 and by04["Bradfield"] == 1203.7
    assert by04["Adelaide"] == 1059.3 and "O'Connor" in by04
    assert "Bonner" in by04 and "Gorton" in by04
    assert "Bonython" not in by04 and "Burke" not in by04
    q06 = parse_aph_table2a(f"{ROOT}/src/aph/aph-09rp02.txt", "09rp02")
    q10 = parse_aph_table2a(f"{ROOT}/src/aph/aph-11rp01.txt", "11rp01")
    assert q06[0]["division"] == "Adelaide" and q06[0]["irsad"] == 1029.0
    assert q10[0]["division"] == "Adelaide" and q10[0]["irsad"] == 1028.8
    print("selftest OK")
elif __name__ == "__main__":
    main()
