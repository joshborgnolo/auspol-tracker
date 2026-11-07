#!/usr/bin/env python3
"""data-vic14.json for /map/ — the Victorian state election of 29 November
2014 (88 Legislative Assembly districts), the vic18 twin of
build_vic22_data.py's discipline: the state preference-flows pipeline's
own HTML mirror of the VEC's "historic results" app, parsed product by
product with every printed figure reconciled fail-loud. Shares its page
grammar page-for-page with build_vic18_data.py; this docstring pins only
where 2014's copy of the app meaningfully differs.

Sources (read-only, committed — .build/state-flow-src/vic/2014/, assembled
by .build/harvest-vic-state-flows.py; this script never refetches):

  <slug>district.html ×88 — the certified RECHECK-vintage district
    summary page (grammar pinned in build_vic18_data.py). Prahran, the
    2014 recount district, closes its total-votes parenthetical
    "recounted" (pinned in RECOUNT_DISTRICTS; parsed identically,
    asserted equal to the pin set).
  fpvbyvotingcentre<slug>district.html ×88 — first preferences per
    voting centre, same grammar family as 2018 (candidate order asserted
    == roster, per-venue sums, Ordinary subtotal == venue sums,
    declaration rows summed into the Total row, printed percentages
    recomputed, Total row == the district page's certified trio).
    Declaration label inventory: the standard five plus "All Votes
    Votes" in ALL_VOTES_FPV districts (prahran's fpv page carries it).
  tcpbyvotingcentre<slug>district.html ×88 — the Two Candidate
    Preferred count per voting centre. 2014's tcp pages also carry the
    Recheck-votes summary block, asserted equal to the district page's
    certified summary (2018's tcp pages famously lack it — the year
    difference; prahran's recounted wording rides the same assertion).
    Declaration labels: the standard five, with prahran the ONE
    district whose fpv page has the "All Votes Votes" row while its tcp
    page does not (ALL_VOTES_TCP pin). The Total-row implied formal/
    informal totals drift from certified by per-district amounts pinned
    EXACTLY in TCP_SUMMARY_DRIFT (the indicative-count vintage seam;
    −448..+400 2014-wide).
  distribution<slug>district.html ×88 — all 88 districts have a file,
    but 43 of them are EMPTY SHELLS: quota cell blank, the distribution
    table an empty tbody, no Elected-member footer (the VEC served the
    shell where no count ever ran — the 2018 counterpart to DIST_ABSENT,
    inverted: files exist but carry nothing). Shell inventory pinned in
    DIST_SHELL; each shell's summary block and elected cell still
    asserted equal to the district page's. The 45 real pages follow the
    build_vic18 grammar with THREE 2014 wrinkles, all pinned exactly:
    * STOP_STATE (9): the FINAL TOTAL row stopped at the quota
      crossing with >2 unreleased candidates (bayswater's four-way
      Heidi Victoria call, mildura's live Cupper race, etc.).
    * DISTPAGE_DRIFT (5): the page's own first-preference row and quota
      sit on a slightly different formal base than the certified
      recheck roster (recheck-era nudgings of a draft page the
      summary-side pages later replaced — bayswater's page-formal
      38,154 vs certified 38,159, down to carrum's zero-sum
      two-candidate shuffle). The page is internally consistent on its
      own base (asserted); the per-candidate and formal deltas against
      certified are pinned verbatim.
    * prahran is the CERTIFIED-FINAL OVERRIDE: its tcp page runs the
      notional PHARAOH (ALP) v NEWTON-BROWN (LIB) election-night pair,
      18,580–18,555, while the commission's certified distribution ran
      HIBBINS (GRN) over NEWTON-BROWN 18,640–18,363 — the annex's pair
      is not the seat's final pair and its leader is not the member,
      exactly vic22's Shepparton class; the district tcp lane rides the
      certified final (pinned in CERTIFIED), per-booth tcp lanes stay
      the tcp page's, and vic22's seat-card guard (the lane's top
      figure must be the elected member) confirms it.
  2ppvote2014.xls — the VEC's official 2014 2PP workbook (Sheet1 only;
    Sheet2/Sheet3 published empty, asserted). 88 district rows + an
    unlabeled totals row whose cells are asserted equal to the column
    sums and to REF_2PP_SUMS (ALP 1,745,194 v Coalition 1,611,715 —
    the officials' 51.99%). Reconciliation rule page-for-page with the
    2018 script: certified classic final -> equals the final; else the
    tcp page's classic totals; else the pinned notional class
    PP_NOTIONAL (computed per the rule, included districts whose
    certified final or tcp pair is non-classic: Melbourne/Richmond/
    Northcote/Brunswick (ALP-v-GRN), Shepparton (LIB-v-IND), Mildura
    (the Cupper-era stop-state)).
  2ppvote2018-final.xlsx "MP turnover" + "No of candidates" sheets —
    the STALE-APPENDIX finding from the 2018 workbooks: both appendix
    sheets document the 2014 election (member cells are the
    2014-elected members; candidate counts are 2014's 545 Assembly +
    351 Council). This script reconciles them exactly against 2014's
    own certified roster (winners and per-district candidate counts
    alike) — the 2014 frame's third-party triangulation of its roster.
  .build/map/src/vic22/demsausage/vic-2022.json — the 2022 Democracy
    Sausage venue roll, the geocode source (join discipline pinned in
    build_vic18_data.py's source block; 2018-set pins GEO_MISS carry
    2014's 73 unmatched venues incl. the small rural halls retired by
    2022 and three renamed-town labels).

WINNER AUTHORITY. The Elected-member cell of every page family
(district / fpv / tcp / distribution-real-or-shell), asserted identical
per district, tallied into the seat count and pinned at EXPECTED_SEATS
(the VEC's official 2014 count: ALP 47, LIB 30, NAT 8, GRN 2, IND 1 —
Shepparton's Suzanna Sheed), cross-checked against certified-final
leaders (44 districts) and the workbooks' MP-turnover appendix.

EMISSION mirrors build_vic22_data.py's record exactly: {year: "vic14",
date, prev: 2010, jurisdiction "VIC", demoBasis "sa1", agg{AUS,VIC},
divs[], booths{}} with candidate rows [n, ab, pn, bucket, votes, 0,
elected, 0] and booth lanes d,id,n,ty,prem,sub,pc,lat,lon,v,inf,tpp,
tcp,fl,dec,vdec (ty=1; tpp only on classic ALP-v-LIB/NAT final pairs,
sums written; fl [] / null — no LAN flow lane, same as vic22; h [] —
the 2010 past join is a LATER wave). No demo/seifa lanes: a different
wave writes build_vicXX_demo.py/_seifa.py/boothcensus clones, so this
script writes null dec/vdec booth lanes and no demo lane, exactly as
the SA/NSW builders do.

usage: python3 -I .build/map/build_vic14_data.py <out_dir>   # default: map/data
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
sys.path.insert(0, HERE)
from build_vic22_data import flat_name  # noqa: E402 — shared naming
from vic22_geo import EXPECTED_NAMES as NAMES_2022  # noqa: E402 — the roll's division set

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, ".build", "state-flow-src", "vic", "2014")
DS_STORE = os.path.join(REPO, ".build", "map", "src", "vic22", "demsausage", "vic-2022.json")
PP_FILE = os.path.join(SRC, "2ppvote2014.xls")
APPENDIX_FILE = os.path.join(REPO, ".build", "state-flow-src", "vic", "2018", "2ppvote2018-final.xlsx")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")
DEMO_STORE = os.path.join(REPO, "data", "vic14-demo.json")
SEIFA_STORE = os.path.join(REPO, "data", "vic14-seifa.json")

ELECTION = "2014-11-29"
PREV = 2010
YEAR = "vic14"
JUR = "VIC"
N_DISTRICTS = 88
# the VEC's official 2014 tally (see WINNER AUTHORITY): ALP 47, LIB 30,
# NAT 8, GRN 2, IND 1 (Shepparton's independent Suzanna Sheed).
EXPECTED_SEATS = {"ALP": 47, "GRN": 2, "IND": 1, "LIB": 30, "NAT": 8}

# statewide reference totals, sum-derived from the certified district
# pages; asserted exactly.
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

# 2014: all 88 distribution files exist; 43 are empty shells (DIST_SHELL,
# see the source block); real pages whose FINAL row stopped at the
# quota crossing with >2 unreleased candidates (STOP_STATE, 9); pages
# whose own first-preference row / quota sit on a different formal base
# than the certified recheck roster (DISTPAGE_DRIFT, 5; formal delta and
# per-candidate raw-name deltas page-minus-roster, verbatim).
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

# 2014 fpv/tcp declaration-row labels: the five standard plus "All Votes
# Votes" in ALL_VOTES_FPV districts; prahran's tcp page is the one page
# family member without it (ALL_VOTES_TCP pin).
DECL_STD5 = frozenset({"Absent Votes", "Early Votes", "Marked As Voted Votes",
                       "Postal Votes", "Provisional Votes"})
ALL_VOTES_FPV = frozenset(
    "brunswick melbourne mildura northcote prahran richmond shepparton".split())
ALL_VOTES_TCP = ALL_VOTES_FPV - {"prahran"}

# districts whose Recheck block closes "recounted" not "rechecked" — the
# recount-era wording pin (Prahran's 2014 recount: all four page families
# move together, asserted).
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

# the 88 2014 district display names (the h2 grammar), roster-identical to 2018
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

# the VEC's own 2021-redistribution adjudication (pinned by
# build_vic22_past.py): 2014-era district -> 2022 roll division name.
RENAMES = {"Burwood": "Ashwood", "Buninyong": "Eureka",
           "Forest Hill": "Glen Waverley", "Yuroke": "Kalkallo",
           "Gembrook": "Pakenham", "Altona": "Point Cook"}
ABOLISHED_2018 = frozenset({"Ferntree Gully", "Keysborough", "Mount Waverley"})

# geo pins: exact unmatched (district, venue) pairs and the hit counts of
# the two join classes (see the demsausage source block).
GEO_PINS = {"venues": 1786, "div": 1477, "global": 236, "miss": 73,
            "min_hit": 0.90}
GEO_MISS = frozenset([
    ("Benambra", "Bullioh"), ("Benambra", "Mitta Mitta"),
    ("Benambra", "Sandy Creek"), ("Bendigo East", "Big Hill"),
    ("Bendigo West", "Big Hill"), ("Buninyong", "Springbank"),
    ("Eltham", "Eltham Woods"), ("Essendon", "Ascot Vale West"),
    ("Euroa", "Arcadia"), ("Euroa", "Caniambo"), ("Footscray", "Sunshine"),
    ("Gippsland East", "Bairnsdale East"), ("Gippsland East", "Benambra"),
    ("Gippsland East", "Bendoc"), ("Gippsland East", "Coongulla"),
    ("Gippsland East", "Ensay"), ("Gippsland East", "Genoa"),
    ("Gippsland East", "Meerlieu"), ("Gippsland South", "Berrys Creek"),
    ("Gippsland South", "Kilmany"), ("Gippsland South", "Mardan"),
    ("Gippsland South", "Stradbroke"), ("Hastings", "Woodlands Primary"),
    ("Lara", "Avalon"), ("Lowan", "Byaduk"), ("Lowan", "Dadswells Bridge"),
    ("Lowan", "Dergholm"), ("Lowan", "Dooen"), ("Lowan", "Jung"),
    ("Lowan", "Minimay"), ("Lowan", "Murra Warra"), ("Lowan", "Noradjuha"),
    ("Lowan", "Pimpinio"), ("Lowan", "Quantong"), ("Lowan", "Riverside"),
    ("Lowan", "Serviceton"), ("Lowan", "Wonwondah North"), ("Lowan", "Yanac"),
    ("Macedon", "Clarkefield"), ("Melton", "Exford"), ("Mildura", "Culgoa"),
    ("Mildura", "Nullawil"), ("Mildura", "Patchewollock"),
    ("Mildura", "Walpeup"), ("Mildura", "Watchem"), ("Mildura", "Werrimull"),
    ("Mildura", "Yaapeet"), ("Monbulk", "Narre Warren East"),
    ("Murray Plains", "Ballendella"), ("Murray Plains", "Echuca West"),
    ("Murray Plains", "Macorna"), ("Murray Plains", "Mitiamo"),
    ("Murray Plains", "Tennyson"), ("Murray Plains", "Yarrawalla South"),
    ("Narracan", "Hill End"), ("Oakleigh", "Oakleigh"),
    ("Ovens Valley", "Boorhaman"), ("Ovens Valley", "Cheshunt"),
    ("Ovens Valley", "Greta West"), ("Ovens Valley", "Londrigan"),
    ("Ovens Valley", "Myrrhee"), ("Ovens Valley", "Wangaratta"),
    ("Ripon", "Ascot"), ("Ripon", "Korong Vale"), ("Ripon", "Litchfield"),
    ("Ripon", "Stuart Mill"), ("Shepparton", "Naring"),
    ("Shepparton", "Yalca North"), ("South-West Coast", "Gorae West"),
    ("South-West Coast", "Portland South West TAFE"),
    ("South-West Coast", "Tyrendarra"), ("St Albans", "Sunshine"),
    ("Sunbury", "Melbourne Airport"),
])

# the eight LC-region fpv products in the cache: whitelisted extras,
# never parsed here; while prahran's own recount-era workbook
# (fpvbyvotingcentreprahrandistrict.xls) is the substitute source for
# Prahran's venue lanes below.
FPV_EXTRA = frozenset(
    "easternmetropolitanregion easternvictoriaregion northernmetropolitanregion "
    "northernvictoriaregion south-easternmetropolitanregion southernmetropolitanregion "
    "westernmetropolitanregion westernvictoriaregion".split())
# PRAHRAN — the Recount. Prahran's HTML fpv page is POST-RECOUNT: its
# per-venue cells were zeroed by the generator and the recount-certified
# totals condense in an "All Votes Votes" row (the per-venue recount
# table was never published — the workbook itself says so). The page's
# suppressed shape is asserted verbatim below (assert_prahran_suppressed).
# Prahran's venue lanes then ride the recount-era's other artefact:
# fpvbyvotingcentreprahrandistrict.xls — the last recheck-edition
# per-centre workbook (same product family and grammar as the vic22 XLS
# files; row 1 warns "The recount has superseded these recheck figures.
# Recount figures by voting centre are not available."). Its
# workbook-vs-certified seam is pinned exactly below (the recount moved
# 35 ballots formal→informal and nudged six candidates' totals).
PRAHRAN_SLUG = "prahran"
PRAHRAN_XLS = "fpvbyvotingcentreprahrandistrict.xls"
PRAHRAN_XLS_DRIFT = {"summary": [0, 35, -35, 0],
                     "cand": [11, 0, -7, 6, 4, 22, -2, 1]}
PRAHRAN_XLS_DECL_LABELS = frozenset({"Absent", "Early Vote", "Postal Vote",
                                     "Provisional"})
PRAHRAN_VENUES = frozenset({
    "Alma", "Balaclava", "Fawkner Park", "Hawksburn", "Hawksburn Central",
    "Orrong", "Prahran", "Prahran East", "Redan Central", "South Yarra",
    "St Kilda East", "Toorak Central", "Toorak West", "Windsor"})

# districts whose workbook row is a notional figure this frame's
# certified products can't reproduce: the certified-non-classic-AND-page-
# non-classic districts (ALP-v-GRN inner seats + Shepparton LIB-v-IND;
# Mildura's Cupper-era stop-state pairs NAT-v-LAB-IND; prahran itself
# reconciles against its indicative tcp page totals).
PP_NOTIONAL = frozenset({"Brunswick", "Melbourne", "Mildura", "Northcote",
                         "Richmond", "Shepparton"})

COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]

# the 2014 VEC party strings onto canon ids, on the build_vic22_past.py
# token vocabulary (AB-compatible with the vic22 frame where strings
# collide).
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
PARTY_NAME_CANON = {"": "Independent"}


def fail(msg):
    raise SystemExit(f"vic14: {msg}")


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


# --------------------------------------------------------------------- fpv
def parse_fpv(page, name, roster, summary, slug):
    """Per-centre first preferences — the build_vic18 grammar pins apply
    page-for-page."""
    ctx = f"{name} fpv page"
    m = re.search(r'<table[^>]*title="First preference votes by voting centre"([\s\S]*?)<tbody>([\s\S]*?)</tbody>', page)
    if not m:
        fail(f"{ctx}: no fpv table")
    thead = re.search(r"<thead>([\s\S]*?)</thead>", m.group(1))
    head_rows = re.findall(r"<tr>([\s\S]*?)</tr>", thead.group(1))
    if len(head_rows) != 2:
        fail(f"{ctx}: {len(head_rows)} header rows")
    names = [clean(x) for x in re.findall(r"<th[^>]*>([\s\S]*?)</th>", head_rows[0])]
    parties = [clean(x) for x in re.findall(r"<th[^>]*>([\s\S]*?)</th>", head_rows[1])]
    if len(names) != len(parties) or names[0] != "" or not parties[0].startswith("Voting Centres"):
        fail(f"{ctx}: header drift")
    if parties[-1] != "Total votes polled" or parties[-2] != "Informal votes" \
            or names[-1] != "" or names[-2] != "":
        fail(f"{ctx}: sentinel header drift")
    cands = list(zip(names[1:-2], parties[1:-2]))
    if [n for n, _ in cands] != [r["raw"] for r in roster]:
        fail(f"{ctx}: candidate order != certified roster order")
    if [p for _, p in cands] != [r["party"] for r in roster]:
        fail(f"{ctx}: candidate parties != certified roster's")
    venues, decl = [], {}
    n_c = len(roster)
    total_row = pct_row = ordinary = None
    for tr in re.findall(r"<tr>\s*(?:<th[^>]*>([\s\S]*?)</th>)((?:\s*<td>[\s\S]*?</td>)+)\s*</tr>", m.group(2)):
        lab = clean(tr[0])
        vals = [clean(x) for x in re.findall(r"<td>([\s\S]*?)</td>", tr[1])]
        if lab == "Percentage of formal vote polled by candidate":
            pct_row = vals
            continue
        if lab == "Ordinary Votes Total":
            ordinary = [num(x, ctx) for x in vals]
            continue
        if lab == "Total":
            if total_row is not None:
                fail(f"{ctx}: two Total rows")
            total_row = [num(x, ctx) for x in vals]
            continue
        if not vals or not re.fullmatch(r"\d[\d,]*", vals[0].replace(",", "")):
            fail(f"{ctx}: unexpected body row {lab!r}")
        if len(vals) != n_c + 2:
            fail(f"{ctx}: row {lab!r} has {len(vals)} cells, expected {n_c + 2}")
        cells = [num(x, ctx) for x in vals]
        if lab == "All Votes Votes":
            cells = [num(x, ctx) if x else 0 for x in vals]
            if cells[-1] != 0:
                fail(f"{ctx}: All Votes row totals {cells[-1]} (zero-totalling grammar broken)")
        elif sum(cells[:-2]) + cells[-2] != cells[-1]:
            fail(f"{ctx}: row {lab!r} sums {sum(cells[:-2])}+{cells[-2]} != polled {cells[-1]}")
        if lab.endswith(" Votes"):
            if lab in decl:
                fail(f"{ctx}: declaration row {lab!r} twice")
            decl[lab] = cells
        else:
            venues.append({"n": lab, "v": cells[:-2], "inf": cells[-2], "tot": cells[-1]})
    if ordinary is None or total_row is None or pct_row is None:
        fail(f"{ctx}: missing subtotal/total/pct row")
    want_decl = DECL_STD5 | ({"All Votes Votes"} if slug in ALL_VOTES_FPV else set())
    if set(decl) != want_decl:
        fail(f"{ctx}: declaration rows {sorted(decl)} != pinned {sorted(want_decl)}")
    if not venues:
        fail(f"{ctx}: no venues")
    for i in range(n_c + 2):
        if sum(v["v"][i] if i < n_c else v["inf"] if i == n_c else v["tot"] for v in venues) != ordinary[i]:
            fail(f"{ctx}: Ordinary subtotal col {i} != venue sums")
    for i in range(n_c + 2):
        if ordinary[i] + sum(d[i] for d in decl.values()) != total_row[i]:
            fail(f"{ctx}: Total col {i} != ordinary + declarations")
    if sum(total_row[:-2]) != summary["formal"] or total_row[-2] != summary["informal"] \
            or total_row[-1] != summary["total"]:
        fail(f"{ctx}: Total row drifts from the district page's certified "
             f"{summary['formal']}/{summary['informal']}/{summary['total']}")
    for i, r in enumerate(roster):
        pv = pct_row[i].replace("%", "").strip()
        if not pv:
            fail(f"{ctx}: pct row cell {i} blank")
        if abs(100 * r["votes"] / summary["formal"] - float(pv)) > 0.0051:
            fail(f"{ctx}: printed pct {pv} vs computed ({r['raw']!r})")
    if len({v["n"] for v in venues}) != len(venues):
        fail(f"{ctx}: venue labels collide")
    return {"venues": venues, "decl": decl}


# --------------------------------------------------------------------- tcp
def parse_tcp(page, name, roster, implied, summary, slug):
    """The Two Candidate Preferred count per voting centre. 2014's tcp
    pages carry the Recheck-votes summary block, asserted equal to the
    district page's certified summary."""
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
    return {"pair": pair, "venues": venues, "cells_total": total_row}


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


# ------------------------------------------------------------ Prahran's xls
def parse_prahran_xls(path, roster, summary):
    """Prahran's recheck-edition per-centre workbook — the substitute for
    the zeroed HTML fpv page (see PRAHRAN_* pins). The vic22 XLS grammar
    asserted end-to-end; the workbook-vs-certified seam is pinned in
    PRAHRAN_XLS_DRIFT."""
    ctx = "prahran recount-era xls"
    wb = xlrd.open_workbook(path)
    if wb.sheet_names() != ["Results-ElectorateResultsVoting"]:
        fail(f"{ctx}: sheets {wb.sheet_names()}")
    s = wb.sheet_by_index(0)

    def cell_int(r, c):
        v = s.cell_value(r, c)
        if isinstance(v, int):
            return v
        if isinstance(v, float) and float(v).is_integer():
            return int(v)
        fail(f"{ctx}: cell r{r}c{c} not a whole number ({v!r})")

    warn = str(s.cell_value(1, 0))
    if warn != ("The recount has superseded these recheck figures. "
                "Recount figures by voting centre are not available."):
        fail(f"{ctx}: supersession warning drifted {warn!r}")
    if str(s.cell_value(3, 0)) != "Prahran District (Recheck)":
        fail(f"{ctx}: header line {str(s.cell_value(3, 0))!r}")
    enrolled, formal, informal, total = (cell_int(5, 2), cell_int(6, 2),
                                         cell_int(7, 2), cell_int(8, 2))
    if formal + informal != total:
        fail(f"{ctx}: formal+informal != total")
    # candidate header row = the row with the two sentinels
    hr = None
    for r in range(9, min(20, s.nrows)):
        cells = [str(s.cell_value(r, c)) for c in range(s.ncols)]
        if "Informal Votes\n" in cells and "Total Votes\nPolled" in cells:
            if hr is not None:
                fail(f"{ctx}: two candidate header rows")
            hr = r
    if hr is None:
        fail(f"{ctx}: no candidate header row")
    cells = [str(s.cell_value(hr, c)) for c in range(s.ncols)]
    inf_col = cells.index("Informal Votes\n")
    tot_col = cells.index("Total Votes\nPolled")
    if inf_col != tot_col - 1:
        fail(f"{ctx}: informal/total columns drift")
    cand_cols, cands = [], []
    for c, cell in enumerate([str(s.cell_value(hr, c)) for c in range(s.ncols)]):
        if not cell or not cell.strip() or cell in ("Informal Votes\n", "Total Votes\nPolled"):
            continue
        nm, _, party = cell.partition("\n")
        cand_cols.append(c)
        cands.append((clean(nm), clean(party)))
    if [n for n, _ in cands] != [r["raw"] for r in roster]:
        fail(f"{ctx}: candidate order != certified roster")
    if [p for _, p in cands] != [r["party"] for r in roster]:
        fail(f"{ctx}: candidate parties != certified roster's")
    n_c = len(cands)
    venues, decl = [], {}
    ordinary = decl_tot = grand = pct_row = None
    for r in range(hr + 1, s.nrows):
        lab = str(s.cell_value(r, 1)).strip()
        if str(s.cell_value(r, 0)).strip():
            fail(f"{ctx} r{r}: label in col0 ({s.cell_value(r, 0)!r})")
        if not lab:
            continue
        if lab == "Total Ordinary Votes":
            ordinary = r
        elif lab == "Total Declaration Votes":
            decl_tot = r
        elif lab == "TOTAL ALL VOTE TYPES":
            grand = r
        elif lab.startswith("Percentage of Formal Vote"):
            pct_row = r
        elif ordinary is None:
            vals = [cell_int(r, c) for c in cand_cols]
            inf, tot = cell_int(r, inf_col), cell_int(r, tot_col)
            if sum(vals) + inf != tot:
                fail(f"{ctx} venue {lab!r}: sum+informal != polled")
            venues.append({"n": lab, "v": vals, "inf": inf, "tot": tot})
        elif decl_tot is None:
            vals = [cell_int(r, c) for c in cand_cols]
            inf, tot = cell_int(r, inf_col), cell_int(r, tot_col)
            if sum(vals) + inf != tot:
                fail(f"{ctx} decl {lab!r}: sum+informal != polled")
            decl[lab] = vals + [inf, tot]
        else:
            fail(f"{ctx} r{r}: row after the subtotals ({lab!r})")
    if None in (ordinary, decl_tot, grand, pct_row):
        fail(f"{ctx}: subtotal rows missing")
    if set(decl) != PRAHRAN_XLS_DECL_LABELS:
        fail(f"{ctx}: declaration labels {sorted(decl)} != pinned {sorted(PRAHRAN_XLS_DECL_LABELS)}")
    if not venues:
        fail(f"{ctx}: no venues")
    if {v["n"] for v in venues} != PRAHRAN_VENUES:
        fail(f"{ctx}: venue set drift {sorted({v['n'] for v in venues} ^ PRAHRAN_VENUES)}")
    for i, c in enumerate(cand_cols):
        if sum(v["v"][i] for v in venues) != cell_int(ordinary, c):
            fail(f"{ctx}: ordinary col {i} != venue sums")
        if cell_int(ordinary, c) + sum(d[i] for d in decl.values()) != cell_int(grand, c):
            fail(f"{ctx}: grand col {i} != ordinary+declarations")
    if sum(v["inf"] for v in venues) != cell_int(ordinary, inf_col) \
            or sum(v["tot"] for v in venues) != cell_int(ordinary, tot_col):
        fail(f"{ctx}: ordinary informal/total != venue sums")
    if cell_int(ordinary, inf_col) + sum(d[n_c] for d in decl.values()) != cell_int(grand, inf_col) \
            or cell_int(ordinary, tot_col) + sum(d[n_c + 1] for d in decl.values()) != cell_int(grand, tot_col):
        fail(f"{ctx}: grand informal/total != ordinary+declarations")
    grand_formals = [cell_int(grand, c) for c in cand_cols]
    if sum(grand_formals) != formal or cell_int(grand, inf_col) != informal \
            or cell_int(grand, tot_col) != total:
        fail(f"{ctx}: grand totals != F/I/T cells")
    got = [enrolled - summary["enrolled"], formal - summary["formal"],
           informal - summary["informal"], total - summary["total"]]
    if got != PRAHRAN_XLS_DRIFT["summary"]:
        fail(f"{ctx}: summary drift {got} != pinned {PRAHRAN_XLS_DRIFT['summary']}")
    cand_drift = [grand_formals[i] - roster[i]["votes"] for i in range(n_c)]
    if cand_drift != PRAHRAN_XLS_DRIFT["cand"]:
        fail(f"{ctx}: per-candidate drift {cand_drift} != pinned {PRAHRAN_XLS_DRIFT['cand']}")
    for i in range(n_c):
        pc = str(s.cell_value(pct_row, cand_cols[i])).strip().rstrip("%").strip()
        if not pc:
            continue
        if abs(100 * grand_formals[i] / formal - float(pc)) > 0.0051:
            fail(f"{ctx}: pct cell {pc} vs computed ({cands[i][0]!r})")
    if len({v["n"] for v in venues}) != len(venues):
        fail(f"{ctx}: venue labels collide")
    return {"venues": venues, "decl": decl}


def assert_prahran_suppressed(page, roster, summary, elected_pair):
    """The zeroed post-recount HTML fpv page of Prahran: summary ==
    district's, venue rows all zero on the pinned 14 names, the
    declaration inventory (the five + All Votes Votes), the All-Votes
    row == certified totals, the Total row equal to it, and the
    suppressed-shape grammar (Ordinary all zero) — all asserted; the
    defect never silently unpins."""
    ctx = "prahran suppressed fpv page"
    sm = parse_summary(page, ctx)
    if sm != summary:
        fail(f"{ctx}: summary drift {sm} vs {summary}")
    if parse_elected(page, ctx) != elected_pair:
        fail(f"{ctx}: elected cell drift")
    if not sm["_recount"]:
        fail(f"{ctx}: recount wording gone")
    m = re.search(r'<table[^>]*title="First preference votes by voting centre"([\s\S]*?)<tbody>([\s\S]*?)</tbody>', page)
    if not m:
        fail(f"{ctx}: fpv table missing")
    zero_rows, all_votes, total_row = [], None, None
    decl = set()
    for lab, tds in re.findall(r"<tr>\s*<th[^>]*>([\s\S]*?)</th>((?:\s*<td>[\s\S]*?</td>)+)\s*</tr>", m.group(2)):
        lab = clean(lab)
        vals = [clean(x) for x in re.findall(r"<td>([\s\S]*?)</td>", tds)]
        if lab == "Percentage of formal vote polled by candidate":
            continue
        if lab == "Ordinary Votes Total":
            if any(x != "0" for x in vals if x):
                fail(f"{ctx}: Ordinary row non-zero")
            continue
        if lab == "All Votes Votes":
            all_votes = [num(x, ctx) if x else 0 for x in vals]
            decl.add(lab)
            continue
        if lab == "Total":
            total_row = [num(x, ctx) for x in vals]
            continue
        if lab.endswith(" Votes"):
            decl.add(lab)
            continue
        if any(x != "0" for x in vals if x):
            fail(f"{ctx}: venue {lab!r} non-zero on the suppressed page")
        zero_rows.append(lab)
    if set(zero_rows) != PRAHRAN_VENUES:
        fail(f"{ctx}: zero-row venue set drift {sorted(set(zero_rows) ^ PRAHRAN_VENUES)}")
    if decl != DECL_STD5 | {"All Votes Votes"}:
        fail(f"{ctx}: suppressed-page declaration inventory drift {sorted(decl)}")
    sup = [r["votes"] for r in roster] + [summary["informal"], summary["total"]]
    if all_votes != sup:
        fail(f"{ctx}: All Votes row {all_votes} != certified totals {sup}")
    if total_row != all_votes:
        fail(f"{ctx}: Total row != All Votes row")
    if sum(sup[:-2]) != summary["formal"]:
        fail(f"{ctx}: All Votes formal doesn't sum to summary formal")


# ------------------------------------------------------------------ demsausage
ADDR_RE = re.compile(r"^(?P<street>.*),\s*(?P<sub>[A-Za-z][A-Za-z .'-]*)\s+(?P<pc>\d{4})$")


def norm_nm(s):
    return " ".join((s or "").split()).casefold()


def load_roll():
    if not os.path.exists(DS_STORE):
        fail(f"demsausage roll {DS_STORE} missing")
    with open(DS_STORE) as f:
        places = json.load(f)
    if len(places) < 1500:
        fail(f"demsausage roll covers {len(places)} places, expected ~1,659")
    by_div, by_name = {}, {}
    divs = set()
    for p in places:
        if not p.get("premises"):
            fail(f"demsausage {p['id']}: no premises")
        g = p.get("geom") or {}
        if g.get("type") != "Point" or len(g.get("coordinates") or []) != 2:
            fail(f"demsausage {p['id']}: geom drift {g!r}")
        lon, lat = (round(float(x), 5) for x in g["coordinates"])
        if not (-40 < lat < -33.5 and 140 < lon < 150.5):
            fail(f"demsausage {p['id']}: coords {lat},{lon} outside Victoria")
        m = ADDR_RE.match(p["address"] or "")
        if not m:
            fail(f"demsausage {p['id']} {p['name']!r}: address {p['address']!r} outside the form")
        p["_sub"], p["_pc"], p["_lat"], p["_lon"] = m.group("sub"), int(m.group("pc")), lat, lon
        for div in p["divisions"]:
            m2 = re.fullmatch(r"(.+?) District", div)
            if not m2:
                fail(f"demsausage {p['id']}: odd division {div!r}")
            divs.add(m2.group(1))
            by_div.setdefault(m2.group(1), {})[norm_nm(p["name"])] = p
        by_name.setdefault(norm_nm(p["name"]), []).append(p)
    if divs != set(NAMES_2022):
        fail("demsausage divisions drifted from the pinned 2022 roster")
    if any(len(v) != 1 for v in by_name.values()):
        dup = sorted(k for k, v in by_name.items() if len(v) != 1)
        fail(f"demsausage roll names no longer globally unique: {dup[:6]}")
    return {"by_div": by_div, "by_name": by_name}


# ------------------------------------------------------------------ 2ppvote + appendix
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


# ------------------------------------------------------------------ frame
def load_demo():
    if not os.path.exists(DEMO_STORE):
        fail(f"census store {DEMO_STORE} missing — run .build/map/build_vic14_demo.py")
    with open(DEMO_STORE) as f:
        d = json.load(f)
    if d.get("year") != YEAR:
        fail(f"census store is year {d.get('year')!r}")
    demo = d.get("demo")
    if not isinstance(demo, dict) or len(demo) != N_DISTRICTS:
        fail(f"census store covers {len(demo or {})} districts, expected {N_DISTRICTS}")
    return demo


def load_seifa():
    if not os.path.exists(SEIFA_STORE):
        fail(f"SEIFA store {SEIFA_STORE} missing — run .build/map/build_vic14_seifa.py")
    with open(SEIFA_STORE) as f:
        d = json.load(f)
    if d.get("year") != YEAR:
        fail(f"SEIFA store is year {d.get('year')!r}")
    seifa = d.get("seifa")
    if not isinstance(seifa, dict) or len(seifa) != N_DISTRICTS:
        fail(f"SEIFA store covers {len(seifa or {})} districts, expected {N_DISTRICTS}")
    return seifa


def main():
    os.makedirs(OUT, exist_ok=True)
    # ---- cache inventory, asserted exactly
    ls = os.listdir(SRC)
    dists = sorted(f[:-len("district.html")] for f in ls
                   if f.endswith("district.html")
                   and not f.startswith(("distribution", "fpvbyvotingcentre", "tcpbyvotingcentre")))
    if len(dists) != N_DISTRICTS:
        fail(f"{len(dists)} district pages, expected {N_DISTRICTS}")
    if PRAHRAN_XLS not in ls:
        fail(f"prahran recount-era workbook {PRAHRAN_XLS} vanished from the cache")
    fpv = {f[len("fpvbyvotingcentre"):-len(".html")] for f in ls
           if f.startswith("fpvbyvotingcentre") and f.endswith(".html")}
    tcp = {f[len("tcpbyvotingcentre"):-len(".html")] for f in ls if f.startswith("tcpbyvotingcentre")}
    dist_p = {f[len("distribution"):-len(".html")] for f in ls if f.startswith("distribution")}
    if tcp != {s + "district" for s in dists}:
        fail(f"tcp inventory drift: {sorted(tcp ^ {s + 'district' for s in dists})[:8]}")
    if fpv != {s + "district" for s in dists} | FPV_EXTRA:
        fail(f"fpv inventory drift: {sorted(fpv ^ ({s + 'district' for s in dists} | FPV_EXTRA))[:8]}")
    real_or_shell = {s[:-len("district")] for s in dist_p if s.endswith("district")}
    if real_or_shell != set(dists):
        fail(f"distribution inventory drift: {sorted(real_or_shell ^ set(dists))[:8]}")
    roll = load_roll()
    pp = load_2ppvote()
    demo, seifa = load_demo(), load_seifa()
    appendix = load_appendix()

    names_by_slug = {}
    for slug in dists:
        h = read(os.path.join(SRC, f"{slug}district.html"))
        nm = parse_h2(h, f"{slug} district page")
        if nm in names_by_slug.values():
            fail(f"display name {nm!r} twice")
        names_by_slug[slug] = nm
    if set(names_by_slug.values()) != set(EXPECTED_NAMES):
        got = set(names_by_slug.values())
        fail(f"district display names drift: extra {sorted(got - set(EXPECTED_NAMES))[:4]} "
             f"missing {sorted(set(EXPECTED_NAMES) - got)[:4]}")

    D = []
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = tot_inf = tot_enrolled = tot_cands = 0
    tpp_tot = [0, 0]
    B = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                         "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")}
    geo_limbo = []
    geo_counts = {"div": 0, "global": 0, "miss": 0}
    n_cert = 0
    elected_of = {}
    ncand_of = {}
    finals_of = {}
    lane_of = {}
    party_of_raw = {}
    pagepp_of = {}
    recount_seen = set()

    for di, slug in enumerate(dists):
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
        if elected_name not in {flat_name(r["raw"]) for r in roster}:
            fail(f"{name}: elected member {elected_name!r} not on the certified roster")
        wrec = next(r for r in roster if flat_name(r["raw"]) == elected_name)
        if AB[wrec["party"]] != elected_ab:
            fail(f"{name}: elected member's party cell {elected_party!r} != ballot string {wrec['party']!r}")
        seats[elected_ab] += 1
        elected_of[name] = elected_name
        ncand_of[name] = len(roster)
        party_of_raw[name] = {r["raw"]: r["party"] for r in roster}

        # ---- fpv page family (prahran asserts its suppressed post-recount
        # page and substitutes the recount-era workbook for the venue lanes)
        h_fpv = read(os.path.join(SRC, f"fpvbyvotingcentre{slug}district.html"))
        if parse_h2(h_fpv, f"{name} fpv page") != name:
            fail(f"{name}: fpv h2 drift")
        if slug != PRAHRAN_SLUG:
            if parse_elected(h_fpv, f"{name} fpv page") != (elected_name, elected_party):
                fail(f"{name}: fpv elected cell != district page's")
            sm_f = parse_summary(h_fpv, f"{name} fpv page")
            if sm_f != sm:
                fail(f"{name}: fpv summary drift {sm_f} vs {sm}")
            lanes = parse_fpv(h_fpv, name, roster, sm, slug)
        else:
            assert_prahran_suppressed(h_fpv, roster, sm, (elected_name, elected_party))
            lanes = parse_prahran_xls(os.path.join(SRC, PRAHRAN_XLS), roster, sm)
        venues = lanes["venues"]

        # ---- tcp page
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

        v_fpv = {v["n"] for v in venues}
        v_tcp = {v["n"] for v in tcp_rec["venues"]}
        if v_fpv != v_tcp:
            fail(f"{name}: fpv/tcp venue sets differ (fpv-only {sorted(v_fpv - v_tcp)[:3]}, "
                 f"tcp-only {sorted(v_tcp - v_fpv)[:3]})")

        # ---------------- candidate rows (vic22's ordering discipline)
        by_flat = []
        for r in roster:
            party = r["party"]
            ab = AB[party]
            by_flat.append({"raw": r["raw"], "flat": flat_name(r["raw"]),
                            "party": party, "ab": ab,
                            "pn": PARTY_NAME_CANON.get(party, party),
                            "bucket": bucket(ab), "v": r["votes"]})
        by_flat.sort(key=lambda r: (-r["v"], r["flat"]))
        idx = {r["flat"]: i for i, r in enumerate(by_flat)}
        rows_out = [[r["flat"], r["ab"], r["pn"], r["bucket"], r["v"], 0,
                     1 if r["flat"] == elected_name else 0, 0] for r in by_flat]

        # ---------------- certified distribution page (shell or real)
        finals = None
        if slug in DIST_SHELL:
            h_dist = read(os.path.join(SRC, f"distribution{slug}district.html"))
            assert_shell(h_dist, name, sm, (elected_name, elected_party))
        else:
            h_dist = read(os.path.join(SRC, f"distribution{slug}district.html"))
            if parse_h2(h_dist, f"{name} distribution page") != name:
                fail(f"{name}: distribution page h2 drift")
            if parse_elected(h_dist, f"{name} distribution page") != (elected_name, elected_party):
                fail(f"{name}: distribution page elected cell != district page's")
            sm_d = parse_summary(h_dist, f"{name} distribution page")
            if sm_d != sm:
                fail(f"{name}: distribution page summary drift {sm_d} vs {sm}")
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

        # ---------------- the district tcp lane (override where pinned)
        lane_pair = pair
        lane_votes = pair_votes
        if slug in CERTIFIED:
            h_dist = read(os.path.join(SRC, f"distribution{slug}district.html"))
            drift = DISTPAGE_DRIFT.get(slug, {"formal": 0, "cand": {}})
            w, wv, ru, ruv = parse_certified(h_dist, name, CERTIFIED[slug], sm, roster, drift)
            lane_pair, lane_votes = [w, ru], (wv, ruv)
            n_cert += 1
        tcpA, tcpB = idx[lane_pair[0]], idx[lane_pair[1]]
        tcp = [[tcpA, lane_votes[0]], [tcpB, lane_votes[1]]]
        lead = tcpA if lane_votes[0] >= lane_votes[1] else tcpB
        if by_flat[lead]["flat"] != elected_name:
            fail(f"{name}: tcp-lane top figure {by_flat[lead]['flat']!r} "
                 f"!= elected member {elected_name!r}")
        pair_buckets = {by_flat[idx[n]]["bucket"] for n in lane_pair}

        lane_map = None
        if pair_buckets == {"alp", "lnp"}:
            va = lane_votes[0] if by_flat[idx[lane_pair[0]]]["bucket"] == "alp" else lane_votes[1]
            vb = lane_votes[1] if by_flat[idx[lane_pair[0]]]["bucket"] == "alp" else lane_votes[0]
            lane_map = (va, vb)
        lane_of[name] = {"buckets": pair_buckets, "alp_lnp": lane_map}
        page_buckets = {by_flat[idx[n]]["bucket"] for n in pair}
        page_map = None
        if page_buckets == {"alp", "lnp"}:
            pa = pair_votes[0] if by_flat[idx[pair[0]]]["bucket"] == "alp" else pair_votes[1]
            pb = pair_votes[1] if by_flat[idx[pair[0]]]["bucket"] == "alp" else pair_votes[0]
            page_map = (pa, pb)
        pagepp_of[name] = (page_buckets, page_map)

        tpp = None
        if lane_map is not None:
            tpp = [lane_map[0], lane_map[1], None]
            tpp_tot[0] += lane_map[0]
            tpp_tot[1] += lane_map[1]

        # ---------------- booths: the join + lanes (vic22's shape)
        rn = RENAMES.get(name, name)
        div_set = set()
        if name not in ABOLISHED_2018:
            div_set = set(roll["by_div"].get(rn, {}))
            if not div_set:
                fail(f"{name}: mapped 2022 division {rn!r} carries no roll venues")
        tcp_by_venue = {v["n"]: v["cells"] for v in tcp_rec["venues"]}
        for bk, v in enumerate(venues):
            kn = norm_nm(v["n"])
            if kn in div_set:
                p = roll["by_div"][rn][kn]
                geo_counts["div"] += 1
            elif kn in roll["by_name"]:
                p = roll["by_name"][kn][0]
                geo_counts["global"] += 1
            else:
                p = None
                geo_counts["miss"] += 1
                geo_limbo.append((name, v["n"]))
            pvotes = [0] * len(by_flat)
            for i, r in enumerate(roster):
                pvotes[idx[flat_name(r["raw"])]] = v["v"][i]
            tc = tcp_by_venue[v["n"]]
            B["d"].append(di)
            B["id"].append(f"{YEAR}-{di}-{bk}")
            B["n"].append(v["n"])
            B["ty"].append(1)
            B["prem"].append(p["premises"] if p else None)
            B["sub"].append(p["_sub"] if p else None)
            B["pc"].append(p["_pc"] if p else None)
            B["lat"].append(p["_lat"] if p else None)
            B["lon"].append(p["_lon"] if p else None)
            B["v"].append(pvotes)
            B["inf"].append(v["inf"])
            B["tpp"].append(None)
            B["tcp"].append([tc[0], tc[1]])
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)

        rec = {"id": di, "n": name, "st": JUR,
               "c": rows_out,
               "inf": sm["informal"],
               "tcp": tcp,
               "fl": [],
               "h": [],
               "demo": demo[name],
               "seifa": seifa[name],
               "enrolled": sm["enrolled"]}
        if tpp:
            rec["tpp"] = tpp
        D.append(rec)
        tot_formal += sm["formal"]
        tot_inf += sm["informal"]
        tot_enrolled += sm["enrolled"]
        tot_cands += len(roster)
        for r in by_flat:
            tot_prim[r["bucket"]] += r["v"]

    # ---------------- statewide pins
    D.sort(key=lambda r: r["id"])
    if recount_seen != RECOUNT_DISTRICTS:
        fail(f"recounted-wording districts {sorted(recount_seen)} != pinned {sorted(RECOUNT_DISTRICTS)}")
    got_seats = dict(sorted(seats.items()))
    if got_seats != EXPECTED_SEATS:
        fail(f"seat counts {got_seats} != expected {EXPECTED_SEATS}")
    if (tot_enrolled, tot_formal, tot_inf, tot_formal + tot_inf) != \
            (REF_ENROLLED, REF_FORMAL, REF_INFORMAL, REF_TOTAL):
        fail(f"statewide totals != REF ({REF_ENROLLED}, {REF_FORMAL}, {REF_INFORMAL}, {REF_TOTAL})")
    if tot_cands != REF_CANDIDATES:
        fail(f"candidate count {tot_cands} != REF {REF_CANDIDATES}")
    prim = {b: tot_prim[b] for b in BUCKETS}
    if prim != REF_PRIM:
        fail(f"statewide primaries {prim} != REF_PRIM {REF_PRIM}")

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
    for name in sorted(lane_of):
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
            alp_f = sum(v for n, v in finals if party_of_raw[name][n] == "AUSTRALIAN LABOR PARTY")
            lnp_f = sum(v for n, v in finals if party_of_raw[name][n] != "AUSTRALIAN LABOR PARTY")
            if (alp_f, lnp_f) != want:
                fail(f"{name}: certified final {(alp_f, lnp_f)} != official 2pp row {want}")
        elif pagepp_of[name][1] is not None:
            if pagepp_of[name][1] != want:
                fail(f"{name}: tcp page totals {pagepp_of[name][1]} != official 2pp row {want}")
        else:
            skipped.append(name)
    if set(skipped) != PP_NOTIONAL:
        fail(f"2ppvote notional-class set {sorted(skipped)} != pinned {sorted(PP_NOTIONAL)}")

    # geo pins
    if geo_counts != {"div": GEO_PINS["div"], "global": GEO_PINS["global"], "miss": GEO_PINS["miss"]}:
        fail(f"geo hit counts {geo_counts} != pinned {GEO_PINS}")
    if set(geo_limbo) != GEO_MISS:
        only_got = sorted(set(geo_limbo) - GEO_MISS)
        only_pin = sorted(GEO_MISS - set(geo_limbo))
        fail(f"geo miss set drift: new={only_got[:6]} gone={only_pin[:6]}")
    n_booths = len(B["id"])
    if n_booths != GEO_PINS["venues"]:
        fail(f"{n_booths} booth lanes != pinned {GEO_PINS['venues']}")
    hit = geo_counts["div"] + geo_counts["global"]
    if hit < GEO_PINS["min_hit"] * n_booths:
        fail(f"geo hit rate {100 * hit / n_booths:.1f}% below the {100 * GEO_PINS['min_hit']:.0f}% bar")

    agg = {"prim": prim, "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": got_seats}
    out = {"year": YEAR, "date": ELECTION, "prev": PREV, "jurisdiction": JUR,
           "demoBasis": "sa1", "demoYear": 2011,
           "agg": {"AUS": agg, "VIC": dict(agg)}, "divs": D, "booths": B}
    p = os.path.join(OUT, f"data-{YEAR}.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1]) if sum(tpp_tot) else 0
    print(f"{YEAR} districts {len(D)} | seats {got_seats}"
          f" | est. 2PP (classic finals, sums) ALP {round(tp, 2)}"
          f" | informal {round(100 * tot_inf / (tot_inf + tot_formal), 2)}"
          f" | enrolled {tot_enrolled} | booths {n_booths}"
          f" | certified-final tcp on {n_cert}"
          f" | geo {geo_counts['div']}div+{geo_counts['global']}global miss {geo_counts['miss']}"
          f" ({round(100 * hit / n_booths, 2)}%)"
          f" | official 2PP (2ppvote) ALP {round(100 * REF_2PP_SUMS[0] / (REF_2PP_SUMS[0] + REF_2PP_SUMS[1]), 2)}"
          f" -> {p} ({os.path.getsize(p)} bytes)")


if __name__ == "__main__":
    main()
