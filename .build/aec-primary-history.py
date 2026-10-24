"""aec-primary-history.py – the national + per-state PRIMARY-VOTE history
behind the /flows-explained/ chart's "View: Primary votes" flip.

IRSAD, IEO and IER fifths 2001–2025 ride beside the class cuts in
fed.classes (seifa_quintiles membership, one lane per index; the quintile
cell of a flow-history class is the mean of its division cells, so this
script's per-division votes roll up the same way).

One series per party family at every federal election, as % of formal first
preferences: two majors always drawn, the era's named minors drawn only
where they polled at least FOLD_PT (4%) in that view that election, in
per cent – everything below folds into Others (user call 2026-10-23:
"below 4% just displays others and above 4% displays as its own points",
so the Democrats surface only in their era and One Nation drops out of the
lean years, exactly as the flow chart's gap-nulls behave). A folded share
is a null in the JSON, never a zero.

Sources, by era:
  2004–2025  AEC first-preference downloads, cached in .build/aec-flow-src/fpv/
             (fetched here when absent; committed so tests recompute offline):
             fpv-house-nat-<year>.csv    HouseFirstPrefsByPartyDownload
             fpv-house-state-<year>.csv  HouseFirstPrefsByStateByPartyDownload
             fpv-senate-state-<year>.csv SenateFirstPrefsByStateByGroupByVoteTypeDownload
             Event ids/paths mirrored from .build/aec-flow-src/README-haul-1983-2007.md:
             2004=12246 on the old /results/ path; 2007–2025 on /<event>/Website/.
  1972–2001  HISTORY block below (typed, source-noted rows): national House
             and Senate tables from the per-election results pages (AEC-sourced,
             the aus-house-primary-history skill's canonical cuts; the skill's
             ALP/LNP House figures are the pin set). No per-state cut before
             2004 – the flow menu's per-state span matches it.

Class cuts (fed.classes): the national House figures regrouped by seat type –
"Federal, inner metro / outer metro / provincial / rural" – a division riding
the election's own AEC Divisional Classifications block
(data/division-classifications.json), so a recategorised seat moves classes
with it. Eleven elections carry a block: 1996–2001 counted from the committed
per-division candidate files (.build/aec-flow-src/hcands-*.txt, the AEC's
pre-2004 abbreviation tokens); 2004–2025 from the per-division preference
downloads (dop-*.csv.gz) at CountNumber 0 (= first preferences). The state-by-
state and Senate sheets ship no division column, so House elections are the
only base a seat-type class can cover – House-only, like the flows side.

Buckets: alp, lnp (the whole Coalition block incl. joint Senate tickets,
CLP and LNP – the poll rows' L/NP), grn, onp, dem (Australian Democrats),
dlp (Democratic Labor – crosses the fold only in 1972), uap (Palmer United
2013 / United Australia 2022, one family for display), xnt (Nick Xenophon
Team / Centre Alliance), jln (Jacqui Lambie Network), ind (independents,
incl. named-person Senate groups), oth. dem/dlp/uap/xnt/jln/ind are FOLDED
gated like grn/onp: the fold rule is per view per election, so Xenophon's
SA cohort surfaces inside the SA cuts while staying part of Others
nationally. One-cut spikes that cross FOLD_PT in a single state-chamber
view – Family First in SA 2004–13, LDP in NSW Senate 2013 / NT 2022,
Legalise Cannabis in the 2022–25 NT/WA/Qld cuts, Derryn Hinch's Justice
Party in Vic 2016 and their likes – stay inside oth BY DESIGN: the chart
tracks the families above, and every unmapped name still lands on the
printed adjudication list after each run. A new family is a deliberate
copy/token decision, never an accident of the fold.

Usage: python3 .build/aec-primary-history.py [--check]
  default writes data/primary-history.json; --check re-derives and compares.
"""
import csv, gzip, io, json, os, sys, urllib.request

from seifa_quintiles import INDEX_META, QIDXES, SEIFA_YEARS, elections_suffix, membership as seifa_membership

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "aec-flow-src", "fpv")
OUT = os.path.join(ROOT, "data", "primary-history.json")
UA = "Mozilla/5.0 (auspol-tracker data update)"

FOLD_PT = 4.0

# year -> (event id, url path segment). ext=.csv everywhere (2004's menu
# offers .csv only; 2013+ offer .txt too – one parser, one format).
EVENTS = {
    2004: (12246, "results"), 2007: (13745, "Website"), 2010: (15508, "Website"),
    2013: (17496, "Website"), 2016: (20499, "Website"), 2019: (24310, "Website"),
    2022: (27966, "Website"), 2025: (31496, "Website"),
}
URLS = {
    2004: "https://results.aec.gov.au/{ev}/results/Downloads/{name}-{ev}.csv",
}
for y, (ev, base) in EVENTS.items():
    if y != 2004:
        URLS[y] = "https://results.aec.gov.au/{ev}/Website/Downloads/{name}-{ev}.csv"

STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"]
STATE_FULL = {"nsw": "New South Wales", "vic": "Victoria", "qld": "Queensland",
              "wa": "Western Australia", "sa": "South Australia", "tas": "Tasmania",
              "act": "Australian Capital Territory", "nt": "Northern Territory"}
# the flow-history states' short forms — the explainer menus and tooltips
# show these ("Federal, NT"), never the full name spelt out
STATE_SHORT = {"nsw": "NSW", "vic": "Vic", "qld": "Qld", "wa": "WA",
               "sa": "SA", "tas": "Tas", "act": "ACT", "nt": "NT"}

# ---- party families ---------------------------------------------------------
# Every PartyNm (House files) and GroupNm (Senate files) in the committed
# caches must resolve exactly one bucket; the sets below enumerate the live
# vocabulary (dumped from the caches 2026-10-23). Lowercased; matched exact.
MAJ_ALP_NM = {"australian labor party", "labor", "a.l.p.",
              "australian labor party (act branch)", "australian labor party (alp)",
              "australian labor party (northern territory) branch", "labor/country labor",
              # "Country Labor" -- Labor's rural-NSW banner in the per-division
              # dop files (the fpv sheets print the joint "Labor/Country Labor"
              # instead, so this token only ever fires on the class-cut path)
              "country labor"}
MAJ_COAL_NM = {"liberal", "the nationals", "national party", "nationals",
               "clp - the territory party", "clp-the territory party",
               # 2007's per-division dop abbreviates the NT party "C.L.P."
               "c.l.p.",
               "country liberal party (nt)", "country liberals", "country liberals (nt)",
               "nt clp", "northern territory country liberal party",
               "liberal national party", "liberal national party of queensland", "lnp",
               "liberal/nationals", "liberal/the nationals", "liberal & nationals",
               "liberal party of australia,nsw division-national party of australia nsw"}
GRN_NM = {"the greens", "australian greens", "queensland greens",
          "the greens (vic)", "the greens (wa)",
          # 2025's per-division dop renames the WA branch "The Greens (WA) Inc"
          "the greens (wa) inc"}
ONP_NM = {"one nation", "pauline hanson's one nation",
          "pauline hanson's one nation (nsw division)", "one nation wa", "pauline"}
DEM_NM = {"australian democrats", "democrats"}
DLP_NM = {"dlp - democratic labor party", "dlp - democratic labour party",
          "d.l.p. - democratic labor party", "dlp democratic labour",
          "democratic labor party (dlp) of australia", "democratic labour party",
          "democratic labour party (dlp)", "labour dlp"}
UAP_NM = {"palmer united party", "united australia party", "uap"}
XNT_NM = {"nick xenophon team", "centre alliance", "nick xenophon group"}
JLN_NM = {"jacqui lambie network"}
IND_NM = {"independent", "non affiliated", "unendorsed/ungrouped amalgamated",
          "david pocock", "kim for canberra"}

FAMILY = {}
for _b, _set in (("alp", MAJ_ALP_NM), ("lnp", MAJ_COAL_NM), ("grn", GRN_NM),
                 ("onp", ONP_NM), ("dem", DEM_NM), ("dlp", DLP_NM),
                 ("uap", UAP_NM), ("xnt", XNT_NM), ("jln", JLN_NM), ("ind", IND_NM)):
    for _n in _set:
        FAMILY[_n] = _b
GATED = ["grn", "onp", "dem", "dlp", "uap", "xnt", "jln", "ind"]
ALL_BUCKETS = ["alp", "lnp"] + GATED + ["oth"]

# Pre-2004 typed block (verified per-election results tables; see
# HISTORY_SOURCES beside HISTORY). Shares of FORMAL first preferences.
# grn/onp/uap/jln/xnt absent where the party did not exist (None); a value
# that exists but sits under FOLD_PT is still recorded raw - the fold is
# applied uniformly at emit, so the 2001 One Nation (4.34) and the 1996
# Democrats (6.76) both reach the display exactly as later rows do.
# The DLP row is None (not 0) where the national table keeps the party in
# its Others lump (1993H/1996H/1998H/2001H, 1983S) - it never clears the
# fold after 1972's 5.25 anyway. No 1972 senate row: no national Senate
# election that year (half-Senate cycle; only a Queensland casual-vacancy
# by-election was held).
HISTORY = {
    "house": {
        1972: {"alp": 49.59, "lnp": 41.48, "dlp": 5.25, "ind": 0.96},
        1974: {"alp": 49.30, "lnp": 45.73, "dlp": 1.42, "ind": 0.40},
        1975: {"alp": 42.84, "lnp": 53.05, "dlp": 1.32, "ind": 0.82},
        1977: {"alp": 39.65, "lnp": 48.11, "dem": 9.38, "dlp": 1.43, "ind": 0.63},
        1980: {"alp": 45.15, "lnp": 46.40, "dem": 6.57, "dlp": 0.31, "ind": 0.70},
        1983: {"alp": 49.48, "lnp": 43.61, "dem": 5.03, "dlp": 0.20, "grn": 0.10, "ind": 0.59},
        1984: {"alp": 47.55, "lnp": 45.01, "dem": 5.45, "dlp": 0.57, "ind": 1.04},
        1987: {"alp": 45.90, "lnp": 45.90, "dem": 6.00, "dlp": 0.04, "ind": 1.66},
        1990: {"alp": 39.44, "lnp": 43.46, "dem": 11.26, "dlp": 0.03, "grn": 1.37, "ind": 2.60},
        1993: {"alp": 44.92, "lnp": 44.27, "dem": 3.75, "grn": 1.85, "ind": 3.11},
        1996: {"alp": 38.75, "lnp": 47.25, "dem": 6.76, "grn": 2.92, "ind": 2.41},
        1998: {"alp": 40.10, "lnp": 39.51, "dem": 5.13, "grn": 2.62, "onp": 8.43, "ind": 1.76},
        2001: {"alp": 37.84, "lnp": 43.01, "dem": 5.41, "grn": 4.96, "onp": 4.34, "ind": 2.89},
    },
    "senate": {
        1974: {"alp": 47.29, "lnp": 43.88, "dlp": 3.56, "ind": 2.12},
        1975: {"alp": 40.91, "lnp": 51.74, "dlp": 2.67, "ind": 1.60},
        1977: {"alp": 36.76, "lnp": 45.56, "dem": 11.13, "dlp": 1.67, "ind": 1.73},
        1980: {"alp": 42.25, "lnp": 43.58, "dem": 9.25, "dlp": 0.41, "ind": 1.13},
        1983: {"alp": 45.49, "lnp": 39.97, "dem": 9.57, "ind": 2.42},
        1984: {"alp": 42.17, "lnp": 39.54, "dem": 7.62, "dlp": 0.37, "ind": 0.39},
        1987: {"alp": 42.83, "lnp": 42.03, "dem": 8.47, "dlp": 0.54, "grn": 0.43, "ind": 1.54},
        1990: {"alp": 38.41, "lnp": 41.92, "dem": 12.63, "dlp": 0.15, "grn": 2.10, "ind": 0.30},
        1993: {"alp": 43.50, "lnp": 43.05, "dem": 5.31, "dlp": 0.36, "grn": 2.95, "ind": 1.13},
        1996: {"alp": 36.15, "lnp": 43.97, "dem": 10.82, "dlp": 0.33, "grn": 3.17, "ind": 0.38},
        1998: {"alp": 37.31, "lnp": 37.70, "dem": 8.45, "dlp": 0.27, "grn": 2.72, "onp": 8.99, "ind": 0.52},
        2001: {"alp": 34.32, "lnp": 41.83, "dem": 7.25, "dlp": 0.57, "grn": 4.94, "onp": 5.54, "ind": 0.69},
    },
}

# Records behind every typed HISTORY row, read 2026-10-23: the AEC-sourced
# per-election results tables and Adam Carr's AEC-mirror Psephos .txt
# summaries, every bucket vote-checked (buckets sum to the formal total ±
# rounding). Reconciliations, never averaged:
#   1974S lnp 43.88 keeps WA's National Alliance (0.84) inside the Coalition
#         - the merged CP+DLP ticket's senator sat with the Country Party,
#         per the election table's own footnote; Psephos's narrower lump
#         prints 43.58.
#   1983S/2001S: the two references' formal totals sit a few hundred votes
#         apart (7,995,045 v 7,997,549; 11,627,529 v 11,627,805) - the
#         results-table prints are typed; bucket shifts are <=0.01 at 2dp
#         (1983S alp/lnp alternates 45.48/39.96).
#   1987S lnp 42.03 includes the NT Nationals per the APH convention the
#         table follows (Psephos's narrower convention prints 41.94).
#   Table misprints corrected from the vote counts (2001H Others 1.64->1.55,
#   1977S Call to Australia 1.12->0.67) sit only inside lump rows the fold
#   absorbs, so no typed cell is affected.
HISTORY_SOURCES = {
    "house": {
        1972: ["https://en.wikipedia.org/wiki/1972_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1972/1972reps1.txt"],
        1974: ["https://en.wikipedia.org/wiki/1974_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1974/1974reps1.txt"],
        1975: ["https://en.wikipedia.org/wiki/1975_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1975/1975reps1.txt"],
        1977: ["https://en.wikipedia.org/wiki/1977_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1977/1977reps1.txt"],
        1980: ["https://en.wikipedia.org/wiki/1980_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1980/1980reps1.txt"],
        1983: ["https://en.wikipedia.org/wiki/1983_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1983/1983reps1.txt"],
        1984: ["https://en.wikipedia.org/wiki/1984_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1984/1984reps1.txt"],
        1987: ["https://en.wikipedia.org/wiki/1987_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1987/1987reps1.txt"],
        1990: ["https://en.wikipedia.org/wiki/1990_Australian_federal_election",
               "https://en.wikipedia.org/wiki/1990_Australian_House_of_Representatives_election",
               "https://psephos.adam-carr.net/countries/a/australia/1990/1990reps1.txt"],
        1993: ["https://en.wikipedia.org/wiki/1993_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1993/1993reps1.txt"],
        1996: ["https://en.wikipedia.org/wiki/1996_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1996/1996reps1.txt"],
        1998: ["https://en.wikipedia.org/wiki/1998_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/1998/1998reps1.txt"],
        2001: ["https://en.wikipedia.org/wiki/2001_Australian_federal_election",
               "https://psephos.adam-carr.net/countries/a/australia/2001/2001reps1.txt"],
    },
    "senate": {
        1974: ["https://en.wikipedia.org/wiki/1974_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1974/1974senate1.txt"],
        1975: ["https://en.wikipedia.org/wiki/1975_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1975/1975senate1.txt"],
        1977: ["https://en.wikipedia.org/wiki/1977_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1977/1977senate1.txt"],
        1980: ["https://en.wikipedia.org/wiki/1980_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1980/1980senate1.txt"],
        1983: ["https://en.wikipedia.org/wiki/1983_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1983/1983senate1.txt"],
        1984: ["https://en.wikipedia.org/wiki/1984_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1984/1984senate1.txt"],
        1987: ["https://en.wikipedia.org/wiki/1987_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1987/1987senate1.txt"],
        1990: ["https://en.wikipedia.org/wiki/1990_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1990/1990senate1.txt"],
        1993: ["https://en.wikipedia.org/wiki/1993_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1993/1993senate1.txt"],
        1996: ["https://en.wikipedia.org/wiki/1996_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1996/1996senate1.txt"],
        1998: ["https://en.wikipedia.org/wiki/1998_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/1998/1998senate1.txt"],
        2001: ["https://en.wikipedia.org/wiki/2001_Australian_Senate_election",
               "https://psephos.adam-carr.net/countries/a/australia/2001/2001senate1.txt"],
    },
}

# ---- fetch ------------------------------------------------------------------
def fetch(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"user-agent": UA})
    with urllib.request.urlopen(req, timeout=60) as res, open(path, "wb") as f:
        f.write(res.read())
    print("fetched", os.path.basename(path), "<-", url)

def fetch_all():
    for y in sorted(EVENTS):
        ev = EVENTS[y][0]
        cache = lambda n: os.path.join(SRC, f"fpv-{n}-{y}.csv")
        fetch(URLS[y].format(ev=ev, name="HouseFirstPrefsByPartyDownload"), cache("house-nat"))
        fetch(URLS[y].format(ev=ev, name="HouseFirstPrefsByStateByPartyDownload"), cache("house-state"))
        fetch(URLS[y].format(ev=ev, name="SenateFirstPrefsByStateByGroupByVoteTypeDownload"), cache("senate-state"))

# ---- parse ------------------------------------------------------------------
def read_sheet(path):
    """AEC download: banner line, then one header row, then data."""
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    head_i = next(i for i, r in enumerate(rows) if r and r[0] in ("PartyAb", "StateAb"))
    return rows[head_i], [r for r in rows[head_i + 1:] if len(r) > 1]

UNMAPPED = []  # names that fell through FAMILY into oth, printed for review

def parse_votes(path, state_col=None, name_col=None, votes_col="TotalVotes"):
    """sum TotalVotes by (state, bucket). state_col=None -> national.
       An unmapped name lumps into oth AND lands on UNMAPPED for review -
       nothing is silently bucketed, but a fringe slate never blocks a run."""
    head, rows = read_sheet(path)
    h = {c: i for i, c in enumerate(head)}
    iv, inm = h[votes_col], h[name_col]
    ist = h[state_col] if state_col else None
    votes = {}
    for r in rows:
        nm = r[inm].strip()
        if not nm:
            continue
        st = r[ist].strip().lower() if ist is not None else "nat"
        b = FAMILY.get(nm.lower())
        if b is None:
            b = "oth"
            UNMAPPED.append((nm, os.path.basename(path)))
        v = float(r[iv])
        votes.setdefault(st, {}).setdefault(b, 0.0)
        votes[st][b] += v
    return votes

def shares(votes_by_cut):
    """votes -> per-cut % shares, majors + named buckets + residual oth with
       the FOLD_PT gate: a gated bucket under 4% folds into oth (null out)."""
    cuts = {}
    for cut, by in votes_by_cut.items():
        tot = sum(by.values())
        pcts = {b: 100.0 * v / tot for b, v in by.items()}
        cuts[cut] = (tot, pcts)
    return cuts

# ---- class cuts -------------------------------------------------------------
# key -> (label, short), in menu order; copy matches the flows chart's
# fed.classes views, which the state-by-state menu shows beside these.
CLASS_META = (("inner", "Inner metropolitan", "inner metro"),
              ("outer", "Outer metropolitan", "outer metro"),
              ("provincial", "Provincial", "provincial"),
              ("rural", "Rural", "rural"))
CLS_KEY = {"inner metropolitan": "inner", "outer metropolitan": "outer",
           "provincial": "provincial", "rural": "rural"}
# the years a Divisional Classifications block exists for: every AEC-download
# election plus the three legacy years counted from hcands files.
CLASS_YEARS = [1996, 1998, 2001] + sorted(EVENTS)

# legacy hcands party tokens (the AEC's pre-2004 abbreviation set) -> bucket:
# the flow side's map in aec-flow-history.py, widened with DEM/IND for the
# primary chart. CLR is Country Labor (Labor's rural-NSW banner until 2013);
# GWA/AGV/TG are the era's other greens parties; HAN is One Nation's token
# (its 1998 recomposition lands on the documented 8.43% national share).
LEGACY_PARTY = {
    "ALP": "alp", "CLR": "alp",
    "LP": "lnp", "NP": "lnp", "CLP": "lnp", "LNP": "lnp", "NAT": "lnp", "LIB": "lnp",
    "GRN": "grn", "GWA": "grn", "AGV": "grn", "TG": "grn",
    "HAN": "onp", "ON": "onp",
    "DEM": "dem", "DLP": "dlp",
    "IND": "ind", "OTH": "oth",
}

def hcands_class_votes(year):
    """hcands-<year>.txt -> {division: {bucket: votes}} at first preferences."""
    path = os.path.join(SRC, "..", f"hcands-{year}.txt")
    votes = {}
    with open(path, encoding="utf-8-sig") as f:
        lines = f.read().splitlines()
    head = lines[0].split(";")
    dcol, pcol, vcol = head.index("Division"), head.index("Party"), head.index("Vote")
    for ln in lines[1:]:
        c = ln.split(";")
        if len(c) <= vcol or not c[vcol].strip():
            continue
        tok = c[pcol].strip()
        b = LEGACY_PARTY.get(tok)
        if b is None and tok:
            b = "oth"
            UNMAPPED.append((tok, os.path.basename(path)))
        elif b is None:
            b = "oth"   # an unlabelled cell is an ungrouped candidate
        div = c[dcol].strip()
        votes.setdefault(div, {}).setdefault(b, 0.0)
        votes[div][b] += float(c[vcol])
    return votes

def dop_class_votes(year):
    """dop-<year>.csv.gz -> {division: {bucket: votes}}: the count-0 Preference
       Count rows are each candidate's first preferences for their seat."""
    path = os.path.join(SRC, "..", f"dop-{year}.csv.gz")
    votes = {}
    with gzip.open(path, "rt", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    hi = next(i for i, r in enumerate(rows) if r and r[0] == "StateAb")
    h = {c: i for i, c in enumerate(rows[hi])}
    ict, icn, idiv, ipty, ival = (h["CalculationType"], h["CountNumber"],
                                  h["DivisionNm"], h["PartyNm"], h["CalculationValue"])
    for r in rows[hi + 1:]:
        if len(r) <= 1:
            continue
        if r[ict] != "Preference Count" or int(r[icn]) != 0:
            continue
        nm = r[ipty].strip().lower()
        if nm:
            b = FAMILY.get(nm)
            if b is None:
                b = "oth"
                UNMAPPED.append((nm, os.path.basename(path)))
        else:
            b = "oth"   # ungrouped candidates carry an empty party cell
        div = r[idiv].strip()
        votes.setdefault(div, {}).setdefault(b, 0.0)
        votes[div][b] += float(r[ival])
    return votes

def class_shares(blocks):
    """Build {classKey: {year: pcts}} over CLASS_YEARS, joining each year's
       per-division votes to that election's Divisional Classifications block.
       The join is exact by construction (the blocks and the AEC division files
       share namings), so a mismatch asserts rather than dropping a seat."""
    out = {k: {} for k, _, _ in CLASS_META}
    recon = {}   # year -> national pcts recomposed from the same ballots
    for y in CLASS_YEARS:
        blk = blocks.get(str(y))
        if not blk:
            continue
        votes = hcands_class_votes(y) if y < 2004 else dop_class_votes(y)
        assert set(votes) == set(blk), \
            f"{y}: class join drifted - counted {sorted(set(votes) - set(blk))[:3]}, classified-only {sorted(set(blk) - set(votes))[:3]}"
        per = {k: {} for k, _, _ in CLASS_META}
        nat = {}
        for div, bks in votes.items():
            ck = CLS_KEY[blk[div]["classification"].lower()]
            for b, v in bks.items():
                per[ck][b] = per[ck].get(b, 0.0) + v
                nat[b] = nat.get(b, 0.0) + v
        recon[y] = nat
        for ck, _, _ in CLASS_META:
            out[ck][y] = shares({"c": per[ck]})["c"][1]
    return out, {y: shares({"n": nat})["n"][1] for y, nat in recon.items()}

def quint_shares():
    """({index: {quintKey: {year: pcts}}}, {year: nat pcts}) over
       SEIFA_YEARS: the same hcands/dop per-division first preferences
       regrouped by seifa_quintiles' memberships, one lane per index
       (each index read advantage-ordered, 1 = most advantaged – IRSAD on
       the store's census-interpolated percentile where it ships one, the
       census-filed rank otherwise). 2001 rides hcands,
       the downloads era the same dop read the class lane uses; the join
       asserts exact like the class lane's, and recon must equal the
       class lane's nat sums – the same ballots partitioned two ways,
       and every index's nat sums must tally identical ballots."""
    out = {ix: {m[0]: {} for m in INDEX_META[ix]["meta"]} for ix in QIDXES}
    recon = {}
    for y in SEIFA_YEARS:
        votes = hcands_class_votes(y) if y < 2004 else dop_class_votes(y)
        for ix in QIDXES:
            mem = seifa_membership(y, ix)
            assert set(votes) == set(mem), \
                f"{y} {ix}: quintile join drifted - counted {sorted(set(votes) - set(mem))[:3]}, quintilised-only {sorted(set(mem) - set(votes))[:3]}"
            per = {m[0]: {} for m in INDEX_META[ix]["meta"]}
            nat = {}
            for div, bks in votes.items():
                qk = mem[div]["classification"]
                for b, v in bks.items():
                    per[qk][b] = per[qk].get(b, 0.0) + v
                    nat[b] = nat.get(b, 0.0) + float(v)
            if ix == QIDXES[0]:
                recon[y] = nat
            else:  # the same ballots under the second index's partition
                for b, v in nat.items():
                    assert abs(v - recon[y].get(b, 0.0)) < 0.001, \
                        f"{y} {b}: {ix} nat sum {v} != {QIDXES[0]}'s {recon[y].get(b)}"
            for qk, _, _, _ in INDEX_META[ix]["meta"]:
                out[ix][qk][y] = shares({"q": per[qk]})["q"][1]
    return out, {y: shares({"n": nat})["n"][1] for y, nat in recon.items()}

# ---- history-aware emit ------------------------------------------------------
def fold_series(year_rows, fold_pt=FOLD_PT):
    """year_rows: {year: {bucket: pct}} with raw buckets (unaligned ok).
       Returns (years, {bucket: [values|None aligned to years]}).
       fold_pt is FOLD_PT everywhere but the SEIFA-fifth lanes: a fifth is
       30-31 seats where a bucket polling ~4% nationally lands 1.7–9%, so
       the shared 4% gate would knock out cells a class view of the same
       size draws; the lanes pass FOLD_PT/2 (quintile cells of a class
       view must fold to the class view's nulls, and the national gate
       stays untouched)."""
    years = sorted(year_rows)
    out = {b: [] for b in ALL_BUCKETS}
    for y in years:
        row = year_rows[y]
        shown = {"alp", "lnp"}
        for g in GATED:
            v = row.get(g)
            if v is not None and v >= fold_pt:
                shown.add(g)
        for b in ALL_BUCKETS:
            if b == "oth":
                continue
            out[b].append(round(row[b], 2) if b in shown and row.get(b) is not None else None)
        oth = 100.0 - sum(row[b] for b in ALL_BUCKETS if b != "oth" and b in shown and row.get(b) is not None)
        out["oth"].append(round(oth, 2))
    return years, out

def build():
    fetch_all()
    aec_house_nat = {}
    for y in sorted(EVENTS):
        v = parse_votes(os.path.join(SRC, f"fpv-house-nat-{y}.csv"),
                        None, "PartyNm")
        aec_house_nat[y] = v.get("nat", {})
    # cross-check: spec column TotalPercentage vs votes-derived share (major rows)
    head, rows = read_sheet(os.path.join(SRC, "fpv-house-nat-2025.csv"))
    h = {c: i for i, c in enumerate(head)}
    for r in rows:
        if r[h["PartyAb"]] == "ALP":
            assert abs(float(r[h["TotalPercentage"]]) - 34.56) < 0.02, "2025 ALP spec column drifted"
    # pinned canonical ALP/LNP House figures (aus-house-primary-history skill); ±0.03 sum-rounding room
    # 2010 EXCEPTION: the skill table's 43.32 is a Wikipedia-propagated transcription error
    # (the Nationals' 3.73% recorded as 3.43). The AEC's own machine download,
    # human-readable national page and electionresources.org all give
    # Coalition 5,408,630 / 12,402,363 = 43.61 – the AEC record is the pin.
    CANON = {2004: (37.63, 46.71), 2007: (43.38, 42.09), 2010: (37.99, 43.61),
             2013: (33.38, 45.55), 2016: (34.73, 42.04), 2019: (33.34, 41.44),
             2022: (32.58, 35.70), 2025: (34.56, 31.82)}
    for y, (a, l) in CANON.items():
        p = aec_house_nat[y]
        assert abs(100 * p["alp"] / sum(p.values()) - a) < 0.03, f"{y} ALP"
        assert abs(100 * p["lnp"] / sum(p.values()) - l) < 0.03, f"{y} L/NP"

    # Pinned canonical ALP/LNP House figures 1972-2001, guarding the typed
    # HISTORY block: the aus-house-primary-history skill's table, with FIVE
    # AEC-record corrections (same doctrine as the 2010 exception above),
    # each votes-verified 2026-10-23 against the AEC-sourced results tables:
    #   1977 L/NP 48.20 -> 48.11   (3,811,340 / 7,922,854  = 48.105)
    #   1983 L/NP 43.57 -> 43.61   (3,787,151 / 8,684,862  = 43.607 - 43.57 is
    #     the Coalition-article table, whose own component sum contradicts it)
    #   1987 ALP 45.76 -> 45.90    (4,238,663 / 9,235,086  = 45.898 - the
    #     summary-table trap the skill's trap-1 documents, on the ALP row too)
    #   1996 ALP 38.69 -> 38.75    (4,217,765 / 10,883,852 = 38.752 - 38.69 is
    #     the Liberal row's own share, transposed)
    #   1998 L/NP 39.52 -> 39.51   (4,388,809 / 11,109,063 = 39.5052)
    HISTORY_CANON = {1972: (49.59, 41.48), 1974: (49.30, 45.73), 1975: (42.84, 53.05),
                     1977: (39.65, 48.11), 1980: (45.15, 46.40), 1983: (49.48, 43.61),
                     1984: (47.55, 45.01), 1987: (45.90, 45.90), 1990: (39.44, 43.46),
                     1993: (44.92, 44.27), 1996: (38.75, 47.25), 1998: (40.10, 39.51),
                     2001: (37.84, 43.01)}
    for y, (a, l) in HISTORY_CANON.items():
        h = HISTORY["house"][y]
        assert abs(h["alp"] - a) < 0.005, f"{y} HISTORY ALP drifted"
        assert abs(h["lnp"] - l) < 0.005, f"{y} HISTORY L/NP drifted"

    # class cuts: national first preferences regrouped by the election's own
    # seat classifications (the fed.classes views the primary chart's "Federal,
    # <class>" menu options read). Recomposition pins: the same ballots summed
    # per class must re-derive the election's canonical national majors, plus
    # the era checks the token maps hang on (the 1996/1998/2001 legacy
    # abbreviation sets against HISTORY's typed grn/dem/onp figures).
    cls_blocks = json.load(open(os.path.join(ROOT, "data", "division-classifications.json"), encoding="utf-8"))["elections"]
    class_rows, class_recon = class_shares(cls_blocks)
    assert [y for y, row in class_rows["inner"].items() if row] == CLASS_YEARS, \
        "a classification block is missing for one of CLASS_YEARS"
    for y in CLASS_YEARS:
        p = class_recon[y]
        canon = CANON.get(y) or HISTORY_CANON.get(y)
        assert abs(p["alp"] - canon[0]) < 0.05, f"{y} class recomposition ALP {p['alp']:.3f} != {canon[0]}"
        assert abs(p["lnp"] - canon[1]) < 0.05, f"{y} class recomposition L/NP {p['lnp']:.3f} != {canon[1]}"
    assert abs(class_recon[1996]["grn"] - 2.92) < 0.05, "hcands greens token map"
    assert abs(class_recon[1996]["dem"] - 6.76) < 0.05, "hcands Democrat token map"
    assert abs(class_recon[1998]["onp"] - 8.43) < 0.02, "hcands One Nation (HAN) token map"

    house_nat_rows = {y: shares({"nat": aec_house_nat[y]})["nat"][1] for y in sorted(EVENTS)}
    # merge typed history
    for y, row in HISTORY["house"].items():
        house_nat_rows[int(y)] = {b: v for b, v in row.items() if b in ALL_BUCKETS and v is not None}
    years_h, house_nat = fold_series(house_nat_rows)

    house_state_rows = {s: {} for s in STATES}
    sen_national = {}
    sen_state_rows = {s: {} for s in STATES}
    for y in sorted(EVENTS):
        vh = parse_votes(os.path.join(SRC, f"fpv-house-state-{y}.csv"),
                         "StateAb", "PartyNm")
        hs = shares(vh)
        for st, (tot, pcts) in hs.items():
            house_state_rows[st][y] = pcts
        vs = parse_votes(os.path.join(SRC, f"fpv-senate-state-{y}.csv"),
                         "StateAb", "GroupNm")
        ss = shares(vs)
        sen_national[y] = {b: sum(vs[s].get(b, 0.0) for s in STATES) /
                              sum(sum(vs[s].values()) for s in STATES) * 100.0
                              for b in {bb for s in vs for bb in vs[s]}}
        for st, (tot, pcts) in ss.items():
            sen_state_rows[st][y] = pcts
    for y, row in HISTORY["senate"].items():
        sen_national[int(y)] = {b: v for b, v in row.items() if b in ALL_BUCKETS and v is not None}
    years_s, sen_nat = fold_series(sen_national)

    def view(label, elections, years, series, states=None, short=None):
        d = {"label": label, "elections": elections, "years": years}
        if short:
            d["short"] = short
        for b in ALL_BUCKETS:
            vals = series[b]
            if b in ("alp", "lnp", "oth") or any(v is not None for v in vals):
                d[b] = vals
        if states:
            d["states"] = states
        return d

    hs_states = {}
    for s in STATES:
        ys, ser = fold_series(house_state_rows[s])
        hs_states[s] = view(STATE_FULL[s], STATE_FULL[s] + " electorates at federal elections", ys, ser,
                            short=STATE_SHORT[s])
    sn_states = {}
    for s in STATES:
        ys, ser = fold_series(sen_state_rows[s])
        sn_states[s] = view(STATE_FULL[s], STATE_FULL[s] + " Senate", ys, ser,
                            short=STATE_SHORT[s])

    doc = {
        "_comment": "GENERATED by .build/aec-primary-history.py – primary-vote history behind the flows-explained chart's Primary votes view. Shares of formal first preferences; named minors present only where >= 4% of a view's vote (null otherwise, folded into oth). 2004-> from committed AEC caches (.build/aec-flow-src/fpv/); 1972–2001 typed in the script's HISTORY block. fed.classes = the House share regrouped by the AEC's per-election division classifications (1996–2025, House only – divisions have no Senate or state line).",
        "foldPt": FOLD_PT,
        "fed": view("Federal", "Australian federal elections", years_h, house_nat, states=hs_states),
    }
    doc["fed"]["sen"] = view("Federal Senate", "Australian Senate elections", years_s, sen_nat, states=sn_states)
    doc["fed"]["classes"] = {}
    for ck, label, short in CLASS_META:
        ys, ser = fold_series(class_rows[ck])
        doc["fed"]["classes"][ck] = view(label, f"federal elections in {short} seats", ys, ser, short=short)
    # The SEIFA fifths file as ten more entries in the SAME classes bank,
    # after the four classifications - five per index (the explainer menu
    # reads the bank straight; the charts fork their captions on the
    # seifa flag and each record's ix names its index). Their fold gate
    # is halved: a fifth prices 30-31 seats against a class view's 20-50,
    # so the quarters the national gate nulls in a 150-seat view are
    # still drawn here (foldSeries' docstring).
    quint_rows, quint_recon = quint_shares()
    for ix in QIDXES:
        first = INDEX_META[ix]["meta"][0][0]
        assert [y for y, row in quint_rows[ix][first].items() if row] == list(SEIFA_YEARS), \
            f"a seifa membership block is missing for one of SEIFA_YEARS ({ix})"
    # recomposition: the fifths partition the same ballots the class lane
    # partitions, so their nat sums must equal the class lane's exactly
    # (both are sums of the same per-division votes)
    for y in SEIFA_YEARS:
        for b in ALL_BUCKETS:
            qa = quint_recon[y].get(b, 0.0)
            ca = class_recon[y].get(b, 0.0)
            assert abs(qa - ca) < 0.001, f"{y} {b} quintile recomposition {qa} != class {ca}"
    # per index, five fifths in the SAME classes bank, each record's ix
    # naming its index; the IRSAD lane's elections copy names the
    # interpolated-percentile basis where the store ships one
    for ix in QIDXES:
        basis = elections_suffix() if ix == "irsad" \
            else f"of seats by {ix.upper()} rank"
        for q, qlbl, qshort, qdesc in INDEX_META[ix]["meta"]:
            ys, ser = fold_series(quint_rows[ix][q], fold_pt=FOLD_PT / 2)
            doc["fed"]["classes"][q] = {"seifa": True, "ix": ix, "foldPt": FOLD_PT / 2,
                                        **view(qlbl, f"federal elections in the {qdesc} {basis}",
                                               ys, ser, short=qshort)}
    return doc

def main():
    doc = build()
    original = None
    if os.path.exists(OUT) and "--check" in sys.argv:
        original = json.load(open(OUT))
    if "--check" in sys.argv:
        if original != doc:
            print("CHECK FAIL: data/primary-history.json is not what the script builds", file=sys.stderr)
            sys.exit(1)
        print("check ok")
        return
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=1, separators=(",", ": "))
        f.write("\n")
    print("wrote", os.path.relpath(OUT, ROOT))
    names = sorted({n for n, _ in UNMAPPED})
    if names:
        print("\nunmapped names lumped into oth (adjudicate FAMILY if wrong):")
        print("  " + ", ".join(names))
    for chan, yy, ser in (("House", doc["fed"]["years"], doc["fed"]),
                          ("Senate", doc["fed"]["sen"]["years"], doc["fed"]["sen"])):
        print(f"\n{chan} national:")
        shown = [b for b in ALL_BUCKETS if b in ser]
        print("      " + "  ".join(f"{b:>6}" for b in shown))
        for i, y in enumerate(yy):
            print(f"  {y}: " + "  ".join(("  null" if ser[b][i] is None else f"{ser[b][i]:6.2f}") for b in shown))

if __name__ == "__main__":
    main()
