"""seifa_quintiles.py – the per-election ABS-SEIFA quintile memberships
behind the explainer's fifth-of-seats flows, primary and two-party cuts
(user request 2026-10-24: add the ABS socio-economic data beside the
AEC's division classifications in the flows-explained menu views;
approved decisions: quintile bands of 30 seats, all three measures,
IRSAD first – the IEO lane joined the same day on "do what you did for
irsad to ieo", education-and-occupation riding every join the first
lane opened, and IER closed the store's trio later that day on "do the
same for IER: 'Federal, by IER quintile'", economic resources on the
same joins again).

data/division-seifa-indexes.json carries a cell per index per division
per federal election 2001–2025 (2028's forward block is never a history
lane – and carries no ieo or ier cells besides). THE RANK READ DIFFERS
PER INDEX – the two conventions this module's pins exist to keep
straight:

- IRSAD cells carry BOTH conventions – `rank` (1 = most ADVANTAGED, the
  display store's natural read) and `rankDis` (N+1−rank, 1 = most
  disadvantaged). This lane reads `rank`; reading the rankDis twin is
  the classic misread the anchors pin against.
- IEO and IER (like IRSD in the same store) keep only the APH print
  order: `rank` 1 = MOST disadvantaged, so their lanes REFLECT it
  (n+1−rank) to land on advantage order.

The quintiles are thirty seats a piece – ceil(rank/30), capped at 5 –
so the first fifth is the MOST-ADVANTAGED and the last the
most-disadvantaged: the ladder is numbered along the advantage ladder,
user call 2026-10-24 (the lane shipped disadvantaged-first that
morning; the same-day review call flipped both indexes, "q1 is top
fifth (most advantaged) … q5 is bottom fifth (most disadvantaged)").
At the 151-seat elections (2019, 2022) the spare seat lands in the last
fifth – arithmetically the same ceil cut as before the flip, but the
remainder rung is now the DISADVANTAGED end; the shipped day's
"advantaged end takes the remainder" wording died with it.

Used by the three store writers that regroup the AEC's per-division
products by grouping: fed-class-flows.py (preference flows),
aec-2pp-history.py (two-party), aec-primary-history.py (first
preferences). The membership emits records in the division-
classifications shape – {"classification": quintile key, "state": ab} –
so the writers' grouping joins (which read rec["classification"]) run
untouched. Quintiles ride each election's OWN block, so a seat moves
fifths with its electorate's relative standing election by election – a
kink is never an index boundary sliding under fixed seats.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# index id -> {"group": the menu optgroup's label, "meta": the key ->
# (label, short, descriptor) table, "pins": the named anchors}.
# label is a view title ("Most-advantaged fifth"), short the bare
# menu face (the positional name alone – "Top fifth" through "Bottom
# fifth", user rename 2026-10-24; the optgroup's own label supplies the
# index), desc the phrase the copy slots compose sentences from ("in the
# <desc> of seats by <IX> rank"). Keys: q1..q5 file IRSAD (the first
# lane); e1..e5 IEO; r1..r5 IER – the key letter names the index so one
# classes bank carries fifteen records without a collision.
INDEX_META = {
    "irsad": {
        "group": "Federal, by IRSAD quintile",
        "meta": (
            ("q1", "Most-advantaged fifth", "Top fifth",
             "most-advantaged fifth"),
            ("q2", "Second-most-advantaged fifth", "2nd fifth",
             "second-most-advantaged fifth"),
            ("q3", "Middle fifth", "Middle fifth", "middle fifth"),
            ("q4", "Second-most-disadvantaged fifth", "4th fifth",
             "second-most-disadvantaged fifth"),
            ("q5", "Most-disadvantaged fifth", "Bottom fifth",
             "most-disadvantaged fifth"),
        ),
        # 2001 Bonython is the IRSAD store's most-disadvantaged seat,
        # North Sydney its rank-1 most-advantaged; 2025 Lingiari/Banks
        # pin the same ladder against a backwards rank read.
        "pins": {2001: (("Bonython", "q5"), ("North Sydney", "q1")),
                 2025: (("Lingiari", "q5"), ("Banks", "q2"))},
    },
    "ieo": {
        "group": "Federal, by IEO quintile",
        "meta": (
            ("e1", "Most-advantaged fifth", "Top fifth",
             "most-advantaged fifth"),
            ("e2", "Second-most-advantaged fifth", "2nd fifth",
             "second-most-advantaged fifth"),
            ("e3", "Middle fifth", "Middle fifth", "middle fifth"),
            ("e4", "Second-most-disadvantaged fifth", "4th fifth",
             "second-most-disadvantaged fifth"),
            ("e5", "Most-disadvantaged fifth", "Bottom fifth",
             "most-disadvantaged fifth"),
        ),
        # 2025's Fowler/Forde pair is ALSO the boundary pin: dis-ranks
        # 30/31 reflect to the last two adv-ranks (121/120) of the
        # fourth fifth, so Fowler closes the bottom fifth from above
        # while Forde keeps e4 – the reflected read does NOT mirror the
        # cut points seat-for-seat.
        "pins": {2001: (("Bonython", "e5"), ("North Sydney", "e1")),
                 2025: (("Spence", "e5"), ("Fowler", "e5"), ("Forde", "e4"),
                        ("Wentworth", "e1"))},
    },
    "ier": {
        "group": "Federal, by IER quintile",
        "meta": (
            ("r1", "Most-advantaged fifth", "Top fifth",
             "most-advantaged fifth"),
            ("r2", "Second-most-advantaged fifth", "2nd fifth",
             "second-most-advantaged fifth"),
            ("r3", "Middle fifth", "Middle fifth", "middle fifth"),
            ("r4", "Second-most-disadvantaged fifth", "4th fifth",
             "second-most-disadvantaged fifth"),
            ("r5", "Most-disadvantaged fifth", "Bottom fifth",
             "most-disadvantaged fifth"),
        ),
        # 2001's most-disadvantaged IER seat is Wide Bay (not Bonython -
        # the anchors differ per index precisely so a cross-index rank
        # read fails loudly); 2025's Barker/Swan pair is ALSO the
        # boundary pin: dis-ranks 30/31 reflect to the last two
        # adv-ranks (121/120) of the fourth fifth, so Barker closes the
        # bottom fifth from above while Swan keeps r4 – the reflected
        # read does NOT mirror the cut points seat-for-seat.
        "pins": {2001: (("Wide Bay", "r5"), ("North Sydney", "r1")),
                 2025: (("Lingiari", "r5"), ("Barker", "r5"), ("Swan", "r4"),
                        ("Mitchell", "r1"))},
    },
}
QIDXES = tuple(INDEX_META)
# the flat rows of INDEX_META: (key, label, short, desc, index id),
# IRSAD's five first
SEIFA_META = tuple((*m, ix) for ix in QIDXES for m in INDEX_META[ix]["meta"])
# the history elections a quintile block exists for (all three indexes
# share the same 2001–2025 coverage; the seifa store's 2028 block scores
# the NEW boundaries for the coming election – no counted product exists
# for it anywhere in this repo – so it is never a cut year.)
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


def quintile_of(rank_adv):
    """The fifth number an advantage-ordered rank places a division
    in: 1..30 -> 1, 31..60 -> 2, … 121+ -> 5 (so a 151-seat chamber's
    spare seat joins the most-disadvantaged fifth)."""
    return min((rank_adv - 1) // 30 + 1, 5)


def _rank_adv(index_name, cell, n):
    """The 1=most-advantaged rank of one division's cell, by the
    index's own storage convention (see the module docstring): IRSAD
    stores its rank advantaged-first; IEO's print order is reflected
    onto the advantage ladder."""
    return cell[index_name]["rank"] if index_name == "irsad" \
        else n + 1 - cell[index_name]["rank"]


def membership(year, index_name):
    """{division: {"classification": quintile key, "state": "VIC"}} for
    one SEIFA_YEARS election and one index ("irsad"/"ieo"/"ier"). Every
    fifth is exactly 30 seats, the last taking the 151-seat chambers'
    spare; a block whose ranks are not a permutation of 1..N fails the
    run, as does a named anchor filed to the wrong fifth."""
    assert index_name in INDEX_META, f"unknown SEIFA index {index_name!r}"
    assert year in SEIFA_YEARS, \
        f"{year}: no quintile block (the seifa store covers {SEIFA_YEARS})"
    blk = store()[str(year)]
    n = len(blk)
    assert n in (150, 151), \
        f"{year}: {n} divisions – the thirty-a-fifth cut prices a 150 or 151 seat chamber"
    meta = INDEX_META[index_name]["meta"]
    keys = tuple(m[0] for m in meta)
    qpre = keys[0][0]  # the letter the index's keys share ("q" / "e")
    out, ranks = {}, []
    for name, cell in blk.items():
        ra = _rank_adv(index_name, cell, n)
        assert isinstance(ra, int) and 1 <= ra <= n, \
            f"{year} {name}: {index_name} adv-rank {ra!r} outside 1..{n}"
        ranks.append(ra)
        out[name] = {"classification": qpre + str(quintile_of(ra)),
                     "state": cell["state"]}
    assert sorted(ranks) == list(range(1, n + 1)), \
        f"{year} {index_name}: ranks are no permutation of 1..{n}"
    sizes = {q: 0 for q in keys}
    for rec in out.values():
        sizes[rec["classification"]] += 1
    assert sizes == {**{q: 30 for q in keys}, keys[-1]: n - 120}, \
        f"{year} {index_name}: fifth sizes {sizes} – expected 30 each, {keys[-1]} the balance"
    for name, q in INDEX_META[index_name]["pins"].get(year, ()):
        assert out[name]["classification"] == q, \
            f"{year} {name}: fifth {out[name]['classification']} != pinned {q}"
    return out
