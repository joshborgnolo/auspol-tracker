#!/usr/bin/env python3
"""data/nsw15-demo.json — per-district 2011-census people figures for the
NSW 2015 state election map (the nsw15 frame on /map/).

The build_nsw19_demo.py recipe one census edition down: the SAME 93
districts of New South Wales's 2013 redistribution, the 2011 census's
vocabulary — this era's datapack is the Basic Community Profile (BCP),
the GCP's pre-2016 form, so the same concepts ride B-numbered short-
header tables (B01 persons/ages/language/citizenship/schooling; B09
country of birth; B40B qualifications; B45B occupation; the lane tables
the gcp_newlanes 2011 entry maps: B07 Indigenous status, B14 religion,
B25 family composition, B32 tenure; the arc tables B08A/B08B ancestry,
B24 children ever born, B46 method of travel; and the B26/B28 income
grids on the BCP's 14-band 2011-dollar grid). Column spellings were
verified live from the zip's own headers 2026-11-04 against
derive-booth-demo-2013.py's pinned constants; derivation bases are the
same ex-not-stated ones the GCP-era frames use, so a federal figure and
an nsw15 figure are commensurate (the one era difference: the BCP's B09
merges the UK's countries, so the birthplace lane carries the eight-
country set the federal 2013 store pins — England/Scotland are not
separately readable in 2011).

Method: every SA1 counts whole to the district its own polygon CENTROID
lies in — boundary-straddling SA1s land on the side their centre sits,
not by area; the state total never moves (every NSW SA1 counts to
exactly one district). The join is the one nsw13_geo.py computes and
commits per vintage at .build/map/nsw13/assign-sa1-<cy>.json (computed
once; this script RIDES the cache — it never re-derives the join, so a
district's people figures and its SEIFA scores always cover the same
geography). The four NSW sentinel SA1s (migratory/offshore) carry no
polygon and sit outside the join.

Inputs (all caches already ride this repo's other pipelines):
  .build/map/src/n-nsw15.geojson                            (93 districts, 2013 redistribution)
  .build/analysis/seat-model/cache/bcp-sa1-2011.zip         (2011 Census BCP SA1 for AUST)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2011_aust_shape.zip (SA1 2011 polygons)
  .build/map/nsw13/assign-sa1-2011.json                     (nsw13_geo.py's join cache)

Deps: python3 stdlib only. Guards fail loud.
usage: python3 -I .build/map/build_nsw15_demo.py
"""
import csv
import hashlib
import io
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nsw13_geo import (DIST_GEOJSON, EXPECTED_NAMES, NSW_SENTINELS,  # noqa: E402
                       VINTAGES, load_assign_map)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
YEAR = 2011
V = VINTAGES[YEAR]
BCP_ZIP = V["gcp"]
BCP_KEY = V["gcp_key"]          # region_id (the BCP's 7-digit SA1 code)
BCP_ROWS = V["gcp_rows"]        # 54,805 national
OUT = os.path.join(REPO, "data", "nsw15-demo.json")

#: measured 2026-11-04 on this machine from the committed caches; a drift
#: past any of these is a guard trip, never a silent re-derive
BCP_NSW_ROWS = 17895
NSW_SENTINEL_PERSONS_2011 = 13030
NSW_PERSONS_ANCHOR_2011 = 6917658   # ABS 2011 census, New South Wales
NSW_PERSONS_TOL = 1000

DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
BCP_B45B_OCCS = ["P_Tot_Managers", "P_Tot_Professionals",
                 "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
                 "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
                 "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
# the curated birthplace-country set the GCP-era stores carry as
# COB_KEYS, minus eng/sct: B09 merges the whole UK into one
# UK_Channel_Islands_Isle_Man row, so only these eight are readable —
# derive-booth-demo-2013.py's COB_KEYS8, in the same site-key order
COB_KEYS = ["ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"]
BCP_B09_COB_COLS = ["India_P", "China_excl_SARs_Taiwan_P",
                    "New_Zealand_P", "Philippines_P", "Vietnam_P",
                    "South_Africa_P", "Italy_P", "Sri_Lanka_P"]
# B09's column order: Australia, not-stated, total, then the eight
# countries in COB_KEYS order (the 2013 store's B09_COLS, verified
# against the pack's header 2026-11-04)
BCP_B09_COLS = ["Australia_P", "Country_birth_not_stated_P", "Tot_P"] + \
               BCP_B09_COB_COLS
BCP_B40B_COLS = ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
                 "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]
MEMBER = V["member"].format   # 2011 Census BCP .../2011Census_{t}_AUST_SA1_short.csv


def fail(msg):
    raise SystemExit(f"nsw15-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# --------------------------------------------------------------- BCP (NSW rows)
def load_bcp_nsw():
    """The BCP-era base tables on the NSW prefix: 2011 Census BCP SA1
    pack, NSW rows only (region_id codes start "1"). Column spellings
    verified from the zip's own headers 2026-11-04."""
    if not os.path.exists(BCP_ZIP):
        fail(f"missing BCP input {BCP_ZIP} (see docstring)")
    # B01's language pair carries the same spelling the GCP-era packs
    # print from 2016 (the 2021 Lang_used_home_* rename had not happened)
    lang_cols = ("Lang_spoken_home_Eng_only_P", "Lang_spoken_home_Oth_Lang_P")
    agecols = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
    want = [BCP_KEY, "Tot_P_P", *lang_cols, *agecols]
    z = zipfile.ZipFile(BCP_ZIP)
    member = MEMBER(table="B01")
    if member not in z.namelist():
        fail(f"BCP zip lacks {member}")
    base = {}
    n = 0
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"BCP B01 header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row[BCP_KEY]
            if not code.startswith("1"):
                continue
            if code in base:
                fail(f"BCP B01 dup NSW code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row[lang_cols[0]]),
                          int(row[lang_cols[1]]),
                          tuple(int(row[c]) for c in agecols))
    if n != BCP_ROWS:
        fail(f"BCP B01 rows {n} != pin {BCP_ROWS}")
    if len(base) != BCP_NSW_ROWS:
        fail(f"BCP NSW rows {len(base)} != pin {BCP_NSW_ROWS}")
    persons = sum(r[0] for r in base.values())
    if abs(persons - NSW_PERSONS_ANCHOR_2011) > NSW_PERSONS_TOL:
        fail(f"BCP NSW persons {persons} drifted past ±{NSW_PERSONS_TOL} of "
             f"2011 census New South Wales {NSW_PERSONS_ANCHOR_2011}")
    print(f"BCP B01 NSW: {len(base)} SA1s, {persons} persons "
          f"(anchor {NSW_PERSONS_ANCHOR_2011}, delta {persons - NSW_PERSONS_ANCHOR_2011})")

    extra = {}
    for tag, member_t, cols in (
        ("B09", MEMBER(table="B09"), BCP_B09_COLS),
        ("B40B", MEMBER(table="B40B"), BCP_B40B_COLS),
        ("B45B", MEMBER(table="B45B"), BCP_B45B_OCCS),
    ):
        if member_t not in z.namelist():
            fail(f"BCP zip lacks {member_t}")
        d = {}
        m = 0
        with io.TextIOWrapper(z.open(member_t), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in [BCP_KEY, *cols]
                    if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"BCP {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row[BCP_KEY]
                if not code.startswith("1"):
                    continue
                if code in d:
                    fail(f"BCP {tag} dup NSW code {code}")
                d[code] = tuple(int(row[c]) for c in cols)
        if m != BCP_ROWS:
            fail(f"BCP {tag} rows {m} != pin {BCP_ROWS}")
        if len(d) != len(base):
            fail(f"BCP {tag}: {len(d)} NSW rows != B01's {len(base)}")
        extra[tag] = d
        print(f"BCP {tag} NSW: {len(d)} SA1s")

    out = {}
    for code, r in base.items():
        b09 = extra["B09"].get(code)
        b40 = extra["B40B"].get(code)
        b45 = extra["B45B"].get(code)
        if b09 is None or b40 is None or b45 is None:
            fail(f"BCP SA1 set mismatch at {code}")
        # the eight-country cob tuple, in COB_KEYS order (B09's column
        # order after the Australia/not-stated/total lead — pinned above)
        cob = tuple(b09[3:])
        out[code] = r + (b09[0], b09[2], b09[1],
                         b40[0] + b40[1] + b40[2], b40[3],
                         b45[2] + b45[6] + b45[7], sum(b45)) + (cob,)
    print(f"BCP demo NSW: {len(out)} rows, persons {persons}")
    return out, persons


# ------------------------------------------------------------------ assemble
def main():
    bcp, nsw_persons = load_bcp_nsw()
    nlt = gcp_newlanes.load(BCP_ZIP, prefix="1", era="2011")
    arc = gcp_newlanes.load_arc31(BCP_ZIP, prefix="1", era="2011")
    inc, _inc_cutrec = gcp_newlanes.state_income_bcp(BCP_ZIP, "1")
    HL = gcp_newlanes.hl_alloc_of(2011, "c7")
    assign = load_assign_map(YEAR)
    sent = NSW_SENTINELS[YEAR]

    # every BCP NSW row is either in the join or a sentinel; the join's
    # SA1 set and the BCP set must agree exactly
    missing = set(bcp) - sent - set(assign)
    extra = set(assign) - set(bcp)
    if missing:
        fail(f"BCP SA1s outside the join: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"join SA1s without a BCP row: {sorted(extra)[:5]} ({len(extra)})")

    # sentinel persons are the only NSW census persons not joined
    sentinel_persons = sum(bcp[c][0] for c in sent)
    if sentinel_persons != NSW_SENTINEL_PERSONS_2011:
        fail(f"sentinel SA1 persons {sentinel_persons} != pin "
             f"{NSW_SENTINEL_PERSONS_2011}")
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
                                  "incBandH": [0] * len(gcp_newlanes.INC_BANDS14),
                                  "hlE": 0.0})
        r = bcp[code]
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
        for ii in range(len(gcp_newlanes.INC_BANDS14)):
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
            med = gcp_newlanes.band_median(a["incBandH"], gcp_newlanes.INC_BANDS14)
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
              "incBandH": [0] * len(gcp_newlanes.INC_BANDS14),
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
        fail(f"partition drift: districts {state['p']} + sentinels {sentinel_persons} != BCP NSW {nsw_persons}")
    print("state:", {**st_shares, "persons": state["p"], "sa1": state["n"]})

    out = {
        "year": "nsw15",
        "jurisdiction": "NSW",
        "date": "2015-03-28",
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
            "gcp": {"path": os.path.relpath(BCP_ZIP, REPO), "sha16": hash16(BCP_ZIP),
                    "members": ["B01", "B07", "B08A", "B08B", "B09", "B14",
                                "B24", "B25", "B26", "B28", "B32",
                                "B40B", "B45B", "B46"]},
            "sa1Shp": {"path": os.path.relpath(V["shp"], REPO), "sha16": hash16(V["shp"])},
            "assignMap": {"path": os.path.relpath(V["assign"], REPO), "sha16": hash16(V["assign"])},
            "gcpRows": BCP_ROWS,
        },
        "about": ("2011 Census BCP B01/B07/B08A/B08B/B09/B14/B24/B25/B26/B28/B32/B40B/B45B/B46 SA1 tables "
                  "(the Basic Community Profile, the GCP's pre-2016 form), pooled to New "
                  "South Wales's 93 state electoral districts for the 28 March 2015 election "
                  "(the 2013 redistribution's boundaries — nsw15 and nsw19 share the district "
                  "set, the census edition differs). Each SA1 counts whole to the district its "
                  "polygon centroid lies in (boundary SA1s are not split; the state total is "
                  "never moved; the SA1→district assignment is the join cache .build/map/"
                  "nsw13/assign-sa1-2011.json, the same one the SEIFA lanes pool over). Bases "
                  "match the federal stores (ex-not-stated): language other than English over "
                  "English-only+other stated; age shares renormalised over B01's 11 bands "
                  "(which exclude age-not-stated); overseas-born over country-stated, and "
                  "the birthplace-country shares (cob, order in cobKeys) riding the same "
                  "country-stated basis — the BCP's B09 table merges the UK's countries, so "
                  "the lane carries the eight-country readable set (England and Scotland are "
                  "not separately readable in 2011); "
                  "university (bachelor and above) over the B01 aged-15+ population less "
                  "level-of-education-not-stated; blue-collar (trades, machinery operators "
                  "and drivers, labourers) over the eight stated ANZSCO groups; the new "
                  "lane set mirrors the federal stores (year-12-or-less over B01's six "
                  "printed stated schooling levels; B07 Tot-row Indigenous/ "
                  "Indigenous-plus-non-Indigenous; B14's Religion menu ten shares (rel, "
                  "key order in relKeys) over the ex-affiliation-not-stated persons basis; "
                  "B32's Housing-tenure menu four shares (ten, key order in tenKeys) over "
                  "the ex-tenure-not-stated occupied-private-dwellings basis; B25's "
                  "one-parent lane (persons in one-parent families over persons in "
                  "families — the BCP prints it on a persons basis); the under-15 share of "
                  "the stated ages). "
                  "Income lanes are the 2011 edition's 14-band grid in 2011 dollars, the "
                  "state-universe quantile cuts New South Wales's own. p is census "
                  "persons; n the SA1 count. The four NSW sentinel SA1s (migratory/offshore) "
                  "carry no polygon and sit outside the join, holding "
                  f"{sentinel_persons} persons statewide."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")


main()
