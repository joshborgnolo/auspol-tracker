#!/usr/bin/env python3
"""Shared SA1→district geometry for the Northern Territory /map/ frames
(nt16, nt20, nt24) — the wa_geo.py protocol on the Territory's own files,
on the same two census vintages: the 2016 census for nt16, the 2021 census
for nt20 and nt24 (a measured-only read, the wa21/wa25 class).

NT redistricts between most general elections (2015 redistribution applied
to 2016, 2019 to 2020, 2023 to 2024), so each frame holds its own
boundary layer and its own SA1→district join: committed per frame at
.build/map/nt<YY>/assign-sa1.json and read back by the SEIFA runs, so a
frame's people and advantage lanes always pool over the SAME assignment.
The 2012 past lane joins at division level only (no census lanes there —
the prev election's demo figures never surface in the app over these
frames).

The one place the ABS SA1 polygons (both vintages) is read for NT,
filtered on the "7" code prefix. Boundary layers are the ABS SED edition
geojsons the harvester writes (machine-local, see harvest-nt-src.py case
2): nt16 ← ASGS2017 SED, nt20 ← ASGS2021 SED, nt24 ← ASGS2025 SED. The
harvester normalised their names (dropping the " (NT)" suffix some SED
rows carry); the join keys them letters-only against the display roster
below.

Datum note: SA1 2021 pack is GDA2020, the SED exports come out WGS84
(outSR 4326) — a sub-2 m offset, immaterial beside urban SA1 sizes (the
same tolerance the wa and qld joins keep).

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DIST_DIR = os.path.join(REPO, ".build", "map", "src", "nt")


def dist_geojson(frame):
    return os.path.join(DIST_DIR, f"n-{frame}.geojson")


#: NT's four sentinel SA1s per vintage carry no geometry
#: (migratory/offshore/no-usual-address, the "…9999…" family — the exact
#: 7-prefixed analogue of WA's pinned set). Computed from each vintage's
#: null-geometry records 2026-11-16 and pinned here; a drift is a guard
#: trip, never a silent re-derive.
NT_SENTINELS = {
    2021: {"79797979991", "79797979992", "79797979993", "79999949999"},
    2016: {"7949999", "7979991", "7979992", "7979993"},
}

#: frame -> census vintage (each frame its own boundary layer and join)
FRAMES = {
    "nt16": 2016,
    "nt20": 2021,
    "nt24": 2021,
}

EXPECTED_NAMES = {
    "nt16": ["Arafura", "Araluen", "Arnhem", "Barkly", "Blain", "Braitling",
             "Brennan", "Casuarina", "Daly", "Drysdale", "Fannie Bay",
             "Fong Lim", "Goyder", "Johnston", "Karama", "Katherine",
             "Namatjira", "Nelson", "Nhulunbuy", "Nightcliff", "Port Darwin",
             "Sanderson", "Spillett", "Stuart", "Wanguri"],
    "nt20": ["Arafura", "Araluen", "Arnhem", "Barkly", "Blain", "Braitling",
             "Brennan", "Casuarina", "Daly", "Drysdale", "Fannie Bay",
             "Fong Lim", "Goyder", "Gwoja", "Johnston", "Karama", "Katherine",
             "Mulka", "Namatjira", "Nelson", "Nightcliff", "Port Darwin",
             "Sanderson", "Spillett", "Wanguri"],
}
EXPECTED_NAMES["nt24"] = list(EXPECTED_NAMES["nt20"])

#: the vintage packs WA's reader already mirrors; NT reads the SAME zip
#: members, filtered on the "7" code prefix
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

#: NT SA1 row counts of each vintage's polygon pack (computed 2026-11-16)
NT_SHP_ROWS = {2021: 649, 2016: 626}


def assign_path(frame):
    yy = frame[2:]
    return os.path.join(REPO, ".build", "map", f"nt{yy}", "assign-sa1.json")


def fail(msg):
    raise SystemExit(f"nt-geo: {msg}")


# the geometry helpers are the wa_geo build verbatim (protocol sibling);
# importing them keeps this file to the NT parameterisation only
import wa_geo  # noqa: E402


def read_sa1_polygons(year):
    V = VINTAGES[year]
    return wa_geo.read_sa1_polygons_param(
        V["gcp"], V["shp"], V["shp_members"], V["shp_key"],
        prefix="7", expect_rows=NT_SHP_ROWS[year],
        sentinels=NT_SENTINELS[year], vintage_label=f"NT {year}")


def key(s):
    return wa_geo.key(s)


def load_districts(frame):
    want = {key(n): n for n in sorted(EXPECTED_NAMES[frame])}
    gjpath = dist_geojson(frame)
    if not os.path.exists(gjpath):
        fail(f"boundary geojson {gjpath} missing — run .build/map/harvest-nt-src.py")
    with open(gjpath) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != 25:
        fail(f"boundary geojson has {len(feats)} features, expected 25")
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
    return out, sorted(EXPECTED_NAMES[frame])


assign_sa1 = wa_geo.assign_sa1

EDGE_EPS_M = wa_geo.EDGE_EPS_M


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
