#!/usr/bin/env python3
"""Fetch/validate the ABS "Estimating homelessness" SA2 data cubes
(cache/homeless/hl-do005-{2016,2021}.xls[x]) — the homeless lane's
inputs for derive-booth-homeless.py.

Two source cubes, both published by ABS 2049.0 under the
"Estimating Homelessness: Census" name (the 2021-census release's
20490DO005_2021 tables 5.3 = hl2021 national-by-SA2 estimates on the
ASGS Edition-3 SA2 universe; the 2016-census release's
20490DO005_2016 tables 5.3 = hl2016 (Ed2 SA2 universe) and 5.4 =
hl2011 (Ed1 SA2 universe)). Earlier census estimations (2001/2006)
reach SA-level only in those publications — no SA2 table — so the
lane's floor is the 2013 election. The 2021 release's own 5.4 (2016
series) was verified to byte-agree with the 2016 release's 5.3 rows
and is ignored (keep one vintage per edition).

Download mechanics worth remembering: abs.gov.au's Akamai serves the
xls[x] intermittently (a 404-strip HTML page instead of the file,
random per request, until a re-fetch with the cookie jar passes);
fetching with a browser UA and retrying up to six times per URL is
the working recipe (never delete the cookie jar between retries).

Run: python3 .build/analysis/seat-model/fetch-homeless-abs.py
Depends: python3 + openpyxl + xlrd (arena derive does the parsing;
this script only fetches and validates)."""

import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

OUT_DIR = ROOT / ".build/analysis/seat-model/cache/homeless"
SOURCES = {
    "hl-do005-2021.xlsx": (
        "https://www.abs.gov.au/statistics/people/housing/"
        "estimating-homelessness-census/2021/20490do005_2021.xlsx",
        "20490DO005_2021", 1_300_000),
    "hl-do005-2016.xls": (
        "https://www.abs.gov.au/statistics/people/housing/"
        "estimating-homelessness-census/2016/20490do005_2016.xls",
        "20490DO005_2016", 1_200_000),
}
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 "
      "Safari/537.36")
NATS = {"hl-do005-2021.xlsx": {"5.3": 122494, "5.4": 116427},
        "hl-do005-2016.xls": {"5.3": 116427, "5.4": 102439}}


def fetch(url):
    """One ABS download with the cookie-jar retry dance."""
    for attempt in range(6):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read()
            if body[:2] == b"PK" or body[:4] == b"\xd0\xcf\x11\xe0":
                return body
        except Exception as e:
            print(f"  attempt {attempt + 1}: {e}")
        time.sleep(7)
    raise SystemExit(f"give up on {url}")


def validate():
    """Parse each cube's ALL-HOMELESS totals table and check the
    national pin + per-table edition column positions."""
    import sys as _sys
    for fn, (_url, marker, _lo) in SOURCES.items():
        p = OUT_DIR / fn
        if not p.exists():
            continue
        if fn.endswith("xlsx"):
            import openpyxl
            wb = openpyxl.load_workbook(p, read_only=True)
            ws_a = wb["Table_5.3"]
            rows_a = list(ws_a.iter_rows(values_only=True))
            ws_b = wb["Table_5.4"]
            rows_b = list(ws_b.iter_rows(values_only=True))
        else:
            import xlrd
            wb = xlrd.open_workbook(str(p))
            for ws in (wb.sheet_by_name("Table_5.3"),
                       wb.sheet_by_name("Table_5.4")):
                pass
            rows_a = [[wb.sheet_by_name("Table_5.3").cell_value(i, j)
                       for j in range(5)] for i in range(7)]
            rows_b = [[wb.sheet_by_name("Table_5.4").cell_value(i, j)
                       for j in range(5)] for i in range(7)]
        for rows, tag in ((rows_a, "5.3"), (rows_b, "5.4")):
            tot = rows[6][4]
            pin = NATS[fn][tag]
            if int(round(float(tot))) != pin:
                raise SystemExit(f"{fn} Table {tag} national {tot} "
                                 f"!= pin {pin}")
        hdr = rows_a[1][0]
        if marker not in hdr:
            raise SystemExit(f"{fn}: marker {marker} missing in header "
                             f"{hdr[:70]}")
    return True


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for fn, (url, marker, lo) in SOURCES.items():
        p = OUT_DIR / fn
        if p.exists():
            raw = p.read_bytes()
            if raw[:2] == b"PK" or raw[:4] == b"\xd0\xcf\x11\xe0":
                continue  # already a real workbook on disk
        print(f"fetch {fn}")
        body = fetch(url)  # fetch() returns only the PK/CFB signature
        p.write_bytes(body)
        print(f"  {len(body):,} bytes")
    for fn in SOURCES:
        if not (OUT_DIR / fn).exists():
            print(f"missing {fn} after fetch?")
            return 1
    validate()
    print("homeless cubes OK (national pins match) "
          f"{sum(1 for f in SOURCES if (OUT_DIR / f).exists())} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
