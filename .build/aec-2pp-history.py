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
  states   1996–2025   2004–2025 from .build/aec-flow-src/tppdiv-<year>.csv
                       (the committed AEC Two Party Preferred By Division
                       downloads); 1996–2001 from the AEC statistics packs'
                       House Two Party Preferred By Polling Place tables
                       (htpp-<year>.txt, committed beside the downloads – a
                       genuine notional Labor-v-Coalition count per
                       division, summed per state via the Divisional
                       Classifications blocks' state field, the file itself
                       carrying no state column). 1998 counts 147
                       divisions: Newcastle's final pair ran Labor v
                       independent (Morris), so the AEC's own table omits
                       it – that exclusion is the product's, never ours.
  classes  1996–2025   the same per-division counts regrouped by the
                       election's own AEC Divisional Classifications block
                       (data/division-classifications.json), so a
                       recategorised seat moves classes with it. The
                       primary view's class span, reached the same day the
                       explainer asked for the 2PP facet (user 2026-10-24:
                       "it should extend to 1996, no?") – the earlier
                       "no notional count before 2004" note was wrong: the
                       HTPP tables were in the statistics zips all along
                       (1993's is informal votes only, so 1996 is the
                       true floor).
  senate   2016–2025   IMPLIED, never counted – no official two-party
                       exists for the chamber seats are not filled from.
                       From the committed ATL tallies
                       (.build/aec-flow-src/senate-atl/counts.json, the
                       AEC's formal-preferences corpus counted by
                       .build/aec-flow-src/senate-atl/analyse_atl_flows.py):
                       the share of above-the-line papers naming at least
                       one major party that name Labor first. National +
                       per-state (the counts' own state codes), 2016 on –
                       the rules handed Senate preferences to the voter at
                       the 2016 double dissolution, so earlier elections
                       cannot be read this way. Marked "implied": true in
                       the JSON (user 2026-10-24: "add House: Lower ⇄ to
                       2pp view (adding upper house data)").
  nsw lc   2011–2023   IMPLIED like the Senate's: the same naming-a-major
                       share over the New South Wales Legislative
                       Council's above-the-line ballots, from the
                       committed NSWEC counts (.build/nswec-lc-flow-src/
                       counts.json, counted by .build/nswec-lc-flow-src/
                       analyse_nsw_lc*.py). NSW's council is the ONLY
                       state upper house whose ballot record counts
                       voters' own preferences (Victoria's ran party
                       tickets to 2022, Western Australia's first
                       ticket-free count prints no ballot-level record,
                       the rest publish none; ACT, NT and Queensland
                       have no upper house). Marked "implied": true too
                       (user 2026-10-24: "what about state-level upper
                       house 2pps" / "add it").

Every emitted cell is Labor's share; the Coalition cell is 100 minus it
(two lines that always sum to exactly 100) – the margin line a third party
would draw is nobody's two-party share. The Senate block's cells are
estimates of a quantity the AEC does not count; everything else in the
file is a record.

Usage: python3 .build/aec-2pp-history.py [--check]
  default writes data/2pp-history.json; --check re-derives and compares.
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "aec-flow-src")
OUT = os.path.join(ROOT, "data", "2pp-history.json")

YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
HTT_YEARS = [1996, 1998, 2001]   # the statistics packs' HTPP-by-place years
CUT_YEARS = HTT_YEARS + YEARS    # every state/class cut year, in order
SEN_YEARS = [2016, 2019, 2022, 2025]   # the ATL-corpus post-GVT events
# the implied senate two-party's verified national cells (the aec-senate-
# atl-flows skill's ad-hoc figures, reproduced exactly from the committed
# counts) – a drift in counts.json breaks these before it reaches the page
SEN_NAT_PINS = {2016: 49.24, 2019: 46.8, 2022: 52.38, 2025: 55.99}
LC_YEARS = [2011, 2015, 2019, 2023]   # the NSWEC council bank's events
# the implied council two-party's verified cells, reproduced exactly from
# the committed counts – a drift in nswec-lc-flow-src/counts.json breaks
# these before it reaches the page (same doctrine as the senate pins)
LC_PINS = {2011: 34.11, 2015: 43.57, 2019: 48.32, 2023: 57.44}
HIST_YEARS = [1972, 1974, 1975, 1977, 1980, 1983, 1984, 1987, 1990, 1993,
              1996, 1998, 2001]   # national only, from the canonical records
# divisions a statistics pack's own HTPP table omits: 1998's Newcastle ran
# its final pair Labor v independent (Allan Morris held it 1983–2001), so
# no Labor-v-Coalition count exists for it in the AEC's table
HTT_EXCLUDED = {1998: {"Newcastle"}}
STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"]
STATE_FULL = {"nsw": "New South Wales", "vic": "Victoria", "qld": "Queensland",
              "wa": "Western Australia", "sa": "South Australia", "tas": "Tasmania",
              "act": "Australian Capital Territory", "nt": "Northern Territory"}
# the flow-history states' short forms — the explainer menus and tooltips
# show these ("Federal, NT"), never the full name spelt out
STATE_SHORT = {"nsw": "NSW", "vic": "Vic", "qld": "Qld", "wa": "WA",
               "sa": "SA", "tas": "Tas", "act": "ACT", "nt": "NT"}
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

def htpp_votes(year):
    """htpp-<year>.txt -> {"perDiv": {div: [alp, coalition]}}: the statistics
       packs' House Two Party Preferred By Polling Place table (semicolon
       CSV, one notional Labor-v-Coalition count per division summed from
       its polling places). No state column in the file – state and class
       both come from the classifications block it joins below. 1998
       omits Newcastle (its final pair ran Labor v independent) – the
       AEC's own table, so the exclusion is the product's, never ours."""
    path = os.path.join(SRC, f"htpp-{year}.txt")
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f, delimiter=";"))
    hi = next(i for i, r in enumerate(rows) if r and r[0].strip() == "Division")
    h = {c: i for i, c in enumerate(rows[hi])}
    ia, ic, idiv = h["ALP TPP Vote"], h["Coalition TPP Vote"], h["Division"]
    # the product's own formality check: the ALP and Coalition columns'
    # share field must read back off every row (a drift there means the
    # file's shape moved, not a seat)
    ipc = h["ALP TPP Pc"]
    out = {"perDiv": {}}
    for r in rows[hi + 1:]:
        if len(r) <= ic or not r[idiv].strip():
            continue
        a, c = float(r[ia]), float(r[ic])
        if a + c:
            assert abs(100 * a / (a + c) - float(r[ipc])) < 0.02, \
                f"{year} {r[idiv]} {r[1]}: ALP pc {r[ipc]} != shares of ({a}, {c})"
        else:
            # a mobile team that recorded nobody prints 0 + 0; the AEC
            # carries its share as 0.00, and the pair adds nothing to a sum
            assert float(r[ipc] or 0) == 0.0, \
                f"{year} {r[idiv]} {r[1]}: empty team prints a nonzero share ({r[ipc]})"
        p = out["perDiv"].setdefault(r[idiv].strip(), [0.0, 0.0])
        p[0] += a
        p[1] += c
    return out

def alp_share(v):
    return 100.0 * v[0] / sum(v)

# ---- the implied Senate two-party -------------------------------------------
def senate_implied():
    """senate-atl/counts.json -> {year: {"nat": (alp, lnp),
       "perState": {st: (alp, lnp)}}}: the implied two-party over above-
       the-line ballots – Labor's share of the ATL papers that name at
       least one major party that name Labor first. The five
       voter families and the four post-GVT events are the contract; a
       new family or a new event is the generator's cue to be re-looked
       at, never to silently widen."""
    counts = json.load(open(os.path.join(SRC, "senate-atl", "counts.json"),
                            encoding="utf-8"))["events"]
    assert set(counts) == {str(y) for y in SEN_YEARS}, \
        f"counts.json events {sorted(counts)} != {SEN_YEARS} - review the senate span"
    def imply(tally):
        a = sum(f["toALP"] for f in tally.values())
        c = sum(f["toCOAL"] for f in tally.values())
        alp = 100.0 * a / (a + c)
        return (alp, 100.0 - alp)
    out = {}
    for ys in map(str, SEN_YEARS):
        ev = counts[ys]
        for fam in ev["counts"]:
            assert fam in ("ALP", "COAL", "GRN", "PHON", "OTHER"), \
                f"{ys}: unmapped voter family {fam} - review the implied formula"
        nat = imply(ev["counts"])
        pin = SEN_NAT_PINS[int(ys)]
        assert abs(nat[0] - pin) < 0.005, \
            f"{ys} national implied 2PP: {nat[0]:.2f} != the verified {pin}"
        states = {s.upper(): s for s in STATES}
        assert set(ev["states"]) == set(states), \
            f"{ys}: counts' states {sorted(ev['states'])} != the eight"
        out[int(ys)] = {"nat": nat,
                        "perState": {states[st]: imply(tally)
                                     for st, tally in ev["states"].items()}}
    return out

# ---- the implied NSW Legislative Council two-party ---------------------------
def nsw_lc_implied():
    """nswec-lc-flow-src/counts.json -> {year: (alp, lnp)}: the implied
       two-party over the council's above-the-line ballots – the same
       naming-a-major share as the senate block, across the same five
       voter families at the banked elections. NSW's is the only state
       upper house whose ballot record counts voters' own preferences
       (so the ONLY council block this file can carry), and the estimate
       is further out than the senate's beside it: most council papers
       rank just one group, so each figure stands on the papers that
       went on to name one of the pair. One jurisdiction, no state or
       class cuts."""
    counts = json.load(open(os.path.join(HERE, "nswec-lc-flow-src", "counts.json"),
                            encoding="utf-8"))["events"]
    assert set(counts) == {str(y) for y in LC_YEARS}, \
        f"counts.json events {sorted(counts)} != {LC_YEARS} - review the council span"
    out = {}
    for ys in map(str, LC_YEARS):
        tally = counts[ys]["counts"]
        for fam in tally:
            assert fam in ("ALP", "COAL", "GRN", "PHON", "OTHER"), \
                f"{ys}: unmapped voter family {fam} - review the implied formula"
        a = sum(f["toALP"] for f in tally.values())
        c = sum(f["toCOAL"] for f in tally.values())
        alp = 100.0 * a / (a + c)
        pin = LC_PINS[int(ys)]
        assert abs(alp - pin) < 0.005, \
            f"{ys} council implied 2PP: {alp:.2f} != the verified {pin}"
        out[int(ys)] = (alp, 100.0 - alp)
    return out

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
    for y in HTT_YEARS:
        v = htpp_votes(y)["perDiv"]
        blk = cls_blocks.get(str(y))
        assert blk, f"{y}: no Divisional Classifications block"
        excl = HTT_EXCLUDED.get(y, set())
        assert set(v) == set(blk) - excl, \
            f"{y}: HTPP join drifted - counted {sorted(set(v) - set(blk))[:3]}, classified-only {sorted(set(blk) - excl - set(v))[:3]}"
        # the file names no state: the block's own state field groups the
        # divisions, exactly the key the class sums below reuse
        per_st, per_cl = {}, {k: [0.0, 0.0] for k, _, _ in CLASS_META}
        nat = [0.0, 0.0]
        for div, pair in v.items():
            rec = blk[div]
            st = rec["state"].strip().lower()
            assert st in STATES, f"{y} {div}: unmapped state {st}"
            p = per_st.setdefault(st, [0.0, 0.0])
            p[0] += pair[0]; p[1] += pair[1]
            ck = CLS_KEY[rec["classification"].lower()]
            per_cl[ck][0] += pair[0]; per_cl[ck][1] += pair[1]
            nat[0] += pair[0]; nat[1] += pair[1]
        assert sorted(per_st) == sorted(STATES), f"{y}: a state is missing"
        derived = alp_share(nat)
        assert abs(derived - nat_rows[y][0]) < 0.06, \
            f"{y} national 2PP: HTPP count {derived:.2f} != canonical {nat_rows[y][0]}"
        for st in STATES:
            a = alp_share(per_st[st])
            per_state[st][y] = (a, 100.0 - a)
        for ck, _, _ in CLASS_META:
            a = alp_share(per_cl[ck])
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
        "_comment": "GENERATED by .build/aec-2pp-history.py – Labor v Coalition two-party-preferred shares behind the flows-explained chart's 2PP view. National cells are data/polls.json's canonical election records verbatim; state and class cuts are the AEC's own per-division two-party counts summed per state, or per AEC division classification (fed.classes) – the TPP By Division downloads 2004–2025 (tppdiv-*.csv), extended to 1996 by the statistics packs' House TPP By Polling Place tables (htpp-*.txt; 1998 counts 147 divisions, the AEC's table omitting Newcastle's Labor-v-independent pair). The Coalition cell is 100 minus Labor's. fed.sen is the IMPLIED Senate two-party (no official one exists – the AEC counts no 2PP in the chamber seats are not filled from): the share of above-the-line papers naming a major party that name Labor first, computed from the committed ATL tallies, 2016 on. nswLc is the IMPLIED New South Wales Legislative Council two-party, the same naming-a-major share over the council's 2011–2023 ballots from the committed NSWEC counts – the only state upper house with a published ballot-level record.",
        "fed": view("Federal", "Australian federal elections", nat_rows,
                    ),
    }
    doc["fed"]["states"] = {}
    for s in STATES:
        doc["fed"]["states"][s] = view(STATE_FULL[s],
                                       STATE_FULL[s] + " electorates at federal elections",
                                       per_state[s], short=STATE_SHORT[s])
    doc["fed"]["classes"] = {}
    for ck, label, short in CLASS_META:
        doc["fed"]["classes"][ck] = view(label, f"federal elections in {short} seats",
                                         per_class[ck], short=short)

    sen = senate_implied()
    sen_nat = {y: sen[y]["nat"] for y in SEN_YEARS}
    doc["fed"]["sen"] = {"implied": True, **view("Federal Senate",
                                                 "Australian Senate elections",
                                                 sen_nat)}
    doc["fed"]["sen"]["states"] = {}
    for s in STATES:
        rows = {y: sen[y]["perState"][s] for y in SEN_YEARS}
        doc["fed"]["sen"]["states"][s] = view(STATE_FULL[s],
                                              STATE_FULL[s] + " Senate",
                                              rows, short=STATE_SHORT[s])

    lc = nsw_lc_implied()
    doc["nswLc"] = {"implied": True, **view("NSW Legislative Council",
                                            "NSW Legislative Council elections",
                                            lc, short="NSW LC")}
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
