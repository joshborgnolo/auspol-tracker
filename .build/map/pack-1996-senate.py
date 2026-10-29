#!/usr/bin/env python3
"""Pack the 1996 statistics CD-ROM's Senate products into the VTR lane
schemas .build/map/senate_vote.py loads (its loaders read exactly these
filenames, keyed by year, 2004 on; no VTR event existed before 2004, so
1996's Senate race lives only in the election-statistics CD-ROM pack).

Mirror of pack-2001-senate.py on the 1996 members committed in
.build/aec-flow-src/ (README-haul-1983-2007.md): sppvote-1996.csv.gz
(Senate first prefs by division × polling place), scands-1996.txt
(candidates: groups/party/elected/term), the pack's own cross-tab oracles
(v24-1996.txt per division, v24s-1996.txt per state - the senres
V2_4/V2_4_S members), and the place identities shared with the House lane
in .build/aec-flow-src/place-ids-1996.json.

Outputs (only after every gate passes - the recompose doctrine):
  .build/aec-flow-src/senate-fpv/div-1996.csv.gz    per-division candidates
                                                    by vote type (oracle)
  .build/aec-flow-src/senate-fpv/pp-1996-<ST>.csv.gz  per-place per-candidate
                                                    ordinary votes (×8)
  .build/aec-flow-src/fpv/fpv-senate-state-1996.csv   per-state group
                                                    vote-type totals
                                                    (senate_vote.py's 2004-
                                                    era state check reuses
                                                    it; Adj is NOT part of
                                                    the arithmetic here -
                                                    it reconciles the pack's
                                                    printed Totals only)

Gates:
  * the ZZ pseudo ticket recomposes (formal+informal == total per place);
  * SPPVOTE recomputes the pack's own V2_4.TXT per-division print exactly
    (every candidate × division × vote type; Adj == printed Total − Σ5);
  * the per-candidate UG sums per division per type == the printed V2_4
    Ungrouped Total rows exactly;
  * the state roll-up recomputes V2_4_S.TXT exactly (per candidate, five
    types, with Adj deals its printed Total);
  * every SPPVOTE candidate appears in scands-1996 and the V2_4's own '#'
    marks equal scands's elected set by name;
  * every ungrouped SPPVOTE candidate row joins scands's UG ticket.

usage: python3 .build/map/pack-1996-senate.py         (from repo root)
"""
import collections, csv, gzip, io, json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = REPO + "/.build/aec-flow-src"
OUT = SRC + "/senate-fpv"
FPV = SRC + "/fpv"
STATES = ["ACT", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"]
STATES_EMIT = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
DECL = {"ABSENT": "abs", "PRE POLL": "pre", "POSTAL": "post", "PROVISIONAL": "prov"}
SKIP_SUMMARY = {"Division Summary", "Adj"}
BANNER = ("1996 Federal Election Senate First Preferences {what} [packed from"
          " the election-statistics CD-ROM by .build/map/pack-1996-senate.py]")
# the era's ballot-group codes -> display names (cosmetic only - the vote
# lanes ride the codes; an unmapped code prints as itself)
GROUP_NAME = {
    "ALP": "Australian Labor Party", "LP": "Liberal Party of Australia",
    "NP": "The National Party of Australia", "LNP": "Liberal/Nationals",
    "DEM": "Australian Democrats", "GRN": "Australian Greens",
    "CLP": "Country Liberal Party", "CTA": "Call to Australia",
    "AFI": "Australians Against Further Immigration",
}
ST_NAME = {"New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD",
           "Western Australia": "WA", "South Australia": "SA", "Tasmania": "TAS",
           "Northern Territory": "NT", "Australian Capital Territory": "ACT"}


def rows_semi(p):
    op = gzip.open if p.endswith(".gz") else open
    with op(p, "rt", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def norm(s):
    s = s or ""
    s = re.sub(r"\s*\([^()]*$", "", s)
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    return re.sub(r"[^a-z0-9]", "", s.lower())


def gzwrite(path, header, rows, what):
    with io.TextIOWrapper(gzip.GzipFile(path, "wb", compresslevel=9, mtime=0), newline="", encoding="utf-8") as f:
        f.write(BANNER.format(what=what) + "\n")
        f.write(",".join(header) + "\n")
        csv.writer(f).writerows(rows)


HEAD_UNGROUPED = re.compile(r"^Ungrouped")
DIVHEAD_RE = re.compile(r"^([A-Za-z][A-Za-z' -]*)\s?\((\d+)\)\s*$")
TOKEN_INT = re.compile(r"-?\d+$")
TOKEN_NUM = re.compile(r"-?\d+(?:\.\d+)?$")
SKIP_HEAD_WORDS = {"Candidates", "Party", "Ordinary", "Absent", "Provisional", "Postal",
                   "Total", "Group", "State", "Enrolment", "FORMAL", "INFORMAL", "GRAND", "VALID"}


def parse_v24(path):
    """section -> {(ticket,bp): {party,name,votes[5],adj,total}}, plus the
    elected-name set the file's own '#' marks carry. Division sections
    open on 'Banks (78925)'-shaped names; the state roll-up file opens
    sections on bare state names. Rows: 'A  TICKET VOTES  <party> …',
    '"NAME"  <party>' candidate rows, '#' elected marks; the numeric run
    is ten numbers (5 vote,pct pairs) + Adj + Total + pct → 13, or 12
    with no Adj."""
    out = collections.defaultdict(dict)
    elected = collections.defaultdict(set)
    cur_key = None
    cur_grp = None
    cur_n = 0
    cur_state = None
    with open(path, encoding="utf-8", errors="replace") as f:
        for ln in f:
            s = ln.strip()
            if not s:
                continue
            if s in ST_NAME:
                cur_state = ST_NAME[s]
                cur_key = cur_state
                cur_grp, cur_n = None, 0
                continue
            m = DIVHEAD_RE.match(s)
            if m:
                # a '<Name> (digits)' line is always a division section
                # (state names never carry parenthesised enrolment)
                cur_key = m.group(1).strip()
                cur_grp, cur_n = None, 0
                continue
            if cur_key is None and cur_state is None:
                continue
            toks = [t for t in re.split(r"\s{2,}|\t+", s) if t.strip()]
            if not toks:
                continue
            head = toks[0]
            marked = toks[0] == "#"
            if marked:
                toks = toks[1:]
                head = toks[0] if toks else head
            if HEAD_UNGROUPED.match(head):
                nums_i = None
                for i, tk in enumerate(toks):
                    if TOKEN_NUM.match(tk):
                        nums_i = i
                        break
                if nums_i is None:
                    continue
                nums = toks[nums_i:]
                if not all(TOKEN_NUM.match(x) for x in nums):
                    continue
                # the same number-vector as candidate rows: five (vote,pct)
                # pairs, then Adj(optional) and Total (+pct)
                if len(nums) == 13:
                    v = [int(nums[0]), int(nums[2]), int(nums[4]), int(nums[6]), int(nums[8])]
                    total = int(nums[11])
                    assert sum(v) + int(nums[10]) == total, (cur_key, nums, "Ungrouped Total contract")
                elif len(nums) == 12:
                    v = [int(nums[0]), int(nums[2]), int(nums[4]), int(nums[6]), int(nums[8])]
                    total = int(nums[10])
                    assert sum(v) == total, (cur_key, nums, "Ungrouped Total contract")
                else:
                    continue
                out[cur_key][("UG", 0)] = {"party": "UG", "name": "Ungrouped Total",
                                           "votes": v, "total": total}
                continue
            if head in SKIP_HEAD_WORDS or "Group Total" in head:
                continue
            if head == "Ungrouped" or head in ("Ungrouped",):
                # UNGROUPED marker: candidates after it key to the UG ticket
                cur_grp, cur_n = "UG", 0
                continue
            if len(toks) < 3:
                continue
            nums_i = None
            for i, tk in enumerate(toks):
                if TOKEN_INT.match(tk):
                    nums_i = i
                    break
            if nums_i is None:
                continue
            nums = toks[nums_i:]
            if not all(TOKEN_NUM.match(x) for x in nums):
                continue
            if len(nums) == 13:
                adj, total = int(nums[10]), int(nums[11])
            elif len(nums) == 12:
                adj, total = 0, int(nums[10])
            else:
                continue
            votes = [int(nums[0]), int(nums[2]), int(nums[4]), int(nums[6]), int(nums[8])]
            assert sum(votes) + adj == total, (cur_key, head, votes, adj, total, "V2_4 print contract")
            party_tok = toks[nums_i - 1]
            if any("TICKET VOTES" in x for x in toks[:nums_i]):
                cur_grp = toks[0]
                cur_n = 0
                key = (cur_grp, 0)
                name = None
            else:
                cur_n += 1
                assert cur_grp is not None, (cur_key, ln)
                key = (cur_grp, cur_n)
                name = toks[0].strip('"')
                if marked and name:
                    elected[cur_state].add(name)
            assert key[-1] is not None and key not in out[cur_key], (cur_key, key, "duplicate printed row")
            out[cur_key][key] = {"party": party_tok, "name": name, "adj": adj,
                                 "votes": votes, "total": total}
    return dict(out), elected


def main():
    ids = json.load(open(SRC + "/place-ids-1996.json"))
    divs = ids["divisions"]
    pm = ids["places"]  # d -> {printed name: id} (full class map from pack-1996-booth)
    div_id_of = {d: divs[d]["id"] for d in divs}
    div_state_of = {d: divs[d]["st"] for d in divs}
    pm_norm = {d: {norm(nm): nm for nm in rows} for d, rows in pm.items()}

    known_divisions = set(div_id_of)

    # ----------------------------------------------------------- candidates
    cands = {}
    cand_group = {}
    elected = collections.defaultdict(set)
    for r in rows_semi(SRC + "/scands-1996.txt"):
        st, t, bp = r["State"], r["Ticket"], int(r["Ballot Position"])
        cands[(st, t, bp)] = r
        cand_group[(st, t)] = r["Group"] or r["Party"] or ""
        if r["Member"].strip() == "#":
            elected[st].add(r["Candidate"])
    for st in STATES:
        assert any(k[0] == st for k in cands), f"scands missing {st}"

    seq_ids = {}
    for i, st in enumerate(STATES):
        n = 0
        for k in sorted(k2 for k2 in cands if k2[0] == st):
            t, bp = k[1], k[2]
            n += 1
            seq_ids[st, t, bp] = (i + 1) * 10000 + n
        per_state_tickets = sorted({t for (s, t, bp) in seq_ids if s == st})
        for j, trow in enumerate(per_state_tickets):
            seq_ids[st, trow, 0] = (i + 1) * 10000 + 500 + j

    # ------------------------------------------------------ sppvote sums
    zz = collections.defaultdict(dict)
    tt = collections.defaultdict(collections.Counter)
    for r in rows_semi(SRC + "/sppvote-1996.csv.gz"):
        dv = r["Division"]
        assert dv in div_id_of, dv
        # the pack's own summary-styled pseudo places ("Division Summary",
        # "Adj") restate every division's totals - counting them anywhere
        # doubles the figures, so they are out of every lane here
        if r["Polling Place"] in SKIP_SUMMARY:
            continue
        if r["Ticket"] == "ZZ":
            bp = int(r["Ballot Position"])
            assert bp in (998, 999, 1000), r
            zz.setdefault((dv, r["Polling Place"]), {})[bp] = int(r["Vote"])
            continue
        tt[(dv, r["Ticket"], int(r["Ballot Position"]))][DECL.get(r["Polling Place"], "ord")] += int(r["Vote"])
    for key, z in zz.items():
        assert z[998] + z[999] == z[1000], (key, z)
    print(f"zz recompose: pass; per-place formal rows: {len(zz)}")
    for (dv, t, bp) in tt:
        st = div_state_of[dv]
        assert bp == 0 or (st, t, bp) in cands, (dv, t, bp, "SPPVOTE candidate missing from scands")

    # ------------------------------------------------ gate: V2_4 per division
    pr, v24_elected = parse_v24(SRC + "/v24-1996.txt")
    assert set(pr) == set(div_id_of), (sorted(set(pr) ^ set(div_id_of))[:5],)
    for (dv, t, bp), vt in tt.items():
        if t == "UG":
            continue
        mine = [vt["ord"], vt["abs"], vt["prov"], vt["pre"], vt["post"]]
        want = pr[dv].get((t, bp))
        assert want is not None, (dv, t, bp, "not printed in V2_4.TXT")
        assert want["votes"] == mine, (dv, t, bp, mine, want["votes"])
        assert want["total"] == sum(mine) + want["adj"], (dv, t, bp)
    print(f"gate: SPPVOTE recomputes V2_4.TXT (candidate × division × type) - exact on {len(tt)} keys")

    # elected: the V2_4 '#' marks by state == scands's elected names
    # (case-folded joins - the two prints capitalise differently)
    for st in STATES:
        v24_names = {norm(x) for x in v24_elected.get(st, set())}
        scands_names = {norm(x) for x in elected[st]}
        assert v24_names == scands_names, (st, sorted(v24_names ^ scands_names)[:4])
    print("gate: V2_4 '#' elected marks == scands elected set on every state")

    # UG aggregates: the candidates' 5-type sums recombine to the printed
    # Ungrouped Total rows exactly.
    ug_acc = collections.defaultdict(collections.Counter)
    for (dv, t, bp), vt in tt.items():
        if t != "UG":
            continue
        for k, v in vt.items():
            ug_acc[dv][k] += v
    for dv, acc in ug_acc.items():
        want = pr.get(dv, {}).get(("UG", 0))
        assert want is not None, (dv, "no printed Ungrouped Total")
        mine = [acc["ord"], acc["abs"], acc["prov"], acc["pre"], acc["post"]]
        assert want["votes"] == mine, (dv, mine, want["votes"])
    print(f"gate: UG aggregates recombine to printed Ungrouped Totals ({len(ug_acc)} divisions)")

    # ------------------------------------------------ gate: V2_4_S per state
    prs, _ = parse_v24(SRC + "/v24s-1996.txt")
    # V2_4_S sections are the state name keys (NSW, VIC, ...) on bare
    # state-name lines.
    st_tt = collections.defaultdict(collections.Counter)
    for (dv, t, bp), vt in tt.items():
        st = div_state_of[dv]
        if t == "UG":
            continue
        for k, v in vt.items():
            st_tt[(st, t, bp)][k] += v
    for (st, t, bp), vt in st_tt.items():
        assert st in prs, (st, "no V2_4_S section")
        want = prs[st].get((t, bp))
        assert want is not None, (st, t, bp, "not printed in V2_4_S.TXT")
        mine = [vt["ord"], vt["abs"], vt["prov"], vt["pre"], vt["post"]]
        assert want["votes"] == mine, (st, t, bp, mine, want["votes"])
        assert want["total"] == sum(mine) + want["adj"], (st, t, bp)
    # the state's own printed formal total gates the whole file at the top
    print("gate: state roll-up recomputes V2_4_S.TXT (every candidate × state × type + adj)")

    # ------------------------------------------------------- id resolution
    pm_prefix = {d: sorted(pm[d], key=len, reverse=True) for d in pm}
    # SPPVOTE keeps the roll-up pseudo places the House level expands by
    # name - the same three constants the 2001 pack rides
    SPPVOTE_PSEUDO = {"Special Hospitals": 2001, "Prison Mobiles": 2002, "Remote Mobiles": 2003}

    def pid_of(dv, pp):
        if pp in pm[dv]:
            return pm[dv][pp]
        if pp in SPPVOTE_PSEUDO:
            return div_id_of[dv] * 10000 + SPPVOTE_PSEUDO[pp]
        n = norm(pp)
        if n in pm_norm[dv]:
            return pm[dv][pm_norm[dv][n]]
        hits = [pm[dv][p2] for p2 in pm_prefix[dv] if norm(p2).startswith(n) and len(n) >= 4]
        if len(hits) == 1:
            return hits[0]
        raise SystemExit(f"unclassified sppvote polling place {pp!r} in {dv}")

    # ------------------------------------------------------- emissions
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(FPV, exist_ok=True)

    # div lane (the oracle)
    orow_all = []
    for dv in sorted(by_div_sort := sorted(div_id_of, key=lambda d: (STATES.index(div_state_of[d]), d))):
        for (dd, t, bp), vt in sorted(tt.items(), key=lambda kv: kv[0]):
            if dd != dv:
                continue
            st = div_state_of[dv]
            if bp != 0:
                c = cands[(st, t, bp)]
                nm = c["Candidate"]
            else:
                nm = f"{t} Ticket Votes"
            orow_all.append([st, div_id_of[dv], dv, t, seq_ids[(st, t, bp)], bp, nm,
                             cand_group[(st, t)] or "UG", cand_group[(st, t)] or "UG", "",
                             vt["ord"], vt["abs"], vt["prov"], vt["pre"], vt["post"], sum(vt.values())])
    gzwrite(OUT + "/div-1996.csv.gz",
            ["StateAb", "DivisionID", "DivisionNm", "Ticket", "CandidateID", "BallotPosition", "CandidateDetails",
             "PartyName", "PartyAb", "SittingMemberFl", "OrdinaryVotes", "AbsentVotes", "ProvisionalVotes",
             "PrePollVotes", "PostalVotes", "TotalVotes"], orow_all,
            "By Division By Candidate By Vote Type")

    # per-state pp lanes (ordinary only)
    pp_rows = collections.defaultdict(list)
    for r in rows_semi(SRC + "/sppvote-1996.csv.gz"):
        dv = r["Division"]
        if r["Ticket"] == "ZZ" or r["Polling Place"] in SKIP_SUMMARY or r["Polling Place"] in DECL:
            continue
        pid = pid_of(dv, r["Polling Place"])
        st = div_state_of[dv]
        t, bp = r["Ticket"], int(r["Ballot Position"])
        if bp == 0:
            nm = f"{t} Ticket Votes"
        else:
            nm = cands[(st, t, bp)]["Candidate"]
        pp_rows[st].append([st, div_id_of[dv], dv, pid, r["Polling Place"], t, seq_ids[(st, t, bp)], bp, nm,
                            cand_group[(st, t)] or "UG", int(r["Vote"])])
    for st in STATES_EMIT:
        gzwrite(OUT + f"/pp-1996-{st}.csv.gz",
                ["StateAb", "DivisionID", "DivisionNm", "PollingPlaceID", "PollingPlaceNm", "Ticket", "CandidateID",
                 "BallotPosition", "CandidateDetails", "PartyNm", "OrdinaryVotes"], pp_rows[st],
                "By Polling Place")

    # per-state group lane (senate_vote.py's 2004-era state check)
    grp_tot = collections.defaultdict(collections.Counter)  # (st,group) ->{type}
    for (dv, t, bp), vt in tt.items():
        st = div_state_of[dv]
        g = cand_group[(st, t)] or "IND"
        for k, v in vt.items():
            grp_tot[(st, g)][k] += v
    st_tot = collections.defaultdict(collections.Counter)
    for (st, g), vt in grp_tot.items():
        for k, v in vt.items():
            st_tot[st][k] += v
    with open(FPV + "/fpv-senate-state-1996.csv", "w", newline="") as f:
        f.write(BANNER.format(what="By Group By Vote Type By State") + "\n")
        f.write("StateAb,GroupAb,GroupNm,OrdinaryVotes,OrdinaryPercentage,AbsentVotes,AbsentPercentage,"
                "ProvisionalVotes,ProvisionalPercentage,PrePollVotes,PrePollPercentage,PostalVotes,"
                "PostalPercentage,TotalVotes,TotalPercentage\n")
        w = csv.writer(f)
        for st in STATES:
            for g in sorted({g2 for (s2, g2) in grp_tot if s2 == st}):
                vt = grp_tot[(st, g)]
                tot = sum(vt.values())
                def pc(k):
                    return round(100 * vt[k] / st_tot[st][k], 2) if st_tot[st][k] else 0
                w.writerow([st, g, GROUP_NAME.get(g, g), vt["ord"], pc("ord"), vt["abs"], pc("abs"),
                            vt["prov"], pc("prov"), vt["pre"], pc("pre"), vt["post"], pc("post"),
                            tot, pc("ord") if False else round(100 * tot / sum(st_tot[st].values()), 2)])
    print(f"div lane {sum(1 for _ in orow_all)} rows; pp:",
          {st: len(pp_rows[st]) for st in STATES_EMIT}, "| state groups:", len(grp_tot))


if __name__ == "__main__":
    main()
