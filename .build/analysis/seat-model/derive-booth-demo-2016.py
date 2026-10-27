#!/usr/bin/env python3
"""data/booth-demo-2013-c1.json — the 2016-census (c1) side of the 2013
people-interpolation lane, AND the repo's 2016 GCP reader library.

The /map/ census-people lanes interpolate between bracketing censuses
to election day (see data/booth-demo-{year}.json's demoInterp record,
written by the interp blend pass; the SEIFA pcti lanes' day-share f).
The measured side of the 2013 lane is the 2011-census venue store
(data/booth-demo-2013.json); this script reads the 2016 Census General
Community Profile SA1 datapack:

  booths     the 2016 GCP counts of the 2016-census SA1 the booth's
             premises coordinates (data/booth-seifa-2013.json's
             lat/lon) fall in — point-in-polygon against the ABS
             1270.0.55.001 July 2016 shapes, the same locate() ladder
             the SEIFA interp lane rides
  divisions  the 2016 GCP counts whole-allocated to CED_2011 and
             summed per division. Membership is CG-plurality: each
             2016 SA1 rides whichever 2011 SA1 delivered it the most
             people (CG_SA1_2011_SA1_2016 RATIO_FROM_TO x the source's
             2011 BCP headcount — a deterministic plurality proxy
             weighting measure, the CG's own ratio basis is 2016
             population), then that SA1's CED from the SAME
             1270055003_ced_2011 allocation map the measured store
             sums on — boundary set identical by construction, never
             polygon-recomputed, so the two sides divide identically

GCP 2016 anatomy (table ids drift from the 2021 GCP's): G01 key
SA1_7DIGITCODE_2016 (Tot_P_P, Age_*_yr_P 11 bands, language) —
identical names to 2021. G09F/G09H country of birth and G46B
qualifications keep the 2021 GCP's _Tot totals columns (P_Australia_Tot,
P_Tot_Tot, P_COB_NS_Tot; P_PGrad_Deg_Total, P_GradDip_and_GradCert_Total,
P_BachDeg_Total, P_Lev_Edu_NS_Total) beside age-banded lanes the lanes
never read. Occupation is G57B (P<9 age bands>_ eight stated ANZSCO
major groups, summed over age bands). Income: G28 family income by
composition and G29 household income are the G32/G33 counterparts on
the SAME 16-band grid as the 2021 GCP (FI_1_149..FI_4000_more,
HI_*_Tot, Neg_Nil_inc_* columns of the B26/B28 family) — the lanes are
derive-booth-seifa-voter.py's income_gcp algorithm bridged onto those
two tables, adults re-weighted at data/income-dist.json's factors.

The GCP readers here are the module's LIBRARY half (load_gcp16 /
income_gcp16 / GCP16 / band_median16): the voter-store interp pass
imports them to fold the 2016/2019 elections' c0/c1 sides, so every
2016-census reading in the repo comes from this one file.

Guards fail loud (table id drift, SA1 universe drift, division-name
drift vs the measured store, plus published national anchors: 2016
usual-resident persons and the published $1,438 national median
household income within tolerance). Run:
  python3 .build/analysis/seat-model/derive-booth-demo-2016.py
Test: node .build/analysis/seat-model/test-booth-demo-2016.mjs
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


def _lib(name, path):
    spec = importlib.util.spec_from_file_location(name, SM / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


d13 = _lib("d13", "derive-booth-demo-2013.py")
hist = _lib("hist", "derive-booth-seifa-hist.py")
voter = _lib("voter", "derive-booth-seifa-voter.py")
fail, hash16 = d13.fail, d13.hash16

STATE_ORDER = d13.STATE_ORDER
BANDS = d13.BANDS
INC_BANDS = voter.INC_BANDS          # the 16-band GCP grid
INC_LO_Q = voter.INC_LO_Q
GCP_ZIP = SM / "cache/gcp-sa1-2016.zip"
PRE = "2016 Census GCP Statistical Area 1 for AUST/"
MEMBERS = {t: f"{PRE}2016Census_{t}_AUS_SA1.csv"
           for t in ("G01", "G09F", "G09H", "G46B", "G57B", "G28",
                     "G29")}
VENUE = ROOT / "data/booth-seifa-2013.json"
OUT = ROOT / "data/booth-demo-2013-c1.json"
CED_FROM = ("CG-plurality (CG_SA1_2011_SA1_2016 x 2011-BCP headcount) "
            "onto the measured store's own 1270055003_ced_2011 map")
GCP_ROWS = 57523  # the Ed2 SA1 universe every table ships

# measured allocation profile (first run 2026-10-28, verified against
# the published census totals): the CG-plurality map places 56,061 of
# the 57,523 Ed2 SA1s; the 33 no-spatial pseudo SA1s (migratory/no
# usual address, 46,342 persons) are division-less by design — the
# measured 2011-side store drops the same class through the CED map
# — and 274 SA1s sourcing only from those pseudos (90,772 persons)
# follow them. The pins catch input drift (GCP zip, CG xlsx, CED csv);
# the published anchors for human review: 2016 GCP AUST persons
# 23,401,461 (published count 23,401,892), median weekly household
# income $1,438.
ALLOC_SA1_2016 = 57249
ALLOC_PERSONS_2016 = 23310689
ALLOC_PERSONS_TOL = 300
NAT_INCMED_2016 = 1438
INC_LO_GUARD_2016 = (750, 1050)   # 2011 was $738, 2021 ~$1,066
INC_HI_GUARD_2016 = (0.06, 0.13)  # 2011 .0444, 2021 ~.156

OCC_AGES = ("15_19", "20_24", "25_34", "35_44", "45_54", "55_64",
            "65_74", "75_84", "85_ov")
OCCS = ["Managers", "Professionals", "TechnicTrades_W",
        "CommunPersnlSvc_W", "ClericalAdminis_W", "Sales_W",
        "Mach_oper_drivers", "Labourers"]


def gcp_table(zipf, member, key_col, col_resolvers, pin_rows=GCP_ROWS):
    """One GCP member -> {7d code: tuple(values)}; resolvers are exact
    names or regexes each matching exactly one column."""
    if member not in zipf.namelist():
        fail(f"GCP zip lacks {member}")
    out = {}
    with io.TextIOWrapper(zipf.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.reader(fh)
        head = [h.strip() for h in next(rdr)]
        ix_of = []
        for res in col_resolvers:
            hits = ([head.index(res)] if res in head else
                    [i for i, h in enumerate(head)
                     if re.fullmatch(res, h)])
            if len(hits) != 1:
                fail(f"{member}: column {res!r} matched {hits}")
            ix_of.append(hits[0])
        if key_col not in head:
            fail(f"{member}: key column {key_col} drift")
        kx = head.index(key_col)
        for row in rdr:
            code = row[kx].strip()
            if not (code.isdigit() and len(code) == 7):
                fail(f"{member}: SA1 key drift {code!r}")
            if code in out:
                fail(f"{member}: dup SA1 {code}")
            try:
                out[code] = tuple(int(float(row[i])) for i in ix_of)
            except ValueError as e:
                fail(f"{member}: non-numeric cell at {code}: {e}")
    if len(out) != pin_rows:
        fail(f"{member}: {len(out)} rows != pin {pin_rows}")
    return out


def occ_columns(head):
    """G57B group -> its 9 age-prefixed columns, resolved by fullmatch
    (ABS header truncation means stems vary; the pin is coverage)."""
    grp_cols = {}
    for g in OCCS:
        cols = [c for c in head for a in OCC_AGES
                if c == f"P{a}_{g}" or
                (g == "TechnicTrades_W" and
                 c == f"P{a}_TechnicTrades_Wrs")]
        if len(cols) != 9:
            # truncation-tolerant fallback: unique fullmatch per group
            hits = [c for c in head if re.fullmatch(
                rf"P(?:15_19|20_24|25_34|35_44|45_54|55_64|65_74|75_84|"
                rf"85_ov)_{g}(rs)?", c)]
            if g == "TechnicTrades_W":
                hits = [c for c in hits if "Trades" in c]
            if len(set(hits)) != 9:
                fail(f"G57B: occupation {g} columns {hits} != 9")
            cols = hits
        grp_cols[g] = cols
    return grp_cols


def load_gcp16():
    """Per 7d SA1: the gcp row tuple mirroring vote's _GCP layout —
    (pers, eng, oth, ages(11), aust, totc, cobns, uni, eduns, bluen,
    occd, inct, incl, inch, incb(16), incbh(16)) — over the 2016 GCP."""
    if not GCP_ZIP.exists():
        fail(f"missing {GCP_ZIP} (ABS datapacks "
             "2016_GCP_SA1_for_AUS_short-header.zip)")
    z = zipfile.ZipFile(GCP_ZIP)
    age_cols = [f"Age_{b}_yr_P" for b in BANDS[:-1]] + ["Age_85ov_P"]
    g01 = gcp_table(z, MEMBERS["G01"], "SA1_7DIGITCODE_2016",
                    ["Tot_P_P", *age_cols,
                     "Lang_spoken_home_Eng_only_P",
                     "Lang_spoken_home_Oth_Lang_P"])
    g09f = gcp_table(z, MEMBERS["G09F"], "SA1_7DIGITCODE_2016",
                     ["P_Australia_Tot"])
    g09h = gcp_table(z, MEMBERS["G09H"],
                     "SA1_7DIGITCODE_2016", ["P_Tot_Tot",
                                             "P_COB_NS_Tot"])
    g46 = gcp_table(z, MEMBERS["G46B"], "SA1_7DIGITCODE_2016",
                    ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
                     "P_BachDeg_Total", "P_Lev_Edu_NS_Total"])
    # G57B's occupation columns resolve off its own header
    if MEMBERS["G57B"] not in z.namelist():
        fail("GCP zip lacks G57B")
    with io.TextIOWrapper(z.open(MEMBERS["G57B"]),
                          encoding="utf-8-sig") as fh:
        g57_head = [h.strip() for h in next(csv.reader(fh))]
    grp_cols = occ_columns(g57_head)
    occ_want = [c for g in OCCS for c in grp_cols[g]]
    g57 = gcp_table(z, MEMBERS["G57B"], "SA1_7DIGITCODE_2016",
                    occ_want)
    ng = len(OCCS)

    def occ_of(vals):
        sums = [sum(vals[i * 9:(i + 1) * 9]) for i in range(ng)]
        return (sums[2] + sums[6] + sums[7]), sum(sums)

    ad4, nonfam, inc_path = voter.income_factors()
    inc, inc_cut, inc_hishare = income_gcp16(z, ad4, nonfam)
    if set(g01) != set(inc):
        fail("G01/G28+G29 SA1 universes diverge")
    out = {}
    for code, r in g01.items():
        if code not in g09f or code not in g09h or code not in g46 \
                or code not in g57:
            fail(f"GCP G09/G46B/G57B SA1 set mismatch at {code}")
        bluen, occd = occ_of(g57[code])
        uni = g46[code][0] + g46[code][1] + g46[code][2]
        ir = inc[code]
        out[code] = (r[0], r[12], r[13],           # pers, eng, oth
                     r[1:12],                      # ages(11)
                     g09f[code][0],                # aust
                     g09h[code][0],                # totc
                     g09h[code][1],                # cobns
                     uni, g46[code][3],            # uni, eduns
                     bluen, occd,                  # bluen, occd
                     ir[0], ir[1], ir[2],          # inct/incl/inch
                     ir[3], ir[4])                 # incb(16), incbh(16)
    print(f"GCP 2016: {len(out)} SA1s "
          f"(G01/G09/G46B/G57B + G28/G29 income)")
    meta = {"loCutWeekly": inc_cut, "hiEdgeWeekly": INC_BANDS[-1][0],
            "hiNationalShare": inc_hishare, "loQuantile": INC_LO_Q,
            "dollarsYear": 2016, "factors": inc_path}
    return out, meta


def income_gcp16(z, ad, nonfam):
    """The voter script's income_gcp recomputation bridged onto the
    2016 GCP's G28 (family income x composition, FI stems + the B26
    family's Neg columns) and G29 (household income, HI stems +
    Negative_Nil_income_Tot) — same 16-band grid, same algorithm:
    household masses re-weighted to adults at each SA1's family mix
    (national mix as fallback), national 25th-percentile cut off the
    national adults histogram, houses-mass medians off the raw bands."""
    def head_of(member):
        if member not in z.namelist():
            fail(f"GCP zip lacks {member}")
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            return [h.strip() for h in next(csv.reader(fh))]

    h28, h29 = head_of(MEMBERS["G28"]), head_of(MEMBERS["G29"])
    neg_types = ("Neg_Nil_inc_cpl_fam_no_child",
                 "Neg_Nil_inc_cpl_fam_wth_chld",
                 "Neg_Nil_inc_One_parent_fam", "Neg_Nil_inc_Other_fam")
    for c in ("Neg_Nil_inc_Tot", *neg_types):
        if c not in h28:
            fail(f"GCP G28 lacks {c}")
    if "Negative_Nil_income_Tot" not in h29:
        fail("GCP G29 lacks Negative_Nil_income_Tot")
    plan = []
    for lo, hi in INC_BANDS:
        stem = f"{lo}_{hi if hi is not None else 'more'}"
        hi_tot, fi_tot = f"HI_{stem}_Tot", f"FI_{stem}_Tot"
        if hi_tot not in h29:
            fail(f"GCP G29 lacks {hi_tot}")
        types = []
        for want in (r"cpl_fam_no_child$", r"cpl_fam_(with|wth)_ch",
                     r"One_parent_fam$", r"Other_fam$"):
            c = f"FI_{stem}_{want}"
            hit = next((h for h in h28
                        if h.startswith(f"FI_{stem}_") and
                        re.search(want, h)), None)
            if hit is None:
                fail(f"GCP G28 lacks FI_{stem} {want}")
            types.append(hit)
        if fi_tot not in h28:
            fail(f"GCP G28 lacks {fi_tot}")
        plan.append((hi_tot, fi_tot, types))
    cols29 = ["Negative_Nil_income_Tot"] + [p[0] for p in plan]
    cols28 = ["Neg_Nil_inc_Tot", *neg_types] + \
             [c for p in plan for c in (p[1], *p[2])]
    t29 = gcp_table(z, MEMBERS["G29"], "SA1_7DIGITCODE_2016", cols29)
    t28 = gcp_table(z, MEMBERS["G28"], "SA1_7DIGITCODE_2016", cols28)
    if set(t28) != set(t29):
        fail("GCP G28/G29 SA1 sets diverge")
    n16 = len(INC_BANDS)
    nat = {"b": [0.0] * n16, "fi": [0.0] * n16,
           "mix": [[0.0] * 4 for _ in range(n16)]}
    for code, r29 in t29.items():
        r28 = t28[code]
        for i in range(n16):
            ne = i == 0
            nat["b"][i] += float(r29[i + 1]) + (
                float(r29[0]) if ne else 0.0)
            nat["fi"][i] += float(r28[5 + i * 5]) + (
                float(r28[0]) if ne else 0.0)
            for k in range(4):
                nat["mix"][i][k] += float(r28[6 + i * 5 + k]) + (
                    float(r28[1 + k]) if ne else 0.0)
    nat_famper, nat_fams = [], []
    for i in range(n16):
        mixn = sum(nat["mix"][i])
        if mixn <= 0 or nat["b"][i] <= 0:
            fail(f"national income mix empty in band {INC_BANDS[i]}")
        nat_famper.append(sum(m * a for m, a in zip(nat["mix"][i], ad))
                          / mixn)
        nat_fams.append(min(1.0, nat["fi"][i] / nat["b"][i]))
    nat_adults = [nat["b"][i] * (nat_fams[i] * nat_famper[i]
                                 + (1 - nat_fams[i]) * nonfam)
                  for i in range(n16)]
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
    if not cut25 or not INC_LO_GUARD_2016[0] <= cut25 <= INC_LO_GUARD_2016[1]:
        fail(f"income 25% cut {cut25} outside guard {INC_LO_GUARD_2016}")
    hi_share = nat_adults[-1] / nat_tot
    if not INC_HI_GUARD_2016[0] <= hi_share <= INC_HI_GUARD_2016[1]:
        fail(f"top-band national share {hi_share:.4f} outside "
             f"{INC_HI_GUARD_2016}")
    print(f"income: national 25% cut ${cut25:.0f}/wk (adults, 2016 $); "
          f"top band {hi_share:.4f} of adults")

    out = {}
    for code, r29 in t29.items():
        r28 = t28[code]
        bands, hh = [], []
        for i in range(n16):
            ne = i == 0
            tot = float(r29[i + 1]) + (float(r29[0]) if ne else 0.0)
            fi = float(r28[5 + i * 5]) + (float(r28[0]) if ne else 0.0)
            mix = [float(r28[6 + i * 5 + k]) + (
                float(r28[1 + k]) if ne else 0.0) for k in range(4)]
            mixn = sum(mix)
            famper = (sum(m * a for m, a in zip(mix, ad)) / mixn
                      if mixn > 0 else nat_famper[i])
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
    return out, round(cut25, 2), round(hi_share, 6)


def band_median16(masses):
    """band_median14's 16-band-grid counterpart (INC_BANDS; GCP basis)."""
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


def shares16(rec):
    """d13.shares' body on the 16-band income grid (median off
    band_median16) — the 2016-edition division/booth demo block."""
    s = d13.shares(rec)
    if rec.get("incbh") is not None:
        s["incMed"] = band_median16(rec["incbh"])
    return s


def gcp_to_rec(row):
    """_GCP-layout tuple -> the rec dict shares16 consumes."""
    return {"pers": row[0], "bands": list(row[3]), "eng": row[1],
            "oth": row[2], "aus": row[4], "totc": row[5],
            "cobns": row[6], "uni": row[7], "eduns": row[8],
            "bluen": row[9], "occd": row[10],
            "pop15": row[0] - row[3][0] - row[3][1],
            "inct": row[11], "incl": row[12], "inch": row[13],
            "incbh": list(row[15])}


def ced_of(gcp, sa11):
    """2016 7d SA1 -> CED_2011 division name, CG-plurality (module
    docstring): contributions of each 2011 SA1 into each 2016 SA1 from
    the voter pipeline's composed walk, weighted by the source's 2011
    BCP headcount; a SA1 whose every source was EMPTY in 2011 (a
    grew-from-nothing area — population-weighted plurality finds
    nothing) falls back to its strongest CG link's division, the
    same rescue tier derive-ced-era-alloc.py gives told islands."""
    xw = voter.load_xwalk1116()   # {MAIN11: [(7d16, ratio)]}
    ced11, skipped = d13.load_ced()  # {7d11: div}
    pers = {k: r["pers"] for k, r in sa11.items()}
    cand = defaultdict(list)      # c16 -> [(ced, ratio, people)]
    for c11, ts in xw.items():
        p11 = pers.get(c11[0] + c11[5:])
        ced = ced11.get(c11[0] + c11[5:])
        if p11 is None or ced is None:
            continue
        for c16, r in ts:
            cand[c16].append((ced, r, r * p11))
    out, rescued = {}, 0
    for c16, cs in cand.items():
        if not cs:
            continue
        w = max(cs, key=lambda t: t[2])
        if w[2] > 0.0:
            out[c16] = w[0]
            continue
        # every source empty: the strongest link's division
        out[c16] = max(cs, key=lambda t: t[1])[0]
        rescued += 1
    print(f"CG-plurality allocation: {len(out)} 2016 SA1s placed over "
          f"{len(set(out.values()))} divisions "
          f"({rescued} rescued by link strength; ced map skipped "
          f"{skipped} pseudo SA1s)")
    return out


def main():
    gcp, meta = load_gcp16()
    sa11 = d13.load_bcp()
    alloc = ced_of(gcp, sa11)
    store = json.loads(VENUE.read_text(encoding="utf-8"))
    booths = store["booths"]
    if not booths or "lat" not in booths[0]:
        fail(f"{VENUE.name}: booth lat/lon missing")
    measured = json.loads(d13.ROOT.joinpath(
        "data/booth-demo-2013.json").read_text(encoding="utf-8"))
    divs_hist = {b["div"] for b in booths}
    divs_measured = {d["div"] for d in measured["divisions"]}
    if divs_hist != divs_measured:
        fail(f"division drift: venue vs measured store "
             f"{sorted(divs_hist ^ divs_measured)}")
    if set(alloc.values()) != divs_hist:
        fail(f"division drift: alloc-only "
             f"{sorted(set(alloc.values()) - divs_hist)} venue-only "
             f"{sorted(divs_hist - set(alloc.values()))}")
    divstate = {b["div"]: b["state"] for b in booths}

    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * len(BANDS),
                                  "eng": 0, "oth": 0, "aus": 0, "totc": 0,
                                  "cobns": 0, "uni": 0, "eduns": 0,
                                  "bluen": 0, "occd": 0, "pop15": 0,
                                  "inct": 0.0, "incl": 0.0, "inch": 0.0,
                                  "incbh": [0.0] * len(INC_BANDS)})
    for code, dv in alloc.items():
        row = gcp.get(code)
        if row is None:
            fail(f"allocated 2016 SA1 {code} missing from the GCP")
        acc = divsum[dv]
        acc["pers"] += row[0]
        acc["eng"] += row[1]
        acc["oth"] += row[2]
        for i in range(len(BANDS)):
            acc["bands"][i] += row[3][i]
        for k, ri in (("aus", 4), ("totc", 5), ("cobns", 6), ("uni", 7),
                      ("eduns", 8), ("bluen", 9), ("occd", 10)):
            acc[k] += row[ri]
        acc["pop15"] += row[0] - row[3][0] - row[3][1]
        acc["inct"] += row[11]
        acc["incl"] += row[12]
        acc["inch"] += row[13]
        for i in range(len(INC_BANDS)):
            acc["incbh"][i] += row[15][i]

    locate, _polys, _nulls = hist.build_locate("sa1-2016")
    out_booths = []
    pip_miss = pip_empty = 0
    for vb in booths:
        rec = {"div": vb["div"], "divId": vb["divId"],
               "state": vb["state"], "boothId": vb["boothId"],
               "booth": vb["booth"], "type": vb["type"]}
        lat, lon = vb.get("lat"), vb.get("lon")
        key = None
        if lat is not None and lon is not None and not (
                lat == 0.0 and lon == 0.0):
            full = locate(lon, lat)
            key = full[0] + full[5:] if full is not None else None
        row = gcp.get(key) if key is not None else None
        if row is None:
            pip_miss += 1
            rec["demo"] = None
        elif row[0] == 0:
            pip_empty += 1
            rec["demo"] = None
        else:
            rec["demo"] = shares16(gcp_to_rec(row))
        out_booths.append(rec)

    divisions = []
    for name in sorted(divsum, key=lambda n: (STATE_ORDER[divstate[n]],
                                              n)):
        divisions.append({"div": name, "state": divstate[name],
                          **shares16(divsum[name])})
    nat = defaultdict(int)
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd", "pop15"):
            nat[k] += dv[k]
        for i, b in enumerate(BANDS):
            nat[b] = nat.get(b, 0) + dv["bands"][i]
        for k in ("inct", "incl", "inch"):
            nat[k] += dv[k]
        nat.setdefault("incbh", [0.0] * len(INC_BANDS))
        for i in range(len(INC_BANDS)):
            nat["incbh"][i] += dv["incbh"][i]
    nat_b = sum(nat[b] for b in BANDS)
    nat_eo = nat["eng"] + nat["oth"]
    nat_fbd = nat["totc"] - nat["cobns"]
    nat_unid = nat["pop15"] - nat["eduns"]
    national = {
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
        "incMed": band_median16(nat["incbh"]),
    }
    if len(alloc) != ALLOC_SA1_2016 or abs(
            national["persons"] - ALLOC_PERSONS_2016) > ALLOC_PERSONS_TOL:
        fail(f"allocation profile drift: sa1 {len(alloc)} vs pin "
             f"{ALLOC_SA1_2016}, persons {national['persons']} vs pin "
             f"{ALLOC_PERSONS_2016}(±{ALLOC_PERSONS_TOL})")
    if national["incMed"] is None or \
            abs(national["incMed"] - NAT_INCMED_2016) > 14:
        fail(f"national household median {national['incMed']} vs 2016 "
             f"published ${NAT_INCMED_2016}")

    counts = {
        "booths": len(out_booths),
        "boothsPip": len(out_booths) - pip_miss - pip_empty,
        "boothsPipMiss": pip_miss,
        "boothsPipEmpty": pip_empty,
        "divisions": len(divisions),
        "sa1Gcp": len(gcp),
        "sa1Alloc": len(alloc),
        "national": national,
    }
    out = {
        "_about": (
            "2016-census side (c1) of the people-interpolation store "
            "for the 2013 federal election. The /map/ census-people "
            "lanes interpolate between bracketing censuses to election "
            "day on the SEIFA pcti lanes' day-share of the "
            "intercensal span (the f factor lives in "
            "data/booth-demo-2013.json's demoInterp record, written by "
            "the interp blend pass); this store is the far side ONLY — "
            "the measured side is the 2011-census venue store "
            "(data/booth-demo-2013.json). A booth's demo block is the "
            "2016 Census General Community Profile counts of the "
            "2016-census SA1 its premises coordinates "
            "(data/booth-seifa-2013.json) fall in, point-in-polygon "
            "against the ABS 1270.0.55.001 July 2016 SA1 shapes — the "
            "venue's neighbourhood, never the booth's voters. A "
            "division's row is the 2016 GCP whole-allocated to "
            "CED_2011 and summed, membership by CG-plurality "
            "(CG_SA1_2011_SA1_2016 ratios x the source SA1's 2011 BCP "
            "headcount) onto the measured store's own "
            "1270055003_ced_2011 allocation map, so both sides divide "
            "on the identical boundary set. Shares mirror the voter/"
            "venue lanes: age renormalised over the 11 G01 bands; "
            "language other-at-home over English-only + other; "
            "overseas-born over country-of-birth stated; university "
            "(bachelor and above) per the aged-15+ population less "
            "level-of-education-not-stated; blue-collar over the eight "
            "stated ANZSCO groups. Income lanes are the voter store's "
            "algorithm on the 2016 GCP's G28/G29 (16-band grid, "
            "FI/HI stems): household masses re-weighted to adults at "
            "data/income-dist.json's factors; loinc the adult share "
            "below the 2016 national 25th-percentile cut "
            "(incomeCuts.loCutWeekly, in 2016 dollars), hiinc the "
            "$4,000-top-band share, incMed the band-interpolated "
            "median weekly household income in 2016 dollars on the "
            "household basis (its national value pinned beside the "
            "ABS-published $1,438). A booth whose premises sit outside "
            "every 2016 SA1 polygon, or whose lat/lon are "
            "absent/(0,0), carries demo:null (counts.boothsPipMiss), "
            "as does one whose SA1 housed no one (boothsPipEmpty); "
            "inside a present block a lane is nulled rather than "
            "clamped when GCP perturbation would put its share "
            "outside [0,1]."),
        "_provenance": {
            "sourceUrls": {
                "gcp": "ABS 2016 Census General Community Profile, SA1 "
                       "for AUST (G01/G09F/G09H/G28/G29/G46B/G57B), "
                       "abs.gov.au census datapacks",
                "shapes": "ABS 1270.0.55.001 July 2016, SA1 polygons "
                          "(1270055001_sa1_2016_aust_shape.zip)",
                "cg": "ABS CG_SA1_2011_SA1_2016 (ASGS Ed2 "
                      "correspondences page)",
                "ced": "ABS ASGS Vol 3 July 2011, CED to SA1 "
                       "allocation (1270055003_ced_2011_aust_csv.zip)",
                "venue": "data/booth-seifa-2013.json",
            },
            "files": {
                str(GCP_ZIP.relative_to(ROOT)): hash16(GCP_ZIP),
                "dl/1270055001_sa1_2016_aust_shape.zip":
                    hash16(ROOT / ".matilda/seifa-irsad-abs/dl/"
                                   "1270055001_sa1_2016_aust_shape.zip"),
                "dl/CG_SA1_2011_SA1_2016.xlsx":
                    hash16(ROOT / ".matilda/seifa-irsad-abs/dl/"
                                   "CG_SA1_2011_SA1_2016.xlsx"),
                "dl/1270055003_ced_2011_aust_csv.zip":
                    hash16(ROOT / ".matilda/seifa-irsad-abs/dl/"
                                   "1270055003_ced_2011_aust_csv.zip"),
                "data/booth-seifa-2013.json":
                    hash16(VENUE),
            },
            "extractedAt": str(date.today()),
        },
        "election": 2013,
        "censusEdition": 2016,
        "deliveryBasis": (
            "venue-proxy per booth (2016-census SA1 of the premises, "
            "point-in-polygon); CG-plurality whole-allocated 2016 GCP "
            "sum per division (CED_2011 membership identical to the "
            "measured store's)"),
        "incomeCuts": {
            "loQuantile": INC_LO_Q,
            "loCutWeekly": meta["loCutWeekly"],
            "hiEdgeWeekly": meta["hiEdgeWeekly"],
            "hiNationalShare": meta["hiNationalShare"],
            "dollarsYear": 2016,
            "adultsWeights": "data/income-dist.json",
            "medianBasis": "households (shares are per-adult)",
        },
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    print(f"OK -> {OUT} (booths {len(out_booths)}, pip-miss {pip_miss}, "
          f"pip-empty {pip_empty}, divisions {len(divisions)}, national "
          f"{national})")


if __name__ == "__main__":
    main()
