#!/usr/bin/env python3
"""Reduce the 2013-era state-boundary vintages to the /map/ n-<frame>.geojson
contract: a GeoJSON FeatureCollection with exactly one `name` property per
feature, the OFFICIAL district casing.

Sources (fetched into .build/map/src/, gitignored; see README-history.md):
  .build/map/src/nsw13/nsw13-raw.geojson
      ArcGIS FeatureServer "2013_NSW_Electoral_Boundaries" (portal.spatial.nsw.
      gov.au, dataset "NSW Administrative Boundaries Theme - State Electoral
      District 2013"): 93 districts, UPPERCASE `districtname`. Boundaries of
      the NSW 2013 redistribution - the 2015 and 2019 state elections.
  .build/map/src/vic13a.geojson
      VEC open-data WFS layer `state_assembly_2013` (opendata.maps.vic.gov.au):
      88 districts, UPPERCASE `district` - the 2014 and 2018 Victorian state
      elections (the vic22 frame's n-vic22.geojson contract, one era back).

Official name casing is taken from each jurisdiction's own election pages,
committed in `.build/state-flow-src/`:
  NSW: <slug>-fp.html.gz carries "<name>" after "State Electoral District of "
  VIC: <slug>district.html carries "<h2>X District</h2>"
The page roster is asserted EQUAL to a title-casing of the boundary roster
(via TITLE_WORD, whose per-word spelling rules are the ONLY name surgery);
any disagreement fails loudly - never a silent rename or drop.

usage: python3 .build/map/make-n13-geojson.py
"""
import gzip, hashlib, json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(REPO, ".build", "map", "src")
NSW_RAW = os.path.join(SRC, "nsw13", "nsw13-raw.geojson")
VIC_RAW = os.path.join(SRC, "vic13a.geojson")
NSW_PAGES = os.path.join(REPO, ".build", "state-flow-src", "nsw", "2019")
VIC_PAGES = os.path.join(REPO, ".build", "state-flow-src", "vic", "2018")

EXPECT_N = {"nsw": 93, "vic": 88}


def fail(msg):
    raise SystemExit(f"make-n13-geojson: {msg}")


# the ONLY name surgery: every boundary name adopts its official-page
# casing matched case-insensitively (geojson "KU-RING-GAI" -> page "Ku-ring-gai",
# "MACQUARIE" -> "Macquarie"); no spelling is ever invented here.
def official_of(upper, page_by_lower, ctx):
    key = upper.lower()
    hits = page_by_lower.get(key) or []
    if len(hits) != 1:
        fail(f"{ctx}: boundary name {upper!r} has {len(hits)} page matches")
    return hits[0]


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load(path):
    with open(path, "rb") as fh:
        return json.loads(fh.read().decode("utf-8"))


def nsw_page_names():
    names = {}
    for f in sorted(os.listdir(NSW_PAGES)):
        if not f.endswith("-fp.html.gz") or f.startswith("lc-"):
            continue
        slug = f[:-len("-fp.html.gz")]
        with gzip.open(os.path.join(NSW_PAGES, f), "rt", encoding="utf-8",
                       errors="replace") as fh:
            t = fh.read()
        m = re.search(r"State Electoral District of ([^<]+)", t)
        if not m:
            fail(f"nsw page {f}: no 'State Electoral District of' line")
        names[slug] = m.group(1).strip()
    if len(names) != EXPECT_N["nsw"]:
        fail(f"nsw page roster {len(names)} != {EXPECT_N['nsw']}")
    return names


def vic_page_names():
    names = {}
    for f in sorted(os.listdir(VIC_PAGES)):
        if not f.endswith("district.html"):
            continue
        if f.startswith(("tcpbyvotingcentre", "fpvbyvotingcentre", "distribution")):
            continue
        slug = f[:-len("district.html")]
        with open(os.path.join(VIC_PAGES, f), encoding="utf-8",
                  errors="replace") as fh:
            t = fh.read()
        m = re.search(r"<h2>([^<]+) District</h2>", t)
        if not m:
            fail(f"vic page {f}: no '<h2>.. District</h2>' line")
        names[slug] = m.group(1).strip()
    if len(names) != EXPECT_N["vic"]:
        fail(f"vic page roster {len(names)} != {EXPECT_N['vic']}")
    return names


def normalise_against(raw_path, prop, page_names, frames):
    raw = load(raw_path)
    feats = raw.get("features") or fail(f"{raw_path}: no features")
    official = sorted(set(page_names.values()))
    page_by_lower = {}
    for name in official:
        page_by_lower.setdefault(name.lower(), []).append(name)
    geom_names = set()
    out_features = []
    for f in feats:
        props = f.get("properties") or {}
        upper = props.get(prop)
        if not upper:
            fail(f"feature lacks {prop}: {props}")
        titled = official_of(upper, page_by_lower, os.path.basename(raw_path))
        if titled in geom_names:
            fail(f"dup official name {titled!r}")
        geom_names.add(titled)
        out_features.append({"type": "Feature",
                             "properties": {"name": titled},
                             "geometry": f["geometry"]})
    if len(geom_names) != len(official):
        fail(f"geometry/name cardinalities differ: {len(geom_names)} vs {len(official)}")
    mism_geo = [n for n in geom_names if n not in official]
    mism_page = [n for n in official if n not in geom_names]
    if mism_geo or mism_page:
        fail(f"roster mismatch: geometry-only {mism_geo[:8]} / page-only {mism_page[:8]}")
    for name in frames:
        dest = os.path.join(SRC, f"n-{name}.geojson")
        body = {"type": "FeatureCollection", "source": os.path.relpath(raw_path, REPO),
                "sourceSHA256": sha256_of(raw_path), "features": out_features}
        with open(dest, "w") as fh:
            json.dump(body, fh, separators=(",", ":"))
        print(f"  n-{name}.geojson: {len(out_features)} features, "
              f"{os.path.getsize(dest):,} bytes")
    return sorted(geom_names)


def main():
    nsw_names = normalise_against(NSW_RAW, "districtname", nsw_page_names(),
                                  ("nsw15", "nsw19"))
    print(f"nsw13 roster: {len(nsw_names)} (e.g. {nsw_names[:4]})")
    vic_names = normalise_against(VIC_RAW, "district", vic_page_names(),
                                  ("vic14", "vic18"))
    print(f"vic13 roster: {len(vic_names)} (e.g. {vic_names[:4]})")
    roster = os.path.join(SRC, "n13-roster.json")
    with open(roster, "w") as fh:
        json.dump({"nsw": nsw_names, "vic": vic_names}, fh, indent=1)
    print(f"roster pinned at {roster}")


if __name__ == "__main__":
    main()
