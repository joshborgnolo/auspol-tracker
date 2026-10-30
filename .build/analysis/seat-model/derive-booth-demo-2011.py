#!/usr/bin/env python3
"""data/booth-demo-2007-c1.json + data/booth-demo-2010-c1.json — the
2011-census (c1) side of the 2007/2010 people-interpolation lanes.

The /map/ census-people lanes interpolate between bracketing censuses
to election day, the same day-share of the intercensal span the SEIFA
pcti lanes use (f lives in the year store's demoInterp record, written
by the interp blend pass — this script only emits the far side). The
MEASURED side is the 2006-census venue store (data/booth-demo-2007.json
/ -2010.json, derive-booth-demo-2006.py); this script reads the SAME
2011 Census BCP the 2013 venue store does, one census edition forward:

  booths     the 2011 BCP counts of the 2011-census SA1 the booth's
             premises coordinates (data/booth-seifa-{year}.json's
             lat/lon) fall in — point-in-polygon against the ABS
             1270.0.55.001 July 2011 shapes, the locate() ladder
             derive-booth-seifa-hist.py's interp lane rides
  divisions  the 2011 BCP counts whole-allocated to the election's
             boundary set and summed per division
             (.build/analysis/seat-model/seifa-src/sa1-2011-ced-
             {2006ed,2010set}.json, the SEIFA interp lane's
             whole-allocations, derive-ced-era-alloc.py)

Both years read ONE census universe, so their national rows must equal
the 2013 venue store's exactly (asserted against
data/booth-demo-2013.json's counts.national — the cross-era identity
oracle the 2006-census era uses between 2007 and 2010), and their
incomeCuts must equal its 2011-dollars record bit-for-bit (the same
B26/B28 recomputation path). A booth whose premises sit outside every
2011 SA1 polygon (offshore, no coords) records demo:null
(counts.boothsPipMiss), as does one whose SA1 housed no one
(boothsPipEmpty); a missing c1 side means the year store's
interpolated cell for that booth simply falls back to the measured
block at display.

Inputs (re-fetchable): cache/bcp-sa1-2011.zip (ABS 2011 Census BCP SA1
for AUST), dl/1270055001_sa1_2011_aust_shape.zip (ABS 1270.0.55.001),
the two seifa-src allocation JSONs, the committed booth-seifa stores,
data/income-dist.json — see derive-booth-demo-2013.py's docstring for
the BCP anatomy and the income-lane derivation (reused verbatim).

Guards fail loud (allocation universe drift, division-name drift,
national-pool drift against the 2013 oracle). Run:
  python3 .build/analysis/seat-model/derive-booth-demo-2011.py
Test: node .build/analysis/seat-model/test-booth-demo-2011.mjs
"""

import importlib.util
import json
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


# the 2013 store's readers (BCP anatomy, income lanes, shares) verbatim —
# this script is a re-driving of that machinery onto the election-era
# boundary sets, never a re-implementation
d13 = _lib("d13", "derive-booth-demo-2013.py")
# the SEIFA interp lane's own geometry machinery (same point-in-polygon
# ladder, same 54,805-record pin on the 2011 SA1 shapes)
hist = _lib("hist", "derive-booth-seifa-hist.py")
fail, hash16 = d13.fail, d13.hash16

STATE_ORDER = d13.STATE_ORDER
YEARS = {
    2007: {"alloc": "sa1-2011-ced-2006ed.json",
           "venue": "data/booth-seifa-2007.json",
           "out": "data/booth-demo-2007-c1.json",
           "boundaries": "the AEC's January 2007 national division set"},
    2010: {"alloc": "sa1-2011-ced-2010ed.json",
           "venue": "data/booth-seifa-2010.json",
           "out": "data/booth-demo-2010-c1.json",
           "boundaries": "the boundary set the 2010 election ran on"},
}
NAT_TOLERANCE = 5e-5  # share drift budget vs the 2013 oracle (float
# summation order); persons must match exactly


def load_alloc(path):
    """sa1-2011-ced-<set>.json -> {7-digit SA1: division name} over the
    150-division set only (the JSON's 11-digit maincodes decode to the
    BCP's 7-digit region_id: code[0] + code[5:], the decode the 2013
    store's CED loader uses; asserted per key)."""
    d = json.loads(path.read_text(encoding="utf-8"))
    if d.get("unit") != "SA1_MAINCODE_2011":
        fail(f"{path.name}: unit drift {d.get('unit')!r}")
    alloc = d.get("alloc")
    if not isinstance(alloc, dict) or len(alloc) != d.get("placed"):
        fail(f"{path.name}: alloc shape drift")
    out = {}
    for mc, nm in alloc.items():
        if not (isinstance(mc, str) and mc.isdigit() and len(mc) == 11):
            fail(f"{path.name}: maincode drift {mc!r}")
        key7 = mc[0] + mc[5:]
        if key7 in out:
            fail(f"{path.name}: dup SA1 {key7}")
        out[key7] = nm
    print(f"{path.name}: {len(out)} SA1s placed over "
          f"{len(d['divisions'])} divisions "
          f"(unplaced-unscored {len(d.get('unplacedUnscored', []))})")
    return out, set(d["divisions"])


def sum_divisions(alloc, sa1, inc):
    """Whole-allocated 2011-BCP sums per division — the 2013 store's
    divsum accumulation over the era allocation instead of CED_2011."""
    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * len(d13.BANDS),
                                  "eng": 0, "oth": 0, "aus": 0, "totc": 0,
                                  "cobns": 0, "uni": 0, "eduns": 0,
                                  "bluen": 0, "occd": 0, "pop15": 0,
                                  "cobn": [0] * len(d13.COB_KEYS8),
                                  "inct": 0.0, "incl": 0.0, "inch": 0.0,
                                  "incbh": [0.0] * len(d13.INC_BANDS14),
                                  "sch6": [0] * 6,
                                  "indig": 0, "indigDen": 0,
                                  "relvec": [0] * len(d13.REL_KEYS),
                                  "relNS": 0, "relTot": 0,
                                  "ten6": [0] * 6,
                                  "famN": 0, "famD": 0})
    for key, dv in alloc.items():
        r = sa1.get(key)
        ir = inc.get(key)
        if r is None or ir is None:
            fail(f"allocated SA1 {key} missing from the BCP/income "
                 f"universes")
        acc = divsum[dv]
        acc["pers"] += r["pers"]
        for i in range(len(d13.BANDS)):
            acc["bands"][i] += r["ages"][i]
        acc["eng"] += r["eng"]
        acc["oth"] += r["oth"]
        for k in ("aus", "totc", "cobns", "uni", "eduns", "bluen",
                  "occd", "pop15"):
            acc[k] += r[k]
        for i in range(6):
            acc["sch6"][i] += r["sch6"][i]
            acc["ten6"][i] += r["ten6"][i]
        for k in ("indig", "indigDen", "relNS", "relTot",
                  "famN", "famD"):
            acc[k] += r[k]
        for i in range(len(d13.REL_KEYS)):
            acc["relvec"][i] += r["relvec"][i]
        for i in range(len(d13.COB_KEYS8)):
            acc["cobn"][i] += r["cobn"][i]
        acc["inct"] += ir[0]
        acc["incl"] += ir[1]
        acc["inch"] += ir[2]
        for i in range(len(d13.INC_BANDS14)):
            acc["incbh"][i] += ir[4][i]
    return divsum


def national_of(divsum):
    """Pool division sums into the national row — layout mirrors the
    2013 store's counts.national exactly for the cross-era oracle."""
    nat = defaultdict(int)
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd", "pop15"):
            nat[k] += dv[k]
        for i, b in enumerate(d13.BANDS):
            nat[b] = nat.get(b, 0) + dv["bands"][i]
        for k in ("inct", "incl", "inch"):
            nat[k] += dv[k]
        nat.setdefault("incbh", [0.0] * len(d13.INC_BANDS14))
        for i in range(len(d13.INC_BANDS14)):
            nat["incbh"][i] += dv["incbh"][i]
        nat.setdefault("cobn", [0.0] * len(d13.COB_KEYS8))
        for i in range(len(d13.COB_KEYS8)):
            nat["cobn"][i] += dv["cobn"][i]
        for i in range(6):
            nat.setdefault("sch6", [0] * 6)
            nat.setdefault("ten6", [0] * 6)
            nat["sch6"][i] += dv["sch6"][i]
            nat["ten6"][i] += dv["ten6"][i]
        for k in ("indig", "indigDen", "relNS", "relTot",
                  "famN", "famD"):
            nat[k] += dv[k]
        for i in range(len(d13.REL_KEYS)):
            nat.setdefault("relvec", [0] * len(d13.REL_KEYS))
            nat["relvec"][i] += dv["relvec"][i]
    nat_b = sum(nat[b] for b in d13.BANDS)
    nat_eo = nat["eng"] + nat["oth"]
    nat_fbd = nat["totc"] - nat["cobns"]
    nat_unid = nat["pop15"] - nat["eduns"]
    return {
        "persons": nat["pers"],
        "langOther": round(nat["oth"] / nat_eo, 4) if nat_eo else None,
        "fborn": round((nat_fbd - nat["aus"]) / nat_fbd, 4)
        if nat_fbd > 0 else None,
        "uni": round(nat["uni"] / nat_unid, 4) if nat_unid > 0 else None,
        "blue": round(nat["bluen"] / nat["occd"], 4)
        if nat["occd"] > 0 else None,
        "age0_14": round((nat["0_4"] + nat["5_14"]) / nat_b, 4),
        "age65ov": round(sum(nat[b] for b in d13.BANDS[8:]) / nat_b, 4),
        "loinc": round(nat["incl"] / nat["inct"], 4)
        if nat["inct"] else None,
        "hiinc": round(nat["inch"] / nat["inct"], 4)
        if nat["inct"] else None,
        "cob": {k: (round(nat["cobn"][i] / nat_fbd, 4)
                    if nat_fbd > 0 else None)
                for i, k in enumerate(d13.COB_KEYS8)},
        "incMed": d13.band_median14(nat["incbh"]),
        "u15": round((nat["0_4"] + nat["5_14"]) / nat_b, 4),
        "y12less": round(sum(nat["sch6"][1:]) / sum(nat["sch6"]), 4),
        "atsci": round(nat["indig"] / nat["indigDen"], 4),
        "onepar": round(nat["famN"] / nat["famD"], 4),
        "rel": {k: round(nat["relvec"][i]
                         / (nat["relTot"] - nat["relNS"]), 4)
                for i, k in enumerate(d13.REL_KEYS)},
        "ten": {k: round({"mort": nat["ten6"][1],
                          "rent": nat["ten6"][2],
                          "own": nat["ten6"][0],
                          "rentPub": nat["ten6"][3]}[k]
                         / (nat["ten6"][0] + nat["ten6"][1]
                            + nat["ten6"][2] + nat["ten6"][4]), 4)
                for k in d13.TEN_KEYS},
    }


def main():
    sa1 = d13.load_bcp()
    z_bcp = d13.zipfile.ZipFile(d13.BCP_ZIP)
    inc_fac, inc_nonfam = d13.income_factors()
    inc, inc_cut, inc_hishare = d13.income_bcp(z_bcp, inc_fac, inc_nonfam)
    z_bcp.close()
    if set(inc) != set(sa1):
        fail("B01/B28 SA1 universes diverge")

    # the 2013 venue store is the same census universe one boundary set
    # up: incomeCuts must match bit-for-bit (same deterministic
    # recomputation), the national row within float summation tolerance
    o13 = json.loads(d13.ROOT.joinpath(
        "data/booth-demo-2013.json").read_text(encoding="utf-8"))
    cut13 = o13["incomeCuts"]
    if (round(inc_cut, 2), round(inc_hishare, 6)) != (
            cut13["loCutWeekly"], cut13["hiNationalShare"]):
        fail(f"incomeCuts drift vs 2013 store: ({inc_cut:.2f}, "
             f"{inc_hishare:.6f}) vs {cut13}")
    nat13 = o13["counts"]["national"]

    locate, _polys, _nulls = hist.build_locate("sa1-2011")

    for year, y in YEARS.items():
        alloc, alloc_divs = load_alloc(SM / "seifa-src" / y["alloc"])
        store = json.loads(d13.ROOT.joinpath(y["venue"]).read_text(
            encoding="utf-8"))
        booths = store["booths"]
        if not booths or "lat" not in booths[0]:
            fail(f"{y['venue']}: booth lat/lon missing")
        divs_hist = {b["div"] for b in booths}
        if alloc_divs != divs_hist:
            fail(f"{year}: division drift: alloc-only "
                 f"{sorted(alloc_divs - divs_hist)} venue-only "
                 f"{sorted(divs_hist - alloc_divs)}")
        divstate = {b["div"]: b["state"] for b in booths}
        divsum = sum_divisions(alloc, sa1, inc)

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
                key = locate(lon, lat)
            row = sa1.get(key) if key is not None else None
            if row is None:
                pip_miss += 1
                rec["demo"] = None
            elif row["pers"] == 0:
                pip_empty += 1
                rec["demo"] = None
            else:
                ir = inc[key]
                rec["demo"] = d13.shares({
                    "pers": row["pers"], "bands": list(row["ages"]),
                    "eng": row["eng"], "oth": row["oth"],
                    "aus": row["aus"], "totc": row["totc"],
                    "cobns": row["cobns"], "cobn": row["cobn"],
                    "uni": row["uni"],
                    "eduns": row["eduns"], "bluen": row["bluen"],
                    "occd": row["occd"], "pop15": row["pop15"],
                    "inct": ir[0], "incl": ir[1], "inch": ir[2],
                    "incbh": list(ir[4]),
                    "sch6": list(row["sch6"]),
                    "indig": row["indig"],
                    "indigDen": row["indigDen"],
                    "relvec": (list(row["relvec"]) if row["relvec"]
                               is not None else None),
                    "relNS": row["relNS"], "relTot": row["relTot"],
                    "ten6": (list(row["ten6"]) if row["ten6"]
                             is not None else None),
                    "famN": row["famN"], "famD": row["famD"]})
            out_booths.append(rec)

        divisions = []
        for name in sorted(divsum, key=lambda n:
                           (STATE_ORDER[divstate[n]], n)):
            divisions.append({"div": name, "state": divstate[name],
                              **d13.shares(divsum[name])})
        national = national_of(divsum)
        if national["persons"] != nat13["persons"]:
            fail(f"{year}: national persons {national['persons']} != "
                 f"2013 oracle {nat13['persons']}")
        for k in ("langOther", "fborn", "uni", "blue", "age0_14",
                  "age65ov", "loinc", "hiinc", "incMed"):
            if abs((national[k] or 0) - (nat13[k] or 0)) > NAT_TOLERANCE:
                fail(f"{year}: national {k} {national[k]} drifts 2013 "
                     f"oracle {nat13[k]}")

        counts = {
            "booths": len(out_booths),
            "boothsPip": len(out_booths) - pip_miss - pip_empty,
            "boothsPipMiss": pip_miss,
            "boothsPipEmpty": pip_empty,
            "divisions": len(divisions),
            "sa1Bcp": len(sa1),
            "sa1Alloc": len(alloc),
            "national": national,
        }
        out = {
            "_about": (
                "2011-census side (c1) of the people-interpolation "
                f"store for the {year} federal election. The /map/ "
                "census-people lanes interpolate between bracketing "
                "censuses to election day on the SEIFA pcti lanes' "
                "day-share of the intercensal span (the f factor lives "
                f"in data/booth-demo-{year}.json's demoInterp record, "
                "written by the interp blend pass); this store is the "
                "far side ONLY — the measured side is the 2006-census "
                f"venue store (data/booth-demo-{year}.json). A booth's "
                "demo block is the 2011 Census Basic Community Profile "
                "counts of the 2011-census SA1 its premises "
                f"coordinates (data/booth-seifa-{year}.json) fall in, "
                "point-in-polygon against the ABS 1270.0.55.001 July "
                "2011 SA1 shapes (derive-booth-seifa-hist.py's locate "
                "ladder) — the venue's neighbourhood, never the "
                "booth's voters. A division's row is the 2011 BCP "
                "whole-allocated to "
                f"{y['boundaries']} "
                f"(seifa-src/{y['alloc']}) and summed, never an average "
                "of booth rows. Shares and income lanes are "
                "derive-booth-demo-2013.py's own readers re-run — same "
                "B01/B07/B09/B14/B25/B26/B28/B32/B40B/B45B bases "
                "(its curated "
                "birthplace-country cob lanes riding the B09 per-country "
                "cells in the 2013 store's COB_KEYS8 order; the "
                "Religion/Housing-tenure/indigenous/schooling/family "
                "lanes riding B01's schooling columns, B07's Tot row, "
                "B14, B25, B32 identically — the ten rel and four ten "
                "menu shares are in the store's relKeys/tenKeys "
                "orders), same adult "
                "re-weighting at data/income-dist.json's factors, the "
                "national 25th-percentile cut in 2011 dollars; this "
                "census universe is the 2013 store's, so incomeCuts "
                "matches it bit-for-bit and the national row within "
                "float summation tolerance (both asserted). A booth "
                "whose premises sit outside every 2011 SA1 polygon, or "
                "whose lat/lon are absent/(0,0), carries demo:null "
                "(counts.boothsPipMiss), as does one whose SA1 housed "
                "no one (boothsPipEmpty) — a missing c1 side leaves "
                "that booth's interpolated display cell to fall back "
                "to the measured block; inside a present block a lane "
                "is nulled rather than clamped when BCP perturbation "
                "would put its share outside [0,1]."),
            "_provenance": {
                "sourceUrls": {
                    "bcp": "ABS 2011 Census Basic Community Profile, "
                           "SA1 for AUST (B01/B09/B26/B28/B40B/B45B), "
                           "abs.gov.au census datapacks",
                    "shapes": "ABS 1270.0.55.001 July 2011, SA1 "
                              "polygons "
                              "(1270055001_sa1_2011_aust_shape.zip)",
                    "alloc": f".build/analysis/seat-model/seifa-src/"
                             f"{y['alloc']} (derive-ced-era-alloc.py)",
                    "venue": y["venue"],
                },
                "files": {
                    str(d13.BCP_ZIP.relative_to(ROOT)):
                        hash16(d13.BCP_ZIP),
                    "dl/1270055001_sa1_2011_aust_shape.zip":
                        hash16(ROOT / ".matilda/seifa-irsad-abs/dl/"
                                       "1270055001_sa1_2011_aust_"
                                       "shape.zip"),
                    f".build/analysis/seat-model/seifa-src/"
                    f"{y['alloc']}":
                        hash16(SM / "seifa-src" / y["alloc"]),
                    y["venue"]:
                        hash16(ROOT / y["venue"]),
                },
                "extractedAt": str(date.today()),
            },
            "election": year,
            "censusEdition": 2011,
            "deliveryBasis": (
                "venue-proxy per booth (2011-census SA1 of the "
                "premises, point-in-polygon); whole-allocated 2011 BCP "
                f"sum per division ({y['alloc']})"),
            "incomeCuts": {
                "loQuantile": d13.INC_LO_Q,
                "loCutWeekly": inc_cut,
                "hiEdgeWeekly": 4000,
                "hiNationalShare": inc_hishare,
                "dollarsYear": 2011,
                "adultsWeights": "data/income-dist.json",
                "medianBasis": "households (shares are per-adult)",
            },
            "cobKeys": list(d13.COB_KEYS8),
            "relKeys": list(d13.REL_KEYS),
            "tenKeys": list(d13.TEN_KEYS),
            "counts": counts,
            "divisions": divisions,
            "booths": out_booths,
        }
        op = ROOT / y["out"]
        op.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
        print(f"OK -> {op} (booths {len(out_booths)}, pip-miss {pip_miss}, "
              f"pip-empty {pip_empty}, divisions {len(divisions)})")


if __name__ == "__main__":
    main()
