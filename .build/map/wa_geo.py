#!/usr/bin/env python3
"""Shared SA1→district geometry for the Western Australia /map/ frames
(wa17, wa21, wa25) — the qld_geo.py protocol on Western Australia's own
files, with one extra dimension already exercised there: the census
edition moves with the frame (2016 for wa17, 2021 for wa21 and wa25).

Unlike Queensland, WA redistributes before EVERY election, so each frame
has its own boundary layer and its own SA1→district join: the 2021-vintage
SA1s join once onto the 2019-redistribution districts (wa21) and once onto
the 2023-redistribution districts (wa25). The joins are committed per frame
at .build/map/wa<YY>/assign-sa1.json and read back by the SEIFA runs, so a
frame's people and advantage lanes always pool over the SAME assignment.

The one place the ABS SA1 polygons (both vintages) is read for WA, filtered
on the "5" code prefix. Boundary layers are the ABS SED edition geojsons the
harvester writes (machine-local, see harvest-wa-src.py case 2):
wa17 ← ASGS2017 SED, wa21 ← ASGS2021 SED, wa25 ← ASGS2025 SED. The
harvester normalised their names to ALL-CAPS; the join keys them
letters-only against the EIS roster below.

Datum note: SA1 2021 pack is GDA2020, the EIS-era SED exports come out
WGS84 (outSR 4326) — a sub-2 m offset, immaterial beside urban SA1 sizes
(the same tolerance the qld and venue-proxy joins keep).

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os
import struct
import zipfile
from array import array

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_DIR = os.path.join(REPO, ".build", "map", "src", "wa")


def dist_geojson(frame):
    return os.path.join(DIST_DIR, f"n-{frame}.geojson")


VINTAGES = {
    2021: {
        "gcp": os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "gcp-sa1-2021.zip"),
        "shp": os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "SA1_2021_AUST_SHP_GDA2020.zip"),
        "shp_members": ("SA1_2021_AUST_GDA2020.shp", "SA1_2021_AUST_GDA2020.dbf"),
        "gcp_key": "SA1_CODE_2021",
        "shp_key": "SA1_CODE21",
        "gcp_rows": 61844,
        "member": "2021 Census GCP Statistical Area 1 for AUS/2021Census_{table}_AUST_SA1.csv",
        "lang": ("Lang_used_home_Eng_only_P", "Lang_used_home_Oth_Lang_P"),
        "uni_member": "G49B", "occ_member": "G60B",
        "fam_member": "G32", "ten_member": "G37",
    },
    2016: {
        "gcp": os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "gcp-sa1-2016.zip"),
        "shp": os.path.join(REPO, ".matilda", "seifa-irsad-abs", "dl", "1270055001_sa1_2016_aust_shape.zip"),
        "shp_members": ("SA1_2016_AUST.shp", "SA1_2016_AUST.dbf"),
        "gcp_key": "SA1_7DIGITCODE_2016",
        "shp_key": "SA1_7DIG16",
        "gcp_rows": 57523,
        "member": "2016 Census GCP Statistical Area 1 for AUST/2016Census_{table}_AUS_SA1.csv",
        "lang": ("Lang_spoken_home_Eng_only_P", "Lang_spoken_home_Oth_Lang_P"),
        "uni_member": "G46B", "occ_member": "G57B",
        "fam_member": "G28", "ten_member": "G33",
    },
}

#: WA sentinel SA1s carry no geometry (migratory/offshore/no-usual-address,
#: the "…9999…" codes) — computed from each vintage's null-geometry records
#: 2026-11-05 and pinned here; a drift in the set is a guard trip, never a
#: silent re-derive
WA_SENTINELS = {
    2021: {"59797979991", "59797979992", "59797979993", "59999949999"},
    2016: {"5949999", "5979991", "5979992", "5979993"},
}

#: the frame -> census vintage; every frame has its own boundary layer and
#: its own SA1→district join (WA redistributes before every election)
FRAMES = {
    "wa17": 2016,
    "wa21": 2021,
    "wa25": 2021,
}


def assign_path(frame):
    yy = frame[2:]
    return os.path.join(REPO, ".build", "map", f"wa{yy}", "assign-sa1.json")


EXPECTED_NAMES = {
    "wa17": sorted(['Albany', 'Armadale', 'Balcatta', 'Baldivis', 'Bassendean', 'Bateman', 'Belmont', 'Bicton', 'Bunbury', 'Burns Beach', 'Butler', 'Cannington', 'Carine', 'Central Wheatbelt', 'Churchlands', 'Cockburn', 'Collie-Preston', 'Cottesloe', 'Darling Range', 'Dawesville', 'Forrestfield', 'Fremantle', 'Geraldton', 'Girrawheen', 'Hillarys', 'Jandakot', 'Joondalup', 'Kalamunda', 'Kalgoorlie', 'Kimberley', 'Kingsley', 'Kwinana', 'Mandurah', 'Maylands', 'Midland', 'Mirrabooka', 'Moore', 'Morley', 'Mount Lawley', 'Murray-Wellington', 'Nedlands', 'North West Central', 'Perth', 'Pilbara', 'Riverton', 'Rockingham', 'Roe', 'Scarborough', 'South Perth', 'Southern River', 'Swan Hills', 'Thornlie', 'Vasse', 'Victoria Park', 'Wanneroo', 'Warnbro', 'Warren-Blackwood', 'West Swan', 'Willagee']),
    "wa21": sorted(['Albany', 'Armadale', 'Balcatta', 'Baldivis', 'Bassendean', 'Bateman', 'Belmont', 'Bicton', 'Bunbury', 'Burns Beach', 'Butler', 'Cannington', 'Carine', 'Central Wheatbelt', 'Churchlands', 'Cockburn', 'Collie-Preston', 'Cottesloe', 'Darling Range', 'Dawesville', 'Forrestfield', 'Fremantle', 'Geraldton', 'Hillarys', 'Jandakot', 'Joondalup', 'Kalamunda', 'Kalgoorlie', 'Kimberley', 'Kingsley', 'Kwinana', 'Landsdale', 'Mandurah', 'Maylands', 'Midland', 'Mirrabooka', 'Moore', 'Morley', 'Mount Lawley', 'Murray-Wellington', 'Nedlands', 'North West Central', 'Perth', 'Pilbara', 'Riverton', 'Rockingham', 'Roe', 'Scarborough', 'South Perth', 'Southern River', 'Swan Hills', 'Thornlie', 'Vasse', 'Victoria Park', 'Wanneroo', 'Warnbro', 'Warren-Blackwood', 'West Swan', 'Willagee']),
    "wa25": sorted(['Albany', 'Armadale', 'Balcatta', 'Baldivis', 'Bassendean', 'Bateman', 'Belmont', 'Bibra Lake', 'Bicton', 'Bunbury', 'Butler', 'Cannington', 'Carine', 'Central Wheatbelt', 'Churchlands', 'Cockburn', 'Collie-Preston', 'Cottesloe', 'Darling Range', 'Dawesville', 'Forrestfield', 'Fremantle', 'Geraldton', 'Girrawheen', 'Hillarys', 'Jandakot', 'Joondalup', 'Kalamunda', 'Kalgoorlie', 'Kimberley', 'Kingsley', 'Kwinana', 'Landsdale', 'Mandurah', 'Maylands', 'Mid-West', 'Midland', 'Mindarie', 'Morley', 'Mount Lawley', 'Murray-Wellington', 'Nedlands', 'Oakford', 'Perth', 'Pilbara', 'Riverton', 'Rockingham', 'Roe', 'Scarborough', 'Secret Harbour', 'South Perth', 'Southern River', 'Swan Hills', 'Thornlie', 'Vasse', 'Victoria Park', 'Wanneroo', 'Warren-Blackwood', 'West Swan']),
}


def fail(msg):
    raise SystemExit(f"wa-geo: {msg}")


# ------------------------------------------------------- SHP polygons (WA rows)
def read_sa1_polygons(year):
    """SA1 code -> classified polygons, WA rows of that vintage's pack."""
    V = VINTAGES[year]
    if not os.path.exists(V["shp"]):
        fail(f"missing SA1 polygons {V['shp']} (see refetch manifests in build_qld_demo_common)")
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
    wa_n = sum(1 for c in codes if c.startswith("5"))
    expect_n = 6352 if year == 2021 else 5984
    if wa_n != expect_n:
        fail(f"DBF WA rows {wa_n} != pin {expect_n}")

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
            if code.startswith("5"):
                nulls.append(code)
            continue
        if rtype != 5:
            fail("SHP non-polygon record")
        if not code.startswith("5"):
            continue
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
    expect = WA_SENTINELS[year]
    if nullset != expect:
        fail(f"WA {year} sentinel SA1 set drift: got {sorted(nullset)},"
             f" pinned {sorted(expect)}")
    print(f"SA1 {year} polygons: {len(out)} WA shapes, {len(nulls)} WA sentinels (no geometry)")
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


def load_districts(frame):
    """The frame's 59 district polygons from the harvester's SED geojson,
    joined name-for-name with the EIS roster (letters-only keys)."""
    want = {key(n): n for n in EXPECTED_NAMES[frame]}
    gjpath = dist_geojson(frame)
    if not os.path.exists(gjpath):
        fail(f"boundary geojson {gjpath} missing — run .build/map/harvest-wa-src.py")
    with open(gjpath) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != 59:
        fail(f"boundary geojson has {len(feats)} features, expected 59")
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
    print(f"districts ({frame}): {len(out)} polygons")
    return out, EXPECTED_NAMES[frame]


# ------------------------------------------------------------------ the join
EDGE_EPS_M = 25


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


def assign_sa1(sa1, districts):
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
            best = EDGE_EPS_M
            for name, _bb, polys in districts:
                d = _ring_dist_m(p, polys)
                if d < best:
                    best = d
                    hit_name = name
            if hit_name is None:
                fail(f"SA1 {code} at {p}: no district within {EDGE_EPS_M} m —"
                     " the boundary source drifted")
            hits = 1
            rescued.append((code, best))
        if hits > 1:
            fail(f"SA1 {code} at {p}: lands in {hits} districts")
        assign[code] = hit_name
    for code, d in rescued:
        print(f"  edge-eps rescue: SA1 {code} -> {assign[code]} ({d:.0f} m off the boundary)")
    print(f"assign: {len(assign)} SA1s -> 59 districts (centroid method, {len(rescued)} edge rescues)")
    return assign


def write_assign_map(frame, assign):
    path = assign_path(frame)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(assign, f, separators=(",", ":"), sort_keys=True)
    print(f"-> {path} ({os.path.getsize(path)} bytes, {len(assign)} SA1s)")


def load_assign_map(frame):
    path = assign_path(frame)
    if not os.path.exists(path):
        fail(f"join cache {path} missing — run build_{frame}_demo.py first")
    with open(path) as f:
        assign = json.load(f)
    names = {key(n): n for n in EXPECTED_NAMES[frame]}
    bad = sorted(set(assign.values()) - set(names.values()))
    if bad:
        fail(f"assign cache values drifted from the frame roster: {bad[:5]}")
    return assign
