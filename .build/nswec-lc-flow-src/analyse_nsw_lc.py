#!/usr/bin/env python3
"""NSW Legislative Council ATL preference-flow analysis, SGE2015 / SG1901 / SG2301.

Input: the NSWEC's per-ballot preference-data statewide zips ("LC Pref Data
Statewide.zip", one per election) from pastvtr.elections.nsw.gov.au; pass the
folder holding them. Sources and byte sizes are in this folder's README.md.

Ports the federal analyse_atl_flows.py cut to NSW: for each formal
above-the-line ballot (Types SATL = a single "1", RATL = a numbered ATL run),
restrict its group sequence to {ALP, COAL} and see which family appears
first; ballots listing neither are reported beside ("named neither" is NOT
exhaust - NSW LC ballots that name no major mostly stay with minor groups).
BTL ballots are excluded, as in the federal script.

The authoritative sequence is the PreferenceNumber column: the NSWEC records
it only for marks forming a valid consecutive run from 1, so a gap or
duplicate beyond the counted prefix is ignored (matches the NSWEC's count).

Reconciliation: the formal-ballot total and every group's pref-1 ATL count
must equal the NSWEC LC fp_summary page figures (hardcoded OFFICIAL below);
counts.json carries both so .build/test-nsw-lc-atl-flows.mjs re-pins them.

Run: python3 analyse_nsw_lc.py <dir-of-zips>   (stdlib only; writes counts.json)
"""
import collections
import csv
import io
import json
import os
import sys
import zipfile

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "counts.json")

ZIPS = {
    2015: "SGE2015-LC-Statewide.zip",
    2019: "SGE2019-LC-Statewide.zip",
    2023: "SG2301-LC-Statewide.zip",
}

# Per-year group letters -> party label, from the NSWEC LC fp_summary pages.
GROUP_LABELS = {
    2023: {
        "A": "Unnamed (Shelton et al.)", "B": "Unnamed (Kelly)",
        "C": "Animal Justice Party", "D": "Labor", "E": "Ungrouped",
        "F": "Socialist Alliance", "G": "Ungrouped",
        "H": "Elizabeth Farrelly Independents", "I": "Liberal / The Nationals",
        "J": "Liberal Democrats", "K": "Ungrouped", "L": "Public Education Party",
        "M": "IMOP", "N": "Shooters Fishers and Farmers",
        "O": "Legalise Cannabis Party", "P": "Ungrouped", "Q": "One Nation",
        "R": "The Greens", "S": "Sustainable Australia", "T": "Ungrouped",
        "U": "Unnamed",
    },
    2019: {
        "A": "Shooters, Fishers and Farmers", "B": "Socialist Alliance",
        "C": "Sustainable Australia", "D": "The Greens",
        "E": "Animal Justice Party", "F": "Advance", "G": "Unnamed G",
        "H": "Ungrouped", "I": "Flux", "J": "Labor / Country Labor",
        "K": "Liberal / The Nationals", "L": "Unnamed L",
        "M": "Australian Conservatives (NSW)", "N": "Keep Sydney Open",
        "O": "Liberal Democrats", "P": "Voluntary Euthanasia Party",
        "Q": "Christian Democratic Party (Fred Nile Group)",
        "R": "The Small Business Party", "S": "Unnamed S",
        "T": "Pauline Hanson's One Nation",
    },
    2015: {
        "A": "No Land Tax", "B": "Outdoor Recreation Party",
        "C": "Animal Justice Party", "D": "Unnamed D",
        "E": "Liberal / Nationals", "F": "Australian Motorist Party",
        "G": "Building Australia Party", "H": "Unnamed H",
        "I": "No Parking Meters Party", "J": "Unnamed J",
        "K": "Labor / Country Labor", "L": "Voluntary Euthanasia Party",
        "M": "Unnamed M", "N": "Shooters and Fishers", "O": "Socialist Alliance",
        "P": "Unnamed P", "Q": "Christian Democratic Party (Fred Nile Group)",
        "R": "The Fishing Party", "S": "The Greens", "T": "Australian Democrats",
        "U": "Ungrouped", "V": "Ungrouped", "W": "Ungrouped",
        "X": "Australian Cyclists Party",
    },
}

# Official NSWEC figures: formal-ballot total, and each group's ATL pref-1
# votes, from the election's LC state fp_summary page (links in README.md).
OFFICIAL = {
    2023: {"formal": 4616858, "ballots": 4895335, "atl": {
        "A": 50244, "B": 0, "C": 97895, "D": 1666891, "E": 0, "F": 16213,
        "G": 0, "H": 57873, "I": 1361663, "J": 159394, "K": 0, "L": 33111,
        "M": 20283, "N": 140530, "O": 163432, "P": 0, "Q": 260912,
        "R": 407352, "S": 41391, "T": 0, "U": 33084}},
    2019: {"formal": 4451146, "ballots": 4752827, "atl": {
        "A": 237624, "B": 12934, "C": 62337, "D": 416266, "E": 83665,
        "F": 3703, "G": 6174, "H": 0, "I": 15473, "J": 1296768, "K": 1530542,
        "L": 9478, "M": 24545, "N": 77920, "O": 93760, "P": 44744, "Q": 96565,
        "R": 29011, "S": 2652, "T": 288151}},
    2015: {"formal": 4316498, "ballots": 4574866, "atl": {
        "A": 77328, "B": 30399, "C": 74562, "D": 5959, "E": 1825480,
        "F": 27031, "G": 12046, "H": 2867, "I": 34106, "J": 4191, "K": 1325759,
        "L": 38923, "M": 2520, "N": 164330, "O": 7864, "P": 2514, "Q": 121555,
        "R": 31226, "S": 412660, "T": 22324, "U": 0, "V": 0, "W": 0, "X": 19985}},
}

FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"]


def family(label):
    u = label.upper()
    if "LABOR" in u:
        return "ALP"
    if "LIBERAL /" in u and "NATIONAL" in u:
        return "COAL"
    if "GREENS" in u:
        return "GRN"
    if "ONE NATION" in u:
        return "PHON"
    return "OTHER"


def analyse(year, zpath):
    labels = GROUP_LABELS[year]
    fam_of = {g: family(lab) for g, lab in labels.items()}
    zf = zipfile.ZipFile(zpath)
    name = next(n for n in zf.namelist() if n.lower().endswith(".txt"))

    counts = {fam: collections.Counter() for fam in FAMILIES}
    fam_oneonly = collections.Counter()
    fam_atl = collections.Counter()
    group_first = collections.Counter()
    rollup = collections.Counter()
    informal = 0

    cur_id = None
    cur = []

    def counted_seq(rows, typ):
        seq = sorted((int(r["prefnum"]), r["grp"])
                     for r in rows if r["typ"] == typ and r["prefnum"].isdigit())
        nums = [n for n, _ in seq]
        if nums != list(range(1, len(nums) + 1)):
            rollup["anomaly_counted_prefix_gap"] += 1
        return [g for _, g in seq]

    def flush(rows):
        nonlocal informal
        if rows[0]["formality"] != "Formal":
            informal += 1
            return
        types = {r["typ"] for r in rows}
        if "BTL" in types:
            rollup["BTL_ballots"] += 1
            return
        if types == {"SATL"}:
            rollup["SATL_ballots"] += 1
        elif types == {"RATL"}:
            rollup["RATL_ballots"] += 1
        elif types == {"SATL", "RATL"}:
            rollup["ATL_mixed_satl_ratl"] += 1
        else:
            rollup["other_" + "+".join(sorted(types))] += 1
            return
        seq = counted_seq(rows, "SATL") + counted_seq(rows, "RATL")
        if not seq:
            rollup["ATL_no_counted_prefix"] += 1
            return
        fams = [fam_of[g] for g in seq]
        src = fams[0]
        fam_atl[src] += 1
        group_first[seq[0]] += 1
        if types == {"SATL"}:
            fam_oneonly[src] += 1
        ralp = fams.index("ALP") if "ALP" in fams else None
        rco = fams.index("COAL") if "COAL" in fams else None
        if ralp is not None and (rco is None or ralp < rco):
            counts[src]["toALP"] += 1
        elif rco is not None:
            counts[src]["toCOAL"] += 1
        else:
            counts[src]["neither"] += 1

    with zf.open(name) as f:
        rd = csv.reader(io.TextIOWrapper(f, newline=""), delimiter="\t")
        next(rd)
        for row in rd:
            if len(row) < 12:
                continue
            bid = row[4]
            if bid != cur_id:
                if cur:
                    flush(cur)
                cur_id = bid
                cur = []
            cur.append({"typ": row[11], "formality": row[10],
                        "prefnum": row[6], "grp": row[8]})
    if cur:
        flush(cur)

    formal = (rollup["SATL_ballots"] + rollup["RATL_ballots"]
              + rollup["BTL_ballots"] + rollup["ATL_mixed_satl_ratl"])
    if formal != OFFICIAL[year]["formal"]:
        sys.exit(f"{year}: formal count {formal} != official {OFFICIAL[year]['formal']}")
    bad = [g for g in labels if group_first.get(g, 0) != OFFICIAL[year]["atl"].get(g, 0)]
    if bad:
        sys.exit(f"{year}: group pref-1 mismatch on {bad}")

    def full(counter):
        return {k: counter.get(k, 0) for k in ("toALP", "toCOAL", "neither")}

    atl_total = sum(fam_atl.values())
    one_total = sum(fam_oneonly.values())
    print(f"{year}: formal {formal:,} (= official); ATL {atl_total:,} "
          f"({rollup['SATL_ballots']:,} single-'1', {rollup['RATL_ballots']:,} multi); "
          f"BTL {rollup['BTL_ballots']:,}")
    return {
        "formal": formal,
        "officialFormal": OFFICIAL[year]["formal"],
        "atl": atl_total,
        "btl": rollup["BTL_ballots"],
        "atlOneOnly": one_total,
        "counts": {fam: full(counts[fam]) for fam in FAMILIES},
        "oneOnly": {fam: fam_oneonly.get(fam, 0) for fam in FAMILIES},
        "atlByFamily": {fam: fam_atl.get(fam, 0) for fam in FAMILIES},
        "groupFirst": {g: group_first.get(g, 0) for g in sorted(labels)},
        "officialGroupAtl": dict(sorted(OFFICIAL[year]["atl"].items())),
    }


def main():
    events = {}
    for year in sorted(ZIPS):
        zpath = os.path.join(SRC, ZIPS[year])
        if not os.path.exists(zpath):
            sys.exit(f"missing {zpath} (see README.md for the source URLs)")
        events[str(year)] = analyse(year, zpath)
    out = {"events": events}
    with open(OUT, "w") as fo:
        json.dump(out, fo, indent=1, sort_keys=True)
        fo.write("\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
