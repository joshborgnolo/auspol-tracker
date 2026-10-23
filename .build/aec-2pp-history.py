"""aec-2pp-history.py – the national + per-state + per-class TWO-PARTY-
PREFERRED history behind the /flows-explained/ chart's "View: 2PP" flip
(2026-10-23, the pair facet the user asked for beside the sibling session's
"View: Primary votes").

Two lines per view: Labor's and the Coalition's share of the two-party
preferred vote at each federal election:

  national 1972–2025   data/polls.json's own election records (tpp_alp /
                       tpp_lnp – the site's canonical pins, displayed
                       verbatim; the AEC's per-division two-party counts
                       recompose them to within 0.05 every download year,
                       asserted below)
  states   2004–2025   .build/aec-flow-src/tppdiv-<year>.csv, the committed
                       AEC Two Party Preferred By Division downloads: every
                       division's notional Labor-v-Coalition count, ALP and
                       Coalition votes summed per state. No per-state cut
                       before 2004 – the downloads' own floor (the primary
                       history's per-state span matches it).
  classes  2004–2025   the same per-division counts regrouped by the
                       election's own AEC Divisional Classifications block
                       (data/division-classifications.json), so a
                       recategorised seat moves classes with it. Starts
                       2004, not 1996 like the primary classes: the
                       downloads' notional two-party count does not exist
                       for the typed era (the hcands files are first
                       preferences only, and the 1996–2001 tcp files are
                       final-pair flows, not Labor-v-Coalition counts).

Every emitted cell is Labor's share; the Coalition cell is 100 minus it
(two lines that always sum to exactly 100) – the margin line a third party
would draw is nobody's two-party share. No Senate view exists: the AEC
counts no two-party preferred in the chamber seats are not filled from.

Usage: python3 .build/aec-2pp-history.py [--check]
  default writes data/2pp-history.json; --check re-derives and compares.
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "aec-flow-src")
OUT = os.path.join(ROOT, "data", "2pp-history.json")

YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
HIST_YEARS = [1972, 1974, 1975, 1977, 1980, 1983, 1984, 1987, 1990, 1993,
              1996, 1998, 2001]   # national only, from the canonical records
STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"]
STATE_FULL = {"nsw": "New South Wales", "vic": "Victoria", "qld": "Queensland",
              "wa": "Western Australia", "sa": "South Australia", "tas": "Tasmania",
              "act": "Australian Capital Territory", "nt": "Northern Territory"}
CLASS_META = (("inner", "Inner metropolitan", "inner metro"),
              ("outer", "Outer metropolitan", "outer metro"),
              ("provincial", "Provincial", "provincial"),
              ("rural", "Rural", "rural"))
CLS_KEY = {"inner metropolitan": "inner", "outer metropolitan": "outer",
           "provincial": "provincial", "rural": "rural"}

# ---- parse the per-division two-party downloads ------------------------------
def tppdiv_votes(year):
    """tppdiv-<year>.csv -> {"nat": [alp, lnp], "perState": {st: [alp, lnp]},
       "perDiv": {div: [alp, lnp]}}. The download's TotalVotes column is its
       own formality: ALP + Coalition votes must recompose it in every
       division (a drift there means the count's shape moved, not a seat)."""
    path = os.path.join(SRC, f"tppdiv-{year}.csv")
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    hi = next(i for i, r in enumerate(rows) if r and r[0].strip() == "DivisionNm")
    h = {c: i for i, c in enumerate(rows[hi])}
    # column ORDER shuffles about between years (2004 prints the Coalition
    # first, later years Labor) – always find by name
    ia = h["Australian Labor Party Votes"]
    il = h["Liberal/National Coalition Votes"]
    itt, idiv, ist = h["TotalVotes"], h["DivisionNm"], h["StateAb"]
    out = {"nat": [0.0, 0.0], "perState": {}, "perDiv": {}}
    for r in rows[hi + 1:]:
        if len(r) <= itt or not r[idiv].strip():
            continue
        a, l = float(r[ia]), float(r[il])
        assert abs(a + l - float(r[itt])) < 1.5, \
            f"{year} {r[idiv]}: ALP + Coalition votes {a + l} != TotalVotes {r[itt]}"
        st = r[ist].strip().lower()
        assert st in STATES, f"{year} {r[idiv]}: unmapped state {st}"
        out["nat"][0] += a
        out["nat"][1] += l
        p = out["perState"].setdefault(st, [0.0, 0.0])
        p[0] += a
        p[1] += l
        out["perDiv"][r[idiv].strip()] = [a, l]
    return out

def alp_share(v):
    return 100.0 * v[0] / sum(v)

def build():
    cls_blocks = json.load(open(os.path.join(ROOT, "data", "division-classifications.json"),
                                encoding="utf-8"))["elections"]
    elections = json.load(open(os.path.join(ROOT, "data", "polls.json"),
                               encoding="utf-8"))["elections"]

    # national: the site's canonical election records, verbatim. The machine
    # counts recompose them within 0.05 in every download year (asserted
    # here, so a torn record or a torn download both fail loudly).
    nat_rows = {}
    for y in HIST_YEARS + YEARS:
        rec = elections.get(f"e{y}")
        assert rec and rec.get("tpp_alp") is not None and rec.get("tpp_lnp") is not None, \
            f"{y}: no canonical tpp pair in data/polls.json"
        nat_rows[y] = (rec["tpp_alp"], rec["tpp_lnp"])

    per_state = {s: {} for s in STATES}     # st -> {year: (alp, lnp) shares}
    per_class = {k: {} for k, _, _ in CLASS_META}
    for y in YEARS:
        v = tppdiv_votes(y)
        derived = alp_share(v["nat"])
        assert abs(derived - nat_rows[y][0]) < 0.05, \
            f"{y} national 2PP: per-division count {derived:.2f} != canonical {nat_rows[y][0]}"
        assert sorted(v["perState"]) == sorted(STATES), f"{y}: a state is missing"
        for st in STATES:
            a = alp_share(v["perState"][st])
            per_state[st][y] = (a, 100.0 - a)
        blk = cls_blocks.get(str(y))
        assert blk, f"{y}: no Divisional Classifications block"
        assert set(v["perDiv"]) == set(blk), \
            f"{y}: class join drifted - counted {sorted(set(v['perDiv']) - set(blk))[:3]}, classified-only {sorted(set(blk) - set(v['perDiv']))[:3]}"
        sums = {k: [0.0, 0.0] for k, _, _ in CLASS_META}
        for div, pair in v["perDiv"].items():
            ck = CLS_KEY[blk[div]["classification"].lower()]
            sums[ck][0] += pair[0]
            sums[ck][1] += pair[1]
        for ck, _, _ in CLASS_META:
            a = alp_share(sums[ck])
            per_class[ck][y] = (a, 100.0 - a)

    def view(label, elections_copy, rows, short=None):
        d = {"label": label, "elections": elections_copy,
             "years": sorted(rows),
             "alp": [round(rows[y][0], 2) for y in sorted(rows)],
             "lnp": [round(rows[y][1], 2) for y in sorted(rows)]}
        if short:
            d["short"] = short
        return d

    doc = {
        "_comment": "GENERATED by .build/aec-2pp-history.py – Labor v Coalition two-party-preferred shares behind the flows-explained chart's 2PP view. National cells are data/polls.json's canonical election records verbatim; state and class cuts are the AEC's Two Party Preferred By Division downloads (tppdiv-*.csv, 2004–2025) summed per state, or per AEC division classification (fed.classes). The Coalition cell is 100 minus Labor's. No Senate view: the AEC counts no 2PP there.",
        "fed": view("Federal", "Australian federal elections", nat_rows,
                    ),
    }
    doc["fed"]["states"] = {}
    for s in STATES:
        doc["fed"]["states"][s] = view(STATE_FULL[s],
                                       STATE_FULL[s] + " electorates at federal elections",
                                       per_state[s])
    doc["fed"]["classes"] = {}
    for ck, label, short in CLASS_META:
        doc["fed"]["classes"][ck] = view(label, f"federal elections in {short} seats",
                                         per_class[ck], short=short)
    return doc

def main():
    doc = build()
    if "--check" in sys.argv:
        original = None
        if os.path.exists(OUT):
            original = json.load(open(OUT))
        if original != doc:
            print("CHECK FAIL: data/2pp-history.json is not what the script builds", file=sys.stderr)
            sys.exit(1)
        print("check ok")
        return
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=1, separators=(",", ": "))
        f.write("\n")
    print("wrote", os.path.relpath(OUT, ROOT))
    FED = doc["fed"]
    print("\nNational ALP two-party preferred:")
    print("  " + "  ".join(f"{y}:{a}" for y, a in zip(FED["years"], FED["alp"])))
    for ck, v in FED["classes"].items():
        print(f"{ck:>10}: " + "  ".join(f"{y}:{a}" for y, a in zip(v["years"], v["alp"])))

if __name__ == "__main__":
    main()
