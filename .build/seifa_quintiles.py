"""seifa_quintiles.py – the per-election ABS-SEIFA quintile membership behind
the explainer's fifth-of-seats flows, primary and two-party cuts (user
request 2026-10-24: add the ABS socio-economic data beside the AEC's
division classifications in the flows-explained menu views; approved
decisions: quintile bands of 30 seats, IRSAD only, all three measures).

data/division-seifa-indexes.json carries an irsad cell per division per
federal election 2001–2025 (2028's forward block is never a history lane).
Each cell's rankDis ranks the division 1..N MOST DISADVANTAGED across that
election's chamber (the store's own rank-1-most-disadvantaged convention,
distinct from its `rank` twin where 1 is most ADVANTAGED – reading the
wrong one is the classic misread this lane's pins exist to catch). The
quintiles are thirty seats a piece – ceil(rankDis/30), capped at 5 – so
q1 is the most-disadvantaged fifth and q5 the most-advantaged; at the
151-seat elections (2019, 2022) the spare seat lands in q5, the
advantaged end taking the remainder (user call 2026-10-24).

Used by the three store writers that regroup the AEC's per-division
products by grouping: fed-class-flows.py (preference flows),
aec-2pp-history.py (two-party), aec-primary-history.py (first
preferences). The membership emits records in the division-
classifications shape – {"classification": quintile key, "state": ab} – so
the writers' grouping joins (which read rec["classification"]) run
untouched. Quintiles ride each election's OWN block, so a seat moves
fifths with its electorate's relative standing election by election – a
kink is never an index boundary sliding under fixed seats.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# key -> (label, short, descriptor), in menu order: most disadvantaged
# first. Label is a view title ("Most-disadvantaged fifth"), short the
# bare menu face (the positional name alone – "Top fifth" through
# "Bottom fifth", user rename 2026-10-24; the optgroup's own label
# supplies the index), desc the phrase the copy slots compose sentences
# from ("in the <desc> of seats by IRSAD rank").
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


def store():
    """data/division-seifa-indexes.json's elections blocks, cached."""
    global _STORE
    if _STORE is None:
        with open(os.path.join(ROOT, "data", "division-seifa-indexes.json"),
                  encoding="utf-8") as f:
            _STORE = json.load(f)["elections"]
    return _STORE


def quintile_of(rank_dis):
    """The fifth a rankDis places a division in: 1..30 -> q1, 31..60 ->
    q2, … 121+ -> q5 (so a 151-seat chamber's spare seat joins q5)."""
    return f"q{min((rank_dis - 1) // 30 + 1, 5)}"


# the store's named anchors, re-pinned here against the WRONG-INDEX and
# wrong-direction reads (rankDis 1 = MOST disadvantaged; 2001 Bonython is
# its most-disadvantaged seat, North Sydney its most-advantaged)
_PINS = {2001: (("Bonython", "q1"), ("North Sydney", "q5")),
         2025: (("Lingiari", "q1"), ("Banks", "q4"))}


def membership(year):
    """{division: {"classification": quintile key, "state": "VIC"}} for one
    SEIFA_YEARS election. Every fifth is exactly 30 seats, q5 taking the
    151-seat chambers' spare; a block whose ranks are not a permutation of
    1..N fails the run, as does a named anchor filed to the wrong fifth."""
    assert year in SEIFA_YEARS, \
        f"{year}: no IRSAD quintile block (the seifa store covers {SEIFA_YEARS})"
    blk = store()[str(year)]
    n = len(blk)
    assert n in (150, 151), \
        f"{year}: {n} divisions – the thirty-a-fifth cut prices a 150 or 151 seat chamber"
    out, ranks = {}, []
    for name, cell in blk.items():
        rd = cell["irsad"]["rankDis"]
        assert isinstance(rd, int) and 1 <= rd <= n, \
            f"{year} {name}: rankDis {rd!r} outside 1..{n}"
        ranks.append(rd)
        out[name] = {"classification": quintile_of(rd), "state": cell["state"]}
    assert sorted(ranks) == list(range(1, n + 1)), \
        f"{year}: rankDis is no permutation of 1..{n}"
    sizes = {q: 0 for q in QUINTS}
    for rec in out.values():
        sizes[rec["classification"]] += 1
    assert sizes == {**{q: 30 for q in QUINTS}, "q5": n - 120}, \
        f"{year}: fifth sizes {sizes} – expected 30 each, q5 the balance"
    for name, q in _PINS.get(year, ()):
        assert out[name]["classification"] == q, \
            f"{year} {name}: fifth {out[name]['classification']} != pinned {q}"
    return out
