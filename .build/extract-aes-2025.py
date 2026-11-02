"""extract-aes-2025.py – the Australian Election Study 2025's House first
preference vote by group, from the AES's own respondent file, for Who votes
for whom's election-time marks (gen-data DEMO_AES).

Input: the ADA general release's CSV (AES 2025, ADA 100279,
doi:10.26193/A9VEXA – 2_AES2025_CSV_100279_general.csv, cp1252). The file
is licensed by the ADA and is NOT committed; only the weighted group tables
below are. Rerun after a new ADA release:

    python3 .build/extract-aes-2025.py <path to 2_AES2025_CSV_100279_general.csv>

Output: data/aes-2025-groups.json – per set and group (the site's own
DEMO_SETS labels), each party's share of the group's House first
preferences in percent (weighted by `weight`, the AES's GREG weight scaled
to the respondent count), and the unweighted respondents behind it; plus
the same for all respondents, the figure each group's gap is measured
against.

Coding (data dictionary, AES2025_DataDictionary_100279_general.xlsx):
  vote      B9_1_r – Liberal 1 + National 3 → lnp, Labor 2, Greens 4,
            One Nation 11, Independent 96 + Other party 97 + Other party
            (confidentialised) 996 → oth. Informal / did not vote 6, does
            not apply 997 and skipped 999 are out of every base.
  gender    H1 – Male 1 → Men, Female 2 → Women (Other 3 joins no group).
  age       AGE (age at the survey, derived from year of birth) –
            18–34, 35–54, 55+.
  generation  birth year H2 – Gen Z 1997+, Millennials 1981–96, Gen X
            1965–80, Boomers 1946–64 (the site's four; the Silent
            generation joins none, as YouGov's doesn't). H2 is suppressed
            (999) for 154 respondents, all aged 18–23 by AGE, so their year
            is 2025 − AGE – every one of them Gen Z on either side of a
            birthday.
  education G3 highest qualification since school – none 1 → Year 12 or
            less; undergraduate diploma 4, associate diploma 5, trade 6,
            non-trade 7 → TAFE or trade; bachelor 3, postgraduate 2 →
            University.
  housing   J1 – own outright 1, mortgage 2, renting 3 (private) + 4
            (public). Other (boarding, living at home) 5 joins none.
  working   G4 – full time 1, part time 2, retired 5.
State and location aren't cut: those charts carry the AEC's counted 2025
result already. Language at home isn't asked.
"""
import csv
import json
import os
import sys
from collections import defaultdict

PARTY = {"1": "lnp", "3": "lnp", "2": "alp", "4": "grn", "11": "onp", "96": "oth", "97": "oth", "996": "oth"}
KEYS = ["alp", "lnp", "onp", "grn", "oth"]


def num(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def birth_year(r):
    y = num(r["H2"])
    if y and 1900 < y < 2010:
        return y
    a = num(r["AGE"])
    return 2025 - a if a and 17 < a < 110 else None


def generation(r):
    y = birth_year(r)
    if y is None:
        return None
    return None if y <= 1945 else "Boomers" if y <= 1964 else "Gen X" if y <= 1980 else "Millennials" if y <= 1996 else "Gen Z"


def age(r):
    a = num(r["AGE"])
    if not a or a < 18 or a > 110:
        return None
    return "18–34" if a <= 34 else "35–54" if a <= 54 else "55+"


SETS = {
    "gender": lambda r: {"1": "Men", "2": "Women"}.get(r["H1"]),
    "age": age,
    "generation": generation,
    "education": lambda r: {"1": "Year 12 or less", "4": "TAFE or trade", "5": "TAFE or trade", "6": "TAFE or trade",
                            "7": "TAFE or trade", "2": "University", "3": "University"}.get(r["G3"]),
    "housing": lambda r: {"1": "Own outright", "2": "Mortgage", "3": "Renting", "4": "Renting"}.get(r["J1"]),
    "working": lambda r: {"1": "Full time", "2": "Part time", "5": "Retired"}.get(r["G4"]),
}
ORDER = {
    "gender": ["Men", "Women"], "age": ["18–34", "35–54", "55+"],
    "generation": ["Gen Z", "Millennials", "Gen X", "Boomers"],
    "education": ["Year 12 or less", "TAFE or trade", "University"],
    "housing": ["Own outright", "Mortgage", "Renting"], "working": ["Full time", "Part time", "Retired"],
}


def table(rows):
    w = defaultdict(float)
    for r, p in rows:
        w[p] += float(r["weight"])
    t = sum(w.values())
    return {"n": len(rows), **{k: round(100 * w[k] / t, 1) for k in KEYS}}


def shares(rows):
    """weighted shares (0..1), total weight and Kish effective n"""
    w = defaultdict(float)
    s1 = s2 = 0.0
    for r, p in rows:
        x = float(r["weight"])
        w[p] += x
        s1 += x
        s2 += x * x
    return {k: w[k] / s1 for k in KEYS}, s1, s1 * s1 / s2


def gap_ci(group, rest):
    """95% margin, in points, of the group's gap from all respondents.
    All respondents = f·group + (1−f)·rest, so the gap is (1−f)(group −
    rest), and group and rest are independent samples: its variance is
    (1−f)²(p_g(1−p_g)/n_g + p_r(1−p_r)/n_r), each n the Kish effective n of
    the GREG weights (deff ≈ 1.6 on this file). A share of zero (no One
    Nation voter among Gen Z respondents) is floored at half a respondent
    so its cell still carries sampling error."""
    pg, wg, ng = shares(group)
    pr, wr, nr = shares(rest)
    f = wg / (wg + wr)
    out = {}
    for k in KEYS:
        a = max(pg[k], 0.5 / ng)
        b = max(pr[k], 0.5 / nr)
        out[k] = round(196 * (1 - f) * ((a * (1 - a) / ng + b * (1 - b) / nr) ** 0.5), 1)
    return out


def main(src):
    with open(src, encoding="cp1252", newline="") as f:
        rows = [(r, PARTY.get(r["B9_1_r"])) for r in csv.DictReader(f)]
    voted = [(r, p) for r, p in rows if p]
    out = {
        "_about": "Australian Election Study 2025 (ADA 100279, general release): House first preference by group, "
                  "weighted (GREG `weight`), percent of the group's formal first preferences; n = unweighted "
                  "respondents. Built by .build/extract-aes-2025.py – see its header for the coding.",
        "source": "https://dataverse.ada.edu.au/dataset.xhtml?persistentId=doi:10.26193/A9VEXA",
        "respondents": len(rows),
        "all": table(voted),
        "sets": {},
    }
    for sid, f in SETS.items():
        by = defaultdict(list)
        for r, p in voted:
            g = f(r)
            if g:
                by[g].append((r, p))
        out["sets"][sid] = {}
        for g in ORDER[sid]:
            if not by[g]:
                continue
            ids = {id(x) for x in by[g]}
            rest = [x for x in voted if id(x) not in ids]
            out["sets"][sid][g] = {**table(by[g]), "ci": gap_ci(by[g], rest)}
    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "aes-2025-groups.json")
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("wrote", os.path.normpath(dst))
    print("all", out["all"])
    for sid, gs in out["sets"].items():
        for g, v in gs.items():
            print(f"  {sid:<10} {g:<16} n={v['n']:<5}", "  ".join(f"{k} {v[k]:5.1f}±{v['ci'][k]:<4}" for k in KEYS))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: extract-aes-2025.py <2_AES2025_CSV_100279_general.csv>")
    main(sys.argv[1])
