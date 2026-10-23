#!/usr/bin/env python3
"""Harvest the 2004 division profile pages (LIVE www.aec.gov.au, no Wayback).
Slug: name minus spaces apostrophes hyphens (server case-insensitive). Sentinel: 55,488 bytes.
Era gate: <title> begins "2004 Profile of the division of".
TWO page templates in the directory: Hunter-era splits label/value into two <li>s,
Swan-era inlines ("Seat Status: Value</li>") — rating regex tries split then inline.
State is NOT machine-labelled on pages: taken from RR5 att3 (2001 set) + Bonner=QLD, Gorton=VIC.
Pages cached in .build/analysis/seat-model/divclass-src/2004/pages/ (delete to refetch).
Writes .build/analysis/seat-model/divclass-src/2004/aec-profiles-2004.tsv"""
import os, re, sys, time, urllib.request, urllib.error

BASE = "https://www.aec.gov.au/Elections/federal_elections/2004/profiles/"
SENTINEL = 55488
CACHE = ".build/analysis/seat-model/divclass-src/2004/pages"
os.makedirs(CACHE, exist_ok=True)

att3 = {}
for l in open(".build/analysis/seat-model/rr5-att3-proposed-classifications.tsv"):
    if l.startswith("#"):
        continue
    c = l.rstrip("\n").split("\t")
    if len(c) >= 2:
        att3[c[0]] = c[1].strip()
STATE_EXTRA = {"Bonner": "QLD", "Gorton": "VIC"}

names = [l.split("\t")[0] for l in open(".build/analysis/seat-model/aec-2001-epoch-profile-ratings.tsv") if l and not l.startswith("#") and l.strip()]
names += ["Bonner", "Gorton"]  # created for 2004
slug = lambda n: n.replace("'", "").replace(" ", "").replace("-", "")

rows, missing = [], []
for name in sorted(names, key=slug):
    s = slug(name)
    path = f"{CACHE}/{s}.html"
    if os.path.exists(path):
        body = open(path, encoding="utf-8").read()
    else:
        try:
            req = urllib.request.Request(BASE + s + ".htm", headers={"User-Agent": "auspol-tracker-research"})
            body = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
        except urllib.error.URLError as e:
            print(f"ERROR {name}: {e}", file=sys.stderr); continue
        time.sleep(0.25)
        open(path, "w", encoding="utf-8").write(body)
    if len(body.encode()) == SENTINEL or "<title>2004 Profile" not in body:
        missing.append(name); continue
    m = re.search(r"Demographic Rating:</h2>\s*<p>([^<]+)</p>", body) or re.search(r"Demographic Rating:\s*([^<]+)</li>", body)
    rating = m.group(1).strip() if m else ""
    m = re.search(r"Seat Status:</li>\s*<li>([^<]+)</li>", body) or re.search(r"Seat Status:\s*([^<]+)</li>", body)
    status = m.group(1).strip() if m else ""
    state = att3.get(name, STATE_EXTRA.get(name, "??"))
    rows.append((name, state, rating, status))
    print(f"ok {name:22s} {state:3s} {rating!r:26s} {status!r}")

# guards
VOCAB = {"Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"}
bad = [r for r in rows if r[2] not in VOCAB or r[1] not in ("NSW","VIC","QLD","SA","WA","TAS","NT","ACT")]
assert not bad, f"vocab/state failures: {bad}"
assert len(rows) == 150, f"{len(rows)} rows (expect 150)"
counts = {}
for r in rows: counts[r[1]] = counts.get(r[1], 0) + 1
EXPECT = {"NSW":50,"VIC":37,"QLD":28,"SA":11,"WA":15,"TAS":5,"NT":2,"ACT":2}
assert counts == EXPECT, f"state counts {counts} != {EXPECT}"
stat = [r for r in rows if not r[3]]
print(f"\nstatus empty on {len(stat)} rows: {[r[0] for r in stat][:8]}")

with open(".build/analysis/seat-model/divclass-src/2004/aec-profiles-2004.tsv", "w") as f:
    f.write("# division\tstate\tclassification2004\tseatStatus2004\n")
    for r in rows:
        f.write("\t".join(r) + "\n")
print(f"wrote {len(rows)} rows; missing (expected abolished 2003-04): {missing}")
