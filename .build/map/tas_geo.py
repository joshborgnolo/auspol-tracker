#!/usr/bin/env python3
"""Shared SA1→division geometry for the Tasmania /map/ frames (tas14,
tas18, tas21, tas24, tas25 — House of Assembly, five divisions of five
members each through 2021, seven from 2024). The nt_geo.py/ sa18_geo.py
protocol on the State's own files, over both census vintages: the 2016
census for tas14 and tas18, the 2021 census for tas21/tas24/tas25

No postal-class SA1 reallocation happens for Tas-era boundary eras —
Tasmania's five divisions by law mirror the era federal divisions, so
the boundary layers are crops of the AEC's national boundary files
(harvest-tas-src.py writes n-tas<frame>.geojson state-era-matched:
 national-esri-2010 for tas14 & tas18 (both ran on the pre-2017
 determination), fe2019 for tas21 (the Sep-2017 determination in
 force), cwlth2021 for tas24, AUS-March-2025 for tas25).

The sentinel SA1 set per vintage is NT's recipe computed for prefix 6
(the ABS's null-geometry migratory/offshore/shipping/no-usual-address
family): Tas2016 keeps FIVE such members (SA/NT's four plus a fifth
migratory-class row that Tasmania's islands add), Tas2021 likewise five.
Computed live 2026-11-17, pinned as guards — drift trips the run outright
(the geo canonical-seconds rule).

Product note: tas10's past lane joins at division level only (the prev
election's demo figures never surface per-division in the app, NT2012
rule).

Deps: python3 stdlib only. Fail-loud contracts per the era protocol.
"""
import json
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC_DIR = os.path.join(REPO, ".build", "map", "src", "tas")


def dist_geojson(frame):
    return os.path.join(SRC_DIR, f"n-{frame}.geojson")


#: Tas null-geometry sentinel SA1 family (migratory / offshore /
#: shipping / no-usual-address), computed from each vintage's records
#: 2026-11-17 and pinned — a drift trips the read outright.
TAS_SENTINELS = {
    2016: {"6949999", "6979991", "6979992", "6979993", "6979994"},
    2021: {"69797979991", "69797979992", "69797979993", "69797979994", "69999949999"},
}

#: Tas SA1 row counts of each vintage's polygon pack (computed 2026-11-17)
TAS_SHP_ROWS = {2016: 1464, 2021: 1482}

#: frame -> census vintage (each frame its own boundary layer and join)
#: tas14/tas18 → 2016 census; tas21/tas24/tas25 → 2021
FRAMES = {
    "tas14": 2016,
    "tas18": 2016,
    "tas21": 2021,
    "tas24": 2021,
    "tas25": 2021,
}

_NAMES_1418 = ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]
_NAMES_2125 = ["Bass", "Braddon", "Clark", "Franklin", "Lyons"]
EXPECTED_NAMES = {
    "tas14": _NAMES_1418,
    "tas18": _NAMES_1418,
    "tas21": _NAMES_2125,
    "tas24": _NAMES_2125,
    "tas25": _NAMES_2125,
}

#: vintage pack locations (shared with every other jurisdiction)
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


def assign_path(frame):
    yy = frame[3:]
    return os.path.join(REPO, ".build", "map", f"tas{yy}", "assign-sa1.json")


def fail(msg):
    raise SystemExit(f"tas-geo: {msg}")


#: reusing the wa_geo machinery verbatim (the NT protocol)
import wa_geo  # noqa: E402


def read_sa1_polygons(year):
    V = VINTAGES[year]
    return wa_geo.read_sa1_polygons_param(
        V["gcp"], V["shp"], V["shp_members"], V["shp_key"],
        prefix="6", expect_rows=TAS_SHP_ROWS[year],
        sentinels=TAS_SENTINELS[year], vintage_label=f"TAS {year}")


def key(s):
    return wa_geo.key(s)


def load_divisions(frame):
    want = {key(n): n for n in sorted(EXPECTED_NAMES[frame])}
    gjpath = dist_geojson(frame)
    if not os.path.exists(gjpath):
        fail(f"boundary geojson {gjpath} missing — run .build/map/harvest-tas-src.py")
    with open(gjpath) as f:
        gj = json.load(f)
    feats = gj.get("features") or []
    if len(feats) != len(EXPECTED_NAMES[frame]):
        fail(f"boundary geojson has {len(feats)} features, want {len(EXPECTED_NAMES[frame])}")
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
        geom = f["geometry"]
        if geom["type"] == "MultiPolygon":
            polys = [(rings[0], rings[1:]) for rings in geom["coordinates"]]
        elif geom["type"] == "Polygon":
            polys = [(geom["coordinates"][0], geom["coordinates"][1:])]
        else:
            fail(f"boundary {nm}: geometry type {geom['type']}")
        xs = [x for p in polys for ring in [p[0], *p[1]] for x, _y in ring]
        ys = [y for p in polys for ring in [p[0], *p[1]] for _x, y in ring]
        out.append((want[k], [min(xs), min(ys), max(xs), max(ys)], polys))
    print(f"divisions ({frame}): {len(out)} polygons")
    return out, sorted(EXPECTED_NAMES[frame])


assign_sa1 = wa_geo.assign_sa1


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
