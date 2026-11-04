#!/usr/bin/env python3
"""Shared SA1→district geometry for the Victorian 2013-redistribution map
frames (vic14, vic18) — the qld_geo.py protocol: one boundary vintage (the
2013 redistribution's 88 districts) serving both elections, with TWO ABS
census vintages beside it (2016 for vic18, 2011 for vic14).

The one place the ABS SA1 polygons (both vintages) and the boundary geojson
.build/map/src/n-vic18.geojson (the n-vic14.geojson file is byte-identical;
both normalised by .build/map/make-n13-geojson.py from the VEC open-data
WFS layer `state_assembly_2013`) are read, and the one place each SA1's
representative point is computed and joined to its district. The demo runs
commit the assignment as .build/map/vic13/assign-sa1-<cy>.json per census
vintage, and the SEIFA runs read it back, so a frame's people and
advantage lanes always pool over the SAME assignment.

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os
import struct
import zipfile
from array import array

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_GEOJSON = os.path.join(REPO, ".build", "map", "src", "n-vic18.geojson")

VINTAGES = {
    2011: {
        "gcp": os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "bcp-sa1-2011.zip"),
        "shp": os.path.join(REPO, ".matilda", "seifa-irsad-abs", "dl", "1270055001_sa1_2011_aust_shape.zip"),
        "shp_members": ("SA1_2011_AUST.shp", "SA1_2011_AUST.dbf"),
        "gcp_key": "region_id",
        "shp_key": "SA1_7DIG11",
        "gcp_rows": 54805,
        "member": "2011 Census BCP Statistical Areas Level 1 for AUST/AUST/2011Census_{table}_AUST_SA1_short.csv",
        "assign": os.path.join(REPO, ".build", "map", "vic13", "assign-sa1-2011.json"),
        "null_sentinel": False,
        "dbf_eq_gcp": True,
    },
    2016: {
        "gcp": os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "gcp-sa1-2016.zip"),
        "shp": os.path.join(REPO, ".matilda", "seifa-irsad-abs", "dl", "1270055001_sa1_2016_aust_shape.zip"),
        "shp_members": ("SA1_2016_AUST.shp", "SA1_2016_AUST.dbf"),
        "gcp_key": "SA1_7DIGITCODE_2016",
        "shp_key": "SA1_7DIG16",
        "gcp_rows": 57523,
        "member": "2016 Census GCP Statistical Area 1 for AUST/2016Census_{table}_AUS_SA1.csv",
        "assign": os.path.join(REPO, ".build", "map", "vic13", "assign-sa1-2016.json"),
        "null_sentinel": False,
        "dbf_eq_gcp": True,
    },
}

#: Victorian sentinel SA1s carry no geometry (migratory/offshore/no-usual-
#: address, the "…9999…" codes) — pinned per vintage; a drift in the set is
#: a guard trip, never a silent re-derive. (2011's BCP universe == 2016's
#: GCP universe on this lane: the same four Victorian pseudo codes in both.)
VIC_SENTINELS = {
    2011: {"2949999", "2979991", "2979992", "2979993"},
    2016: {"2949999", "2979991", "2979992", "2979993"},
}

# Victoria's 88 Legislative Assembly districts for the 2014 and 2018 state
# elections (the 2013 redistribution's own names — verified verbatim against
# the VEC's committed historical-results pages by .build/map/make-n13-geojson.py:
# every boundary name matched its "<h2>.. District</h2>" line)
EXPECTED_NAMES = sorted([
    "Albert Park", "Altona", "Bass", "Bayswater", "Bellarine", "Benambra",
    "Bendigo East", "Bendigo West", "Bentleigh", "Box Hill", "Brighton",
    "Broadmeadows", "Brunswick", "Bulleen", "Bundoora", "Buninyong",
    "Burwood", "Carrum", "Caulfield", "Clarinda", "Cranbourne", "Croydon",
    "Dandenong", "Eildon", "Eltham", "Essendon", "Euroa", "Evelyn",
    "Ferntree Gully", "Footscray", "Forest Hill", "Frankston", "Geelong",
    "Gembrook", "Gippsland East", "Gippsland South", "Hastings", "Hawthorn",
    "Ivanhoe", "Kew", "Keysborough", "Kororoit", "Lara", "Lowan",
    "Macedon", "Malvern", "Melbourne", "Melton", "Mildura", "Mill Park",
    "Monbulk", "Mordialloc", "Mornington", "Morwell", "Mount Waverley",
    "Mulgrave", "Murray Plains", "Narracan", "Narre Warren North",
    "Narre Warren South", "Nepean", "Niddrie", "Northcote", "Oakleigh",
    "Ovens Valley", "Pascoe Vale", "Polwarth", "Prahran", "Preston",
    "Richmond", "Ringwood", "Ripon", "Rowville", "Sandringham",
    "Shepparton", "South Barwon", "South-West Coast", "St Albans",
    "Sunbury", "Sydenham", "Tarneit", "Thomastown", "Warrandyte",
    "Wendouree", "Werribee", "Williamstown", "Yan Yean", "Yuroke",
])


def fail(msg):
    raise SystemExit(f"vic13-geo: {msg}")


# ------------------------------------------------------- SHP polygons (VIC rows)
def read_sa1_polygons(year):
    """SA1 code -> classified polygons, VIC rows of that vintage's pack."""
    V = VINTAGES[year]
    if not os.path.exists(V["shp"]):
        fail(f"missing SA1 polygons {V['shp']} (see build_nswXX_demo refetch)")
    with zipfile.ZipFile(V["shp"]) as z:
        dbf = z.read(V["shp_members"][1])
        shp = z.read(V["shp_members"][0])
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
    if V["shp_key"] not in [f[0] for f in fields]:
        fail(f"DBF lacks {V['shp_key']}")
    codes = []
    for i in range(nrec):
        rec = dbf[hlen + i * rlen: hlen + (i + 1) * rlen]
        for name, rel, flen in fields:
            if name == V["shp_key"]:
                codes.append(rec[rel:rel + flen].decode("ascii").strip())
                break
    if V.get("null_sentinel"):
        zeds = [c for c in codes if c == "ZZZZZZZZZZZ"]
        if len(zeds) != 1 or codes[-1] != "ZZZZZZZZZZZ":
            fail("DBF null-record sentinel not as expected")
        if len([c for c in codes if c != "ZZZZZZZZZZZ"]) != V["gcp_rows"]:
            fail(f"DBF non-sentinel records {len(codes) - 1} != {V['gcp_rows']}")
    else:
        if len(codes) != V["gcp_rows"]:
            fail(f"DBF records {len(codes)} != {V['gcp_rows']}")

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
            if code.startswith("2"):
                nulls.append(code)
            continue
        if rtype != 5:
            fail("SHP non-polygon record")
        if not code.startswith("2"):
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
    expect = VIC_SENTINELS[year]
    if nullset != expect:
        fail(f"VIC {year} sentinel SA1 set drift: got {sorted(nullset)},"
             f" pinned {sorted(expect)}")
    print(f"SA1 {year} polygons: {len(out)} VIC shapes, {len(nulls)} VIC sentinels (no geometry)")
    return out


# ------------------------------------------------------------------ geometry
def ring_area_centroid(ring):
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
    """The 88 district polygons from the 2013 boundary geojson, joined
    name-for-name with EXPECTED_NAMES (letters-only keys)."""
    want = {key(n): n for n in EXPECTED_NAMES}
    if not os.path.exists(DIST_GEOJSON):
        fail(f"boundary geojson {DIST_GEOJSON} missing — run .build/map/make-n13-geojson.py")
    with open(DIST_GEOJSON) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != 88:
        fail(f"boundary geojson has {len(feats)} features, expected 88")
    got = {}
    for f in feats:
        nm = (f.get("properties") or {}).get("name", "")
        got[key(nm)] = nm
    if set(got) != set(want):
        fail(f"boundary name drift: geojson-only {sorted(set(got) - set(want))},"
             f" expected-only {sorted(set(want) - set(got))}")
    out = []
    for f in feats:
        nm = f["properties"]["name"]
        k = key(nm)
        polys = [(rings[0], rings[1:]) for rings in
                 (f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]])]
        xs = [x for p in polys for ring in [p[0], *p[1]] for x, _y in ring]
        ys = [y for p in polys for ring in [p[0], *p[1]] for _x, y in ring]
        out.append((want[k], [min(xs), min(ys), max(xs), max(ys)], polys))
    print(f"districts: {len(out)} polygons")
    return out, EXPECTED_NAMES


# ------------------------------------------------------------------ the join
EDGE_EPS_M = 25

# tideline-clipped SA1 centroids rescued past EDGE_EPS_M, pinned per
# (year, code): measured live 2026-11-04 (the VEC's layer is coastline-cut,
# this SA1's centroid sits in the San Remo channel). Anything not listed
# here fails loudly.
PINNED_RESCUES = {
    2011: {
        # San Remo channel, Bass Coast: Bass 591 m east; Gippsland South 869 m
        "2109311": {"district": "Bass", "maxM": 620},
        # Albert Park-ward bay edge (St Kilda–Port Melbourne foreshore)
        "2113030": {"district": "Albert Park", "maxM": 150},
        # Pearcedale: a real TOPOLOGY HOLE in VEC's state_assembly_2013 layer
        # (the Hastings polygon's Pearcedale part is missing — Pearcedale is a
        # documented Hastings-district locality at these elections)
        "2130807": {"district": "Hastings", "maxM": 1320},
        # the same hole's western edge, Tooradin airfield — 61 m out
        "2137942": {"district": "Hastings", "maxM": 90},
        # Killarney beach fan south-west of Port Fairy
        "2143332": {"district": "South-West Coast", "maxM": 200},
    },
    2016: {
        # same SA1, the 2016 pack's centroid 578 m east of Bass
        "2109311": {"district": "Bass", "maxM": 600},
        # Pearcedale hole, identical in the 2016 pack (SA1s are edition-stable)
        "2130807": {"district": "Hastings", "maxM": 1320},
        "2137942": {"district": "Hastings", "maxM": 90},
    },
}


def _ring_dist_m(p, polys):
    import math as _m
    best = 1e18
    for outer, _holes in polys:
        n = len(outer)
        for i in range(n - 1):
            x1, y1 = outer[i]
            x2, y2 = outer[i + 1]
            dx, dy = x2 - x1, y2 - y1
            l2 = dx * dx + dy * dy
            t = 0 if l2 == 0 else max(0, min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / l2))
            qx, qy = x1 + t * dx, y1 + t * dy
            d = _m.hypot(p[0] - qx, p[1] - qy) * 111.32 * 1000
            if d < best:
                best = d
    return best


def assign_sa1(year):
    sa1 = read_sa1_polygons(year)
    districts, _names = load_districts()
    points = {}
    for code, polys in sa1.items():
        p = geometry_centroid(polys)
        if p is None or not in_geometry(p, polys):
            fail(f"SA1 {code}: cannot place a representative point inside its own shape")
        points[code] = p
    assign = {}
    rescued = []
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
        if hits == 0:
            # the boundary layer clips tideline slivers that SA1 centroids
            # just clear — the single nearest district inside EDGE_EPS_M
            # takes it; past that bar only a PINNED_RESCUES entry covers the
            # pair, and an unpinned one is a real boundary mismatch which
            # stops the build
            pin = (PINNED_RESCUES.get(year) or {}).get(code)
            limit = pin["maxM"] if pin else EDGE_EPS_M
            best = limit
            hit = None
            for name, _bb, polys in districts:
                d = _ring_dist_m(p, polys)
                if d < best:
                    best = d
                    hit = name
            if hit is None:
                fail(f"SA1 {code} at {p}: no district within {limit} m —"
                     " the boundary source drifted")
            if pin and hit != pin["district"]:
                fail(f"SA1 {code} at {p}: pinned rescue {pin['district']}"
                     f" but nearest is {hit}")
            hits = 1
            rescued.append((code, best))
            hit_name = hit
        if hits > 1:
            fail(f"SA1 {code} at {p}: lands in {hits} districts")
        assign[code] = hit_name
    for code, d in rescued:
        print(f"  edge-eps rescue: SA1 {code} -> {assign[code]} ({d:.0f} m off the boundary)")
    print(f"assign: {len(assign)} SA1s -> 88 districts (centroid method, {len(rescued)} edge rescues)")
    return assign


def write_assign_map(year, assign):
    os.makedirs(os.path.dirname(VINTAGES[year]["assign"]), exist_ok=True)
    path = VINTAGES[year]["assign"]
    with open(path, "w") as f:
        json.dump(assign, f, separators=(",", ":"), sort_keys=True)
    print(f"-> {path} ({os.path.getsize(path)} bytes, {len(assign)} SA1s)")


def load_assign_map(year):
    V = VINTAGES[year]
    path = V["assign"]
    if not os.path.exists(path):
        fail(f"join cache {path} missing — run the {year}-vintage demo builder first")
    with open(path) as f:
        assign = json.load(f)
    names = set(EXPECTED_NAMES)
    only = {k for k, v in assign.items() if v not in names}
    if only:
        fail(f"join cache: {len(only)} SA1s assign to district names outside EXPECTED_NAMES ({sorted(only)[:3]}…)")
    if set(assign) & VIC_SENTINELS[year]:
        fail("join cache carries a sentinel SA1")
    print(f"join cache: {path} covers {len(assign)} SA1s")
    return assign
