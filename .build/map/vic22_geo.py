#!/usr/bin/env python3
"""Shared SA1→district geometry for the vic22 census pipelines — the sa26
module's protocol on Victoria's own files.

The one place the ABS SA1 2021 polygons (GDA2020) and Victoria's State
Assembly 2022 geojson (opendata.maps.vic.gov.au WFS layer
open-data-platform:state_assembly_2022, harvested with the source mirror)
are read, and the one place each SA1's representative point is computed and
joined to the district it lies in. build_vic22_demo.py (the people lanes)
and build_vic22_seifa.py (the advantage indexes) both ride the assignment
this module computes — the demo run COMMITS it as
.build/map/vic22/assign-sa1.json (a cache), and the SEIFA run reads it back,
so both pipelines' district rows always agree on which district every SA1
belongs to. If the cache were absent the SEIFA script would silently
re-derive a join; it fails stop instead.

Unlike sa26's module there is NO build-product roster read here (data-
vic22.json is written further along the chain than the demo store it
carries): the roster oracle is the boundary geojson itself plus the pinned
EXPECTED_NAMES — the same 88 the harvest script nails down, taken from the
VEC's own manifest/blot the night the script's roster bug cost an evening.
Never retype the list from memory: the 2021 redistribution abolished
Ferntree Gully, Forest Hill, Yuroke and created Bayswater, Kalkallo, Kew
(among others).

Method: each SA1 counts whole to the district its polygon's representative
point lies in; boundary SA1s are never split and the state total never
moves.

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os
import struct
import zipfile
from array import array

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_GEOJSON = os.path.join(REPO, ".build", "map", "src", "vic22", "n-vic22.geojson")
DATA_DIR = os.path.join(REPO, ".build", "map", "vic22")
DATA_JSON = os.path.join(DATA_DIR, "data-vic22.json")
ASSIGN_MAP = os.path.join(DATA_DIR, "assign-sa1.json")
SA1_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "SA1_2021_AUST_SHP_GDA2020.zip")

GCP_ROWS = 61844
GCP_VIC_ROWS = 15482          # SA1 codes starting "2" (15,478 shaped + 4 sentinels)
VIC_PERSONS_MIN, VIC_PERSONS_MAX = 6_500_000, 6_700_000
# the ABS SA1 pack's null-geometry sentinels for Victoria (migratory/
# offshore/no-usual-address): pinned three + one, no shape, kept out of the
# join — same family as the federal stores' sentinels
VIC_SENTINELS = {"29797979991", "29797979992", "29797979993", "29999949999"}

# the 2022 election's 88 districts (the 2021 redistribution's roster —
# identical set to harvest-vic22-src.py's DISTRICTS; the boundary geojson's
# 88 feature names are asserted equal below)
EXPECTED_NAMES = [
    "Albert Park", "Ashwood", "Bass", "Bayswater", "Bellarine", "Benambra",
    "Bendigo East", "Bendigo West", "Bentleigh", "Berwick", "Box Hill",
    "Brighton", "Broadmeadows", "Brunswick", "Bulleen", "Bundoora",
    "Carrum", "Caulfield", "Clarinda", "Cranbourne", "Croydon", "Dandenong",
    "Eildon", "Eltham", "Essendon", "Eureka", "Euroa", "Evelyn",
    "Footscray", "Frankston", "Geelong", "Gippsland East", "Gippsland South",
    "Glen Waverley", "Greenvale", "Hastings", "Hawthorn", "Ivanhoe",
    "Kalkallo", "Kew", "Kororoit", "Lara", "Laverton", "Lowan", "Macedon",
    "Malvern", "Melbourne", "Melton", "Mildura", "Mill Park", "Monbulk",
    "Mordialloc", "Mornington", "Morwell", "Mulgrave", "Murray Plains",
    "Narracan", "Narre Warren North", "Narre Warren South", "Nepean",
    "Niddrie", "Northcote", "Oakleigh", "Ovens Valley", "Pakenham",
    "Pascoe Vale", "Point Cook", "Polwarth", "Prahran", "Preston",
    "Richmond", "Ringwood", "Ripon", "Rowville", "Sandringham", "Shepparton",
    "South Barwon", "South-West Coast", "St Albans", "Sunbury", "Sydenham",
    "Tarneit", "Thomastown", "Warrandyte", "Wendouree", "Werribee",
    "Williamstown", "Yan Yean",
]
assert len(EXPECTED_NAMES) == 88 and len(set(EXPECTED_NAMES)) == 88


def fail(msg):
    raise SystemExit(f"vic22-geo: {msg}")


# ------------------------------------------------------- SHP polygons (VIC rows)
def read_sa1_polygons(state="2", sentinels=VIC_SENTINELS):
    """SA1_CODE21 (in DBF order) -> polygons for the state's codes with shapes."""
    if not os.path.exists(SA1_ZIP):
        fail(f"missing SA1 polygons {SA1_ZIP} (see build_vic22_demo.py refetch)")
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
    # the SHP records by ordinal
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
            if code.startswith(state):
                nulls.append(code)
            continue
        if rtype != 5:
            fail("SHP non-polygon record")
        if not code.startswith(state):
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
    if nullset != sentinels:
        fail(f"sentinel SA1 set drift: {sorted(nullset ^ sentinels)}")
    print(f"SA1 polygons: {len(out)} Vic shapes, {len(nulls)} Vic sentinels (no geometry)")
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
    """The 88 Vic 2022 district polygons, keyed the way the map joins
    names: lowercase letters only. The geojson's own 88 names are asserted
    against the pinned roster."""
    with open(DIST_GEOJSON) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != 88:
        fail(f"district geojson has {len(feats)} features, expected 88")
    got = {}
    for f in feats:
        nm = f["properties"].get("name")
        polys = [(rings[0], rings[1:]) for rings in
                 (f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon"
                  else [f["geometry"]["coordinates"]])]
        k = key(nm)
        if k in got:
            fail(f"geojson name {nm!r} collides with {got[k][0]!r} under the join key")
        xs = [x for p in polys for ring in [p[0], *p[1]] for x, _y in ring]
        ys = [y for p in polys for ring in [p[0], *p[1]] for _x, y in ring]
        got[k] = (nm, [min(xs), min(ys), max(xs), max(ys)], polys)
    want = {key(n): n for n in EXPECTED_NAMES}
    if set(got) != set(want):
        fail(f"district name drift: geojson-only {sorted(set(got) - set(want))}, "
             f"roster-only {sorted(set(want) - set(got))}")
    out = [got[k] for k in got]
    out.sort(key=lambda t: key(t[0]))
    print(f"districts: {len(out)} polygons")
    return out, [n for n, _bb, _p in out]


# Four SA1s whose representative point stitches just off the 2022 district
# polygons (water-edge centroids and a boundary seam) — adjudicated by
# adjacency, each unambiguous by an order of magnitude over its next
# district (distances from the first-pass fail run, 2026-10-27):
#   20503109311 — French Island SA1; 0.6 km from Bass across the water
#     (Gippsland South 0.8 km, next 36 km). French Island sits in the
#     electorate of Bass.
#   21203130807 — Tooradin foreshore sliver; 1.1 km from Bass (Hastings
#     4.0 km). Tooradin was moved into Bass at the 2021 redistribution.
#   21601140636 — sits exactly on a Murray Plains boundary seam (0.0 km;
#     Shepparton 16 km next).
#   21704148014 — small-town sliver 0.1 km from South-West Coast
#     (Lowan 36 km next).
OVERRIDES = {
    "20503109311": "Bass",
    "21203130807": "Bass",
    "21601140636": "Murray Plains",
    "21704148014": "South-West Coast",
}

# ------------------------------------------------------------------ the join
def assign_sa1(sa1, districts):
    """Every SA1 code -> the district its representative point lies in."""
    names = {n for n, _bb, _p in districts}
    if set(OVERRIDES) - set(sa1):
        fail("OVERRIDES names an SA1 with no polygon — roster drift?")
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
            fix = OVERRIDES.get(code)
            if hits == 0 and fix:
                assign[code] = fix
                continue
            fail(f"SA1 {code} at {p}: lands in {hits} districts, expected exactly 1")
        assign[code] = hit_name
    if OVERRIDES and any(assign.get(c) == OVERRIDES[c] for c in OVERRIDES if c in assign):
        print(f"assign: {len(assign)} SA1s -> 88 districts "
              f"(centroid method; {sum(1 for c in OVERRIDES if c in assign)} adjudicated seam/overrides)")
    return assign


def write_assign_map(assign):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(ASSIGN_MAP, "w") as f:
        json.dump(assign, f, separators=(",", ":"), sort_keys=True)
    print(f"-> {ASSIGN_MAP} ({os.path.getsize(ASSIGN_MAP)} bytes, {len(assign)} SA1s)")


def load_assign_map():
    """The committed join, checked against the live district name set. The
    SEIFA pipeline must pool on the demo pipeline's own assignment."""
    if not os.path.exists(ASSIGN_MAP):
        fail(f"join cache {ASSIGN_MAP} missing — run build_vic22_demo.py first")
    with open(ASSIGN_MAP) as f:
        assign = json.load(f)
    names = set(EXPECTED_NAMES)
    only = {v for v in assign.values() if v not in names}
    if only:
        fail(f"join cache: {len(only)} SA1s assign to districts no longer carried ({sorted(only)[:3]}…)")
    if set(assign) & VIC_SENTINELS:
        fail("join cache carries a sentinel SA1")
    print(f"join cache: {ASSIGN_MAP} covers {len(assign)} SA1s")
    return assign
