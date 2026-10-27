"""Mirror the Victorian Election 2022 source files into .build/map/src/vic22/.

Sources (all fetched once, committed after review, never re-fetched by the
build itself):
  - VEC Azure blob mirror (itsitecoreblobvecprd01/public-files/State/Reports/):
    the 88 district "Results by Voting Centre" XLS (booth primary rows,
    declaration-pile rows, enrolment) and the 8 Legislative Council region
    "Votes Received" / "Distribution of Preferences" XLS; the file list is
    the committed .build/state-flow-src/vic/manifest-2022.txt. The blob
    carries a few re-issued duplicates ("Brighton ... (1).xls",
    "South-Eastern Metropolitan ... Centre..xls") plus a stray
    "North-Eastern Victoria Region" row (not a 2022 region — Victoria has
    eight; "North-Eastern Metropolitan" is the 2021 redistribution's name):
    the script logs duplicates byte-compared and skips non-canonical names.
  - the live vec.vic.gov.au 2022 district pages' 2CP annexes:
    /results/.../results-by-district/<slug>-district-results/<slug>-2cp-
    results-by-voting-centre — a server-rendered table of the final TCP
    pair per voting centre (the booth tcp lane; no XLS form exists, so the
    HTML page itself is the record).
  - the 2022 election's results-summary page and the Narracan
    supplementary-election page: the VEC's elected-member roster (the
    build's winner authority — the annex pair's leader is not, see THE
    WINNER AUTHORITY in build_vic22_data.py).
  - Democracy Sausage's public API (democracysausage.org/api/0.1): the VIC
    2022 election id 34 venue roll — 1,659 geocoded election-day voting
    centres with premises/address, the geocode source for the booth lanes
    (the VEC publishes no venue coordinates). Enumerated via
    polling_places/search/?ids=…&election_id=34 over the election's id
    block, 323000..324999 as of the 2026-10-27 fetch (lo==hi fence-post
    scan: spans returning records widen until both edges come back empty).

usage: python3 .build/map/harvest-vic22-src.py        # fetch what's missing
"""
import collections
import json
import os
import subprocess
import sys
import time
import urllib.parse

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(REPO, ".build", "map", "src", "vic22")
MANIFEST = os.path.join(REPO, ".build", "state-flow-src", "vic", "manifest-2022.txt")
BLOB = "https://itsitecoreblobvecprd01.blob.core.windows.net/public-files/"
VEC = "https://www.vec.vic.gov.au"
RES_DIR = "/results/state-election-results/2022-state-election-results/results-by-district"

# the 2022 election's 88 districts (the 2021 redistribution's roster —
# Bayswater/Clarinda/Kalkallo/Kew/Point Cook etc. replaced Ferntree Gully,
# Keysborough, Yuroke and other 2018 names, so a 2018-era list must never be
# used here; the redistribution's rename table lives in the build script).
# Pinning the names here makes a manifest drift fail loudly. The list is
# reconciled against .build/state-flow-src/vic/manifest-2022.txt's 88 unique
# "District-Results by Voting Centre" base names.
DISTRICTS = [
    "Albert Park", "Ashwood", "Bass", "Bayswater", "Bellarine", "Benambra",
    "Bendigo East", "Bendigo West", "Bentleigh", "Berwick", "Box Hill",
    "Brighton", "Broadmeadows", "Brunswick", "Bulleen", "Bundoora",
    "Carrum", "Caulfield", "Clarinda", "Cranbourne", "Croydon", "Dandenong",
    "Eildon", "Eltham", "Essendon", "Eureka", "Euroa", "Evelyn",
    "Footscray", "Frankston", "Geelong", "Gippsland East", "Gippsland South",
    "Glen Waverley", "Greenvale", "Hastings", "Hawthorn", "Ivanhoe",
    "Kalkallo", "Kew", "Kororoit", "Lara", "Laverton", "Lowan", "Macedon",
    "Malvern", "Melbourne", "Melton", "Mildura", "Mill Park", "Monbulk",
    "Mordialloc", "Mornington", "Morwell", "Mulgrave", "Murray Plains",
    "Narracan", "Narre Warren North", "Narre Warren South", "Nepean",
    "Niddrie", "Northcote", "Oakleigh", "Ovens Valley", "Pakenham",
    "Pascoe Vale", "Point Cook", "Polwarth", "Prahran", "Preston",
    "Richmond", "Ringwood", "Ripon", "Rowville", "Sandringham", "Shepparton",
    "South Barwon", "South-West Coast", "St Albans", "Sunbury", "Sydenham",
    "Tarneit", "Thomastown", "Warrandyte", "Wendouree", "Werribee",
    "Williamstown", "Yan Yean",
]
assert len(DISTRICTS) == 88 and len(set(DISTRICTS)) == 88
REGIONS = [
    "Eastern Victoria", "North-Eastern Metropolitan", "Northern Metropolitan",
    "Northern Victoria", "South-Eastern Metropolitan", "Southern Metropolitan",
    "Western Metropolitan", "Western Victoria",
]


def slug(name):
    return name.lower().replace(" ", "-")


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return "skip"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    r = subprocess.run(["curl", "-sfL", "--max-time", "180", "-o", dest, url],
                       capture_output=True, text=True)
    if r.returncode != 0:
        if os.path.exists(dest):
            os.remove(dest)
        return f"FAIL {r.returncode}"
    return "ok"


def blob_name(name):
    return urllib.parse.urljoin(BLOB, urllib.parse.quote("State/Reports/" + name))


def main():
    listed = [l.strip() for l in open(MANIFEST) if l.strip()]
    reports = [os.path.basename(l) for l in listed if l.startswith("State/Reports/")]

    # ---- district XLS --------------------------------------------------------
    n_ok = n_skip = n_fail = 0
    dupes = collections.Counter()
    for d in DISTRICTS:
        want = f"{d} District-Results by Voting Centre.xls"
        alts = [r for r in reports if r.startswith(f"{d} District-Results by Voting Centre")]
        if not alts:
            print(f"MISSING district XLS {d!r}")
            n_fail += 1
            continue
        canon = want if want in alts else None
        rest = [a for a in alts if a != want]
        if canon is None:
            print(f"MISSING canonical {want!r} (have {alts!r})")
            n_fail += 1
            continue
        url = blob_name(want)
        dest = os.path.join(OUT, "xls", slug(d) + ".xls")
        if d == "Nepean" and not os.path.exists(dest):
            # the live blob slot now serves the 2026 Nepean BY-ELECTION file
            # (same canonical name, reused): the committed 2022-general file
            # was recovered from web.archive.org/web/20250430153207id_/<url>
            # — restore it from a checkout, never re-fetch the live blob.
            print("NEPEAN: live blob is the 2026 by-election file; restore the "
                  "Wayback 2022-general capture instead of fetching")
            n_fail += 1
            continue
        res = fetch(url, dest)
        n_ok += res == "ok"
        n_skip += res == "skip"
        n_fail += res.startswith("FAIL")
        if res.startswith("FAIL"):
            print(f"{res} {want}")
        for a in rest:
            dupes[a] += 1
            u2, d2 = blob_name(a), os.path.join(OUT, "xls-dup", a.replace(" ", "_"))
            r2 = fetch(u2, d2)
            if r2 in ("ok", "skip"):
                same = open(dest, "rb").read() == open(d2, "rb").read()
                print(f"  dup {a!r}: {'identical' if same else 'DIFFERS — review'} vs canonical")
    print(f"district XLS: {n_ok} fetched, {n_skip} cached, {n_fail} failed")

    # ---- 2CP HTML annexes ----------------------------------------------------
    n_ok2 = n_skip2 = n_fail2 = 0
    for d in DISTRICTS:
        s = slug(d)
        if d == "Narracan":
            # Narracan's Nov 2022 poll was deferred; the live record is the
            # May 2023 supplementary election under the by-elections timeline
            url = (VEC + "/results/state-election-results/state-by-elections-timeline/"
                   "narracan-district-supplementary-election-results/2cp-results-by-voting-centre")
        else:
            url = (VEC + RES_DIR + f"/{s}-district-results/{s}-2cp-results-by-voting-centre")
        dest = os.path.join(OUT, "2cp", s + ".html")
        res = fetch(url, dest)
        n_ok2 += res == "ok"
        n_skip2 += res == "skip"
        n_fail2 += res.startswith("FAIL")
        if res.startswith("FAIL"):
            print(f"{res} {url}")
        time.sleep(0.15)
    print(f"2CP annexes: {n_ok2} fetched, {n_skip2} cached, {n_fail2} failed")

    # ---- LC region XLS -------------------------------------------------------
    n_ok3 = n_skip3 = n_fail3 = 0
    for r in REGIONS:
        for suffix, tag in (("Votes Received.xls", "votes"),
                            ("Distribution of Preferences.xls", "dop")):
            want = f"{r} Region-{suffix}"
            if want not in reports:
                print(f"MISSING LC {r!r} {suffix}")
                n_fail3 += 1
                continue
            dest = os.path.join(OUT, "xlc", slug(r) + "-" + tag + ".xls")
            res = fetch(blob_name(want), dest)
            n_ok3 += res == "ok"
            n_skip3 += res == "skip"
            n_fail3 += res.startswith("FAIL")
            if res.startswith("FAIL"):
                print(f"{res} {want}")
    # log (never fetch) the manifest's LC rows that are not our canonical pair
    canon = {f"{r} Region-{s}" for r in REGIONS
             for s in ("Votes Received.xls", "Distribution of Preferences.xls",
                       "Results by Voting Centre.xls")}
    odd = [x for x in reports if x.startswith(tuple(r + " Region" for r in REGIONS))
           and x not in canon and "Results by Voting Centre" not in x]
    odd += [x for x in reports if x.startswith("North-Eastern Victoria Region")]
    for x in odd:
        print("  non-canonical LC row:", x)
    print(f"LC XLS: {n_ok3} fetched, {n_skip3} cached, {n_fail3} failed")

    # ---- the elected-member roster pages ------------------------------------
    # the build's winner authority (see THE WINNER AUTHORITY in
    # build_vic22_data.py): the 2022 results summary's per-district
    # elected-member tiles (87; Narracan's tile waited on its supplementary
    # poll) plus the Narracan supplementary election's own page.
    n_ok4 = n_skip4 = n_fail4 = 0
    for url, dest in (
        (VEC + "/results/state-election-results/2022-state-election-results/results-summary",
         os.path.join(OUT, "results-summary.html")),
        (VEC + "/results/state-election-results/state-by-elections-timeline/"
               "narracan-district-supplementary-election-results",
         os.path.join(OUT, "narracan-supplementary.html")),
    ):
        res = fetch(url, dest)
        n_ok4 += res == "ok"
        n_skip4 += res == "skip"
        n_fail4 += res.startswith("FAIL")
        if res.startswith("FAIL"):
            print(f"{res} {url}")
        time.sleep(0.15)
    print(f"roster pages: {n_ok4} fetched, {n_skip4} cached, {n_fail4} failed")

    # ---- demsausage venue roll ----------------------------------------------
    dest = os.path.join(OUT, "demsausage", "vic-2022.json")
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        print("demsausage roll: cached")
    else:
        lo, hi = 323000, 325000
        places = {}
        span = 250
        for start in range(lo, hi, span):
            ids = ",".join(str(i) for i in range(start, start + span))
            url = ("https://democracysausage.org/api/0.1/polling_places/search/"
                   f"?ids={ids}&election_id=34")
            tmp = dest + ".tmp"
            r = subprocess.run(["curl", "-sfL", "--max-time", "60", "-o", tmp, url],
                               capture_output=True, text=True)
            if r.returncode != 0:
                sys.exit(f"demsausage fetch failed rc={r.returncode} at span {start}")
            rows = json.loads(open(tmp).read() or "[]")
            os.remove(tmp)
            for x in rows:
                places[x["id"]] = x
            time.sleep(0.2)
        divs = {d for x in places.values() for d in x["divisions"]}
        if len(places) < 1500 or len(divs) != 88:
            sys.exit(f"demsausage roll drifted: {len(places)} places, {len(divs)} divisions")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w") as f:
            json.dump([places[i] for i in sorted(places)], f, separators=(",", ":"))
        print(f"demsausage roll: {len(places)} places across {len(divs)} divisions")


if __name__ == "__main__":
    main()
