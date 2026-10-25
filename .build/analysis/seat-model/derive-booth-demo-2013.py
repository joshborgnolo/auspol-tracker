#!/usr/bin/env python3
"""data/booth-demo-2013.json — census-people store for the 2013 election.

The voter-footprint demo lanes (data/booth-seifa-voter-YYYY.json,
derive-booth-seifa-voter.py) exist only from 2016 — the AEC published
its "Votes by SA1" product from 2016 onward. This is the venue-proxy
sibling (the deepest the census people lanes can go: ABS serves bulk
census datapacks for 2011/2016/2021 only, so the 2010 and older
elections — 2006-census era — are unfetchable):

  booths     the 2011 Census BCP counts of the SAME SA1 the booth's
             venue-proxy geo key names (data/booth-seifa-2013.json's
             SA1_7DIG11) — the venue's neighbourhood, never the booth's
             voters
  divisions  the exact 2011-census sums over the SA1s each division
             contains (ASGS CED-2011 membership — the boundaries the
             2013 election ran on), shares from the pooled count, never
             an average of booth rows

Deliberately NOT named booth-seifa-voter-2013.json: build_map_data.py
reads that name as the vote-weighted footprint contract, which a venue
proxy would silently mislabel.

Inputs (re-fetchable):
  .build/analysis/seat-model/cache/bcp-sa1-2011.zip — ABS 2011 Census
      Basic Community Profile, Statistical Area Level 1 for AUST,
      short-header CSVs (abs.gov.au census datapacks 2011_BCP_SA1;
      B01: persons + 11 age bands + inline English-only/other language;
      B09: country of birth; B40B: highest non-school qualification,
      persons block)
  data/booth-seifa-2013.json — committed: the 2013 booth universe and
      each booth's geo SA1 key
  .matilda/seifa-irsad-abs/dl/1270055003_ced_2011_aust_csv.zip — ABS
      ASGS Vol 3 July 2011, CED to SA1 allocation (SA1_MAINCODE_2011,
      CED_CODE/NAME incl. the 9 migratory/offshore + 9 no-usual-address
      pseudo-entries, which drop out)

Concordance: SA1_MAINCODE_2011 -> the BCP 7-digit region_id drops the
SA4+SA3 digits (code[0] + code[5:]) — the same decode the voter
pipeline uses, assert-verified on every run. The ABS CED file's
'Mcewen/Mcmillan/Mcpherson' spellings normalise to the AEC forms.

Guards fail loud (BCP header drift, SA1 universe drift, division-set
drift). Run:  python3 .build/analysis/seat-model/derive-booth-demo-2013.py
Test:  node .build/analysis/seat-model/test-booth-demo-2013.mjs
"""

import csv
import importlib.util
import io
import json
import sys
import zipfile
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

CACHE = SM / "cache"
ABS = ROOT / ".matilda/seifa-irsad-abs"
BCP_ZIP = CACHE / "bcp-sa1-2011.zip"
BCP_B01 = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
           "2011Census_B01_AUST_SA1_short.csv")
BCP_B09 = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
           "2011Census_B09_AUST_SA1_short.csv")
BCP_B40B = ("2011 Census BCP Statistical Areas Level 1 for AUST/AUST/"
            "2011Census_B40B_AUST_SA1_short.csv")
CED_ZIP = ABS / "dl/1270055003_ced_2011_aust_csv.zip"
VENUE = ROOT / "data/booth-seifa-2013.json"

BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
         "55_64", "65_74", "75_84", "85ov"]
AGECOLS = [f"Age_{b}_yr_P" for b in BANDS[:-1]] + ["Age_85ov_P"]
B09_COLS = ["Australia_P", "Country_birth_not_stated_P", "Tot_P"]
B40_COLS = ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
            "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]
RENAME = {"Mcewen": "McEwen", "Mcmillan": "McMillan",
          "Mcpherson": "McPherson"}
STATE_ORDER = {s: i for i, s in
               enumerate(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT",
                          "ACT"])}
DECLINED = 1  # --checklists accept no dropped or extra rows


def bcp_table(zipf, member, key_col, cols, pin_rows_low, pin_rows_high):
    """One BCP member -> {region_id: tuple(values)}, header-drift checked."""
    if member not in zipf.namelist():
        fail(f"BCP zip lacks {member}")
    out = {}
    with io.TextIOWrapper(zipf.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.reader(fh)
        head = [h.strip() for h in next(rdr)]
        want = [key_col] + cols
        miss = [c for c in want if c not in head]
        if miss:
            fail(f"{member}: header drift, missing {miss}")
        ix = [head.index(c) for c in want]
        for row in rdr:
            code = row[ix[0]].strip()
            if not (code.isdigit() and len(code) == 7):
                fail(f"{member}: SA1 key drift {code!r}")
            if code in out:
                fail(f"{member}: dup SA1 {code}")
            try:
                out[code] = tuple(int(row[i]) for i in ix[1:])
            except ValueError as e:
                fail(f"{member}: non-numeric cell at {code}: {e}")
    n = len(out)
    if not pin_rows_low <= n <= pin_rows_high:
        fail(f"{member}: {n} rows outside pin [{pin_rows_low},"
             f" {pin_rows_high}]")
    return out


def load_bcp():
    """Per SA1: persons, ages(11), eng, oth, aus, totc, cobns, uni, eduns."""
    if not BCP_ZIP.exists():
        fail(f"missing {BCP_ZIP} (ABS datapacks 2011_BCP_SA1 for AUST, "
             f"short-header; see module docstring)")
    z = zipfile.ZipFile(BCP_ZIP)
    g01 = bcp_table(z, BCP_B01, "region_id",
                    ["Tot_P_P", *AGECOLS,
                     "Lang_spoken_home_Eng_only_P",
                     "Lang_spoken_home_Oth_Lang_P"], 54805, 54805)
    b09 = bcp_table(z, BCP_B09, "region_id", B09_COLS, 54800, 54805)
    b40 = bcp_table(z, BCP_B40B, "region_id", B40_COLS, 54800, 54805)
    out = {}
    for code, g in g01.items():
        aus, cobns, totc = b09.get(code, (None, None, None))
        pg, gd, ba, eduns = b40.get(code, (None, None, None, None))
        out[code] = {
            "pers": g[0],
            "ages": g[1:12],
            "eng": g[12], "oth": g[13],
            "aus": aus, "totc": totc, "cobns": cobns,
            "uni": (pg + gd + ba) if pg is not None else None,
            "eduns": eduns,
            "pop15": g[0] - g[1] - g[2],
        }
    n05 = sum(1 for c in out.values() if c["aus"] is None)
    n40 = sum(1 for c in out.values() if c["uni"] is None)
    print(f"BCP 2011: {len(out)} SA1s (B09 short {n05}, B40B short {n40})")
    return out


def load_ced():
    """7-digit SA1 -> division name, on the 150-division set only."""
    if not CED_ZIP.exists():
        fail(f"missing {CED_ZIP} (ASGS Vol 3 July 2011 CED->SA1; "
             f".matilda/seifa-irsad-abs/dl/)")
    z = zipfile.ZipFile(CED_ZIP)
    mem = [n for n in z.namelist() if n.upper().endswith(".CSV")]
    if mem != ["CED_2011_AUST.csv"]:
        fail(f"CED zip members drifted {mem}")
    out = {}
    skipped = 0
    with io.TextIOWrapper(z.open(mem[0]), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        want = ["SA1_MAINCODE_2011", "CED_CODE_2011", "CED_NAME_2011"]
        miss = [c for c in want if c not in (rdr.fieldnames or [])]
        if miss:
            fail(f"CED_2011_AUST.csv: header drift, missing {miss}")
        n = 0
        for row in rdr:
            n += 1
            mc = row["SA1_MAINCODE_2011"].strip()
            if not (mc.isdigit() and len(mc) == 11):
                fail(f"CED_2011_AUST.csv: maincode drift {mc!r}")
            key7 = mc[0] + mc[5:]
            nm = row["CED_NAME_2011"].strip()
            if nm.startswith(("Migratory", "No usual address")):
                skipped += 1
                continue
            if key7 in out:
                fail(f"CED_2011_AUST.csv: dup SA1 {key7}")
            out[key7] = RENAME.get(nm, nm)
    if n != 54805:
        fail(f"CED_2011_AUST.csv: {n} rows != 54805")
    return out, skipped


def bounded(num, den):
    """A share of an ex-not-stated basis: none when the basis is empty,
    and none when BCP perturbation of a tiny SA1 takes the arithmetic
    outside [0,1] — emit no number rather than clamp one."""
    if den is None or num is None or den <= 0:
        return None
    v = num / den
    return round(v, 4) if 0 <= v <= 1 else None


def shares(rec):
    """The 2013 stores' demo block shape (voter-store demo shape parity)."""
    bsum = sum(rec["bands"])
    fb_den = None if rec["totc"] is None else rec["totc"] - rec["cobns"]
    uni_den = None if rec["uni"] is None else rec["pop15"] - rec["eduns"]
    return {
        "persons": rec["pers"],
        "cov": 1.0,
        "langOther": bounded(rec["oth"], rec["eng"] + rec["oth"]),
        "fborn": bounded(None if rec["totc"] is None
                         else rec["totc"] - rec["cobns"] - rec["aus"],
                         fb_den),
        "uni": bounded(rec["uni"], uni_den),
        "age": ({b: round(rec["bands"][i] / bsum, 4)
                 for i, b in enumerate(BANDS)} if bsum > 0 else None),
    }


def main():
    store = json.loads(VENUE.read_text(encoding="utf-8"))
    booths = store["booths"]
    if not booths or "geo" not in booths[0]:
        fail(f"{VENUE.name}: booth geo keys missing")
    sa1 = load_bcp()
    ced, ced_skipped = load_ced()
    divs_hist = sorted({b["div"] for b in booths})
    mapped = set(ced.values())
    if len(mapped) != 150:
        fail(f"CED_2011 maps {len(mapped)} divisions != 150")
    if mapped != set(divs_hist):
        fail(f"division drift: ced-only {sorted(mapped - set(divs_hist))} "
             f"venue-only {sorted(set(divs_hist) - mapped)}")
    # every division SA1 needs its three BCP tables
    short = {k for k in ced
             if sa1.get(k, {}).get("aus") is None
             or sa1.get(k, {}).get("uni") is None}
    if short:
        fail(f"CED-2011 SA1s short a BCP table: {sorted(short)[:8]}")

    divstate = {b["div"]: b["state"] for b in booths}
    divsum = defaultdict(lambda: {"pers": 0, "bands": [0] * len(BANDS),
                                  "eng": 0, "oth": 0, "aus": 0, "totc": 0,
                                  "cobns": 0, "uni": 0, "eduns": 0,
                                  "pop15": 0})
    for key, dv in ced.items():
        r = sa1[key]
        acc = divsum[dv]
        acc["pers"] += r["pers"]
        for i in range(len(BANDS)):
            acc["bands"][i] += r["ages"][i]
        acc["eng"] += r["eng"]
        acc["oth"] += r["oth"]
        for k in ("aus", "totc", "cobns", "uni", "eduns", "pop15"):
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
            # venue SA1 is uninhabited (commercial/industrial block): a
            # zero-person venue proxy carries no census people
            geo_empty += 1
            rec["demo"] = None
        else:
            rec["demo"] = shares({
                "pers": row["pers"], "bands": list(row["ages"]),
                "eng": row["eng"], "oth": row["oth"],
                "aus": row["aus"], "totc": row["totc"],
                "cobns": row["cobns"], "uni": row["uni"],
                "eduns": row["eduns"], "pop15": row["pop15"]})
        out_booths.append(rec)

    # the national row pools DIVISION sums (the CED-2011 universe), not
    # the venue SA1s — a national reading of the election's geography
    for dv in divsum.values():
        for k in ("pers", "eng", "oth", "aus", "totc", "cobns", "uni",
                  "eduns", "pop15"):
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
        "sa1Bcp": len(sa1),
        "sa1Ced": len(ced),
        "cedPseudoSkipped": ced_skipped,
        "national": {
            "persons": nat["pers"],
            "langOther": round(nat["oth"] / nat_eo, 4) if nat_eo else None,
            "fborn": round((nat_fbd - nat["aus"]) / nat_fbd, 4)
            if nat_fbd > 0 else None,
            "uni": round(nat["uni"] / nat_unid, 4) if nat_unid > 0 else None,
            "age0_14": round((nat["0_4"] + nat["5_14"]) / nat_b, 4),
            "age65ov": round(sum(nat[b] for b in BANDS[8:]) / nat_b, 4),
        },
    }
    out = {
        "_about": (
            "Census-people store for the 2013 federal election, the "
            "venue-proxy sibling of the voter-footprint demo lanes in "
            "data/booth-seifa-voter-YYYY.json (2016+; the AEC published "
            "no 'Votes by SA1' product before 2016, so a 2013 booth "
            "cannot be weighted by where its voters live). A booth's "
            "demo block is the 2011 Census Basic Community Profile "
            "counts of the SA1 its VENUE sits in — the geo key of "
            "booth-seifa-2013.json — describing the venue's "
            "neighbourhood, never the booth's voters; persons is a real "
            "SA1 headcount, never a weighted pseudo-population. A "
            "division's row is the exact 2011-census sum over the SA1s "
            "of its CED-2011 membership (the boundary set the 2013 "
            "election ran on; ABS Mcewen/Mcmillan/Mcpherson spellings "
            "normalised), not an average of its booth rows. Shares "
            "mirror the GCP lanes: age renormalised over the 11 B01 "
            "bands (no age-not-stated column); language other-at-home "
            "over English-only + other; overseas-born over "
            "country-of-birth stated; university (bachelor and above) "
            "per the aged-15+ population less "
            "level-of-education-not-stated. The national row pools the "
            "division sums. A booth whose venue SA1 records no "
            "residents (commercial/industrial blocks; "
            "counts.boothsGeoEmpty) carries demo:null, as does one "
            "whose geo key is absent from the BCP "
            "(counts.boothsGeoMissing); inside a present block a lane "
            "is nulled rather than clamped when the BCP's small-area "
            "perturbation would put its share outside [0,1] "
            "(counts.boothsGeo-carrying rows only). Booth records "
            "carry geo of data/booth-seifa-2013.json; its venue-proxy "
            "caveats apply here too."),
        "_provenance": {
            "sourceUrls": {
                "bcp": "ABS 2011 Census Basic Community Profile, SA1 for "
                       "AUST (B01/B09/B40B), abs.gov.au census datapacks",
                "ced": "ABS ASGS Vol 3 July 2011, CED to SA1 allocation "
                       "(1270055003_ced_2011_aust_csv.zip)",
                "venue": "data/booth-seifa-2013.json",
            },
            "files": {
                str(BCP_ZIP.relative_to(ROOT)): hash16(BCP_ZIP),
                str(CED_ZIP.relative_to(ROOT)): hash16(CED_ZIP),
                str(VENUE.relative_to(ROOT)): hash16(VENUE),
            },
            "extractedAt": str(date.today()),
        },
        "election": 2013,
        "censusEdition": 2011,
        "deliveryBasis": ("venue-proxy per booth (SA1 of the premises); "
                          "exact CED-2011 census sum per division"),
        "counts": counts,
        "divisions": divisions,
        "booths": out_booths,
    }
    op = ROOT / "data/booth-demo-2013.json"
    op.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n",
                  encoding="utf-8")
    print(f"OK -> {op} (booths {len(out_booths)}, geo-missing {geo_missing}, "
          f"divisions {len(divisions)}, national {counts['national']})")


if __name__ == "__main__":
    main()
