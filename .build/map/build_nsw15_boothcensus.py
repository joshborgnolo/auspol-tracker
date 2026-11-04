#!/usr/bin/env python3
"""Booth-level census lanes (dec/demo) for the nsw15 map frame — the
build_nsw23_boothcensus.py recipe verbatim, two census editions down,
the build_nsw19_boothcensus.py twin one edition lower still.

Every geocoded fixed booth of the 2015 state election's NSWEC venue
roll joins to the census area it stands in — the venue-proxy read the
federal frames carry as their booths' `dec` (SEIFA deciles) and `demo`
(people cells) lanes, here on the 2011 census's SA1 universe (the
frame's own vintage: data-nsw15.json carries demoYear 2011, and
data/nsw15-demo.json and data/nsw15-seifa.json pool the same edition to
districts). NSWEC releases no votes-by-SA1 product, so the voter-
footprint lane (`vdec`) stays null; only the venue read exists. Mobile
teams never join (a mobile team has no fixed venue and the team's
nominal point says nothing about where it polled — every ty-4 row
stays null even when the roll prints coordinates, the parent's
treatment), and 2015's roll leaves a block of fixed venues unmatched —
a coord-less row takes null lanes and counts, the parent's loud-fail
clause softened per the frame's own roll.

  dec  — [irsad, irsd, ier, ieo] NATIONAL deciles of the booth's SA1,
         taken from the ABS SEIFA 2011 cube's own per-area decile
         columns (the column right of each score column, resolved by
         header title — the same titles the district SEIFA pipeline
         resolves by name; a decile is null where the cube publishes no
         score for the index)
  demo — the SA1's own people cells [lang, a65, a2034, fborn, uni,
         blue, null, null], computed from the 2011 Census BCP SA1
         tables (the Basic Community Profile, the GCP's pre-2016 form)
         with the same member and column choices and the same
         ex-not-stated bases as the district people lanes
         (build_nsw15_demo.py), so a booth's row is commensurate with
         its district's. The two income slots stay null. A cell is null
         where its denominator is zero (a tiny SA1 can state no
         language/occupation).

Inputs (all caches already ride this repo's other pipelines):
  .build/analysis/seat-model/cache/bcp-sa1-2011.zip           (2011 Census BCP SA1 for AUST)
  .matilda/seifa-irsad-abs/abs-seifa-2011-sa1-indexes.xls     (SEIFA 2011 SA1 cube, legacy .xls)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2011_aust_shape.zip (SA1 2011 polygons)
  map/data/data-nsw15.json                                    (the map data build;
        this script splices the two lanes into it and rewrites it — it
        runs after build_nsw15_data.py and is itself rerun after it
        whenever that build changes, since that build wipes the lanes)

Chain:
  python3 .build/map/build_nsw15_boothcensus.py   (no -I: xlrd is a
    user-site package of this machine and -I hides user site, exactly
    like build_nsw15_seifa.py)

Deps: stdlib + xlrd (the 2011 cube's legacy .xls; the sibling SEIFA
builder's reader library).
usage: python3 .build/map/build_nsw15_boothcensus.py
"""
import functools
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nsw13_geo import (NSW_SENTINELS, VINTAGES, in_geometry,  # noqa: E402
                       read_sa1_polygons)

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
YEAR = 2011
YEAR_TAG = "nsw15"
V = VINTAGES[YEAR]
BCP_ZIP = V["gcp"]
CUBE_XLS = os.path.join(REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2011-sa1-indexes.xls")
BCP_KEY = V["gcp_key"]          # region_id (the BCP's 7-digit SA1 code)
BCP_ROWS = V["gcp_rows"]        # 54,805 national (incl. the 4 NSW sentinels)
MEMBER = V["member"].format     # 2011 Census BCP .../2011Census_{t}_AUST_SA1_short.csv

#: frame-roster pins, measured from the committed data build 2026-11-04;
#: a drift past any of these is a guard trip, never a silent re-derive
BOOTHS_PIN = 3324
GEOCODED_PIN = 2657            # booths with lat/lon (includes 92 ty-4 team rows)
BCP_NSW_ROWS = 17895           # build_nsw15_demo.py's pin (incl. sentinels)

IX = ["irsad", "irsd", "ier", "ieo"]
#: derive-division-seifa-abs.py's own canon (the district SEIFA builders'
#: table): each index's score column is the column whose printed title
#: names the index, and a decile column immediately follows it
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}
#: cube row-set pins (national/NSW), build_nsw15_seifa.py's: an SA1 the
#: cube could not score carries NO row
CUBE_CODE_ROWS = 52678
CUBE_NSW_ROWS = 17167

DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
BCP_B45B_OCCS = ["P_Tot_Managers", "P_Tot_Professionals",
                 "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
                 "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
                 "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
BCP_MEMBERS = (
    ("B09", MEMBER(table="B09"), ["Australia_P",
                                  "Country_birth_not_stated_P", "Tot_P"]),
    ("B40B", MEMBER(table="B40B"), ["P_PGrad_Deg_Total",
                                    "P_GradDip_and_GradCert_Total",
                                    "P_BachDeg_Total",
                                    "P_Lev_Edu_NS_Total"]),
    ("B45B", MEMBER(table="B45B"), BCP_B45B_OCCS),
)


def fail(msg):
    raise SystemExit(f"nsw15-boothcensus: {msg}")


# ------------------------------------------------------------- census tables
@functools.lru_cache(maxsize=None)
def sa1_polygons():
    out = read_sa1_polygons(YEAR)
    pre = {code: [(min(x for x, _ in o), min(y for _, y in o),
                   max(x for x, _ in o), max(y for _, y in o)) for o, _h in polys]
           for code, polys in out.items()}
    grid = {}
    step = 0.25  # the parent's booth join recipe: polygon bboxes bucketed
    # in 0.25-degree cells, a point's cell plus its expanding rings are its
    # PIP shortlist
    for code, boxes in pre.items():
        for bb in boxes:
            x0 = int(bb[0] / step)
            y0 = int(bb[1] / step)
            x1 = int(bb[2] / step)
            y1 = int(bb[3] / step)
            for i in range(x0, x1 + 1):
                for j in range(y0, y1 + 1):
                    grid.setdefault((i, j), set()).add(code)
    return out, grid, step, pre


def pip(lon, lat):
    sa1, grid, step, boxes = sa1_polygons()
    ci, cj = int(lon / step), int(lat / step)
    # a polygon the point sits in always has grid cells within one ring of
    # the point's cell; the second ring is belt-and-braces for clipped bboxes
    for radius in (0, 1, 2):
        codes = set()
        for i in range(ci - radius, ci + radius + 1):
            for j in range(cj - radius, cj + radius + 1):
                codes |= grid.get((i, j), set())
        hits = [code for code in codes
                if any(bb[0] - 1e-9 <= lon <= bb[2] + 1e-9 and bb[1] - 1e-9 <= lat <= bb[3] + 1e-9
                       for bb in boxes[code])
                and in_geometry((lon, lat), sa1[code])]
        if hits:
            return sorted(hits)[0]
    return None


def _canon(t):
    return " ".join(str(t).upper().split())


@functools.lru_cache(maxsize=None)
def seifa_deciles():
    """SA1 code -> {ix: national decile|None} from the ABS 2011 cube's
    own per-area decile columns. Columns resolved by header title (score
    column), the decile column verified to follow it — build_nsw15_
    seifa.py's xlrd conventions on the same file."""
    if not os.path.exists(CUBE_XLS):
        fail(f"missing SEIFA cube {CUBE_XLS}")
    try:
        import xlrd
    except ImportError:
        fail("needs xlrd (user-site on this machine; run without -I "
             "like build_nsw15_seifa.py)")
    wb = xlrd.open_workbook(CUBE_XLS, on_demand=True)
    if "Table 1" not in wb.sheet_names():
        fail(f"cube sheets {wb.sheet_names()} lack 'Table 1'")
    sh = wb.sheet_by_name("Table 1")
    probe_rows = [sh.row_values(r) for r in range(min(8, sh.nrows))]
    title_i = next((i for i, r in enumerate(probe_rows)
                    if any("INDEX OF" in _canon(t) for t in r if t)), None)
    if title_i is None:
        fail("cube lacks a title row naming an index")
    title_row = [_canon(t) if t is not None else "" for t in
                 probe_rows[title_i]]
    sub_row = [_canon(t) if t is not None else "" for t in
               probe_rows[title_i + 1]]
    cols = {}
    for ix, wanted in INDEX_TITLES.items():
        for i, t in enumerate(title_row):
            if t and any(w in t for w in wanted):
                cols[ix] = i
                break
        if ix not in cols:
            fail(f"cube header drift: no column titled {wanted!r}")
    if set(cols) != set(IX):
        fail(f"cube header drift: resolved {sorted(cols)}, want {IX}")
    for ix, c in cols.items():
        hist = sub_row[c + 1] if c + 1 < len(sub_row) else ""
        if "DECILE" not in hist:
            fail(f"cube {ix}: column {c + 1} after the score is not a "
                 f"Decile column ({hist!r})")
    out, n = {}, 0

    def num_cell(row, i):
        v = row[i] if i < len(row) else None
        return v if isinstance(v, (int, float)) else None

    for r in range(title_i + 2, sh.nrows):
        v = sh.cell_value(r, 0)
        if isinstance(v, float):
            v = int(v)
        s = str(v).strip() if v is not None else ""
        if not (len(s) == 7 and s.isdigit()):
            continue
        n += 1
        if not s.startswith("1"):
            continue
        row = sh.row_values(r)
        rec = {}
        for ix, c in cols.items():
            sc = num_cell(row, c)
            d = num_cell(row, c + 1)
            if sc is None:
                rec[ix] = None
            elif d is None:
                fail(f"cube {s}: {ix} score {sc} with no decile beside it")
            else:
                rec[ix] = int(d)
                if not 1 <= rec[ix] <= 10:
                    fail(f"cube {s}: {ix} decile {rec[ix]} outside 1..10")
        out[s] = rec
    wb.release_resources()
    if n != CUBE_CODE_ROWS:
        fail(f"cube Table 1 code rows {n} != pin {CUBE_CODE_ROWS}")
    if len(out) != CUBE_NSW_ROWS:
        fail(f"cube NSW scored rows {len(out)} != pin {CUBE_NSW_ROWS}")
    print(f"cube NSW deciles: {len(out)} SA1s (era {YEAR})")
    return out


@functools.lru_cache(maxsize=None)
def demo_cells():
    """SA1 code -> demo row [lang, a65, a2034, fborn, uni, blue, None,
    None] with the district people lanes' exact bases
    (build_nsw15_demo.py): the 2011 BCP SA1 pack's B01/B09/B40B/B45B
    members, the ex-not-stated denominators, the bounded share
    recipe."""
    import csv
    import io
    import zipfile
    if not os.path.exists(BCP_ZIP):
        fail(f"missing BCP input {BCP_ZIP}")
    lang_cols = ("Lang_spoken_home_Eng_only_P", "Lang_spoken_home_Oth_Lang_P")
    agecols = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
    want = [BCP_KEY, "Tot_P_P", *lang_cols, *agecols]
    base = {}
    n = 0
    z = zipfile.ZipFile(BCP_ZIP)
    with io.TextIOWrapper(z.open(MEMBER(table="B01")), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"BCP B01 header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row[BCP_KEY]
            if not code.startswith("1"):
                continue
            if code in base:
                fail(f"BCP B01 dup NSW code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row[lang_cols[0]]),
                          int(row[lang_cols[1]]),
                          tuple(int(row[c]) for c in agecols))
    if n != BCP_ROWS or len(base) != BCP_NSW_ROWS:
        fail(f"BCP B01 rows {n} (pin {BCP_ROWS}), NSW {len(base)} (pin {BCP_NSW_ROWS})")
    if not NSW_SENTINELS[YEAR] <= set(base):
        fail("BCP B01 NSW rows lack the pinned sentinel SA1s "
             f"{sorted(NSW_SENTINELS[YEAR])}")
    extra = {}
    for tag, member, cols in BCP_MEMBERS:
        if member not in z.namelist():
            fail(f"BCP zip lacks {member}")
        d, m = {}, 0
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in [BCP_KEY, *cols] if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"BCP {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row[BCP_KEY]
                if code.startswith("1"):
                    d[code] = tuple(int(row[c]) for c in cols)
        if m != BCP_ROWS or len(d) != BCP_NSW_ROWS:
            fail(f"BCP {tag} rows {m}, NSW {len(d)}")
        extra[tag] = d
    out = {}
    for code, r in base.items():
        p, eng, oth, bands = r[0], r[1], r[2], r[3]
        aust, cobns, tot = extra["B09"][code]
        b40 = extra["B40B"][code]
        uni = b40[0] + b40[1] + b40[2]
        eduns = b40[3]
        oc = extra["B45B"][code]
        blue, occd = oc[2] + oc[6] + oc[7], sum(oc)
        bsum = sum(bands)
        pop15 = p - bands[0] - bands[1]

        def safe(num, den):
            # derive-booth-demo's bounded(): a share of an ex-not-stated
            # basis is none when the basis is empty, AND none when census
            # perturbation of a tiny SA1 takes the arithmetic outside
            # [0,1] (cross-table cells disagree at population ~19) — emit
            # no number rather than clamp one
            if den <= 0:
                return None
            v = num / den
            return round(v, 4) if 0 <= v <= 1 else None
        out[code] = [safe(oth, eng + oth),
                     safe(bands[8] + bands[9] + bands[10], bsum),
                     safe(bands[3] + bands[4], bsum),
                     safe(tot - cobns - aust, tot - cobns),
                     safe(uni, pop15 - eduns),
                     safe(blue, occd),
                     None, None]
    print(f"BCP demo cells: {len(out)} SA1s (era {YEAR})")
    return out


# ------------------------------------------------------------------ the join
def main():
    decs = seifa_deciles()
    demos = demo_cells()
    path = os.path.join(REPO, "map", "data", f"data-{YEAR_TAG}.json")
    if not os.path.exists(path):
        fail(f"missing {path} — run build_{YEAR_TAG}_data.py first")
    with open(path) as f:
        data = json.load(f)
    B = data["booths"]
    n = len(B["id"])
    if n != BOOTHS_PIN:
        fail(f"{YEAR_TAG}: {n} booths != pin {BOOTHS_PIN} "
             "(the data build changed — re-pin after review)")
    for lane in ("lat", "lon", "ty", "dec"):
        if len(B[lane]) != n:
            fail(f"{YEAR_TAG}: booth lane {lane} length drifted")
    geocoded = sum(1 for k in B["lat"] if k is not None)
    if geocoded != GEOCODED_PIN:
        fail(f"{YEAR_TAG}: {geocoded} geocoded booths != pin {GEOCODED_PIN}")
    owned = sum(1 for k in B["dec"] if k is not None)
    if owned:
        fail(f"{YEAR_TAG}: {owned} dec rows already filled — the lane is "
             f"not this script's on a stale data build (rerun "
             f"build_{YEAR_TAG}_data.py first)")
    filled_demo = sum(1 for k in (B.get("demo") or []) if k is not None)
    if filled_demo:
        fail(f"{YEAR_TAG}: {filled_demo} demo rows already filled — the "
             f"lane is not this script's on a stale data build (rerun "
             f"build_{YEAR_TAG}_data.py first)")
    out_sa1, suppressions = set(), 0
    counts = {"pip": 0, "noscore": 0, "demo": 0, "teams": 0, "nocoords": 0}
    dec_col, demo_col = [], []
    for k in range(n):
        lat, lon, ty = B["lat"][k], B["lon"][k], B["ty"][k]
        if ty == 4:
            counts["teams"] += 1
            dec_col.append(None)
            demo_col.append(None)
            continue
        if lat is None:
            # 2015's un-matched fixed venues: the parent's loud-fail
            # clause, softened per the frame's own roll — null lanes,
            # counted
            counts["nocoords"] += 1
            dec_col.append(None)
            demo_col.append(None)
            continue
        code = pip(lon, lat)
        if code is None:
            fail(f"{YEAR_TAG} booth {B['n'][k]!r} at {lat},{lon}: inside "
                 "no SA1 polygon — an offshore or misplaced venue needs "
                 "an explicit guard, never a silent miss")
        counts["pip"] += 1
        out_sa1.add(code)
        d = decs.get(code)
        if d is None:
            counts["noscore"] += 1
            dec_col.append(None)
        else:
            if all(v is None for v in d.values()):
                counts["noscore"] += 1
            suppressions += sum(1 for v in d.values() if v is None)
            dec_col.append([d[ix] for ix in IX])
        dm = demos.get(code)
        if dm is None:
            fail(f"{YEAR_TAG} booth {B['n'][k]!r}: SA1 {code} has no BCP "
                 "row (the BCP and SA1 packs must cover the same codes)")
        counts["demo"] += 1
        demo_col.append(list(dm))
    B["dec"] = dec_col
    B["demo"] = demo_col
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{YEAR_TAG}: {counts['pip']} booths joined to {len(out_sa1)} SA1s "
          f"({counts['noscore']} in SA1s the cube does not score, "
          f"{suppressions} suppressed index cells, {counts['teams']} mobile "
          f"teams null, {counts['nocoords']} fixed booths without coords "
          f"null) -> {path} ({os.path.getsize(path)} bytes)")


main()
