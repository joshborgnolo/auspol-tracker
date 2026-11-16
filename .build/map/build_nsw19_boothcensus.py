#!/usr/bin/env python3
"""Booth-level census lanes (dec/demo) for the nsw19 map frame — the
build_nsw23_boothcensus.py recipe on the nsw19 frame's own census
vintage (the 2016 GCP/SEIFA editions — the build_vic18_boothcensus.py
twin's exact era, on the NSWEC venue roll — one census edition above
the nsw15 frame's 2011 BCP).

Every geocoded fixed booth of the 2019 state election's NSWEC venue
roll joins to the census area it stands in — the venue-proxy read the
map carries as booths' `dec` (national SEIFA deciles) and `demo`
(people cells) lanes, here on the 2016 census's SA1 universe (the
frame's own vintage: data-nsw19.json carries demoYear 2016, and
data/nsw19-demo.json and data/nsw19-seifa.json pool the same edition
to districts). NSWEC releases no votes-by-SA1 product, so the voter-
footprint lane (`vdec`, a federal read) stays null by design. Mobile
teams never join (a mobile team has no fixed venue and the team's
nominal point says nothing about where it polled — every ty-4 row
stays null even when the roll prints coordinates), and 2019's venue
roll geocodes every fixed venue, so the null-coords branch is a
softened loud-fail clause that never fires — a coord-less row takes
null lanes and counts (qld17's ERA_UNLOCATED_OK discipline, never an
estimate).

  dec  — [irsad, irsd, ier, ieo] NATIONAL deciles of the booth's SA1,
         taken from the ABS SEIFA 2016 cube's own per-area decile
         columns (the column right of each score column, resolved by
         header title — the same titles the district SEIFA pipeline
         resolves by name; a decile is null where the cube publishes no
         score for the index)
  demo — the SA1's own 19-cell people row in the app's DM tuple order
         ([lang, a65, a2034, fborn, uni, blue, loinc, hiinc, y12,
         y10less, atsci, u15, onepar, pt, noncit, bigfam, hl, hiqinc,
         unemp] — the build_vic18_boothcensus.py fill, at the district
         people lanes' exact bases (build_nsw19_demo.py)), with the
         cob/rel/ten/anc/ind/mar rows beside it, each in its top-level
         key record's site order (cobKeys/relKeys/tenKeys/ancKeys/
         indKeys/marKeys). A cell is null where its denominator is
         zero or census perturbation takes the arithmetic outside
         [0,1] (emit no number rather than clamp). The frame's top
         level also gains its own incomeCuts record.

Inputs (all caches already ride this repo's other pipelines):
  .build/analysis/seat-model/cache/gcp-sa1-2016.zip           (GCP 2016 SA1 datapack)
  .matilda/seifa-irsad-abs/abs-seifa-2016-sa1-indexes.xls     (SEIFA 2016 SA1 cube, legacy .xls)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2016_aust_shape.zip (SA1 2016 polygons)
  map/data/data-nsw19.json                                    (the map data build;
        this script splices the lanes into it and rewrites it — it
        runs after build_nsw19_data.py and is itself rerun after it
        whenever that build changes, since that build wipes the lanes)

Chain:
  python3 -I .build/map/build_nsw19_data.py
  python3 .build/map/build_nsw19_boothcensus.py   (no -I: xlrd is a
    user-site package of this machine and -I hides user site, exactly
    like build_nsw19_seifa.py)

Deps: stdlib + xlrd (the 2016 cube's legacy .xls; the sibling SEIFA
builder's reader library).
usage: python3 .build/map/build_nsw19_boothcensus.py
"""
import functools
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nsw13_geo import (NSW_SENTINELS, VINTAGES, in_geometry,  # noqa: E402
                       read_sa1_polygons)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
YEAR = 2016
YEAR_TAG = "nsw19"
V = VINTAGES[YEAR]
GCP_ZIP = V["gcp"]
CUBE_XLS = os.path.join(REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2016-sa1-indexes.xls")
GCP_KEY = V["gcp_key"]          # SA1_7DIGITCODE_2016
GCP_ROWS = V["gcp_rows"]        # 57,523 national (incl. the 4 NSW sentinels)
MEMBER = V["member"].format     # 2016 Census GCP .../2016Census_{t}_AUS_SA1.csv

#: frame-roster pins, measured from the committed data build 2026-11-04;
#: a drift past any of these is a guard trip, never a silent re-derive
BOOTHS_PIN = 2946
GEOCODED_PIN = 2855            # booths with lat/lon (includes 93 ty-4 team rows)
GCP_NSW_ROWS = 18399           # build_nsw19_demo.py's pin (incl. sentinels)

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
#: cube row-set pins (national/NSW), build_nsw19_seifa.py's: an SA1 the
#: cube could not score carries NO row
CUBE_CODE_ROWS = 55140
CUBE_NSW_ROWS = 17648

# the G09 top-country columns surfaced on /map/ as birthplace sub-views
# (the federal stores' COB_KEYS — site-key order; 2016's G09 vocab is
# 2021's — build_nsw19_demo.py's own column set)
COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita",
            "lka", "sct"]
GCP_G09F_COLS = ["P_Australia_Tot", "P_England_Tot", "P_China_Tot"]
GCP_G09G_COLS = ["P_India_Tot", "P_New_Zealand_Tot", "P_Italy_Tot"]
GCP_G09H_COLS = ["P_Tot_Tot", "P_COB_NS_Tot", "P_Philippines_Tot",
                 "P_Vietnam_Tot", "P_South_Africa_Tot", "P_Scotland_Tot",
                 "P_Sri_Lanka_Tot"]


def fail(msg):
    raise SystemExit(f"nsw19-boothcensus: {msg}")


# ------------------------------------------------------------- census tables
@functools.lru_cache(maxsize=None)
def sa1_polygons():
    out = read_sa1_polygons(YEAR)
    pre = {}
    for code, polys in out.items():
        boxes = []
        for outer, _holes in polys:
            xs = [p[0] for p in outer]
            ys = [p[1] for p in outer]
            boxes.append((min(xs), min(ys), max(xs), max(ys)))
        pre[code] = boxes
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
    """SA1 code -> {ix: national decile|None} from the ABS 2016 cube's
    own per-area decile columns. Columns resolved by header title (score
    column), the decile column verified to follow it — build_nsw19_
    seifa.py's xlrd conventions on the same file."""
    if not os.path.exists(CUBE_XLS):
        fail(f"missing SEIFA cube {CUBE_XLS}")
    try:
        import xlrd
    except ImportError:
        fail("needs xlrd (user-site on this machine; run without -I "
             "like build_nsw19_seifa.py)")
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
    """SA1 code -> (demo row [lang, a65, a2034, fborn, uni, blue, loinc,
    hiinc, y12, y10less, atsci, u15, onepar, pt, noncit, bigfam, hl,
    hiqinc, unemp], cob row in COB_KEYS order, rel row in REL_KEYS
    order, ten row in TEN_KEYS order, anc row in ANC_KEYS order, ind row
    in IND_KEYS order, mar row in MAR_KEYS order) with the district
    people lanes' exact bases (build_nsw19_demo.py, whose shared helpers
    all read the 2016 GCP the same way)."""
    import csv
    import io
    import zipfile
    if not os.path.exists(GCP_ZIP):
        fail(f"missing GCP input {GCP_ZIP}")
    base = gcp_newlanes.demo_base(GCP_ZIP, prefix="1", era="2016")
    newl = gcp_newlanes.load(GCP_ZIP, prefix="1", era="2016")
    arc = gcp_newlanes.load_arc31(GCP_ZIP, prefix="1", era="2016")
    lab = gcp_newlanes.load_lab(GCP_ZIP, prefix="1", era="2016")
    ind = gcp_newlanes.load_ind(GCP_ZIP, prefix="1", era="2016")
    mar = gcp_newlanes.load_mar(GCP_ZIP, prefix="1", era="2016")
    inc, _inc_cutrec = gcp_newlanes.state_income(GCP_ZIP, "2016", "1")
    HL = gcp_newlanes.hl_alloc_of(YEAR, "c7")
    if len(base) != GCP_NSW_ROWS:
        fail(f"GCP NSW rows {len(base)} != pin {GCP_NSW_ROWS}")
    # the G09 birthplace read (Australia/total/not-stated ride demo_base;
    # this fetch carries the country rows in the GCP_G09*_COLS order)
    z = zipfile.ZipFile(GCP_ZIP)
    extra = {}
    for tag, cols in (("G09F", GCP_G09F_COLS), ("G09G", GCP_G09G_COLS),
                      ("G09H", GCP_G09H_COLS)):
        member = MEMBER(table=tag)
        if member not in z.namelist():
            fail(f"GCP zip lacks {member}")
        d, m = {}, 0
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in [GCP_KEY, *cols]
                    if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"GCP {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row[GCP_KEY]
                if code.startswith("1"):
                    d[code] = tuple(int(row[c]) for c in cols)
        if m != GCP_ROWS or len(d) != GCP_NSW_ROWS:
            fail(f"GCP {tag} rows {m} (pin {GCP_ROWS}), NSW {len(d)} (pin {GCP_NSW_ROWS})")
        extra[tag] = d
    out = {}
    for code, r in base.items():
        p, eng, oth, bands = r[0], r[1], r[2], r[3]
        aust, tot, cobns = r[4], r[5], r[6]
        uni4, oc = r[7], r[8]
        uni, eduns = sum(uni4[:3]), uni4[3]
        blue, occd = oc[2] + oc[6] + oc[7], sum(oc)
        bsum = sum(bands)
        pop15 = p - bands[0] - bands[1]

        def safe(_num, _den):
            # the bounded() recipe: a share of an ex-not-stated basis is
            # none when the basis is empty, AND none when census
            # perturbation of a tiny SA1 takes the arithmetic outside
            # [0,1] (cross-table cells disagree at population ~19) — emit
            # no number rather than clamp one
            if _den <= 0:
                return None
            v = _num / _den
            return round(v, 4) if 0 <= v <= 1 else None
        sch6, indt, (relvec, relns, reltot), ten6, fam = newl[code]
        rel = [safe(v, reltot - relns) for v in relvec]
        own, mort, rent, rentpub, othtype, tenns = ten6
        tend = own + mort + rent + othtype
        ten = [safe(mort, tend), safe(rent, tend),
               safe(own, tend), safe(rentpub, tend)]
        citz, (ptn, ptt, ptns), (ceb3, cebns, cebt), \
            (ancv, ancp, ancns) = arc[code]
        hle = HL.get(code, {}).get("e", 0.0)
        uel, lfd = lab[code]
        iv, _ivns, _ivt = ind[code]
        ivd = sum(iv)
        indsh = [safe(v, ivd) for v in iv]
        aud, lom, him, _med, _bands_ad, _hh, hiqm = inc[code]
        anc = [safe(v, ancp - ancns) for v in ancv]
        marv = mar[code]
        marsh = [safe(v, sum(marv)) for v in marv]
        f09 = extra["G09F"][code]
        g09 = extra["G09G"][code]
        h09 = extra["G09H"][code]
        den09 = h09[0] - h09[1]
        cob = (f09[1], g09[0], f09[2], g09[1], h09[2], h09[3], h09[4],
               g09[2], h09[6], h09[5])
        out[code] = ([safe(oth, eng + oth),
                     safe(bands[8] + bands[9] + bands[10], bsum),
                     safe(bands[3] + bands[4], bsum),
                     safe(tot - cobns - aust, tot - cobns),
                     safe(uni, pop15 - eduns),
                     safe(blue, occd),
                     safe(lom, aud), safe(him, aud),
                     gcp_newlanes.y12_cell(sch6, safe),
                     gcp_newlanes.y10less_cell(sch6, safe),
                     safe(indt[0], indt[1]),
                     gcp_newlanes.u15_cell(bands, safe),
                     safe(fam[0], fam[1]),
                     safe(ptn, ptt - ptns),
                     safe(p - citz, p),
                     safe(ceb3, cebt - cebns),
                     safe(hle, p),
                     safe(hiqm, aud),
                     safe(uel, lfd)],
                     [safe(c, den09) for c in cob], rel, ten, anc,
                     indsh, marsh)
    if len(out) != GCP_NSW_ROWS:
        fail(f"demo cells {len(out)} != pin {GCP_NSW_ROWS}")
    print(f"GCP {YEAR} demo cells: {len(out)} SA1s")
    return out


# ------------------------------------------------------------------ the join
def main():
    decs = seifa_deciles()
    demos = demo_cells()
    # the four NSW sentinel SA1s (migratory/offshore) hold census
    # persons but no polygon: they stay IN the demo universe and OUT of
    # the join — nsw13_geo pins the set; the coverage identity below is
    # the frame's "sentinels excluded exactly" guard
    sent = NSW_SENTINELS[YEAR]
    shapes = set(sa1_polygons()[0])
    if set(demos) - sent != shapes:
        fail("GCP universe minus the sentinel SA1s does not equal the "
             "shape set")
    path = os.path.join(REPO, "map", "data", f"data-{YEAR_TAG}.json")
    if not os.path.exists(path):
        fail(f"missing {path} — run build_{YEAR_TAG}_data.py first")
    with open(path) as f:
        data = json.load(f)
    if data.get("year") != YEAR_TAG:
        fail(f"{path} is not the {YEAR_TAG} frame")
    if data.get("demoBasis") != "sa1" or data.get("demoYear") != YEAR:
        fail(f"{YEAR_TAG}: demoBasis/demoYear drift "
             f"({data.get('demoBasis')!r}/{data.get('demoYear')!r})")
    B = data["booths"]
    n = len(B["id"])
    if n != BOOTHS_PIN:
        fail(f"{YEAR_TAG}: {n} booths != pin {BOOTHS_PIN} "
             "(the data build changed — re-pin after review)")
    for lane in ("lat", "lon", "ty", "dec", "vdec"):
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
    if "demo" in B or data.get("cobKeys"):
        fail(f"{YEAR_TAG}: demo lane or cobKeys already set — the lane is "
             f"not this script's on a stale data build (rerun "
             f"build_{YEAR_TAG}_data.py first)")
    if any(k is not None for k in B["vdec"]):
        fail(f"{YEAR_TAG}: vdec rows filled — that lane is not this "
             f"script's")
    if any((B["lat"][k] is None) != (B["lon"][k] is None) for k in range(n)):
        fail(f"{YEAR_TAG}: a booth carries only one of lat/lon")
    out_sa1, suppressions = set(), 0
    counts = {"pip": 0, "noscore": 0, "demo": 0, "teams": 0, "nocoords": 0}
    dec_col, demo_col, cob_col, rel_col, ten_col, anc_col, ind_col, mar_col = \
        [], [], [], [], [], [], [], []
    for k in range(n):
        lat, lon, ty = B["lat"][k], B["lon"][k], B["ty"][k]
        if ty == 4:
            counts["teams"] += 1
            dec_col.append(None)
            demo_col.append(None)
            cob_col.append(None)
            rel_col.append(None)
            ten_col.append(None)
            anc_col.append(None)
            ind_col.append(None)
            mar_col.append(None)
            continue
        if lat is None:
            # a fixed venue the roll carries no coordinates for (2015's
            # un-matched venues class): the parent's loud-fail clause,
            # softened per the frame's own roll — null lanes, counted
            counts["nocoords"] += 1
            dec_col.append(None)
            demo_col.append(None)
            cob_col.append(None)
            rel_col.append(None)
            ten_col.append(None)
            anc_col.append(None)
            ind_col.append(None)
            mar_col.append(None)
            continue
        code = pip(lon, lat)
        if code is None:
            fail(f"{YEAR_TAG} booth {B['n'][k]!r} at {lat},{lon}: inside "
                 "no SA1 polygon — an offshore or misplaced venue needs "
                 "an explicit guard, never a silent miss")
        if code in sent:
            fail(f"{YEAR_TAG} booth {B['n'][k]!r}: joined sentinel SA1 "
                 f"{code}")
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
            fail(f"{YEAR_TAG} booth {B['n'][k]!r}: SA1 {code} has no GCP "
                 "row (the GCP and SA1 packs must cover the same codes)")
        counts["demo"] += 1
        demo_col.append(list(dm[0]))
        cob_col.append(list(dm[1]))
        rel_col.append(list(dm[2]))
        ten_col.append(list(dm[3]))
        anc_col.append(list(dm[4]))
        ind_col.append(list(dm[5]))
        mar_col.append(list(dm[6]))
    B["dec"] = dec_col
    B["vdec"] = [None] * n  # NSWEC releases no votes-by-SA1 product; the
    # voter-footprint lane is a federal AEC read and stays empty by design
    B["demo"] = demo_col
    B["cob"] = cob_col
    B["rel"] = rel_col
    B["ten"] = ten_col
    B["anc"] = anc_col
    B["ind"] = ind_col
    B["mar"] = mar_col
    data["cobKeys"] = COB_KEYS
    data["relKeys"] = list(gcp_newlanes.REL_KEYS)
    data["tenKeys"] = ["mort", "rent", "own", "rentPub"]
    data["ancKeys"] = list(gcp_newlanes.ANC_KEYS)
    data["indKeys"] = list(gcp_newlanes.IND_KEYS)
    data["marKeys"] = list(gcp_newlanes.MAR_KEYS)
    # the frame's own income-cuts record (the shared engine post its
    # 2026-11-04 family-block fix is NSW-2016's only rider)
    _unused_inc, inc_cutrec = gcp_newlanes.state_income(GCP_ZIP, "2016", "1")
    data["incomeCuts"] = inc_cutrec
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{YEAR_TAG}: {counts['pip']} booths joined to {len(out_sa1)} SA1s "
          f"({counts['noscore']} in SA1s the cube does not score, "
          f"{suppressions} suppressed index cells, {counts['teams']} mobile "
          f"teams null, {counts['nocoords']} fixed booths without coords "
          f"null) -> {path} ({os.path.getsize(path)} bytes)")


main()
