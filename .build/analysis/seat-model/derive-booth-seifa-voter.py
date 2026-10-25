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
fail = m25.fail
hash16 = m25.hash16

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


# ------------------------------------------------- demo (GCP G01/G09/G49B)
# The demo block: 2021-census GCP (SA1) — G01 age bands + language spoken
# at home, G09F/G09H country of birth, G49B highest non-school
# qualification — folded by the same per-SA1 vote weights. EVERY lane
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
GCP_MEMBER_G09H = ("2021 Census GCP Statistical Area 1 for AUS/"
                   "2021Census_G09H_AUST_SA1.csv")
GCP_MEMBER_G49B = ("2021 Census GCP Statistical Area 1 for AUS/"
                   "2021Census_G49B_AUST_SA1.csv")
GCP_MEMBER_G32 = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G32_AUST_SA1.csv")
GCP_MEMBER_G33 = ("2021 Census GCP Statistical Area 1 for AUS/"
                  "2021Census_G33_AUST_SA1.csv")
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
DEMO_BASIS = ("2021 Census GCP G01, G09F/G09H, G49B and G32/G33 @ SA1 "
              "(Ed3); "
              "every lane's votes are "
              "in Ed3 space before folding, walking older geographies "
              "via ABS correspondences")
_DEMO_TAIL = (" The demo block folds the 2021-census GCP G01, G09F/G09H, "
              "G49B and G32/G33 SA1 tables (G01: age-band structure; language "
              "spoken at home English-only vs other. G09: country of "
              "birth — the overseas-born share excludes "
              "country-of-birth-not-stated. G49B: highest non-school "
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
              "by couples) — all by the same per-SA1 vote "
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
    z = zipfile.ZipFile(GCP_ZIP)
    if GCP_MEMBER not in z.namelist():
        fail(f"GCP zip lacks {GCP_MEMBER}")
    with io.TextIOWrapper(z.open(GCP_MEMBER), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
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
    if n != GCP_ROWS:
        fail(f"GCP G01 rows {n} != pin {GCP_ROWS}")
    extra = {}
    for tag, member, cols in (
        ("G09F", GCP_MEMBER_G09F, ["P_Australia_Tot"]),
        ("G09H", GCP_MEMBER_G09H, ["P_Tot_Tot", "P_COB_NS_Tot"]),
        ("G49B", GCP_MEMBER_G49B, ["P_PGrad_Deg_Total",
                                   "P_GradDip_and_GradCert_Total",
                                   "P_BachDeg_Total",
                                   "P_Lev_Edu_NS_Total"]),
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
    out = {}
    for code, r in base.items():
        f09 = extra["G09F"].get(code)
        h09 = extra["G09H"].get(code)
        e49 = extra["G49B"].get(code)
        ir = inc.get(code)
        if f09 is None or h09 is None or e49 is None or ir is None:
            fail(f"GCP G09/G49B/G33 SA1 set mismatch at {code}")
        out[code] = r + (f09[0], h09[0], h09[1],
                         e49[0] + e49[1] + e49[2], e49[3]) + ir
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


def demo_units(units21, gcp):
    """Per unit: the GCP demo block + the div/national accumulators."""
    nat = {"votes": 0.0, "pers": 0.0, "eng": 0.0, "oth": 0.0,
           "bands": [0.0] * len(DEMO_BANDS), "aust": 0.0, "totc": 0.0,
           "cobns": 0.0, "uni": 0.0, "eduns": 0.0, "pop15": 0.0,
           "inct": 0.0, "incl": 0.0, "inch": 0.0,
           "incb": [0.0] * len(INC_BANDS),
           "incbh": [0.0] * len(INC_BANDS)}
    divs = {}
    out = {}
    for key, kv in units21.items():
        tot = sum(kv.values())
        if tot <= 0:
            out[key] = None
            continue
        cov = pers = eng = oth = 0.0
        aust = totc = cobns = uni = eduns = pop15 = 0.0
        inct = incl = inch = 0.0
        bands = [0.0] * len(DEMO_BANDS)
        incb = [0.0] * len(INC_BANDS)
        incbh = [0.0] * len(INC_BANDS)
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
            pop15 += w * (r[0] - ages[0] - ages[1])
            inct += w * r[9]
            incl += w * r[10]
            inch += w * r[11]
            for i in range(len(INC_BANDS)):
                incb[i] += w * r[12][i]
                incbh[i] += w * r[13][i]
        dv = divs.setdefault(key[0], {"votes": 0.0, "cov": 0.0,
                                      "pers": 0.0, "eng": 0.0, "oth": 0.0,
                                      "bands": [0.0] * len(DEMO_BANDS),
                                      "aust": 0.0, "totc": 0.0,
                                      "cobns": 0.0, "uni": 0.0,
                                      "eduns": 0.0, "pop15": 0.0,
                                      "inct": 0.0, "incl": 0.0,
                                      "inch": 0.0,
                                      "incb": [0.0] * len(INC_BANDS),
                                      "incbh": [0.0] * len(INC_BANDS)})
        dv["votes"] += tot
        dv["cov"] += cov
        dv["pers"] += pers
        dv["eng"] += eng
        dv["oth"] += oth
        for i in range(len(DEMO_BANDS)):
            dv["bands"][i] += bands[i]
        for k, v in (("aust", aust), ("totc", totc), ("cobns", cobns),
                     ("uni", uni), ("eduns", eduns), ("pop15", pop15),
                     ("inct", inct), ("incl", incl), ("inch", inch)):
            dv[k] += v
        for i in range(len(INC_BANDS)):
            dv["incb"][i] += incb[i]
            dv["incbh"][i] += incbh[i]
        cov /= tot
        nat["votes"] += tot
        nat["pers"] += pers
        nat["eng"] += eng
        nat["oth"] += oth
        for i in range(len(DEMO_BANDS)):
            nat["bands"][i] += bands[i]
        for k, v in (("aust", aust), ("totc", totc), ("cobns", cobns),
                     ("uni", uni), ("eduns", eduns), ("pop15", pop15),
                     ("inct", inct), ("incl", incl), ("inch", inch)):
            nat[k] += v
        for i in range(len(INC_BANDS)):
            nat["incb"][i] += incb[i]
            nat["incbh"][i] += incbh[i]
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
            "age": ({b: round(bands[i] / bsum, 4)
                     for i, b in enumerate(DEMO_BANDS)}
                    if bsum > 0 else None),
            "loinc": round(incl / inct, 4) if inct > 0 else None,
            "hiinc": round(inch / inct, 4) if inct > 0 else None,
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
    if conf.get("score") == "xwalk16":
        units16, drop16 = units_to_ed2(units, _CC[conf["ed"]], load_xwalk1116())
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
                        "demo": demo_map.get((div, "cohort", name))})
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
            "age0_14": round(
                (demo_nat["bands"][0] + demo_nat["bands"][1]) / nat_b, 4),
            "age65ov": round(sum(demo_nat["bands"][8:]) / nat_b, 4),
            "loinc": round(demo_nat["incl"] / nat_inc, 4)
            if nat_inc > 0 else None,
            "hiinc": round(demo_nat["inch"] / nat_inc, 4)
            if nat_inc > 0 else None,
            "incMed": band_median(demo_nat["incbh"]),
        },
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
            "age": ({b: round(dv["bands"][i] / bsum, 4)
                     for i, b in enumerate(DEMO_BANDS)}
                    if bsum > 0 else None),
            "loinc": round(dv["incl"] / dv["inct"], 4)
                if dv["inct"] > 0 else None,
            "hiinc": round(dv["inch"] / dv["inct"], 4)
                if dv["inct"] > 0 else None,
            "incMed": band_median(dv["incbh"]),
        })

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
            "language/foreign-born/university/age/income reading per "
            "division, "
            "its shares from its own pooled sum, never from averaging "
            "the row-level rounded shares.") + DEMO_ABOUT[year],
        "_provenance": {
            "sourceUrls": {
                "votes": {2016: "AEC 2016 downloads, Votes by SA1 (xlsx)",
                          2019: "AEC 2019 downloads, Votes by SA1",
                          2022: "AEC 2022 downloads, Votes by SA1",
                          2025: "AEC fe25 downloads-statistics, Votes by SA1 – national"}[year],
                "fpvOracle": "VTR HouseStateFirstPrefsByPollingPlaceDownload",
                "gcp": "ABS 2021 Census GCP datapack (SA1, G01/G09/G49B/"
                       "G32/G33)",
                **({"crosswalk": "ABS CG_SA1_2016_SA1_2021 (ASGS Ed3 correspondences page)"}
                   if conf["mode"] == "xwalk21" else {}),
                **({"crosswalkEd1": "ABS CG_SA1_2011_SA1_2016 (ASGS Ed2 correspondences page)"}
                   if year == 2016 else {}),
            },
            "files": {
                str(conf["file"].relative_to(ROOT)): hash16(conf["file"]),
                str(vpath.relative_to(ROOT)): hash16(vpath),
                str(GCP_ZIP.relative_to(ROOT)): hash16(GCP_ZIP),
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
        "incomeCuts": {
            "loQuantile": gcp_meta["loQuantile"],
            "loCutWeekly": gcp_meta["loCutWeekly"],
            "hiEdgeWeekly": gcp_meta["hiEdgeWeekly"],
            "hiNationalShare": gcp_meta["hiNationalShare"],
            "dollarsYear": gcp_meta["dollarsYear"],
            "adultsWeights": gcp_meta["factors"],
            "medianBasis": "households (shares are per-adult)",
        },
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
