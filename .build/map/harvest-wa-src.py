#!/usr/bin/env python3
"""harvest-wa-src.py — fill the Western Australia /map/ frame source mirrors.

The /map/ WA frames (wa17, wa21, wa25) read four kinds of sources. This
script assembles the pieces the existing flow mirror does not already
carry:

  1. RESULTS — already mirrored by the state-flows machinery at
     .build/state-flow-src/wa/sg{2017,2021,2025}/<CODE>.json (the WAEC EIS
     results-API payloads, one per district: candidates, booth rows, district
     2CP, full distribution). Committed by .build/harvest-wa-state-flows.py.
     This script only VERIFIES the mirror's presence and shape (59 district
     files per election, the tables the emitter reads, non-empty booth
     lane), like harvest-qld-src's case 3 — a missing mirror fails at
     harvest time, not mid-build.

  2. BOUNDARIES — one electoral-boundary set per election (WA redistributes
     before every election; the eras are the 2015, 2019 and 2023
     redistributions). The ABS serves each gazettal as its "State Electoral
     Divisions" Non-ABS structure, edition-matched:
       wa17 ← ASGS2017/SED   (2015 gazettal; EIS name-set verified)
       wa21 ← ASGS2021/SED   (2019 gazettal)
       wa25 ← ASGS2025/SED   (2023 gazettal; Landgate LGATE-069 current is
                                the same set — crosscheck oracle only)
     Exported as anonymous ArcGIS GeoJSON (outSR=4326) into
       .build/map/src/wa/n-wa17.geojson etc. — MACHINE-LOCAL, like the
     federal n-YYYY.geojson era files and n-sa26.geojson — never committed.
     Names carry a " (Region)" suffix in the SED product; this script
     normalises them to the bare ALL-CAPS district name EIS uses ("Albany"
     → ALBANY), the shape geo_build's key() join consumes.

  3. VENUE REGISTERS (polling-place coordinates — the EIS API carries no
     venue geometry for declared elections):
       pp-2017.xlsx   data.wa.gov.au "2017 WA State Government Election
                      Polling Places" XLSX (1,016 venues, lat/long), official
       pp-2021.xlsx   The Tally Room's WA-2021-Pollingplaces.xlsx
       pp-2025.xlsx   The Tally Room's WA-2025-Pollingplaces.xlsx
     The Tally Room files are Ben Raue's geolocated registers harvested off
     his public Google Drive folders (uc?export=download). If Drive serves
     the sign-in interstitial instead, re-run later; a missing register is a
     WARNING not a failure — the 17/25 registers name-join much of 2021's
     venues and unlocated booths simply draw no dot (the app's contract).

  4. 2025 per-venue two-candidate-preferred:
       tcp-2025.xlsx  The Tally Room's WA-2025-LA-2CP-PollingPlace.xlsx — the
     per-venue 2CP the 2017/2021 frames could not have (their eras publish
     2CP at district level only; their booth tcp field stays null, the qld17
     precedent).

  5. ELECTION-LEVEL EIS payloads the per-district mirror does not carry
     (map-local extras, committed next to this script's siblings):
       sgYYYY-root.json        /api/sgElections/sgYYYY — variables, the
                               LACountProgress cards (enrolled/counted
                               oracles), the electorate roster with
                               Lat/Long/Zoom (district label-point source)
       sgYYYY-candidates.json  /api/sgElections/sgYYYY/LACandidateParty —
                               the candidate roster with LONG party names
                               ("Australian Christians") and full candidate
                               names ("ANDERSON, Rose") that the mirror's
                               district files abbreviate.

usage: python3 -I .build/map/harvest-wa-src.py [--fetch]
"""
import json, os, sys, urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "wa")
SRCW = os.path.join(REPO, ".build", "map", "src", "wa")
FETCH = "--fetch" in sys.argv

YEARS = (2017, 2021, 2025)
SED_FOLDER = {2017: "ASGS2017", 2021: "ASGS2021", 2025: "ASGS2025"}
SED_URL = (
    "https://geo.abs.gov.au/arcgis/rest/services/{folder}/SED/MapServer/0/query"
    "?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson"
)
PP17_URL = ("https://catalogue.data.wa.gov.au/dataset/918324db-277a-448f-91c7-9da7fe2fe61b/"
            "resource/60434d6f-7c98-4c6f-b812-65ed31e1c872/download/"
            "sge-2017-proposed-ordinary-and-mobile-polling-places-as-at-161206.xlsx")
DRIVE = "https://drive.google.com/uc?export=download&id={id}"
DRIVE_FILES = {
    "pp-2021.xlsx": None,  # resolved at fetch time from the folder listing
    "pp-2025.xlsx": "1Tp1EMVoD0QfdGGZ2F7CtRvf8RPEMaXTn",
    "tcp-2025.xlsx": "1N-gi264BSNhgBnUbrpTbNovO24-H5rk9",
}
DRIVE_FOLDER_2021 = "1xPky1HfGZEcQpDinv1lglFifkDgSg9bV"
UA = {"User-Agent": "auspol-tracker wa map-frame source harvest"}
EIS = "https://eis.waec.wa.gov.au/api/sgElections"


def fail(msg):
    raise SystemExit(f"harvest-wa-src: {msg}")


def fetch_eis_extras():
    """5 — election-level JSON into .build/map/src/wa/ (committed, small).
    Years beyond the three frames are the past lanes' sources: sg2013 is
    wa17's previous election."""
    for y in (2013,) + YEARS:
        for name, tail in ((f"sg{y}-root.json", f"sg{y}"),
                           (f"sg{y}-candidates.json", f"sg{y}/LACandidateParty")):
            out = os.path.join(SRCW, name)
            if os.path.exists(out) and not FETCH:
                print(f"{name} present"); continue
            if not FETCH:
                print(f"{name} missing (run with --fetch)"); continue
            d = json.loads(get(f"{EIS}/{tail}").lstrip("﻿"))
            if "root" in name:
                if not d.get("LACountProgress", {}).get("Number_Electors"):
                    fail(f"{name}: no Number_Electors on the count card")
                if len(d.get("electorates") or []) < 60:
                    fail(f"{name}: electorate roster thin ({len(d.get('electorates') or [])})")
            else:
                if len(d.get("LACandidateParty") or []) < 150:
                    fail(f"{name}: candidate roster thin")
            json.dump(d, open(out, "w"))
            print(f"{name}: fetched")


def get(url, binary=False, timeout=180):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def check_results():
    """1 — the flow mirror must already carry all three elections."""
    for y in YEARS:
        dd = os.path.join(SFS, f"sg{y}")
        if not os.path.isdir(dd):
            fail(f"missing flow mirror {dd} — run .build/harvest-wa-state-flows.py")
        files = [f for f in os.listdir(dd) if f.endswith(".json")]
        if len(files) < 59:
            fail(f"{dd}: only {len(files)} district files (want 59)")
        probes = ["ALB", "VDM", "KIM"]  # metro, country, remote — any three real codes
        probe = next(p for p in probes if f"{p}.json" in files)
        d = json.load(open(os.path.join(dd, f"{probe}.json")))
        for tab in ("resultsCandidates", "results2CP", "resultsFullDistribution",
                    "resultsPollingPlace", "toptotals", "currentElectorate"):
            if tab not in d:
                fail(f"{dd}/{probe}.json: no {tab} table")
        if not (d.get("resultsPollingPlace")):
            fail(f"{dd}/{probe}.json: empty booth lane")
        if len(d["results2CP"] or []) != 2:
            fail(f"{dd}/{probe}.json: results2CP not a pair ({len(d.get('results2CP') or [])})")
        named = [r for r in d["resultsPollingPlace"] if r.get("BREAKDOWN_GROUP") == "Polling Places"]
        if not named:
            fail(f"{dd}/{probe}.json: no real venues in booth lane")
        print(f"sg{y}: {len(files)} district files, booth lane verified on {probe}")


def norm_wa_name(n):
    """SED 'Albany (South West)' -> 'ALBANY'; EIS writes bare names."""
    n = n.split(" (")[0].strip()
    return n.upper()


def eis_roster(y):
    """The election's District names from the committed flow mirror — the
    gate the SED export is filtered against (ABS editions carry extra
    5-prefixed rows: 'No SED'-style pseudo features)."""
    dd = os.path.join(SFS, f"sg{y}")
    anyf = os.path.join(dd, "ALB.json")
    d = json.load(open(anyf))
    out = []
    for e in d["electorates"]:
        if e.get("ElelctorateType") == "District":  # sic — schema typo
            out.append(e["ElectorateName"].upper())
    if len(out) != 59:
        fail(f"sg{y}: EIS roster has {len(out)} districts (want 59)")
    return out


def fetch_geo():
    """2 — SED edition per election into machine-local n-wa<yy>.geojson."""
    kept_any = False
    for y in YEARS:
        out = os.path.join(SRCW, f"n-wa{str(y)[2:]}.geojson")
        if os.path.exists(out) and not FETCH:
            print(f"n-wa{str(y)[2:]}.geojson present"); continue
        kept_any = True
        roster = eis_roster(y)
        raw = json.loads(get(SED_URL.format(folder=SED_FOLDER[y])))
        codef = next(k for k in raw["features"][0]["properties"] if "CODE" in k.upper())
        namef = next(k for k in raw["features"][0]["properties"]
                     if "name" in k.lower() and not k.startswith("ST"))
        feats = [f for f in raw["features"]
                 if str(f["properties"].get(codef, "")).startswith("5")
                 and norm_wa_name(f["properties"][namef]) in roster]
        names = [norm_wa_name(f["properties"][namef]) for f in feats]
        if len(set(names)) != len(names):
            fail(f"{SED_FOLDER[y]} SED: duplicate normalised district names")
        missing = [n for n in roster if n not in names]
        extra = [n for n in names if n not in roster]
        if missing:
            fail(f"{SED_FOLDER[y]} SED missing districts: {missing[:5]}")
        if extra:
            fail(f"{SED_FOLDER[y]} SED: unrostered districts slipped through: {extra[:5]}")
        for f in feats:
            f["properties"]["name"] = norm_wa_name(f["properties"][namef])
        json.dump({"type": "FeatureCollection", "features": feats}, open(out, "w"))
        print(f"n-wa{str(y)[2:]}.geojson: {len(feats)} features ({SED_FOLDER[y]} SED)")
    if not kept_any and FETCH:
        print("geojson rebuild was already fresh")


def fetch_xlsx(name, url, warn_only=True):
    out = os.path.join(SRCW, name)
    if os.path.exists(out) and not FETCH:
        print(f"{name} present"); return True
    if not FETCH:
        print(f"{name} missing (run with --fetch)"); return False
    try:
        blob = get(url, binary=True)
    except Exception as e:
        (fail if not warn_only else print)(f"{name}: fetch failed — {e}" if warn_only else f"{name}: {e}")
        return False
    if not blob[:2] == b"PK":
        print(f"{name}: not an xlsx (Drive interstitial?) — {len(blob)} bytes; left unfetched")
        return False
    with open(out, "wb") as f:
        f.write(blob)
    print(f"{name}: {len(blob)//1024} KiB")
    return True


def resolve_2021_drive_id():
    """The Tally Room WA-2021 folder -> file ids (Drive sign-in interstitials
    come and go; a failure here downgrades pp-2021 to a bootstrap warning)."""
    url = f"https://drive.google.com/drive/folders/{DRIVE_FOLDER_2021}"
    try:
        h = get(url)
    except Exception as e:
        print(f"WA-2021 folder listing failed: {e}")
        return None
    import re
    for m in re.finditer(r"aria-label=\"(WA-2021-Pollingplaces[^\"]*?\.xlsx)[^\"]*\"[^>]*ssk='5:[^']{1,9}:([\w-]{25,60})'", h):
        return m.group(2).split("-0-")[0]
    return None


def validate_xlsx():
    try:
        import openpyxl
    except ImportError:
        print("openpyxl not installed — xlsx registers left unvalidated")
        return
    want = {
        "pp-2017.xlsx": ("Latitude", "Longitude"),
        "pp-2021.xlsx": ("latitude", "longitude"),
        "pp-2025.xlsx": ("latitude", "longitude"),
        "tcp-2025.xlsx": ("district_name",),
    }
    for fn, cols in want.items():
        path = os.path.join(SRCW, fn)
        if not os.path.exists(path):
            continue
        ws = openpyxl.load_workbook(path, read_only=True).active
        head = [str(c).lower() if c is not None else "" for c in next(ws.iter_rows(values_only=True, max_row=1))]
        for c in cols:
            if c.lower() not in [h.strip() for h in head]:
                print(f"{fn}: no column {c!r} in header {head[:12]}"); break
        else:
            print(f"{fn}: header ok, ~{ws.max_row} rows")


def main():
    os.makedirs(SRCW, exist_ok=True)
    check_results()
    fetch_geo()
    fetch_eis_extras()
    fetch_xlsx("pp-2017.xlsx", PP17_URL)
    fetch_xlsx("pp-2025.xlsx", DRIVE.format(id=DRIVE_FILES["pp-2025.xlsx"]))
    fetch_xlsx("tcp-2025.xlsx", DRIVE.format(id=DRIVE_FILES["tcp-2025.xlsx"]))
    pp21_id = resolve_2021_drive_id() if FETCH or not os.path.exists(
        os.path.join(SRCW, "pp-2021.xlsx")) else None
    if pp21_id:
        DRIVE_FILES["pp-2021.xlsx"] = pp21_id
    if pp21_id or os.path.exists(os.path.join(SRCW, "pp-2021.xlsx")):
        fetch_xlsx("pp-2021.xlsx", DRIVE.format(id=DRIVE_FILES["pp-2021.xlsx"] or pp21_id))
    elif FETCH:
        print("pp-2021.xlsx: WA-2021 folder listing walled this run — name-join "
              "against pp-2017/pp-2025 covers most of it; unlocated booths draw no dot")
    validate_xlsx()


if __name__ == "__main__":
    main()
