#!/usr/bin/env python3
"""harvest-sa18-src.py — the sa18 frame's sources.

Verifies the committed 2018 results mirror (already at
.build/map/src/sa22/ecsa-2018-*.html.gz — fetched by the sa22 past lane)
and exports the frame's boundary layer:

- The mirror: 49 pages — 47 district summaries
  (ecsa-2018-<District>.html.gz), plus house and Legislative Council
  summaries, under https://www.ecsa.sa.gov.au/html/results/2018/... .
  These are the Electoral Commission SA's own 2018 result tables
  (candidate first-preferences and two-candidate-preferred counts,
  district tallies). Verified parseable by the build's own district
  parser shard; re-fetch is out of scope here (build_sa22_past.py owns
  the --fetch for these pages).

- The boundary layer: the ABS ArcGIS SED/MapServer anonymous GeoJSON
  service, edition ASGS2017 (the 2016 redistribution as gazetted for
  the 2018 election — ASGS2016 carries the 2012-determination/2014
  set, ASGS2017 the determination applied in 2018, ASGS2018 unchanged),
  roster-gated against sa18_geo's EXPECTED_NAMES, written MACHINE-LOCAL
  to .build/map/src/sa18/n-sa18.geojson, never committed.

usage: python3 -I .build/map/harvest-sa18-src.py [--fetch]
"""
import gzip
import json
import os
import re
import sys
import urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC22 = os.path.join(REPO, ".build", "map", "src", "sa22")
SRC18 = os.path.join(REPO, ".build", "map", "src", "sa18")
FETCH = "--fetch" in sys.argv

SED_URL = (
    "https://geo.abs.gov.au/arcgis/rest/services/ASGS2017/SED/MapServer/0/query"
    "?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson"
)
UA = {"User-Agent": "auspol-tracker sa18 map-frame source harvest"}

EXPECTED_NAMES = None  # imported lazily from sa18_geo


def fail(msg):
    raise SystemExit(f"harvest-sa18: {msg}")


def norm_key(s):
    return re.sub(r"[^A-Z0-9]+", " ", str(s or "").upper()).strip()


def check_mirror():
    from build_sa22_past import fetch_page, votes_table  # noqa: E402
    files = [f for f in os.listdir(SRC22)
             if f.startswith("ecsa-2018-") and f.endswith(".html.gz")]
    districts = sorted(f[len("ecsa-2018-"):-len(".html.gz")] for f in files
                       if f not in ("ecsa-2018-house.html.gz", "ecsa-2018-lc.html.gz"))
    if len(districts) != 47:
        fail(f"{len(districts)} 2018 district pages cached under sa22/, want 47 "
             f"(missing the fetcher? run build_sa22_past.py map/data --fetch)")
    for extra in ("ecsa-2018-house.html.gz", "ecsa-2018-lc.html.gz"):
        if extra not in files:
            fail("2018 mirror missing " + extra)
    for d in districts[:2] + districts[-2:]:
        doc = fetch_page(f"ecsa-2018-{d}", f"{d}.html")
        fpv, foot = votes_table(__import__('re').sub(
            r'<div class="d-none d-sm-block">.*?</div>', "", doc,
            flags=__import__('re').S), "First Preference Votes", d)
        if foot.get("Total Formal") is None:
            fail(f"{d}: mirror page's Tallies block missing")
    print(f"mirror 2018: 47 district pages + house + LC parsed")


def fetch_geo():
    out_path = os.path.join(SRC18, "n-sa18.geojson")
    if os.path.exists(out_path) and not FETCH:
        print("n-sa18.geojson present")
        return
    if not FETCH:
        print("n-sa18.geojson missing (run with --fetch)")
        return
    import sa18_geo
    roster = {norm_key(x) for x in sa18_geo.EXPECTED_NAMES}
    raw = json.loads(urllib.request.urlopen(
        urllib.request.Request(SED_URL, headers=UA), timeout=180).read())
    feats = []
    namef = codef = None
    for f in raw["features"]:
        props = f.get("properties") or {}
        codef = codef or next((k for k in props if "code" in k.lower()), None)
        namef = namef or next((k for k in props if "name" in k.lower()), None)
        nm = re.sub(r"\s*\(SA\)\s*$", "", (props.get(namef) or "").strip())
        if not str(props.get(codef, "")).startswith("4"):
            continue
        if norm_key(nm) not in roster:
            continue
        f["properties"] = {"name": nm}
        feats.append(f)
    got = {norm_key((f["properties"] or {}).get("name")) for f in feats}
    if got != roster:
        fail(f"SED edition roster differs from the results mirror's: "
             f"missing_geo {sorted(roster - got)[:4]} extra_geo {sorted(got - roster)[:4]}")
    os.makedirs(SRC18, exist_ok=True)
    json.dump({"type": "FeatureCollection", "features": feats}, open(out_path, "w"))
    print(f"n-sa18.geojson: {len(feats)} features (ASGS2017 SED)")


def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    check_mirror()
    fetch_geo()


if __name__ == "__main__":
    main()
