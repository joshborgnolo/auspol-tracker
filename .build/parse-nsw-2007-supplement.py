"""parse-nsw-2007-supplement.py - the NSW 2007 Legislative Assembly entry of
the NOTIONAL all-seats preference-flow store (data/state-flows-nsw-allseats.json).

2007 predates the NSW Electoral Commission's ballot-level preference files
(2015 on; parse-nsw-state-flows.py counts those), but the Parliamentary
Library's Background Paper 1/08 ("NSW Election 2007: an analysis of the
results", by Antony Green's election office) published the decomposition of
Antony Green's indicative tally-sheet count - the count Antony ran in every
returning officer's office - in two committed forms:

  * .build/state-flow-src/nsw/2007/bp2007-main-report.txt - the Background
    Paper's pdftotext dump. Its "Preference Flows by Electorate" chapter
    prints, per district and candidate, each minor party's ballots split
    To <finalist A> / To <finalist B> / Exhausted; these rows are the
    CROSSBENCH source (their sums are exactly the Paper's printed statewide
    "Indicative Preferences Flows by Party" table - asserted here).
  * .build/state-flow-src/nsw/2007/flows-supplement.txt - the 524-page
    booth-level supplement. Its pages lose a known, pinned set of
    declaration-vote rows to the print, so it never feeds a crossbench
    figure; it AUDITS the main report's per-district rows against the
    fingerprint exceptions noted below. (It carries no classic district's
    major-party piles: a finalist's ballots were never distributed, so no
    classic district prints an ALP/LIB/NAT tally table. The implied
    two-party's major piles come from the Paper's SUMMARY OF FIRST
    PREFERENCE VOTES BY ELECTORATE table instead, whose district rows are
    reconciled here to its own printed statewide totals.)

Same estimand as the store's ballot-file years: every formal ballot read as
a Labor v Coalition contest. The tally sheets rank the ACTUAL final two of
a district, so the notional decomposition exists only where that pair was
Labor v Liberal or Labor v National (72 districts; Cessnock makes 73, its
actual distribution standing in because the sheets were never data-
captured there). The 18 districts a crossbencher or Greens candidate
reached the final two in, plus Hornsby and North Shore (sheets never
captured; "North Sydney" in the main report's file is the mislabel for
North Shore), sit in the store's skipped list.

One Nation ran no candidates in 2007; the store carries null, as for 2015.

The implied two-party share is on the tally basis (about four ballots in
five follow the sheets): the crossbench splits from the main report plus
the major parties' first-preference piles from the Paper's electorate
summary. It computes to ~54.8 Labor - NOT the Paper's printed statewide
52.3, because the sheets' readers see no differential exhaustion (real
OPV effect: Labor-leaning minors' ballots exhaust more than the sheets
survive). The printed 52.3 is therefore no gate on the count's basis;
the characteristic checks (93 districts, exact statewide sums, the
Cessnock row, the crossbench reconciliation, the declaration-loss
fingerprint) stand instead.

Writes the 2007 entry into data/state-flows-nsw-allseats.json, leaving
every other year untouched. Usage: .build/parse-nsw-2007-supplement.py
"""
import collections
import gzip
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..")
MAIN = os.path.join(ROOT, ".build", "state-flow-src", "nsw", "2007", "bp2007-main-report.txt.gz")
SUPP = os.path.join(ROOT, ".build", "state-flow-src", "nsw", "2007", "flows-supplement.txt.gz")
ALL = os.path.join(ROOT, "data", "state-flows-nsw-allseats.json")
YEAR = 2007

MAJORS = ("ALP", "LIB", "NAT")
BUCKET = {"GRN": "grn", "ON": "onp", "ONP": "onp", "PHON": "onp"}
# the Coalition never stood both brands in one district in 2007; a
# major-party ballot in a Labor v Coalition district stays with its side

# Background Paper 1/08, p.59: "Indicative Preferences Flows by Party -
# Labor/Coalition Contests" - the printed statewide rows, votes distributed
# to (Labor, Coalition, Exhausted); the parse's per-district rows must sum
# to them to the vote (the Paper warns only of unaudited sheets, and both
# tables are prints of the one database).
BP_PARTY = {
    "GRN": (86350, 25745, 99881),
    "CDP": (11615, 26882, 29262),
    "UNI": (9356, 4085, 18296),
    "AFI": (7489, 7311, 24364),
    "DEM": (3988, 2616, 6216),
    "FP": (1117, 1152, 3107),
    "ORP": (211, 219, 715),
    "SOS": (211, 229, 616),
    "SA": (181, 80, 247),
    "IND": (18729, 25234, 51679),
}
BP_TOTAL = (139247, 93553, 234383)          # 261 candidates, 73 electorates
BP_2PP = 52.3                                # statewide Labor share, p.33

# the first-preference summary's own statewide check: its 93 district rows
# must sum to the Paper's printed state-wide totals (Total Labor /
# Total Coalition, p.7)
BP_PRIMARIES = (1535860, 1457292)

# Cessnock's majors from its printed First Count (Background Paper 1/08,
# p.15): its tally sheets were never captured, its actual distribution is
# the count the statewide table splices (its candidate rows ride the
# by-electorate chapter). The first-preference summary prints the same
# figures; the parse cross-checks the constant against that table.
CESSNOCK_MAJORS = {"ALP": 24026, "NAT": 13754}
# the printed final count checks them against the spliced Green split
# (1,321 to Labor, 1,510 to National, both in the by-electorate rows)
assert CESSNOCK_MAJORS["ALP"] + 1321 == 25347
assert CESSNOCK_MAJORS["NAT"] + 1510 == 15264

# the supplement's pages are the booth-level audit of the main report's
# rows, but its print loses declaration-vote rows in exactly these
# (district, party) cells - the main report's database total minus the
# supplement print, per cell: [formal, toLabor, toCoal, exhausted]. Found by
# diffing the two committed sources; any change to a committed file must
# keep this fingerprint within two votes a cell.
LOST_ROWS = {
    ("Bathurst", "GRN"): (-22, -4, -5, -13),
    ("Bathurst", "IND"): (-101, -6, -33, -62),
    ("Davidson", "GRN"): (-16, -7, -3, -6),
    ("Davidson", "CDP"): (-3, 0, -2, -1),
    ("Davidson", "DEM"): (-3, -3, 0, 0),
    ("Davidson", "AFI"): (-3, 0, -1, -2),
    ("Mount Druitt", "GRN"): (-33, -5, -8, -20),
    ("Mount Druitt", "CDP"): (-105, -22, -34, -47),
    ("Mount Druitt", "AFI"): (-19, -1, 0, -18),
    ("Parramatta", "GRN"): (-160, -38, -61, -61),
    ("Parramatta", "CDP"): (-154, -24, -72, -58),
    ("Parramatta", "UNI"): (-98, -22, -14, -62),
    ("Parramatta", "DEM"): (-43, -14, -7, -22),
    ("Parramatta", "AFI"): (-40, -5, -16, -19),
    ("South Coast", "GRN"): (-43, -2, -22, -19),
    ("South Coast", "CDP"): (-34, -3, -16, -15),
    ("South Coast", "AFI"): (-15, -6, -2, -7),
    ("The Entrance", "GRN"): (-251, -28, -84, -139),
    ("The Entrance", "AFI"): (-75, -9, -10, -56),
    ("Wallsend", "GRN"): (-441, -198, -47, -196),
    ("Wallsend", "CDP"): (-133, -60, -15, -58),
    ("Wallsend", "FP"): (-185, -46, -24, -115),
}

NUMPAIR = re.compile(r"(\d+)\s+(?:\.\.|\d+\.?\d*)\b")
CAND = re.compile(r"^\s*\d*\s*(\S[^\n]*?)\s*\(([\w-]+)\)\s")
PAIR = re.compile(r"to\s+([A-Z]+)\s+\(\d\)")


def parse_bp_districts():
    """the Background Paper's by-electorate chapter ->
    district -> {pair: (codeA, codeB), rows: [(name, code, f, toA, toB, exh)]}.
    An indicative table wins; a district's actual-distribution block (five
    districts print one) stands in only when no indicative table exists."""
    t = gzip.open(MAIN, "rt").read()
    # the chapter heading also appears in the contents list (p.69); take the
    # occurrence past the statewide-tables chapter
    i0 = t.find("Preference Flows by Electorate", 100000)
    assert i0 > 0, "the by-electorate chapter is missing"
    seg = t[i0:]
    # the chapter ends at the next appendix (a share-by-party history); the
    # pastoral back-pages that follow must not enter Wyong's block
    iE = seg.find("New South Wales Election Results 1947")
    assert iE > 0, "the by-electorate chapter's end marker is Missing"
    seg = seg[:iE]
    all_names = ["Albury", "Auburn", "Ballina", "Balmain", "Bankstown", "Barwon", "Bathurst",
                 "Baulkham Hills", "Bega", "Blacktown", "Blue Mountains", "Burrinjuck", "Cabramatta",
                 "Camden", "Campbelltown", "Canterbury", "Castle Hill", "Cessnock", "Charlestown",
                 "Clarence", "Coffs Harbour", "Coogee", "Cronulla", "Davidson", "Drummoyne", "Dubbo",
                 "East Hills", "Epping", "Fairfield", "Gosford", "Goulburn", "Granville", "Hawkesbury",
                 "Heathcote", "Heffron", "Hornsby", "Keira", "Kiama", "Kogarah", "Ku-ring-gai",
                 "Lake Macquarie", "Lakemba", "Lane Cove", "Lismore", "Liverpool", "Londonderry",
                 "Macquarie Fields", "Maitland", "Manly", "Maroubra", "Marrickville", "Menai", "Miranda",
                 "Monaro", "Mount Druitt", "Mulgoa", "Murray-Darling", "Murrumbidgee", "Myall Lakes",
                 "Newcastle", "North Shore", "Northern Tablelands", "Oatley", "Orange", "Oxley",
                 "Parramatta", "Penrith", "Pittwater", "Port Macquarie", "Port Stephens", "Riverstone",
                 "Rockdale", "Ryde", "Shellharbour", "Smithfield", "South Coast", "Strathfield",
                 "Swansea", "Sydney", "Tamworth", "Terrigal", "The Entrance", "Toongabbie", "Tweed",
                 "Upper Hunter", "Vaucluse", "Wagga Wagga", "Wakehurst", "Wallsend", "Willoughby",
                 "Wollondilly", "Wollongong", "Wyong"]
    # split the chapter into per-district pages: a page starts at a line
    # that is exactly a district's name
    heads = []
    lines = seg.splitlines()
    offs = []
    pos = 0
    for ln in lines:
        offs.append(pos)
        pos += len(ln) + 1
    for nm in all_names:
        for i, ln in enumerate(lines):
            if ln.strip() == nm or ln.strip() == nm + " (Actual preference distribution)":
                heads.append((offs[i], nm, "actual" in ln))
    heads.sort()
    blocks = {}
    for j, (off, nm, is_actual_fmt) in enumerate(heads):
        end = heads[j + 1][0] if j + 1 < len(heads) else len(seg)
        blocks.setdefault(nm, []).append(seg[off:end])
    out = {}
    for nm, chunks in sorted(blocks.items()):
        if any("count forms not available" in c for c in chunks):
            continue                          # Hornsby, North Shore: no data
        best = None
        for want_actual in (False, True):     # prefer an indicative table
            for c in chunks:
                if (c.strip().splitlines()[0].strip().endswith("(Actual preference distribution)")) != want_actual:
                    continue
                # a chunk may print later distribution tables after its own
                # under a second District head ("(Full distribution)",
                # "(Actual two-party preferred distribution)" &c). Those
                # rows form a different count and never belong to this one
                if not want_actual:
                    m2 = re.search(rf"(?m)^\s*{re.escape(nm)}\s*\(", c)
                    if m2:
                        c = c[:m2.start()]
                pm = PAIR.search(c)
                if not pm:
                    continue
                pair = tuple(PAIR.findall(c)[:2])
                rows = []
                for ln in c.splitlines():
                    cm = CAND.match(ln)
                    if not cm or cm.group(1).strip() in ("", "Candidate"):
                        continue
                    nums = NUMPAIR.findall(ln[cm.start():])
                    if len(nums) < 4:
                        continue
                    f, a, b, x = (int(n) for n in nums[:4])
                    code = cm.group(2).upper()
                    # four classic districts print an unregistered
                    # independent as (-); the Paper's statewide Independent
                    # row includes them (its 1678 ballots)
                    code = "IND" if code == "-" else code
                    rows.append((cm.group(1).strip(), code, f, a, b, x))
                if rows:
                    best = (pair, rows)
            if best:
                break
        if best:
            pair, rows = best
            # a print row may miss its own cross-sum by a vote: the sheets
            # were never audited. Noted, never repaired; the statewide
            # reconciliation to the Paper's printed totals is the gate.
            for name, code, f, a, b, x in rows:
                if a + b + x != f:
                    print(f"note: {nm} {name}({code}): printed row cross-sum {a}+{b}+{x} != {f}")
            out[nm] = {"pair": pair, "rows": rows}
    return out


# supplement row: label then (formal)(toA %)(toB %)(exh %) - the count
# columns are groups 2, 3, 5, 7; the percentage columns are never read
SNUM = r"(\d+)\s+([\d.]+|\.\.)"
SROW = re.compile(rf"^([^\n]{{1,44}}?)\s+(\d+)\s+{SNUM}\s+{SNUM}\s+{SNUM}\s*$")
SHEAD = re.compile(r"^\s*Formal\s+To\s+(\S[^\n]*?)\s{2,}To\s+(\S[^\n]*?)\s{2,}Exhausted\s*$", re.M)
SLAB = re.compile(r"^([^\n]{2,40}?)\s+Votes\s+Votes\s+%", re.M)
# a candidate label or a booth-table candidate row: the print truncates at
# the page width, so the closing paren is optional ("Wiszniewski (CDP")
SCAND_LOOSE = re.compile(r"^(\S.*?)\s*\(([\w-]+)\)?\s*$")
CODES = ("ALP", "LIB", "NAT", "GRN", "CDP", "UNI", "AFI", "DEM", "FP",
         "ORP", "SOS", "SA", "IND", "ONP")


def code_of(tok):
    """a printed (possibly truncated) party token -> its canonical code:
    unique-prefix resolution ("GR" -> GRN, "CD" -> CDP), None when the
    token is empty or ambiguous ("S" could be SA or SOS)."""
    tok = tok.strip().upper()
    if tok == "-":
        return "IND"
    if tok in CODES:
        return tok
    hits = [c for c in CODES if c.startswith(tok)]
    if len(hits) == 1:
        return hits[0]
    return None
FP_ROW = re.compile(r"^([A-Za-z][A-Za-z' \-]+?)\s*\d?\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+"
                    r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$", re.M)


def parse_bp_firstprefs():
    """the Paper's SUMMARY OF FIRST PREFERENCE VOTES BY ELECTORATE ->
    district -> (ALP, LIB, NAT) primary votes. Parse gates: exactly the 93
    districts, and both statewide major sums equal the Paper's own printed
    state-wide totals, so a drifted row or column read cannot pass."""
    t = gzip.open(MAIN, "rt").read()
    i = t.find("SUMMARY OF FIRST PREFERENCE VOTES BY ELECTORATE")
    assert i > 0, "the first-preference summary chapter is missing"
    rows = {}
    for m in FP_ROW.finditer(t[i:]):
        nm = m.group(1).strip()

        def num(k):
            s = m.group(k)
            return 0 if s == ".." else int(s)

        rows[nm] = (num(2), num(3), num(4))
        if nm == "Wyong":
            break
    assert len(rows) == 93, f"{len(rows)} first-preference districts"
    got = (sum(v[0] for v in rows.values()), sum(v[1] + v[2] for v in rows.values()))
    assert got == BP_PRIMARIES, f"major-primaries sum {got} vs the Paper's printed {BP_PRIMARIES}"
    # Cessnock's stub constant, cross-checked against the same summary
    assert (rows["Cessnock"][0], rows["Cessnock"][2]) == \
        (CESSNOCK_MAJORS["ALP"], CESSNOCK_MAJORS["NAT"]), "Cessnock's summary row moved"
    return rows


def parse_supplement(bp):
    """the booth-level supplement -> district -> {order, majors{code: formal},
    minors{code: [f, toA, toB, exh]}}.

    The supplement prints two table orientations under the same tally
    header: candidate tables (the label line is "Name (CODE)  Votes Votes
    %", the rows are booths, closed by "Candidate Total") and booth tables
    (the label is a booth name, the rows are "Name (CODE)" candidates,
    closed by "Booth Total"). Most candidates appear in both forms; the
    candidate summary's printed total is the authority and the booth sum
    only fills candidates who never got one. Summing both forms would
    count most districts twice, so the two piles merge candidate-first."""
    t = gzip.open(SUPP, "rt").read()
    ms = list(re.finditer(r"NSW 2007 Election - Preferences? Flows for ([^\n]+)", t))
    spans = []
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(t)
        nm = m.group(1).strip()
        if spans and spans[-1][0] == nm:
            spans[-1] = (nm, spans[-1][1], end)
        else:
            spans.append((nm, m.start(), end))
    assert len(spans) == 93, f"{len(spans)} districts"
    out = {}
    stubs = []
    for nm, s, e in spans:
        ch = t[s:e]
        if "not available." in ch and len(ch) < 600:
            stubs.append(nm)
            continue
        heads = list(SHEAD.finditer(ch))
        assert heads, f"{nm}: no tally header"
        order = tuple(re.sub(r"\s+", " ", heads[0].group(k)).strip() for k in (1, 2))
        for hd in heads:
            ho = tuple(re.sub(r"\s+", " ", hd.group(k)).strip() for k in (1, 2))
            assert ho == order, f"{nm}: inconsistent tally headers"
        tabs = [ch[hd.end():heads[i + 1].start() if i + 1 < len(heads) else len(ch)]
                for i, hd in enumerate(heads)]
        booth_sum = collections.defaultdict(lambda: [0, 0, 0, 0])
        cand_pile = collections.defaultdict(lambda: [0, 0, 0, 0])
        pend = []                    # (label, nums) candidate tables whose code the print ate
        for tb in tabs:
            rows, total = [], None
            for ln in tb.splitlines():
                rm = SROW.match(ln)
                if not rm:
                    continue
                nums = [int(rm.group(k)) for k in (2, 3, 5, 7)]
                lbl = rm.group(1).strip()
                if lbl.startswith(("Candidate Total", "Booth Total")):
                    total = (lbl.split()[0], nums)
                    continue
                rows.append((lbl, nums))
            # classify by the total row, not the label: labels truncate at
            # the print width ("Wiszniewski (CDP" loses its close paren,
            # booth names carry parens like "Gordon (Ku-Ring-Gai)"), so a
            # label regex cannot tell the two orientations apart
            if total and total[0] == "Candidate":
                lm = SLAB.search(tb)
                cm2 = SCAND_LOOSE.match(lm.group(1).strip()) if lm else None
                code = code_of(cm2.group(2)) if cm2 else None
                if code:
                    for i, v in enumerate(total[1]):
                        cand_pile[code][i] += v
                else:
                    pend.append((lm.group(1).strip() if lm else "?", total[1]))
                rs = [sum(r[1][i] for r in rows) for i in range(4)]
                if any(abs(a - b) > 2 for a, b in zip(rs, total[1])):
                    print(f"note: {nm} {code or pend[-1][0]}: booth rows {rs} vs the printed "
                          f"Candidate Total {total[1]}")
            else:
                for lbl, nums in rows:
                    cm = SCAND_LOOSE.match(lbl)
                    code = code_of(cm.group(2)) if cm else None
                    if not code:
                        print(f"note: {nm}: row without a resolvable code: {lbl!r}")
                        continue
                    for i, v in enumerate(nums):
                        booth_sum[code][i] += v
                if total is None:
                    print(f"note: {nm}: a tally table with no total row ({len(rows)} rows)")
        # a candidate label can lose its whole parenthetical to the print
        # ("van der Wijngaar" - 16 letters and its GRN never made the page).
        # Resolve by the district's own booth sums first (the total prints
        # its figure exactly), then by the main report's candidate name
        missing = []
        for label, nums in pend:
            hits = [c for c, b in booth_sum.items()
                    if c not in cand_pile and list(b) == list(nums)]
            code = hits[0] if len(hits) == 1 else None
            if not code and nm in bp:
                wants = [rw for rw in bp[nm]["rows"]
                         if rw[0].lower().startswith(label.lower()[:6])
                         or label.lower().startswith(rw[0].lower()[:6])]
                if len(wants) == 1:
                    code = wants[0][1]
            if code:
                print(f"note: {nm}: codeless candidate table {label!r} resolved to {code}")
                for i, v in enumerate(nums):
                    cand_pile[code][i] += v
            else:
                missing.append(label)
        assert not missing, f"{nm}: unresolvable codeless candidate tables: {missing}"

        minors = {}
        for code in set(booth_sum) | set(cand_pile):
            cp, bs = cand_pile.get(code) or [0, 0, 0, 0], booth_sum.get(code) or [0, 0, 0, 0]
            minors[code] = cp if any(cp) else bs
        # a non-classic district may print an excluded major's table (it
        # fed the actual final two); classic districts never print majors
        majors = {code: minors.pop(code)[0] for code in MAJORS if code in minors}
        out[nm] = {"order": order, "majors": majors, "minors": minors}
    return out, stubs


CLASSIC = lambda pair: "ALP" in pair and any(p in ("LIB", "NAT") for p in pair)


def main():
    bp = parse_bp_districts()
    fp = parse_bp_firstprefs()
    supp, stubs = parse_supplement(bp)
    # the Library's mislabel: the seat it means is North Shore
    assert sorted(stubs) == ["Cessnock", "Hornsby", "North Sydney"], stubs
    universe = set(supp) | {"Cessnock", "Hornsby", "North Shore"}
    assert len(universe) == 93, len(universe)

    classic = sorted(nm for nm, d in bp.items() if CLASSIC(d["pair"]))
    skipped = sorted(universe - set(classic))
    assert len(universe) == 93 and len(classic) == 73 and len(skipped) == 20, \
        f"{len(classic)} classic, {len(skipped)} skipped of {len(universe)}"
    print(f"classic districts: {len(classic)}; skipped ({len(skipped)}): {', '.join(skipped)}")
    onp = [(nm, c) for nm, d in bp.items() for (_, c, *_rest) in d["rows"] if BUCKET.get(c) == "onp"]
    assert not onp, f"One Nation at 2007: {onp[:3]}"
    # no classic district sat both Coalition brands: a major-party ballot
    # stays with its side, so no excluded-major split enters the piles
    majors_seen = [(nm, r) for nm in classic for r in bp[nm]["rows"] if r[1] in MAJORS]
    assert not majors_seen, f"major rows inside the classic districts: {majors_seen[:3]}"

    # crossbench piles from the Background Paper's rows (asserted against
    # the Paper's printed statewide table, so they cannot silently drift)
    cross = collections.defaultdict(lambda: [0, 0, 0])     # code: toLabor, toCoal, exh
    for nm in classic:
        lab = bp[nm]["pair"].index("ALP")
        for name, code, f, a, b, x in bp[nm]["rows"]:
            to_a, to_c = (a, b) if lab == 0 else (b, a)
            for i, v in enumerate((to_a, to_c, x)):
                cross[code][i] += v
    fails = []
    for code, want in BP_PARTY.items():
        got = tuple(cross.get(code, (0, 0, 0)))
        if any(abs(g - w) > 2 for g, w in zip(got, want)):
            fails.append(f"{code}: {got} vs the Paper's printed {want}")
    got_tot = tuple(sum(cross[c][i] for c in cross) for i in range(3))
    if any(abs(g - w) > 2 for g, w in zip(got_tot, BP_TOTAL)):
        fails.append(f"TOTAL: {got_tot} vs the Paper's printed {BP_TOTAL}")
    if fails:
        raise SystemExit("the by-electorate rows no longer sum to the Paper's statewide table:\n  "
                         + "\n  ".join(fails))
    print(f"crossbench rows reconcile with the Paper's statewide table: {got_tot}")

    # the supplement audits the same per-district figures: its minors'
    # per-district piles vs the Background Paper's rows, modulo the pinned
    # declaration-row losses
    drift = []
    for nm in classic:
        if nm == "Cessnock":
            continue                          # supplement stub; actual distribution carries it
        lab = bp[nm]["pair"].index("ALP")
        want = collections.defaultdict(lambda: [0, 0, 0, 0])
        for name, code, f, a, b, x in bp[nm]["rows"]:
            to_a, to_c = (a, b) if lab == 0 else (b, a)
            for i, v in enumerate((f, to_a, to_c, x)):
                want[code][i] += v
        got = supp.get(nm, {}).get("minors", {})
        sorder = supp[nm]["order"]
        assert "Labor" in sorder, f"{nm}: supplement pair {sorder}"
        s_lab = sorder.index("Labor")
        s_coalname = "Liberal" if "LIB" in bp[nm]["pair"] else "National"
        assert s_coalname in sorder, f"{nm}: supplement pair {sorder} lacks {s_coalname}"
        s_coal = sorder.index(s_coalname)
        for code in set(want) | set(got):
            wf = want[code]
            ws = got.get(code, [0, 0, 0, 0])
            sg = [ws[0], ws[1 + s_lab], ws[1 + s_coal], ws[3]]
            diff = tuple(g - w for g, w in zip(sg, wf))
            exp = LOST_ROWS.get((nm, code))
            if exp:
                if any(abs(d - e) > 2 for d, e in zip(diff, exp)):
                    drift.append(f"{nm} {code}: {diff} vs pinned loss {exp}")
            elif any(abs(d) > 2 for d in diff):
                drift.append(f"{nm} {code}: {diff} outside the fingerprint - the Paper {tuple(wf)}, "
                             f"the supplement {tuple(sg)}")
    if drift:
        raise SystemExit("the supplement no longer audits the Paper's rows:\n  " + "\n  ".join(drift))
    print(f"the supplement audits the Paper's rows district by district "
          f"({len(LOST_ROWS)} declaration-row losses pinned)")

    # implied two-party on the count's own basis: the Paper's crossbench
    # splits plus the major parties' first-preference piles from the
    # Paper's summary table (the supplement prints no classic-district
    # major tables - a finalist's ballots are never distributed)
    tot_a = sum(cross[c][0] for c in cross)
    tot_c = sum(cross[c][1] for c in cross)
    for nm in classic:
        tot_a += fp[nm][0]
        tot_c += fp[nm][1] + fp[nm][2]
    implied = round(100 * tot_a / (tot_a + tot_c), 1)
    assert 54 <= implied <= 56, f"implied Labor tally-basis two-party {implied}"
    print(f"implied Labor two-party {implied} on the count's basis "
          f"(the Paper's statewide 2PP is {BP_2PP}; the gap is real OPV differential exhaustion)")
    all93 = round(100 * (sum(v[0] for v in fp.values()) + sum(cross[c][0] for c in cross)) /
                  (sum(v[0] + v[1] + v[2] for v in fp.values()) +
                   sum(cross[c][0] + cross[c][1] for c in cross)), 2)
    print(f"  (all-93 first-preferences-plus-flows basis for the record: {all93})")

    pile = collections.defaultdict(lambda: [0, 0, 0])      # bucket: toLabor, toCoal, exh
    for code, (a, c, x) in cross.items():
        b = BUCKET.get(code, "oth")
        for i, v in enumerate((a, c, x)):
            pile[b][i] += v

    def nshare(b):
        a, c, x = pile[b]
        if not a + c + x:
            return None, None
        return (round(100 * a / (a + c), 1) if a + c else None,
                round(100 * x / (a + c + x), 1))

    entry = {"votes": {g: [pile[g][0], pile[g][1]] for g in ("grn", "onp", "oth")},
             "implied2pp": implied, "skipped": skipped}
    for g in ("grn", "onp", "oth"):
        entry[g], entry[g + "Exh"] = nshare(g)
    for g in ("grn", "onp", "oth"):
        a, c, x = pile[g]
        print(f"  {g}: {a:,}/{c:,}/{x:,}"
              + (f"  = {entry[g]}% to Labor of either, {entry[g + 'Exh']}% exhausted" if entry[g] is not None else ""))

    aseats = {}
    if os.path.exists(ALL):
        old = json.load(open(ALL))
        sk = old.get("skipped") or [[] for _ in old["years"]]
        for i, y in enumerate(old["years"]):
            if y == YEAR:
                continue
            aseats[y] = dict(grn=old["grn"][i], grnExh=old["grnExh"][i],
                             onp=old["onp"][i], onpExh=old["onpExh"][i],
                             oth=old["oth"][i], othExh=old["othExh"][i],
                             votes={g: old["votes"][g][i] for g in ("grn", "onp", "oth")},
                             implied2pp=old["implied2pp"][i], skipped=sk[i])
    aseats[YEAR] = entry
    ys = sorted(aseats)
    doc = {"source": "NSW Electoral Commission ballot papers, scanned notionally Labor v Coalition in every "
                     "district (2015 on); 2007 from Antony Green's indicative tally-sheet count as printed in "
                     "NSW Parliamentary Library Background Paper 1/08 (about four ballots in five, the "
                     "declaration votes' forms mostly missing) - its per-district rows, reconciled to the "
                     "Paper's printed statewide table and audited against the booth-level supplement",
           "years": ys,
           "grn": [aseats[y]["grn"] for y in ys], "grnExh": [aseats[y]["grnExh"] for y in ys],
           "onp": [aseats[y]["onp"] for y in ys], "onpExh": [aseats[y]["onpExh"] for y in ys],
           "oth": [aseats[y]["oth"] for y in ys], "othExh": [aseats[y]["othExh"] for y in ys],
           "votes": {g: [aseats[y]["votes"][g] for y in ys] for g in ("grn", "onp", "oth")},
           "implied2pp": [aseats[y]["implied2pp"] for y in ys],
           "skipped": [aseats[y]["skipped"] for y in ys]}
    with open(ALL, "w") as f:
        json.dump(doc, f, indent=1)
        f.write("\n")
    print(f"wrote {ALL} (years {ys})")


if __name__ == "__main__":
    main()
