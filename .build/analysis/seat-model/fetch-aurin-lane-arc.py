#!/usr/bin/env python3
"""fetch-aurin-lane-arc.py — the 2026-10-31 people-lanes arc's AURIN
top-up fetch: exactly one 1991 census layer, `b26 Method of travel to
work by sex`, which the six-table 1991 set of fetch-aurin-census.py
(the '90s lanes arc's own fetcher, in its sibling worktree) does not
download. 1996 needs nothing here: travel (cd_b21) and citizenship
(cd_b01) are already inside its 33-layer fetch set, and this era's
GCP never carried ancestry or children-ever-born tables at all — so
the pt/noncit 1990s sides cover fully with this one layer, and
anc/bigfam's own per-year menu gates hide those options there (the
exact same way the homeless lane hides before 2013).

Idempotent WFS-paginated pull of one layer copied from
fetch-aurin-census.py's own mechanism: anonymous GetCapabilities
probe, signed GetFeature pages into cache/bcp-1991-aurin (the shared
cache that script's other layers live in — never rewrites a layer
that is complete already), credentials from AURIN_USER/AURIN_PASS or
a sourced env file such as ~/.aurin.env (Anonymous GetFeature on this
side 401s, so an ADP account is needed; the script explains and exits
0 when the env is absent). Run after derive-booth-seifa-hist.py's
first run if the cache dir does not exist yet.

  python3 .build/analysis/seat-model/fetch-aurin-lane-arc.py
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

CACHE_DIR = ROOT / ".build/analysis/seat-model/cache/bcp-1991-aurin"
WFS = "https://adp.aurin.org.au/geoserver/wfs"
LAYER = "b26_method_trvl_wrk_by_sex_cd_1991"
WORKSPACE = "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991"
GET_CHUNK = 50000
CDS_PIN = 31401  # the 1991 CD universe the sibling tallies pin


def main():
    user = os.environ.get("AURIN_USER")
    pw = os.environ.get("AURIN_PASS")
    if not (user and pw):
        for cand in ("~/.aurin.env",):
            p = os.path.expanduser(cand)
            if os.path.exists(p):
                for line in open(p):
                    row = line.strip()
                    if row.startswith("AURIN_USER="):
                        user = user or row.split("=", 1)[1].strip().strip('"')
                    elif row.startswith("AURIN_PASS="):
                        pw = pw or row.split("=", 1)[1].strip().strip('"')
    if not (user and pw):
        print("AURIN_USER/AURIN_PASS are not set and ~/.aurin.env carries "
              "none; sign up for an ADP/AAF account at "
              "https://aurin.org.au/account, fill those, and rerun "
              "(nothing downloaded; cache unchanged)")
        return 0

    out = CACHE_DIR / f"{LAYER}.csv"
    if out.exists():
        n = sum(1 for _ in open(out, encoding="utf-8-sig")) - 1
        if n >= CDS_PIN - 50:
            print(f"{LAYER}: {n} rows present, skipping")
            return 0
        print(f"{LAYER}: only {n} rows on disk, re-downloading")
        out.unlink()

    import base64
    auth = base64.b64encode(f"{user}:{pw}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}",
               "User-Agent": "auspol-tracker census fetch"}

    params = {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature",
        "typenames": f"{WORKSPACE}:{LAYER}",
        "outputFormat": "csv", "count": str(GET_CHUNK),
    }
    start, rows_total = 0, 0
    chunks = []
    while True:
        q = dict(params)
        if start:
            q["startIndex"] = str(start)
        url = WFS + "?" + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                body = r.read().decode("utf-8-sig", "replace")
        except Exception as e:
            sys.exit(f"fetch {LAYER} page {start}: {e}")
        lines = body.strip().splitlines()
        if not lines or (not chunks and not lines[0]):
            break
        if not chunks:
            chunks.append(lines)
            start += len(lines) - 1
            rows_total += len(lines) - 1
            if len(lines) - 1 < GET_CHUNK:
                break
        else:
            chunks[0].extend(lines[1:])
            start += len(lines) - 1
            rows_total += len(lines) - 1
            if len(lines) - 1 < GET_CHUNK:
                break
    head = chunks[0][0]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(chunks[0]) + "\n", encoding="utf-8")
    rows = rows_total
    if rows < CDS_PIN - 50:
        sys.exit(f"{LAYER}: fetched only {rows} rows (pin {CDS_PIN})")
    cols = head.split(",")
    print(f"OK -> {out} ({rows} rows, cols include "
          f"{[c for c in cols if 'tr' in c or 'tran' in c][:6]}…)")

    marker = CACHE_DIR / "fetch-lane-arc.json"
    marker.write_text(json.dumps({
        "layer": LAYER, "rows": rows,
        "sha256": __import__("hashlib").sha256(
            out.read_bytes()).hexdigest(),
        "fetchedBy": "fetch-aurin-lane-arc.py (2026-10-31 lanes arc)"},
        indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
