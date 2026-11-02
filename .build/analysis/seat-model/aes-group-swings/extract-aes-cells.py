"""extract-aes-cells.py – each party's House vote by group at every Australian
Election Study 1993–2025, from the AES integrated respondent file, for the
group-swing backtest in this folder (backtest.mjs, poll-gaps.mjs, seats-*.mjs).

Input: the ADA general release of the AES integrated file 1967–2025, version
1 (2_aes67to25_integrated_general_v1.dta). The file is licensed by the ADA
and is NOT committed; only the weighted group tables below are. Needs pandas
(pip install pandas). Run from the repo root:

    python3 .build/analysis/seat-model/aes-group-swings/extract-aes-cells.py <path to the .dta>

Output: aes-cells.json beside this script. Per wave: each party's share of
the House first preferences of all respondents and of each group (weighted),
with the respondents (n) and effective sample (neff) behind it; `<dim>_all`
is the same over the respondents who answered that dimension, the base each
group's gap is measured against. Then per party a weighted logistic
regression of its vote on the groups together (`joint`), so overlapping
groups (young renters, older graduates) are separated.

Coding (variable labels and value labels of the integrated file):
  wave    aeswave – the twelve federal elections the seat model's swing fit
          covers (.build/analysis/seat-model/swing-fit.mjs LONG_YEARS).
  vote    vthor – Liberal 1 + National 3 → lnp, Labor 2 → alp, Greens 5 →
          grn, One Nation 6 → onp, Democrats 4 + other party 7, 11, 19 →
          oth, Independent 8 → ind. Did not vote, informal, don't know and
          missing are out of every base.
  weight  weight – 1993 and 2010 on. This release gives every 1996–2007
          respondent 1.0, so those six waves are unweighted.
  age     age (derived) – 18–34, 35–54, 55+.
  degree  hiqual – postgraduate 2 + bachelor 3 → degree; any other
          qualification answer → no degree; skipped and missing are out.
          2001's codes are shifted one step in this release (1 postgraduate,
          2 bachelor, 8 none): years of tertiary education (trtedu) show it,
          and check_degree_codes() tests that every run, so a corrected
          release stops the script instead of being misread.
  tenure  ownhome (1996 on) – own outright 1 → own, paying off 2 → mort,
          renting 3 (private) + 4 (public) → rent; other 5 (boarding,
          living at home) joins none.
  sex     sex – male 1, female 2.
  joint   young + old (35–54 the reference) + degree + male, and from 1996
          renter + mortgage (outright owners the reference); `joint_nt`
          leaves tenure out so 1993 compares.
"""
import json
import os
import sys

import numpy as np
import pandas as pd

WAVES = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
PARTIES = ["alp", "lnp", "grn", "onp"]
VOTE = {2: "alp", 1: "lnp", 3: "lnp", 5: "grn", 6: "onp", 4: "oth", 7: "oth", 11: "oth", 19: "oth", 8: "ind"}
COLS = ["aeswave", "vthor", "hiqual", "trtedu", "ownhome", "age", "sex", "weight"]
DEGREE = {2001: (1, 2)}          # everything else: (2, 3)
NONE_CODE = {2001: 8}            # everything else: 1


def check_degree_codes(df):
    """Degree codes must carry long tertiary study and the no-qualification code none."""
    for y in WAVES:
        g = df[(df.wave == y) & (df.trtedu >= 0)]
        deg = DEGREE.get(y, (2, 3))
        med_deg = g[g.hiqual.isin(deg)].trtedu.median()
        med_none = g[g.hiqual == NONE_CODE.get(y, 1)].trtedu.median()
        if not (med_deg >= 3 and med_none == 0):
            sys.exit(f"hiqual coding changed in {y}: median tertiary years {med_deg} for degree codes {deg}, "
                     f"{med_none} for code {NONE_CODE.get(y, 1)} – recheck DEGREE / NONE_CODE")


def shares(s):
    w = s.w.sum()
    return {"n": int(len(s)), "neff": round(float(w ** 2 / (s.w ** 2).sum()), 1),
            **{p: round(float(s.loc[s.vote == p, "w"].sum() / w), 5) for p in PARTIES}}


def logit_fit(X, y, w):
    """Weighted logistic regression by IRLS; SEs scaled to the effective sample."""
    b = np.zeros(X.shape[1])
    for _ in range(100):
        mu = 1 / (1 + np.exp(-(X @ b)))
        W = w * mu * (1 - mu)
        z = X @ b + (y - mu) / np.maximum(mu * (1 - mu), 1e-9)
        nb = np.linalg.solve(X.T @ (W[:, None] * X) + 1e-6 * np.eye(X.shape[1]), X.T @ (W * z))
        done = np.max(np.abs(nb - b)) < 1e-10
        b = nb
        if done:
            break
    mu = 1 / (1 + np.exp(-(X @ b)))
    scale = (w.sum() / (w ** 2).sum())
    cov = np.linalg.inv(X.T @ ((w * scale * mu * (1 - mu))[:, None] * X))
    return [round(float(v), 4) for v in b], [round(float(v), 4) for v in np.sqrt(np.diag(cov))]


def main(path):
    df = pd.read_stata(path, columns=COLS, convert_categoricals=False)
    df = df[df.aeswave.isin(WAVES)].copy()
    df["wave"] = df.aeswave.astype(int)
    check_degree_codes(df)
    df["vote"] = df.vthor.map(VOTE)
    df["w"] = np.where(df.weight > 0, df.weight, np.nan)
    a = df.age.where(df.age >= 18)
    df["ageg"] = np.select([a.between(18, 34), a.between(35, 54), a >= 55], ["y", "m", "o"], default="")
    df["deg"] = [np.nan if not h > 0 else float(h in DEGREE.get(y, (2, 3))) for h, y in zip(df.hiqual, df.wave)]
    df["ten"] = df.ownhome.map({1: "own", 2: "mort", 3: "rent", 4: "rent"})
    df["male"] = df.sex.map({1: 1.0, 2: 0.0})
    df = df[df.vote.notna() & df.w.notna()]

    out = {
        "_about": "Each party's share of House first preferences (vthor) by group at each AES 1993–2025, weighted "
                  "(1996–2007 unweighted: the release carries no weight for them), from the ADA's AES integrated file "
                  "1967–2025 v1, by extract-aes-cells.py; shares are fractions of the group's formal votes "
                  "(Labor, Coalition, Greens, One Nation, other parties, independents). joint: weighted logit of each "
                  "party's vote on young, old, degree, male (+ renter, mortgage from 1996); b and se in logit.",
        "source": "Australian Election Study integrated file 1967–2025, version 1, ADA general release "
                  "(2_aes67to25_integrated_general_v1). Respondent data not committed.",
        "waves": {},
    }
    for y in WAVES:
        g = df[df.wave == y]
        rec = {"all": shares(g)}
        ga = g[g.ageg != ""]
        rec["age"] = {k: shares(ga[ga.ageg == k]) for k in ["y", "m", "o"]}
        rec["age_all"] = shares(ga)
        gd = g[g.deg.notna()]
        rec["deg"] = {"1": shares(gd[gd.deg == 1.0]), "0": shares(gd[gd.deg == 0.0])}
        rec["deg_all"] = shares(gd)
        gt = g[g.ten.notna()]
        if len(gt) > 100:
            rec["ten"] = {k: shares(gt[gt.ten == k]) for k in ["own", "mort", "rent"]}
            rec["ten_all"] = shares(gt)
        gs = g[g.male.notna()]
        rec["sex"] = {"m": shares(gs[gs.male == 1.0]), "f": shares(gs[gs.male == 0.0])}
        rec["sex_all"] = shares(gs)
        has_ten = "ten" in rec
        gj = g[(g.ageg != "") & g.deg.notna() & g.male.notna() & (g.ten.notna() if has_ten else True)]
        cols = [np.ones(len(gj)), (gj.ageg == "y").astype(float), (gj.ageg == "o").astype(float), gj.deg.values, gj.male.values]
        names = ["const", "young", "old", "deg", "male"]
        if has_ten:
            cols += [(gj.ten == "rent").astype(float), (gj.ten == "mort").astype(float)]
            names += ["rent", "mort"]
        X = np.column_stack(cols)
        for key, k in (("joint", X.shape[1]), ("joint_nt", 5)):
            rec[key] = {"n": int(len(gj)), "names": names[:k]}
            for p in PARTIES:
                yv = (gj.vote == p).astype(float).values
                if yv.sum() < 15:
                    continue
                b, se = logit_fit(X[:, :k], yv, gj.w.values)
                rec[key][p] = {"b": b, "se": se}
        out["waves"][str(y)] = rec

    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "aes-cells.json"), "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    for y in WAVES:
        r = out["waves"][str(y)]
        print(y, "n", r["all"]["n"], " ".join(f"{p} {100 * r['all'][p]:.1f}" for p in PARTIES),
              "| degree", r["deg"]["1"]["n"], " ".join(f"{p} {100 * r['deg']['1'][p]:.1f}" for p in PARTIES))
    # the 2025 wave against the 2025 release's own CSV extraction (data/aes-2025-groups.json), where present
    ref = os.path.join(here, "..", "..", "..", "..", "data", "aes-2025-groups.json")
    if os.path.exists(ref):
        R = json.load(open(ref))["sets"]
        r = out["waves"]["2025"]
        pairs = [("University", r["deg"]["1"], R["education"]["University"]), ("Men", r["sex"]["m"], R["gender"]["Men"]),
                 ("Women", r["sex"]["f"], R["gender"]["Women"])] + \
                [(k, r["age"][c], R["age"][k]) for c, k in (("y", "18–34"), ("m", "35–54"), ("o", "55+"))]
        worst = max(abs(100 * mine[p] - theirs[p]) for _, mine, theirs in pairs for p in PARTIES)
        print(f"2025 v data/aes-2025-groups.json (the 2025 release's CSV): largest difference {worst:.2f} pts")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
