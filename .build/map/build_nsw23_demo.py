#!/usr/bin/env python3
"""data/nsw23-demo.json — per-district 2021-census people figures for the NSW
2023 state election map (the nsw23 frame on /map/).

The build_sa26_demo.py discipline on New South Wales's 93 districts: the
federal seats' census lanes ride booth-level voter-footprint stores, but the
NSWEC's 2023 results carry no voter join, so each district's figures are
pooled directly from the ABS 2021 Census GCP SA1 tables at the same
ex-not-stated bases as .build/analysis/seat-model/derive-booth-seifa-voter.py
(the G01/G09F/G09H/G49B/G60B member and column choices are identical, so a
federal figure and an nsw23 figure are commensurate).

Method: every SA1 entirely inside a district would be exact; to avoid
partial SA1 splits the assignment is by the SA1's own polygon CENTROID —
the SA1 counts to the district its centroid lies in, whole. The join is
computed once by nsw23_geo.py and committed as
.build/map/nsw23/assign-sa1.json; this script rides that cache (it never
re-derives the join, so a district's people figures and its SEIFA scores
always cover the same geography).

Inputs (the two zip caches ride the seat-model pipeline, git-ignored; the
district geojson is the frame's own boundary source, kept out of the repo
for size like the federal n-YYYY.geojson era files):
  .build/map/src/nsw23/n-nsw23.geojson                      (93 districts, 2021 redistribution)
  .build/analysis/seat-model/cache/gcp-sa1-2021.zip         (GCP 2021 SA1 datapack)
  .build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip (SA1 2021 polygons)
  .build/map/nsw23/assign-sa1.json                          (nsw23_geo.py's join cache)

Re-fetch manifest when a cache is missing:
  GCP zip:   https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SA1_for_AUS_short-header.zip
  SA1 zip:   https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files/SA1_2021_AUST_SHP_GDA2020.zip

Deps: python3 stdlib only. Guards fail loud.
usage: python3 -I .build/map/build_nsw23_demo.py
then:  python3 -I .build/map/build_nsw23_data.py map/data
"""
import csv
import hashlib
import io
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nsw23_geo import (ASSIGN_MAP, DIST_GEOJSON, SA1_ZIP, NSW_SENTINELS,  # noqa: E402
                       EXPECTED_NAMES, load_assign_map)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GCP_ZIP = os.path.join(REPO, ".build", "analysis", "seat-model", "cache", "gcp-sa1-2021.zip")
OUT = os.path.join(REPO, "data", "nsw23-demo.json")

GCP_MEMBER = "2021 Census GCP Statistical Area 1 for AUS/2021Census_G01_AUST_SA1.csv"
GCP_ROWS = 61844
GCP_NSW_ROWS = 19750
GCP_NSW_PERSONS_MIN, GCP_NSW_PERSONS_MAX = 7_900_000, 8_300_000
# GCP 2021 tallies 11,371 persons in NSW's migratory/offshore SA1s (people
# at sea on census night) — they carry no polygon and sit outside the join
NSW_SENTINEL_PERSONS = 11371

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
    raise SystemExit(f"nsw23-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# ---------------------------------------------------------------- GCP (NSW rows)
def load_gcp_nsw():
    """Same table/column map as derive-booth-seifa-voter.py load_gcp21,
    NSW rows only (SA1 codes start "1")."""
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
            if not code.startswith("1"):
                continue
            if code in base:
                fail(f"GCP G01 dup NSW code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row["Lang_used_home_Eng_only_P"]),
                          int(row["Lang_used_home_Oth_Lang_P"]),
                          tuple(int(row[c]) for c in agecols))
    if n != GCP_ROWS:
        fail(f"GCP G01 rows {n} != pin {GCP_ROWS}")
    if len(base) != GCP_NSW_ROWS:
        fail(f"GCP NSW rows {len(base)} != pin {GCP_NSW_ROWS}")
    persons = sum(r[0] for r in base.values())
    if not (GCP_NSW_PERSONS_MIN <= persons <= GCP_NSW_PERSONS_MAX):
        fail(f"GCP NSW persons {persons} outside {GCP_NSW_PERSONS_MIN}..{GCP_NSW_PERSONS_MAX}")
    print(f"GCP G01 NSW: {len(base)} SA1s, {persons} persons")

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
    print(f"GCP demo NSW: {len(out)} rows, persons {persons}")
    return out, persons


# ------------------------------------------------------------------ assemble
def main():
    gcp, nsw_persons = load_gcp_nsw()
    nlt = gcp_newlanes.load(GCP_ZIP, prefix="1")
    assign = load_assign_map()

    # every GCP NSW row is either in the join or a sentinel; the join's SA1
    # set and the GCP set must agree exactly
    missing = set(gcp) - NSW_SENTINELS - set(assign)
    extra = set(assign) - set(gcp)
    if missing:
        fail(f"GCP SA1s outside the join: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"join SA1s without a GCP row: {sorted(extra)[:5]} ({len(extra)})")

    # sentinel persons are the only NSW census persons not joined
    sentinel_persons = sum(gcp[c][0] for c in NSW_SENTINELS)
    if sentinel_persons != NSW_SENTINEL_PERSONS:
        fail(f"unjoined sentinel SA1 persons {sentinel_persons} != pin {NSW_SENTINEL_PERSONS}")

    order = list(EXPECTED_NAMES)

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
        }
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
              "famN": 0, "famD": 0}
    for a in acc.values():
        for k2, v2 in a.items():
            if k2 == "bands":
                for i in range(len(DEMO_BANDS)):
                    st_acc["bands"][i] += v2[i]
            elif k2 in ("cobN", "relN", "tenN", "cobN"):
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
        "year": "nsw23",
        "jurisdiction": "NSW",
        "date": "2023-03-25",
        "demoBasis": "sa1",
        "cobKeys": COB_KEYS,
        "relKeys": list(gcp_newlanes.REL_KEYS),
        "tenKeys": ["mort", "rent", "own", "rentPub"],
        "demo": {n: demo[n] for n in order},
        "state": {**st_shares, "persons": state["p"], "sa1": state["n"],
                  "sentinelSa1": len(NSW_SENTINELS), "sentinelPersons": sentinel_persons},
        "src": {
            "districtGeojson": {"path": os.path.relpath(DIST_GEOJSON, REPO), "sha16": hash16(DIST_GEOJSON)},
            "gcp": {"path": os.path.relpath(GCP_ZIP, REPO), "sha16": hash16(GCP_ZIP),
                    "members": ["G01", "G07", "G09F", "G09G", "G09H", "G14",
                                "G32", "G37", "G49B", "G60B"]},
            "sa1Shp": {"path": os.path.relpath(SA1_ZIP, REPO), "sha16": hash16(SA1_ZIP)},
            "assignMap": {"path": os.path.relpath(ASSIGN_MAP, REPO), "sha16": hash16(ASSIGN_MAP)},
            "gcpRows": GCP_ROWS,
        },
        "about": ("2021 Census GCP G01/G07/G09F/G09G/G09H/G14/G32/G37/G49B/G60B SA1 tables, pooled to New South "
                  "Wales's 93 state electoral districts for the 25 March 2023 election. "
                  "Each SA1 counts whole to the district its polygon centroid lies in "
                  "(boundary SA1s are not split; the state total is never moved). Bases match "
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
                  "G37's Housing-tenure menu four shares (ten, key order in tenKeys) over "
                  "the ex-tenure-not-stated occupied-private-dwellings basis; G32's "
                  "one-parent share of families; the under-15 share of the stated ages). "
                  "p is census "
                  "persons; n the SA1 count. The four NSW sentinel SA1s (migratory/offshore) "
                  "carry no polygon and sit outside the join, holding "
                  f"{sentinel_persons} persons statewide."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")


main()
