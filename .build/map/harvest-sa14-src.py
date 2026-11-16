#!/usr/bin/env python3
"""harvest-sa14-src.py — mirror the ECSA's 2014 state-election static-era
results tree from the Wayback capture into
.build/state-flow-src/sa/2014/ (the sa18 frame's past-lane source).

The ECSA's current Joomla surface lists 2014-era results only partially
(some district summaries never migrated), but the static-era tree they
ran at the election is preserved whole at the Wayback Machine:

  /elections/2014-state-election-results-summary
    └ house-of-assembly-district-results/districtsummary/<701..747>   one page per district:
        "First Preference" and "Two Candidate Preferred" tables with
        per-candidate votes and the district tallies (formal/informal/
        ballot papers), matching the 2018-era static pages' schema
    └ house-of-assembly-state-summary              party-vote oracle
    └ house-of-assembly-state-summary              (the same page reads
                                                     detaileddistrictall
                                                     per psephos too)
    └ house-of-assembly-final-outcomes             seat outcome tables
    └ house-of-assembly-final-results              (and
      legislative-council-state-summary            LC oracle)

Every URL was confirmed status-200 live-archived at the Wayback Machine
before this harvest: no URL is fetched from the live ECSA host (the 2026
masthead lump current site returns for these ids carries no data).

Also committed beside the pages: psephos-sa2014.txt and
psephos-sa20143.txt — Adam Carr's transcription of the ECSA's own
statistics (its per-district table IS the ECSA's own counts; two
transcription-era display flaws known: the pendulum file drops its own
rank-09 Labor seat, and the voting-by-district file skips its
Davenport/Dunstan sections entirely). The harvest's parser-side
identity checks catch a fourth thing only if BOTH systems lose it.

usage: python3 -I .build/map/harvest-sa14-src.py [--fetch]
  --fetch   (re)download the 52 pages via the Wayback Machine; otherwise
            verify-only
"""
import gzip
import os
import re
import sys
import time
import urllib.request
import urllib.error

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(REPO, ".build", "state-flow-src", "sa", "2014")
FETCH = "--fetch" in sys.argv

#: ids 701..747 in the static-era districtsummary sequence, mapped to the
#: ECSA's own district names (from house-of-assembly-state-summary's node
#: list — two ids sit districtless in the tree: 747 == --DOUBLECHECK--
#: the list below prints exactly 47). Mirrors' role file.
DISTRICT_IDS = {str(701 + k): k for k in range(47)}
DIST_PATH = ("elections/2014-state-election-results-summary/"
             "house-of-assembly-district-results/districtsummary/{n}")
WB = "http://web.archive.org/web/20140407082339id_/"
BASE = "http://www.ecsa.sa.gov.au/"

PAGES = [("ecsa-2014-state-summary.html.gz",
          "elections/2014-state-election-results-summary/house-of-assembly-state-summary"),
         ("ecsa-2014-lc-summary.html.gz",
          "elections/2014-state-election-results-summary/legislative-council-state-summary"),
         ("ecsa-2014-final-outcomes.html.gz",
          "elections/2014-state-election-results-summary/house-of-assembly-final-outcomes"),
         ("ecsa-2014-final-results.html.gz",
          "elections/2014-state-election-results-summary/house-of-assembly-final-results")]
PAGES += [(f"ecsa-2014-district-{n}.html.gz", DIST_PATH.format(n=n))
          for n in sorted(DISTRICT_IDS, key=int)]

#: psephos transcription files fetched beside the mirror (Adam Carr's own
#: URLs unchanged since the file first shipped)
PSEPHOS = [("psephos-sa2014.txt",
            "http://psephos.adam-carr.net/countries/a/australia/states/sa/sa2014.txt"),
           ("psephos-sa20143.txt",
            "http://psephos.adam-carr.net/countries/a/australia/states/sa/sa20143.txt")]
UA = {"User-Agent": "auspol-tracker sa14 mirror (Wayback captures only)"}

MIN_BYTES = 4000
SIG_FP = re.compile(r"First Preference", re.I)
SIG_TCP = re.compile(r"Two Candidate Preferred", re.I)
SIG_SUM = re.compile(r"Statewide", re.I)
MIN_2014_ROWS = 45


def fail(msg):
    raise SystemExit(f"harvest-sa14: {msg}")


_LAST_OK = 0.0


def fetch(url, timeout=120, tries=6, min_bytes=2000):
    """Serial fetch respecting the archive's re-crawl throttling: pace
    calls ~1.4s apart, back off hard on connection refusal/429s."""
    global _LAST_OK
    last = None
    for k in range(tries):
        gap = time.time() - _LAST_OK
        if gap < 1.4:
            time.sleep(1.4 - gap)
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
                code = r.status
            if code != 200 or len(body) < min_bytes:
                _LAST_OK = time.time()
                time.sleep([15, 45, 90, 180][min(k, 3)])
                last = f"status {code}, {len(body)} bytes"
                continue
            _LAST_OK = time.time()
            return body
        except Exception as e:
            last = e
            _LAST_OK = time.time()
            time.sleep([15, 45, 90, 180][min(k, 3)])
    raise RuntimeError(f"wayback fetch failed after {tries}: {url} ({last})")


def write_gz(path, data):
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write(data)


def check_one(path, name):
    with gzip.open(os.path.join(OUT, path), "rt", encoding="utf-8", errors="replace") as f:
        doc = f.read()
    if len(doc) < 2000:
        fail(f"{path}: {len(doc)} bytes, suspiciously small")
    return doc


def verify():
    for fn, kind in PSEPHOS:
        p = os.path.join(OUT, fn)
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            fail(f"missing psephos mirror {p}")
    n_district = 0
    for fn, _slug in PAGES:
        p = os.path.join(OUT, fn)
        if not os.path.exists(p):
            fail(f"missing {p}")
        doc = check_one(fn, fn)
        if fn == "ecsa-2014-state-summary.html.gz":
            if not SIG_SUM.search(doc) or not re.search(r"Total Formal", doc):
                fail("state summary page carries neither its table nor its anchor")
        elif "lc-summary" in fn or "final-" in fn:
            pass
        else:
            if not SIG_FP.search(doc) or not SIG_TCP.search(doc):
                fail(f"{fn}: district page lacks its First Preference / Two Candidate anchors")
            n_district += 1
    if n_district != 47:
        fail(f"expected 47 district pages, counted {n_district}")
    print(f"sa14 mirror: 47 district summaries + state totals + LC summary"
          f" + final tables + psephos cross-check files present")


def harvest():
    os.makedirs(OUT, exist_ok=True)
    for fn, url in PSEPHOS:
        p = os.path.join(OUT, fn)
        if os.path.exists(p) and os.path.getsize(p) > 1000 and not FETCH:
            continue
        body = fetch(url)
        with open(p, "wb") as f:
            f.write(body)
        print(f"  {fn}: {len(body)} bytes")
    for fn, slug in PAGES:
        p = os.path.join(OUT, fn)
        if os.path.exists(p) and os.path.getsize(p) > MIN_BYTES and not FETCH:
            continue
        url = WB + BASE + slug if not slug.startswith("http") else slug
        body = fetch(url, timeout=120)
        text = body.decode("utf-8", "replace")
        write_gz(p, text)
        print(f"  {fn}: {len(text)} chars")
    print("sa14 mirror fetched")


def main():
    if FETCH:
        harvest()
    verify()


if __name__ == "__main__":
    main()
