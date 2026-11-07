#!/usr/bin/env python3
"""maps/data/areas-sa1-2021.json — the /map/ Areas draw's census pack (2021 vintage).

The map's Seats and Surface drawings paint census figures seat-by-seat: the
seat stores pool SA1s up to each seat (sa1/venue/voter bases, depending on
the frame), and the smoothed field then estimates BETWEEN the polling places.
The Areas drawing is the missing bottom rung: the ABS's own SA1 census areas,
painted with the figures as counted, no pooling and no smoothing. This script
builds the one lazy pack the drawing reads: national SA1 geometry (topojson,
simplified for suburb-zoom reading) plus every Census-lens measure as a typed
per-SA1 lane aligned to the geometry order, with per-lane key extents (caps,
population-weighted p99.5) and the pooled national/state marks the legend's
benchmark lines ride.

Bases mirror the map's existing census stores exactly: the lane formulas come
from build_sa26_demo.py's shares() and its gcp_newlanes readers (the same
GCP tables, the same ex-not-stated denominators); the median lanes read the
GCP G02's own printed medians per SA1; the SEIFA lanes read the ABS's
published 2021 SA1 cube deciles (areas ranked into tenths nationally — the
seats' "ranked into tenths of the seats" is a different, intentional, thing).
The homeless lane is deliberately absent: it is an SA2 estimate shared down
to SA1s, never an SA1 count (the plan's user call).

Inputs (every one already a cache of this repo's other pipelines):
  .build/analysis/seat-model/cache/gcp-sa1-2021.zip              (GCP 2021 SA1 datapack)
  .build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip (SA1 2021 polygons)
  .matilda/seifa-irsad-abs/abs-seifa-2021-sa1-indexes.xlsx       (SEIFA 2021 SA1 cube)
  data/income-dist.json                                          (income adults factors)
  data/sa26-demo.json + .build/map/sa26/assign-sa1.json          (cross-check oracle)

Test: `npm test`'s .build/test-map-areas.mjs conformance + service pins; the
served drawing itself is probed headlessly (pixel reads, .matilda/probe).

usage: python3 -I .build/map/build_areas_sa1.py
       MAPSHAPER=path/to/mapshaper python3 -I .build/map/build_areas_sa1.py
"""
import base64
import csv
import gzip
import hashlib
import io
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gcp_newlanes  # noqa: E402

GCP_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "gcp-sa1-2021.zip")
SA1_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "SA1_2021_AUST_SHP_GDA2020.zip")
CUBE_XLSX = os.path.join(REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2021-sa1-indexes.xlsx")
SA26_DEMO = os.path.join(REPO, "data", "sa26-demo.json")
SA26_ASSIGN = os.path.join(REPO, ".build", "map", "sa26", "assign-sa1.json")
OUT = os.path.join(REPO, "maps", "data", "areas-sa1-2021.json")
MAPSHAPER = os.environ.get("MAPSHAPER", os.path.join(REPO, "node_modules", ".bin", "mapshaper"))

try:
    import openpyxl
except ImportError:
    raise SystemExit("areas-sa1: needs openpyxl (the SEIFA cube reader uses it, as build_sa26_seifa.py does)")

GCP_MEMBER = "2021 Census GCP Statistical Area 1 for AUS/2021Census_%s_AUST_SA1.csv"
GCP_ROWS = 61844          # national GCP SA1 rows, every table (pins all readers)
CUBE_CODE_ROWS = 59421    # national SEIFA cube Table 1 code rows
NAT_PERSONS_MIN, NAT_PERSONS_MAX = 25_000_000, 26_000_000  # 2021 census ≈ 25.42M
IX = ["irsad", "irsd", "ier", "ieo"]
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}
JUR_OF = {"1": "NSW", "2": "VIC", "3": "QLD", "4": "SA", "5": "WA", "6": "TAS",
          "7": "NT", "8": "ACT", "9": "OT"}
JURS = ["AUS", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]

# the birthplace package's ten-country tuple, site-key order (the demo
# builders' COB_KEYS for 2021-census bases)
COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka", "sct"]

AGE_BANDS = [("0_4", 0, 4), ("5_14", 5, 14), ("15_19", 15, 19), ("20_24", 20, 24),
             ("25_34", 25, 34), ("35_44", 35, 44), ("45_54", 45, 54), ("55_64", 55, 64),
             ("65_74", 65, 74), ("75_84", 75, 84), ("85ov", 85, None)]
AGE_1824_OF_1519 = 2 / 5  # the census-grid constant the map's own age lane uses


def fail(msg):
    raise SystemExit(f"areas-sa1: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# ------------------------------------------------------------ the polygons
def read_dbf():
    """The ABS SA1 pack's DBF, stdlib-read (sa26_geo.py's recipe):
    code -> {sa2, area km², jur}, the lone ZZZZZZZZZZZ null record asserted."""
    if not os.path.exists(SA1_ZIP):
        fail(f"missing SA1 polygons {SA1_ZIP} (see docstring refetch)")
    with zipfile.ZipFile(SA1_ZIP) as z:
        dbf = z.read("SA1_2021_AUST_GDA2020.dbf")
    nrec, hlen, rlen = struct.unpack_from("<IHH", dbf, 4)
    byname = {}
    off, pos = 32, 1
    while dbf[off] != 0x0D:
        name = dbf[off:off + 11].split(b"\x00")[0].decode("ascii")
        flen = dbf[off + 16]
        byname[name] = (pos, flen)
        pos += flen
        off += 32
    want = ["SA1_CODE21", "SA2_NAME21", "AREASQKM21"]
    if any(w not in byname for w in want):
        fail(f"DBF header drift, missing {[w for w in want if w not in byname]}")
    out = {}
    zeds = 0
    for i in range(nrec):
        rec = dbf[hlen + i * rlen: hlen + (i + 1) * rlen]
        row = {}
        for nm in want:
            rel, flen = byname[nm]
            row[nm] = rec[rel:rel + flen].decode("ascii", "replace").strip()
        code = row["SA1_CODE21"]
        if code == "ZZZZZZZZZZZ":
            zeds += 1
            continue
        try:
            area = float(row["AREASQKM21"])
        except ValueError:
            area = 0.0
        out[code] = {"sa2": row["SA2_NAME21"], "area": area,
                     "jur": JUR_OF.get(code[0], "OT")}
    if zeds != 1:
        fail(f"DBF null-record sentinels {zeds} != 1")
    if len(out) != GCP_ROWS:
        fail(f"DBF non-sentinel records {len(out)} != {GCP_ROWS}")
    print(f"DBF: {len(out)} SA1 attribute rows")
    return out


def run_mapshaper(tmp):
    """The suburb-zoom grain the prototype proved: 8% keep-shapes, planar,
    1e5 quantisation. Returns the parsed topojson."""
    if not os.path.exists(MAPSHAPER):
        fail(f"missing mapshaper at {MAPSHAPER} (npm install, or MAPSHAPER=...)")
    with zipfile.ZipFile(SA1_ZIP) as z:
        for part in ("shp", "shx", "dbf", "prj"):
            z.extract(f"SA1_2021_AUST_GDA2020.{part}", tmp)
    shp = os.path.join(tmp, "SA1_2021_AUST_GDA2020.shp")
    topo_path = os.path.join(tmp, "sa1.topo.json")
    cmd = [MAPSHAPER, shp,
           "-filter", "AREASQKM21>0",
           "-filter-fields", "SA1_CODE21",
           "-simplify", "8%", "keep-shapes", "planar",
           "-clean",
           "-o", topo_path, "format=topojson", "quantization=1e5"]
    if subprocess.run(cmd, capture_output=True, text=True).returncode != 0:
        r = subprocess.run(cmd, capture_output=True, text=True)
        fail(f"mapshaper failed: {r.stderr.strip()[:400]}")
    if not os.path.exists(topo_path):
        fail("mapshaper wrote no topojson")
    with open(topo_path) as f:
        topo = json.load(f)
    objs = [k for k, o in topo.get("objects", {}).items() if o.get("geometries")]
    if len(objs) != 1:
        fail(f"topojson object layers {objs} (want exactly one)")
    return topo


# ------------------------------------------------------------ the GCP cells
def read_table(z, member, cols):
    member = GCP_MEMBER % member
    if member not in z.namelist():
        fail(f"GCP zip lacks {member}")
    out = {}
    n = 0
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        fn = rdr.fieldnames or []
        miss = [c for c in ["SA1_CODE_2021", *cols] if c not in fn]
        if miss:
            fail(f"GCP {member.split('/')[-1]} header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row["SA1_CODE_2021"]
            if code in out:
                fail(f"GCP {member.split('/')[-1]} dup code {code}")
            vals = []
            for c in cols:
                v = row[c].strip()
                vals.append(int(v) if v.lstrip("-").isdigit() else None)
            out[code] = tuple(vals)
    if n != GCP_ROWS:
        fail(f"GCP {member.split('/')[-1]} rows {n} != pin {GCP_ROWS}")
    return out


def load_cells(dbf):
    """code -> record dict of every raw count the lanes divide."""
    if not os.path.exists(GCP_ZIP):
        fail(f"missing GCP input {GCP_ZIP}")
    base = gcp_newlanes.demo_base(GCP_ZIP, era="2021")   # national prefix ""
    nlt = gcp_newlanes.load(GCP_ZIP, era="2021")
    arc = gcp_newlanes.load_arc31(GCP_ZIP, era="2021")
    inc, cutrec = gcp_newlanes.state_income(GCP_ZIP, "2021", "")
    z = zipfile.ZipFile(GCP_ZIP)
    f09 = read_table(z, "G09F", ["P_Australia_Tot", "P_England_Tot", "P_China_Tot"])
    g09 = read_table(z, "G09G", ["P_India_Tot", "P_New_Zealand_Tot", "P_Italy_Tot"])
    h09 = read_table(z, "G09H", ["P_Tot_Tot", "P_COB_NS_Tot", "P_Philippines_Tot",
                                 "P_Vietnam_Tot", "P_South_Africa_Tot",
                                 "P_Scotland_Tot", "P_Sri_Lanka_Tot"])
    g02 = read_table(z, "G02", ["Median_age_persons", "Median_tot_hhd_inc_weekly"])
    z.close()
    for tag, d in (("G09F", f09), ("G09G", g09), ("G09H", h09), ("G02", g02),
                   ("nlt", nlt), ("arc", arc), ("inc", inc)):
        if set(d) != set(base):
            fail(f"GCP {tag} SA1 universe != G01's ({len(d)} vs {len(base)})")

    rec = {}
    for code, b in base.items():
        (totP, eng, oth, bands, aust, cobTot, cobNS, uni4, occ8) = b
        sch6, indt, (relvec, relns, reltot), ten6, fam = nlt[code]
        citz, (ptn, ptt, ptns), (ceb3, cebns, cebt), (ancv, ancp, ancns) = arc[code]
        (aud, _lom, _him, _med_b, bands_ad, hh, _hiqm) = inc[code]
        ageM02, incM02 = g02[code]
        q09f, q09g, q09h = f09[code], g09[code], h09[code]
        # the ten-country cob tuple in COB_KEYS order, off the three G09 tables
        cob10 = (q09f[1], q09g[0], q09f[2], q09g[1], q09h[2], q09h[3],
                 q09h[4], q09g[2], q09h[6], q09h[5])
        rec[code] = {
            "p": totP, "eng": eng, "oth": oth, "bands": tuple(bands),
            "aust": aust, "cobTot": cobTot, "cobNS": cobNS,
            "uni3": uni4[0] + uni4[1] + uni4[2], "eduNS": uni4[3],
            "blue": occ8[2] + occ8[6] + occ8[7], "occ8": sum(occ8),
            "cob10": cob10,
            "sch6": sch6, "indN": indt[0], "indD": indt[1],
            "relvec": relvec, "relNS": relns, "relTot": reltot,
            "ten6": ten6, "famN": fam[0], "famD": fam[1],
            "citz": citz, "ptn": ptn, "ptt": ptt, "ptNS": ptns,
            "ceb3": ceb3, "cebNS": cebns, "cebT": cebt,
            "ancvec": ancv, "ancP": ancp, "ancNS": ancns,
            "incAd": aud, "bandsAd": bands_ad, "hh": hh,
            "ageMed": ageM02, "incMed": incM02,
            "jur": dbf[code]["jur"],
        }
    persons = sum(r["p"] for r in rec.values())
    if not (NAT_PERSONS_MIN <= persons <= NAT_PERSONS_MAX):
        fail(f"national GCP persons {persons} outside {NAT_PERSONS_MIN}..{NAT_PERSONS_MAX}")
    print(f"GCP cells: {len(rec)} SA1s, {persons} persons; "
          f"income cuts ${cutrec['loCutWeekly']:.0f}/${cutrec['hiQCutWeekly']:.0f}")
    return rec, cutrec


def load_seifa():
    """code -> {ix: decile 1..10 or None}, off the ABS's own published
    national deciles (each score column's twin decile column, asserted)."""
    if not os.path.exists(CUBE_XLSX):
        fail(f"missing SEIFA cube {CUBE_XLSX} (see docstring refetch)")
    wb = openpyxl.load_workbook(CUBE_XLSX, read_only=True)
    if "Table 1" not in wb.sheetnames:
        fail(f"cube sheets {wb.sheetnames} lack 'Table 1'")
    sh = wb["Table 1"]
    hdr = list(sh.iter_rows(values_only=True, max_row=6))
    title_row = list(hdr[4])
    canon = lambda t: " ".join(str(t).upper().split())
    cols = {}
    for i, t in enumerate(title_row):
        if not t:
            continue
        for ix, wanted in INDEX_TITLES.items():
            if ix in cols:
                continue
            if any(w in canon(t) for w in wanted):
                cols[ix] = i
                break
    if set(cols) != set(IX):
        fail(f"cube header drift: resolved {sorted(cols)} — {title_row!r}")
    out, nrows = {}, 0
    for row in sh.iter_rows(values_only=True, min_row=7):
        v = row[0] if row else None
        if isinstance(v, float):
            v = int(v)
        v = str(v) if v is not None else ""
        if not (len(v) == 11 and v.isdigit()):
            continue
        nrows += 1
        rec = {}
        for ix in IX:
            sc, dc = row[cols[ix]], row[cols[ix] + 1]
            # a suppressed index prints '-' in both cells (never None here)
            if not (isinstance(sc, (int, float)) and isinstance(dc, (int, float))):
                rec[ix] = None
                continue
            if not 1 <= dc <= 10:
                fail(f"cube row {v}: decile drifted ({ix}: {sc!r}, {dc!r})")
            rec[ix] = int(dc)
        out[v] = rec
    if nrows != CUBE_CODE_ROWS:
        fail(f"cube Table 1 code rows {nrows} != pin {CUBE_CODE_ROWS}")
    suppressed = sum(1 for r in out.values() if all(r[ix] is None for ix in IX))
    print(f"SEIFA cube: {len(out)} rows ({suppressed} carry no published score)")
    return out


# ------------------------------------------------------------ the lanes
# each share lane: (numerator, denominator) over one SA1's record; a zero (or
# negative) denominator makes the cell null, never a read
def _bands_sum(r):
    return sum(r["bands"])


_TEN_BASIS = lambda r: r["ten6"][0] + r["ten6"][1] + r["ten6"][2] + r["ten6"][4]  # noqa: E731
SHARES = {
    "lang": (lambda r: r["oth"], lambda r: r["eng"] + r["oth"]),
    "fborn": (lambda r: (r["cobTot"] - r["cobNS"]) - r["aust"], lambda r: r["cobTot"] - r["cobNS"]),
    "uni": (lambda r: r["uni3"], lambda r: (r["p"] - r["bands"][0] - r["bands"][1]) - r["eduNS"]),
    "blue": (lambda r: r["blue"], lambda r: r["occ8"]),
    "y12less": (lambda r: sum(r["sch6"][1:]), lambda r: sum(r["sch6"])),
    "atsci": (lambda r: r["indN"], lambda r: r["indD"]),
    "u15": (lambda r: r["bands"][0] + r["bands"][1], _bands_sum),
    "onepar": (lambda r: r["famN"], lambda r: r["famD"]),
    "pt": (lambda r: r["ptn"], lambda r: r["ptt"] - r["ptNS"]),
    "noncit": (lambda r: r["p"] - r["citz"], lambda r: r["p"]),
    "bigfam": (lambda r: r["ceb3"], lambda r: r["cebT"] - r["cebNS"]),
    "a65": (lambda r: r["bands"][8] + r["bands"][9] + r["bands"][10], _bands_sum),
    "a2034": (lambda r: r["bands"][3] + r["bands"][4], _bands_sum),
    "a1824": (lambda r: r["bands"][2] * AGE_1824_OF_1519 + r["bands"][3], _bands_sum),
    "a3554": (lambda r: r["bands"][5] + r["bands"][6], _bands_sum),
    "a75": (lambda r: r["bands"][9] + r["bands"][10], _bands_sum),
}
for _i, _k in enumerate(gcp_newlanes.REL_KEYS):
    SHARES[f"rel.{_k}"] = ((lambda i: (lambda r: r["relvec"][i]))(_i),
                           (lambda r: r["relTot"] - r["relNS"]))
for _k, _i in {"mort": 1, "rent": 2, "own": 0, "rentPub": 3}.items():
    SHARES[f"ten.{_k}"] = ((lambda i: (lambda r: r["ten6"][i]))(_i), _TEN_BASIS)
_FBDEN = lambda r: r["cobTot"] - r["cobNS"]  # noqa: E731
for _i, _k in enumerate(COB_KEYS):
    SHARES[f"cob.{_k}"] = ((lambda i: (lambda r: r["cob10"][i]))(_i), _FBDEN)
_ANCDEN = lambda r: r["ancP"] - r["ancNS"]  # noqa: E731
for _i, _k in enumerate(gcp_newlanes.ANC_KEYS):
    SHARES[f"anc.{_k}"] = ((lambda i: (lambda r: r["ancvec"][i]))(_i), _ANCDEN)

# the income quartile lanes are cut-relative: the seat stores measure them
# against each frame-universe's own incomeCuts record (national cuts on the
# federal frames, state cuts on the state frames), so the pack carries each
# SA1's sixteen adults-basis band masses and the shares are computed at draw
# time against the frame in view's cuts; the builder's marks use the same
# per-universe cuts, computed freshly per jurisdiction
INC_BANDS = gcp_newlanes.INC_BANDS
def inc_masses(band, cutlo, cuthi):
    """(mass below cutlo, mass above cuthi) of a per-SA1 adults-basis band
    tuple — gcp_newlanes.state_income's own per-SA1 walk, parameterised."""
    lo_mass = 0.0
    for i, (lo, hi) in enumerate(INC_BANDS):
        if cutlo <= lo:
            continue
        if hi is not None and cutlo > hi:
            lo_mass += band[i]
            continue
        lo_mass += band[i] * (cutlo - lo) / (hi - lo + 1)
        break
    hi_mass = sum(band)
    for i, (lo, hi) in enumerate(INC_BANDS):
        if cuthi <= lo:
            break
        if hi is not None and cuthi > hi:
            hi_mass -= band[i]
            continue
        hi_mass -= band[i] * (cuthi - lo) / (hi - lo + 1)
        break
    return lo_mass, hi_mass


LANE_ORDER = (["lang", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar",
               "pt", "noncit", "bigfam", "loinc", "hiqinc",
               "a65", "a2034", "a1824", "a3554", "a75"]
              + [f"rel.{k}" for k in gcp_newlanes.REL_KEYS]
              + [f"ten.{k}" for k in ["mort", "rent", "own", "rentPub"]]
              + [f"cob.{k}" for k in COB_KEYS]
              + [f"anc.{k}" for k in gcp_newlanes.ANC_KEYS]
              + ["ageMed", "incMed"]
              + [f"sf.{ix}" for ix in IX])
if set(LANE_ORDER) != set(SHARES) | {"ageMed", "incMed", "loinc", "hiqinc"} | {f"sf.{ix}" for ix in IX}:
    fail("lane-order table drifted from the shares table")


def nice_up(x, cap):
    """A tidy key top just past the pop-weighted p99.5: 1s to 10, 5s to 30,
    10s above; never above the measure's cap."""
    if x <= 0:
        return None
    if x <= 10:
        v = int(x) + (1 if x > int(x) else 0)
    elif x <= 30:
        v = 5 * int((x + 4.999999) / 5)
    else:
        v = 10 * int((x + 9.999999) / 10)
    return min(cap, max(1, v))


def build_lanes(rec, order, seifa, dbf, universe_cuts):
    """Paint lanes aligned to the geometry order, plus caps and marks."""
    sa2names, sa2pos = [], {}
    lanes = {k: bytearray(len(order)) for k in SHARES}
    age_med = bytearray(len(order))
    inc_med = bytearray(2 * len(order))
    inc_bands = bytearray(32 * len(order))           # 16 uint16-le adults masses
    sfdec = {ix: bytearray(len(order)) for ix in IX}
    pop = bytearray(4 * len(order))
    area = bytearray(4 * len(order))
    sa2i = bytearray(2 * len(order))
    hists = {k: [0] * 1001 for k in SHARES}          # pop-weighted, per-mille value
    hists["loinc"] = [0] * 1001
    hists["hiqinc"] = [0] * 1001
    med_vals = {"ageMed": [], "incMed": []}          # (value, pop) per published cell
    pool = {k: {j: [0.0, 0.0] for j in JURS} for k in SHARES}
    inc_pool = {k: {j: [0.0, 0.0] for j in JURS} for k in ("loinc", "hiqinc")}
    age_pool = {j: [0.0] * len(AGE_BANDS) for j in JURS}
    inc_hh_pool = {j: [0.0] * len(gcp_newlanes.INC_BANDS) for j in JURS}
    nulls = {k: 0 for k in SHARES}
    nulls["inc"] = 0
    cutlo_aus, cuthi_aus = universe_cuts["AUS"]

    for i, code in enumerate(order):
        r = rec[code]
        jur, p = r["jur"], r["p"]
        struct.pack_into("<I", pop, 4 * i, p)
        struct.pack_into("<I", area, 4 * i, int(round(dbf[code]["area"] * 100)))
        nm = dbf[code]["sa2"]
        ix2 = sa2pos.get(nm)
        if ix2 is None:
            ix2 = len(sa2names)
            sa2names.append(nm)
            sa2pos[nm] = ix2
        struct.pack_into("<H", sa2i, 2 * i, ix2)
        for k, (nf, df) in SHARES.items():
            den = df(r)
            num = nf(r) if den > 0 else None
            if num is None or num < -1e-9:
                lanes[k][i] = 255
                nulls[k] += 1
                continue
            v = max(0.0, min(1.0, num / den))
            lanes[k][i] = int(round(v * 200))
            if p > 0:
                hists[k][min(1000, int(round(v * 1000)))] += p
                pool[k]["AUS"][0] += num
                pool[k]["AUS"][1] += den
                if jur != "OT":
                    pool[k][jur][0] += num
                    pool[k][jur][1] += den
        for bi in range(len(AGE_BANDS)):
            age_pool["AUS"][bi] += r["bands"][bi]
            if jur != "OT":
                age_pool[jur][bi] += r["bands"][bi]
        for bi in range(len(gcp_newlanes.INC_BANDS)):
            inc_hh_pool["AUS"][bi] += r["hh"][bi]
            if jur != "OT":
                inc_hh_pool[jur][bi] += r["hh"][bi]
        bands = [int(round(v)) for v in r["bandsAd"]]
        if sum(bands) <= 0:
            nulls["inc"] += 1
        else:
            struct.pack_into("<16H", inc_bands, 32 * i, *bands)
            if p > 0:
                lo_a, hi_a = inc_masses(bands, cutlo_aus, cuthi_aus)
                aud = sum(bands)
                hists["loinc"][min(1000, int(round(1000 * lo_a / aud)))] += p
                hists["hiqinc"][min(1000, int(round(1000 * hi_a / aud)))] += p
                fl = r["bandsAd"]  # the unrounded masses price the marks
                for jur2, (clo, chi) in universe_cuts.items():
                    if jur2 != "AUS":
                        if jur != jur2:
                            continue
                    lo_m, hi_m = inc_masses(fl, clo, chi)
                    inc_pool["loinc"][jur2][0] += lo_m
                    inc_pool["loinc"][jur2][1] += r["incAd"]
                    inc_pool["hiqinc"][jur2][0] += hi_m
                    inc_pool["hiqinc"][jur2][1] += r["incAd"]
        if r["ageMed"] is not None and 0 < r["ageMed"] < 128:
            age_med[i] = int(r["ageMed"])
            if p > 0:
                med_vals["ageMed"].append((int(r["ageMed"]), p))
        else:
            age_med[i] = 255
        if r["incMed"] is not None and 0 < r["incMed"] < 65000:
            struct.pack_into("<H", inc_med, 2 * i, int(r["incMed"]))
            if p > 0:
                med_vals["incMed"].append((int(r["incMed"]), p))
        else:
            struct.pack_into("<H", inc_med, 2 * i, 65535)
        row = seifa.get(code)
        for ix in IX:
            sfdec[ix][i] = (row and row.get(ix)) or 0

    caps, marks = {}, {}
    for k in list(SHARES) + ["loinc", "hiqinc"]:
        tot = sum(hists[k])
        if tot <= 0:
            fail(f"lane {k}: nothing painted")
        acc, hi = 0, None
        for b in range(1001):
            acc += hists[k][b]
            if acc / tot >= 0.995:
                hi = b / 10
                break
        caps[k] = [0, nice_up(hi, 100)]
        mk = {}
        src = inc_pool.get(k)
        for j in JURS:
            n, d = (src or pool[k])[j]
            mk[j] = round(n / d, 4) if d > 0 else None
        marks[k] = mk
    for k, vals in med_vals.items():
        vals.sort()
        tot = sum(w for _v, w in vals)
        acc, lo, hi = 0, None, None
        for v, w in vals:
            acc += w
            if lo is None and acc / tot >= 0.005:
                lo = v
            if acc / tot >= 0.995:
                hi = v
                break
        if k == "ageMed":
            caps[k] = [max(0, (lo // 5) * 5), min(110, ((hi or 90) + 4) // 5 * 5)]
        else:
            caps[k] = [max(0, (lo // 100) * 100), ((hi or 4000) + 99) // 100 * 100]
    for j in JURS:
        masses = age_pool[j]
        t = sum(masses)
        v = None
        if t > 0:
            half, acc = t / 2, 0.0
            for (_bk, lo2, hi2), mm in zip(AGE_BANDS, masses):
                if acc + mm >= half:
                    if hi2 is not None and mm > 0:
                        v = min(hi2, int(lo2 + (hi2 + 1 - lo2) * (half - acc) / mm))
                    break
                acc += mm
        marks.setdefault("ageMed", {})[j] = v
        med = gcp_newlanes.band_median(inc_hh_pool[j], gcp_newlanes.INC_BANDS)
        marks.setdefault("incMed", {})[j] = int(round(med)) if med is not None else None
    for ix in IX:
        caps[f"sf.{ix}"] = [1, 10]
    if set(caps) != set(LANE_ORDER):
        fail("caps table drifted from the lane order")
    return {
        "lanes": lanes, "ageMed": age_med, "incMed": inc_med, "incBands": inc_bands,
        "sf": sfdec,
        "pop": pop, "area": area, "sa2i": sa2i, "sa2names": sa2names,
        "caps": caps, "marks": marks, "nulls": nulls,
    }


# ------------------------------------------------------------ the cross-check
def cross_check_sa26(rec, universe_cuts):
    """Pooled SA1 lanes must reproduce the sa26 district store — same readers
    and bases by design, so any drift is a formula break, loud. The income
    quartile lanes recompute against SA's own universe cut, as the store's did."""
    if not (os.path.exists(SA26_DEMO) and os.path.exists(SA26_ASSIGN)):
        print("WARN: sa26 demo/assign cache absent — cross-check skipped")
        return
    demo = json.load(open(SA26_DEMO))["demo"]
    assign = json.load(open(SA26_ASSIGN))
    cutlo_sa, cuthi_sa = universe_cuts["SA"]
    acc = {}
    for code, dist in assign.items():
        r = rec.get(code)
        if r is None:
            continue
        a = acc.setdefault(dist, {k: [0.0, 0.0] for k in SHARES} | {"loinc": [0.0, 0.0], "hiqinc": [0.0, 0.0]})
        for k in SHARES:
            nf, df = SHARES[k]
            den = df(r)
            if den > 0:
                num = nf(r)
                if num is not None and num >= -1e-9:
                    a[k][0] += num
                    a[k][1] += den
        if r["incAd"] > 0:
            lo_m, hi_m = inc_masses(r["bandsAd"], cutlo_sa, cuthi_sa)
            a["loinc"][0] += lo_m
            a["loinc"][1] += r["incAd"]
            a["hiqinc"][0] += hi_m
            a["hiqinc"][1] += r["incAd"]
    GROUP_OF = {"cob": None, "rel": None, "ten": None, "anc": None}
    checks = []
    for k in list(SHARES) + ["loinc", "hiqinc"]:
        if "." in k:
            grp, top = k.split(".", 1)
            if grp not in GROUP_OF:
                fail(f"ungrouped lane id {k}")
        else:
            grp, top = None, k
        for dist, t in demo.items():
            node = t.get(grp) if grp else t
            pub = node.get(top) if isinstance(node, dict) else None
            if pub is None:
                continue
            a = acc.get(dist)
            if not a or a[k][1] <= 0:
                continue
            checks.append((abs(a[k][0] / a[k][1] - pub), k, dist, a[k][0] / a[k][1], pub))
    if len(checks) < 47 * 10:
        fail(f"sa26 cross-check matched {len(checks)} rows (wanted every district)")
    checks.sort(reverse=True)
    n_bad = sum(1 for c in checks if c[0] > 0.0015)
    d0, k0, dist0, got0, pub0 = checks[0]
    print(f"sa26 cross-check: {len(checks)} lane-district compares, "
          f"max |Δ| {d0:.5f} on {k0}/{dist0} ({got0:.4f} vs {pub0:.4f}), "
          f"over tolerance: {n_bad}")
    if n_bad > 0:
        fail(f"sa26 cross-check: {n_bad} compares over 0.0015 (worst {k0}/{dist0}: "
             f"{got0:.4f} vs store {pub0:.4f})")


def main():
    dbf = read_dbf()
    rec, cutrec = load_cells(dbf)
    seifa = load_seifa()

    # every display universe's own income cuts (the seat stores' rule):
    # AUS for the federal frames, each state for its own frame. TAS/NT/ACT have
    # no frame (and the ACT's 75% cut lands the open top band of a 2021-income
    # histogram — its universe can't print a cut this way at all), so their
    # marks ride the national cuts.
    universe_cuts = {"AUS": (cutrec["loCutWeekly"], cutrec["hiQCutWeekly"])}
    for pref, jur in (("1", "NSW"), ("2", "VIC"), ("3", "QLD"), ("4", "SA"),
                      ("5", "WA"), ("6", "TAS"), ("7", "NT"), ("8", "ACT")):
        try:
            _rows, cr = gcp_newlanes.state_income(GCP_ZIP, "2021", pref)
            universe_cuts[jur] = (cr["loCutWeekly"], cr["hiQCutWeekly"])
        except SystemExit as e:
            if jur in JURS[1:6]:  # the states that HAVE frames must cut cleanly
                raise
            print(f"note: {jur} universe uncut ({e}) — national cuts stand in")
            universe_cuts[jur] = universe_cuts["AUS"]
    print("income cuts by universe:", {j: [f"${c[0]:.0f}", f"${c[1]:.0f}"] for j, c in universe_cuts.items()})

    # geometry: simplify with mapshaper, then read the emitted code order
    # back (the lanes zip to IT, never to an assumed order)
    tmp = tempfile.mkdtemp(prefix="areas-sa1-")
    try:
        topo = run_mapshaper(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    key = next(iter(topo["objects"]))
    geoms = topo["objects"][key]["geometries"]
    order = [g["properties"]["SA1_CODE21"] for g in geoms]
    if len(set(order)) != len(order):
        fail("topojson carries duplicate SA1 codes")
    in_gcp, in_topo = set(rec), set(order)
    if not in_topo <= in_gcp:
        fail(f"polygon codes absent from GCP: {sorted(in_topo - in_gcp)[:5]}")
    dropped = in_gcp - in_topo
    for code in dropped:
        if dbf[code]["area"] > 0:
            fail(f"GCP SA1 {code} area {dbf[code]['area']} km² lost by the shape filter")
    sentinel_persons = sum(rec[c]["p"] for c in dropped)
    print(f"{len(order)} shaped SA1s; {len(dropped)} no-polygon sentinel codes "
          f"({sentinel_persons} persons) sit out")

    built = build_lanes(rec, order, seifa, dbf, universe_cuts)
    nulls = built["nulls"]
    worst = sorted(nulls.items(), key=lambda kv: -kv[1])[:6]
    print(f"lanes: {len(LANE_ORDER)}, SA1s painted {len(order)}; worst nulls {worst}")
    for k, n in nulls.items():
        if n > 0.12 * len(order):
            fail(f"lane {k} null on {n} areas (>12%)")

    # the deep end must actually exist (the whole point of the p99.5 caps)
    langmax = max(v for v in built["lanes"]["lang"] if v != 255) / 200
    if langmax < 0.85:
        fail(f"lang lane tops at {langmax:.2f} — expected an SA1 over 0.85 (Fairfield class)")
    nat = built["marks"]["lang"]["AUS"]
    if not (0.18 < nat < 0.28):
        fail(f"national lang mark {nat} drifts (expected ≈0.22)")

    print("caps:")
    for k in LANE_ORDER:
        lo, hi = built["caps"][k] if isinstance(built["caps"][k], list) else built["caps"][k]
        m = built["marks"].get(k)
        print(f"  {k:16s} [{lo}, {hi}]  mark AUS {m['AUS'] if m else '—'}")

    cross_check_sa26(rec, universe_cuts)

    def b64(buf):
        return base64.b64encode(bytes(buf)).decode("ascii")

    lanepack = {}
    for k in SHARES:
        lanepack[k] = {"t": "u8x2", "b": b64(built["lanes"][k])}
    lanepack["ageMed"] = {"t": "u8", "b": b64(built["ageMed"])}
    lanepack["incMed"] = {"t": "u16", "b": b64(built["incMed"])}
    for ix in IX:
        lanepack[f"sf.{ix}"] = {"t": "u8z", "b": b64(built["sf"][ix])}

    out = {
        "vintage": 2021,
        "topo": topo,
        "lanes": lanepack,
        "meta": {
            "pop": {"t": "u32", "b": b64(built["pop"])},
            "area": {"t": "u32x100", "b": b64(built["area"])},
            "sa2i": {"t": "u16", "b": b64(built["sa2i"])},
            "sa2names": built["sa2names"],
            "incBands": {"t": "u16x16", "b": b64(built["incBands"])},
        },
        "caps": built["caps"],
        "marks": built["marks"],
        "src": {
            "gcp": {"path": os.path.relpath(GCP_ZIP, REPO), "sha16": hash16(GCP_ZIP)},
            "sa1Shp": {"path": os.path.relpath(SA1_ZIP, REPO), "sha16": hash16(SA1_ZIP)},
            "seifa": {"path": os.path.relpath(CUBE_XLSX, REPO), "sha16": hash16(CUBE_XLSX)},
            "gcpRows": GCP_ROWS, "cubeRows": CUBE_CODE_ROWS,
            "incomeCuts": cutrec,
        },
        "about": ("The 2021 census as counted in its own SA1 statistical areas — the Areas "
                  "drawing's pack on /map/. National SA1 geometry (ABS digital boundaries, "
                  "simplified 8% planar keep-shapes, 1e5 quantisation) plus the Census "
                  "lens's measures as per-SA1 lanes in geometry order. Bases mirror the "
                  "map's other census stores (gcp_newlanes formulas, ex-not-stated "
                  "denominators); ageMed/incMed are the GCP G02's own printed medians; SEIFA "
                  "lanes are the ABS's published national SA1 deciles 1-10 (0 = not "
                  "published). The income quartile lanes (loinc/hiqinc) are cut-relative: "
                  "meta.incBands carries each SA1's sixteen adults-basis band masses and "
                  "the share is computed at draw time against the frame in view's own cuts, "
                  "exactly as its seat stores do. Lane encoding t: u8x2 = share ×200 "
                  "(255 null), u8 = uint8 (255 null), u8z = uint8 (0 null), u16 = "
                  "uint16-le (65535 null), u16x16 = sixteen uint16-le per SA1, "
                  "u32/u32x100 = uint32-le (area ×100). caps are each key's extents "
                  "(shares: population-weighted p99.5 rounded up nice; seifa 1-10); marks "
                  "are the pooled jurisdiction benchmarks the legend's lines ride "
                  "(income lanes priced at each universe's own cuts)."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    raw = os.path.getsize(OUT)
    with open(OUT, "rb") as f:
        gz = len(gzip.compress(f.read(), 9))
    print(f"-> {OUT}")
    print(f"   {raw / 1e6:.1f} MB raw, ~{gz / 1e6:.1f} MB gzipped; "
          f"{len(built['sa2names'])} SA2 names, {len(topo['arcs'])} shared arcs")


main()
