"""secret-harbour-flows.py - the 2026 Secret Harbour by-election's Labor v
One Nation preference flows for the whole seat, by group (Liberal, Greens,
everyone else), for the preference-flows explainer and /flows/ crosses.

No count of each party's voters exists for the whole seat. Two sources do:
  * the WAEC's count sheets for the Secret Harbour Early Polling Place
    (early period and polling day, the two scanned PDFs below): every
    candidate's own ballots split between Labor (Tree) and One Nation
    (Herdegen) - 47% of the seat's formal votes, typed here;
  * the WAEC's results feed (data/secret-harbour-2026-waec.json): each
    candidate's first preferences and the seat's final two-candidate
    count, so the REST of the seat's first preferences and its two-candidate
    split follow by subtraction - how its minor-party ballots split IN TOTAL
    is known exactly (54% to Labor, against 46% at the early polling place).
What stays unknown is how that total divides between the parties outside
the early polling place. The estimate moves every candidate's early-
polling-place flow by one shift (on the logit scale) until the rest adds
up to its known total; the RANGE is the spread over three other ways of
dividing it (the same points for every party, a share of each party's room
left, and the shape of the site's pile model on the seat's distribution) -
how much the answer hangs on that choice, not a tested 90% error.
Writes data/secret-harbour-flows.json. Usage: python3 .build/secret-harbour-flows.py
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = ("https://www.elections.wa.gov.au/sites/default/files/CAP%20Form%20and%20guides/2026%20By-election/Count%20Results/"
          "Secret-Harbour-Early-Polling-Place-Early-polling-period-only.pdf",
          "https://www.elections.wa.gov.au/sites/default/files/CAP%20Form%20and%20guides/2026%20By-election/Count%20Results/"
          "Secret-Harbour-Early-Polling-Place-Polling-day-only.pdf")
# [first preferences, to TREE (ALP), to HERDEGEN (PHON), exhausted], as printed
EARLY = {"ROBERTSON": [2100, 620, 1475, 5], "BARTON": [107, 27, 80, 0], "DAVIES": [748, 676, 72, 0], "BUCHANAN": [391, 202, 189, 0],
         "HAMILTON": [37, 15, 22, 0], "TREE": [2945, 2945, 0, 0], "HOWARD": [35, 17, 18, 0], "BURDETT": [160, 43, 117, 0],
         "JENSEN": [166, 95, 69, 2], "VAN LIESHOUT": [46, 18, 28, 0], "GULLAN": [29, 17, 12, 0], "FELS": [71, 36, 35, 0],
         "PALMER": [117, 74, 43, 0], "HERDEGEN": [5166, 0, 5166, 0], "DUNNE": [22, 14, 8, 0], "MURRELL": [45, 20, 25, 0]}
DAY = {"ROBERTSON": [151, 50, 101, 0], "BARTON": [11, 3, 8, 0], "DAVIES": [79, 68, 11, 0], "BUCHANAN": [36, 20, 15, 1],
       "HAMILTON": [6, 4, 2, 0], "TREE": [162, 162, 0, 0], "HOWARD": [5, 2, 3, 0], "BURDETT": [12, 4, 8, 0],
       "JENSEN": [18, 11, 7, 0], "VAN LIESHOUT": [5, 1, 4, 0], "GULLAN": [2, 2, 0, 0], "FELS": [9, 3, 6, 0],
       "PALMER": [13, 8, 5, 0], "HERDEGEN": [357, 0, 357, 0], "DUNNE": [2, 0, 2, 0], "MURRELL": [4, 2, 2, 0]}
SHEET_TOTALS = {"early": (12185, 4819, 7359, 7), "day": (872, 340, 531, 1)}   # the sheets' printed A, B, C, D
# the site's pile model on the seat's full distribution (no counts used),
# its whole-seat flows: the shape the fourth rule borrows (computed
# 2026-10-22 with the pooled own-v-inherited contrast; one seat has too few
# exclusions per party to fit its own)
MODEL = {"lib": 0.3517, "grn": 0.8437, "oth": 0.5173}
GROUP = lambda k: "lib" if k == "ROBERTSON" else "grn" if k == "DAVIES" else "oth"


def main():
    for nm, sheet in (("early", EARLY), ("day", DAY)):
        for k, (fp, a, o, x) in sheet.items():
            assert fp == a + o + x, f"{nm} {k}: row does not add"
        assert tuple(sum(r[i] for r in sheet.values()) for i in range(4)) == SHEET_TOTALS[nm], f"{nm}: totals"
    w = json.load(open(os.path.join(ROOT, "data", "secret-harbour-2026-waec.json")))
    seat = {c["BALLOT_PAPER_NAME"]: c["Votes_Counted"] for c in w["resultsCandidates"]}
    tcp = {r["Ballot_Paper_Name"].split(" - ")[0]: r["Votes_Counted"] for r in w["results2CP"]}
    ev = {k: [a + b for a, b in zip(EARLY[k], DAY[k])] for k in EARLY}
    rest = {k: seat[k] - ev[k][0] for k in ev}
    assert all(v >= 0 for v in rest.values()), "the early polling place can't exceed the seat"
    minors = [k for k in ev if k not in ("TREE", "HERDEGEN")]
    rest_alp = tcp["TREE"] - sum(v[1] for v in ev.values())
    gain = rest_alp - rest["TREE"]
    lg = lambda p: math.log(p / (1 - p))
    il = lambda x: 1 / (1 + math.exp(-x))
    fe = {k: (ev[k][1] + 0.5) / (ev[k][1] + ev[k][2] + 1) for k in minors}

    def solve(shift):
        lo, hi = -6.0, 6.0
        for _ in range(100):
            mid = (lo + hi) / 2
            if sum(rest[k] * shift(k, mid) for k in minors) < gain:
                lo = mid
            else:
                hi = mid
        return {k: shift(k, (lo + hi) / 2) for k in minors}

    def whole(fr):
        out = {}
        for g in ("lib", "grn", "oth"):
            ks = [k for k in minors if GROUP(k) == g]
            a = sum(ev[k][1] for k in ks) + sum(rest[k] * fr[k] for k in ks)
            n = sum(ev[k][1] + ev[k][2] for k in ks) + sum(rest[k] for k in ks)
            out[g] = round(100 * a / n, 2)
        return out
    rules = {
        "logit shift": whole(solve(lambda k, t: il(lg(fe[k]) + t))),
        "same points": whole(solve(lambda k, t: min(1, max(0, fe[k] + t / 10)))),
        "share of the room left": whole(solve(lambda k, t: fe[k] + (1 - fe[k]) * (1 - math.exp(-max(t, 0))))),
        "model's party shape": whole(solve(lambda k, t: il(lg(MODEL[GROUP(k)]) + t))),
    }
    est = rules["logit shift"]
    rng = {g: [min(r[g] for r in rules.values()), max(r[g] for r in rules.values())] for g in est}
    evf = {}
    for g in ("lib", "grn", "oth"):
        ks = [k for k in minors if GROUP(k) == g]
        evf[g] = round(100 * sum(ev[k][1] for k in ks) / sum(ev[k][1] + ev[k][2] for k in ks), 2)
    formal, evn = sum(seat.values()), sum(v[0] for v in ev.values())
    ev_minor = sum(ev[k][1] for k in minors) / sum(ev[k][1] + ev[k][2] for k in minors)
    rest_minor = gain / (rest_alp + (tcp["HERDEGEN"] - sum(v[2] for v in ev.values())) - rest["TREE"] - rest["HERDEGEN"])
    out = {"estimate": est, "range": rng, "rules": rules, "early_polling_place": evf,
           "early_share": round(100 * evn / formal, 1), "minor_to_labor": {"early": round(100 * ev_minor, 1), "rest": round(100 * rest_minor, 1)},
           "model": {g: round(100 * v, 2) for g, v in MODEL.items()}, "sheets": SHEETS, "feed": w["_source"]}
    with open(os.path.join(ROOT, "data", "secret-harbour-flows.json"), "w") as f:
        json.dump(out, f, indent=1)
        f.write("\n")
    print(json.dumps({k: out[k] for k in ("estimate", "range", "early_polling_place", "early_share", "minor_to_labor")}))


if __name__ == "__main__":
    main()
