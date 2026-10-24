"""seifa_quintiles.py – the per-election ABS-SEIFA quintile memberships
behind the explainer's fifth-of-seats flows, primary and two-party cuts
(user request 2026-10-24: add the ABS socio-economic data beside the
AEC's division classifications in the flows-explained menu views;
approved decisions: quintile bands of 30 seats, all three measures,
IRSAD first – the IEO lane joined the same day on "do what you did for
irsad to ieo", education-and-occupation riding every join the first
lane opened, and IER closed the store's trio later that day on "do the
same for IER: 'Federal, by IER quintile'", economic resources on the
same joins again; the interpolated percentile then became the IRSAD
lane's default ranking basis, user direction 2026-10-24).

data/division-seifa-indexes.json carries a cell per index per division
per federal election 2001–2025 (2028's forward block is never a history
lane – and carries no ieo or ier cells besides). THE RANK READ DIFFERS
PER INDEX – the two conventions this module's pins exist to keep
straight:

- IRSAD cells carry BOTH conventions – `rank` (1 = most ADVANTAGED, the
  display store's natural read) and `rankDis` (N+1−rank, 1 = most
  disadvantaged). This lane's census-rank cut reads `rank`; reading the
  rankDis twin is the classic misread the anchors pin against. And
  IRSAD alone carries the store's interpolated-percentile lane: THE
  BASIS for membership() is the store's `pcti` – the IRSAD percentile
  linearly interpolated between the bracketing censuses at the election
  date (cell pcti = (1−f)·pct0 + f·pct1, f the election's day-share of
  the census-to-census interval) – wherever the store ships one (the
  store's _pcti factor years: the six census-bracketed elections
  2004–2019, the CD-era 2004/2007/2010 lanes landed 2026-10-25 once
  the banned-period CED polygons were derived by allocation). Those
  years the membership ranks pcti DESCENDING (the most advantaged
  percentile files the advantage-ordered rank 1); the other elections
  fall back to their census-filed `rank` – the recorded observation.
- IEO and IER (like IRSD in the same store) keep only the APH print
  order: `rank` 1 = MOST disadvantaged, so their lanes REFLECT it
  (n+1−rank) to land on advantage order.

The quintiles are thirty seats a piece on whichever basis – the pcti
lane sorts pcti descending and files the first thirty to the first
fifth; the rank lane is ceil(rank/30), capped at 5 – so the first fifth
is the MOST-ADVANTAGED and the last the most-disadvantaged: the ladder
is numbered along the advantage ladder, user call 2026-10-24 (the lane
shipped disadvantaged-first that morning; the same-day review call
flipped both indexes, "q1 is top fifth (most advantaged) … q5 is
bottom fifth (most disadvantaged)"). At the 151-seat elections (2019,
2022) the spare seat lands in the last fifth – arithmetically the same
ceil cut as before the flip, but the remainder rung is now the
DISADVANTAGED end; the shipped day's "advantaged end takes the
remainder" wording died with it. The interpolation itself moves 12
seats a fifth at 2013 and 10 at 2019 (the 151-seat chamber's spare
sits at the disadvantaged end post-flip, so the advantaged-first
cut points land one seat in from the shipped day's – the same pair
counted 12 there pre-flip) and none at 2016 (the census fell five
weeks after that election, so pcti is pct1's). The landed CD-era
lanes cut coarser – whole-unit CED polygon allocation with an f
aiming away from the measured census moves 21 IRSAD seats at 2004,
8 at 2007 and 30 at 2010 (66 IER seats at 2004, the year's IER
reshuffle) – rank_membership() keeps the all-recorded-observation
cut for exactly that comparison.

Used by the three store writers that regroup the AEC's per-division
products by grouping: fed-class-flows.py (preference flows),
aec-2pp-history.py (two-party), aec-primary-history.py (first
preferences), and aec-informal-history.py (informality). The membership
emits records in the division-classifications shape –
{"classification": quintile key, "state": ab} – so the writers'
grouping joins (which read rec["classification"]) run untouched.
Quintiles ride each election's OWN block, so a seat moves fifths with
its electorate's relative standing election by election – a kink is
never an index boundary sliding under fixed seats. The retained
rank-basis cut for every year (the recorded observation, no
interpolation) lives in rank_membership() for comparison work; the
default lane the writers and menus ship is the interpolated one.
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
        # pin the same ladder against a backwards rank read. These are
        # CENSUS-RANK anchors, checked where membership falls back to
        # the recorded `rank`; the interpolated years' anchors live in
        # _PCTI_PINS.
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
# the interpolated-percentile lane's own named anchors: Lingiari is the
# pcti-most-disadvantaged seat of 2013 and 2016 (Spence in 2019);
# Bradfield edges North Sydney to the 2013 pcti advantaged pole,
# Wentworth holds it 2016 and 2019. The CD-era lanes landed 2026-10-25
# pin Fowler and Wakefield to their census-year tail poles (each is
# ALSO its census-rank tail), and 2010's Lingiari tail pole – the
# census sits on Wakefield but the interpolated lattice moves Lingiari
# to the floor between the censuses. Checked by the pcti lane alone –
# the census `rank` read at these years need not file them identically
# (Bradfield edges North Sydney to the 2013 pcti pole, not the census
# pole; Lingiari supplants Wakefield at the 2010 pcti tail).
_PCTI_PINS = {2004: (("Fowler", "q5"), ("Bradfield", "q1")),
              2007: (("Wakefield", "q5"), ("Bradfield", "q1")),
              2010: (("Lingiari", "q5"), ("Bradfield", "q1")),
              2013: (("Lingiari", "q5"), ("Bradfield", "q1")),
              2016: (("Lingiari", "q5"), ("Wentworth", "q1")),
              2019: (("Spence", "q5"), ("Wentworth", "q1"))}
# the history elections a quintile block exists for (all three indexes
# share the same 2001–2025 coverage; the seifa store's 2028 block scores
# the NEW boundaries for the coming election – no counted product exists
# for it anywhere in this repo – so it is never a cut year.)
SEIFA_YEARS = (2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025)
# each index's own span (2026-10-25, flows-explained review): the store's
# 1998 block (APH CIB 4/1998-99 – 1996 census, the 148 divisions of the
# 1998 election) prints IRSD, IER and IEO but no IRSAD, so the IEO and IER
# lanes open at 1998 while IRSAD's opens at 2001. ALL_SEIFA_YEARS is their
# union, the grid the writers walk.
INDEX_YEARS = {"irsad": SEIFA_YEARS,
               "ieo": (1998,) + SEIFA_YEARS,
               "ier": (1998,) + SEIFA_YEARS}
ALL_SEIFA_YEARS = tuple(sorted(set().union(*INDEX_YEARS.values())))


def years_of(index_name):
    """The elections an index's fifths exist for."""
    return INDEX_YEARS[index_name]

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
    pcti – the store's own _pcti factor years (the six census-bracketed
    elections 2004–2019, the CD-era lanes landed 2026-10-25; has always
    auto-shipped whatever years the store's factor keys carry)."""
    global _INTERP_YEARS
    if _INTERP_YEARS is None:
        _INTERP_YEARS = frozenset(int(y) for y in
                                  _raw().get("_pcti", {}).get("factors", {}))
    return _INTERP_YEARS


def interp_label():
    """The pcti factor years as a human list, "2004, 2007, 2010, 2013,
    2016 and 2019" – the interpolation window the elections-strings
    name. Derived from the store's own _pcti factors so a new lane
    joins the copy the day the store carries it."""
    ys = sorted(interp_years())
    if len(ys) <= 1:
        return str(ys[0]) if ys else ""
    return ", ".join(str(y) for y in ys[:-1]) + " and " + str(ys[-1])


# the basis phrase the stores' "elections" scope lines append after the
# quintile descriptor ("federal elections in the most-advantaged fifth
# " + this): percentile basis, interpolated inside the census window,
# recorded census rank outside it. The JS-side twin emitted for the
# menus' captions lives in gen-data.mjs.
ELECTIONS_SUFFIX = "of seats by {ix}"


def elections_suffix(ix="irsad"):
    """The scope line's basis phrase – the bare index name since
    2026-10-25 (the flows-explained review moved the interpolation
    window into How it's built; every index now ranks the same way, so
    the line no longer forks)."""
    return ELECTIONS_SUFFIX.replace("{ix}", ix.upper())


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


def _check(year, index_name, out, keys, sizes_note):
    """The invariant pack all membership lanes share: 30-a-fifth with
    the last fifth taking a 151-seat chamber's spare, every fifth
    present."""
    n = len(out)
    sizes = {q: 0 for q in keys}
    for rec in out.values():
        sizes[rec["classification"]] += 1
    assert sizes == {**{q: 30 for q in keys}, keys[-1]: n - 120}, \
        f"{year} {index_name}: fifth sizes {sizes} – expected 30 each, {keys[-1]} the balance ({sizes_note})"


def _rank_cut(year, index_name):
    """The recorded-observation cut ({division: {"classification": quintile
    key, "state": "VIC"}}) for one SEIFA_YEARS year and one index: the
    census-filed advantage-ordered rank, no interpolation. Also the fall-
    back the default membership() takes outside the _pcti factor years;
    a pcti year checked from here skips its _PCTI_PINS anchors – those
    bind the interpolated read alone."""
    blk = store()[str(year)]
    n = len(blk)
    meta = INDEX_META[index_name]["meta"]
    keys = tuple(m[0] for m in meta)
    qpre = keys[0][0]  # the letter the index's keys share ("q" / "e" / "r")
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
    _check(year, index_name, out, keys, "census-rank basis")
    pins = INDEX_META[index_name]["pins"].get(year, ())
    if index_name == "irsad" and year in _PCTI_PINS:
        pins = ()
    for name, q in pins:
        assert out[name]["classification"] == q, \
            f"{year} {name}: fifth {out[name]['classification']} != pinned {q}"
    return out


def membership(year, index_name):
    """{division: {"classification": quintile key, "state": "VIC"}} for one
    SEIFA_YEARS election and one index ("irsad"/"ieo"/"ier"), on the
    default basis: every index ranks the store's interpolated pcti
    descending (the most advantaged percentile files the advantage-
    ordered rank 1, thirty seats a fifth) at the _pcti factor years, and
    every other year files the recorded census advantage-rank. (IEO and
    IER joined the pcti basis 2026-10-25 – the flows-explained review
    found the three index lanes ranked on different bases at the same
    elections; the store had always carried their pcti. Their pct runs
    ascending with advantage exactly as IRSAD's does, so the one
    descending sort serves all three.) A pcti-year block
    with a missing/non-numeric/repeated pcti fails the run, as does a
    named anchor filed to the wrong fifth."""
    assert index_name in INDEX_META, f"unknown SEIFA index {index_name!r}"
    assert year in years_of(index_name), \
        f"{year}: no {index_name} quintile block (its fifths cover {years_of(index_name)})"
    blk = store()[str(year)]
    n = len(blk)
    assert n in (148, 150, 151), \
        f"{year}: {n} divisions – the thirty-a-fifth cut prices a 148, 150 or 151 seat chamber"
    if year in interp_years():
        meta = INDEX_META[index_name]["meta"]
        keys = tuple(m[0] for m in meta)
        qpre = keys[0][0]
        pcts = []
        for name, cell in blk.items():
            p = cell[index_name].get("pcti")
            assert isinstance(p, (int, float)) and 0.0 < p <= 1.0, \
                f"{year} {name}: pcti {p!r} – the interpolated percentile must be in (0,1]"
            pcts.append(p)
        assert len(set(pcts)) == n, \
            f"{year}: pcti is not one-per-division – the thirty-a-fifth cut has no tie rule"
        order = sorted(blk, key=lambda nm: blk[nm][index_name]["pcti"],
                       reverse=True)
        out = {name: {"classification":
                          qpre + str(quintile_of(i + 1)),
                      "state": blk[name]["state"]}
               for i, name in enumerate(order)}
        _check(year, index_name, out, keys, "pcti basis")
        for name, q in (_PCTI_PINS.get(year, ()) if index_name == "irsad" else ()):
            assert out[name]["classification"] == q, \
                f"{year} {name}: fifth {out[name]['classification']} != pinned {q}"
        return out
    return _rank_cut(year, index_name)


def rank_membership(year):
    """The RETAINED recorded-observation cut for IRSAD ({division:
    {"classification": q, "state": ab}} off the store's census-filed
    `rank`) for any SEIFA_YEARS year – kept speculatively, without the
    pcti interpolation, so a comparison of the two bases prices the
    interpolation's own movement (12 seats moved fifths at 2013 and 10
    at 2019 on the 2026-10-24 switch – the 151-seat chamber's spare-seat
    end moved with the numbering flip, so 2019's pair count is not the
    shipped day's 12; none at 2016, whose pcti ratio sits 5 weeks short
    of the census it measures). Numbered most-advantaged-first like
    every lane this module emits."""
    assert year in SEIFA_YEARS, \
        f"{year}: no IRSAD quintile block (the seifa store covers {SEIFA_YEARS})"
    blk = store()[str(year)]
    assert len(blk) in (150, 151)
    return _rank_cut(year, "irsad")
