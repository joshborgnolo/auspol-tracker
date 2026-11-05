#!/usr/bin/env python3
"""Each federal seat's Labor and Coalition votes by how they were cast.

Adds vt2 to every division of map/data/res-<year>.json, beside vt (the formal
votes in each pile): {pile: [labor, coalition]}, a pile left out when it holds
no votes. The story column reads it for "How votes were cast".

  day    ordinary votes at polling places
  mob    ordinary votes taken by hospital, remote and other mobile teams
  ppvc   ordinary votes at early voting centres (from 2010)
  pre    declaration pre-poll votes
  post   postal votes
  abs    absent votes
  prov   provisional votes

Where the two sides come from:
  2016-2025  the AEC's two-party count by vote type, for every seat
  2004-2013  the AEC's two-candidate count by vote type (the AEC has no two-party
             product by vote type before 2016)
  1996-2001  the statistics packs' final count, pile by pile (HPPDOP)
Before 2016 only the seats whose final two were Labor and the Coalition carry vt2,
because a final two of any other pair says nothing about the two-party count.
1993's pack stops at the division after first preferences, so 1993 has no vt2.

Ordinary votes split by polling-place type from the res file's own booths, and
each seat's piles are checked against its final count before anything is written.

Patches the res files in place, so run it after anything that rewrites them
(geo_build.mjs, handbook_geo.mjs), then node .build/map/assemble.mjs.
test-map-page fails if a res file comes back without vt2.

Run: python3 -I .build/map/build_vote_piles.py
"""
import collections
import csv
import gzip
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / ".build/aec-flow-src"
ORACLE = SRC / "booth/oracle"
OUT = ROOT / "map/data"
COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ"}  # as build_map_data.py
TYPES = (("Ordinary", "ord"), ("Absent", "abs"), ("Provisional", "prov"), ("PrePoll", "pre"), ("Postal", "post"))
DECL = {"ABSENT": "abs", "PRE POLL": "pre", "POSTAL": "post", "PROVISIONAL": "prov"}
ORDER = ("day", "mob", "ppvc", "pre", "post", "abs", "prov")
EARLY, PLACE = 5, 1  # polling-place types: an early voting centre, a plain polling place


def rows(path):
    """an AEC tally-room file: a banner line, then the header"""
    with gzip.open(path, "rt", encoding="utf-8-sig") as f:
        return list(csv.DictReader(io.StringIO(f.read().split("\n", 1)[1])))


def classic(d):
    """[labor's index in the final two, coalition's], or None for any other pair"""
    fams = [d["c"][i][3] for i, _ in d["tcp"]]
    return (fams.index("alp"), fams.index("lnp")) if sorted(fams) == ["alp", "lnp"] else None


def booth_split(res):
    """each division's ordinary [labor, coalition] by kind of place, from its polling places

    A classic seat's booth two-party figure is its two-candidate figure, so the
    same lane serves every year; it is missing at a few 1998 places (Newcastle,
    which has no two-party count in the frame at all)."""
    b = res["booths"]
    out = collections.defaultdict(lambda: {"day": [0, 0], "mob": [0, 0], "ppvc": [0, 0]})
    missing = collections.Counter()
    for j, d in enumerate(b["d"]):
        t = b["tpp"][j] if j < len(b["tpp"]) else None
        if not t:
            missing[d] += 1
            continue
        ty = b["ty"][j]
        p = out[d]["ppvc" if ty == EARLY else "day" if ty == PLACE else "mob"]
        p[0] += t[0]
        p[1] += t[1]
    return out, missing


def piles_from_types(ord_pile, kinds, name):
    """ordinary split by kind of place; the places must add to the AEC's ordinary total"""
    a = sum(kinds[k][0] for k in ("day", "mob", "ppvc"))
    c = sum(kinds[k][1] for k in ("day", "mob", "ppvc"))
    assert (a, c) == tuple(ord_pile), f"{name}: places {a}/{c} v ordinary {ord_pile}"
    return {k: list(kinds[k]) for k in ("day", "mob", "ppvc")}


def tppvt(year):
    """2016 on: the AEC's two-party count by vote type"""
    R = rows(ORACLE / f"tppvt-{year}.csv.gz")
    cols = list(R[0].keys())
    def col(side, t):
        c = [x for x in cols if x.startswith(side) and x.endswith(t + "Votes")]
        assert len(c) == 1, (side, t, c)
        return c[0]
    return {int(r["DivisionID"]): {s: [int(r[col("Australian Labor", t)]), int(r[col("Liberal/National", t)])] for t, s in TYPES}
            for r in R if r["DivisionNm"].strip()}


def tcpcvt(year):
    """2004-2013: the two-candidate count by vote type, Labor v Coalition pairs only"""
    by = collections.defaultdict(list)
    for r in rows(ORACLE / f"tcpcvt-{year}.csv.gz"):
        if r["DivisionNm"].strip():
            by[int(r["DivisionID"])].append(r)
    out = {}
    for d, pair in by.items():
        lab = [r for r in pair if r["PartyAb"] == "ALP"]
        coa = [r for r in pair if r["PartyAb"] in COALITION]
        if len(pair) == 2 and len(lab) == 1 and len(coa) == 1:
            out[d] = {s: [int(lab[0][t + "Votes"]), int(coa[0][t + "Votes"])] for t, s in TYPES}
    return out


def hppdop(year, res):
    """1996-2001: the final count at every pile; ballot position n is the frame's c[n-1]"""
    last = collections.defaultdict(int)
    src = gzip.open(SRC / f"dop-{year}.csv.gz", "rt", encoding="utf-8-sig")
    R = [r for r in csv.DictReader(src, delimiter=";") if r["Polling Place"] != "DIVISION SUMMARY"]
    for r in R:
        last[r["Division"]] = max(last[r["Division"]], int(r["Count"]))
    id_of = {d["n"]: d["id"] for d in res["divs"]}
    out = collections.defaultdict(lambda: {s: [0, 0] for _, s in TYPES})
    for r in R:
        n = r["Division"]
        if int(r["Count"]) != last[n] or n not in id_of or r["Candidate Status"] not in ("E", "R") or not r["Vote"].strip():
            continue
        d = next(x for x in res["divs"] if x["n"] == n)
        sides = classic(d)
        if not sides:
            continue
        i = int(r["Ballot Position"]) - 1
        pair = [c for c, _ in d["tcp"]]
        if i not in pair:
            raise AssertionError(f"{year} {n}: ballot position {i + 1} is not in the final two {pair}")
        side = 0 if pair.index(i) == sides[0] else 1
        out[d["id"]][DECL.get(r["Polling Place"], "ord")][side] += int(r["Vote"])
    return out


def fix_ppvc(res):
    """vt.ppvc counted early centres' informal ballots too, unlike every other pile in vt;
    build_map_data.py now counts formal votes, and this brings the res files into line"""
    b = res["booths"]
    formal = collections.Counter()
    for j, d in enumerate(b["d"]):
        if b["ty"][j] == EARLY:
            formal[d] += sum(b["v"][j])
    for i, d in enumerate(res["divs"]):
        d["vt"]["ppvc"] = formal[i]


def build(year, res):
    fix_ppvc(res)
    source = "tppvt" if year >= 2016 else "tcpcvt" if year >= 2004 else "hppdop"
    tv = tppvt(year) if source == "tppvt" else tcpcvt(year) if source == "tcpcvt" else hppdop(year, res)
    kinds, missing = booth_split(res)
    made = 0
    for i, d in enumerate(res["divs"]):
        d.pop("vt2", None)
        if source != "tppvt" and not classic(d):
            continue
        v = tv.get(d["id"])
        if v is None:
            assert source != "tppvt", f"{year} {d['n']}: no two-party row"
            continue
        if missing[i]:
            # no booth figures to split ordinary by kind of place: all of it stays with the day
            split = {"day": list(v["ord"]), "mob": [0, 0], "ppvc": [0, 0]}
        else:
            split = piles_from_types(v["ord"], kinds[i], f"{year} {d['n']}")
        piles = {**split, **{s: v[s] for s in ("pre", "post", "abs", "prov")}}
        tot = [sum(p[0] for p in piles.values()), sum(p[1] for p in piles.values())]
        if source == "tppvt":
            want = d["tpp"][:2]
        else:
            sides = classic(d)
            want = [d["tcp"][sides[0]][1], d["tcp"][sides[1]][1]]
        assert tot == list(want), f"{year} {d['n']}: piles {tot} v final count {want}"
        vt2 = {k: piles[k] for k in ORDER if sum(piles[k])}
        # beside vt, so the file reads in order
        rebuilt = {}
        for k, x in d.items():
            rebuilt[k] = x
            if k == "vt":
                rebuilt["vt2"] = vt2
        d.clear()
        d.update(rebuilt)
        made += 1
    return made, source


def main():
    for year in (1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025):
        path = OUT / f"res-{year}.json"
        text = path.read_text(encoding="utf-8")
        res = json.loads(text)
        tail = "\n" if text.endswith("\n") else ""
        same = json.dumps(res, separators=(",", ":"), ensure_ascii=False) + tail
        assert same == text, f"{path.name} doesn't round-trip, so writing it would change more than vt2"
        made, source = build(year, res)
        path.write_text(json.dumps(res, separators=(",", ":"), ensure_ascii=False) + tail, encoding="utf-8")
        print(year, source, f"{made} of {len(res['divs'])} seats")


if __name__ == "__main__":
    main()
