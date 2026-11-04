"""Harvest the NSWEC by-election report pages the /map/ NSW "now" frame needs.

Source: results.elections.nsw.gov.au — the Nov-2023-and-later results system
(the pastvtr archive stops at the consolidated general-election events; the
Oct-2024 triple sits on event SB2402, the Sep-2025 Kiama by-election on
SB2502). One snapshot per district per report, committed beside the nsw
state-flow caches and never refetched — build_nsw_now.py reads the caches
only; a cache gap fails that build loudly.

Reports per district (each 200-checked):
  fp   FirstPreferencesReport — venue grid (first preferences + informal,
       sectioned Voting Centres / Early Voting Centres / Declaration Votes)
  tcp  TwoCandidatesPreferredReport — the final pair + exhausted per venue
  cc   CheckCountPreferencesReport — the district Vote Summary (candidates,
       party long names, formal votes) with the enrolment prose line
  dop  DistributionOfPreferencesReport — provenance only: the new report
       system never activated it for these events (the ladder exists on
       pastvtr for the general elections), so the page is committed to
       record that no official count ladder was ever published for these
       by-elections (build_nsw_now files fl: [] on the four districts)

usage: python3 -I .build/harvest-nsw-byelections.py [--check]
"""
import gzip
import os
import subprocess
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
ROOT = os.path.join(REPO, ".build", "state-flow-src", "nsw", "byelections")
BASE = "https://results.elections.nsw.gov.au"

# event -> {year-label, [(district-slug, NSWEC district path-name)]}
EVENTS = {
    "SB2402": {
        "day": "2024-10-19",
        "dists": ["Epping", "Hornsby", "Pittwater"],
    },
    "SB2502": {
        "day": "2025-09-13",
        "dists": ["Kiama"],
    },
}
REPORTS = ("fp", "tcp", "cc", "dop")
URLS = {
    "fp": "{b}/{ev}/{d}/Parliamentary/FirstPreferencesReport.html",
    "tcp": "{b}/{ev}/{d}/Parliamentary/TwoCandidatesPreferredReport.html",
    "cc": "{b}/{ev}/{d}/Parliamentary/CheckCountPreferencesReport.html",
    "dop": "{b}/{ev}/{d}/Parliamentary/DistributionOfPreferencesReport.html",
}


def slug_of(d):
    return d.replace(" ", "-").lower()


def get(url):
    r = subprocess.run(["curl", "-sfL", "--max-time", "180", "-A", "Mozilla/5.0", url],
                       capture_output=True)
    if r.returncode != 0:
        return None
    return r.stdout


def want(ev, dist, rep):
    return os.path.join(ROOT, ev, f"{slug_of(dist)}-{rep}.html.gz")


def harvest():
    n_new = 0
    for ev, e in EVENTS.items():
        for dist in e["dists"]:
            for rep in REPORTS:
                p = want(ev, dist, rep)
                if os.path.exists(p):
                    continue
                url = URLS[rep].format(b=BASE, ev=ev, d=dist)
                body = get(url)
                # the dop page's skeletal "not yet activated" shell is the
                # provenance record itself (no ladder was ever published);
                # on any other report it means we fetched too early
                if body is None or (rep != "dop" and b"not yet activated" in body[:6000]):
                    print(f"{ev} {dist} {rep}: FAIL {url}")
                    sys.exit(1)
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with gzip.open(p, "wb") as f:
                    f.write(body)
                print(f"{ev} {dist} {rep}: {len(body)} bytes -> {p}")
                n_new += 1
    print(f"harvest complete: {n_new} new pages, "
          f"{sum(len(e['dists']) for e in EVENTS.values())} districts x {len(REPORTS)} reports")


def check():
    bad = 0
    for ev, e in EVENTS.items():
        for dist in e["dists"]:
            for rep in REPORTS:
                p = want(ev, dist, rep)
                ok = os.path.exists(p) and os.path.getsize(p) > 1000
                if not ok:
                    bad += 1
                    print(f"MISSING/suspect {p}")
    print("cache check:", "clean" if not bad else f"{bad} problems")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
    harvest()
