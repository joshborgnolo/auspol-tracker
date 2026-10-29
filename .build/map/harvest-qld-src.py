#!/usr/bin/env python3
"""harvest-qld-src.py — fill the Queensland map-frame source mirrors.

The /map/ Queensland frames (qld17, qld20, qld24) read three kinds of source
caches. This script assembles them:

  1. 2017 Ektron-site artifacts the flow mirror never harvested. The 2017
     frame's results caches are the 93 gzipped booth pages already committed
     at .build/state-flow-src/qld/2017/booth<N>.html.gz (the flow machinery's
     mirror — the map builders read them there, never re-fetch them), but
     the frame also needs, per district N (1..93, alphabetical):
       .build/map/src/qld17/district<N>.html.gz   — the district summary
         page (electors at close of roll, candidate roster with short party
         codes, formal/informal/total votes, the elected marker)
       .build/map/src/qld17/profile<N>.html.gz    — the district profile
         page (the venue roll: booth name, premise, street, suburb — the
         2017 frame's prem/sub lanes and its name↔2020/2024 coord join key)
     Live URLs (the site still serves them, 2026-10-29):
       https://results.ecq.qld.gov.au/elections/state/State2017/results/district<N>.html
       https://results.ecq.qld.gov.au/elections/state/State2017/<Name>/districtProfile.html
     The profile slug comes from each booth page's own District Profile link,
     so the harvest needs no district-name list of its own.

  2. The 2017-determined state electoral boundary geojson (one boundary set
     served the 2017, 2020 and 2024 elections; the next redistribution
     applies from 2028). Downloaded from the Queensland spatial catalogue's
     ArcGIS FeatureServer "State electoral boundary 2017" layer (item
     1465b5b4ba6a464e9a72d3d9fe3ab602):
       .build/map/src/qld/n-qld.geojson   (MACHINE-LOCAL, like the federal
       n-YYYY.geojson era files and sa26's n-sa26.geojson — never committed)
     93 features, `name` property in ALL-CAPS; geo_build's key() join folds
     case/punctuation.

  3. The 2020/2024 media-feed XML: ALREADY mirrored by the flow machinery at
     .build/state-flow-src/qld/<YYYY>/{src.zip,xml/publicResults.xml} — this
     script only verifies the mirror's presence and shape (venues block with
     coordinates, 93 state-general districts with official count rounds),
     so a missing mirror fails at harvest time, not mid-build.

usage: python3 -I .build/map/harvest-qld-src.py [--fetch] [--bounds-only]
"""
import gzip, io, json, os, re, sys, time, urllib.request, zipfile

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FLOW_MIRROR = os.path.join(REPO, ".build", "state-flow-src", "qld")
SRC17 = os.path.join(REPO, ".build", "map", "src", "qld17")
SRCB = os.path.join(REPO, ".build", "map", "src", "qld")
FETCH = "--fetch" in sys.argv
BOUNDS_ONLY = "--bounds-only" in sys.argv
BASE = "https://results.ecq.qld.gov.au/elections/state/State2017"
BOUNDS_URL = ("https://spatial-gis.information.qld.gov.au/arcgis/rest/services/"
              "Boundaries/AdminBoundariesFramework/FeatureServer/139/query"
              "?where=1%3D1&outFields=*&returnGeometry=true&f=geojson")
UA = {"User-Agent": "auspol-tracker qld map-frame source harvest"}


def fail(msg):
    raise SystemExit(f"harvest-qld-src: {msg}")


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req) as r:
        body = r.read()
    if binary:
        return body
    return body.decode("utf-8", errors="replace")


def save_gz(path, text):
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write(text)


def harvest_2017():
    os.makedirs(SRC17, exist_ok=True)
    made = 0
    for fname, url, needs in (
        ("prepoll-offices.html.gz", f"{BASE}/prepollOffices.html", ("Pre-Poll",)),
        ("returning-officers.html.gz", f"{BASE}/returningofficers.html", ("Returning Officer",)),
    ):
        path = os.path.join(SRC17, fname)
        if FETCH or not os.path.exists(path):
            txt = get(url)
            for need in needs:
                if need not in txt:
                    fail(f"{url}: response lacks {need!r} — the 2017 site's shape moved")
            save_gz(path, txt)
            made += 1
    for n in range(1, 94):
        dpath = os.path.join(SRC17, f"district{n}.html.gz")
        ppath = os.path.join(SRC17, f"profile{n}.html.gz")
        if not FETCH and os.path.exists(dpath) and os.path.exists(ppath):
            continue
        # the booth page (already mirrored by the flow machinery) names the
        # district and carries the District Profile link with the profile slug
        booth_path = os.path.join(FLOW_MIRROR, "2017", f"booth{n}.html.gz")
        if not os.path.exists(booth_path):
            fail(f"flow mirror booth page missing: {booth_path}"
                 " — run .build/harvest-qld-state-flows.py for 2017 first")
        with gzip.open(booth_path, "rt", encoding="utf-8", errors="replace") as f:
            booth = f.read()
        m = re.search(r"(\d{4}) State General Election - (.*?) -?\s*Booth Details", booth)
        if not m or m.group(1) != "2017":
            fail(f"booth{n}: could not read the district name from the title")
        name = m.group(2).strip()
        lm = re.search(r'href="(/elections/state/State2017/([^"]+)/districtProfile\.html)"', booth)
        if not lm:
            fail(f"booth{n} ({name}): no District Profile link")
        slug = lm.group(2)

        if FETCH or not os.path.exists(dpath):
            dtxt = get(f"{BASE}/results/district{n}.html")
            dm = re.search(r"(\d{4}) State General Election - (.*?) -?\s*District Summary", dtxt)
            if not dm or dm.group(1) != "2017":
                fail(f"district{n}: title did not match the 2017 district-summary shape")
            if dm.group(2).strip() != name:
                fail(f"district{n} is {dm.group(2).strip()} but booth{n} is {name} — indices crossed")
            if "Electors at Close of Roll:" not in dtxt or "Total Formal Votes" not in dtxt:
                fail(f"district{n}: summary page lacks the enrolment/votes blocks")
            save_gz(dpath, dtxt)
            made += 1
            time.sleep(0.2)

        if FETCH or not os.path.exists(ppath):
            ptxt = get(f"{BASE}/{slug}/districtProfile.html")
            if "Polling Booths:" not in ptxt:
                fail(f"profile {name} ({slug}): page lacks the Polling Booths roll")
            save_gz(ppath, ptxt)
            made += 1
            time.sleep(0.2)
    print(f"2017 artifacts: {made} fetched into {SRC17}"
          " (0 = the mirror was already complete)")


def harvest_bounds():
    os.makedirs(SRCB, exist_ok=True)
    dest = os.path.join(SRCB, "n-qld.geojson")
    if not FETCH and os.path.exists(dest):
        return dest
    raw = get(BOUNDS_URL, binary=True)
    d = json.loads(raw.decode("utf-8"))
    feats = d.get("features") or []
    if d.get("type") != "FeatureCollection" or len(feats) != 93:
        fail(f"boundary layer returned {len(feats)} features (expected 93) — the layer or query changed")
    names = set()
    for f in feats:
        p = f.get("properties") or {}
        nm = (p.get("name") or "").strip()
        if not nm or f.get("geometry", {}).get("type") not in ("Polygon", "MultiPolygon"):
            fail("a boundary feature lacks a name or polygon geometry")
        names.add(nm.upper())
    if len(names) != 93:
        fail(f"boundary name set has {len(names)} unique names, expected 93")
    with open(dest, "w") as f:
        json.dump(d, f, separators=(",", ":"))
    # geo_build reads n-<year>.geojson per frame; the one 2017-determined set
    # serves all three elections, so the canon is copied to each frame's name
    for yy in ("17", "20", "24"):
        ydest = os.path.join(os.path.dirname(dest), f"n-qld{yy}.geojson")
        with open(ydest, "w") as f:
            json.dump(d, f, separators=(",", ":"))
    print(f"boundaries: 93 districts -> {dest} (machine-local, untracked)"
          f" plus n-qld17/20/24 copies for geo_build")
    return dest


def verify_xml_mirror(year):
    path = os.path.join(FLOW_MIRROR, str(year), "xml", "publicResults.xml")
    if not os.path.exists(path):
        zpath = os.path.join(FLOW_MIRROR, str(year), "src.zip")
        if not os.path.exists(zpath):
            fail(f"flow mirror for {year} missing entirely ({zpath})"
                 " — run .build/harvest-qld-state-flows.py first")
        target = os.path.join(FLOW_MIRROR, str(year), "xml")
        os.makedirs(target, exist_ok=True)
        with zipfile.ZipFile(zpath) as z:
            names = z.namelist()
            if "publicResults.xml" not in names:
                fail(f"{zpath} holds {names}, expected publicResults.xml")
            z.extract("publicResults.xml", target)
        print(f"{year}: publicResults.xml unzipped from the mirrored src.zip")
    with open(path, "rb") as f:
        head = f.read(4000)
    if b"<venues" not in head:
        fail(f"{year}: {path} opens without the venues block — mirror shape changed")
    return path


def main():
    harvest_bounds()
    if BOUNDS_ONLY:
        return
    for year in (2020, 2024):
        verify_xml_mirror(year)
    harvest_2017()
    print("qld source mirrors ready")


main()
