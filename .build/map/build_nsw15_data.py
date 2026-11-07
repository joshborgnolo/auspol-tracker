#!/usr/bin/env python3
"""data-nsw15.json for /map/ — the New South Wales state election of 28 Mar
2015 (93 districts, Legislative Assembly, NSWEC event id SGE2015), the frame
build's own parse of the NSW Electoral Commission's pastvtr results pages.

build_nsw23_data.py's discipline verbatim on the 2015 vintage (the eldest
of the three NSWEC webpage vintages the flow caches hold), with the two
vintage deltas called out below. The committed caches in
.build/state-flow-src/nsw/2015/ (<slug>-fp.html.gz, <slug>-dop.html.gz)
are the one record — this script never refetches; a cache gap fails the
build loudly. The 2015 grid prints the same 93 districts as 2019's and
2023's isn't: 2015 and 2019 were both fought on the 2013-redistribution
boundaries, so the district set is IDENTICAL (same 93 slugs and names; the
2023 election moved to a new redistribution).

Grammar (pinned against hawkesbury-{fp,dop}, balmain-{fp,dop} and
sydney-{fp,dop} of 2015, all 93 districts of both vintages scanned
head-to-toe; deltas from build_nsw23_data.py's pinned 2019/2023 grammar):
  fp page: prose "Electors Enrolled as on DD/MM/YYYY: N" — 2015 wraps the
    label in <b> (2019 <span class="bold">, 2023 <strong>); table 0 and
    the "Venue and Vote Types" grid are structurally the parent's, but the
    sections are renamed: Polling Places (not Voting Centres) + Total
    Polling Place Ordinary Votes; Pre-Poll Venues (not Early Voting
    Centres) + Total Pre-Poll Ordinary Votes; then Declaration Votes
    (Absent / Enrolment / iVote / Postal / Provisional / Silent — five
    rows, 2019 folds the last pair into "Enrolment / Provisional") +
    Total Declaration Votes; Total Votes / Ballot Papers and the two pct
    rows. Inside Pre-Poll Venues the 2015 page prints "<X> RO Pre-Poll"
    returning-officer rows (2019: "<X> EM Office"), "<X> Pre-Poll" /
    "<X> Pre-poll" / even "<X> Pre Poll" venue rows (2019: "<X> EVC"),
    "Sydney Town Hall Pre-Poll" once per district, and one
    "Declared Institution" row (2019: "Declared Facility") in 89 of 93
    districts. Pct cells print "X.XX %" with a space in both old vintages.
  party codes: 2015's era adds NLT (No Land Tax Campaign), ACP (Australian
    Cyclists Party), ORP (Outdoor Recreation Party) and UP (Unity Party),
    and prints the Nationals as NP (2019: NAT). Labor prints LAB and in 26
    seats CLP (Country Labor — mapped to ALP exactly as build_nsw23_data's
    CLP clause; never the NT Country Liberal). 13 empty Representation
    cells print as bare-surname header columns and IND rows in the dop —
    the parent's ungrouped-candidate lane.
  dop page: same table as 2019/2023 (header "Counts|Count 1|…", candidate
    rows "NAME GivenCODE" glued with no parens, sentinel rows, a trailing
    "% of Vote" column) with two print differences: ELECTED<br>{votes}
    stamps the winner's tally from the FIRST cell onward (not only the
    late violation weights), and the "% of Vote" cell sits
    SECOND-LAST on a winner row with one empty cell behind it. The
    final-count read below is content-based (pct cells never read as
    counts), so both placements parse. All 93 2015 districts carry fp and
    dop caches and every 2015 dop page carries an ELECTED row.

The frame's res file rides build_nsw23_data.py's shape exactly ({year,
date, prev, jurisdiction, demoBasis, flBasis, flOpv, agg{AUS,NSW{...}},
divs[], booths{}}; candidate rows [n,ab,pn,bucket,votes,swing,elected,x];
booth lanes d,id,n,ty,prem,sub,pc,lat,lon,v,inf,tpp,tcp,fl,dec,vdec plus
the provenance lane psrc below). prev is null — no 2011 sources are
committed; qld17 is the frame family's null-prev precedent. tpp only on
classic ALP-v-LNP final pairs.

The preferences lane is COUNTED exactly as nsw23's and nsw19's: the NSWEC
publishes every ballot paper's preferences and parse-nsw-state-flows.py's
re-count (committed .build/state-flow-src/nsw/2015/counts.csv — never
refetched, a miss fails the build; header-identical to 2019's/2023's,
verified) gives per district and candidate the ballots ending with each
of the district's final pair plus the exhausted remainder. d.fl carries
one [candIdx, toFinal1, toFinal2, exhausted] quadruple per NON-finalist,
oriented on the tcp pair. flBasis "counted" + flOpv true. Booth tpp/tcp/fl
stay empty.

Booths and VENUE PROVENANCE (the one place 2015 departs the parent): no
SGE2015 placemark roll exists and the pastvtr venue API is dead, so each
2015 fp-grid venue row is name-matched to the NEXT election's roll — the
committed SG1901 placemark set (.build/map/src/nsw23/venues/SG1901/<nnn>-
<district>.json, id numbers also loaned as this frame's placemark ids,
since the 2013-redistribution district set is identical). Within the same
district's file only (a cross-district same-name venue is never matched —
the same-premises name in another district is not evidence; this is the
same-district guard the goal sets for this wave). Lane order: exact Uppn
print ("Annangrove Public"), postal-Name alias, then the 2015-only
translations "<X> RO Pre[- ]Poll" → "<X> EM Office" and "<X> Pre[- ]Poll"
→ "<X> EVC" or bare "<X>" (covers "Sydney Town Hall Pre-Poll", the roll's
byte-identical duplicated central record every district prints). The
EVC-translation lane asserts the matched record's Locality still names the
labelled town — a 2015 pre-poll and its 2019 successor in the same town
are a plausible-consistent location, not a proven identical premises; an
assertion-fail fails the build loudly. Matched/venue rows carry their
origin on the card: the booths lane psrc is null for a current-election
placemark, else [2019, matchedUppn, lane], and the frame-level venueSrc
record below keeps the counts and the full unmatched list — the federal
1993-98 frames' source-year disclosure discipline (their
booth-locations-history.json store / location lane), against the match
fraction pinned in VENUE_2015_MATCH: a drift of the committed caches that
changes ANY matching count fails the build. Unmatched rows are honest
nulls: premises/locality/postcode/lat/lon all null, psrc null.

ty: 5 for a pre-poll venue row (2015's Pre-Poll section incl. the
area-venue translations above), 4 for a Declared Institution team row or
an "<X> RO Pre-Poll" returning-officer row — geocoded only if the RO row
matched its district's SG1901 EM-office placemark — else 1. Declaration
rows absent from the booth lanes (Absent / Enrolment / iVote / Postal /
Provisional / Silent), exactly as nsw23.

Census is NOT spliced here (contrast build_nsw23_data.py, which folds
data/nsw23-demo.json + nsw23-seifa.json in at this step): the 2015 and
2019 frames stage census as a later wave against the nsw13 boundaries
work, so div records emit "demo": null / "seifa": null placeholders.

usage: python3 -I .build/map/build_nsw15_data.py <out_dir>
"""
import collections, csv, gzip, html as H, json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FLOW = os.path.join(REPO, ".build", "state-flow-src", "nsw")
NSW23 = os.path.join(REPO, ".build", "map", "src", "nsw23")
VENUES = os.path.join(NSW23, "venues")
DIST_IDS = os.path.join(NSW23, "district-ids.json")
FLOW_COUNTS = os.path.join(FLOW, "2015", "counts.csv")
DEMO_STORE = os.path.join(REPO, "data", "nsw15-demo.json")
SEIFA_STORE = os.path.join(REPO, "data", "nsw15-seifa.json")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "maps", "data")

ELECTION = "2015-03-28"
EVENT = "SG1901"     # venue roll loaned from the 2019 event — see docstring
LANG_YEAR = "2015"
EXPECTED_SEATS = {"ALP": 34, "LIB": 37, "NAT": 17, "GRN": 3, "IND": 2}
N_DISTRICTS = 93
# the 2015 grid's section heads and subtotal-row prefixes (2019/2023 print
# "Voting Centres"/"Early Voting Centres" — same three structural slots)
SECTION_HEADS = {"Polling Places": "vc", "Pre-Poll Venues": "evc",
                 "Declaration Votes": "decl"}
SUBTOTAL_HEADS = {"Total Polling Place": "vc", "Total Pre-Poll": "evc",
                  "Total Declaration": "decl"}
# statewide REF pins — computed STRICTLY as the sums over all 93 district
# parses on the committed caches (the caches carry no statewide roll-up;
# the LC pages print neither an enrolled nor an aggregate-LA figure), then
# pinned here; a drift against them fails the build loudly. (Cross-check:
# NSWEC's own published statewide enrolment for the 2015 close of roll is
# 5,040,662 — the district sums agree.)
REF_2015_FORMAL = 4404334
REF_2015_INFORMAL = 156900
REF_2015_ENROLLED = 5040662
# venue name-match bookkeeping pinned from the committed caches: (matched,
# eligible) — the run whose caches show different counts drifts and fails
VENUE_2015_MATCH = (2657, 3235)
VENUE_MATCH_FRACTION_MIN = 0.80  # the 82% first-pass reality less margin;
                                  # tune only with evidence, not to silence
# the one NSWEC locality-naming divergence on the committed roll: 2015's
# "Wiradjuri Pre-Poll" (the district's RO channel in the Griffith area —
# Wiradjuri is a locality NE of Griffith) succeeded in 2019 by the
# "Wiradjuri EVC" placemark, which the roll files under the Griffith
# locality, not Wiradjuri. The EVC lane's locality-consistency assert
# passes this one pinned pair; ANY further divergence fails the build
EVC_LOCALITY_EXCEPT = {("murray", "Wiradjuri Pre-Poll"): "Wiradjuri EVC"}

COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]


def fail(msg):
    raise SystemExit(f"nsw15: {msg}")


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP" or ab == "LAB":
        return "alp"
    if ab in COALITION:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "HAN", "ONP", "PHON"):
        return "onp"
    if ab in ("IND", "", "NAFD"):
        return "ind"
    return "oth"


def fix_word(w):
    if w.isupper() and len(w) > 1:
        t = w.capitalize()
        for pre in ("Mc", "O'", "D'"):
            if t.startswith(pre) and len(t) > len(pre):
                t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
        return t
    # the NSWEC record prints a few nominated names "McGIRR"/"MacJOLLY" (the
    # surname's own capital kept, the tail still in caps); those aren't
    # .isupper(), so normalise the caps tail here
    m = re.fullmatch(r"(Mc|Mac)([A-Z]{2,})", w)
    if m:
        return m.group(1) + m.group(2).capitalize()
    return w


def title_name(given, surname):
    s = surname or ""
    out = []
    for w in s.split(" "):
        out.append("-".join(fix_word(p) if p else p for p in w.split("-")))
    return ((given or "").strip() + " " + " ".join(out)).strip()


def flat_name(n):
    """NSWEC rows run "SURNAME Given" (no comma); the map's files ride
    "Given SURNAME"."""
    n = (n or "").strip()
    if not n:
        return n
    parts = n.split(" ")
    lead = 0
    for i, w in enumerate(parts):
        # a mixed "McGIRR"/"MacJOLLY" still belongs to the leading surname run
        if w.isupper() or re.fullmatch(r"(Mc|Mac)[A-Z]{2,}(?:-[A-Z]+)*", w):
            lead = i + 1
        else:
            break
    if not lead or lead == len(parts):
        # all-caps or no caps run: keep as filed (a one-name candidate)
        return title_name("", n) if n.isupper() else n
    sur, giv = " ".join(parts[:lead]), " ".join(parts[lead:])
    return title_name(giv, sur)


def num(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if re.fullmatch(r"-?\d+", s) else None


def parse_int_cell(s):
    v = num(s)
    if v is None:
        fail(f"odd vote cell {s!r}")
    return v


def slug_for(year, name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ------------------------------------------------------------------ fp parse
def txt(c):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def rows_of(table):
    for tr in re.findall(r"<tr.*?</tr>", table, re.S | re.I):
        yield [txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]


HDR_AB_RE = re.compile(r"^([A-Z][A-Za-z' .&-]*?)\s*\(([A-Z]{1,5})\)\s*$")

# the venue-grid's affiliation codes onto the frame's party abbreviations.
# NSWEC's codes are its own (LAB not ALP; SAP for Sustainable Australia);
# the map's files ride the AEC-era vocabulary the other frames share.
PARTY_AB = {
    "LAB": "ALP", "ALP": "ALP", "LIB": "LIB", "NAT": "NAT", "GRN": "GRN",
    "ON": "ONP", "PHON": "ONP", "IND": "IND", "SFF": "SFF", "AJP": "AJP",
    "SAP": "SAP", "SBP": "SBP", "KSO": "KSO", "LDP": "LDP", "IMO": "IMO",
    "IMOP": "IMO", "LCP": "LCP", "PEP": "PEP", "SA": "SOA",
    "CLP": "ALP",   # Country Labor Party code — NOT the NT Country Liberal
    "CDP": "CDP", "AC": "AC", "FLUX": "FLUX",
    # 2015-era codes the parent's table predates: the Nationals print NP
    # (2019 moved the print to NAT), and four 2015-only minor houses
    "NP": "NAT", "NLT": "NLT", "ACP": "ACP", "ORP": "ORP", "UP": "UP",
}
# reference list of the era's full party names (the frame files ride the
# NSWEC page's own printed wording on pn — this only documents the codes)
PARTY_NAME = {
    "ALP": "Australian Labor Party", "LIB": "Liberal Party",
    "NAT": "The Nationals", "GRN": "The Greens",
    "ONP": "Pauline Hanson's One Nation", "IND": "Independent",
    "SFF": "Shooters, Fishers and Farmers", "AJP": "Animal Justice Party",
    "SAP": "Sustainable Australia", "SBP": "The Small Business Party",
    "KSO": "Keep Sydney Open", "LDP": "Liberal Democrats",
    "SOA": "Socialist Alliance", "CDP": "Christian Democratic Party",
    "AC": "Australian Conservatives",
    "NLT": "No Land Tax", "ACP": "Australian Cyclists Party",
    "ORP": "Outdoor Recreation Party", "UP": "Unity Party",
}


def parse_fp(page, year, slug):
    """The district's fp summary page -> candidates, formal/informal,
    enrolled, and the venue rows [{sec, name, votes[], inf}]."""
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    if len(tables) != 2:
        fail(f"{year} {slug}: {len(tables)} tables, expected 2")
    # enrolled, from the prose note (2015 closes the label with </b>,
    # 2019 </span>, 2023 </strong>)
    m = re.search(r"Electors Enrolled as on ([\d/]+):</(?:strong|span|b)>\s*([\d,]+)", page)
    if not m:
        fail(f"{year} {slug}: no Electors Enrolled line")
    enrolled = int(m.group(2).replace(",", ""))

    # ---- table 0: candidate summary
    t0 = list(rows_of(tables[0]))
    if not t0 or t0[0][:2] != ["Candidate", "Representation"]:
        fail(f"{year} {slug}: table 0 header drift ({t0[0][:2]!r})")
    cands = []          # (familyKey, surname-given, partyName, votes)
    formal0 = None
    for r in t0[1:]:
        if not r or not r[0]:
            continue
        if r[0].upper().startswith("TOTAL FORMAL"):
            formal0 = parse_int_cell(r[2] if len(r) > 2 else r[-1])
            continue
        name, party, votes = r[0], r[1], parse_int_cell(r[2])
        cands.append({"nm": name, "pn": party, "v": votes})
    if formal0 is None:
        fail(f"{year} {slug}: no TOTAL FORMAL VOTES row")
    if sum(c["v"] for c in cands) != formal0:
        fail(f"{year} {slug}: table 0 sum {sum(c['v'] for c in cands)} != formal {formal0}")

    # ---- table 1: the venue grid; header row gives the affiliation key
    t1 = list(rows_of(tables[1]))
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
        m2 = HDR_AB_RE.match(cell)
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
        if lab in SECTION_HEADS:
            sec = SECTION_HEADS[lab]
            continue
        if lab.startswith("%"):
            continue
        cells = r[1:]
        votes = [parse_int_cell(c) if c not in ("", "-") else 0 for c in cells[:len(keys)]]
        extra = cells[len(keys):]
        tot_f = parse_int_cell(extra[0]) if len(extra) > 0 and extra[0] not in ("", "-") else None
        inf = parse_int_cell(extra[1]) if len(extra) > 1 and extra[1] not in ("", "-") else 0
        sub = next((kind for k, kind in SUBTOTAL_HEADS.items()
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


# ------------------------------------------------------------------ dop parse
ELECTED_RE = re.compile(r"ELECTED\s*([\d,]+)")
CAND_ROW_RE = re.compile(r"^([A-Z][A-Za-z' .&()-]*?[a-z\)])((?:[A-Z]{2,5}))$")


def parse_dop(page, year, slug, fp):
    """The district's Distribution-of-Preferences page -> TCP pair and
    winner, reconciled against the fp parse's candidates."""
    tables = re.findall(r"<table.*?</table>", page, re.S | re.I)
    if len(tables) != 1:
        fail(f"{year} {slug}: dop has {len(tables)} tables, expected 1")
    rows = list(rows_of(tables[0]))
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
            total_trk = [parse_int_cell(c) if c not in ("", "-") else None for c in r[1:]]
            continue
        if back.startswith("Exhausted Votes"):
            exhausted = [parse_int_cell(c) if c not in ("", "-") else None for c in r[1:]]
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
            if code not in PARTY_AB:
                cut = next((c for c in sorted(PARTY_AB, key=len, reverse=True)
                            if run.endswith(c) and len(run) > len(c)), None)
                code = cut
            if code and code in PARTY_AB:
                stripped = back[:m_suf.end(1) - len(code)].strip()
        matched = next((c for c in fp["cands"]
                        if c["nm"].lower() == stripped.lower()), None)
        if matched is None:
            # sentinel we do not track (a stranger row) — only candidate
            # rows carry a first-preference count cell matching the fp
            first = parse_int_cell(r[1]) if len(r) > 1 else None
            if first is None or all(c["v"] != first for c in fp["cands"]):
                continue
            fail(f"{year} {slug}: dop row {back[:40]!r} matches no fp candidate")
        vals = [c for c in r[1:]]
        cand_rows[matched["nm"]] = vals
        # 2015 stamps ELECTED<br>{votes} on the winner's tally from the
        # FIRST count cell onward; the marker alone never proves the final
        # total, which the finals read below derives anyway
        if any(ELECTED_RE.search(c) for c in vals):
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
        mm2 = ELECTED_RE.search(last)
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


# ------------------------------------------------------------------ caches
def load_districts():
    """The district roster, loaned from the SG1901 id map (the committed
    district-ids file has no SGE2015 entry; the 2015 and 2019 elections
    were fought on the SAME 2013-redistribution districts — identical 93
    slugs and names — so the frame's placemark ids ride SG1901's
    numbering; the fp cache's folder slugs are cross-checked against it
    in main before any parse)."""
    with open(DIST_IDS) as f:
        d = json.load(f)
    m = d.get(EVENT)
    if not isinstance(m, dict) or len(m) != N_DISTRICTS:
        fail(f"district-ids {EVENT} covers {len(m or {})} districts, expected {N_DISTRICTS}")
    return m


def load_venues():
    """The NSWEC placemark roll THIS FRAME MATCHES AGAINST: SG1901's
    records, keyed Uppn-first with the postal Name as an alias exactly as
    build_nsw23_data's loader (identical-field duplicates pass, a
    diverging duplicate fails loudly)."""
    out = {}
    base = os.path.join(VENUES, EVENT)
    if not os.path.isdir(base):
        fail(f"venue roll {base} missing")
    n_files = 0
    for slug in DIST_SLUGS:
        p = os.path.join(base, f"{DIST15[slug]}-{slug}.json")
        if not os.path.exists(p):
            fail(f"venue roll {p} missing")
        n_files += 1
        out.setdefault(slug, {"uppn": {}, "alias": {}})
        for v in json.load(open(p)):
            uppn = (v.get("Uppn") or "").upper()
            name = (v.get("Name") or "").upper()
            if not uppn:
                fail(f"venue record in {slug} lacks a Uppn label")
            cell = out[slug]["uppn"]
            same_loc = (uppn in cell and all(
                cell[uppn].get(k) == v.get(k)
                for k in ("Name", "Premises", "Locality", "Postcode", "Lat", "Lon")))
            if uppn in cell and not same_loc:
                fail(f"venue {uppn!r} duplicated with different fields in {slug}")
            cell[uppn] = v
            if name:
                al = out[slug]["alias"]
                if name in al and not (al[name] is v or dict(al[name]) == dict(v)):
                    # the EVC held in a day booth shares the postal Name:
                    # keep whichever record the Uppn lane printed as a day
                    # booth (no " EVC" suffix), else the first lodged
                    if al[name].get("Uppn", "").upper().endswith(" EVC") and \
                            not uppn.endswith(" EVC"):
                        al[name] = v
                else:
                    al[name] = v
    n_locs = sum(len(o["uppn"]) for o in out.values())
    print(f"venue roll: {n_files} district files, {n_locs} placemarks")
    return out


def venue_lookup(venues, slug, nm):
    """Resolve one 2015 fp-page venue label to an SG1901 placemark IN THE
    SAME DISTRICT, exact first, then the 2015-only print translations
    (see the module docstring). Returns (record, lane); lane is the
    translation used — 'exact'/'alias' for direct name equality, 'ro' /
    'evc' / 'bare' for the translations — or None where the 2019 roll
    offers no plausible home for the row (a venue renamed or closed by
    2019, a hospital report the roll never carried, or an RO office
    serving this district from a neighbouring one). Same-district guard:
    the lookup never leaves this district's file — and inside the evc
    translation lane the matched record's Locality must still name the
    labelled town, so a same-town successor venue is never silently
    promoted to identical premises."""
    cell = venues.get(slug)
    if cell is None:
        fail(f"no venue roll for district {slug}")
    uppn = nm.upper()
    v = cell["uppn"].get(uppn)
    if v is not None:
        return v, "exact"
    v = cell["alias"].get(uppn)
    if v is not None:
        for alt in cell["uppn"].values():
            if (alt is not v and alt.get("Name", "").upper() == uppn
                    and not alt.get("Uppn", "").upper().endswith(" EVC")):
                return alt, "alias"
        return v, "alias"
    m = re.match(r"^(.*) RO Pre[- ][Pp]oll$", nm)
    if m:
        v = cell["uppn"].get((m.group(1) + " EM Office").upper())
        if v is not None:
            return v, "ro"
    m = re.match(r"^(.*) Pre[- ][Pp]oll$", nm)
    if m:
        g = m.group(1)
        for lane, alt in (("evc", g + " EVC"), ("bare", g)):
            v = cell["uppn"].get(alt.upper())
            if v is not None:
                if lane == "evc" and \
                        EVC_LOCALITY_EXCEPT.get((slug, nm)) != alt:
                    loc = (v.get("Locality") or "").lower()
                    if g.lower() not in loc:
                        fail(f"{LANG_YEAR} {slug}: matched {nm!r} to {alt!r} whose "
                             f"Locality {v.get('Locality')!r} does not name the town")
                return v, lane
    return None, None


def load_demo():
    if not os.path.exists(DEMO_STORE):
        fail(f"census store {DEMO_STORE} missing — run .build/map/build_nsw15_demo.py")
    with open(DEMO_STORE) as f:
        d = json.load(f)
    if d.get("year") != "nsw15":
        fail(f"census store is year {d.get('year')!r}")
    demo = d.get("demo")
    if not isinstance(demo, dict) or len(demo) != N_DISTRICTS:
        fail(f"census store covers {len(demo or {})} districts, expected {N_DISTRICTS}")
    return demo


def load_seifa():
    if not os.path.exists(SEIFA_STORE):
        fail(f"SEIFA store {SEIFA_STORE} missing — run .build/map/build_nsw15_seifa.py")
    with open(SEIFA_STORE) as f:
        d = json.load(f)
    if d.get("year") != "nsw15":
        fail(f"SEIFA store is year {d.get('year')!r}")
    seifa = d.get("seifa")
    if not isinstance(seifa, dict) or len(seifa) != N_DISTRICTS:
        fail(f"SEIFA store covers {len(seifa or {})} districts, expected {N_DISTRICTS}")
    return seifa


def read_page(year, slug, kind):
    p = os.path.join(FLOW, year, f"{slug}-{kind}.html.gz")
    if not os.path.exists(p):
        fail(f"cache miss {p} — the {kind} pages are the committed record")
    with gzip.open(p, "rt", encoding="utf-8", errors="replace") as f:
        return f.read()


def clean_booth_name(name):
    return name.strip()


# ------------------------------------------- counted preference flows
def load_flow_counts(slugs):
    """The committed re-count of the NSWEC's ballot papers: {slug:
    {"finals": [flatName, flatName], "rows": {flatName: (to_final1,
    to_final2, exhausted, first_prefs)}}}, the frames' flattened name forms.
    The 2015 counts.csv rides the same columns as 2019's and 2023's
    (verified header-identical)."""
    if not os.path.exists(FLOW_COUNTS):
        fail(f"{FLOW_COUNTS} missing — .build/parse-nsw-state-flows.py is the "
             f"committed re-count of the NSWEC's ballot papers")
    out = collections.defaultdict(lambda: {"finals": None, "rows": {}})
    with open(FLOW_COUNTS, newline="") as f:
        for r in csv.DictReader(f):
            slug = r["district"]
            if slug not in slugs:
                fail(f"counts.csv names a district {slug!r} the frame lacks")
            t1, t2, ex, fpv = (parse_int_cell(r[k]) for k in
                               ("to_final1", "to_final2", "exhausted", "first_prefs"))
            if t1 + t2 + ex != fpv:
                fail(f"counts.csv {slug} {r['candidate']}: {t1}+{t2}+{ex} != fp {fpv}")
            nm = flat_name(r["candidate"])
            finals = (flat_name(r["final1"]), flat_name(r["final2"]))
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
             f"{'…' if len(missing) > 3 else ''} — the {LANG_YEAR} re-count is short")
    return out


# ------------------------------------------------------------------ main
def main():
    os.makedirs(OUT, exist_ok=True)
    global DIST15, DIST_SLUGS
    DIST15 = load_districts()          # slug -> nnn (SG1901 ids, loaned)
    DIST_SLUGS = sorted(DIST15)
    venues = load_venues()
    flows = load_flow_counts(set(DIST_SLUGS))
    demo, seifa = load_demo(), load_seifa()

    # the fp cache folder's slugs and the id map must name one roster
    cache_slugs = set()
    for f in os.listdir(os.path.join(FLOW, LANG_YEAR)):
        mm = re.fullmatch(r"(.+)-fp\.html\.gz", f)
        if mm and mm.group(1) != "lc":
            cache_slugs.add(mm.group(1))
    if cache_slugs != set(DIST_SLUGS):
        fail(f"cache roster drift: cache-only {sorted(cache_slugs - set(DIST_SLUGS))[:3]}, "
             f"ids-only {sorted(set(DIST_SLUGS) - cache_slugs)[:3]}")

    # district roster, in the placemark-id order
    order = sorted(DIST_SLUGS, key=lambda s: int(DIST15[s]))

    D = []
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = tot_inf = tot_enrolled = 0
    tpp_tot = [0, 0]
    B = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                         "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")}
    B["psrc"] = []
    types_seen = collections.Counter()
    geocoded = 0
    matched_n = 0
    eligible_n = 0
    unmatched = []
    decl_rows = 0
    for di, slug in enumerate(order):
        # the district display name rides the fp page's own H1 anchor and
        # must slug back to the cache folder's name
        fpage = read_page(LANG_YEAR, slug, "fp")
        mm = re.search(r"State Electoral District of ([A-Za-z][A-Za-z'’ \-]+)", fpage)
        if not mm:
            fail(f"{LANG_YEAR} {slug}: no State Electoral District anchor")
        disp = mm.group(1).strip()
        if slug_for(LANG_YEAR, disp) != slug:
            fail(f"{LANG_YEAR} {slug}: H1 name {disp!r} slugs to {slug_for(LANG_YEAR, disp)!r}")
        fp = parse_fp(fpage, LANG_YEAR, slug)
        dop = parse_dop(read_page(LANG_YEAR, slug, "dop"), LANG_YEAR, slug, fp)

        # candidates: fp order, names flattened, party onto the frame's codes
        rows = []
        for i, c in enumerate(fp["cands"]):
            _sur, ab0 = fp["keys"][i]
            ab = PARTY_AB.get(ab0)
            if ab is None:
                fail(f"{LANG_YEAR} {slug}: unmapped party code {ab0!r} ({c['pn']!r})")
            rows.append({"n": flat_name(c["nm"]), "ab": ab, "pn": c["pn"],
                         "b": bucket(ab), "v": c["v"], "el": c["nm"] == dop["winner"]})
        if sum(1 for r in rows if r["el"]) != 1:
            fail(f"{LANG_YEAR} {slug}: {sum(1 for r in rows if r['el'])} elected rows")
        rows.sort(key=lambda r: -r["v"])
        w = next(r for r in rows if r["el"])
        seats[w["ab"]] += 1

        # TCP on the dop finals, re-indexed onto the sorted rows
        by_nm = {r["n"]: k for k, r in enumerate(rows)}
        (ta, tb) = sorted(dop["tcp"].items())
        ia, ib = by_nm[flat_name(ta[0])], by_nm[flat_name(tb[0])]
        tcp_pair = [[ia, ta[1]], [ib, tb[1]]]
        pair_buckets = {rows[ia]["b"], rows[ib]["b"]}
        tpp = None
        if pair_buckets == {"alp", "lnp"}:
            alp_i = ia if rows[ia]["b"] == "alp" else ib
            lnp_i = ib if alp_i == ia else ia
            va = ta[1] if alp_i == ia else tb[1]
            vb = tb[1] if alp_i == ia else ta[1]
            tpp = [va, vb, None]
            tpp_tot[0] += va
            tpp_tot[1] += vb

        # counted preference re-count: one [k, toA, toB, exhausted] quadruple
        # per non-finalist, oriented on the tcp pair's own order
        frec = flows[slug]
        f1n, f2n = frec["finals"]
        if {f1n, f2n} != {rows[ia]["n"], rows[ib]["n"]}:
            fail(f"{LANG_YEAR} {slug}: flow finals {frec['finals']} are not the dop tcp pair")
        if set(frec["rows"]) != {r["n"] for r in rows}:
            fail(f"{LANG_YEAR} {slug}: counts.csv candidates do not match the fp roll")
        for slot, fn in ((0, f1n), (1, f2n)):
            t1, t2, ex, fpv = frec["rows"][fn]
            if (t1, t2)[slot] != fpv or (t1, t2)[1 - slot] != 0 or ex != 0:
                fail(f"{LANG_YEAR} {slug}: finalist {fn!r} has stray ballot flow "
                     f"({t1} {t2} {ex} of fp {fpv})")
        swap = f1n != rows[ia]["n"]
        fl = []
        for k, r in enumerate(rows):
            if r["n"] in (f1n, f2n):
                continue
            t1, t2, ex, fpv = frec["rows"][r["n"]]
            if fpv != r["v"]:
                fail(f"{LANG_YEAR} {slug}: counts.csv fp {fpv} != fp-page {r['v']} for {r['n']!r}")
            fl.append([k, t2, t1, ex] if swap else [k, t1, t2, ex])

        # ---- booths
        for bk, v in enumerate(fp["venues"]):
            votes = [0] * len(rows)
            for i, c in enumerate(fp["cands"]):
                votes[by_nm[flat_name(c["nm"])]] = v["votes"][i]
            sec = v["sec"]
            nm = clean_booth_name(v["name"])
            is_decl = sec == "decl"
            is_evc = sec == "evc" or nm.endswith(" EVC") or " EVC " in nm
            # Declared Institution (2019: Declared Facility) — the declared-
            # institution team: a no-premises channel off the venue roll,
            # printed once per district at the Pre-Poll tail; ty 4
            is_df = "Declared Institution" in nm
            # interstate offices ("ACT - Canberra" …) vote off-frame — no
            # NSW placemark (none in the 2015/2019 caches; 2023 only)
            is_is = bool(re.match(r"^(ACT|NT|QLD|SA|TAS|VIC|WA) - ", nm))
            # 2015's "<X> RO Pre-Poll" is the returning-officer row the
            # other vintages print as "<X> EM Office"
            is_office = bool(re.match(r"^(.+) RO Pre[- ][Pp]oll$", nm))
            is_team = is_df or is_is or nm.endswith(" EM Office") or is_office
            ty = 5 if is_evc and not is_team else (4 if is_team else 1)
            # declaration-pile rows (Postal / Absent / Enrolment /
            # iVote / Provisional / Silent) count in the district totals
            # but are no place: skipped from the booth lanes
            if is_decl:
                decl_rows += 1
                continue
            rec = None
            lane = None
            if is_df or is_is:
                pass
            else:
                rec, lane = venue_lookup(venues, slug, nm)
                eligible_n += 1
                if rec is None:
                    unmatched.append((slug, nm))
                else:
                    matched_n += 1
            if rec:
                geocoded += 1
            B["d"].append(di)
            B["id"].append(f"nsw15-{di}-{bk}")
            B["n"].append(nm)
            B["ty"].append(ty)
            B["prem"].append((rec or {}).get("Premises"))
            B["sub"].append((rec or {}).get("Locality"))
            B["pc"].append((rec or {}).get("Postcode"))
            B["lat"].append(round(float(rec["Lat"]), 5) if rec and rec.get("Lat") not in (None, "") else None)
            B["lon"].append(round(float(rec["Lon"]), 5) if rec and rec.get("Lon") not in (None, "") else None)
            B["v"].append(votes)
            B["inf"].append(v["inf"] or 0)
            B["tpp"].append(None)
            B["tcp"].append(None)
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)
            # provenance stamp: [sourceEventYear, matched Uppn, lane]; an
            # unmatched row (or a never-located team row) carries null —
            # the federal 1993-98 frames' source-year disclosure discipline
            B["psrc"].append([2019, rec["Uppn"], lane] if rec else None)
            types_seen[ty] += 1
        recd = {
            "id": di, "n": disp, "st": "NSW",
            "c": [[r["n"], r["ab"], r["pn"], r["b"], r["v"], 0, 1 if r["el"] else 0, 0] for r in rows],
            "inf": fp["inf"],
            "tcp": tcp_pair,
            "fl": fl,
            "h": [],
            "enrolled": fp["enrolled"],
            "demo": demo[disp],
            "seifa": seifa[disp],
        }
        if tpp:
            recd["tpp"] = tpp
        D.append(recd)
        tot_formal += fp["formal"]
        tot_inf += fp["inf"]
        tot_enrolled += fp["enrolled"]
        for r in rows:
            tot_prim[r["b"]] += r["v"]

    if dict(seats) != EXPECTED_SEATS:
        fail(f"seat counts {dict(seats)} != expected {EXPECTED_SEATS}")

    # statewide REF pins, strict sums over the 93 district parses
    if REF_2015_FORMAL is None:
        print(f"UNPINNED REF: formal {tot_formal} informal {tot_inf} "
              f"enrolled {tot_enrolled} (sum over 93 districts)")
    else:
        if tot_formal != REF_2015_FORMAL:
            fail(f"statewide formal {tot_formal} != REF_2015_FORMAL {REF_2015_FORMAL}")
        if tot_inf != REF_2015_INFORMAL:
            fail(f"statewide informal {tot_inf} != REF_2015_INFORMAL {REF_2015_INFORMAL}")
        if tot_enrolled != REF_2015_ENROLLED:
            fail(f"statewide enrolled {tot_enrolled} != REF_2015_ENROLLED {REF_2015_ENROLLED}")

    # venue name-match bookkeeping — pinned counts AND a fraction floor
    frac = matched_n / eligible_n if eligible_n else 0
    print(f"venue match: {matched_n}/{eligible_n} = {100*frac:.2f}%")
    if VENUE_2015_MATCH is None:
        print(f"UNPINNED VENUE MATCH: (matched {matched_n}, eligible {eligible_n})")
    else:
        if (matched_n, eligible_n) != VENUE_2015_MATCH:
            fail(f"venue match (matched {matched_n}, eligible {eligible_n}) "
                 f"drifted from VENUE_2015_MATCH {VENUE_2015_MATCH}")
    if frac < VENUE_MATCH_FRACTION_MIN:
        fail(f"venue match fraction {frac:.4f} below pin floor "
             f"{VENUE_MATCH_FRACTION_MIN} (unmatched {len(unmatched)} of "
             f"{eligible_n} eligible rows)")

    venue_src = {
        "roll": "SG1901",
        "matched": matched_n,
        "eligible": eligible_n,
        "unmatched": [[slug, nm] for slug, nm in unmatched],
        "note": ("No SGE2015 placemark roll exists (the pastvtr venue API is "
                 "dead): each 2015 venue row is NAME-MATCHED to the next "
                 "election's committed SG1901 placemarks, strictly within "
                 "its own district's roll (psrc stamps each matched row's "
                 "2019 source and translation lane: exact or alias name "
                 "equality, or the 2015-only 'RO Pre-Poll'->'EM Office' and "
                 "'Pre-Poll'->'EVC'/bare translation lanes; the EVC lane "
                 "asserts the matched record's locality names the labelled "
                 "town). Same-premises at a plausible-consistent location, "
                 "NOT a proven identical venue: rows that matched no "
                 "plausible 2019 home carry null premises/lat/lon and null "
                 "psrc — renamed or closed venues, hospital report rows the "
                 "roll never carried, and RO offices served from a "
                 "neighbouring district. Vote counts ride the 2015 pages "
                 "regardless. Declared Institution teams and the "
                 "declaration piles (postal/absent/enrolment/iVote/"
                 "provisional-silent) are never geocoded by design."),
    }
    agg = {"prim": {k: tot_prim[k] for k in BUCKETS}, "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": dict(seats)}
    out = {"year": "nsw15", "date": ELECTION, "prev": None, "jurisdiction": "NSW",
           "demoBasis": "sa1", "demoYear": 2011, "flBasis": "counted", "flOpv": True,
           "agg": {"AUS": agg, "NSW": dict(agg)}, "divs": D, "booths": B,
           "venueSrc": venue_src}
    p = os.path.join(OUT, "data-nsw15.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1])
    print("nsw15 districts", len(D), "| seats", dict(seats), "| 2PP-classic ALP", round(tp, 2),
          "| informal", round(100 * tot_inf / (tot_inf + tot_formal), 2), "| enrolled", tot_enrolled,
          "| booths", len(B["id"]), dict(sorted(types_seen.items())), "| geocoded", geocoded,
          "| declaration rows", decl_rows, "| venue-eligible", eligible_n,
          "| venue-matched", matched_n, "| size", os.path.getsize(p))


if __name__ == "__main__":
    main()
