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
B12_COLS = ["B1990", "B2104"]               # eng-only, other-lang
B39_COLS = ["B5167", "B5176", "B5185", "B5248"]  # pg,graddip,bach,ns
B44_COLS = [f"B{i}" for i in range(7153, 7161)]  # 8 major groups
PIN_ROWS = 38713  # exact CD universe across the nine state CSVs
STATE_ORDER = {s: i for i, s in
               enumerate(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT",
                          "ACT"])}


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
        for t in ("B01", "B09", "B12", "B39_B", "B44_B"):
            if not (CD06 / f"CD_{st}_{t}.csv").exists():
                fail(f"missing cd06 extracts ({CD06}); see module "
                     f"docstring")
    if not BCP_ZIP.exists():
        fail(f"missing {BCP_ZIP} (provenance anchor; ABS 2006 Census "
             f"datapacks, archive census06bcp.zip)")
    b01 = bcp_table("B01", ["B3"] + B01_BANDS)
    b09 = bcp_table("B09", B09_COLS)
    b12 = bcp_table("B12", B12_COLS)
    b39 = bcp_table("B39_B", B39_COLS)
    b44 = bcp_table("B44_B", B44_COLS)
    out = {}
    for code, g in b01.items():
        aus, cobns, totc = b09[code]
        eng, oth = b12[code]
        pg, gd, ba, eduns = b39[code]
        occ = b44[code]
        out[code] = {
            "pers": g[0],
            "ages": g[1:12],
            "eng": eng, "oth": oth,
            "aus": aus, "totc": totc, "cobns": cobns,
            "uni": pg + gd + ba,
            "eduns": eduns,
            "bluen": occ[2] + occ[6] + occ[7],
            "occd": sum(occ),
            "pop15": g[0] - g[1] - g[2],
        }
    print(f"BCP 2006: {len(out)} CDs")
    return out


def bounded(num, den):
    """A share of an ex-not-stated basis: none when the basis is empty,
    and none when BCP perturbation of a tiny CD takes the arithmetic
    outside [0,1] — emit no number rather than clamp one."""
    if den is None or num is None or den <= 0:
        return None
    v = num / den
    return round(v, 4) if 0 <= v <= 1 else None


def shares(rec):
    """The demo block shape, parity with derive-booth-demo-2013.py."""
    bsum = sum(rec["bands"])
    fb_den = rec["totc"] - rec["cobns"]
    uni_den = rec["pop15"] - rec["eduns"]
    return {
        "persons": rec["pers"],
        "cov": 1.0,
        "langOther": bounded(rec["oth"], rec["eng"] + rec["oth"]),
        "fborn": bounded(rec["totc"] - rec["cobns"] - rec["aus"], fb_den),
        "uni": bounded(rec["uni"], uni_den),
        "blue": bounded(rec["bluen"], rec["occd"]),
        "age": ({b: round(rec["bands"][i] / bsum, 4)
                 for i, b in enumerate(BANDS)} if bsum > 0 else None),
    }


def build_year(year, sa1):
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
                                  "cobns": 0, "uni": 0, "eduns": 0,
                                  "bluen": 0, "occd": 0, "pop15": 0})
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
            rec["demo"] = shares({
                "pers": row["pers"], "bands": list(row["ages"]),
                "eng": row["eng"], "oth": row["oth"],
                "aus": row["aus"], "totc": row["totc"],
                "cobns": row["cobns"], "uni": row["uni"],
                "eduns": row["eduns"], "bluen": row["bluen"],
                "occd": row["occd"], "pop15": row["pop15"]})
        out_booths.append(rec)

    # the national row pools DIVISION sums (the era-division universe),
    # not the venue CDs — a national reading of the election's geography
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "bluen", "occd", "pop15"):
            nat[k] += dv[k]
        for i, b in enumerate(BANDS):
            nat[b] = nat.get(b, 0) + dv["bands"][i]

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
            "country-of-birth stated; university (bachelor and above) "
            "per the aged-15+ population less "
            "level-of-education-not-stated; blue-collar (technicians/"
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
                       "collection districts (B01/B09/B12/B39_B/B44_B), "
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
        "deliveryBasis": ("venue-proxy per booth (collection district of "
                          "the premises); exact era-division census sum "
                          "per division"),
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    return out


def main():
    sa1 = load_bcp()
    for year in (2007, 2010):
        out = build_year(year, sa1)
        c = out["counts"]
        op = ROOT / f"data/booth-demo-{year}.json"
        op.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
        print(f"OK -> {op} (booths {c['booths']}, geo-missing "
              f"{c['boothsGeoMissing']}, geo-empty {c['boothsGeoEmpty']}, "
              f"divisions {c['divisions']}, national {c['national']})")


if __name__ == "__main__":
    main()
