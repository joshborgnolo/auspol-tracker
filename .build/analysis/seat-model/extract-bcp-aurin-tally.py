#!/usr/bin/env python3
"""extract-bcp-aurin-tally.py — flatten the AURIN WFS census lane CSVs
(cache/bcp-{1991,1996}-aurin) into the per-CD share records the
people-interp derive chains read.

Emits cache/bcp-{year}-aurin-tally.json:

  {
    "_about": ...,
    "censusEdition": 1991|1996,
    "counts": {"cds": N, "national": {...}},
    "tally": {cd_code: {pers, bands(11), eng, oth, aus, totc, cobns,
                        uni, eduns, bluen, occd}, ...},
  }

Per-CD record fields, all computed from the census night's in-scope
queries on the resident population:

  pers       resident people (1991: b01's tot_p less its
             enumerations migratory/offshore bucket; 1996: b01's
             total_persons)
  bands(11)  age bands 0_4, 5_14, 15_19, 20_24, 25_34, 35_44, 45_54,
             55_64, 65_74, 75_84, 85ov — each year's own table-by-age
             columns summed per band:
               1991: b05's `p_age_N` single-year columns for 0..84 and
                     its `p_age_85_89` + `p_age_90_more` top bins
               1996: b03a's `aged_N_years_p` single-year columns 0..54
                     plus b03b's `aged_*_to_*_years_p` bins 55+
  eng/oth    language at home: eng = speaks English only; oth = every
             other language the same table tallies, taken as the
             table's total minus eng minus its not-stated row (both
             years expose one no-state line per language table)
  aus/totc/cobns  birthplace basis: aus = born-Australia persons, totc
             = the table's total, cobns = birthplace not-stated. The
             lane recipe's fborn share resolves as
             (totc − cobns − aus)/(totc − cobns)
  uni/eduns  tertiary parts per census's own highest-level basis:
             1991 b16 = p_hier_degree + p_post_graduate_diploma +
             p_bachelor_degree, p_qualification_no_stated; 1996 b17b =
             persons_total_hgher_d + persons_total_p_g_dip +
             persons_total_bach_d, persons_total_not_stated
  bluen/occd ASCO-era blue-collar share for both years: blue = the
             three ASCO bases the cd-tag attribute for ANZSCO's 3/7/8
             lane: {Tradespersons, Int-Production+Transport, Labourers},
             occd = the nine stated major ASCO groups (both Inadequately
             Described and Not Stated are excluded). 1991's stem names
             come from b22's `stp_*_p` dates; 1996's come from b20's
             per-occupation `total_<stem>_persons` columns

Guards fail loud: row-set universe has to equal each census's CD
universe (31,402 / 34,328); national persons sits inside ±60k of each
census's published count (17,284,036 / 17,892,423). The 2001-era
script's gap tolerance is chosen the same way.

  python3 .build/analysis/seat-model/extract-bcp-aurin-tally.py 1991
  python3 .build/analysis/seat-model/extract-bcp-aurin-tally.py 1996
"""

import csv
import json
import sys
from pathlib import Path

csv.field_size_limit(sys.maxsize)

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

CACHE = ROOT / ".build/analysis/seat-model/cache"

EXPECTED = {
    "1991": {"cds": 31401, "published": 16841572},
    "1996": {"cds": 34327, "published": 17881210},
}


def _sub_int(row, name):
    try:
        return int(row[name])
    except (KeyError, ValueError, TypeError):
        return 0


def _tally(rows_by_cd, code_key="cd_code"):
    """rows_by_cd: iterable of (cd, rec-parts); merged under the code."""
    out = {}
    for r in rows_by_cd:
        code = r[code_key]
        out.setdefault(code, {})
        yield code, out[code], r


def tally_1991():
    dirpath = CACHE / "bcp-1991-aurin"
    if not dirpath.exists():
        raise SystemExit(f"GUARD missing {dirpath}")

    def read(name):
        with open(dirpath / name, newline="", encoding="utf-8-sig") as fh:
            return list(csv.DictReader(fh))

    tally = {}

    for r in read("b01_slct_characteristics_cd_1991.csv"):
        c = r["cd_code_1991"]
        tally[c] = {"pers": _sub_int(r, "tot_p")
                    - _sub_int(r, "p_enumertd_migratory_offshore_cd")}

    for r in read("b05_age_by_sex_cd_1991.csv"):
        c = r["cd_code_1991"]
        band_sum = {}
        for b_name, (lo, hi) in zip(
                ("0_4", "5_14", "15_19", "20_24", "25_34"),
                ((0, 4), (5, 14), (15, 19), (20, 24), (25, 34))):
            band_sum[b_name] = sum(_sub_int(r, f"p_age_{i}") for i in range(lo, hi + 1))
        band_sum["35_44"] = sum(_sub_int(r, f"p_age_{i}") for i in range(35, 45))
        band_sum["45_54"] = sum(_sub_int(r, f"p_age_{i}") for i in range(45, 55))
        band_sum["55_64"] = sum(_sub_int(r, f"p_age_{i}") for i in range(55, 65))
        # b05's single-year columns stop at 64; 65+ is grouped five-year
        # bins (p_age_65_69, p_age_70_74, p_age_75_79, p_age_80_84,
        # p_age_85_89, p_age_90_yrs_more)
        band_sum["65_74"] = _sub_int(r, "p_age_65_69") + _sub_int(r, "p_age_70_74")
        band_sum["75_84"] = _sub_int(r, "p_age_75_79") + _sub_int(r, "p_age_80_84")
        band_sum["85ov"] = _sub_int(r, "p_age_85_89") + _sub_int(r, "p_age_90_yrs_more")
        tally[c]["bands"] = [band_sum[k] for k in (
            "0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
            "55_64", "65_74", "75_84", "85ov")]

    for r in read("b11_language_spoken_home_by_sex_cd_1991.csv"):
        c = r["cd_code_1991"]
        eng = _sub_int(r, "p_spk_eng_only")
        tot = _sub_int(r, "tot_p")
        ns = _sub_int(r, "p_language_spoken_no_stated")
        tally[c]["eng"] = eng
        tally[c]["oth"] = tot - eng - ns

    for r in read("b08_birthplace_ctry_by_sex_cd_1991.csv"):
        c = r["cd_code_1991"]
        tally[c]["aus"] = _sub_int(r, "p_born_aus_p")
        tally[c]["totc"] = _sub_int(r, "tot_p")
        tally[c]["cobns"] = _sub_int(r, "birthplace_no_stated_p")

    for r in read("b16_qualification_hi_level_by_sex_cd_1991.csv"):
        c = r["cd_code_1991"]
        tally[c]["uni"] = (_sub_int(r, "p_hier_degree")
                           + _sub_int(r, "p_post_graduate_diploma")
                           + _sub_int(r, "p_bachelor_degree"))
        tally[c]["eduns"] = _sub_int(r, "p_qualification_no_stated")

    for r in read("b22_occupation_by_age_by_sex_cd_1991.csv"):
        c = r["cd_code_1991"]
        stems = ("managers_admistrators", "pros", "para_pros",
                 "tradesp", "clerks", "sales_pal_wrkers",
                 "plant_machine_ops_drivers", "labourers_rel_wrkers")
        blue = sum(_sub_int(r, f"{s}_p") for s in
                   ("tradesp", "plant_machine_ops_drivers",
                    "labourers_rel_wrkers"))
        occd = sum(_sub_int(r, f"{s}_p") for s in stems)
        tally[c]["bluen"] = blue
        tally[c]["occd"] = occd

    return tally


def tally_1996():
    dirpath = CACHE / "bcp-1996-aurin"
    if not dirpath.exists():
        raise SystemExit(f"GUARD missing {dirpath}")

    def read(name):
        with open(dirpath / name, newline="", encoding="utf-8-sig") as fh:
            return list(csv.DictReader(fh))

    tally = {}

    for r in read("cd_b01_census_1996.csv"):
        c = r["cd_code"]
        tally[c] = {"pers": _sub_int(r, "total_persons")}

    for r in read("cd_b03a_census_1996.csv"):
        c = r["cd_code"]
        tally[c]["bands"] = [
            sum(_sub_int(r, f"aged_{i}_years_p") for i in range(0, 5)),
            sum(_sub_int(r, f"aged_{i}_years_p") for i in range(5, 15)),
            sum(_sub_int(r, f"aged_{i}_years_p") for i in range(15, 20)),
            sum(_sub_int(r, f"aged_{i}_years_p") for i in range(20, 25)),
            sum(_sub_int(r, f"aged_{i}_years_p") for i in range(25, 35)),
            sum(_sub_int(r, f"aged_{i}_years_p") for i in range(35, 45)),
            sum(_sub_int(r, f"aged_{i}_years_p") for i in range(45, 55)),
        ]
    for r in read("cd_b03b_census_1996.csv"):
        c = r["cd_code"]
        bands = tally[c]["bands"]
        bands.extend([
            (_sub_int(r, "aged_55_to_59_years_p")
             + _sub_int(r, "aged_60_to_64_years_p")),
            (_sub_int(r, "aged_65_to_69_years_p")
             + _sub_int(r, "aged_70_to_74_years_p")),
            (_sub_int(r, "aged_75_to_79_years_p")
             + _sub_int(r, "aged_80_to_84_years_p")),
            (_sub_int(r, "aged_85_to_89_years_p")
             + _sub_int(r, "aged_90_to_94_years_p")
             + _sub_int(r, "aged_95_to_98_years_p")
             + _sub_int(r, "aged_99_years_and_over_p")),
        ])

    for r in read("cd_b05_census_1996.csv"):
        c = r["cd_code"]
        tally[c]["aus"] = _sub_int(r, "australian_p")
        tally[c]["totc"] = _sub_int(r, "total_p")
        tally[c]["cobns"] = _sub_int(r, "not_stated_p")

    for r in read("cd_b08_census_1996.csv"):
        c = r["cd_code"]
        tot = _sub_int(r, "p_total")
        eng = _sub_int(r, "p_spk_eng_only")
        ns = _sub_int(r, "p_not_stated")
        osv = _sub_int(r, "p_os_visitor")
        tally[c]["eng"] = eng
        tally[c]["oth"] = tot - eng - ns - osv

    for r in read("cd_b17b_census_1996.csv"):
        c = r["cd_code"]
        tally[c]["uni"] = (_sub_int(r, "persons_total_hgher_d")
                           + _sub_int(r, "persons_total_p_g_dip")
                           + _sub_int(r, "persons_total_bach_d"))
        tally[c]["eduns"] = _sub_int(r, "persons_total_not_stated")

    for r in read("cd_b20_census_1996.csv"):
        c = r["cd_code"]
        stems_p = ["total_mangrs_admnstrtrs_p", "total_profssnls_persons",
                   "total_assoc_profs_persons",
                   "total_trdprsns_rltd_wrkrs_p",
                   "total_advnd_clrcl_serv_wrkr_p",
                   "total_int_clercl_wrkr_p",
                   "total_int_prod_trnprt_wrkrs_p",
                   "total_lbrers_rltd_wrkrs_p"]
        occd = sum(_sub_int(r, s) for s in stems_p)
        blue = (_sub_int(r, "total_trdprsns_rltd_wrkrs_p")
                + _sub_int(r, "total_int_prod_trnprt_wrkrs_p")
                + _sub_int(r, "total_lbrers_rltd_wrkrs_p"))
        tally[c]["bluen"] = blue
        tally[c]["occd"] = occd

    return tally


def main():
    year = sys.argv[1] if len(sys.argv) > 1 else None
    if year not in EXPECTED:
        raise SystemExit("usage: extract-bcp-aurin-tally.py 1991|1996")

    tally = tally_1991() if year == "1991" else tally_1996()
    exp = EXPECTED[year]
    if len(tally) != exp["cds"]:
        raise SystemExit(f"GUARD {year} universe {len(tally)} != {exp['cds']}")

    nat_p = sum(r["pers"] for r in tally.values())
    if nat_p != exp["published"]:
        raise SystemExit(f"GUARD {year} national persons {nat_p} != "
                         f"{exp['published']} (pin)")

    nation = {"persons": nat_p, "published": exp["published"]}
    eo = sum(r["eng"] + r["oth"] for r in tally.values())
    fb = tally and (sum(r["totc"] - r["cobns"] for r in tally.values()))
    nation["langOther"] = round(sum(r["oth"] for r in tally.values()) / eo, 4)
    nation["fborn"] = (round((fb - sum(r["aus"] for r in tally.values()))
                             / fb, 4))
    nation["band-sum"] = sum(sum(r["bands"]) for r in tally.values())
    nation["bands_per_cds"] = len(tally)
    nation["aged"] = round(
        sum(sum(r["bands"][8:]) for r in tally.values())
        / nation["band-sum"], 4)
    nation["uni"] = round(sum(r["uni"] for r in tally.values())
                          / (nat_p - sum(sum(r["bands"][:2])
                                         for r in tally.values())), 4)
    nation["blue"] = round(sum(r["bluen"] for r in tally.values())
                           / sum(r["occd"] for r in tally.values()), 4)

    out = {
        "_about": (f"{year}-census lane tally from the AURIN WFS "
                   f"downloads (per-CD shares); see this script's "
                   f"header for the records' field meaning and its "
                   f"national profile supply."),
        "_provenance": {"families": {"aurin": f"cache/bcp-{year}-aurin"}},
        "censusEdition": int(year),
        "counts": {"cds": len(tally), "national": nation},
        "tally": tally,
    }
    out_file = CACHE / f"bcp-{year}-aurin-tally.json"
    out_file.write_text(json.dumps(out, indent=2, ensure_ascii=False)
                        + "\n", encoding="utf-8")
    print(f"OK -> {out_file}\n  cds={len(tally):,}"
          f" persons={nat_p:,} published={exp['published']:,}"
          f" bands-sum={nation['band-sum']:,}"
          f" langOther={nation['langOther']} fborn={nation['fborn']}"
          f" aged={nation['aged']} uni={nation['uni']}"
          f" blue={nation['blue']}")


if __name__ == "__main__":
    main()
