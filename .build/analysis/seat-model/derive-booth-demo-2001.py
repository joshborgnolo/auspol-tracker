#!/usr/bin/env python3
"""data/booth-demo-2004.json — the census-people store for the 2004
federal election (the 2001-census, c0 side of the 2004
people-interpolation lane).

The measured side design rides the 2006-census era's sibling
(derive-booth-demo-2006.py): the 2004 election is the floor of the
people-interp lanes (the next people lane up is 2007's), interpolated
between the 2001 and 2006 censuses to election day at the SEIFA pcti
lane's own day-share f (0.634373 — the c1 side data/booth-demo-2004-c1.json
is a separate derive). A booth's demo block is the 2001 Basic Community
Profile counts of the 2001-census collection district its venue sits in
— data/booth-seifa-2004.json's own `geo` field holds the 2001 CD code
(the seifa lane maps each 2004 premises to its CD, coords carried from
the 2007 addresses for most rows); a division's row is the exact
2001-BCP sum over the CDs whole-allocated to its division
(seifa-src/cd-2001-ced-2003ed.json, derive-cd-2001-ced-alloc.py) —
real headcounts, never vote-weighted pseudo-populations.

Architecture differences to name: the 2001 BCP ships as ~35,000
per-CD xlsx files inside nine per-state zips (the archive.org mirror
of ABS's paid CDATA CD product — ABS has no bulk 2001 BCP download),
tallied per CD by extract-bcp-2001-tally.py into
cache/bcp-2001-cd-tally.json, where this script reads one record per
CD; and occupation in 2001 is the ASCO classification (pre-ANZSCO), so
the blue-collar shares map {Tradespersons, Intermediate Production &
Transport, Labourers} onto the ANZSCO 3/7/8 lane the later censuses
read — the/definitional wobble name in _about; the ABS reported the
two classifications as broadly comparable.

No income lanes (the repo's income floor stays at the 2013 election —
the blend keeps that floor; the store carries no incomeCuts and its
demo blocks carry no loinc/hiinc/income-median keys).

Guards fail loud (booth-set drift vs the venue store, division-name
drift, allocation universe drift against the gateway population check,
national persons inside the published-census envelope).
Run:  python3 .build/analysis/seat-model/derive-booth-demo-2001.py
Test: node .build/analysis/seat-model/test-booth-demo-2001.mjs
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


d13 = _lib("d13", "derive-booth-demo-2013.py")
xt = _lib("xt01", "extract-bcp-2001-tally.py")
fail, hash16 = d13.fail, d13.hash16

# the /map/ Born-overseas country menu, in store-row order (the
# extractor's own constant): whole-UK first exactly as eng leads the
# 2021-era menu, then the era's eight in the GCP-era site order
COB_KEYS01 = xt.COB01_KEYS
# the Religion and Housing-tenure select families (the cross-era key
# orders — the extractor's REL01_KEYS list is the same order)
REL_KEYS_01 = xt.REL01_KEYS
TEN_KEYS = ["mort", "rent", "own", "rentPub"]

TALLY = SM / "cache/bcp-2001-cd-tally.json"
ALLOC = SM / "seifa-src/cd-2001-ced-2003ed.json"
VENUE = ROOT / "data/booth-seifa-2004.json"
OUT = ROOT / "data/booth-demo-2004.json"
STATE_ORDER = d13.STATE_ORDER
BANDS = d13.BANDS


def load_tally():
    d = json.loads(TALLY.read_text())["tally"]
    exp = 35289
    if len(d) != exp:
        fail(f"2001 tally rows {len(d)} != {exp}")
    need = {"pers", "bands", "aus", "totc", "cobns", "eng", "oth",
            "uni", "eduns", "bluen", "occd", "cobn"}
    need_new = {"rel01", "rel01ns", "rel01tot",
                "sch01", "fam01", "ten01", "ind01", "b1ov"}
    for code, r in d.items():
        if any(k not in r for k in need):
            fail(f"2001 tally {code} row shape drift")
        if r.get("shortCd"):
            continue
        if any(k not in r or r[k] is None for k in need_new):
            fail(f"2001 tally {code} new-lane fields drift")
        if len(r["rel01"]) != len(REL_KEYS_01) \
                or len(r["fam01"]) != 5 or len(r["ten01"]) != 6 \
                or len(r["sch01"]) != 6:
            fail(f"2001 tally {code} new-lane widths drift")
        if r.get("cobn") is None and not r.get("shortCd"):
            fail(f"2001 tally {code}: cobn missing off a full profile")
        if r.get("cobn") is not None and len(r["cobn"]) != len(COB_KEYS01):
            fail(f"2001 tally {code}: cobn width drift")
    print(f"2001 BCP tally: {len(d)} CDs")
    return d


def main():
    people = load_tally()
    alloc_d = json.loads(ALLOC.read_text())
    alloc = alloc_d["alloc"]
    if alloc_d.get("unit") != "CD_CODE_2001":
        fail("alloc unit drift")
    venue = json.loads(VENUE.read_text())
    booths = venue["booths"]
    divs_hist = sorted({b["div"] for b in booths})
    mapped = set(alloc_d["divisions"])
    if len(mapped) != 150 or mapped != set(divs_hist):
        fail(f"division drift: alloc-only {sorted(mapped - set(divs_hist))} "
             f"venue-only {sorted(set(divs_hist) - mapped)}")

    # division sums: exact 2001-BCP totals over the whole-alloc set —
    # a short-table CD (ABS published no lane tables for it) counts
    # its people but never enters a lane pool, the not-stated doctrine
    # taken to whole tables rather than cells
    no_lanes = []
    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * 11,
                                  "eng": 0, "oth": 0, "aus": 0,
                                  "totc": 0, "cobns": 0, "uni": 0,
                                  "eduns": 0, "bluen": 0, "occd": 0,
                                  "cobn": [0] * len(COB_KEYS01),
                                  "sch01": [0] * 6,
                                  "indig": 0, "indigDen": 0,
                                  "rel01": [0] * len(REL_KEYS_01),
                                  "relNS": 0, "relTot": 0,
                                  "ten01": [0] * 6,
                                  "famN": 0, "famD": 0})
    for code, dv in alloc.items():
        r = people.get(code)
        if r is None:
            continue  # alloc covers the no-population cube-extras
        acc = divsum[dv]
        acc["pers"] += r["pers"]
        if r.get("shortCd"):
            no_lanes.append(code)
            continue
        for i in range(11):
            acc["bands"][i] += r["bands"][i]
        for k in ("eng", "oth", "aus", "totc", "cobns", "uni", "eduns",
                  "bluen", "occd"):
            acc[k] += r[k]
        for i in range(len(COB_KEYS01)):
            acc["cobn"][i] += r["cobn"][i]
        for i in range(6):
            acc["sch01"][i] += r["sch01"][i]
            acc["ten01"][i] += r["ten01"][i]
        for i in range(len(REL_KEYS_01)):
            acc["rel01"][i] += r["rel01"][i]
        acc["relNS"] += r["rel01ns"]
        acc["relTot"] += r["rel01tot"]
        acc["famN"] += r["fam01"][2]
        acc["famD"] += r["fam01"][4]
        acc["indig"] += r["ind01"]
        acc["indigDen"] += r["b1Persons"] - r["b1ov"]
    no_lanes_pop = sum(people[c]["pers"] for c in no_lanes)

    def shares(rec):
        per = rec["pers"]
        if per == 0:
            return None
        eo = rec["eng"] + rec["oth"]
        fb = rec["totc"] - rec["cobns"]
        p15 = per - rec["bands"][0] - rec["bands"][1]
        uden = p15 - rec["eduns"]
        bsum = sum(rec["bands"])
        s = {
            "persons": per,
            "cov": 1.0,
            "langOther": round(rec["oth"] / eo, 4) if eo > 0 else None,
            "fborn":
                round((fb - rec["aus"]) / fb, 4) if fb > 0 else None,
            "uni": round(rec["uni"] / uden, 4) if uden > 0 else None,
            "blue": round(rec["bluen"] / rec["occd"], 4)
            if rec["occd"] > 0 else None,
            "age": {b: round(rec["bands"][i] / bsum, 4)
                    for i, b in enumerate(BANDS)},
            "u15": (round((rec["bands"][0] + rec["bands"][1]) / bsum, 4)
                    if bsum > 0 else None),
        }
        if rec.get("sch01") is not None:
            sc = rec["sch01"]  # [y11..dng five below-Y12, y12] stated
            s["y12less"] = (round(sum(sc[:5]) / sum(sc), 4)
                            if sum(sc) > 0 else None)
        if rec.get("indig") is not None and rec.get("indigDen"):
            s["atsci"] = round(rec["indig"] / rec["indigDen"], 4)
        if rec.get("rel01") is not None and rec.get("relTot") is not None:
            relbd = rec["relTot"] - rec.get("relNS", 0)
            s["rel"] = {k: round(rec["rel01"][i] / relbd, 4)
                        if relbd > 0 else None
                        for i, k in enumerate(REL_KEYS_01)}
        if rec.get("ten01") is not None:
            own, mort, rent, stha, oth, tns = rec["ten01"]
            tend = own + mort + rent + oth
            s["ten"] = {k: round({"mort": mort, "rent": rent,
                                  "own": own, "rentPub": stha}[k] / tend,
                                 4) if tend > 0 else None
                        for k in TEN_KEYS}
        if rec.get("famN") is not None and rec.get("famD"):
            s["onepar"] = round(rec["famN"] / rec["famD"], 4)
        if rec.get("cobn") is not None:
            # the birthplace menu: shares on the same stated-birthplace
            # basis as fborn itself (Never the blend's — cob rides the
            # measured store; demoI never carries it)
            s["cob"] = {k: round(rec["cobn"][i] / fb, 4) if fb > 0
                        else None
                        for i, k in enumerate(COB_KEYS01)}
        return s

    nat = defaultdict(int)
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd"):
            nat[k] += dv[k]
        for i in range(11):
            nat.setdefault("bands", [0] * 11)
            nat["bands"][i] += dv["bands"][i]
        for i in range(6):
            nat.setdefault("sch01", [0] * 6)
            nat.setdefault("ten01", [0] * 6)
            nat["sch01"][i] += dv["sch01"][i]
            nat["ten01"][i] += dv["ten01"][i]
        for i in range(len(REL_KEYS_01)):
            nat.setdefault("rel01", [0] * len(REL_KEYS_01))
            nat["rel01"][i] += dv["rel01"][i]
        for k in ("relNS", "relTot", "indig", "indigDen",
                  "famN", "famD"):
            nat[k] += dv[k]
    nat_eo = nat["eng"] + nat["oth"]
    nat_fb = nat["totc"] - nat["cobns"]
    nat_p15 = nat["pers"] - nat["bands"][0] - nat["bands"][1]
    natcob = [sum(dv["cobn"][i] for dv in divsum.values())
              for i in range(len(COB_KEYS01))]
    national = {
        "persons": nat["pers"],
        "langOther": round(nat["oth"] / nat_eo, 4),
        "fborn": round((nat_fb - nat["aus"]) / nat_fb, 4),
        "uni": round(nat["uni"] / (nat_p15 - nat["eduns"]), 4),
        "blue": round(nat["bluen"] / nat["occd"], 4),
        "age0_14": round((nat["bands"][0] + nat["bands"][1]) /
                         nat["pers"], 4),
        "age65ov": round(sum(nat["bands"][8:]) / nat["pers"], 4),
        "cob": {k: round(natcob[i] / nat_fb, 4)
                for i, k in enumerate(COB_KEYS01)},
        "u15": round((nat["bands"][0] + nat["bands"][1]) /
                     nat["pers"], 4),
        "y12less": round(sum(nat["sch01"][:5]) / sum(nat["sch01"]), 4),
        "atsci": round(nat["indig"] / nat["indigDen"], 4),
        "onepar": round(nat["famN"] / nat["famD"], 4),
        "rel": {k: round(nat["rel01"][i]
                         / (nat["relTot"] - nat["relNS"]), 4)
                for i, k in enumerate(REL_KEYS_01)},
        "ten": {k: round({"mort": nat["ten01"][1],
                          "rent": nat["ten01"][2],
                          "own": nat["ten01"][0],
                          "rentPub": nat["ten01"][3]}[k]
                         / (nat["ten01"][0] + nat["ten01"][1]
                            + nat["ten01"][2] + nat["ten01"][4]), 4)
                for k in TEN_KEYS},
    }
    # measured-once pin (first verified run): the tally's own total
    # (18,652,828) less the 8,249 people in the dropped offshore class
    # = 18,644,579; the published 2001 census count is 18,769,249 with
    # overseas visitors in it (subtracted inside the BCP totals here).
    # Run-to-run drift in sealed inputs is caught exactly
    pin = 18644579
    if abs(national["persons"] - pin) > 400:
        fail(f"national persons {national['persons']} drifts the "
             f"pin {pin} (tally {18652828} - offshore 8249)")

    out_booths = []
    geo_missing = geo_empty = 0
    for vb in booths:
        rec = {"div": vb["div"], "divId": vb["divId"],
               "state": vb["state"], "boothId": vb["boothId"],
               "booth": vb["booth"], "type": vb["type"]}
        key = vb.get("geo")
        r = people.get(str(key)) if key is not None else None
        if r is None:
            geo_missing += 1
            rec["demo"] = None
        elif r.get("shortCd"):
            # ABS shipped a headcount only for this CD: people counted,
            # every lane untabled — never a fabricated share
            rec["demo"] = {"persons": r["pers"], "cov": 1.0,
                           "langOther": None, "fborn": None, "uni": None,
                           "blue": None, "age": None,
                           "y12less": None, "atsci": None, "u15": None,
                           "onepar": None, "rel": None, "ten": None}
        else:
            rec["demo"] = shares({
                "pers": r["pers"], "bands": r["bands"],
                "eng": r["eng"], "oth": r["oth"],
                "aus": r["aus"], "totc": r["totc"], "cobns": r["cobns"],
                "uni": r["uni"], "eduns": r["eduns"],
                "bluen": r["bluen"], "occd": r["occd"],
                "cobn": r.get("cobn"),
                "sch01": r.get("sch01"),
                "indig": r.get("ind01"),
                "indigDen": (r.get("b1Persons", 0) - r.get("b1ov", 0)),
                "rel01": r.get("rel01"),
                "relNS": r.get("rel01ns"),
                "relTot": r.get("rel01tot"),
                "ten01": r.get("ten01"),
                "famN": r.get("fam01", [0] * 5)[2],
                "famD": r.get("fam01", [0] * 5)[4]})
            if rec["demo"] is None:
                geo_empty += 1
        out_booths.append(rec)

    # d13's division-row emission shape (no income keys here)
    divstate = {b["div"]: b["state"] for b in booths}
    divisions = []
    for name in sorted(divsum, key=lambda n: (STATE_ORDER[divstate[n]],
                                              n)):
        divisions.append({"div": name, "state": divstate[name],
                          **shares(divsum[name])})
    counts = {
        "booths": len(out_booths),
        "boothsGeo": len(out_booths) - geo_missing - geo_empty,
        "boothsGeoMissing": geo_missing,
        "boothsGeoEmpty": geo_empty,
        "divisions": len(divisions),
        "cdsBcpTally": len(people),
        "cdsAlloc": len(alloc),
        "cdsShortTable": len(no_lanes),
        "personsShortTable": no_lanes_pop,
        "national": national,
    }
    about = (
        "Census-people basis store for the 2004 federal election (the "
        "2001-census c0 side of the 2004 people-interpolation lane; "
        "the two sides blend to election day at the SEIFA pcti lane's "
        "day-share, see the demoInterp record). The people-smallest-area "
        "is a 2001-census collection district (ASGC 2001 CD): a booth's "
        "demo block is the 2001 Basic Community Profile counts of the "
        "CD its venue sits in — the venue's neighbourhood, never the "
        "booth's voters, mapped by data/booth-seifa-2004.json's own "
        "`geo` field (most 2004 premises coords are carried from the "
        "2007 poll-book addresses; counts.boothsGeoMissing/"
        "boothsGeoEmpty are the rows the carry never reached or that "
        "stand outside a populated CD). A division's row is the exact "
        "2001-BCP sum over the CDs whole-allocated to its division "
        "(seifa-src/cd-2001-ced-2003ed.json), real headcounts, never "
        "vote-weighted pseudo-populations. The 2001 BCP ships as "
        "~35,000 per-CD spreadsheets (no bulk 2001 datapack on "
        "abs.gov.au; source is the archive.org mirror of the ABS "
        "CDATA-era product), tallied per CD into an extraction table by "
        "extract-bcp-2001-tally.py, and overseas visitors ride their "
        "own row inside several 2001 tables' totals and are subtracted "
        "so every lane is the as-enumerated resident count the GCP-era "
        "products take. Two balance-area CDs carry a truncated workbook "
        "(no demographic tables) and count people but share no lanes "
        "(counts.cdsShortTable/personsShortTable — the not-stated "
        "doctrine over whole tables). Anglophone-age-language-foreign-"
        "born-uni shares mirror d13's; OCCUPATION is the ASCO "
        "classification "
        "(pre-ANZSCO): blue-collar maps {Tradespersons, Intermediate "
        "Production & Transport, Labourers} onto the ANZSCO 3/7/8 lane "
        "(broadly comparable per ABS, the named definitional wobble). "
        "The new lane set rides the BCP's own 2001 tables: B 10's "
        "Religion menu ten shares (rel, key order in relKeys, "
        "No-religion leading; the orth lane sums the edition's two "
        "\"Orthodox\"/\"Oriental Christian\" rows) over the "
        "ex-affiliation-not-stated persons-ex-overseas basis (B 10's "
        "grand and B 01's persons row disagree by ~0.2% per CD inside "
        "the 2001 product itself, so the religion basis is B 10's own "
        "grand less its not-stated and overseas rows); B 12's "
        "year-12-or-less over the stated schooling levels (its "
        "\"Still at school\" row kept out of the basis to hold the "
        "GCP-era stated-level frame); B 01's total Indigenous persons "
        "over persons ex-overseas — the 2001 product publishes no "
        "Indigenous-status-not-stated row, so the lane's basis is "
        "persons ex-overseas and the share runs a few per cent "
        "relative under the later editions' ex-not-stated basis; "
        "B 19's Housing-tenure menu four shares (ten, key order in "
        "tenKeys, owned-with-mortgage leading; the 2001 print has no "
        "grand-total column; its rented total rides the printed "
        "rented-total column) over the ex-tenure-not-stated "
        "occupied-private-dwellings basis; B 17's one-parent share "
        "of families; and the under-15 share of the stated ages. "
        "Birthplace countries ride cobKeys/cob on the measured side "
        "(the /map/ Born-overseas country menu: whole-UK leading as eng "
        "leads the 2021-era menu, then the era's eight); the interp "
        "blend's demoI never carries a cob key — cob is read measured, "
        "never blended. No income lanes: the repo's income floor stays at the 2013 "
        "election, so this store carries no incomeCuts record and its "
        "demo blocks carry no income keys; 2007-and-later years ride "
        "the SEIFA-excluded-turnout voter-games lane or the "
        "intercensal blends.")
    out = {
        "_about": about,
        "_provenance": {
            "sourceUrls": {
                "bcp": "ABS 2001 Census Basic Community Profile, "
                       "per-CD xlsx (archive.org mirror of the "
                       "CDATA-era CD product, "
                       "identifier 2001-bcp-cd-00_aus)",
                "tally": "cache/bcp-2001-cd-tally.json "
                         "(extract-bcp-2001-tally.py)",
                "alloc": ".build/analysis/seat-model/seifa-src/"
                         "cd-2001-ced-2003ed.json "
                         "(derive-cd-2001-ced-alloc.py)",
                "venue": "data/booth-seifa-2004.json",
                "gpkg": "dl/asgc2001.gpkg (ABS 2001 ASGC digital "
                        "boundaries)",
            },
            "files": {
                ".build/analysis/seat-model/cache/"
                "bcp-2001-cd-tally.json": hash16(TALLY),
                ".build/analysis/seat-model/seifa-src/"
                "cd-2001-ced-2003ed.json": hash16(ALLOC),
                "data/booth-seifa-2004.json": hash16(VENUE),
            },
            "extractedAt": str(date.today()),
        },
        "election": 2004,
        "censusEdition": 2001,
        "cobKeys": COB_KEYS01,
        "relKeys": list(REL_KEYS_01),
        "tenKeys": list(TEN_KEYS),
        "deliveryBasis": (
            "venue-CD lookup per booth (the venue seifa store's own "
            "2001-CD geo of the premises); exact CD sum per division "
            "(cd-2001-ced-2003ed)"),
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    print(f"OK -> {OUT} (booths {len(out_booths)}, geo-missing "
          f"{geo_missing}, geo-empty {geo_empty}, divisions "
          f"{len(divisions)}, national {national})")


if __name__ == "__main__":
    main()
