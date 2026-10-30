#!/usr/bin/env python3
"""cache/bcp-2001-cd-tally.json — the 2001 BCP per-CD tally the people
lanes read.

One pass over the nine per-state zips mirrored from
archive.org/details/2001-bcp-cd-00_aus (ABS Census 2001, Basic
Community Profiles - All Collection Districts; ABS does not currently
host a bulk 2001 BCP — the CD-level product was the paid CDATA CD).
Each BCP_<7-digit-CD>.xlsx carries 33 tables (B 01..B 33) plus front
matter; the people lanes need six, and the new-lane arc adds five more:

  B 01  Selected characteristics      total persons (cross-check),
                        ALSO total Indigenous persons + Overseas
                        visitors (the atsci lane - no Indigenous-status-
                        not-stated row exists in the 2001 product, so
                        the lane's basis is persons ex-overseas; the
                        store names it)
  B 03  Age by sex          THREE column-block layout (0-29 | 30-59 |
                        60-100+), five-year subtotal rows - merged to
                        the pipeline's 11 G01 bands
  B 06  Birthplace (countries)       Australia, Not stated,
                        Overseas visitors, Total, and the nine country
                        rows of the /map/ Born-overseas menu
                        (COB01_KEYS: uk + the era's eight, the per-CD
                        cobn vector)
  B 08  Language spoken at home       Speaks English only, "Speaks
                        other language: Total", Overseas visitors
  B 10  Religious affiliation         the ten REL01 menu rows + Not
                        stated + Overseas visitors
  B 12  Highest level of schooling    Year 8 .. Year 12 (+ Still at
                        school, Did not go, Not stated); the y12less
                        lane numerator excludes "still at school" to
                        hold the GCP-era stated-level basis
  B 17  Family type                   couple-with-children total,
                        couple w/o children, one-parent total, other
  B 19  Dwelling structure by tenure  tenure Type x landlord grid;
                        the OWN/MORT/RENT(STHA+other)/rentPublic cells
                        ride its Total row
  B 23  Non-school qualification      Postgraduate/GradDip/Bachelor,
                        Not stated
  B 27B Occupation by age by sex      nine ASCO-era major groups x 7
                        age bands, col 9 = Total (2 of 2 = Persons)
  B 30  Weekly family income          band x family type (12 stated
                        bands, Negative/Nil and the partial-stated /
                        all-not-stated ledger rows read for the
                        identity but excluded from every basis — the
                        B26/G31-era doctrine)
  B 31  Weekly household income       band x household type; the
                        household histogram rides the table's Total
                        column (family/non-family cells may shave
                        independently in small cells)

The 2026-10-31 people-lanes arc reads three more:
  B 01  (again)                     the "Australian citizen" row —
                        the noncit lane counts residents NOT counted
                        here (citizenship-not-stated is not printed
                        anywhere in the GCP-era product either, so the
                        lane rides the consistent counted-complement)
  B 05A/B 05B  Ancestry by birthplace  the twelve ANC01 options' Total
                        Responses column + the "Total Persons" and
                        "Not stated" rows (one NS response per
                        not-stated person, so the NS response row is
                        the person-level NS)
  B 28  Method of travel to work    train/bus/ferry/tram one-method
                        rows; the two-method print is combination-level
                        (Train and Bus / Train and other (excluding
                        Bus) / Bus and other (excluding Train) /
                        Other two methods), so PT = the one-method
                        rides + Train-and-Bus + Train-and-other +
                        Bus-and-other + both three-method rows (the
                        same formula as the GCP-era total-column
                        version); over the ex-NS total

2001 has NO children-ever-born table (the variable sat out the 2001
BCP), so the bigfam lane is null on this era's stores and the
interpolated 2004 store blends its 2006 side's measure.

Overseas visitors ride their own row INSIDE several tables' totals in
the 2001 product, so every lane subtracts them: an as-enumerated
count with visitors out, the GCP-era basis every later edition uses.
Occupation in 2001 is the ASCO classification (pre-ANZSCO); the
blue-collar shares map {Tradespersons, Intermediate Production &
Transport, Labourers} onto the ANZSCO 3/7/8 lane — the store's _about
names the definitional wobble.

Cross-checks run loud per CD (B 03 bands + overseas == its Total;
B 03 Total less overseas == B 01 persons; B 06 Total less overseas ==
B 03 Total less overseas) with a perturbation tolerance measured on
the first full run. Run:
  python3 .build/analysis/seat-model/extract-bcp-2001-tally.py
    [--only NT]     (dev: one state)
"""

import io
import json
import sys
import warnings
import zipfile
from collections import Counter
from pathlib import Path

warnings.filterwarnings("ignore", category=UserWarning)

ROOT = Path(__file__).resolve().parent
while not (ROOT / ".git").exists():
    ROOT = ROOT.parent

CACHE = ROOT / ".build/analysis/seat-model/cache/bcp-2001"
OUT = ROOT / ".build/analysis/seat-model/cache/bcp-2001-cd-tally.json"
TOL = 4  # perturbation slack per CD (measured CB perturbation ±3 cells)

BAND_LABELS = {  # B 03 five-year subtotal label -> pipeline band
    "0-4": "0_4",
    "5-9": "5_9",
    "10-14": "10_14",
    "15-19": "15_19",
    "20-24": "20_24",
    "25-29": "25_29",
    "30-34": "30_34",
    "35-39": "35_39",
    "40-44": "40_44",
    "45-49": "45_49",
    "50-54": "50_54",
    "55-59": "55_59",
    "60-64": "60_64",
    "65-69": "65_69",
    "70-74": "70_74",
    "75-79": "75_79",
    "80-84": "80_84",
    "85-89": "85_89",
    "90-94": "90_94",
    "95-99": "95_99",
    "100 years and over": "100ov",
}
OCC_GROUPS = [
    "Managers and Administrators",
    "Professionals",
    "Associate Professionals",
    "Tradespersons and Related Workers",
    "Advanced Clerical and Service Workers",
    "Intermediate Clerical, Sales and Service Workers",
    "Intermediate Production and Transport Workers",
    "Elementary Clerical, Sales and Service Workers",
    "Labourers and Related Workers",
]
BLUE = {"Tradespersons and Related Workers",
        "Intermediate Production and Transport Workers",
        "Labourers and Related Workers"}
# B 06's birthplace country rows -> the /map/ Born-overseas country menu
# (a per-CD `cobn` vector on the tally rec, in this exact order). The
# whole-era menu: the eight the 2006/2011-census stores print, plus the
# whole-UK row this edition's own table carries ("United Kingdom"
# merges England/Scotland/Wales/NI/Channel-Islands like the GCP-era
# B09 does) — "uk" leads the list exactly as "eng" leads the 2021-era
# menu, the remaining eight follow the site key order.
COB01_KEYS = ["uk", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita",
              "lka"]
COB01_PREFIX = {
    "uk": "united kingdom",
    "ind": "india",
    "chn": "china",
    "nzl": "new zealand",
    "phl": "philippines",
    "vnm": "viet nam",
    "zaf": "south africa",
    "ita": "italy",
    "lka": "sri lanka",
}
# B 10's religious-affiliation rows -> the /map/ Religion menu (order
# leads with "No religion", the cross-era REL_KEYS set; "orth" sums the
# edition's two orthodox rows - 2001 prints "Orthodox" and "Oriental
# Christian" separately, GCP-era prints Eastern + Oriental orthodox)
REL01_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth", "budd",
              "isl", "hind", "jew"]
REL01_PREFIX = {
    "norel": "no religion",
    "cath": "catholic",
    "angl": "anglican",
    "unch": "uniting church",
    "pres": "presbyterian and reformed",
    "budd": "buddhism",
    "isl": "islam",
    "hind": "hinduism",
    "jew": "judaism",
}
# B 30's column order: couple-with-children, couple-without, one-parent,
# other, Total (header verified against the printed sheet — B 31's is
# family / non-family / Total). The row ladder is the same 12 stated
# bands in both (and identical to derive-booth-demo-2001's INC_BANDS01).
INC01_BAND_LABELS = ["$1-$199", "$200-$299", "$300-$399", "$400-$499",
                     "$500-$599", "$600-$699", "$700-$799", "$800-$999",
                     "$1,000-$1,199", "$1,200-$1,499", "$1,500-$1,999",
                     "$2,000 or more"]
# B 05A/B 05B's ancestry rows -> the /map/ Ancestry menu (the site's
# cross-era key order; the 2001 print's labels are exact matches)
ANC01_KEYS = ["english", "australian", "irish", "scottish", "chinese",
              "italian", "german", "indian", "filipino", "dutch",
              "vietnamese", "lebanese"]
ANC01_LABELS = {
    "english": "english",
    "australian": "australian",
    "irish": "irish",
    "scottish": "scottish",
    "chinese": "chinese",
    "italian": "italian",
    "german": "german",
    "indian": "indian",
    "filipino": "filipino",
    "dutch": "dutch",
    "vietnamese": "vietnamese",
    "lebanese": "lebanese",
}

import openpyxl  # noqa: E402


def cell_of(row, ix):
    v = row[ix] if ix < len(row) else None
    if v is None:
        return 0
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).strip()
    return int(s) if s.lstrip("-").isdigit() else 0


def label_of(row):
    for c in row:
        if c is None:
            continue
        s = str(c).strip()
        if s and not s.lstrip("-").isdigit():
            return s.lower()
    return ""


def wb_get(wb, name, minc, maxc):
    """rows of a sheet that must exist in a full workbook, or empty when
    the sheet is absent (short-table CDs)"""
    if name not in wb.sheetnames:
        return []
    return [r for r in wb[name].iter_rows(min_col=minc, max_col=maxc,
                                          values_only=True)]


def block_persons(row, col):
    """the Persons column of a B 03 column block: block 3 is 3 cells
    wide on some CDs (Persons suppressed there), so fall back to
    Males+Females when the declared Persons cell is absent"""
    p = row[col + 3] if col + 3 < len(row) else None
    if isinstance(p, (int, float)):
        return int(p)
    if p is not None and str(p).strip().lstrip("-").isdigit():
        return int(str(p).strip())
    return cell_of(row, col + 1) + cell_of(row, col + 2)


def parse_cd(member_name, wb):
    """one BCP_<cd>.xlsx -> the tally rec"""
    # short-table CDs emit a truncated workbook (the balance/"no usual
    # address" codes, ~32 sheets, none of the demographic tables):
    # keep the B 01 headcount and null the lanes before any lane reads
    if any(s not in wb.sheetnames for s in
           ("B 05A", "B 05B", "B 06", "B 08", "B 10", "B 12", "B 17",
            "B 19", "B 23", "B 27B", "B 28")):
        pers_tot = None
        for row in wb_get(wb, "B 01", 1, 4):
            lab = label_of(row)
            if lab.startswith("total persons"):
                pers_tot = cell_of(row, 3)
        if pers_tot is None:
            pers_tot = 0
        return {"pers": pers_tot, "b1Persons": pers_tot, "b3Ov": 0,
                "bands": [0] * 11, "aus": None, "totc": None,
                "cobns": None, "eng": None, "oth": None, "uni": None,
                "eduns": None, "bluen": None, "occd": None,
                "cobn": None,
                "rel01": None, "rel01ns": None, "rel01tot": None,
                "rel01ov": None, "sch01": None, "sch01ns": None,
                "fam01": None, "ten01": None,
                "fiTot01": None, "fiMix01": None, "hiTot01": None,
                "ind01": None, "b1ov": None,
                "cit01": None, "tw01": None, "anc01": None,
                "ancp01": None, "ancns01": None,
                "shortCd": True}

    def sheet_rows(name, minc, maxc):
        try:
            ws = wb[name]
        except KeyError:
            raise KeyError(f"{member_name}: sheet {name} missing")
        return [r for r in ws.iter_rows(min_col=minc, max_col=maxc,
                                        values_only=True)]

    # ---- B 03 (three column blocks at separators 0/5/10 -- M,F,P
    # per block, the last block may suppress its Persons cell)
    b3 = sheet_rows("B 03", 1, 13)
    bands = {k: 0 for k in BAND_LABELS.values()}
    b3_total = b3_ov = None
    for row in b3:
        for col in (0, 5, 10):
            if col >= len(row):
                continue
            lab = str(row[col]).strip().lower() if row[col] is not \
                None else ""
            if not lab:
                continue
            per = block_persons(row, col)
            if lab in BAND_LABELS:
                bands[BAND_LABELS[lab]] += per
            elif lab.startswith("overseas visit"):
                b3_ov = per
            elif lab == "total":
                b3_total = per
    bands11 = [
        bands["0_4"],
        bands["5_9"] + bands["10_14"],
        bands["15_19"],
        bands["20_24"],
        bands["25_29"] + bands["30_34"],
        bands["35_39"] + bands["40_44"],
        bands["45_49"] + bands["50_54"],
        bands["55_59"] + bands["60_64"],
        bands["65_69"] + bands["70_74"],
        bands["75_79"] + bands["80_84"],
        bands["85_89"] + bands["90_94"] + bands["95_99"] + bands["100ov"],
    ]

    # ---- B 01 summary (plus the Indigenous, citizen and overseas-
    # visitor rows the atsci/noncit shares ride)
    b1 = sheet_rows("B 01", 1, 4)
    b1_persons = b1_indig = b1_ov = b1_cit = None
    for row in b1:
        lab = label_of(row)
        if lab.startswith("total persons"):
            b1_persons = cell_of(row, 3)
        elif lab == "total indigenous persons":
            b1_indig = cell_of(row, 3)
        elif lab == "australian citizen":
            b1_cit = cell_of(row, 3)  # exact: "Australian citizen
            # aged 18 years and over" follows one row below and must
            # never overwrite this (a startswith match once cost the
            # age-gated count landing here instead)
        elif lab.startswith("overseas visit"):
            b1_ov = cell_of(row, 3)

    # ---- B 10 religion (the ten-menu rows; the table prints THREE
    # "Total" rows: Christianity's, Other religions', and the grand
    # total last. Within-table identity: grand == (Christianity +
    # Other religions) + norel + inadequately-described + not-stated +
    # overseas-visitors; the grand total does NOT reconcile with
    # B 01's persons row (the two tables' totals disagree in the 2001
    # product itself, ~0.2% at CD level, so no cross-table check)
    rel = {k: None for k in REL01_KEYS}
    rel_orth = 0
    rel_ns = rel_ineq = b10_ov = None
    totals = []
    for row in sheet_rows("B 10", 1, 4):
        lab = label_of(row)
        per = cell_of(row, 3)
        if lab == "total":
            totals.append(per)
            continue
        if lab.startswith("overseas visit"):
            b10_ov = per
        elif lab in ("orthodox", "oriental christian"):
            rel_orth += per
        elif lab.startswith("inadequately"):
            rel_ineq = per
        elif lab.startswith("not stated"):
            rel_ns = per
        else:
            for k, pref in REL01_PREFIX.items():
                if lab == pref or lab.startswith(pref):
                    rel[k] = per
                    break
    rel["orth"] = rel_orth
    b10_grand = totals[-1] if totals else None
    # B 10's own print: grand = Christianity-Total + Other-religions-
    # Total + the four standalone rows (Buddhism/Hinduism/Islam/
    # Judaism) + no-religion + inadequately-described + not-stated +
    # overseas-visitors
    b10_identity = (len(totals) == 3
                    and totals[2] == totals[0] + totals[1]
                    + (rel.get("budd") or 0) + (rel.get("hind") or 0)
                    + (rel.get("isl") or 0) + (rel.get("jew") or 0)
                    + (rel.get("norel") or 0) + (rel_ineq or 0)
                    + (rel_ns or 0) + (b10_ov or 0))
    # ---- B 12 highest schooling completed (15+, excl overseas
    # visitors): the printed level rows; "Still at school" is excluded
    # from the stated-level basis to hold the 2011+ GCP-gnu basis
    sch = {k: None for k in ("y12", "y11", "y10", "y9", "y8", "dng")}
    sch_ns = None
    SCH01_LABELS = {
        "year 12 or equivalent": "y12", "year 11 or equivalent": "y11",
        "year 10 or equivalent": "y10", "year 9 or equivalent": "y9",
        "year 8 or below": "y8", "did not go to school": "dng"}
    for row in sheet_rows("B 12", 1, 4):
        lab = label_of(row)
        per = cell_of(row, 3)
        for txt, k in SCH01_LABELS.items():
            if lab == txt:
                sch[k] = per
        if lab.startswith("not stated"):
            sch_ns = per

    # ---- B 17 family type (families, col 1; section-total rows)
    fam_cf_child = fam_cf_nochild = fam_opf = fam_other = fam_tot = None
    section = None
    for row in sheet_rows("B 17", 1, 4):
        lab = label_of(row)
        per = cell_of(row, 1)
        if lab.startswith("couple family:"):
            section = "cf"
        elif lab.startswith("one parent family:"):
            section = "opf"
        elif lab == "total" and section == "cf":
            fam_cf_child = per
            section = None
        elif lab == "total" and section == "opf":
            fam_opf = per
            section = None
        elif lab.startswith("couple family without children"):
            fam_cf_nochild = per
        elif lab.startswith("other family"):
            fam_other = per
        elif lab == "total" and section is None \
                and fam_cf_child is not None and fam_opf is not None \
                and fam_other is not None:
            fam_tot = per

    # ---- B 19 tenure x dwelling (Total row; rented-total is column 7,
    # and there is no grand-total column in this edition)
    ten_own = ten_purch = ten_rentbuy = ten_stha = ten_othll = None
    ten_nsll = ten_renttot = ten_othtype = ten_tenns = None
    for row in sheet_rows("B 19", 1, 10):
        if label_of(row) != "total":
            continue
        ten_own = cell_of(row, 1)
        ten_purch = cell_of(row, 2)
        ten_rentbuy = cell_of(row, 3)
        ten_stha = cell_of(row, 4)
        ten_othll = cell_of(row, 5)
        ten_nsll = cell_of(row, 6)
        ten_renttot = cell_of(row, 7)
        ten_othtype = cell_of(row, 8)
        ten_tenns = cell_of(row, 9)

    # ---- B 30 weekly family income (band x family type) ----
    # cols: 1 = couple-with-children, 2 = couple-without, 3 = one-parent,
    # 4 = other, 5 = Total. fi lists are 13 long: neg/nil folds in as
    # row 0, then the 12 stated bands (INC01_BAND_LABELS order).
    fi_mix = [[0] * 4 for _ in range(13)]
    fi_tot = [0] * 13
    fi_part = fi_nostat = fi_total = None
    for row in sheet_rows("B 30", 1, 6):
        lab = label_of(row)
        if not lab:
            continue
        if lab.startswith("negative"):
            tgt = 0
        elif lab.startswith("partial income"):
            tgt = "part"
        elif lab.startswith("all incomes"):
            tgt = "notstated"
        elif lab == "total":
            tgt = "total"
        else:
            lab_stem = lab.rstrip()
            tgt = None
            for gi, glab in enumerate(INC01_BAND_LABELS):
                if lab_stem.lower().startswith(glab.lower()):
                    tgt = gi + 1
                    break
        if tgt is None:
            continue
        vals = [cell_of(row, k) for k in range(1, 6)]
        if tgt == "part":
            fi_part = vals[4]
        elif tgt == "notstated":
            fi_nostat = vals[4]
        elif tgt == "total":
            fi_total = vals[4]
        else:
            for k in range(4):
                fi_mix[tgt][k] += vals[k]
            fi_tot[tgt] += vals[4]

    # ---- B 31 weekly household income (band x household type) ----
    # col 3 = Total; family / non-family splits read for the identity
    # only (small-cell shave doctrine: the Total column is canonical)
    hh_tot = [0] * 13
    hh_fam = [0] * 13
    hh_nonf = [0] * 13
    hh_part = hh_nostat = hh_total = None
    for row in sheet_rows("B 31", 1, 4):
        lab = label_of(row)
        if not lab:
            continue
        if lab.startswith("negative"):
            tgt = 0
        elif lab.startswith("partial income"):
            tgt = "part"
        elif lab.startswith("all incomes"):
            tgt = "notstated"
        elif lab == "total":
            tgt = "total"
        else:
            lab_stem = lab.rstrip()
            tgt = None
            for gi, glab in enumerate(INC01_BAND_LABELS):
                if lab_stem.lower().startswith(glab.lower()):
                    tgt = gi + 1
                    break
        if tgt is None:
            continue
        fc, nf, tt = cell_of(row, 1), cell_of(row, 2), cell_of(row, 3)
        if tgt == "part":
            hh_part = tt
        elif tgt == "notstated":
            hh_nostat = tt
        elif tgt == "total":
            hh_total = tt
        else:
            hh_fam[tgt] += fc
            hh_nonf[tgt] += nf
            hh_tot[tgt] += tt

    # ---- B 06 birthplace
    aus = cobns = b6_ov = b6_total = None
    elsewhere = None
    others = 0
    cob = {k: None for k in COB01_KEYS}
    for row in sheet_rows("B 06", 1, 4):
        lab = label_of(row)
        per = cell_of(row, 3)
        if lab == "australia":
            aus = per
        elif lab.startswith("born elsewhere overseas"):
            elsewhere = per
        elif lab.startswith("overseas visit"):
            b6_ov = per
        elif lab == "total":
            b6_total = per
        elif lab.startswith("not stated"):
            if cobns is None:
                cobns = per
        else:
            hit = False
            for k, pref in COB01_PREFIX.items():
                if lab.startswith(pref):
                    cob[k] = per
                    hit = True
                    break
            if not hit:
                # the twenty-odd named countries outside the menu (and
                # the table's footnote text rows, cell_of 0) — kept as
                # one residual count so the table fully recomposes
                others += per
    cob_miss = [k for k, v in cob.items() if v is None]
    if cob_miss or elsewhere is None:
        raise KeyError(f"{member_name}: B 06 menu rows drifted "
                       f"(missing {cob_miss}, elsewhere {elsewhere is None})")

    # ---- B 08 language: language lists carry inner subtotal rows
    # (Chinese languages etc.), so the sheet's arithmetic gives the
    # other-language grand total: Total - English-only - Not stated -
    # Overseas visitors (all four rows exist in every CD file)
    eng = lang_ns = b8_ov = b8_total = None
    for row in sheet_rows("B 08", 1, 4):
        lab = label_of(row)
        per = cell_of(row, 3)
        if lab.startswith("speaks english only"):
            eng = per
        elif lab.startswith("not stated"):
            lang_ns = per
        elif lab.startswith("overseas visit"):
            b8_ov = per
        elif lab == "total":
            b8_total = per
    oth = (b8_total - eng - lang_ns - b8_ov) if None not in (
        eng, lang_ns, b8_ov, b8_total) else None

    # ---- B 23 qualifications
    pgrad = gdip = bach = eduns = None
    for row in sheet_rows("B 23", 1, 4):
        lab = label_of(row)
        per = cell_of(row, 3)
        if lab.startswith("postgraduate degree"):
            pgrad = per
        elif lab.startswith("graduate diploma"):
            gdip = per
        elif lab.startswith("bachelor degree"):
            bach = per
        elif lab.startswith("not stated"):
            eduns = per

    # ---- B 28 method of travel to work (persons col; PT numerator is
    # the GCP-era formula on the combination-level print: one-method
    # train/bus/ferry/tram + Train-and-Bus + Train-and-other +
    # Bus-and-other + both three-method rows, other-combination rows
    # unattributable; denominator the ex-not-stated total)
    tw = {"train1": 0, "bus1": 0, "ferry1": 0, "tram1": 0,
          "tr2": 0, "bu2": 0, "three_t": 0, "three_b": 0,
          "tot": None, "ns": None}
    sect = None
    for row in sheet_rows("B 28", 1, 4):
        lab = label_of(row)
        if not lab:
            continue
        per = cell_of(row, 3)
        if lab.startswith("one method"):
            sect = "one"
        elif lab.startswith("two methods"):
            sect = "two"
        elif lab.startswith("three methods"):
            sect = "three"
        elif sect == "one" and lab == "train":
            tw["train1"] = per
        elif sect == "one" and lab == "bus":
            tw["bus1"] = per
        elif sect == "one" and lab == "ferry":
            tw["ferry1"] = per
        elif sect == "one" and lab.startswith("tram"):
            tw["tram1"] = per
        elif sect == "two":
            if lab.startswith("train and bus") or lab.startswith("train and other"):
                tw["tr2"] += per
            elif lab.startswith("bus and other"):
                tw["bu2"] += per
        elif sect == "three":
            if lab.startswith("train and"):
                tw["three_t"] += per
            elif lab.startswith("bus and"):
                tw["three_b"] += per
        if lab == "total":
            tw["tot"] = per  # last printed total wins: the grand
            # total ends the table (the one/two/three-method
            # subtotal rows are the same label)
            sect = None
        elif lab.startswith("not stated"):
            tw["ns"] = per

    # ---- B 05A/B 05B ancestry (Total Responses column 6; a person
    # not stating ancestry contributes exactly one not-stated
    # response, so the NS response row is the person-level NS)
    anc28n = tw["train1"] + tw["bus1"] + tw["ferry1"] + tw["tram1"] \
        + tw["tr2"] + tw["bu2"] + tw["three_t"] + tw["three_b"]
    tw01 = [anc28n, tw["tot"], tw["ns"]] \
        if tw["tot"] is not None and tw["ns"] is not None else None
    anc = {k: None for k in ANC01_LABELS}
    ancp = ancns = None
    for sheet in ("B 05A", "B 05B"):
        for row in sheet_rows(sheet, 1, 7):
            lab = label_of(row)
            if not lab:
                continue
            per = cell_of(row, 6)
            if lab.startswith("total persons"):
                ancp = per
            elif lab.startswith("not stated"):
                ancns = per
            else:
                for k, pref in ANC01_LABELS.items():
                    if lab == pref:
                        anc[k] = per

    # ---- B 27B occupation (persons sheet; col 9 = Total)
    occ = {g: 0 for g in OCC_GROUPS}
    occ_ns = 0
    occ_other = 0  # inadequately described
    for row in sheet_rows("B 27B", 1, 9):
        lab = label_of(row)
        tot = cell_of(row, 8)
        for g in OCC_GROUPS:
            if lab == g.lower():
                occ[g] = tot
        if lab == "not stated":
            occ_ns = tot
        elif lab.startswith("inadequately"):
            occ_other = tot
    missing = [k for k, v in {"aus": aus, "cobns": cobns,
                              "b6_ov": b6_ov, "b6_total": b6_total,
                              "eng": eng, "oth": oth,
                              "b8_total": b8_total, "pgrad": pgrad,
                              "gdip": gdip, "bach": bach,
                              "eduns": eduns, "b1_persons": b1_persons,
                              "b3_total": b3_total, "b3_ov": b3_ov,
                              "b1_indig": b1_indig, "b1_ov": b1_ov,
                              "rel_ns": rel_ns, "b10_ov": b10_ov,
                              "b10_grand": b10_grand,
                              "sch_ns": sch_ns,
                              "fam_cf_child": fam_cf_child,
                              "fam_cf_nochild": fam_cf_nochild,
                              "fam_opf": fam_opf,
                              "fam_other": fam_other,
                              "fam_tot": fam_tot,
                              "ten_own": ten_own,
                              "ten_renttot": ten_renttot,
                              "ten_stha": ten_stha,
                              "ten_othtype": ten_othtype,
                              "ten_tenns": ten_tenns,
                              "b1_cit": b1_cit,
                              "tw01": tw01,
                              "ancp": ancp, "ancns": ancns,
                              }.items()
               if v is None]
    missing += [f"rel01.{k}" for k, v in rel.items() if v is None]
    missing += [f"sch01.{k}" for k, v in sch.items() if v is None]
    missing += [f"anc01.{k}" for k, v in anc.items() if v is None]
    if missing:
        raise ValueError("table drift " + ",".join(missing))
    if oth is not None and oth < 0:
        oth = None  # perturbation pushed the computed total negative —
        # emit no share, never clamp
    # table-internal recompositions (failure classes ride `checks`;
    # the 2001 product is unperturbed so these identities hold exactly)
    recons = {}
    if fam_cf_child + fam_cf_nochild + fam_opf + fam_other \
            != fam_tot:
        recons["fam"] = fam_cf_child + fam_cf_nochild + fam_opf \
            + fam_other - fam_tot
    if not b10_identity:
        recons["rel-total"] = 1
    if abs(ten_stha + ten_othll + ten_nsll - ten_renttot) > TOL:
        recons["renttot"] = (ten_stha + ten_othll + ten_nsll
                             - ten_renttot)
    y12_den = sum(sch.values())
    if y12_den <= 0:
        recons["sch-empty"] = 1
    elif not 0 <= (sch["y11"] + sch["y10"] + sch["y9"] + sch["y8"]
                   + sch["dng"]) / y12_den <= 1:
        recons["sch-share"] = 1
    if b1_indig > b1_persons:
        recons["indig>pers"] = 1
    # B 30/B 31 within-table identities: each stated band's printed
    # Total recomposes its four family types, and each table's printed
    # Total recomposes stated + partial-stated + not-stated
    for gi in range(13):
        if abs(sum(fi_mix[gi]) - fi_tot[gi]) > TOL:
            recons["b30band"] = 1
        if abs(hh_fam[gi] + hh_nonf[gi] - hh_tot[gi]) > TOL:
            recons["b31band"] = 1
    if fi_part is None or fi_nostat is None or fi_total is None:
        recons["b30miss"] = 1
    elif abs(sum(fi_tot) + fi_part + fi_nostat - fi_total) > TOL * 3:
        recons["b30total"] = sum(fi_tot) + fi_part + fi_nostat \
            - fi_total
    if hh_part is None or hh_nostat is None or hh_total is None:
        recons["b31miss"] = 1
    elif abs(sum(hh_tot) + hh_part + hh_nostat - hh_total) > TOL * 3:
        recons["b31total"] = sum(hh_tot) + hh_part + hh_nostat \
            - hh_total

    return {
        "pers": b3_total - b3_ov,
        "b1Persons": b1_persons,
        "b3Ov": b3_ov,
        "bands": bands11,
        "aus": aus, "totc": b6_total - b6_ov, "cobns": cobns,
        "eng": eng, "oth": oth,
        "uni": pgrad + gdip + bach, "eduns": eduns,
        "bluen": sum(occ[g] for g in OCC_GROUPS if g in BLUE),
        "occd": sum(occ.values()),
        "cobn": [cob[k] for k in COB01_KEYS],
        "b6Others": others,
        "b6Elsewhere": elsewhere,
        "ind01": b1_indig, "b1ov": b1_ov,
        "rel01": [rel[k] for k in REL01_KEYS],
        "rel01ns": rel_ns, "rel01tot": b10_grand - b10_ov,
        "rel01ov": b10_ov,
        "sch01": [sch["y11"], sch["y10"], sch["y9"], sch["y8"],
                  sch["dng"], sch["y12"]],
        "sch01ns": sch_ns,
        "fam01": [fam_cf_child, fam_cf_nochild, fam_opf, fam_other,
                  fam_tot],
        "ten01": [ten_own, ten_purch + ten_rentbuy, ten_renttot,
                  ten_stha, ten_othtype, ten_tenns],
        "fiTot01": fi_tot,
        "fiMix01": [c for band in fi_mix for c in band],
        "hiTot01": hh_tot,
        "cit01": b1_cit,
        "tw01": tw01,
        "anc01": [anc[k] for k in ANC01_KEYS],
        "ancp01": ancp, "ancns01": ancns,
        "_recons": recons or None,
    }


def merge_shards(pattern, out_path):
    """Fold a running shard-outs set into the derived tally (the
    lightest amortisation: per-shard runs write their own tables;
    this joins them and reprints the national profile)."""
    import glob as g
    tally = {}
    for p in sorted(g.glob(pattern)):
        d = json.load(open(p, encoding="utf-8"))
        for k, v in d["tally"].items():
            tally[k] = v
    if len(tally) != 35289:
        raise SystemExit(f"merged tally rows {len(tally)} != pin 35289")
    relc = {k: 0 for k in REL01_KEYS}
    ancc = {k: 0 for k in ANC01_KEYS}
    sc = [0] * 6
    fc = [0] * 5
    tc = [0] * 6
    ind = pers = less_ov = cit = pt = ptt = ptns = ancp = ancns = 0
    full = [r for r in tally.values() if r.get("rel01tot") is not None]
    for r in full:
        for i, k in enumerate(REL01_KEYS):
            relc[k] += r["rel01"][i]
        for i, k in enumerate(ANC01_KEYS):
            ancc[k] += r["anc01"][i]
        for i in range(6):
            sc[i] += r["sch01"][i]
        for i in range(5):
            fc[i] += r["fam01"][i]
        for i in range(6):
            tc[i] += r["ten01"][i]
        ind += r["ind01"]
        pers += r["b1Persons"]
        less_ov += r["b1ov"]
        cit += r["cit01"]
        pt += r["tw01"][0]
        ptt += r["tw01"][1]
        ptns += r["tw01"][2]
        ancp += r["ancp01"]
        ancns += r["ancns01"]
    relnat_den = sum(r["rel01tot"] - r["rel01ns"] for r in full)
    sc_den = sum(sc)
    ten_den = tc[0] + tc[1] + tc[2] + tc[4]
    ancden = ancp - ancns
    print("national new-lane shares (2001 census, full-table CDs):",
          {"norel": round(relc['norel'] / relnat_den, 4),
           "cath": round(relc['cath'] / relnat_den, 4),
           "angl": round(relc['angl'] / relnat_den, 4),
           "unch": round(relc['unch'] / relnat_den, 4),
           "pres": round(relc['pres'] / relnat_den, 4),
           "orth": round(relc['orth'] / relnat_den, 4),
           "budd": round(relc['budd'] / relnat_den, 4),
           "isl": round(relc['isl'] / relnat_den, 4),
           "hind": round(relc['hind'] / relnat_den, 4),
           "jew": round(relc['jew'] / relnat_den, 4),
           "y12less": round(sum(sc[:5]) / sc_den, 4),
           "oneparent": round(fc[2] / fc[4], 4),
           "mort": round(tc[1] / ten_den, 4),
           "rent": round(tc[2] / ten_den, 4),
           "own": round(tc[0] / ten_den, 4),
           "rentPub": round(tc[3] / ten_den, 4),
           "atsci": round(ind / (pers - less_ov), 4),
           "pt": round(pt / (ptt - ptns), 4),
           "noncit": round(1 - cit / pers, 4),
           "anc": {k: round(ancc[k] / ancden, 4)
                   for k in ANC01_KEYS}})
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({"tally": tally}, fh)
        fh.write("\n")
    print(f"OK -> {out_path} ({len(tally)} CDs)")


def main():
    only = None
    shard = (0, 1)
    out_path = OUT
    for a in sys.argv[1:]:
        if a.startswith("--only="):
            only = a.split("=", 1)[1]
        elif a.startswith("--shard="):
            i, n = a.split("=", 1)[1].split("/")
            shard = (int(i), int(n))
        elif a.startswith("--out="):
            out_path = Path(a.split("=", 1)[1])
        elif a.startswith("--merge="):
            merge_shards(a.split("=", 1)[1], OUT)
            return
    zips = sorted(CACHE.glob("bcp-2001-cd-*.zip"))
    if only:
        zips = [z for z in zips if only.lower() in z.name.lower()]
    if not zips:
        print(f"GUARD no zips in {CACHE} (need the archive.org 9-zip set)")
        raise SystemExit(1)
    tally = {}
    bad = Counter()
    checks = Counter()
    for zp in zips:
        z = zipfile.ZipFile(zp)
        members = sorted(n for n in z.namelist()
                         if n.lower().endswith(".xlsx"))
        i_s, n_s = shard
        members = [m for k, m in enumerate(members) if k % n_s == i_s]
        print(f"{zp.name} shard {i_s}/{n_s}: {len(members)} CD files",
              flush=True)
        for n in members:
            code = n.split("/")[-1].removeprefix("BCP_").removesuffix(".xlsx")
            if not (code.isdigit() and len(code) == 7):
                raise SystemExit(f"GUARD filename drift: {n!r}")
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                try:
                    wb = openpyxl.load_workbook(io.BytesIO(z.read(n)),
                                                read_only=True,
                                                data_only=True)
                    rec = parse_cd(n, wb)
                except Exception as e:
                    bad[str(e).partition(":")[0]] += 1
                    continue
            if code in tally:
                raise SystemExit(f"GUARD dup CD {code}")
            recons = rec.pop("_recons", None) or {}
            for c in recons:
                checks["prof-" + c if c in ("sch-empty",) else c] += 1
            tally[code] = rec
            if rec.get("shortCd"):
                checks["prof-short-cd"] += 1
                continue
            # checks: the bands MUST sum to the table's own Total
            # (sheet-internal, zero tolerance); the B 01/B 06/B 03
            # universes are EACH table's own announced basis in the
            # 2001 product (they disagree by design -- profile only)
            if abs(sum(rec["bands"]) - rec["pers"]) > TOL * 2:
                checks["bands"] += 1
            if abs(rec["b1Persons"] - rec["pers"]) > TOL:
                checks["prof-b1"] += 1
            # the birthplace composition recomposes its table total
            # within perturbation slack (menu countries + the residual
            # named others + elsewhere + Australia + not stated)
            comp = rec["aus"] + sum(rec["cobn"]) + rec["b6Others"] \
                + rec["b6Elsewhere"] + rec["cobns"]
            if abs(comp - rec["totc"]) > TOL * 3:
                checks["b6cob"] += 1
            if abs(rec["totc"] - rec["pers"]) > 20:
                checks["prof-b6"] += 1
            if rec["uni"] == 0 and rec["pers"] > 50:
                checks["prof-uni-zero"] += 1
            if rec["pers"] > 0:
                oth_den = (rec["eng"] or 0) + (rec["oth"] or 0)
                if oth_den <= 0 or \
                        not (0 <= (rec["oth"] or 0) / oth_den <= 1):
                    checks["oth-share"] += 1
            tally[code] = rec
    profl = {k: v for k, v in checks.items() if k.startswith("prof-")}
    hard = {k: v for k, v in checks.items() if not k.startswith("prof-")}
    print(f"tally: {len(tally)} CDs "
          f"(parse-failure classes: {dict(bad) or 'none'}, "
          f"universe-profile (expected in the 2001 product): "
          f"{profl or 'none'}, hard slips: {hard or 'none'})")
    if bad or hard:
        raise SystemExit("GUARD check-failure profile is not pristine")
    pers = sum(r["pers"] for r in tally.values())
    print(f"persons (ex-overseas): {pers:,}")
    nat = {k: sum(r[k] or 0 for r in tally.values()) for k in
           ("pers", "aus", "totc", "cobns", "eng", "oth", "uni",
            "eduns", "bluen", "occd")}
    eo = nat["eng"] + nat["oth"]
    fbd = nat["totc"] - nat["cobns"]
    p15 = sum(r["pers"] - r["bands"][0] - r["bands"][1]
              for r in tally.values())
    bands_tot = sum(sum(r["bands"]) for r in tally.values())
    print("tally profile (ex-overseas, 2001 census):",
          {"langOther": round(nat["oth"] / eo, 4),
           "fborn": round((fbd - nat["aus"]) / fbd, 4),
           "uni": round(nat["uni"] / (p15 - nat["eduns"]), 4),
           "blue": round(nat["bluen"] / nat["occd"], 4),
           "age0_14": round(sum(r["bands"][0] + r["bands"][1]
                                for r in tally.values()) / bands_tot, 4),
           "age65ov": round(sum(sum(r["bands"][8:])
                                for r in tally.values()) / bands_tot, 4)})
    cobnat = {k: sum((r["cobn"] or [0] * len(COB01_KEYS))[i]
                     for r in tally.values())
              for i, k in enumerate(COB01_KEYS)}
    print("birthplace countries (share of the stated birthplace base "
          f"{fbd:,}):",
          {k: round(v / fbd, 4) for k, v in cobnat.items()})
    # the new-lane national reads (full-table CDs only)
    full = [r for r in tally.values() if r.get("rel01tot")]
    relc = {k: sum(r["rel01"][i] for r in full)
            for i, k in enumerate(REL01_KEYS)}
    relnat_den = sum(r["rel01tot"] - r["rel01ns"] for r in full)
    sc = [sum(r["sch01"][i] for r in full) for i in range(6)]
    sc_den = sum(sc)
    fc = [sum(r["fam01"][i] for r in full) for i in range(5)]
    tc = [sum(r["ten01"][i] for r in full) for i in range(6)]
    ten_den = tc[0] + tc[1] + tc[2] + tc[4]  # ex tenure-NS basis
    print("new-lane national shares (full-table CDs):",
          {"norel": round(relc['norel'] / relnat_den, 4),
           "cath": round(relc['cath'] / relnat_den, 4),
           "angl": round(relc['angl'] / relnat_den, 4),
           "y12less": round(sum(sc[:5]) / sc_den, 4),
           "oneparent": round(fc[2] / fc[4], 4),
           "mort": round(tc[1] / ten_den, 4),
           "rent": round(tc[2] / ten_den, 4),
           "ownOut": round(tc[0] / ten_den, 4),
           "rentPublic": round(tc[3] / ten_den, 4),
           "atsci": round(sum(r["ind01"] for r in full)
                          / sum(r["b1Persons"] - r["b1ov"]
                                for r in full), 4)})
    out_path.write_text(json.dumps({"tally": tally}) + "\n",
                        encoding="utf-8")
    print(f"OK -> {out_path} ({len(tally)} CDs)")


if __name__ == "__main__":
    main()
