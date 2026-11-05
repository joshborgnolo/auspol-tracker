#!/usr/bin/env python3
"""harvest-wa-byelections.py — mirror WAEC's by-election result payloads for
the /map/ "WA now" frame. The WAEC's EIS by-elections API is the one-family
sibling of the general-election results API the state-flows mirror rides:

  /api/ByElections                          catalogue (elections since 2001)
  /api/ByElections/{name-dashes}/overview   one election's own bundle —
      election card (count tallies, enrolment, dates), district/early/other
      polling-place registers WITH coordinates, candidates, results2CP, the
      per-polling-place first-preference rows, full preference distribution

Mirrors (committed, never re-fetched by the producer):
  .build/state-flow-src/wa/byelections/2026-secret-harbour/overview.json

usage: python3 -I .build/map/harvest-wa-byelections.py
"""
import json
import os
import urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT_DIR = os.path.join(REPO, ".build", "state-flow-src", "wa", "byelections")
EIS = "https://eis.waec.wa.gov.au/api/ByElections"
UA = {"User-Agent": "auspol-tracker wa by-election source harvest"}

#: the elections the wanow frame cares about (its producer hand-curates the
#: changes ledger; only a new by-election extends ME). Slug = the API's own
#: dashed event name.
ME = {"2026 Secret Harbour By-Election": "2026-secret-harbour"}


def fail(msg):
    raise SystemExit(f"harvest-wa-byelections: {msg}")


def get(url):
    req = urllib.request.Request(url, headers=UA)
    body = urllib.request.urlopen(req, timeout=120).read().decode("utf-8", "replace").lstrip("﻿")
    if not body.lstrip().startswith(("{", "[")):
        fail(f"HTML response, not JSON: {url}")
    return json.loads(body)


def main():
    catalogue = get(EIS)
    names = {e["ElectionName"] for e in catalogue} if isinstance(catalogue, list) else set()
    want = [n for n in ME if n in names]
    missing = [n for n in ME if n not in names]
    if missing:
        print(f"note: not yet in the ByElections catalogue: {missing}")
    os.makedirs(OUT_DIR, exist_ok=True)
    for name in want:
        slug = ME[name]
        dd = os.path.join(OUT_DIR, slug)
        os.makedirs(dd, exist_ok=True)
        p = os.path.join(dd, "overview.json")
        d = get(f"{EIS}/{name.replace(' ', '-')}/overview")
        ev = d.get("ElectionEvent") or {}
        cands = d.get("resultsCandidates") or []
        pprows = d.get("resultsPollingPlace") or []
        tcp = d.get("results2CP") or []
        if not ev.get("ELECTION_DATE"):
            fail(f"{name}: overview lacks ELECTION_DATE")
        if len(tcp) != 2:
            fail(f"{name}: results2CP not a pair")
        if not pprows:
            fail(f"{name}: no per-polling-place rows")
        if not cands:
            fail(f"{name}: no candidates")
        tt = d.get("toptotals") or {}
        if not tt.get("NUMBER_ELECTORS") or not tt.get("FORMAL_LAST_PUBLISHED_NUMBER_ENTERED"):
            fail(f"{name}: toptotals thin")
        with open(p, "w") as f:
            json.dump(d, f, separators=(",", ":"))
        print(f"{name}: {ev['ELECTION_DATE'][:10]}, {len(cands)} candidates, "
              f"{len(pprows)} polling-place rows, formal "
              f"{tt['FORMAL_LAST_PUBLISHED_NUMBER_ENTERED']} -> {p}")


if __name__ == "__main__":
    main()
