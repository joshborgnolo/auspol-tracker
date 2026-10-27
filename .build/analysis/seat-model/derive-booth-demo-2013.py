#!/usr/bin/env python3
"""data/booth-demo-2013.json — census-people store for the 2013 election.

The voter-footprint demo lanes (data/booth-seifa-voter-YYYY.json,
derive-booth-seifa-voter.py) exist only from 2016 — the AEC published
its "Votes by SA1" product from 2016 onward. This is the venue-proxy
sibling (the deepest the census people lanes can go: ABS serves bulk
census datapacks for 2011/2016/2021 only, so the 2010 and older
elections — 2006-census era — are unfetchable):

  booths     the 2011 Census BCP counts of the SAME SA1 the booth's
             venue-proxy geo key names (data/booth-seifa-2013.json's
             SA1_7DIG11) — the venue's neighbourhood, never the booth's
             voters
  divisions  the exact 2011-census sums over the SA1s each division
             contains (ASGS CED-2011 membership — the boundaries the
             2013 election ran on), shares from the pooled count, never
             an average of booth rows

Deliberately NOT named booth-seifa-voter-2013.json: build_map_data.py
reads that name as the vote-weighted footprint contract, which a venue
proxy would silently mislabel.

Inputs (re-fetchable):
  .build/analysis/seat-model/cache/bcp-sa1-2011.zip — ABS 2011 Census
      Basic Community Profile, Statistical Area Level 1 for AUST,
      short-header CSVs (abs.gov.au census datapacks 2011_BCP_SA1;
      B01: persons + 11 age bands + inline English-only/other language;
      B09: country of birth; B40B: highest non-school qualification,
      persons block; B26: family income by composition × the 14-band
      grid — the 2011 counterpart of 2021's G32 (B27 is intact/step/
      blended family FORM, not an income mix, and plays no role here);
      B28: household income by the same 14 bands — the G33 counterpart)
  data/booth-seifa-2013.json — committed: the 2013 booth universe and
      each booth's geo SA1 key
  data/income-dist.json — the Who-votes income facet's national store:
      adults-per-household factors by family composition (2021-GCP
      derived, the only adults factors in the repo; the AEC/census
      publishes no persons-by-household-income table)
  .matilda/seifa-irsad-abs/dl/1270055003_ced_2011_aust_csv.zip — ABS
      ASGS Vol 3 July 2011, CED to SA1 allocation (SA1_MAINCODE_2011,
      CED_CODE/NAME incl. the 9 migratory/offshore + 9 no-usual-address
      pseudo-entries, which drop out)

Concordance: SA1_MAINCODE_2011 -> the BCP 7-digit region_id drops the
SA4+SA3 digits (code[0] + code[5:]) — the same decode the voter
pipeline uses, assert-verified on every run. The ABS CED file's
'Mcewen/Mcmillan/Mcpherson' spellings normalise to the AEC forms.

Guards fail loud (BCP header drift, SA1 universe drift, division-set
drift). Run:  python3 .build/analysis/seat-model/derive-booth-demo-2013.py
Test:  node .build/analysis/seat-model/test-booth-demo-2013.mjs
"""

import csv
import importlib.util
import io
import json
import re
import sys
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

SM = ROOT / ".build/analysis/seat-model"
# reuse verified machinery verbatim
_spec = importlib.util.spec_from_file_location("m25", SM / "derive-booth-seifa-2025.py")
m25 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m25)
fail = m25.fail
hash16 = m25.hash16

CACHE = SM / "cache"
ABS = ROOT / ".matilda/seifa-irsad-abs"
BCP_ZIP = CACHE / "bcp-sa1-2011.zip"
BCP_B01 = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
           "2011Census_B01_AUST_SA1_short.csv")
BCP_B09 = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
           "2011Census_B09_AUST_SA1_short.csv")
BCP_B26 = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
           "2011Census_B26_AUST_SA1_short.csv")
BCP_B28 = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
           "2011Census_B28_AUST_SA1_short.csv")
BCP_B40B = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
            "2011Census_B40B_AUST_SA1_short.csv")
BCP_B45B = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
            "2011Census_B45B_AUST_SA1_short.csv")
CED_ZIP = ABS / "dl/1270055003_ced_2011_aust_csv.zip"
VENUE = ROOT / "data/booth-seifa-2013.json"

# household weekly income bands ($2011), B26/B28 grid: (lo, hi)
# inclusive; the top band is open ("FI_4000_more_*"), Negative/Nil folds
# into the first band, and partial-stated and all-not-stated households
# are EXCLUDED from every lane basis (the facet does the same).
INC_BANDS14 = [(1, 199), (200, 299), (300, 399), (400, 599), (600, 799),
               (800, 999), (1000, 1249), (1250, 1499), (1500, 1999),
               (2000, 2499), (2500, 2999), (3000, 3499), (3500, 3999),
               (4000, None)]
INC_LO_Q = 0.25  # low lane: adults below the national 25th percentile
# top band = $4,000+/wk in 2011 dollars — the same dollar edge the 2021
# lanes pin; what moves per census year is the national share of it
INC_LO_GUARD_2011 = (650, 850)  # plausible $ for the 2011 25% cut
INC_HI_GUARD_2011 = (0.03, 0.06)  # national adults share of the top band

BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
         "55_64", "65_74", "75_84", "85ov"]
AGECOLS = [f"Age_{b}_yr_P" for b in BANDS[:-1]] + ["Age_85ov_P"]
# the curated birthplace-country set the GCP-era stores carry as
# COB_KEYS, minus eng/sct: B09 merges the whole UK into one
# UK_Channel_Islands_Isle_Man row, so only the eight are readable here
# (same site-key order)
COB_KEYS8 = ["ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"]
B09_COB_COLS = ["India_P", "China_excl_SARs_Taiwan_P", "New_Zealand_P",
                "Philippines_P", "Vietnam_P", "South_Africa_P", "Italy_P",
                "Sri_Lanka_P"]
B09_COLS = ["Australia_P", "Country_birth_not_stated_P", "Tot_P"] + \
           B09_COB_COLS
B40_COLS = ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
            "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]
# the eight stated ANZSCO occupation major groups (B45B P_Tot_*), in
# file order; blue-collar = trades + machinery operators & drivers +
# labourers, shared over the stated set (inadequately-described/
# not-stated excluded)
B45_COLS = ["P_Tot_Managers", "P_Tot_Professionals",
            "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
            "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
            "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
RENAME = {"Mcewen": "McEwen", "Mcmillan": "McMillan",
          "Mcpherson": "McPherson"}
STATE_ORDER = {s: i for i, s in
               enumerate(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT",
                          "ACT"])}
DECLINED = 1  # --checklists accept no dropped or extra rows


def bcp_table(zipf, member, key_col, cols, pin_rows_low, pin_rows_high):
    """One BCP member -> {region_id: tuple(values)}, header-drift checked."""
    if member not in zipf.namelist():
        fail(f"BCP zip lacks {member}")
    out = {}
    with io.TextIOWrapper(zipf.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.reader(fh)
        head = [h.strip() for h in next(rdr)]
        want = [key_col] + cols
        miss = [c for c in want if c not in head]
        if miss:
            fail(f"{member}: header drift, missing {miss}")
        ix = [head.index(c) for c in want]
        for row in rdr:
            code = row[ix[0]].strip()
            if not (code.isdigit() and len(code) == 7):
                fail(f"{member}: SA1 key drift {code!r}")
            if code in out:
                fail(f"{member}: dup SA1 {code}")
            try:
                out[code] = tuple(int(row[i]) for i in ix[1:])
            except ValueError as e:
                fail(f"{member}: non-numeric cell at {code}: {e}")
    n = len(out)
    if not pin_rows_low <= n <= pin_rows_high:
        fail(f"{member}: {n} rows outside pin [{pin_rows_low},"
             f" {pin_rows_high}]")
    return out


def load_bcp():
    """Per SA1: persons, ages(11), eng, oth, aus, totc, cobns, uni, eduns."""
    if not BCP_ZIP.exists():
        fail(f"missing {BCP_ZIP} (ABS datapacks 2011_BCP_SA1 for AUST, "
             f"short-header; see module docstring)")
    z = zipfile.ZipFile(BCP_ZIP)
    g01 = bcp_table(z, BCP_B01, "region_id",
                    ["Tot_P_P", *AGECOLS,
                     "Lang_spoken_home_Eng_only_P",
                     "Lang_spoken_home_Oth_Lang_P"], 54805, 54805)
    b09 = bcp_table(z, BCP_B09, "region_id", B09_COLS, 54800, 54805)
    b40 = bcp_table(z, BCP_B40B, "region_id", B40_COLS, 54800, 54805)
    b45 = bcp_table(z, BCP_B45B, "region_id", B45_COLS, 54800, 54805)
    out = {}
    for code, g in g01.items():
        row09 = b09.get(code)
        if row09 is None:
            aus = totc = cobns = ccob = None
        else:
            aus, cobns, totc = row09[:3]
            ccob = row09[3:]
        pg, gd, ba, eduns = b40.get(code, (None, None, None, None))
        occ = b45.get(code)
        out[code] = {
            "pers": g[0],
            "ages": g[1:12],
            "eng": g[12], "oth": g[13],
            "aus": aus, "totc": totc, "cobns": cobns,
            "cobn": ccob,
            "uni": (pg + gd + ba) if pg is not None else None,
            "eduns": eduns,
            "bluen": (occ[2] + occ[6] + occ[7]) if occ is not None
                     else None,
            "occd": sum(occ) if occ is not None else None,
            "pop15": g[0] - g[1] - g[2],
        }
    n05 = sum(1 for c in out.values() if c["aus"] is None)
    n40 = sum(1 for c in out.values() if c["uni"] is None)
    n45 = sum(1 for c in out.values() if c["occd"] is None)
    print(f"BCP 2011: {len(out)} SA1s (B09 short {n05}, B40B short {n40}, "
          f"B45B short {n45})")
    return out


# ------------------------------------------- income lanes (B26/B28, 2011)
def income_factors():
    """Adults-per-household factors from data/income-dist.json (the
    Who-votes income facet's national histogram store), mirroring
    derive-booth-seifa-voter.py's loader — the same 16-band 2021-GCP
    provenance check even though these lanes weight the BCP's 14-band
    2011 grid: the factors are per family-composition type, not per
    band, so the check only pins WHICH histogram the file's numbers
    came from (a moved facet file fails loud, never silently reused)."""
    path = ROOT / "data/income-dist.json"
    if not path.exists():
        fail("missing data/income-dist.json "
             "(run node .build/extract-income-dist.mjs)")
    ax = json.loads(path.read_text(encoding="utf-8"))["axes"]["household"]
    ap = ax["adultsPer"]
    grid16 = [((0 if i == 0 else lo), hi) for i, (lo, hi) in enumerate(
        [(1, 149), (150, 299), (300, 399), (400, 499), (500, 649),
         (650, 799), (800, 999), (1000, 1249), (1250, 1499),
         (1500, 1749), (1750, 1999), (2000, 2499), (2500, 2999),
         (3000, 3499), (3500, 3999), (4000, None)])]
    for (lo, hi), b in zip(grid16, ax["bands"]):
        if b["lo"] != lo or b["hi"] != hi:
            fail(f"income-dist grid drift at [{lo},{hi}] vs {b}")
    return ((ap["coupleNoChildren"], ap["coupleWithChildren"],
             ap["oneParent"], ap["otherFamily"]), ap["nonFamily"])


def income_bcp(z, ad, nonfam):
    """Per SA1: (adult total, adult loMass, adult hiMass, 14 adult band
    masses, 14 raw household masses) — the B28 household-income bands
    re-weighted to adults at the SA1's B26 family mix (national mix as
    fallback; non-family households at the national mean), mirroring
    income_gcp in derive-booth-seifa-voter.py on the BCP's own tables:
    B26 family income × composition is the 2011 counterpart of the
    2021 GCP's G32, B28 household income the G33 counterpart, so
    household mass rides the Tot columns (never B28's fam/non columns
    — same small-SA1 perturbation finding as the GCP lanes) and
    partial-stated/all-not-stated stay outside the basis. Returns the
    per-SA1 map plus the national 25%-cut dollar and the national
    top-band adult share. The median lane is read off the RAW
    household histogram, so incMed sits on ABS's published-median
    basis while loinc/hiinc sit on the adults (poll-frame) basis —
    the same split the 2016+ stores pin."""
    def head_of(member):
        if member not in z.namelist():
            fail(f"BCP zip lacks {member}")
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            return [h.strip() for h in next(csv.reader(fh))]

    h28 = head_of(BCP_B28)
    h26 = head_of(BCP_B26)
    negh = "Negative_Nil_income_Tot"
    negf = "Neg_Nil_inc_Tot"
    neg_types = ("Neg_Nil_inc_cpl_fam_no_child",
                 "Neg_Nil_inc_cpl_fam_wth_chld",
                 "Neg_Nil_inc_One_parent_fam",
                 "Neg_Nil_inc_Other_fam")
    if negh not in h28:
        fail("BCP B28 lacks the Negative_Nil Tot column")
    if negf not in h26 or any(c not in h26 for c in neg_types):
        fail("BCP B26 lacks the Neg_Nil columns")
    plan = []
    for lo, hi in INC_BANDS14:
        stem = f"{lo}_{hi if hi is not None else 'more'}"
        hi_tot, fi_tot = f"HI_{stem}_Tot", f"FI_{stem}_Tot"
        if hi_tot not in h28:
            fail(f"BCP B28 lacks {hi_tot}")
        if fi_tot not in h26:
            fail(f"BCP B26 lacks {fi_tot}")
        fstem = f"FI_{stem}"
        types = []
        for want in (r"cpl_fam_no_child$", r"cpl_fam_(with|wth)_ch",
                     r"One_parent_fam$", r"Other_fam$"):
            c = next((h for h in h26
                      if h.startswith(f"{fstem}_") and re.search(want, h)),
                     None)
            if c is None:
                fail(f"BCP B26 lacks {fstem} {want}")
            types.append(c)
        plan.append((hi_tot, fi_tot, types))
    cols28 = [negh] + [p[0] for p in plan]
    cols26 = [negf, *neg_types] + [c for p in plan for c in (p[1], *p[2])]
    b28 = bcp_table(z, BCP_B28, "region_id", cols28, 54805, 54805)
    b26 = bcp_table(z, BCP_B26, "region_id", cols26, 54805, 54805)
    if set(b26) != set(b28):
        fail("BCP B26/B28 SA1 sets diverge")
    # col order: r28 = (neg, HI band Tots x14); r26 = (neg Tot, 4 neg
    # types, then per band (FI Tot, 4 family-type counts))
    nat = {"b": [0.0] * 14, "fi": [0.0] * 14,
           "mix": [[0.0] * 4 for _ in range(14)]}
    for code, r28 in b28.items():
        r26 = b26[code]
        for i in range(14):
            ne = i == 0
            nat["b"][i] += float(r28[i + 1]) + (float(r28[0]) if ne
                                                else 0.0)
            nat["fi"][i] += float(r26[5 + i * 5]) + (float(r26[0]) if ne
                                                     else 0.0)
            for k in range(4):
                nat["mix"][i][k] += float(r26[6 + i * 5 + k]) + (
                    float(r26[1 + k]) if ne else 0.0)
    nat_famper, nat_fams = [], []
    for i in range(14):
        mixn = sum(nat["mix"][i])
        if mixn <= 0 or nat["b"][i] <= 0:
            fail(f"national income mix empty in band {INC_BANDS14[i]}")
        nat_famper.append(sum(m * a for m, a in zip(nat["mix"][i], ad))
                          / mixn)
        nat_fams.append(min(1.0, nat["fi"][i] / nat["b"][i]))
    nat_adults = [nat["b"][i] * (nat_fams[i] * nat_famper[i]
                                 + (1 - nat_fams[i]) * nonfam)
                  for i in range(14)]
    nat_tot = sum(nat_adults)
    cum, cut25 = 0.0, None
    for i, (lo, hi) in enumerate(INC_BANDS14):
        cum += nat_adults[i] / nat_tot
        if cum >= INC_LO_Q:
            prev = cum - nat_adults[i] / nat_tot
            f = (INC_LO_Q - prev) / (nat_adults[i] / nat_tot)
            if hi is None:
                fail("income 25% cut lands in the open top band")
            cut25 = lo + f * (hi - lo + 1)
            break
    if not cut25 or not INC_LO_GUARD_2011[0] <= cut25 <= INC_LO_GUARD_2011[1]:
        fail(f"income 25% cut {cut25} outside guard {INC_LO_GUARD_2011}")
    hi_share = nat_adults[-1] / nat_tot
    if not INC_HI_GUARD_2011[0] <= hi_share <= INC_HI_GUARD_2011[1]:
        fail(f"top-band national share {hi_share:.4f} outside "
             f"{INC_HI_GUARD_2011}")
    print(f"income: national 25% cut ${cut25:.0f}/wk (adults, 2011 $); "
          f"top band {hi_share:.4f} of adults")

    out = {}
    for code, r28 in b28.items():
        r26 = b26[code]
        bands = []      # adults per band (loinc/hiinc basis)
        hh = []         # raw households per band (incMed basis)
        for i in range(14):
            ne = i == 0
            tot = float(r28[i + 1]) + (float(r28[0]) if ne else 0.0)
            fi = float(r26[5 + i * 5]) + (float(r26[0]) if ne else 0.0)
            mix = [float(r26[6 + i * 5 + k]) + (float(r26[1 + k]) if ne
                                                else 0.0)
                   for k in range(4)]
            mixn = sum(mix)
            famper = (sum(m * a for m, a in zip(mix, ad)) / mixn
                      if mixn > 0 else nat_famper[i])
            # fam share of the band's households, clamped: an SA1 cell's
            # independently perturbed B26 FI Tot can momentarily exceed
            # the B28 HI Tot it shares its basis with
            fams = min(1.0, fi / tot) if tot > 0 else nat_fams[i]
            bands.append(tot * (fams * famper + (1 - fams) * nonfam))
            hh.append(tot)
        tsum = sum(bands)
        lo_mass = 0.0
        for i, (lo, hi) in enumerate(INC_BANDS14):
            if cut25 <= lo:
                continue
            if hi is not None and cut25 > hi:
                lo_mass += bands[i]
                continue
            lo_mass += bands[i] * (cut25 - lo) / (hi - lo + 1)
            break
        out[code] = (tsum, lo_mass, bands[-1], tuple(bands), tuple(hh))
    print(f"income: B26/B28 SA1, {len(out)} rows (factors from "
          f"data/income-dist.json)")
    return out, round(cut25, 2), round(hi_share, 6)


def band_median14(masses):
    """Interpolated median weekly income ($) of a pooled household band
    histogram on INC_BANDS14 — the 14-band-grid counterpart of
    derive-booth-seifa-voter.py's band_median: linear inside the median
    band; None when the basis is empty or the median lands in the open
    top band (never plausible at division scale)."""
    tot = sum(masses)
    if tot <= 0:
        return None
    cum = 0.0
    for (lo, hi), m in zip(INC_BANDS14, masses):
        if cum + m >= tot / 2.0:
            if hi is None or m <= 0:
                return None
            return round(lo + (tot / 2.0 - cum) / m * (hi - lo + 1))
        cum += m
    return None


def load_ced():
    """7-digit SA1 -> division name, on the 150-division set only."""
    if not CED_ZIP.exists():
        fail(f"missing {CED_ZIP} (ASGS Vol 3 July 2011 CED->SA1; "
             f".matilda/seifa-irsad-abs/dl/)")
    z = zipfile.ZipFile(CED_ZIP)
    mem = [n for n in z.namelist() if n.upper().endswith(".CSV")]
    if mem != ["CED_2011_AUST.csv"]:
        fail(f"CED zip members drifted {mem}")
    out = {}
    skipped = 0
    with io.TextIOWrapper(z.open(mem[0]), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        want = ["SA1_MAINCODE_2011", "CED_CODE_2011", "CED_NAME_2011"]
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"CED_2011_AUST.csv: header drift, missing {miss}")
        n = 0
        for row in rdr:
            n += 1
            mc = row["SA1_MAINCODE_2011"].strip()
            if not (mc.isdigit() and len(mc) == 11):
                fail(f"CED_2011_AUST.csv: maincode drift {mc!r}")
            key7 = mc[0] + mc[5:]
            nm = row["CED_NAME_2011"].strip()
            if nm.startswith(("Migratory", "No usual address")):
                skipped += 1
                continue
            if key7 in out:
                fail(f"CED_2011_AUST.csv: dup SA1 {key7}")
            out[key7] = RENAME.get(nm, nm)
    if n != 54805:
        fail(f"CED_2011_AUST.csv: {n} rows != 54805")
    return out, skipped


def bounded(num, den):
    """A share of an ex-not-stated basis: none when the basis is empty,
    and none when BCP perturbation of a tiny SA1 takes the arithmetic
    outside [0,1] — emit no number rather than clamp one."""
    if den is None or num is None or den <= 0:
        return None
    v = num / den
    return round(v, 4) if 0 <= v <= 1 else None


def shares(rec):
    """The 2013 stores' demo block shape (voter-store demo shape parity
    plus the income lanes): income keys sit in the rec only when the
    source carries the B26/B28 histogram for it — every division row
    does; a venue booth's row does only when its geo SA1 does."""
    bsum = sum(rec["bands"])
    fb_den = None if rec["totc"] is None else rec["totc"] - rec["cobns"]
    uni_den = None if rec["uni"] is None else rec["pop15"] - rec["eduns"]
    out = {
        "persons": rec["pers"],
        "cov": 1.0,
        "langOther": bounded(rec["oth"], rec["eng"] + rec["oth"]),
        "fborn": bounded(None if rec["totc"] is None
                         else rec["totc"] - rec["cobns"] - rec["aus"],
                         fb_den),
        "uni": bounded(rec["uni"], uni_den),
        "blue": bounded(rec["bluen"], rec["occd"]),
        "age": ({b: round(rec["bands"][i] / bsum, 4)
                 for i, b in enumerate(BANDS)} if bsum > 0 else None),
    }
    if rec.get("inct") is not None:
        out["loinc"] = bounded(rec["incl"], rec["inct"])
        out["hiinc"] = bounded(rec["inch"], rec["inct"])
        out["incMed"] = band_median14(rec["incbh"])
    if rec.get("cobn") is not None:
        out["cob"] = {k: bounded(rec["cobn"][i], fb_den)
                      for i, k in enumerate(COB_KEYS8)}
    return out


def main():
    store = json.loads(VENUE.read_text(encoding="utf-8"))
    booths = store["booths"]
    if not booths or "geo" not in booths[0]:
        fail(f"{VENUE.name}: booth geo keys missing")
    sa1 = load_bcp()
    z_bcp = zipfile.ZipFile(BCP_ZIP)
    inc_fac, inc_nonfam = income_factors()
    inc, inc_cut, inc_hishare = income_bcp(z_bcp, inc_fac, inc_nonfam)
    z_bcp.close()
    if set(inc) != set(sa1):
        fail("B01/B28 SA1 universes diverge")
    ced, ced_skipped = load_ced()
    divs_hist = sorted({b["div"] for b in booths})
    mapped = set(ced.values())
    if len(mapped) != 150:
        fail(f"CED_2011 maps {len(mapped)} divisions != 150")
    if mapped != set(divs_hist):
        fail(f"division drift: ced-only {sorted(mapped - set(divs_hist))} "
             f"venue-only {sorted(set(divs_hist) - mapped)}")
    # every division SA1 needs its four BCP tables
    short = {k for k in ced
             if sa1.get(k, {}).get("aus") is None
             or sa1.get(k, {}).get("uni") is None
             or sa1.get(k, {}).get("occd") is None}
    if short:
        fail(f"CED-2011 SA1s short a BCP table: {sorted(short)[:8]}")

    divstate = {b["div"]: b["state"] for b in booths}
    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * len(BANDS),
                                  "eng": 0, "oth": 0, "aus": 0, "totc": 0,
                                  "cobns": 0, "cobn": [0] * len(COB_KEYS8),
                                  "uni": 0, "eduns": 0,
                                  "bluen": 0, "occd": 0, "pop15": 0,
                                  "inct": 0.0, "incl": 0.0, "inch": 0.0,
                                  "incbh": [0.0] * len(INC_BANDS14)})
    for key, dv in ced.items():
        r = sa1[key]
        ir = inc[key]
        acc = divsum[dv]
        acc["pers"] += r["pers"]
        for i in range(len(BANDS)):
            acc["bands"][i] += r["ages"][i]
        acc["eng"] += r["eng"]
        acc["oth"] += r["oth"]
        for k in ("aus", "totc", "cobns", "uni", "eduns", "bluen",
                  "occd", "pop15"):
            acc[k] += r[k]
        for i in range(len(COB_KEYS8)):
            acc["cobn"][i] += r["cobn"][i]
        acc["inct"] += ir[0]
        acc["incl"] += ir[1]
        acc["inch"] += ir[2]
        for i in range(len(INC_BANDS14)):
            acc["incbh"][i] += ir[4][i]

    out_booths = []
    geo_missing = geo_empty = 0
    nat = defaultdict(int)
    for vb in booths:
        rec = {"div": vb["div"], "divId": vb["divId"], "state": vb["state"],
               "boothId": vb["boothId"], "booth": vb["booth"],
               "type": vb["type"]}
        row = sa1.get(vb.get("geo"))
        if row is None:
            geo_missing += 1
            rec["demo"] = None
        elif row["pers"] == 0:
            # venue SA1 is uninhabited (commercial/industrial block): a
            # zero-person venue proxy carries no census people
            geo_empty += 1
            rec["demo"] = None
        else:
            ir = inc[vb["geo"]]
            rec["demo"] = shares({
                "pers": row["pers"], "bands": list(row["ages"]),
                "eng": row["eng"], "oth": row["oth"],
                "aus": row["aus"], "totc": row["totc"],
                "cobns": row["cobns"], "cobn": row["cobn"],
                "uni": row["uni"],
                "eduns": row["eduns"], "bluen": row["bluen"],
                "occd": row["occd"], "pop15": row["pop15"],
                "inct": ir[0], "incl": ir[1], "inch": ir[2],
                "incbh": list(ir[4])})
        out_booths.append(rec)

    # the national row pools DIVISION sums (the CED-2011 universe), not
    # the venue SA1s — a national reading of the election's geography
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd", "pop15"):
            nat[k] += dv[k]
        for i, b in enumerate(BANDS):
            nat[b] = nat.get(b, 0) + dv["bands"][i]
        for k in ("inct", "incl", "inch"):
            nat[k] += dv[k]
        for i in range(len(INC_BANDS14)):
            nat.setdefault("incbh", [0.0] * len(INC_BANDS14))
            nat["incbh"][i] += dv["incbh"][i]
        for i in range(len(COB_KEYS8)):
            nat.setdefault("cobn", [0.0] * len(COB_KEYS8))
            nat["cobn"][i] += dv["cobn"][i]

    divisions = []
    for name in sorted(divsum, key=lambda n: (STATE_ORDER[divstate[n]], n)):
        dv = divsum[name]
        divisions.append({"div": name, "state": divstate[name],
                          **shares(dv)})
    nat_b = sum(nat[b] for b in BANDS)
    nat_eo = nat["eng"] + nat["oth"]
    nat_fbd = nat["totc"] - nat["cobns"]
    nat_unid = nat["pop15"] - nat["eduns"]
    counts = {
        "booths": len(out_booths),
        "boothsGeo": len(out_booths) - geo_missing - geo_empty,
        "boothsGeoMissing": geo_missing,
        "boothsGeoEmpty": geo_empty,
        "divisions": len(divisions),
        "sa1Bcp": len(sa1),
        "sa1Ced": len(ced),
        "cedPseudoSkipped": ced_skipped,
        "national": {
            "persons": nat["pers"],
            "langOther": round(nat["oth"] / nat_eo, 4) if nat_eo else None,
            "fborn": round((nat_fbd - nat["aus"]) / nat_fbd, 4)
            if nat_fbd > 0 else None,
            "uni": round(nat["uni"] / nat_unid, 4) if nat_unid > 0 else None,
            "blue": round(nat["bluen"] / nat["occd"], 4)
            if nat["occd"] > 0 else None,
            "age0_14": round((nat["0_4"] + nat["5_14"]) / nat_b, 4),
            "age65ov": round(sum(nat[b] for b in BANDS[8:]) / nat_b, 4),
            "loinc": round(nat["incl"] / nat["inct"], 4)
            if nat["inct"] else None,
            "hiinc": round(nat["inch"] / nat["inct"], 4)
            if nat["inct"] else None,
            "cob": {k: (round(nat["cobn"][i] / nat_fbd, 4)
                        if nat_fbd > 0 else None)
                    for i, k in enumerate(COB_KEYS8)},
            "incMed": band_median14(nat["incbh"]),
        },
    }
    out = {
        "_about": (
            "Census-people store for the 2013 federal election, the "
            "venue-proxy sibling of the voter-footprint demo lanes in "
            "data/booth-seifa-voter-YYYY.json (2016+; the AEC published "
            "no 'Votes by SA1' product before 2016, so a 2013 booth "
            "cannot be weighted by where its voters live). A booth's "
            "demo block is the 2011 Census Basic Community Profile "
            "counts of the SA1 its VENUE sits in — the geo key of "
            "booth-seifa-2013.json — describing the venue's "
            "neighbourhood, never the booth's voters; persons is a real "
            "SA1 headcount, never a weighted pseudo-population. A "
            "division's row is the exact 2011-census sum over the SA1s "
            "of its CED-2011 membership (the boundary set the 2013 "
            "election ran on; ABS Mcewen/Mcmillan/Mcpherson spellings "
            "normalised), not an average of its booth rows. Shares "
            "mirror the GCP lanes: age renormalised over the 11 B01 "
            "bands (no age-not-stated column); language other-at-home "
            "over English-only + other; overseas-born over "
            "country-of-birth stated, and the curated birthplace-country "
            "(cob) shares riding that same country-stated basis — the "
            "2011 B09 prints no England or Scotland subsets (it merges "
            "the UK into one row), so the GCP-era ten-country set is "
            "trimmed to eight here (country order in cobKeys); "
            "university (bachelor and above) "
            "per the aged-15+ population less "
            "level-of-education-not-stated; blue-collar (technicians/"
            "trades + machinery operators/drivers + labourers of B45B "
            "the ANZSCO occupation major groups) over the eight stated "
            "occupation groups, inadequately-described and not-stated "
            "occupations out of the frame. Income lanes mirror the "
            "voter stores on the BCP's own tables: B28 households by "
            "the 14-band weekly household-income grid are re-weighted "
            "to ADULTS at the data/income-dist.json factors (each "
            "band's family share from B26's family-income Tot over its "
            "family-composition mix in the SA1 — national mix as "
            "fallback — the rest non-family at the national mean; "
            "household mass rides the Tot columns, never the B28 "
            "fam/non columns, small-SA1 perturbation independently "
            "shaving the splits; partial-stated and all-not-stated "
            "households sit outside the basis). loinc is the adult "
            "share below the national 25th-percentile weekly "
            "household-income cut the store-level incomeCuts record "
            "carries (the BCP national adults histogram's cut band "
            "split linearly, in 2011 dollars), hiinc the adult share "
            "in the $4,000-and-top band, incMed the band-interpolated "
            "median weekly household income in 2011 dollars on the "
            "HOUSEHOLD basis (ABS's own published-median basis — the "
            "adults-weighted histogram would read a few hundred "
            "dollars higher, skewed by couples). The national row "
            "pools the "
            "division sums. A booth whose venue SA1 records no "
            "residents (commercial/industrial blocks; "
            "counts.boothsGeoEmpty) carries demo:null, as does one "
            "whose geo key is absent from the BCP "
            "(counts.boothsGeoMissing); inside a present block a lane "
            "is nulled rather than clamped when the BCP's small-area "
            "perturbation would put its share outside [0,1] "
            "(counts.boothsGeo-carrying rows only). Booth records "
            "carry geo of data/booth-seifa-2013.json; its venue-proxy "
            "caveats apply here too."),
        "_provenance": {
            "sourceUrls": {
                "bcp": "ABS 2011 Census Basic Community Profile, SA1 for "
                       "AUST (B01/B09/B26/B28/B40B/B45B), abs.gov.au census "
                       "datapacks",
                "ced": "ABS ASGS Vol 3 July 2011, CED to SA1 allocation "
                       "(1270055003_ced_2011_aust_csv.zip)",
                "venue": "data/booth-seifa-2013.json",
            },
            "files": {
                str(BCP_ZIP.relative_to(ROOT)): hash16(BCP_ZIP),
                str(CED_ZIP.relative_to(ROOT)): hash16(CED_ZIP),
                str(VENUE.relative_to(ROOT)): hash16(VENUE),
            },
            "extractedAt": str(date.today()),
        },
        "election": 2013,
        "censusEdition": 2011,
        "cobKeys": COB_KEYS8,
        "deliveryBasis": ("venue-proxy per booth (SA1 of the premises); "
                          "exact CED-2011 census sum per division"),
        "incomeCuts": {
            "loQuantile": INC_LO_Q,
            "loCutWeekly": inc_cut,
            "hiEdgeWeekly": 4000,
            "hiNationalShare": inc_hishare,
            "dollarsYear": 2011,
            "adultsWeights": "data/income-dist.json",
            "medianBasis": "households (shares are per-adult)",
        },
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    op = ROOT / "data/booth-demo-2013.json"
    op.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                  encoding="utf-8")
    print(f"OK -> {op} (booths {len(out_booths)}, geo-missing {geo_missing}, "
          f"divisions {len(divisions)}, national {counts['national']})")


if __name__ == "__main__":
    main()
