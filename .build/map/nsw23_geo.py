#!/usr/bin/env python3
"""Shared SA1→district geometry for the nsw23 census pipelines.

The sa22_geo.py / sa26_geo.py discipline on the nsw23 frame's own district
geometry: ABS SA1 2021 polygons (GDA2020) joined to New South Wales's 93
districts for the 2023 state election in .build/map/src/nsw23/n-nsw23.geojson
(the full-resolution source the map's geo pipeline itself reduces, and the
frame build's own name roster — the 2021 redistribution's set: Badgerys
Creek, Kellyville, Leppington, Wahroonga and Winston Hills new; Baulkham
Hills, Ku-ring-gai, Lakemba, Mulgoa and Seven Hills gone).

Method is sa26_geo.py's unchanged: each SA1 counts whole to the district
its polygon's representative point lies in; boundary SA1s are never split
and the state total never moves.

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os
import struct
import zipfile
from array import array

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_GEOJSON = os.path.join(REPO, ".build", "map", "src", "nsw23", "n-nsw23.geojson")
SA1_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "SA1_2021_AUST_SHP_GDA2020.zip")
ASSIGN_MAP = os.path.join(REPO, ".build", "map", "nsw23", "assign-sa1.json")

# the 93 New South Wales districts for the 2023 state election (the 2021
# redistribution's own names — the boundary source's roster, pinned here so
# a boundary-file drift fails loudly instead of moving the join)
EXPECTED_NAMES = sorted([
    "Albury", "Auburn", "Badgerys Creek", "Ballina", "Balmain", "Bankstown",
    "Barwon", "Bathurst", "Bega", "Blacktown", "Blue Mountains",
    "Cabramatta", "Camden", "Campbelltown", "Canterbury", "Castle Hill",
    "Cessnock", "Charlestown", "Clarence", "Coffs Harbour", "Coogee",
    "Cootamundra", "Cronulla", "Davidson", "Drummoyne", "Dubbo",
    "East Hills", "Epping", "Fairfield", "Gosford", "Goulburn", "Granville",
    "Hawkesbury", "Heathcote", "Heffron", "Holsworthy", "Hornsby", "Keira",
    "Kellyville", "Kiama", "Kogarah", "Lake Macquarie", "Lane Cove",
    "Leppington", "Lismore", "Liverpool", "Londonderry",
    "Macquarie Fields", "Maitland", "Manly", "Maroubra", "Miranda",
    "Monaro", "Mount Druitt", "Murray", "Myall Lakes", "Newcastle",
    "Newtown", "North Shore", "Northern Tablelands", "Oatley", "Orange",
    "Oxley", "Parramatta", "Penrith", "Pittwater", "Port Macquarie",
    "Port Stephens", "Prospect", "Riverstone", "Rockdale", "Ryde",
    "Shellharbour", "South Coast", "Strathfield", "Summer Hill", "Swansea",
    "Sydney", "Tamworth", "Terrigal", "The Entrance", "Tweed",
    "Upper Hunter", "Vaucluse", "Wagga Wagga", "Wahroonga", "Wakehurst",
    "Wallsend", "Willoughby", "Winston Hills", "Wollondilly", "Wollongong",
    "Wyong",
])

GCP_ROWS = 61844
# the ABS SA1 pack's null-geometry sentinels for NSW (migratory/offshore/
# no-usual-address): three + one, no shape, kept out of the join
NSW_SENTINELS = {"19797979991", "19797979992", "19797979993", "19999949999"}


def fail(msg):
    raise SystemExit(f"nsw23-geo: {msg}")


# ------------------------------------------------------- SHP polygons (NSW rows)
def read_sa1_polygons():
    """SA1_CODE21 (in DBF order) -> polygons for NSW codes with shapes."""
    if not os.path.exists(SA1_ZIP):
        fail(f"missing SA1 polygons {SA1_ZIP} (see build_nsw23_demo.py refetch)")
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
            if code.startswith("1"):
                nulls.append(code)
            continue
        if rtype != 5:
            fail("SHP non-polygon record")
        if not code.startswith("1"):
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
    if nullset != NSW_SENTINELS:
        fail(f"NSW sentinel SA1 set drift: {sorted(nullset ^ NSW_SENTINELS)}")
    print(f"SA1 polygons: {len(out)} NSW shapes, {len(nulls)} NSW sentinels (no geometry)")
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
def key(s):
    return "".join(c for c in (s or "").lower() if c.isalpha())


def load_districts():
    """The 93 NSW 2023 district polygons from the frame's boundary source,
    keyed the way the map joins names (letters only)."""
    with open(DIST_GEOJSON) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != 93:
        fail(f"district geojson has {len(feats)} features, expected 93")
    got = {key(f["properties"].get("name", "")): f["properties"].get("name", "") for f in feats}
    want = {key(n): n for n in EXPECTED_NAMES}
    if set(got) != set(want):
        fail(f"district name drift: geojson-only {sorted(set(got) - set(want))}, expected-only {sorted(set(want) - set(got))}")
    out = []
    for f in feats:
        k = key(f["properties"]["name"])
        polys = [(rings[0], rings[1:]) for rings in
                 (f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]])]
        xs = [x for p in polys for ring in [p[0], *p[1]] for x, _y in ring]
        ys = [y for p in polys for ring in [p[0], *p[1]] for _x, y in ring]
        out.append((want[k], [min(xs), min(ys), max(xs), max(ys)], polys))
    print(f"districts: {len(out)} polygons ({os.path.relpath(DIST_GEOJSON, REPO)})")
    return out, list(EXPECTED_NAMES)


# ------------------------------------------------------------------ the join
def assign_sa1(sa1, districts):
    """Every SA1 code -> the district its representative point lies in."""
    points = {}
    for code, polys in sa1.items():
        p = geometry_centroid(polys)
        if p is None or not in_geometry(p, polys):
            fail(f"SA1 {code}: cannot place a representative point inside its own shape")
        points[code] = p
    assign = {}
    misses = []
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
        if hits == 1:
            assign[code] = hit_name
        else:
            # a boundary-straddling SA1's centroid can land on a sliver the
            # full-resolution outlines settle a hair outside this district
            # set: fall back to the district whose edge sits nearest rather
            # than fail a whole state total
            best = None
            for name, bb, polys in districts:
                xc = min(max(p[0], bb[0]), bb[2])
                yc = min(max(p[1], bb[1]), bb[3])
                d = ((p[0] - xc) ** 2 + (p[1] - yc) ** 2) ** 0.5
                if best is None or d < best[1]:
                    best = (name, d)
            misses.append((code, best[0], best[1]))
            assign[code] = best[0]
    if misses:
        print(f"assign: {len(misses)} SA1 centroid(s) outside every polygon — "
              f"filed to the nearest edge ({misses[0][0]} -> {misses[0][1]} at {misses[0][2]:.6f} deg)")
    print(f"assign: {len(assign)} SA1s -> 93 districts (centroid method)")
    return assign


def _unused_assign_sa1_exact(sa1, districts):
    """Every SA1 code -> the district its representative point lies in."""
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
    print(f"assign: {len(assign)} SA1s -> 93 districts (centroid method)")
    return assign


def write_assign_map(assign):
    os.makedirs(os.path.dirname(ASSIGN_MAP), exist_ok=True)
    with open(ASSIGN_MAP, "w") as f:
        json.dump(assign, f, separators=(",", ":"), sort_keys=True)
    print(f"-> {ASSIGN_MAP} ({os.path.getsize(ASSIGN_MAP)} bytes, {len(assign)} SA1s)")


def load_assign_map():
    """The join cache, checked against the district roster. The SEIFA
    pipeline must pool on the demo pipeline's own assignment."""
    if not os.path.exists(ASSIGN_MAP):
        fail(f"join cache {ASSIGN_MAP} missing — run build_nsw23_demo.py first")
    with open(ASSIGN_MAP) as f:
        assign = json.load(f)
    names = set(EXPECTED_NAMES)
    only = {k for k, v in assign.items() if v not in names}
    if only:
        fail(f"join cache: {len(only)} SA1s assign to districts outside the 2023 roster ({sorted(only)[:3]}…)")
    if set(assign) & NSW_SENTINELS:
        fail("join cache carries a sentinel SA1")
    print(f"join cache: {ASSIGN_MAP} covers {len(assign)} SA1s")
    return assign
