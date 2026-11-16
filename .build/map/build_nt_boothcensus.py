#!/usr/bin/env python3
"""Booth-level census lanes (dec/demo) for the Northern Territory map
frames (nt16, nt20, nt24) — the build_wa_boothcensus.py recipe (itself the
nsw23/qld/vic/sa discipline) on the NTEC frames' venue registers. Every
NT venue row carries coordinates — pp-nt.json's locality-anchored
geocoding located all 338 of them, so the length-zero unlocated
registers below are the era's record, pinned and any drift a guard trip.
Mobile teams never made it to the frames' booth lanes (they fold into
the district totals instead), so the ty==4 register pins at zero too.

Every located venue joins to the SA1 it stands in — the venue-proxy read
the map carries as the booths' `dec` (national SEIFA deciles) and `demo`
(people cells) lanes. No NT-era product releases votes-by-SA1, so the
voter-footprint lane (`vdec`) stays null. Census vintages follow
nt_geo.FRAMES: nt16 reads the 2016 GCP/SEIFA editions, nt20/nt24 the
2021. NT's four sentinel SA1s per vintage (migratory/offshore,
nt_geo.NT_SENTINELS) stay IN the demo universe and OUT of the join — the
coverage identity (GCP universe minus sentinels equals the shape set) is
asserted per frame, the lanes' load-bearing pin.

  dec  — [irsad, irsd, ier, ieo] NATIONAL deciles of the booth's SA1,
         taken from the vintage's ABS SEIFA cube per-area decile
         columns (score column resolved by header title, the Decile
         column verified beside it; a decile is null where the cube
         publishes no score for the index)
  demo — the SA1's own 19-cell people row in the app's DM tuple order,
         computed from the GCP SA1 tables with the same member and
         column choices and the same ex-not-stated bases as the district
         people lanes (the frame's own build_nt<yy>_demo.py), so a
         booth's row is commensurate with its district's; the
         cob/rel/ten/anc/ind/mar rows beside it ride their top-level
         key records' site orders. A cell is null where its denominator
         is zero or census perturbation takes the arithmetic outside
         [0,1] (emit no number rather than clamp one). Each frame's top
         level also gains its own incomeCuts record.

Inputs (all caches already ride this repo's other pipelines):
  .build/analysis/seat-model/cache/gcp-sa1-2016.zip      (GCP 2016 SA1 datapack)
  .build/analysis/seat-model/cache/gcp-sa1-2021.zip      (GCP 2021 SA1 datapack)
  .matilda/seifa-irsad-abs/abs-seifa-2016-sa1-indexes.xls (SEIFA 2016 SA1 cube)
  .matilda/seifa-irsad-abs/abs-seifa-2021-sa1-indexes.xlsx (SEIFA 2021 SA1 cube)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2016_aust_shape.zip (SA1 2016 polygons)
  .build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip (SA1 2021 polygons)
  .build/analysis/seat-model/cache/homeless-sa1-{2016,2021}-alloc.json
  map/data/data-nt<yy>.json (build_nt<yy>_data.py's output; this script
        splices the lanes into it and rewrites it — it runs after that
        build and is itself rerun after it, since the data build
        wipes the lanes)

usage: python3 .build/map/build_nt_boothcensus.py [nt16 nt20 nt24]
(no -I: xlrd is a user-site package of this machine and -I hides user site)
"""
import functools
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nt_geo  # noqa: E402
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

FRAMES = nt_geo.FRAMES  # frame -> census vintage year
VENUES = {"nt16": 88, "nt20": 116, "nt24": 134}         # the data builds' booth-lane lengths
UNLOCATED = {"nt16": 0, "nt20": 0, "nt24": 0}           # venues the era's register leaves unlocated
MOBILE = {"nt16": 0, "nt20": 0, "nt24": 0}              # ty==4 teams (none reach the lanes)

GCP_NT_ROWS = {2016: 626, 2021: 649}   # prefix "7" per zip, measured 2026-11-16
CUBE_ROWS = {2016: 55140, 2021: 59421} # national pins
CUBE_NT_ROWS = {2016: 544, 2021: 576}  # prefix "7" per cube, measured 2026-11-16
CUBES = {
    2016: os.path.join(REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2016-sa1-indexes.xls"),
    2021: os.path.join(REPO, ".matilda", "seifa-irsad-abs", "abs-seifa-2021-sa1-indexes.xlsx"),
}
CUBE_KIND = {2016: "xls", 2021: "xlsx"}
# the homeless est-allocation key form per edition ("c7" cube-7-digit |
# "m" SA1-main)
HL_FORM = {2016: "c7", 2021: "m"}

IX = ["irsad", "irsd", "ier", "ieo"]
INDEX_TITLES = {
    "irsad": ("INDEX OF RELATIVE SOCIO-ECONOMIC ADVANTAGE AND DISADVANTAGE",),
    "irsd": ("INDEX OF RELATIVE SOCIO-ECONOMIC DISADVANTAGE",),
    "ier": ("INDEX OF ECONOMIC RESOURCES",),
    "ieo": ("INDEX OF EDUCATION AND OCCUPATION", "INDEX OF EMPLOYMENT AND OCCUPATION"),
}
COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita",
            "lka", "sct"]
GCP_G09F_COLS = ["P_Australia_Tot", "P_England_Tot", "P_China_Tot"]
GCP_G09G_COLS = ["P_India_Tot", "P_New_Zealand_Tot", "P_Italy_Tot"]
GCP_G09H_COLS = ["P_Tot_Tot", "P_COB_NS_Tot", "P_Philippines_Tot",
                 "P_Vietnam_Tot", "P_South_Africa_Tot", "P_Scotland_Tot",
                 "P_Sri_Lanka_Tot"]


def fail(msg):
    raise SystemExit(f"nt-boothcensus: {msg}")


# ------------------------------------------------------------- census tables
@functools.lru_cache(maxsize=None)
def sa1_polygons(year):
    out = nt_geo.read_sa1_polygons(year)
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


def pip(year, lon, lat):
    sa1, grid, step, boxes = sa1_polygons(year)
    ci, cj = int(lon / step), int(lat / step)
    for radius in (0, 1, 2):
        codes = set()
        for i in range(ci - radius, ci + radius + 1):
            for j in range(cj - radius, cj + radius + 1):
                codes |= grid.get((i, j), set())
        hits = [code for code in codes
                if any(bb[0] - 1e-9 <= lon <= bb[2] + 1e-9 and bb[1] - 1e-9 <= lat <= bb[3] + 1e-9
                       for bb in boxes[code])
                and wa_in_geometry(year, sa1, code, lon, lat)]
        if hits:
            return sorted(hits)[0]
    return None


def wa_in_geometry(year, sa1, code, lon, lat):
    import wa_geo
    return wa_geo.in_geometry((lon, lat), sa1[code])


@functools.lru_cache(maxsize=None)
def seifa_deciles(year):
    """SA1 code -> {ix: national decile|None} from that vintage's cube —
    the qld joint's era-blind reader (title row by INDEX scan, the
    Decile column verified beside the score, 1..10 bounds)."""
    path, kind = CUBES[year], CUBE_KIND[year]
    if not os.path.exists(path):
        fail(f"missing SEIFA cube {path}")
    if kind == "xlsx":
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True)
        if "Table 1" not in wb.sheetnames:
            fail(f"cube sheets {wb.sheetnames} lack 'Table 1'")
        rows = list(wb["Table 1"].iter_rows(values_only=True))
    else:
        import xlrd
        wb = xlrd.open_workbook(path, on_demand=True)
        if "Table 1" not in wb.sheet_names():
            fail(f"cube sheets {wb.sheet_names()} lack 'Table 1'")
        sh = wb.sheet_by_name("Table 1")
        rows = [sh.row_values(r) for r in range(sh.nrows)]
    canon = lambda t: " ".join(str(t).upper().split())
    title_i = next(i for i, r in enumerate(rows) if r and any(t and "INDEX OF" in canon(t) for t in r))
    title_row = [canon(t) if t is not None else "" for t in rows[title_i]]
    sub_row = list(rows[title_i + 1]) if len(rows) > title_i + 1 else []
    cols = {}
    for ix, wanted in INDEX_TITLES.items():
        for i, t in enumerate(title_row):
            if t and any(w in t for w in wanted):
                cols[ix] = i
                break
        if ix not in cols:
            fail(f"cube {year} header drift: no column titles {wanted!r}")
    for ix, c in cols.items():
        hist = canon(sub_row[c + 1]) if c + 1 < len(sub_row) and sub_row[c + 1] else ""
        if "DECILE" not in hist:
            fail(f"cube {year} {ix}: column after the score is not a Decile column")
    out, n, nnt = {}, 0, 0
    for row in rows[title_i + 1:]:
        if not row:
            continue
        v = row[0]
        if isinstance(v, float):
            v = int(v)
        s = str(v) if v is not None else ""
        if not (len(s) in (7, 11) and s.isdigit()):
            continue
        n += 1
        if not s.startswith("7"):
            continue
        nnt += 1
        rec = {}
        for ix, c in cols.items():
            sc = row[c] if c < len(row) else None
            dc = row[c + 1] if c + 1 < len(row) else None
            if not isinstance(sc, (int, float)):
                rec[ix] = None
            elif not isinstance(dc, (int, float)):
                fail(f"cube {year} {s}: {ix} score {sc} with no decile beside it")
            else:
                rec[ix] = int(dc)
                if not 1 <= rec[ix] <= 10:
                    fail(f"cube {year} {s}: {ix} decile {rec[ix]} outside 1..10")
        out[s] = rec
    if n != CUBE_ROWS[year] or nnt != CUBE_NT_ROWS[year]:
        fail(f"cube {year} rows {n} (pin {CUBE_ROWS[year]}), NT {nnt} (pin {CUBE_NT_ROWS[year]})")
    print(f"cube {year} NT deciles: {nnt} SA1s")
    return out


@functools.lru_cache(maxsize=None)
def demo_cells(year):
    """SA1 code -> the lane rows — the WA joints' demo_cells verbatim
    on the NT prefix."""
    import csv
    import io
    import zipfile
    V = nt_geo.VINTAGES[year]
    era = str(year)
    if not os.path.exists(V["gcp"]):
        fail(f"missing GCP input {V['gcp']}")
    base = gcp_newlanes.demo_base(V["gcp"], prefix="7", era=era)
    newl = gcp_newlanes.load(V["gcp"], prefix="7", era=era)
    arc = gcp_newlanes.load_arc31(V["gcp"], prefix="7", era=era)
    lab = gcp_newlanes.load_lab(V["gcp"], prefix="7", era=era)
    ind = gcp_newlanes.load_ind(V["gcp"], prefix="7", era=era)
    mar = gcp_newlanes.load_mar(V["gcp"], prefix="7", era=era)
    inc, _inc_cutrec = gcp_newlanes.state_income(V["gcp"], era, "7")
    HL = gcp_newlanes.hl_alloc_of(year, HL_FORM[year])
    if len(base) != GCP_NT_ROWS[year]:
        fail(f"GCP NT rows {len(base)} != pin {GCP_NT_ROWS[year]}")
    z = zipfile.ZipFile(V["gcp"])
    key_col = V["gcp_key"]
    extra = {}
    for tag, cols in (("G09F", GCP_G09F_COLS), ("G09G", GCP_G09G_COLS),
                      ("G09H", GCP_G09H_COLS)):
        member = V["member"].format(table=tag)
        if member not in z.namelist():
            fail(f"GCP zip lacks {member}")
        d, m = {}, 0
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in [key_col, *cols]
                    if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"GCP {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row[key_col]
                if code.startswith("7"):
                    d[code] = tuple(int(row[c]) for c in cols)
        if m != V["gcp_rows"] or len(d) != GCP_NT_ROWS[year]:
            fail(f"GCP {tag} rows {m} (pin {V['gcp_rows']}), NT {len(d)} (pin {GCP_NT_ROWS[year]})")
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
    if len(out) != GCP_NT_ROWS[year]:
        fail(f"demo cells {len(out)} != pin {GCP_NT_ROWS[year]}")
    print(f"GCP {year} demo cells: {len(out)} SA1s")
    return out


# ------------------------------------------------------------------ the join
def run_frame(frame):
    year = FRAMES[frame]
    decs = seifa_deciles(year)
    demos = demo_cells(year)
    sent = nt_geo.NT_SENTINELS[year]
    shapes = set(sa1_polygons(year)[0])
    if set(demos) - sent != shapes:
        fail("GCP universe minus the sentinel SA1s does not equal the shape set")
    path = os.path.join(REPO, "map", "data", f"data-{frame}.json")
    if not os.path.exists(path):
        fail(f"missing {path} — run build_{frame}_data.py first")
    with open(path) as f:
        data = json.load(f)
    if data.get("year") != frame:
        fail(f"{path} is not the {frame} frame")
    if data.get("demoBasis") != "sa1":
        fail(f"{frame}: demoBasis drift ({data.get('demoBasis')!r})")
    if year != 2021:
        if data.get("demoYear") != year:
            fail(f"{frame}: demoYear drift ({data.get('demoYear')!r}, want {year})")
    elif "demoYear" in data:
        fail(f"{frame}: demoYear {data.get('demoYear')!r} on a 2021-vintage frame "
             f"— build_nt_common writes it only when != 2021")
    B = data["booths"]
    n = len(B["id"])
    if n != VENUES[frame]:
        fail(f"{frame}: {n} booth lanes != pinned {VENUES[frame]} venues")
    for lane in ("lat", "lon", "ty", "dec", "vdec"):
        if len(B[lane]) != n:
            fail(f"{frame}: booth lane {lane} length drifted")
    owned = sum(1 for k in B["dec"] if k is not None)
    if owned:
        fail(f"{frame}: {owned} dec rows already filled — the lane is not this script's on a stale data build "
             f"(rerun build_{frame}_data.py first)")
    if "demo" in B or data.get("cobKeys"):
        fail(f"{frame}: demo lane or cobKeys already set — stale data build "
             f"(rerun build_{frame}_data.py first)")
    if any(k is not None for k in B["vdec"]):
        fail(f"{frame}: vdec rows filled — that lane is not this script's")
    unlocated_pin = sum(1 for k in range(n)
                        if B["lat"][k] is None or B["lon"][k] is None)
    if unlocated_pin != UNLOCATED[frame]:
        fail(f"{frame}: {unlocated_pin} booths without coordinates != "
             f"pinned {UNLOCATED[frame]}")
    if any((B["lat"][k] is None) != (B["lon"][k] is None) for k in range(n)):
        fail(f"{frame}: a booth carries only one of lat/lon")
    out_sa1, suppressions = set(), 0
    counts = {"pip": 0, "noscore": 0, "mobile": 0, "unlocated": 0}
    dec_col, demo_col, cob_col, rel_col, ten_col, anc_col, ind_col, mar_col = \
        [], [], [], [], [], [], [], []
    for k in range(n):
        lat, lon, ty = B["lat"][k], B["lon"][k], B["ty"][k]
        if ty == 4:
            counts["mobile"] += 1
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
            counts["unlocated"] += 1
            dec_col.append(None)
            demo_col.append(None)
            cob_col.append(None)
            rel_col.append(None)
            ten_col.append(None)
            anc_col.append(None)
            ind_col.append(None)
            mar_col.append(None)
            continue
        code = pip(year, lon, lat)
        if code is None:
            fail(f"{frame} booth {B['n'][k]!r} at {lat},{lon}: inside no NT SA1 polygon — an offshore or misplaced venue needs an explicit guard, never a silent miss")
        if code in sent:
            fail(f"{frame} booth {B['n'][k]!r}: joined sentinel SA1 {code}")
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
            fail(f"{frame} booth {B['n'][k]!r}: SA1 {code} has no GCP row (the GCP and SA1 packs must cover the same codes)")
        demo_col.append(list(dm[0]))
        cob_col.append(list(dm[1]))
        rel_col.append(list(dm[2]))
        ten_col.append(list(dm[3]))
        anc_col.append(list(dm[4]))
        ind_col.append(list(dm[5]))
        mar_col.append(list(dm[6]))
    if counts["mobile"] != MOBILE[frame]:
        fail(f"{frame}: {counts['mobile']} mobile-team rows != pinned "
             f"{MOBILE[frame]}")
    B["dec"] = dec_col
    B["vdec"] = [None] * n  # no NT-era votes-by-SA1 product exists;
    # the voter-footprint lane is a federal AEC read and stays empty
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
    _unused_inc, inc_cutrec = gcp_newlanes.state_income(
        nt_geo.VINTAGES[year]["gcp"], str(year), "7")
    data["incomeCuts"] = inc_cutrec
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"{frame}: {counts['pip']} booths joined to {len(out_sa1)} SA1s "
          f"({counts['noscore']} in SA1s the cube does not score, "
          f"{suppressions} suppressed index cells, {counts['mobile']} mobile teams null, "
          f"{counts['unlocated']} unlocated null) "
          f"-> {path} ({os.path.getsize(path)} bytes)")


def main():
    frames = [a for a in sys.argv[1:] if not a.startswith("-")] or list(FRAMES)
    for frame in frames:
        if frame not in FRAMES:
            fail(f"unknown frame {frame!r}")
        if frame not in VENUES or frame not in UNLOCATED or frame not in MOBILE:
            fail(f"{frame}: venue/unlocated/mobile pins missing")
    for frame in frames:
        run_frame(frame)


main()
