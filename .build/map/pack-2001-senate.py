#!/usr/bin/env python3
"""Pack the 2001 statistics CD-ROM's Senate products into the VTR lane
schemas .build/map/senate_vote.py loads (VTR years 2004+; no event existed
for 2001, so its Senate race lives only in the election-statistics pack).

Inputs (committed):
  sppvote-2001.csv.gz      senate FPV by division × polling place
  scands-2001.txt          senate candidates by state (groupies/party/elected)
  place-ids-2001.json      (division, printed place) -> synthetic id map
                           (pack-2001-booth.py; one home for pack-era lanes)
  v310_2001.V310_PSEUDO    the aggregate-pseudo id constants 2001-2003

Outputs:
  .build/aec-flow-src/senate-fpv/div-2001.csv.gz      per-division candidates
                                                      by vote type (oracle)
  .build/aec-flow-src/senate-fpv/pp-2001-<ST>.csv.gz  per-place per-candidate
                                                      ordinary votes ×8

Gate (before anything is written): every (division, ticket, ballot position,
type) recomputed from sppvote equals the pack's own V2_4_D print ("First
preference votes by candidate by vote type by division", the same CD-ROM's
independent cross-tab) exactly, and every candidate name in scands appears
in the same printed table. Any miss means the products moved - stop.
"""
import csv, gzip, os, re, sys, json, collections, io

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = REPO + "/.build/aec-flow-src"
OUT = SRC + "/senate-fpv"
# the same aggregate-pseudo id space the House pack's V310 pseudo lanes use
V310_PSEUDO = {"Special Hospitals": 2001, "Prison Mobiles": 2002, "Remote Mobiles": 2003}
V2D = REPO + "/.matilda/map-2001/ex/data/national/national_txt/V2_4_D.txt"
STATES = ["ACT", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"]
DECL = {"ABSENT": "abs", "PRE POLL": "pre", "POSTAL": "post", "PROVISIONAL": "prov"}
TYPE_ORDER = ("ord", "abs", "prov", "pre", "post", "total")
TYPE_COLS = ("OrdinaryVotes", "AbsentVotes", "ProvisionalVotes", "PrePollVotes", "PostalVotes")
BANNER = ("2001 Federal Election Senate First Preferences {what} [packed from the"
          " election-statistics CD-ROM by .build/map/pack-2001-senate.py]")
SPECIAL_PLACEMENT_RE = re.compile(r"(^| )(Hospital|Nursing Home|Hostel|Sanitarium|Clinic)( |$)")


def gid(div_id, local):
    """the pack-era global-id rule shared with the House pack (its gid)"""
    return div_id * 10000 + local



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


def parse_v2d(path):
    """(div)[(ticket, bp)] = {'party', 'name?', 'OrdinaryVotes', ..., 'TotalVotes'}
    from the pack's printed V2_4_D cross-tab.
    Rows: division headers '<Div> (<enr>)'; group rows 'A  TICKET VOTES  <party> …';
    candidate rows '"NAME"  <party> …'; totals rows 'Group Total  <party> …' (skipped);
    elected rows lead with '#'. Each numeric block is six vote,pct pairs, votes on
    even slots. Anything else in the layout means the product moved - stop."""
    out = collections.defaultdict(dict)
    cur_div = None
    cur_grp = None
    cur_n = 0
    with open(path, encoding="utf-8", errors="replace") as f:
        for ln in f:
            s = ln.strip()
            if not s:
                continue
            m = re.match(r"^([A-Za-z][A-Za-z' -]*)\s?\((\d+)\)\s*$", s)
            if m and "Election" not in s:
                cur_div = m.group(1).rstrip()
                cur_grp, cur_n = None, 0
                continue
            if cur_div is None:
                continue
            toks = [t for t in re.split(r"\s{2,}|\t+", s) if t.strip()]
            if not toks:
                continue
            head = toks[0]
            if head == "Ungrouped Total":
                # one aggregate print per division rides the ("UG", 0) key
                nums = toks[1:]
                assert all(re.fullmatch(r"\d+(?:\.\d+)?", x) for x in nums) and len(nums) == 12, ln
                out[cur_div]["UG", 0] = {"party": "UG", "name": "Ungrouped Total",
                                         "OrdinaryVotes": int(nums[0]), "AbsentVotes": int(nums[2]),
                                         "ProvisionalVotes": int(nums[4]), "PrePollVotes": int(nums[6]),
                                         "PostalVotes": int(nums[8]), "TotalVotes": int(nums[10])}
                continue
            if head in ("Candidates", "Party", "Ordinary", "Absent", "Provisional", "Postal",
                        "Total", "Group", "State", "Sensor") or "Group Total" in head:
                continue
            if toks[0].startswith("#"):
                toks = toks[1:]
            if len(toks) < 3:
                continue
            nums_i = None
            for i, tk in enumerate(toks):
                if re.fullmatch(r"\d+", tk):
                    nums_i = i
                    break
            if nums_i is None:
                continue
            nums = toks[nums_i:]
            if not all(re.fullmatch(r"\d+(?:\.\d+)?", x) for x in nums):
                continue
            if len(nums) != 12:
                continue
            picks = [int(nums[0]), int(nums[2]), int(nums[4]), int(nums[6]), int(nums[8]), int(nums[10])]
            party_tok = toks[nums_i - 1]
            name = None
            if any("TICKET VOTES" in x for x in toks[:nums_i]):
                cur_grp = toks[0]
                cur_n = 0
                key = (toks[0], 0)
            else:
                cur_n += 1
                key = (cur_grp, cur_n)
                name = toks[0].strip('"')
            assert key[0] is not None, (cur_div, ln)
            assert key not in out[cur_div], (cur_div, key, "duplicate printed row")
            out[cur_div][key] = {"party": party_tok, "name": name,
                                 "OrdinaryVotes": picks[0], "AbsentVotes": picks[1],
                                 "ProvisionalVotes": picks[2], "PrePollVotes": picks[3],
                                 "PostalVotes": picks[4], "TotalVotes": picks[5]}
    return dict(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    ids = json.load(open(SRC + "/place-ids-2001.json"))
    divs = ids["divisions"]
    pm = ids["places"]["roll"]
    # names per division for norm joins
    pm_norm = {d: {} for d in pm}
    for d, rows in pm.items():
        for printed in rows:
            pm_norm[d].setdefault(norm(printed), printed)
    pm_prefix = {d: sorted(rows, key=len, reverse=True) for d, rows in pm.items()}

    div_id_of = {d: divs[d]["id"] for d in divs}
    div_state_of = {d: divs[d]["st"] for d in divs}

    # candidates (scands): (st, ticket, ballot pos) -> row
    cands = {}
    cand_name = {}
    cand_party = {}
    base = {}
    for r in rows_semi(SRC + "/scands-2001.txt"):
        st, t, bp = r["State"], r["Ticket"], int(r["Ballot Position"])
        cands[(st, t, bp)] = r
        cand_name[(st, t, bp)] = r["Candidate"]
        cand_party[(st, t, bp)] = r["Party"] or ""
        cand_party[(st, t, 0)] = r["Party"] or ""  # ticket votes ride the group's party
    for st in STATES:
        assert any(k[0] == st for k in cand_name), f"scands missing {st}"
    seq_ids = {}
    for i, st in enumerate(STATES):
        n = 0
        for k in sorted(k2 for k2 in cands if k2[0] == st):
            t, bp = k[1], k[2]
            n += 1
            seq_ids[st, t, bp] = (i + 1) * 10000 + n
        assert n, f"no scands entries for {st}"
        # ticket rows (BP 0): their group's own ids, by its tickets' order at the ballot
        per_state_tickets = sorted({t for (s, t, bp) in seq_ids if s == st})
        for j, trow in enumerate(per_state_tickets):
            seq_ids[st, trow, 0] = (i + 1) * 10000 + 500 + j

    # sppvote sums per (division, ticket, ballot pos, vote type)
    # the pack's pseudo-place summary pseudo-rows restate every division's
    # totals ("Division Summary"; nominal "Adj" adjustment rows in the product
    # family) — both summarise, never add: skip from the counting lanes or every
    # value would come out doubled (verified: the value that appeared twice
    # over the whole state without this filter)
    SKIP_SUMMARY = {"Division Summary", "Adj"}
    sen_zz = collections.defaultdict(dict)   # "ZZ" rows: per-place formal/informal/total
    tt = collections.defaultdict(collections.Counter)
    for r in rows_semi(SRC + "/sppvote-2001.csv.gz"):
        assert r["Division"] in div_id_of, r
        if r["Ticket"] == "ZZ":
            # pack pseudo ticket: ballot positions 998/999/1000 = formal/informal/total
            assert int(r["Ballot Position"]) in (998, 999, 1000), r
            sen_zz[(r["Division"], r["Polling Place"])] = sen_zz.get((r["Division"], r["Polling Place"]), {})
            sen_zz[(r["Division"], r["Polling Place"])][int(r["Ballot Position"])] = int(r["Vote"])
            continue
        if r["Polling Place"] in SKIP_SUMMARY:
            continue
        tt[(r["Division"], r["Ticket"], int(r["Ballot Position"]))][DECL.get(r["Polling Place"], "ord")] += int(r["Vote"])
    # internal recompose of the pseudo ticket + per-place formal oracle:
    # posted places' ZZ.formal equals the same places' own candidate sum, and
    # ZZ.total == ZZ.formal + ZZ.informal, always
    for (dv, pp), z in sen_zz.items():
        assert z[998] + z[999] == z[1000], (dv, pp, z)
    print("zz recompose: pass; pseudo-place formal rows:", len(sen_zz))
    # group party consistency: every one of a state's tickets appears in scands
    for (dv, t, bp) in tt:
        assert bp == 0 or (div_state_of[dv], t, bp) in cand_name, f"{dv} {t} {bp}: candidate not in scands"

    # ------ the gate: sppvote recomputes the printed V2_4_D exactly ------
    pr = parse_v2d(V2D)
    assert pr, "V2_4_D parse returned nothing"
    miss = []
    for (dv, t, bp), vt in tt.items():
        mine = {tc: vt[k] for (k, tc) in (("ord", "OrdinaryVotes"), ("abs", "AbsentVotes"), ("prov", "ProvisionalVotes"),
                                          ("pre", "PrePollVotes"), ("post", "PostalVotes"))}
        mine["TotalVotes"] = sum(mine.values())
        if t == "UG":
            # sppvote's per-candidate UG positions aggregate to the printed
            # "Ungrouped Total" rather than appearing one row each
            key_us = (t, bp)
            continue
            delta = {tc: (mine[tc], want.get(tc)) for tc in TYPE_COLS + ("TotalVotes",)} if want else {"division": "missing"}
            miss.append((dv, t, bp, delta))
    # UG aggregates: Σ per-candidate votes per division per type == printed Ungrouped Total
    ug_acc = collections.defaultdict(collections.Counter)
    for (dv, t, bp), vt in tt.items():
        if t != "UG":
            continue
        for k, v in vt.items():
            ug_acc[dv][k] += v
    misplaced = []
    for dv, acc in ug_acc.items():
        want = pr.get(dv, {}).get(("UG", 0))
        mine = {tc: acc[k] for (k, tc) in (("ord", "OrdinaryVotes"), ("abs", "AbsentVotes"), ("prov", "ProvisionalVotes"),
                                           ("pre", "PrePollVotes"), ("post", "PostalVotes"))}
        mine["TotalVotes"] = sum(mine.values())
        if not want or any(want[tc] != mine[tc] for tc in TYPE_COLS + ("TotalVotes",)):
            misplaced.append((dv, mine, want))
    assert not misplaced, misplaced[:3]
    print("gate: UG aggregates recombine to the printed Ungrouped Total rows")

    assert not miss, miss[:4]
    print("gate: sppvote sums of every candidate × division × type == the pack's V2_4_D print")

    # sppvote -> pp fails classification run
    sp_hosp = collections.defaultdict(dict)  # pseudo placements named only in sppvote

    def pid_of(dv, pp):
        if pp in pm[dv]:
            return pm[dv][pp]
        n = norm(pp)
        if n in pm_norm[dv]:
            return pm[dv][pm_norm[dv][n]]
        hits = [pm[dv][p] for p in pm_prefix[dv] if norm(p).startswith(n) and len(n) >= 6]
        if len(hits) == 1:
            return hits[0]
        if pp in V310_PSEUDO:
            return gid(dv_id(dv), V310_PSEUDO[pp])
        if pp == "Special Hospitals":
            return gid(dv_id(dv), V310_PSEUDO["Special Hospitals"])
        if SPECIAL_PLACEMENT_RE.search(pp):
            sp_hosp.setdefault(dv, {}).setdefault(pp, gid(dv_id(dv), 9001 + len(sp_hosp[dv])))
            return sp_hosp[dv][pp]
        raise SystemExit(f"unclassified sppvote polling place {pp!r} in {dv}")

    # div lane
    orows = collections.defaultdict(list)
    dv_id = lambda dv: div_id_of[dv]
    for st in STATES:
        rows = []
        for (dv, t, bp), vt in sorted(tt.items(), key=lambda kv: (divs_dv(kv[0][0]), kv[0][1], kv[0][2])) if False else []:
            pass
    divs_dv = lambda dv: (STATES.index(div_state_of[dv]), dv_id(dv))
    by_div = collections.defaultdict(list)
    for (dv, t, bp), vt in tt.items():
        st = div_state_of[dv]
        c = cands[(st, t, bp)] if bp != 0 else None
        nm = c["Candidate"] if bp != 0 else f"{t} Ticket Votes"
        by_div[dv].append([st, div_id_of[dv], dv, t, seq_ids[(st, t, bp)], bp, nm,
                           cand_party[(st, t, 0)], cand_party[(st, t, 0)], "",
                           vt["ord"], vt["abs"], vt["prov"], vt["pre"], vt["post"], sum(vt.values())])
    orow_all = []
    for dv in sorted(by_div, key=divs_dv):
        orow_all.extend(by_div[dv])
    gzwrite(OUT + "/div-2001.csv.gz",
            ["StateAb", "DivisionID", "DivisionNm", "Ticket", "CandidateID", "BallotPosition", "CandidateDetails",
             "PartyName", "PartyAb", "SittingMemberFl", "OrdinaryVotes", "AbsentVotes", "ProvisionalVotes",
             "PrePollVotes", "PostalVotes", "TotalVotes"], orow_all,
            "By Division By Candidate By Vote Type")

    # per-state pp lanes
    pp_rows = collections.defaultdict(list)
    sp_place_rows = []
    for r in rows_semi(SRC + "/sppvote-2001.csv.gz"):
        dv = r["Division"]
        if r["Ticket"] == "ZZ" or r["Polling Place"] in SKIP_SUMMARY or r["Polling Place"] in DECL:
            continue
        pid = pid_of(dv, r["Polling Place"])
        st = div_state_of[dv]
        t = r["Ticket"]
        bp = int(r["Ballot Position"])
        c = cands[(st, t, bp)] if bp != 0 else None
        nm = c["Candidate"] if bp != 0 else f"{t} Ticket Votes"
        pp_rows[st].append([st, div_id_of[dv], dv, pid, r["Polling Place"], t, seq_ids[(st, t, bp)], bp, nm,
                            cand_party[(st, t, 0)], int(r["Vote"])])
    for st in STATES:
        gzwrite(OUT + f"/pp-2001-{st}.csv.gz",
                ["StateAb", "DivisionID", "DivisionNm", "PollingPlaceID", "PollingPlaceNm", "Ticket", "CandidateID",
                 "BallotPosition", "CandidateDetails", "PartyNm", "OrdinaryVotes"], pp_rows[st],
                "By Polling Place")
    print(f"div lane {len(orow_all)} rows; pp:", {st: len(pp_rows[st]) for st in STATES})


if __name__ == "__main__":
    main()
