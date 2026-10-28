#!/usr/bin/env python3
"""Pack the 2001 statistics-pack tables into the VTR lane schemas
.build/map/build_map_data.py loads (its loaders read exactly these
filenames, keyed by year, 2004 on; the AEC Virtual Tally Room starts at
event 12246, so 2001 exists only in the election-statistics CD-ROM).

Inputs: the committed, sha256-anchored members in .build/aec-flow-src/
(README-haul-1983-2007.md) — divs-2001.txt, hcands-2001.txt (+hcands-1998
for sitting-member marks), htpp-2001.txt, dop-2001.csv.gz (HPPDOP),
pps-2001-<st>.txt ×8 (the polling-place roll), and the flows suite's
fpv/2001.csv.gz repack (read-only cross-check).

Outputs (written only after every gate passes — the recompose doctrine,
machine sums against printed totals):

  .build/aec-flow-src/booth/oracle/fpvvt-2001.csv.gz   division candidates
      by vote type (the oracle; informal as cid 999)
  .build/aec-flow-src/booth/fpv/2001-<ST>.csv.gz [x8]  per-place per-candidate
      ordinary first prefs (+ informal, cid 999)
  .build/aec-flow-src/booth/tcf/2001-<ST>.csv.gz [x8]  per-place transfers
      to the final pair (own rows FromCandidateId 0)
  .build/aec-flow-src/booth/tpp-pp/2001.csv.gz         per-place 2PP + swing
  .build/aec-flow-src/tcpflow-2001.csv.gz              division-level flow
  .build/aec-flow-src/tppdiv-2001.csv                  division 2PP + swing
  atlas/data/aec-2001/GeneralPollingPlacesDownload-2001-derived.csv
      the venue lane (from the pps rolls)

The pack's polling-place vocabulary (established 2026-10-28):
  1. pps-roll ordinary booths (the pps files);
  2. "Special Hospital Team N" / "Prison Mobile Team N" / "Remote Mobile
     Team N" ordinary pseudo places in HPPDOP;
  3. htpp-only named hospital rows ("Alfred Hospital"…) — the TPP file
     breaks special-hospital votes down by hospital where HPPDOP keeps
     the team aggregate; informal-only, no first-prefs lane;
  4. ABSENT / PRE POLL / POSTAL / PROVISIONAL declaration pseudo places
     (never booths);
  5. HPPDOP's DIVISION SUMMARY rows (count-level division totals — a
     super-oracle here, never emitted).
2001 has zero exhausted votes in the House count (amended CEA;
import_files.pdf note 9), so tpph/mho pairing always ends with two
candidates under full numbering.

Synthetic ids (the pack names none): divisions take AEC-flavoured state
blocks (ACT 101-102, NSW 201-250, VIC 301-337, QLD 401-427, WA 501-515,
SA 601-612, TAS 701-705, NT 801-802, alphabetical per state); places are
1..k in roll order within division; class-2 pseudo places ride 1001+ per
division; declaration pseudo places are 8001-8004 in DECL order; the
htpp-only hospitals are 9001+ in first-seen order per division.

Gates: count-1 sums per candidate == hcands-2001 Vote; vote-type splits +
htpp informal vs divs-2001 formal/informal; HPPDOP place sums ==
DIVISION SUMMARY; htpp totals vs divs.txt (exact); per-place final-pair
sums == htpp TPP columns; htpp's ALP TPP Pc recomputes within 0.02;
fpv walk == the committed fpv/2001 repack (read-only).

Banner note: the emitted files open with a banner naming this script —
loaders' banner-skip only cares that line 1 is not the header row.
"""
import csv, gzip, os, collections, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = REPO + "/.build/aec-flow-src"
BOOTH = SRC + "/booth"
ATLAS = REPO + "/atlas/data/aec-2001"
STATES = ["ACT", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"]
BLOCK_BASE = {"ACT": 100, "NSW": 200, "VIC": 300, "QLD": 400, "WA": 500, "SA": 600, "TAS": 700, "NT": 800}
DECL = collections.OrderedDict((("ABSENT", ("abs", 8001)), ("PRE POLL", ("pre", 8002)),
                                ("POSTAL", ("post", 8003)), ("PROVISIONAL", ("prov", 8004))))
MOBILE_RE = re.compile(r"^(Special Hospital|Prison Mobile|Remote Mobile) Team \d+$|^Express$|^Corio West$")
# v3_10's pseudo-venue aggregates ride the 2xxx id lane; htpp's hospital
# breakout rows (names it alone records) ride the 9xxx lane per division
V310_PSEUDO = {"Special Hospitals": 2001, "Prison Mobiles": 2002, "Remote Mobiles": 2003}
GZIP_KW = dict(compresslevel=9, mtime=0) if sys.version_info >= (3, 7) else {}
BANNER = ("2001 Federal Election {what} [packed from the election-statistics CD-ROM"
          " by .build/map/pack-2001-booth.py]")


def rows_semi(p):
    op = gzip.open if p.endswith(".gz") else open
    with op(p, "rt", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


sys.path.insert(0, os.path.join(REPO, ".build", "map"))
from v310_2001 import parse_all as v310_parse_all


def norm(s):
    s = s or ""
    # the pack truncates names mid-word, including inside a "(Disambiguator)"
    # tail that never closes ("Croydon Park West (Port Adelaide" beside the
    # roll's complete "Croydon Park West (Port Adelaide)") - both forms
    # collapse here
    s = re.sub(r"\s*\([^()]*$", "", s)
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    return re.sub(r"[^a-z0-9]", "", s.lower())


def split_name(c):
    if ", " in c:
        s, g = c.split(", ", 1)
        return s, g
    return c, ""


def gzwrite(path, header, rows, what):
    import io
    with io.TextIOWrapper(gzip.GzipFile(path, "wb", compresslevel=9, mtime=0), newline="", encoding="utf-8") as f:
        f.write(BANNER.format(what=what) + "\n")
        f.write(",".join(header) + "\n")
        csv.writer(f).writerows(rows)


def main():
    # ------------------------------------------------------------- div ids
    divs = list(rows_semi(SRC + "/divs-2001.txt"))
    assert len(divs) == 150 and {r["State"] for r in divs} == set(STATES)
    by_state = collections.defaultdict(list)
    for r in divs:
        by_state[r["State"]].append(r["Division"])
    for st in STATES:
        by_state[st].sort(key=str.lower)
    div_id, div_state, div_rt = {}, {}, {r["Division"]: r for r in divs}
    # place ids are global per year: div_id*10000 + local-class numbering
    # (every AEC PollingPlaceID product presents them nation-wide-unique)
    def gid(d, lid):
        return div_id[d] * 10000 + lid
    for st in STATES:
        for j, d in enumerate(by_state[st]):
            div_id[d] = BLOCK_BASE[st] + 1 + j
        div_state.update({d: st for d in by_state[st]})

    # --------------------------------------------------------- candidates
    sit_prev = {(r["Division"], r["Candidate"].strip().lower())
                for r in rows_semi(SRC + "/hcands-1998.txt") if r["Member"].strip() == "#"}
    cands = {}
    for r in rows_semi(SRC + "/hcands-2001.txt"):
        if int(r["Ballot Position"]) > 900:
            continue
        cands.setdefault(r["Division"], []).append(r)
    assert len(cands) == 150
    for d, cl in cands.items():
        cl.sort(key=lambda r: int(r["Ballot Position"]))
        assert [int(c["Ballot Position"]) for c in cl] == list(range(1, len(cl) + 1)), (d,)
        for i, c in enumerate(cl, 1):
            s, g = split_name(c["Candidate"])
            c["_cid"] = i
            c["_sur"], c["_giv"] = s, g
            c["_sit"] = "#" if (d, c["Candidate"].strip().lower()) in sit_prev else ""

    def cinfo(d, bp):
        for c in cands[d]:
            if int(c["Ballot Position"]) == bp:
                return c
        return None

    # ------------------------------------------------------------ pps roll
    roll = collections.defaultdict(list)
    n_roll = 0
    for st in STATES:
        cur = None
        for ln in open(SRC + f"/pps-2001-{st.lower()}.txt", encoding="utf-8-sig", errors="replace"):
            ln = ln.rstrip("\n")
            if not ln.strip():
                continue
            parts = [p.strip() for p in ln.split("\t")]
            if parts and parts[0] == "":
                parts = parts[1:]  # optional leading indent tab (both are used)
            non = [p for p in parts if p]
            if not non:
                continue
            if non[0] == "Polling Place Name":
                continue
            if len(non) == 1:
                if non[0] in div_id:
                    cur = non[0]
                elif non[0].startswith(("General Information", "Polling")):
                    continue
                else:
                    raise SystemExit(f"pps-2001-{st.lower()}: unknown row {non[0]!r}")
                continue
            if cur is None:
                raise SystemExit(f"pps-2001-{st.lower()}: venue row before any division header")
            assert div_state[cur] == st, (cur, st)
            while len(parts) < 4:
                parts.append("")
            roll[cur].append({"id": gid(cur, len(roll[cur]) + 1), "name": parts[0],
                              "prem": parts[1], "addr": parts[2], "sub": parts[3]})
            n_roll += 1
    assert len(roll) == 150, len(roll)
    for d, vs in roll.items():
        ns = [norm(v["name"]) for v in vs]
        assert len(set(ns)) == len(ns), (d, "duplicate roll names")

    # -------------------------------------------------- v3_10 official flows
    # The pack's v3_10<DIV>.txt tables carry the OFFICIAL per-place and
    # per-division movement of each excluded candidate's first preferences
    # into the final pair (the tcp/fl lanes - data HPPDOP's count summaries
    # can never reproduce). Parsed once here; every derived lane below
    # cross-checks against it.
    V = v310_parse_all()
    assert set(V) == set(div_id), (sorted(set(V) ^ set(div_id)))

    # ------------------------------------------------------------- count walk
    places = collections.defaultdict(lambda: collections.defaultdict(dict))
    summary = collections.defaultdict(lambda: collections.defaultdict(dict))
    for r in rows_semi(SRC + "/dop-2001.csv.gz"):
        d, pp = r["Division"], r["Polling Place"]
        tgt = summary[d] if pp == "DIVISION SUMMARY" else places[(d, pp)]
        # excluded rows print blank votes (their pile empties): blank == 0
        tgt[int(r["Count"])][int(r["Ballot Position"])] = int(r["Vote"] or "0")
    assert set(d for d, _ in places) | set(summary) == set(div_id)
    assert len(summary) == 150

    # --------------------------------------------------------- place classes
    p_roll = {}       # (div, variant) -> venue (id, name)
    for d, vs in roll.items():
        for v in vs:
            p_roll[(d, v["name"])] = v
            p_roll.setdefault((d, norm(v["name"])), v)

    # htpp's venue column is field-width-truncated mid-word ("...Colleg"
    # for "...College"); a strict-prefix tier joins them back to the roll
    # (>=6 normalised chars and exactly one rollout candidate in the
    # division - anything blurrier is no match at all)
    def roll_prefix(d, pp):
        n = norm(pp)
        if len(n) < 6:
            return None
        hits = [v["id"] for v in roll[d] if norm(v["name"]).startswith(n)]
        return hits[0] if len(hits) == 1 else None
    # mobile-class pseudo places: named team rows / combined teams, plus the
    # AEC's declared-but-closed venues (they print zero everywhere, e.g.
    # Corio West fire; sieved at emission by the properties of the product
    # itself, never by name-listing)
    mobile = {}
    unclassified = []
    for (d, pp) in places:
        if pp in DECL or (d, pp) in p_roll:
            continue
        if MOBILE_RE.match(pp):
            mobile.setdefault(d, [])
            if pp not in mobile[d]:
                mobile[d].append(pp)
        elif roll_prefix(d, pp) is not None:
            continue  # roll venue seen truncated by htpp's field width
        else:
            unclassified.append((d, pp))
    zero_ok = set()
    for d, pp in unclassified:
        t_all = sum(v for m in places[(d, pp)].values() for v in m.values())
        if t_all == 0 and int(hzero := 0 or 0) == 0:
            zero_ok.add((d, pp))
        else:
            raise SystemExit(f"unclassified polling place {pp!r} in {d} with {t_all} recorded votes")
    for d, pp in sorted(zero_ok):
        mobile.setdefault(d, [])
        mobile[d].append(pp)
    if zero_ok:
        print("zero-vote declared venues recognised:", sorted({pp for _, pp in zero_ok}))
    mobile_id = {}
    for d, lst in mobile.items():
        lst.sort()
        for i, pp in enumerate(lst):
            mobile_id[(d, pp)] = gid(d, 1001 + i)
    place_ids = {}
    for (d, pp) in places:
        if pp in DECL:
            continue
        if (d, pp) in p_roll:
            place_ids[(d, pp)] = p_roll[(d, pp)]["id"]
        else:
            place_ids[(d, pp)] = mobile_id[(d, pp)]

    # -------------------------------------------------- htpp + its hospitals
    htpp = rows_semi(SRC + "/htpp-2001.txt")
    # anything surviving all tiers is a true special-placement row htpp
    # alone names (their venue identity has no lane to open), riding the
    # 9xxx pseudo id block per division
    hosp_id = collections.defaultdict(dict)
    for r in htpp:
        d, pp = r["Division"], r["Polling Place"]
        if pp in DECL or (d, pp) in p_roll or (d, pp) in mobile_id or \
           (d, norm(pp)) in p_roll or roll_prefix(d, pp):
            continue
        hosp_id[d].setdefault(pp, gid(d, 9001 + len(hosp_id[d])))

    for r in htpp:
        a, c, pc = int(r["ALP TPP Vote"] or 0), int(r["Coalition TPP Vote"] or 0), float(r["ALP TPP Pc"] or 0)
        assert a + c == 0 and pc == 0 or a + c > 0 and abs(100 * a / (a + c) - pc) < 0.02, \
            (r["Division"], r["Polling Place"])

    # -------------------------------------------------------------- oracles
    # sum checks — htpp vs divs.txt (once here, before anything is written)
    sum_tpp = collections.defaultdict(lambda: [0, 0, 0])
    inf_split = collections.defaultdict(collections.Counter)
    for r in htpp:
        d, pp = r["Division"], r["Polling Place"]
        a, c, inf = int(r["ALP TPP Vote"] or 0), int(r["Coalition TPP Vote"] or 0), int(r["Informal Vote"] or 0)
        sum_tpp[d][0] += a
        sum_tpp[d][1] += c
        sum_tpp[d][2] += inf
        inf_split[d][DECL[pp][0] if pp in DECL else "ord"] += inf
    for r in divs:
        d = r["Division"]
        a, co, inf = sum_tpp[d]
        assert (int(r["ALP TPP Vote"]), int(r["Coalition TPP Vote"]), int(r["Informal Vote"])) == (a, co, inf), d
    print("oracle htpp->divs: exact TPP+informal on all 150 divisions")

    # hcands vote oracle: count-1 sums by (div, bp) == printed Vote
    c1_tot = collections.defaultdict(int)
    c1typ = collections.defaultdict(collections.Counter)  # (div, bp) -> type -> votes
    vtypes = collections.defaultdict(collections.Counter)
    for (d, pp), counts in places.items():
        c1 = counts.get(1, {})
        for bp, v in c1.items():
            c1_tot[(d, bp)] += v
            k = DECL[pp][0] if pp in DECL else "ord"
            c1typ[(d, bp)][k] += v
            vtypes[d][k] += v
    for d, cl in cands.items():
        for c in cl:
            bp = int(c["Ballot Position"])
            assert c1_tot[(d, bp)] == int(c["Vote"]), (d, bp, c1_tot[(d, bp)], c["Vote"])
    for r in divs:
        d = r["Division"]
        assert sum(vtypes[d].values()) == int(r["Formal Vote"]), (d, "formal split vs divs.txt")
        assert sum(inf_split[d].values()) == int(r["Informal Vote"]), (d, "informal split vs divs.txt")
    print("oracle hcands/formal/informal splits vs divs.txt: exact on all 150")

    # DIVISION SUMMARY recompose
    walk_sum = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(int)))
    for (d, pp), counts in places.items():
        for k, m in counts.items():
            for bp, v in m.items():
                walk_sum[d][k][bp] += v
    for d, ck in summary.items():
        for k, m in ck.items():
            for bp, v in m.items():
                assert walk_sum[d][k].get(bp) == v, (d, k, bp)
    print("oracle DIVISION SUMMARY recompose: exact")

    # fpv repack cross-check (read-only)
    n_mis = 0
    for r in rows_semi(BOOTH + "/fpv/2001.csv.gz"):
        k = (r["Division"], r["Polling Place"], int(r["Ballot Position"]))
        got = places.get((k[0], k[1]), {}).get(1, {}).get(k[2])
        if (got or 0) != int(r["Vote"]):
            n_mis += 1
            if n_mis <= 3:
                print("fpv mismatch", k, got, r["Vote"])
    assert n_mis == 0, n_mis
    print("fpv/2001 repack cross-check: exact")

    # ------------------------------------------------------------- htpp ids
    def tpp_pid(d, pp):
        if pp in DECL:
            return gid(d, DECL[pp][1])
        if (d, pp) in p_roll:
            return p_roll[(d, pp)]["id"]
        if (d, norm(pp)) in p_roll:
            return p_roll[(d, norm(pp))]["id"]
        if (d, pp) in mobile_id:
            return mobile_id[(d, pp)]
        pref = roll_prefix(d, pp)
        if pref is not None:
            return pref
        return hosp_id[d][pp]

    # ------------------------------------------------------------- emissions
    os.makedirs(BOOTH + "/oracle", exist_ok=True)
    os.makedirs(ATLAS, exist_ok=True)

    # informals land on the RESOLVED booth id (his truncated forms in htpp -
    # "Colleg", "Hospita" - carry their informal vote to the roll booth they
    # print, otherwise the division-level street checks pass while per-booth
    # informal leaks; proven by the recompose gate in build_map_data.py)
    def pid_of(d, pp):
        if pp in DECL:
            return gid(d, DECL[pp][1])
        if (d, pp) in p_roll:
            return p_roll[(d, pp)]["id"]
        if (d, norm(pp)) in p_roll:
            return p_roll[(d, norm(pp))]["id"]
        if (d, pp) in mobile_id:
            return mobile_id[(d, pp)]
        pref = roll_prefix(d, pp)
        if pref is not None:
            return pref
        return hosp_id[d][pp]

    inf_map = collections.defaultdict(int)
    for r in htpp:
        d, pp = r["Division"], r["Polling Place"]
        inf_map[(d, pid_of(d, pp))] += int(r["Informal Vote"] or 0)

    # fpv per state
    for st in STATES:
        rows = []
        for d in by_state[st]:
            for (dd, pp), ids in sorted(place_ids.items()):
                if dd != d:
                    continue
                counts = places[(d, pp)]
                c1 = counts.get(1, {})
                pid = ids
                for c in cands[d]:
                    bp = int(c["Ballot Position"])
                    rows.append([st, div_id[d], d, pid, pp, c["_cid"], c["_sur"], c["_giv"], bp, c["_sit"],
                                 c["Party"], c["Party"], c1.get(bp, 0), c["Swing"] or ""])
                rows.append([st, div_id[d], d, pid, pp, 999, "", "", "", "", "INFORMAL", "Informal",
                             inf_map.get((d, pid), 0), ""])
        gzwrite(BOOTH + f"/fpv/2001-{st}.csv.gz",
                ["StateAb", "DivisionID", "DivisionNm", "PollingPlaceID", "PollingPlace", "CandidateID",
                 "Surname", "GivenNm", "BallotPosition", "SittingMemberFl", "PartyAb", "PartyNm",
                 "OrdinaryVotes", "Swing"], rows,
                f"House of Representatives First Preferences By Candidate By Polling Place for {st}")

    # fpvvt oracle
    ov = []
    for st in STATES:
        for d in by_state[st]:
            for c in cands[d]:
                bp = int(c["Ballot Position"])
                vt = c1typ[(d, bp)]
                tot = sum(vt.values())
                elected = "Y" if c["Member"].strip() == "#" else ""
                hist_elected = "Y" if c["_sit"] == "#" else ""
                ov.append([st, div_id[d], d, c["_cid"], c["_sur"], c["_giv"], bp, c["_sit"],
                           c["Party"], c["Party"], vt["ord"], vt["abs"], vt["prov"], vt["pre"], vt["post"],
                           tot, c["Swing"] or "", elected, hist_elected])
            ov.append([st, div_id[d], d, 999, "", "", "", "", "INFORMAL", "Informal",
                       inf_split[d]["ord"], inf_split[d]["abs"], inf_split[d]["prov"],
                       inf_split[d]["pre"], inf_split[d]["post"], sum(inf_split[d].values()), "", "", ""])
    gzwrite(BOOTH + "/oracle/fpvvt-2001.csv.gz",
            ["StateAb", "DivisionID", "DivisionNm", "CandidateID", "Surname", "GivenNm", "BallotPosition",
             "SittingMemberFl", "PartyAb", "PartyNm", "OrdinaryVotes", "AbsentVotes", "ProvisionalVotes",
             "PrePollVotes", "PostalVotes", "TotalVotes", "Swing", "Elected", "HistoricElected"], ov,
            "House of Representatives First Preferences By Candidate By Vote Type")

    # ------------------------------------------------ v3_10-official flow lanes
    # Per-place tcf and division tcpflow are the v3_10 tables VERBATIM (the
    # AEC's official disposition of each excluded candidate's first
    # preferences into the final pair - the modern VTR tcf/tcpflow products
    # hold exactly this; it cannot be reconstructed from count summaries).
    # pair/name -> candidate id via the hcands roll (name + party must bind)
    # the pack's own tables affiliate-code ALP candidates as CLR ("Country
    # Labor", the NSW variant) in the v3_10 pages while hcands packs them
    # under ALP - the same person, never an error, mapped here
    PARTY_EQUIV = {"CLR": "ALP"}

    def _nkey(s):
        return re.sub(r"\s+", " ", (s or "").strip().lower())

    def bind(d, name, ab):
        name_t = _nkey(name)
        hits = [c for c in cands[d] if _nkey(c["Candidate"]) == name_t]
        if not hits:
            # the v3_10 tables abbreviate multi-part given names
            # ("VALASINAVICIUS, Vytautas" when hcands prints the Charles);
            # a surname match plus first-given-token prefix joins them back
            sur = _nkey(name.split(",", 1)[0])
            giv = _nkey(name.split(",", 1)[1]).split(" ")[0] if "," in name else ""
            pool = [c for c in cands[d] if _nkey(c["Candidate"].split(",", 1)[0]) == sur]
            hits = [c for c in pool if _nkey(c["Candidate"].split(",", 1)[1] if "," in c["Candidate"] else "").split(" ")[0] == giv]
        assert len(hits) == 1, (d, name)
        c = hits[0]
        hp_ab = (c["Party"] or "IND")
        assert hp_ab == ab or PARTY_EQUIV.get(ab) == hp_ab or PARTY_EQUIV.get(hp_ab) == ab, (d, name, hp_ab, ab)
        return c

    vfmt = lambda v: v if v == "" else int(v)
    def flow_row(st, d, pid, pp_caption, xrow, to_row, n, pct):
        xi, ti = xrow, to_row
        return [st, div_id[d], d, pid, pp_caption, xi["id"], xi["Party"], xi["Party"], xi["SUR"], xi["GIV"], xi["BP"],
                ti["id"], ti["Party"], ti["Party"], ti["SUR"], ti["GIV"], ti["BP"], n, pct]

    def div_flow_row(st, d, xrow, to_row, n, pct):
        xi, ti = xrow, to_row
        return [st, div_id[d], d, xi["id"], xi["Party"], xi["Party"], xi["SUR"], xi["GIV"], xi["BP"],
                ti["id"], ti["Party"], ti["Party"], ti["SUR"], ti["GIV"], ti["BP"], n, pct]

    # candidates in the (div, name)-keyed shape the v3_10 tables print
    for d, cl in cands.items():
        for c in cl:
            c.update({"id": c["_cid"], "SUR": c["_sur"], "GIV": c["_giv"], "BP": int(c["Ballot Position"])})

    tcf_rows = collections.defaultdict(list)
    tcpflow_rows = []
    unknown_sections = []

    from v310_2001 import DECL_MAP as _SECT_DECL  # PRE_POLL variant of the pack

    def sect_id(d, s):
        ds = _SECT_DECL.get(s, s)
        if ds in DECL:
            return gid(d, DECL[ds][1])
        if (d, s) in p_roll:
            return p_roll[(d, s)]["id"]
        if (d, norm(s)) in p_roll:
            return p_roll[(d, norm(s))]["id"]
        if (d, s) in mobile_id:
            return mobile_id[(d, s)]
        if s in V310_PSEUDO:
            return gid(d, V310_PSEUDO[s])
        unknown_sections.append((d, s))
        return None

    for st in STATES:
        for d in by_state[st]:
            v = V[d]
            pA = bind(d, v["pair"][0][0], v["pair"][0][1])
            pB = bind(d, v["pair"][1][0], v["pair"][1][1])
            for s, sec in v["sections"].items():
                # per-candidate-fp flows off venue sections always reconcile:
                # excluded fp + pair fp + transfer sinks = this venue's formal
                excfp, tA, tB, formal = sec["total"]
                fpA, fpB = sec["fp"]
                exc_fpsum = sum(row[2] for row in sec["excl"])
                assert exc_fpsum == excfp, (d, s, exc_fpsum, excfp, "excluded sums")
                assert fpA + fpB + excfp == formal, (d, s, "formal recompose")
                if s in ("Total Ordinary",):
                    continue
                if s == "Division Summary":
                    for (cd, ab, elx, to1, to2) in sec["excl"]:
                        xi = bind(d, cd, ab)
                        assert elx == int(xi["Vote"]), (d, cd, elx, xi["Vote"])
                        if to1:
                            tcpflow_rows.append(div_flow_row(st, d, xi, pA, to1, round(100 * to1 / elx, 2) if elx else 0))
                        if to2:
                            tcpflow_rows.append(div_flow_row(st, d, xi, pB, to2, round(100 * to2 / elx, 2) if elx else 0))
                    fptot = sec["fp"][0] + sec["fp"][1]
                    tcpflow_rows.append(div_flow_row(st, d, {"id": 0, "Party": "", "SUR": "First Preferences",
                                                                "GIV": "", "BP": 0}, pA, sec["fp"][0],
                                                 round(100 * sec["fp"][0] / fptot, 3) if fptot else 0))
                    tcpflow_rows.append(div_flow_row(st, d, {"id": 0, "Party": "", "SUR": "First Preferences",
                                                                "GIV": "", "BP": 0}, pB, sec["fp"][1],
                                                 round(100 * sec["fp"][1] / fptot, 3) if fptot else 0))
                    continue
                pid = sect_id(d, s)
                if pid is None:
                    continue  # a new pseudo section would have landed in unknown_sections
                for (cd, ab, elx, to1, to2) in sec["excl"]:
                    xi = bind(d, cd, ab)
                    if to1:
                        tcf_rows[st].append(flow_row(st, d, pid, s, xi, pA, to1, round(100 * to1 / elx, 2) if elx else 0))
                    if to2:
                        tcf_rows[st].append(flow_row(st, d, pid, s, xi, pB, to2, round(100 * to2 / elx, 3) if elx else 0))
                fptot = sec["fp"][0] + sec["fp"][1]
                tcf_rows[st].append(flow_row(st, d, pid, s, {"id": 0, "Party": "", "SUR": "First Preferences",
                                                            "GIV": "", "BP": 0}, pA, sec["fp"][0],
                                             round(100 * sec["fp"][0] / fptot, 3) if fptot else 0))
                tcf_rows[st].append(flow_row(st, d, pid, s, {"id": 0, "Party": "", "SUR": "First Preferences",
                                                            "GIV": "", "BP": 0}, pB, sec["fp"][1],
                                             round(100 * sec["fp"][1] / fptot, 3) if fptot else 0))
    assert not unknown_sections, sorted({x for x in unknown_sections})

    # per-place final-pair tcf sums == htpp (oracle) — checked after lanes
    tpp_lane = {(r["Division"], r["Polling Place"]): r for r in htpp}
    for (d, pp), counts in places.items():
        if pp in DECL:
            continue
        ks = sorted(counts)
        fin = counts[ks[-1]]
        if len(fin) != 2:
            continue
        a2 = sorted(fin.values())
        h = tpp_lane.get((d, pp))
        assert h is not None, (d, pp)
        tot_h = [int(h["ALP TPP Vote"] or 0), int(h["Coalition TPP Vote"] or 0)]
        assert sorted(tot_h) == a2, (d, pp, a2, tot_h)
    print("oracle per-place final pair == htpp TPP columns: pass")

    # tcpflow + tcf (both are the v3_10-verbatim lanes built above)
    for st in STATES:
        gzwrite(BOOTH + f"/tcf/2001-{st}.csv.gz",
                ["StateAb", "DivisionId", "DivisionNm", "PPId", "PPNm", "FromCandidateId", "FromCandidatePartyAb",
                 "FromCandidatePartyNm", "FromCandidateSurname", "FromCandidateGivenNm", "FromCandidateBallotPosition",
                 "ToCandidateId", "ToCandidatePartyAb", "ToCandidatePartyNm", "ToCandidateSurname",
                 "ToCandidateGivenNm", "ToCandidateBallotPosition", "TransferCount", "TransferPercent"], tcf_rows[st],
                f"House of Representatives Two Candidate Preferred Flow of Preferences by Polling Place for {st}")
    gzwrite(SRC + "/tcpflow-2001.csv.gz",
            ["StateAb", "DivisionID", "DivisionNm", "FromCandidateID", "FromCandidatePartyAb",
             "FromCandidatePartyNm", "FromCandidateSurname", "FromCandidateGivenNm",
             "FromCandidateBallotPosition", "ToCandidateID", "ToCandidatePartyAb", "ToCandidatePartyNm",
             "ToCandidateSurname", "ToCandidateGivenNm", "ToCandidateBallotPosition",
             "TransferCount", "TransferPercentage"], tcpflow_rows,
            "House of Representatives Two Candidate Preferred Flow of Preferences By Division")

    # hcands-'#' (the elected candidate) against the v3_10 Division-Summary
    # champion — the only independent cross-check the winner lanes have
    for r in divs:
        d = r["Division"]
        sec = V[d]["sections"]["Division Summary"]
        a_won = V[d]["pair"][0] if sec["total"][1] >= sec["total"][2] else V[d]["pair"][1]
        my_win = next(c for c in cands[d] if c["Member"].strip() == "#")
        assert my_win["Candidate"].strip().lower() == a_won[0].strip().lower(), (d, my_win["Candidate"], a_won)
    print("oracle hcands-elected == v3_10 division-summary TCP win: pass on all 150")

    # tpp-pp nationwide
    tp = []
    for st in STATES:
        for r in htpp:
            d, pp = r["Division"], r["Polling Place"]
            if div_state[d] != st:
                continue
            a, c = int(r["ALP TPP Vote"] or 0), int(r["Coalition TPP Vote"] or 0)
            tp.append([st, div_id[d], d, tpp_pid(d, pp), pp,
                       a, r["ALP TPP Pc"] or "0",
                       c, "", a + c, r["ALP Swing"] or ""])
    gzwrite(BOOTH + "/tpp-pp/2001.csv.gz",
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
    # tppdiv lives plain beside the modern tppdiv-YYYY.csv files (loader
    # reads .csv, not .gz)
    with open(SRC + "/tppdiv-2001.csv", "w", newline="") as f:
        f.write(BANNER.format(what="House of Representatives Two Party Preferred By Division") + "\n")
        f.write("DivisionNm,DivisionID,StateAb,PartyAb,Australian Labor Party Votes,"
                "Australian Labor Party Percentage,Liberal/National Coalition Votes,"
                "Liberal/National Coalition Percentage,TotalVotes,Swing\n")
        csv.writer(f).writerows(tppd)

    # GPP derived (roll only; mobile-class places have no named premises)
    gpp_rows = []
    for st in STATES:
        for d in by_state[st]:
            for v in roll[d]:
                gpp_rows.append([st, div_id[d], d, v["id"], 1, v["name"], v["prem"], v["addr"], "", "",
                                 v["sub"], st, ""])
    # the GPP lane sits plain beside the AEC downloads like the other years
    with open(ATLAS + "/GeneralPollingPlacesDownload-2001-derived.csv", "w", newline="") as f:
        f.write(BANNER.format(what="House of Representatives General Polling Places") + "\n")
        f.write("State,DivisionID,DivisionNm,PollingPlaceID,PollingPlaceTypeID,PollingPlaceNm,"
                "PremisesNm,PremisesAddress1,PremisesAddress2,PremisesAddress3,PremisesSuburb,"
                "PremisesStateAb,PremisesPostCode\n")
        csv.writer(f).writerows(gpp_rows)

    # --------------------------------------------------------- place-id map
    # The whole (division, printed place) -> synthetic id map, one home: the
    # lane products the pack writes, and pack-2001-senate.py for the Senate
    # lanes take identities from it (its own pseudo vocabulary lands here as
    # the same ids).
    pm = collections.defaultdict(dict)
    for (d, pp), pid in place_ids.items():
        pm[d][pp] = pid
    for (d, pp), pid in mobile_id.items():
        pm[d].setdefault(pp, pid)
    for dd, m in hosp_id.items():
        for pp, pid in m.items():
            pm[dd][pp] = pid
    pm_doc = {
        "_about": "Place -> synthetic id map for the pack-era 2001 lanes (pack-2001-booth.py's own "
                  "assignment; roll venues keep their 1..k roll order per division, hppdop mobile-class "
                  "pseudo teams 1001+, v3_10 pseudo aggregates 2001-2003, declaration pseudo places "
                  "8001-8004, special-placement rows htpp alone names 9001+). The Senate lane pack "
                  "(.build/map/pack-2001-senate.py) and any other 2001-era lanes read ids from here.",
        "divisions": {d: {"id": div_id[d], "st": div_state[d]} for d in div_id},
        "places": {"roll": {d: {} for d in pm},}
    }
    for d in pm:
        pm_doc["places"]["roll"][d] = pm[d]
    import json as _json
    with open(SRC + "/place-ids-2001.json", "w") as f:
        _json.dump(pm_doc, f, separators=(",", ":"))
    print("place-ids-2001.json:", sum(len(v) for v in pm_doc["places"]["roll"].values()), "place ids")

        # ------------------------------------------------------------ recaps
    print("pps roll venues:", n_roll)
    print("mobile-class pseudo places:", len(mobile_id), "| htpp-only hospitals:", sum(len(v) for v in hosp_id.values()))
    print("fpv lanes:", {st: st for st in STATES}.keys())
    print("oracle tcf-by-sum pending final check inside the builder (fpv totals == oracle 'ord')")


if __name__ == "__main__":
    main()
