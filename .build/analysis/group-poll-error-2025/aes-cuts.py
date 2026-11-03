"""aes-cuts.py – the AES 2025's House first preferences cut on the pollsters' own bands, for group-error.mjs.

data/aes-2025-groups.json cuts the AES on the site's bands (18–34/35–54/55+ and so on). The polls in
bludgertrack-2022-25.json print other bands: age 18-34/35-49/50-64/65+, household income up to $50k /
$50k-$99k / $100k-$150k / $150k+, work status with an "Other" row, and RedBridge's AEC region classes. This
cuts the respondent file on exactly those bands, keyed by the feed's scope labels, so each poll cell has an
election-time counterpart with its own margin.

Input: the ADA general release's CSV (AES 2025, ADA 100279, doi:10.26193/A9VEXA,
2_AES2025_CSV_100279_general.csv, cp1252). Licensed by the ADA and NOT committed; only the weighted cells
below are. Run from the repo root:

    python3 .build/analysis/group-poll-error-2025/aes-cuts.py <path to 2_AES2025_CSV_100279_general.csv>

Coding is .build/extract-aes-2025.py's (vote B9_1_r: Liberal + National → lnp, Labor, Greens, One Nation 11,
independents and other parties → oth; informal, did not vote, does not apply and skipped are out of every
base; weights = the GREG `weight`), plus:
  age        AGE: 18–34, 35–49, 50–64, 65+.
  education  G3: none → No tertiary; undergraduate/associate diploma, trade, non-trade → TAFE/Tech;
             bachelor, postgraduate → University.
  income     J6 (household, gross, before tax). The AES's $45,001–60,000 band is split 1/3 below $50k and
             2/3 above, and $140,001–160,000 half each side of $150k (uniform within the band); each
             respondent's weight is shared out in those fractions.
  work       G4: full time 1, part time 2, retired 5, everything else answered (unemployed, student,
             caring, other) → Other.
  housing    J1: own outright, mortgage, renting (private + public). Boarding / living at home → none.
  region     CED_ABS (the ABS division code on the 2025 boundaries) → division name
             (data/census-2021-divisions-2025.json) → the AEC's demographic class
             (data/aec-2025-division-class.json). Ten respondents carry no division (-97). The file's CED_AEC
             column is not the AEC's results-site DivisionID, so it is not used.
  state      STATE (ABS order: 1 NSW … 8 ACT).
Religion is not cut: the general release keeps only four H6_r codes and puts 880 respondents in
"Other – confidentialised". Language at home is not asked.

Each cell: weighted shares (percent of the group's formal first preferences), unweighted n, Kish effective n,
the group's weighted share of all voters (f), its gap from all voters (group − all, points) and that gap's
standard error. As in extract-aes-2025.py the gap is (1 − f)(group − rest) with group and rest independent,
each with its Kish effective n; a zero share is floored at half a respondent. Education also carries the
graduate gap on the logit scale (University v everyone else with a qualification answer), as
seat-model/aes-group-swings/poll-gaps.mjs measures it, with its standard error.
"""
import csv
import json
import math
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
PARTY = {"1": "lnp", "3": "lnp", "2": "alp", "4": "grn", "11": "onp", "96": "oth", "97": "oth", "996": "oth"}
KEYS = ["alp", "lnp", "grn", "onp", "oth"]
STATE = {"1": "NSW", "2": "VIC", "3": "QLD", "4": "SA", "5": "WA", "6": "TAS", "7": "NT", "8": "ACT"}
CLASS = {"inner": "Inner Metropolitan", "outer": "Outer Metropolitan", "provincial": "Provincial", "rural": "Rural"}


def num(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def division_class():
    """ABS CED code (the AES's CED_ABS, 2024 boundaries = the 2025 election's) → the AEC's 2025 demographic class."""
    with open(os.path.join(ROOT, "data/census-2021-divisions-2025.json"), encoding="utf-8") as f:
        names = {d["code"].replace("CED", ""): d["name"] for d in json.load(f)["divisions"]}
    with open(os.path.join(ROOT, "data/aec-2025-division-class.json"), encoding="utf-8") as f:
        cls = {d["name"]: CLASS[d["class"]] for d in json.load(f)["divisions"]}
    return {i: cls[n] for i, n in names.items()}


def age(r):
    a = num(r["AGE"])
    if not a or a < 18 or a > 110:
        return []
    return [("Age 18-34" if a <= 34 else "Age 35-49" if a <= 49 else "Age 50-64" if a <= 64 else "Age 65+", 1.0)]


INCOME = {1: [("Up to $50k", 1)], 3: [("Up to $50k", 1)], 5: [("Up to $50k", 1)], 7: [("Up to $50k", 1)],
          9: [("Up to $50k", 1 / 3), ("$50k-$99k", 2 / 3)], 11: [("$50k-$99k", 1)], 13: [("$50k-$99k", 1)],
          15: [("$100k-$150k", 1)], 17: [("$100k-$150k", 1)], 19: [("$100k-$150k", 0.5), ("$150k+", 0.5)],
          21: [("$150k+", 1)], 24: [("$150k+", 1)], 25: [("$150k+", 1)]}


def make_dims(div_class):
    def pick(field, mapping):
        return lambda r: [(mapping[r[field]], 1.0)] if r[field] in mapping else []

    return {
        "gender": pick("H1", {"1": "Male", "2": "Female"}),
        "age": age,
        "education": pick("G3", {"1": "No tertiary", "4": "TAFE/Tech", "5": "TAFE/Tech", "6": "TAFE/Tech",
                                 "7": "TAFE/Tech", "2": "University", "3": "University"}),
        "income": lambda r: INCOME.get(num(r["J6"]), []),
        "work": pick("G4", {"1": "Full time", "2": "Part time", "5": "Retired", "3": "Other", "4": "Other",
                            "6": "Other", "7": "Other", "96": "Other"}),
        "housing": pick("J1", {"1": "Own outright", "2": "Mortgage", "3": "Rent", "4": "Rent"}),
        "region": lambda r: [(div_class[r["CED_ABS"]], 1.0)] if r["CED_ABS"] in div_class else [],
        "state": pick("STATE", STATE),
    }


def shares(items):
    """items: (weight, party). Weighted shares 0..1, total weight, Kish effective n."""
    w = defaultdict(float)
    s1 = s2 = 0.0
    for x, p in items:
        w[p] += x
        s1 += x
        s2 += x * x
    return {k: w[k] / s1 for k in KEYS}, s1, (s1 * s1 / s2 if s2 else 0.0)


def logit(p):
    return math.log(p / (1 - p))


def main(src):
    with open(src, encoding="cp1252", newline="") as f:
        rows = [(r, PARTY.get(r["B9_1_r"])) for r in csv.DictReader(f)]
    voted = [(r, p) for r, p in rows if p]
    dims = make_dims(division_class())
    pa, wa, na = shares([(float(r["weight"]), p) for r, p in voted])
    out = {
        "_about": "AES 2025 House first preferences cut on the pollsters' bands (bludgertrack-2022-25.json scope labels), by aes-cuts.py – see its header. Shares in percent of the group's formal first preferences (GREG-weighted); n unweighted; neff Kish; f = the group's weighted share of all voters; gap = group − all voters (points) with its standard error gapSe (1 SD, points).",
        "source": "https://dataverse.ada.edu.au/dataset.xhtml?persistentId=doi:10.26193/A9VEXA",
        "all": {"n": len(voted), "neff": round(na, 1), **{k: round(100 * pa[k], 2) for k in KEYS}},
        "groups": {},
    }
    for dim, fn in dims.items():
        cells = defaultdict(list)  # group -> [(weight, party)]
        member = defaultdict(lambda: defaultdict(float))  # group -> respondent index -> fraction
        for i, (r, p) in enumerate(voted):
            for g, frac in fn(r):
                cells[g].append((float(r["weight"]) * frac, p))
                member[g][i] += frac
        for g, items in cells.items():
            pg, wg, ng = shares(items)
            rest = [(float(r["weight"]) * (1 - member[g].get(i, 0.0)), p) for i, (r, p) in enumerate(voted)
                    if member[g].get(i, 0.0) < 1]
            pr, wr, nr = shares(rest)
            f = wg / (wg + wr)
            se = {}
            for k in KEYS:
                a = max(pg[k], 0.5 / ng)
                b = max(pr[k], 0.5 / nr)
                se[k] = round(100 * (1 - f) * math.sqrt(a * (1 - a) / ng + b * (1 - b) / nr), 2)
            cell = {"dim": dim, "n": round(sum(member[g].values()), 1), "neff": round(ng, 1), "f": round(f, 4),
                    **{k: round(100 * pg[k], 2) for k in KEYS},
                    "gap": {k: round(100 * (pg[k] - pa[k]), 2) for k in KEYS}, "gapSe": se}
            out["groups"][g] = cell
    # graduate gap on the logit scale: University v everyone else who answered G3
    uni = [(float(r["weight"]), p) for r, p in voted if r["G3"] in ("2", "3")]
    non = [(float(r["weight"]), p) for r, p in voted if r["G3"] in ("1", "4", "5", "6", "7")]
    pu, _, nu = shares(uni)
    pn, _, nn = shares(non)
    out["graduateGap"] = {k: {"uni": round(100 * pu[k], 2), "non": round(100 * pn[k], 2),
                              "g": round(logit(pu[k]) - logit(pn[k]), 4),
                              "se": round(math.sqrt(1 / (nu * pu[k] * (1 - pu[k])) + 1 / (nn * pn[k] * (1 - pn[k]))), 4)}
                          for k in KEYS}
    dst = os.path.join(HERE, "aes-cuts.json")
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("wrote", os.path.relpath(dst), "| all", out["all"])
    for g, v in out["groups"].items():
        print(f"  {v['dim']:<9} {g:<20} n={v['n']:<7} neff={v['neff']:<7}",
              "  ".join(f"{k} {v[k]:5.1f} ({v['gap'][k]:+5.1f}±{v['gapSe'][k]:.1f})" for k in KEYS))
    print("  graduate gap (logit):", "  ".join(f"{k} {v['g']:+.2f}±{v['se']:.2f}" for k, v in out["graduateGap"].items()))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: aes-cuts.py <2_AES2025_CSV_100279_general.csv>")
    main(sys.argv[1])
