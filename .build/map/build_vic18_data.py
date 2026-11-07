#!/usr/bin/env python3
"""data-vic18.json for /map/ — the Victorian state election of 24 November
2018 (88 Legislative Assembly districts), modelled field-for-field on
build_vic22_data.py (the sa26/nsw23/vic22 discipline) but parsing the
state preference-flows pipeline's own HTML mirror of the VEC's
"historic results" app instead of the 2022 XLS/annex pair.

Sources (read-only, committed — .build/state-flow-src/vic/2018/, assembled
by .build/harvest-vic-state-flows.py; this script never refetches — a
cache gap or drift fails the build loudly):

  <slug>district.html ×88 — the district summary page, the certified
    RECHECK vintage: <h2><Name> District</h2>; the Elected-member cell
    (`<span class="bold-text">SURNAME, Given</span><br><span
    class="italic">PARTY</span>`); the "Recheck votes" Electorate results
    summary table (Total Enrolment / Formal / Informal / Total, the last
    two with printed percentages which this script recomputes); the
    "Recheck first preference votes" table (title="First preference
    votes") whose per-candidate votes sum to Formal Votes exactly; and —
    on the 48 districts whose certified distribution page exists — a
    "Results after distribution of preferences" link block (the
    standalone distribution<slug>district.html page it points at).
  fpvbyvotingcentre<slug>district.html ×88 — first preferences per
    voting centre (an Elected-member cell and the Recheck summary, both
    asserted identical to the district page's). One "First preference
    votes by voting centre" table: two-row thead (candidate-name row
    over party-name row, closed by "Informal votes" / "Total votes
    polled" sentinels), venue rows (th label, one td per candidate then
    informal + polled, ssum-per-venue asserted), "Ordinary Votes Total"
    subtotal asserted column-for-column equal to the summed venues,
    declaration rows (Postal / Early / Marked As Voted / Provisional /
    Absent Votes, plus "All Votes Votes" in ALL_VOTES_FPV districts)
    asserted column-wise into the closing Total row, the printed
    "Percentage of formal vote polled by candidate" row recomputed
    within half a printed hundredth, and the Total row asserted equal
    to the district page's certified recheck trio.

    BRUNSWICK'S FPV PAGE IS A VEC SOURCE DEFECT: the canonical blob URL
    serves that district's 2014 table (enrolment 46,954 / formal 40,358
    / informal 2,089 / total 42,447 and the 2014 eight-candidate roster
    — re-fetched 2026-11-04, byte-identical, so the source itself is
    broken and the cache faithful). The frame substitutes the VEC's own
    per-district workbook brunswickdistrict.xlsx ("Results by Voting
    Centre", print 10/12/2018 — the same product family and grammar as
    the vic22 XLS files) for Brunswick's venue lanes; the defect
    signature and the workbook↔recheck drift are pinned exactly
    (BRUNSWICK_DEFECT / BRUNSWICK_XLSX_DRIFT), and the defective page
    is still parsed to assert the defect stands. Brunswick's district
    figures stay the certified recheck numbers — the same
    declaration-vs-certified XLS seam vic22 ships on all 88 of its
    districts, compressed into one.
  tcpbyvotingcentre<slug>district.html ×88 — the Two Candidate
    Preferred count per voting centre. Two header rows with the pair
    named in id="candidate1"/id="candidate2" th cells (asserted on the
    certified roster), venue rows with five figure cells [cand1, cand2,
    mis-sorts, informal, polled] each summing internally, Ordinary
    subtotal asserted equal to the summed venues, declaration rows
    (same inventory discipline as fpv, ALL_VOTES_TCP pinned), a closing
    Total row asserted (sums, ordinary+declarations, pair percentages
    recomputed) — whose implied formal/informal totals drift from the
    certified recheck figures by per-district amounts pinned EXACTLY in
    TCP_SUMMARY_DRIFT (the indicative-count vintage seam; −653..+403
    2018-wide). 2018's tcp pages carry no "Recheck votes" summary block
    (asserted absent; a 2014-era difference).
  distribution<slug>district.html ×48 — the preference-distribution
    pages (the 48 2018 districts whose count needed exclusions; the
    other 40, pinned in DIST_ABSENT, returned primary majorities and no
    count). Each carries the Elected-member cell, the Recheck summary
    (both asserted equal to the district page's), the Quota table
    (asserted == certified formal//2+1), and the "Distribution of
    preference votes" table: header candidates asserted equal to the
    certified roster order, the first row equal to the certified
    per-candidate record exactly, every Transfer row's figure cells
    summing to its caption count and TOTAL, Progressive rows' TOTAL ==
    certified formal, and a FINAL TOTAL row of >=2 remaining candidates
    whose TOTAL == certified formal — either a two-candidate final or
    one of the 12 stop-state remnants pinned in STOP_STATE (the
    2018-era "stops at the quota crossing" class the vic22 past-join
    documents). The final row's leader is asserted equal to the elected
    member, as is the page's Elected-member footer.
  2ppvote2018.xlsx + 2ppvote2018-final.xlsx — the VEC's official 2018
    2PP workbooks, row-identical byte-classes (asserted per-row). The
    2PP sheet carries 87 district rows (RICHMOND is missing from the
    product — pinned in PP_MISSING) plus a formula-sum row; sum pins
    REF_2PP_SUMS. Reconciliation rule against the frame's certified
    products: a district with a real two-candidate CLASSIC final has
    its workbook row equal to that certified final; every other
    classic-pair district's row equals the tcp page's totals; ONE
    pinned exception — Albert Park's LNP cell prints 14,696 against its
    own certified final of 14,697 (an off-by-one inside the official
    product: the row's own formula sum 39,857 ≠ formal 39,858 exposes
    it). The pinned notional class PP_NOTIONAL (Brunswick, Geelong,
    Melbourne, Mildura, Morwell, Northcote, Pascoe Vale, Prahran,
    Preston, Shepparton) carries no check: eight districts whose
    certified final and tcp page are both non-classic, Geelong's
    stop-state page with its own notional ALP-v-IND (Lyons) tcp pair,
    and Preston, whose tcp page alone is non-classic — none of those
    rows can be reproduced from this frame's certified pages. THE STALE
    APPENDIX:
    the workbooks' "MP turnover" and "No of candidates" sheets document
    the 2014 election (member cells read the 2014-elected members,
    candidate counts are 2014's 545+351) — the VEC recycled 2014's
    appendices, the same defect family as Brunswick's fpv page. Their
    2014 character is pinned here; build_vic14_data.py reconciles them
    against the vic14 frame's own certified roster.
  .build/map/src/vic22/demsausage/vic-2022.json — Democracy Sausage's
    2022 venue roll (1,659 places, no duplicate names, every venue
    apportioned to 2022 divisions): the geocode source. Venue names
    join the fpv page's printed venue label (whitespace/case
    normalised), first inside the mapped 2022 division of the district
    (RENAMES — the VEC's own 2021-redistribution adjudication as pinned
    by build_vic22_past.py), then globally (the roll is name-unique, so
    the fallback is unambiguous; a venue relocated by the 2021
    redistribution still geocodes). Venues absent from the roll keep
    null geo lanes; the exact miss SET is pinned in GEO_MISS and the
    hit counts in GEO_PINS.

WINNER AUTHORITY. Each page family's Elected-member cell (district /
fpv / tcp / distribution), asserted identical per district, tallied
into the seat count, cross-checked against the certified-final leader
wherever one exists and against the MP-turnover sheet's member set.
The tally is pinned at EXPECTED_SEATS (the VEC's official 2018 count:
ALP 55, LIB 21, NAT 6, GRN 3, IND 3 — Mildura Cupper, Shepparton Sheed,
Morwell Northe). THE CERTIFIED-FINAL OVERRIDE: Benambra's tcp page
runs the notional TAIT (ALP) v TILLEY (LIB) election-night pair, while
the actual certified final pair ran TILLEY v HAWKINS (IND) — the tcp
page's pair is not the seat's final pair, exactly vic22's Shepparton
class; the district tcp lane therefore rides the certified distribution
final (pinned in CERTIFIED) while the per-booth tcp lanes stay the tcp
page's (no per-venue certified pair product exists — vic22's override
discipline verbatim). The build then fails if any district's tcp-lane
top figure is not the elected member — vic22's seat-card guard.

EMISSION mirrors build_vic22_data.py's record exactly: {year: "vic18",
date, prev: 2014, jurisdiction "VIC", demoBasis "sa1", agg{AUS,VIC},
divs[], booths{}} with candidate rows [n, ab, pn, bucket, votes, 0,
elected, 0] and booth lanes d,id,n,ty,prem,sub,pc,lat,lon,v,inf,tpp,
tcp,fl,dec,vdec (every venue ty=1; tpp only on classic ALP-v-LIB/NAT
final pairs, sums written; fl [] / null everywhere — no LAN flow lane,
same as vic22; h [] everywhere — the 2014 past join is a LATER wave,
this script only carries the prev field, mirroring how
build_vic22_data.py's raw emission defers h/swings to
build_vic22_past.py). No demo/seifa lanes exist yet: a different wave
writes build_vicXX_demo.py/_seifa.py/boothcensus clones, so this script
writes null dec/vdec booth lanes and no demo lane, exactly as the
SA/NSW builders do.

usage: python3 -I .build/map/build_vic18_data.py <out_dir>   # default: maps/data
deps: stdlib + openpyxl (the Brunswick workbook + the 2ppvote workbooks)
"""
import collections
import html as H
import json
import os
import re
import sys

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_vic22_data import flat_name  # noqa: E402 — shared naming, proven on 2018 html
from vic22_geo import EXPECTED_NAMES as NAMES_2022  # noqa: E402 — the roll's division set

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, ".build", "state-flow-src", "vic", "2018")
DS_STORE = os.path.join(REPO, ".build", "map", "src", "vic22", "demsausage", "vic-2022.json")
PP_FILE = os.path.join(SRC, "2ppvote2018-final.xlsx")
PP_FILE_EARLY = os.path.join(SRC, "2ppvote2018.xlsx")
BR_XLSX = os.path.join(SRC, "brunswickdistrict.xlsx")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "maps", "data")
DEMO_STORE = os.path.join(REPO, "data", "vic18-demo.json")
SEIFA_STORE = os.path.join(REPO, "data", "vic18-seifa.json")

ELECTION = "2018-11-24"
PREV = 2014
YEAR = "vic18"
JUR = "VIC"
N_DISTRICTS = 88
# the VEC's official 2018 tally (see WINNER AUTHORITY): ALP 55, LIB 21,
# NAT 6, GRN 3, IND 3 — counted from the parsed elected cells and pinned.
EXPECTED_SEATS = {"ALP": 55, "GRN": 3, "IND": 3, "LIB": 21, "NAT": 6}

# statewide reference totals, sum-derived from the certified district
# pages; asserted exactly.
REF_ENROLLED = 4139326
REF_FORMAL = 3514474
REF_INFORMAL = 217592
REF_TOTAL = 3732066
REF_CANDIDATES = 507
REF_PRIM = {"alp": 1506460, "lnp": 1236912, "grn": 376470, "onp": 0,
            "ind": 213289, "oth": 181343}

# the official 2PP workbook sum over its 87 district rows (Richmond is
# absent from the product): ALP 57.30%.
REF_2PP_SUMS = (1988434, 1481975)
PP_MISSING = {"Richmond"}
# Albert Park's LNP cell prints 14,696 where its own certified final and
# its row-sum both say 14,697 (the official product's own off-by-one).
PP_TYPOS = {"Albert Park": (25161, 14696)}
# districts whose workbook row is a notional figure unreproducible from
# this frame's certified products: certified-non-classic-AND-page-non-
# classic districts (9) plus Geelong, whose tcp page itself carries the
# notional ALP-v-IND (Lyons) pair (the 2018 workbook's own class hole).
PP_NOTIONAL = frozenset({"Brunswick", "Geelong", "Melbourne", "Mildura",
                         "Morwell", "Northcote", "Pascoe Vale", "Prahran",
                         "Preston", "Shepparton"})

# the certified distribution final for districts whose tcp page runs a
# notional pair that is NOT the seat's actual final pair (THE
# CERTIFIED-FINAL OVERRIDE): slug -> (flat winner, votes, flat runner-up,
# votes). parse_certified asserts the page's FINAL TOTAL says exactly this.
CERTIFIED = {"benambra": ("Bill Tilley", 21732, "Jacqui Hawkins", 19703)}

# 2018: districts with no distribution page at all (40 of 88), and real
# pages whose FINAL TOTAL row is a stop-state remnant (more than two
# unreleased candidates at the quota-crossing stop — 12).
DIST_ABSENT = frozenset(
    "altona bendigoeast bendigowest bentleigh broadmeadows bulleen bundoora "
    "carrum clarinda cranbourne dandenong euroa footscray gippslandeast "
    "gippslandsouth keysborough kororoit lara lowan malvern millpark "
    "mordialloc mornington mulgrave murrayplains narracan narrewarrennorth "
    "niddrie oakleigh polwarth preston rowville stalbans sunbury sydenham "
    "tarneit thomastown williamstown yanyean yuroke".split())
STOP_STATE = frozenset(
    "bellarine buninyong eildon frankston geelong kew macedon "
    "narrewarrensouth ovensvalley warrandyte wendouree werribee".split())

# fpv/tcp declaration-row labels: the five standard declarations plus "All
# Votes Votes" in pinned districts. Two page-family asymmetries pinned:
# ripon's fpv page carries the row but its tcp page does not; brunswick's
# GENUINE tcp page carries it (zero-totalling, blank-printed pair cells —
# ALL_VOTES_BLANK) while its fpv lanes come from the xlsx (XLS five only).
DECL_STD5 = frozenset({"Absent Votes", "Early Votes", "Marked As Voted Votes",
                       "Postal Votes", "Provisional Votes"})
ALL_VOTES_FPV = frozenset(
    "geelong melbourne mildura morwell northcote pascoevale prahran preston "
    "ripon shepparton".split())
ALL_VOTES_TCP = ALL_VOTES_FPV - {"ripon"} | {"brunswick"}
XLS_DECL_LABELS = frozenset({"Absent", "Early Vote", "Marked as Voted",
                             "Postal Vote", "Provisional"})

# districts whose Recheck-summary block closes "recounted" rather than
# "rechecked" — the recount-era wording pin (Ripon's 2018 recount; all
# three summary-carrying page families move together, asserted).
RECOUNT_DISTRICTS = frozenset({"ripon"})

# BRUNSWICK: the blob's fpv page serves the district's 2014 table. Its
# signature is asserted on the cached page, then the district's own
# workbook (vic22-XLS grammar) supplies the venue lanes.
BRUNSWICK_SLUG = "brunswick"
BRUNSWICK_DEFECT = {"enrolled": 46954, "formal": 40358, "informal": 2089,
                    "total": 42447, "cands": 8}
# the defective page's own stale elected-member cell (2014's table)
BRUNSWICK_DEFECT_ELECTED = ("Jane Garrett", "AUSTRALIAN LABOR PARTY")
BRUNSWICK_XLSX_DRIFT = {"summary": [0, 157, -189, -32],
                        "cand": [3, 18, -3, 76, 4, 34, 14, 6, 5]}

# tcp-page implied totals minus the district page's certified recheck
# figures, per district [formal-drift, informal-drift] — asserted exactly.
TCP_SUMMARY_DRIFT = {
    "albertpark": [57, -58], "altona": [-15, -31], "bass": [281, -275],
    "bayswater": [30, -38], "bellarine": [7, -47], "benambra": [10, -139],
    "bendigoeast": [32, -27], "bendigowest": [-7, -9], "bentleigh": [111, -129],
    "boxhill": [-45, -2], "brighton": [8, -10], "broadmeadows": [105, -102],
    "brunswick": [-203, -240], "bulleen": [91, -90], "bundoora": [90, -26],
    "buninyong": [148, -158], "burwood": [25, -83], "carrum": [9, -86],
    "caulfield": [16, -27], "clarinda": [54, -67], "cranbourne": [187, -198],
    "croydon": [9, -19], "dandenong": [66, -69], "eildon": [-5, -22],
    "eltham": [-6, 2], "essendon": [54, -91], "euroa": [120, -69],
    "evelyn": [-2, -8], "ferntreegully": [-30, 5], "footscray": [11, -30],
    "foresthill": [-4, -2], "frankston": [50, -16], "geelong": [88, -91],
    "gembrook": [-14, -11], "gippslandeast": [131, -137],
    "gippslandsouth": [57, -3], "hastings": [0, -23], "hawthorn": [15, -41],
    "ivanhoe": [48, -62], "kew": [-10, -11], "keysborough": [103, -28],
    "kororoit": [-208, -104], "lara": [62, -76], "lowan": [11, -19],
    "macedon": [74, 10], "malvern": [24, -34], "melbourne": [112, -116],
    "melton": [403, -388], "mildura": [74, -81], "millpark": [113, -109],
    "monbulk": [-75, -14], "mordialloc": [145, -146], "mornington": [-18, -25],
    "morwell": [310, -316], "mountwaverley": [-121, 94], "mulgrave": [0, -16],
    "murrayplains": [8, -18], "narracan": [71, -80],
    "narrewarrennorth": [46, -51], "narrewarrensouth": [-9, -21],
    "nepean": [12, -31], "niddrie": [-19, 4], "northcote": [-178, -97],
    "oakleigh": [19, -28], "ovensvalley": [97, -85], "pascoevale": [173, -190],
    "polwarth": [31, -46], "prahran": [115, -185], "preston": [18, -155],
    "richmond": [145, -146], "ringwood": [-7, -11], "ripon": [236, -264],
    "rowville": [-35, -1], "sandringham": [135, -146], "shepparton": [98, -102],
    "south-westcoast": [190, -218], "southbarwon": [109, -159],
    "stalbans": [-653, 404], "sunbury": [-74, -11], "sydenham": [-336, -16],
    "tarneit": [251, -257], "thomastown": [181, -194], "warrandyte": [-12, 6],
    "wendouree": [74, -84], "werribee": [157, -149], "williamstown": [37, -61],
    "yanyean": [60, -149], "yuroke": [32, -47],
}

# the 88 2018 district display names (the h2 grammar), roster-identical to 2014
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

# the VEC's own 2021-redistribution adjudication (the
# renames-adjudication.txt table pinned by build_vic22_past.py): 2018
# district -> 2022 roll division (for the geo join's district scope).
RENAMES = {"Burwood": "Ashwood", "Buninyong": "Eureka",
           "Forest Hill": "Glen Waverley", "Yuroke": "Kalkallo",
           "Gembrook": "Pakenham", "Altona": "Point Cook"}
ABOLISHED_2018 = frozenset({"Ferntree Gully", "Keysborough", "Mount Waverley"})

# geo pins: exact unmatched (district, venue) pairs and the hit counts of
# the two join classes (see the demsausage source block).
GEO_PINS = {"venues": 1794, "div": 1488, "global": 238, "miss": 68,
            "min_hit": 0.90}
GEO_MISS = frozenset([
    ("Benambra", "Bullioh"), ("Benambra", "Mitta Mitta"),
    ("Benambra", "Sandy Creek"), ("Buninyong", "Springbank"),
    ("Eltham", "Eltham Woods"), ("Essendon", "Ascot Vale West"),
    ("Euroa", "Arcadia"), ("Euroa", "Caniambo"), ("Footscray", "Sunshine"),
    ("Gippsland East", "Bairnsdale East"), ("Gippsland East", "Benambra"),
    ("Gippsland East", "Bendoc"), ("Gippsland East", "Coongulla"),
    ("Gippsland East", "Ensay"), ("Gippsland East", "Genoa"),
    ("Gippsland East", "Meerlieu"), ("Gippsland South", "Berrys Creek"),
    ("Gippsland South", "Kilmany"), ("Gippsland South", "Mardan"),
    ("Gippsland South", "Stradbroke"), ("Hastings", "Woodlands Primary"),
    ("Lowan", "Byaduk"), ("Lowan", "Dadswells Bridge"),
    ("Lowan", "Dergholm"), ("Lowan", "Dooen"), ("Lowan", "Jung"),
    ("Lowan", "Minimay"), ("Lowan", "Murra Warra"), ("Lowan", "Noradjuha"),
    ("Lowan", "Pimpinio"), ("Lowan", "Quantong"), ("Lowan", "Riverside"),
    ("Lowan", "Serviceton"), ("Lowan", "Wonwondah North"), ("Lowan", "Yanac"),
    ("Macedon", "Clarkefield"), ("Melton", "Exford"), ("Mildura", "Culgoa"),
    ("Mildura", "Nullawil"), ("Mildura", "Patchewollock"),
    ("Mildura", "Walpeup"), ("Mildura", "Watchem"), ("Mildura", "Werrimull"),
    ("Mildura", "Yaapeet"), ("Monbulk", "Narre Warren East"),
    ("Murray Plains", "Ballendella"), ("Murray Plains", "Macorna"),
    ("Murray Plains", "Mitiamo"), ("Murray Plains", "Yarrawalla South"),
    ("Narracan", "Hill End"),
    ("Oakleigh", "Oakleigh"), ("Ovens Valley", "Boorhaman"),
    ("Ovens Valley", "Cheshunt"), ("Ovens Valley", "Greta West"),
    ("Ovens Valley", "Londrigan"), ("Ovens Valley", "Myrrhee"),
    ("Ovens Valley", "Wangaratta"), ("Ripon", "Ascot"),
    ("Ripon", "Korong Vale"), ("Ripon", "Litchfield"),
    ("Ripon", "Stuart Mill"), ("Shepparton", "Naring"),
    ("Shepparton", "Yalca North"), ("South-West Coast", "Gorae West"),
    ("South-West Coast", "Portland South West TAFE"),
    ("South-West Coast", "Tyrendarra"), ("St Albans", "Sunshine"),
    ("Sunbury", "Melbourne Airport"),
])

# the eight LC-region fpv products in the cache: whitelisted extras,
# never parsed here.
FPV_EXTRA = frozenset(
    "easternmetropolitanregion easternvictoriaregion northernmetropolitanregion "
    "northernvictoriaregion south-easternmetropolitanregion southernmetropolitanregion "
    "westernmetropolitanregion westernvictoriaregion".split())

COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]

# the 2018 VEC party strings onto canon ids — build_vic22_past.py's own
# AB_2018 token set (one canon shared with the vic22 frame).
AB = {
    "AUSTRALIAN LABOR PARTY": "ALP",
    "LIBERAL": "LIB",
    "THE NATIONALS": "NAT",
    "AUSTRALIAN GREENS": "GRN",
    "ANIMAL JUSTICE PARTY": "AJP",
    "LABOUR DLP": "DLP",
    "VICTORIAN SOCIALISTS": "VS",
    "FIONA PATTEN'S REASON PARTY": "REAS",
    "TRANSPORT MATTERS": "TMP",
    "SHOOTERS, FISHERS & FARMERS VIC": "SFF",
    "DERRYN HINCH'S JUSTICE PARTY": "DHJP",
    "LIBERAL DEMOCRATS": "LDP",
    "SUSTAINABLE AUSTRALIA": "SA",
    "AUSSIE BATTLER PARTY": "ABP",
    "AUSTRALIAN COUNTRY PARTY": "ACP",
    "AUSTRALIAN LIBERTY ALLIANCE": "ALA",
    "": "IND",
}
PARTY_NAME_CANON = {"": "Independent"}


def fail(msg):
    raise SystemExit(f"vic18: {msg}")


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
    """The Recheck-votes Electorate results summary: integer cells with
    their printed percentages recomputed; formal+informal == total."""
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
    candidate roster, asserted to sum to Formal Votes exactly and to
    reproduce the page's printed percentages."""
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
            fail(f"{ctx}: unmapped 2018 party string {party!r} — extend AB (never a silent other)")
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
    """The per-centre first-preference product — the source block pins its
    grammar end-to-end. Returns venues (page order) and declaration rows.
    Brunswick never reaches here (its defective page + xlsx substitute)."""
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
        if sum(cells[:-2]) + cells[-2] != cells[-1]:
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
        fail(f"{ctx}: Total row {total_row[-3:]} drifts from the district page's certified "
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
def parse_tcp(page, name, roster, implied, slug):
    """The Two Candidate Preferred count per voting centre; `implied` is
    the (formal, informal) pair its Total row must imply — the certified
    recheck figures shifted by the district's pinned vintage seam."""
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
    if "as at close of rolls" in page:
        fail(f"{ctx}: 2018 tcp page carries a Recheck-summary block (year drift)")
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
        # "All Votes Votes" rows print blanks for zero (brunswick's genuine
        # 2018 tcp row is blank-printed; every such row must total zero)
        if lab == "All Votes Votes":
            cells = [num(x, ctx) if x else 0 for x in vals]
            if cells[-1] != 0:
                fail(f"{ctx}: All Votes row totals {cells[-1]} (blank-for-zero grammar broken)")
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
    # the indicative-count vintage seam, pinned exactly per district
    if total_row[0] + total_row[1] + total_row[2] != implied[0] \
            or total_row[3] != implied[1]:
        fail(f"{ctx}: tcp Total implies formal {total_row[0] + total_row[1] + total_row[2]} "
             f"informal {total_row[3]}, pinned {implied}")
    return {"pair": pair, "venues": venues, "cells_total": total_row}


# ------------------------------------------------------------- distribution
def parse_distpage(page, name, roster, summary):
    """The certified preference-distribution page: every internal
    equality asserted (see the source block); returns the FINAL TOTAL
    row's remaining candidates (raw names) — two for a true final pair,
    more for a quota-crossing stop-state."""
    ctx = f"{name} distribution page"
    m = re.search(r'title="Quota"[\s\S]*?<td>\s*([\d,]*)</td>', page)
    if not m:
        fail(f"{ctx}: no Quota table")
    if not m.group(1):
        fail(f"{ctx}: blank quota cell (never held in 2018)")
    quota = int(m.group(1).replace(",", ""))
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
            if cells != [r["votes"] for r in roster]:
                fail(f"{ctx}: fp row != certified roster record")
            if tot != summary["formal"]:
                fail(f"{ctx}: fp TOTAL {tot} != certified formal {summary['formal']}")
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
            if tot != summary["formal"]:
                fail(f"{ctx}: progressive TOTAL != certified formal")
        else:
            fail(f"{ctx}: unexpected row {lab!r}")
    if fp_row is None or final_row is None:
        fail(f"{ctx}: missing fp/FINAL row")
    finals = [(names[i], v) for i, v in enumerate(final_row[0]) if v]
    if not finals:
        fail(f"{ctx}: empty FINAL TOTAL")
    if final_row[1] != summary["formal"]:
        fail(f"{ctx}: FINAL TOTAL {final_row[1]} != certified formal")
    if len(finals) == 2 and sum(v for _, v in finals) != summary["formal"]:
        fail(f"{ctx}: final pair spare votes")
    if sum(v for _, v in finals) > summary["formal"]:
        fail(f"{ctx}: final row over-runs formal")
    if quota != summary["formal"] // 2 + 1:
        fail(f"{ctx}: quota {quota} != formal/2+1")
    lead = max(finals, key=lambda t: t[1])
    if lead[1] < quota:
        fail(f"{ctx}: final leader {lead} under quota")
    return {"finals": finals}


def parse_certified(page, name, pinned, summary, roster):
    """The CERTIFIED-FINAL override district's distribution final, parsed
    and asserted equal to the pinned figures (vic22's parse_certified
    discipline: a source move or a hand edit fails loudly)."""
    rec = parse_distpage(page, name, roster, summary)
    finals = rec["finals"]
    if len(finals) != 2:
        fail(f"{name}: certified-final page no longer a two-candidate count")
    lead = max(finals, key=lambda t: t[1])
    runner = min(finals, key=lambda t: t[1])
    got = (flat_name(lead[0]), lead[1], flat_name(runner[0]), runner[1])
    if got != pinned:
        fail(f"{name}: certified final {got} != pinned {pinned}")
    return (got[0], got[1], got[2], got[3])


# --------------------------------------------------------- Brunswick's xlsx
def parse_brunswick_xlsx(path, roster, summary):
    """Brunswick's 'Results by Voting Centre' workbook — declaration-stage
    venue product standing in for the defective fpv HTML page. The vic22
    XLS grammar asserted end-to-end; the workbook-vs-certified seam is
    pinned in BRUNSWICK_XLSX_DRIFT."""
    ctx = "brunswick xlsx"
    wb = openpyxl.load_workbook(path)
    if wb.sheetnames != ["Results-ElectorateResultsVoting"]:
        fail(f"{ctx}: sheets {wb.sheetnames}")
    ws = wb[wb.sheetnames[0]]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    wb.close()

    def cell_int(r, c):
        v = rows[r][c]
        if isinstance(v, int):
            return v
        if isinstance(v, float) and float(v).is_integer():
            return int(v)
        fail(f"{ctx}: cell r{r}c{c} not a whole number ({v!r})")

    if str(rows[3][0]) != "Brunswick District (Primary)":
        fail(f"{ctx}: header line {rows[3][0]!r}")
    enrolled, formal, informal, total = (cell_int(5, 2), cell_int(6, 2),
                                         cell_int(7, 2), cell_int(8, 2))
    if formal + informal != total:
        fail(f"{ctx}: formal+informal != total")
    hr = None
    for r in range(9, min(20, len(rows))):
        cells = [str(v) if isinstance(v, str) else "" for v in rows[r]]
        if "Informal Votes\n" in cells and "Total Votes\nPolled" in cells:
            if hr is not None:
                fail(f"{ctx}: two candidate header rows")
            hr = r
    if hr is None:
        fail(f"{ctx}: no candidate header row")
    cells = rows[hr]
    inf_col = [i for i, v in enumerate(cells) if v == "Informal Votes\n"][0]
    tot_col = [i for i, v in enumerate(cells) if v == "Total Votes\nPolled"][0]
    if inf_col != tot_col - 1:
        fail(f"{ctx}: informal/total columns drift")
    cand_cols, cands = [], []
    for c in range(1, len(cells)):
        v = cells[c]
        if not isinstance(v, str) or not v.strip():
            continue
        if v in ("Informal Votes\n", "Total Votes\nPolled"):
            continue
        nm, _, party = v.partition("\n")
        cand_cols.append(c)
        cands.append((clean(nm), clean(party)))
    if [n for n, _ in cands] != [r["raw"] for r in roster]:
        fail(f"{ctx}: candidate order != certified roster")
    if [p for _, p in cands] != [r["party"] for r in roster]:
        fail(f"{ctx}: candidate parties != certified roster's")
    n_c = len(cands)
    venues, decl = [], {}
    ordinary = decl_tot = grand = pct_row = None

    def cellstr(v):
        return str(v).strip() if v is not None else ""

    for r in range(hr + 1, len(rows)):
        lab = cellstr(rows[r][1]) if len(rows[r]) > 1 else ""
        lab0 = cellstr(rows[r][0])
        if lab0:
            fail(f"{ctx} r{r}: label in col0 ({rows[r][0]!r})")
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
    if set(decl) != XLS_DECL_LABELS:
        fail(f"{ctx}: declaration labels {sorted(decl)} != the XLS five")
    if not venues:
        fail(f"{ctx}: no venues")
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
    if got != BRUNSWICK_XLSX_DRIFT["summary"]:
        fail(f"{ctx}: summary drift {got} != pinned {BRUNSWICK_XLSX_DRIFT['summary']}")
    cand_drift = [grand_formals[i] - roster[i]["votes"] for i in range(n_c)]
    if cand_drift != BRUNSWICK_XLSX_DRIFT["cand"]:
        fail(f"{ctx}: per-candidate drift {cand_drift} != pinned {BRUNSWICK_XLSX_DRIFT['cand']}")
    for i in range(n_c):
        pc = str(rows[pct_row][cand_cols[i]]).strip().rstrip("%").strip()
        if not pc:
            continue
        if abs(100 * grand_formals[i] / formal - float(pc)) > 0.0051:
            fail(f"{ctx}: pct cell {pc} vs computed ({cands[i][0]!r})")
    if len({v["n"] for v in venues}) != len(venues):
        fail(f"{ctx}: venue labels collide")
    return {"venues": venues, "decl": decl}


def assert_brunswick_defect(page):
    """The cached fpv page for Brunswick must still be the defective
    2014-era table (see BRUNSWICK_DEFECT)."""
    ctx = "brunswick defective fpv page"
    sm = parse_summary(page, ctx)
    sig = {"enrolled": sm["enrolled"], "formal": sm["formal"],
           "informal": sm["informal"], "total": sm["total"]}
    if sig != {k: BRUNSWICK_DEFECT[k] for k in sig}:
        fail(f"{ctx}: defect signature drifted {sig}")
    m = re.search(r'<table[^>]*title="First preference votes by voting centre"([\s\S]*?)<tbody>', page)
    if not m:
        fail(f"{ctx}: fpv table missing")
    head_rows = re.findall(r"<tr>([\s\S]*?)</tr>", re.search(r"<thead>([\s\S]*?)</thead>", m.group(1)).group(1))
    if len(head_rows) != 2:
        fail(f"{ctx}: header row drift")
    names = [x for x in (clean(y) for y in re.findall(r"<th[^>]*>([\s\S]*?)</th>", head_rows[0])) if x]
    if len(names) != BRUNSWICK_DEFECT["cands"]:
        fail(f"{ctx}: {len(names)} candidates != pinned {BRUNSWICK_DEFECT['cands']}")
    el = parse_elected(page, ctx)
    if el != BRUNSWICK_DEFECT_ELECTED:
        fail(f"{ctx}: defect elected cell {el} != pinned {BRUNSWICK_DEFECT_ELECTED}")


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


# ------------------------------------------------------------------ 2ppvote
def load_2ppvote():
    """Both 2018 workbooks carry identical 2PP rows (asserted); the final
    one supplies the row map. The workbooks' MP-turnover and No-of-
    candidates appendices are STALE: they document the 2014 election
    (member cells go Jane Garrett/Heidi Victoria; candidate cells sum to
    2014's 545 + 351 LC) — the stale-appendix defect, pinned shallow here
    and cross-checked properly against the vic14 frame's own certified
    roster in build_vic14_data.py."""
    def sheet_rows(path):
        wb = openpyxl.load_workbook(path, read_only=True)
        ws = wb["2PP"]
        rows = [tuple(r) for r in ws.iter_rows(values_only=True)]
        wb.close()
        return rows
    if sheet_rows(PP_FILE) != sheet_rows(PP_FILE_EARLY):
        fail("2ppvote2018.xlsx and 2ppvote2018-final.xlsx diverge")
    out = {}
    wb = openpyxl.load_workbook(PP_FILE, read_only=True)
    if wb.sheetnames != ["2PP", "MP turnover", "No of candidates"]:
        fail(f"2ppvote sheet drift {wb.sheetnames}")
    for r in wb["2PP"].iter_rows(values_only=True):
        if not isinstance(r[0], str) or r[0] == "District":
            continue
        if not (isinstance(r[1], int) and isinstance(r[3], int)):
            fail(f"2ppvote: row for {r[0]!r} not the integer pair form {r!r}")
        out[r[0]] = (r[1], r[3])
    if len(out) != 87 or set(out) & PP_MISSING:
        fail(f"2ppvote: {len(out)} rows / PP_MISSING drift {sorted(set(out) & PP_MISSING)}")
    # the stale-appendix defect, watched (see docstring)
    stale = {}
    for r in wb["MP turnover"].iter_rows(values_only=True):
        if r[0] in ("Abolished districts", "Regions"):
            break
        if isinstance(r[0], str) and r[0] != "District":
            stale[r[0]] = r[1]
    if len(stale) != 88 or stale.get("Brunswick") != "Jane Garrett" \
            or stale.get("Bayswater") != "Heidi Victoria":
        fail(f"MP-turnover appendix drifts from the pinned stale-2014 character "
             f"({len(stale)} rows; Brunswick reads {stale.get('Brunswick')!r})")
    wb.close()
    if sum(v[0] for v in out.values()) != REF_2PP_SUMS[0] \
            or sum(v[1] for v in out.values()) != REF_2PP_SUMS[1]:
        fail(f"2ppvote row sums != pinned {REF_2PP_SUMS}")
    return out


# ------------------------------------------------------------------ frame
def load_demo():
    if not os.path.exists(DEMO_STORE):
        fail(f"census store {DEMO_STORE} missing — run .build/map/build_vic18_demo.py")
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
        fail(f"SEIFA store {SEIFA_STORE} missing — run .build/map/build_vic18_seifa.py")
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
    fpv = {f[len("fpvbyvotingcentre"):-len(".html")] for f in ls if f.startswith("fpvbyvotingcentre")}
    tcp = {f[len("tcpbyvotingcentre"):-len(".html")] for f in ls if f.startswith("tcpbyvotingcentre")}
    dist_p = {f[len("distribution"):-len(".html")] for f in ls if f.startswith("distribution")}
    if tcp != {s + "district" for s in dists}:
        fail(f"tcp inventory drift: {sorted(tcp ^ {s + 'district' for s in dists})[:8]}")
    if fpv != {s + "district" for s in dists} | FPV_EXTRA:
        fail(f"fpv inventory drift: {sorted(fpv ^ ({s + 'district' for s in dists} | FPV_EXTRA))[:8]}")
    got_dist = {s[:-len("district")] for s in dist_p if s.endswith("district")}
    want_dist = {s for s in dists if s not in DIST_ABSENT}
    if got_dist != want_dist:
        fail(f"distribution inventory drift: {sorted(got_dist ^ want_dist)[:8]}")
    roll = load_roll()
    pp = load_2ppvote()
    demo, seifa = load_demo(), load_seifa()

    # display names, one read ahead (fpv/tcp/distribution h2s are re-asserted
    # against the district page's below)
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
    finals_of = {}   # for the 2ppvote reconciliation: certified finals | None
    lane_of = {}     # frame tcp lane: {buckets, alp_lnp}
    party_of_raw = {}  # district -> {raw candidate: party string}
    pagepp_of = {}   # district -> (tcp page pair buckets, page totals mapped ALP/Coal)
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

        # ---- fpv page family (Brunswick asserts its defect instead and
        # substitutes the district workbook for the venue lanes)
        h_fpv = read(os.path.join(SRC, f"fpvbyvotingcentre{slug}district.html"))
        if parse_h2(h_fpv, f"{name} fpv page") != name:
            fail(f"{name}: fpv h2 drift")
        if slug != BRUNSWICK_SLUG:
            if parse_elected(h_fpv, f"{name} fpv page") != (elected_name, elected_party):
                fail(f"{name}: fpv elected cell != district page's")
            sm_f = parse_summary(h_fpv, f"{name} fpv page")
            if sm_f != sm:
                fail(f"{name}: fpv summary drift {sm_f} vs {sm}")
            lanes = parse_fpv(h_fpv, name, roster, sm, slug)
        else:
            assert_brunswick_defect(h_fpv)
            lanes = parse_brunswick_xlsx(BR_XLSX, roster, sm)
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
        tcp_rec = parse_tcp(h_tcp, name, roster, implied, slug)
        pair = tcp_rec["pair"]
        pair_votes = (tcp_rec["cells_total"][0], tcp_rec["cells_total"][1])

        # venue sets across the venue families must agree exactly
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
        cm_row_of = {r["raw"]: r for r in by_flat}

        # ---------------- certified distribution page
        finals = None
        if slug not in DIST_ABSENT:
            h_dist = read(os.path.join(SRC, f"distribution{slug}district.html"))
            if parse_h2(h_dist, f"{name} distribution page") != name:
                fail(f"{name}: distribution page h2 drift")
            if parse_elected(h_dist, f"{name} distribution page") != (elected_name, elected_party):
                fail(f"{name}: distribution page elected cell != district page's")
            sm_d = parse_summary(h_dist, f"{name} distribution page")
            if sm_d != sm:
                fail(f"{name}: distribution page summary drift {sm_d} vs {sm}")
            finals_all = parse_distpage(h_dist, name, roster, sm)["finals"]
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
        if slug in STOP_STATE and slug in DIST_ABSENT:
            fail(f"{slug}: stop-state pin on a district with no distribution page")
        finals_of[name] = finals

        # ---------------- the district tcp lane (override where pinned)
        lane_pair = pair
        lane_votes = pair_votes
        if slug in CERTIFIED:
            h_dist = read(os.path.join(SRC, f"distribution{slug}district.html"))
            w, wv, ru, ruv = parse_certified(h_dist, name, CERTIFIED[slug], sm, roster)
            lane_pair, lane_votes = [w, ru], (wv, ruv)
            n_cert += 1
        tcpA, tcpB = idx[lane_pair[0]], idx[lane_pair[1]]
        tcp = [[tcpA, lane_votes[0]], [tcpB, lane_votes[1]]]
        lead = tcpA if lane_votes[0] >= lane_votes[1] else tcpB
        if by_flat[lead]["flat"] != elected_name:
            fail(f"{name}: tcp-lane top figure {by_flat[lead]['flat']!r} "
                 f"!= elected member {elected_name!r}")
        pair_buckets = {by_flat[idx[n]]["bucket"] for n in lane_pair}

        alp_in_pair = next((n for n in lane_pair if by_flat[idx[n]]["bucket"] == "alp"), None)
        lnp_in_pair = next((n for n in lane_pair if by_flat[idx[n]]["bucket"] == "lnp"), None)
        lane_map = None
        if pair_buckets == {"alp", "lnp"} and alp_in_pair and lnp_in_pair:
            va = lane_votes[0] if by_flat[idx[lane_pair[0]]]["bucket"] == "alp" else lane_votes[1]
            vb = lane_votes[1] if by_flat[idx[lane_pair[0]]]["bucket"] == "alp" else lane_votes[0]
            lane_map = (va, vb)
        lane_of[name] = {"buckets": pair_buckets, "alp_lnp": lane_map}
        # the tcp page's own totals as (ALP, Coalition), for the 2ppvote
        # workbook's notional-row reconciliation rule
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
                pvotes[idx[cm_row_of[r["raw"]]["flat"]]] = v["v"][i]
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
        fail(f"statewide totals ({tot_enrolled}, {tot_formal}, {tot_inf}, {tot_formal + tot_inf}) "
             f"!= REF ({REF_ENROLLED}, {REF_FORMAL}, {REF_INFORMAL}, {REF_TOTAL})")
    if tot_cands != REF_CANDIDATES:
        fail(f"candidate count {tot_cands} != REF {REF_CANDIDATES}")
    prim = {b: tot_prim[b] for b in BUCKETS}
    if prim != REF_PRIM:
        fail(f"statewide primaries {prim} != REF_PRIM {REF_PRIM}")

    # 2ppvote reconciliation (the source-block rule):
    # 1. certified classic final present -> row == that final;
    # 2. else the tcp page's pair is classic -> row == the page's totals;
    # 3. else -> pinned notional-skip class
    skipped = []
    for name in sorted(lane_of):
        if name in PP_MISSING:
            continue
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
            if name in PP_TYPOS:
                if want != PP_TYPOS[name]:
                    fail(f"{name}: the official product's pinned typo cell now reads {want}")
                if (alp_f, lnp_f) != (want[0], want[1] + 1):
                    fail(f"{name}: certified final {(alp_f, lnp_f)} is no longer the pinned typo + 1")
            elif (alp_f, lnp_f) != want:
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
           "demoBasis": "sa1", "demoYear": 2016,
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
          f" | official 2PP (2ppvote) ALP {round(100 * REF_2PP_SUMS[0] / sum(REF_2PP_SUMS), 2)}"
          f" -> {p} ({os.path.getsize(p)} bytes)")


if __name__ == "__main__":
    main()
