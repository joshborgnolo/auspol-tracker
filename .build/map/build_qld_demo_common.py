"""data/qld<yy>-demo.json — per-district census-people figures for the
Queensland map frames, in the sa26 discipline on Queensland's own products.

Same estimand as the federal seats' census lanes (booth-demo-*) pooled one
level up: Queensland's three frames are districts-products (the ECQ releases
district totals; the VRS-era per-venue rows carry no voter-origin join), so
each district's people figures are pooled directly from the ABS census GCP
SA1 tables — the 2016 census for qld17, the 2021 census for qld20 and
qld24 (a measured-only read, the sa26 class) — at the same ex-not-stated
bases as .build/analysis/seat-model/derive-booth-seifa-voter.py (the
G01/G09F/G09G/G09H/level-of-education/occupation member and column choices
are identical per vintage, so a federal figure and a qld figure are
commensurate).

Method: every QLD SA1 entirely inside a district would be exact; to avoid
partial SA1 splits the assignment is by the SA1's own polygon centroid —
the SA1 counts to the district its centroid lies in, whole. Boundary-
straddling SA1s land on the side their centre sits; the state total never
moves (every QLD SA1 counts to exactly one district). The geometry lives in
qld_geo.py and the join is committed per vintage at
.build/map/qld{16,21}/assign-sa1.json (qld20 and qld24 share the 2021 join).

Inputs (machine caches; refetch manifest in qld_geo.VINTAGES):
  .build/analysis/seat-model/cache/gcp-sa1-2021.zip        (GCP 2021 SA1 datapack)
  .build/analysis/seat-model/cache/gcp-sa1-2016.zip        (GCP 2016 SA1 datapack)
  .build/analysis/seat-model/cache/SA1_2021_AUST_SHP_GDA2020.zip
  .matilda/seifa-irsad-abs/dl/1270055001_sa1_2016_aust_shape.zip
  .build/map/src/qld/n-qld.geojson                         (93 districts, 2017 determination)

Deps: python3 stdlib only. Guards fail loud.
usage: python3 -I .build/map/build_qld<yy>_demo.py
"""
import csv
import hashlib
import io
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qld_geo import (DIST_GEOJSON, QLD_SENTINELS, VINTAGES, assign_sa1,  # noqa: E402
                     load_districts, read_sa1_polygons, write_assign_map)
import gcp_newlanes  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
OCC_COLS = ["P_Tot_Managers", "P_Tot_Professionals",
            "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
            "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
            "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita",
            "lka", "sct"]
UNI_COLS = ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
            "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]

GCP_QLD_PERSONS = {2021: (4_900_000, 5_400_000), 2016: (4_400_000, 5_000_000)}
#: sentinel-census persons per vintage (migratory/offshore/no-usual-address
#: SA1s — outside the join by construction), printed on the first run and
#: pinned here
QLD_SENTINEL_PERSONS = {2021: 14853, 2016: 12660}


def fail(msg):
    raise SystemExit(f"qld-demo: {msg}")


def hash16(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def _gcp_member(z, year, table):
    name = VINTAGES[year]["member"].format(table=table)
    if name not in z.namelist():
        fail(f"GCP {year} zip lacks {name}")
    return name


def load_gcp_qld(year):
    """One pass over that vintage's GCP SA1 pack, QLD rows (code prefix 3),
    same table/column map as the sa26/federal choices per vintage."""
    V = VINTAGES[year]
    gcp_zip = V["gcp"]
    if not os.path.exists(gcp_zip):
        fail(f"missing GCP input {gcp_zip}")
    z = zipfile.ZipFile(gcp_zip)
    agecols = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
    lang_cols = V["lang"]
    want = [V["gcp_key"], "Tot_P_P", *lang_cols, *agecols]
    base = {}
    n = 0
    member = _gcp_member(z, year, "G01")
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"GCP {year} G01 header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row[V["gcp_key"]]
            if not code.startswith("3"):
                continue
            if code in base:
                fail(f"GCP G01 dup QLD code {code}")
            base[code] = (int(row["Tot_P_P"]), int(row[lang_cols[0]]),
                          int(row[lang_cols[1]]),
                          tuple(int(row[c]) for c in agecols))
    if n != V["gcp_rows"]:
        fail(f"GCP {year} G01 rows {n} != pin {V['gcp_rows']}")
    persons = sum(r[0] for r in base.values())
    lo, hi = GCP_QLD_PERSONS[year]
    if not (lo <= persons <= hi):
        fail(f"GCP {year} QLD persons {persons} outside {lo}..{hi}")
    print(f"GCP {year} G01 QLD: {len(base)} SA1s, {persons} persons")

    table_specs = (
        ("G09F", ["P_Australia_Tot", "P_England_Tot", "P_China_Tot"]),
        ("G09G", ["P_India_Tot", "P_New_Zealand_Tot", "P_Italy_Tot"]),
        ("G09H", ["P_Tot_Tot", "P_COB_NS_Tot", "P_Philippines_Tot",
                  "P_Vietnam_Tot", "P_South_Africa_Tot", "P_Scotland_Tot",
                  "P_Sri_Lanka_Tot"]),
        (V["uni_member"], UNI_COLS),
        (V["occ_member"], OCC_COLS),
    )
    extra = {}
    for tag, cols in table_specs:
        member = _gcp_member(z, year, tag)
        d = {}
        m = 0
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
            rdr = csv.DictReader(fh)
            miss = [c for c in [V["gcp_key"], *cols] if c not in (rdr.fieldnames or [])]
            if miss:
                fail(f"GCP {year} {tag} header drift, missing {miss}")
            for row in rdr:
                m += 1
                code = row[V["gcp_key"]]
                if not code.startswith("3"):
                    continue
                if code in d:
                    fail(f"GCP {tag} dup QLD code {code}")
                d[code] = tuple(int(row[c]) for c in cols)
        if m != V["gcp_rows"]:
            fail(f"GCP {year} {tag} rows {m} != pin {V['gcp_rows']}")
        if len(d) != len(base):
            fail(f"GCP {year} {tag}: {len(d)} QLD rows != G01's {len(base)}")
        extra[tag] = d
        print(f"GCP {year} {tag} QLD: {len(d)} SA1s")

    out = {}
    for code, r in base.items():
        f09 = extra["G09F"].get(code)
        g09 = extra["G09G"].get(code)
        h09 = extra["G09H"].get(code)
        uni = extra[V["uni_member"]].get(code)
        occ = extra[V["occ_member"]].get(code)
        if None in (f09, g09, h09, uni, occ):
            fail(f"GCP {year} QLD set mismatch at {code}")
        # the ten-country cob tuple in COB_KEYS order; indices ride the
        # per-table column orders above (identical across vintages, pinned)
        cob = (f09[1], g09[0], f09[2], g09[1], h09[2], h09[3], h09[4],
               g09[2], h09[6], h09[5])
        out[code] = r + (f09[0], h09[0], h09[1],
                         uni[0] + uni[1] + uni[2], uni[3],
                         occ[2] + occ[6] + occ[7], sum(occ)) + (cob,)
    print(f"GCP {year} demo QLD: {len(out)} rows, persons {persons}")
    return out, persons


# ------------------------------------------------------------------ assemble
def demo_main(frame, year):
    V = VINTAGES[year]
    gcp, qld_persons = load_gcp_qld(year)
    nlt = gcp_newlanes.load(V["gcp"], prefix="3", era=str(year))
    sa1 = read_sa1_polygons(year)
    districts, order = load_districts()

    missing = set(gcp) - QLD_SENTINELS[year] - set(sa1)
    extra = set(sa1) - set(gcp)
    if missing:
        fail(f"GCP QLD SA1s without a polygon: {sorted(missing)[:5]} ({len(missing)})")
    if extra:
        fail(f"SA1 {year} polygons without a GCP row: {sorted(extra)[:5]} ({len(extra)})")

    assign = assign_sa1(sa1, districts)
    write_assign_map(year, assign)

    sentinel_persons = sum(gcp[c][0] for c in QLD_SENTINELS[year])
    if sentinel_persons != QLD_SENTINEL_PERSONS[year]:
        fail(f"{year} sentinel SA1 persons {sentinel_persons} != pin {QLD_SENTINEL_PERSONS[year]}")

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
    persons = st_acc["p"]
    if persons + sentinel_persons != qld_persons:
        fail(f"partition drift: districts {persons} + sentinels {sentinel_persons}"
             f" != GCP QLD {qld_persons}")
    st_acc.pop("pop15")
    st_acc.pop("bands")
    st_acc.pop("cobN")
    print("state:", {**st_shares, "persons": persons, "sa1": st_acc["n"]})

    out = {
        "year": frame,
        "jurisdiction": "QLD",
        "date": {"qld24": "2024-10-26", "qld20": "2020-10-31", "qld17": "2017-11-25"}[frame],
        "demoBasis": "sa1",
        "cobKeys": COB_KEYS,
        "relKeys": list(gcp_newlanes.REL_KEYS),
        "tenKeys": ["mort", "rent", "own", "rentPub"],
        "demo": {nm: demo[nm] for nm in order},
        "state": {**st_shares, "persons": persons, "sa1": st_acc["n"],
                  "sentinelSa1": len(QLD_SENTINELS[year]), "sentinelPersons": sentinel_persons},
        "src": {
            "districtGeojson": {"path": os.path.relpath(DIST_GEOJSON, REPO), "sha16": hash16(DIST_GEOJSON)},
            "gcp": {"path": os.path.relpath(V["gcp"], REPO), "sha16": hash16(V["gcp"]),
                    "members": ["G01", "G07", "G09F", "G09G", "G09H", "G14",
                                V["fam_member"], V["ten_member"],
                                V["uni_member"], V["occ_member"]]},
            "sa1Shp": {"path": os.path.relpath(V["shp"], REPO), "sha16": hash16(V["shp"])},
            "gcpRows": V["gcp_rows"],
        },
        "about": (f"{year} Census GCP G01/G07/G09F/G09G/G09H/G14/{V['fam_member']}/{V['ten_member']}/{V['uni_member']}/{V['occ_member']} SA1 tables, "
                  "pooled to Queensland's 93 Legislative Assembly districts"
                  f" for the frame's election date. Each SA1 counts whole to "
                  "the district its polygon centroid lies in (boundary SA1s are "
                  "not split; the state total is never moved). Bases match the "
                  "federal stores (ex-not-stated): language other than English "
                  "over English-only+other stated; age shares renormalised over "
                  "G01's 11 bands (which exclude age-not-stated); overseas-born "
                  "over country-stated, and the ten curated birthplace-country "
                  "shares (cob, order in cobKeys) riding the same country-stated "
                  "basis; university (bachelor and above) over the G01 aged-15+ "
                  "population less level-of-education-not-stated; blue-collar "
                  "(trades, machinery operators and drivers, labourers) over "
                  "the eight stated ANZSCO groups; the new lane set mirrors "
                  "the federal stores (year-12-or-less over G01's six "
                  "printed stated schooling levels; G07 Tot-row "
                  "Indigenous/Indigenous-plus-non-Indigenous; G14's Religion "
                  "menu ten shares (rel, key order in relKeys) over the "
                  "ex-affiliation-not-stated persons basis; "
                  "the tenure grid's four Housing-tenure shares (ten, key "
                  "order in tenKeys) over the ex-tenure-not-stated "
                  "occupied-private-dwellings basis; the family table's "
                  "one-parent share of families; the under-15 share of "
                  "the stated ages). p is census persons; n the "
                  "SA1 count. The four QLD sentinel SA1s (migratory/offshore/"
                  "no-usual-address) carry no polygon and sit outside the join, "
                  f"holding {sentinel_persons} persons statewide."),
    }
    out_path = os.path.join(REPO, "data", f"{frame}-demo.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"-> {out_path} ({os.path.getsize(out_path)} bytes)")


FRAMES = {"qld24": 2021, "qld20": 2021, "qld17": 2016}
