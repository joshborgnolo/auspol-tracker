#!/usr/bin/env python3
"""ATL Senate preference-flow analysis across the four elections since group
voting tickets were abolished: 2016 (event 20499), 2019 (24310), 2022 (27966)
and 2025 (31496). Elections before 2016 ran party tickets, so no per-ballot
CSVs exist for them and no ordinal-1-reading flows can be computed.

Usage: analyse_atl_flows.py [EVENT]        (default 31496)

Input, in one dir (AEC_DATA_DIR, default this script's own dir):
- aec-senate-formalpreferences-<EVENT>-<STATE>.csv          (ballot-level, per state)
- SenateStateDOPDownload-<EVENT>-<STATE>.csv                (TotalFormalPapers checks)
- SenateFirstPrefsByStateByGroupByVoteTypeDownload-<EVENT>.csv (reconciliation)
- SenateCandidatesDownload-<EVENT>.csv                      (2019+: group-vs-candidate columns)
- aec-senate-candidateinformation-20499.zip                 (2016 only: ballot layout)

For each ATL ballot the analyser classifies (1) ALP orientation: any ALP
group listed before any Coalition group (LP/NP/LNP/CLP etc.) -- the Senate
two-party-preferred flow convention -- vs Coalition-before-ALP vs neither
family listed; (2) the exit destination: the first family listed that is not
the ballot's own; (3) the Labor-v-One-Nation pair: restricted to {ALP, PHON},
which family is listed first, or only one listed, or neither ("pa" counts --
the explainer's Labor v One Nation Senate bank); (4) the Coalition-v-One-
Nation pair: restricted to {COAL, PHON} likewise ("pc" counts -- the
explainer's Coalition v One Nation Senate bank). BTL ballots (and mixed
papers under the savings provisions) are excluded from the ATL tallies, and
their first preferences join the first-prefs reconciliation only.

2016's formal-preferences files are a DIFFERENT format: one positional
Preferences string per ballot (group slots, then candidate slots in ballot
order), laid out by aec-senate-candidateinformation-20499.csv; 2019+ files
carry one column per group and per candidate. Both resolve to the same
counters here.

Cross-checks: row counts vs each state's DoP TotalFormalPapers; family
first-preference totals vs SenateFirstPrefsByStateByGroupByVoteTypeDownload;
the national COAL pair cells against the previously verified figures
(ORACLE_ON below) and the national ALP Coalition-v-One-Nation pair cells
against the pinned ORACLE_CON. Any check failure aborts before output is
written.

Writes atl_flow_results-<EVENT>.json (AEC_RESULTS_DIR, default this script's
dir). merge_pa_counts.py folds the pa blocks of the four events' results
into counts.json, merge_pc_counts.py the pc blocks (each recomputes the
committed blocks byte-for-byte before folding its own in).
"""
import csv, json, sys, os, glob, zipfile

EVENT = sys.argv[1] if len(sys.argv) > 1 else "31496"
EVENT_YEAR = {"20499": 2016, "24310": 2019, "27966": 2022, "31496": 2025}
if EVENT not in EVENT_YEAR:
    sys.exit(f"unknown event {EVENT} (want one of {sorted(EVENT_YEAR)})")
YEAR = EVENT_YEAR[EVENT]
POS = (EVENT == "20499")    # 2016: positional-string format
BASE = os.environ.get("AEC_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("AEC_RESULTS_DIR", os.path.dirname(os.path.abspath(__file__)))
STATES = ["ACT", "NT", "NSW", "VIC", "QLD", "WA", "SA", "TAS"]

MAX_FIELDS = 1000
csv.field_size_limit(10_000_000)

def family(group_name: str) -> str:
    nm = " ".join(group_name.upper().split())
    if "GREENS" in nm:
        return "GRN"
    if "ONE NATION" in nm or "PAULINE HANSON" in nm:
        return "PHON"
    if "LIBERTARIAN" in nm or "LIBERAL DEMOCRATS" in nm or "LIBERAL DEMOCRAT" in nm:
        return "OTHER"
    if "FRASER ANNING" in nm:   # 2019's Conservative National Party is no Coalition
        return "OTHER"
    toks = nm.split()
    # no COUNTRY token: 2016's Australian Country Party and 2019's Country
    # Labor are no Coalition (Country Liberals (NT) matches via LIBERAL)
    if "LIBERAL" in nm or "NATIONAL" in nm or "CLP" in toks or "LNP" in toks:
        return "COAL"
    # A.L.P. carries no "LABOR" substring (NT's registered 2022 name) - match
    # on the dot-emptied token list ("A.L.P." -> "ALP"; strip(".") only eats
    # the outer dots and leaves "A.L.P")
    if "LABOR" in nm or "ALP" in [t.replace(".", "") for t in toks]:
        return "ALP"
    return "OTHER"

DESTS = ["toALP", "toCOAL", "neither"]
FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"]
PA = ["ALP_first", "ALP_only", "PHON_first", "PHON_only", "neither"]
PC = ["COAL_first", "COAL_only", "PHON_first", "PHON_only", "neither"]

# previously verified national COAL-pair figures (share = ALP-first of the
# COAL ballots naming at least one of the pair; nei = share of ALL COAL ATL
# ballots naming neither). The recompute must land within rounding of them.
ORACLE_ON = {"20499": (61.17, 61.12), "24310": (47.63, 53.46),
             "27966": (42.51, 38.4), "31496": (25.27, 13.0)}

# national ALP-pair Coalition-v-One-Nation figures, computed from this very
# run and pinned (share = COAL-first of the ALP ballots naming at least one
# of the pair; nei = share of ALL ALP ATL ballots naming neither party).
ORACLE_CON = {"20499": (62.74, 58.33), "24310": (72.97, 55.95),
              "27966": (69.95, 56.64), "31496": (73.34, 46.99)}


def tally_atl(seq_fams, counts, exitc, pax, pcx, atl_first):
    """One ATL ballot: the family sequence in ballot order (duplicates kept).
    Returns nothing; updates the shared counters in place."""
    src = seq_fams[0]
    atl_first[src] += 1
    dest_exit = "none"
    for f_ in seq_fams[1:]:
        if f_ != src:
            dest_exit = f_
            break
    exitc[src][dest_exit] += 1
    ralp = seq_fams.index("ALP") if "ALP" in seq_fams else None
    rco = seq_fams.index("COAL") if "COAL" in seq_fams else None
    rph = seq_fams.index("PHON") if "PHON" in seq_fams else None
    srcpa = pax[src]
    if ralp is not None and rph is not None:
        srcpa["ALP_first" if ralp < rph else "PHON_first"] += 1
    elif ralp is not None:
        srcpa["ALP_only"] += 1
    elif rph is not None:
        srcpa["PHON_only"] += 1
    else:
        srcpa["neither"] += 1
    # the third tally (pc): the SAME ballot's Coalition-v-One-Nation pair -
    # the explainer's Coalition v One Nation Senate bank
    srcpc = pcx[src]
    if rco is not None and rph is not None:
        srcpc["COAL_first" if rco < rph else "PHON_first"] += 1
    elif rco is not None:
        srcpc["COAL_only"] += 1
    elif rph is not None:
        srcpc["PHON_only"] += 1
    else:
        srcpc["neither"] += 1
    if ralp is not None and (rco is None or ralp < rco):
        counts[src]["toALP"] += 1
    elif rco is not None:
        counts[src]["toCOAL"] += 1
    else:
        counts[src]["neither"] += 1


def blank_state():
    return {"counts": {fam: {d: 0 for d in DESTS} for fam in FAMILIES},
            "exit": {fam: {d: 0 for d in FAMILIES + ["none"]} for fam in FAMILIES},
            "pa": {fam: {d: 0 for d in PA} for fam in FAMILIES},
            "pc": {fam: {d: 0 for d in PC} for fam in FAMILIES},
            "atl_first": {fam: 0 for fam in FAMILIES}, "btl_first": {fam: 0 for fam in FAMILIES},
            "atl": 0, "btl": 0, "rows": 0, "mixed": 0, "dupe_atl": 0}


def parse_column_state(st, cand):
    """2019/2022/2025: one column per group and per candidate."""
    path = os.path.join(BASE, f"aec-senate-formalpreferences-{EVENT}-{st}.csv")
    if not os.path.exists(path):
        print(f"  [skip] {st}: csv missing")
        return None, None
    res = blank_state()
    with open(path, newline="") as f:
        r = csv.reader(f)
        head = next(r)
        ball = head[6:]
        cols = []   # (kind, letter)
        fams = {}
        name_map = []
        for h in ball:
            h = h.strip()
            prefix, _, nm = h.partition(":")
            nm = nm.strip()
            name_map.append((prefix.strip(), nm))
            letter = prefix.strip()
            if nm.upper() in cand.get(st, set()):
                cols.append(("cand", letter))
            else:
                cols.append(("group", letter))
                if letter not in fams:
                    fams[letter] = family(nm)
        groups = [(i, l) for i, (k, l) in enumerate(cols) if k == "group"]
        cand_cols = [(i, l) for i, (k, l) in enumerate(cols) if k == "cand"]
        # sanity: group cols must all precede candidate cols
        if groups and cand_cols:
            assert groups[-1][0] < cand_cols[0][0], f"{st}: interleaved columns?"
        audit = {"groups": [{"letter": l, "family": fams[l]} for _, l in groups],
                 "n_candidates": len(cand_cols)}
        assert len(cand_cols) == len(cand.get(st, set())), f"{st}: candidate col count mismatch"

        counts, exitc, pax, pcx = res["counts"], res["exit"], res["pa"], res["pc"]
        atl_first, btl_first = res["atl_first"], res["btl_first"]
        for row in r:
            if not row:
                continue
            res["rows"] += 1
            vals = row[6:6 + len(cols)]
            gseq = []
            btl_vals = []
            for (kind, letter), v in zip(cols, vals):
                v = v.strip()
                if not v:
                    continue
                if kind == "group":
                    gseq.append((int(v), letter))
                else:
                    btl_vals.append((int(v), letter))
            if not gseq and not btl_vals:
                continue
            if btl_vals:
                # savings provisions: BTL counted where a BTL sequence exists
                res["btl"] += 1
                if gseq:
                    res["mixed"] += 1
                for n, letter in sorted(btl_vals):
                    if n == 1:
                        btl_first[fams.get(letter, "OTHER")] += 1
                        break
                continue
            res["atl"] += 1
            gseq.sort()
            nums = [n for n, _ in gseq]
            if len(nums) != len(set(nums)):
                res["dupe_atl"] += 1
            tally_atl([fams[l] for _, l in gseq], counts, exitc, pax, pcx, atl_first)
    return res, audit


def parse_positional_state(st, candinfo):
    """2016 (20499): one positional Preferences string per ballot - first the
    G group slots in (len, letter) ticket order, then the candidate slots in
    (group order, ballot position), ungrouped candidates last. tokens are
    digits; '*' and '/' count as preference 1 (tick/cross/single-stroke-1);
    anything else is a format surprise and asserts. Row 2 is a dashes
    separator."""
    path = os.path.join(BASE, f"aec-senate-formalpreferences-{EVENT}-{st}.csv")
    if not os.path.exists(path):
        print(f"  [skip] {st}: csv missing")
        return None, None
    groups, cands, gfam = candinfo[st]
    res = blank_state()
    with open(path, newline="") as f:
        r = csv.reader(f)
        head = next(r)
        assert head[5].strip().lower() == "preferences", f"{st}: unexpected 2016 header: {head[:6]}"
        sep = next(r)
        assert set(sep[0]) == {"-"}, f"{st}: missing dashes separator row"
        def tokens(s):
            for i, tok in enumerate(s.split(",")):
                tok = tok.strip()
                if not tok:
                    continue
                if tok.isdigit():
                    yield i, int(tok)
                elif tok in ("*", "/"):
                    yield i, 1
                else:
                    raise AssertionError(f"{st}: surprise token {tok!r} in {s!r}")
        first_checked = False
        counts, exitc, pax, pcx = res["counts"], res["exit"], res["pa"], res["pc"]
        atl_first, btl_first = res["atl_first"], res["btl_first"]
        for row in r:
            if not row or len(row) < 6:
                continue
            res["rows"] += 1
            toks = list(tokens(row[5]))
            if not first_checked:
                first_checked = True
                slots = len(row[5].split(","))
                assert slots == len(groups) + len(cands), \
                    f"{st}: {slots} slots, expected {len(groups)} groups + {len(cands)} candidates"
            gseq = []
            btl_vals = []
            for i, n in toks:
                if i < len(groups):
                    gseq.append((n, groups[i]))
                else:
                    btl_vals.append((n, cands[i - len(groups)]))
            if not gseq and not btl_vals:
                continue
            if btl_vals:
                res["btl"] += 1
                if gseq:
                    res["mixed"] += 1
                n0 = min(btl_vals)
                if n0[0] == 1:
                    btl_first[n0[1]] += 1
                continue
            res["atl"] += 1
            gseq.sort()
            nums = [n for n, _ in gseq]
            if len(nums) != len(set(nums)):
                res["dupe_atl"] += 1
            tally_atl([gfam[l] for _, l in gseq], counts, exitc, pax, pcx, atl_first)
    return res, {"groups": [{"letter": l, "family": gfam[l]} for l in groups],
                 "n_candidates": len(cands)}


def load_candinfo_2016():
    """aec-senate-candidateinformation-20499: nom_ty 'S' rows give, per state,
    the group letters (ordered len-then-letter, the ungrouped 'UG' slot left
    out - it has no group column on the ballot) and the candidate slots
    (group order, then ballot position, ungrouped last) with the family's
    party assignment. A ticket's family comes from its candidates' party
    names; a ticket whose names map to two families is a hard error (a
    joint Liberal + Nationals ticket maps to COAL on both names)."""
    zip_path = os.path.join(BASE, "aec-senate-candidateinformation-20499.zip")
    csv_path = os.path.join(BASE, "aec-senate-candidateinformation-20499.csv")
    fh = None
    if os.path.exists(csv_path):
        fh = open(csv_path, newline="")
    elif os.path.exists(zip_path):
        fh = zipfile.ZipFile(zip_path).open("aec-senate-candidateinformation-20499.csv")
    else:
        sys.exit("20499 needs aec-senate-candidateinformation-20499 (.zip or extracted .csv) in AEC_DATA_DIR")
    with fh:
        rdr = csv.reader((line.decode("utf-8-sig", "replace") for line in fh), delimiter=",") \
            if isinstance(fh, zipfile.ZipExtFile) else csv.reader(fh)
        hdr = next(rdr)
        ix = {nm.strip(): i for i, nm in enumerate(hdr)}
        info = {}
        for row in rdr:
            if len(row) < 9 or row[ix["nom_ty"]] != "S":
                continue
            st = row[ix["state_ab"]].strip()
            ticket = row[ix["ticket"]].strip().upper()
            party = row[ix["party_ballot_nm"]].strip()
            bpos = int(row[ix["ballot_position"]])
            info.setdefault(st, {}).setdefault(ticket, []).append((bpos, party))
    out = {}
    for st, tickets in info.items():
        letters = sorted([t for t in tickets if t != "UG"], key=lambda t: (len(t), t))
        gfam = {}
        for t in letters + ["UG"]:
            fams = {family(p) for _, p in tickets[t]}
            assert len(fams) == 1, f"{st} ticket {t}: candidates map to several families {fams}"
            gfam[t] = fams.pop()
        cands = []
        for t in letters + ["UG"]:
            for bpos, party in sorted(tickets[t]):
                cands.append(gfam[t])
        out[st] = (letters, cands, gfam)
    return out


def main():
    if POS:
        info = load_candinfo_2016()
        cand = None
    else:
        cand = {}
        with open(os.path.join(BASE, f"SenateCandidatesDownload-{EVENT}.csv"), newline="") as f:
            r = csv.reader(f)
            next(r)  # banner
            hdr = next(r)
            for row in r:
                if not row or len(row) < 6:
                    continue
                cand.setdefault(row[0], set()).add(f"{row[4].upper()} {row[5].upper()}".strip())

    # official formal-paper totals per state from DoP
    formal_total = {}
    for dop in glob.glob(os.path.join(BASE, f"SenateStateDOPDownload-{EVENT}-*.csv")):
        st = os.path.basename(dop).split("-")[-1].split(".")[0]
        with open(dop, newline="") as f:
            r = csv.reader(f)
            next(r)  # header
            first = next(r)
            formal_total[st] = int(first[2])

    audit = {}
    results = {}
    recon_first = {}   # state -> family -> ATL+BTL first prefs
    atl_btl = {}
    pa_by_state = {}
    pc_by_state = {}

    for st in STATES:
        if POS:
            if st not in info:
                print(f"  [skip] {st}: no candidates file entry")
                continue
            res, aud = parse_positional_state(st, info)
        else:
            res, aud = parse_column_state(st, cand)
        if res is None:
            continue
        audit[st] = aud
        pa_by_state[st] = res["pa"]
        pc_by_state[st] = res["pc"]
        results[st] = {"counts": res["counts"], "exit": res["exit"], "pa": res["pa"], "pc": res["pc"],
                       "atl": res["atl"], "btl": res["btl"], "rows": res["rows"],
                       "mixed": res["mixed"], "dupe_atl": res["dupe_atl"],
                       "coal_pa": res["pa"]["COAL"]}
        for fam in FAMILIES:
            assert sum(res["pc"][fam].values()) == res["atl_first"][fam], \
                f"{st} {fam}: pc cells do not sum to the family's ATL ballots"
        atl_btl[st] = {"atl": res["atl"], "btl": res["btl"]}
        recon_first[st] = {fam: res["atl_first"][fam] + res["btl_first"][fam] for fam in FAMILIES}
        exp = formal_total.get(st)
        status = "OK" if exp == res["rows"] else f"MISMATCH (DoP={exp})"
        print(f"{st}: rows={res['rows']} formal-papers check {status} | ATL={res['atl']} BTL={res['btl']} mixed={res['mixed']} dupeATL={res['dupe_atl']}")
        assert exp == res["rows"], f"{st}: ballot rows do not match the DoP formal-paper total"

    # reconciliation vs first-prefs download
    fp_tot = {}
    with open(os.path.join(BASE, f"SenateFirstPrefsByStateByGroupByVoteTypeDownload-{EVENT}.csv"), newline="") as f:
        r = csv.reader(f)
        next(r)
        hdr = next(r)
        ti = hdr.index("TotalVotes")
        for row in r:
            if not row or len(row) <= ti:
                continue
            fam = family(row[2])
            fp_tot.setdefault(row[0], {fam: 0 for fam in FAMILIES})
            fp_tot[row[0]][fam] += int(row[ti])

    print("\n== family first-pref reconciliation (mine vs AEC csv) ==")
    for st in sorted(recon_first):
        if st not in fp_tot:
            continue
        diffs = {fam: recon_first[st][fam] - fp_tot[st][fam] for fam in FAMILIES}
        print(f"  {st}: mine={recon_first[st]}  aec={fp_tot[st]}  diff={diffs}")

    # national aggregate
    nat_counts = {fam: {d: 0 for d in DESTS} for fam in FAMILIES}
    nat_exit = {fam: {d: 0 for d in FAMILIES + ["none"]} for fam in FAMILIES}
    nat_pax = {fam: {d: 0 for d in PA} for fam in FAMILIES}
    nat_pcx = {fam: {d: 0 for d in PC} for fam in FAMILIES}
    for st, res in results.items():
        for fam in FAMILIES:
            for d in DESTS:
                nat_counts[fam][d] += res["counts"][fam][d]
            for d in FAMILIES + ["none"]:
                nat_exit[fam][d] += res["exit"][fam][d]
            for d in PA:
                nat_pax[fam][d] += res["pa"][fam][d]
            for d in PC:
                nat_pcx[fam][d] += res["pc"][fam][d]

    # oracle: the national COAL Labor-v-One-Nation pair must sit at the
    # previously verified figures (within published-rounding)
    on = nat_pax["COAL"]
    num = on["ALP_first"] + on["ALP_only"]
    den = num + on["PHON_first"] + on["PHON_only"]
    tot = den + on["neither"]
    oshare, onei = ORACLE_ON[EVENT]
    share = 100 * num / den
    nei = 100 * on["neither"] / tot
    assert abs(share - oshare) < 0.05, f"COAL pair ALP share {share:.2f} != verified {oshare}"
    assert abs(nei - onei) < 0.15, f"COAL pair named-neither {nei:.2f} != verified {onei}"
    print(f"\noracle OK: COAL pair ALP {share:.2f}% (verified {oshare}), named neither {nei:.2f}% (verified {onei})")

    # the Coalition-v-One-Nation pair pins against ORACLE_CON (its figures
    # were computed from these verified ballots; once pinned, a drift in the
    # tally aborts the run before any output lands)
    ccx = nat_pcx["ALP"]
    num2 = ccx["COAL_first"] + ccx["COAL_only"]
    den2 = num2 + ccx["PHON_first"] + ccx["PHON_only"]
    tot2 = den2 + ccx["neither"]
    cshare, cnei = ORACLE_CON[EVENT]
    share2 = 100 * num2 / den2
    nei2 = 100 * ccx["neither"] / tot2
    if cshare is not None:
        assert abs(share2 - cshare) < 0.05, f"ALP pair COAL share {share2:.2f} != pinned {cshare}"
        assert abs(nei2 - cnei) < 0.15, f"ALP pair named-neither {nei2:.2f} != pinned {cnei}"
    print(f"coalition-v-ON pair: ALP ballots COAL-first {share2:.2f}%, PHON-first {100 * ccx['PHON_first'] / tot2 + 100 * ccx['PHON_only'] / tot2:.2f}%, named neither {nei2:.2f}% (to pin in ORACLE_CON: ({share2:.2f}, {nei2:.2f}))")

    def table(cc):
        out = []
        hdr = f"{'from':>6} | {'to Labor':>14} | {'to Coalition':>14} | {'neither major':>14} | N"
        out.append(hdr)
        for fam in FAMILIES:
            n = sum(cc[fam].values())
            if n == 0:
                continue
            a, c, z = cc[fam]["toALP"], cc[fam]["toCOAL"], cc[fam]["neither"]
            out.append(f"{fam:>6} | {a/n*100:7.2f}% ({a}) | {c/n*100:7.2f}% ({c}) | {z/n*100:7.2f}% ({z}) | {n}")
        return out

    print("\n== NATIONAL ATL flow of preferences (Labor v Coalition) ==")
    for line in table(nat_counts):
        print(line)
    for st in STATES:
        if st in results:
            print(f"\n== {st} ==")
            for line in table(results[st]["counts"]):
                print(line)

    def exittab(cc):
        out = []
        out.append(f"{'from':>6} | {'next: ALP':>9} | {'next: COAL':>10} | {'next: GRN':>9} | {'next: PHON':>10} | {'next: OTHER':>11} | {'none listed':>11} | N")
        for fam in FAMILIES:
            n = sum(cc[fam].values())
            if n == 0:
                continue
            cells = [f"{cc[fam][d]/n*100:6.2f}%" for d in ["ALP", "COAL", "GRN", "PHON", "OTHER", "none"]]
            out.append(f"{fam:>6} | " + " | ".join(cells) + f" | {n}")
        return out

    print("\n== NATIONAL exit-destination matrix (first different party listed) ==")
    for line in exittab(nat_exit):
        print(line)
    for st in STATES:
        if st in results:
            print(f"\n-- {st} exit matrix --")
            for line in exittab(results[st]["exit"]):
                print(line)

    def parow(name, cc):
        n = sum(cc.values())
        if n == 0:
            print(f"{name:>5} | (no ballots)")
            return
        cells = " | ".join(f"{cc[d]/n*100:8.2f}%" for d in PA)
        print(f"{name:>5} | {cells} | {n}")

    for srcfam in ["COAL", "GRN", "OTHER"]:
        print(f"\n== {srcfam} ATL ballots: Labor v One Nation pair (first-listed; '_only' = the other named nowhere) ==")
        print(f"{'scope':>5} | {'ALP<PHON':>9} | {'ALP only':>9} | {'PHON<ALP':>9} | {'PHON only':>10} | {'neither':>8} | N")
        parow("NAT", nat_pax[srcfam])
        for st in STATES:
            if st in results:
                parow(st, pa_by_state[st][srcfam])

    def pcrow(name, cc):
        n = sum(cc.values())
        if n == 0:
            print(f"{name:>5} | (no ballots)")
            return
        cells = " | ".join(f"{cc[d]/n*100:8.2f}%" for d in PC)
        print(f"{name:>5} | {cells} | {n}")

    for srcfam in ["ALP", "GRN", "OTHER"]:
        print(f"\n== {srcfam} ATL ballots: Coalition v One Nation pair (first-listed; '_only' = the other named nowhere) ==")
        print(f"{'scope':>5} | {'COAL<PHON':>9} | {'COAL only':>9} | {'PHON<COAL':>9} | {'PHON only':>10} | {'neither':>8} | N")
        pcrow("NAT", nat_pcx[srcfam])
        for st in STATES:
            if st in results:
                pcrow(st, pc_by_state[st][srcfam])

    print("\n== group->family audit ==")
    for st in STATES:
        if st in audit:
            print(f"  {st}: " + ", ".join(f"{g['letter']}={g['family']}" for g in audit[st]["groups"]))

    out_path = os.path.join(OUT, f"atl_flow_results-{EVENT}.json")
    with open(out_path, "w") as f:
        json.dump({"event": EVENT, "year": YEAR, "results": results, "national": nat_counts,
                   "national_exit": nat_exit, "audit": audit,
                   "pa": {"national": nat_pax, "states": pa_by_state},
                   "pc": {"national": nat_pcx, "states": pc_by_state},
                   "atl_btl": atl_btl, "recon_first": recon_first, "aec_first": fp_tot}, f, indent=1)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
