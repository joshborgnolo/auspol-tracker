#!/usr/bin/env python3
"""data/sa26-demo.json — per-district 2021-census people figures for the SA
2026 state election map (the sa26 frame on /map/).

The federal seats' census lanes ride booth-level stores (booth-seifa-voter-*,
booth-demo-*) because the AEC tells the site where each booth's voters live.
South Australia's 2026 state election is a districts-only product (the ECSA
releases district totals, no polling-place rows), so there is no voter join
to ride. What does exist is the SA1 census geometry the voter footprint work
uses: SA1s nest far below SA's 47 state districts, so each district's figures
are pooled directly from the ABS 2021 Census GCP SA1 tables, at the same
ex-not-stated bases as .build/analysis/seat-model/derive-booth-seifa-voter.py
(the G01/G09F/G09H/G49B/G60B member and column choices are identical, so a
federal figure and an sa26 figure are commensurate).

Method: every SA1 entirely inside a district would be exact; to avoid partial
SA1 splits the assignment is by the SA1's own polygon CENTROID — the SA1
counts to the district its centroid lies in, whole. Boundary-straddling SA1s
land on the side their centre of population sits, not by area; the effect is
only where a district edge crosses an SA1, and the state total never moves
(every SA SA1 counts to exactly one district).

Inputs (the two zip caches are the voter-footprint/sa1 pipeline's, git-ignored;
the district geojson is SA's own State Electorates 2026 file, 42MB, kept out of
the repo for size like the federal n-YYYY.geojson era files):
  .build/map/sa26/StateElectorates2026_GDA2020.geojson        (47 districts, GDA2020)
  .build/analysis/seat-model/cache/gcp-sa1-2021.zip           (GCP 2021 SA1 datapack)
  .build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip (SA1 2021 polygons)
  .build/map/sa26/data-sa26.json                              (the build's own product: name identity)

Re-fetch manifest when a cache is missing:
  GCP zip:   https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SA1_for_AUS_short-header.zip
  SA1 zip:   https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files/SA1_2021_AUST_SHP_GDA2020.zip
  districts: data.sa.gov.au "State Electorates 2026" (GDA2020 geojson)

Deps: python3 stdlib only. Guards fail loud. Test: node .build/test-sa26-demo.mjs
usage: python3 -I .build/map/build_sa26_demo.py
then:  python3 -I .build/map/build_sa26_data.py .build/map/sa26
then:  node .build/map/geo_build.mjs .build/map/sa26 .build/map/sa26 map/data --years=sa26
"""
import csv
import hashlib
import io
import json
import os
import struct
import zipfile
from array import array

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_GEOJSON = os.path.join(REPO, ".build", "map", "sa26", "StateElectorates2026_GDA2020.geojson")
GCP_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "gcp-sa1-2021.zip")
SA1_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "SA1_2021_AUST_SHP_GDA2020.zip")
DATA_JSON = os.path.join(REPO, ".build", "map", "sa26", "data-sa26.json")
OUT = os.path.join(REPO, "data", "sa26-demo.json")

GCP_MEMBER = "2021 Census GCP Statistical Area 1 for AUS/2021Census_G01_AUST_SA1.csv"
GCP_ROWS = 61844
GCP_SA_ROWS = 4329
GCP_SA_PERSONS_MIN, GCP_SA_PERSONS_MAX = 1_700_000, 1_900_000
# the ABS SA1 pack's null-geometry sentinels for SA (migratory/offshore/
# no-usual-address): pinned three + one, no shape, kept out of the join
SA_SENTINELS = {"49797979991", "49797979992", "49797979993", "49999949999"}
# GCP 2021 tallies 3,389 persons in SA's migratory/offshore SA1s (people at
# sea on census night) — they carry no polygon and sit outside the join
SA_SENTINEL_PERSONS = 3389

DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
GCP_G60B_OCCS = ["P_Tot_Managers", "P_Tot_Professionals",
                 "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
                 "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
                 "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]


def fail(msg):
    raise SystemExit(f"sa26-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# ---------------------------------------------------------------- GCP (SA rows)
def load_gcp_sa():
    """Same table/column map as derive-booth-seifa-voter.py load_gcp21,
    SA rows only (SA1 codes start "4")."""
    if not os.path.exists(GCP_ZIP):
        fail(f"missing GCP input {GCP_ZIP} (see docstring refetch)")
    agecols = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
    want = ["SA1_CODE_2021", "Tot_P_P", "Lang_used_home_Eng_only_P",
            "Lang_used_home_Oth_Lang_P", *agecols]
    base = {}
    n = 0
    z = zipfile.ZipFile(GCP_ZIP)
    with io.TextIOWrapper(z.open(GCP_MEMBER), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"GCP G01 header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row["SA1_CODE_2021"]
            if not code.startswith("4"):
                continue
            if code in base:
                fail(f"GCP G01 dup SA code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row["Lang_used_home_Eng_only_P"]),
                          int(row["Lang_used_home_Oth_Lang_P"]),
                          tuple(int(row[c]) for c in agecols))
    if n != GCP_ROWS:
        fail(f"GCP G01 rows {n} != pin {GCP_ROWS}")
    if len(base) != GCP_SA_ROWS:
        fail(f"GCP SA rows {len(base)} != pin {GCP_SA_ROWS}")
    persons = sum(r[0] for r in base.values())
    if not (GCP_SA_PERSONS_MIN <= persons <= GCP_SA_PERSONS_MAX):
        fail(f"GCP SA persons {persons} outside {GCP_SA_PERSONS_MIN}..{GCP_SA_PERSONS_MAX}")
    print(f"GCP G01 SA: {len(base)} SA1s, {persons} persons")

    extra = {}
    for tag, member, cols in (
        ("G09F", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G09F_AUST_SA1.csv",
         ["P_Australia_Tot"]),
        ("G09H", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G09H_AUST_SA1.csv",
         ["P_Tot_Tot", "P_COB_NS_Tot"]),
        ("G49B", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G49B_AUST_SA1.csv",
         ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
          "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]),
        ("G60B", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G60B_AUST_SA1.csv",
         GCP_G60B_OCCS),
    ):
        if member not in z.namelist():
            fail(f"GCP zip lacks {member}")
        d = {}
        m = 0
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in ["SA1_CODE_2021", *cols]
                    if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"GCP {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row["SA1_CODE_2021"]
                if not code.startswith("4"):
                    continue
                if code in d:
                    fail(f"GCP {tag} dup SA code {code}")
                d[code] = tuple(int(row[c]) for c in cols)
        if m != GCP_ROWS:
            fail(f"GCP {tag} rows {m} != pin {GCP_ROWS}")
        if len(d) != len(base):
            fail(f"GCP {tag}: {len(d)} SA rows != G01's {len(base)}")
        extra[tag] = d
        print(f"GCP {tag} SA: {len(d)} SA1s")

    out = {}
    for code, r in base.items():
        f09 = extra["G09F"].get(code)
        h09 = extra["G09H"].get(code)
        e49 = extra["G49B"].get(code)
        o60 = extra["G60B"].get(code)
        if f09 is None or h09 is None or e49 is None or o60 is None:
            fail(f"GCP SA1 set mismatch at {code}")
        out[code] = r + (f09[0], h09[0], h09[1],
                         e49[0] + e49[1] + e49[2], e49[3],
                         o60[2] + o60[6] + o60[7], sum(o60))
    print(f"GCP demo SA: {len(out)} rows, persons {persons}")
    return out, persons


# ------------------------------------------------------- SHP polygons (SA rows)
def read_sa1_polygons():
    """SA1_CODE21 (in DBF order) -> polygons for SA codes with shapes."""
    with zipfile.ZipFile(SA1_ZIP) as z:
        dbf = z.read("SA1_2021_AUST_GDA2020.dbf")
        shp = z.read("SA1_2021_AUST_GDA2020.shp")
    nrec, hlen, rlen = struct.unpack_from("<IHH", dbf, 4)
    fields = []
    off = 32
    pos = 1
    while dbf[off] != 0x0D:
        name = dbf[off:off + 11].split(b"\x00")[0].decode("ascii")
        flen = dbf[off + 16]
        fields.append((name, pos, flen))
        pos += flen
        off += 32
    if "SA1_CODE21" not in [f[0] for f in fields]:
        fail("DBF lacks SA1_CODE21")
    codes = []
    for i in range(nrec):
        rec = dbf[hlen + i * rlen: hlen + (i + 1) * rlen]
        for name, rel, flen in fields:
            if name == "SA1_CODE21":
                codes.append(rec[rel:rel + flen].decode("ascii").strip())
                break
    # the pack ends with one null-geometry sentinel record ZZZZZZZZZZZ
    # ("no spatial" row); expect exactly one, and keep the codes aligned to
    # the SHP records by ordinal (the sentinel's own null-shape record rides
    # along and is never read by name)
    zeds = [c for c in codes if c == "ZZZZZZZZZZZ"]
    if len(zeds) != 1 or codes[-1] != "ZZZZZZZZZZZ":
        fail("DBF null-record sentinel not as expected")
    if len([c for c in codes if c != "ZZZZZZZZZZZ"]) != GCP_ROWS:
        fail(f"DBF non-sentinel records {len(codes) - 1} != {GCP_ROWS}")

    if struct.unpack_from(">i", shp, 0)[0] != 9994 or \
       struct.unpack_from("<i", shp, 28)[0] != 1000 or \
       struct.unpack_from(">i", shp, 24)[0] * 2 != len(shp):
        fail("SHP magic bits absent")
    if struct.unpack_from("<i", shp, 32)[0] != 5:
        fail("SHP shape type != 5 (polygon)")

    out = {}
    nulls = []
    off = 100
    recno = 0
    while off < len(shp):
        _rec, clen = struct.unpack_from(">2i", shp, off)
        off += 8
        content = shp[off:off + clen * 2]
        off += clen * 2
        code = codes[recno]
        recno += 1
        rtype = struct.unpack_from("<i", content, 0)[0]
        if rtype == 0:
            if code.startswith("4"):
                nulls.append(code)
            continue
        if rtype != 5:
            fail("SHP non-polygon record")
        if not code.startswith("4"):
            continue
        _box = struct.unpack_from("<4d", content, 4)
        nparts, npts = struct.unpack_from("<2i", content, 36)
        parts = struct.unpack_from(f"<{nparts}i", content, 44)
        xy = memoryview(content)[44 + 4 * nparts: 44 + 4 * nparts + 16 * npts]
        pts = struct.unpack_from(f"<{npts * 2}d", xy)
        arr = array("d", pts)
        rings = [list(zip(arr[2 * parts[i]:2 * (parts[i + 1] if i + 1 < nparts else npts):2],
                          arr[2 * parts[i] + 1:2 * (parts[i + 1] if i + 1 < nparts else npts) + 1:2]))
                 for i in range(nparts)]
        out[code] = classify_rings(rings)
    if recno != nrec:
        fail(f"SHP records {recno} != DBF {nrec}")
    nullset = set(nulls)
    if nullset != SA_SENTINELS:
        fail(f"SA sentinel SA1 set drift: {sorted(nullset ^ SA_SENTINELS)}")
    print(f"SA1 polygons: {len(out)} SA shapes, {len(nulls)} SA sentinels (no geometry)")
    return out


# ------------------------------------------------------------------ geometry
def ring_area_centroid(ring):
    """Signed shoelace area and centroid of a closed ring."""
    a = 0.0
    cx = 0.0
    cy = 0.0
    n = len(ring)
    for i in range(n - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        cr = x1 * y2 - x2 * y1
        a += cr
        cx += (x1 + x2) * cr
        cy += (y1 + y2) * cr
    a *= 0.5
    if a == 0:
        return 0.0, (ring[0][0], ring[0][1])
    return a, (cx / (6 * a), cy / (6 * a))


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        j = i
        if (yi > y) == (yj > y):
            continue
        xint = xi + (y - yi) / (yj - yi) * (xj - xi)
        if x < xint:
            inside = not inside
    return inside


def classify_rings(rings):
    """Unordered SHP rings -> [(outer, [holes]), ...] by containment depth."""
    if len(rings) == 1:
        return [(rings[0], [])]
    areas = []
    for r in rings:
        a, c = ring_area_centroid(r)
        areas.append(abs(a))
    depth = []
    for i, r in enumerate(rings):
        d = 0
        for j, o in enumerate(rings):
            if i == j or areas[j] < areas[i]:
                continue
            if point_in_ring(r[0][0], r[0][1], o):
                d += 1
        depth.append(d)
    outers = [(r, []) for r, d in zip(rings, depth) if d % 2 == 0]
    for r, d in zip(rings, depth):
        if d % 2 == 1:
            best = None
            bi = -1
            for k, (o, _h) in enumerate(outers):
                a, _c = ring_area_centroid(o)
                if point_in_ring(r[0][0], r[0][1], o) and (best is None or abs(a) < best):
                    best = abs(a)
                    bi = k
            if bi < 0:
                fail("SHP hole ring has no containing outer")
            outers[bi][1].append(r)
    return outers


def geometry_centroid(polys):
    """Representative point: area-weighted centroid over outer rings less
    holes; if that drifts outside (concave or slivered shapes), the largest
    outer ring's own centroid; then an inward nudge along each edge's
    inward-pointing normal — every non-degenerate polygon yields one."""
    num_x = num_y = den = 0.0
    parts = []
    for outer, holes in polys:
        a, c = ring_area_centroid(outer)
        parts.append((abs(a), outer))
        w = abs(a)
        num_x += w * c[0]
        num_y += w * c[1]
        den += w
        for h in holes:
            ha, hc = ring_area_centroid(h)
            num_x -= abs(ha) * hc[0]
            num_y -= abs(ha) * hc[1]
            den -= abs(ha)
    if den != 0:
        p = (num_x / den, num_y / den)
        if in_geometry(p, polys):
            return p
    parts.sort(key=lambda t: -t[0])
    for w, outer in parts:
        a, c = ring_area_centroid(outer)
        if in_geometry(c, polys):
            return c
        s = 1 if a > 0 else -1
        xs = [v[0] for v in outer]
        ys = [v[1] for v in outer]
        eps = 1e-6 * max(max(xs) - min(xs), max(ys) - min(ys), 1e-12)
        n = len(outer)
        for i in range(n - 1):
            x1, y1 = outer[i]
            x2, y2 = outer[i + 1]
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            nx, ny = -(y2 - y1), (x2 - x1)
            ln = (nx * nx + ny * ny) ** 0.5
            if ln == 0:
                continue
            p = (mx + s * eps * nx / ln, my + s * eps * ny / ln)
            if in_geometry(p, polys):
                return p
    return None


def in_geometry(p, polys):
    x, y = p
    for outer, holes in polys:
        if point_in_ring(x, y, outer) and not any(point_in_ring(x, y, h) for h in holes):
            return True
    return False


# ------------------------------------------------------------------ districts
def load_districts():
    """47 SA 2026 district polygons from the State Electorates geojson,
    keyed the way the map joins names: lowercase letters only."""
    with open(DATA_JSON) as f:
        data = json.load(f)
    if data.get("year") != "sa26" or len(data.get("divs") or []) != 47:
        fail("data-sa26.json drifted: run build_sa26_data.py first")
    want = {key(d["n"]): d["n"] for d in data["divs"]}
    with open(DIST_GEOJSON) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != 47:
        fail(f"district geojson has {len(feats)} features, expected 47")
    got = {key(f["properties"].get("electorate", "")): f["properties"]["electorate"] for f in feats}
    if set(got) != set(want):
        fail(f"district name drift: geojson-only {sorted(set(got) - set(want))}, data-only {sorted(set(want) - set(got))}")
    out = []
    for f in feats:
        k = key(f["properties"]["electorate"])
        polys = [(rings[0], rings[1:]) for rings in
                 (f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]])]
        xs = [x for p in polys for ring in [p[0], *p[1]] for x, _y in ring]
        ys = [y for p in polys for ring in [p[0], *p[1]] for _x, y in ring]
        out.append((want[k], [min(xs), min(ys), max(xs), max(ys)], polys))
    print(f"districts: {len(out)} polygons")
    return out, [data["divs"][i]["n"] for i in range(47)]


def key(s):
    return "".join(c for c in (s or "").lower() if c.isalpha())


# ------------------------------------------------------------------ assemble
def main():
    gcp, sa_persons = load_gcp_sa()
    sa1 = read_sa1_polygons()
    districts, order = load_districts()

    # every GCP SA row must have a polygon (minus the null sentinels) and
    # every polygon a GCP row
    missing = set(gcp) - SA_SENTINELS - set(sa1)
    extra = set(sa1) - set(gcp)
    if missing:
        fail(f"GCP SA1s without a polygon: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"SA1 polygons without a GCP row: {sorted(extra)[:5]} ({len(extra)})")

    # assign each SA1 to the district its representative point lies in
    points = {}
    for code, polys in sa1.items():
        p = geometry_centroid(polys)
        if p is None or not in_geometry(p, polys):
            fail(f"SA1 {code}: cannot place a representative point inside its own shape")
        points[code] = p
    assign = {}
    for code, p in sorted(points.items()):
        hits = 0
        hit_name = None
        for name, bb, polys in districts:
            x, y = p
            if not (bb[0] - 1e-9 <= x <= bb[2] + 1e-9 and bb[1] - 1e-9 <= y <= bb[3] + 1e-9):
                continue
            if in_geometry(p, polys):
                hits += 1
                hit_name = name
        if hits != 1:
            fail(f"SA1 {code} at {p}: lands in {hits} districts, expected exactly 1")
        assign[code] = hit_name
    print(f"assign: {len(assign)} SA1s -> 47 districts (centroid method)")

    # sentinel persons are the only SA census persons not joined
    sentinel_persons = sum(gcp[c][0] for c in SA_SENTINELS)
    if sentinel_persons != SA_SENTINEL_PERSONS:
        fail(f"unjoined sentinel SA1 persons {sentinel_persons} != pin {SA_SENTINEL_PERSONS}")

    # pool
    acc = {}
    for code, dist in assign.items():
        a = acc.setdefault(dist, {"p": 0, "eng": 0, "oth": 0, "aust": 0,
                                  "tot": 0, "cobns": 0, "uni": 0, "eduns": 0,
                                  "pop15": 0, "blue": 0, "occd": 0,
                                  "bands": [0] * len(DEMO_BANDS), "n": 0})
        r = gcp[code]
        a["p"] += r[0]
        a["eng"] += r[1]
        a["oth"] += r[2]
        for i in range(len(DEMO_BANDS)):
            a["bands"][i] += r[3][i]
        a["aust"] += r[4]
        a["tot"] += r[5]
        a["cobns"] += r[6]
        a["uni"] += r[7]
        a["eduns"] += r[8]
        a["blue"] += r[9]
        a["occd"] += r[10]
        a["pop15"] += r[0] - r[3][0] - r[3][1]
        a["n"] += 1
    for dist, _bb, _polys in districts:
        if dist not in acc:
            fail(f"district {dist} has no SA1 assigned")

    def shares(a):
        bsum = sum(a["bands"])
        fb_den = a["tot"] - a["cobns"]
        uni_den = a["pop15"] - a["eduns"]
        for nm, v in (("bands", bsum), ("fb_den", fb_den),
                      ("uni_den", uni_den), ("occd", a["occd"]),
                      ("eng+oth", a["eng"] + a["oth"])):
            if v <= 0:
                return None, nm
        s = {
            "lang": round(a["oth"] / (a["eng"] + a["oth"]), 4),
            "a65": round((a["bands"][8] + a["bands"][9] + a["bands"][10]) / bsum, 4),
            "a2034": round((a["bands"][3] + a["bands"][4]) / bsum, 4),
            "fborn": round((fb_den - a["aust"]) / fb_den, 4),
            "uni": round(a["uni"] / uni_den, 4),
            "blue": round(a["blue"] / a["occd"], 4),
        }
        return s, None

    demo = {}
    for dist, _bb, _polys in districts:
        a = acc[dist]
        s, why = shares(a)
        if s is None:
            fail(f"{dist}: zero denominator on {why}")
        demo[dist] = {**s, "p": a["p"], "n": a["n"]}

    state = {"p": sum(a["p"] for a in acc.values()), "n": sum(a["n"] for a in acc.values())}
    st_acc = {"p": 0, "eng": 0, "oth": 0, "aust": 0, "tot": 0, "cobns": 0,
              "uni": 0, "eduns": 0, "pop15": 0, "blue": 0, "occd": 0,
              "bands": [0] * len(DEMO_BANDS), "n": 0}
    for a in acc.values():
        for k2, v2 in a.items():
            if k2 == "bands":
                for i in range(len(DEMO_BANDS)):
                    st_acc["bands"][i] += v2[i]
            else:
                st_acc[k2] += v2
    st_shares, why = shares(st_acc)
    if st_shares is None:
        fail(f"state: zero denominator on {why}")
    if state["p"] + sentinel_persons != sa_persons:
        fail(f"partition drift: districts {state['p']} + sentinels {sentinel_persons} != GCP SA {sa_persons}")
    print("state:", {**st_shares, "persons": state["p"], "sa1": state["n"]})

    out = {
        "year": "sa26",
        "jurisdiction": "SA",
        "date": "2026-03-21",
        "demoBasis": "sa1",
        "demo": {n: demo[n] for n in order},
        "state": {**st_shares, "persons": state["p"], "sa1": state["n"],
                  "sentinelSa1": len(SA_SENTINELS), "sentinelPersons": sentinel_persons},
        "src": {
            "districtGeojson": {"path": os.path.relpath(DIST_GEOJSON, REPO), "sha16": hash16(DIST_GEOJSON)},
            "gcp": {"path": os.path.relpath(GCP_ZIP, REPO), "sha16": hash16(GCP_ZIP),
                    "members": ["G01", "G09F", "G09H", "G49B", "G60B"]},
            "sa1Shp": {"path": os.path.relpath(SA1_ZIP, REPO), "sha16": hash16(SA1_ZIP)},
            "gcpRows": GCP_ROWS,
        },
        "about": ("2021 Census GCP G01/G09F/G09H/G49B/G60B SA1 tables, pooled to South "
                  "Australia's 47 state electoral districts for the 21 March 2026 election. "
                  "Each SA1 counts whole to the district its polygon centroid lies in "
                  "(boundary SA1s are not split; the state total is never moved). Bases match "
                  "the federal stores (ex-not-stated): language other than English over "
                  "English-only+other stated; age shares renormalised over G01's 11 bands "
                  "(which exclude age-not-stated); overseas-born over country-stated; "
                  "university (bachelor and above) over the G01 aged-15+ population less "
                  "level-of-education-not-stated; blue-collar (trades, machinery operators "
                  "and drivers, labourers) over the eight stated ANZSCO groups. p is census "
                  "persons; n the SA1 count. The four SA sentinel SA1s (migratory/offshore) "
                  "carry no polygon and sit outside the join, holding "
                  f"{sentinel_persons} persons statewide."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")


main()
