#!/usr/bin/env python3
"""data/vic22-demo.json — per-district 2021-census people figures for
Victoria's 2022 state election map (the vic22 frame on /map/).

The sa26 sibling's recipe, verbatim, on the eighty-eight-district Victorian
dataset: the VEC publishes district totals and voting-centre primary rows
(its "Results by Voting Centre" XLS mirror in .build/map/src/vic22/xls/) but
no voter footprint, so each district's figures pool directly from the ABS
2021 Census GCP SA1 tables, at the same ex-not-stated bases as
.build/analysis/seat-model/derive-booth-seifa-voter.py (the G01/G09F/G09H/
G49B/G60B member and column choices are identical, so a federal figure and
a vic22 figure are commensurate).

Method: every SA1 counts whole to the district its own polygon
representative point lies in (vic22_geo.assign_sa1) — boundary-straddling
SA1s land where their centre of population sits, not by area; the state
total never moves (every Vic SA1 counts to exactly one district). The four
Vic sentinel SA1s (migratory/offshore) carry no polygon and sit outside the
join.

Inputs (both zips are the voter-footprint/sa1 pipeline's, git-ignored):
  .build/map/src/vic22/n-vic22.geojson                      (88 districts, GDA2020)
  .build/analysis/seat-model/cache/gcp-sa1-2021.zip         (GCP 2021 SA1 datapack)
  .build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip (SA1 2021 polygons)

Re-fetch manifest when a cache is missing:
  GCP zip:   https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SA1_for_AUS_short-header.zip
  SA1 zip:   https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files/SA1_2021_AUST_SHP_GDA2020.zip
  districts: opendata.maps.vic.gov.au WFS, layer open-data-platform:state_assembly_2022

Deps: python3 stdlib only. Guards fail loud.
usage: python3 -I .build/map/build_vic22_demo.py
then:  python3 -I .build/map/build_vic22_seifa.py
then:  python3 -I .build/map/build_vic22_data.py .build/map/vic22
then:  python3 .build/map/build_vic22_boothcensus.py
then:  python3 -I .build/map/build_vic22_past.py .build/map/vic22
then:  node .build/map/geo_build.mjs .build/map/src/vic22 .build/map/vic22 map/data --years=vic22
"""
import csv
import hashlib
import io
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vic22_geo import (DIST_GEOJSON, SA1_ZIP, VIC_SENTINELS, assign_sa1,  # noqa: E402
                       load_districts, read_sa1_polygons, write_assign_map,
                       GCP_ROWS, GCP_VIC_ROWS, VIC_PERSONS_MIN, VIC_PERSONS_MAX)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GCP_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "gcp-sa1-2021.zip")
OUT = os.path.join(REPO, "data", "vic22-demo.json")

GCP_MEMBER = "2021 Census GCP Statistical Area 1 for AUS/2021Census_G01_AUST_SA1.csv"

DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
GCP_G60B_OCCS = ["P_Tot_Managers", "P_Tot_Professionals",
                 "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
                 "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
                 "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
# the G09 top-country columns surfaced on /map/ as birthplace sub-views
# (the federal stores' COB_KEYS — site-key order, 2021 national shares)
COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita",
            "lka", "sct"]
GCP_G09F_COLS = ["P_Australia_Tot", "P_England_Tot", "P_China_Tot"]
GCP_G09G_COLS = ["P_India_Tot", "P_New_Zealand_Tot", "P_Italy_Tot"]
GCP_G09H_COLS = ["P_Tot_Tot", "P_COB_NS_Tot", "P_Philippines_Tot",
                 "P_Vietnam_Tot", "P_South_Africa_Tot", "P_Scotland_Tot",
                 "P_Sri_Lanka_Tot"]


def fail(msg):
    raise SystemExit(f"vic22-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# --------------------------------------------------------------- GCP (Vic rows)
def load_gcp_vic():
    """Same table/column map as derive-booth-seifa-voter.py load_gcp21,
    Vic rows only (SA1 codes start "2")."""
    if not os.path.exists(GCP_ZIP):
        fail(f"missing GCP input {GCP_ZIP} (see docstring refetch)")
    agecols = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
    want = ["SA1_CODE_2021", "Tot_P_P", "Lang_used_home_Eng_only_P",
            "Lang_used_home_Oth_Lang_P", *agecols]
    base = {}
    n = 0
    z = zipfile.ZipFile(GCP_ZIP)
    with io.TextIOWrapper(z.open(GCP_MEMBER), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"GCP G01 header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row["SA1_CODE_2021"]
            if not code.startswith("2"):
                continue
            if code in base:
                fail(f"GCP G01 dup Vic code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row["Lang_used_home_Eng_only_P"]),
                          int(row["Lang_used_home_Oth_Lang_P"]),
                          tuple(int(row[c]) for c in agecols))
    if n != GCP_ROWS:
        fail(f"GCP G01 rows {n} != pin {GCP_ROWS}")
    if len(base) != GCP_VIC_ROWS:
        fail(f"GCP Vic rows {len(base)} != pin {GCP_VIC_ROWS}")
    persons = sum(r[0] for r in base.values())
    if not (VIC_PERSONS_MIN <= persons <= VIC_PERSONS_MAX):
        fail(f"GCP Vic persons {persons} outside {VIC_PERSONS_MIN}..{VIC_PERSONS_MAX}")
    print(f"GCP G01 Vic: {len(base)} SA1s, {persons} persons")

    extra = {}
    for tag, member, cols in (
        ("G09F", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G09F_AUST_SA1.csv",
         GCP_G09F_COLS),
        ("G09G", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G09G_AUST_SA1.csv",
         GCP_G09G_COLS),
        ("G09H", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G09H_AUST_SA1.csv",
         GCP_G09H_COLS),
        ("G49B", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G49B_AUST_SA1.csv",
         ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
          "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]),
        ("G60B", "2021 Census GCP Statistical Area 1 for AUS/2021Census_G60B_AUST_SA1.csv",
         GCP_G60B_OCCS),
    ):
        if member not in z.namelist():
            fail(f"GCP zip lacks {member}")
        d = {}
        m = 0
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in ["SA1_CODE_2021", *cols]
                    if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"GCP {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row["SA1_CODE_2021"]
                if not code.startswith("2"):
                    continue
                if code in d:
                    fail(f"GCP {tag} dup Vic code {code}")
                d[code] = tuple(int(row[c]) for c in cols)
        if m != GCP_ROWS:
            fail(f"GCP {tag} rows {m} != pin {GCP_ROWS}")
        if len(d) != len(base):
            fail(f"GCP {tag}: {len(d)} Vic rows != G01's {len(base)}")
        extra[tag] = d
        print(f"GCP {tag} Vic: {len(d)} SA1s")

    out = {}
    for code, r in base.items():
        f09 = extra["G09F"].get(code)
        g09 = extra["G09G"].get(code)
        h09 = extra["G09H"].get(code)
        e49 = extra["G49B"].get(code)
        o60 = extra["G60B"].get(code)
        if f09 is None or g09 is None or h09 is None or e49 is None \
                or o60 is None:
            fail(f"GCP SA1 set mismatch at {code}")
        # the ten-country cob tuple, in COB_KEYS order, indexed on the
        # GCP_G09{F,G,H}_COLS orders above
        cob = (f09[1], g09[0], f09[2], g09[1], h09[2], h09[3], h09[4],
               g09[2], h09[6], h09[5])
        out[code] = r + (f09[0], h09[0], h09[1],
                         e49[0] + e49[1] + e49[2], e49[3],
                         o60[2] + o60[6] + o60[7], sum(o60)) + (cob,)
    print(f"GCP demo Vic: {len(out)} rows, persons {persons}")
    return out, persons



# ------------------------------------------------------------------ assemble
def main():
    gcp, vic_persons = load_gcp_vic()
    nlt = gcp_newlanes.load(GCP_ZIP, prefix="2")
    sa1 = read_sa1_polygons()
    districts, order = load_districts()

    # every GCP Vic row must have a polygon (minus the null sentinels) and
    # every polygon a GCP row
    missing = set(gcp) - VIC_SENTINELS - set(sa1)
    extra = set(sa1) - set(gcp)
    if missing:
        fail(f"GCP SA1s without a polygon: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"SA1 polygons without a GCP row: {sorted(extra)[:5]} ({len(extra)})")

    assign = assign_sa1(sa1, districts)

    # hand the join to the map's cache: the SEIFA pipeline computes its own
    # per-SA1 pools against the SAME assignment, never a re-derived one
    write_assign_map(assign)

    # sentinel persons are the only Vic census persons not joined
    sentinel_persons = sum(gcp[c][0] for c in VIC_SENTINELS)
    if sentinel_persons <= 0 or sentinel_persons > 20000:
        fail(f"unjoined sentinel SA1 persons {sentinel_persons} out of band")
    print(f"sentinel SA1s: {len(VIC_SENTINELS)}, {sentinel_persons} persons")

    # pool
    acc = {}
    for code, dist in assign.items():
        a = acc.setdefault(dist, {"p": 0, "eng": 0, "oth": 0, "aust": 0,
                                  "tot": 0, "cobns": 0, "uni": 0, "eduns": 0,
                                  "pop15": 0, "blue": 0, "occd": 0,
                                  "cobN": [0] * len(COB_KEYS),
                                  "bands": [0] * len(DEMO_BANDS), "n": 0, "ylN": 0, "ylD": 0, "atN": 0, "atD": 0,
                                  "relN": [0] * len(gcp_newlanes.REL_KEYS),
                                  "relNS": 0, "relTot": 0,
                                  "tenN": [0] * 6, "famN": 0, "famD": 0})
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
    for dist, _bb, _polys in districts:
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
        }
        return s, None

    demo = {}
    for dist, _bb, _polys in districts:
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
              "famN": 0, "famD": 0}
    for a in acc.values():
        for k2, v2 in a.items():
            if k2 == "bands":
                for i in range(len(DEMO_BANDS)):
                    st_acc["bands"][i] += v2[i]
            elif k2 in ("cobN", "relN", "tenN"):
                for i in range(len(v2)):
                    st_acc[k2][i] += v2[i]
            else:
                st_acc[k2] += v2
    st_shares, why = shares(st_acc)
    if st_shares is None:
        fail(f"state: zero denominator on {why}")
    if state["p"] + sentinel_persons != vic_persons:
        fail(f"partition drift: districts {state['p']} + sentinels {sentinel_persons} != GCP Vic {vic_persons}")
    print("state:", {**st_shares, "persons": state["p"], "sa1": state["n"]})

    out = {
        "year": "vic22",
        "jurisdiction": "VIC",
        "date": "2022-11-26",
        "demoBasis": "sa1",
        "cobKeys": COB_KEYS,
        "relKeys": list(gcp_newlanes.REL_KEYS),
        "tenKeys": ["mort", "rent", "own", "rentPub"],
        "demo": {n: demo[n] for n in order},
        "state": {**st_shares, "persons": state["p"], "sa1": state["n"],
                  "sentinelSa1": len(VIC_SENTINELS), "sentinelPersons": sentinel_persons},
        "src": {
            "districtGeojson": {"path": os.path.relpath(DIST_GEOJSON, REPO), "sha16": hash16(DIST_GEOJSON)},
            "gcp": {"path": os.path.relpath(GCP_ZIP, REPO), "sha16": hash16(GCP_ZIP),
                    "members": ["G01", "G07", "G09F", "G09G", "G09H", "G14",
                                "G32", "G37", "G49B", "G60B"]},
            "sa1Shp": {"path": os.path.relpath(SA1_ZIP, REPO), "sha16": hash16(SA1_ZIP)},
            "gcpRows": GCP_ROWS,
        },
        "about": ("2021 Census GCP G01/G07/G09F/G09G/G09H/G14/G32/G37/G49B/G60B SA1 tables, pooled to Victoria's "
                  "88 state electoral districts for the 26 November 2022 election (the 2021 "
                  "redistribution's boundaries). Each SA1 counts whole to the district its "
                  "polygon representative point lies in (boundary SA1s are not split; the "
                  "state total is never moved). Bases match the federal stores (ex-not-"
                  "stated): language other than English over English-only+other stated; age "
                  "shares renormalised over G01's 11 bands (which exclude age-not-stated); "
                  "overseas-born over country-stated, and the ten curated birthplace-country "
                  "shares (cob, order in cobKeys) riding that same basis; "
                  "university (bachelor and above) over "
                  "the G01 aged-15+ population less level-of-education-not-stated; blue-"
                  "collar (trades, machinery operators and drivers, labourers) over the "
                  "eight stated ANZSCO groups; the new lane set mirrors the federal stores (year-12-or-less over G01's six printed stated schooling levels; G07 Tot-row Indigenous/ Indigenous-plus-non-Indigenous; G14's Religion menu ten shares (rel, key order in relKeys) over the ex-affiliation-not-stated persons basis; G37's Housing-tenure menu four shares (ten, key order in tenKeys) over the ex-tenure-not-stated occupied-private-dwellings basis; G32's one-parent share of families; the under-15 share of the stated ages). p is census persons; n the SA1 count. The "
                  "four Vic sentinel SA1s (migratory/offshore) carry no polygon and sit "
                  f"outside the join, holding {sentinel_persons} persons statewide."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")


main()
