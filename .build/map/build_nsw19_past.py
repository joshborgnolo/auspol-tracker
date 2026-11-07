"""data-nsw19.json's past election: the New South Wales state election of
28 March 2015 (93 districts, Legislative Assembly), joined INTO
maps/data/data-nsw19.json exactly as build_nsw23_past.py joined 2019 into
the nsw23 frame: `prev` 2015 (already wired by build_nsw19_data.py —
asserted here, never rewritten), agg pprim/pformal on AUS+NSW, each
district's `h` history row, every candidate's c[5] change on 2015 (same
ab token as 2019, else the whole share — the federal new-name
convention), and classic-pair districts' tpp[2] swings where 2015's
final pair was also Labor v Coalition.

The 2015 and 2019 elections were both fought on the 2013 redistribution
— the SAME 93 districts, names and slugs. No rename adjudication exists
here at all: where build_nsw23_past.py carries RENAMES/ABOLISHED/NEW for
the 2021 redistribution (Leppington and friends), this builder asserts
the two rosters equal, loudly, and handles nothing.

Sources (committed, read-only): the 2015 result pages
(.build/state-flow-src/nsw/2015/<slug>-{fp,dop}.html.gz ×93) and the
2015 counted preference-flow bank (.build/state-flow-src/nsw/2015/
counts.csv — the same parse-nsw-state-flows.py re-count family the
frame's own 2019 fl lanes ride). The 2015 pages sit at ANOTHER vintage
grammar from the frame's 2019 pages — Polling Places / Pre-Poll Venues
section heads (2019: Voting Centres / Early Voting Centres), the
Nationals printed NP (2019: NAT), the 2015-only minor codes NLT/ACP/ORP/
UP, Declared Institution rows, ELECTED stamped from the first count
cell. That grammar is build_nsw15_data.py's; the parse functions are
LIFTED here with the 2015 constants owned (this builder imports nothing
from the sibling 2015 builder — the two files' reads of the same caches
stay coherent, not conjoined). The generic helpers (page reads, name
flattening, buckets) ride the frame builder's exactly as
build_nsw23_past.py rides build_nsw23_data's.

counts.csv is VERIFICATION-ONLY as a data source (the parent-of-lane's
join derives every joined figure from the fp/dop pages): per district it
re-proves the candidate first-preference roll name-for-name and
vote-for-vote, the final pair by name, BOTH finalists' tallies as the
summed to_final lanes, and the exhausted remainder as formal − TCP. A
candidate the bank prints under a different name trips the build loudly.
(The fp/dop page census, 93 districts: no SFF code exists in 2015 — the
Shooters and Fishers Party contested the Legislative Council only that
year — so every 2019 SFF candidacy's change reads its whole 2019 share
under the same-token rule; the Nationals' 2015 NP code maps onto the
shared NAT token, Country Labor's CLP onto ALP.)

Guards (the goal's provenance list): REF_2015_FORMAL / REF_2015_INFORMAL
/ REF_2015_ENROLLED strict-sum pins (copied from build_nsw15_data.py,
which pins the same three), the seat tally {ALP 34, LIB 37, NAT 17,
GRN 3, IND 2}, the elected-marker arithmetic on all 93 (re-asserted at
the join boundary), and the 93-name roster equality against the frame.
Frame byte-identity outside the joined lanes rides on the lane-list
discipline: the join writes agg.{AUS,NSW}.pprim/pformal, div.h, c[*][5]
and tpp[2], and nothing else; root `prev` stays the 2015 that
build_nsw19_data.py emitted.

usage: python3 -I .build/map/build_nsw19_past.py <map_data_dir>
runs AFTER build_nsw19_data.py (it joins into that script's
data-nsw19.json).
"""
import collections
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_nsw19_data as B  # noqa: E402  (read_page, flat_name, bucket, helpers)

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(B.REPO, "maps", "data")

# ------------------------------------------------------------------ 2015 grammar
# Lifted verbatim from build_nsw15_data.py (that module is the 2015 frame's
# own builder; the join owns its copy, and a drift of either copy against
# the committed caches fails the build that trips first).
SECTION_HEADS_2015 = {"Polling Places": "vc", "Pre-Poll Venues": "evc",
                      "Declaration Votes": "decl"}
SUBTOTAL_HEADS_2015 = {"Total Polling Place": "vc", "Total Pre-Poll": "evc",
                       "Total Declaration": "decl"}
# the venue-grid's affiliation codes onto the frame's abbreviations, 2015
# vintage: the parent's map plus NP for the Nationals (2019 prints NAT) and
# the four 2015-only minor houses NLT/ACP/ORP/UP
PARTY_AB_2015 = {
    "LAB": "ALP", "ALP": "ALP", "LIB": "LIB", "NAT": "NAT", "GRN": "GRN",
    "ON": "ONP", "PHON": "ONP", "IND": "IND", "SFF": "SFF", "AJP": "AJP",
    "SAP": "SAP", "SBP": "SBP", "KSO": "KSO", "LDP": "LDP", "IMO": "IMO",
    "IMOP": "IMO", "LCP": "LCP", "PEP": "PEP", "SA": "SOA",
    "CLP": "ALP",   # Country Labor Party code — NOT the NT Country Liberal
    "CDP": "CDP", "AC": "AC", "FLUX": "FLUX",
    "NP": "NAT", "NLT": "NLT", "ACP": "ACP", "ORP": "ORP", "UP": "UP",
}
COUNTS_2015 = os.path.join(B.FLOW, "2015", "counts.csv")

# the 2015 statewide answer key — copied from build_nsw15_data.py's pins:
# computed STRICTLY as the sums over all 93 district parses on the
# committed caches (the caches carry no statewide roll-up), then pinned; a
# drift against them fails the build loudly. (Cross-check recorded there:
# the NSWEC's published statewide enrolment for the 2015 close of roll is
# 5,040,662 — the district sums agree.)
REF_2015_FORMAL = 4404334
REF_2015_INFORMAL = 156900
REF_2015_ENROLLED = 5040662
EXPECTED_2015_SEATS = {"ALP": 34, "LIB": 37, "NAT": 17, "GRN": 3, "IND": 2}
N_DISTRICTS = 93


def fail(msg):
    raise SystemExit(f"nsw19-past: {msg}")


def r2(v):
    return round(v + 1e-9, 2)


# ------------------------------------------------------------------ 2015 parses
def parse_fp(page, year, slug):
    """The district's 2015 fp summary page -> candidates, formal/informal,
    enrolled, and the venue rows. build_nsw15_data.parse_fp lifted: its
    SECTION/SUBTOTAL/PARTY tables are this module's 2015-owned constants;
    the cell/table helpers are the frame builder's (identical text in both
    source modules)."""
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    if len(tables) != 2:
        fail(f"{year} {slug}: {len(tables)} tables, expected 2")
    # enrolled, from the prose note (2015 closes the label with </b>)
    m = re.search(r"Electors Enrolled as on ([\d/]+):</(?:strong|span|b)>\s*([\d,]+)", page)
    if not m:
        fail(f"{year} {slug}: no Electors Enrolled line")
    enrolled = int(m.group(2).replace(",", ""))

    # ---- table 0: candidate summary
    t0 = list(B.rows_of(tables[0]))
    if not t0 or t0[0][:2] != ["Candidate", "Representation"]:
        fail(f"{year} {slug}: table 0 header drift ({t0[0][:2]!r})")
    cands = []          # (familyKey, surname-given, partyName, votes)
    formal0 = None
    for r in t0[1:]:
        if not r or not r[0]:
            continue
        if r[0].upper().startswith("TOTAL FORMAL"):
            formal0 = B.parse_int_cell(r[2] if len(r) > 2 else r[-1])
            continue
        name, party, votes = r[0], r[1], B.parse_int_cell(r[2])
        cands.append({"nm": name, "pn": party, "v": votes})
    if formal0 is None:
        fail(f"{year} {slug}: no TOTAL FORMAL VOTES row")
    if sum(c["v"] for c in cands) != formal0:
        fail(f"{year} {slug}: table 0 sum {sum(c['v'] for c in cands)} != formal {formal0}")

    # ---- table 1: the venue grid; header row gives the affiliation key
    t1 = list(B.rows_of(tables[1]))
    hdr = t1[0]
    if not hdr or hdr[0] != "Venue and Vote Types":
        fail(f"{year} {slug}: table 1 header drift ({hdr[0]!r})")
    # sentinel columns close the candidate block (an ungrouped candidate's
    # header cell is the bare surname — only the printed sentinel names are
    # never candidates, so the sentinel labels themselves start the tail)
    tail_names = ("total formal", "informal", "total votes/ ballot papers",
                  "count status")
    i_tf = next((i for i, c in enumerate(hdr[1:])
                 if c.lower() in tail_names), None)
    if i_tf is None:
        fail(f"{year} {slug}: venue header lacks a Total Formal sentinel")
    keys = []           # per candidate column: (surname-lower, AB|None)
    for cell in hdr[1:][:i_tf]:
        m2 = B.HDR_AB_RE.match(cell)
        keys.append((m2.group(1).strip().lower(), m2.group(2)) if m2 else None)
    if len(keys) != len(cands):
        fail(f"{year} {slug}: table 0 has {len(cands)} candidates, table 1 header {len(keys)}")
    hdr_cells = hdr[1:][:i_tf]
    for i, k in enumerate(keys):
        if k is None:
            # bare-surname column = ungrouped candidate (party cell empty)
            sur = hdr_cells[i].strip().lower()
            if not cands[i]["pn"]:
                keys[i] = (sur, "IND")
            else:
                fail(f"{year} {slug}: unparseable header cell {hdr_cells[i]!r} "
                     f"over party cell {cands[i]['pn']!r}")
    tail = hdr[1 + i_tf:]
    want_tail = ["Total Formal", "Informal", "Total Votes/ Ballot Papers", "Count Status"]
    if [t.replace("\xa0", " ").strip() for t in tail[:2]] != want_tail[:2]:
        fail(f"{year} {slug}: venue sentinel columns drift ({tail!r})")

    # reconcile the two tables' candidates (same order; the summary name's
    # surname part is the header surname — multi-word surnames included)
    order = []
    for i, (sur, ab) in enumerate(keys):
        c = cands[i]
        if not c["nm"].lower().startswith(sur + " "):
            fail(f"{year} {slug}: table order drift at {i}: {c['nm']!r} vs header {sur!r}")
        order.append(i)

    venues = []
    sec = None
    tots = {}
    for r in t1[1:]:
        if not r or not r[0]:
            continue
        lab = r[0]
        if lab in SECTION_HEADS_2015:
            sec = SECTION_HEADS_2015[lab]
            continue
        if lab.startswith("%"):
            continue
        cells = r[1:]
        votes = [B.parse_int_cell(c) if c not in ("", "-") else 0 for c in cells[:len(keys)]]
        extra = cells[len(keys):]
        tot_f = B.parse_int_cell(extra[0]) if len(extra) > 0 and extra[0] not in ("", "-") else None
        inf = B.parse_int_cell(extra[1]) if len(extra) > 1 and extra[1] not in ("", "-") else 0
        sub = next((kind for k, kind in SUBTOTAL_HEADS_2015.items()
                    if lab.startswith(k)), None)
        if sub in ("vc", "evc", "decl"):
            tots[sub] = (votes, tot_f)
            continue
        if lab.startswith("Total Votes"):
            tots["all"] = (votes, tot_f, inf)
            continue
        if sec is None:
            fail(f"{year} {slug}: venue row {lab!r} before any section head")
        venues.append({"sec": sec, "name": lab, "votes": votes, "tot": tot_f, "inf": inf})
    if set(tots) != {"vc", "evc", "decl", "all"}:
        fail(f"{year} {slug}: missing subtotal rows ({sorted(tots)})")

    # subtotals reconcile (per candidate columns and the formal column)
    for key in ("vc", "evc", "decl"):
        sv, tf = tots[key]
        rows = [v for v in venues if v["sec"] == key]
        if rows:
            col = [sum(v["votes"][i] for v in rows) for i in range(len(keys))]
            if col != sv:
                fail(f"{year} {slug}: {key} subtotal {sv} != venue sums {col}")
        else:
            if any(sv):
                fail(f"{year} {slug}: {key} subtotal non-zero with no venue rows")
    allv, all_tf, all_inf = tots["all"]
    if all_tf != formal0:
        fail(f"{year} {slug}: venue-grid formal {all_tf} != table-0 formal {formal0}")
    if allv != [c["v"] for c in cands]:
        # the venue grid's candidate columns are the same formal counts
        fail(f"{year} {slug}: venue-grid candidate totals != table 0")

    # informal: the total row carries it
    informal = all_inf
    return {"cands": cands, "keys": keys, "formal": formal0, "inf": informal,
            "enrolled": enrolled, "venues": venues}


def parse_dop(page, year, slug, fp):
    """The district's 2015 Distribution-of-Preferences page -> TCP pair and
    winner, reconciled against the fp parse's candidates. build_nsw15_
    data.parse_dop lifted: 2015 stamps ELECTED<br>{votes} from the FIRST
    count cell onward and prints the winner row's %-of-vote cell SECOND-
    LAST; the final-count read is content-based, so both placements parse.
    The cell helpers are the frame builder's."""
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    if len(tables) != 1:
        fail(f"{year} {slug}: dop has {len(tables)} tables, expected 1")
    rows = list(B.rows_of(tables[0]))
    if not rows or rows[0][0] != "Counts":
        fail(f"{year} {slug}: dop header drift ({rows[0][:2]!r})")
    ncand = len(fp["cands"])
    cand_rows = {}
    winner = None
    tcp = None
    exhausted = None
    total_trk = None
    for r in rows[1:]:
        if not r or not r[0]:
            continue
        lab = r[0]
        if lab in ("Candidates",) or lab.startswith("Count"):
            continue
        # name cells arrive glued as "PRESTON RobynLIB" (surnameCAPS party);
        # the row's own first token is the surname cap-word
        back = lab
        if back.startswith("Total Votes in Count"):
            total_trk = [B.parse_int_cell(c) if c not in ("", "-") else None for c in r[1:]]
            continue
        if back.startswith("Exhausted Votes"):
            exhausted = [B.parse_int_cell(c) if c not in ("", "-") else None for c in r[1:]]
            continue
        if back.startswith("Informal") or back.startswith("Total Votes /") or back.startswith("Absolute Majority"):
            continue
        # a candidate row's name cell is the fp summary's "SURNAME Given"
        # with the affiliation code glued or tacked at the tail; an
        # ungrouped candidate's carries none ("DAOUD Jamal")
        stripped = back.strip()
        m_suf = re.search(r"\s*\(?([A-Z]{2,5})\)?$", stripped)
        if m_suf:
            run = m_suf.group(1)
            # the run can fuse a surname-final uppercase tail with a glued
            # code ("KANAK Dominic WYGRN" — tail "WY" + code "GRN"): take
            # the longest KNOWN code off the run's end
            code = run
            if code not in PARTY_AB_2015:
                cut = next((c for c in sorted(PARTY_AB_2015, key=len, reverse=True)
                            if run.endswith(c) and len(run) > len(c)), None)
                code = cut
            if code and code in PARTY_AB_2015:
                stripped = back[:m_suf.end(1) - len(code)].strip()
        matched = next((c for c in fp["cands"]
                        if c["nm"].lower() == stripped.lower()), None)
        if matched is None:
            # sentinel we do not track (a stranger row) — only candidate
            # rows carry a first-preference count cell matching the fp
            first = B.parse_int_cell(r[1]) if len(r) > 1 else None
            if first is None or all(c["v"] != first for c in fp["cands"]):
                continue
            fail(f"{year} {slug}: dop row {back[:40]!r} matches no fp candidate")
        vals = [c for c in r[1:]]
        cand_rows[matched["nm"]] = vals
        # 2015 stamps ELECTED<br>{votes} on the winner's tally from the
        # FIRST count cell onward; the marker alone never proves the final
        # total, which the finals read below derives anyway
        if any(B.ELECTED_RE.search(c) for c in vals):
            if winner is not None:
                fail(f"{year} {slug}: two ELECTED rows")
            winner = matched["nm"]
    if winner is None:
        fail(f"{year} {slug}: no ELECTED marker")
    if len(cand_rows) != ncand:
        miss = [c["nm"] for c in fp["cands"] if c["nm"] not in cand_rows]
        fail(f"{year} {slug}: dop rows {len(cand_rows)} != {ncand} candidates (missing {miss[:3]})")

    def final_cell(nm):
        # the dop table's trailing column is "% of Vote" — 2015 prints it
        # SECOND-LAST on a winner row with an empty cell behind it, 2019
        # and 2023 print it last: read the last count's tally content-
        # based, as the candidate's last non-empty cell that is not a
        # percentage. An excluded candidate's final reads EXCLUDED.
        tail = [v for v in cand_rows[nm]
                if v not in ("", "-") and not re.fullmatch(r"\d+(?:\.\d+)?\s*%", v)]
        if not tail:
            fail(f"{year} {slug}: {nm} has no count cells")
        return tail[-1]

    # the two live candidates at the final count: the winner's cell carries
    # ELECTED; the other live row's is a bare number; every excluded row's
    # ends EXCLUDED
    finals = {}
    for nm in cand_rows:
        last = final_cell(nm)
        if "EXCLUDED" in last:
            continue
        mm2 = B.ELECTED_RE.search(last)
        raw = mm2.group(1) if mm2 else (re.search(r"([\d,]+)$", last) or [None, None])[1]
        if raw is None:
            continue
        v = int(raw.replace(",", ""))
        if v <= 0:
            fail(f"{year} {slug}: {nm} final total {v}")
        finals[nm] = v
    if len(finals) != 2:
        fail(f"{year} {slug}: {len(finals)} live candidates at the last count "
             f"({sorted(finals) or 'none'}), expected 2")
    if winner not in finals:
        fail(f"{year} {slug}: ELECTED {winner} not in the live pair {sorted(finals)}")
    # the winner's tally is the higher
    (a, b) = sorted(finals)
    if finals[a] == finals[b]:
        fail(f"{year} {slug}: dead heat at the last count")
    if (finals[a] > finals[b]) != (winner == a):
        fail(f"{year} {slug}: ELECTED marker {winner} contradicts the taller tally")
    return {"tcp": finals, "winner": winner}


# ------------------------------------------- the counted re-count oracle
def load_flow_counts_2015(slugs):
    """The committed 2015 re-count of the NSWEC's ballot papers — {slug:
    {"finals": [flatName, flatName], "rows": {flatName: (to_final1,
    to_final2, exhausted, first_prefs)}}}. build_nsw15_data's loader lifted
    against COUNTS_2015 (header-identical to the frame's own 2019 bank,
    verified when that builder was pinned)."""
    if not os.path.exists(COUNTS_2015):
        fail(f"{COUNTS_2015} missing — .build/parse-nsw-state-flows.py is the "
             f"committed re-count of the NSWEC's ballot papers")
    out = collections.defaultdict(lambda: {"finals": None, "rows": {}})
    with open(COUNTS_2015, newline="") as f:
        for r in csv.DictReader(f):
            slug = r["district"]
            if slug not in slugs:
                fail(f"counts.csv names a district {slug!r} the frame lacks")
            t1, t2, ex, fpv = (B.parse_int_cell(r[k]) for k in
                               ("to_final1", "to_final2", "exhausted", "first_prefs"))
            if t1 + t2 + ex != fpv:
                fail(f"counts.csv {slug} {r['candidate']}: {t1}+{t2}+{ex} != fp {fpv}")
            nm = B.flat_name(r["candidate"])
            finals = (B.flat_name(r["final1"]), B.flat_name(r["final2"]))
            d = out[slug]
            if d["finals"] is None:
                if finals[0] == finals[1]:
                    fail(f"counts.csv {slug}: final1 == final2")
                d["finals"] = list(finals)
            elif tuple(d["finals"]) != finals:
                fail(f"counts.csv {slug}: finals drift within the district")
            if nm in d["rows"]:
                fail(f"counts.csv {slug}: duplicate candidate {nm!r}")
            d["rows"][nm] = (t1, t2, ex, fpv)
    missing = slugs - set(out)
    if missing:
        fail(f"counts.csv has no rows for {sorted(missing)[:3]}"
             f"{'…' if len(missing) > 3 else ''} — the 2015 re-count is short")
    return out


# ------------------------------------------------------------------ the 2015 house
def build_2015():
    sdir = os.path.join(B.FLOW, "2015")
    slugs = sorted(f[: -len("-fp.html.gz")] for f in os.listdir(sdir)
                   if f.endswith("-fp.html.gz") and not f.startswith("lc-"))
    if len(slugs) != N_DISTRICTS:
        fail(f"2015 cache holds {len(slugs)} districts, expected {N_DISTRICTS}")
    dists, slug_of, seats = {}, {}, {}
    prim = collections.Counter()
    formal = informal = enrolled = 0
    for slug in slugs:
        fpage = B.read_page("2015", slug, "fp")
        fp = parse_fp(fpage, "2015", slug)
        dop = parse_dop(B.read_page("2015", slug, "dop"), "2015", slug, fp)
        m = re.search(r"State Electoral District of ([A-Za-z][A-Za-z'’ \-]+)", fpage)
        if not m:
            fail(f"2015 {slug}: no State Electoral District anchor")
        name = m.group(1).strip()
        if slug != B.slug_for("2015", name):
            fail(f"2015 {slug}: page names district {name!r}")
        if name in dists:
            fail(f"2015 district {name!r} parsed twice")
        ab_of = {}
        for i, c in enumerate(fp["cands"]):
            code = fp["keys"][i][1]
            ab = PARTY_AB_2015.get(code)
            if ab is None:
                fail(f"2015 {slug}: unmapped party code {code!r} ({c['pn']!r})")
            ab_of[c["nm"]] = ab
            prim[B.bucket(ab)] += c["v"]
        formal += fp["formal"]
        informal += fp["inf"]
        enrolled += fp["enrolled"]
        w = dop["winner"]
        # 2015's TCP pair -> bucket pair; keep the counts for a classic 2PP
        tcp = {flat_ab: v for flat_ab, v in
               ((B.bucket(ab_of[n]), v) for n, v in dop["tcp"].items())}
        wab = ab_of[w]
        seats[wab] = seats.get(wab, 0) + 1
        # elected-in-2015 == the final pair's arithmetic leader, re-asserted
        # at the join boundary on top of parse_dop's internal proof
        if max(dop["tcp"], key=dop["tcp"].get) != w:
            fail(f"2015 {slug}: ELECTED {w!r} is not the taller final tally")
        wv = dop["tcp"][w]
        tot = sum(dop["tcp"].values())
        dists[name] = {
            "slug": slug,
            "cands": [{"nm": c["nm"], "ab": ab_of[c["nm"]], "v": c["v"]} for c in fp["cands"]],
            "formal": fp["formal"],
            "winner": {"n": B.flat_name(w), "ab": wab, "pct": r2(100 * wv / tot)},
            "tcp_names": dop["tcp"],
            "tcp_buckets": frozenset(tcp),
            "tpp": ([tcp["alp"], tcp["lnp"]] if "alp" in tcp and "lnp" in tcp else None),
        }
        slug_of[name] = slug
    if seats != EXPECTED_2015_SEATS:
        fail(f"2015 seats {seats} != expected {EXPECTED_2015_SEATS}")
    if (formal, informal, enrolled) != (REF_2015_FORMAL, REF_2015_INFORMAL, REF_2015_ENROLLED):
        fail(f"2015 totals (formal {formal}, informal {informal}, enrolled {enrolled}) "
             f"!= REF_2015_* ({REF_2015_FORMAL}, {REF_2015_INFORMAL}, {REF_2015_ENROLLED})")
    got = {k: prim[k] for k in ("alp", "lnp", "grn", "onp", "ind", "oth")}
    return {"dists": dists, "slug_of": slug_of, "prim": got, "formal": formal}


def verify_counts(ha):
    """The counted re-count against the page parse, per district: the
    candidate roll name-for-name AND vote-for-vote, the final pair by
    name, both finalists' tallies as the summed to_final lanes, and the
    exhausted remainder as formal − TCP. Nothing is joined from the bank;
    a disagreement fails the build loudly. Returns the checked count and
    the printed-name drift list (empty unless a candidate's bank print
    differs from the page print — kept for the run report)."""
    flows = load_flow_counts_2015(set(ha["slug_of"].values()))
    name_drift = []
    for name, d in ha["dists"].items():
        slug = d["slug"]
        fr = flows[slug]
        page_roll = {B.flat_name(c["nm"]): c["v"] for c in d["cands"]}
        if set(fr["rows"]) != set(page_roll):
            only_bank = sorted(set(fr["rows"]) - set(page_roll))
            only_page = sorted(set(page_roll) - set(fr["rows"]))
            name_drift.append((slug, only_bank, only_page))
            fail(f"2015 {slug}: counts.csv candidate roll drifts from the fp page — "
                 f"bank-only {only_bank}, page-only {only_page}")
        for nm, v in page_roll.items():
            t1, t2, ex, fpv = fr["rows"][nm]
            if fpv != v:
                fail(f"counts.csv {slug} {nm}: bank fp {fpv} != page fp {v}")
        tcp_flat = {B.flat_name(n): v for n, v in d["tcp_names"].items()}
        f1, f2 = fr["finals"]
        if {f1, f2} != set(tcp_flat):
            fail(f"counts.csv {slug}: final pair {fr['finals']} is not the dop pair "
                 f"{sorted(tcp_flat)}")
        s1 = sum(r[0] for r in fr["rows"].values())
        s2 = sum(r[1] for r in fr["rows"].values())
        if s1 != tcp_flat[f1] or s2 != tcp_flat[f2]:
            fail(f"counts.csv {slug}: finalist tallies ({f1} {s1}, {f2} {s2}) != "
                 f"the dop tallies ({tcp_flat[f1]}, {tcp_flat[f2]})")
        exs = sum(r[2] for r in fr["rows"].values())
        if exs != d["formal"] - s1 - s2:
            fail(f"counts.csv {slug}: exhausted {exs} != formal − TCP "
                 f"({d['formal']} − {s1} − {s2})")
    return len(ha["dists"]), name_drift


# ------------------------------------------------------------------ join into the frame
def main():
    ha = build_2015()
    n_verified, name_drift = verify_counts(ha)

    data_path = os.path.join(OUT, "data-nsw19.json")
    if not os.path.exists(data_path):
        fail("data-nsw19.json missing — run .build/map/build_nsw19_data.py first")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != "nsw19":
        fail("data-nsw19.json is not the nsw19 frame")
    if data.get("prev") != 2015:
        fail(f"frame root prev is {data.get('prev')!r}, not 2015 — "
             f"build_nsw19_data.py wires prev; this script asserts, never rewrites")

    # the roster check: 2015 and 2019 were fought on the SAME 2013-
    # redistribution districts, so the frame's names and the 2015 pages'
    # H1 names are one set. Asserted loudly — no rename machinery exists.
    frame_names = [div["n"] for div in data["divs"]]
    if len(frame_names) != N_DISTRICTS or len(set(frame_names)) != N_DISTRICTS:
        fail(f"frame carries {len(frame_names)} districts ({len(set(frame_names))} unique), "
             f"expected {N_DISTRICTS}")
    if set(frame_names) != set(ha["dists"]):
        fail(f"2013-redistribution roster drift — frame-only "
             f"{sorted(set(frame_names) - set(ha['dists']))[:3]}, 2015-only "
             f"{sorted(set(ha['dists']) - set(frame_names))[:3]}")

    agg = data["agg"]
    for st_k in ("AUS", "NSW"):
        agg[st_k]["pprim"] = ha["prim"]
        agg[st_k]["pformal"] = ha["formal"]

    n_hist = n_sw = n_tpp = 0
    matched = set()
    for div in data["divs"]:
        name = div["n"]
        past = ha["dists"].get(name)
        if past is None:
            fail(f"2019 district {name} matches no 2015 page — the roster "
                 f"check above should have spoken first")
        matched.add(name)
        if div["h"]:
            fail(f"{name}: h already holds {len(div['h'])} rows — the join "
                 f"expects to be the frame's first past lane")
        w = past["winner"]
        div["h"] = [[2015, w["pct"], w["ab"], w["n"]]]
        n_hist += 1
        formal = sum(r[4] for r in div["c"])
        prev_by_ab = {}
        for c in past["cands"]:
            prev_by_ab[c["ab"]] = prev_by_ab.get(c["ab"], 0) + c["v"]
        for r in div["c"]:
            share = (100 * r[4]) / formal
            prev_share = (100 * prev_by_ab[r[1]]) / past["formal"] if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1
        if div.get("tpp") and past["tpp"]:
            cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
            oldv = (100 * past["tpp"][0]) / sum(past["tpp"])
            div["tpp"][2] = r2(cur - oldv)
            n_tpp += 1
    if matched != set(ha["dists"]):
        fail(f"2015 districts matched to no frame div: {sorted(set(ha['dists']) - matched)}")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    drift = (f"; counts.csv roll drift {name_drift}" if name_drift
             else "; counts.csv verified, no printed-name drift")
    print(f"nsw19 past: {n_hist} history rows, {n_sw} candidate swings, {n_tpp} 2PP swings; "
          f"2015 stored (LA {ha['formal']:,} formal; {n_verified} districts re-count"
          f"-checked{drift})")


if __name__ == "__main__":
    main()
