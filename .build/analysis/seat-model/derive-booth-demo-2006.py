#!/usr/bin/env python3
"""data/booth-demo-2007.json + data/booth-demo-2010.json — census-people
stores for the 2007 and 2010 elections, on the 2006 census.

The venue-proxy sibling of the 2013 store (derive-booth-demo-2013.py):
the AEC published no "Votes by SA1" product before 2016, and the ABS
2006 census era reports on ASGC collection districts (CDs), so a
2007/2010 booth's people are the 2006 Census Basic Community Profile
counts of the CD its venue's geo key names (data/booth-seifa-2007.json
and data/booth-seifa-2010.json's CD codes — the venue's neighbourhood,
never the booth's voters), and a division's row is the exact 2006-census
sum over the CDs each era division contains. Seat-sum membership comes
from the two allocation stores this repo derives:

  seifa-src/cd-2006-ced-2006ed.json — CDs whole-allocated to the
      January 2007 national division set the 2007 election ran on
  seifa-src/cd-2006-ced-2010set.json — the same, to the boundary set
      in force at the 2010 election
  (both emitted by derive-ced-era-alloc.py; whole-unit allocation,
  6x6 grid majority + LGA-sibling fallback, 0 unplaced)

Deliberately NOT named booth-seifa-voter-YYYY.json: build_map_data.py
reads that name as the vote-weighted footprint contract, which a venue
proxy would silently mislabel.

Inputs (re-fetchable):
  .matilda/seifa-irsad-abs/dl/census06bcp.zip — ABS 2006 Census Basic
      Community Profile (ASGC 2006, CD region), extracted here to
      .matilda/seifa-irsad-abs/dl/cd06/ as flat CD_<STATE>_<TABLE>.csv:
      B01 (persons + 11 age bands, opaque B<n> cell names decoded via
      BCP2006_cell_desc_dp.xls), B09 (country of birth), B12 (language
      at home), B39_B (non-school qualification level, persons block),
      B44_B (occupation by age by sex, persons block)
  data/booth-seifa-2007.json / data/booth-seifa-2010.json — committed:
      each year's booth universe and each booth's CD geo key
  the two seifa-src allocation stores above

Cell map (all Persons columns; see the xls descriptor):
  B01: B3 = total persons; B6,B9,…,B36 (step 3) = the 11 GCP-mirrored
       age-band totals (0_4, 5_14, 15_19, 20_24, 25_34, 35_44, 45_54,
       55_64, 65_74, 75_84, 85ov)
  B09: B1249 = Australia-born, B1357 = birthplace not stated,
       B1360 = total
  B12: B1990 = English only at home, B2104 = other language total
  B39_B: B5167/B5176/B5185 = postgrad / grad-dip / bachelor totals
       (the uni numerator), B5248 = level of education not stated
  B44_B: B7153..B7160 = the eight stated ANZSCO major groups
       (B7155 technicians & trades, B7159 machinery operators &
       drivers, B7160 labourers = the blue numerator), B7161 =
       inadequately described / not stated (out of frame)
  B26: B4319,B4324,.. (step 5) = the 15 family-income Tot cells
       (Negative/Nil then the 14 stated bands), B4315,B4320,B4325,..
       (step 5, four cells each) = the band x four-family-type mix
  B28: B4415,B4418,B4421,.. (step 3) = the 15 household-band Tot
       cells (Negative/Nil + 14 stated bands; partial-stated
       B4458-60 and all-not-stated B4461-63 verified for the
       identity and kept out of every lane basis)

Guards fail loud (header drift, CD-key drift, universe drift,
division-set drift). Run:  python3 .build/analysis/seat-model/derive-booth-demo-2006.py
Test:  node .build/analysis/seat-model/test-booth-demo-2006.mjs
"""

import csv
import importlib.util
import json
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

_spec = importlib.util.spec_from_file_location("ilanes", SM / "income_lanes.py")
ilanes = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ilanes)
income_factors = ilanes.income_factors
income_engine = ilanes.engine
income_band_median = lambda masses: ilanes.band_median(  # noqa: E731
    masses, ilanes.INC_BANDS_06)
INC_BANDS06 = ilanes.INC_BANDS_06

ABS = ROOT / ".matilda/seifa-irsad-abs"
BCP_ZIP = ABS / "dl/census06bcp.zip"
CD06 = ABS / "dl/cd06"
STATES = ["NSW", "Vic", "Qld", "SA", "WA", "Tas", "NT", "ACT", "OT"]
ALLOC = {
    2007: SM / "seifa-src/cd-2006-ced-2006ed.json",
    2010: SM / "seifa-src/cd-2006-ced-2010set.json",
}
VENUE = {
    2007: ROOT / "data/booth-seifa-2007.json",
    2010: ROOT / "data/booth-seifa-2010.json",
}

BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
         "55_64", "65_74", "75_84", "85ov"]
B01_BANDS = [f"B{i}" for i in range(6, 37, 3)]  # B6,B9,…,B36, P columns
B09_COLS = ["B1249", "B1357", "B1360"]      # aus, cob-ns, total
# the curated birthplace-country set the GCP-era stores carry as
# COB_KEYS, minus eng/sct: B09 prints one United Kingdom row, so only
# the eight are readable at this edition (same site-key order); cells
# verified against BCP2006_cell_desc_dp.xls
COB_KEYS8 = ["ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"]
B09_COB_CELLS = ["B1282", "B1258", "B1315", "B1321", "B1351", "B1330",
                 "B1294", "B1336"]  # ind chn nzl phl vnm zaf ita lka _P
B09_COLS += B09_COB_CELLS
B12_COLS = ["B1990", "B2104"]               # eng-only, other-lang
B39_COLS = ["B5167", "B5176", "B5185", "B5248"]  # pg,graddip,bach,ns
B44_COLS = [f"B{i}" for i in range(7153, 7161)]  # 8 major groups
PIN_ROWS = 38713  # exact CD universe across the nine state CSVs
STATE_ORDER = {s: i for i, s in
               enumerate(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT",
                          "ACT"])}
# ---- the six new People lanes' 2006-BCP cells (2026-10-29 arc; ids
# verified row-by-row against BCP2006_cell_desc_dp.xls):
#   B01 B54 = Total Indigenous persons (the table's own
#     selected-characteristics total — see the GCP-era Tot-row
#     rationale in derive-booth-seifa-voter.py); B07's "Total" row
#     B1039 = Indigenous status not stated (the lane's basis = persons
#     ex status-not-stated: B54 raw Indigenous / (B3 persons - B1039))
#   B13 = religion (the ten REL menu rows + not-stated + total; the
#     orth lane sums Eastern B2134 + Oriental B2146)
#   B15 P_*_Tot = highest year of school, persons, six levels
#   B24 = family composition (one-parent/total families)
#   B32 = tenure by landlord totals (mort lane is "Being purchased"
#     incl rent/buy schemes)
B01_INDIG = "B54"
B07_NS_TOTAL = "B1039"  # B07 Total-row Indigenous status NS, persons
B13_REL = {
    "norel": ["B2194"],      # No_Religion_P
    "cath": ["B2128"],       # Christ_Catholic_P
    "angl": ["B2116"],       # Christ_Anglican_P
    "unch": ["B2164"],       # Christ_Uniting_Church_P
    "pres": ["B2155"],       # Christ_Presbyter_Ref_P
    "orth": ["B2134", "B2146"],  # Eastern + Oriental orthodox
    "budd": ["B2113"],       # Buddhism_P
    "isl": ["B2179"],        # Islam_P
    "hind": ["B2176"],       # Hinduism_P
    "jew": ["B2182"],        # Judaism_P
}
B13_NS = "B2200"
B13_TOT = "B2203"
B15_SCHOOL = ["B2454", "B2464", "B2474", "B2484", "B2494",
              "B2504"]  # P_Yr_12_eq .. P_Did_not_go (GCP level order)
B24_FAM = ["B4243", "B4223", "B4233", "B4244", "B4245"]
# OPF_Tot_F, Couple_no_child_F, Couple_Tot_F, Other_Family_F, Total_F
B32_TEN = ["B4531", "B4537", "B4579", "B4549", "B4585", "B4591"]
# own-outright, being-purchased, rented-total, S/T housing authority,
# other-tenure-type, tenure-NS
# ---- income: B26 family income by composition + B28 household income
# ---- (14 stated bands, Negative/Nil counted with the $1-$149 band at
# ---- read time like the 2011 reader; partial/all-not-stated out of
# ---- frame, verified against the table's own printed Total)
B28_TOT = ["B4415"] + [f"B{4418 + 3 * i}" for i in range(14)]
B26_TOT = [f"B{4319 + 5 * j}" for j in range(15)]
B26_MIX = [f"B{4315 + 5 * j + k}" for j in range(15) for k in range(4)]
B28_PART = ["B4458", "B4459", "B4460"]      # partial, by household type
B28_NOSTAT = ["B4461", "B4462", "B4463"]    # all not stated
B28_GRAND = "B4466"                          # table Total, households
B26_GRAND = "B4404"                          # fi Total row, its Total col
# the cross-era key orders the whole lane stack shares
REL_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth", "budd",
            "isl", "hind", "jew"]
TEN_KEYS = ["mort", "rent", "own", "rentPub"]


def bcp_table(table, cols, pin_rows=PIN_ROWS):
    """One BCP table across the nine state CSVs -> {cd: tuple(values)}."""
    want = ["region_id"] + cols
    out = {}
    for st in STATES:
        p = CD06 / f"CD_{st}_{table}.csv"
        if not p.exists():
            fail(f"missing {p} (extract census06bcp.zip per module "
                 f"docstring)")
        with open(p, encoding="utf-8-sig", newline="") as fh:
            rdr = csv.reader(fh)
            head = [h.strip() for h in next(rdr)]
            miss = [c for c in want if c not in head]
            if miss:
                fail(f"{p.name}: header drift, missing {miss}")
            ix = [head.index(c) for c in want]
            for row in rdr:
                if not row:
                    continue
                code = row[ix[0]].strip()
                if not (code.isdigit() and len(code) == 7):
                    fail(f"{p.name}: CD key drift {code!r}")
                if code in out:
                    fail(f"{p.name}: dup CD {code}")
                try:
                    out[code] = tuple(int(row[i] or 0) for i in ix[1:])
                except ValueError as e:
                    fail(f"{p.name}: non-numeric cell at {code}: {e}")
    n = len(out)
    if n != pin_rows:
        fail(f"{table}: {n} CDs != {pin_rows}")
    return out


def load_bcp():
    """Per CD: persons, ages(11), eng, oth, aus, totc, cobns, uni, eduns,
    occupancy of the eight stated major groups, pop15."""
    for st in STATES:
        for t in ("B01", "B07", "B09", "B12", "B13", "B15_B", "B24",
                  "B32", "B39_B", "B44_B"):
            if not (CD06 / f"CD_{st}_{t}.csv").exists():
                fail(f"missing cd06 extracts ({CD06}); see module "
                     f"docstring")
    if not BCP_ZIP.exists():
        fail(f"missing {BCP_ZIP} (provenance anchor; ABS 2006 Census "
             f"datapacks, archive census06bcp.zip)")
    b01 = bcp_table("B01", ["B3", B01_INDIG] + B01_BANDS)
    b09 = bcp_table("B09", B09_COLS)
    b12 = bcp_table("B12", B12_COLS)
    b39 = bcp_table("B39_B", B39_COLS)
    b44 = bcp_table("B44_B", B44_COLS)
    b07 = bcp_table("B07", [B07_NS_TOTAL])
    rel_cells = [c for k in REL_KEYS for c in B13_REL[k]]
    b13 = bcp_table("B13", rel_cells + [B13_NS, B13_TOT])
    # B15's Persons cell block straddles the two split files: the
    # Year-12..Year-9 total cells ride B15_A, Year-8-below +
    # did-not-go ride B15_B (BCP2006_cell_desc_dp.xls Split column)
    b15a = bcp_table("B15_A", ["B2454", "B2464", "B2474", "B2484"])
    b15b = bcp_table("B15_B", ["B2494", "B2504"])
    b24 = bcp_table("B24", B24_FAM)
    b32 = bcp_table("B32", B32_TEN)
    out = {}
    for code, g in b01.items():
        row09 = b09[code]
        aus, cobns, totc = row09[:3]
        ccob = row09[3:]
        eng, oth = b12[code]
        pg, gd, ba, eduns = b39[code]
        occ = b44[code]
        row13 = b13[code]
        # the cross-era REL_KEYS vector, orth = its two-cell sum
        relvec = []
        i = 0
        for k in REL_KEYS:
            span = len(B13_REL[k])
            relvec.append(sum(row13[i:i + span]))
            i += span
        out[code] = {
            "pers": g[0],
            "ages": g[2:13],
            "eng": eng, "oth": oth,
            "aus": aus, "totc": totc, "cobns": cobns,
            "cobn": ccob,
            "uni": pg + gd + ba,
            "eduns": eduns,
            "bluen": occ[2] + occ[6] + occ[7],
            "occd": sum(occ),
            "pop15": g[0] - g[2] - g[3],
            "sch6": list(b15a[code]) + list(b15b[code]),
            "indig": g[1],
            "indigDen": g[0] - b07[code][0],
            "relvec": tuple(relvec),
            "relNS": row13[-2],
            "relTot": row13[-1],
            "ten6": tuple(b32[code]),
            "famN": b24[code][0],
            "famD": b24[code][4],
        }
    print(f"BCP 2006: {len(out)} CDs")
    return out


def income_rows06():
    """per CD: (hh14, fi14, mix14x4) — the B28 household-band Tots and
    B26 family-band Tots with Negative/Nil folded into the $1-$149 band
    (the 2011 reader's fold), mix the four-family-type rows. The
    within-table identities reconcile per CD: each band's Tot
    recomposes its four types, and stated + partial-stated +
    all-not-stated recompose each table's printed Total — everything
    inside the BCP's measured ±cell perturbation."""
    b28 = bcp_table("B28", B28_TOT + B28_PART + B28_NOSTAT + [B28_GRAND])
    b26 = bcp_table("B26", B26_TOT + B26_MIX + [B26_GRAND])
    if set(b26) != set(b28):
        fail("B26/B28 CD sets diverge")
    rows = {}
    for code, r28 in b28.items():
        r26 = b26[code]
        hh_raw = [int(v) for v in r28[:15]]
        fi_raw = [int(v) for v in r26[:15]]
        part = int(r28[17])               # Total-col partial-stated
        nost = int(r28[20])               # Total-col all-not-stated
        grand28 = int(r28[21])            # printed Total households
        if abs(sum(hh_raw) + part + nost - grand28) > 12:
            fail(f"B28 identity tripped at {code}: {sum(hh_raw)}+"
                 f"{part}+{nost} vs {grand28}")
        mix = [int(v) for v in r26[15:75]]
        if abs(sum(fi_raw) - sum(mix)) > 12:
            fail(f"B26 band-vs-mix identity tripped at {code}")
        # B26's printed Total (B4404) carries its own partial-stated /
        # all-not-stated households, rows which sit outside this
        # reader's lanes — the band-vs-mix line identity above is the
        # tight check the crop keeps
        hh = [hh_raw[0] + hh_raw[1]] + hh_raw[2:]
        fi = [fi_raw[0] + fi_raw[1]] + fi_raw[2:]
        mrows = [[mix[0 + k] + mix[4 + k] for k in range(4)]] + \
                [[mix[8 + g * 4 + k] for k in range(4)]
                 for g in range(13)]
        rows[code] = (hh, fi, mrows)
    return rows


def income06():
    """the 2006-census income lanes: (per-CD engine map, nat cut,
    nat hi share) — see income_lanes.py for the recipe (mirrors the
    2011/GCP-era lanes; the $3,000+ top band is this edition's
    hi edge)."""
    ad, nonfam = income_factors()
    inc, cut, his = income_engine(income_rows06(), INC_BANDS06,
                                  ad, nonfam, "06")
    print(f"income: B26/B28 CD, national 25% cut ${cut:.0f}/wk; "
          f"top band {his:.4f} of adults")
    return inc, cut, his


def bounded(num, den):
    """A share of an ex-not-stated basis: none when the basis is empty,
    and none when BCP perturbation of a tiny CD takes the arithmetic
    outside [0,1] — emit no number rather than clamp one."""
    if den is None or num is None or den <= 0:
        return None
    v = num / den
    return round(v, 4) if 0 <= v <= 1 else None


def income_shares(rec, bands=None):
    """the income arm of a demo block from a rec carrying incT/incLo/
    incHi (adult masses) and incHH (pooled household band masses):
    the 25th-percentile-cut share, the top-band share and the
    band-interpolated household-income median."""
    if rec.get("incT") is None:
        return {}
    tsum = rec["incT"]
    med = income_band_median(rec["incHH"]) if rec.get("incHH") else None
    return {"loinc": bounded(rec["incLo"], tsum),
            "hiinc": bounded(rec["incHi"], tsum),
            "incMed": round(med) if med is not None else None}


def shares(rec):
    """The demo block shape, parity with derive-booth-demo-2013.py."""
    bsum = sum(rec["bands"])
    fb_den = rec["totc"] - rec["cobns"]
    uni_den = rec["pop15"] - rec["eduns"]
    out = {
        "persons": rec["pers"],
        "cov": 1.0,
        "langOther": bounded(rec["oth"], rec["eng"] + rec["oth"]),
        "fborn": bounded(rec["totc"] - rec["cobns"] - rec["aus"], fb_den),
        "uni": bounded(rec["uni"], uni_den),
        "blue": bounded(rec["bluen"], rec["occd"]),
        "age": ({b: round(rec["bands"][i] / bsum, 4)
                 for i, b in enumerate(BANDS)} if bsum > 0 else None),
        "u15": (bounded(rec["bands"][0] + rec["bands"][1], bsum)
                if bsum > 0 else None),
    }
    if rec.get("sch6") is not None:
        sc = rec["sch6"]
        scd = sum(sc)
        out["y12less"] = bounded(sum(sc[1:]), scd) if scd > 0 else None
    if rec.get("indig") is not None and rec.get("indigDen"):
        out["atsci"] = bounded(rec["indig"], rec["indigDen"])
    if rec.get("relvec") is not None and rec.get("relTot") is not None:
        relbd = rec["relTot"] - (rec.get("relNS") or 0)
        out["rel"] = {k: bounded(rec["relvec"][i], relbd)
                      for i, k in enumerate(REL_KEYS)}
    if rec.get("ten6") is not None:
        own, mort, rent, rentpub, othtype, tenns = rec["ten6"]
        tend = own + mort + rent + othtype
        out["ten"] = {k: bounded({"mort": mort, "rent": rent,
                                  "own": own, "rentPub": rentpub}[k],
                                 tend)
                      for k in TEN_KEYS}
    if rec.get("famN") is not None and rec.get("famD"):
        out["onepar"] = bounded(rec["famN"], rec["famD"])
    if rec.get("cobn") is not None:
        out["cob"] = {k: bounded(rec["cobn"][i], fb_den)
                      for i, k in enumerate(COB_KEYS8)}
    out.update(income_shares(rec))
    return out


def build_year(year, sa1, inc_map, inc_cut, inc_hishare):
    """One election's store off the shared BCP table."""
    venue_path = VENUE[year]
    alloc_path = ALLOC[year]
    store = json.loads(venue_path.read_text(encoding="utf-8"))
    booths = store["booths"]
    if not booths or "geo" not in booths[0]:
        fail(f"{venue_path.name}: booth geo keys missing")
    alloc_doc = json.loads(alloc_path.read_text(encoding="utf-8"))
    ced = alloc_doc["alloc"]
    if len(alloc_doc["divisions"]) != 150:
        fail(f"{alloc_path.name}: {len(alloc_doc['divisions'])} divisions "
             f"!= 150")
    not_in_bcp = sorted(k for k in ced if k not in sa1)
    if not_in_bcp:
        fail(f"{alloc_path.name}: {len(not_in_bcp)} allocated CDs absent "
             f"from the BCP, e.g. {not_in_bcp[:8]}")
    mapped = set(ced.values())
    divs_hist = sorted({b["div"] for b in booths})
    if mapped != set(divs_hist):
        fail(f"division drift ({year}): alloc-only "
             f"{sorted(mapped - set(divs_hist))} venue-only "
             f"{sorted(set(divs_hist) - mapped)}")

    divstate = {b["div"]: b["state"] for b in booths}
    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * len(BANDS),
                                  "eng": 0, "oth": 0, "aus": 0, "totc": 0,
                                  "cobns": 0, "cobn": [0] * len(COB_KEYS8),
                                  "uni": 0, "eduns": 0,
                                  "bluen": 0, "occd": 0, "pop15": 0,
                                  "sch6": [0] * 6,
                                  "indig": 0, "indigDen": 0,
                                  "relvec": [0] * len(REL_KEYS),
                                  "relNS": 0, "relTot": 0,
                                  "ten6": [0] * 6,
                                  "famN": 0, "famD": 0,
                                  "incT": 0.0, "incLo": 0.0,
                                  "incHi": 0.0,
                                  "incHH": [0] * len(INC_BANDS06)})
    for key, dv in ced.items():
        r = sa1[key]
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
        for i in range(6):
            acc["sch6"][i] += r["sch6"][i]
            acc["ten6"][i] += r["ten6"][i]
        for k in ("indig", "indigDen", "relNS", "relTot",
                  "famN", "famD"):
            acc[k] += r[k]
        for i in range(len(REL_KEYS)):
            acc["relvec"][i] += r["relvec"][i]
        inc = inc_map.get(key)
        if inc is not None:
            acc["incT"] += inc[0]
            acc["incLo"] += inc[1]
            acc["incHi"] += inc[2]
            for i in range(len(INC_BANDS06)):
                acc["incHH"][i] += inc[4][i]

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
            # venue CD is uninhabited (commercial/industrial block): a
            # zero-person venue proxy carries no census people
            geo_empty += 1
            rec["demo"] = None
        else:
            inc = inc_map.get(vb.get("geo"))
            rec["demo"] = shares({
                "pers": row["pers"], "bands": list(row["ages"]),
                "eng": row["eng"], "oth": row["oth"],
                "aus": row["aus"], "totc": row["totc"],
                "cobns": row["cobns"], "cobn": row["cobn"],
                "uni": row["uni"],
                "eduns": row["eduns"], "bluen": row["bluen"],
                "occd": row["occd"], "pop15": row["pop15"],
                "sch6": list(row["sch6"]),
                "indig": row["indig"],
                "indigDen": row["indigDen"],
                "relvec": list(row["relvec"]),
                "relNS": row["relNS"], "relTot": row["relTot"],
                "ten6": list(row["ten6"]),
                "famN": row["famN"], "famD": row["famD"],
                **({"incT": inc[0], "incLo": inc[1], "incHi": inc[2],
                    "incHH": list(inc[4])} if inc else {})})
        out_booths.append(rec)

    # the national row pools DIVISION sums (the era-division universe),
    # not the venue CDs — a national reading of the election's geography
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd", "pop15"):
            nat[k] += dv[k]
        for i, b in enumerate(BANDS):
            nat[b] = nat.get(b, 0) + dv["bands"][i]
        for i in range(len(COB_KEYS8)):
            nat.setdefault("cobn", [0.0] * len(COB_KEYS8))
            nat["cobn"][i] += dv["cobn"][i]
        for i in range(6):
            nat.setdefault("sch6", [0] * 6)
            nat.setdefault("ten6", [0] * 6)
            nat["sch6"][i] += dv["sch6"][i]
            nat["ten6"][i] += dv["ten6"][i]
        for k in ("indig", "indigDen", "relNS", "relTot",
                  "famN", "famD"):
            nat[k] += dv[k]
        for i in range(len(REL_KEYS)):
            nat.setdefault("relvec", [0] * len(REL_KEYS))
            nat["relvec"][i] += dv["relvec"][i]
        for k in ("incT", "incLo", "incHi"):
            nat[k] += dv[k]
        for i in range(len(INC_BANDS06)):
            nat.setdefault("incHH", [0] * len(INC_BANDS06))
            nat["incHH"][i] += dv["incHH"][i]

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
        "cdBcp": len(sa1),
        "cdAlloc": len(ced),
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
            "cob": {k: (round(nat["cobn"][i] / nat_fbd, 4)
                        if nat_fbd > 0 else None)
                    for i, k in enumerate(COB_KEYS8)},
            "u15": round((nat["0_4"] + nat["5_14"]) / nat_b, 4),
            "y12less": round(sum(nat["sch6"][1:]) / sum(nat["sch6"]), 4),
            "atsci": round(nat["indig"] / nat["indigDen"], 4),
            "onepar": round(nat["famN"] / nat["famD"], 4),
            "rel": {k: round(nat["relvec"][i]
                             / (nat["relTot"] - nat["relNS"]), 4)
                    for i, k in enumerate(REL_KEYS)},
            "ten": {k: round({"mort": nat["ten6"][1],
                              "rent": nat["ten6"][2],
                              "own": nat["ten6"][0],
                              "rentPub": nat["ten6"][3]}[k]
                             / (nat["ten6"][0] + nat["ten6"][1]
                                + nat["ten6"][2] + nat["ten6"][4]), 4)
                    for k in TEN_KEYS},
            "loinc": round(nat["incLo"] / nat["incT"], 4),
            "hiinc": round(nat["incHi"] / nat["incT"], 4),
            "incMed": round(income_band_median(nat["incHH"])),
        },
    }
    era = ("the January 2007 national division set (the boundaries the "
           "2007 election ran on)" if year == 2007 else
           "the national division set in force at the 2010 election "
           "(Victoria's pre-24/12/2010-determination set)")
    out = {
        "_about": (
            f"Census-people store for the {year} federal election, the "
            "venue-proxy sibling of the voter-footprint demo lanes in "
            "data/booth-seifa-voter-YYYY.json (2016+; the AEC published "
            f"no 'Votes by SA1' product before 2016, so a {year} booth "
            "cannot be weighted by where its voters live). A booth's "
            "demo block is the 2006 Census Basic Community Profile "
            "counts of the collection district (CD) its VENUE sits in "
            f"— the geo key of booth-seifa-{year}.json — describing "
            "the venue's neighbourhood, never the booth's voters; "
            "persons is a real CD headcount, never a weighted "
            "pseudo-population. A division's row is the exact "
            "2006-census sum over the CDs whole-allocated to its "
            f"membership of {era} "
            f"({alloc_path.name}, derive-ced-era-alloc.py; whole-unit "
            "allocation by 6x6 grid majority with an LGA-sibling "
            "fallback), not an average of its booth rows. Shares "
            "mirror the GCP lanes: age renormalised over the 11 B01 "
            "bands (no age-not-stated column); language other-at-home "
            "over English-only + other; overseas-born over "
            "country-of-birth stated, and the curated birthplace-country "
            "(cob) shares riding that same basis — the 2006 B09 prints "
            "one United Kingdom row, so the GCP-era ten-country set is "
            "trimmed to eight here (country order in cobKeys); "
            "university (bachelor and above) "
            "per the aged-15+ population less "
            "level-of-education-not-stated; income lanes mirror the "
            "voter stores on the BCP's own tables: B28 households by "
            "the 14-band weekly household-income grid are re-weighted "
            "to ADULTS at the data/income-dist.json factors (each "
            "band's family share from B26's family-income Tot over its "
            "family-composition mix in the CD — national mix as "
            "fallback — the rest non-family at the national mean; "
            "household mass rides the Tot columns, never B28's "
            "fam/non columns, small-CD perturbation independently "
            "shaving the splits; partial-stated and all-not-stated "
            "households sit outside the basis). loinc is the adult "
            "share below the national 25th-percentile weekly "
            "household-income cut the store-level incomeCuts record "
            "carries (the 2006 national adults histogram's cut band "
            "split linearly, in 2006 dollars), hiinc the adult share "
            "in the $3,000-and-top band (this edition's hi edge — the "
            "page's own dollar wording reads incomeCuts.hiEdgeWeekly "
            "per year), incMed the band-interpolated median weekly "
            "household income in 2006 dollars on the HOUSEHOLD basis "
            "(ABS's own published-median basis — the adults-weighted "
            "histogram would read a few hundred dollars higher, "
            "skewed by couples). The new lane set mirrors "
            "the voter stores: B15_B's highest-year-of-schooling six "
            "levels (year-12-or-less over the stated levels), "
            "Indigenous status of B01's total over persons ex "
            "B07's status-not-stated (the lane is B54 indigenous / "
            "(B3 persons - B1039 status-not-stated)), B13's ten "
            "Religion menu shares (rel, key order in relKeys, "
            "No-religion leading) over the ex-affiliation-not-stated "
            "persons basis, B32's four Housing-tenure menu shares "
            "(ten, key order in tenKeys, owned-with-mortgage "
            "leading — being-purchased includes rent/buy) over the "
            "ex-tenure-not-stated occupied-private-dwellings basis "
            "(rented-public a state-or-territory-housing-authority "
            "landlord within that base), B24's one-parent share of "
            "families, and the under-15 share of the stated ages; "
            "blue-collar (technicians/"+
            "trades + machinery operators/drivers + labourers of B44 "
            "the ANZSCO occupation major groups) over the eight stated "
            "occupation groups, inadequately-described and not-stated "
            "occupations out of the frame. The national row pools the "
            "division sums. A booth whose venue CD records no "
            "residents (commercial/industrial blocks; "
            "counts.boothsGeoEmpty) carries demo:null, as does one "
            "whose geo key is absent from the BCP "
            "(counts.boothsGeoMissing); inside a present block a lane "
            "is nulled rather than clamped when the BCP's small-area "
            "perturbation would put its share outside [0,1] "
            "(counts.boothsGeo-carrying rows only). Booth records "
            f"carry geo of data/booth-seifa-{year}.json; its "
            "venue-proxy caveats apply here too."),
        "_provenance": {
            "sourceUrls": {
                "bcp": "ABS 2006 Census Basic Community Profile, "
                       "collection districts (B01/B07/B09/B12/B13/"
                       "B15_B/B24/B26/B28/B32/B39_B/B44_B), "
                       "abs.gov.au archive census06bcp.zip",
                "alloc": f"{alloc_path.name} (derive-ced-era-alloc.py)",
                "venue": f"data/booth-seifa-{year}.json",
            },
            "files": {
                str(BCP_ZIP.relative_to(ROOT)): hash16(BCP_ZIP),
                str(alloc_path.relative_to(ROOT)): hash16(alloc_path),
                str(venue_path.relative_to(ROOT)): hash16(venue_path),
            },
            "extractedAt": str(date.today()),
        },
        "election": year,
        "censusEdition": 2006,
        "cobKeys": COB_KEYS8,
        "relKeys": list(REL_KEYS),
        "tenKeys": list(TEN_KEYS),
        "deliveryBasis": ("venue-proxy per booth (collection district of "
                          "the premises); exact era-division census sum "
                          "per division"),
        "incomeCuts": {
            "loQuantile": ilanes.INC_LO_Q,
            "loCutWeekly": inc_cut,
            "hiEdgeWeekly": INC_BANDS06[-1][0],
            "hiNationalShare": inc_hishare,
            "dollarsYear": 2006,
            "adultsWeights": "data/income-dist.json",
            "medianBasis": "households (shares are per-adult)",
        },
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    return out


def main():
    sa1 = load_bcp()
    inc_map, inc_cut, inc_hishare = income06()
    for year in (2007, 2010):
        out = build_year(year, sa1, inc_map, inc_cut, inc_hishare)
        c = out["counts"]
        op = ROOT / f"data/booth-demo-{year}.json"
        op.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
        print(f"OK -> {op} (booths {c['booths']}, geo-missing "
              f"{c['boothsGeoMissing']}, geo-empty {c['boothsGeoEmpty']}, "
              f"divisions {c['divisions']}, national {c['national']})")


if __name__ == "__main__":
    main()
