#!/usr/bin/env python3
"""The vic18 frame's past election: the 29 November 2014 Victorian state
election, joined into map/data/data-vic18.json the cell-for-cell way
build_vic22_past.py joined 2018 into the vic22 frame (and build_sa26_past
joined SA 2022 into sa26).

THE HAPPY PART: the 2014 and 2018 elections were BOTH fought on the 2013
redistribution — the same 88 districts, the same names, no renames, no
abolitions, no new districts. The 2022-side renames-adjudication
machinery (RENAMES / NEW_2022 / ABOLISHED_2018, cited from the VEC's
redistribution paper) has NOTHING to do here: this script asserts the
name roster identity loudly instead and dies on any drift.

Sources (read-only, committed — the state preference-flows pipeline's own
mirror; no re-mirror here):
  .build/state-flow-src/vic/2014/<slug>district.html                ×88
      the certified RECHECK-vintage district summary (Prahran, the 2014
      recount district, closes its total-votes parenthetical
      "recounted" — pinned in RECOUNT_DISTRICTS), carrying the
      Elected-member cell, the Electorate-results summary and the
      certified Recheck first-preference roster.
  .build/state-flow-src/vic/2014/tcpbyvotingcentre<slug>district.html ×88
      the Two Candidate Preferred count per voting centre — the
      FINAL-PAIR AUTHORITY in exactly the role build_vic22_past.py gives
      the 2018 pages: the VEC's own two-candidate-preferred count,
      complete for all 88 districts. 2014's tcp pages ALSO carry the
      Recheck-votes summary block (asserted equal to the district
      page's certified figures — the year difference: 2018's lack it).
      Their Total-row implied formal/informal totals drift from
      certified by per-district amounts pinned EXACTLY in
      TCP_SUMMARY_DRIFT (the indicative-count vintage seam;
      -448..+400 2014-wide).
  .build/state-flow-src/vic/2014/distribution<slug>district.html   ×88
      all 88 exist; 43 are EMPTY SHELLS (pinned in DIST_SHELL), 45 are
      real — 9 of which stopped the FINAL count at the quota crossing
      with >2 unreleased candidates (STOP_STATE) and 5 sit on a
      recheck-era formal base drifted from certified (DISTPAGE_DRIFT,
      pinned verbatim). A real two-candidate page's FINAL row is the
      district's certified final; the shells are grammar-asserted.
      THE CERTIFIED-FINAL OVERRIDE: prahran's tcp page runs the
      notional PHARAOH (ALP) v NEWTON-BROWN (LIB) election-night pair
      (18,580-18,555) while the commission's certified distribution
      ran HIBBINS (GRN) over NEWTON-BROWN 18,640-18,363 — the tcp
      page's pair is NOT the seat's final pair and its leader is not
      the member. Prahran's join lanes ride the certified final pinned
      in CERTIFIED; its per-page tcp count is still parsed and
      grammar-asserted. (Exactly vic22's Shepparton / vic18's Benambra
      class.)
  .build/state-flow-src/vic/2014/2ppvote2014.xls — the VEC's official
      2014 2PP workbook (Sheet1 only; Sheet2/Sheet3 published empty,
      asserted): 88 district rows + an unlabeled totals row asserted
      equal to REF_2PP_SUMS (ALP 1,745,194 v Coalition 1,611,715 — the
      officials' 51.99%). Cross-anchor (the build_vic14_data.py rule):
      certified classic final -> workbook row == that final; else the
      tcp page's classic totals -> row == those; else the district is
      in the pinned notional class PP_NOTIONAL (Melbourne/Richmond/
      Northcote/Brunswick ALP-v-GRN, Shepparton LIB-v-IND, Mildura's
      Cupper-era stop-state).
  .build/state-flow-src/vic/2018/2ppvote2018-final.xlsx — the STALE
      APPENDIX: its "MP turnover" / "No of candidates" sheets document
      the 2014 election (the VEC recycled 2014's appendices — found by
      build_vic14_data.py). Their member cells and candidate counts are
      reconciled exactly against this script's own certified 2014
      roster — the third-party triangulation of the winners.

WINNER AUTHORITY: each 2014 page family's own "Elected member" cell
(district / tcp / distribution real-or-shell, asserted identical per
district) == the certified pair's arithmetic leader on all 88 (the tcp
page pair everywhere except prahran's pinned certified final), tallied
into seats and pinned at EXPECTED_SEATS (the VEC's official 2014 count:
ALP 47, LIB 30, NAT 8, GRN 2, IND 1 — Shepparton's Suzanna Sheed).

The 2014 grammar is lifted wholesale from build_vic14_data.py (the vic14
frame's own builder — page regexes, summary/roster/tcp/distribution
parsers, AB party mapping, bucket(), the drift/stop/shell pin tables —
copied here verbatim so this script is self-contained and imports no
sibling builder). Products the join never touches (fpv per-centre
lanes, Prahran's recount workbook, the demsausage geo roll, booth
lanes) are not parsed; the cache's file inventory is still asserted so
a cache drift fails loud.

Joined into the frame (mirroring build_vic22_past.py cell for cell):
  prev            → already wired to 2014 by build_vic18_data.py —
                    asserted, never touched
  agg.{AUS,VIC}   → pprim (2014 first prefs by bucket, frame
                    vocabulary alp/lnp/grn/onp/ind/oth; One Nation stood
                    no Assembly candidates in 2014 — onp is 0 by fact;
                    Country Alliance et al. ride build_vic14_data.py's
                    AB mapping), pformal (2014 Assembly formal total
                    3,355,707, strict-sum checked against REF_FORMAL)
  div.h           → appended [2014, winner's final-pair %, winner ab
                    token, member name] — the certified final pair
                    (tcp-page Total row; prahran rides CERTIFIED)
  div.c[*][5]     → primary points change vs the 2014 district's
                    same-token primary share (tokens summed per
                    district); a candidate whose ab token didn't stand
                    in 2014 gets their whole share (the frame family's
                    new-name convention)
  div.tpp[2]      → swing vs the 2014 final, only where the frame's
                    2018 lane is a classic ALP-v-(LIB|NAT) pair AND the
                    2014 certified final pair is classic too; else null

usage: python3 -I .build/map/build_vic18_past.py <out_dir>   # default: map/data
deps: stdlib + xlrd (2ppvote2014.xls) + openpyxl (the stale appendix)
"""
import collections
import html as H
import json
import os
import re
import sys

import openpyxl
import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, ".build", "state-flow-src", "vic", "2014")
PP_FILE = os.path.join(SRC, "2ppvote2014.xls")
APPENDIX_FILE = os.path.join(REPO, ".build", "state-flow-src", "vic", "2018",
                             "2ppvote2018-final.xlsx")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

N_DISTRICTS = 88
# the VEC's official 2014 tally (see WINNER AUTHORITY): ALP 47, LIB 30,
# NAT 8, GRN 2, IND 1 (Shepparton's independent Suzanna Sheed).
EXPECTED_SEATS = {"ALP": 47, "GRN": 2, "IND": 1, "LIB": 30, "NAT": 8}

# statewide reference totals, sum-derived from the certified district
# pages; asserted exactly. Lifted wholesale from build_vic14_data.py.
REF_ENROLLED = 3806301
REF_FORMAL = 3355707
REF_INFORMAL = 184838
REF_TOTAL = 3540545
REF_CANDIDATES = 545
REF_PRIM = {"alp": 1278436, "lnp": 1409282, "grn": 385240, "onp": 0,
            "ind": 112289, "oth": 170460}

# the official 2ppvote2014 totals row: ALP 51.99% (1745194, 1611715).
REF_2PP_SUMS = (1745194, 1611715, 3356909)
REF_2PP_TOTAL_ROW_LABEL = ""

# the certified distribution final whose tcp page runs a notional pair
# that is NOT the seat's actual final pair (THE CERTIFIED-FINAL
# OVERRIDE): prahran's certified final, asserted against its page.
CERTIFIED = {"prahran": ("Sam Hibbins", 18640, "Clem Newton-Brown", 18363)}

# 2014: all 88 distribution files exist; 43 are empty shells (DIST_SHELL);
# real pages whose FINAL row stopped at the quota crossing with >2
# unreleased candidates (STOP_STATE, 9); pages whose own first-preference
# row / quota sit on a different formal base than the certified recheck
# roster (DISTPAGE_DRIFT, 5; verbatim). Lifted from build_vic14_data.py.
DIST_SHELL = frozenset(
    "altona benambra boxhill brighton broadmeadows bulleen bundoora burwood "
    "caulfield clarinda croydon dandenong evelyn ferntreegully gembrook "
    "gippslandeast gippslandsouth hastings hawthorn kew keysborough kororoit "
    "lara lowan malvern melton millpark mornington mountwaverley murrayplains "
    "narracan nepean ovensvalley polwarth rowville sandringham south-westcoast "
    "stalbans sydenham thomastown warrandyte werribee yuroke".split())
STOP_STATE = frozenset(
    "bayswater bendigowest eildon foresthill mildura pascoevale preston "
    "ringwood tarneit".split())
DISTPAGE_DRIFT = {
    "bayswater": {"formal": -5, "cand": {"DIB, Tony": -3, "VICTORIA, Heidi": -2}},
    "carrum": {"formal": 0, "cand": {"BAUER, Donna": -1, "KILKENNY, Sonya": 1}},
    "narrewarrennorth": {"formal": -2, "cand": {"STAPLEDON, Amanda": -2}},
    "preston": {"formal": -66, "cand": {"GRECO, Gaetano": -5, "WARD, Rachel": -2,
                                          "LJUBICIC, Rose": -29, "SCOTT, Robin": -19,
                                          "FORSTER, John": -11}},
    "tarneit": {"formal": -8, "cand": {"BAGUOT, Lem": -1, "WARING, Rohan": -2,
                                       "LANGUILLER, Telmo": -4, "BAUCH, Joh": -1}},
}

# 2014 tcp-page declaration-row labels: the standard five, with prahran
# the one district whose fpv page (not parsed here) carries the extra
# "All Votes Votes" row while its tcp page does not.
DECL_STD5 = frozenset({"Absent Votes", "Early Votes", "Marked As Voted Votes",
                       "Postal Votes", "Provisional Votes"})
ALL_VOTES_TCP = frozenset(
    "brunswick melbourne mildura northcote richmond shepparton".split())

# districts whose Recheck block closes "recounted" not "rechecked" — the
# recount-era wording pin (Prahran's 2014 recount).
RECOUNT_DISTRICTS = frozenset({"prahran"})

# tcp-page implied totals minus the district page's certified recheck
# figures, per district [formal-drift, informal-drift] — asserted exactly.
TCP_SUMMARY_DRIFT = {
    "albertpark": [83, -120], "altona": [70, -102], "bass": [135, -142],
    "bayswater": [19, -18], "bellarine": [208, -251], "benambra": [68, -67],
    "bendigoeast": [23, -39], "bendigowest": [25, -37], "bentleigh": [60, -82],
    "boxhill": [48, -59], "brighton": [23, -10], "broadmeadows": [-49, -114],
    "brunswick": [127, -131], "bulleen": [32, -31], "bundoora": [37, -38],
    "buninyong": [94, -98], "burwood": [7, -24], "carrum": [23, -36],
    "caulfield": [27, -69], "clarinda": [27, -54], "cranbourne": [55, -87],
    "croydon": [253, -59], "dandenong": [166, -181], "eildon": [93, -103],
    "eltham": [61, -79], "essendon": [59, -117], "euroa": [61, -66],
    "evelyn": [65, -96], "ferntreegully": [5, -12], "footscray": [62, -72],
    "foresthill": [121, -124], "frankston": [400, -425], "geelong": [87, -118],
    "gembrook": [111, -115], "gippslandeast": [153, -153],
    "gippslandsouth": [52, -68], "hastings": [64, -74], "hawthorn": [-91, 0],
    "ivanhoe": [17, -14], "kew": [-22, 17], "keysborough": [84, -109],
    "kororoit": [82, -92], "lara": [17, -24], "lowan": [-4, 0],
    "macedon": [6, -20], "malvern": [14, -17], "melbourne": [2, -77],
    "melton": [193, -201], "mildura": [255, -257], "millpark": [-448, -73],
    "monbulk": [126, -135], "mordialloc": [268, -269], "mornington": [41, -50],
    "morwell": [100, -105], "mountwaverley": [-187, -43], "mulgrave": [33, -54],
    "murrayplains": [61, -70], "narracan": [84, -58],
    "narrewarrennorth": [153, -168], "narrewarrensouth": [-53, -4],
    "nepean": [34, -37], "niddrie": [149, -238], "northcote": [47, -85],
    "oakleigh": [15, -29], "ovensvalley": [38, -53], "pascoevale": [150, -153],
    "polwarth": [23, -29], "prahran": [148, -169], "preston": [75, -27],
    "richmond": [23, -23], "ringwood": [-81, 61], "ripon": [189, -209],
    "rowville": [31, -29], "sandringham": [-30, 16], "shepparton": [79, -105],
    "south-westcoast": [88, -87], "southbarwon": [202, -215],
    "stalbans": [107, -115], "sunbury": [-11, -9], "sydenham": [47, -51],
    "tarneit": [120, -119], "thomastown": [-227, -77], "warrandyte": [47, -61],
    "wendouree": [144, -153], "werribee": [39, -82], "williamstown": [49, -60],
    "yanyean": [147, -140], "yuroke": [33, -61],
}

# the 88 2014 district display names (the h2 grammar), roster-identical
# to 2018 — the 2013-redistribution happy part, asserted loudly twice:
# parsed pages == this pin AND the frame's own roster == the parsed set.
EXPECTED_NAMES = [
    "Albert Park", "Altona", "Bass", "Bayswater", "Bellarine", "Benambra",
    "Bendigo East", "Bendigo West", "Bentleigh", "Box Hill", "Brighton",
    "Broadmeadows", "Brunswick", "Bulleen", "Bundoora", "Buninyong",
    "Burwood", "Carrum", "Caulfield", "Clarinda", "Cranbourne", "Croydon",
    "Dandenong", "Eildon", "Eltham", "Essendon", "Euroa", "Evelyn",
    "Ferntree Gully", "Footscray", "Forest Hill", "Frankston", "Geelong",
    "Gembrook", "Gippsland East", "Gippsland South", "Hastings", "Hawthorn",
    "Ivanhoe", "Kew", "Keysborough", "Kororoit", "Lara", "Lowan", "Macedon",
    "Malvern", "Melbourne", "Melton", "Mildura", "Mill Park", "Monbulk",
    "Mordialloc", "Mornington", "Morwell", "Mount Waverley", "Mulgrave",
    "Murray Plains", "Narracan", "Narre Warren North", "Narre Warren South",
    "Nepean", "Niddrie", "Northcote", "Oakleigh", "Ovens Valley",
    "Pascoe Vale", "Polwarth", "Prahran", "Preston", "Richmond", "Ringwood",
    "Ripon", "Rowville", "Sandringham", "Shepparton", "South Barwon",
    "South-West Coast", "St Albans", "Sunbury", "Sydenham", "Tarneit",
    "Thomastown", "Warrandyte", "Wendouree", "Werribee", "Williamstown",
    "Yan Yean", "Yuroke"]

# the eight LC-region fpv products in the cache: whitelisted extras in
# the inventory assertion, never parsed here (the join rides district
# rollups).
FPV_EXTRA = frozenset(
    "easternmetropolitanregion easternvictoriaregion northernmetropolitanregion "
    "northernvictoriaregion south-easternmetropolitanregion southernmetropolitanregion "
    "westernmetropolitanregion westernvictoriaregion".split())
PRAHRAN_XLS = "fpvbyvotingcentreprahrandistrict.xls"

# districts whose workbook row is a notional figure the certified
# products can't reproduce: certified-non-classic-AND-page-non-classic
# (ALP-v-GRN inner seats + Shepparton LIB-v-IND; Mildura's Cupper-era
# stop-state). Prahran reconciles against its indicative tcp totals.
PP_NOTIONAL = frozenset({"Brunswick", "Melbourne", "Mildura", "Northcote",
                         "Richmond", "Shepparton"})

COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]

# the 2014 VEC party strings onto canon ids, lifted verbatim from
# build_vic14_data.py (Country Alliance rides "ACA" -> oth; a party with
# no 2018-frame standing simply never matches a swing token and feeds
# only the state aggregates).
AB = {
    "AUSTRALIAN LABOR PARTY": "ALP",
    "LIBERAL": "LIB",
    "THE NATIONALS": "NAT",
    "AUSTRALIAN GREENS": "GRN",
    "ANIMAL JUSTICE PARTY": "AJP",
    "FAMILY FIRST": "FFP",
    "DEMOCRATIC LABOUR PARTY (DLP)": "DLP",
    "SHOOTERS AND FISHERS PARTY VICTORIA": "SFF",
    "SEX PARTY": "SXP",
    "AUSTRALIAN COUNTRY ALLIANCE": "ACA",
    "AUSTRALIAN CHRISTIANS": "AC",
    "RISE UP AUSTRALIA PARTY": "RUA",
    "VOICE FOR THE WEST": "VFTW",
    "SOCIALIST ALLIANCE": "SAL",
    "PEOPLE POWER VICTORIA/NO SMART METERS": "PPV",
    "THE BASICS ROCK 'N' ROLL PARTY": "BRAP",
    "": "IND",
}


def fail(msg):
    raise SystemExit(f"vic18-past: {msg}")


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP":
        return "alp"
    if ab in COALITION:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "ONP"):
        return "onp"
    if ab in ("IND", ""):
        return "ind"
    return "oth"


def r2(v):
    return round(v + 1e-9, 2)


def fix_word(w):
    if w.isupper() and len(w) > 1:
        t = w.capitalize()
        for pre in ("Mc", "O'", "D'"):
            if t.startswith(pre) and len(t) > len(pre):
                t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
        return t
    # the VEC record prints a few nominated names "McLEISH"/"MacPHERSON"
    # (the surname's own capital kept, the tail still in caps); those
    # aren't .isupper(), so normalise the caps tail here
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
    """VEC cells run "SURNAME, Given"; the map's files ride "Given SURNAME"."""
    n = (n or "").strip()
    if "," in n:
        sur, giv = n.split(",", 1)
        return title_name(giv.strip(), sur.strip())
    return title_name("", n)


def clean(cell):
    return H.unescape(re.sub(r"\s+", " ", cell)).strip()


def num(s, ctx):
    t = clean(s).replace(",", "")
    if not re.fullmatch(r"\d+", t):
        fail(f"{ctx}: not a whole number {s!r}")
    return int(t)


def read(path):
    if not os.path.exists(path):
        fail(f"missing cached page {path}")
    return open(path, encoding="utf-8").read()


# ------------------------------------------------------------ the district page
def parse_summary(page, ctx):
    m = re.search(r"<th>\s*Total Enrolment\s*<br\s*/?>\s*as at close of rolls:\s*</th>\s*<td>([\d,]+)", page)
    if not m:
        fail(f"{ctx}: no enrolment summary")
    enrolled = num(m.group(1), ctx)
    m = re.search(r"<th>\s*Formal Votes:\s*</th>\s*<td>([\d,]+)", page)
    if not m:
        fail(f"{ctx}: no formal summary")
    formal = num(m.group(1), ctx)
    m = re.search(r"<th>\s*Informal Votes:\s*</th>\s*<td>([\d,]+) \(([\d.]+)% of the total votes\)", page)
    if not m:
        fail(f"{ctx}: no informal summary")
    informal, pc = num(m.group(1), ctx), float(m.group(2))
    m = re.search(r"<th>\s*Total Votes:\s*</th>\s*<td>([\d,]+) \(([\d.]+)% of the total enrolment as at the close of rolls (rechecked|recounted)\)", page)
    if not m:
        fail(f"{ctx}: no total summary")
    total, pco = num(m.group(1), ctx), float(m.group(2))
    recount = m.group(3) == "recounted"
    if formal + informal != total:
        fail(f"{ctx}: formal+informal != total")
    if abs(100 * informal / total - pc) > 0.0051:
        fail(f"{ctx}: printed informal% {pc} vs computed")
    if abs(100 * total / enrolled - pco) > 0.0051:
        fail(f"{ctx}: printed turnout% {pco} vs computed")
    return {"enrolled": enrolled, "formal": formal,
            "informal": informal, "total": total, "_recount": recount}


def parse_elected(page, ctx):
    m = re.search(r'class="bold-text">([^<]+)</span><br><span[^>]*>([^<]*)</span>', page)
    if not m:
        fail(f"{ctx}: no elected-member cell")
    return flat_name(clean(m.group(1))), clean(m.group(2))


def parse_h2(page, ctx):
    m = re.search(r"<h2>([\s\S]{1,80}?) District(?:<br>|</h2>)", page)
    if not m:
        fail(f"{ctx}: no district h2")
    return clean(m.group(1))


def parse_roster(page, name, formal):
    """The district page's Recheck first-preference table: the certified
    candidate roster, asserted to sum to Formal Votes exactly."""
    ctx = f"{name} district page"
    m = re.search(r'<table[^>]*title="First preference votes"[\s\S]*?</thead>\s*<tbody>([\s\S]*?)</tbody>', page)
    if not m:
        fail(f"{ctx}: no first-preference table")
    rows = re.findall(r"<tr>\s*<td>([\s\S]*?)</td>\s*<td>([\s\S]*?)</td>\s*<td>([\s\S]*?)</td>\s*<td>([\s\S]*?)</td>\s*</tr>", m.group(1))
    roster = []
    seen = set()
    for raw_n, raw_p, raw_v, raw_pc in rows:
        party = clean(raw_p)
        if party not in AB:
            fail(f"{ctx}: unmapped 2014 party string {party!r} — extend AB (never a silent other)")
        nm_raw = clean(raw_n)
        if nm_raw in seen:
            fail(f"{ctx}: duplicate candidate {nm_raw!r}")
        seen.add(nm_raw)
        v = num(raw_v, ctx)
        pc_txt = clean(raw_pc)
        pc = float(pc_txt[pc_txt.index(">") + 1:].strip().rstrip("%"))
        roster.append({"raw": nm_raw, "party": party, "votes": v, "pc_print": pc})
    if not roster:
        fail(f"{ctx}: first-pref table parses to no rows")
    if sum(r["votes"] for r in roster) != formal:
        fail(f"{ctx}: first prefs sum {sum(r['votes'] for r in roster)} != Formal Votes {formal}")
    for r in roster:
        if abs(100 * r["votes"] / formal - r["pc_print"]) > 0.0051:
            fail(f"{ctx}: {r['raw']!r} printed % {r['pc_print']} vs computed")
    if len({flat_name(r["raw"]) for r in roster}) != len(roster):
        fail(f"{ctx}: candidate names collide after flattening")
    return roster


# --------------------------------------------------------------------- tcp
def parse_tcp(page, name, roster, implied, summary, slug):
    """The Two Candidate Preferred count per voting centre — the
    FINAL-PAIR AUTHORITY of this join. 2014's tcp pages carry the
    Recheck-votes summary block, asserted equal to the district page's
    certified summary."""
    ctx = f"{name} tcp page"
    by_flat = {flat_name(r["raw"]) for r in roster}
    pair_raw = [clean(x) for x in re.findall(r'id="candidate[12]">([^<]+)</th>', page)]
    if len(pair_raw) != 2:
        fail(f"{ctx}: {len(pair_raw)} pair candidates")
    pair = [flat_name(pair_raw[0]), flat_name(pair_raw[1])]
    if pair[0] == pair[1]:
        fail(f"{ctx}: pair cells collide {pair_raw!r}")
    for p in pair:
        if p not in by_flat:
            fail(f"{ctx}: pair member {p!r} ({pair_raw!r}) not on the certified roster")
    sm_t = parse_summary(page, f"{name} tcp page")
    if sm_t != summary:
        fail(f"{ctx}: tcp summary block {sm_t} != district page's certified {summary}")
    m = re.search(r'<table[^>]*title="Two candidate preferred results by voting centre"[\s\S]*?</thead>\s*<tbody>([\s\S]*?)</tbody>', page)
    if not m:
        fail(f"{ctx}: no tcp table")
    venues, decl = [], {}
    ordinary = total_row = pct_row = None
    for tr in re.finditer(r"<tr>\s*<th[^>]*>([\s\S]*?)</th>((?:\s*<td>[^<]*</td>)+)\s*</tr>", m.group(1)):
        lab = clean(tr.group(1))
        vals = [clean(x) for x in re.findall(r"<td>([^<]*)</td>", tr.group(2))]
        if lab == "Percentage of formal vote polled by candidate":
            pct_row = vals
            continue
        if len(vals) != 5:
            fail(f"{ctx}: row {lab!r} not the five-column form")
        if lab == "All Votes Votes":
            cells = [num(x, ctx) if x else 0 for x in vals]
            if cells[-1] != 0:
                fail(f"{ctx}: All Votes row totals {cells[-1]} (zero-totalling grammar broken)")
        else:
            cells = [num(x, ctx) for x in vals]
        if sum(cells[:-1]) != cells[-1]:
            fail(f"{ctx}: row {lab!r} sums != polled")
        if lab == "Ordinary Votes Total":
            ordinary = cells
            continue
        if lab == "Total":
            if total_row is not None:
                fail(f"{ctx}: two Total rows")
            total_row = cells
            continue
        if lab.endswith(" Votes"):
            if lab in decl:
                fail(f"{ctx}: declaration row {lab!r} twice")
            decl[lab] = cells
        else:
            venues.append({"n": lab, "cells": cells})
    if ordinary is None or total_row is None or pct_row is None:
        fail(f"{ctx}: missing subtotal/total/pct row")
    want_decl = DECL_STD5 | ({"All Votes Votes"} if slug in ALL_VOTES_TCP else set())
    if set(decl) != want_decl:
        fail(f"{ctx}: declaration rows {sorted(decl)} != pinned {sorted(want_decl)}")
    if not venues:
        fail(f"{ctx}: no venues")
    for i in range(5):
        if sum(v["cells"][i] for v in venues) != ordinary[i]:
            fail(f"{ctx}: Ordinary col {i} != venue sums")
        if ordinary[i] + sum(d[i] for d in decl.values()) != total_row[i]:
            fail(f"{ctx}: Total col {i} != ordinary + declarations")
    if len({v["n"] for v in venues}) != len(venues):
        fail(f"{ctx}: venue labels collide")
    for i in range(2):
        pv = pct_row[i].replace("%", "").strip()
        if not pv:
            fail(f"{ctx}: pct row cell {i} blank")
        mine = 100 * total_row[i] / (total_row[0] + total_row[1])
        if abs(mine - float(pv)) > 0.0051:
            fail(f"{ctx}: printed pair pct {pv} vs computed {mine:.4f}")
    if total_row[0] + total_row[1] + total_row[2] != implied[0] \
            or total_row[3] != implied[1]:
        fail(f"{ctx}: tcp Total implies formal {total_row[0] + total_row[1] + total_row[2]} "
             f"informal {total_row[3]}, pinned {implied}")
    return {"pair": pair, "cells_total": total_row}


# ------------------------------------------------------------- distribution
def assert_shell(page, name, summary, elected_pair):
    """2014's empty distribution page: quota cell blank, the distribution
    table's tbody empty, no FINAL TOTAL and no elected-member footer. The
    Recheck summary and the Elected-member cell are still asserted equal
    to the district page's."""
    ctx = f"{name} distribution shell"
    if "FINAL TOTAL" in page:
        fail(f"{ctx}: FINAL TOTAL present on a pinned shell")
    m = re.search(r'title="Quota"[\s\S]*?<td>\s*</td>', page)
    if not m:
        fail(f"{ctx}: shell without the blank quota cell")
    q = re.search(r'<table[^>]*title="Distribution of preference votes"[\s\S]*?<tbody>\s*</tbody>', page)
    if not q:
        fail(f"{ctx}: shell table tbody not empty or table missing")
    if parse_summary(page, ctx) != summary:
        fail(f"{ctx}: shell summary != district page's")
    if parse_elected(page, ctx) != elected_pair:
        fail(f"{ctx}: shell elected cell != district page's")


def parse_distpage(page, name, roster, summary, drift):
    """A 2014 REAL distribution page. Internally consistent on its own
    base (see DISTPAGE_DRIFT for the five whose base sits off certified
    by a recheck-era nudge). Returns the FINAL TOTAL row's remaining
    candidates (>=2)."""
    ctx = f"{name} distribution page"
    dformal = summary["formal"] + drift["formal"]
    m = re.search(r'title="Quota"[\s\S]*?<td>\s*([\d,]+)\s*</td>', page)
    if not m:
        fail(f"{ctx}: no quota cell (blank quotas only appear on shells)")
    quota = int(m.group(1).replace(",", ""))
    if quota != dformal // 2 + 1:
        fail(f"{ctx}: quota {quota} != page formal/2+1 ({dformal})")
    mt = re.search(r'<table[^>]*title="Distribution of preference votes"[\s\S]*?</table>', page)
    if not mt:
        fail(f"{ctx}: no distribution table")
    table = mt.group(0)
    head = [clean(x) for x in re.findall(r'<th[^>]*scope="col">([\s\S]*?)</th>', table)]
    if not head or head[0] != "" or head[-1] != "TOTAL":
        fail(f"{ctx}: distribution table header drift")
    names = head[1:-1]
    if names != [r["raw"] for r in roster]:
        fail(f"{ctx}: candidate order != certified roster order")
    fp_row = final_row = None
    for tr in re.findall(r"<tr>\s*<td>([\s\S]*?)</td>((?:\s*<td[^>]*>[\s\S]*?</td>)+)\s*</tr>", table):
        lab = clean(tr[0])
        vals = [clean(x) for x in re.findall(r"<td[^>]*>([\s\S]*?)</td>", tr[1])]
        if len(vals) != len(names) + 1:
            fail(f"{ctx}: row {lab!r} not the candidate+TOTAL column form")
        cells = [num(v, ctx) if v else 0 for v in vals[:-1]]
        tot = num(vals[-1], ctx)
        if lab.startswith("Total first preference votes recorded"):
            if tot != dformal:
                fail(f"{ctx}: fp TOTAL {tot} != page formal {dformal}")
            for i, r in enumerate(roster):
                have = r["votes"] + (drift["cand"].get(r["raw"], 0))
                if cells[i] != have:
                    fail(f"{ctx}: fp cell {r['raw']!r} {cells[i]} != certified+pin {have}")
            fp_row = cells
        elif lab == "FINAL TOTAL":
            if final_row is not None:
                fail(f"{ctx}: two FINAL TOTAL rows")
            final_row = (cells, tot)
        elif lab.startswith("Transfer of "):
            m2 = re.fullmatch(r"Transfer of (\d[\d,]*) ballot papers of .*", lab)
            if not m2:
                fail(f"{ctx}: transfer caption drift {lab!r}")
            if int(m2.group(1).replace(",", "")) != tot:
                fail(f"{ctx}: transfer TOTAL != caption count ({lab!r})")
            if sum(cells) != tot:
                fail(f"{ctx}: transfer cells sum != TOTAL ({lab!r})")
        elif lab == "Progressive Total":
            if tot != dformal:
                fail(f"{ctx}: progressive TOTAL != page formal")
        else:
            fail(f"{ctx}: unexpected row {lab!r}")
    if fp_row is None or final_row is None:
        fail(f"{ctx}: missing fp/FINAL row")
    finals = [(names[i], v) for i, v in enumerate(final_row[0]) if v]
    if not finals:
        fail(f"{ctx}: empty FINAL TOTAL")
    if final_row[1] != dformal:
        fail(f"{ctx}: FINAL TOTAL {final_row[1]} != page formal")
    if len(finals) == 2 and sum(v for _, v in finals) != dformal:
        fail(f"{ctx}: final pair spare votes")
    if sum(v for _, v in finals) > dformal:
        fail(f"{ctx}: final row over-runs page formal")
    lead = max(finals, key=lambda t: t[1])
    if lead[1] < quota:
        fail(f"{ctx}: final leader {lead} under quota")
    return {"finals": finals}


def parse_certified(page, name, pinned, summary, roster, drift):
    rec = parse_distpage(page, name, roster, summary, drift)
    finals = rec["finals"]
    if len(finals) != 2:
        fail(f"{name}: certified-final page no longer a two-candidate count")
    lead = max(finals, key=lambda t: t[1])
    runner = min(finals, key=lambda t: t[1])
    got = (flat_name(lead[0]), lead[1], flat_name(runner[0]), runner[1])
    if got != pinned:
        fail(f"{name}: certified final {got} != pinned {pinned}")
    return got


# ----------------------------------------------------------------- workbooks
def load_2ppvote():
    """2ppvote2014.xls: Sheet1 carries the 88 district rows and an
    unlabeled totals row; Sheet2/Sheet3 published empty (asserted)."""
    wb = xlrd.open_workbook(PP_FILE)
    if wb.sheet_names() != ["Sheet1", "Sheet2", "Sheet3"]:
        fail(f"2ppvote2014 sheets {wb.sheet_names()}")
    s = wb.sheet_by_index(0)
    hdr = [s.cell_value(0, c) for c in range(6)]
    if hdr != ["District", "Labor votes", "Labor %", "Liberal/National votes",
               "Liberal/National %", "Total votes"]:
        fail(f"2ppvote2014 header drift {hdr!r}")
    out = {}
    tot_row = None
    for r in range(1, s.nrows):
        lab, alp, _pc, lnp, _pc2, tot = (s.cell_value(r, c) for c in range(6))
        if lab == "":
            if tot_row is not None:
                fail("2ppvote2014: two unlabeled totals rows")
            tot_row = (alp, lnp, tot, lab)
            continue
        if lab in out:
            fail(f"2ppvote2014: {lab!r} listed twice")
        if not all(float(x).is_integer() for x in (alp, lnp)):
            fail(f"2ppvote2014: row for {lab!r} not the integer pair form")
        if abs(alp / (alp + lnp) - _pc) > 0.0051 / 100:
            fail(f"2ppvote2014: printed % cell drift at {lab!r}")
        if alp + lnp != tot:
            fail(f"2ppvote2014: row {lab} total {tot} != alp+lnp {alp + lnp}")
        out[lab] = (int(alp), int(lnp))
    if len(out) != N_DISTRICTS:
        fail(f"2ppvote2014: {len(out)} district rows != {N_DISTRICTS}")
    if tot_row is None or tot_row[3] != REF_2PP_TOTAL_ROW_LABEL:
        fail(f"2ppvote2014: totals row label drift {tot_row!r}")
    if (int(tot_row[0]), int(tot_row[1]), int(tot_row[2])) != REF_2PP_SUMS:
        fail(f"2ppvote2014: totals row != pinned {REF_2PP_SUMS}")
    if (sum(v[0] for v in out.values()), sum(v[1] for v in out.values()),
        sum(v[0] + v[1] for v in out.values())) != REF_2PP_SUMS:
        fail(f"2ppvote2014: row sums != totals row")
    for i in (1, 2):
        if wb.sheet_by_index(i).nrows:
            fail(f"2ppvote2014: Sheet{i + 1} no longer empty")
    return out


def load_appendix():
    """The stale 2014-era appendices inside the 2018 workbooks: member and
    candidate counts to triangulate 2014's own certified roster."""
    wb = openpyxl.load_workbook(APPENDIX_FILE, read_only=True)
    if wb.sheetnames != ["2PP", "MP turnover", "No of candidates"]:
        fail(f"appendix sheet drift {wb.sheetnames}")
    members, ncands = {}, {}
    for r in wb["MP turnover"].iter_rows(values_only=True):
        if r[0] in ("Abolished districts", "Regions"):
            break
        if isinstance(r[0], str) and r[0] != "District":
            members[r[0]] = r[1]
    if len(members) != 88:
        fail(f"appendix MP turnover: {len(members)} rows != 88")
    for r in wb["No of candidates"].iter_rows(values_only=True):
        if r[0] in ("Abolished districts", "Regions"):
            break
        if isinstance(r[0], str) and r[0] != "District":
            ncands[r[0]] = r[1]
    if len(ncands) != 88 or any(not isinstance(v, int) for v in ncands.values()):
        fail(f"appendix candidate counts: {len(ncands)} rows != 88")
    wb.close()
    return {"members": members, "ncands": ncands}


# ------------------------------------------------------------------ the 2014s
def build_2014():
    # cache inventory, asserted exactly (district rollups only are parsed;
    # the fpv per-centre pages and Prahran's recount workbook are
    # inventory-asserted, never parsed — the join rides rollups)
    ls = os.listdir(SRC)
    dists = sorted(f[:-len("district.html")] for f in ls
                   if f.endswith("district.html")
                   and not f.startswith("distribution")
                   and not f.startswith("fpvbyvotingcentre")
                   and not f.startswith("tcpbyvotingcentre"))
    if len(dists) != N_DISTRICTS:
        fail(f"{len(dists)} district pages in {SRC}, expected {N_DISTRICTS}")
    if PRAHRAN_XLS not in ls:
        fail(f"prahran recount-era workbook {PRAHRAN_XLS} vanished from the cache")
    fpv = {f[len("fpvbyvotingcentre"):-len(".html")] for f in ls
           if f.startswith("fpvbyvotingcentre") and f.endswith(".html")}
    tcp = {f[len("tcpbyvotingcentre"):-len(".html")] for f in ls
           if f.startswith("tcpbyvotingcentre") and f.endswith(".html")}
    dist_p = {f[len("distribution"):-len(".html")] for f in ls
              if f.startswith("distribution")}
    if tcp != {s + "district" for s in dists}:
        fail(f"tcp inventory drift: {sorted(tcp ^ {s + 'district' for s in dists})[:8]}")
    if fpv != {s + "district" for s in dists} | FPV_EXTRA:
        fail(f"fpv inventory drift: {sorted(fpv ^ ({s + 'district' for s in dists} | FPV_EXTRA))[:8]}")
    real_or_shell = {s[:-len("district")] for s in dist_p if s.endswith("district")}
    if real_or_shell != set(dists):
        fail(f"distribution inventory drift: {sorted(real_or_shell ^ set(dists))[:8]}")

    pp = load_2ppvote()
    appendix = load_appendix()

    names_by_slug = {}
    for slug in dists:
        nm = parse_h2(read(os.path.join(SRC, f"{slug}district.html")),
                      f"{slug} district page")
        if nm in names_by_slug.values():
            fail(f"district display name {nm!r} appears twice")
        names_by_slug[slug] = nm
    if set(names_by_slug.values()) != set(EXPECTED_NAMES):
        got = set(names_by_slug.values())
        fail(f"2014 district display names drifted from the pinned roster: "
             f"extra {sorted(got - set(EXPECTED_NAMES))[:4]} "
             f"missing {sorted(set(EXPECTED_NAMES) - got)[:4]} — the 2013 "
             f"redistribution's 88-district roster is load-bearing here")

    D = {}
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = tot_inf = tot_enrolled = tot_cands = 0
    recount_seen = set()
    elected_of, ncand_of = {}, {}
    finals_of, pagepp_of, party_of_raw = {}, {}, {}

    for slug in dists:
        name = names_by_slug[slug]
        h_main = read(os.path.join(SRC, f"{slug}district.html"))
        sm = parse_summary(h_main, name)
        if sm["_recount"]:
            recount_seen.add(slug)
        elected_name, elected_party = parse_elected(h_main, name)
        if elected_party not in AB:
            fail(f"{name}: unmapped elected-party string {elected_party!r}")
        elected_ab = AB[elected_party]
        roster = parse_roster(h_main, name, sm["formal"])
        party_of_raw[name] = {r["raw"]: r["party"] for r in roster}
        ab_of_raw = {r["raw"]: AB[r["party"]] for r in roster}
        ab_of_flat = {flat_name(r["raw"]): ab_of_raw[r["raw"]] for r in roster}
        if elected_name not in ab_of_flat:
            fail(f"{name}: elected member {elected_name!r} not on the certified roster")
        if ab_of_flat[elected_name] != elected_ab:
            fail(f"{name}: elected member's party cell {elected_party!r} != certified roster")
        seats[elected_ab] += 1

        # ---- tcp page: the FINAL-PAIR AUTHORITY (parsed end-to-end)
        h_tcp = read(os.path.join(SRC, f"tcpbyvotingcentre{slug}district.html"))
        if parse_h2(h_tcp, f"{name} tcp page") != name:
            fail(f"{name}: tcp h2 drift")
        if parse_elected(h_tcp, f"{name} tcp page") != (elected_name, elected_party):
            fail(f"{name}: tcp elected cell != district page's")
        want = TCP_SUMMARY_DRIFT.get(slug)
        if want is None:
            fail(f"{slug}: no TCP_SUMMARY_DRIFT pin")
        implied = (sm["formal"] + want[0], sm["informal"] + want[1])
        tcp_rec = parse_tcp(h_tcp, name, roster, implied, sm, slug)
        pair = tcp_rec["pair"]
        pair_votes = (tcp_rec["cells_total"][0], tcp_rec["cells_total"][1])

        # ---- certified distribution page (shell or real)
        finals = None
        h_dist = read(os.path.join(SRC, f"distribution{slug}district.html"))
        if slug in DIST_SHELL:
            assert_shell(h_dist, name, sm, (elected_name, elected_party))
        else:
            if parse_h2(h_dist, f"{name} distribution page") != name:
                fail(f"{name}: distribution page h2 drift")
            if parse_elected(h_dist, f"{name} distribution page") != (elected_name, elected_party):
                fail(f"{name}: distribution page elected cell != district page's")
            if parse_summary(h_dist, f"{name} distribution page") != sm:
                fail(f"{name}: distribution page summary != district page's")
            drift = DISTPAGE_DRIFT.get(slug, {"formal": 0, "cand": {}})
            finals_all = parse_distpage(h_dist, name, roster, sm, drift)["finals"]
            w_final = flat_name(max(finals_all, key=lambda t: t[1])[0])
            if w_final != elected_name:
                fail(f"{name}: certified final leader {w_final!r} != elected member {elected_name!r}")
            if len(finals_all) > 2:
                if slug not in STOP_STATE:
                    fail(f"{name}: unpinned stop-state final of {len(finals_all)} candidates")
            else:
                if slug in STOP_STATE:
                    fail(f"{name}: pinned stop-state district now a two-candidate final")
                finals = finals_all
        finals_of[name] = finals

        # ---------------- the certified final pair (override where pinned)
        lane_pair = pair
        lane_votes = pair_votes
        if slug in CERTIFIED:
            drift = DISTPAGE_DRIFT.get(slug, {"formal": 0, "cand": {}})
            w, wv, ru, ruv = parse_certified(h_dist, name, CERTIFIED[slug], sm, roster, drift)
            lane_pair, lane_votes = [w, ru], (wv, ruv)

        # WINNER AUTHORITY: the Elected-member cell == the certified
        # pair's arithmetic leader on all 88
        lead_flat = lane_pair[0] if lane_votes[0] >= lane_votes[1] else lane_pair[1]
        if lead_flat != elected_name:
            fail(f"{name}: certified-pair leader {lead_flat!r} != elected member {elected_name!r}")
        winner_ab = ab_of_flat[lead_flat]
        if winner_ab != elected_ab:
            fail(f"{name}: certified leader's ballot party {winner_ab} != elected cell {elected_ab}")
        pct = r2(100 * max(lane_votes) / (lane_votes[0] + lane_votes[1]))

        # the certified final pair's 2PP base, classic ALP-v-(LIB|NAT) only
        lane_buckets = {bucket(ab_of_flat[p]) for p in lane_pair}
        tpp14 = None
        if lane_buckets == {"alp", "lnp"} and "ALP" in {ab_of_flat[p] for p in lane_pair}:
            va = lane_votes[0] if ab_of_flat[lane_pair[0]] == "ALP" else lane_votes[1]
            tpp14 = (va, lane_votes[0] + lane_votes[1] - va)
        # the tcp PAGE's own classic map (pre-override) for the official
        # 2PP workbook reconciliation
        page_buckets = {bucket(ab_of_flat[p]) for p in pair}
        page_map = None
        if page_buckets == {"alp", "lnp"} and "ALP" in {ab_of_flat[p] for p in pair}:
            pa = pair_votes[0] if ab_of_flat[pair[0]] == "ALP" else pair_votes[1]
            page_map = (pa, pair_votes[0] + pair_votes[1] - pa)
        pagepp_of[name] = page_map

        prev_by_ab = {}
        for r in roster:
            prev_by_ab[ab_of_raw[r["raw"]]] = prev_by_ab.get(ab_of_raw[r["raw"]], 0) + r["votes"]

        D[name] = {"roster": roster, "formal": sm["formal"],
                   "winner": {"n": elected_name, "ab": winner_ab, "pct": pct},
                   "tpp": list(tpp14) if tpp14 else None,
                   "prev_by_ab": prev_by_ab}
        elected_of[name] = elected_name
        ncand_of[name] = len(roster)
        tot_formal += sm["formal"]
        tot_inf += sm["informal"]
        tot_enrolled += sm["enrolled"]
        tot_cands += len(roster)
        for r in roster:
            tot_prim[bucket(AB[r["party"]])] += r["votes"]

    # ---------------- statewide pins
    if recount_seen != RECOUNT_DISTRICTS:
        fail(f"recounted-wording districts {sorted(recount_seen)} != pinned {sorted(RECOUNT_DISTRICTS)}")
    got_seats = dict(sorted(seats.items()))
    if got_seats != EXPECTED_SEATS:
        fail(f"2014 seats {got_seats} != expected {EXPECTED_SEATS} (the VEC's own tally)")
    if (tot_enrolled, tot_formal, tot_inf, tot_formal + tot_inf) != \
            (REF_ENROLLED, REF_FORMAL, REF_INFORMAL, REF_TOTAL):
        fail(f"statewide totals != REF ({REF_ENROLLED}, {REF_FORMAL}, {REF_INFORMAL}, {REF_TOTAL})")
    if tot_cands != REF_CANDIDATES:
        fail(f"candidate count {tot_cands} != REF {REF_CANDIDATES}")
    prim = {b: tot_prim[b] for b in BUCKETS}
    if prim != REF_PRIM:
        fail(f"statewide primaries {prim} != REF_PRIM {REF_PRIM}")
    if sum(prim.values()) != REF_FORMAL:
        fail(f"pprim strict sum {sum(prim.values())} != pformal {REF_FORMAL}")

    # the stale-appendix triangulation of the 2014 certified roster
    if elected_of != appendix["members"]:
        diff = sorted(n for n in elected_of if appendix["members"].get(n) != elected_of[n])
        fail(f"appendix member set drifts at {diff[:6]}")
    if ncand_of != appendix["ncands"]:
        diff = sorted(n for n in ncand_of if appendix["ncands"].get(n) != ncand_of[n])
        fail(f"appendix candidate counts drift at {diff[:6]}")

    # 2ppvote reconciliation (the source-block rule):
    # 1. certified classic final present -> row == that final;
    # 2. else the tcp page's pair is classic -> row == the page's totals;
    # 3. else -> pinned notional class
    skipped = []
    for name in sorted(D):
        want = pp.get(name)
        if want is None:
            fail(f"{name}: missing from the official 2pp workbook")
        finals = finals_of[name]
        fbuckets = None
        if finals is not None:
            fbuckets = {"alp" if party_of_raw[name][n] == "AUSTRALIAN LABOR PARTY"
                        else ("lnp" if party_of_raw[name][n] in ("LIBERAL", "THE NATIONALS")
                              else "oth") for n, _ in finals}
        if fbuckets == {"alp", "lnp"}:
            alp_f = sum(v for n, v in finals
                        if party_of_raw[name][n] == "AUSTRALIAN LABOR PARTY")
            lnp_f = sum(v for n, v in finals
                        if party_of_raw[name][n] != "AUSTRALIAN LABOR PARTY")
            if (alp_f, lnp_f) != want:
                fail(f"{name}: certified final {(alp_f, lnp_f)} != official 2pp row {want}")
        elif pagepp_of[name] is not None:
            if pagepp_of[name] != want:
                fail(f"{name}: tcp page totals {pagepp_of[name]} != official 2pp row {want}")
        else:
            skipped.append(name)
    if set(skipped) != PP_NOTIONAL:
        fail(f"2ppvote notional-class set {sorted(skipped)} != pinned {sorted(PP_NOTIONAL)}")

    print(f"2014: {len(D)} districts, {tot_formal} formal "
          f"(+{tot_inf} informal, {tot_enrolled} enrolled, {tot_cands} candidates), "
          f"seats {got_seats}; official 2PP ALP "
          f"{100 * REF_2PP_SUMS[0] / REF_2PP_SUMS[2]:.2f}")
    return {"dists": D, "prim": prim, "formal": REF_FORMAL}


# ------------------------------------------------------------------- the join
def main():
    p14 = build_2014()

    data_path = os.path.join(OUT, "data-vic18.json")
    if not os.path.exists(data_path):
        fail(f"frame {data_path} missing — run build_vic18_data.py first")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != "vic18":
        fail(f"{data_path} is not the vic18 frame")
    if data.get("prev") != 2014:
        fail(f"frame prev is {data.get('prev')!r}, expected 2014 "
             f"(build_vic18_data.py wires it; this join asserts, never touches)")
    for st_k in data["agg"]:
        if "pprim" in data["agg"][st_k] or "pformal" in data["agg"][st_k]:
            fail("frame already carries pprim/pformal — rerun build_vic18_data.py "
                 "map/data first (the lanes are not this script's on a stale build)")

    if len(data["divs"]) != 88:
        fail(f"frame carries {len(data['divs'])} districts, expected 88")
    frame_names = [div["n"] for div in data["divs"]]
    if len(set(frame_names)) != 88:
        fail("frame district names collide")
    # THE HAPPY PART, asserted loudly: 2014 and 2018 were fought on the
    # same 2013-redistribution roster — 88 districts, identical names,
    # no renames, no adjudication machinery on this side of the House.
    if set(frame_names) != set(p14["dists"]):
        fail(f"frame/2014 name mismatch — renames-adjudication is the 2022 "
             f"side's, this frame must match name-for-name: frame-only "
             f"{sorted(set(frame_names) - set(p14['dists']))[:4]}, 2014-only "
             f"{sorted(set(p14['dists']) - set(frame_names))[:4]}")
    print(f"name join: {len(frame_names)}/88 districts match 2014's roster "
          f"exactly (2013 redistribution, both elections) — no renames")
    for div in data["divs"]:
        if div["h"] != []:
            fail(f"{div['n']}: history lane already populated — restore the raw "
                 f"build_vic18_data.py emission before joining")
        if any(len(r) != 8 or r[5] != 0 for r in div["c"]):
            fail(f"{div['n']}: candidate rows drifted from the raw-emission "
                 f"8-shape or carry swings already")
        t = div.get("tpp")
        if t is not None and (len(t) != 3 or t[2] is not None):
            fail(f"{div['n']}: tpp lane drifted from the raw-emission shape")

    for st_k in data["agg"]:
        data["agg"][st_k]["pprim"] = p14["prim"]
        data["agg"][st_k]["pformal"] = p14["formal"]

    n_hist = n_sw = n_tpp = 0
    for div in data["divs"]:
        past = p14["dists"][div["n"]]
        w = past["winner"]
        div["h"].append([2014, w["pct"], w["ab"], w["n"]])
        n_hist += 1
        cur_formal = sum(r[4] for r in div["c"])
        if cur_formal <= 0:
            fail(f"{div['n']}: frame candidate votes sum to {cur_formal}")
        for r in div["c"]:
            share = (100 * r[4]) / cur_formal
            prev_share = (100 * past["prev_by_ab"][r[1]]) / past["formal"] \
                if r[1] in past["prev_by_ab"] else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1
        t = div.get("tpp")
        if t is not None:
            if past["tpp"]:
                cur = (100 * t[0]) / (t[0] + t[1])
                old = (100 * past["tpp"][0]) / (past["tpp"][0] + past["tpp"][1])
                t[2] = r2(cur - old)
                n_tpp += 1
            else:
                t[2] = None  # 2014's certified final pair wasn't classic

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"vic18 past: {n_hist} history rows, {n_sw} candidate swings, "
          f"{n_tpp} 2PP swings (classic-compatible pairs); 2014 state pprim "
          f"{p14['prim']}, pformal {p14['formal']}"
          f" -> {data_path} ({os.path.getsize(data_path)} bytes)")


if __name__ == "__main__":
    main()
