#!/usr/bin/env python3
"""harvest-nt-src.py — fill the Northern Territory /map/ frame source mirrors.

The /map/ NT frames (nt16, nt20, nt24) read three kinds of sources. This
script verifies/assembles them, the harvest-wa-src.py discipline on the
NTEC's own products:

  1. RESULTS — already mirrored by the state-flows machinery at
     .build/state-flow-src/nt/{2016,2020,2024}/<division>.html (the NTEC
     results pages, one per division: candidate table with Primary/TCP,
     the "First preferences by voting centre" booth table, enrolment /
     formal / informal tallies, the distribution-of-preferences chain).
     Committed by .build/harvest-nt-state-flows.py (Chrome-piggyback past
     the Cloudflare wall). The 2012 election (nt16's past lane) is mirrored
     beside them at .build/state-flow-src/nt/2012/ as
       2012_la_general_election.pdf   NTEC's official statistical report
                                      (via the 2025-11-16 Wayback capture —
                                      ntec.nt.gov.au 403s plain curl)
       2012-official-summary.txt      its committed `pdftotext -layout`
                                      extract (re-derive machineside;
                                      builders read the committed file)
       psephos-nt2012.txt             Adam Carr's verbatim transcription of
                                      the AEC-style per-division candidate
                                      tables (NTEC's own page carries no
                                      candidate tables for 2012)
     This script only VERIFIES presence and shape, like harvest-wa-src's
     case 1 — a missing mirror fails at harvest time, not mid-build.

  2. BOUNDARIES — one SED edition per election, roster-gated against the
     results mirror's own division names (ABS editions carry
     Migratory/No-usual-address extras):
       nt16 ← ASGS2017/SED   (2015 redistribution, applied Aug 2016)
       nt20 ← ASGS2021/SED   (2019 redistribution — Stuart→Gwoja,
                              Nhulunbuy→Mulka)
       nt24 ← ASGS2025/SED   (2023 redistribution — no name changes)
     Exported as anonymous ArcGIS GeoJSON (outSR=4326) into
       .build/map/src/nt/n-nt<yy>.geojson — MACHINE-LOCAL, never committed.
     The SED product writes some NT names "<Name> (NT)"; this script
     normalises to the bare form NTEC uses, the shape geo_build's key()
     join consumes. (No ABS edition carries the 2012 divisions — the 2011
     redistribution set pre-dates the SED product entirely; the 2012→2016
     adjudication therefore rides documented renames, see
     .build/map/src/nt/past-adjudication.md, never polygons.)

  3. VENUE COORDINATES — no official geocoded register exists for NT
     elections (checked ntec.nt.gov.au, data.nt.gov.au CKAN, The Tally
     Room): most remote divisions vote via mobile teams, which have no
     fixed venue and draw no dot (the app's contract). Named booths are
     locality-named ("Parap", "Borroloola") plus ~15 early-voting centres
     ("Darwin EVC"). This script geocodes named booths to their ABS
     State-Suburb/small-town centroid (SSC 2016-era / SAL 2021-era, per
     frame vintage, anonymous ArcGIS query) and writes
       .build/map/src/nt/pp-nt.json        {(frame, division, venue):
                                           [lat, lon, ty]}  — COMMITTED
     with the early-voting centres hand-resolved in EVC_GEO below (their
     names carry no locality join key). Unresolved venues stay out of the
     file and simply draw no dot.

usage: python3 -I .build/map/harvest-nt-src.py [--fetch]
  --fetch   rewrite the geojson exports and pp-nt.json (idempotent;
            otherwise verify-only)
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "nt")
SRCN = os.path.join(REPO, ".build", "map", "src", "nt")
FETCH = "--fetch" in sys.argv

FRAMES = {"nt16": 2016, "nt20": 2020, "nt24": 2024}
SED_FOLDER = {"nt16": "ASGS2017", "nt20": "ASGS2021", "nt24": "ASGS2025"}
SED_URL = (
    "https://geo.abs.gov.au/arcgis/rest/services/{folder}/SED/MapServer/0/query"
    "?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson"
)
# locality sources per frame (suburb-name venues join SSC/SAL; remote
# community venues ride UCL — the "urban centre/locality" tier covering
# Jabiru/Ali Curung/Galiwin'ku-style towns that carry no suburb row).
# Polygon centroids are computed client-side (the service ignores
# returnCentroidOnly). Codes carry the state prefix 7 in all four layers.
LOC_SOURCES = {
    "nt16": [("ASGS2016", "SSC", "ssc_name_2016", "ssc_code_2016"),
             ("ASGS2016", "UCL", "ucl_name_2016", "ucl_code_2016")],
    "nt20": [("ASGS2021", "SAL", "sal_name_2021", "sal_code_2021"),
             ("ASGS2021", "UCL", "ucl_name_2021", "ucl_code_2021")],
}
LOC_SOURCES["nt24"] = LOC_SOURCES["nt20"]
LOC_URL = (
    "https://geo.abs.gov.au/arcgis/rest/services/{folder}/{svc}/MapServer/0/query"
    "?where={codef}%20LIKE%20%277%25%27&outFields=*&returnGeometry=true"
    "&outSR=4326&resultRecordCount=2000&f=geojson"
)
UA = {"User-Agent": "auspol-tracker nt map-frame source harvest"}

PSEUDO_VENUE_RE = re.compile(r"^(Absent|Declaration|Postal|Totals)$", re.I)
MOBILE_VENUE_RE = re.compile(r"^mobile team", re.I)
EVC_VENUE_RE = re.compile(r"\bEVC\b\s*\**$", re.I)

#: venue-label -> locality join-key fixups (the ABS products carry some NT
#: names suffixed " (NT)" — norm_sed_name strips those — and drop
#: apostrophes; a couple of NTEC booth labels are colloquial rather than
#: cadastral). Keys are norm_key() forms.
VENUE_ALIASES = {
    "GALIWIN KU": "GALIWINKU",         # apostrophe: NTEC's venue list vs ABS's spelling
    "MOULDEN PARK": "MOULDEN",
    "KATHERINE CENTRAL": "KATHERINE",
    "CASUARINA CITY": "CASUARINA",
}

#: venues whose labels exist in NO ABS locality product — hand-resolved to
#: the venue's host site (Nominatim lookups 2026-11-16; school rows are the
#: booth hosts, not neighbourhood centroids)
LOCALITY_OVERRIDES = {
    "MANUNDA TERRACE": (-12.4031, 130.9193),   # Manunda Terrace Primary School, Karama
    "YIRARA": (-23.7626, 133.8696),            # Yirara College, Arumbera
    "SANDERSON": (-12.3889, 130.8986),         # Sanderson High School, Anula
}

#: hand-resolved early-voting-centre locations (venue name -> [lat, lon]).
#: EVC rooms move election to election; a name re-entered here covers its
#: venue across frames only when it was the same place — verify before
#: extending. Sources: NTEC "where to vote" venue lists of each election.
EVC_GEO = {
    "Darwin EVC": [-12.3755, 130.8811],            # Darwin Convention Centre, Waterfront
    "Casuarina EVC": [-12.3773, 130.8821],         # Casuarina Square shopping centre
    "Palmerston EVC": [-12.4810, 130.9828],        # Palmerston Shopping Centre
    "Alice Springs EVC": [-23.6980, 133.8807],     # Alice Springs CBD
    "Katherine EVC": [-14.4645, 132.2636],         # Katherine CBD
    "Tennant Creek EVC": [-19.6493, 134.1913],     # Tennant Creek
    "Nhulunbuy EVC": [-12.1825, 136.7768],         # Nhulunbuy town centre
    "Coolalinga EVC": [-12.5223, 131.0453],        # Coolalinga Central
    "Howard Springs EVC": [-12.4945, 131.0745],
    "Berrimah EVC": [-12.4423, 130.9235],
    "Berry Springs EVC": [-12.7145, 131.0130],
    "Jabiru EVC": [-12.6707, 132.8343],
}


def fail(msg):
    raise SystemExit(f"harvest-nt-src: {msg}")


def get(url, binary=False, timeout=180):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


# ---------------------------------------------------------------- rosters
def norm_key(s):
    return re.sub(r"[^A-Z0-9]+", " ", str(s or "").upper()).strip()


def mirror_divisions(year):
    """The election's division names from the committed HTML mirror — the
    roster gate every other source is filtered against. 2016-era pages are
    <slug>.html; the display name comes off the page's results-table h2."""
    import nt_parse  # noqa: E402 (same directory on sys.path via caller)
    dd = os.path.join(SFS, str(year))
    if not os.path.isdir(dd):
        fail(f"missing results mirror {dd} — run .build/harvest-nt-state-flows.py")
    out = nt_parse.roster(year)
    if len(out) != 25:
        fail(f"{dd}: roster {len(out)} divisions, want 25")
    return out


def check_results():
    """1 — the NTEC mirror must carry all three elections in parseable
    shape; 2012's trifecta must sit beside them for nt16's past lane."""
    import nt_parse
    for year in (2016, 2020, 2024):
        names = mirror_divisions(year)
        print(f"mirror {year}: {len(names)} divisions ({names[0]} … {names[-1]})")
        d = nt_parse.load_frame_year(year)
        for dist in d["districts"]:
            if not dist["cands"] or dist["formal"] <= 0 or dist["enrolled"] <= 0:
                fail(f"{year}/{dist['name']}: parsed thin "
                     f"(cands {len(dist['cands'])}, formal {dist['formal']}, enrolled {dist['enrolled']})")
        n_booths = sum(len(x["booths"]) for x in d["districts"])
        n_named = sum(1 for x in d["districts"] for b in x["booths"]
                      if not MOBILE_VENUE_RE.match(b["name"]) and not EVC_VENUE_RE.search(b["name"])
                      and not PSEUDO_VENUE_RE.match(b["name"]) and b["name"].strip())
        print(f"  parsed ok: {n_booths} booth rows ({n_named} named-venue)")
    d12 = os.path.join(SFS, "2012")
    for fn in ("2012_la_general_election.pdf", "2012-official-summary.txt",
               "psephos-nt2012.txt"):
        p = os.path.join(d12, fn)
        if not os.path.exists(p) or os.path.getsize(p) < 10000:
            fail(f"missing/thin 2012 mirror file {p}")
    past = nt_parse.load_frame_year(2012)
    if len(past["districts"]) != 25:
        fail(f"2012 parse: {len(past['districts'])} divisions, want 25")
    print(f"2012 past-lane mirror: 25 divisions (psephos + official summary crossed)")


# ---------------------------------------------------------------- boundaries
def norm_sed_name(n):
    """SED 'Stuart (NT)' -> 'Stuart'; NTEC writes bare names."""
    return re.sub(r"\s*\(NT\)\s*$", "", (n or "").strip())


def fetch_geo(frame):
    """2 — SED edition per frame into machine-local n-nt<yy>.geojson."""
    year = FRAMES[frame]
    out = os.path.join(SRCN, f"n-{frame}.geojson")
    if os.path.exists(out) and not FETCH:
        print(f"n-{frame}.geojson present")
        return
    if not FETCH:
        print(f"n-{frame}.geojson missing (run with --fetch)")
        return
    roster = {norm_key(x) for x in mirror_divisions(year)}
    raw = json.loads(get(SED_URL.format(folder=SED_FOLDER[frame])))
    feats = []
    for f in raw["features"]:
        props = f.get("properties") or {}
        codef = next((k for k in props if "CODE" in k.upper()), None)
        namef = next((k for k in props if "name" in k.lower() and not k.upper().startswith("ST")), None)
        if not codef or not namef:
            fail(f"{SED_FOLDER[frame]} SED: property keys drifted {sorted(props)[:6]}")
        nm = norm_sed_name(props.get(namef))
        if not str(props.get(codef, "")).startswith("7"):
            continue
        if norm_key(nm) not in roster:
            continue
        f["properties"] = {"name": nm}
        feats.append(f)
    names = [norm_sed_name((f["properties"] or {}).get("name")) for f in feats]
    if len(set(names)) != len(names):
        fail(f"{SED_FOLDER[frame]} SED: duplicate normalised names {sorted(names)}")
    missing = [x for x in roster if x not in {norm_key(n) for n in names}]
    if missing:
        fail(f"{SED_FOLDER[frame]} SED missing divisions: {sorted(missing)[:6]}")
    json.dump({"type": "FeatureCollection", "features": feats}, open(out, "w"))
    print(f"n-{frame}.geojson: {len(feats)} features ({SED_FOLDER[frame]} SED)")


# ---------------------------------------------------------------- venue geo
def fetch_loc_centroids(frame):
    """ABS locality centroid per suburb/locality name, NT rows (computed
    from the polygons the services return; returnCentroidOnly is ignored
    by these layers)."""
    import wa_geo  # noqa: E402 (same directory)
    out = {}
    for folder, svc, namef, codef in LOC_SOURCES[frame]:
        raw = json.loads(get(LOC_URL.format(folder=folder, svc=svc, codef=codef)))
        n_nt = 0
        for f in raw.get("features", []):
            props = f.get("properties") or {}
            nm = props.get(namef)
            code = str(props.get(codef, ""))
            if not (nm and code.startswith("7")):
                continue
            geom = f.get("geometry") or {}
            outer = []
            if geom.get("type") == "Polygon":
                outer = [geom["coordinates"][0]] if geom.get("coordinates") else []
            elif geom.get("type") == "MultiPolygon":
                outer = [poly[0] for poly in geom.get("coordinates") or [] if poly]
            if not outer:
                continue
            best, best_a = None, -1.0
            for ring in outer:
                a, c = wa_geo.ring_area_centroid([(float(x), float(y)) for x, y, *_ in ring])
                if abs(a) > best_a:
                    best_a, best = abs(a), c
            if best is None:
                continue
            # suffixes follow the SED product's own " (State)" convention —
            # "Larapinta (NT)" keys as LARAPINTA
            nm_clean = norm_sed_name(nm)
            out.setdefault(norm_key(nm_clean), (best[1], best[0]))  # [lat, lon]
            n_nt += 1
        if n_nt < 50:
            fail(f"{frame} {folder}/{svc}: only {n_nt} NT localities — service drift?")
        print(f"  {frame} {svc}: {n_nt} NT localities")
    return out


def collect_venues():
    """Scan the mirror for venue rows: {(frame, division, venue)} split
    named / EVC / mobile+pseudo."""
    import nt_parse
    named, evcs = {}, {}
    for frame, year in FRAMES.items():
        d = nt_parse.load_frame_year(year)
        for dist in d["districts"]:
            for b in dist["booths"]:
                v = re.sub(r"\s*\*\s*$", "", b["name"]).strip()
                if not v:
                    continue
                if PSEUDO_VENUE_RE.match(v) or MOBILE_VENUE_RE.match(v):
                    continue
                if EVC_VENUE_RE.search(v):
                    evcs[v] = None
                    continue
                named[(frame, dist["name"], v)] = None
    return named, evcs


def fetch_pp():
    """3 — geocode named venues to locality centroids + the hand-resolved
    EVC rooms, writing pp-nt.json. Idempotent; --fetch only rewrites rows
    a provenance change would move."""
    out_path = os.path.join(SRCN, "pp-nt.json")
    if os.path.exists(out_path) and not FETCH:
        print("pp-nt.json present")
        return
    if not FETCH:
        print("pp-nt.json missing (run with --fetch)")
        return
    named, evcs = collect_venues()
    rows = {}
    unmatched = []
    unlocated_evc = []
    import nt_parse  # noqa: E402 (after the sys.path insert in main)
    locs_by_frame = {fr: fetch_loc_centroids(fr) for fr in FRAMES}
    for frame in FRAMES:
        locs = locs_by_frame[frame]
        for (fr, dist, v) in sorted((k for k in named if k[0] == frame)):
            vkey = VENUE_ALIASES.get(norm_key(v), norm_key(v))
            loc = locs.get(vkey)
            if loc is None and norm_key(v) in LOCALITY_OVERRIDES:
                ov = LOCALITY_OVERRIDES[norm_key(v)]
                loc = (ov[0], ov[1])
            if loc is None:
                unmatched.append((fr, dist, v))
                continue
            rows[f"{fr}|{dist}|{v}"] = [round(loc[0], 5), round(loc[1], 5), 1]
    # EVC rows ride their frame+division; a venue appears in as many pairs
    # as it was used in. Where EVC_GEO hasn't pinned the room yet, the
    # EVC's named suburb can still anchor it (documented approximation).
    for frame, year in FRAMES.items():
        d = nt_parse.load_frame_year(year)
        locs = locs_by_frame[frame]
        for dist in d["districts"]:
            for b in dist["booths"]:
                v = re.sub(r"\s*\*\s*$", "", b["name"]).strip()
                if not v:
                    continue
                if EVC_VENUE_RE.search(v):
                    geo = EVC_GEO.get(v)
                    if geo:
                        rows[f"{frame}|{dist['name']}|{v}"] = [geo[0], geo[1], 5]
                        continue
                    sub = norm_key(re.sub(r"\s+EVC\s*$", "", v, flags=re.I))
                    sub = VENUE_ALIASES.get(sub, sub)
                    loc = locs.get(sub)
                    if loc:
                        rows[f"{frame}|{dist['name']}|{v}"] = [round(loc[0], 5), round(loc[1], 5), 5]
                        continue
                    unlocated_evc.append((frame, dist["name"], v))
    json.dump(rows, open(out_path, "w"), indent=0, sort_keys=True)
    print(f"pp-nt.json: {len(rows)} located venue rows "
          f"({len(unmatched)} named venues unmatched, {len(unlocated_evc)} EVCs unlocated)")
    for fr, dist, v in unmatched[:30]:
        print(f"   unmatched {fr} {dist}: {v!r}")
    for fr, dist, v in unlocated_evc[:20]:
        print(f"   unlocated EVC {fr} {dist}: {v!r}")


def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(SRCN, exist_ok=True)
    check_results()
    for frame in FRAMES:
        fetch_geo(frame)
    fetch_pp()


if __name__ == "__main__":
    main()
