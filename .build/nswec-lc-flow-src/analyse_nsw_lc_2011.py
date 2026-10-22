#!/usr/bin/env python3
"""NSW Legislative Council ATL preference-flow analysis, SGE2011.

Same estimand and output shape as analyse_nsw_lc.py (2015/2019/2023), for
the 2011 election's ballot-level preference zip:

    https://pastvtr.elections.nsw.gov.au/SGE2011/data/sge_2011_lc_preferences.zip
    (652,275,238 bytes; saved beside this script as sge_2011_lc_preferences.zip)

The 2011 zip's BTLExpandedPreference.csv is ONE long csv
(BTL_EXPANDED_PREFERENCE_ID,VC_BALLOT_PAPER_ID,PREFERENCE,CANDIDATE_ID,TYPE,
~111M records) holding every formal ballot's EXPANDED preferences: the
count's pre-count step converts each above-the-line mark into the group's
candidates in draw order, and the per-ballot TYPE column preserves the
original mark — SATL = a single "1" above a group's box, RATL = a numbered
ATL run, BTL = below the line (excluded, as in the 2015-23 analysis; the
Readme.doc in the zip documents the layout and that all preferences after
a break or repeat in sequence have already been removed, matching the
"counted prefix" rule applied by the 2015-23 PreferenceNumber column). An
ATL ballot's group sequence is recovered as the consecutive-group blocks
of its expansion in PREFERENCE order; a SATL ballot's sequence is its group
alone. Candidate.csv (CANDIDATE_ID,CANDIDATE_NAME,GROUP_CODE,DRAW_ORDER)
maps each candidate to a group letter; ungrouped candidates carry a blank.

Reconciliation against TWO official sources committed beside this script in
published/: the NSWEC's r02 "First Preference Votes by Group" report
(sge2011-r02-fp-by-group.pdf; formal 4,076,024 over groups A-P plus
ungrouped) and Antony Green's NSW Election 2011 Final Analysis (NSW
Parliamentary Library Briefing Paper 3/2011, pp.44-53,
pnsw-2011-election-final-analysis-BP3-2011.pdf), whose per-group "Ticket
Votes (no preferences)" / "Ticket Votes (with preferences)" rows are the
official SATL / RATL ballot counts per group (they sum to 3,349,050 /
635,546). The run STOPS if its formal total, any group's ATL pref-1
count (SATL+RATL ballots), or any group's SATL/RATL split differs.

One Nation fielded no 2011 Legislative Council group (Pauline Hanson's
2011 ticket was an unnamed independent group, J — OTHER family), so the
PHON family stays zero and derives to null in the display table, like 2015.

Like analyse_nsw_lc.py it also takes the second tally (pa) of the same
ballots, restricted to {ALP, PHON} instead of {ALP, COAL}: per family,
ALP_first / ALP_only / PHON_first / PHON_only / neither, a ballot naming
only one of the pair counting its way. 2011's PHON cells all stay zero
(no One Nation group ran) — the display series nulls the year downstream.

Merges events["2011"] into counts.json (the 2015-23 events stand as they
are). Run: python3 analyse_nsw_lc_2011.py <dir-holding-the-zip>  (stdlib only)
"""
import collections
import json
import os
import sys
import zipfile

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "counts.json")

ZIP = "sge_2011_lc_preferences.zip"

# Per-group labels from the NSWEC r02 report / BP 3/2011 (committed in
# published/); order A-P then UNG, matching the official group fp rows.
GROUP_LABELS = {
    "A": "Liberal / Nationals", "B": "No Parking Meters Party",
    "C": "Unnamed (Hatton)", "D": "Outdoor Recreation Party",
    "E": "Save Our State", "F": "Christian Democratic Party (Fred Nile Group)",
    "G": "Family First", "H": "Labor / Country Labor", "I": "The Greens",
    "J": "Unnamed (Hanson)", "K": "Socialist Alliance",
    "L": "Australian Democrats", "M": "Building Australia",
    "N": "Restore the Workers' Rights Party", "O": "The Fishing Party",
    "P": "Shooters and Fishers", "UNG": "Ungrouped",
}

# Official figures: formal from the r02 report; SATL ("Ticket Votes (no
# preferences)") and RATL ("(with preferences)") per group from BP 3/2011.
OFFICIAL_FORMAL = 4076024
OFFICIAL_SATL = {
    "A": 1610615, "B": 36971, "C": 36520, "D": 23976, "E": 10731,
    "F": 85932, "G": 46588, "H": 856822, "I": 351605, "J": 66879,
    "K": 7017, "L": 26051, "M": 7221, "N": 14162, "O": 43505,
    "P": 124455, "UNG": 0,
}
OFFICIAL_RATL = {
    "A": 313299, "B": 11344, "C": 7856, "D": 6686, "E": 2391,
    "F": 37862, "G": 11544, "H": 96595, "I": 89153, "J": 11047,
    "K": 2991, "L": 6389, "M": 1552, "N": 3127, "O": 9896,
    "P": 23814, "UNG": 0,
}
OFFICIAL_GROUP_ATL = {g: OFFICIAL_SATL[g] + OFFICIAL_RATL[g] for g in GROUP_LABELS}

FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"]
PA = ["ALP_first", "ALP_only", "PHON_first", "PHON_only", "neither"]


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


def main():
    zpath = os.path.join(SRC, ZIP)
    if not os.path.exists(zpath):
        sys.exit(f"missing {zpath} (see README.md for the source URL)")
    zf = zipfile.ZipFile(zpath)
    names = [n for n in zf.namelist() if "/" not in n.strip("/")]
    cand_name = next(n for n in names if n.lower().endswith("candidate.csv"))
    pref_name = next(n for n in names if n.lower().endswith("btlexpandedpreference.csv"))

    cand_grp = {}
    with zf.open(cand_name) as f:
        text = (line.decode("ascii", "replace") for line in f)
        header = next(text)
        assert header.strip().upper() == "CANDIDATE_ID,CANDIDATE_NAME,GROUP_CODE,DRAW_ORDER", header
        for line in text:
            parts = line.rstrip("\r\n").split(",")
            if len(parts) < 4:
                continue
            cand_grp[int(parts[0])] = parts[2].strip().upper() or "UNG"
    assert len(cand_grp) == 311, f"expected the 311 candidates of SGE2011, got {len(cand_grp)}"

    fam_of = {g: family(lab) for g, lab in GROUP_LABELS.items()}

    counts = {fam: collections.Counter() for fam in FAMILIES}
    pa = {fam: collections.Counter() for fam in FAMILIES}
    fam_oneonly = collections.Counter()
    fam_atl = collections.Counter()
    group_first = collections.Counter()
    group_satl = collections.Counter()
    group_ratl = collections.Counter()
    rollup = collections.Counter()

    cur_id = None
    cur_type = None
    cur_seq = None      # consecutive-deduped group sequence, RATL only
    cur_group = None    # first group of the ballot (SATL tracking)
    cur_last_grp = None

    def atl_ballot(seq, oneonly, typ):
        fams = [fam_of[g] for g in seq]
        src = fams[0]
        fam_atl[src] += 1
        group_first[seq[0]] += 1
        (group_satl if typ == "SATL" else group_ratl)[seq[0]] += 1
        if oneonly:
            fam_oneonly[src] += 1
        ralp = fams.index("ALP") if "ALP" in fams else None
        rco = fams.index("COAL") if "COAL" in fams else None
        rph = fams.index("PHON") if "PHON" in fams else None
        srcpa = pa[src]
        if ralp is not None and rph is not None:
            srcpa["ALP_first" if ralp < rph else "PHON_first"] += 1
        elif ralp is not None:
            srcpa["ALP_only"] += 1
        elif rph is not None:
            srcpa["PHON_only"] += 1
        else:
            srcpa["neither"] += 1
        if ralp is not None and (rco is None or ralp < rco):
            counts[src]["toALP"] += 1
        elif rco is not None:
            counts[src]["toCOAL"] += 1
        else:
            counts[src]["neither"] += 1

    def flush():
        if cur_type == "SATL":
            rollup["SATL_ballots"] += 1
            atl_ballot([cur_group], True, "SATL")
        elif cur_type == "RATL":
            rollup["RATL_ballots"] += 1
            atl_ballot(cur_seq, False, "RATL")
        elif cur_type == "BTL":
            rollup["BTL_ballots"] += 1
        else:
            rollup["other_" + str(cur_type)] += 1

    with zf.open(pref_name) as f:
        text = (line.decode("ascii", "replace") for line in f)
        header = next(text)
        assert header.strip().upper() == "BTL_EXPANDED_PREFERENCE_ID,VC_BALLOT_PAPER_ID,PREFERENCE,CANDIDATE_ID,TYPE", header
        for line in text:
            p = line.split(",")
            if len(p) < 5:
                rollup["short_rows"] += 1
                continue
            bid = p[1]
            if bid != cur_id:
                if cur_id is not None:
                    flush()
                cur_id = bid
                cur_type = p[4].rstrip("\r\n")
                cur_seq = []
                cur_group = None
                cur_last_grp = None
            typ = cur_type
            if typ == "BTL":
                continue
            cid = int(p[3])
            grp = cand_grp[cid]
            if typ == "SATL":
                if cur_group is None:
                    cur_group = grp
            else:  # RATL: rebuild the ATL sequence from consecutive blocks
                if grp != cur_last_grp:
                    cur_seq.append(grp)
                    cur_last_grp = grp
    if cur_id is not None:
        flush()

    formal = (rollup["SATL_ballots"] + rollup["RATL_ballots"]
              + rollup["BTL_ballots"])
    if formal != OFFICIAL_FORMAL:
        sys.exit(f"2011: formal count {formal} != official {OFFICIAL_FORMAL} "
                 f"(SATL {rollup['SATL_ballots']:,} RATL {rollup['RATL_ballots']:,} "
                 f"BTL {rollup['BTL_ballots']:,} other {dict((k, v) for k, v in rollup.items() if k.startswith('other_'))})")
    bad = [g for g in GROUP_LABELS if group_first.get(g, 0) != OFFICIAL_GROUP_ATL[g]]
    if bad:
        sys.exit(f"2011: group ATL pref-1 mismatch on {bad}")
    bad = [g for g in GROUP_LABELS if group_satl.get(g, 0) != OFFICIAL_SATL[g]]
    if bad:
        sys.exit(f"2011: group SATL (ticket no-pref) mismatch on {bad}")
    bad = [g for g in GROUP_LABELS if group_ratl.get(g, 0) != OFFICIAL_RATL[g]]
    if bad:
        sys.exit(f"2011: group RATL (ticket with-pref) mismatch on {bad}")

    def full(counter):
        return {k: counter.get(k, 0) for k in ("toALP", "toCOAL", "neither")}

    def full_pa(counter):
        return {k: counter.get(k, 0) for k in PA}

    atl_total = sum(fam_atl.values())
    one_total = sum(fam_oneonly.values())
    print(f"2011: formal {formal:,} (= official); ATL {atl_total:,} "
          f"({rollup['SATL_ballots']:,} single-'1', {rollup['RATL_ballots']:,} multi); "
          f"BTL {rollup['BTL_ballots']:,}")
    event = {
        "formal": formal,
        "officialFormal": OFFICIAL_FORMAL,
        "atl": atl_total,
        "btl": rollup["BTL_ballots"],
        "atlOneOnly": one_total,
        "counts": {fam: full(counts[fam]) for fam in FAMILIES},
        "pa": {fam: full_pa(pa[fam]) for fam in FAMILIES},
        "oneOnly": {fam: fam_oneonly.get(fam, 0) for fam in FAMILIES},
        "atlByFamily": {fam: fam_atl.get(fam, 0) for fam in FAMILIES},
        "groupFirst": {g: group_first.get(g, 0) for g in sorted(GROUP_LABELS)},
        "officialGroupAtl": dict(sorted(OFFICIAL_GROUP_ATL.items())),
        "groupSatl": {g: group_satl.get(g, 0) for g in sorted(GROUP_LABELS)},
        "groupRatl": {g: group_ratl.get(g, 0) for g in sorted(GROUP_LABELS)},
        "officialGroupSatl": dict(sorted(OFFICIAL_SATL.items())),
        "officialGroupRatl": dict(sorted(OFFICIAL_RATL.items())),
    }
    counts_path = OUT
    out = {"events": {}}
    if os.path.exists(counts_path):
        with open(counts_path) as fi:
            out = json.load(fi)
    out.setdefault("events", {})["2011"] = event
    with open(counts_path, "w") as fo:
        json.dump(out, fo, indent=1, sort_keys=True)
        fo.write("\n")
    print(f"{counts_path}: events['2011'] merged")


if __name__ == "__main__":
    main()
