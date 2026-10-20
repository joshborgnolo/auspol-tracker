"""Mirror WAEC state-general-election result JSON into
.build/state-flow-src/wa/sgYYYY/<DISTRICT>.json.

Source (all official WAEC): the EIS results API behind
https://www.elections.wa.gov.au/elections/state/sgelection#/sgYYYY –
  https://eis.waec.wa.gov.au/api/sgElections
  https://eis.waec.wa.gov.au/api/sgElections/sgYYYY/list
  https://eis.waec.wa.gov.au/api/sgElections/sgYYYY/{CODE}/results
Unauthenticated plain-GET JSON (no JS/Cloudflare wall). District codes come
from each year's own list (`ElelctorateType == "District"` – sic, the typo
is in the schema), never hardcoded, since the map changes between
redistributions (57 districts in 2001/2005, 59 from 2008).

Only downloads files missing locally; idempotent re-runs.
"""
import concurrent.futures
import json
import os
import subprocess
import sys

ROOT = ".build/state-flow-src/wa"
API = "https://eis.waec.wa.gov.au/api/sgElections"
YEARS = (2001, 2005, 2008, 2013, 2017, 2021, 2025)


def get(url, timeout=120):
    r = subprocess.run(["curl", "-sf", "--max-time", str(timeout), url],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except (json.JSONDecodeError, ValueError):
        return None


def fetch(url, dest, timeout=120):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return None
    r = subprocess.run(["curl", "-sf", "--max-time", str(timeout), "-o", dest, url],
                       capture_output=True, text=True)
    if r.returncode != 0:
        if os.path.exists(dest):
            os.remove(dest)
        return f"FAIL {r.returncode} {url}"
    # an HTML challenge page or empty body saved as .json would poison parses
    try:
        with open(dest) as f:
            json.load(f)
    except (json.JSONDecodeError, ValueError, OSError):
        os.remove(dest)
        return f"FAIL non-json {url}"
    return None


def main():
    years = [int(y) for y in sys.argv[1:]] or list(YEARS)
    cat = get(API)
    if not cat:
        sys.exit("could not read the sgElections catalogue")
    bad = 0
    for year in years:
        name = f"sg{year}"
        if not any(e.get("ElectionName") == name for e in cat):
            print(f"{year}: not in the catalogue, skipped")
            continue
        listing = get(f"{API}/{name}/list")
        if not listing:
            print(f"{year}: list fetch failed")
            bad += 1
            continue
        codes = [e["ElectorateCode"] for e in listing.get("electorates", [])
                 if e.get("ElelctorateType") == "District"]
        outdir = os.path.join(ROOT, name)
        os.makedirs(outdir, exist_ok=True)
        jobs = [(f"{API}/{name}/{code}/results", os.path.join(outdir, f"{code}.json"))
                for code in codes]
        done = fail = 0
        errs = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            for res in ex.map(lambda j: fetch(*j), jobs):
                if res:
                    errs.append(res)
                    fail += 1
                else:
                    done += 1
        print(f"{year}: {done} ok, {fail} failed ({len(jobs)} districts)")
        for e in errs[:10]:
            print("   ", e)
        bad += fail
    sys.exit(0 if bad == 0 else 1)


if __name__ == "__main__":
    main()
