"""Harvest the ECQ by-election media feeds the /map/ Qld "now" frame needs.

The commission's Vote Result System archive for each by-election sits on
resultsdata.elections.qld.gov.au's public elections.json manifest — the same
provenance the state-general feeds follow (harvest-qld-state-flows.py).
One zip per event, locally committed and never refetched at build time:
  .build/state-flow-src/qld/byelections/<stub>/src.zip
  and unpacks for qld_ecq's loader: xml/publicResults.xml beside it.

Events (from the manifest, verified 2026-11-04):
  Hinchinbrook2025  29 November 2025  — KAP's Nick Dametto resigned
  Stafford2026      16 May 2026 — Jimmy Sullivan (Independent since his May
                    2025 expulsion from Labor) died in office
Each zip also bundles that event's companion council by-election
(the 2024 SGE feed does the same with Ipswich's council by-election); the
district-of-interest is filtered by name where the loader hands it out.

usage: python3 -I .build/harvest-qld-byelections.py [--check]
"""
import json
import os
import subprocess
import sys
import zipfile

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
ROOT = os.path.join(REPO, ".build", "state-flow-src", "qld", "byelections")
MANIFEST = "https://resultsdata.elections.qld.gov.au/elections.json"
STUBS = ("Hinchinbrook2025", "Stafford2026")


def fail(msg):
    raise SystemExit(f"harvest-qld-byelections: {msg}")


def get_json(url):
    r = subprocess.run(["curl", "-sf", "--max-time", "120", url], capture_output=True)
    if r.returncode != 0:
        fail(f"fetch fail {r.returncode} {url}")
    return json.loads(r.stdout)


def fetch(url, dest):
    r = subprocess.run(["curl", "-sf", "--max-time", "600", "-o", dest, url], capture_output=True)
    if r.returncode != 0:
        return f"FAIL {r.returncode} {url}"
    if not zipfile.is_zipfile(dest):
        os.unlink(dest)
        return f"FAIL non-zip {url}"
    with zipfile.ZipFile(dest) as z:
        names = z.namelist()
        if "publicResults.xml" not in names:
            return f"FAIL zip missing publicResults.xml: {names[:6]}"
    return None


def events():
    d = get_json(MANIFEST)
    events = d if isinstance(d, list) else d.get("elections", d.get("Elections", []))
    out = {}
    for e in events:
        if e.get("stub") in STUBS:
            out[e["stub"]] = e
    if len(out) != len(STUBS):
        fail(f"manifest names {sorted(out)}, expected all of {STUBS}")
    return out


def main():
    evs = events()
    n_new = 0
    for stub in STUBS:
        url = evs[stub].get("archiveXML")
        if not url:
            fail(f"{stub}: manifest holds no archiveXML")
        outdir = os.path.join(ROOT, stub)
        os.makedirs(outdir, exist_ok=True)
        zpath = os.path.join(outdir, "src.zip")
        if not os.path.exists(zpath):
            err = fetch(url, zpath)
            if err:
                fail(err)
            print(f"{stub}: {os.path.getsize(zpath)} bytes -> {zpath}")
            n_new += 1
        xdir = os.path.join(outdir, "xml")
        os.makedirs(xdir, exist_ok=True)
        xp = os.path.join(xdir, "publicResults.xml")
        if not os.path.exists(xp):
            with zipfile.ZipFile(zpath) as z:
                z.extract("publicResults.xml", xdir)
            print(f"{stub}: publicResults.xml unzipped")
    sys.exit(0)


def check():
    bad = []
    for stub in STUBS:
        xp = os.path.join(ROOT, stub, "xml", "publicResults.xml")
        if not os.path.exists(xp) or os.path.getsize(xp) < 1000:
            bad.append(xp)
    print("cache check:", "clean" if not bad else f"missing {bad}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
    main()
