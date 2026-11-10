#!/usr/bin/env python3
"""Each federal division's Senate first preferences by how they were cast.

Adds vts to every division of map/data/res-<year>.json for the eras the
Senate cast chart covers (2019, 2022, 2025 — 2016 is out, see the runnote
below), beside vt/vt2/vt3: {pile: [alp, lnp, grn, onp, oth]}, "oth" pooling
independents as vt3 does — the Senate's own buckets come from
senate_vote.py's canonical bucket lane. The Senate has no two-party piles:
every formal Senate ballot has exactly one first preference, so a pile's
five always exhaust it, and that is asserted before writing.

    day    ordinary votes at polling places
    mob    ordinary votes taken by mobile teams
    ppvc   ordinary votes at early voting centres
    pre    declaration pre-poll votes
    post   postal votes
    abs    absent votes
    prov   provisional votes

From the AEC Virtual Tally Room (.build/aec-flow-src/senate-fpv/, landed by
.build/harvest-aec-senate.py): div-<year>.csv.gz (every candidate's votes in
every division, all vote types) names each sum by vote type; the ordinary
pillar's kind-of-place split only exists as votes per polling place
(pp-<year>-<ST>.csv.gz), and which of those places is an early centre the
Senate file never says. The venue types come from the House booth record:
the downloads' PollingPlaceID is the same AEC id in both chambers' products
(measured: 100% of the Senate places and their votes, every one of the four
era years).

Asserts before anything writes:

  * every res division has its Senate count (every one of these years
    elected every state's senators);
  * every Senate polling-place id exists in the Year's House booth record;
  * a candidate's polling-place ordinary votes add to its div-file ordinary
    votes (the venue lane reconciles, candidate by candidate — the VTR's
    CandidateID repeats across states, so the join is on
    (division, candidate): 2019's Bean collision);
  * each division's family piles add to the div file's totals AND to the
    committed senate-vote-<year>.json row (alp/lnp/grn/onp vs row[1..4],
    oth vs row[5]+row[6] — independents folded in), so the lane and the
    Senate deck can't drift apart.

Patches the res files in place, so run it after anything that rewrites them
(geo_build.mjs, handbook_geo.mjs, build_vote_piles.py), then assemble.
test-map-page fails if an era res file comes back without vts.

2016 is deliberately outside YEARS: its polling-place product misattributes
~176 of 22,702 candidates' ordinary votes between tickets (whole-division
totals reconcile, but the per-candidate and per-family venue splits shift
by tens of votes — e.g. FFP's bp1/bp2 pair in Boothby off by 553/452), so
no venue split can be trusted at the exactness this store's own contract
demands; the other three eras reconcile candidate by candidate, exactly.

Run: python3 -I .build/map/build_senate_piles.py
"""
import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # python3 -I keeps the script dir off sys.path
import senate_vote as sv

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "map/data"
YEARS = (2019, 2022, 2025)  # see the docstring: 2016's venue lane is not exact
FAMS5 = ("alp", "lnp", "grn", "onp", "oth")
ORDER = ("day", "mob", "ppvc", "pre", "post", "abs", "prov")
EARLY, PLACE = 5, 1  # polling-place types: an early voting centre, a plain polling place
DECL = (("PrePollVotes", "pre"), ("PostalVotes", "post"), ("AbsentVotes", "abs"), ("ProvisionalVotes", "prov"))


def build(year, res, senate_vote_rows):
    div_rows = sv.rows(Path(sv.SRC) / f"div-{year}.csv.gz")
    grp = "Group" if "Group" in div_rows[0] else "Ticket"
    # the Senate's own buckets (senate_vote.bucket), keyed by (division,
    # candidate): a CandidateID alone isn't a join key
    members = collections.defaultdict(set)  # (state, group) -> its candidates' names
    for r in div_rows:
        if r["BallotPosition"] != "0":
            members[(r["StateAb"], r[grp])].add(sv.person(r["CandidateDetails"]))
    f5_of = {}
    for r in div_rows:
        fam = sv.bucket(r["PartyAb"], r["PartyName"], members[(r["StateAb"], r[grp])])
        f5_of[(int(r["DivisionID"]), r["CandidateID"])] = FAMS5.index("oth" if fam == "ind" else fam)
    by_div = collections.defaultdict(list)
    for r in div_rows:
        by_div[int(r["DivisionID"])].append(r)
    b = res["booths"]
    ty_of = {b["id"][j]: b["ty"][j] for j in range(len(b["id"]))}
    # each candidate's ordinary votes by kind of place, from the polling-place downloads
    cand_place = collections.defaultdict(lambda: {"day": [0] * 5, "mob": [0] * 5, "ppvc": [0] * 5})
    for st in sv.STATES:
        for r in sv.rows(Path(sv.SRC) / f"pp-{year}-{st}.csv.gz"):
            cid = r["CandidateID"]
            if cid == "0":  # the informal ballots' row: not first preferences
                continue
            did = int(r["DivisionID"])
            pp = int(r["PollingPlaceID"])
            assert pp in ty_of, f"{year} {st}: polling place {pp} has no House counterpart in the res booths"
            kind = "ppvc" if ty_of[pp] == EARLY else "day" if ty_of[pp] == PLACE else "mob"
            cand_place[(did, cid)][kind][f5_of[(did, cid)]] += int(r["OrdinaryVotes"])
    piles_of = {}
    for d in res["divs"]:
        did, name = d["id"], d["n"]
        assert by_div.get(did), f"{year} {name}: no Senate count"
        got = {s: [0] * 5 for s in ORDER}
        total = 0
        for r in by_div[did]:
            cid = r["CandidateID"]
            f = f5_of[(did, cid)]
            # the venue lane must reconcile the candidate's own ordinary votes
            places = cand_place[(did, cid)]
            want_ord = int(r["OrdinaryVotes"])
            got_ord = sum(places[k][f] for k in ("day", "mob", "ppvc"))
            assert got_ord == want_ord, f"{year} {name}: {r['CandidateDetails']}: polling places add {got_ord} v ordinary {want_ord}"
            for k in ("day", "mob", "ppvc"):
                got[k][f] += places[k][f]
            for t, s in DECL:
                got[s][f] += int(r[t])
            total += int(r["TotalVotes"])
        # the piles must exhaust the seat's Senate formal votes (a pile's five
        # = every formal ballot cast that way)
        assert sum(sum(v) for v in got.values()) == total, f"{year} {name}: piles don't exhaust the Senate count"
        # and each family's piles must be its Senate total, the deck's own
        row = senate_vote_rows[name]
        want = row[1:5] + [row[5] + row[6]]
        got5 = [sum(got[s][f] for s in ORDER) for f in range(5)]
        assert got5 == want, f"{year} {name}: family piles {got5} v the Senate deck's {want}"
        piles_of[did] = {s: got[s] for s in ORDER if sum(got[s])}
    return piles_of


def main():
    for year in YEARS:
        path = OUT / f"res-{year}.json"
        text = path.read_text(encoding="utf-8")
        res = json.loads(text)
        tail = "\n" if text.endswith("\n") else ""
        same = json.dumps(res, separators=(",", ":"), ensure_ascii=False) + tail
        assert same == text, f"{path.name} doesn't round-trip, so writing it would change more than vts"
        senate_vote_rows = json.loads((OUT / f"senate-vote-{year}.json").read_text(encoding="utf-8"))["divs"]
        piles_of = build(year, res, senate_vote_rows)
        for d in res["divs"]:
            assert "vt3" in d, f"{year} {d['n']}: vts rides beside vt3 (run build_vote_piles.py first)"
            d.pop("vts", None)
            piles = piles_of[d["id"]]
            rebuilt = {}
            for k, x in d.items():
                rebuilt[k] = x
                if k == "vt3":
                    rebuilt["vts"] = piles
            d.clear()
            d.update(rebuilt)
        path.write_text(json.dumps(res, separators=(",", ":"), ensure_ascii=False) + tail, encoding="utf-8")
        tot = sum(sum(p) for piles in piles_of.values() for p in piles.values())
        print(f"{year}: vts on {len(piles_of)} of {len(res['divs'])} seats, {tot:,} Senate formal")


if __name__ == "__main__":
    main()
