#!/usr/bin/env python3
"""data/nsw19-demo.json — per-district 2016-census people figures for the
NSW 2019 state election map (the nsw19 frame on /map/).

The build_nsw23_demo.py recipe, verbatim, on the 2016 census vintage over
the SAME 93 districts (New South Wales's 2013 redistribution serves both
nsw15 and nsw19; the census edition moves, 2016 here): the NSWEC publishes
district results but no voter footprint, so each district's figures pool
directly from the ABS 2016 Census GCP SA1 tables, at the same
ex-not-stated bases as .build/analysis/seat-model/derive-booth-seifa-
voter.py (the G01/G09F/G09G/G09H/G46B/G57B member and column choices are
the qld17 frame's identical, so a federal figure and an nsw19 figure are
commensurate).

INCOME-LANE NOTE (2026-11-04, flagged for the orchestrator): this frame
does NOT ride gcp_newlanes.state_income for its income cohorts. Measured
2026-11-04 against the federal engines' national pins ($/wk lo·hiq·top:
2016 $895.80/$2,655.45, 2021 $1,078.87/$3,225.97), the shared GCP-era
function computes its family block ONE TUPLE COLUMN EARLY (the five
Neg_Nil columns widen cols32_extra to five, but its (4 + i*5) block
offsets were never bumped — fi lands on each band's Other_fam column and
mix's first type is the neg-nil Tot), understating the family share of
every GCP-era lane (NSW-2021 lo-cut measures $888.77 shipped vs $1,109.00
corrected; NSW-2016 $754.25 vs $911.45; the seven committed state frames
carry the shipped figures, and _INC_CUT_GUARDS/_INC_HIQ_GUARDS windows
were measured under the bug). Until the orchestrator reconciles the
shared module (and the frames that ride it), build_nsw19 computes its
income cohorts LOCALLY below with the corrected arithmetic (name-resolved
columns, derive-booth-seifa-voter.py income_gcp's own discipline), so
this file's loinc/hiinc/hiqinc/medIncWeekly are the corrected figures —
they will NOT tie out bitwise against a sibling frame's until the shared
fix lands. The 2011 era is unaffected: gcp_newlanes.state_income_bcp
mirrors the federal income_bcp, which is oracle-verified against
booth-demo-2013.

Method: every SA1 counts whole to the district its own polygon CENTROID
lies in — boundary-straddling SA1s land on the side their centre sits, not
by area; the state total never moves (every NSW SA1 counts to exactly one
district). The join is the one nsw13_geo.py computes and commits per
vintage at .build/map/nsw13/assign-sa1-<cy>.json (computed once; this
script RIDES the cache — it never re-derives the join, so a district's
people figures and its SEIFA scores always cover the same geography). The
four NSW sentinel SA1s (migratory/offshore) carry no polygon and sit
outside the join.

Inputs (all caches already ride this repo's other pipelines):
  .build/map/src/n-nsw19.geojson                            (93 districts, 2013 redistribution)
  .build/analysis/seat-model/cache/gcp-sa1-2016.zip         (GCP 2016 SA1 datapack)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2016_aust_shape.zip (SA1 2016 polygons)
  .build/map/nsw13/assign-sa1-2016.json                     (nsw13_geo.py's join cache)

Deps: python3 stdlib only. Guards fail loud.
usage: python3 -I .build/map/build_nsw19_demo.py
"""
import csv
import hashlib
import io
import json
import os
import re
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nsw13_geo import (DIST_GEOJSON, EXPECTED_NAMES, NSW_SENTINELS,  # noqa: E402
                       VINTAGES, load_assign_map)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
YEAR = 2016
V = VINTAGES[YEAR]
GCP_ZIP = V["gcp"]
GCP_KEY = V["gcp_key"]          # SA1_7DIGITCODE_2016
GCP_ROWS = V["gcp_rows"]        # 57,523 national
OUT = os.path.join(REPO, "data", "nsw19-demo.json")

#: measured 2026-11-04 on this machine from the committed caches; a drift
#: past any of these is a guard trip, never a silent re-derive
GCP_NSW_ROWS = 18399
NSW_SENTINEL_PERSONS_2016 = 12701
NSW_PERSONS_ANCHOR_2016 = 7480228   # ABS 2016 census, New South Wales
NSW_PERSONS_TOL = 1000
# GCP 2016 tallies 12,701 persons in NSW's migratory/offshore SA1s (the
# quickstats universe sits 67 persons under the GCP's — measured above)

DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
GCP_G57B_OCCS = ["P_Tot_Managers", "P_Tot_Professionals",
                 "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
                 "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
                 "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
# the G09 top-country columns surfaced on /map/ as birthplace sub-views
# (the federal stores' COB_KEYS — site-key order, 2016 vocab identical)
COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita",
            "lka", "sct"]
GCP_G09F_COLS = ["P_Australia_Tot", "P_England_Tot", "P_China_Tot"]
GCP_G09G_COLS = ["P_India_Tot", "P_New_Zealand_Tot", "P_Italy_Tot"]
GCP_G09H_COLS = ["P_Tot_Tot", "P_COB_NS_Tot", "P_Philippines_Tot",
                 "P_Vietnam_Tot", "P_South_Africa_Tot", "P_Scotland_Tot",
                 "P_Sri_Lanka_Tot"]
MEMBER = V["member"].format       # 2016 Census GCP .../2016Census_{t}_AUS_SA1.csv

# ---- the income lane's NSW-2016 constants (see the INCOME-LANE NOTE above)
INC_BANDS = gcp_newlanes.INC_BANDS      # the 16-band GCP grid, 2016 $
INC_LO_Q, INC_HI_Q = 0.25, 0.75
#: measured 2026-11-04 from the committed pack with the corrected
#: family-share arithmetic (log lines cross-check at run time):
#:   NSW-2016 25% cut $911.45/wk, 75% cut $2,794.98/wk, top band 0.1080
#:   (federal national pins: lo $895.80, hiq $2,655.45 — NSW-above, as
#:   peer ordering requires)
INC_LO_GUARD_2016 = (860, 960)
INC_HIQ_GUARD_2016 = (2600, 3000)
INC_HI_GUARD_2016 = (0.08, 0.14)


def fail(msg):
    raise SystemExit(f"nsw19-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# ---------------------------------------- the corrected local income reader
def income_2016_nsw():
    """Per-SA1 income cohorts keyed NSW SA1 -> (adults, loMass, hiMass,
    medIncWeekly, (16 adult masses), (16 household masses), hiqMass);
    plus the frame's incomeCuts record. income_gcp's arithmetic verbatim
    (columns resolved by NAME against the live headers, never position
    (the shared state_income's tuple offsets shift one column left —
    see the INCOME-LANE NOTE), the cuts computed on the NSW-prefixed
    universe, matching the state-frame convention)."""
    ad, nonfam = gcp_newlanes._income_factors()
    z = zipfile.ZipFile(GCP_ZIP)

    def members(table):
        m = MEMBER(table=table)
        if m not in z.namelist():
            fail(f"GCP zip lacks {m}")
        return m

    def head_errors(table, want):
        memb = members(table)
        with io.TextIOWrapper(z.open(memb), encoding="utf-8-sig") as fh:
            head = [h.strip() for h in next(csv.reader(fh))]
        miss = [c for c in want if c not in head]
        if miss:
            fail(f"GCP {table} header drift, missing {miss}")
        return head

    negf, negh = "Neg_Nil_inc_Tot", "Negative_Nil_income_Tot"
    neg_types = ("Neg_Nil_inc_cpl_fam_no_child",
                 "Neg_Nil_inc_cpl_fam_wth_chld",
                 "Neg_Nil_inc_One_parent_fam",
                 "Neg_Nil_inc_Other_fam")
    h28 = head_errors("G28", [negf, *neg_types])
    h29 = head_errors("G29", [negh])
    plan = []
    for lo, hi in INC_BANDS:
        stem = f"{lo}_{hi if hi is not None else 'more'}"
        hi_tot, fi_tot = f"HI_{stem}_Tot", f"FI_{stem}_Tot"
        if hi_tot not in h29:
            fail(f"GCP G29 lacks {hi_tot}")
        if fi_tot not in h28:
            fail(f"GCP G28 lacks {fi_tot}")
        types = []
        for want in (r"cpl_fam_no_child$", r"cpl_fam_(with|wth)_ch",
                     r"One_parent_fam$", r"Other_fam$"):
            c = next((h for h in h28
                      if h.startswith(f"FI_{stem}_")
                      and re.search(want, h)), None)
            if c is None:
                fail(f"GCP G28 lacks {fi_tot} {want}")
            types.append(c)
        plan.append((hi_tot, fi_tot, types))

    def read(table, cols):
        out = {}
        n = 0
        memb = members(table)
        with io.TextIOWrapper(z.open(memb), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            for row in rdr:
                n += 1
                code = row[GCP_KEY]
                if not code.startswith("1"):
                    continue
                if code in out:
                    fail(f"GCP {table} dup NSW code {code}")
                out[code] = tuple(int(row[c]) for c in cols)
        if n != GCP_ROWS:
            fail(f"GCP {table} rows {n} != pin {GCP_ROWS}")
        return out

    # r28 tuple layout: [0] Neg_Nil_inc_Tot, [1..4] the four Neg_Nil
    # type columns (no-child/wth-chld/one-parent/other), then per band
    # [5+i*5] FI Tot, [6+i*5 .. 9+i*5] the band's four type counts —
    # every consumer below folds band 0's neg mass off these positions
    cols28 = [negf, *neg_types] + [c for hi_tot, fi_tot, types in plan
                                   for c in (fi_tot, *types)]
    cols29 = [negh] + [p[0] for p in plan]
    g28 = read("G28", cols28)
    g29 = read("G29", cols29)
    if set(g28) != set(g29):
        fail("GCP G28/G29 NSW universe drift")
    nb = len(INC_BANDS)
    nat = {"b": [0.0] * nb, "fi": [0.0] * nb,
           "mix": [[0.0] * 4 for _ in range(nb)]}
    for code in g28:
        r29, r28 = g29[code], g28[code]
        for i in range(nb):
            ne = i == 0
            nat["b"][i] += r29[i + 1] + (r29[0] if ne else 0)
            nat["fi"][i] += r28[5 + i * 5] + (r28[0] if ne else 0)
            for k in range(4):
                nat["mix"][i][k] += r28[6 + i * 5 + k] + (r28[1 + k]
                                                          if ne else 0)
    nat_famper, nat_fams = [], []
    for i in range(nb):
        m = nat["mix"][i]
        if sum(m) <= 0 or nat["b"][i] <= 0:
            fail(f"NSW-2016 income band {INC_BANDS[i]} empty universe mix")
        nat_famper.append(sum(x * a for x, a in zip(m, ad)) / sum(m))
        nat_fams.append(min(1.0, nat["fi"][i] / nat["b"][i]))
    nat_adults = [nat["b"][i] * (nat_fams[i] * nat_famper[i]
                                 + (1 - nat_fams[i]) * nonfam)
                  for i in range(nb)]
    nat_tot = sum(nat_adults)
    cuts = {}
    for Q, tag in ((INC_LO_Q, "lo"), (INC_HI_Q, "hiq")):
        cum = 0.0
        for i, (lo, hi) in enumerate(INC_BANDS):
            share = nat_adults[i] / nat_tot
            prev = cum
            cum += share
            if cum >= Q:
                if hi is None:
                    fail(f"NSW-2016 income {tag} cut lands the open band")
                cuts[tag] = lo + (Q - prev) / share * (hi - lo + 1)
                break
    cut, cut75 = cuts["lo"], cuts["hiq"]
    if not INC_LO_GUARD_2016[0] <= cut <= INC_LO_GUARD_2016[1]:
        fail(f"NSW-2016 income 25% cut {cut} outside guard "
             f"{INC_LO_GUARD_2016}")
    if not INC_HIQ_GUARD_2016[0] <= cut75 <= INC_HIQ_GUARD_2016[1]:
        fail(f"NSW-2016 income 75% cut {cut75} outside guard "
             f"{INC_HIQ_GUARD_2016}")
    hi_share = nat_adults[-1] / nat_tot
    if not INC_HI_GUARD_2016[0] <= hi_share <= INC_HI_GUARD_2016[1]:
        fail(f"NSW-2016 income top-band share {hi_share:.4f} outside "
             f"guard {INC_HI_GUARD_2016}")
    print(f"NSW-2016 income: 25% cut ${cut:.2f}/wk, 75% cut "
          f"${cut75:.2f}/wk, top band {hi_share:.4f} (adults, 2016 $)")

    out = {}
    for code in g29:
        r29, r28 = g29[code], g28[code]
        bands_ad = []
        hh = []
        for i in range(nb):
            ne = i == 0
            tot = float(r29[i + 1]) + (float(r29[0]) if ne else 0.0)
            fi = float(r28[5 + i * 5]) + (float(r28[0]) if ne else 0.0)
            mix = [float(r28[6 + i * 5 + k]) + (float(r28[1 + k])
                                                if ne else 0.0)
                   for k in range(4)]
            mixn = sum(mix)
            famper = (sum(x * a for x, a in zip(mix, ad)) / mixn
                      if mixn > 0 else nat_famper[i])
            # fam share of the band's households, clamped: an SA1 cell's
            # independently perturbed G28 FI Tot can momentarily exceed
            # the G29 HI Tot it shares its basis with
            fams = min(1.0, fi / tot) if tot > 0 else nat_fams[i]
            bands_ad.append(tot * (fams * famper + (1 - fams) * nonfam))
            hh.append(tot)
        tsum = sum(bands_ad)

        def below(cutv):
            mass = 0.0
            for i, (lo, hi) in enumerate(INC_BANDS):
                if cutv <= lo:
                    break
                if hi is not None and cutv > hi:
                    mass += bands_ad[i]
                    continue
                mass += bands_ad[i] * (cutv - lo) / (hi - lo + 1)
                break
            return mass

        thh = sum(hh)
        med = None
        if thh > 0:
            half = thh / 2
            accx = 0.0
            for i, (lo, hi) in enumerate(INC_BANDS):
                if accx + hh[i] >= half:
                    if hi is not None and hh[i] > 0:
                        med = int(round(lo + (hi - lo + 1)
                                        * (half - accx) / hh[i]))
                    break
                accx += hh[i]
        out[code] = (tsum, below(cut), bands_ad[-1], med,
                     tuple(bands_ad), tuple(hh), tsum - below(cut75))
    cutrec = {"loQuantile": INC_LO_Q, "loCutWeekly": round(cut, 2),
              "hiQuantile": INC_HI_Q, "hiQCutWeekly": round(cut75, 2),
              "hiEdgeWeekly": 4000,
              "hiNationalShare": round(hi_share, 6),
              "dollarsYear": 2016}
    print(f"GCP income cells: {len(out)} NSW SA1s (era 2016, corrected "
          f"family block)")
    return out, cutrec


# --------------------------------------------------------------- GCP (NSW rows)
def load_gcp_nsw():
    """qld17's table/column map on the NSW prefix: 2016 GCP SA1 pack,
    NSW rows only (SA1 codes start "1"). Column spellings verified from
    the zip's own headers 2026-11-04."""
    if not os.path.exists(GCP_ZIP):
        fail(f"missing GCP input {GCP_ZIP} (see docstring)")
    # 2016's language column pair (the 2021 pack's Lang_used_home_* pair
    # is the same concept renamed; the 2016 prints are these, verified)
    lang_cols = ("Lang_spoken_home_Eng_only_P", "Lang_spoken_home_Oth_Lang_P")
    agecols = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
    want = [GCP_KEY, "Tot_P_P", *lang_cols, *agecols]
    z = zipfile.ZipFile(GCP_ZIP)
    member = MEMBER(table="G01")
    if member not in z.namelist():
        fail(f"GCP zip lacks {member}")
    base = {}
    n = 0
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"GCP G01 header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row[GCP_KEY]
            if not code.startswith("1"):
                continue
            if code in base:
                fail(f"GCP G01 dup NSW code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row[lang_cols[0]]),
                          int(row[lang_cols[1]]),
                          tuple(int(row[c]) for c in agecols))
    if n != GCP_ROWS:
        fail(f"GCP G01 rows {n} != pin {GCP_ROWS}")
    if len(base) != GCP_NSW_ROWS:
        fail(f"GCP NSW rows {len(base)} != pin {GCP_NSW_ROWS}")
    persons = sum(r[0] for r in base.values())
    if abs(persons - NSW_PERSONS_ANCHOR_2016) > NSW_PERSONS_TOL:
        fail(f"GCP NSW persons {persons} drifted past ±{NSW_PERSONS_TOL} of "
             f"2016 census New South Wales {NSW_PERSONS_ANCHOR_2016}")
    print(f"GCP G01 NSW: {len(base)} SA1s, {persons} persons "
          f"(anchor {NSW_PERSONS_ANCHOR_2016}, delta {persons - NSW_PERSONS_ANCHOR_2016})")

    extra = {}
    for tag, member_t, cols in (
        ("G09F", MEMBER(table="G09F"), GCP_G09F_COLS),
        ("G09G", MEMBER(table="G09G"), GCP_G09G_COLS),
        ("G09H", MEMBER(table="G09H"), GCP_G09H_COLS),
        ("G46B", MEMBER(table="G46B"),
         ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
          "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]),
        ("G57B", MEMBER(table="G57B"), GCP_G57B_OCCS),
    ):
        if member_t not in z.namelist():
            fail(f"GCP zip lacks {member_t}")
        d = {}
        m = 0
        with io.TextIOWrapper(z.open(member_t), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in [GCP_KEY, *cols]
                    if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"GCP {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row[GCP_KEY]
                if not code.startswith("1"):
                    continue
                if code in d:
                    fail(f"GCP {tag} dup NSW code {code}")
                d[code] = tuple(int(row[c]) for c in cols)
        if m != GCP_ROWS:
            fail(f"GCP {tag} rows {m} != pin {GCP_ROWS}")
        if len(d) != len(base):
            fail(f"GCP {tag}: {len(d)} NSW rows != G01's {len(base)}")
        extra[tag] = d
        print(f"GCP {tag} NSW: {len(d)} SA1s")

    out = {}
    for code, r in base.items():
        f09 = extra["G09F"].get(code)
        g09 = extra["G09G"].get(code)
        h09 = extra["G09H"].get(code)
        e46 = extra["G46B"].get(code)
        o57 = extra["G57B"].get(code)
        if f09 is None or g09 is None or h09 is None or e46 is None \
                or o57 is None:
            fail(f"GCP SA1 set mismatch at {code}")
        # the ten-country cob tuple, in COB_KEYS order, indexed on the
        # GCP_G09{F,G,H}_COLS orders above
        cob = (f09[1], g09[0], f09[2], g09[1], h09[2], h09[3], h09[4],
               g09[2], h09[6], h09[5])
        out[code] = r + (f09[0], h09[0], h09[1],
                         e46[0] + e46[1] + e46[2], e46[3],
                         o57[2] + o57[6] + o57[7], sum(o57)) + (cob,)
    print(f"GCP demo NSW: {len(out)} rows, persons {persons}")
    return out, persons


# ------------------------------------------------------------------ assemble
def main():
    gcp, nsw_persons = load_gcp_nsw()
    nlt = gcp_newlanes.load(GCP_ZIP, prefix="1", era="2016")
    arc = gcp_newlanes.load_arc31(GCP_ZIP, prefix="1", era="2016")
    inc, _inc_cutrec = income_2016_nsw()
    HL = gcp_newlanes.hl_alloc_of(2016, "c7")
    assign = load_assign_map(YEAR)
    sent = NSW_SENTINELS[YEAR]

    # every GCP NSW row is either in the join or a sentinel; the join's SA1
    # set and the GCP set must agree exactly
    missing = set(gcp) - sent - set(assign)
    extra = set(assign) - set(gcp)
    if missing:
        fail(f"GCP SA1s outside the join: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"join SA1s without a GCP row: {sorted(extra)[:5]} ({len(extra)})")

    # sentinel persons are the only NSW census persons not joined
    sentinel_persons = sum(gcp[c][0] for c in sent)
    if sentinel_persons != NSW_SENTINEL_PERSONS_2016:
        fail(f"sentinel SA1 persons {sentinel_persons} != pin "
             f"{NSW_SENTINEL_PERSONS_2016}")
    print(f"sentinel SA1s: {len(sent)}, {sentinel_persons} persons")

    order = list(EXPECTED_NAMES)
    if len(order) != 93:
        fail("nsw13_geo.EXPECTED_NAMES drifted")

    # pool
    acc = {}
    for code, dist in assign.items():
        a = acc.setdefault(dist, {"p": 0, "eng": 0, "oth": 0, "aust": 0,
                                  "tot": 0, "cobns": 0, "uni": 0, "eduns": 0,
                                  "pop15": 0, "blue": 0, "occd": 0,
                                  "cobN": [0] * len(COB_KEYS),
                                  "bands": [0] * len(DEMO_BANDS), "n": 0,
                                  "ylN": 0, "ylD": 0, "atN": 0, "atD": 0,
                                  "relN": [0] * len(gcp_newlanes.REL_KEYS),
                                  "relNS": 0, "relTot": 0,
                                  "tenN": [0] * 6, "famN": 0, "famD": 0,
                                  "citz": 0, "ptn": 0, "ptt": 0, "ptns": 0,
                                  "ceb3": 0, "cebns": 0, "cebt": 0,
                                  "ancN": [0] * len(gcp_newlanes.ANC_KEYS),
                                  "ancP": 0, "ancNS": 0,
                                  "incAud": 0.0, "incLo": 0.0, "incHi": 0.0,
                                  "incHiQ": 0.0,
                                  "incBandH": [0] * len(gcp_newlanes.INC_BANDS),
                                  "hlE": 0.0})
        r = gcp[code]
        a["p"] += r[0]
        a["eng"] += r[1]
        a["oth"] += r[2]
        for i in range(len(DEMO_BANDS)):
            a["bands"][i] += r[3][i]
        a["aust"] += r[4]
        a["tot"] += r[5]
        a["cobns"] += r[6]
        a["uni"] += r[7]
        a["eduns"] += r[8]
        a["blue"] += r[9]
        a["occd"] += r[10]
        for i in range(len(COB_KEYS)):
            a["cobN"][i] += r[11][i]
        a["pop15"] += r[0] - r[3][0] - r[3][1]
        a["n"] += 1
        sch6, indt, (relvec, relns, reltot), ten6, fam = nlt[code]
        a["ylN"] += sum(sch6[1:])
        a["ylD"] += sum(sch6)
        a["atN"] += indt[0]
        a["atD"] += indt[1]
        for i in range(len(gcp_newlanes.REL_KEYS)):
            a["relN"][i] += relvec[i]
        a["relNS"] += relns
        a["relTot"] += reltot
        for i in range(6):
            a["tenN"][i] += ten6[i]
        a["famN"] += fam[0]
        a["famD"] += fam[1]
        citz, (ptn, ptt, ptns), (ceb3, cebns, cebt), \
            (ancv, ancp, ancns) = arc[code]
        a["citz"] += citz
        a["ptn"] += ptn
        a["ptt"] += ptt
        a["ptns"] += ptns
        a["ceb3"] += ceb3
        a["cebns"] += cebns
        a["cebt"] += cebt
        for i in range(len(gcp_newlanes.ANC_KEYS)):
            a["ancN"][i] += ancv[i]
        a["ancP"] += ancp
        aud, lom, him, _med, bands_ad, hh, hiqm = inc[code]
        a["incAud"] += aud
        a["incLo"] += lom
        a["incHi"] += him
        a["incHiQ"] += hiqm
        for ii in range(len(gcp_newlanes.INC_BANDS)):
            a["incBandH"][ii] += hh[ii]
        a["ancNS"] += ancns
        a["hlE"] += HL.get(code, {}).get("e", 0.0)
    for dist in order:
        if dist not in acc:
            fail(f"district {dist} has no SA1 assigned")

    def shares(a):
        bsum = sum(a["bands"])
        fb_den = a["tot"] - a["cobns"]
        uni_den = a["pop15"] - a["eduns"]
        for nm, v in (("bands", bsum), ("fb_den", fb_den),
                      ("uni_den", uni_den), ("occd", a["occd"]),
                      ("eng+oth", a["eng"] + a["oth"])):
            if v <= 0:
                return None, nm
        tn = a["tenN"]
        tend = tn[0] + tn[1] + tn[2] + tn[4]
        s = {
            "lang": round(a["oth"] / (a["eng"] + a["oth"]), 4),
            "a65": round((a["bands"][8] + a["bands"][9] + a["bands"][10]) / bsum, 4),
            "a2034": round((a["bands"][3] + a["bands"][4]) / bsum, 4),
            "fborn": round((fb_den - a["aust"]) / fb_den, 4),
            "uni": round(a["uni"] / uni_den, 4),
            "blue": round(a["blue"] / a["occd"], 4),
            "cob": {k: round(a["cobN"][i] / fb_den, 4)
                    for i, k in enumerate(COB_KEYS)},
            "u15": round((a["bands"][0] + a["bands"][1]) / bsum, 4),
            "y12less": round(a["ylN"] / a["ylD"], 4) if a["ylD"] else None,
            "atsci": round(a["atN"] / a["atD"], 4) if a["atD"] else None,
            "onepar": round(a["famN"] / a["famD"], 4) if a["famD"] else None,
            "rel": {k: (round(a["relN"][i] / (a["relTot"] - a["relNS"]), 4)
                        if a["relTot"] - a["relNS"] > 0 else None)
                    for i, k in enumerate(gcp_newlanes.REL_KEYS)},
            "ten": {k: (round({"mort": tn[1], "rent": tn[2],
                               "own": tn[0], "rentPub": tn[3]}[k] / tend, 4)
                        if tend > 0 else None)
                    for k in ["mort", "rent", "own", "rentPub"]},
            "pt": (round(a["ptn"] / (a["ptt"] - a["ptns"]), 4)
                   if a["ptt"] - a["ptns"] > 0 else None),
            "noncit": round((a["p"] - a["citz"]) / a["p"], 4) if a["p"] else None,
            "bigfam": (round(a["ceb3"] / (a["cebt"] - a["cebns"]), 4)
                       if a["cebt"] - a["cebns"] > 0 else None),
            "hl": round(a["hlE"] / a["p"], 4) if a["p"] else None,
            "anc": {k: (round(a["ancN"][i] / (a["ancP"] - a["ancNS"]), 4)
                        if a["ancP"] - a["ancNS"] > 0 else None)
                    for i, k in enumerate(gcp_newlanes.ANC_KEYS)},
        }
        if a.get("incAud", 0) > 0:
            s["loinc"] = round(a["incLo"] / a["incAud"], 4)
            s["hiinc"] = round(a["incHi"] / a["incAud"], 4)
            s["hiqinc"] = round(a["incHiQ"] / a["incAud"], 4)
            med = gcp_newlanes.band_median(a["incBandH"], gcp_newlanes.INC_BANDS)
            s["medIncWeekly"] = int(round(med)) if med is not None else None
        return s, None

    demo = {}
    for dist in order:
        a = acc[dist]
        s, why = shares(a)
        if s is None:
            fail(f"{dist}: zero denominator on {why}")
        demo[dist] = {**s, "p": a["p"], "n": a["n"]}

    state = {"p": sum(a["p"] for a in acc.values()), "n": sum(a["n"] for a in acc.values())}
    st_acc = {"p": 0, "eng": 0, "oth": 0, "aust": 0, "tot": 0, "cobns": 0,
              "uni": 0, "eduns": 0, "pop15": 0, "blue": 0, "occd": 0,
              "cobN": [0] * len(COB_KEYS),
              "bands": [0] * len(DEMO_BANDS), "n": 0,
              "ylN": 0, "ylD": 0, "atN": 0, "atD": 0,
              "relN": [0] * len(gcp_newlanes.REL_KEYS),
              "relNS": 0, "relTot": 0, "tenN": [0] * 6,
              "famN": 0, "famD": 0,
              "citz": 0, "ptn": 0, "ptt": 0, "ptns": 0,
              "ceb3": 0, "cebns": 0, "cebt": 0,
              "ancN": [0] * len(gcp_newlanes.ANC_KEYS),
              "ancP": 0, "ancNS": 0,
              "incAud": 0.0, "incLo": 0.0, "incHi": 0.0, "incHiQ": 0.0,
              "incBandH": [0] * len(gcp_newlanes.INC_BANDS),
              "hlE": 0.0}
    for a in acc.values():
        for k2, v2 in a.items():
            if k2 == "bands":
                for i in range(len(DEMO_BANDS)):
                    st_acc["bands"][i] += v2[i]
            elif k2 in ("cobN", "relN", "tenN", "ancN", "incBandH"):
                for i in range(len(v2)):
                    st_acc[k2][i] += v2[i]
            else:
                st_acc[k2] += v2
    st_shares, why = shares(st_acc)
    if st_shares is None:
        fail(f"state: zero denominator on {why}")
    if state["p"] + sentinel_persons != nsw_persons:
        fail(f"partition drift: districts {state['p']} + sentinels {sentinel_persons} != GCP NSW {nsw_persons}")
    print("state:", {**st_shares, "persons": state["p"], "sa1": state["n"]})

    out = {
        "year": "nsw19",
        "jurisdiction": "NSW",
        "date": "2019-03-23",
        "demoBasis": "sa1",
        "cobKeys": COB_KEYS,
        "relKeys": list(gcp_newlanes.REL_KEYS),
        "tenKeys": ["mort", "rent", "own", "rentPub"],
        "ancKeys": list(gcp_newlanes.ANC_KEYS),
        "demo": {n: demo[n] for n in order},
        "state": {**st_shares, "persons": state["p"], "sa1": state["n"],
                  "sentinelSa1": len(sent), "sentinelPersons": sentinel_persons},
        "src": {
            "districtGeojson": {"path": os.path.relpath(DIST_GEOJSON, REPO), "sha16": hash16(DIST_GEOJSON)},
            "gcp": {"path": os.path.relpath(GCP_ZIP, REPO), "sha16": hash16(GCP_ZIP),
                    "members": ["G01", "G07", "G08", "G09F", "G09G", "G09H",
                                "G14", "G24", "G28", "G29", "G33",
                                "G46B", "G57B", "G59"]},
            "sa1Shp": {"path": os.path.relpath(V["shp"], REPO), "sha16": hash16(V["shp"])},
            "assignMap": {"path": os.path.relpath(V["assign"], REPO), "sha16": hash16(V["assign"])},
            "gcpRows": GCP_ROWS,
        },
        "about": ("2016 Census GCP G01/G07/G08/G09F/G09G/G09H/G14/G24/G28/G29/G33/G46B/G57B/G59 SA1 tables, pooled to New South "
                  "Wales's 93 state electoral districts for the 23 March 2019 election (the "
                  "2013 redistribution's boundaries — nsw19 shares nsw15's district set, the "
                  "census edition moved). Each SA1 counts whole to the district its polygon "
                  "centroid lies in (boundary SA1s are not split; the state total is never "
                  "moved; the SA1→district assignment is the join cache .build/map/nsw13/"
                  "assign-sa1-2016.json, the same one the SEIFA lanes pool over). Bases match "
                  "the federal stores (ex-not-stated): language other than English over "
                  "English-only+other stated; age shares renormalised over G01's 11 bands "
                  "(which exclude age-not-stated); overseas-born over country-stated, and "
                  "the ten curated birthplace-country shares (cob, order in cobKeys) riding "
                  "the same country-stated basis; "
                  "university (bachelor and above) over the G01 aged-15+ population less "
                  "level-of-education-not-stated; blue-collar (trades, machinery operators "
                  "and drivers, labourers) over the eight stated ANZSCO groups; the new "
                  "lane set mirrors the federal stores (year-12-or-less over G01's six "
                  "printed stated schooling levels; G07 Tot-row Indigenous/ "
                  "Indigenous-plus-non-Indigenous; G14's Religion menu ten shares (rel, "
                  "key order in relKeys) over the ex-affiliation-not-stated persons basis; "
                  "G33's Housing-tenure menu four shares (ten, key order in tenKeys) over "
                  "the ex-tenure-not-stated occupied-private-dwellings basis; G28's "
                  "one-parent share of families; the under-15 share of the stated ages). "
                  "Income lanes are the 2016 edition's 16-band grid in 2016 dollars, the "
                  "state-universe quantile cuts New South Wales's own, computed per SA1 "
                  "with the federal income lane's family-share arithmetic. p is census "
                  "persons; n the SA1 count. The four NSW sentinel SA1s (migratory/offshore) "
                  "carry no polygon and sit outside the join, holding "
                  f"{sentinel_persons} persons statewide."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")


main()
