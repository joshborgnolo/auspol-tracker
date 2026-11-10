#!/usr/bin/env python3
"""Senate informal ballots by division, from the AEC Virtual Tally Room, for the Election map's
Senate lens (the "Informal votes" line under a Senate-figures head reads the chamber's own count,
not the House's).

Per federal event 2007-2025 it lands, under .build/aec-flow-src/senate-informal/:
  inf-<year>.csv.gz       Downloads/SenateInformalByDivisionDownload-<EVENT>.csv
                          (Formal/Informal/Total/InformalPercent per division; the product first
                          exists for 2007 — no file at any earlier event, probed 2026-11-10)

  python3 .build/harvest-aec-senate-informal.py [year ...]   (default: every year; existing files are kept)
"""
import os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".build/aec-flow-src/senate-informal")
EVENT = {2007: 13745, 2010: 15508, 2013: 17496, 2016: 20499, 2019: 24310, 2022: 27966, 2025: 31496}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

os.makedirs(OUT, exist_ok=True)
for y in [int(a) for a in sys.argv[1:]] or sorted(EVENT):
    dest = os.path.join(OUT, f"inf-{y}.csv.gz")
    if os.path.exists(dest):
        print(y, "kept")
        continue
    url = f"https://results.aec.gov.au/{EVENT[y]}/Website/Downloads/SenateInformalByDivisionDownload-{EVENT[y]}.csv"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    body = urllib.request.urlopen(req, timeout=90).read()
    head = body[:64]
    if head.lstrip().startswith(b"<"):
        raise RuntimeError(f"not a CSV: {url}")
    import gzip
    with open(dest, "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", compresslevel=9, mtime=0) as z:
            z.write(body)
    print(y, "->", dest)
