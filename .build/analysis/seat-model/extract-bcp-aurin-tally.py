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


# =====================================================================
# the follow-on people-lane cohorts (the map-people-fill arc): language=
# birthplace menu per census era, religion menu, housing tenure, the
# Indigenous and one-parent lanes. Every cohort rides the GCP-era share
# contracts: birthplace over country-of-birth-stated people, religion
# over affiliation-stated people, tenure over the tenure-stated
# occupied-private-dwelling-family universe, Indigenous over answered
# status, one-parent over the printed family universe. Tally-side
# denominators ride inside every record (cobTot/cobNS, relTot/relNS,
# tenTot/tenNS, atsciD, oneparD) so the derive computes shares with the
# contract visible in-file.

COB91_KEYS = ["uk", "chn", "nzl", "phl", "vnm", "zaf", "ita"]
COB91_COLS = {"uk": "p_born_united_kingdom_p", "chn": "p_born_china_p",
              "nzl": "p_born_new_zealand_p",
              "phl": "p_born_philippines_p", "vnm": "p_born_viet_nam_p",
              "zaf": "p_born_south_africa_p", "ita": "p_born_italy_p"}
COB96_KEYS = ["uk", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"]
COB96_COLS = {"uk": "united_kingdom_p", "ind": "india_p",
              "chn": "china_ex_taiwan_province_p",
              "nzl": "new_zealand_p", "phl": "philippines_p",
              "vnm": "viet_nam_p", "zaf": "south_africa_p",
              "ita": "italy_p", "lka": "sri_lanka_p"}
REL_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth", "budd",
            "isl", "hind", "jew"]
REL91_COLS = {
    "norel": ["p_no_religion_p"], "cath": ["p_christian_catholic_p"],
    "angl": ["p_christian_anglican_p"], "unch": ["p_christian_uniting_chch_p"],
    "pres": ["p_christian_presbyterian_p"],
    "orth": ["p_christian_orthodox_p"],
    "budd": ["p_non_christian_buddhist_p"],
    "isl": ["p_non_christian_islam_p"],
    "hind": [],  # the 1991 BCP prints no Hindu row (rides to _oth)
    "jew": ["p_non_christian_judaism_p"],
}
REL96_COLS = {
    "norel": ["no_religion_p"], "cath": ["christian_catholic_p"],
    "angl": ["christian_anglican_p"], "unch": ["christian_uniting_church_p"],
    "pres": ["christian_presby_and_reform_p"],
    "orth": ["christian_orthodox_p", "christian_oriental_chrstn_p"],
    "budd": ["n_christian_buddhism_p"], "isl": ["n_christian_islam_p"],
    "hind": ["n_christian_hinduism_p"], "jew": ["n_christian_judaism_p"],
}
TEN_KEYS = ["mort", "rent", "own", "rentPub"]
TEN91_COLS = {"mort": ["being_purchased_occ_priv_dwl"],
              "rent": ["rent_occ_priv_dwl"],
              "own": ["owned_priv_dwl"],
              "rentPub": ["rent_hous_cmsn_auth_occup_priv_dwl"]}
TEN96_COLS = {"mort": ["total_being_pur"], "rent": ["total_rented"],
              "own": ["total_fully_owned"],
              "rentPub": []}  # the 1996 BCP prints no landlord arm


def lanes_1991(tally):
    """Enrich the 1991 six-lane tally with the follow-on cohorts; the B13
    religion print's within-table identity and B34's family-type
    decomposition cross-check nationally, and the B47 landlord grid owns
    up to the rent_total self-description."""
    dirpath = CACHE / "bcp-1991-aurin"

    def read(name):
        with open(dirpath / name, newline="", encoding="utf-8-sig") as fh:
            return list(csv.DictReader(fh))

    rel_rows, ten_rows, cob_rows, fam_rows, ind_rows = {}, {}, {}, {}, {}
    for r in read("b13_religion_by_sex_cd_1991.csv"):
        rel_rows[r["cd_code_1991"]] = r
    for r in read("b47_nature_occ_by_lld_type_by_dwl_type_cd_1991.csv"):
        ten_rows[r["cd_code_1991"]] = r
    for r in read("b08_birthplace_ctry_by_sex_cd_1991.csv"):
        cob_rows[r["cd_code_1991"]] = r
    for r in read("b34_fam_type_cd_1991.csv"):
        fam_rows[r["cd_code_1991"]] = r
    for r in read("b04_abity_by_sex_cd_1991.csv"):
        ind_rows[r["cd_code_1991"]] = r

    for c, rec in tally.items():
        rr = rel_rows.get(c)
        rec["rel"] = {k: (None if not REL91_COLS[k] else
                          sum(int(float(rr[col] or 0))
                              for col in REL91_COLS[k]))
                      for k in REL_KEYS} if rr else None
        rec["relTot"] = int(float(rr["tot_p"])) if rr else None
        rec["relNS"] = int(float(rr["p_religion_no_stated_p"])) if rr \
            else None
        if rr:
            # within-table identity: christian + non-christian + norel +
            # inadequately-described + not-stated == tot (rejects a table
            # alias/era swap drift silently)
            lhs = (int(float(rr["p_christian_tot_p"]))
                   + int(float(rr["p_non_christian_tot_p"]))
                   + int(float(rr["p_no_religion_p"]))
                   + int(float(rr["p_religion_inadequately_described_p"]))
                   + int(float(rr["p_religion_no_stated_p"])))
            rhs = int(float(rr["tot_p"]))
            if abs(lhs - rhs) > 0:
                raise SystemExit(f"GUARD 1991 {c}: religion identity "
                                 f"{lhs} != {rhs}")
        tr = ten_rows.get(c)
        rec["ten"] = {k: (int(float(tr[cols[0]] or 0)) if
                          len(cols) == 1 else None)
                      for k, cols in TEN91_COLS.items()} if tr else None
        rec["tenTot"] = int(float(tr["occ_priv_dwl"])) if tr else None
        rec["tenNS"] = None  # the 1991 BCP tenure print carries no
        # tenure-not-stated row; its occupancy universe is the printed
        # stated classes
        if tr:
            lor = ["rent_hous_cmsn_auth_occup_priv_dwl", "rent_oth_gov_agency_occ_priv_dwl", "rent_fm_oth_occ_priv_dwl", "rent_no_stated_occ_priv_dwl"]
            lhs = sum(int(float(tr[c2] or 0)) for c2 in lor)
            rhs = int(float(tr["rent_occ_priv_dwl"]))
            if lhs != rhs:
                raise SystemExit(f"GUARD 1991 {c}: landlord grid {lhs} "
                                 f"!= rent_occ_priv_dwl {rhs}")
        cb = cob_rows.get(c)
        rec["cob"] = {k: int(float(cb[COB91_COLS[k]] or 0))
                      for k in COB91_KEYS} if cb else None
        rec["cobNS"] = int(float(cb["birthplace_no_stated_p"])) if cb \
            else None
        if cb:
            # print's identity: every named country row + the residual +
            # not-stated == tot (country families derived from the print
            # head itself so a later ABS added country rides too)
            _B08_META = ("p_total_oth_ctry", "p_born_mn_eng_spk_ctry",
                         "tot_p_born_oth_ctry_p", "birthplace_no_stated_p",
                         "tot_p", "p_born_ovs_oth_ctry_p",
                         "tot_p_pr100", "FID", "cd_code_1991",
                         "the_geom")
            ctry = [col for col in cob_rows[c] if col.endswith("_p")
                    and col not in _B08_META]
            var = (sum(int(float(cb[col] or 0)) for col in ctry)
                   + int(float(cb["p_born_ovs_oth_ctry_p"]))
                   + int(float(cb["birthplace_no_stated_p"])))
            rhs = int(float(cb["tot_p"]))
            if var != rhs:
                raise SystemExit(f"GUARD 1991 {c}: birthplace identity "
                                 f"{var} != {rhs} over {ctry}")
        fm = fam_rows.get(c)
        rec["oneparN"] = int(float(fm["one_prnt_fam"])) if fm else None
        rec["oneparD"] = int(float(fm["tot_fam"])) if fm else None
        if fm:
            # print's identity: one-parent + couples-no-children +
            # couples-with-children ("two_prnt") + other-relatives-only
            lhs = (int(float(fm["one_prnt_fam"]))
                   + int(float(fm["cpls_out_offspring"]))
                   + int(float(fm["two_prnt_fam"]))
                   + int(float(fm["fam_oth_rel_indv_only"])))
            rhs = int(float(fm["tot_fam"]))
            if lhs != rhs:
                raise SystemExit(f"GUARD 1991 {c}: family identity {lhs} "
                                 f"!= {rhs}")
        ir = ind_rows.get(c)
        rec["atsciN"] = int(float(ir["tot_ab_tsi_p"])) if ir else None
        rec["atsciD"] = (int(float(ir["tot_p"]))
                         - int(float(ir["p_abity_no_stated"]))) \
            if ir else None
    return tally


def lanes_1996(tally):
    """Enrich the 1996 six-lane tally; the B05/B10/B14/B22/B25A prints'
    within-table identities cross-check nationally."""
    dirpath = CACHE / "bcp-1996-aurin"

    def read(name):
        with open(dirpath / name, newline="", encoding="utf-8-sig") as fh:
            return list(csv.DictReader(fh))

    rel_rows, ten_rows, cob_rows, fam_rows = {}, {}, {}, {}
    ind_rows = {}
    for r in read("cd_b10_census_1996.csv"):
        rel_rows[r["cd_code"]] = r
    for r in read("cd_b14_census_1996.csv"):
        ten_rows[r["cd_code"]] = r
    for r in read("cd_b05_census_1996.csv"):
        cob_rows[r["cd_code"]] = r
    for r in read("cd_b25a_census_1996.csv"):
        fam_rows[r["cd_code"]] = r
    for r in read("cd_b01_census_1996.csv"):
        ind_rows[r["cd_code"]] = r

    for c, rec in tally.items():
        rr = rel_rows.get(c)
        rec["rel"] = {k: (None if not REL96_COLS[k] else
                          sum(int(float(rr[col] or 0))
                              for col in REL96_COLS[k]))
                      for k in REL_KEYS} if rr else None
        rec["relTot"] = int(float(rr["total_p"])) if rr else None
        rec["relNS"] = int(float(rr["not_stated_p"])) if rr else None
        # GCP-era religion shares ride the usual-residents universe —
        # the 1996 table prints overseas_visitor separately
        rec["relOV"] = int(float(rr["overseas_visitor_p"])) if rr \
            else None
        if rr:
            lhs = (int(float(rr["christian_total_p"]))
                   + int(float(rr["n_christian_total_p"]))
                   + int(float(rr["no_religion_p"]))
                   + int(float(rr["inadequately_described_p"]))
                   + int(float(rr["not_stated_p"]))
                   + int(float(rr["overseas_visitor_p"])))
            rhs = int(float(rr["total_p"]))
            if lhs != rhs:
                raise SystemExit(f"GUARD 1996 {c}: religion identity "
                                 f"{lhs} != {rhs}")
        tr = ten_rows.get(c)
        rec["ten"] = {k: (None if not TEN96_COLS[k] else
                          int(float(tr[TEN96_COLS[k][0]] or 0)))
                      for k in TEN_KEYS} if tr else None
        rec["tenTot"] = int(float(tr["total_total_occp"])) if tr else None
        rec["tenNS"] = int(float(tr["total_not_stated"])) if tr else None
        if tr:
            lhs = sum(int(float(tr[col] or 0)) for col in
                      ("total_fully_owned", "total_being_pur",
                       "total_rent_buy", "total_rented", "total_rent_free",
                       "total_life_tenure", "total_other",
                       "total_not_stated"))
            rhs = int(float(tr["total_total_occp"]))
            if lhs != rhs:
                raise SystemExit(f"GUARD 1996 {c}: tenure identity {lhs} "
                                 f"!= {rhs}")
        cb = cob_rows.get(c)
        rec["cob"] = {k: int(float(cb[COB96_COLS[k]] or 0))
                      for k in COB96_KEYS} if cb else None
        rec["cobNS"] = int(float(cb["not_stated_p"])) if cb else None
        rec["cobOV"] = int(float(cb["overseas_visitor_p"])) if cb else None
        if cb:
            # print's identity: every named country row + the residual +
            # not-stated + overseas-visitors == total
            _B05_META = ("total_p", "not_stated_p", "overseas_visitor_p",
                         "born_eslewhere_os_p", "FID", "ogc_fid",
                         "cd_code", "ste", "wkb_geometry")
            ctry = [col for col in cob_rows[c] if
                    (col.endswith("_p") and col not in _B05_META)]
            lhs = (sum(int(float(cb[col] or 0)) for col in ctry)
                   + int(float(cb["born_eslewhere_os_p"] or 0))
                   + int(float(cb["not_stated_p"]))
                   + int(float(cb["overseas_visitor_p"])))
            rhs = int(float(cb["total_p"]))
            if lhs != rhs:
                raise SystemExit(f"GUARD 1996 {c}: birthplace identity "
                                 f"{lhs} != {rhs} over {ctry}")
        fm = fam_rows.get(c)
        rec["oneparN"] = int(float(fm["tot_ofh_opf_tot"])) if fm else None
        rec["oneparD"] = int(float(fm["tot_ofh_tot"])) if fm else None
        ir = ind_rows.get(c)
        rec["atsciN"] = (int(float(ir["aboriginal_persons"]))
                         + int(float(ir["torres_str_islander_persons"]))
                         + int(float(ir["both_aboriginal_torres_is_p"]))) \
            if ir else None
    return tally


def main():
    year = sys.argv[1] if len(sys.argv) > 1 else None
    if year not in EXPECTED:
        raise SystemExit("usage: extract-bcp-aurin-tally.py 1991|1996")

    tally = tally_1991() if year == "1991" else tally_1996()
    tally = lanes_1991(tally) if year == "1991" else lanes_1996(tally)
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

    # the follow-on cohorts' national profile (documentary — the derive
    # reads the per-CD rows, never these)
    def _sharef(num, den):
        return round(num / den, 4) if den else None
    cob_keys = COB91_KEYS if year == "1991" else COB96_KEYS
    den_cob = (sum(r["totc"] - r["cobns"] for r in tally.values())
               if year == "1991" else
               sum(r["totc"] - r["cobns"] - (r.get("cobOV") or 0)
                   for r in tally.values()))
    den_rel = sum((r["relTot"] or 0) - (r["relNS"] or 0)
                  - (r.get("relOV") or 0) for r in tally.values())
    den_ten = sum((r["tenTot"] or 0) - (r["tenNS"] or 0)
                  for r in tally.values())
    profile = {
        "cob": {k: _sharef(sum(r["cob"][k] for r in tally.values()
                              if r["cob"]), den_cob) for k in cob_keys},
        "rel": {k: _sharef(sum((r["rel"][k] or 0) for r in tally.values()
                              if r["rel"]), den_rel) for k in REL_KEYS},
        "ten": {k: _sharef(sum((r["ten"][k] or 0) for r in tally.values()
                              if r["ten"]), den_ten) for k in TEN_KEYS},
        "atsci": _sharef(sum((r.get("atsciN") or 0)
                            for r in tally.values()),
                         sum((r["atsciD"] if r.get("atsciD") is not None
                              else r["pers"]) or 0
                             for r in tally.values())),
        "onepar": _sharef(sum(r["oneparN"] or 0 for r in tally.values()),
                          sum(r["oneparD"] or 0 for r in tally.values())),
    }

    out = {
        "_about": (f"{year}-census lane tally from the AURIN WFS "
                   f"downloads (per-CD shares); see this script's "
                   f"header for the records' field meaning and its "
                   f"national profile supply."),
        "_provenance": {"families": {"aurin": f"cache/bcp-{year}-aurin"}},
        "censusEdition": int(year),
        "counts": {"cds": len(tally), "national": nation,
                   "laneProfile": profile},
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
    print("  lanes: norel", profile["rel"]["norel"], "cath",
          profile["rel"]["cath"], "own", profile["ten"]["own"],
          "rent", profile["ten"]["rent"], "atsci", profile["atsci"],
          "onepar", profile["onepar"], "uk", profile["cob"]["uk"])


if __name__ == "__main__":
    main()
