#!/usr/bin/env python3
"""SA Legislative Council first-preference counts, 2022 & 2026.

Sources (all official ECSA, mirrored in .build/state-flow-src/sa/lc/; see
README.md in this folder for the URLs): the results API behind
result.ecsa.sa.gov.au — LCStatic/<date> names each party id, and
LCChange/<date>/0 carries each party's statewide first-preference vote
total beside the election's totalFormalVotes.

Guards: electionStatus must be "final", and the party votes must sum
exactly to totalFormalVotes.

Output: sa.json — {"events": {year: {formal, byParty, byFamily}}}.

Run from the repo root:  python3 .build/state-lc-primaries/parse-sa-lc.py
(stdlib only; writes sa.json beside itself)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "state-flow-src", "sa", "lc"))
OUT = os.path.join(HERE, "sa.json")

FAMS = {
    "ALP": "ALP",
    "LIB": "COAL", "NAT": "COAL",
    "GRN": "GRN", "Greens": "GRN",
    "ONP": "ONP", "PHON": "ONP",
}

YEARS = {"2022": "2022-03-19", "2026": "2026-03-21"}


def main():
    events = {}
    for year, iso in YEARS.items():
        static = json.load(open(os.path.join(SRC, f"lcstatic-{iso}.json")))
        change = json.load(open(os.path.join(SRC, f"lcchange-{iso}.json")))
        if change.get("electionStatus") != "final":
            raise SystemExit(f"{year}: not final ({change.get('electionStatus')})")
        names = {p["id"]: (p["partyName"], p.get("partyId") or "")
                 for p in static.get("parties", [])}
        formal = change["totalFormalVotes"]
        by_party = {}
        by_family = {}
        for p in change.get("parties", []):
            name, pid = names.get(p["id"], (f"party-{p['id']}", ""))
            by_party[name] = by_party.get(name, 0) + p["votes"]
            fam = FAMS.get(pid) or FAMS.get(name, "OTHER")
            by_family[fam] = by_family.get(fam, 0) + p["votes"]
        # ungrouped candidates ride no party entry: the residual is theirs
        ungrouped = formal - sum(by_party.values())
        if ungrouped < 0 or ungrouped / formal > 0.005:
            raise SystemExit(f"{year}: party votes {sum(by_party.values())} "
                             f"vs totalFormalVotes {formal}")
        if ungrouped:
            by_party["Ungrouped"] = ungrouped
            by_family["OTHER"] = by_family.get("OTHER", 0) + ungrouped
        for k in ("ALP", "COAL", "GRN", "ONP", "OTHER"):
            by_family.setdefault(k, 0)
        events[year] = {"formal": formal, "byParty": dict(sorted(by_party.items())),
                        "byFamily": by_family}
        print(f"{year}: formal {formal:,}, {len(by_party)} parties")
        for name, v in sorted(by_party.items(), key=lambda kv: -kv[1])[:6]:
            print(f"   {name}: {v / formal * 100:.2f}%")

    with open(OUT, "w") as f:
        json.dump({"events": events}, f, indent=1, sort_keys=True)
        f.write("\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
