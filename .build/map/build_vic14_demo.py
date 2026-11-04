#!/usr/bin/env python3
"""data/vic14-demo.json — per-district 2011-census people figures for
Victoria's 2014 state election map (the vic14 frame on /map/).

The build_vic22_demo.py recipe's deepest census vintage: 2011 predates
the GCP series, so this rides the 2011 Census Basic Community Profile —
the GCP's own pre-2016 form — pooled the exact same way over the SAME
88 districts (the 2013 redistribution's boundaries serve both vic14
and vic18; the census edition moves, 2011 here). Table/column choices
mirror .build/analysis/seat-model/derive-booth-demo-2013.py's BCP
readers (B01/B07/B08A/B08B/B09/B14/B24/B25/B26/B28/B32/B40B/B45B/B46),
so a federal 2011-era figure and a vic14 figure are commensurate, and
every column spelling below was verified from the zip's own headers.

ONE mapped difference from the GCP-era stores, never a silent drop:
the 2011 BCP's place-of-birth table (B09) merges England and Scotland
into a single UK_Channel_Islands_Isle_Man row, so the ten-country
birthplace map of the GCP-era stores cannot print here — cobKeys drops
to the eight-country set the federal 2011-era stores carry in the same
situation (derive-booth-demo-2013.py's COB_KEYS8, same site-key order).
Every other lane the vic22/vic18 stores carry exists in 2011 BCP
tables (the income lanes print the 14-band 2011-dollar grid; the
$4,000+ top band is the same dollar edge).

Method: every SA1 counts whole to the district its own polygon
representative point lies in (vic13_geo.assign_sa1(2011)) — boundary-
straddling SA1s land where their centre of population sits, not by
area; the state total never moves (every Vic SA1 counts to exactly one
district). The four Vic sentinel SA1s (migratory/offshore) carry no
polygon and sit outside the join.

Inputs (all caches already ride this repo's other pipelines):
  .build/map/src/n-vic18.geojson                          (88 districts, the 2013 set)
  .build/analysis/seat-model/cache/bcp-sa1-2011.zip       (2011 Census BCP SA1 for AUST)
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2011_aust_shape.zip (SA1 2011 polygons)

Deps: python3 stdlib only. Guards fail loud.
usage: python3 -I .build/map/build_vic14_demo.py
then:  python3 .build/map/build_vic14_seifa.py   (no -I: xlrd is user-site)
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
YEAR = 2011
V = VINTAGES[YEAR]
BCP_ZIP = V["gcp"]
BCP_KEY = V["gcp_key"]          # region_id (7-digit SA1)
BCP_ROWS = V["gcp_rows"]        # 54,805 national
OUT = os.path.join(REPO, "data", "vic14-demo.json")

#: measured 2026-11-04 on this machine from the committed caches; a drift
#: past any of these is a guard trip, never a silent re-derive
BCP_VIC_ROWS = 13339
VIC_SENTINEL_PERSONS_2011 = 8341
VIC_PERSONS_ANCHOR_2011 = 5354042   # ABS 2011 census, Victoria
VIC_PERSONS_TOL = 5000

DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
B45B_OCCS = ["P_Tot_Managers", "P_Tot_Professionals",
             "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
             "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
             "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
# B09 merges the whole UK into one UK_Channel_Islands_Isle_Man row, so
# the GCP-era ten-country map loses eng/sct here — the federal 2011-era
# stores' COB_KEYS8 in the same site-key order (a documented mapping,
# see the docstring)
COB_KEYS = ["ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"]
B09_COLS = ["Australia_P", "Country_birth_not_stated_P", "Tot_P",
            "India_P", "China_excl_SARs_Taiwan_P", "New_Zealand_P",
            "Philippines_P", "Vietnam_P", "South_Africa_P",
            "Italy_P", "Sri_Lanka_P"]
B40B_COLS = ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
             "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]
MEMBER = V["member"].format       # 2011 BCP .../AUST/2011Census_{t}_AUST_SA1_short.csv


def fail(msg):
    raise SystemExit(f"vic14-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


# --------------------------------------------------------------- BCP (Vic rows)
def load_bcp_vic():
    """The vic18 GCP loader's BCP counterpart: same table/column map as
    derive-booth-demo-2013.py load_bcp, Vic rows only (region_id
    starts "2")."""
    if not os.path.exists(BCP_ZIP):
        fail(f"missing BCP input {BCP_ZIP} (see docstring)")
    # 2011 B01's language pair — same concept the GCP packs print as
    # Lang_spoken_home_*/Lang_used_home_*; verified from the B01 header
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
            code = row[BCP_KEY].strip()
            if not code.startswith("2"):
                continue
            if code in base:
                fail(f"BCP B01 dup Vic code {code}")
            base[code] = (int(row["Tot_P_P"]),
                          int(row[lang_cols[0]]),
                          int(row[lang_cols[1]]),
                          tuple(int(row[c]) for c in agecols))
    if n != BCP_ROWS:
        fail(f"BCP B01 rows {n} != pin {BCP_ROWS}")
    if len(base) != BCP_VIC_ROWS:
        fail(f"BCP Vic rows {len(base)} != pin {BCP_VIC_ROWS}")
    persons = sum(r[0] for r in base.values())
    if abs(persons - VIC_PERSONS_ANCHOR_2011) > VIC_PERSONS_TOL:
        fail(f"BCP Vic persons {persons} drifted past ±{VIC_PERSONS_TOL} of "
             f"2011 census Victoria {VIC_PERSONS_ANCHOR_2011}")
    print(f"BCP B01 Vic: {len(base)} SA1s, {persons} persons "
          f"(anchor {VIC_PERSONS_ANCHOR_2011}, delta {persons - VIC_PERSONS_ANCHOR_2011})")

    extra = {}
    for tag, member_t, cols in (
        ("B09", MEMBER(table="B09"), B09_COLS),
        ("B40B", MEMBER(table="B40B"), B40B_COLS),
        ("B45B", MEMBER(table="B45B"), B45B_OCCS),
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
                code = row[BCP_KEY].strip()
                if not code.startswith("2"):
                    continue
                if code in d:
                    fail(f"BCP {tag} dup Vic code {code}")
                d[code] = tuple(int(row[c]) for c in cols)
        if m != BCP_ROWS:
            fail(f"BCP {tag} rows {m} != pin {BCP_ROWS}")
        if len(d) != len(base):
            fail(f"BCP {tag}: {len(d)} Vic rows != B01's {len(base)}")
        extra[tag] = d
        print(f"BCP {tag} Vic: {len(d)} SA1s")

    out = {}
    for code, r in base.items():
        b09 = extra["B09"].get(code)
        e40 = extra["B40B"].get(code)
        o45 = extra["B45B"].get(code)
        if b09 is None or e40 is None or o45 is None:
            fail(f"BCP SA1 set mismatch at {code}")
        # the eight-country cob tuple, in COB_KEYS order, indexed on the
        # B09_COLS order above
        cob = tuple(b09[3:])
        out[code] = r + (b09[0], b09[2], b09[1],
                         e40[0] + e40[1] + e40[2], e40[3],
                         o45[2] + o45[6] + o45[7], sum(o45)) + (cob,)
    print(f"BCP demo Vic: {len(out)} rows, persons {persons}")
    return out, persons


# ------------------------------------------------------------------ assemble
def main():
    gcp, vic_persons = load_bcp_vic()
    nlt = gcp_newlanes.load(BCP_ZIP, prefix="2", era="2011")
    arc = gcp_newlanes.load_arc31(BCP_ZIP, prefix="2", era="2011")
    inc, _inc_cutrec = gcp_newlanes.state_income_bcp(BCP_ZIP, "2")
    HL = gcp_newlanes.hl_alloc_of(2011, "c7")
    sa1 = read_sa1_polygons(YEAR)
    districts, order = load_districts()

    # every BCP Vic row must have a polygon (minus the null sentinels) and
    # every polygon a BCP row
    sent = VIC_SENTINELS[YEAR]
    missing = set(gcp) - sent - set(sa1)
    extra = set(sa1) - set(gcp)
    if missing:
        fail(f"BCP SA1s without a polygon: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"SA1 polygons without a BCP row: {sorted(extra)[:5]} ({len(extra)})")

    assign = assign_sa1(YEAR)

    # hand the join to the map's cache: the SEIFA pipeline computes its own
    # per-SA1 pools against the SAME assignment, never a re-derived one
    write_assign_map(YEAR, assign)

    # sentinel persons are the only Vic census persons not joined
    sentinel_persons = sum(gcp[c][0] for c in sent)
    if sentinel_persons != VIC_SENTINEL_PERSONS_2011:
        fail(f"sentinel SA1 persons {sentinel_persons} != pin "
             f"{VIC_SENTINEL_PERSONS_2011}")
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
                                  "incAud": 0.0, "incLo": 0.0, "incHi": 0.0, "incHiQ": 0.0, "incBandH": [0] * len(gcp_newlanes.INC_BANDS14),
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
        for ii in range(len(gcp_newlanes.INC_BANDS14)):
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
            med = gcp_newlanes.band_median(a["incBandH"],
                                           gcp_newlanes.INC_BANDS14)
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
    if state["p"] + sentinel_persons != vic_persons:
        fail(f"partition drift: districts {state['p']} + sentinels {sentinel_persons} != BCP Vic {vic_persons}")
    print("state:", {**st_shares, "persons": state["p"], "sa1": state["n"]})

    out = {
        "year": "vic14",
        "jurisdiction": "VIC",
        "date": "2014-11-29",
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
            "gcpRows": BCP_ROWS,
        },
        "about": ("2011 Census Basic Community Profile B01/B07/B08A/B08B/B09/B14/B24/B25/B26/B28/B32/B40B/B45B/B46 "
                  "SA1 tables, pooled to Victoria's "
                  "88 state electoral districts for the 29 November 2014 election (the 2013 "
                  "redistribution's boundaries — vic14 shares vic18's district set, the census "
                  "edition moved; 2011 predates the GCP series, so the BCP — the GCP's own "
                  "pre-2016 form — is the read). Each SA1 counts whole to the district its "
                  "polygon representative point lies in (boundary SA1s are not split; the "
                  "state total is never moved). Bases match the federal stores (ex-not-"
                  "stated): language other than English over English-only+other stated; age "
                  "shares renormalised over B01's 11 bands (which exclude age-not-stated); "
                  "overseas-born over country-stated — the B09 birthplace table merges England "
                  "and Scotland into one UK row, so the curated birthplace map prints the "
                  "federal 2011-era stores' eight-country set (cob, order in cobKeys) rather "
                  "than the GCP-era ten; "
                  "university (bachelor and above, B40B) over "
                  "the B01 aged-15+ population less level-of-education-not-stated; blue-"
                  "collar (trades, machinery operators and drivers, labourers, B45B) over the "
                  "eight stated ANZSCO groups; the new lane set mirrors the federal 2011-era stores (year-12-or-less over B01's six printed stated schooling levels; B07 Tot-row Indigenous/ Indigenous-plus-non-Indigenous; B14's Religion menu ten shares (rel, key order in relKeys) over the ex-affiliation-not-stated persons basis; B32's Housing-tenure menu four shares (ten, key order in tenKeys) over the ex-tenure-not-stated occupied-private-dwellings basis; B25's one-parent share of families; the under-15 share of the stated ages). Income lanes are the 2011 edition's 14-band grid in 2011 dollars (its $4,000+ open top band is the same dollar edge the GCP grids pin), the state-universe quantile cuts Victoria's own. p is census persons; n the SA1 count. The "
                  "four Vic sentinel SA1s (migratory/offshore) carry no polygon and sit "
                  f"outside the join, holding {sentinel_persons} persons statewide."),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")


main()
