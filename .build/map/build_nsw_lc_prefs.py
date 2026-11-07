#!/usr/bin/env python3
"""NSW Legislative Council upper-house preference lenses for the /map/ state frames.

Emits maps/data/senate-prefs-<frame>.json for nsw15/nsw19/nsw23 in the federal
senate-prefs-<year>.json schema (see .build/map/senate_prefs.mjs, whose output
contract this mirrors key-for-key, plus "lc": true and a venueJoin provenance
block), computed from the NSWEC's per-ballot LC preference statewide zips
(already mirrored in .build/nswec-lc-flow-src/; never refetched).

Per formal above-the-line ballot (Types SATL = a lone "1", RATL = a numbered
ATL run; BTL excluded per the federal producer's own rule) over three pair
contests (ALP v Coalition "AC", ALP v One Nation "AO", Coalition v One Nation
"CO") and the three donor cohorts that decide each (the same geometry as the
federal cells(): pairs x donors x [x, y, nei] = 27 counts), per district and
per res-frame polling venue. A ballot's counted-file family is the family of
its FIRST-ranked group letter in the valid consecutive PreferenceNumber run
(the NSWEC records PreferenceNumber only for marks forming a valid run from
1, so digit rows already are the counted prefix).

One Nation fielded no LC group in 2015: the AO/CO pair cells are emitted as
zeros and the file carries the federal absent convention {"NSW": ["onp"]}
(the lens shows no figure rather than 100% for the present rival; nei would
otherwise soak every ballot that could not rank the missing party).

Venue placement joins the ballot's (District, Venue/VoteSubType) to the res
frame's booth roll by same district + same normalised name, expanding nothing
else; VoteType "DV" (Absent/iVote/Postal/Enrolment/Provisional) ballots have
no venue in the frame by construction and land in byNameMisses alongside any
genuine name misses. Missed ballots still feed their district's cells —
district cells never move with venue misses; venue cells only move counts.

Guard pins (values measured on the frozen sources 2026-11-04; fail loudly):
  * every frame's matched share of joinable formal ATL ballots (VoteType in
    PP/PR/DI; DV is structurally venue-less) >= GUARD_MIN_MATCH_SHARE (worst:
    nsw15's 2016-lot roll era);
  * per-(pair, donor) x+y+nei cell triples == that donor family's district
    ATL tally; summed over districts == counts.json's atlByFamily, BYTE-EXACT;
  * formal ATL read == counts.json's atl; BTL read == counts.json's btl;
  * the zip's District set == the res frame's 93-district roster, per era
    (2013 redistribution names for nsw15/nsw19; 2021 names for nsw23);
  * every district's ATL tally > 0; matched + missed == ATL exactly.

Deterministic: one pass per frame, stdlib only; re-run is byte-identical.

Run: python3 -I .build/map/build_nsw_lc_prefs.py
"""
import collections
import csv
import io
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC_DIR = os.path.join(ROOT, ".build", "nswec-lc-flow-src")
COUNTS = json.load(open(os.path.join(SRC_DIR, "counts.json")))
MAP_DATA = os.path.join(ROOT, "maps", "data")

FRAMES = [  # (frame id, election year, zip name, absent record)
    ("nsw15", 2015, "SGE2015-LC-Statewide.zip", {"NSW": ["onp"]}),
    ("nsw19", 2019, "SGE2019-LC-Statewide.zip", {}),
    ("nsw23", 2023, "SG2301-LC-Statewide.zip", {}),
]

# Measured guard pins (frozen sources; see module docstring).
GUARD_MIN_MATCH_SHARE = 0.90  # of joinable (non-"DV" VoteType) formal ATL ballots
GUARD_MIN_BOOTHS = {"nsw15": 2500, "nsw19": 2300, "nsw23": 2500}  # venue ids with votes
GUARD_DIVS = 93

# --- lifted verbatim from .build/nswec-lc-flow-src/analyse_nsw_lc.py -------
# (per-year group letters -> party label, and the label -> family mapping;
#  do not import: the analysis script is its own entry point.)
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
# --- end lift ---------------------------------------------------------------


PAIRS = ["AC", "AO", "CO"]
DONORS = {"AC": ["grn", "onp", "oth"], "AO": ["lnp", "grn", "oth"], "CO": ["alp", "grn", "oth"]}
PAIR_SIDES = {"AC": ("ALP", "COAL"), "AO": ("ALP", "PHON"), "CO": ("COAL", "PHON")}
DONOR_SIDE = {"alp": "ALP", "lnp": "COAL", "grn": "GRN", "onp": "PHON", "oth": "OTHER"}

SOURCE = ("Every formal above-the-line NSW Legislative Council ballot, {year} "
          "(NSWEC LC Pref Data Statewide.zip), grouped into Labor, the Liberals "
          "and Nationals, the Greens, One Nation and the rest via the committed "
          "nswec-lc-flow-src/analyse_nsw_lc.py family mapping; by polling place "
          "joined to the frame's venue roll")


def fail(msg):
    sys.exit(f"build_nsw_lc_prefs: FAIL: {msg}")


def norm_name(s):
    return " ".join(s.split()).lower()


def build_frame(fid, year, zip_name):
    """One pass over the frame's zip; computes all pair cells (pre-zero)."""
    res_path = os.path.join(MAP_DATA, f"res-{fid}.json")
    res = json.load(open(res_path))
    if res.get("year") != fid:
        fail(f"{fid}: res frame year {res.get('year')!r} != {fid!r}")
    roster = [d["n"] for d in res["divs"]]
    if len(roster) != GUARD_DIVS:
        fail(f"{fid}: res roster {len(roster)} != {GUARD_DIVS}")
    b = res["booths"]
    n_booths = len(b["id"])
    venue_key = {}  # (district idx, normalised venue name) -> booth array idx
    for i in range(n_booths):
        k = (b["d"][i], norm_name(b["n"][i]))
        if k in venue_key:
            fail(f"{fid}: duplicate (district, name) venue pair {k!r} in res roll")
        venue_key[k] = i
    roster_idx = {n: i for i, n in enumerate(roster)}

    fam_of_group = {g: family(lab) for g, lab in GROUP_LABELS[year].items()}

    # 27-cell accumulators (computed for ALL pairs; absent-party zeroing is
    # an emission-time byte choice only)
    div_cells = {name: [0] * 27 for name in roster}
    booth_cells = {b["id"][i]: [0] * 27 for i in range(n_booths)}

    rollup = collections.Counter()
    fam_atl = collections.Counter()
    dist_atl = collections.Counter()
    dist_fam = {n: collections.Counter() for n in roster}
    vt_atl = collections.Counter()
    matched = 0
    missed = 0
    by_name_miss = collections.Counter()  # (district, venue label) -> ballots
    zip_districts = set()

    def flush(district, vtype, venue, rows):
        """rows: (typ, prefnum, grp, formality) of one ballot; mirrors
        analyse_nsw_lc.py's contiguous-ballid grouping, formality gate,
        SATL/RATL/BTL partition and counted-prefix handling exactly
        (counts.json was produced by that partition, so byte-exact
        reconciliation stands or falls on matching it)."""
        nonlocal matched, missed
        if rows[0][3] != "Formal":
            rollup["informal_ballots"] += 1
            return
        types = set(r[0] for r in rows)
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
        counted = []
        for want_typ in ("SATL", "RATL"):
            seq = sorted((int(r[1]), r[2]) for r in rows
                         if r[0] == want_typ and r[1].isdigit())
            nums = [n for n, _ in seq]
            if nums and nums != list(range(1, len(nums) + 1)):
                rollup["anomaly_counted_prefix_gap"] += 1
            counted.extend(g for _, g in seq)
        if not counted:
            rollup["ATL_no_counted_prefix"] += 1
            return
        fams = [fam_of_group[g] for g in counted]
        src = fams[0]
        fam_atl[src] += 1
        dist_atl[district] += 1
        dist_fam[district][src] += 1
        vt_atl[vtype] += 1
        pos = {fam: (fams.index(fam) if fam in fams else None)
               for fam in ("ALP", "COAL", "PHON")}
        # the cells this ballot donates: per pair and donor it belongs to
        adds = []
        for pi, pr in enumerate(PAIRS):
            for di, donor in enumerate(DONORS[pr]):
                if DONOR_SIDE[donor] != src:
                    continue
                ra, rb = pos[PAIR_SIDES[pr][0]], pos[PAIR_SIDES[pr][1]]
                off = pi * 9 + di * 3
                if ra is None and rb is None:
                    cell = off + 2            # nei
                elif rb is None or (ra is not None and ra < rb):
                    cell = off                # x
                else:
                    cell = off + 1            # y
                adds.append(cell)
        dc = div_cells[district]
        for cell in adds:
            dc[cell] += 1
        # venue placement: DV ballots are structurally venue-less; everything
        # else joins by (district, normalised name), expanding nothing else
        placed = None
        if vtype != "DV":
            placed = venue_key.get((roster_idx[district], norm_name(venue)))
        if placed is None:
            missed += 1
            by_name_miss[(district, venue)] += 1
            return
        matched += 1
        bc = booth_cells[b["id"][placed]]
        for cell in adds:
            bc[cell] += 1

    zpath = os.path.join(SRC_DIR, zip_name)
    zf = zipfile.ZipFile(zpath)
    member = next(n for n in zf.namelist() if n.lower().endswith(".txt"))
    cur_id, cur_meta, cur_rows = None, None, []
    with zf.open(member) as fh:
        rd = csv.reader(io.TextIOWrapper(fh, newline=""), delimiter="\t")
        next(rd)
        for row in rd:
            if len(row) < 12:
                continue
            bid = row[4]
            if bid != cur_id:
                if cur_rows:
                    flush(*cur_meta, cur_rows)
                cur_id = bid
                cur_meta = (row[1], row[2], row[3])
                zip_districts.add(row[1])
                cur_rows = []
            cur_rows.append((row[11], row[6], row[8], row[10]))
        if cur_rows:
            flush(*cur_meta, cur_rows)
    zf.close()

    # --- reconciliations against the committed bank (fail loudly) -----------
    want = COUNTS["events"][str(year)]
    if zip_districts != set(roster):
        fail(f"{fid}: zip/res district roster mismatch: "
             f"zip-only {sorted(zip_districts - set(roster))}, "
             f"res-only {sorted(set(roster) - zip_districts)}")
    atl = sum(fam_atl.values())
    if atl != want["atl"]:
        fail(f"{fid}: formal ATL read {atl} != counts.json atl {want['atl']}")
    if rollup["BTL_ballots"] != want["btl"]:
        fail(f"{fid}: BTL read {rollup['BTL_ballots']} != counts.json btl "
             f"{want['btl']}")
    if sum(dist_atl.values()) != atl:
        fail(f"{fid}: district ATL sums {sum(dist_atl.values()):,} != ATL {atl:,}")
    for fam in ("ALP", "COAL", "GRN", "PHON", "OTHER"):
        if fam_atl.get(fam, 0) != want["atlByFamily"][fam]:
            fail(f"{fid}: family {fam} ATL {fam_atl.get(fam, 0):,} != "
                 f"counts.json {want['atlByFamily'][fam]:,} (byte-exact pin)")
    zero_districts = [n for n in roster if dist_atl.get(n, 0) == 0]
    if zero_districts:
        fail(f"{fid}: districts with zero ATL ballots: {zero_districts}")
    for name in roster:
        cells = div_cells[name]
        for pi, pr in enumerate(PAIRS):
            for di, donor in enumerate(DONORS[pr]):
                tri = sum(cells[pi * 9 + di * 3: pi * 9 + di * 3 + 3])
                want_tri = dist_fam[name].get(DONOR_SIDE[donor], 0)
                if tri != want_tri:
                    fail(f"{fid}: {name} pair {pr} donor {donor} x+y+nei "
                         f"{tri:,} != district {donor} ATL {want_tri:,}")
    # pair-semantics pin: statewide triples must equal the bank's INDEPENDENT
    # tallies (counts: ALP v COAL; pa: ALP v PHON; pc: COAL v PHON), byte-exact
    sums = {(pr, dn): [0, 0, 0] for pr in PAIRS for dn in DONORS[pr]}
    for cells in div_cells.values():
        for pi, pr in enumerate(PAIRS):
            for di, dn in enumerate(DONORS[pr]):
                t = sums[(pr, dn)]
                t[0] += cells[pi * 9 + di * 3]
                t[1] += cells[pi * 9 + di * 3 + 1]
                t[2] += cells[pi * 9 + di * 3 + 2]
    for (pr, dn), v in sums.items():
        fam = DONOR_SIDE[dn]
        if pr == "AC":
            w = want["counts"][fam]
            want_tri = [w["toALP"], w["toCOAL"], w["neither"]]
        elif pr == "AO":
            w = want["pa"][fam]
            want_tri = [w["ALP_first"] + w["ALP_only"],
                        w["PHON_first"] + w["PHON_only"], w["neither"]]
        else:
            w = want["pc"][fam]
            want_tri = [w["COAL_first"] + w["COAL_only"],
                        w["PHON_first"] + w["PHON_only"], w["neither"]]
        if v != want_tri:
            fail(f"{fid}: pair {pr} donor {dn} statewide {v} != "
                 f"counts.json independent tally {want_tri} (byte-exact pin)")
    joinable = atl - vt_atl.get("DV", 0)
    share = matched / joinable if joinable else 0.0
    if matched + missed != atl:
        fail(f"{fid}: matched {matched:,} + missed {missed:,} != ATL {atl:,}")
    if share < GUARD_MIN_MATCH_SHARE:
        fail(f"{fid}: matched venue share {share:.4%} < guard "
             f"{GUARD_MIN_MATCH_SHARE:.2%}")
    n_placed_booths = sum(1 for v in booth_cells.values() if sum(v))
    if n_placed_booths < GUARD_MIN_BOOTHS[fid]:
        fail(f"{fid}: only {n_placed_booths} venues received votes "
             f"(< floor {GUARD_MIN_BOOTHS[fid]})")

    return {
        "res_n_booths": n_booths,
        "roster": roster,
        "booth_ids": [b["id"][i] for i in range(n_booths)],
        "div_cells": div_cells,
        "booth_cells": booth_cells,
        "rollup": rollup,
        "fam_atl": fam_atl,
        "dist_fam": dist_fam,
        "vt_atl": vt_atl,
        "matched": matched,
        "missed": missed,
        "share": share,
        "joinable": joinable,
        "miss_groups": by_name_miss,
        "formal_read": (rollup["SATL_ballots"] + rollup["RATL_ballots"]
                        + rollup["ATL_mixed_satl_ratl"]
                        + rollup["BTL_ballots"]),
    }


def emit_frame(fid, year, absent, st):
    """Writes senate-prefs-<fid>.json in the federal schema key order."""
    def emit_cells(computed):
        if "onp" not in absent.get("NSW", []):
            return computed
        # One Nation absent: its pairs' cells go to zero (federal lens
        # convention: the lens shows no figure, never 100% for the rival)
        return computed[:9] + [0] * 18

    divs = {name: emit_cells(st["div_cells"][name]) for name in st["roster"]}
    booths = {}
    for i, vid in enumerate(st["booth_ids"]):
        cells = st["booth_cells"][vid]
        if sum(cells):
            booths[vid] = emit_cells(cells)
    misses_sorted = sorted(st["miss_groups"].items())
    out = {
        "year": fid,
        "lc": True,
        "pairs": PAIRS,
        "donors": DONORS,
        "absent": absent,
        "source": SOURCE.format(year=year),
        "divs": divs,
        "booths": booths,
        "venueJoin": {
            "matched": st["matched"],
            "missed": st["missed"],
            "byNameMisses": [
                [k[0] for k, _ in misses_sorted],
                [k[1] for k, _ in misses_sorted],
                [n for _, n in misses_sorted],
            ],
        },
    }
    out_path = os.path.join(MAP_DATA, f"senate-prefs-{fid}.json")
    with open(out_path, "w", newline="") as fo:
        json.dump(out, fo, separators=(",", ":"))
    return out_path, len(booths)


def self_check(fid, absent, st, n_booths_emitted):
    """Reloads the written file and re-verifies the emitted contract."""
    out = json.load(open(os.path.join(MAP_DATA, f"senate-prefs-{fid}.json")))
    if list(out) != ["year", "lc", "pairs", "donors", "absent", "source",
                     "divs", "booths", "venueJoin"]:
        fail(f"{fid}: emitted key order drifted: {list(out)}")
    if out["year"] != fid or out["lc"] is not True:
        fail(f"{fid}: emitted year/lc markers wrong")
    if len(out["divs"]) != GUARD_DIVS:
        fail(f"{fid}: emitted divs {len(out['divs'])} != {GUARD_DIVS}")
    if len(out["booths"]) != n_booths_emitted:
        fail(f"{fid}: emitted booths count changed on reload")
    zero_pairs = {"AO", "CO"} if absent.get("NSW") else set()
    for table, label in ((out["divs"], "div"), (out["booths"], "booth")):
        for name, cells in table.items():
            if len(cells) != 27 or any(not isinstance(c, int) for c in cells):
                fail(f"{fid}: {label} {name}: cells not 27 ints")
            if cells != [int(c) for c in cells] or sum(cells) < 0:
                fail(f"{fid}: {label} {name}: negative cells")
    # every emitted triple reconciles: computed pairs vs district tallies,
    # zeroed pairs exactly zero (nsw15's PHON donor cohort is zero natively)
    for name, cells in out["divs"].items():
        for pi, pr in enumerate(PAIRS):
            for di, donor in enumerate(DONORS[pr]):
                tri = sum(cells[pi * 9 + di * 3: pi * 9 + di * 3 + 3])
                if pr in zero_pairs:
                    want_tri = 0
                else:
                    want_tri = st["dist_fam"][name].get(DONOR_SIDE[donor], 0)
                if tri != want_tri:
                    fail(f"{fid}: emitted {name} pair {pr} donor {donor} "
                         f"sum {tri:,} != pin {want_tri:,}")
    # venueJoin totals are the venue-level truth of the scan
    vj = out["venueJoin"]
    atl = sum(st["fam_atl"].values())
    if vj["matched"] + vj["missed"] != atl:
        fail(f"{fid}: emitted venueJoin {vj['matched']}+{vj['missed']} != ATL")
    bnm = vj["byNameMisses"]
    if len(bnm) != 3 or not (len(bnm[0]) == len(bnm[1]) == len(bnm[2])):
        fail(f"{fid}: emitted byNameMisses columns misaligned")
    if sum(bnm[2]) != vj["missed"]:
        fail(f"{fid}: emitted byNameMisses counts {sum(bnm[2]):,} != missed")


def main():
    for fid, year, zip_name, absent in FRAMES:
        st = build_frame(fid, year, zip_name)
        out_path, n_emitted = emit_frame(fid, year, absent, st)
        self_check(fid, absent, st, n_emitted)
        want = COUNTS["events"][str(year)]
        r = st["rollup"]
        atl = want["atl"]
        print(f"== {fid} ({year}) -> {out_path}")
        print(f"  cells: {GUARD_DIVS} district cells; {n_emitted} venue ids "
              f"with votes (of {st['res_n_booths']} in the res roll); "
              f"{len(st['miss_groups'])} unmatched (district, venue) groups")
        print(f"  ballots: ATL {atl:,} (SATL {r['SATL_ballots']:,} + "
              f"RATL {r['RATL_ballots']:,} + mixed "
              f"{r['ATL_mixed_satl_ratl']:,}) | BTL {want['btl']:,} | "
              f"informal {r['informal_ballots']:,} | formal read "
              f"{st['formal_read']:,} vs counts.json formal {want['formal']:,}")
        print("  ATL by family (mine == counts.json atlByFamily):")
        for fam in ("ALP", "COAL", "GRN", "PHON", "OTHER"):
            mine = st["fam_atl"].get(fam, 0)
            print(f"    {fam:6s} {mine:>10,} == {want['atlByFamily'][fam]:>10,}")
        dv = st["vt_atl"].get("DV", 0)
        print(f"  venue join: matched {st['matched']:,} + missed "
              f"{st['missed']:,} == ATL {atl:,}; matched share of joinable "
              f"(non-DV) ballots {st['matched']:,}/{st['joinable']:,} = "
              f"{st['share']:.4%} (guard >= {GUARD_MIN_MATCH_SHARE:.2%}); "
              f"DV structural share {dv / atl:.2%} of ATL")
        extra = {k: v for k, v in r.items()
                 if k not in ("informal_ballots", "SATL_ballots",
                              "RATL_ballots", "ATL_mixed_satl_ratl",
                              "BTL_ballots")}
        print(f"  anomalies: {extra or 'none'}")
        print(f"  absent: {json.dumps(absent)}")
        print(f"  wrote {out_path} ({os.path.getsize(out_path):,} bytes)")
    print("RESULT=ok")


if __name__ == "__main__":
    main()
