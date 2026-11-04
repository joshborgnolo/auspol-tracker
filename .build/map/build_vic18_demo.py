#!/usr/bin/env python3
"""data/vic18-demo.json — per-district 2016-census people figures for
Victoria's 2018 state election map (the vic18 frame on /map/).

The build_vic22_demo.py recipe, verbatim, on the 2016 census vintage
over the SAME 88 districts (the 2013 redistribution's boundaries serve
both vic14 and vic18; the census edition moves, 2016 here): the VEC
publishes district totals but no voter footprint, so each district's
figures pool directly from the ABS 2016 Census GCP SA1 tables, at the
same ex-not-stated bases as .build/analysis/seat-model/derive-booth-
seifa-voter.py (the G01/G09F/G09H/G46B/G57B member and column choices
are the qld17 frame's identical, so a federal figure and a vic18
figure are commensurate).

Method: every SA1 counts whole to the district its own polygon
representative point lies in (vic13_geo.assign_sa1(2016)) — boundary-
straddling SA1s land where their centre of population sits, not by
area; the state total never moves (every Vic SA1 counts to exactly one
district). The four Vic sentinel SA1s (migratory/offshore) carry no
polygon and sit outside the join.

Inputs (all caches already ride this repo's other pipelines):
  .build/map/src/n-vic18.geojson                          (88 districts, the 2013 set)
  .build/analysis/seat-model/cache/gcp-sa1-2016.zip       (GCP 2016 SA1 datapack)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2016_aust_shape.zip (SA1 2016 polygons)

Deps: python3 stdlib only. Guards fail loud.
usage: python3 -I .build/map/build_vic18_demo.py
then:  python3 .build/map/build_vic18_seifa.py   (no -I: xlrd is user-site)
"""
import csv
import hashlib
import io
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vic13_geo import (DIST_GEOJSON, VINTAGES, VIC_SENTINELS, assign_sa1,  # noqa: E402
                       load_districts, read_sa1_polygons, write_assign_map)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
YEAR = 2016
V = VINTAGES[YEAR]
GCP_ZIP = V["gcp"]
GCP_KEY = V["gcp_key"]          # SA1_7DIGITCODE_2016
GCP_ROWS = V["gcp_rows"]        # 57,523 national
OUT = os.path.join(REPO, "data", "vic18-demo.json")

#: measured 2026-11-04 on this machine from the committed caches; a drift
#: past any of these is a guard trip, never a silent re-derive
GCP_VIC_ROWS = 14073
VIC_SENTINEL_PERSONS_2016 = 7592
VIC_PERSONS_ANCHOR_2016 = 5926624   # ABS 2016 census, Victoria
VIC_PERSONS_TOL = 5000

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


def fail(msg):
    raise SystemExit(f"vic18-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# --------------------------------------------------------------- GCP (Vic rows)
def load_gcp_vic():
    """qld17's table/column map on the Vic prefix: 2016 GCP SA1 pack,
    Vic rows only (SA1 codes start "2"). Column spellings verified from
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
            if not code.startswith("2"):
                continue
            if code in base:
                fail(f"GCP G01 dup Vic code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row[lang_cols[0]]),
                          int(row[lang_cols[1]]),
                          tuple(int(row[c]) for c in agecols))
    if n != GCP_ROWS:
        fail(f"GCP G01 rows {n} != pin {GCP_ROWS}")
    if len(base) != GCP_VIC_ROWS:
        fail(f"GCP Vic rows {len(base)} != pin {GCP_VIC_ROWS}")
    persons = sum(r[0] for r in base.values())
    if abs(persons - VIC_PERSONS_ANCHOR_2016) > VIC_PERSONS_TOL:
        fail(f"GCP Vic persons {persons} drifted past ±{VIC_PERSONS_TOL} of "
             f"2016 census Victoria {VIC_PERSONS_ANCHOR_2016}")
    print(f"GCP G01 Vic: {len(base)} SA1s, {persons} persons "
          f"(anchor {VIC_PERSONS_ANCHOR_2016}, delta {persons - VIC_PERSONS_ANCHOR_2016})")

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
    print(f"GCP demo Vic: {len(out)} rows, persons {persons}")
    return out, persons


# ------------------------------------------------------------------ assemble
def main():
    gcp, vic_persons = load_gcp_vic()
    nlt = gcp_newlanes.load(GCP_ZIP, prefix="2", era="2016")
    arc = gcp_newlanes.load_arc31(GCP_ZIP, prefix="2", era="2016")
    inc, _inc_cutrec = gcp_newlanes.state_income(GCP_ZIP, "2016", "2")
    HL = gcp_newlanes.hl_alloc_of(2016, "c7")
    sa1 = read_sa1_polygons(YEAR)
    districts, order = load_districts()

    # every GCP Vic row must have a polygon (minus the null sentinels) and
    # every polygon a GCP row
    sent = VIC_SENTINELS[YEAR]
    missing = set(gcp) - sent - set(sa1)
    extra = set(sa1) - set(gcp)
    if missing:
        fail(f"GCP SA1s without a polygon: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"SA1 polygons without a GCP row: {sorted(extra)[:5]} ({len(extra)})")

    assign = assign_sa1(YEAR)

    # hand the join to the map's cache: the SEIFA pipeline computes its own
    # per-SA1 pools against the SAME assignment, never a re-derived one
    write_assign_map(YEAR, assign)

    # sentinel persons are the only Vic census persons not joined
    sentinel_persons = sum(gcp[c][0] for c in sent)
    if sentinel_persons != VIC_SENTINEL_PERSONS_2016:
        fail(f"sentinel SA1 persons {sentinel_persons} != pin "
             f"{VIC_SENTINEL_PERSONS_2016}")
    print(f"sentinel SA1s: {len(sent)}, {sentinel_persons} persons")

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
                                  "tenN": [0] * 6, "famN": 0, "famD": 0,
                                  "citz": 0, "ptn": 0, "ptt": 0, "ptns": 0,
                                  "ceb3": 0, "cebns": 0, "cebt": 0,
                                  "ancN": [0] * len(gcp_newlanes.ANC_KEYS),
                                  "ancP": 0, "ancNS": 0,
                                  "incAud": 0.0, "incLo": 0.0, "incHi": 0.0, "incHiQ": 0.0, "incBandH": [0] * len(gcp_newlanes.INC_BANDS),
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
    if state["p"] + sentinel_persons != vic_persons:
        fail(f"partition drift: districts {state['p']} + sentinels {sentinel_persons} != GCP Vic {vic_persons}")
    print("state:", {**st_shares, "persons": state["p"], "sa1": state["n"]})

    out = {
        "year": "vic18",
        "jurisdiction": "VIC",
        "date": "2018-11-24",
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
            "gcpRows": GCP_ROWS,
        },
        "about": ("2016 Census GCP G01/G07/G08/G09F/G09G/G09H/G14/G24/G28/G29/G33/G46B/G57B/G59 SA1 tables, pooled to Victoria's "
                  "88 state electoral districts for the 24 November 2018 election (the 2013 "
                  "redistribution's boundaries — vic18 shares vic14's district set, the census "
                  "edition moved). Each SA1 counts whole to the district its "
                  "polygon representative point lies in (boundary SA1s are not split; the "
                  "state total is never moved). Bases match the federal stores (ex-not-"
                  "stated): language other than English over English-only+other stated; age "
                  "shares renormalised over G01's 11 bands (which exclude age-not-stated); "
                  "overseas-born over country-stated, and the ten curated birthplace-country "
                  "shares (cob, order in cobKeys) riding that same basis; "
                  "university (bachelor and above) over "
                  "the G01 aged-15+ population less level-of-education-not-stated; blue-"
                  "collar (trades, machinery operators and drivers, labourers) over the "
                  "eight stated ANZSCO groups; the new lane set mirrors the federal stores (year-12-or-less over G01's six printed stated schooling levels; G07 Tot-row Indigenous/ Indigenous-plus-non-Indigenous; G14's Religion menu ten shares (rel, key order in relKeys) over the ex-affiliation-not-stated persons basis; G33's Housing-tenure menu four shares (ten, key order in tenKeys) over the ex-tenure-not-stated occupied-private-dwellings basis; G28's one-parent share of families; the under-15 share of the stated ages). Income lanes are the 2016 edition's 16-band grid in 2016 dollars, the state-universe quantile cuts Victoria's own. p is census persons; n the SA1 count. The "
                  "four Vic sentinel SA1s (migratory/offshore) carry no polygon and sit "
                  f"outside the join, holding {sentinel_persons} persons statewide."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")


main()
