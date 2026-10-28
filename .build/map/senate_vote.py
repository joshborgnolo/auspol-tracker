#!/usr/bin/env python3
"""The Senate's first preferences by seat and polling place, for the Election map's Senate lens:
map/data/senate-vote-<year>.json, 2004-2025.

From the AEC's Virtual Tally Room (.build/aec-flow-src/senate-fpv/, landed by .build/harvest-aec-senate.py):
  div-<year>.csv.gz       every group ticket's and candidate's Senate votes in every division, all vote types
  pp-<year>-<ST>.csv.gz   ordinary Senate votes by polling place (none for 2004: the AEC never served them)

Votes are summed into the map's six families, as the House's are (build_map_data.py's bucket), with the
Senate's own codes on the same rails: the Liberal-National joint tickets (LPNP), Labor's Country Labor ticket
(ALPC), the Victorian Greens (GVIC), and a group carrying no party but its candidate's own name (David
Pocock's) read as independent, as ungrouped and "Non Affiliated" candidates are.

Output: { year, divs: { <division>: [formal, alp, lnp, grn, onp, ind, oth] } (all vote types, as the House's
seat figures), booths: { <polling place id>: [formal, ...] } (ordinary votes, as the House's booths) }.
Checks: each division's booths add to its ordinary votes in the division file, and each state's division
totals to the state figures in .build/aec-flow-src/fpv/fpv-senate-state-<year>.csv.

  python3 .build/map/senate_vote.py
"""
import collections, csv, gzip, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, ".build/aec-flow-src/senate-fpv")
YEARS = [2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
FAMS = ["alp", "lnp", "grn", "onp", "ind", "oth"]
COAL = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LPNP"}


def rows(path):
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as f:
        first = f.readline()
        if first.startswith("StateAb"):
            f.seek(0)
        return list(csv.DictReader(f))


def bucket(ab, name, members):
    ab = (ab or "").upper()
    if ab in ("ALP", "ALPC"):
        return "alp"
    if ab in COAL:
        return "lnp"
    if ab in ("GRN", "GVIC"):
        return "grn"
    if ab in ("ON", "HAN"):
        return "onp"
    if ab in ("IND", "NAFD", "") or re.match(r"(Independent|Non Affiliated)$", name or "", re.I):
        return "ind"
    # a group named for its own candidate ("David Pocock") stands as an independent
    if name and any(name.strip().lower() == m for m in members):
        return "ind"
    return "oth"


def person(details):
    # "POCOCK, David" -> "david pocock"
    sur, _, given = (details or "").partition(",")
    return f"{given.strip()} {sur.strip()}".lower()


for year in YEARS:
    div = rows(os.path.join(SRC, f"div-{year}.csv.gz"))
    grp = "Group" if "Group" in div[0] else "Ticket"
    members = collections.defaultdict(set)  # (state, group) -> its candidates' names
    for r in div:
        if r["BallotPosition"] != "0":
            members[(r["StateAb"], r[grp])].add(person(r["CandidateDetails"]))
    fam_of = {}
    for r in div:
        fam_of[r["CandidateID"]] = bucket(r["PartyAb"], r["PartyName"], members[(r["StateAb"], r[grp])])
    D = collections.defaultdict(lambda: [0] * 7)
    ordinary = collections.Counter()
    state = collections.Counter()
    for r in div:
        v = int(r["TotalVotes"])
        d = D[r["DivisionNm"]]
        d[0] += v
        d[1 + FAMS.index(fam_of[r["CandidateID"]])] += v
        ordinary[r["DivisionNm"]] += int(r["OrdinaryVotes"])
        state[r["StateAb"]] += v
    # the state figures, the AEC's own
    st_file = os.path.join(ROOT, f".build/aec-flow-src/fpv/fpv-senate-state-{year}.csv")
    if os.path.exists(st_file):
        with open(st_file, encoding="utf-8-sig") as f:
            f.readline()
            want = collections.Counter()
            for r in csv.DictReader(f):
                want[r["StateAb"]] += int(r["TotalVotes"])
        if want != state:
            sys.exit(f"{year}: division totals differ from the state file: {dict(want - state)} / {dict(state - want)}")
    B = {}
    if year != 2004:
        sums = collections.Counter()
        for st in STATES:
            for r in rows(os.path.join(SRC, f"pp-{year}-{st}.csv.gz")):
                k = r["PollingPlaceID"]
                if k not in B:
                    B[k] = [0] * 7
                    B[k + "/d"] = r["DivisionNm"]
                elif B[k + "/d"] != r["DivisionNm"]:
                    sys.exit(f"{year}: polling place {k} in two divisions")
                if r["CandidateID"] == "0":  # the informal ballots' row: not first preferences
                    continue
                v = int(r["OrdinaryVotes"])
                fam = fam_of.get(r["CandidateID"])
                if fam is None:
                    sys.exit(f"{year}: candidate {r['CandidateID']} ({r['CandidateDetails']}) not in the division file")
                B[k][0] += v
                B[k][1 + FAMS.index(fam)] += v
                sums[r["DivisionNm"]] += v
        bad = {d: (sums[d], ordinary[d]) for d in ordinary if sums[d] != ordinary[d]}
        if bad:
            sys.exit(f"{year}: polling places don't add to the divisions' ordinary votes: {dict(list(bad.items())[:5])}")
        B = {k: v for k, v in B.items() if not k.endswith("/d") and v[0] > 0}
    out = {"year": year, "fams": FAMS, "divs": dict(D), "booths": B,
           "source": f"AEC Virtual Tally Room, Senate first preferences by division (all votes) and by polling place (ordinary votes), {year}"}
    with open(os.path.join(ROOT, f"map/data/senate-vote-{year}.json"), "w") as f:
        json.dump(out, f, separators=(",", ":"))
        f.write("\n")
    T = [sum(d[i] for d in D.values()) for i in range(7)]
    print(f"senate-vote-{year}.json: {len(D)} divisions, {len(B)} polling places; " + " ".join(f"{FAMS[i]} {100 * T[i + 1] / T[0]:.1f}" for i in range(6)))
