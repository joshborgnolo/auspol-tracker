#!/usr/bin/env python3
"""Booth-level census lanes (dec/demo) for the vic14 map frame — the
build_vic22_boothcensus.py recipe at its deepest census vintage: 2011
predates the GCP series, so this rides the 2011 Census Basic Community
Profile (the GCP's own pre-2016 form) and the SEIFA 2011 cube. vic14
shares vic18's 88 districts — the 2013 redistribution's boundaries,
one boundary geojson serving both frames; the census editions move.

build_vic14_data.py geocodes the 2014 venue roll by name onto
Democracy Sausage's 2022 roll; 73 of the 1,786 venues carry no
coordinates (the data build's GEO_PINS "miss") — the era simply can
not place them, and their lanes stay null by design (qld17's
ERA_UNLOCATED_OK discipline, never an estimate). Every located venue
joins to the SA1 it stands in — the venue-proxy read the map carries
as booths' `dec` (national SEIFA deciles) and `demo` (people cells)
lanes. The VEC releases no votes-by-SA1 product, so this frame's
voter-footprint lane (`vdec`, another wave's write) stays null.

  dec  — [irsad, irsd, ier, ieo] NATIONAL deciles of the booth's SA1,
         taken from the ABS SEIFA 2011 cube's own per-area decile
         columns (the score column resolved by header title, the
         decile verified the column beside it — build_vic14_seifa.py's
         exact reader discipline; a decile is null where the cube
         publishes no score for the index)
  demo — the SA1's own people cells [lang, a65, a2034, fborn, uni,
         blue, null, null], computed from the 2011 Census BCP SA1
         tables at the exact bases of the district people lanes
         (build_vic14_demo.py), so a booth row is commensurate with
         its district's row. A cell is null where its denominator is
         zero or census perturbation takes the arithmetic outside
         [0,1] (emit no number rather than clamp one).

Inputs (all caches already ride this repo's other pipelines):
  .build/analysis/seat-model/cache/bcp-sa1-2011.zip      (2011 BCP SA1 datapack)
  .matilda/seifa-irsad-abs/abs-seifa-2011-sa1-indexes.xls (SEIFA 2011 SA1 cube)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2011_aust_shape.zip (SA1 2011 polygons)
  map/data/data-vic14.json (build_vic14_data.py's output; this script
        splices the two lanes in in place and rewrites it — it runs
        after that build and is itself rerun after it, since the
        data build wipes the lanes)

usage: python3 .build/map/build_vic14_boothcensus.py
(no -I: xlrd is a user-site package of this machine and -I hides user site)
"""
import functools
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vic13_geo import (VINTAGES, VIC_SENTINELS, in_geometry,  # noqa: E402
                       read_sa1_polygons)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FRAME = "vic14"
YEAR = 2011
ERA = "2011"
V = VINTAGES[YEAR]
BCP_ZIP = V["gcp"]              # .build/analysis/seat-model/cache/bcp-sa1-2011.zip
BCP_ROWS = V["gcp_rows"]        # 54,805 national
BCP_VIC_ROWS = 13339            # measured 2026-11-04 (13335 shaped + 4 sentinels)
CUBE_XLS = os.path.join(
    REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2011-sa1-indexes.xls")
CUBE_ROWS = 52678               # build_vic14_seifa.py's pins, same cube
CUBE_VIC_ROWS = 12954
CUBE_CODE_LEN = 7
DATA_JSON = os.path.join(REPO, "map", "data", "data-vic14.json")
VENUES = 1786                   # the data build's GEO_PINS venues
UNLOCATED = 73                  # ... and its GEO_PINS miss

IX = ["irsad", "irsd", "ier", "ieo"]
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}


def fail(msg):
    raise SystemExit(f"vic14-boothcensus: {msg}")


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
    step = 0.25  # the nsw23/booth-seifa store's static-grid recipe
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


@functools.lru_cache(maxsize=None)
def seifa_deciles():
    """SA1 code -> {ix: national decile|None} from the SEIFA 2011 cube's
    own per-area decile columns — build_vic14_seifa.py's xlrd reader
    with the vic22/qld decile-beside-the-score verification."""
    import xlrd
    if not os.path.exists(CUBE_XLS):
        fail(f"missing SEIFA cube {CUBE_XLS}")
    wb = xlrd.open_workbook(CUBE_XLS, on_demand=True)
    if "Table 1" not in wb.sheet_names():
        fail(f"cube sheets {wb.sheet_names()} lack 'Table 1'")
    sh = wb.sheet_by_name("Table 1")
    rows = [sh.row_values(r) for r in range(sh.nrows)]
    wb.release_resources()
    canon = lambda t: " ".join(str(t).upper().split())
    title_i = next(i for i, r in enumerate(rows)
                   if r and any(t and "INDEX OF" in canon(t) for t in r))
    title_row = [canon(t) if t is not None else "" for t in rows[title_i]]
    sub_row = list(rows[title_i + 1]) if len(rows) > title_i + 1 else []
    cols = {}
    for ix, wanted in INDEX_TITLES.items():
        for i, t in enumerate(title_row):
            if t and any(w in t for w in wanted):
                cols[ix] = i
                break
        if ix not in cols:
            fail(f"cube header drift: no column titles {wanted!r}")
    for ix, c in cols.items():
        hist = canon(sub_row[c + 1]) if c + 1 < len(sub_row) and sub_row[c + 1] else ""
        if "DECILE" not in hist:
            fail(f"cube {ix}: column after the score is not a Decile column")
    out, n, nvic = {}, 0, 0
    for row in rows[title_i + 1:]:
        if not row:
            continue
        v = row[0]
        if isinstance(v, float):
            v = int(v)
        s = str(v) if v is not None else ""
        if not (len(s) == CUBE_CODE_LEN and s.isdigit()):
            continue
        n += 1
        if not s.startswith("2"):
            continue
        nvic += 1
        rec = {}
        for ix, c in cols.items():
            sc = row[c] if c < len(row) else None
            dc = row[c + 1] if c + 1 < len(row) else None
            if not isinstance(sc, (int, float)):
                rec[ix] = None
            elif not isinstance(dc, (int, float)):
                fail(f"cube {s}: {ix} score {sc} with no decile beside it")
            else:
                rec[ix] = int(dc)
                if not 1 <= rec[ix] <= 10:
                    fail(f"cube {s}: {ix} decile {rec[ix]} outside 1..10")
        out[s] = rec
    if n != CUBE_ROWS or nvic != CUBE_VIC_ROWS:
        fail(f"cube rows {n} (pin {CUBE_ROWS}), VIC {nvic} (pin {CUBE_VIC_ROWS})")
    print(f"cube {YEAR} VIC deciles: {nvic} SA1s")
    return out


@functools.lru_cache(maxsize=None)
def demo_cells():
    """SA1 code -> demo row [lang, a65, a2034, fborn, uni, blue, None,
    None] on the district people lanes' exact bases
    (build_vic14_demo.py's shares(), via gcp_newlanes.demo_base's raw
    counts)."""
    if not os.path.exists(BCP_ZIP):
        fail(f"missing BCP input {BCP_ZIP}")
    base = gcp_newlanes.demo_base(BCP_ZIP, prefix="2", era=ERA)
    if len(base) != BCP_VIC_ROWS:
        fail(f"BCP Vic rows {len(base)} != pin {BCP_VIC_ROWS}")
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
            # [0,1] — emit no number rather than clamp one
            if _den <= 0:
                return None
            v = _num / _den
            return round(v, 4) if 0 <= v <= 1 else None
        out[code] = [safe(oth, eng + oth),
                     safe(bands[8] + bands[9] + bands[10], bsum),
                     safe(bands[3] + bands[4], bsum),
                     safe(tot - cobns - aust, tot - cobns),
                     safe(uni, pop15 - eduns),
                     safe(blue, occd),
                     None, None]
    if len(out) != BCP_VIC_ROWS:
        fail(f"demo cells {len(out)} != pin {BCP_VIC_ROWS}")
    print(f"BCP {YEAR} demo cells: {len(out)} SA1s")
    return out


# ------------------------------------------------------------------ the join
def main():
    decs = seifa_deciles()
    demos = demo_cells()
    # the four Vic sentinel SA1s (migratory/offshore) hold census
    # persons but no polygon: they stay IN the demo universe and OUT of
    # the join — vic13_geo pins the set; the coverage identity below is
    # the frame's "sentinels excluded exactly" guard
    sent = VIC_SENTINELS[YEAR]
    shapes = set(sa1_polygons()[0])
    if set(demos) - sent != shapes:
        fail("BCP universe minus the sentinel SA1s does not equal the "
             "shape set")
    path = DATA_JSON
    if not os.path.exists(path):
        fail(f"missing {path} — run build_vic14_data.py first")
    with open(path) as f:
        data = json.load(f)
    if data.get("year") != FRAME:
        fail(f"{path} is not the {FRAME} frame")
    if data.get("demoBasis") != "sa1" or data.get("demoYear") != YEAR:
        fail(f"{FRAME}: demoBasis/demoYear drift "
             f"({data.get('demoBasis')!r}/{data.get('demoYear')!r})")
    B = data["booths"]
    n = len(B["id"])
    if n != VENUES:
        fail(f"{FRAME}: {n} booth lanes != pinned {VENUES} venues")
    for lane in ("lat", "lon", "ty", "dec", "vdec"):
        if len(B[lane]) != n:
            fail(f"{FRAME}: booth lane {lane} length drifted")
    owned = sum(1 for k in B["dec"] if k is not None)
    if owned:
        fail(f"{FRAME}: {owned} dec rows already filled — the lane is not this script's on a stale data build "
             f"(rerun build_vic14_data.py first)")
    if "demo" in B or data.get("cobKeys"):
        fail(f"{FRAME}: demo lane or cobKeys already set — the lane is not this script's on a stale data build "
             f"(rerun build_vic14_data.py first)")
    if any(k is not None for k in B["vdec"]):
        fail(f"{FRAME}: vdec rows filled — that lane is not this script's")
    unlocated_pin = sum(1 for k in range(n)
                        if B["lat"][k] is None or B["lon"][k] is None)
    if unlocated_pin != UNLOCATED:
        fail(f"{FRAME}: {unlocated_pin} booths without coordinates != "
             f"pinned {UNLOCATED}")
    if any((B["lat"][k] is None) != (B["lon"][k] is None) for k in range(n)):
        fail(f"{FRAME}: a booth carries only one of lat/lon")
    out_sa1, suppressions = set(), 0
    counts = {"pip": 0, "noscore": 0, "mobile": 0, "unlocated": 0}
    dec_col, demo_col = [], []
    for k in range(n):
        lat, lon, ty = B["lat"][k], B["lon"][k], B["ty"][k]
        if ty == 4:
            # the mobile-team null guard; vic14's roll carries none
            counts["mobile"] += 1
            dec_col.append(None)
            demo_col.append(None)
            continue
        if lat is None:
            counts["unlocated"] += 1
            dec_col.append(None)
            demo_col.append(None)
            continue
        code = pip(lon, lat)
        if code is None:
            fail(f"{FRAME} booth {B['n'][k]!r} at {lat},{lon}: inside no SA1 polygon — an offshore or misplaced venue needs an explicit guard, never a silent miss")
        if code in sent:
            fail(f"{FRAME} booth {B['n'][k]!r}: joined sentinel SA1 {code}")
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
            fail(f"{FRAME} booth {B['n'][k]!r}: SA1 {code} has no BCP row (the BCP and SA1 packs must cover the same codes)")
        demo_col.append(list(dm))
    B["dec"] = dec_col
    B["demo"] = demo_col
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{FRAME}: {counts['pip']} booths joined to {len(out_sa1)} SA1s "
          f"({counts['noscore']} in SA1s the cube does not score, "
          f"{suppressions} suppressed index cells, {counts['mobile']} mobile teams null, "
          f"{counts['unlocated']} unlocated null) "
          f"-> {path} ({os.path.getsize(path)} bytes)")


main()
