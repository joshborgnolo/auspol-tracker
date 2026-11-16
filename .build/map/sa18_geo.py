#!/usr/bin/env python3
"""Shared SA1→district geometry for the sa18 census pipelines.

The sa22_geo.py discipline on the sa18 frame's own district geometry: ABS
SA1 2016 polygons (the 2016 AUST shape zip, its SA1_7DIG16 key) joined to
the 2016–2018-era South Australian district polygons in
.build/map/src/sa18/n-sa18.geojson (the ASDS 2016 redistribution era, the
frame build's own name roster — the 2016 determination's 47 districts:
recreated King, recreated Hurtle Vale, recreated Elizabeth; Badcoe/Black
renamed from Ashford/Mitchell; Narungga from Taylor; Gibson from
Fisher; Ngadjuri still future).

One deliberate divergence from sa22/sa26_geo.py: the sa18 census reads the
2016 edition. Its rows are nevertheless authoritative precursors by code:
an SA1 2016 code stays inside the state prefix 4 with the state's own
four null-shaped sentinels ({4949999, 4979991, 4979992, 4979993} —
computed fresh from each vintage's null-geometry records, pinned).

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os
import struct
import zipfile
from array import array

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_GEOJSON = os.path.join(REPO, ".build", "map", "src", "sa18", "n-sa18.geojson")
SA1_ZIP = os.path.join(REPO, ".matilda", "seifa-irsad-abs", "dl", "1270055001_sa1_2016_aust_shape.zip")
ASSIGN_MAP = os.path.join(REPO, ".build", "map", "sa18", "assign-sa1.json")

#: the Electoral Commission SA's 47 districts for the 2018 state election
#: (the 2016 determination set — ECSA's own pages title them so)
EXPECTED_NAMES = sorted([
    "Adelaide", "Badcoe", "Black", "Bragg", "Chaffey", "Cheltenham", "Colton",
    "Croydon", "Davenport", "Dunstan", "Elder", "Elizabeth", "Enfield",
    "Finniss", "Flinders", "Florey", "Frome", "Gibson", "Giles", "Hammond",
    "Hartley", "Heysen", "Hurtle Vale", "Kaurna", "Kavel", "King", "Lee",
    "Light", "MacKillop", "Mawson", "Morialta", "Morphett", "Mount Gambier",
    "Narungga", "Newland", "Playford", "Port Adelaide", "Ramsay", "Reynell",
    "Schubert", "Stuart", "Taylor", "Torrens", "Unley", "Waite",
    "West Torrens", "Wright",
])

GCP_ROWS = 57523
#: the ABS SA1 pack's null-geometry sentinels for SA (migratory/offshore/
#: no-usual-address): the prefix-4 {…4999…}/{…7999…} family, computed from
#: this vintage's null-shape records 2026-11-17 and pinned
SA_SENTINELS = {"4949999", "4979991", "4979992", "4979993"}
SA1_KEY = "SA1_7DIG16"


def fail(msg):
    raise SystemExit(f"sa18-geo: {msg}")


# ------------------------------------------------------- SHP polygons (SA rows)
def read_sa1_polygons():
    """SA1_7DIG16 (in DBF order) -> polygons for SA codes with shapes."""
    if not os.path.exists(SA1_ZIP):
        fail(f"missing SA1 polygons {SA1_ZIP} (see build_sa18_demo.py refetch)")
    with zipfile.ZipFile(SA1_ZIP) as z:
        dbf = z.read("SA1_2016_AUST.dbf")
        shp = z.read("SA1_2016_AUST.shp")
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
    if SA1_KEY not in [f[0] for f in fields]:
        fail(f"DBF lacks {SA1_KEY}")
    codes = []
    for i in range(nrec):
        rec = dbf[hlen + i * rlen: hlen + (i + 1) * rlen]
        for name, rel, flen in fields:
            if name == SA1_KEY:
                codes.append(rec[rel:rel + flen].decode("ascii").strip())
                break
    # the 2016 edition predates the ZZZZZZZZZZZ sentinel convention the
    # 2021 pack adds at the tail — expect exactly 57,523 code rows and keep
    # the codes aligned to the SHP records by ordinal (its sibling era files
    # read the same way: no trailing sentinel at all)
    if len(codes) != GCP_ROWS:
        fail(f"DBF rows {len(codes)} != pin {GCP_ROWS}")

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
            x_n = -(y2 - y1)
            y_n = (x2 - x1)
            ln = (x_n * x_n + y_n * y_n) ** 0.5
            if ln == 0:
                continue
            p = (mx + s * eps * x_n / ln, my + s * eps * y_n / ln)
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
    """The 47 2016–2018-era SA district polygons from the frame's boundary
    source, keyed the way the map joins names (letters only)."""
    with open(DIST_GEOJSON) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != 47:
        fail(f"district geojson has {len(feats)} features, expected 47")
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
        fail(f"join cache {ASSIGN_MAP} missing — run build_sa18_demo.py first")
    with open(ASSIGN_MAP) as f:
        assign = json.load(f)
    names = set(EXPECTED_NAMES)
    only = {k for k, v in assign.items() if v not in names}
    if only:
        fail(f"join cache: {len(only)} SA1s assign to districts outside the 2018 roster ({sorted(only)[:3]}…)")
    if set(assign) & SA_SENTINELS:
        fail("join cache carries a sentinel SA1")
    print(f"join cache: {ASSIGN_MAP} covers {len(assign)} SA1s")
    return assign
