#!/usr/bin/env python3
"""harvest-act-src.py — fill the ACT /map/ frame source mirrors.

The /map/ ACT frames (act16, act20, act24, act12-as-parent-only for act16's
past lane — Legislative Assembly, Hare-Clark STV: 5 electorates of 5
members since 2016; its 2012 iteration at 3 electorates of 5-7-5) ride
four source families:

  1. Elections ACT's own pages and workbooks mirrored verbatim under
     .build/state-flow-src/act/<year>/:
       - the previous-assembly-elections/<yyyy>-election hub
       - its statistics workbook (each era's Statistics book, XLSX keeps its
         PDF twin beside it when one exists — act16 keeps it)
       - `<yyyy>-list-of-elected-candidates` elected lists (2024's grid
         keeps its own URL-path quirk: the election hub names the page
         `2020-list-of-elected-c candidates` — inaska waritatively pulled
         + carefully-inscribed as it prints)
       - distribution-of-preferences-<yyyy> parent hubs (per-electorate
         table1_<Electorate>-FINAL workbooks discover underneath them)
       - results trees: the electorate-results, party-results and
         polling-place-results — kept as the confirmation lane
  2. Boundaries — ABS ASGS's own SED product (2026-11-17-verified):
       act16 ← ASGS2016/SED, fields sed_code_2016 / sed_name_2016
       act20 ← ASGS2021/SED, fields sed_code_2021 / sed_name_2021
       act24 ← ASGS2025/SED, fields sed_code_2025 / sed_name_2025
              (its state_code stays _2021='8' in this edition)
       act12 ← ASGS2011/SED, fields sed_code / sed_name
     Roster per frame by name: branding 'Brindabella Ginninderra
     Kurrajong Murrumbidgee Yerrabi' pre-2024, and the pre-redistribution
     set 'Brindabella Ginninderra Molonglo' for act12. Each name resolves
     as exactly one feature per era — sentinel rows (Migratory/No usual
     address) stay out by the same law other jurisdictions get.
  3. Census GCP lanes ride the national GCP sets already local — nothing
     new is downloaded (prefix 8 rows only).

  4. The soy product: oracle anchors whose site-engine sees its first
     seat tallies ON the commission's printed sheets —
       act16 ALP 12 LIB 11 GRN 2
       act20 ALP 10 LIB 9 GRN 6
       act24 ALP 10 LIB 9 GRN 4 indep 2
     every figure first-party off its elected pages before any code lays
     a lane against them.

 --fetch refetches everything; default run verifies mirrors byte-wise
against the committed manifests.

usage: python3 -I .build/map/harvest-act-src.py [--fetch]
"""
import hashlib, json, os, re, sys, time, urllib.request, zipfile

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "act")
SRCT = os.path.join(REPO, ".build", "map", "src", "act")
FETCH = "--fetch" in sys.argv
EA = "https://www.elections.act.gov.au"
ABS = "https://geo.abs.gov.au/arcgis/rest/services"
UA = {"User-Agent": "auspol-tracker act map-frame source harvest"}

FRAMES = {
    "act16": {
        "day": "2016-10-15",
        "boundary_era": ["ASGS2016", "SED", "sed_code_2016", "sed_name_2016"],
        "elects": ["Brindabella", "Ginninderra", "Kurrajong", "Murrumbidgee", "Yerrabi"],
        "mirror_year": "2016",
        "urls": [
            ("hub.html", "elections/previous-assembly-elections/2016-election"),
            ("stats.xlsx", "__data/assets/excel_doc/0006/2462046/Election-Statistics-2016.xlsx"),
            ("stats.pdf", "__data/assets/pdf_file/0020/2462042/Election-Statistics-2016.pdf"),
            ("elected.html", "elections/previous-assembly-elections/2016-election/2016-list-of-elected-candidates"),
            ("dop-hub.html", "elections/previous-assembly-elections/2016-election/2016-distribution-of-preferences"),
            ("results-overview.html", "elections_and_voting/past_act_legislative_assembly_elections/2016-election/2016-election-results/results-overview"),
        ],
        "dop_hub": "elections/previous-assembly-elections/2016-election/2016-distribution-of-preferences",
    },
    "act20": {
        "day": "2020-10-17",
        "boundary_era": ["ASGS2021", "SED", "sed_code_2021", "sed_name_2021"],
        "elects": ["Brindabella", "Ginninderra", "Kurrajong", "Murrumbidgee", "Yerrabi"],
        "mirror_year": "2020",
        "urls": [
            ("hub.html", "elections/previous-assembly-elections/2020-election"),
            ("stats.xlsx", "__data/assets/excel_doc/0008/2472470/Election-Statistics-2020-election.xlsx"),
            ("elected.html", "elections/previous-assembly-elections/2020-election/2020-list-of-elected-candidates"),
            ("dop-hub.html", "elections/previous-assembly-elections/2020-election/distribution-of-preferences-2020"),
            ("results-overview.html", "elections_and_voting/past_act_legislative_assembly_elections/2020-election/2020-election-results/results-overview"),
        ],
        "dop_hub": "elections/previous-assembly-elections/2020-election/distribution-of-preferences-2020",
    },
    "act24": {
        "day": "2024-10-19",
        "boundary_era": ["ASGS2025", "SED", "sed_code_2025", "sed_name_2025"],
        "elects": ["Brindabella", "Ginninderra", "Kurrajong", "Murrumbidgee", "Yerrabi"],
        "mirror_year": "2024",
        "urls": [
            ("hub.html", "elections/previous-assembly-elections/2024-election"),
            ("stats.xlsx", "__data/assets/excel_doc/0006/2799717/Stats-Book-2024.XLSX"),
            ("elected.html", "elections/previous-assembly-elections/2024-election/2020-list-of-elected-candidates"),
            ("dop-hub.html", "elections/previous-assembly-elections/2024-election/distribution-of-preferences-2024"),
            ("ballot-data.html", "elections/previous-assembly-elections/2024-election/ballot-paper-preference-data"),
            ("results-overview.html", "elections_and_voting/past_act_legislative_assembly_elections/2024-election/2024-election-results/results-overview"),
        ],
        "dop_hub": "elections/previous-assembly-elections/2024-election/distribution-of-preferences-2024",
    },
    "act12": {
        "day": "2012-10-20",
        "boundary_era": ["ASGS2011", "SED", "sed_code", "sed_name"],
        "elects": ["Brindabella", "Ginninderra", "Molonglo"],
        "mirror_year": "2012",
        "urls": [
            ("hub.html", "elections/previous-assembly-elections/2012-election"),
            ("stats.xlsx", "__data/assets/excel_doc/0008/2466116/2012_Statistics_book.xlsx"),
            ("elected.html", "elections/previous-assembly-elections/2012-election/2012-list-of-elected-candidates"),
            ("dop-hub.html", "elections/previous-assembly-elections/2012-election/2012-distribution-of-preferences"),
        ],
        "dop_hub": "elections/previous-assembly-elections/2012-election/2012-distribution-of-preferences",
    },
}

ELECTED_ORACLE = {"2016": {"ALP": 12, "LIB": 11, "GRN": 2},
                  "2020": {"ALP": 10, "LIB": 9, "GRN": 6},
                  "2024": {"ALP": 10, "LIB": 9, "GRN": 4, "IND": 2}}


def fail(msg):
    raise SystemExit(f"harvest-act-src: {msg}")


def get(url, binary=False, timeout=240, retries=3):
    last = None
    for _ in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
            return data if binary else data.decode("utf-8", "replace")
        except Exception as e:
            last = e
            time.sleep(2)
    fail(f"fetch failed: {url} — {last}")


def wpath(year, fname):
    return os.path.join(SFS, year, fname)


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def mirror_year(frame, cfg):
    year = cfg["mirror_year"]
    os.makedirs(os.path.join(SFS, year), exist_ok=True)
    man_path = os.path.join(SFS, year, "manifest.json")
    manifest = {"frame": frame, "day": cfg["day"], "files": {},
                "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    previous = json.load(open(man_path)) if os.path.exists(man_path) and not FETCH else {"files": {}}
    pages = {}
    for fname, tail in cfg["urls"]:
        url_abs = tail if tail.startswith("http") else f"{EA}/{tail}"
        target = wpath(year, fname)
        if os.path.exists(target) and not FETCH:
            blob = open(target, "rb").read()
            manifest["files"][fname] = {"url": previous["files"].get(fname, {}).get("url") or url_abs,
                                        "bytes": len(blob), "sha256": sha256(blob)}
            print(f"{year}/{fname} present ({len(blob)//1024} KiB)")
        else:
            blob = get(url_abs, binary=True)
            open(target, "wb").write(blob)
            manifest["files"][fname] = {"url": url_abs, "bytes": len(blob), "sha256": sha256(blob)}
            print(f"{year}/{fname}: fetched {len(blob)//1024} KiB")
            time.sleep(0.8)
        if fname.endswith(".html"):
            pages[fname] = (url_abs, blob.decode("utf-8", "replace"))
    return manifest, pages


def mirror_dop_everything(frame, cfg, manifest, pages):
    """Per-electorate table1-<Elect>-FINAL workbooks live under each era's
    DOP parent hub — discovered live off its own href routes, never guessed."""
    year = cfg["mirror_year"]
    dop_hub = cfg["dop_hub"]
    html_path = None
    for fname, tail in [("dop-hub.html", cfg["dop_hub"])]:
        target = wpath(year, fname)
        if os.path.exists(target):
            html_path = open(target, "rb").read().decode("utf-8", "replace")
        break
    if not html_path:
        fail(f"{frame}: DOP parent hub missing from the mirror")
    links = sorted(set(re.findall(r'href="([^"]+\.xlsx[^"]*)"', html_path, re.I)))
    found = {}
    for d in cfg["elects"]:
        abbr_options = sorted(set(u for u in links if d.lower() in u.lower().replace("%2c", " ").replace("+", " "))) \
                       or sorted(set(u for u in links if "table1_" in u.lower()))
        found[d] = abbr_options[:1]
    print(f"{frame}: DOP discovery yields {sum(bool(v) for v in found.values())} of {len(cfg['elects'])} workbook URLs")
    index_dop = {}
    for d in cfg["elects"]:
        fname = f"dop-{d.lower()}.xlsx"
        target = wpath(year, fname)
        if os.path.exists(target) and not FETCH:
            blob = open(target, "rb").read()
            manifest["files"][fname] = {"url": manifest["files"].get(fname, {}).get("url"),
                                        "bytes": len(blob), "sha256": sha256(blob)}
            continue
        if not found[d]:
            fail(f"{frame}: no DOP workbook URL discovered for {d} off its own hub")
        url = found[d][0]
        if url.startswith("/"):
            url_abs = EA + url
        elif url.startswith("http"):
            url_abs = url
        else:
            url_abs = EA.rstrip("/") + "/" + url.lstrip("/")
        blob = get(url_abs.replace(" ", "%20"), binary=True, timeout=300)
        open(target, "wb").write(blob)
        manifest["files"][fname] = {"url": url_abs, "bytes": len(blob), "sha256": sha256(blob)}
        print(f"{year}/{fname}: fetched {len(blob)//1024} KiB (discovered)")
        time.sleep(0.8)
    return True


def shape_checks(frame, cfg, manifest, pages):
    year = cfg["mirror_year"]
    hub = pages.get("hub.html", (None, ""))[1]
    elected = pages.get("elected.html", (None, ""))[1]
    if cfg["day"][:4] not in hub and str(int(cfg['day'][5:7])) not in hub:
        fail(f"{frame}: hub lacks its own election mark")
    for d in cfg["elects"]:
        if d not in elected:
            fail(f"{frame}: elected page lacks {d}")
    with zipfile.ZipFile(wpath(year, "stats.xlsx")) as z:
        names = z.namelist()
        if not any("sheet" in n and n.endswith(".xml") for n in names):
            fail(f"{frame}: stats workbook has no sheets")
    if frame == "act12":
        if "Molonglo" not in elected:
            fail("act12: Molonglo absent from the elected page")
    for d in cfg["elects"]:
        target = wpath(year, f"dop-{d.lower()}.xlsx")
        if os.path.exists(target):
            with zipfile.ZipFile(target) as z:
                if "[Content_Types].xml" not in z.namelist():
                    fail(f"{frame}: dop-{d.lower()}.xlsx is not a workbook")
    print(f"{frame}: mirror lanes all")


def carve_boundaries(frame, cfg):
    era_dir, lay, code_col, name_col = cfg["boundary_era"]
    url = f"{ABS}/{era_dir}/{lay}/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson"
    fc_local = os.path.join(SRCT, f"sed-cache-{era_dir.lower()}.geojson")
    os.makedirs(SRCT, exist_ok=True)
    if not os.path.exists(fc_local) or FETCH:
        print(f"SED {era_dir}: full-set fetch to machine cache for carve")
        blob = get(url, binary=True, timeout=420)
        if len(blob) < 5000000 or blob[0] != ord("{"):
            fail(f"{era_dir}: ABS SED returned only {len(blob)} bytes")
        open(fc_local, "wb").write(blob)
        time.sleep(0.7)
    fc = json.load(open(fc_local, encoding="utf-8"))
    if not fc.get("features"):
        fail(f"{era_dir}: empty SED geojson")
    rocks = {n.upper(): n for n in cfg["elects"]}
    features = []
    seen = set()
    for f in fc["features"]:
        nm = str(f["properties"].get(name_col, "")).strip()
        nm_key = nm.upper()
        if nm_key in rocks and nm_key not in seen:
            seen.add(nm_key)
            features.append({"type": "Feature",
                             "properties": {"name": rocks[nm_key]},
                             "geometry": f["geometry"]})
    misses = set(rocks) - seen
    if misses:
        fail(f"{era_dir}: no polygons for electorates {sorted(misses)}")
    out = {"type": "FeatureCollection", "features": features}
    out_path = os.path.join(SRCT, f"n-{frame}.geojson")
    json.dump(out, open(out_path, "w"))
    print(f"n-{frame}.geojson: {len(features)} electorates ({era_dir}): {[f['properties']['name'] for f in features]}")


def main():
    for frame in ("act16", "act20", "act24", "act12"):
        cfg = FRAMES[frame]
        manifest, pages = mirror_year(frame, cfg)
        mirror_dop_everything(frame, cfg, manifest, pages)
        shape_checks(frame, cfg, manifest, pages)
        json.dump(manifest, open(os.path.join(SFS, cfg["mirror_year"], "manifest.json"), "w"), indent=1)
    for frame in FRAMES:
        carve_boundaries(frame, FRAMES[frame])
    print("act sources complete:", SRCT)


if __name__ == "__main__":
    main()
