#!/usr/bin/env python3
"""cache/bcp-2001-cd-tally.json — the 2001 BCP per-CD tally the people
lanes read.

One pass over the nine per-state zips mirrored from
archive.org/details/2001-bcp-cd-00_aus (ABS Census 2001, Basic
Community Profiles - All Collection Districts; ABS does not currently
host a bulk 2001 BCP — the CD-level product was the paid CDATA CD).
Each BCP_<7-digit-CD>.xlsx carries 33 tables (B 01..B 33) plus front
matter; the people lanes need six:

  B 01  Selected characteristics      total persons (cross-check)
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
  B 23  Non-school qualification      Postgraduate/GradDip/Bachelor,
                        Not stated
  B 27B Occupation by age by sex      nine ASCO-era major groups x 7
                        age bands, col 9 = Total (2 of 2 = Persons)

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
           ("B 06", "B 08", "B 23", "B 27B")):
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

    # ---- B 01 summary
    b1 = sheet_rows("B 01", 1, 4)
    b1_persons = None
    for row in b1:
        lab = label_of(row)
        if lab.startswith("total persons"):
            b1_persons = cell_of(row, 3)

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
                              "b3_total": b3_total, "b3_ov": b3_ov}.items()
               if v is None]
    if missing:
        raise ValueError("table drift " + ",".join(missing))
    if oth is not None and oth < 0:
        oth = None  # perturbation pushed the computed total negative —
        # emit no share, never clamp

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
    }


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
            if rec.get("shortCd"):
                checks["prof-short-cd"] += 1
                tally[code] = rec
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
    out_path.write_text(json.dumps({"tally": tally}) + "\n",
                        encoding="utf-8")
    print(f"OK -> {out_path} ({len(tally)} CDs)")


if __name__ == "__main__":
    main()
