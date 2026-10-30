#!/usr/bin/env python3
"""data/booth-demo-2001.json — the measured census-people store for the
2001 federal election's /map/ frame (the /map/ People lanes now start
at the 2001 election).

This store is the 2001 ELECTION joining its own census, measured-only:
the 2001 census night (7 Aug 2001) sat ~3 months before election day
(10 Nov 2001), so there is no intercensal blend for this frame — the
same measured-only posture the SEIFA side classes the 2001 election
under (seifa-src/div-interp.json: 1998/2001/2022/2025/2028 carry no
pcti). Should a 2006-census c1 side ever be built, the interp machine
(derive-booth-demo-interp.py) consumes this store's schema unchanged.

The people recipes and the store's shape mirror the 2004 election's c0
side (derive-booth-demo-2001.py) VERBATIM — same tally
(cache/bcp-2001-cd-tally.json), same division-sum doctrine over a CD
allocation, same shares, same ASCO→blue wobble, same offshore drop —
with these frame differences:

  * A division's row rides seifa-src/cd-2001-ced-2001set.json — the
    2001 census CDs allocated to the divisions the ELECTION ITSELF was
    fought on (the 2004 lane uses the 2003-edition set).
  * The booth store (data/booth-seifa-2001.json, derive-2001-venues.py)
    carries no 2001-CD `geo` code the way data/booth-seifa-2004.json
    does — its `geo` is a coordinate-PROVENANCE label. The frame's CD
    join is computed here, in three tiers:
      1. inherit: the ~6.3k venues whose coordinates are inherited from
         the 2004 store (geo "gpp 2004") take THAT store's own 2001-CD
         code — same building, same coordinates, the 2004 lane's own
         point-in-CD result mirrored, never re-figured;
      2. pip: the remaining coorded venues (inheritances from later
         stores, "gpp <year>") are pointed into the 2001 CD polygons
         (derive-booth-seifa-hist.py's build_locate("cd2001") — the
         same engine that assigned the 2004 store's codes);
      3. honest-null: the suburb-tier venues (geo "suburb" — a suburb
         centroid can span many CDs, naming one would be
         dishonest-lucky) and the coordinate-less rows carry
         demo:null (counts.boothsSuburbTier / boothsNoCoords), the
         same emit-no-number doctrine the GCP-era stores apply to
         their own join classes.

Guards fail loud (division-set drift vs the venue store and the
classification block's 2001 set, alloc unit drift, tally unlock,
national persons inside the published envelope).
Run:  python3 .build/analysis/seat-model/derive-booth-demo-2001-frame.py
Test: node .build/analysis/seat-model/test-booth-demo-2001-frame.mjs
"""

import importlib.util
import json
import re
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


lane = _lib("lane2004", "derive-booth-demo-2001.py")
hist = _lib("hist", "derive-booth-seifa-hist.py")
fail, hash16 = lane.fail, lane.hash16

# verbatim recipe carry: tally loader, share composition and the
# BANDS/STATE_ORDER tables live on the 2004-election lane this script
# shadows (its shares() nests inside main(), so the recipe text is
# mirrored below — keep the two in lock-step, birthplace menu included)
load_tally = lane.load_tally
STATE_ORDER = lane.STATE_ORDER
BANDS = lane.BANDS
COB_KEYS01 = lane.COB_KEYS01
REL_KEYS01 = lane.REL_KEYS_01
TEN_KEYS = lane.TEN_KEYS
ilanes = lane.ilanes
INC_BANDS01 = lane.INC_BANDS01

TALLY = SM / "cache/bcp-2001-cd-tally.json"
ALLOC = SM / "seifa-src/cd-2001-ced-2001set.json"
VENUE = ROOT / "data/booth-seifa-2001.json"
VENUE04 = ROOT / "data/booth-seifa-2004.json"
OUT = ROOT / "data/booth-demo-2001.json"


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load_booth_geo04():
    """the 2004 store's identity keys -> its 2001-CD geo code. A key
    that splits (same premises enrolled under two 2004-era rows in
    different CDs — boundary artefacts) is crowded OUT of the map, not
    tie-broken: those venues inherit nothing and take the pip tier of
    their own coordinates instead."""
    s04 = json.loads(VENUE04.read_text())
    geo, conflict = {}, {}
    for b in s04["booths"]:
        g = b.get("geo")
        if not g or not str(g).isdigit():
            continue
        st = b.get("premisesState") or b["state"]
        for keyname in (b["venue"], b["booth"]):
            k = (norm(keyname), norm(b["suburb"]), st)
            if not k[0] or not k[2]:
                continue
            if k in geo and geo[k] != str(g):
                conflict[k] = {geo[k], str(g)}
                del geo[k]
            else:
                geo.setdefault(k, str(g))
    if conflict:
        print(f"  {len(conflict)} identity keys split across 2001-CDs "
              "in the 2004 store (e.g. "
              f"{next(iter(conflict))}) — those venues take the pip tier")
    print(f"2004-store CD inherit map: {len(geo)} identity keys")
    return geo


def shares(rec):
    # recipe text mirrored from derive-booth-demo-2001.py's nested
    # shares() — the 2001 BCP lane's own composition (see the docstring
    # note; any change belongs in both files)
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
        "fborn": round((fb - rec["aus"]) / fb, 4) if fb > 0 else None,
        "uni": round(rec["uni"] / uden, 4) if uden > 0 else None,
        "blue": round(rec["bluen"] / rec["occd"], 4)
        if rec["occd"] > 0 else None,
        "age": {b: round(rec["bands"][i] / bsum, 4)
                for i, b in enumerate(BANDS)},
        "u15": (round((rec["bands"][0] + rec["bands"][1]) / bsum, 4)
                if bsum > 0 else None),
    }
    # the six new People lanes over the same tally (the 2004-election
    # lane's own map of the B 10/B 12/B 17/B 19/B 01 tables — keep the
    # two in lock-step)
    if rec.get("sch01") is not None:
        sc = rec["sch01"]
        s["y12less"] = round(sum(sc[:5]) / sum(sc), 4) if sum(sc) > 0 else None
    if rec.get("indig") is not None and rec.get("indigDen"):
        s["atsci"] = round(rec["indig"] / rec["indigDen"], 4)
    if rec.get("rel01") is not None and rec.get("relTot") is not None:
        relbd = rec["relTot"] - rec.get("relNS", 0)
        s["rel"] = {k: round(rec["rel01"][i] / relbd, 4) if relbd > 0
                    else None
                    for i, k in enumerate(REL_KEYS01)}
    if rec.get("ten01") is not None:
        own, mort, rent, stha, oth, tns = rec["ten01"]
        tend = own + mort + rent + oth
        s["ten"] = {k: round({"mort": mort, "rent": rent,
                              "own": own, "rentPub": stha}[k] / tend, 4)
                    if tend > 0 else None
                    for k in TEN_KEYS}
    if rec.get("famN") is not None and rec.get("famD"):
        s["onepar"] = round(rec["famN"] / rec["famD"], 4)
    if rec.get("incT") is not None and rec["incT"] > 0:
        tsum = rec["incT"]
        lo, hi = rec["incLo"], rec["incHi"]
        s["loinc"] = round(lo / tsum, 4) if 0 <= lo / tsum <= 1 \
            else None
        s["hiinc"] = round(hi / tsum, 4) if 0 <= hi / tsum <= 1 \
            else None
        med = ilanes.band_median(rec["incHH"], INC_BANDS01) \
            if rec.get("incHH") else None
        s["incMed"] = round(med) if med is not None else None
    if rec.get("cobn") is not None:
        # the birthplace menu: shares on the same stated-birthplace
        # basis as fborn itself (measured lane — no interp demoI ever
        # carries a cob key, per the app contract)
        s["cob"] = {k: round(rec["cobn"][i] / fb, 4) if fb > 0
                    else None
                    for i, k in enumerate(COB_KEYS01)}
    return s


def demo_of(r, inc=None):
    if r is None:
        return None
    if r.get("shortCd"):
        # ABS shipped a headcount only for this CD: people counted,
        # every lane untabled — never a fabricated share
        return {"persons": r["pers"], "cov": 1.0, "langOther": None,
                "fborn": None, "uni": None, "blue": None, "age": None,
                "u15": None, "y12less": None, "atsci": None,
                "onepar": None, "rel": None, "ten": None,
                "loinc": None, "hiinc": None, "incMed": None}
    return shares({
        "pers": r["pers"], "bands": r["bands"], "eng": r["eng"],
        "oth": r["oth"], "aus": r["aus"], "totc": r["totc"],
        "cobns": r["cobns"], "uni": r["uni"], "eduns": r["eduns"],
        "bluen": r["bluen"], "occd": r["occd"], "cobn": r.get("cobn"),
        "sch01": r.get("sch01"),
        "indig": r.get("ind01"),
        "indigDen": (r.get("b1Persons", 0) - r.get("b1ov", 0)),
        "rel01": r.get("rel01"),
        "relNS": r.get("rel01ns"),
        "relTot": r.get("rel01tot"),
        "ten01": r.get("ten01"),
        "famN": r.get("fam01", [0] * 5)[2],
        "famD": r.get("fam01", [0] * 5)[4],
        **({"incT": inc[0], "incLo": inc[1], "incHi": inc[2],
            "incHH": list(inc[4])} if inc else {})})


def main():
    people = load_tally()  # re-runs the 2004 lane's own shape gates
    # the 2001-edition income lanes over the same tally (B 30/B 31),
    # the 2004-election lane's own recipe — keep the two in lock-step
    inc_rows = {}
    for code, r in people.items():
        if not r.get("fiTot01"):
            continue
        fi, hh, mixraw = r["fiTot01"], r["hiTot01"], r["fiMix01"]
        inc_rows[code] = (
            [hh[0] + hh[1]] + hh[2:],
            [fi[0] + fi[1]] + fi[2:],
            [[mixraw[0 + k] + mixraw[4 + k] for k in range(4)]] +
            [[mixraw[8 + g * 4 + k] for k in range(4)]
             for g in range(11)])
    ad, nonfam = ilanes.income_factors()
    inc_map, inc_cut, inc_hishare = ilanes.engine(
        inc_rows, INC_BANDS01, ad, nonfam, "01")
    print(f"income: B 30/B 31 CD, {len(inc_rows)} rows, national 25% "
          f"cut ${inc_cut:.0f}/wk; top band {inc_hishare:.4f} of adults")
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

    # division sums: exact 2001-BCP totals over the whole-alloc set (the
    # 2001-election division set) — short-table CDs count people, never
    # enter lane pools (the not-stated doctrine over whole tables)
    no_lanes = []
    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * 11,
                                  "eng": 0, "oth": 0, "aus": 0,
                                  "totc": 0, "cobns": 0, "uni": 0,
                                  "eduns": 0, "bluen": 0, "occd": 0,
                                  "cobn": [0] * len(COB_KEYS01),
                                  "sch01": [0] * 6,
                                  "indig": 0, "indigDen": 0,
                                  "rel01": [0] * len(REL_KEYS01),
                                  "relNS": 0, "relTot": 0,
                                  "ten01": [0] * 6,
                                  "famN": 0, "famD": 0,
                                  "incT": 0.0, "incLo": 0.0,
                                  "incHi": 0.0,
                                  "incHH": [0] * len(INC_BANDS01)})
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
        for i in range(len(REL_KEYS01)):
            acc["rel01"][i] += r["rel01"][i]
        acc["relNS"] += r["rel01ns"]
        acc["relTot"] += r["rel01tot"]
        acc["famN"] += r["fam01"][2]
        acc["famD"] += r["fam01"][4]
        acc["indig"] += r["ind01"]
        acc["indigDen"] += r["b1Persons"] - r["b1ov"]
        inc = inc_map.get(code)
        if inc is not None:
            acc["incT"] += inc[0]
            acc["incLo"] += inc[1]
            acc["incHi"] += inc[2]
            for i in range(len(INC_BANDS01)):
                acc["incHH"][i] += inc[4][i]
    no_lanes_pop = sum(people[c]["pers"] for c in no_lanes)

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
        for k in ("relNS", "relTot", "indig", "indigDen",
                  "famN", "famD"):
            nat[k] += dv[k]
        for k in ("incT", "incLo", "incHi"):
            nat[k] += dv[k]
        for i in range(len(INC_BANDS01)):
            nat.setdefault("incHH", [0] * len(INC_BANDS01))
            nat["incHH"][i] += dv["incHH"][i]
        for i in range(len(REL_KEYS01)):
            nat.setdefault("rel01", [0] * len(REL_KEYS01))
            nat["rel01"][i] += dv["rel01"][i]
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
                for i, k in enumerate(REL_KEYS01)},
        "ten": {k: round({"mort": nat["ten01"][1],
                          "rent": nat["ten01"][2],
                          "own": nat["ten01"][0],
                          "rentPub": nat["ten01"][3]}[k]
                         / (nat["ten01"][0] + nat["ten01"][1]
                            + nat["ten01"][2] + nat["ten01"][4]), 4)
                for k in TEN_KEYS},
        "loinc": round(nat["incLo"] / nat["incT"], 4),
        "hiinc": round(nat["incHi"] / nat["incT"], 4),
        "incMed": round(ilanes.band_median(nat["incHH"], INC_BANDS01)),
    }
    # measured-once pin (the 2004 lane's own figure): the tally total
    # (18,652,828) less the 8,249 people of the dropped offshore class
    # = 18,644,579 — this alloc drops the same ABS offshore class (its
    # 93 units, same population), so the pin carries letter-for-letter
    pin = 18644579
    if abs(national["persons"] - pin) > 400:
        fail(f"national persons {national['persons']} drifts the "
             f"pin {pin} (tally {18652828} - offshore 8249)")

    geo04 = load_booth_geo04()
    locate, _polys, _null = hist.build_locate("cd2001")

    out_booths = []
    clase = {"inherit": 0, "pip": 0, "suburb": 0, "nocoords": 0,
             "pip_miss": 0}
    geo_missing = geo_empty = 0
    for vb in booths:
        rec = {"div": vb["div"], "divId": vb["divId"],
               "state": vb["state"], "boothId": vb["boothId"],
               "booth": vb["booth"], "type": vb["type"]}
        tag = vb.get("geo")
        code = None
        if tag == "gpp 2004":
            st = vb.get("premisesState") or vb["state"]
            code = (geo04.get((norm(vb["venue"]), norm(vb["suburb"]), st))
                    or geo04.get((norm(vb["booth"]), norm(vb["suburb"]), st)))
            if code is not None:
                clase["inherit"] += 1
            # a None here (the 2004 twin never got a CD) falls to pip below
        if code is None and tag and tag.startswith("gpp ") and \
                vb.get("lat") and vb.get("lon"):
            code = locate(vb["lon"], vb["lat"])
            if code is not None:
                clase["pip"] += 1
            else:
                clase["pip_miss"] += 1
        if code is None:
            if tag == "suburb":
                clase["suburb"] += 1
            elif not tag or not tag.startswith("gpp "):
                clase["nocoords"] += 1
        r = people.get(str(code)) if code is not None else None
        demo = demo_of(r, inc_map.get(str(code)) if code is not None
                       else None)
        if r is None:
            geo_missing += 1
        elif demo is None:
            geo_empty += 1
        rec["demo"] = demo
        out_booths.append(rec)

    divisions = []
    divstate = {b["div"]: b["state"] for b in booths}
    for name in sorted(divsum, key=lambda n: (STATE_ORDER[divstate[n]],
                                              n)):
        divisions.append({"div": name, "state": divstate[name],
                          **shares(divsum[name])})

    counts = {
        "booths": len(out_booths),
        "boothsGeo": len(out_booths) - geo_missing - geo_empty,
        "boothsGeoMissing": geo_missing,
        "boothsGeoEmpty": geo_empty,
        "boothsCdInherit2004": clase["inherit"],
        "boothsCdPip": clase["pip"],
        "boothsCdPipMiss": clase["pip_miss"],
        "boothsSuburbTier": clase["suburb"],
        "boothsNoCoords": clase["nocoords"],
        "divisions": len(divisions),
        "cdsBcpTally": len(people),
        "cdsAlloc": len(alloc),
        "cdsShortTable": len(no_lanes),
        "personsShortTable": no_lanes_pop,
        "national": national,
    }
    about = (
        "Census-people basis store for the 2001 federal election frame — "
        "the measured 2001-census lane joined to its own election "
        "(no intercensal blend: census night sat ~3 months before "
        "election day; the SEIFA pcti side classes this election "
        "measured-only too, seifa-src/div-interp.json). The "
        "people-smallest-area is a 2001-census collection district "
        "(ASGC 2001 CD): a booth's demo block is the 2001 Basic "
        "Community Profile counts of the CD its venue stands in — the "
        "venue's neighbourhood, never the booth's voters. The venue CD "
        "is computed three-tiered (data/booth-seifa-2001.json carries "
        "coordinate provenance, not CD codes): 'gpp 2004' rows inherit "
        "the 2004 store's own 2001-CD code for the same premises "
        "(counts.boothsCdInherit2004); other coorded rows are pointed "
        "into the 2001 CD polygons (counts.boothsCdPip, misses "
        "counts.boothsCdPipMiss); suburb-tier venues (a suburb centroid "
        "can span many CDs) and coordinate-less rows carry demo:null "
        "(counts.boothsSuburbTier / boothsNoCoords — no number from a "
        "dishonest join). A division's row is the exact 2001-BCP sum "
        "over the CDs whole-allocated to its 2001-election division "
        "(seifa-src/cd-2001-ced-2001set.json), real headcounts, never "
        "vote-weighted pseudo-populations. The 2001 BCP ships as "
        "~35,000 per-CD spreadsheets (no bulk 2001 datapack on "
        "abs.gov.au; source is the archive.org mirror of the ABS "
        "CDATA-era product), tallied per CD into an extraction table by "
        "extract-bcp-2001-tally.py, and overseas visitors ride their "
        "own row inside several 2001 tables' totals and are subtracted "
        "so every lane is the as-enumerated resident count the GCP-era "
        "products take. The six new People lanes ride the 2001 BCP's "
        "own tables identically to the 2004-election lane: B 10's "
        "Religion menu ten shares (rel, key order in relKeys, "
        "No-religion leading; the orth lane sums the edition's two "
        "\"Orthodox\"/\"Oriental Christian\" rows) over the "
        "ex-affiliation-not-stated persons-ex-overseas basis, B 12's "
        "year-12-or-less over the printed stated schooling levels "
        "(its \"Still at school\" row kept out of the basis to hold "
        "the GCP-era frame), B 01's total Indigenous persons over "
        "persons ex-overseas (the 2001 product publishes no "
        "Indigenous-status-not-stated row, so the lane's basis is "
        "persons ex-overseas — the share runs a few per cent relative "
        "under the later editions' ex-not-stated basis), B 19's "
        "Housing-tenure menu four shares (ten, key order in tenKeys, "
        "owned-with-mortgage leading; the 2001 print has no "
        "grand-total column, its rented total riding its own printed "
        "column) over the ex-tenure-not-stated "
        "occupied-private-dwellings basis, B 17's one-parent share of "
        "families, and the under-15 share of the stated ages; B 30's "
        "family-income x type grid and B 31's household grid feed the "
        "income lanes through the shared income engine identically to "
        "the 2004-election lane (loinc the adult share below the "
        "incomeCuts record's national 25th-percentile weekly cut in "
        "2001 dollars, hiinc the adult share in the $2,000-or-more "
        "top band — this edition's hi edge — incMed the "
        "band-interpolated median weekly household income on the "
        "household basis). Two "
        "balance-area CDs carry a truncated workbook "
        "(no demographic tables) and count people but share no lanes "
        "(counts.cdsShortTable/personsShortTable — the not-stated "
        "doctrine over whole tables). Anglophone-age-language-foreign-"
        "born-uni shares mirror the 2004-election lane's (which mirrors "
        "d13's); OCCUPATION is the ASCO classification (pre-ANZSCO): "
        "blue-collar maps {Tradespersons, Intermediate Production & "
        "Transport, Labourers} onto the ANZSCO 3/7/8 lane (broadly "
        "comparable per ABS, the named definitional wobble). Birthplace "
        "countries ride cobKeys/cob (the /map/ Born-overseas country "
        "menu: whole-UK leading as eng leads the 2021-era menu, then "
        "the era's eight, all read from the same B 06 table).")
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
                         "cd-2001-ced-2001set.json "
                         "(derive-cd-2001-ced-2001set.py)",
                "venue": "data/booth-seifa-2001.json",
                "venueInherit": "data/booth-seifa-2004.json (the 2001-CD "
                                "geo lane the 'gpp 2004' venues inherit)",
                "gpkg": "dl/asgc2001.gpkg (ABS 2001 ASGC digital "
                        "boundaries — the CD polygons and the "
                        "2001-edition CED layer both)",
            },
            "files": {
                ".build/analysis/seat-model/cache/"
                "bcp-2001-cd-tally.json": hash16(TALLY),
                ".build/analysis/seat-model/seifa-src/"
                "cd-2001-ced-2001set.json": hash16(ALLOC),
                "data/booth-seifa-2001.json": hash16(VENUE),
                "data/booth-seifa-2004.json": hash16(VENUE04),
            },
            "extractedAt": str(date.today()),
        },
        "election": 2001,
        "censusEdition": 2001,
        "cobKeys": COB_KEYS01,
        "relKeys": list(REL_KEYS01),
        "tenKeys": list(TEN_KEYS),
        "incomeCuts": {
            "loQuantile": ilanes.INC_LO_Q,
            "loCutWeekly": inc_cut,
            "hiEdgeWeekly": INC_BANDS01[-1][0],
            "hiNationalShare": inc_hishare,
            "dollarsYear": 2001,
            "adultsWeights": "data/income-dist.json",
            "medianBasis": "households (shares are per-adult)",
        },
        "deliveryBasis": (
            "venue-CD join per booth (inherit lane: the 2004 seifa "
            "store's own 2001-CD geo for the same premises; point-in-"
            "polygon of the venue's derived coordinates otherwise; "
            "suburb-tier and coordinate-less rows null); exact CD sum "
            "per division (cd-2001-ced-2001set)"),
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    print(f"OK -> {OUT} (booths {len(out_booths)}: inherit "
          f"{clase['inherit']}, pip {clase['pip']}, pip-miss "
          f"{clase['pip_miss']}, suburb {clase['suburb']}, no-coords "
          f"{clase['nocoords']}; divisions {len(divisions)}; national "
          f"{national})")


if __name__ == "__main__":
    main()
