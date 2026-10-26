#!/usr/bin/env python3
"""Senate first preferences from the AEC Virtual Tally Room, for the Election map's Senate lens.

Per federal event 2004-2025 it lands, under .build/aec-flow-src/senate-fpv/:
  div-<year>.csv.gz       Downloads/SenateFirstPrefsByDivisionByVoteTypeDownload-<EVENT>.csv
                          (every candidate's and group ticket's votes in every division, all vote
                          types; its PartyAb column names each CandidateID's party)
  pp-<year>-<ST>.csv.gz   the per-division Downloads/SenateDivisionFirstPrefsByPollingPlaceDownload-
                          <EVENT>-<DivisionID>.csv files (listed on SenateDivisionDownloadMenu-<EVENT>-
                          <ST>-csv.htm), merged one file a state: the first file's banner and header,
                          then every file's rows (headers assert-equal). Ordinary votes by polling place.
2004 has no polling-place product: the VTR linked it, but the files were never served (the Internet
Archive's captures from December 2005 are 404s too), so 2004 is division-grain only.

  python3 .build/harvest-aec-senate.py [year ...]     (default: every year; existing files are kept)
"""
import gzip, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".build/aec-flow-src/senate-fpv")
EVENT = {2004: 12246, 2007: 13745, 2010: 15508, 2013: 17496, 2016: 20499, 2019: 24310, 2022: 27966, 2025: 31496}
STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"


def base(year):
    return f"https://results.aec.gov.au/{EVENT[year]}/{'results' if year == 2004 else 'Website'}/"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode("utf-8-sig")
    if body.lstrip().startswith("<"):
        raise RuntimeError("not a CSV: " + url)
    return body


def write_gz(path, text):
    with gzip.open(path, "wt", encoding="utf-8", newline="") as f:
        f.write(text)


def harvest(year):
    os.makedirs(OUT, exist_ok=True)
    e = EVENT[year]
    p = os.path.join(OUT, f"div-{year}.csv.gz")
    if not os.path.exists(p):
        write_gz(p, get(base(year) + f"Downloads/SenateFirstPrefsByDivisionByVoteTypeDownload-{e}.csv"))
    print(year, "division file", os.path.getsize(p), "bytes")
    if year == 2004:
        return
    for st in STATES:
        p = os.path.join(OUT, f"pp-{year}-{st}.csv.gz")
        if os.path.exists(p):
            continue
        req = urllib.request.Request(base(year) + f"SenateDivisionDownloadMenu-{e}-{st}-csv.htm", headers={"User-Agent": UA})
        menu = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        files = sorted(set(re.findall(rf'Downloads/SenateDivisionFirstPrefsByPollingPlaceDownload-{e}-\d+\.csv', menu)))
        if not files:
            raise RuntimeError(f"{year} {st}: no polling-place files on the menu")
        with ThreadPoolExecutor(6) as ex:
            bodies = list(ex.map(lambda f: get(base(year) + f), files))
        head = None
        out = []
        for b in bodies:
            lines = b.splitlines()
            if head is None:
                head = lines[1]
                out += lines[:2]
            assert lines[1] == head, f"{year} {st}: headers differ"
            out += [l for l in lines[2:] if l.strip()]
        write_gz(p, "\n".join(out) + "\n")
        print(year, st, len(files), "divisions", len(out) - 2, "rows", os.path.getsize(p), "bytes")


if __name__ == "__main__":
    for y in [int(a) for a in sys.argv[1:]] or sorted(EVENT):
        harvest(y)
