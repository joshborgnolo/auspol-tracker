#!/usr/bin/env python3
"""ATL Senate preference-flow analysis, AEC event 31496 (2025 federal election).

Input: aec-senate-formalpreferences-31496-<STATE>.csv (ballot-level resolved
preference sequence per ballot; first columns = ATL group boxes, then BTL
candidate boxes). For each ATL ballot determines whether it lists any ALP
group before any Coalition group (LP/NP/LNP/CLP etc.) -- the Senate
two-party-preferred flow convention -- plus ballots listing neither family.

Cross-checks: row counts vs official DoP TotalFormalPapers; first-preference
group totals vs SenateFirstPrefsByStateByGroupByVoteTypeDownload.
"""
import csv, json, sys, os, glob

BASE = os.environ.get("AEC_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.dirname(os.path.abspath(__file__))
STATES = ["ACT", "NT", "NSW", "VIC", "QLD", "WA", "SA", "TAS"]

MAX_FIELDS = 1000
csv.field_size_limit(10_000_000)

def family(group_name: str) -> str:
    nm = " ".join(group_name.upper().split())
    if "GREENS" in nm:
        return "GRN"
    if "ONE NATION" in nm:
        return "PHON"
    if "LIBERTARIAN" in nm or "LIBERAL DEMOCRATS" in nm or "LIBERAL DEMOCRAT" in nm:
        return "OTHER"
    toks = nm.split()
    if "LIBERAL" in nm or "NATIONAL" in nm or "CLP" in toks or "LNP" in toks or "COUNTRY" in toks:
        return "COAL"
    if "LABOR" in nm:
        return "ALP"
    return "OTHER"

DESTS = ["toALP", "toCOAL", "neither"]
FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"]
PA = ["PHON_first", "ALP_first", "PHON_only", "ALP_only", "neither"]

def main():
    # candidate name sets per state (to distinguish candidate columns from group columns)
    cand = {}
    with open(os.path.join(BASE, "SenateCandidatesDownload-31496.csv"), newline="") as f:
        r = csv.reader(f)
        next(r)  # banner
        hdr = next(r)
        for row in r:
            if not row or len(row) < 6:
                continue
            cand.setdefault(row[0], set()).add(f"{row[4].upper()} {row[5].upper()}".strip())

    # official formal-paper totals per state from DoP
    formal_total = {}
    for dop in glob.glob(os.path.join(BASE, "SenateStateDOPDownload-31496-*.csv")):
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

    for st in STATES:
        path = os.path.join(BASE, f"aec-senate-formalpreferences-31496-{st}.csv")
        if not os.path.exists(path):
            print(f"  [skip] {st}: csv missing")
            continue
        with open(path, newline="") as f:
            r = csv.reader(f)
            head = next(r)
            ball = head[6:]
            cols = []  # (kind, letter)
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
            audit[st] = {"groups": [{"letter": l, "family": fams[l]} for _, l in groups],
                         "n_candidates": len(cand_cols)}
            assert len(cand_cols) == len(cand.get(st, set())), f"{st}: candidate col count mismatch"

            counts = {fam: {d: 0 for d in DESTS} for fam in FAMILIES}
            exitc = {fam: {d: 0 for d in FAMILIES + ["none"]} for fam in FAMILIES}
            pax = {fam: {d: 0 for d in PA} for fam in FAMILIES}
            atl_first = {fam: 0 for fam in FAMILIES}
            btl_first = {fam: 0 for fam in FAMILIES}
            nat = nbt = nrows = nmixed = ndupe = 0
            for row in r:
                if not row:
                    continue
                nrows += 1
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
                    nbt += 1
                    if gseq:
                        nmixed += 1
                    for n, letter in sorted(btl_vals):
                        if n == 1:
                            btl_first[fams.get(letter, "OTHER")] += 1
                            break
                    continue
                nat += 1
                gseq.sort()
                nums = [n for n, _ in gseq]
                if len(nums) != len(set(nums)):
                    ndupe += 1
                seq_fams = [fams[l] for _, l in gseq]
                src_fam = seq_fams[0]
                atl_first[src_fam] += 1
                dest_exit = "none"
                for f_ in seq_fams[1:]:
                    if f_ != src_fam:
                        dest_exit = f_
                        break
                exitc[src_fam][dest_exit] += 1
                ralp = seq_fams.index("ALP") if "ALP" in seq_fams else None
                rco = seq_fams.index("COAL") if "COAL" in seq_fams else None
                srcpa = pax[src_fam]
                rph = seq_fams.index("PHON") if "PHON" in seq_fams else None
                if rph is not None and ralp is not None:
                    srcpa["PHON_first" if rph < ralp else "ALP_first"] += 1
                elif rph is not None:
                    srcpa["PHON_only"] += 1
                elif ralp is not None:
                    srcpa["ALP_only"] += 1
                else:
                    srcpa["neither"] += 1
                if ralp is not None and (rco is None or ralp < rco):
                    counts[src_fam]["toALP"] += 1
                elif rco is not None:
                    counts[src_fam]["toCOAL"] += 1
                else:
                    counts[src_fam]["neither"] += 1
            results[st] = {"counts": counts, "exit": exitc, "atl": nat, "btl": nbt, "rows": nrows,
                           "mixed": nmixed, "dupe_atl": ndupe, "coal_pa": pax["COAL"], "pa": pax}
            atl_btl[st] = {"atl": nat, "btl": nbt}
            recon_first[st] = {fam: atl_first[fam] + btl_first[fam] for fam in FAMILIES}
            exp = formal_total.get(st)
            status = "OK" if exp == nrows else f"MISMATCH (DoP={exp})"
            print(f"{st}: rows={nrows} formal-papers check {status} | ATL={nat} BTL={nbt} mixed={nmixed} dupeATL={ndupe}")

    # reconciliation vs first-prefs download
    fp_tot = {}
    with open(os.path.join(BASE, "SenateFirstPrefsByStateByGroupByVoteTypeDownload-31496.csv"), newline="") as f:
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
    nat_pa = {d: 0 for d in PA}
    nat_pax = {fam: {d: 0 for d in PA} for fam in FAMILIES}
    for st, res in results.items():
        for fam in FAMILIES:
            for d in DESTS:
                nat_counts[fam][d] += res["counts"][fam][d]
            for d in FAMILIES + ["none"]:
                nat_exit[fam][d] += res["exit"][fam][d]
            for d in PA:
                nat_pax[fam][d] += res["pa"][fam][d]
        for d in PA:
            nat_pa[d] += res["coal_pa"][d]

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

    print("\n== NATIONAL ATL flow of preferences ==")
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

    print("\n== Coalition ATL ballots: PHON vs ALP first-listed ==")
    print(f"{'scope':>5} | {'PHON<ALP':>9} | {'ALP<PHON':>9} | {'PHON only':>10} | {'ALP only':>9} | {'neither':>8} | N")
    def parow(name, cc):
        n = sum(cc.values())
        cells = " | ".join(f"{cc[d]/n*100:8.2f}%" for d in PA)
        print(f"{name:>5} | {cells} | {n}")
    parow("NAT", nat_pa)
    for st in STATES:
        if st in results:
            parow(st, results[st]["coal_pa"])

    for srcfam in ["GRN", "OTHER"]:
        print(f"\n== {srcfam} ATL ballots: PHON vs ALP first-listed ==")
        print(f"{'scope':>5} | {'PHON<ALP':>9} | {'ALP<PHON':>9} | {'PHON only':>10} | {'ALP only':>9} | {'neither':>8} | N")
        parow("NAT", nat_pax[srcfam])
        for st in STATES:
            if st in results:
                parow(st, results[st]["pa"][srcfam])

    print("\n== group->family audit ==")
    for st in STATES:
        if st in audit:
            print(f"  {st}: " + ", ".join(f"{g['letter']}={g['family']}" for g in audit[st]["groups"]))

    with open(os.path.join(OUT, "atl_flow_results.json"), "w") as f:
        json.dump({"results": results, "national": nat_counts, "national_exit": nat_exit, "audit": audit,
                   "national_coal_pa": nat_pa, "national_pa": nat_pax,
                   "atl_btl": atl_btl, "recon_first": recon_first, "aec_first": fp_tot}, f, indent=1)
    print("\nwrote atl_flow_results.json")

if __name__ == "__main__":
    main()
