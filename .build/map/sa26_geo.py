#!/usr/bin/env python3
"""Shared SA1→district geometry for the sa26 census pipelines.

The one place the ABS SA1 2021 polygons (GDA2020) and SA's State Electorates
2026 geojson are read, and the one place each SA1's representative point is
computed and joined to the district it lies in. build_sa26_demo.py (the
people lanes) and build_sa26_seifa.py (the advantage indexes) both ride the
assignment this module computes — the demo run COMMITS it as
.build/map/sa26/assign-sa1.json (a cache, like the .zip inputs), and the
SEIFA run reads it back, so both pipelines' district rows always agree on
which district every SA1 belongs to. If the cache were absent the SEIFA
script would silently re-derive a join; it fails stop instead.

Method (unchanged from its home in build_sa26_demo.py): each SA1 counts
whole to the district its polygon's representative point lies in; boundary
SA1s are never split and the state total never moves.

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os
import struct
import zipfile
from array import array

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_GEOJSON = os.path.join(REPO, ".build", "map", "sa26", "StateElectorates2026_GDA2020.geojson")
SA1_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "SA1_2021_AUST_SHP_GDA2020.zip")
DATA_JSON = os.path.join(REPO, ".build", "map", "sa26", "data-sa26.json")
ASSIGN_MAP = os.path.join(REPO, ".build", "map", "sa26", "assign-sa1.json")

GCP_ROWS = 61844
# the ABS SA1 pack's null-geometry sentinels for SA (migratory/offshore/
# no-usual-address): pinned three + one, no shape, kept out of the join
SA_SENTINELS = {"49797979991", "49797979992", "49797979993", "49999949999"}


def fail(msg):
    raise SystemExit(f"sa26-geo: {msg}")


# ------------------------------------------------------- SHP polygons (SA rows)
def read_sa1_polygons():
    """SA1_CODE21 (in DBF order) -> polygons for SA codes with shapes."""
    if not os.path.exists(SA1_ZIP):
        fail(f"missing SA1 polygons {SA1_ZIP} (see build_sa26_demo.py refetch)")
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
def key(s):
    return "".join(c for c in (s or "").lower() if c.isalpha())


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
    with open(ASSIGN_MAP, "w") as f:
        json.dump(assign, f, separators=(",", ":"), sort_keys=True)
    print(f"-> {ASSIGN_MAP} ({os.path.getsize(ASSIGN_MAP)} bytes, {len(assign)} SA1s)")


def load_assign_map():
    """The committed join, checked against the live district name set. The
    SEIFA pipeline must pool on the demo pipeline's own assignment."""
    if not os.path.exists(ASSIGN_MAP):
        fail(f"join cache {ASSIGN_MAP} missing — run build_sa26_demo.py first")
    with open(ASSIGN_MAP) as f:
        assign = json.load(f)
    with open(DATA_JSON) as f:
        names = {d["n"] for d in json.load(f)["divs"]}
    only = {k for k, v in assign.items() if v not in names}
    if only:
        fail(f"join cache: {len(only)} SA1s assign to districts data-sa26.json no longer carries ({sorted(only)[:3]}…)")
    if set(assign) & SA_SENTINELS:
        fail("join cache carries a sentinel SA1")
    print(f"join cache: {ASSIGN_MAP} covers {len(assign)} SA1s")
    return assign
