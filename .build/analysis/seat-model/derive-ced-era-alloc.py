#!/usr/bin/env python3
"""derive-ced-era-alloc.py — census units allocated whole to the electoral
division sets the 2004, 2007 and 2010 federal elections were fought on.

WHY (interp follow-on, 2026-10-25): derive-division-seifa-interp.py's c1
sides for 2004/2007/2010 need census-cube units (2006 CDs, 2011 SA1s)
placed in the CED polygons of each election's boundary set, and no ABS
product ever shipped those memberships (ABS CED allocations exist for the
census-ERA editions only). This script builds them spatially, the same
method as the 2013-SA lane (derive-sa-ced2013.py): whole-unit allocation
by majority of a 6x6 grid sample of the unit's inside-points.

ERA POLYGON SETS (all cached in .matilda/seifa-irsad-abs/dl/aec-ced-eras/):
  ced2003ed (the 2004 election's divisions) — AEC "Election 2003 boundary
      set" national zip COM20040430_elb.zip (per-state MapInfo mid/mif,
      determination dates in the file names: QLD20031125, SA20031217,
      VIC20030129, NSW20000211, WA20001120, TAS20000211, NT20001221,
      ACT19971210) — the set APH CIB 1/2004-05 calls "(2003 boundaries)".
      Wayback id_ capture of aec.gov.au/pdf/profiles/gis/elb/2004/.
  ced2006ed (the 2007 election's divisions) — AEC "January 2007" national
      zip COM20070521_elb.zip (NSW20061122, QLD20061122, VIC20070521,
      ACT20051209, SA20031217, WA20001120, TAS20000211, NT20001221),
      Wayback capture of aec.gov.au/pdf/profiles/gis/elb/2006/.
  ced2010set (the 2010 election's divisions) — AEC national ESRI zip
      national-esri-2010.zip, LIVE at aec.gov.au/Electorates/gis/files/
      (GIS download page row "National / 2010"; VIC in it is the 2002
      determination — VIC's 24/12/2010 re-cut gazetted after the election).

MEMBERSHIP IS THE GATE, not the label: each era's division-name set is
joined NAME-EXACT against the election's block of
data/division-classifications.json before any emit, and the 2010 lane's
SA1 allocation is re-derived against the ABS CED_2011 csv as a provenance
oracle — agreement everywhere except a straddler-noise envelope (the ABS
concordance shares the election-era boundary set nationwide; VIC's
24/12/2010 re-cut never entered it).

OUTPUTS (consumed by derive-division-seifa-interp.py):
  seifa-src/cd-2006-ced-2003ed.json    {CD_CODE06: division}
  seifa-src/sa1-2011-ced-2006ed.json   {SA1_MAINCODE_2011: division}
  seifa-src/sa1-2011-ced-2010ed.json   {SA1_MAINCODE_2011: division}
The two cd-2006 lanes of the 2007 and 2010 election boundary sets are
the seat-sum memberships the census-people stores for those elections
pool their 2006-BCP counts over (derive-booth-demo-2006.py, the
venue-proxy sibling of derive-booth-demo-2013.py):
  seifa-src/cd-2006-ced-2006ed.json    {CD_CODE06: division}  (2007 set)
  seifa-src/cd-2006-ced-2010set.json   {CD_CODE06: division}  (2010 set)

Run from the repo root:
    python3 .build/analysis/seat-model/derive-ced-era-alloc.py
"""
import collections
import csv
import glob
import importlib.util
import io
import json
import os
import sys
import zipfile

import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = HERE.rsplit("/.build/", 1)[0]
ABS_CACHE = f"{PROJ}/.matilda/seifa-irsad-abs"
DL = f"{ABS_CACHE}/dl"
ERA_DIR = f"{DL}/aec-ced-eras"
CLASS_JSON = f"{PROJ}/data/division-classifications.json"
GRID = 6

_spec = importlib.util.spec_from_file_location(
    "sa2013", os.path.join(HERE, "derive-sa-ced2013.py"))
sa2013 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sa2013)

MC_NORM = {"Mcewen": "McEwen", "Mcmillan": "McMillan", "Mcpherson": "McPherson"}


def fail(msg):
    sys.exit(f"derive-ced-era-alloc: {msg}")


# ------------------------------------------------------------ MIF/MID read

def read_mif_mid(mif_path, mid_path):
    """MapInfo mid/mif pair -> [(name, (box, rings))]. The name column is
    found in the MIF header (Elect_div / ELECT_DIV). Rings of one REGION
    feature are kept together; even-odd fills holes and islands alike."""
    with open(mif_path, encoding="latin-1") as fh:
        lines = fh.read().splitlines()
    # header: "Columns N" then N column-definition lines, then "Data"
    cols, di0 = [], None
    ncols = None
    for i, line in enumerate(lines):
        t = line.strip()
        if ncols is None:
            if t.startswith("Columns"):
                ncols = int(t.split()[1])
            continue
        if len(cols) < ncols:
            cols.append(t.split()[0])
            continue
        if t.lower() == "data":
            di0 = i + 1
            break
    if di0 is None:
        fail(f"{mif_path}: no Data line / bad header")
    ncol = next((j for j, c in enumerate(cols) if c.lower() == "elect_div"), None)
    if ncol is None:
        fail(f"{mif_path}: no Elect_div column in {cols}")
    try:
        mid_lines = open(mid_path, encoding="latin-1").read().splitlines()
        mid_names = [next(csv.reader(io.StringIO(r)))[ncol]
                     for r in mid_lines if r.strip()]
    except StopIteration:
        fail(f"{mif_path}: mid unreadable")
    # geometry objects
    feats, i = [], di0
    n = len(lines)
    while i < n:
        t = lines[i].strip()
        low = t.lower()
        if low.startswith("region"):
            npoly = int(t.split()[1])
            i += 1
            rings = []
            for _ in range(npoly):
                npts = int(lines[i].strip())
                i += 1
                pts = []
                for _ in range(npts):
                    x, y = lines[i].split()
                    pts.extend((float(x), float(y)))
                    i += 1
                rings.append(pts)
            flat = [v for r in rings for v in r]
            box = (min(flat[::2]), min(flat[1::2]), max(flat[::2]), max(flat[1::2]))
            feats.append((box, rings))
        else:
            i += 1
    if len(feats) != len(mid_names):
        fail(f"{mif_path}: {len(feats)} regions vs {len(mid_names)} mid rows")
    return list(zip(mid_names, feats))


def read_era_divisions():
    """{era: {division_name: Banded}} from the cached era polygon sets."""
    eras = {"ced2003ed": f"{ERA_DIR}/2004", "ced2006ed": f"{ERA_DIR}/2007"}
    out = {}
    for era, d in eras.items():
        divs = {}
        mifs = {os.path.basename(p).rsplit(".", 1)[0].lower(): p
                for p in glob.glob(f"{d}/*.[mM][iI][fF]")}
        for root, mif in sorted(mifs.items()):
            base = os.path.basename(mif).rsplit(".", 1)[0]
            mid = None
            for ext in (".MID", ".mid"):
                cand = os.path.join(d, base + ext)
                if os.path.exists(cand):
                    mid = cand
                    break
            if mid is None:
                fail(f"{mif}: no mid sibling")
            for nm, poly in read_mif_mid(mif, mid):
                nm = MC_NORM.get(nm.strip(), nm.strip())
                if nm in divs:  # multi-feature division: merge rings
                    b0, r0 = divs[nm]
                    rings = r0 + poly[1]
                    flat = [v for r in rings for v in r]
                    box = (min(b0[0], poly[0][0]), min(b0[1], poly[0][1]),
                           max(b0[2], poly[0][2]), max(b0[3], poly[0][3]))
                    divs[nm] = (box, rings)
                else:
                    divs[nm] = poly
        out[era] = divs
    # 2010: single national shp, ELECT_DIV field
    d2010 = f"{ERA_DIR}/2010"
    buf_all = {}
    for fn in ("COM_ELB_2010_region.shp", "COM_ELB_2010_region.dbf"):
        with open(os.path.join(d2010, fn), "rb") as fh:
            buf_all[fn] = fh.read()
    names = [r["ELECT_DIV"] for r in sa2013.dbf_rows(buf_all["COM_ELB_2010_region.dbf"])]
    divs = {}
    for nm, poly in zip(names, sa2013.shp_polygons(buf_all["COM_ELB_2010_region.shp"])):
        if poly is None:
            continue
        nm = MC_NORM.get(nm.strip(), nm.strip())
        if nm in divs:
            b0, r0 = divs[nm]
            rings = r0 + poly[1]
            box = (min(b0[0], poly[0][0]), min(b0[1], poly[0][1]),
                   max(b0[2], poly[0][2]), max(b0[3], poly[0][3]))
            divs[nm] = (box, rings)
        else:
            divs[nm] = poly
    out["ced2010set"] = divs
    return out


# ------------------------------------------------------------ unit sources

def units_cd2006():
    """2006 census-collection-district polygons -> {key: (lga, box, rings)}."""
    out_all = {}
    for st in ("nsw", "vic", "qld", "sa", "wa", "tas", "nt", "act", "ot"):
        z = zipfile.ZipFile(f"{DL}/1259030002_cd06a{st}_shape.zip")
        shp = next(n for n in z.namelist() if n.lower().endswith(".shp"))
        dbf = next(n for n in z.namelist() if n.lower().endswith(".dbf"))
        rows = list(sa2013.dbf_rows(z.read(dbf)))
        key = next((k for k in rows[0] if k.upper().startswith("CD_CODE")), None)
        if key is None:
            fail(f"cd06 {st}: no CD_CODE field in {list(rows[0])}")
        for r, p in zip(rows, sa2013.shp_polygons(z.read(shp))):
            out_all[r[key].strip()] = (r.get("LGA_CODE06", "").strip(), p)
        print(f"  cd06 {st}: {len(rows)} polygons (key {key})")
    return out_all


def units_sa1_2011():
    """ASGS 2011 SA1 polygons -> {key: (sa2, box, rings)}."""
    z = zipfile.ZipFile(f"{DL}/1270055001_sa1_2011_aust_shape.zip")
    rows = list(sa2013.dbf_rows(z.read("SA1_2011_AUST.dbf")))
    out = {r["SA1_MAIN11"].strip(): (r["SA2_MAIN11"].strip(), p)
           for r, p in zip(rows, sa2013.shp_polygons(z.read("SA1_2011_AUST.shp")))}
    print(f"  sa1 2011: {len(out)} polygons (key SA1_MAIN11)")
    return out


# ------------------------------------------------------------ allocation

def allocate(units, divs, tag):
    """Whole-unit majority allocation on a GRID x GRID sample, with a
    division-bbox prefilter so each point is tested only against the few
    divisions it can sit in. units: {key: (group, poly)}."""
    banded = [(nm, sa2013.Banded(*poly)) for nm, poly in divs.items()]
    out, split, fallback, unplaced = {}, 0, 0, []
    for key, (group, poly) in units.items():
        if poly is None:
            unplaced.append(key)
            continue
        box, rings = poly
        cands = [(nm, b) for nm, b in banded
                 if not (b.box[2] < box[0] or b.box[0] > box[2] or
                         b.box[3] < box[1] or b.box[1] > box[3])]
        votes = collections.Counter()
        for gx in range(GRID):
            for gy in range(GRID):
                x = box[0] + (gx + 0.5) * (box[2] - box[0]) / GRID
                y = box[1] + (gy + 0.5) * (box[3] - box[1]) / GRID
                if not sa2013.inside(x, y, rings):
                    continue
                for nm, d in cands:
                    if d.contains(x, y):
                        votes[nm] += 1
                        break
        if not votes:
            fallback += 1
            x, y = rings[0][0], rings[0][1]
            for nm, d in cands:
                if d.contains(x, y):
                    votes[nm] += 1
                    break
        if not votes:
            unplaced.append(key)
            continue
        if len(votes) > 1:
            split += 1
        out[key] = votes.most_common(1)[0][0]
    # group-plurality rescue: units outside every era polygon (the era AEC
    # files stop at the coastline; island/harbour census units fall out)
    # take the division their sibling units of the same census group (LGA
    # for CDs, SA2 for SA1s) were allocated to.
    group_of = {}
    for key, (group, _p) in units.items():
        if key in out:
            group_of.setdefault(group, collections.Counter())[out[key]] += 1
    forced = {}
    still = []
    for key in unplaced:
        group = units[key][0]
        tally = group_of.get(group)
        if tally:
            forced[key] = tally.most_common(1)[0][0]
        else:
            still.append(key)
    print(f"  {tag}: {len(out)} allocated, {split} straddle a boundary, "
          f"{fallback} by first vertex, {len(unplaced)} missed -> "
          f"{len(forced)} rescued by group plurality, {len(still)} unplaced")
    if forced:
        for k, v in sorted(forced.items()):
            print(f"    rescue {k} (group {units[k][0]}) -> {v}")
    out.update(forced)
    return out, split, fallback, still


def klass_block(year):
    return json.load(open(CLASS_JSON))["elections"][year]


def gate_era(tag, alloc, year):
    """Name-set join NAME-EXACT against the election's classification block;
    Mc-casing already normalised on ingest."""
    want = set(klass_block(year))
    got = set(alloc.values())
    if got != want:
        fail(f"{tag}: divisions {sorted(got ^ want)} != the {year} "
             f"classification block (got-only {sorted(got - want)[:5]}, "
             f"want-only {sorted(want - got)[:5]})")


def gate_unplaced_empty(tag, unplaced, cube_xls, bridge_2011=False):
    """Every unplaced unit must carry zero population AND no SEIFA score in
    its census cube — anything else is a unit the SEIFA lane would silently
    lose. Off-shore/migratory/zero-pop balance units pass."""
    wb = xlrd.open_workbook(cube_xls)
    sh = wb.sheet_by_name("Table 1")
    title_row = sh.row_values(4)
    up_col = next(i for i, t in enumerate(title_row)
                  if t and "USUAL RESIDENT POPULATION" in " ".join(str(t).upper().split()))
    score_cols = [i for i, t in enumerate(sh.row_values(5))
                  if str(t).strip().lower() == "score"]
    cube = {}
    for r in range(6, sh.nrows):
        v = sh.row_values(r)
        if isinstance(v[0], float):
            cube[str(int(v[0]))] = (v[up_col], [v[i] for i in score_cols])
    key_of = None
    if bridge_2011:
        spec = importlib.util.spec_from_file_location(
            "derive_irsad", f"{PROJ}/.build/analysis/seifa-index/derive-irsad.py")
        di = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(di)
        bridge = di.load_mb_sa1_keys(2011)      # maincode -> 7-digit
        key_of = lambda k: bridge.get(k)
    else:
        key_of = lambda k: k
    real, absent = [], []
    for u in unplaced:
        ck = key_of(u)
        rec = cube.get(ck) if ck else None
        if rec is None:
            absent.append(u)
        elif (rec[0] or 0) > 0 or any(isinstance(s, float) for s in rec[1]):
            real.append((u, rec[0]))
    if real:
        fail(f"{tag}: {len(real)} unplaced units carry population or a "
             f"score: {real[:8]}")
    print(f"  {tag}: {len(unplaced)} unplaced units all population-free and "
          f"score-free ({len(absent)} absent from the cube)")


def emit(path, doc):
    with open(path, "w") as f:
        json.dump(doc, f, indent=1, sort_keys=True)
        f.write("\n")
    print(f"  wrote {path}")


def main():
    era_divs = read_era_divisions()
    for era in ("ced2003ed", "ced2006ed", "ced2010set"):
        print(f"{era}: {len(era_divs[era])} divisions")

    # ---- 2004 lane: 2006 CDs against the 2003-edition polygons
    units = units_cd2006()
    alloc, split, fb, un = allocate(units, era_divs["ced2003ed"], "cd06 -> ced2003ed")
    gate_unplaced_empty("cd06", un, f"{ABS_CACHE}/abs-seifa-2006-cd-indexes.xls")
    gate_era("cd06 -> ced2003ed", alloc, "2004")
    emit(f"{HERE}/seifa-src/cd-2006-ced-2003ed.json", {
        "_about": "2006 census collection districts (CD_CODE06, ABS 1259.0.30.002 "
                  "shapes) allocated whole to the divisions in force at the 2004 "
                  "federal election (the AEC's 'Election 2003 boundary set', "
                  "COM20040430_elb.zip via Wayback) by majority of a 6x6 grid "
                  "sample — the membership derive-division-seifa-interp.py's "
                  "e2004c1 lane needs; no ABS CD->2003-edition concordance exists. "
                  "Units falling outside every era polygon (the AEC files stop "
                  "at the coastline; island units fall out) take their LGA "
                  "siblings' division. Generated by derive-ced-era-alloc.py.",
        "unit": "CD_CODE_2006", "divisions": sorted(set(alloc.values())),
        "unitCount": len(units), "placed": len(alloc), "split": split,
        "fallback": fb, "unplacedUnscored": un,
        "alloc": dict(sorted(alloc.items()))})

    # ---- census-people lanes: 2006 CDs against the 2006-edition polygon
    # ---- set (the 2007 election's divisions) and the 2010-election set —
    # ---- the seat-sum memberships derive-booth-demo-2006.py pools the
    # ---- 2006-BCP counts over for booth-demo-2007/2010.json. The units
    # ---- are still the CD2006 polygons loaded for the 2004 lane.
    alloc07, split, fb, un = allocate(units, era_divs["ced2006ed"],
                                      "cd06 -> ced2006ed")
    gate_unplaced_empty("cd06@2006ed", un,
                        f"{ABS_CACHE}/abs-seifa-2006-cd-indexes.xls")
    gate_era("cd06 -> ced2006ed", alloc07, "2007")
    emit(f"{HERE}/seifa-src/cd-2006-ced-2006ed.json", {
        "_about": "2006 census collection districts (CD_CODE06, ABS 1259.0.30.002 "
                  "shapes) allocated whole to the divisions in force at the 2007 "
                  "federal election (the AEC's January 2007 national set, "
                  "COM20070521_elb.zip, the same polygons as the sa1-2011-ced-2006ed "
                  "lane) by majority of a 6x6 grid sample; outside-polygon island "
                  "units take their LGA siblings' division. The seat-sum membership "
                  "derive-booth-demo-2006.py pools the 2006-BCP counts over for the "
                  "2007 election's census-people store. Generated by "
                  "derive-ced-era-alloc.py.",
        "unit": "CD_CODE_2006", "divisions": sorted(set(alloc07.values())),
        "unitCount": len(units), "placed": len(alloc07), "split": split,
        "fallback": fb, "unplacedUnscored": un,
        "alloc": dict(sorted(alloc07.items()))})

    alloc10, split, fb, un = allocate(units, era_divs["ced2010set"],
                                      "cd06 -> ced2010set")
    gate_unplaced_empty("cd06@2010set", un,
                        f"{ABS_CACHE}/abs-seifa-2006-cd-indexes.xls")
    gate_era("cd06 -> ced2010set", alloc10, "2010")
    emit(f"{HERE}/seifa-src/cd-2006-ced-2010set.json", {
        "_about": "2006 census collection districts (CD_CODE06, ABS 1259.0.30.002 "
                  "shapes) allocated whole to the divisions in force at the 2010 "
                  "federal election (the AEC's national-esri-2010.zip, VIC's "
                  "pre-24/12/2010-determination set — the same polygons as the "
                  "sa1-2011-ced-2010ed lane) by majority of a 6x6 grid sample; "
                  "outside-polygon island units take their LGA siblings' division. "
                  "The seat-sum membership derive-booth-demo-2006.py pools the "
                  "2006-BCP counts over for the 2010 election's census-people "
                  "store. Generated by derive-ced-era-alloc.py.",
        "unit": "CD_CODE_2006", "divisions": sorted(set(alloc10.values())),
        "unitCount": len(units), "placed": len(alloc10), "split": split,
        "fallback": fb, "unplacedUnscored": un,
        "alloc": dict(sorted(alloc10.items()))})

    # ---- 2007 lane: 2011 SA1s against the 2006-edition polygons
    units = units_sa1_2011()
    alloc07, split, fb, un = allocate(units, era_divs["ced2006ed"], "sa1 -> ced2006ed")
    gate_unplaced_empty("sa1@2006ed", un, f"{ABS_CACHE}/abs-seifa-2011-sa1-indexes.xls", bridge_2011=True)
    gate_era("sa1 -> ced2006ed", alloc07, "2007")
    emit(f"{HERE}/seifa-src/sa1-2011-ced-2006ed.json", {
        "_about": "ASGS 2011 SA1s (SA1_MAINCODE_2011, ABS 1270.0.55.001 shapes) "
                  "allocated whole to the divisions in force at the 2007 federal "
                  "election (the AEC's January 2007 national set, "
                  "COM20070521_elb.zip via Wayback) by majority of a 6x6 grid "
                  "sample; outside-polygon island units take their SA2 "
                  "siblings' division. Feeds derive-division-seifa-interp.py's "
                  "e2007c1 lane. Generated by derive-ced-era-alloc.py.",
        "unit": "SA1_MAINCODE_2011", "divisions": sorted(set(alloc07.values())),
        "unitCount": len(units), "placed": len(alloc07), "split": split,
        "fallback": fb, "unplacedUnscored": un,
        "alloc": dict(sorted(alloc07.items()))})

    # ---- 2010 lane: 2011 SA1s against the 2010-election polygons
    alloc10, split, fb, un = allocate(units, era_divs["ced2010set"], "sa1 -> ced2010set")
    gate_unplaced_empty("sa1@2010set", un, f"{ABS_CACHE}/abs-seifa-2011-sa1-indexes.xls", bridge_2011=True)
    gate_era("sa1 -> ced2010set", alloc10, "2010")

    # provenance oracle: the ABS CED_2011 csv (units' census-era membership)
    # must AGREE with this allocation everywhere — its VIC polygons are the
    # pre-24/12/2010-determination set too (the concordance was built on the
    # election-era boundaries nationwide; measured 2026-10-25: the VIC SA1s
    # allocated here differ from the Jan-2007-era VIC alloc on ZERO units,
    # which only holds if both products share that vintage). Disagreement is
    # therefore straddler noise alone — our 6x6-grid majority vs the ABS's
    # mesh-block-population majority: 69 of 54,772 SA1s scattered across
    # every state. Wrong-vintage file (e.g. a 2016-era set) would produce
    # thousands of differences on one side.
    z = zipfile.ZipFile(f"{DL}/1270055003_ced_2011_aust_csv.zip")
    with z.open(z.namelist()[0]) as fh:
        rd = csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig"))
        keys = list(rd.fieldnames)
        sa1col = next(c for c in keys if c.startswith("SA1_MAINCODE"))
        namcol = next(c for c in keys if c.startswith("CED_NAME"))
        ced11 = {row[sa1col]: MC_NORM.get(row[namcol], row[namcol]) for row in rd}
    klass10 = klass_block("2010")
    state_of = {n: r["state"] for n, r in klass10.items()}
    pseudo = lambda nm: ("No usual address" in nm or "Migratory" in nm
                         or "Shipping" in nm)
    agree, differ = 0, collections.Counter()
    for sa1, nm in alloc10.items():
        abs_nm = ced11.get(sa1)
        if abs_nm is None or pseudo(abs_nm):
            continue
        if abs_nm == nm:
            agree += 1
        else:
            st = state_of.get(nm) or state_of.get(abs_nm) or "??"
            differ[(st, nm, abs_nm)] += 1
    total_diff = sum(differ.values())
    print(f"  oracle vs ABS CED_2011: {agree} SA1s agree; straddler "
          f"differences {total_diff} across {len(differ)} pairs")
    if not (agree > 30000 and total_diff <= 200):
        fail(f"oracle deltas outside expected envelope: {total_diff} "
             f"differences — {sorted(differ.items(), key=lambda kv: -kv[1])[:8]}")
    about10 = ("ASGS 2011 SA1s (SA1_MAINCODE_2011) allocated whole to the "
               "divisions in force at the 2010 federal election (the AEC's "
               "national-esri-2010.zip, the live GIS page's 'National / 2010' "
               "file) by majority of a 6x6 grid sample; outside-polygon "
               "island units take their SA2 siblings' division. "
               "Provenance-oracle checked against the ABS CED_2011 "
               "allocation (agrees everywhere except straddler noise — "
               "the ABS concordance was built on the same election-era "
               "boundaries, VIC's pre-24/12/2010 determination). Feeds "
               "derive-division-seifa-interp.py's e2010c1 lane. Generated "
               "by derive-ced-era-alloc.py.")
    emit(f"{HERE}/seifa-src/sa1-2011-ced-2010ed.json", {
        "_about": about10,
        "unit": "SA1_MAINCODE_2011", "divisions": sorted(set(alloc10.values())),
        "unitCount": len(units), "placed": len(alloc10), "split": split,
        "fallback": fb, "unplacedUnscored": un,
        "oracleVsCed2011": {"agree": agree,
                            "straddlerMoves": dict(sorted(
                                (f"{st}:{a}->{b}", n)
                                for (st, a, b), n in differ.items()))},
        "alloc": dict(sorted(alloc10.items()))})


if __name__ == "__main__":
    main()
