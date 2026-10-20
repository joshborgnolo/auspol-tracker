"""Mirror the NSW Electoral Commission's Legislative Assembly results for the
state-flow work (.build/state-flow-src/nsw/<year>/).

Source: the NSWEC's past-results site, pastvtr.elections.nsw.gov.au/<event>/
LA/results lists every district; per district
  * cc/fp_summary – first preferences, each candidate's party code;
  * dop/dop      – the official distribution of preferences (stops once a
                   candidate holds an absolute majority);
  * preferences  – a zip of every ballot paper's preference markings
                   ("SG2301 LA Pref Data <District>.zip": District,
                   PollingPlaceName, BPNumber, Formality, CandidateName,
                   PrefMarking, PrefCounted).
The two pages are mirrored verbatim, gzipped (<district>-fp.html.gz,
<district>-dop.html.gz). The ballot zips (~0.4MB each, ~40MB an election)
are a local cache in zip/, gitignored: parse-nsw-state-flows.py reduces
them to a committed per-candidate count (counts.csv) and records each zip's
sha256 there, so a re-download can be checked against what was counted.

Events: 2023 (SG2301) and 2019 (SG1901). Earlier elections are not on the
past-results site in this form (SG1501/SG1101 return server errors).
Idempotent: only fetches what is missing.
"""
import gzip
import os
import re
import subprocess
import sys
import urllib.parse

ROOT = os.path.join(".build", "state-flow-src", "nsw")
EVENTS = {2023: "SG2301", 2019: "SG1901"}
BASE = "https://pastvtr.elections.nsw.gov.au"


def get(url):
    r = subprocess.run(["curl", "-sfL", "--max-time", "180", "-A", "Mozilla/5.0", url], capture_output=True)
    return r.stdout if r.returncode == 0 else None


def save_gz(dest, data):
    with open(dest + ".part", "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as f:
        f.write(data)
    os.replace(dest + ".part", dest)


def main():
    bad = 0
    for year, ev in EVENTS.items():
        out = os.path.join(ROOT, str(year))
        zdir = os.path.join(out, "zip")
        os.makedirs(zdir, exist_ok=True)
        idx = get(f"{BASE}/{ev}/LA/results")
        if not idx:
            print(f"{year}: FAIL district list")
            bad += 1
            continue
        districts = sorted(set(re.findall(rf'href="/{ev}/LA/([a-z0-9-]+)/preferences"', idx.decode("utf-8", "replace"))))
        for d in districts:
            for page, suffix in (("cc/fp_summary", "fp"), ("dop/dop", "dop")):
                dest = os.path.join(out, f"{d}-{suffix}.html.gz")
                if os.path.exists(dest):
                    continue
                body = get(f"{BASE}/{ev}/LA/{d}/{page}")
                if not body or b"Page Not Found" in body:
                    print(f"{year} {d}: FAIL {page}")
                    bad += 1
                    continue
                save_gz(dest, body)
            pref = get(f"{BASE}/{ev}/LA/{d}/preferences")
            m = re.search(rb'href="([^"]+\.zip)"', pref or b"")
            if not m:
                print(f"{year} {d}: FAIL no preference zip link")
                bad += 1
                continue
            href = m.group(1).decode()
            name = urllib.parse.unquote(href.rsplit("/", 1)[-1])
            dest = os.path.join(zdir, name)
            if os.path.exists(dest):
                continue
            url = href if href.startswith("http") else f"{BASE}/{ev}/LA/{d}/{href.lstrip('/')}" if not href.startswith("/") else BASE + href
            body = get(url.replace(" ", "%20"))
            if not body or body[:2] != b"PK":
                print(f"{year} {d}: FAIL zip {url}")
                bad += 1
                continue
            with open(dest + ".part", "wb") as f:
                f.write(body)
            os.replace(dest + ".part", dest)
        print(f"{year}: {len(districts)} districts")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
