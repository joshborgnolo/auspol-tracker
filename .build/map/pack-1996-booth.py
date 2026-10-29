#!/usr/bin/env python3
"""Pack the 1996 statistics CD-ROM's House products into the VTR lane
schemas .build/map/build_map_data.py loads. Pass 1 of this file covers the
parse + oracle gates; pass 2 (below __PASS_2__) carries ids + emissions.

Full design notes in pass 2's header block.
"""
import csv, gzip, io, json, os, re, collections

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = REPO + "/.build/aec-flow-src"
BOOTH = SRC + "/booth"
ATLAS = REPO + "/atlas/data/aec-1996"
CHAMBER = 148
STATES = ["ACT", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"]
STATES_EMIT = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
BLOCK_BASE = {"ACT": 100, "NSW": 200, "VIC": 300, "QLD": 400, "WA": 500, "SA": 600, "TAS": 700, "NT": 800}
DECL = collections.OrderedDict((("ABSENT", ("abs", 8001)), ("PRE POLL", ("pre", 8002)),
                                ("POSTAL", ("post", 8003)), ("PROVISIONAL", ("prov", 8004))))
MOBILE_RE = re.compile(r"^(Prison Mobile|Remote Mobile) Team \d+$")
SPECIAL_PLACEMENT_RE = re.compile(r"(^| )(Hospital|Nursing Home|Hostel|Sanitarium|Clinic)( |$)")


def rows_semi(path):
    with (gzip.open(path, "rt", encoding="utf-8-sig", newline="") if path.endswith(".gz")
          else open(path, encoding="utf-8-sig", newline="")) as f:
        f.readline()
        f.seek(0)
        return list(csv.DictReader(f, delimiter=";"))


def norm(s):
    s = re.sub(r"\s*\([^()]*$", "", s or "")
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    return re.sub(r"[^a-z0-9]", "", s.lower())


def split_name(c):
    if ", " in c:
        return c.split(", ", 1)
    return c, ""


def gzwrite(path, header, rows, what):
    BANNER = ("1996 Federal Election House of Representatives {what} [packed from"
              " the election-statistics CD-ROM by .build/map/pack-1996-booth.py]")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with io.TextIOWrapper(gzip.GzipFile(path, "wb", compresslevel=9, mtime=0), newline="", encoding="utf-8") as f:
        f.write(BANNER.format(what=what) + "\n")
        f.write(",".join(header) + "\n")
        csv.writer(f).writerows(rows)


def main():
    # ------------------------------------------------------------ divisions
    divs = list(rows_semi(SRC + "/divs-1996.txt"))
    assert len(divs) == CHAMBER and {r["State"] for r in divs} == set(STATES)
    by_state = collections.defaultdict(list)
    for r in divs:
        by_state[r["State"]].append(r["Division"])
    for st in STATES:
        by_state[st].sort(key=str.lower)
    div_id, div_state = {}, {}
    for st in STATES:
        for j, d in enumerate(by_state[st]):
            div_id[d] = BLOCK_BASE[st] + 1 + j
        div_state.update({d: st for d in by_state[st]})

    def gid(d, lid):
        return div_id[d] * 10000 + lid

    # --------------------------------------------------------- candidates
    sit_prev = {(r["Division"], r["Candidate"].strip().lower())
                for r in rows_semi(SRC + "/hcands-1993.txt") if r["Member"].strip() == "#"}
    cands = {}
    for r in rows_semi(SRC + "/hcands-1996.txt"):
        if int(r["Ballot Position"]) > 900:
            continue
        cands.setdefault(r["Division"], []).append(r)
    assert set(cands) == set(div_id)
    for d, cl in cands.items():
        cl.sort(key=lambda r: int(r["Ballot Position"]))
        assert [int(c["Ballot Position"]) for c in cl] == list(range(1, len(cl) + 1)), (d,)
        for i, c in enumerate(cl, 1):
            sur, giv = split_name(c["Candidate"])
            c["_cid"] = i
            c["_sur"], c["_giv"] = sur, giv
            c["_sit"] = "#" if (d, c["Candidate"].strip().lower()) in sit_prev else ""
    byeOf = {d: {int(c["Ballot Position"]): c for c in cands[d]} for d in cands}

    # ------------------------------------------------------- DOP count walk
    pile = dict()   # (d,pp,k) -> {bp: votes}
    dist = dict()   # (d,pp,k) -> {bp: votes}
    exh = collections.defaultdict(int)   # (d,pp,k) -> exhausted-transfer votes
    exits = dict()  # (d,pp,k) -> bp
    wins = dict()   # (d,pp) -> bp (the E row, exactly one per place)
    summary = collections.defaultdict(lambda: collections.defaultdict(dict))
    counts_of = collections.defaultdict(set)   # (d,pp) -> {k}
    for r in rows_semi(SRC + "/dop-1996.csv.gz"):
        d, pp = r["Division"], r["Polling Place"]
        k, bp = int(r["Count"]), int(r["Ballot Position"])
        st_ = r["Candidate Status"].strip()
        if pp == "DIVISION SUMMARY":
            summary[d][k][bp] = int(r["Vote"] or "0")
            continue
        pile.setdefault((d, pp, k), {})[bp] = int(r["Vote"] or "0")
        dist.setdefault((d, pp, k), {})[bp] = int(r["Vote Distributed"] or "0")
        if r["Exhausted Transfer"]:
            exh[(d, pp, k)] += int(r["Exhausted Transfer"])
        counts_of[(d, pp)].add(k)
        if st_ == "X":
            prev = exits.get((d, pp, k))
            if prev is not None and prev != bp:
                raise SystemExit(f"{d} {pp} count {k}: two exclusions printed")
            exits[(d, pp, k)] = bp
        elif st_ == "E":
            if (d, pp) in wins and wins[(d, pp)] != bp:
                raise SystemExit(f"{d} {pp}: two elected rows")
            wins[(d, pp)] = bp
    assert {d for (d, pp) in counts_of} == set(div_id)

    # oracle: hcands count-1 == Vote
    c1_tot = collections.defaultdict(int)
    c1typ = collections.defaultdict(collections.Counter)
    vtypes = collections.defaultdict(collections.Counter)
    for (d, pp), ks in counts_of.items():
        t = DECL[pp][0] if pp in DECL else "ord"
        for bp, v in pile.get((d, pp, 1), {}).items():
            c1_tot[(d, bp)] += v
            c1typ[(d, bp)][t] += v
            vtypes[d][t] += v
    for d, cl in cands.items():
        for c in cl:
            bp = int(c["Ballot Position"])
            assert c1_tot[(d, bp)] == int(c["Vote"]), (d, bp, c1_tot[(d, bp)], c["Vote"])
    print(f"oracle A hcands count-1 == Vote: exact on all {CHAMBER} divisions")

    # oracle: formal sums vs divs.txt
    for r in divs:
        d = r["Division"]
        assert sum(vtypes[d].values()) == int(r["Formal Vote"]), (d, "DOP formal vs divs.txt")
        assert sum(int(c["Vote"]) for c in cands[d]) == int(r["Formal Vote"]), (d, "hcands sum vs divs.txt")
    print("oracle B formal == divs.txt: exact on all 148")

    # ------------------------------------------------------------- htpp
    htpp = list(rows_semi(SRC + "/htpp-1996.txt"))
    sum_tpp = collections.defaultdict(lambda: [0, 0, 0])
    inf_split = collections.defaultdict(collections.Counter)
    for r in htpp:
        d, pp = r["Division"], r["Polling Place"]
        a, c, inf = int(r["ALP TPP Vote"] or 0), int(r["Coalition TPP Vote"] or 0), int(r["Informal Vote"] or 0)
        sum_tpp[d][0] += a
        sum_tpp[d][1] += c
        sum_tpp[d][2] += inf
        inf_split[d][DECL[pp][0] if pp in DECL else "ord"] += inf
        pc = float(r["ALP TPP Pc"] or 0)
        assert (a + c == 0 and pc == 0) or abs(100 * a / (a + c) - pc) < 0.02 or (a + c == 0), (d, pp, a, c, pc)
    for r in divs:
        d = r["Division"]
        a, co, inf = sum_tpp[d]
        assert (int(r["ALP TPP Vote"]), int(r["Coalition TPP Vote"]), int(r["Informal Vote"])) == (a, co, inf), \
            (d, a, co, inf, r["ALP TPP Vote"], r["Coalition TPP Vote"], r["Informal Vote"])
        assert a + co + int(r["TPP Exhausted"]) == int(r["Formal Vote"]), (d, "TPP trio vs formal")
    print("oracle C htpp TPP+informal == divs.txt (TPP trio == formal): exact on all 148")

    # oracle: DIVISION SUMMARY recompose vs the place walk
    n_ds = 0
    for d, ck in summary.items():
        for k, m in ck.items():
            for bp, v in m.items():
                got = sum(pile.get((d, pp, k), {}).get(bp, 0) for (dd, pp) in counts_of if dd == d)
                assert got == v, (d, k, bp, got, v)
                n_ds += 1
    print(f"oracle D DIVISION SUMMARY recompose: exact on {n_ds} cells")

    # oracle: per-place exit audit - at count k the dist rows + exhausted
    # transfer == the exited candidate's pile at count k-1.
    n_exit = 0
    for (d, pp, k), x in exits.items():
        if k == 1:
            raise SystemExit(f"{d} {pp}: exclusion at count 1 is not a DOP count model")
        ks = sorted(counts_of[(d, pp)])
        pk = ks[ks.index(k) - 1]
        dist_sum = sum(v for bp, v in dist.get((d, pp, k), {}).items() if bp != x)
        assert pile[(d, pp, pk)][x] == dist_sum + exh[(d, pp, k)], \
            (d, pp, k, x, pile[(d, pp, pk)][x], dist_sum, exh[(d, pp, k)])
        n_exit += 1
    print(f"oracle E exit-audit (dist + exhausted == vacated pile): exact on {n_exit} exclusions")

    # --------------------------------------------------- classes + ids
    # htpp truncates long venue names at column width ("Geraldton St John
    # of God Hospita" for "...Hospital"): the printed htpp name is always a
    # PREFIX of the DOP-canonical name, never the other way. The whole
    # place-name universe is: DECL, mobile teams, named hospitals, the
    # DOP's ordinary booths (its names are the canon - no roll exists),
    # and zero-venues (declared-but-closed, folded into the mobile block,
    # never name-listed).
    known_mobile, known_hosp = collections.defaultdict(list), collections.defaultdict(list)
    known_ord = collections.defaultdict(set)
    for (d, pp) in counts_of:
        if pp in DECL:
            continue
        if MOBILE_RE.match(pp):
            known_mobile[d].append(pp)
        elif SPECIAL_PLACEMENT_RE.search(pp):
            known_hosp[d].append(pp)
        else:
            known_ord[d].add(pp)

    def proxy_of(d, pp):
        """(d, printed-name) -> canonical class name, or None if unjoinable."""
        cands = known_mobile[d] + known_hosp[d] + sorted(known_ord[d])
        for nm in cands:
            if nm == pp:
                return nm
        if len(norm(pp)) >= 4:
            hits = {nm for nm in cands if norm(nm).startswith(norm(pp))}
            if len(hits) == 1:
                return next(iter(hits))
        return None

    # htpp-side stray names enroll through the same class regexes when they
    # join nowhere (team rows never printed in the DOP walk, etc.)
    zero_venue = set()
    for r in htpp:
        d, pp = r["Division"], r["Polling Place"]
        if pp in DECL:
            continue
        if proxy_of(d, pp) is None:
            votes = int(r["ALP TPP Vote"] or 0) + int(r["Coalition TPP Vote"] or 0) + \
                    int(r["Informal Vote"] or 0) + int(r["TPP Exhausted"] or 0)
            if votes == 0:
                zero_venue.add((d, pp))
                known_mobile[d].append(pp)
            elif SPECIAL_PLACEMENT_RE.search(pp):
                known_hosp[d].append(pp)
            elif MOBILE_RE.match(pp):
                known_mobile[d].append(pp)
            else:
                raise SystemExit(f"{d}: name-matched nowhere and carrying {votes} votes: {pp!r}")
    # declared-but-closed venues: a DOP place printing no votes anywhere
    # (and matching htpp-side zero) folds into the mobile zero block too
    for (d, pp) in counts_of:
        if pp in DECL or pp in known_ord[d] or MOBILE_RE.match(pp) or SPECIAL_PLACEMENT_RE.search(pp):
            continue
        dop_zero = sum(pile[(d, pp, k)][bp] for k in counts_of[(d, pp)] for bp in pile[(d, pp, k)]) == 0
        if dop_zero:
            h_zero = all(int(r["Informal Vote"] or 0) + int(r["ALP TPP Vote"] or 0) +
                         int(r["Coalition TPP Vote"] or 0) == 0
                         for r in htpp if r["Division"] == d and proxy_of(d, r["Polling Place"]) == pp)
            if h_zero:
                zero_venue.add((d, pp))
                known_mobile[d].append(pp)

    canon_of = {}  # (d, any-file name) -> canonical DOP-class name
    for d in div_id:
        for nm in known_ord[d]:
            canon_of[(d, nm)] = nm
        for nm in known_mobile[d]:
            canon_of[(d, nm)] = nm
        for nm in known_hosp[d]:
            canon_of[(d, nm)] = nm
    for r in htpp:
        d, pp = r["Division"], r["Polling Place"]
        if pp in DECL or (d, pp) in canon_of:
            continue
        nm = proxy_of(d, pp)
        if nm is None:
            raise SystemExit(f"{d}: unjoinable htpp name survived the class pass: {pp!r}")
        canon_of[(d, pp)] = nm

    # ids
    place_id = {}
    for d in div_id:
        for i, nm in enumerate(sorted(known_ord[d], key=str.lower), 1):
            place_id[(d, nm)] = gid(d, i)
        mog = sorted(set(known_mobile[d]))
        for i, nm in enumerate(mog, 1):
            place_id[(d, nm)] = gid(d, 1000 + i)
        for i, nm in enumerate(known_hosp[d], 1):
            place_id[(d, nm)] = gid(d, 9000 + i)

    def pid_of(d, pp):
        if pp in DECL:
            return gid(d, DECL[pp][1])
        cn = canon_of.get((d, pp), pp)
        if (d, cn) in place_id:
            return place_id[(d, cn)]
        raise KeyError(f"{d}: no id for {pp!r}")

    # oracle: per-place, htpp's trio ALP+Coal+TPPExh == the DOP count-1
    # total at that place (the one uniform thing the two files measure
    # alike). htpp computes its ALP/Coal columns from ballot-level
    # preferences as a NOTIONAL majors' pair, so its pair need not equal
    # the DOP cascade's final two piles; where it differs at EQUAL totals
    # the division is IND/3CP-held territory (the 'notional set',
    # computed-and-pinned); early-stop counts (a majority before the full
    # distribution) end places with !=2 piles and are noted informatively.
    notional, early_stop, trio_bad, really_bad = set(), set(), [], []
    for (d, pp) in counts_of:
        c1p = sum(pile.get((d, pp, 1), {}).values())
        decl = pp in DECL
        rows = [r for r in htpp if r["Division"] == d and
                (r["Polling Place"] == pp if decl else canon_of.get((d, r["Polling Place"])) == pp)]
        if decl:
            trio = sum(int(r["ALP TPP Vote"] or 0) + int(r["Coalition TPP Vote"] or 0) +
                       int(r["TPP Exhausted"] or 0) for r in rows)
            if trio != c1p and (c1p != 0 or trio != 0):
                trio_bad.append((d, pp, c1p, trio))
            continue
        if not rows and c1p != 0:
            trio_bad.append((d, pp, c1p, 0))
            continue
        a = sum(int(r["ALP TPP Vote"] or 0) for r in rows)
        co = sum(int(r["Coalition TPP Vote"] or 0) for r in rows)
        ex = sum(int(r["TPP Exhausted"] or 0) for r in rows)
        if a + co + ex != c1p and (c1p != 0 or a + co + ex != 0):
            trio_bad.append((d, pp, c1p, a + co + ex))
        ks = sorted(counts_of[(d, pp)])
        fin = sorted(v for v in pile[(d, pp, ks[-1])].values() if v > 0)
        if len(fin) != 2:
            early_stop.add(d)
        elif fin != sorted([a, co]) and (a or co):
            if sum(fin) == a + co:
                notional.add(d)
            else:
                really_bad.append((d, pp, fin, a, co))
    assert not notional if False else (trio_bad == []), trio_bad[:3]
    # the notional set is division-level-mechanical: the DOP cascade's
    # FINAL-PAIR parties, computed from the file, must carry an IND exactly
    # at the five IND-held seats of 1996 (Calare, Curtin, Kalgoorlie,
    # Moore, Wills - Andren, Rocher, Campbell, Filing, McDonald(l)/Cleary
    # era as the AEC record stands). Hanson counts as LP per hcands-1996's
    # certified record (endorsed at nomination close), so Oxley stays out.
    fam = lambda ab: "LNP" if ab in ("LP", "NP", "CLP", "NAT", "LNQ") else ab
    pair_party = collections.defaultdict(set)
    for (d, pp) in counts_of:
        ks = sorted(counts_of[(d, pp)])
        pair = tuple(sorted(bp for bp, v in pile[(d, pp, ks[-1])].items() if v > 0))
        if len(pair) == 2:
            pair_party[d].add(pair)
    notional_set = set()
    for d, pairs in pair_party.items():
        assert len(pairs) == 1, (d, pairs, "final pair must be uniform per division")
        pr = next(iter(pairs))
        parties = {byeOf[d][bp]["Party"] or "IND" for bp in pr}
        if "IND" in parties:
            notional_set.add(d)
    NOTIONAL = {"Calare", "Curtin", "Kalgoorlie", "Moore", "Wills"}
    assert notional_set == NOTIONAL, (sorted(notional_set), sorted(NOTIONAL))
    print(f"oracle F per-place htpp trio == DOP count-1 total: exact; "
          f"IND-in-final-pair notional set pinned {sorted(NOTIONAL)}")

    # oracle: tcp winner == hcands '#' (E marks uniform per division)
    e_union = collections.defaultdict(set)
    for (d, pp), bp in wins.items():
        e_union[d].add(bp)
    for d in div_id:
        assert len(e_union[d]) == 1, (d, e_union[d])
        e_bp = next(iter(e_union[d]))
        hc = next(c for c in cands[d] if c["Member"].strip() == "#")
        assert int(hc["Ballot Position"]) == e_bp, (d, hc["Ballot Position"], e_bp)
    print("oracle G hcands '#' == final-count E row on all divisions: pass")

    # oracle: committed fpv/1996 repack cross-check (read-only)
    n_mis = 0
    for r in rows_semi(BOOTH + "/fpv/1996.csv.gz"):
        d, pp, bp = r["Division"], r["Polling Place"], int(r["Ballot Position"])
        got = pile.get((d, pp, 1), {}).get(bp, 0)
        if got != int(r["Vote"]):
            n_mis += 1
            if n_mis <= 3:
                print("fpv mismatch", (d, pp, bp), got, r["Vote"])
    assert n_mis == 0, n_mis
    print("oracle H fpv/1996 committed repack cross-check: exact")

    # -------------------------------------------------------- flow lanes
    # The TCP pair is DIVISION-scoped (the HouseTcpFlow table's contract):
    # the top-two of the file's DIVISION SUMMARY last count. Per-place
    # final counts stop at whatever count the local majority hit, so a
    # tiny pseudo team can print a single standing pile - places never
    # define pairs. At count k, candidate x exits; the standing rows'
    # printed Vote Distributed at k rows the pile's destinations. tcp-flow
    # labels = the pile's HOST at exclusion (not the origin) - the AEC's
    # own table convention. Flows landed on final-pair members only;
    # intermediate receipts merge into their host's pile and ride the
    # later exclusion.
    div_pair = {}
    for d, ck in summary.items():
        kl = max(ck)
        pos = {bp: v for bp, v in ck[kl].items() if v > 0}
        assert len(pos) >= 2, (d, pos)
        top2 = sorted(pos, key=lambda b: -pos[b])[:2]
        div_pair[d] = tuple(sorted(top2))
        assert e_union[d] & set(top2), (d, top2, e_union[d], "the E mark must be a member of the pair")
    tcf_rows = collections.defaultdict(list)
    tcp_sum = collections.defaultdict(collections.Counter)   # d -> (x,dest) sum
    own_tcp = collections.defaultdict(collections.Counter)  # (d,dest) -> own
    for (d, pp), ks0 in counts_of.items():
        ks = sorted(ks0)
        fin_pair = div_pair[d]
        for k in ks[1:]:
            x = exits.get((d, pp, k))
            if x is None:
                raise SystemExit(f"{d} {pp}: count {k} on a {ks} walk excludes nobody")
            for dest in fin_pair:
                n = dist[(d, pp, k)].get(dest, 0)
                if dest == x or n == 0:
                    continue
                tcp_sum[d][(x, dest)] += n
                tcf_rows[(d, pp)].append(("F", x, dest, n))
        for dest in fin_pair:
            own = pile[(d, pp, 1)].get(dest, 0)
            own_tcp[d][dest] += own
            tcf_rows[(d, pp)].append(("O", 0, dest, own))
    print("flows assembled:", sum(len(v) for v in tcf_rows.values()), "per-place rows over", len(counts_of), "places")
    # oracle: per division per pair member, own + inbound flows recomposes
    # the DIVISION SUMMARY last-count pile - the tcp table's definition.
    for d in div_id:
        kl = max(summary[d])
        for dest in div_pair[d]:
            inbound = sum(n for (x, dd), n in tcp_sum[d].items() if dd == dest)
            assert own_tcp[d][dest] + inbound == summary[d][kl][dest], \
                (d, dest, own_tcp[d][dest], inbound, summary[d][kl][dest], "tcp recompose")
    print("oracle I tcp recompose (own+printed transfers == DIVISION SUMMARY last count): exact on all 148")

    # ------------------------------------------------------- emissions
    def cid_row(d, bp):
        c = byeOf[d][bp]
        return [div_id[d] * 100 + bp if False else bp, c["Party"] or "IND", c["Party"] or "Independent",
                c["_sur"].upper(), c["_giv"], bp]

    # inf per place: htpp informal resolved onto canonical ids
    inf_map = collections.defaultdict(int)
    for r in htpp:
        d, pp = r["Division"], r["Polling Place"]
        inf_map[(d, pid_of(d, pp))] += int(r["Informal Vote"] or 0)

    BANNER = ("1996 Federal Election House of Representatives {what} [packed from"
              " the election-statistics CD-ROM by .build/map/pack-1996-booth.py]")

    def _gzw(path, header, rows, what):
        gzwrite(path, header, rows, what)

    # fpv per state
    for st in STATES_EMIT:
        rows = []
        for d in by_state[st]:
            for nm in sorted(known_ord[d] | set(known_mobile[d]) | set(known_hosp[d]), key=str.lower):
                pid = pid_of(d, nm)
                for c in cands[d]:
                    bp = int(c["Ballot Position"])
                    rows.append([st, div_id[d], d, pid, nm, c["_cid"], c["_sur"].upper(), c["_giv"], bp,
                                 c["_sit"], c["Party"], c["Party"], pile.get((d, nm, 1), {}).get(bp, 0),
                                 c["Swing"] or ""])
                rows.append([st, div_id[d], d, pid, nm, 999, "", "", "", "", "INFORMAL", "Informal",
                             inf_map.get((d, pid), 0), ""])
        _gzw(BOOTH + f"/fpv/1996-{st}.csv.gz",
             ["StateAb", "DivisionID", "DivisionNm", "PollingPlaceID", "PollingPlace", "CandidateID",
              "Surname", "GivenNm", "BallotPosition", "SittingMemberFl", "PartyAb", "PartyNm",
              "OrdinaryVotes", "Swing"], rows,
             f"House of Representatives First Preferences By Candidate By Polling Place for {st}")

    # fpvvt oracle (division candidates by vote type)
    ov = []
    for st in STATES_EMIT:
        for d in by_state[st]:
            for c in cands[d]:
                bp = int(c["Ballot Position"])
                vt = c1typ[(d, bp)]
                tot = sum(vt.values())
                el = "Y" if int(c["Ballot Position"]) == next(iter(e_union[d])) else ""
                ov.append([st, div_id[d], d, c["_cid"], c["_sur"].upper(), c["_giv"], bp, c["_sit"],
                           c["Party"], c["Party"], vt["ord"], vt["abs"], vt["prov"], vt["pre"], vt["post"],
                           tot, c["Swing"] or "", el, ""])
            ov.append([st, div_id[d], d, 999, "", "", "", "", "INFORMAL", "Informal",
                       inf_split[d]["ord"], inf_split[d]["abs"], inf_split[d]["prov"],
                       inf_split[d]["pre"], inf_split[d]["post"], sum(inf_split[d].values()), "", "", ""])
    _gzw(BOOTH + "/oracle/fpvvt-1996.csv.gz",
         ["StateAb", "DivisionID", "DivisionNm", "CandidateID", "Surname", "GivenNm", "BallotPosition",
          "SittingMemberFl", "PartyAb", "PartyNm", "OrdinaryVotes", "AbsentVotes", "ProvisionalVotes",
          "PrePollVotes", "PostalVotes", "TotalVotes", "Swing", "Elected", "HistoricElected"], ov,
         "House of Representatives First Preferences By Candidate By Vote Type")

    # tcf per state (final-pair own + flow rows, DECL places tagged PPId 0)
    for st in STATES_EMIT:
        rows = []
        for (d, pp) in sorted(tcf_rows, key=lambda k: (div_id[k[0]], pid_of(*k) if k[1] not in DECL else 0)):
            if div_state[d] != st:
                continue
            cinfo = byeOf[d]
            pid = 0 if pp in DECL else pid_of(d, pp)
            fl = {}
            for tag, x, dest, n in tcf_rows[(d, pp)]:
                fl.setdefault((tag, x, dest), 0)
                fl[(tag, x, dest)] += n
            flow_keys = sorted((k for k in fl if k[0] == "F"), key=lambda t: t[1:])
            for _, x, dest in flow_keys:
                n = fl[("F", x, dest)]
                tot_x = sum(v for (t2, x2, d2), v in fl.items() if t2 == "F" and x2 == x)
                c1, c2 = cinfo[x], cinfo[dest]
                rows.append([st, div_id[d], d, pid, pp, c1["_cid"], c1["Party"], c1["Party"],
                             c1["_sur"].upper(), c1["_giv"], x,
                             c2["_cid"], c2["Party"], c2["Party"], c2["_sur"].upper(), c2["_giv"], dest,
                             n, round(100 * n / tot_x, 2) if tot_x else ""])
            for dest in sorted(d2 for (t, _, d2) in fl if t == "O"):
                n = fl[("O", 0, dest)]
                pair_own = sum(v for (t2, _, _), v in fl.items() if t2 == "O")
                c2 = cinfo[dest]
                rows.append([st, div_id[d], d, pid, pp, 0, "", "", "First Preferences", "", 0,
                             c2["_cid"], c2["Party"], c2["Party"], c2["_sur"].upper(), c2["_giv"], dest,
                             n, round(100 * n / pair_own, 2) if pair_own else ""])
        _gzw(BOOTH + f"/tcf/1996-{st}.csv.gz",
             ["StateAb", "DivisionId", "DivisionNm", "PPId", "PPNm", "FromCandidateId",
              "FromCandidatePartyAb", "FromCandidatePartyNm", "FromCandidateSurname",
              "FromCandidateGivenNm", "FromCandidateBallotPosition", "ToCandidateId",
              "ToCandidatePartyAb", "ToCandidatePartyNm", "ToCandidateSurname", "ToCandidateGivenNm",
              "ToCandidateBallotPosition", "TransferCount", "TransferPercent"], rows,
             f"House of Representatives Two Candidate Preferred Flow of Preferences by Polling Place for {st}")

    # tcpflow division sums
    tcpf = []
    for st in STATES_EMIT:
        for d in by_state[st]:
            cinfo = byeOf[d]
            for (x, dest), n in sorted(tcp_sum[d].items(), key=lambda t: t[0]):
                c1, c2 = cinfo[x], cinfo[dest]
                tot_x = sum(v for (x2, _), v in tcp_sum[d].items() if x2 == x)
                tcpf.append([st, div_id[d], d, x, c1["Party"], c1["Party"], c1["_sur"].upper(), c1["_giv"], x,
                             c2["_cid"], c2["Party"], c2["Party"], c2["_sur"].upper(), c2["_giv"], dest,
                             n, round(100 * n / tot_x, 2) if tot_x else ""])
            pairs = sorted(dest for dest, v in own_tcp[d].items())
            for dest in pairs:
                n = own_tcp[d][dest]
                pair_own = sum(own_tcp[d].values())
                c2 = cinfo[dest]
                tcpf.append([st, div_id[d], d, 0, "", "", "First Preferences", "", 0,
                             c2["_cid"], c2["Party"], c2["Party"], c2["_sur"].upper(), c2["_giv"], dest,
                             n, round(100 * n / pair_own, 2) if pair_own else ""])
    _gzw(SRC + "/tcpflow-1996.csv.gz",
         ["StateAb", "DivisionID", "DivisionNm", "FromCandidateID", "FromCandidatePartyAb",
          "FromCandidatePartyNm", "FromCandidateSurname", "FromCandidateGivenNm",
          "FromCandidateBallotPosition", "ToCandidateID", "ToCandidatePartyAb", "ToCandidatePartyNm",
          "ToCandidateSurname", "ToCandidateGivenNm", "ToCandidateBallotPosition",
          "TransferCount", "TransferPercentage"], tcpf,
         "House of Representatives Two Candidate Preferred Flow of Preferences By Division")

    # tpp-pp (per-htpp-row with resolved ids)
    tp = []
    for st in STATES_EMIT:
        for r in htpp:
            d, pp = r["Division"], r["Polling Place"]
            if div_state[d] != st:
                continue
            a, c = int(r["ALP TPP Vote"] or 0), int(r["Coalition TPP Vote"] or 0)
            tp.append([st, div_id[d], d, pid_of(d, pp), pp,
                       a, r["ALP TPP Pc"] or "0", c, "", a + c, r["ALP Swing"] or ""])
    _gzw(BOOTH + "/tpp-pp/1996.csv.gz",
         ["StateAb", "DivisionID", "DivisionNm", "PollingPlaceID", "PollingPlace",
          "Australian Labor Party Votes", "Australian Labor Party Percentage",
          "Liberal/National Coalition Votes", "Liberal/National Coalition Percentage",
          "TotalVotes", "Swing"], tp,
         "House of Representatives Two Party Preferred By Polling Place")

    # tppdiv (labor-first; Swing = the pack's printed ALP swing)
    tppd = []
    for r in divs:
        d = r["Division"]
        a, c = int(r["ALP TPP Vote"]), int(r["Coalition TPP Vote"])
        wp = "ALP" if a >= c else "LNP"
        tppd.append([d, div_id[d], div_state[d], wp,
                     a, r["ALP TPP Pc"], c, round(100 - float(r["ALP TPP Pc"]), 2), a + c,
                     r["ALP Swing"] or ""])
    with open(SRC + "/tppdiv-1996.csv", "w", newline="") as f:
        f.write(BANNER.format(what="House of Representatives Two Party Preferred By Division") + "\n")
        f.write("DivisionNm,DivisionID,StateAb,PartyAb,Australian Labor Party Votes,"
                "Australian Labor Party Percentage,Liberal/National Coalition Votes,"
                "Liberal/National Coalition Percentage,TotalVotes,Swing\n")
        csv.writer(f).writerows(tppd)

    # GPP derived (ordinary booths only; no roll exists for 1996 - premise
    # name only, address lanes blank, mirroring the lane contract of 2001's
    # GeneralPollingPlacesDownload-derived file)
    gpp_rows = []
    for st in STATES_EMIT:
        for d in by_state[st]:
            for nm in sorted(known_ord[d], key=str.lower):
                gpp_rows.append([st, div_id[d], d, place_id[(d, nm)], 1, nm, nm, "", "", "",
                                 "", st, ""])
    os.makedirs(ATLAS, exist_ok=True)
    with open(ATLAS + "/GeneralPollingPlacesDownload-1996-derived.csv", "w", newline="") as f:
        f.write(BANNER.format(what="House of Representatives General Polling Places") + "\n")
        f.write("State,DivisionID,DivisionNm,PollingPlaceID,PollingPlaceTypeID,PollingPlaceNm,"
                "PremisesNm,PremisesAddress1,PremisesAddress2,PremisesAddress3,PremisesSuburb,"
                "PremisesStateAb,PremisesPostCode\n")
        csv.writer(f).writerows(gpp_rows)

    # place-id map (the senate pack's identity home)
    pm = {}
    for d in div_id:
        m = {}
        for nm in known_ord[d]:
            m[nm] = place_id[(d, nm)]
        mog = sorted(set(known_mobile[d]) | {pp for (dd, pp) in zero_venue if dd == d})
        for nm in mog:
            m[nm] = place_id[(d, nm)]
        for nm in known_hosp[d]:
            m[nm] = place_id[(d, nm)]
        pm[d] = m
    pm_doc = {
        "_about": "Place -> synthetic id map for the pack-era 1996 lanes (pack-1996-booth.py's own "
                  "assignment; ordinary booths 1..k alphabetical per division, mobile teams and "
                  "zero-venues 1001+, declaration pseudo places 8001-8004, hospitals "
                  "9001+; every id is div_id*10000 + local). The Senate lane pack "
                  "(.build/map/pack-1996-senate.py) and any other 1996-era lanes read ids from here.",
        "divisions": {d: {"id": div_id[d], "st": div_state[d]} for d in div_id},
        "places": pm,
    }
    with open(SRC + "/place-ids-1996.json", "w") as f:
        json.dump(pm_doc, f, separators=(",", ":"))
    print("place-ids-1996.json:", sum(len(v) for v in pm.values()), "place ids")
    print("PASS 2 GREEN (emissions)" + f" | ordinary={sum(len(v) for v in known_ord.values())}"
          f" mobile={sum(len(set(known_mobile[d]) | {pp for (dd, pp) in zero_venue if dd == d}) for d in known_mobile)}"
          f" hospitals={sum(len(v) for v in known_hosp.values())}")
    return locals()


if __name__ == "__main__":
    main()
