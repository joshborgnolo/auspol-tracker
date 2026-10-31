#!/usr/bin/env python3
"""Voter-footprint SEIFA per booth, elections 2016/2019/2022/2025.

Complement of the venue-proxy stores (derive-booth-seifa-2025.py /
derive-booth-seifa-hist.py, which key each booth to the SA1 of its
PREMISES). This store weights SEIFA by where each booth's VOTERS LIVE,
from the AEC "Votes by SA1" product (roll mark-off x polling-place
results; the AEC flags the counts "indicative… not directly comparable
to vote counts due to rounding" — reconciled against the committed FPV
per-booth totals on every run and recorded in the store's counts).

Emits one data/booth-seifa-voter-YYYY.json per election (the footprint
exists only for 2016+ — the AEC published no SA1/CCD product earlier).

Concordance: the file's 7-digit ccd_id/SA1_id IS the 11-digit SA1 code
with the SA4+SA3 digits dropped (code[0] + code[5:11]) — verified
injective on all three ASGS editions (pins below). The 2019 lane joins
the 2016-census cube DIRECTLY on its 7-digit key column. The 2016 lane's
votes sit on ASGS 2011 SA1s, but the election (2 July 2016) fell five
weeks before the 2016 census, so since 2026-10-25 (flows-explained
review: the division store and the venue store both read 2016 against
the 2016 census) its scores walk each 2011 SA1's votes onto 2016 SA1s by
the ABS CG_SA1_2011_SA1_2016 correspondence and join the 2016 cube; its
demo block keeps the Ed1->Ed3 walk. The 2025 lane decodes to SA1_CODE21 first; the
2022 lane decodes to SA1_MAIN16 then redistributes via the ABS Ed2->Ed3
correspondence (RATIO_FROM_TO shares) to reach the same 2021-census cube.
Per-index SEIFA suppression is partial within an SA1, so each index
weights over its own covered-vote denominator (recorded per unit in cov).
Sentinel SA1 ids (ABS migratory/no-usual-address; shapes …9999 and the
2016-era OT form 9999901) carry no scores: their votes are counted
(counts.votesSentinel, ids pinned in counts.sentinelIds) and excluded
from weights.
pp_id 0 rows are division-level declaration cohorts (Postal/Pre-Poll/
Absent/Provisional) — kept as per-division cohort units, never as booths.

Inputs (git-ignored caches under .build/analysis/seat-model/cache/votes-sa1/,
re-fetch manifest on missing):
  2025: 2025-federal-election-votes-sa1-nat.csv — AEC fe25
        downloads-statistics page, "Votes by SA1 – national" zip
  2022: votes-sa1-2022.csv — AEC 2022 downloads page ("Votes by SA1" national)
  2019: votes-sa1-2019.csv — AEC 2019 downloads page ("Votes by SA1" national)
  2016: votes-sa1-2016.xlsx — AEC 2016 downloads page ("Votes by SA1" xlsx,
        sheet "HouseCatchment (2016FE)")
  2022: CG_SA1_2016_SA1_2021.csv — ABS ASGS Ed3 correspondences page
        https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/correspondences/CG_SA1_2016_SA1_2021.csv
  demo: cache/gcp-sa1-2021.zip — ABS datapacks page
        download/2021_GCP_SA1_for_AUS_short-header.zip (G01 SA1 table:
        age bands + language spoken at home; G09: country of birth;
        G49B: highest non-school qualification; G33 households by weekly
        income × family/non-family + G32 family mix by income band —
        the low-/high-household-income lanes, adults-weighted by the
        factors data/income-dist.json carries for the Who-votes income
        facet; every lane's demo basis;
        2016 lane's votes also walk .matilda/seifa-irsad-abs/dl/
        CG_SA1_2011_SA1_2016.xlsx — ABS ASGS Ed2 correspondences page)
Plus committed/held: data/booth-seifa-YYYY.json (booth universe + venue
scores), .build/aec-flow-src/booth/fpv/YYYY-<ST>.csv.gz (reconcile),
.matilda/seifa-irsad-abs/abs-seifa-{2011,2016}-sa1-indexes.xls +
abs-seifa-2021-sa1-indexes.xlsx, dl/1270055001_sa1_{2011,2016}_aust_shape.zip,
cache/SA1_2021_AUST_SHP_GDA2020.zip (see derive-booth-seifa-hist.py).

Guards fail loud. Universe pins measured 2026-10-24.
Run: python3 .build/analysis/seat-model/derive-booth-seifa-voter.py [--year=YYYY]
Test: node .build/analysis/seat-model/test-booth-seifa-voter.mjs
"""

import csv
import gzip
import importlib.util
import io
import json
import re
import statistics
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"
# reuse verified machinery verbatim
_spec = importlib.util.spec_from_file_location("m25", SM / "derive-booth-seifa-2025.py")
m25 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m25)
_spec = importlib.util.spec_from_file_location("hist", SM / "derive-booth-seifa-hist.py")
hist = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hist)
_spec = importlib.util.spec_from_file_location("hla", SM / "homeless_alloc.py")
hla = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(hla)
fail = m25.fail
hash16 = m25.hash16
HL_ALLOC = {2011: hla.alloc_of(2011, "c7"),
            2016: hla.alloc_of(2016, "c7"),
            2021: hla.alloc_of(2021, "m")}
# slot 27 on every GCP-universe row: hla's allocated homeless estimate
# count (never a rate); the acc machinery pools it additively

ABS = ROOT / ".matilda/seifa-irsad-abs"
CACHE = SM / "cache"
VDIR = CACHE / "votes-sa1"
FPV = ROOT / ".build/aec-flow-src/booth/fpv"
STATE_ORDER = {s: i for i, s in
               enumerate(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"])}
COHORTS = {"Postal", "Pre-Poll", "Absent", "Provisional"}
INDEXES = ("irsd", "irsad", "ier", "ieo")
ONLY_YEAR = None
for a in sys.argv[1:]:
    if a.startswith("--year="):
        ONLY_YEAR = int(a[len("--year="):])


# ------------------------------------------------------------- editions
def dbf_col(buf, wanted, pin_len):
    """One column out of a dBase III table as strings."""
    nrec, hlen, rlen = struct.unpack_from("<IHH", buf, 4)
    fields, off, pos = [], 32, 1
    while buf[off] != 0x0D:
        name = buf[off:off + 11].split(b"\x00")[0].decode("ascii")
        fields.append((name, pos, buf[off + 16]))
        pos += buf[off + 16]
        off += 32
    hit = [(p, l) for n, p, l in fields if n == wanted]
    if len(hit) != 1:
        fail(f"DBF lacks {wanted}")
    rel, flen = hit[0]
    out = []
    for i in range(nrec):
        rec = buf[hlen + i * rlen: hlen + (i + 1) * rlen]
        if rec[0:1] == b"*":
            continue
        out.append(rec[rel:rel + flen].decode("ascii", "ignore").strip())
    if len(out) != pin_len:
        fail(f"DBF {wanted} records {len(out)} != pin {pin_len}")
    for c in out:
        if len(c) != 11 or not c.isdigit():
            fail(f"DBF odd code {c!r}")
    if len(set(out)) != len(out):
        fail(f"DBF {wanted} not unique")
    return out


def comp_map(codes11, tag):
    """7-digit ccd = code11[0] + code11[5:11]; injective on every edition."""
    m = {}
    for c in codes11:
        k = c[0] + c[5:]
        if k in m:
            fail(f"{tag}: compression collision {k}")
        m[k] = c
    return m


def comp_map_of(zip_path, field, pin_len, tag):
    z = zipfile.ZipFile(zip_path)
    dbf = next(n for n in z.namelist() if n.lower().endswith(".dbf"))
    codes = dbf_col(z.read(dbf), field, pin_len)
    m = comp_map(codes, tag)
    print(f"edition {tag}: {len(codes)} SA1 codes, ccd map injective")
    return m


def load_ccd_maps():
    need = {LANES[y]["ed"] for y in years_run()}
    out = {}
    if "Ed1" in need:
        out["Ed1"] = comp_map_of(ABS / "dl/1270055001_sa1_2011_aust_shape.zip",
                                 "SA1_MAIN11", 54805, "Ed1")
    if "Ed2" in need:
        out["Ed2"] = comp_map_of(ABS / "dl/1270055001_sa1_2016_aust_shape.zip",
                                 "SA1_MAIN16", 57523, "Ed2")
    if "Ed3" in need:
        z = zipfile.ZipFile(CACHE / "SA1_2021_AUST_SHP_GDA2020.zip")
        out["Ed3"] = comp_map(m25.read_dbf_codes(
            z.read("SA1_2021_AUST_GDA2020.dbf")), "Ed3")
        print("edition Ed3: 61844 SA1 codes, ccd map injective")
    return out


# ------------------------------------------------------------- cubes
def cube21():
    raw = m25.read_seifa(ABS / "abs-seifa-2021-sa1-indexes.xlsx")
    return {c: {"irsd": v[0], "irsad": v[2], "ier": v[4], "ieo": v[6]}
            for c, v in raw.items()}


def cube_for(year, mode):
    """year -> {sa1_join_key: {idx: score|None}}, keyed per the lane."""
    if (mode == "xwalk16" and year == 2016) or (mode == "direct" and year == 2019):
        m = hist._cube_xls_table1(ABS / "abs-seifa-2016-sa1-indexes.xls",
                                  code_col=0, code_len=7,
                                  data_rows=hist.CUBE_ROWS["sa1-2016"],
                                  pop_col=10)
        return {c: {i: v[i] for i in INDEXES} for c, v in m.items()}
    if mode in ("direct21", "xwalk21"):
        return cube21()
    fail(f"no cube lane for {year}/{mode}")


# ------------------------------------------------------------- crosswalk
def load_xwalk():
    """SA1_MAIN16 -> [(SA1_CODE21, ratio)]; full Ed2 source coverage."""
    path = VDIR / "CG_SA1_2016_SA1_2021.csv"
    if not path.exists():
        fail(f"missing crosswalk {path} (see docstring refetch)")
    x = defaultdict(list)
    nrows = 0
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        if rdr.fieldnames[:2] != ["SA1_MAINCODE_2016", "SA1_CODE_2021"]:
            fail("CG csv header drifted")
        for row in rdr:
            nrows += 1
            r = row["RATIO_FROM_TO"]
            if r == "":
                continue
            x[row["SA1_MAINCODE_2016"]].append((row["SA1_CODE_2021"], float(r)))
    bad = [c for c, ts in x.items()
           if not 0.999 <= sum(t[1] for t in ts) <= 1.001]
    if nrows != 62080 or len(x) != 57523 or len(bad) > 1:
        fail(f"CG csv drifted: rows {nrows}, sources {len(x)}, ratio-bad {bad}")
    print(f"crosswalk: {len(x)} SA1_2016 sources -> SA1_CODE_2021")
    return x


# ------------------------------------------ demo (GCP G01/G09/G49B/G60B)
# The demo block: 2021-census GCP (SA1) — G01 age bands + language spoken
# at home, G09F/G09G/G09H country of birth, G49B highest non-school
# qualification, G60B occupation — folded by the same per-SA1 vote weights
# (the emitted tuple gains blue-collar count + stated-occupation total at
# indexes 9 and 10, and the ten curated birthplace-country totals of
# COB_KEYS as a tuple at index 16). EVERY lane
# lands on the Ed3/2021-census table; older votes are chain-walked into
# Ed3 first
# (2019 & 2022 via CG_SA1_2016_SA1_2021; 2016 via CG_SA1_2011_SA1_2016
# composed with it), so the demo basis is the SAME census in all stores.
DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
GCP_ZIP = CACHE / "gcp-sa1-2021.zip"
GCP_MEMBER = ("2021 Census GCP Statistical Area 1 for AUS/"
              "2021Census_G01_AUST_SA1.csv")
# country of birth (G09 is split by sex × country-group; the persons
# block is F-H) and highest non-school qualification
GCP_MEMBER_G09F = ("2021 Census GCP Statistical Area 1 for AUS/"
                   "2021Census_G09F_AUST_SA1.csv")
GCP_MEMBER_G09G = ("2021 Census GCP Statistical Area 1 for AUS/"
                   "2021Census_G09G_AUST_SA1.csv")
GCP_MEMBER_G09H = ("2021 Census GCP Statistical Area 1 for AUS/"
                   "2021Census_G09H_AUST_SA1.csv")
# the G09 top-country columns surfaced on /map/ as birthplace sub-views,
# keyed by their site key and ordered by 2021 national share of the
# country-stated population (eng 3.84 ind 2.77 chn 2.25 nzl 2.19 phl
# 1.18 vnm 1.04 zaf 0.74 ita 0.63 lka 0.52 sct 0.43)
COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita",
            "lka", "sct"]
# the Religion and Housing-tenure select families (cross-era key sets,
# identical order in every edition's reader; REL keys lead with "No
# religion", TEN keys lead with the user-default "mort")
REL_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth", "budd",
            "isl", "hind", "jew"]
TEN_KEYS = ["mort", "rent", "own", "rentPub"]
# the Ancestry menu options, site key order (the 2026-10-31 lanes arc;
# user-specified set — every era's store records its readable subset
# in ancKeys). Census ancestry takes up to two responses per person,
# so option shares are independent and sum past 100%, never normalised
ANC_KEYS = ["english", "australian", "irish", "scottish", "chinese",
            "italian", "german", "indian", "filipino", "dutch",
            "vietnamese", "lebanese"]
GCP_G09F_COLS = ["P_Australia_Tot", "P_England_Tot", "P_China_Tot"]
GCP_G09G_COLS = ["P_India_Tot", "P_New_Zealand_Tot", "P_Italy_Tot"]
GCP_G09H_COLS = ["P_Tot_Tot", "P_COB_NS_Tot", "P_Philippines_Tot",
                 "P_Vietnam_Tot", "P_South_Africa_Tot", "P_Scotland_Tot",
                 "P_Sri_Lanka_Tot"]
GCP_MEMBER_G49B = ("2021 Census GCP Statistical Area 1 for AUS/"
                   "2021Census_G49B_AUST_SA1.csv")
GCP_MEMBER_G32 = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G32_AUST_SA1.csv")
GCP_MEMBER_G33 = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G33_AUST_SA1.csv")
GCP_MEMBER_G60B = ("2021 Census GCP Statistical Area 1 for AUS/"
                   "2021Census_G60B_AUST_SA1.csv")
# ---- the six new People lanes' 2021 GCP members (2026-10-29 arc):
# schooling rides G01 (already read); Indigenous status G07 (the
# age-banded person table — its Indigenous/Non-Indigenous stall is the
# lane's ex-not-stated basis); religion G14; family composition totals
# G32 (income x composition); tenure x landlord G37
GCP_MEMBER_G07 = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G07_AUST_SA1.csv")
GCP_MEMBER_G14 = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G14_AUST_SA1.csv")
GCP_MEMBER_G37 = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G37_AUST_SA1.csv")
# G01's highest-year-of-schooling persons columns (printed six-state
# set; y12less = the five below-original-year rows over their stated
# sum — still-at-school sits outside every era's GCP print)
GCP_G01_SCHOOL_COLS = ["High_yr_schl_comp_Yr_12_eq_P",
                       "High_yr_schl_comp_Yr_11_eq_P",
                       "High_yr_schl_comp_Yr_10_eq_P",
                       "High_yr_schl_comp_Yr_9_eq_P",
                       "High_yr_schl_comp_Yr_8_belw_P",
                       "High_yr_schl_comp_D_n_g_sch_P"]
# G07 age-band row stems (Indigenous_P / Non_Indig*-P / Tot_P) — the
# Non-Indigenous column's suffix varies band to band in the GCP print
# ("Non_Indigenous_P" young bands, "Non_Indig_P" older); resolve per
# header at load
G07_BANDS = ["A_0_4_y", "A_5_9_y", "A_10_14_y", "A_15_19_y", "A_20_24_y",
             "A_25_29_y", "A_30_34_y", "A_35_39_y", "A_40_44_y",
             "A_45_49_y", "A_50_54_y", "A_55_59_y", "A_60_64_y",
             "A_65_y_ov"]
# G14 religion columns per REL_KEYS slot (GCP era: No-religion is the
# so-described NR part of SB_OSB_NRA; the orth lane sums Eastern +
# Oriental orthodox — the 2001 print's own two orthodox rows)
GCP_G14_REL = {
    "norel": ["SB_OSB_NRA_NR_P"],
    "cath": ["Christianity_Catholic_P"],
    "angl": ["Christianity_Anglican_P"],
    "unch": ["Christianity_Uniting_Church_P"],
    "pres": ["Christinty_Prsbytrin_Refrmd_P"],
    "orth": ["Christianity_Eastrn_Orthdox_P",
             "Christianity_Orintal_Orthdx_P"],
    "budd": ["Buddhism_P"],
    "isl": ["Islam_P"],
    "hind": ["Hinduism_P"],
    "jew": ["Judaism_P"],
}
# G37 tenure x landlord totals (occupied private dwellings): owned
# outright, owned with mortgage, rented (all landlords), rented from a
# state/territory housing authority, other tenure type, tenure not
# stated
GCP_G37_COLS = ["O_OR_Total", "O_MTG_Total", "R_Tot_Total",
                "R_ST_h_auth_Total", "Oth_ten_type_Total",
                "Ten_type_NS_Total"]
# G32's family-composition totals (one-parent share's family basis)
GCP_G32_FAMCOLS = ["Tot_One_parent_fam", "Tot_cpl_fam_no_child",
                   "Tot_cpl_fam_wth_chld", "Tot_Other_fam", "Tot_Tot"]
# the eight stated ANZSCO occupation major groups (G60B P_Tot_*), in
# file order; blue-collar = trades + machinery operators & drivers +
# labourers, shared over the stated set (inadequately-described/
# not-stated excluded)
GCP_G60B_OCCS = ["P_Tot_Managers", "P_Tot_Professionals",
                 "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
                 "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
                 "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
GCP_ROWS = 61844
# household weekly income bands ($2021), G33/G32 grid: (lo, hi) inclusive;
# the top band is open. Negative/Nil folds into the first band. Partial-
# stated and all-not-stated households are EXCLUDED from every lane basis
# (the facet does the same).
INC_BANDS = [(1, 149), (150, 299), (300, 399), (400, 499), (500, 649),
             (650, 799), (800, 999), (1000, 1249), (1250, 1499),
             (1500, 1749), (1750, 1999), (2000, 2499), (2500, 2999),
             (3000, 3499), (3500, 3999), (4000, None)]
INC_LO_Q = 0.25  # low lane: adults below the national 25th percentile
# hi lane: share of adults in the grid's top open band. It lands on the
# same national share as the Who-votes facet's top-15% reading to within
# a hair (top-15% cut interpolates to ~$4,134 inside the 4000+ band, so
# the two measures differ only by one constant scale factor everywhere)
# — the snapped edge keeps every figure a count the census printed, no
# tail model; the label carries the real national share
INC_HI_GUARD = (0.13, 0.19)  # national adults share of the top band
INC_LO_GUARD = (900, 1250)  # plausible $ for the 2021 national 25% cut
XW11_ROWS = 58769
XW11_SOURCES = 54805
XW11_SHORT = {"31501140101", "31501140102", "31501140104",
              "50806121812", "60203106418"}
DEMO_BASIS = ("2021 Census GCP G01, G07, G08, G09F/G09G/G09H, G14, "
              "G28, G32/G33, G37, G49B, G60B and G62 @ SA1 (Ed3), plus "
              "the ABS Estimating-homelessness 2049.0 SA2 estimates "
              "down-allocated by population share "
              "(cache/homeless-sa1-2021-alloc.json); "
              "every lane's votes are "
              "in Ed3 space before folding, walking older geographies "
              "via ABS correspondences")
_DEMO_TAIL = (" The demo block folds the 2021-census GCP G01, G07, "
              "G08, G09F/G09G/G09H, G14, G28, G32/G33, G37, G49B, G60B "
              "and G62 SA1 "
              "tables (G01: age-band structure (u15 the under-15 share "
              "of the stated ages); language "
              "spoken at home English-only vs other; the "
              "highest-year-of-schooling persons columns — the "
              "year-12-or-less share of the six printed stated levels "
              "(below-Year-12 = Year 11, Year 10, Year 9, Year 8 or "
              "below, did-not-go-to-school). G07: Indigenous status — "
              "the identifying share of the Indigenous-plus-non-Indigenous "
              "persons basis (status-not-stated excluded). G14: "
              "religious affiliation — the Religion menu's ten share "
              "options (rel, key order in relKeys, No-religion leading) "
              "ride the ex-affiliation-not-stated persons basis. "
              "G32's family-composition totals: the one-parent share "
              "of families (couple-with-children + couple-without-children "
              "+ one-parent + other-family). G37: tenure by landlord "
              "— the Housing-tenure menu's four share options "
              "(ten, key order in tenKeys, owned-with-mortgage leading) "
              "ride the ex-tenure-not-stated occupied-private-dwellings "
              "basis, rented-public a state-or-territory-housing-authority "
              "landlord within that base. G09: country of "
              "birth — the overseas-born share excludes "
              "country-of-birth-not-stated, and the ten curated "
              "birthplace-country shares (cob, country order in cobKeys) "
              "ride the same country-stated basis. G49B: highest non-school "
              "qualification — the bachelor-and-above share is of the "
              "G01 aged-15-and-over population, excluding "
              "level-of-education-not-stated. G33 households by weekly "
              "income are re-weighted to ADULTS at the data/income-dist.json "
              "factors — each band's family households at that band's G32 "
              "family mix in the SA1 (national mix as fallback), non-family "
              "households at the national mean; loinc is the adult share "
              "below the national 25th-percentile weekly household-income "
              "cut the store-level incomeCuts record carries (the national "
              "histogram's cut band split linearly), hiinc the adult share "
              "in the $4,000-and-top band, incMed the band-interpolated "
              "median weekly household income in 2021 dollars on the "
              "HOUSEHOLD basis (ABS's own published-median basis — the "
              "adults-weighted histogram would read ~$300 higher, skewed "
              "by couples). G60B: occupation of "
              "employed persons — the blue-collar share counts the "
              "technicians-and-trades, machinery-operators-and-drivers "
              "and labourers major groups over the eight stated "
              "occupation groups, excluding inadequately-described/"
              "not-stated). The 2026-10-31 lanes arc: G62's commute "
              "share — any train, bus, tram or ferry leg of the "
              "counted employed-persons-with-stated-method journeys; "
              "G01's citizenship — residents not counted as Australian "
              "citizens (the GCP publishes no not-stated count for "
              "citizenship, so they're inside the complement as "
              "everywhere in this stack); G28's bigfam — women aged 15+ "
              "who have had three or more children "
              "ever born, over motherhood-stated women; G08's Ancestry"
              "-menu twelve shares (anc, key order in ancKeys) "
              "over persons ex the ancestry-not-stated responses — a "
              "person can name two ancestries so the options never "
              "partition residents, they count people per option; and "
              "the homeless lane, the ABS Estimating-homelessness "
              "2049.0 SA2 estimates down-allocated to each SA1 by "
              "resident-population share — an SA2-area measure. "
              "— all by the same per-SA1 vote "
              "weights — age shares "
              "renormalise over the 11 bands, which exclude "
              "age-not-stated; persons are a "
              "vote-weighted pseudo-population, never a headcount, and "
              "demo figures describe where the booth's voters lived in "
              "2021, never who the voters themselves were — the "
              "ecological transport is the point of the weighting and "
              "its limit. Walk used for this lane: ")
DEMO_ABOUT = {
    2025: _DEMO_TAIL + "none needed (votes are already Ed3).",
    2022: _DEMO_TAIL + "CG_SA1_2016_SA1_2021 (same as the SEIFA lane).",
    2019: _DEMO_TAIL + "CG_SA1_2016_SA1_2021 (the SEIFA lane for this "
                       "year is SEIFA-2016-direct; demo is 2021-census "
                       "based instead).",
    2016: _DEMO_TAIL + "CG_SA1_2011_SA1_2016 composed with "
                       "CG_SA1_2016_SA1_2021 (the SEIFA lane for this "
                       "year walks onto 2016 SA1s for the 2016 census; "
                       "demo is 2021-census based instead).",
}

_GCP = None
_XW11 = None


# ------------------------------------------------- income lanes (G32/G33)
def income_factors():
    """Adults-per-household factors from data/income-dist.json — the
    Who-votes income facet's national histogram store, whose G27/G32/G35-
    derived adultsPer factors are the GCP's canon in this repo (the GCP
    carries no persons-by-household-income table). Grids must match
    INC_BANDS or the facet file has moved on: fail loud, never reuse a
    stale grid."""
    path = ROOT / "data/income-dist.json"
    if not path.exists():
        fail("missing data/income-dist.json (run node .build/extract-income-dist.mjs)")
    ax = json.loads(path.read_text(encoding="utf-8"))["axes"]["household"]
    ap = ax["adultsPer"]
    for (lo, hi), b in zip(INC_BANDS, ax["bands"]):
        if b["lo"] != (lo if lo > 1 else 0) or b["hi"] != hi:
            fail(f"income-dist grid drift at [{lo},{hi}] vs {b}")
    return ((ap["coupleNoChildren"], ap["coupleWithChildren"],
             ap["oneParent"], ap["otherFamily"]), ap["nonFamily"], path)


def income_gcp(z, factors, nonfam):
    """Per SA1: (incTot, loMass, hiMass, bands16 adults) — G33's per-band
    Tot households re-weighted to adults: the band's FAMILY share from
    G32's FI Tot (fam share over the SA1's G32 type mix at the income-
    dist factors, national mix as fallback), the rest non-family at the
    national mean. The household mass rides the Tot columns, never the
    G33 fam/non columns: at SA1 scale ABS perturbs each cell
    independently and G33's own fam/non columns sum ~3% under their
    Tot columns nationally, while the Tot columns agree with the CED
    pack that income-dist.json's national histograms come from (within
    ~1%). loMass splits the cut band linearly at the national
    25th-percentile dollar. Per-SA1 value: (adult total, adult loMass,
    adult hi-band mass, 16 adult band masses, 16 raw household masses) —
    the median lane is read off the household histogram, so incMed sits
    on ABS's published-median basis while loinc/hiinc sit on the
    adults (poll-frame) basis."""
    ad = factors
    def cols_of(member):
        if member not in z.namelist():
            fail(f"GCP zip lacks {member}")
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            head = rdr.fieldnames or []
            rows = {}
            for row in rdr:
                c = row["SA1_CODE_2021"]
                if c in rows:
                    fail(f"{member} dup code {c}")
                rows[c] = row
            if len(rows) != GCP_ROWS:
                fail(f"{member} rows {len(rows)} != pin {GCP_ROWS}")
        return head, rows

    h33, g33 = cols_of(GCP_MEMBER_G33)
    h32, g32 = cols_of(GCP_MEMBER_G32)
    neg33 = "Negative_Nil_income_Tot"
    neg32tot = "Neg_Nil_inc_Tot"
    neg32 = ("Neg_Nil_inc_cpl_fam_no_child", "Neg_Nil_inc_cpl_fam_wth_chld",
             "Neg_Nil_inc_One_parent_fam", "Neg_Nil_inc_Other_fam")
    if neg33 not in h33:
        fail("GCP G33 lacks the Negative_Nil Tot column")
    plan = []
    for i, (lo, hi) in enumerate(INC_BANDS):
        hi_tot = f"HI_{lo}_{hi if hi is not None else 'more'}_Tot"
        fi_tot = f"FI_{lo}_{hi if hi is not None else 'more'}_Tot"
        if hi_tot not in h33:
            fail(f"GCP G33 lacks {hi_tot}")
        if fi_tot not in h32:
            fail(f"GCP G32 lacks {fi_tot}")
        fstem = f"FI_{lo}_{hi if hi is not None else 'more'}"
        types = []
        for want in (r"cpl_fam_no_child$", r"cpl_fam_(with|wth)_ch",
                     r"One_parent_fam$", r"Other_fam$"):
            c = next((h for h in h32
                      if h.startswith(f"{fstem}_") and re.search(want, h)),
                     None)
            if c is None:
                fail(f"GCP G32 lacks {fstem} {want}")
            types.append(c)
        if i == 0 and (neg32tot not in h32 or
                       any(c not in h32 for c in neg32)):
            fail("GCP G32 lacks the Neg_Nil columns")
        plan.append((hi_tot, fi_tot, types))
    # national per-band family mix (the per-SA1 mix's fallback + the cut)
    nat = {"b": [0.0] * 16, "fi": [0.0] * 16,
           "mix": [[0] * 4 for _ in range(16)]}
    for code in g33:
        r33, r32 = g33[code], g32.get(code)
        if r32 is None:
            fail(f"G33 SA1 {code} missing from G32")
        for i, (hc, fc, tc) in enumerate(plan):
            ne = i == 0
            nat["b"][i] += float(r33[hc]) + (float(r33[neg33]) if ne else 0.0)
            nat["fi"][i] += float(r32[fc]) + (float(r32[neg32tot])
                                              if ne else 0.0)
            for k, t in enumerate(tc):
                nat["mix"][i][k] += float(r32[t]) + (
                    float(r32[neg32[k]]) if ne else 0.0)
    nat_famper = []
    nat_fams = []
    for i in range(16):
        mixn = sum(nat["mix"][i])
        if mixn <= 0 or nat["b"][i] <= 0:
            fail(f"national income mix empty in band {INC_BANDS[i]}")
        nat_famper.append(sum(m * a for m, a in zip(nat["mix"][i], ad)) / mixn)
        nat_fams.append(min(1.0, nat["fi"][i] / nat["b"][i]))
    nat_adults = [nat["b"][i] * (nat_fams[i] * nat_famper[i]
                                 + (1 - nat_fams[i]) * nonfam)
                  for i in range(16)]
    nat_tot = sum(nat_adults)
    cum, cut25 = 0.0, None
    for i, (lo, hi) in enumerate(INC_BANDS):
        cum += nat_adults[i] / nat_tot
        if cum >= INC_LO_Q:
            prev = cum - nat_adults[i] / nat_tot
            f = (INC_LO_Q - prev) / (nat_adults[i] / nat_tot)
            if hi is None:
                fail("income 25% cut lands in the open top band")
            cut25 = lo + f * (hi - lo + 1)
            break
    if not cut25 or not INC_LO_GUARD[0] <= cut25 <= INC_LO_GUARD[1]:
        fail(f"income 25% cut {cut25} outside guard {INC_LO_GUARD}")
    hi_share = nat_adults[-1] / nat_tot
    if not INC_HI_GUARD[0] <= hi_share <= INC_HI_GUARD[1]:
        fail(f"top-band national share {hi_share:.4f} outside {INC_HI_GUARD}")
    print(f"income: national 25% cut ${cut25:.0f}/wk (adults, 2021 $); "
          f"top band {hi_share:.4f} of adults")

    out = {}
    for code in g33:
        r33, r32 = g33[code], g32[code]
        bands = []      # adults per band (loinc/hiinc basis)
        hh = []         # raw households per band (incMed basis)
        for i, (hc, fc, tc) in enumerate(plan):
            ne = i == 0
            tot = float(r33[hc]) + (float(r33[neg33]) if ne else 0.0)
            fi = float(r32[fc]) + (float(r32[neg32tot]) if ne else 0.0)
            mix = [float(r32[t]) + (float(r32[neg32[k]]) if ne else 0.0)
                   for k, t in enumerate(tc)]
            mixn = sum(mix)
            famper = (sum(m * a for m, a in zip(mix, ad)) / mixn
                      if mixn > 0 else nat_famper[i])
            # fam share of the band's households, clamped: an SA1 cell's
            # independently perturbed G32 FI Tot can momentarily exceed
            # the G33 HI Tot it shares its basis with
            fams = min(1.0, fi / tot) if tot > 0 else nat_fams[i]
            bands.append(tot * (fams * famper + (1 - fams) * nonfam))
            hh.append(tot)
        tsum = sum(bands)
        lo_mass = 0.0
        for i, (lo, hi) in enumerate(INC_BANDS):
            if cut25 <= lo:
                continue
            if hi is not None and cut25 > hi:
                lo_mass += bands[i]
                continue
            lo_mass += bands[i] * (cut25 - lo) / (hi - lo + 1)
            break
        out[code] = (tsum, lo_mass, bands[-1], tuple(bands), tuple(hh))
    print(f"income: G32/G33 SA1, {len(out)} rows (factors from "
          f"data/income-dist.json)")
    return out, round(cut25, 2), round(hi_share, 6)


def read_p_cols(z, member, idcol, cols, rows_pin, tag):
    """One GCP table's persons columns as compact int tuples, guarded —
    header drift, duplicate codes and the table's row-count pin all
    fail loud. cols may include None (a column name that resolved to
    no header) only when the caller tolerates it."""
    if member not in z.namelist():
        fail(f"GCP zip lacks {member}")
    d = {}
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        fn = rdr.fieldnames or []
        miss = [c for c in cols + [idcol]
                if c is not None and c not in fn]
        if miss:
            fail(f"GCP {tag} header drift, missing {miss}")
        m = 0
        for row in rdr:
            m += 1
            code = row[idcol]
            if code in d:
                fail(f"GCP {tag} dup code {code}")
            d[code] = tuple(int(row[c]) if c is not None else None
                            for c in cols)
    if m != rows_pin:
        fail(f"GCP {tag} rows {m} != pin {rows_pin}")
    print(f"GCP demo: {tag}, {m} rows")
    return d


# SA1-row pins of the GCP universes the new-lane tables join (the
# 2021 zip's pin lives at GCP_ROWS; the 2016 zip's sits here so both
# the voter-store reader and derive-booth-demo-2016.py share it)
G16_GCP_ROWS = 57523


def new_lane_tables(z, idcol="SA1_CODE_2021", era="2021"):
    """The six new People lanes' GCP reads, keyed per SA1:
      G07 {code: (ind-tuple, nonind-tuple)}   G14 {code: (relvec, ns, tot)}
      G37 {code: (own, mort, rent, rentPub, othType, tenNS)}
      G32 {code: (onepar, cplNoChild, cplChild, otherFam, famTot)}
      G01c {code: (Australian_citizen_P,)}   Gmtw {code: (ptn, mtot, mns)}
      Gceb {code: (ceb3plus, cebNS, cebTot)}
      G08 {code: (ancvec[12], ancTotP, ancNS)}
    Schooling is always the caller's own G01 base pass. era=2016 reads
    the Ed2 zip's G07/G14/G33/G28 counterparts (travel G59, children
    G24) and its G08 G01-era column spellings differ in resp-case
    (Ancestry_NS_Tot_Resp / _Tot_Resp vs 2021's _Tot_resp)."""
    pfx = ("2021 Census GCP Statistical Area 1 for AUS/"
           if era == "2021" else
           "2016 Census GCP Statistical Area 1 for AUST/")
    rows_pin = GCP_ROWS if era == "2021" else G16_GCP_ROWS
    tbl = {}
    zpf = lambda m: pfx + m
    if era == "2021":
        m07, m14, mten, mfam = ("2021Census_G07_AUST_SA1.csv",
                                "2021Census_G14_AUST_SA1.csv",
                                "2021Census_G37_AUST_SA1.csv",
                                "2021Census_G32_AUST_SA1.csv")
        mg01, mmtw, mceb, m08 = ("2021Census_G01_AUST_SA1.csv",
                                 "2021Census_G62_AUST_SA1.csv",
                                 "2021Census_G28_AUST_SA1.csv",
                                 "2021Census_G08_AUST_SA1.csv")
        tram_col = "One_met_Tram_or_lt_rail_P"
        three_trn_col = "Three_meth_Tr_2_oth_meth_P"
        resp_sfx = "resp"
        ns_resp = "Ancestry_NS_Tot_resp"
    else:
        m07, m14, mten, mfam = ("2016Census_G07_AUS_SA1.csv",
                                "2016Census_G14_AUS_SA1.csv",
                                "2016Census_G33_AUS_SA1.csv",
                                "2016Census_G28_AUS_SA1.csv")
        mg01, mmtw, mceb, m08 = ("2016Census_G01_AUS_SA1.csv",
                                 "2016Census_G59_AUS_SA1.csv",
                                 "2016Census_G24_AUS_SA1.csv",
                                 "2016Census_G08_AUS_SA1.csv")
        tram_col = "One_met_Tram_incl_lt_rail_P"
        three_trn_col = "Three_meth_Trn_two_othr_met_P"
        resp_sfx = "Resp"
        ns_resp = "Ancestry_NS_Tot_Resp"
    # G07's per-band Indigenous columns are individually suppressed
    # (0-3-person cells turned to zero far outnumbering bumps) and
    # undercount nationally by a fifth; the table's own Tot rows are
    # coherent with G01's Indigenous totals and the census headline —
    # the lane reads the Tot row, never the band stall
    tbl["G07"] = read_p_cols(z, zpf(m07), idcol,
                             ["Tot_Indigenous_P", "Tot_Non_Indigenous_P"],
                             rows_pin, "G07")
    rel_cols = [c for k in REL_KEYS for c in GCP_G14_REL[k]]
    g14 = read_p_cols(z, zpf(m14), idcol,
                      rel_cols + ["Religious_affiliation_ns_P", "Tot_P"],
                      rows_pin, "G14")
    tbl["G14"] = {}
    for c, r in g14.items():
        relvec, i = [], 0
        for k in REL_KEYS:
            span = len(GCP_G14_REL[k])
            relvec.append(sum(r[i: i + span]))
            i += span
        tbl["G14"][c] = (tuple(relvec), r[-2], r[-1])
    tbl["G37"] = read_p_cols(z, zpf(mten), idcol, GCP_G37_COLS,
                             rows_pin, "G37")
    tbl["G32"] = {c: (r[0], r[4])
                  for c, r in read_p_cols(
                      z, zpf(mfam), idcol, GCP_G32_FAMCOLS,
                      rows_pin, "G32").items()}
    # ---- the 2026-10-31 lanes arc's GCP reads: G01's Australian
    # citizen persons cell; the method-of-travel table's persons
    # cells (G62/G59 — PT numerator as the d13 B46 formula's GCP
    # counterpart: any train/bus/ferry/tram one- or multi-method ride,
    # the two-method Train_Tot and Bus_Tot overlap on train-bus
    # deduped, three-method train/bus rows in, the unattributable
    # other-combination rows out); children-ever-born totals row
    # (three-or-more over the stated total, women 15+); G08 ancestry
    # (the twelve options' <A>_Tot response cells over persons ex the
    # ancestry-not-stated responses — one NS response per NS person)
    tbl["G01c"] = read_p_cols(z, zpf(mg01), idcol,
                              ["Australian_citizen_P"], rows_pin, "G01c")
    mtw_cols = ["One_method_Train_P", "One_method_Bus_P",
                "One_method_Ferry_P", tram_col,
                "Two_methods_Train_Tot_P", "Two_methods_Bus_Tot_P",
                "Two_methods_Train_Bus_P",
                three_trn_col,
                "Three_met_Bs_2_ot_met_ex_tr_P",
                "Tot_P", "Method_travel_to_work_ns_P"]
    g62 = read_p_cols(z, zpf(mmtw), idcol, mtw_cols, rows_pin, "Gmtw")
    tbl["Gmtw"] = {c: (r[0] + r[1] + r[2] + r[3] + r[4] + r[5] - r[6]
                       + r[7] + r[8], r[9], r[10])
                   for c, r in g62.items()}
    tbl["Gceb"] = {c: (r[0] + r[1] + r[2] + r[3], r[4], r[5])
                   for c, r in read_p_cols(
                       z, zpf(mceb), idcol,
                       ["Tot_Nmbr_children_ever_born_3",
                        "Tot_Nmbr_children_ever_born_4",
                        "Tot_Nmbr_children_ever_born_5",
                        "Tot_Nmbr_chidrn_ever_brn_6_mr",
                        "Tot_Nmbr_childrn_ever_born_Ns", "Total_Total"],
                       rows_pin, "Gceb").items()}
    anc_cols = [f"{b}_Tot_{resp_sfx}" for b in
                ("English", "Aust", "Irish", "Scottish", "Chinese",
                 "Italian", "German", "Indian", "Filipino", "Dutch",
                 "Vietnamese", "Lebanese")]
    g08 = read_p_cols(z, zpf(m08), idcol,
                      anc_cols + [ns_resp, "Tot_P_Tot_resp"]
                      if resp_sfx == "resp"
                      else anc_cols + [ns_resp, "Tot_P_Tot_Resp"],
                      rows_pin, "G08")
    tbl["G08"] = {c: (r[:len(ANC_KEYS)], r[-1], r[-2])
                  for c, r in g08.items()}
    return tbl


def load_gcp21():
    global _GCP
    if _GCP is not None:
        return _GCP
    if not GCP_ZIP.exists():
        fail(f"missing GCP input {GCP_ZIP} (see docstring refetch)")
    agecols = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
    want = ["SA1_CODE_2021", "Tot_P_P", "Lang_used_home_Eng_only_P",
            "Lang_used_home_Oth_Lang_P", *agecols]
    base = {}
    school = {}
    z = zipfile.ZipFile(GCP_ZIP)
    if GCP_MEMBER not in z.namelist():
        fail(f"GCP zip lacks {GCP_MEMBER}")
    with io.TextIOWrapper(z.open(GCP_MEMBER), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want + GCP_G01_SCHOOL_COLS
                if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"GCP G01 header drift, missing {miss}")
        n = 0
        for row in rdr:
            n += 1
            code = row["SA1_CODE_2021"]
            if code in base:
                fail(f"GCP G01 dup code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row["Lang_used_home_Eng_only_P"]),
                          int(row["Lang_used_home_Oth_Lang_P"]),
                          tuple(int(row[c]) for c in agecols))
            school[code] = tuple(int(row[c])
                                 for c in GCP_G01_SCHOOL_COLS)
    if n != GCP_ROWS:
        fail(f"GCP G01 rows {n} != pin {GCP_ROWS}")
    extra = {}
    for tag, member, cols in (
        ("G09F", GCP_MEMBER_G09F, GCP_G09F_COLS),
        ("G09G", GCP_MEMBER_G09G, GCP_G09G_COLS),
        ("G09H", GCP_MEMBER_G09H, GCP_G09H_COLS),
        ("G49B", GCP_MEMBER_G49B, ["P_PGrad_Deg_Total",
                                   "P_GradDip_and_GradCert_Total",
                                   "P_BachDeg_Total",
                                   "P_Lev_Edu_NS_Total"]),
        ("G60B", GCP_MEMBER_G60B, GCP_G60B_OCCS),
    ):
        if member not in z.namelist():
            fail(f"GCP zip lacks {member}")
        d = {}
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in ["SA1_CODE_2021", *cols]
                    if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"GCP {tag} header drift, missing {miss}")
            m = 0
            for row in rdr:
                m += 1
                code = row["SA1_CODE_2021"]
                if code in d:
                    fail(f"GCP {tag} dup code {code}")
                d[code] = tuple(int(row[c]) for c in cols)
        if m != GCP_ROWS:
            fail(f"GCP {tag} rows {m} != pin {GCP_ROWS}")
        extra[tag] = d
        print(f"GCP demo: {tag} SA1, {m} rows")
    ad4, nonfam, inc_path = income_factors()
    inc, inc_cut, inc_hishare = income_gcp(z, ad4, nonfam)
    nlt = new_lane_tables(z, era="2021")
    out = {}
    for code, r in base.items():
        f09 = extra["G09F"].get(code)
        g09 = extra["G09G"].get(code)
        h09 = extra["G09H"].get(code)
        e49 = extra["G49B"].get(code)
        ir = inc.get(code)
        o60 = extra["G60B"].get(code)
        if f09 is None or g09 is None or h09 is None or e49 is None \
                or ir is None or o60 is None:
            fail(f"GCP G09/G49B/G32/G33/G60B SA1 set mismatch at {code}")
        if code not in school or code not in nlt["G07"] \
                or code not in nlt["G14"] or code not in nlt["G37"] \
                or code not in nlt["G32"]:
            fail(f"GCP G01/G07/G14/G37/G32 SA1 set mismatch at {code}")
        if code not in nlt["G01c"] or code not in nlt["Gmtw"] \
                or code not in nlt["Gceb"] or code not in nlt["G08"]:
            fail(f"GCP G01c/Gmtw/Gceb/G08 SA1 set mismatch at {code}")
        # the ten-country cob tuple, in COB_KEYS order, indexed on the
        # GCP_G09{F,G,H}_COLS orders above
        cob = (f09[1], g09[0], f09[2], g09[1], h09[2], h09[3], h09[4],
               g09[2], h09[6], h09[5])
        sc = school[code]
        y12t = (sc[1] + sc[2] + sc[3] + sc[4] + sc[5], sum(sc))
        indig, nonind = nlt["G07"][code]
        indt = (indig, indig + nonind)
        relvec, relns, reltot = nlt["G14"][code]
        ten = nlt["G37"][code]
        fam = nlt["G32"][code]
        out[code] = r + (f09[0], h09[0], h09[1],
                         e49[0] + e49[1] + e49[2], e49[3],
                         o60[2] + o60[6] + o60[7], sum(o60)) + ir + (cob,) \
            + (y12t, indt, relvec, (relns, reltot), ten, fam) \
            + (nlt["G01c"][code][0], nlt["Gmtw"][code],
               nlt["Gceb"][code], nlt["G08"][code]) \
            + (HL_ALLOC[2021].get(code, {}).get("e", 0.0),)
    print(f"GCP demo: G01 SA1, {n} rows")
    _GCP = (out, {"loCutWeekly": inc_cut, "hiEdgeWeekly": INC_BANDS[-1][0],
                  "hiNationalShare": inc_hishare,
                  "loQuantile": INC_LO_Q, "dollarsYear": 2021,
                  "factors": str(inc_path.relative_to(ROOT))})
    return _GCP


def load_xwalk11():
    """SA1_MAINCODE_2011 -> [(SA1_CODE21, ratio)], composed Ed1->Ed2->Ed3."""
    global _XW11
    if _XW11 is not None:
        return _XW11
    path = ABS / "dl/CG_SA1_2011_SA1_2016.xlsx"
    if not path.exists():
        fail(f"missing correspondence {path} (ABS ASGS Ed2 correspondences)")
    src = defaultdict(list)
    n = 0
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb["Table 3"]
    for row in ws.iter_rows(values_only=True):
        c0 = row[0]
        if isinstance(c0, int) and 10**10 <= c0 < 10**11:
            c0 = str(c0)
        if not (isinstance(c0, str) and len(c0) == 11 and c0.isdigit()):
            continue
        n += 1
        if row[2] in (None, "") or row[4] in (None, 0):
            continue  # "null to" shares (Table 4 family) never map
        src[c0].append((str(row[2]), float(row[4])))
    short = [c for c, ts in src.items()
             if not 0.999 <= sum(r for _, r in ts) <= 1.001]
    if n != XW11_ROWS or len(src) != XW11_SOURCES \
            or set(short) != XW11_SHORT:
        fail(f"CG_SA1_2011_SA1_2016 drifted: rows {n}, sources {len(src)}, "
             f"short {sorted(short)}")
    x16 = load_xwalk()
    out = {}
    for c11, t16 in src.items():
        acc = defaultdict(float)
        for c16, r1 in t16:
            for c21, r2 in x16.get(c16, ()):
                acc[c21] += r1 * r2
        if acc:
            out[c11] = [(c, r) for c, r in acc.items()]
    _XW11 = out
    global _XW1116
    _XW1116 = {c11: [(c16[0] + c16[5:], r) for c16, r in t16]
               for c11, t16 in src.items()}
    print(f"crosswalk 11->21: composed {len(out)} SA1_2011 sources "
          f"(rows {n})")
    return out


_XW1116 = None


def load_xwalk1116():
    """SA1_MAINCODE_2011 -> [(2016 7-digit cube key, ratio)] – the
    CG_SA1_2011_SA1_2016 shares load_xwalk11 composes from, keyed for the
    2016 cube."""
    if _XW1116 is None:
        load_xwalk11()
    return _XW1116


def units_to_ed2(units, dec, xw):
    """Walk the 2016 lane's Ed1 7-digit vote units onto 2016 SA1s (the
    2016 cube's 7-digit keys) for scoring."""
    out = {}
    drop = 0.0
    for key, kv in units.items():
        acc = Counter()
        for ccd, w in kv.items():
            full = dec.get(ccd)
            ts = xw.get(full) if full is not None else None
            if not ts:
                drop += w
                continue
            for code, r in ts:
                acc[code] += w * r
            short = 1.0 - sum(r for _, r in ts)
            if short > 0.001:
                drop += w * short
        out[key] = acc
    return out, round(drop)


def units_to_ed3(units, conf, dec, xw):
    """Walk a direct lane's 7-digit-keyed vote units into Ed3 space."""
    out = {}
    drop = 0.0
    for key, kv in units.items():
        acc = Counter()
        for ccd, w in kv.items():
            full = dec.get(ccd)
            ts = xw.get(full) if full is not None else None
            if not ts:
                drop += w
                continue
            for code, r in ts:
                acc[code] += w * r
        out[key] = acc
    return out, round(drop)


def acc_new():
    """The new-lane lane accumulator (zero-weight); pers rides here too
    because the noncit share's denominator is the weighted persons."""
    return {"pers": 0.0,
            "y12n": 0.0, "y12d": 0.0, "atN": 0.0, "atD": 0.0,
            "relN": [0.0] * len(REL_KEYS), "relNS": 0.0, "relTot": 0.0,
            "tenN": [0.0] * 6, "famN": 0.0, "famD": 0.0,
            "citz": 0.0, "ptN": 0.0, "ptT": 0.0, "ptNS": 0.0,
            "cebN": 0.0, "cebNS": 0.0, "cebT": 0.0,
            "ancN": [0.0] * len(ANC_KEYS), "ancP": 0.0, "ancNS": 0.0,
            "hlE": 0.0}


def acc_row(acc, r, w):
    """Weight-add row r's new-lane tail (r[17..26]) into acc; any
    reader of the GCP/BCP universes emits the same tail layout."""
    acc["pers"] += w * r[0]
    acc["y12n"] += w * r[17][0]
    acc["y12d"] += w * r[17][1]
    acc["atN"] += w * r[18][0]
    acc["atD"] += w * r[18][1]
    for i in range(len(REL_KEYS)):
        acc["relN"][i] += w * r[19][i]
    acc["relNS"] += w * r[20][0]
    acc["relTot"] += w * r[20][1]
    for i in range(6):
        acc["tenN"][i] += w * r[21][i]
    acc["famN"] += w * r[22][0]
    acc["famD"] += w * r[22][1]
    acc["citz"] += w * r[23]
    acc["ptN"] += w * r[24][0]
    acc["ptT"] += w * r[24][1]
    acc["ptNS"] += w * r[24][2]
    acc["cebN"] += w * r[25][0]
    acc["cebNS"] += w * r[25][1]
    acc["cebT"] += w * r[25][2]
    for i in range(len(ANC_KEYS)):
        acc["ancN"][i] += w * r[26][0][i]
    acc["ancP"] += w * r[26][1]
    acc["ancNS"] += w * r[26][2]
    acc["hlE"] += w * r[27]


def acc_merge(dst, src):
    for k in ("pers", "y12n", "y12d", "atN", "atD", "relNS", "relTot",
              "famN", "famD", "citz", "ptN", "ptT", "ptNS",
              "cebN", "cebNS", "cebT", "ancP", "ancNS", "hlE"):
        dst[k] += src[k]
    for i in range(len(REL_KEYS)):
        dst["relN"][i] += src["relN"][i]
    for i in range(6):
        dst["tenN"][i] += src["tenN"][i]
    for i in range(len(ANC_KEYS)):
        dst["ancN"][i] += src["ancN"][i]


def emit_new(acc):
    """One share-block's new-lane section. Shares come from the
    weighted COUNTS (never averaged row shares), and an empty basis
    emits null on the per-lane pcti convention — nothing is ever
    clamped or completed. rel rides the ex-not-stated persons basis,
    ten the ex-tenure-not-stated dwellings basis."""
    yd, ad = acc["y12d"], acc["atD"]
    relD = acc["relTot"] - acc["relNS"]
    tn = acc["tenN"]
    tenD = tn[0] + tn[1] + tn[2] + tn[4]
    ptD = acc["ptT"] - acc["ptNS"]
    cebD = acc["cebT"] - acc["cebNS"]
    ancD = acc["ancP"] - acc["ancNS"]
    return {
        "y12less": round(acc["y12n"] / yd, 4) if yd > 0 else None,
        "atsci": round(acc["atN"] / ad, 4) if ad > 0 else None,
        "onepar": round(acc["famN"] / acc["famD"], 4)
        if acc["famD"] > 0 else None,
        "rel": {k: (round(acc["relN"][i] / relD, 4)
                    if relD > 0 else None)
                for i, k in enumerate(REL_KEYS)},
        "ten": {k: (round({"mort": tn[1], "rent": tn[2],
                           "own": tn[0], "rentPub": tn[3]}[k] / tenD,
                          4)
                    if tenD > 0 else None)
                for k in TEN_KEYS},
        "pt": round(acc["ptN"] / ptD, 4) if ptD > 0 else None,
        "noncit": (round((acc["pers"] - acc["citz"]) / acc["pers"], 4)
                   if acc["pers"] > 0 else None),
        "bigfam": round(acc["cebN"] / cebD, 4) if cebD > 0 else None,
        "anc": {k: (round(acc["ancN"][i] / ancD, 4)
                    if ancD > 0 else None)
                for i, k in enumerate(ANC_KEYS)},
        "hl": (round(acc["hlE"] / acc["pers"], 4)
               if acc["pers"] > 0 else None),
    }


def demo_units(units21, gcp):
    """Per unit: the GCP demo block + the div/national accumulators."""
    nat = {"votes": 0.0, "pers": 0.0, "eng": 0.0, "oth": 0.0,
           "bands": [0.0] * len(DEMO_BANDS), "aust": 0.0, "totc": 0.0,
           "cobns": 0.0, "uni": 0.0, "eduns": 0.0, "pop15": 0.0,
           "bluen": 0.0, "occd": 0.0,
           "inct": 0.0, "incl": 0.0, "inch": 0.0,
           "incb": [0.0] * len(INC_BANDS),
           "incbh": [0.0] * len(INC_BANDS),
           "cobN": [0.0] * len(COB_KEYS),
           "newL": acc_new()}
    divs = {}
    out = {}
    for key, kv in units21.items():
        tot = sum(kv.values())
        if tot <= 0:
            out[key] = None
            continue
        cov = pers = eng = oth = 0.0
        aust = totc = cobns = uni = eduns = pop15 = 0.0
        bluen = occd = 0.0
        inct = incl = inch = 0.0
        bands = [0.0] * len(DEMO_BANDS)
        incb = [0.0] * len(INC_BANDS)
        incbh = [0.0] * len(INC_BANDS)
        cobacc = [0.0] * len(COB_KEYS)
        dvn = acc_new()
        for code, w in kv.items():
            r = gcp.get(code)
            if r is None:
                continue
            cov += w
            pers += w * r[0]
            eng += w * r[1]
            oth += w * r[2]
            ages = r[3]
            for i in range(len(DEMO_BANDS)):
                bands[i] += w * ages[i]
            aust += w * r[4]
            totc += w * r[5]
            cobns += w * r[6]
            uni += w * r[7]
            eduns += w * r[8]
            bluen += w * r[9]
            occd += w * r[10]
            pop15 += w * (r[0] - ages[0] - ages[1])
            inct += w * r[11]
            incl += w * r[12]
            inch += w * r[13]
            for i in range(len(INC_BANDS)):
                incb[i] += w * r[14][i]
                incbh[i] += w * r[15][i]
            for i in range(len(COB_KEYS)):
                cobacc[i] += w * r[16][i]
            acc_row(dvn, r, w)
        dv = divs.setdefault(key[0], {"votes": 0.0, "cov": 0.0,
                                      "pers": 0.0, "eng": 0.0, "oth": 0.0,
                                      "bands": [0.0] * len(DEMO_BANDS),
                                      "aust": 0.0, "totc": 0.0,
                                      "cobns": 0.0, "uni": 0.0,
                                      "eduns": 0.0, "pop15": 0.0,
                                      "bluen": 0.0, "occd": 0.0,
                                      "inct": 0.0, "incl": 0.0,
                                      "inch": 0.0,
                                      "incb": [0.0] * len(INC_BANDS),
                                      "incbh": [0.0] * len(INC_BANDS),
                                      "cobN": [0.0] * len(COB_KEYS),
                                      "newL": acc_new()})
        dv["votes"] += tot
        dv["cov"] += cov
        dv["pers"] += pers
        dv["eng"] += eng
        dv["oth"] += oth
        for i in range(len(DEMO_BANDS)):
            dv["bands"][i] += bands[i]
        for k, v in (("aust", aust), ("totc", totc), ("cobns", cobns),
                     ("uni", uni), ("eduns", eduns), ("pop15", pop15),
                     ("bluen", bluen), ("occd", occd),
                     ("inct", inct), ("incl", incl), ("inch", inch)):
            dv[k] += v
        for i in range(len(INC_BANDS)):
            dv["incb"][i] += incb[i]
            dv["incbh"][i] += incbh[i]
        for i in range(len(COB_KEYS)):
            dv["cobN"][i] += cobacc[i]
        acc_merge(dv["newL"], dvn)
        cov /= tot
        nat["votes"] += tot
        nat["pers"] += pers
        nat["eng"] += eng
        nat["oth"] += oth
        for i in range(len(DEMO_BANDS)):
            nat["bands"][i] += bands[i]
        for k, v in (("aust", aust), ("totc", totc), ("cobns", cobns),
                     ("uni", uni), ("eduns", eduns), ("pop15", pop15),
                     ("bluen", bluen), ("occd", occd),
                     ("inct", inct), ("incl", incl), ("inch", inch)):
            nat[k] += v
        for i in range(len(INC_BANDS)):
            nat["incb"][i] += incb[i]
            nat["incbh"][i] += incbh[i]
        for i in range(len(COB_KEYS)):
            nat["cobN"][i] += cobacc[i]
        acc_merge(nat["newL"], dvn)
        # G01's 11 age bands exclude age-not-stated (no NS column; the
        # residual against Tot_P_P runs anywhere up to ~5% per SA1), so
        # the age shares renormalise on the band sum — the same
        # ex-not-stated basis langOther uses (eng+oth, not Tot_P_P).
        # Foreign-born follows the census's ex-not-stated share too
        # (overseas-stated over country-stated); university is per the
        # G01 aged-15+ population less level-of-education-not-stated
        # (G49B's own not-stated column). Income shares are of the
        # adults-weighted total across G33's stated bands — partial-
        # stated and all-not-stated households sit outside the basis.
        bsum = sum(bands)
        fb_den = totc - cobns
        uni_den = pop15 - eduns
        out[key] = {
            "persons": int(round(pers)),
            "cov": round(cov, 4),
            "langOther":
                round(oth / (eng + oth), 4) if eng + oth > 0 else None,
            "fborn":
                round((fb_den - aust) / fb_den, 4) if fb_den > 0 else None,
            "uni":
                round(uni / uni_den, 4) if uni_den > 0 else None,
            "blue":
                round(bluen / occd, 4) if occd > 0 else None,
            "age": ({b: round(bands[i] / bsum, 4)
                     for i, b in enumerate(DEMO_BANDS)}
                    if bsum > 0 else None),
            "loinc": round(incl / inct, 4) if inct > 0 else None,
            "hiinc": round(inch / inct, 4) if inct > 0 else None,
            "incMed": band_median(incbh) if inct > 0 else None,
            "cob": {k: (round(cobacc[i] / fb_den, 4)
                        if fb_den > 0 else None)
                    for i, k in enumerate(COB_KEYS)},
            "u15": (round((bands[0] + bands[1]) / bsum, 4)
                    if bsum > 0 else None),
            **emit_new(dvn),
        }
    return out, nat, divs


def band_median(masses):
    """Interpolated median weekly income ($) of a pooled band histogram:
    linear inside the median band; None when the basis is empty or the
    median lands in the open top band (never plausible here)."""
    tot = sum(masses)
    if tot <= 0:
        return None
    cum = 0.0
    for (lo, hi), m in zip(INC_BANDS, masses):
        if cum + m >= tot / 2.0:
            if hi is None or m <= 0:
                return None
            return round(lo + (tot / 2.0 - cum) / m * (hi - lo + 1))
        cum += m
    return None


# ------------------------------------------- people-interp (census blends)
# The voter-basis years of the /map/ people-interpolation lanes: the
# people cells interpolate between the bracketing censuses to election
# day at the SEIFA pcti lanes' day-share f (hist.interp_f — the SAME
# map; the cross-read keeps both stores' factors identical), blending
# shares directly. 2019 folds its Ed2-native units on the 2016 GCP
# (g16.load_gcp16) beside the measured 2021 fold; 2016 folds its
# Ed1-native units on the 2011 BCP beside its scoring walk's Ed2 units
# on the 2016 GCP (f ≈ 0.979 — the census sat five weeks after
# election day). The blend emits demoI blocks beside demo: a block
# missing on either census side stays null whole (the display falls
# back to the measured block), and a lane missing on either side stays
# null inside its block (the pcti far-suppressed convention, per
# lane). incMed and the incomeCuts dollar labels pin to the NEAREST
# census side — a blended dollar figure would mix epochs.
INTERP = {
    2016: {"c0": 2011, "c1": 2016},
    2019: {"c0": 2016, "c1": 2021},
}
_G16 = None
_D13 = None


def _g16():
    global _G16
    if _G16 is None:
        spec = importlib.util.spec_from_file_location(
            "g16m", SM / "derive-booth-demo-2016.py")
        _G16 = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_G16)
    return _G16


def _d13():
    global _D13
    if _D13 is None:
        spec = importlib.util.spec_from_file_location(
            "d13m", SM / "derive-booth-demo-2013.py")
        _D13 = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_D13)
    return _D13


def demo_units_i(units, gcp):
    """demo_units folded for the interp sides: identical accumulation,
    except the income band histograms ride only rows that carry them
    (the 2011 BCP-side map emits income scalars but its 14-band
    histograms stay home — they are never a nearest side, so the
    masses are never consumed)."""
    nat = {"votes": 0.0, "pers": 0.0, "eng": 0.0, "oth": 0.0,
           "bands": [0.0] * len(DEMO_BANDS), "aust": 0.0, "totc": 0.0,
           "cobns": 0.0, "uni": 0.0, "eduns": 0.0, "pop15": 0.0,
           "bluen": 0.0, "occd": 0.0,
           "inct": 0.0, "incl": 0.0, "inch": 0.0,
           "incbh": None,
           "newL": acc_new()}
    divs = {}
    out = {}
    for key, kv in units.items():
        tot = sum(kv.values())
        if tot <= 0:
            out[key] = None
            continue
        cov = pers = eng = oth = 0.0
        aust = totc = cobns = uni = eduns = pop15 = 0.0
        bluen = occd = 0.0
        inct = incl = inch = 0.0
        bands = [0.0] * len(DEMO_BANDS)
        incbh = None
        dvn = acc_new()
        for code, w in kv.items():
            r = gcp.get(code)
            if r is None:
                continue
            cov += w
            pers += w * r[0]
            eng += w * r[1]
            oth += w * r[2]
            for i in range(len(DEMO_BANDS)):
                bands[i] += w * r[3][i]
            aust += w * r[4]
            totc += w * r[5]
            cobns += w * r[6]
            uni += w * r[7]
            eduns += w * r[8]
            bluen += w * r[9]
            occd += w * r[10]
            pop15 += w * (r[0] - r[3][0] - r[3][1])
            inct += w * r[11]
            incl += w * r[12]
            inch += w * r[13]
            if len(r) > 15 and r[15] is not None:
                if incbh is None:
                    incbh = [0.0] * len(INC_BANDS)
                for i in range(len(INC_BANDS)):
                    incbh[i] += w * r[15][i]
            acc_row(dvn, r, w)
        dv = divs.setdefault(key[0], {"votes": 0.0, "cov": 0.0,
                                      "pers": 0.0, "eng": 0.0,
                                      "oth": 0.0,
                                      "bands": [0.0] * len(DEMO_BANDS),
                                      "aust": 0.0, "totc": 0.0,
                                      "cobns": 0.0, "uni": 0.0,
                                      "eduns": 0.0, "pop15": 0.0,
                                      "bluen": 0.0, "occd": 0.0,
                                      "inct": 0.0, "incl": 0.0,
                                      "inch": 0.0, "incbh": None,
                                      "newL": acc_new()})
        dv["votes"] += tot
        dv["cov"] += cov
        dv["pers"] += pers
        dv["eng"] += eng
        dv["oth"] += oth
        for i in range(len(DEMO_BANDS)):
            dv["bands"][i] += bands[i]
        for k, v in (("aust", aust), ("totc", totc), ("cobns", cobns),
                     ("uni", uni), ("eduns", eduns), ("pop15", pop15),
                     ("bluen", bluen), ("occd", occd),
                     ("inct", inct), ("incl", incl), ("inch", inch)):
            dv[k] += v
        if incbh is not None:
            if dv["incbh"] is None:
                dv["incbh"] = [0.0] * len(INC_BANDS)
            for i in range(len(INC_BANDS)):
                dv["incbh"][i] += incbh[i]
        acc_merge(dv["newL"], dvn)
        cov /= tot
        nat["votes"] += tot
        nat["pers"] += pers
        nat["eng"] += eng
        nat["oth"] += oth
        for i in range(len(DEMO_BANDS)):
            nat["bands"][i] += bands[i]
        for k, v in (("aust", aust), ("totc", totc), ("cobns", cobns),
                     ("uni", uni), ("eduns", eduns), ("pop15", pop15),
                     ("bluen", bluen), ("occd", occd),
                     ("inct", inct), ("incl", incl), ("inch", inch)):
            nat[k] += v
        if incbh is not None:
            if nat["incbh"] is None:
                nat["incbh"] = [0.0] * len(INC_BANDS)
            for i in range(len(INC_BANDS)):
                nat["incbh"][i] += incbh[i]
        acc_merge(nat["newL"], dvn)
        bsum = sum(bands)
        fb_den = totc - cobns
        uni_den = pop15 - eduns
        out[key] = {
            "persons": int(round(pers)),
            "cov": round(cov, 4),
            "langOther":
                round(oth / (eng + oth), 4) if eng + oth > 0 else None,
            "fborn":
                round((fb_den - aust) / fb_den, 4) if fb_den > 0 else None,
            "uni":
                round(uni / uni_den, 4) if uni_den > 0 else None,
            "blue":
                round(bluen / occd, 4) if occd > 0 else None,
            "age": ({b: round(bands[i] / bsum, 4)
                     for i, b in enumerate(DEMO_BANDS)}
                    if bsum > 0 else None),
            "loinc": round(incl / inct, 4) if inct > 0 else None,
            "hiinc": round(inch / inct, 4) if inct > 0 else None,
            "incMed": band_median(incbh) if incbh is not None else None,
            "u15": (round((bands[0] + bands[1]) / bsum, 4)
                    if bsum > 0 else None),
            **emit_new(dvn),
        }
    return out, nat, divs


_GCP11 = None


def gcp11():
    """The 2011 BCP universe in the _GCP row layout (income histograms
    omitted — see demo_units_i), keyed 7-digit SA1 2011, plus its
    income-cuts meta. Built on derive-booth-demo-2013.py's readers."""
    global _GCP11
    if _GCP11 is not None:
        return _GCP11
    d13 = _d13()
    bcp = d13.load_bcp()
    z = zipfile.ZipFile(d13.BCP_ZIP)
    ad4, nonfam, inc_path = income_factors()
    inc, cut, hishare = d13.income_bcp(z, ad4, nonfam)
    z.close()
    if set(inc) != set(bcp):
        fail("B01/B28 SA1 universes diverge (gcp11)")
    out = {}
    for code, r in bcp.items():
        ir = inc[code]
        if any(r[k] is None for k in
               ("aus", "totc", "cobns", "uni", "eduns", "bluen", "occd",
                "sch6", "indig", "indigDen", "relvec", "relNS",
                "relTot", "ten6", "famN", "famD", "citz", "mtw",
                "ceb3", "ancn", "ancP")):
            continue  # short-table SA1s: coverage drop, never null maths
        y12t = (sum(r["sch6"][1:]), sum(r["sch6"]))
        out[code] = (r["pers"], r["eng"], r["oth"], tuple(r["ages"]),
                     r["aus"], r["totc"], r["cobns"], r["uni"],
                     r["eduns"], r["bluen"], r["occd"],
                     ir[0], ir[1], ir[2],
                     None, None, None,            # slots 14/15/16 hist-cob pads
                     y12t, (r["indig"], r["indigDen"]),
                     tuple(r["relvec"]), (r["relNS"], r["relTot"]),
                     tuple(r["ten6"]), (r["famN"], r["famD"]),
                     r["citz"], (r["mtw"]["n"], r["mtw"]["t"],
                                 r["mtw"]["ns"]),
                     (r["ceb3"], r["cebns"], r["cebt"]),
                     (tuple(r["ancn"]), r["ancP"], r["ancns"]),
                     r["hle"] or 0.0)
    print(f"gcp11: BCP 2011 in the _GCP layout, {len(out)} SA1s")
    _GCP11 = (out, {"loCutWeekly": cut, "hiEdgeWeekly": 4000,
                    "hiNationalShare": hishare, "loQuantile": INC_LO_Q,
                    "dollarsYear": 2011,
                    "factors": str(inc_path.relative_to(ROOT))})
    return _GCP11


def interp_f_year(year, c0, c1):
    """The pcti lanes' own day-share (derive-booth-seifa-hist.py's
    map — the demo blend rides the identical factors to the last
    decimal; f > 0.5 means the newer census is the nearest side)."""
    return hist.interp_f(year, c0, c1)


def lane_blend(a, b, f):
    return round((1 - f) * a + f * b, 4) if a is not None \
        and b is not None else None


def blend_demo(c0blk, c1blk, f):
    """One demoI block out of two census-side blocks; the block needs
    BOTH census sides (a one-sided block stays null whole, so the
    display falls back to the measured block), and inside it a lane
    missing on either side is null (the per-lane pcti doctrine — never
    a one-sided value wearing the blend's label)."""
    if c0blk is None or c1blk is None:
        return None
    out = {"persons": int(round(
        (1 - f) * c0blk["persons"] + f * c1blk["persons"]))
        if c0blk is not None and c1blk is not None
        and c0blk["persons"] is not None and c1blk["persons"] is not None
        else None}
    for k in ("langOther", "fborn", "uni", "blue", "loinc", "hiinc",
              "y12less", "atsci", "u15", "onepar", "pt", "noncit",
              "bigfam", "hl"):
        out[k] = lane_blend(c0blk.get(k) if c0blk else None,
                            c1blk.get(k) if c1blk else None, f)
    a0 = c0blk.get("age") if c0blk else None
    a1 = c1blk.get("age") if c1blk else None
    out["age"] = ({b: lane_blend(None if a0 is None else a0.get(b),
                                 None if a1 is None else a1.get(b), f)
                   for b in DEMO_BANDS}
                  if a0 is not None or a1 is not None else None)
    # the select-family lanes blend per option like the age bands do
    for which, keys in (("rel", REL_KEYS), ("ten", TEN_KEYS),
                        ("anc", ANC_KEYS)):
        d0 = c0blk.get(which) if c0blk else None
        d1 = c1blk.get(which) if c1blk else None
        out[which] = ({k: lane_blend(None if d0 is None
                                     else d0.get(k),
                                     None if d1 is None
                                     else d1.get(k), f)
                       for k in keys}
                      if d0 is not None or d1 is not None else None)
    return out


def div_block(dv, votes, incbh_medians=True):
    """The store's division-row emission shape out of a fold's
    division accumulator (mirrors the divisions[] builder below)."""
    tot = votes
    bsum = sum(dv["bands"])
    fb_den = dv["totc"] - dv["cobns"]
    uni_den = dv["pop15"] - dv["eduns"]
    return {
        "votes": int(round(tot)),
        "persons": int(round(dv["pers"])),
        "cov": round(dv["cov"] / tot, 4) if tot > 0 else None,
        "langOther": round(dv["oth"] / (dv["eng"] + dv["oth"]), 4)
        if dv["eng"] + dv["oth"] > 0 else None,
        "fborn": round((fb_den - dv["aust"]) / fb_den, 4)
        if fb_den > 0 else None,
        "uni": round(dv["uni"] / uni_den, 4) if uni_den > 0 else None,
        "blue": round(dv["bluen"] / dv["occd"], 4)
        if dv["occd"] > 0 else None,
        "age": ({b: round(dv["bands"][i] / bsum, 4)
                 for i, b in enumerate(DEMO_BANDS)}
                if bsum > 0 else None),
        "loinc": round(dv["incl"] / dv["inct"], 4)
        if dv["inct"] > 0 else None,
        "hiinc": round(dv["inch"] / dv["inct"], 4)
        if dv["inct"] > 0 else None,
        "incMed": (band_median(dv["incbh"])
                   if dv["incbh"] is not None else None),
        "u15": (round((dv["bands"][0] + dv["bands"][1]) / bsum, 4)
                if bsum > 0 else None),
        **emit_new(dv["newL"]),
    }


def nat_block(nat):
    """companion of div_block for the national pool"""
    nat_b = sum(nat["bands"]) or 1
    nat_eo = nat["eng"] + nat["oth"]
    nat_fbd = nat["totc"] - nat["cobns"]
    nat_unid = nat["pop15"] - nat["eduns"]
    nat_inc = nat["inct"]
    return {
        "langOther": round(nat["oth"] / nat_eo, 4) if nat_eo else None,
        "fborn": round((nat_fbd - nat["aust"]) / nat_fbd, 4)
        if nat_fbd > 0 else None,
        "uni": round(nat["uni"] / nat_unid, 4) if nat_unid else None,
        "blue": round(nat["bluen"] / nat["occd"], 4)
        if nat["occd"] > 0 else None,
        "age0_14": round(
            (nat["bands"][0] + nat["bands"][1]) / nat_b, 4),
        "age65ov": round(sum(nat["bands"][8:]) / nat_b, 4),
        "loinc": round(nat["incl"] / nat_inc, 4)
        if nat_inc > 0 else None,
        "hiinc": round(nat["inch"] / nat_inc, 4)
        if nat_inc > 0 else None,
        "incMed": (band_median(nat["incbh"])
                   if nat["incbh"] is not None else None),
        **emit_new(nat["newL"]),
    }


def interp_side(year, conf, c):
    """Fold side c for the interp year's lanes: returns
    (demo_map, nat, div, meta) for either census edge."""
    g = _g16()
    if c == 2021:
        gcp, meta = load_gcp21()
        units21, drop = units_to_ed3(_INTERP_UNITS[year], conf,
                                     _CC[conf["ed"]],
                                     load_xwalk()
                                     if conf["ed"] == "Ed2"
                                     else load_xwalk11())
        du = demo_units_i(units21, gcp)
        return (*du, {"loCutWeekly": meta["loCutWeekly"],
                      "hiEdgeWeekly": meta["hiEdgeWeekly"],
                      "hiNationalShare": meta["hiNationalShare"],
                      "loQuantile": meta["loQuantile"],
                      "dollarsYear": 2021})
    if c == 2016:
        gcp, meta = g.load_gcp16()
        units16 = _INTERP_UNITS16.get(year) or _INTERP_UNITS[year]
        return (*demo_units_i(units16, gcp),
                {"loCutWeekly": meta["loCutWeekly"],
                 "hiEdgeWeekly": meta["hiEdgeWeekly"],
                 "hiNationalShare": meta["hiNationalShare"],
                 "loQuantile": meta["loQuantile"], "dollarsYear": 2016})
    if c == 2011:
        gcp, meta = gcp11()
        return (*demo_units_i(_INTERP_UNITS[year], gcp),
                dict(meta))
    fail(f"interp side {c}")


# native/edition-keyed unit maps captured mid-build() for the interp
# sides: the interp fold rides the SAME walk intermediates scoring uses
_INTERP_UNITS = {}
_INTERP_UNITS16 = {}


# ------------------------------------------------------------- votes files
LANES = {
    2025: {"file": VDIR / "2025-federal-election-votes-sa1-nat.csv",
           "fmt": "csv", "idcol": "ccd_id", "ed": "Ed3", "mode": "direct21",
           "fpv": "2025", "seifa": 2021},
    2022: {"file": VDIR / "votes-sa1-2022.csv",
           "fmt": "csv", "idcol": "ccd_id", "ed": "Ed2", "mode": "xwalk21",
           "fpv": "2022", "seifa": 2021},
    2019: {"file": VDIR / "votes-sa1-2019.csv",
           "fmt": "csv", "idcol": "SA1_id", "ed": "Ed2", "mode": "direct",
           "fpv": "2019", "seifa": 2016},
    2016: {"file": VDIR / "votes-sa1-2016.xlsx",
           "fmt": "xlsx", "idcol": "SA1_id", "ed": "Ed1", "mode": "direct",
           "score": "xwalk16", "fpv": "2016", "seifa": 2016},
}
# data rows only (2016 xlsx counts the header separately: sheet total 934,147)
VOTES_ROWS = {2025: 1064065, 2022: 1000189, 2019: 1003235, 2016: 934146}


def years_run():
    if ONLY_YEAR is not None:
        if ONLY_YEAR not in LANES:
            fail(f"unknown --year {ONLY_YEAR}")
        return [ONLY_YEAR]
    return sorted(LANES)


def vote_rows(year, conf):
    """Yield (div, ccd, pp_id, pp_nm, votes); ids normalised to str."""
    path = conf["file"]
    idcol = conf["idcol"]
    if not path.exists():
        fail(f"missing votes input {path} (see docstring refetch)")
    if conf["fmt"] == "csv":
        with open(path, newline="", encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            want = ["year", "state_ab", "div_nm", idcol, "pp_id", "pp_nm", "votes"]
            if [c.strip() for c in rdr.fieldnames] != want:
                fail(f"{path.name}: header drift {rdr.fieldnames}")
            for row in rdr:
                if row["year"].strip() != str(year):
                    fail(f"{path.name}: year drift {row['year']!r}")
                yield (row["div_nm"].strip(), row[idcol].strip(),
                       row["pp_id"].strip(), row["pp_nm"].strip(),
                       int(row["votes"] or 0))
    else:
        wb = openpyxl.load_workbook(path, read_only=True)
        if wb.sheetnames[0] != "HouseCatchment (2016FE)":
            fail(f"{path.name}: sheet drift {wb.sheetnames[0]!r}")
        ws = wb[wb.sheetnames[0]]
        it = ws.iter_rows(values_only=True)
        if tuple(next(it)) != ("year", "state_ab", "div_nm", "SA1_id",
                               "pp_id", "pp_nm", "votes"):
            fail(f"{path.name}: header drift")
        for row in it:
            if row[0] != year:
                fail(f"{path.name}: year drift {row[0]!r}")
            yield (str(row[2]).strip(), str(int(row[3])),
                   str(int(row[4])), str(row[5]).strip(), int(row[6] or 0))


def is_sentinel(ccd):
    """ABS migratory/no-usual-address senders: …9999 overflows everywhere,
    plus the 2016-era OT sentinel 9999901 (9-state + 99999 trunk)."""
    return ccd.endswith("9999") or ccd.startswith("99999")


def load_votes(year, conf, ccdmap, xwalk):
    """Aggregate to units {(div,kind,oid): {sa1_join_key: vote_weight}}."""
    units = defaultdict(Counter)
    cohort_names = Counter()
    sent_ids = Counter()
    sent_votes = drop_xw = 0
    n = 0
    mode = conf["mode"]
    for div, ccd, pp, pp_nm, v in vote_rows(year, conf):
        n += 1
        v = int(v)
        if mode == "direct":
            if ccd not in ccdmap:
                if is_sentinel(ccd):
                    sent_ids[ccd] += v
                    sent_votes += v
                    continue
                fail(f"{year}: unknown 7-digit id {ccd!r} (not sentinel)")
            targets = ((ccd, 1.0),)
        else:
            code10 = ccdmap.get(ccd)
            if code10 is None:
                if is_sentinel(ccd):
                    sent_ids[ccd] += v
                    sent_votes += v
                    continue
                fail(f"{year}: unmapped ccd {ccd!r} (not sentinel)")
            if mode == "direct21":
                targets = ((code10, 1.0),)
            else:
                ts = xwalk.get(code10)
                if not ts:
                    drop_xw += v
                    continue
                targets = ts
                rs = sum(t[1] for t in ts)
                if rs < 0.999:
                    drop_xw += v * (1.0 - rs)
        key = (div, "cohort", pp_nm) if pp == "0" else (div, "booth", int(pp))
        if pp == "0":
            if pp_nm not in COHORTS:
                fail(f"{year}: cohort vocab drift {pp_nm!r}")
            cohort_names[pp_nm] += 1
        for tcode, r in targets:
            units[key][tcode] += v * r
    if n != VOTES_ROWS[year]:
        fail(f"{year}: votes rows {n} != pin {VOTES_ROWS[year]}")
    print(f"{year} votes: {n} rows, {len(units)} units, cohorts "
          f"{dict(cohort_names)}, sentinel ids {len(sent_ids)} votes "
          f"{sent_votes}, xwalk-dropped {round(drop_xw)}")
    return units, sent_ids, round(drop_xw)


# ------------------------------------------------------------- scoring
def score_units(units, cube):
    """Per unit: votes, sa1 count, per-index covered shares + weighted means."""
    stats = {}
    for key, kv in units.items():
        tot = sum(kv.values())
        ws = dict.fromkeys(INDEXES, 0.0)
        kept = dict.fromkeys(INDEXES, 0.0)
        for code, w in kv.items():
            s = cube.get(code)
            if s is None:
                continue
            for i in INDEXES:
                sc = s[i]
                if sc is not None:
                    ws[i] += w * sc
                    kept[i] += w
        stats[key] = {
            "votes": int(round(tot)), "sa1s": len(kv),
            "cov": {i: round(kept[i] / tot, 4) if tot else 0 for i in INDEXES},
            "seifa": {i: round(ws[i] / kept[i], 1) if kept[i] else None
                      for i in INDEXES},
        }
    return stats


# ------------------------------------------------------------- venue + fpv
def load_venue(year):
    path = ROOT / f"data/booth-seifa-{year}.json"
    st = json.loads(path.read_text())
    rows = st["booths"]
    if len({(b["div"], b["boothId"]) for b in rows}) != len(rows):
        fail(f"venue store {year}: dup (div,boothId)")
    return path, rows


def load_fpv(year):
    """(DivisionNm, PollingPlaceID) -> ordinary formal FPV total."""
    tot = Counter()
    files = sorted(FPV.glob(f"{year}-*.csv.gz"))
    if not files:
        fail(f"fpv: no oracle files for {year}")
    for fcsv in files:
        with gzip.open(fcsv, "rt", newline="") as fh:
            next(fh)  # banner line
            rdr = csv.DictReader(fh)
            if [c.strip() for c in rdr.fieldnames][:5] != \
                    ["StateAb", "DivisionID", "DivisionNm",
                     "PollingPlaceID", "PollingPlace"]:
                fail(f"fpv: header drift {fcsv.name}")
            for row in rdr:
                tot[(row["DivisionNm"], int(row["PollingPlaceID"]))] += \
                    int(row["OrdinaryVotes"])
    return tot


# ------------------------------------------------------------------ main
_CC = None


def build(year):
    conf = LANES[year]
    vpath, venue_rows = load_venue(year)
    cube = cube_for(year, conf.get("score", conf["mode"]))
    xwalk = load_xwalk() if conf["mode"] == "xwalk21" else None
    units, sent_ids, drop_xw = load_votes(year, conf, _CC[conf["ed"]], xwalk)
    sent_votes = sum(sent_ids.values())
    if year in INTERP:
        _INTERP_UNITS[year] = units
    if conf.get("score") == "xwalk16":
        units16, drop16 = units_to_ed2(units, _CC[conf["ed"]], load_xwalk1116())
        if year in INTERP:
            _INTERP_UNITS16[year] = units16
        print(f"{year} scores: walked onto 2016 SA1s, {drop16} votes on no 2016 target")
        stats = score_units(units16, cube)
        # the unit's own vote total stays the file's (the walk only moves
        # weights between SA1 editions); sa1s counts the file's SA1s
        for key, st in stats.items():
            tot0, tot16 = sum(units[key].values()), sum(units16[key].values())
            st["votes"] = int(round(tot0))
            st["sa1s"] = len(units[key])
            # coverage stays a share of the file's votes: a vote the walk
            # could not place counts as uncovered
            f = tot16 / tot0 if tot0 else 0
            st["cov"] = {i: round(c * f, 4) for i, c in st["cov"].items()}
    else:
        stats = score_units(units, cube)
    fpv = load_fpv(conf["fpv"])

    gcp, gcp_meta = load_gcp21()
    if conf["mode"] in ("direct21", "xwalk21"):
        units21, demo_drop = units, 0
    else:
        xw_d = load_xwalk() if conf["ed"] == "Ed2" else load_xwalk11()
        units21, demo_drop = units_to_ed3(units, conf, _CC[conf["ed"]], xw_d)
    demo_map, demo_nat, demo_div = demo_units(units21, gcp)
    if demo_drop:
        print(f"{year} demo: {demo_drop} votes land on no Ed3 target")

    # people-interp sides: fold the election's units on both bracketing
    # censuses and blend the shares (module header comment)
    interp = INTERP.get(year)
    demoI_map = demoI_divs = demoI_national = incuts_i = demo_interp = None
    if interp is not None:
        f = hist.interp_f(year, interp["c0"], interp["c1"])
        near = interp["c1"] if f > 0.5 else interp["c0"]
        side, meta_i = {}, {}
        for c in (interp["c0"], interp["c1"]):
            dm, nt, dv, mt = interp_side(year, conf, c)
            side[c] = {"map": dm, "nat": nt, "div": dv, "meta": mt}
            meta_i[c] = mt
        demoI_map = {}
        (c0, c1), s0, s1 = (interp["c0"], interp["c1"]), \
            side[interp["c0"]], side[interp["c1"]]
        nmap = side[near]["map"]
        for key in set(s0["map"]) | set(s1["map"]):
            bi = blend_demo(s0["map"].get(key),
                            s1["map"].get(key), f)
            if bi is not None:
                nb = nmap.get(key)
                # booth demoI incMed pins to the nearest census side,
                # like the division blocks — a nearest-side row that
                # stays null hands the lane to the measured figure
                bi["incMed"] = nb.get("incMed") if nb else None
            demoI_map[key] = bi
        nbi = {}
        nb0, nb1 = nat_block(s0["nat"]), nat_block(s1["nat"])
        for k in ("langOther", "fborn", "uni", "blue", "age0_14",
                  "age65ov", "loinc", "hiinc", "y12less", "atsci",
                  "onepar", "pt", "noncit", "bigfam", "hl"):
            nbi[k] = lane_blend(nb0.get(k), nb1.get(k), f)
        for which, keys in (("rel", REL_KEYS), ("ten", TEN_KEYS),
                            ("anc", ANC_KEYS)):
            d0, d1 = nb0.get(which), nb1.get(which)
            nbi[which] = ({k: lane_blend(
                None if d0 is None else d0.get(k),
                None if d1 is None else d1.get(k), f)
                for k in keys}
                if d0 is not None or d1 is not None else None)
        nbi["incMed"] = nat_block(side[near]["nat"])["incMed"]
        demoI_national = nbi
        demoI_divs = {}
        for div in set(s0["div"]) | set(s1["div"]):
            b0 = div_block(s0["div"][div], s0["div"][div]["votes"]) \
                if div in s0["div"] else None
            b1 = div_block(s1["div"][div], s1["div"][div]["votes"]) \
                if div in s1["div"] else None
            ib = blend_demo(b0, b1, f) if b0 is not None \
                or b1 is not None else None
            if ib is not None:
                ndv = side[near]["div"].get(div)
                ib["incMed"] = (band_median(ndv["incbh"]) if ndv is not None
                                and ndv["incbh"] is not None else None)
                if near == c0 and ib["incMed"] is None:
                    fail(f"{year}: {div} nearest side {near} carries no "
                         "incbh histogram")
            demoI_divs[div] = ib
        demo_interp = {
            "f": f, "c0": c0, "c1": c1, "nearestSide": near,
            "censusNights": {str(c0): hist.CENSUS_NIGHT[c0].isoformat(),
                             str(c1): hist.CENSUS_NIGHT[c1].isoformat()},
            "blend": "shares",
            "nullRule": ("a unit missing its demo block on either "
                         "census side, or a lane missing on either "
                         "side, shows the measured figure instead"),
        }
        incuts_i = {
            "loQuantile": INC_LO_Q,
            "loCutWeekly": meta_i[near]["loCutWeekly"],
            "hiEdgeWeekly": meta_i[near]["hiEdgeWeekly"],
            "hiNationalShare": meta_i[near]["hiNationalShare"],
            "dollarsYear": near,
            "adultsWeights": "data/income-dist.json",
            "medianBasis": "households (shares are per-adult)",
            "sides": {
                str(c): {"loCutWeekly": meta_i[c]["loCutWeekly"],
                         "dollarsYear": c,
                         "hiNationalShare":
                             meta_i[c]["hiNationalShare"]}
                for c in (c0, c1)},
        }
        print(f"{year} interp: {c0}<--f={f}-->{c1}, nearest {near}, "
              f"{sum(1 for v in demoI_map.values() if v)} demoI rows")

    venue_by = {(b["div"], b["boothId"]): b for b in venue_rows}
    vote_keys = {(k[0], k[2]) for k in stats if k[1] == "booth"}
    if {b["div"] for b in venue_rows} != {k[0] for k in vote_keys}:
        vd, vv = {k[0] for k in vote_keys}, {b["div"] for b in venue_rows}
        fail(f"{year} div drift: votes-only {sorted(vd - vv)}, "
             f"venue-only {sorted(vv - vd)}")
    extra = vote_keys - set(venue_by)
    if extra:
        fail(f"{year}: votes booths not in venue store: {sorted(extra)[:8]}")
    no_votes = sorted(set(venue_by) - vote_keys)
    divstate = {b["div"]: b["state"] for b in venue_rows}

    # reconcile vs FPV ordinary totals (deterministic iteration)
    matched = missing = 0
    rels = []
    maxabs = (0, None)
    for div, pid in sorted(vote_keys):
        st = stats[(div, "booth", pid)]
        off = fpv.get((div, pid))
        if off is None:
            missing += 1
            continue
        matched += 1
        d = st["votes"] - off
        if off > 0:
            rels.append(d / off)
        if abs(d) > maxabs[0]:
            maxabs = (abs(d), f"{div}|{pid}|sa1file vs fpv diff {d:+d}")
    rels_abs = sorted(abs(r) for r in rels)
    recon = {
        "matched": matched, "missing": missing,
        "medianAbsPct": round(statistics.median(rels_abs) * 100, 2),
        "p95AbsPct": round(rels_abs[int(len(rels_abs) * 0.95)] * 100, 2),
        "maxAbs": maxabs[0], "maxAbsBooth": maxabs[1],
    }

    # per-booth rows in venue-store order
    out_booths = []
    deltas = {i: [] for i in INDEXES}
    scored = 0
    for vb in venue_rows:
        st = stats.get((vb["div"], "booth", vb["boothId"]))
        vseifa = vb.get("seifa")
        rec = {"div": vb["div"], "divId": vb["divId"], "state": vb["state"],
               "boothId": vb["boothId"], "booth": vb["booth"],
               "type": vb["type"]}
        if st is None:
            rec["votes"] = None
            rec["note"] = "noVotesRows"
            rec["seifa"] = None
            rec["demo"] = None
        else:
            seifa = st["seifa"] if any(
                v is not None for v in st["seifa"].values()) else None
            rec["votes"] = st["votes"]
            rec["sa1s"] = st["sa1s"]
            rec["cov"] = st["cov"]
            rec["seifa"] = seifa
            rec["demo"] = demo_map.get((vb["div"], "booth", vb["boothId"]))
            if demoI_map is not None:
                rec["demoI"] = demoI_map.get(
                    (vb["div"], "booth", vb["boothId"]))
            if seifa:
                scored += 1
            if vseifa and seifa:
                for i in INDEXES:
                    if vseifa.get(i) is not None and seifa[i] is not None:
                        deltas[i].append(abs(seifa[i] - vseifa[i]))
        out_booths.append(rec)

    cohorts = []
    for (div, kind, name), st in stats.items():
        if kind != "cohort":
            continue
        cohorts.append({"div": div, "state": divstate[div], "cohort": name,
                        "votes": st["votes"], "sa1s": st["sa1s"],
                        "cov": st["cov"],
                        "seifa": st["seifa"] if any(
                            v is not None for v in st["seifa"].values())
                        else None,
                        "demo": demo_map.get((div, "cohort", name)),
                        **({"demoI": demoI_map.get((div, "cohort", name))}
                           if demoI_map is not None else {})})
    cohorts.sort(key=lambda c: (STATE_ORDER[c["state"]], c["div"], c["cohort"]))

    diverge = {}
    for i in INDEXES:
        ds = sorted(deltas[i])
        if ds:
            diverge[i] = {
                "compared": len(ds),
                "medianAbs": round(statistics.median(ds), 1),
                "p95Abs": round(ds[int(len(ds) * 0.95)], 1),
                "moved100": sum(1 for d in ds if d >= 100),
            }

    bkeys = [k for k in stats if k[1] == "booth"]
    vtot_b = sum(stats[k]["votes"] for k in bkeys) or 1
    cov_all = {i: round(sum(stats[k]["cov"][i] * stats[k]["votes"]
                            for k in bkeys) / vtot_b, 4) for i in INDEXES}

    counts = {
        "booths": len(out_booths), "boothsScored": scored,
        "boothsNoVotesFile": len(no_votes),
        "boothsNoVotesFileIds": [f"{d}|{p}" for d, p in no_votes],
        "cohortRows": len(cohorts),
        "votesTotal": sum(stats[k]["votes"] for k in bkeys) +
        sum(c["votes"] for c in cohorts) + sent_votes + drop_xw,
        "votesSentinel": sent_votes,
        "sentinelIds": sorted(sent_ids),
        "coverage": cov_all,
        "reconcileFpv": recon,
        "venueDelta": diverge,
    }
    if drop_xw:
        counts["votesDroppedXwalk"] = drop_xw

    demo_rows = sum(1 for v in demo_map.values() if v)
    cov_demo = round(sum(demo_map[k]["cov"] * stats[k]["votes"]
                         for k in bkeys if demo_map.get(k)) / vtot_b, 4)
    nat_b = sum(demo_nat["bands"]) or 1
    nat_eo = demo_nat["eng"] + demo_nat["oth"]
    nat_fbd = demo_nat["totc"] - demo_nat["cobns"]
    nat_unid = demo_nat["pop15"] - demo_nat["eduns"]
    nat_inc = demo_nat["inct"]
    counts["demo"] = {
        "rows": demo_rows,
        "coverage": cov_demo,
        **({"votesDroppedWalk": demo_drop} if demo_drop else {}),
        "national": {
            "langOther": round(demo_nat["oth"] / nat_eo, 4)
            if nat_eo else None,
            "fborn": round((nat_fbd - demo_nat["aust"]) / nat_fbd, 4)
            if nat_fbd > 0 else None,
            "uni": round(demo_nat["uni"] / nat_unid, 4)
            if nat_unid > 0 else None,
            "blue": round(demo_nat["bluen"] / demo_nat["occd"], 4)
            if demo_nat["occd"] > 0 else None,
            "age0_14": round(
                (demo_nat["bands"][0] + demo_nat["bands"][1]) / nat_b, 4),
            "age65ov": round(sum(demo_nat["bands"][8:]) / nat_b, 4),
            "loinc": round(demo_nat["incl"] / nat_inc, 4)
            if nat_inc > 0 else None,
            "hiinc": round(demo_nat["inch"] / nat_inc, 4)
            if nat_inc > 0 else None,
            "cob": {k: (round(demo_nat["cobN"][i] / nat_fbd, 4)
                        if nat_fbd > 0 else None)
                    for i, k in enumerate(COB_KEYS)},
            "incMed": band_median(demo_nat["incbh"]),
            "u15": round(
                (demo_nat["bands"][0] + demo_nat["bands"][1])
                / nat_b, 4),
            **emit_new(demo_nat["newL"]),
        },
    }
    if demoI_national is not None:
        counts["demoI"] = {
            "rows": sum(1 for v in demoI_map.values() if v),
            "national": demoI_national,
        }

    # the division level: the same per-SA1 tallies re-pooled by division
    # (one pass over the div accumulators — a division's shares come from
    # its own SA1 sum, never from averaging rounded row shares). votes is
    # the stats count (booth + cohort rows), cov the share of its
    # demo-weights that mapped onto populated SA1s.
    div_votes = defaultdict(int)
    for (div, _, _), st in stats.items():
        div_votes[div] += st["votes"]
    divisions = []
    for div in sorted(demo_div, key=lambda nm: (STATE_ORDER[divstate[nm]], nm)):
        dv = demo_div[div]
        tot = dv["votes"]
        bsum = sum(dv["bands"])
        fb_den = dv["totc"] - dv["cobns"]
        uni_den = dv["pop15"] - dv["eduns"]
        divisions.append({
            "div": div, "state": divstate[div],
            "votes": div_votes.get(div, int(round(tot))),
            "persons": int(round(dv["pers"])),
            "cov": round(dv["cov"] / tot, 4) if tot > 0 else None,
            "langOther": round(dv["oth"] / (dv["eng"] + dv["oth"]), 4)
                if dv["eng"] + dv["oth"] > 0 else None,
            "fborn": round((fb_den - dv["aust"]) / fb_den, 4)
                if fb_den > 0 else None,
            "uni": round(dv["uni"] / uni_den, 4)
                if uni_den > 0 else None,
            "blue": round(dv["bluen"] / dv["occd"], 4)
                if dv["occd"] > 0 else None,
            "age": ({b: round(dv["bands"][i] / bsum, 4)
                     for i, b in enumerate(DEMO_BANDS)}
                    if bsum > 0 else None),
            "loinc": round(dv["incl"] / dv["inct"], 4)
                if dv["inct"] > 0 else None,
            "hiinc": round(dv["inch"] / dv["inct"], 4)
                if dv["inct"] > 0 else None,
            "cob": {k: (round(dv["cobN"][i] / fb_den, 4)
                        if fb_den > 0 else None)
                    for i, k in enumerate(COB_KEYS)},
            "incMed": band_median(dv["incbh"]),
            "u15": (round((dv["bands"][0] + dv["bands"][1]) / bsum, 4)
                    if bsum > 0 else None),
            **emit_new(dv["newL"]),
        })
        if demoI_divs is not None:
            divisions[-1]["demoI"] = demoI_divs.get(div)

    mode_note = {
        "xwalk16": ". Scores are SEIFA 2016: each 2011 SA1's votes are "
            "redistributed over 2016 SA1s by the ABS CG_SA1_2011_SA1_2016 "
            "correspondence (its population ratios) – the election fell five "
            "weeks before the 2016 census",
        "direct": f". Scores are SEIFA {conf['seifa']} joined direct on the cube's 7-digit key",
        "direct21": ". Scores are SEIFA 2021, the 7-digit ccd decoded to "
            "SA1_CODE21 and joined to the 2021-census cube",
        "xwalk21": ". Scores are SEIFA 2021: each 2016 SA1's votes are "
            "redistributed over SA1_CODE21 targets by the ABS "
            "CG_SA1_2016_SA1_2021 correspondence (RATIO_FROM_TO shares)",
    }[conf.get("score", conf["mode"])]
    interp_note = (
        f" The demoI blocks interpolate the people figures between the "
        f"{interp['c0']} and {interp['c1']} censuses to election day "
        f"(day-share {demo_interp['f']} of the intercensal span — the "
        f"SEIFA pcti lanes' own factors): each demoI lane blends the "
        f"shares of this election's votes folded on both censuses, a "
        f"lane missing on either side falling back to the measured "
        f"demo figure for that lane; incMed and the incomeCutsI dollar "
        f"figures come from the {demo_interp['nearestSide']} census "
        f"side alone, never a mixed-currency blend."
        if demo_interp is not None else "")
    out = {
        "_about": (
            "Voter-footprint SEIFA per federal booth: vote-weighted mean "
            "SEIFA scores over the SA1s where the booth's VOTERS live "
            "(AEC 'Votes by SA1' roll mark-off x results product — "
            "AEC-flagged indicative, rounded), the footprint complement "
            "to the venue-proxy store booth-seifa-YYYY.json (SA1 of the "
            "premises). Votes SA1s are ASGS " + conf["ed"] + mode_note +
            ". Per-index ABS suppression: each index weights over its own "
            "covered votes (cov). Sentinel …9999 no-address SA1s are "
            "vote-counted but score-excluded. pp_id 0 rows are division "
            "declaration cohorts (Postal/Pre-Poll/Absent/Provisional), "
            "emitted per division, not per booth. Booths the votes file "
            "never lists (unused PPVCs, cancelled mobile teams) carry "
            "votes:null and note:noVotesRows. The divisions array "
            "re-pools every unit's per-SA1 demo tallies by division: one "
            "language/foreign-born/university/blue-collar/age/income "
            "reading per division plus the curated birthplace-country "
            "(cob) shares (same country-stated basis as fborn; country "
            "order in cobKeys), "
            "its shares from its own pooled sum, never from averaging "
            "the row-level rounded shares.") + DEMO_ABOUT[year] + interp_note,
        "_provenance": {
            "sourceUrls": {
                "votes": {2016: "AEC 2016 downloads, Votes by SA1 (xlsx)",
                          2019: "AEC 2019 downloads, Votes by SA1",
                          2022: "AEC 2022 downloads, Votes by SA1",
                          2025: "AEC fe25 downloads-statistics, Votes by SA1 – national"}[year],
                "fpvOracle": "VTR HouseStateFirstPrefsByPollingPlaceDownload",
                "gcp": "ABS 2021 Census GCP datapack (SA1, G01/G07/G09/"
                       "G14/G32/G33/G37/G49B/G60B)",
                **({"crosswalk": "ABS CG_SA1_2016_SA1_2021 (ASGS Ed3 correspondences page)"}
                   if conf["mode"] == "xwalk21" else {}),
                **({"crosswalkEd1": "ABS CG_SA1_2011_SA1_2016 (ASGS Ed2 correspondences page)"}
                   if year == 2016 else {}),
                **({"gcpInterp": "ABS 2016 Census GCP datapack (SA1, "
                                 "G01/G07/G09/G14/G28/G29/G33/G46B/G57B)"}
                   if demo_interp is not None else {}),
                **({"bcpInterp": "ABS 2011 Census Basic Community "
                                 "Profile, SA1 for AUST "
                                 "(B01/B07/B09/B14/B16/B25/B26/B28/"
                                 "B32/B40B/B45B)"}
                   if demo_interp is not None and interp["c0"] == 2011
                   else {}),
            },
            "files": {
                str(conf["file"].relative_to(ROOT)): hash16(conf["file"]),
                str(vpath.relative_to(ROOT)): hash16(vpath),
                str(GCP_ZIP.relative_to(ROOT)): hash16(GCP_ZIP),
                **({"cache/gcp-sa1-2016.zip": hash16(
                        SM / "cache/gcp-sa1-2016.zip")}
                   if demo_interp is not None else {}),
                **({"cache/bcp-sa1-2011.zip": hash16(
                        SM / "cache/bcp-sa1-2011.zip")}
                   if demo_interp is not None and interp["c0"] == 2011
                   else {}),
                **({str((VDIR / "CG_SA1_2016_SA1_2021.csv").relative_to(ROOT)):
                        hash16(VDIR / "CG_SA1_2016_SA1_2021.csv")}
                   if conf["mode"] == "xwalk21" else {}),
                **({str((ABS / "dl/CG_SA1_2011_SA1_2016.xlsx")
                        .relative_to(ROOT)): hash16(
                            ABS / "dl/CG_SA1_2011_SA1_2016.xlsx")}
                   if year == 2016 else {}),
            },
            "extractedAt": str(date.today()),
        },
        "election": year,
        "seifaEdition": conf["seifa"],
        "votesGeography": {"Ed1": "SA1 (ASGS 2011, 7-digit)",
                           "Ed2": "SA1 (ASGS 2016, 7-digit)",
                           "Ed3": "SA1 (ASGS Ed3 2021, 7-digit ccd)"}[conf["ed"]],
        "indexes": list(INDEXES),
        "demoBasis": DEMO_BASIS,
        "cobKeys": COB_KEYS,
        "relKeys": list(REL_KEYS),
        "tenKeys": list(TEN_KEYS),
        "ancKeys": list(ANC_KEYS),
        "incomeCuts": {
            "loQuantile": gcp_meta["loQuantile"],
            "loCutWeekly": gcp_meta["loCutWeekly"],
            "hiEdgeWeekly": gcp_meta["hiEdgeWeekly"],
            "hiNationalShare": gcp_meta["hiNationalShare"],
            "dollarsYear": gcp_meta["dollarsYear"],
            "adultsWeights": gcp_meta["factors"],
            "medianBasis": "households (shares are per-adult)",
        },
        **({"demoInterp": demo_interp, "incomeCutsI": incuts_i}
           if demo_interp is not None else {}),
        "counts": counts,
        "divisions": divisions,
        "cohorts": cohorts,
        "booths": out_booths,
    }
    op = ROOT / f"data/booth-seifa-voter-{year}.json"
    op.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                  encoding="utf-8")
    print(f"OK -> {op} (booths {len(out_booths)}, scored {scored}, cohorts "
          f"{len(cohorts)}, recon median {recon['medianAbsPct']}%)")
    return op


def main():
    global _CC
    _CC = load_ccd_maps()
    for y in years_run():
        build(y)


if __name__ == "__main__":
    main()
