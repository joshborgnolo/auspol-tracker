#!/usr/bin/env python3
"""fetch-aurin-census.py — download the 1991/1996 census lane tables
from the AURIN Data Catalogue into the seat-model cache.

Usage:
  AURIN_USER=<user> AURIN_PASS=<pass> \
    python3 .build/analysis/seat-model/fetch-aurin-census.py

or put AURIN_USER/AURIN_PASS in a sourced env file (e.g. ~/.aurin.env).

Design notes (the '90s census-preparedness arc — see
.matilda/skills/auto-skill-auspol-map-census-lanes/SKILL.md):

- The AURIN Data Catalogue/ADP WFS keeps `GetCapabilities` anonymous
  but returns 401 `{"detail":"Not authenticated"}` on `GetFeature`
  without credentials. Per the audit, any ADP/AAF usersec pair passes
  Plain-HTTP-Basic on this endpoint. This script reads them from the
  AURIN_USER/AURIN_PASS environment; if they are not set it explains
  how to finish registration and exits 0 without fetching anything
  (idempotent, safe to run before the account exists).
- Download = one WFS v2.0.0 GetFeature per layer, outputFormat=csv,
  paginated at GET_CHUNK rows per request until a short page lands,
  into cache/census-19XX/<tablename>.csv (resumable: a finished layer
  is never re-downloaded unless you delete it). Mod 1996's layers are
  the 33 cd_bNN_census_1996 entries; 1991's are six named tables the
  lane reads need (b01/b05/b08/b11/b16/b22) — full 57-table scope is
  only a manifest edit away when the future arc needs more.
- Writes a per-census manifest.json of {layer, rows, sha256} as the
  provenance the derive scripts later read, and prints a layer-by-
  layer count row at completion.
"""

import base64
import csv
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

csv.field_size_limit(sys.maxsize)


ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

CACHE = ROOT / ".build/analysis/seat-model/cache"
WFS = "https://adp.aurin.org.au/geoserver/wfs"
GET_CHUNK = 50000

# 1991: the six lane tables (+ b01's summary block the totals ride),
# then the follow-on people-lane tables (religion/income/tenure) the
# map-people-fill arc reads.
T1991 = {
    "b01_slct_characteristics_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b04_abity_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b05_age_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b08_birthplace_ctry_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b11_language_spoken_home_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b13_religion_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b16_qualification_hi_level_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b22_occupation_by_age_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b27_yr_individual_inc_by_sex_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b29_yr_hsld_inc_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b34_fam_type_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b47_nature_occ_by_lld_type_by_dwl_type_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
    "b48_nature_occ_by_lld_type_by_dwl_type_cd_1991": "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1991",
}
# 1996: the 33-layer CD set (same six lanes in the same variant)
T1996 = {
    f"cd_{t}_census_1996":
        "datasource-AU_Govt_ABS_Census-UoM_AURIN_DB_Census1996"
    for t in (
        "b01", "b02", "b03a", "b03b", "b04", "b05", "b06", "b07", "b08",
        "b09", "b10", "b11", "b12", "b13a", "b13b", "b13c", "b14", "b15",
        "b16", "b17a", "b17b", "b18a", "b18b", "b19a", "b19b", "b20",
        "b21", "b22a", "b22b", "b23", "b24", "b25a", "b25b", "b26", "b27",
        "b28", "b29", "b30", "b31a", "b31b", "b32")
}

# SEIFA cubes (the DB_3 workspace carries the ABS-era CD cubes the map's
# SEIFA lanes need back to the 1991 census). Pulled into their own cache
# dir; the derive scripts read them from there.
TSEIFA = {
    "seifa_cd_1991": "datasource-AU_Govt_ABS-UoM_AURIN_DB_3",
    "seifa_cd_1996": "datasource-AU_Govt_ABS-UoM_AURIN_DB_3",
    "seifa_cd_2001": "datasource-AU_Govt_ABS-UoM_AURIN_DB_3",
}

CREDS_NOTE = """\
AURIN credentials are not set. This script needs an ADP/AAF account on
the AURIN Data Catalogue. Register/sign the account, then either:

  AURIN_USER=<user> AURIN_PASS=<pass> \\
    python3 .build/analysis/seat-model/fetch-aurin-census.py

or put them in ~/.aurin.env as AURIN_USER=/AURIN_PASS= lines, then:
  source ~/.aurin.env && python3 .build/analysis/seat-model/fetch-aurin-census.py

Nothing was downloaded.
"""


def creds():
    user, password = os.environ.get("AURIN_USER"), os.environ.get(
        "AURIN_PASS")
    if user and password:
        return user, password
    env = Path.home() / ".aurin.env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("AURIN_USER="):
                user = line.split("=", 1)[1].strip()
            elif line.startswith("AURIN_PASS="):
                password = line.split("=", 1)[1].strip()
    return (user, password) if user and password else (None, None)


def http_get(url, auth_hdr, retries=4):
    req = urllib.request.Request(url)
    req.add_header("Authorization", auth_hdr)
    req.add_header("User-Agent", "auspol-tracker census fetch")
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=180,
                                        context=ssl.create_default_context()) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise SystemExit(
                    f"AUTH {e.code} on {urllib.parse.urlparse(url).path}: "
                    "credentials rejected by the AURIN host "
                    "(check AURIN_USER/AURIN_PASS, register the account, or "
                    "ask support@aurin.org.au whether Basic auth mode changed).")
            if attempt == retries - 1:
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(5 * (attempt + 1))
    raise SystemExit("unreachable")


def fetch_layer(tag, workspace, auth_hdr, out_dir):
    out = out_dir / f"{tag}.csv"
    if out.exists() and out.stat().st_size > 0:
        rows = list(csv.reader(out.read_text(encoding="utf-8").splitlines()))
        sha = hashlib.sha256(out.read_bytes()).hexdigest()[:16]
        return ("skip", len(rows), sha)
    rows = []
    # server-side rules established empirically 2026-10-30: pagination
    # needs sortBy (startIndex without it is an ExceptionReport 400),
    # startIndex is 1-based with no page-0 start, page 1 = plain params
    start, first = 0, True
    while True:
        params = {
            "service": "WFS", "version": "2.0.0", "request": "GetFeature",
            "typenames": f"{workspace}:{tag}",
            "outputFormat": "csv",
            "count": str(GET_CHUNK),
        }
        if start > 0:
            params["sortBy"] = "ogc_fid"
            params["startIndex"] = str(start)
        blob = http_get(f"{WFS}?{urllib.parse.urlencode(params)}", auth_hdr)
        text = blob.decode("utf-8-sig")
        if text.lstrip().startswith(("{" "<ows:", "<?xml")):
            raise SystemExit(f"{tag}: non-CSV reply {text[:120]}")
        parsed = list(csv.reader(text.splitlines()))
        if first:
            batch = parsed
            first = False
        else:
            batch = parsed[1:] if parsed and parsed[0] == rows[0] else parsed
        if not batch:
            break
        rows.extend(batch)
        recv = len(batch)
        start += recv
        if recv < GET_CHUNK:
            break
    out_dir.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerows(rows)
    sha = hashlib.sha256(out.read_bytes()).hexdigest()[:16]
    return ("ok", len(rows), sha)


def main():
    user, password = creds()
    if not user or not password:
        print(CREDS_NOTE)
        return
    only = None
    for a in sys.argv[1:]:
        if a.startswith("--census="):
            v = a.split("=", 1)[1]
            only = v if v == "seifa" else int(v)
    auth_hdr = "Basic " + base64.b64encode(
        f"{user}:{password}".encode()).decode()
    for census, tables in ((1991, T1991), (1996, T1996), ("seifa", TSEIFA)):
        if only is not None and census != only:
            continue
        out_dir = CACHE / (f"bcp-{census}-aurin" if census != "seifa"
                           else "seifa-cd-aurin")
        print(f"--- census {census}: {len(tables)} layers")
        manifest = {}
        for tag, workspace in sorted(tables.items()):
            status, n, sha = fetch_layer(tag, workspace, auth_hdr, out_dir)
            manifest[tag] = {"rows": n, "sha16": sha, "file": f"{tag}.csv",
                        "status": status}
            print(f"  {status} {tag}: {n} rows (sha {sha})")
            time.sleep(0.3)
        (out_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        counts = sum(
            (json.loads((out_dir / "manifest.json").read_text())[t].get(
                "rows") or 0) for t in tables)
        print(f"  census {census}: {counts:,} rows across {len(tables)} layers")


if __name__ == "__main__":
    main()
