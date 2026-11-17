#!/usr/bin/env python3
"""harvest-tas-src.py — fill the Tasmania /map/ frame source mirrors.

The /map/ Tas frames (tas14, tas18, tas21, tas24, tas25 — House of
Assembly, Hare-Clark, 5 members per division through 2021, 7 members
from 2024) read four kinds of sources:

  1. RESULTS MIRRORS — first-party TEC pages and files under
     .build/state-flow-src/tas/<year>/ (committed). Several URL-era
     shapes exist side by side:
       tas14 (15 Mar 2014)  Static-era tree: Results/Results_<Div>.html
                            per division plus root-level
                            PollingplaceList<DIV>.html venue lists
       tas18 (3 Mar 2018)   Results/<Div>/index.html per division —
                            the division name is *Denison* still: TEC's
                            2018 pages print Denison 9×/Clark 0. The
                            Sep-2017 federal Denison→Clark determination
                            did not apply to the 2018 state election
                            (state law follows federal sets at the next
                            state general election after gazettal here)
       tas21 (1 May 2021)   results/<div>/index.html per division +
                            statewide first-preferences-by-polling-places
                            XLSX + per-division DOP PDF (count number in
                            the filename discovered off each page)
       tas24 (23 Mar 2024)  elections-2024/ shape, first 35-member
                            assembly (7 per division): DOP XLSX+PDF per
                            division, statewide FPP XLSX, elected roster
                            page
       tas25 (19 Jul 2025)  elections-2025/, the July snap (same seven-
                            member shape, ~90 counts a division)
       tas10 (20 Mar 2010)  parent-only past layer for tas14: the old
                            electoral.tas.gov.au tree through Wayback
                            captures (the live TEC links only the
                            2007-10 Blue Book PDF). Pages discovered
                            from the archived hub, roster-gated to the
                            five divisions.

  2. BOUNDARIES — Tas HoA divisions are by law the era's federal
     divisions, so polygons are crops of the AEC's national ESRI zips
     (downloaded to machine-local .matilda/map-tas-dl/; per-frame
     n-tas<yy>.geojson emitted into .build/map/src/tas/, untracked):
       tas14, tas18  national-esri-2010.zip (Denison era — tas18's
                     election ran on the PRE-2017 federal determination,
                     per the state follow-at-next-election rule)
       tas21         national-esri-fe2019.zip (Clark era, the Sep-2017
                     redrawing in force)
       tas24         2021-Cwlth_electoral_boundaries_ESRI.zip (the 2022-
                     federal-era set, in force for the Mar-2024 election
                     under the same rule)
       tas25         AUS-March-2025-esri.zip (in force at the Jul-2025
                     snap)
     Measured 2026-11-17: each era's TAS ring hashes differ from every
     other era's for every division (see the carve's equivalence print),
     so the tas18-vs-tas14 and tas24-vs-tas21 boundary joins are real
     work adjudicated in .build/map/src/tas/past-adjudication.md, not
     name cosmetics. The ABS ASGS SED product is deliberately never used
     for TAS — its TAS layer is the 15-clause Legislative Council set
     (22 "Clark (Derwent)"-style features), not the five HoA divisions.

  3. Venue coordinates and elected rosters: neither is geocoded by the
     commission. Addresses ride the PollingplaceList era pages (tas14 /
     tas18-era) and venue NAMES ride the later XLSX files; dot coords
     are downstream tas_parse/pp-tas.json work (ABS SAL/UCL centroids,
     NT-recipe). The elected roster per division rides each era's own
     pages (Elected/Excluded flags on the division pages ≤2018; the
     results pages and candidates-elected.html from 2021).

  4. Rabbit holes avoided (empirically): Tally Room's Tas datasets and
     the ABS SED 6-prefix rows are not consulted anywhere (Drive consent
     wall; wrong body respectively). No in-build network lanes (GF-1):
     every oracle the emitters assert rides a mirrored first-party
     artifact in this directory.

 --fetch refetches everything; default run verifies mirrors byte-wise
 against the committed manifests.

usage: python3 -I .build/map/harvest-tas-src.py [--fetch]
"""
import hashlib, json, os, re, subprocess, sys, time, urllib.parse, urllib.request, zipfile

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SFS = os.path.join(REPO, ".build", "state-flow-src", "tas")
SRCT = os.path.join(REPO, ".build", "map", "src", "tas")
DL = os.path.join(REPO, ".matilda", "map-tas-dl")
FETCH = "--fetch" in sys.argv
TEC = "https://www.tec.tas.gov.au"
AEC = "https://www.aec.gov.au"
UA = {"User-Agent": "auspol-tracker tas map-frame source harvest"}

FRAMES = {
    "tas14": {
        "day": "2014-03-15", "boundary": "national-esri-2010.zip",
        "divs": ["Bass", "Braddon", "Denison", "Franklin", "Lyons"],
        "mirror_year": "2014",
        "urls": [("hub.html", "house-of-assembly/StateElection2014/index.html")]
            + [("results-index.html", "house-of-assembly/StateElection2014/Results/Results.html")]
            + [(f"results-{d.lower()}.html", f"house-of-assembly/StateElection2014/Results/Results_{d}.html") for d in ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]]
            + [("candidates.html", "house-of-assembly/StateElection2014/Candidates.html")]
            + [(f"candidates-{d.lower()}.html", f"house-of-assembly/StateElection2014/{d}_Candidates.html") for d in ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]]
            # 2014's machine-readable layer beside the image-era pages:
            # per-venue FP PDF and the full Hare-Clark count (scrutiny sheet)
            + [(f"ppfp-{d.lower()}.pdf", f"house-of-assembly/StateElection2014/Results/{d}/2014%20{d}%20first%20preferences%20by%20polling%20place.pdf") for d in ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]]
            + [(f"scrutiny-{d.lower()}.pdf", f"house-of-assembly/StateElection2014/Results/{d}/2014%20{d}%20scrutiny%20event%20sheet.pdf") for d in ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]],
        # the polling-place file now 301s to the current-era ways-to-vote
        # hub — the in-era print survives only in the archive
        "wayback_files": [(f"pollingplaces-{d.lower()}.html",
                           f"house-of-assembly/StateElection2014/PollingplaceList{d.upper()}.html")
                          for d in ["BASS", "BRADDON", "DENISON", "FRANKLIN", "LYONS"]],
    },
    "tas18": {
        "day": "2018-03-03", "boundary": "national-esri-2010.zip",
        "divs": ["Bass", "Braddon", "Denison", "Franklin", "Lyons"],
        "mirror_year": "2018",
        "urls": [("hub.html", "house-of-assembly/StateElection2018/index.html")]
            + [("results-index.html", "house-of-assembly/StateElection2018/Results/Results.html")]
            + [(f"results-{d.lower()}.html", f"house-of-assembly/StateElection2018/Results/{d}/index.html") for d in ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]]
            + [("candidates.html", "house-of-assembly/StateElection2018/Candidates.html")]
            + [(f"candidates-{d.lower()}.html", f"house-of-assembly/StateElection2018/Candidates-{d}.html") for d in ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]]
            # machine layer beside the HTML era print: the per-venue FP
            # workbooks PPs/ live inside Results/, discovered live off the
            # division pages at build-design time (2018-<Div>-first-prefs…)
            + [(f"fppp-{d.lower()}.xlsx", f"house-of-assembly/StateElection2018/Results/PPs/2018-{d}-first-prefs-by-polling-places.xlsx") for d in ["Bass", "Braddon", "Denison", "Franklin", "Lyons"]],
        # 2018's five venue lists are tab panels of ONE PollingPlaceLists
        # page (also gone from live, 301s — archive capture only)
        "wayback_files": [("pollinglists.html", "house-of-assembly/StateElection2018/PollingPlaceLists.html")],
    },
    "tas21": {
        "day": "2021-05-01", "boundary": "national-esri-fe2019.zip",
        "divs": ["Bass", "Braddon", "Clark", "Franklin", "Lyons"],
        "mirror_year": "2021",
        "urls": [("hub.html", "house-of-assembly/StateElection2021/index.html")]
            + [(f"results-{d.lower()}.html", f"house-of-assembly/StateElection2021/results/{d.lower()}/index.html") for d in ["Bass", "Braddon", "Clark", "Franklin", "Lyons"]]
            + [("fp-by-polling-places.xlsx", "house-of-assembly/StateElection2021/results/assets/2021-State-election-first-preferences-by-polling-places.xlsx")]
            + [("candidates-elected.html", "house-of-assembly/StateElection2021/HAElection21CandidatesElected.html")]
            + [(f"candidates-{d.lower()}.html", f"house-of-assembly/StateElection2021/HAElection21Candidates-{d}.html") for d in ["Bass", "Braddon", "Clark", "Franklin", "Lyons"]],
        "discover": [("dop-{div}.pdf", "results-{div}.html",
                      "href=\"(?P<h>[^\"]*H?o?A?-?[^\"]*Export[^\"]*\\.pdf)\"")],
    },
    "tas24": {
        "day": "2024-03-23", "boundary": "2021-Cwlth_electoral_boundaries_ESRI.zip",
        "divs": ["Bass", "Braddon", "Clark", "Franklin", "Lyons"],
        "mirror_year": "2024",
        "urls": [("hub.html", "house-of-assembly/elections-2024/index.html")]
            + [(f"results-{d.lower()}.html", f"house-of-assembly/elections-2024/results/{d.lower()}/index.html") for d in ["Bass", "Braddon", "Clark", "Franklin", "Lyons"]]
            + [("fp-by-polling-places.xlsx", "house-of-assembly/elections-2024/results/pdf/2024-state-election-first-preferences-by-polling-places.xlsx")]
            + [("candidates-elected.html", "house-of-assembly/elections-2024/candidates-elected.html")],
        "discover": [("dop-{div}.xlsx", "results-{div}.html",
                      "href=\"(?P<h>[^\"]*Export[^\"]*\\.xlsx)\""),
                     ("dop-{div}.pdf", "results-{div}.html",
                      "href=\"(?P<h>[^\"]*[Ee]xport[^\"]*\\.pdf)\"")],
    },
    "tas25": {
        "day": "2025-07-19", "boundary": "AUS-March-2025-esri.zip",
        "divs": ["Bass", "Braddon", "Clark", "Franklin", "Lyons"],
        "mirror_year": "2025",
        "urls": [("hub.html", "house-of-assembly/elections-2025/index.html")]
            + [(f"results-{d.lower()}.html", f"house-of-assembly/elections-2025/results/{d.lower()}/index.html") for d in ["Bass", "Braddon", "Clark", "Franklin", "Lyons"]]
            + [("fp-by-polling-places.xlsx", "house-of-assembly/elections-2025/results/downloads/2025-state-election-first-preferences-by-polling-places.xlsx")]
            + [("candidates-elected.html", "house-of-assembly/elections-2025/candidates-elected.html")],
        "discover": [("dop-{div}.xlsx", "results-{div}.html",
                      "href=\"(?P<h>[^\"]*Export Count[^\"]*\\.xlsx)\""),
                     ("dop-{div}.pdf", "results-{div}.html",
                      "href=\"(?P<h>[^\"]*[Ee]xport[^\"]*\\.pdf)\"")],
    },
    "tas10": {
        "day": "2010-03-20", "boundary": "national-esri-2010.zip",
        "divs": ["Bass", "Braddon", "Denison", "Franklin", "Lyons"],
        "mirror_year": "2010", "wayback": True,
    },
}

AEC_ZIPS = {
    "national-esri-2010.zip": "/Electorates/gis/files/national-esri-2010.zip",
    "national-esri-fe2019.zip": "/Electorates/gis/files/national-esri-fe2019.zip",
    "2021-Cwlth_electoral_boundaries_ESRI.zip": "/Electorates/gis/files/2021-Cwlth_electoral_boundaries_ESRI.zip",
    "AUS-March-2025-esri.zip": "/Electorates/files/2025/AUS-March-2025-esri.zip",
}


def fail(msg):
    raise SystemExit(f"harvest-tas-src: {msg}")


def get(url, binary=False, timeout=240, retries=3):
    last = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
            return data if binary else data.decode("utf-8", "replace")
        except Exception as e:
            last = e
            time.sleep([15, 45, 90][i] if i < 3 else 180)
    fail(f"fetch failed permanently: {url} — {last}")


def wpath(year, name):
    return os.path.join(SFS, year, name)


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def mirror_static(frame, cfg):
    """Fetch every (fname, url) into the frame's mirror year + write its
    manifest; verification mode checks committed bytes instead."""
    year = cfg["mirror_year"]
    os.makedirs(os.path.join(SFS, year), exist_ok=True)
    man_path = os.path.join(SFS, year, "manifest.json")
    manifest = {"frame": frame, "day": cfg["day"], "files": {},
                "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    previous = json.load(open(man_path)) if os.path.exists(man_path) and not FETCH else {"files": {}}
    pages = {}
    for fname, url in cfg["urls"]:
        url_abs = url if url.startswith("http") else f"{TEC}/{url.lstrip('/')}"
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

    # archived copies of pages the live server now 301s to the current-era
    # print (Tor poll-place lists, era venue addresses). One requested
    # capture per file; timed per the archive at fetch time.
    for fname, tail in cfg.get("wayback_files", []):
        url_abs = f"{TEC}/{tail.lstrip('/')}"
        target = wpath(year, fname)
        if os.path.exists(target) and not FETCH:
            blob = open(target, "rb").read()
            manifest["files"][fname] = {"url": url_abs, "bytes": len(blob), "sha256": sha256(blob),
                                        "tape": manifest_at(previous, fname, "tape")}
            print(f"{year}/{fname} present ({len(blob)//1024} KiB)")
        else:
            cap = cdx_latest(url_abs)
            if not cap:
                fail(f"{fname}: no archive capture of {url_abs} (in-era venue print lost)")
            blob = get(f"http://web.archive.org/web/{cap}id_/{url_abs}", binary=True)
            if len(blob) < 4000 or b"301 Moved" in blob[:2000]:
                fail(f"{fname}: archive row for {url_abs} unusable ({len(blob)} bytes)")
            open(target, "wb").write(blob)
            manifest["files"][fname] = {"url": url_abs, "bytes": len(blob), "sha256": sha256(blob),
                                        "capturedAt": cap}
            print(f"{year}/{fname}: {len(blob)//1024} KiB (wayback {cap})")
            time.sleep(1.5)
        if fname.endswith(".html"):
            pages[fname] = (url_abs, blob.decode("utf-8", "replace"))
    return manifest, pages


def manifest_at(prev, fname, key):
    return (prev.get("files", {}).get(fname, {}) or {}).get(key)


def cdx_latest(url):
    q = (f"http://web.archive.org/cdx/search/cdx?url={urllib.parse.quote(url, safe='')}"
         "&output=json&filter=statuscode:200&limit=-1")
    for _ in range(3):
        try:
            rows = json.loads(get(q))
            break
        except json.JSONDecodeError as e:
            time.sleep(5)
    else:
        return None
    if not rows or len(rows) < 2:
        return None
    return rows[-1][1]


def mirror_discovered(frame, cfg, manifest, pages):
    """DOP links: per-division count numbers ride the filenames; each one
    gets found off the division's own results page, never guessed."""
    year = cfg["mirror_year"]
    for pat, src_pat, rx in cfg.get("discover", []):
        for d in cfg["divs"]:
            fname = pat.replace("{div}", d.lower())
            target = wpath(year, fname)
            src_fname = src_pat.replace("{div}", d.lower())
            if os.path.exists(target) and not FETCH:
                blob = open(target, "rb").read()
                manifest["files"][fname] = manifest["files"].get(fname) or {
                    "url": manifest["files"].get(fname, {}).get("url"),
                    "bytes": len(blob), "sha256": sha256(blob)}
                manifest["files"][fname]["bytes"] = len(blob)
                manifest["files"][fname]["sha256"] = sha256(blob)
                continue
            if src_fname not in pages:
                pages[src_fname] = (None, open(wpath(year, src_fname), "rb").read().decode("utf-8", "replace"))
            page_url, src = pages[src_fname]
            m = re.search(rx, src)
            if not m:
                fail(f"{year} {d}: DOP link not found on {src_fname} (pattern {rx})")
            href = m.group("h").replace(" ", "%20")
            base = page_url or next(meta["url"] for k, meta in manifest["files"].items()
                                    if k == src_fname)
            url = urllib.parse.urljoin(base, href)
            blob = get(url, binary=True)
            open(target, "wb").write(blob)
            manifest["files"][fname] = {"url": url, "bytes": len(blob), "sha256": sha256(blob)}
            print(f"{year}/{fname}: fetched {len(blob)//1024} KiB (discovered)")
            time.sleep(0.8)


TAS18_ROSTER_RE = re.compile(r"(Denison|Clark)")


def shape_checks(frame, cfg, pages, mirror_year):
    def page(name):
        if name not in pages:
            p = wpath(mirror_year, name)
            pages[name] = (None, open(p, "rb").read().decode("utf-8", "replace"))
        return pages[name][1]

    year = mirror_year
    if frame == "tas14":
        for d in cfg["divs"]:
            h = page(f"results-{d.lower()}.html")
            if not re.search(r"Elected|Excluded|first preference|Quota", h, re.I):
                fail(f"tas14 {d}: results page lacks results markers")
        for fname in [p for p in pages if p.startswith("pollingplaces-")]:
            h = page(fname)
            if h.count('<div class="medium-8 columns"><p>') < 10:
                fail(f"tas14 {fname}: venue list page lacks address rows (columns><p> form)")
        print("tas14: division pages carry Elected/E clauses; venue lists carry address rows")
    if frame == "tas18":
        import zipfile as _zf
        for d in cfg["divs"]:
            with _zf.ZipFile(wpath(year, f"fppp-{d.lower()}.xlsx")) as z:
                if "[Content_Types].xml" not in z.namelist():
                    fail(f"tas18 fppp-{d.lower()}.xlsx: not a workbook")
        h = page("results-denison.html")
        den = len(re.findall(r"Denison", h)); cla = len(re.findall(r"Clark", h))
        if den < 5 or cla > 0:
            fail(f"tas18 denison page prints Denison {den}, Clark {cla} (the era print must be Denison)")
        if not re.search(r"Elected", h):
            fail("tas18 denison: no Elected marker on the division page")
        print(f"tas18: era name checks hold (Denison {den}x, Clark {cla}x); Elected roster flag present")
    if frame == "tas21":
        with zipfile.ZipFile(wpath(year, "fp-by-polling-places.xlsx")) as z:
            if not any("sheet" in n and n.endswith(".xml") for n in z.namelist()):
                fail("tas21 fp-by-polling-places.xlsx: not a workbook")
        e = page("candidates-elected.html")
        if not re.search(r"Elected|ElEC|MEMBER", e):
            fail("tas21 candidates-elected: no roster marker")
        for d in cfg["divs"]:
            p = wpath(year, f"dop-{d.lower()}.pdf")
            if not open(p, "rb").read(4) == b"%PDF":
                fail(f"tas21 dop-{d.lower()}.pdf: not a PDF")
        print("tas21: statewide XLSX + per-division DOP PDFs + elected page verified")
    if frame in ("tas24", "tas25"):
        with zipfile.ZipFile(wpath(year, "fp-by-polling-places.xlsx")) as z:
            if not any("sheet" in n and n.endswith(".xml") for n in z.namelist()):
                fail(f"{frame} fp-by-polling-places.xlsx: not a workbook")
        for d in cfg["divs"]:
            with zipfile.ZipFile(wpath(year, f"dop-{d.lower()}.xlsx")) as z:
                if "[Content_Types].xml" not in z.namelist():
                    fail(f"{frame} dop-{d.lower()}.xlsx: not a workbook")
        e = page("candidates-elected.html")
        if not re.search(r"Elected|elected", e):
            fail(f"{frame} candidates-elected.html: no roster marker")
        print(f"{frame}: statewide XLSX + five DOP workbooks + elected page verified")


def mirror_year_now(frame):
    cfg = FRAMES[frame]
    year = cfg["mirror_year"]
    manifest, pages = mirror_static(frame, cfg)
    mirror_discovered(frame, cfg, manifest, pages)
    shape_checks(frame, cfg, pages, year)
    json.dump(manifest, open(os.path.join(SFS, year, "manifest.json"), "w"), indent=1)
    print(f"{frame}: mirror verified ({len(manifest['files'])} files)")


def mirror_tas10_wayback():
    year = "2010"
    os.makedirs(os.path.join(SFS, year), exist_ok=True)
    ts = "20100323080925"
    old = "http://www.electoral.tas.gov.au/pages/HouseOfAssembly/HoA2010"
    manifest = {"frame": "tas10", "day": "2010-03-20", "files": {},
                "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    divs = FRAMES["tas10"]["divs"]

    def wb(url):
        return get(f"http://web.archive.org/web/{ts}id_/{url}", binary=True)

    # the archived HoA2010 tree as enumerated live from the archive's
    # CDX directory 2026-11-17: per-division First + Dist HTML pages,
    # per-division venue-list HTML and polling-figures PDF, plus the
    # main page and election summary documents
    names = {
        "hub-electionsummary.html": f"{old}/HoA2010ElectionSummary.html",
        "hub-mainpage.html": f"{old}/HoA2010MainPage.html",
    }
    for d in divs:
        base = f"{old}/Results/{d}"
        names.update({
            f"results-{d.lower()}-first.html": f"{base}/{d}First.html",
            f"results-{d.lower()}-dist.html": f"{base}/{d}Dist.html",
            f"pollinglist-{d.lower()}.html": f"{old}/PollingPlaces/2010HoA{d}Polling.html",
            f"pollingfigures-{d.lower()}.pdf": f"{old}/HoA2010_PDF/{d}%20Polling%20Place%20Figures.pdf",
        })

    for fname, url in names.items():
        target = wpath(year, fname)
        if os.path.exists(target) and not FETCH:
            blob = open(target, "rb").read()
            manifest["files"][fname] = {"url": url, "bytes": len(blob), "sha256": sha256(blob),
                                        "capturedAt": ts}
            continue
        try:
            blob = wb(url)
        except SystemExit:
            if fname.endswith(".pdf"):
                print(f"2010/{fname}: archive missing ({url.split('/')[-1]}) — optional lane")
                continue
            raise
        if fname.endswith(".pdf") and not blob[:4] == b"%PDF":
            print(f"2010/{fname}: not a PDF ({blob[:4]!r}) — discarded")
            continue
        if fname.endswith(".html") and b"<h1" not in blob and b"<table" not in blob:
            print(f"2010/{fname}: archive row carries no page markup — treated missing")
            continue
        if len(blob) < 1200:
            print(f"2010/{fname}: archive row too small ({len(blob)} bytes) — treated missing")
            continue
        open(target, "wb").write(blob)
        manifest["files"][fname] = {"url": url, "bytes": len(blob), "sha256": sha256(blob)}
        print(f"2010/{fname}: {len(blob)//1024} KiB (wayback)")
        time.sleep(1.4)

    have = {k.split("-")[1] for k in manifest["files"] if k.startswith("results-")}
    want = {d.lower() for d in divs} - have
    if want and not FETCH:
        print(f"tas10: divisions missing from archive mirror: {sorted(want)} (provisional parent layer)")
    json.dump(manifest, open(os.path.join(SFS, year, "manifest.json"), "w"), indent=1)
    print(f"tas10: {len(manifest['files'])} archive rows")


def fetch_zip(name):
    os.makedirs(DL, exist_ok=True)
    p = os.path.join(DL, name)
    if os.path.exists(p) and not FETCH:
        return p
    url = AEC + AEC_ZIPS[name]
    print(f"dl/{name}: {url}")
    blob = get(url, binary=True, timeout=420)
    if not blob[:2] == b"PK" or len(blob) < 200000:
        fail(f"dl/{name}: not a zip ({len(blob)} bytes)")
    open(p, "wb").write(blob)
    return p


def key(s):
    return re.sub(r"[^a-z]", "", str(s).lower())


def tas_roster_features(zip_name, roster):
    """Extract the five Tas features off a national-era zip (name-roster
    guarded) as {name: hash} + the feature list."""
    z = fetch_zip(zip_name)
    stage = os.path.join(DL, zip_name[:-4])
    os.makedirs(stage, exist_ok=True)
    if not any(f.endswith("namelist") for f in os.listdir(stage)):
        subprocess.run(["unzip", "-oq", z, "-d", stage], check=True)
    ms = os.environ.get("MAPSHAPER") or os.path.join(REPO, "node_modules", ".bin", "mapshaper")
    shps = [os.path.join(p, f) for p, _, fs in os.walk(stage)
            for f in fs if f.lower().endswith(".shp") and "sa1" not in f.lower()]
    if not shps:
        fail(f"{zip_name}: no shp found")
    fc_path = os.path.join(stage, "tas.geojson")
    if not os.path.exists(fc_path):
        subprocess.run([ms, "-i", shps[0], "-o", fc_path, "format=geojson"], check=True)
    fc = json.load(open(fc_path))
    props = fc["features"][0]["properties"]
    wantk = {key(n) for n in roster}
    best, got = None, 0
    for c in props.keys():
        n = sum(1 for f in fc["features"] if key(f["properties"].get(c, "")) in wantk)
        if n > got:
            best, got = c, n
    if got != len(roster):
        fail(f"{zip_name}: no name column carries the Tas roster ({roster}); best {best}={got}")
    feats = [f for f in fc["features"] if key(f["properties"].get(best, "")) in wantk]
    if len(feats) != len(roster):
        fail(f"{zip_name}: {len(feats)} Tas features, want {len(roster)}")
    out = []
    for f in feats:
        name = str(f["properties"][best]).strip()
        h = hashlib.sha256(json.dumps(f["geometry"], sort_keys=True).encode()).hexdigest()[:10]
        out.append((name, h, {"type": "Feature", "properties": {"name": name},
                              "geometry": f["geometry"]}))
    byname = {n: h for n, h, _ in out}
    if set(byname) != set(roster):
        fail(f"{zip_name}: roster mismatch {sorted(set(byname) ^ set(roster))}")
    return out


def carve_boundaries():
    era_feats = {}
    for z in sorted(set(cfg["boundary"] for cfg in FRAMES.values())):
        roster = next(cfg["divs"] for cfg in FRAMES.values() if cfg["boundary"] == z)
        era_feats[z] = tas_roster_features(z, roster)

    names_by_era = {z: sorted(n for n, _, _ in feats) for z, feats in era_feats.items()}
    print("era rosters:", {z: names_by_era[z] for z in era_feats})

    zlist = list(era_feats)
    for a, b in zip(zlist, zlist[1:]):
        ha = sorted(h for n, h, _ in era_feats[a])
        hb = sorted(h for n, h, _ in era_feats[b])
        same = ha == hb
        print(f"{a} rings {'==' if same else '!='} {b}" + (" (identical five-feature set)" if same else
                                                          f" ({sum(x != y for x, y in zip(ha, hb))} of {len(ha)} differ)"))

    for frame, cfg in FRAMES.items():
        if frame == "tas10":
            continue
        era = cfg["boundary"]
        feats = era_feats[era]
        want_names = set(cfg["divs"])
        got_names = {n for n, _, _ in feats}
        if got_names != want_names:
            fail(f"{frame}: era {era} names {sorted(got_names)} != election roster {sorted(want_names)}")
        out = os.path.join(SRCT, f"n-{frame}.geojson")
        json.dump({"type": "FeatureCollection",
                   "features": [f for _, _, f in feats]}, open(out, "w"))
        print(f"n-{frame}.geojson: {len(feats)} features ({era})")


def mirror_psephos():
    """Adam Carr's per-election text prints — the committed cross-check
    bench (qld2015/nt2012-style). Files tas<year>.txt, same division/district
    shapes as his federal prints."""
    for y in ("2010", "2014", "2018", "2021", "2024"):
        p = os.path.join(SFS, y, f"psephos-tas{y}.txt")
        if os.path.exists(p) and not FETCH:
            print(f"{y}/psephos-tas{y}.txt present ({os.path.getsize(p) // 1024} KiB)")
            continue
        blob = get(f"http://psephos.adam-carr.net/countries/a/australia/states/tas/tas{y}.txt",
                   binary=False)
        if "Tasmanian" not in blob and "TASMANIA" not in blob.upper():
            fail(f"psephos tas{y}: unexpected payload ({len(blob)} bytes)")
        open(p, "w", encoding="utf-8").write(blob)
        print(f"{y}/psephos-tas{y}.txt: {len(blob) // 1024} KiB")
        time.sleep(0.8)


def main():
    for frame in ("tas14", "tas18", "tas21", "tas24", "tas25"):
        mirror_year_now(frame)
    mirror_tas10_wayback()
    mirror_psephos()
    carve_boundaries()
    print("tas sources complete:", SRCT)


if __name__ == "__main__":
    main()
