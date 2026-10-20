"""Mirror the ECQ state-general-election full-results XML archives into
.build/state-flow-src/qld/YYYY/src.zip + xml/publicResults.xml.

Source: https://resultsdata.elections.qld.gov.au/elections.json lists every
event's `archiveXML` zip; the State General entries are
``publicResults_State2020_aurukun2020_Final.zip`` (2020 SGE, bundled with a
council by-election) and ``publicResults_SGE2024_ICCDiv4_Final.zip`` (2024
SGE, bundled with an Ipswich council by-election). Each zip holds a single
``publicResults.xml`` with every district's Official Distribution of
Preferences chain. Plain unauthenticated GET; the zip URL is reused
verbatim from elections.json, never handcrafted.

2017 is not in that feed. Its distributions live on the ECQ's older results
site: each district's booth page (results.ecq.qld.gov.au/elections/state/
State2017/results/booth<N>.html, N = 1..93) closes with a "Summary of
Distribution of Preferences" table – first preferences, then one row per
exclusion. They are mirrored verbatim but gzipped
(.build/state-flow-src/qld/2017/booth<N>.html.gz; ~400KB each raw). The
2004–2015 elections used optional preferential voting and are left out.
Only downloads files missing locally; idempotent re-runs.
"""
import gzip
import json
import os
import subprocess
import sys
import zipfile

ROOT = ".build/state-flow-src/qld"
ELECTIONS_JSON = "https://resultsdata.elections.qld.gov.au/elections.json"
YEARS = (2020, 2024)


def get_json(url):
    r = subprocess.run(["curl", "-sf", "--max-time", "120", url],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except (json.JSONDecodeError, ValueError):
        return None


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return None
    r = subprocess.run(["curl", "-sf", "--max-time", "600", "-o", dest, url],
                       capture_output=True, text=True)
    if r.returncode != 0:
        if os.path.exists(dest):
            os.remove(dest)
        return f"FAIL {r.returncode} {url}"
    if not zipfile.is_zipfile(dest):
        os.remove(dest)
        return f"FAIL non-zip {url}"
    return None


BOOTH_2017 = "https://results.ecq.qld.gov.au/elections/state/State2017/results/booth{}.html"


def harvest_2017():
    outdir = os.path.join(ROOT, "2017")
    os.makedirs(outdir, exist_ok=True)
    got = bad = 0
    for n in range(1, 94):
        dest = os.path.join(outdir, f"booth{n}.html.gz")
        if os.path.exists(dest):
            got += 1
            continue
        r = subprocess.run(["curl", "-sf", "--max-time", "120", "-A", "Mozilla/5.0", BOOTH_2017.format(n)],
                           capture_output=True)
        if r.returncode != 0 or b"Summary of Distribution of Preferences" not in r.stdout:
            print(f"2017: booth{n} FAIL ({r.returncode})")
            bad += 1
            continue
        with open(dest + ".part", "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as f:
            f.write(r.stdout)
        os.replace(dest + ".part", dest)
        got += 1
    print(f"2017: {got} of 93 district booth pages mirrored")
    return bad


def main():
    bad = harvest_2017()
    cat = get_json(ELECTIONS_JSON)
    if not cat:
        sys.exit("could not read the ECQ elections catalogue")
    urls = {}
    for ev in cat.get("elections", []):
        u = ev.get("archiveXML") or ""
        if "State2020" in u:
            urls.setdefault(2020, u)
        elif "SGE2024" in u:
            urls.setdefault(2024, u)
    for year in YEARS:
        u = urls.get(year)
        if not u:
            print(f"{year}: no archive XML in elections.json, skipped")
            continue
        outdir = os.path.join(ROOT, str(year))
        xmldir = os.path.join(outdir, "xml")
        xml_path = os.path.join(xmldir, "publicResults.xml")
        if os.path.exists(xml_path) and os.path.getsize(xml_path) > 0:
            print(f"{year}: already mirrored")
            continue
        os.makedirs(outdir, exist_ok=True)
        err = fetch(u, os.path.join(outdir, "src.zip"))
        if err:
            print(f"{year}: {err}")
            bad += 1
            continue
        os.makedirs(xmldir, exist_ok=True)
        with zipfile.ZipFile(os.path.join(outdir, "src.zip")) as z:
            z.extractall(xmldir)
        if not os.path.exists(xml_path):
            print(f"{year}: zip missing publicResults.xml: "
                  f"{zipfile.ZipFile(os.path.join(outdir, 'src.zip')).namelist()[:6]}")
            bad += 1
            continue
        kb = os.path.getsize(xml_path) // 1024
        print(f"{year}: mirrored {u.split('/')[-1]} -> {xml_path} ({kb} KB)")
    sys.exit(0 if bad == 0 else 1)


if __name__ == "__main__":
    main()
