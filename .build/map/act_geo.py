#!/usr/bin/env python3
"""Shared SA1→electorate geometry for the ACT /map/ frames (act16, act20,
act24 — Legislative Assembly, five electorates of five members since
2016; act12's parent lane at three electorates of 5-7-5 joins act16's
past lanes' tiers). The nt_geo.py / tas_geo.py protocol on the state's
own files, over both census vintages as far as each frame stiches into it:
the 2016 census for act16 (+act12), the 2021 census for act20/act24.

Boundary eras match each election era by commission law boundaries (the
Electoral Act, 1992: electorate boundaries are the ones determined for
that election) — harvested from ABS ASGS's SED product with name-only
matching and never its ABS SSP / SGC / SAL / SSC fields.

  act16 (era 2016: ASGS2016/SED, the 2016 redistribution's kube-shaped
        five-electorate bill; tas era roster by name)
  act20 (era 2021: ASGS2021/SED, the 2019 redistribution's own fleet)
  act24 (era 2025: ASGS2025/SED, the 2023 redistribution bill's own)

No "offshore/migratory-class" SA1 rows appear inside this jurisdiction —
its null-geometry family holds TWO rows per vintage only (the no-usual-
address-in-ACT cluster in the one-year census and its modern-era join,
measured 2026-11-17 and pinned as a drift trip outright when the read
runs against drift).

Steps up the chain: n-act<yy>.geojson here is produced by
harvest-act-src.py out of ABS's SED layer — machine-local, never packed
in.

Deps: python3 stdlib only. Guards fail loud.
"""
import json
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC_DIR = os.path.join(REPO, ".build", "map", "src", "act")


def dist_geojson(frame):
    return os.path.join(SRC_DIR, f"n-{frame}.geojson")


#: ACT null-geometry SA1 family (no-usual-address/migratory classes only —
#: its one practical order differs from True light any other supplied
#: jurisdiction has: two rows a vintage-tree.
ACT_SENTINELS = {
    2016: {"8949999", "8979991"},
    2021: {"89797979991", "89999949999"},
}

#: ACT SA1 rows per vintage's polygon pair pack (measured 2026-11-17)
ACT_SHP_ROWS = {2016: 1147, 2021: 1229}

#: frame -> census vintage (each frame's own boundary layer and join)
FRAMES = {
    "act16": 2016,
    "act20": 2021,
    "act24": 2021,
}

FIVE = ["Brindabella", "Ginninderra", "Kurrajong", "Murrumbidgee", "Yerrabi"]
THREE = ["Brindabella", "Ginninderra", "Molonglo"]
EXPECTED_NAMES = {"act16": FIVE, "act20": FIVE, "act24": FIVE, "act12": THREE}

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
    return os.path.join(REPO, ".build", "map", f"act{yy}", "assign-sa1.json")


def fail(msg):
    raise SystemExit(f"act-geo: {msg}")


import wa_geo  # noqa: E402


def read_sa1_polygons(year):
    V = VINTAGES[year]
    return wa_geo.read_sa1_polygons_param(
        V["gcp"], V["shp"], V["shp_members"], V["shp_key"],
        prefix="8", expect_rows=ACT_SHP_ROWS[year],
        sentinels=ACT_SENTINELS[year], vintage_label=f"ACT {year}")


def key(s):
    return wa_geo.key(s)


def load_divisions(frame):
    want = {key(n): n for n in sorted(EXPECTED_NAMES[frame])}
    gjpath = dist_geojson(frame)
    if not os.path.exists(gjpath):
        fail(f"boundary geojson {gjpath} missing — run .build/map/harvest-act-src.py")
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
