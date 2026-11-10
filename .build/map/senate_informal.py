#!/usr/bin/env python3
"""The Senate's informal ballots by seat, for the Election map's Senate lens:
map/data/senate-informal-<year>.json, 2007-2025.

From the AEC Virtual Tally Room (.build/aec-flow-src/senate-informal/, landed by
.build/harvest-aec-senate-informal.py):
  inf-<year>.csv.gz       FormalVotes/InformalVotes/TotalVotes/InformalPercent per division.

Output: { year, source, divs: { <division>: [formal, informal] } } — the same division-name keys the
vote deck (senate_vote.py) keys by, so the app's Senate-figures head pools the chamber's own informal
count where the House's line pools the House's. The AEC's informal-by-division product starts 2007;
earlier Senate lanes carry no count (never the House's figure there).

Checks: the banner is the event's final phase; every row parses and its Total equals Formal+Informal;
every division in the vote deck for the year is present in the informal map and vice versa.

  python3 .build/map/senate_informal.py
"""
import csv, gzip, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, ".build/aec-flow-src/senate-informal")
OUT = os.path.join(ROOT, "map", "data")
YEARS = [2007, 2010, 2013, 2016, 2019, 2022, 2025]
SOURCE = "AEC Virtual Tally Room, SenateInformalByDivisionDownload per election (results.aec.gov.au/<event>/Website/Downloads/), Phase:FinalResults"

for year in YEARS:
    path = os.path.join(SRC, f"inf-{year}.csv.gz")
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as f:
        banner = f.readline()
        assert f"{year} Federal Election Senate Informal Votes By Division" in banner and "FinalResults" in banner, (year, banner)
        rows = list(csv.DictReader(f))
    divs = {}
    for r in rows:
        form, inf, total = int(r["FormalVotes"]), int(r["InformalVotes"]), int(r["TotalVotes"])
        assert form + inf == total, (year, r)
        divs[r["DivisionNm"]] = [form, inf]
    # the informal product and the vote deck must cover the same divisions
    vote = json.load(open(os.path.join(OUT, f"senate-vote-{year}.json")))
    only_i = sorted(set(divs) - set(vote["divs"]))
    only_v = sorted(set(vote["divs"]) - set(divs))
    assert not (only_i or only_v), (year, only_i, only_v)
    nat_f = sum(r[0] for r in divs.values())
    nat_i = sum(r[1] for r in divs.values())
    out = os.path.join(OUT, f"senate-informal-{year}.json")
    json.dump({"year": year, "source": SOURCE, "divs": divs}, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"senate-informal-{year}.json  divisions={len(divs)}  informal={100 * nat_i / (nat_f + nat_i):.2f}%")
print("ok")
