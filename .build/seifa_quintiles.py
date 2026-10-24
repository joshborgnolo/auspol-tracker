"""seifa_quintiles.py – the per-election ABS-SEIFA quintile membership behind
the explainer's fifth-of-seats flows, primary and two-party cuts (user
request 2026-10-24: add the ABS socio-economic data beside the AEC's
division classifications in the flows-explained menu views; approved
decisions: quintile bands of 30 seats, IRSAD only, all three measures;
interpolated percentile as the default ranking basis, rank quintiles
retained, user direction 2026-10-24).

data/division-seifa-indexes.json carries an irsad cell per division per
federal election 2001–2025 (2028's forward block is never a history lane).
THE BASIS: membership ranks by the store's `pcti` – the IRSAD percentile
linearly interpolated between the bracketing censuses at the election date
(cell pcti = (1−f)·pct0 + f·pct1, f the election's day-share of the
census-to-census interval) – wherever the store ships one (the _pcti
factor years, 2013/2016/2019 today). The other elections fall back to
their census-filed rankDis: the rank lane is the recorded observation
(each cell's rankDis ranks the division 1..N MOST DISADVANTAGED across the
chamber – the store's own rank-1-most-disadvantaged convention; its twin
`rank` has 1 most ADVANTAGED – reading the wrong one is the classic
misread this lane's pins exist to catch), and the CD-era 2004/2007/2010
division interpolation lanes are pending banned-period CED polygons. The
quintiles are thirty seats a piece on whichever basis – the pcti lane
sorts pcti ascending (0 = most disadvantaged) and files the first thirty
to q1; the rank lane is ceil(rankDis/30), capped at 5 – so q1 is the
most-disadvantaged fifth and q5 the most-advantaged; at the 151-seat
elections (2019, 2022) the spare seat lands in q5, the advantaged end
taking the remainder (user call 2026-10-24).

Used by the three store writers that regroup the AEC's per-division
products by grouping: fed-class-flows.py (preference flows),
aec-2pp-history.py (two-party), aec-primary-history.py (first
preferences). The membership emits records in the division-
classifications shape – {"classification": quintile key, "state": ab} – so
the writers' grouping joins (which read rec["classification"]) run
untouched. Quintiles ride each election's OWN block, so a seat moves
fifths with its electorate's relative standing election by election – a
kink is never an index boundary sliding under fixed seats. The retained
rank-basis cut for every year (the recorded rankDis observation, no
interpolation) lives in rank_membership() for comparison work; the
default lane the writers and menus ship is the interpolated one.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# key -> (label, short, descriptor), in menu order: most disadvantaged
# first. Label is a view title ("Most-disadvantaged fifth"), short the
# bare menu face (the positional name alone – "Top fifth" through
# "Bottom fifth", user rename 2026-10-24; the optgroup's own label
# supplies the index), desc the phrase the copy slots compose sentences
# from ("in the <desc> of seats by IRSAD percentile").
QUINT_META = (
    ("q1", "Most-disadvantaged fifth", "Top fifth",
     "most-disadvantaged fifth"),
    ("q2", "Second-most-disadvantaged fifth", "2nd fifth",
     "second-most-disadvantaged fifth"),
    ("q3", "Middle fifth", "Middle fifth", "middle fifth"),
    ("q4", "Second-most-advantaged fifth", "4th fifth",
     "second-most-advantaged fifth"),
    ("q5", "Most-advantaged fifth", "Bottom fifth",
     "most-advantaged fifth"),
)
QUINTS = tuple(m[0] for m in QUINT_META)
# the history elections an IRSAD block exists for. The seifa store's 2028
# block scores the NEW boundaries for the coming election – no counted
# product exists for it anywhere in this repo, so it is never a cut year.
SEIFA_YEARS = (2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025)

_STORE = None
_INTERP_YEARS = None


def _raw():
    global _STORE
    if _STORE is None:
        with open(os.path.join(ROOT, "data", "division-seifa-indexes.json"),
                  encoding="utf-8") as f:
            _STORE = json.load(f)
    return _STORE


def store():
    """data/division-seifa-indexes.json's elections blocks, cached."""
    return _raw()["elections"]


def interp_years():
    """The elections whose irsad cells carry an interpolated-percentile
    pcti – the store's own _pcti factor years (2013/2016/2019 today; the
    CD-era 2004/2007/2010 division lanes join here when their polygons
    land, and these menus interpolate from then on)."""
    global _INTERP_YEARS
    if _INTERP_YEARS is None:
        _INTERP_YEARS = frozenset(int(y) for y in
                                  _raw().get("_pcti", {}).get("factors", {}))
    return _INTERP_YEARS


def quintile_of(rank_dis):
    """The fifth a rankDis places a division in: 1..30 -> q1, 31..60 ->
    q2, … 121+ -> q5 (so a 151-seat chamber's spare seat joins q5). The
    recorded-observation lane – the interpolated membership() ranks pcti
    instead where the store ships one."""
    return f"q{min((rank_dis - 1) // 30 + 1, 5)}"


def interp_label():
    """The pcti factor years as a human list, "2013, 2016 and 2019" – the
    interpolation window the elections-strings name. Derived from the
    store's own _pcti factors so the CD-era lanes join the copy the day
    they land."""
    ys = sorted(interp_years())
    if len(ys) <= 1:
        return str(ys[0]) if ys else ""
    return ", ".join(str(y) for y in ys[:-1]) + " and " + str(ys[-1])


# the basis phrase the stores' "elections" scope lines append after the
# quintile descriptor ("federal elections in the most-disadvantaged fifth
# " + this): percentile basis, interpolated inside the census window,
# recorded census rank outside it.
ELECTIONS_SUFFIX = ("of seats by IRSAD percentile (interpolated at the "
                    "{ys} elections, the census rank otherwise)")


def elections_suffix():
    return ELECTIONS_SUFFIX.replace("{ys}", interp_label())


# the store's named anchors, re-pinned here against the WRONG-INDEX and
# wrong-direction/basis reads (a pcti cell's most-disadvantaged rankDis 1
# floor is the census-year anchor; Bradfield edges North Sydney to the
# 2013 pcti advantaged pole, Wentworth holds it 2016 and 2019)
_PINS = {2001: (("Bonython", "q1"), ("North Sydney", "q5")),
         2013: (("Lingiari", "q1"), ("Bradfield", "q5")),
         2016: (("Lingiari", "q1"), ("Wentworth", "q5")),
         2019: (("Spence", "q1"), ("Wentworth", "q5")),
         2025: (("Lingiari", "q1"), ("Banks", "q4"))}


def _check(year, out, sizes_note):
    """The invariant pack both lanes share: 30-a-fifth with q5 taking a
    151-seat chamber's spare, every fifth present."""
    n = len(out)
    sizes = {q: 0 for q in QUINTS}
    for rec in out.values():
        sizes[rec["classification"]] += 1
    assert sizes == {**{q: 30 for q in QUINTS}, "q5": n - 120}, \
        f"{year}: fifth sizes {sizes} – expected 30 each, q5 the balance ({sizes_note})"


def membership(year):
    """{division: {"classification": quintile key, "state": "VIC"}} for one
    SEIFA_YEARS election on the DEFAULT interpolated-percentile basis: the
    store's pcti years rank pcti ascending (0 = most disadvantaged) and
    file thirty seats a fifth; the other years file the recorded census
    rankDis by quintile_of. A pcti-year block with a missing/non-numeric
    pcti fails the run, as does a named anchor filed to the wrong fifth."""
    assert year in SEIFA_YEARS, \
        f"{year}: no IRSAD quintile block (the seifa store covers {SEIFA_YEARS})"
    blk = store()[str(year)]
    n = len(blk)
    assert n in (150, 151), \
        f"{year}: {n} divisions – the thirty-a-fifth cut prices a 150 or 151 seat chamber"
    out = {}
    if year in interp_years():
        pcts = []
        for name, cell in blk.items():
            p = cell["irsad"].get("pcti")
            assert isinstance(p, (int, float)) and 0.0 < p <= 1.0, \
                f"{year} {name}: pcti {p!r} – the interpolated percentile must be in (0,1]"
            pcts.append(p)
        assert len(set(pcts)) == n, \
            f"{year}: pcti is not one-per-division – the thirty-a-fifth cut has no tie rule"
        order = sorted(blk, key=lambda nm: blk[nm]["irsad"]["pcti"])
        for i, name in enumerate(order):
            out[name] = {"classification": f"q{min(i // 30 + 1, 5)}",
                         "state": blk[name]["state"]}
        sizes_note = "pcti basis"
    else:
        assert year not in interp_years()  # docstring line – basis is rank
        ranks = []
        for name, cell in blk.items():
            rd = cell["irsad"]["rankDis"]
            assert isinstance(rd, int) and 1 <= rd <= n, \
                f"{year} {name}: rankDis {rd!r} outside 1..{n}"
            ranks.append(rd)
            out[name] = {"classification": quintile_of(rd),
                         "state": cell["state"]}
        assert sorted(ranks) == list(range(1, n + 1)), \
            f"{year}: rankDis is no permutation of 1..{n}"
        sizes_note = "census-rank basis"
    _check(year, out, sizes_note)
    for name, q in _PINS.get(year, ()):
        assert out[name]["classification"] == q, \
            f"{year} {name}: fifth {out[name]['classification']} != pinned {q}"
    return out


def rank_membership(year):
    """The RETAINED recorded-observation cut ({division: {"classification":
    q, "state": ab}} by quintile_of(rankDis)) for any SEIFA_YEARS year –
    kept speculatively, without the pcti interpolation, so a comparison of
    the two bases prices the interpolation's own movement (12 seats moved
    fifths at 2013 and 2019 on the 2026-10-24 switch; none at 2016, whose
    pcti ratio sits 5 weeks short of the census it measures)."""
    assert year in SEIFA_YEARS, \
        f"{year}: no IRSAD quintile block (the seifa store covers {SEIFA_YEARS})"
    blk = store()[str(year)]
    n = len(blk)
    assert n in (150, 151)
    out, ranks = {}, []
    for name, cell in blk.items():
        rd = cell["irsad"]["rankDis"]
        assert isinstance(rd, int) and 1 <= rd <= n, \
            f"{year} {name}: rankDis {rd!r} outside 1..{n}"
        ranks.append(rd)
        out[name] = {"classification": quintile_of(rd), "state": cell["state"]}
    assert sorted(ranks) == list(range(1, n + 1)), \
        f"{year}: rankDis is no permutation of 1..{n}"
    _check(year, out, "census-rank basis")
    return out
