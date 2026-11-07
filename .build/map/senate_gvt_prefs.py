#!/usr/bin/env python3
"""The Election map's Senate preferences lens for the group-ticket era (2004, 2007, 2010, 2013).

Ballot-level Senate files exist only from 2016 (.build/analysis/seat-model/extract-senate-rankings.py);
before that the AEC's machine record of preferences is the parties' lodged group voting tickets — an
above-the-line "1" was counted as that ticket's full order. This builds the same
maps/data/senate-prefs-<year>.json the post-2016 builder (.build/map/senate_prefs.mjs) writes, marked
gvt: true so the lens presents the era as party tickets, never as ballot tallies. Below-the-line
voters (a few per cent per group — UseOfGvt reports the split) are invisible to the record; the
lens copy says so.

Inputs (all committed caches):
  .build/aec-flow-src/senate-gvt/gvt-<event>.csv.gz     SenateGroupVotingTicketsDownload: every lodged
                                                        ticket per (state, owner group), full candidate order
  .build/aec-flow-src/senate-gvt/usegvt-<event>.csv.gz  SenateUseOfGvtByGroupDownload: ticket v non-ticket vote split
  .build/aec-flow-src/senate-fpv/div-<year>.csv.gz   per-division "X Ticket Votes" rows (BallotPosition 0)
  .build/aec-flow-src/senate-fpv/pp-<year>-<ST>.csv.gz  the same rows per polling place (ordinary votes; none for 2004)
  maps/data/senate-vote-<year>.json                   the Senate lens's booth-id space, intersected into

Guards: every lodged ticket numbers every candidate in its state (the GVT completeness invariant);
every owner letter seen with votes maps to a lodged ticket; the division files' ticket-vote totals per
(state, group) equal UseOfGvt's TicketVotes; every emitted booth id is a Senate-lens booth; every
candidate party maps to a lens family (the era map mirrors senate_vote.py's bucket(), independents不一定要
pooled into "oth" as the ballot-era files pool them). Prints a per-state party-count summary and the
national ticket-era shares beside it.

  python3 .build/map/senate_gvt_prefs.py
"""
import collections, csv, gzip, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GVT = os.path.join(ROOT, ".build/aec-flow-src/senate-gvt")
FPV = os.path.join(ROOT, ".build/aec-flow-src/senate-fpv")
EVENT = {2004: 12246, 2007: 13745, 2010: 15508, 2013: 17496}
STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
PAIRS = ["AC", "AO", "CO"]
DONORS = {"AC": ["grn", "onp", "oth"], "AO": ["lnp", "grn", "oth"], "CO": ["alp", "grn", "oth"]}
LETTER = {"alp": "A", "lnp": "C", "grn": "G", "onp": "O"}

# era party-code map — mirrors senate_vote.py's bucket(), with independents pooled into "oth"
COAL = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LPNP"}


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP":
        return "alp"
    if ab in COAL:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "HAN"):
        return "onp"
    return "oth"


def rows(path):
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8-sig", newline="") as f:
        f.readline()  # every AEC export carries a one-line banner above its header
        return list(csv.DictReader(f))


def emit_num(x):
    return int(x) if float(x) == int(x) else round(float(x), 2)


for year, ev in EVENT.items():
    # -- every lodged ticket as a family-order pattern (order each family first appears)
    gvt = rows(os.path.join(GVT, f"gvt-{ev}.csv.gz"))
    cand = {}                       # CandidateID -> (state, fam)
    for r in gvt:
        cand[r["CandidateID"]] = (r["State"], bucket(r["PartyAb"]))
    order = collections.defaultdict(list)   # (state, letter, ticketNo) -> [(pref, CandidateID)]
    for r in gvt:
        order[(r["State"], r["OwnerTicket"], r["TicketNo"])].append((int(r["PreferenceNo"]), r["CandidateID"]))
    patterns, by_state = {}, collections.defaultdict(set)
    for (st, letter, tno), seq in order.items():
        seq.sort()
        # the pattern alphabet is the big four as the ballot-era files carry it (A/C/G/O): "oth" candidates
        # sit between them but change no pairwise order, so they're dropped from the pattern string
        patterns[(st, letter, tno)] = "".join(dict.fromkeys(LETTER[cand[c][1]] for _, c in seq if cand[c][1] != "oth"))
    for cid, (st, _) in cand.items():
        by_state[st].add(cid)
    for (st, letter, tno), seq in order.items():
        have = {c for _, c in seq}
        if have != by_state[st]:
            sys.exit(f"{year} {st} {letter} ticket {tno}: numbers {len(have)} of the state's {len(by_state[st])} candidates")
    n_tickets = collections.Counter((st, l) for (st, l, _) in order)
    if max(n_tickets.values()) > 3:
        sys.exit(f"{year}: a group lodged more than 3 tickets")
    tnos_of = {k: [tno for (_st, _l, tno) in order if _st == k[0] and _l == k[1]] for k in n_tickets}

    # -- per-division ticket-vote counts by ballot letter (all vote types), and each letter's family
    div = rows(os.path.join(FPV, f"div-{year}.csv.gz"))
    group_fam, group_name = {}, {}
    atl_div, div_state = collections.defaultdict(collections.Counter), {}
    for r in div:
        if r["BallotPosition"] != "0":
            continue
        key = (r["StateAb"], r["Ticket"])
        fam = bucket(r["PartyAb"])
        if key in group_fam and group_fam[key] != fam:
            sys.exit(f"{year} {key}: a group sits in two families")
        group_fam[key] = fam
        group_name[key] = (r.get("PartyName") or "").strip()
        atl_div[r["DivisionNm"]][r["Ticket"]] += int(r["TotalVotes"])
        div_state[r["DivisionNm"]] = r["StateAb"]
    # a withdrawn group leaves a zero-vote letter on the division print (NSW 'U', 2004) — no ballots, no row
    voted_letters = {st: set() for st in STATES}
    for dn, votes in atl_div.items():
        for letter, n in votes.items():
            if n:
                voted_letters[div_state[dn]].add(letter)
    letters_lodged = {st: {l for (s, l) in n_tickets if s == st} for st in STATES}
    for st in STATES:
        if voted_letters[st] != letters_lodged[st]:
            sys.exit(f"{year} {st}: voted letters {sorted(voted_letters[st])} != lodged tickets {sorted(letters_lodged[st])}")

    # -- cross-check against the published ticket/non-ticket split
    want, have = collections.Counter(), collections.Counter()
    for r in rows(os.path.join(GVT, f"usegvt-{ev}.csv.gz")):
        want[(r["StateAb"], r["Ticket"])] += int(r["TicketVotes"])
    for dn, votes in atl_div.items():
        for letter, n in votes.items():
            have[(div_state[dn], letter)] += n
    bad = {k: (want[k], have[k]) for k in want if want[k] != have[k]}
    if bad:
        sys.exit(f"{year}: ticket-vote totals differ from UseOfGvt: {dict(list(bad.items())[:5])}")

    # -- 27-count cells, same layout as senate_prefs.mjs (pair-major, donor-minor: [x, y, nei])
    def cells_for(state, votes):
        tally = collections.defaultdict(float)
        for letter, n in votes.items():
            if not n or (state, letter) not in tnos_of:
                continue
            fam = group_fam[(state, letter)]
            for pair in PAIRS:
                if fam not in DONORS[pair]:
                    continue
                for tno in tnos_of[(state, letter)]:
                    pat = patterns[(state, letter, tno)]
                    ix, iy = pat.find(pair[0]), pat.find(pair[1])
                    slot = 2 if (ix < 0 and iy < 0) else (0 if (iy < 0 or 0 <= ix < iy) else 1)
                    tally[(pair, fam, slot)] += n / n_tickets[(state, letter)]
        out = []
        for pair in PAIRS:
            for fam in DONORS[pair]:
                out += [emit_num(tally[(pair, fam, i)]) for i in range(3)]
        return out

    # families absent from a state's ballot (the lens shows no figure rather than 100% for a rival)
    fam_by_state = {st: {bucket(r["PartyAb"]) for r in gvt if r["State"] == st} for st in STATES}
    absent = {st: [f for f in ("alp", "lnp", "grn", "onp") if f not in fam_by_state[st]] for st in STATES}
    absent = {st: miss for st, miss in absent.items() if miss}

    divs = {dn: cells_for(div_state[dn], votes) for dn, votes in atl_div.items()}

    booths = {}
    if year != 2004:
        lens_booths = set(json.load(open(os.path.join(ROOT, f"maps/data/senate-vote-{year}.json")))["booths"])
        atl_pp, pp_state = collections.defaultdict(collections.Counter), {}
        for st in STATES:
            for r in rows(os.path.join(FPV, f"pp-{year}-{st}.csv.gz")):
                if r["BallotPosition"] == "0":
                    atl_pp[r["PollingPlaceID"]][r["Ticket"]] += int(r["OrdinaryVotes"])
                    pp_state[r["PollingPlaceID"]] = st
        atl_pp = {pid: v for pid, v in atl_pp.items() if sum(v.values()) > 0}  # empty prison teams carry zero rows
        missing = set(atl_pp) - lens_booths
        if missing:
            sys.exit(f"{year}: {len(missing)} ticket-vote polling places are not Senate-lens booths: {sorted(missing)[:5]}")
        booths = {pid: cells_for(pp_state[pid], votes) for pid, votes in atl_pp.items()}

    total = sum(n for v in atl_div.values() for n in v.values())
    out = {"year": year, "pairs": PAIRS, "donors": DONORS, "absent": absent, "gvt": True,
           "source": f"The parties' lodged group voting tickets, {year} (AEC SenateGroupVotingTicketsDownload, SenateFirstPrefsByDivision/PollingPlaceByVoteType); every above-the-line ballot was counted as its party's ticket — below-the-line voters are outside this record",
           "divs": divs, "booths": booths}
    p = os.path.join(ROOT, f"maps/data/senate-prefs-{year}.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"))
        f.write("\n")
    per_state = collections.Counter(g for (st, g) in group_name)
    print(f"senate-prefs-{year}.json: absent {absent}, {len(divs)} divisions, {len(booths)} polling places, "
          f"{os.path.getsize(p)} bytes, {total:,} ticket votes over {sum(per_state.values())} groups {dict(per_state)}")
    nat = {}
    for pair in PAIRS:
        for fam in DONORS[pair]:
            x = y = 0
            for dn, cells in divs.items():
                i = (PAIRS.index(pair) * 3 + DONORS[pair].index(fam)) * 3
                x += cells[i]
                y += cells[i + 1]
            if x + y:
                nat[(pair, fam)] = 100 * x / (x + y)
    for pair in PAIRS:
        print(f"  {pair}: " + "  ".join(f"{fam} {nat[(pair, fam)]:.1f}" for fam in DONORS[pair] if (pair, fam) in nat))
