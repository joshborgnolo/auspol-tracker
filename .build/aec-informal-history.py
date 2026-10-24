"""aec-informal-history.py – the INFORMAL-VOTE history behind the
/flows-explained/ chart's fourth View stop (user 2026-10-24: "View:
Informal votes … informal voting data for each federal election as far
back as possible, split also by state/territory, lower and upper house",
"also … by aec seat classification …, and IRSAD index quintile", "and ieo
quintile").

Every cell is informal ballots ÷ (formal + informal) ballots, per cent.

Lanes (sources committed under .build/aec-informal-src/ - README.md there
records the fetches, seams and divergences):
  House national + the eight states, 1901–2025:
    1901–2001  the APH handbook appendix "Informal votes: House of
               Representatives" (aph-informal-house.htm, 44 elections;
               the NT enters 1922, the ACT 1949 - missing cells are
               nulls, never 0);
    2004–2025  derived from the committed VTR vote-type downloads
               (booth/oracle/fpvvt-<year>.csv.gz): each division's
               Informal pseudo-row's TotalVotes over every candidate
               row's. The APH table's whole 2004–2013 overlap recomposes
               at 1dp (asserted), as do the AEC summary page's 2016/19/22.
  Senate national + the eight states, 1903–2022:
    1903–1975  the APH appendix "Informal votes: Senate"
               (aph-informal-senate.htm; its 1901 row is n.a. everywhere
               but SA/WA/Tas, so 1903 is the floor);
    1977–2022  the AEC's informality summary page (its table 0; the
               WA-only 2014 re-election row is dropped - its figures are
               already folded into the APH's 2013 row, and 2014 is never
               an election year in the chart). No AEC machine-readable
               2025 Senate informal product exists yet (the page's
               "Updated: 24 August 2022" still stands; the VTR's 2025
               turnout URLs 404), so the Senate lane floors at 2022 while
               the House's runs 2025.
  House AEC seat classes (inner/outer/provincial/rural), 1996–2025:
    each division's informal share regrouped by that election's own
    data/division-classifications.json block - 1996–2001 counted from the
    committed statistics-era tables (htpp-<year>.txt's Informal Vote
    over hcands-<year>.txt's formal first preferences); 2004–2025 the
    fpvvt lane above. 1998's Newcastle is absent from the HTPP product -
    its poll was deferred to a supplementary election on 21 November 1998
    after the Democrats candidate died, and the packs' polling-place table
    never carried it - so its informal count is filed from the AEC's own
    supplementary-election result page (NEWCASTLE_1998 below) and all
    148 divisions stand behind the 1998 cells.
  SEIFA quintiles — IRSAD q1..q5, IEO e1..e5, IER r1..r5, 2001–2025:
    the same divisions' votes regrouped by
    seifa_quintiles.membership(year, ix) — the class bank's FIFTEEN
    seifa records, ix-tagged exactly like the primary lane's. Numbered
    along the advantage ladder like every lane sibling (q1/e1/r1 most
    ADVANTAGED … q5/e5/r5 most-disadvantaged, the 2026-10-24 sitewide
    renumbering the informal lane absorbed on its IER addition).

Printed-source divergences the merges take a side on (both figures
official, listed for audit): the AEC summary page and the APH appendix
print tiny differences on their shared Senate years, and two House years
(1980: 2.4 v 2.5; 1984: 6.8 v 6.3 - the AEC page is the newer product,
so where both print a cell the AEC page governs the SENATE lane and the
fpvvt derivation the House; the APH is the deep-time lane alone).

Usage: python3 .build/aec-informal-history.py [--check]
  default writes data/informal-history.json; --check re-derives and compares.
"""
import csv, gzip, json, os, re, sys
from html.parser import HTMLParser

from seifa_quintiles import INDEX_META, QIDXES, SEIFA_YEARS, membership as seifa_membership

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "aec-informal-src")
BOOTH = os.path.join(HERE, "aec-flow-src", "booth", "oracle")
FLOW_SRC = os.path.join(HERE, "aec-flow-src")
OUT = os.path.join(ROOT, "data", "informal-history.json")

EVENTS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]
LEGACY_YEARS = [1996, 1998, 2001]
# 1998 Newcastle's supplementary election (21 Nov 1998: Liberals did not
# stand, Labor's Allan Morris beat the Greens' Carrie Jacobi 67.33-32.67),
# from https://aec.gov.au/elections/supplementary_by_elections/1998/newcastle.htm
# - the HTPP polling-place table omits the division; hcands carries its
# first preferences, which must sum to the page's formal figure
NEWCASTLE_1998 = {"formal": 65223, "informal": 3347}
CLASS_YEARS = LEGACY_YEARS + EVENTS

STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"]
STATE_FULL = {"nsw": "New South Wales", "vic": "Victoria", "qld": "Queensland",
              "wa": "Western Australia", "sa": "South Australia", "tas": "Tasmania",
              "act": "Australian Capital Territory", "nt": "Northern Territory"}
STATE_SHORT = {"nsw": "NSW", "vic": "Vic", "qld": "Qld", "wa": "WA",
               "sa": "SA", "tas": "Tas", "act": "ACT", "nt": "NT"}
SMAP = dict(NSW="nsw", VIC="vic", QLD="qld", WA="wa", SA="sa", TAS="tas", ACT="act", NT="nt")

CLASS_META = (("inner", "Inner metropolitan", "inner metro"),
              ("outer", "Outer metropolitan", "outer metro"),
              ("provincial", "Provincial", "provincial"),
              ("rural", "Rural", "rural"))
CLS_KEY = {"inner metropolitan": "inner", "outer metropolitan": "outer",
           "provincial": "provincial", "rural": "rural"}

# ---- committed-page tables --------------------------------------------------
class _Tables(HTMLParser):
    """Every <table> in one committed page, as rows of stripped cell text."""
    def __init__(self):
        super().__init__()
        self.tables, self._n, self.rows, self.row, self.cell = [], 0, [], None, None
    def handle_starttag(self, tag, _attrs):
        if tag == "table":
            self._n += 1
            if self._n == 1: self.rows = []
        elif tag == "tr" and self._n == 1:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = ""
    def handle_endtag(self, tag):
        if tag == "table":
            self._n -= 1
            if self._n == 0: self.tables.append(self.rows)
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row); self.row = None
        elif tag in ("td", "th") and self.cell is not None:
            self.row.append(re.sub(r"\s+", " ", self.cell).strip()); self.cell = None
    def handle_data(self, d):
        if self.cell is not None: self.cell += d

# the committed pages' own column vocabularies, normalised to repo cuts:
# APH prints "NSW Vic Qld SA WA Tas NT ACT Aust" (SA before WA, NT before
# ACT), the AEC page "Year NSW Vic. Qld WA SA Tas. ACT NT Total" (WA
# before SA) - never trust position, always the header cell's words.
_HDR_MAP = {"nsw": "nsw", "vic": "vic", "vic.": "vic", "qld": "qld",
            "wa": "wa", "sa": "sa", "tas": "tas", "tas.": "tas",
            "nt": "nt", "act": "act", "aust": "nat", "total": "nat"}

def pct_table(path, table_idx=0):
    """{year: {cut: pct}} from one committed informality table. The
       ". ."/"n.a."/empty cells are None; a footnoted year ("2013 (a)",
       "1983[1]") files under its plain year; a row whose year is not
       four digits (the AEC page's "2014[2]" WA-only re-election row is
       the only one) is dropped."""
    p = _Tables()
    with open(path, encoding="utf-8", errors="replace") as f:
        p.feed(f.read())
    tbl = p.tables[table_idx]
    cols = [_HDR_MAP.get(c.lower(), None) for c in tbl[0]]
    assert sum(1 for c in cols if c) == 9, f"{path}: header drifted - {tbl[0]}"
    out = {}
    for row in tbl[1:]:
        m = re.match(r"(\d{4})", row[0])
        if not m:
            continue   # 2014[2], the WA half-Senate re-election row
        year = int(m.group(1))
        cells = {}
        for raw, cut in zip(row[1:], cols[1:]):
            if cut is None:
                continue
            t = raw.strip()
            cells[cut] = None
            if t in (". .", "n.a.", ""):
                continue
            cells[cut] = float(t)
        out[year] = cells
    return out

def aph_house():
    return pct_table(os.path.join(SRC, "aph-informal-house.htm"))

def aph_senate():
    return pct_table(os.path.join(SRC, "aph-informal-senate.htm"))

def aec_page():
    """(senate rows, house rows) - the page's table 0 is the Senate's
       (its 1977 national 9.0 is the APH Senate row's; table 1's 2.5 the
       House's), asserted below against the APH series themselves."""
    p = os.path.join(SRC, "aec-informality-summary.html")
    return pct_table(p, 0), pct_table(p, 1)

# ---- per-division vote lanes ------------------------------------------------
def fpvvt_votes(year):
    """{division: (formal, informal)} from the VTR's vote-type download;
       one Informal pseudo-row per division, its TotalVotes covering
       every vote type (ordinary, absent, provisional, pre-poll, postal).
       Returns (votes, div_state) - the join lanes need the states."""
    path = os.path.join(BOOTH, f"fpvvt-{year}.csv.gz")
    with gzip.open(path, "rt", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    hi = next(i for i, r in enumerate(rows) if r and r[0] == "StateAb")
    h = {c: i for i, c in enumerate(rows[hi])}
    votes, div_state = {}, {}
    for r in rows[hi + 1:]:
        if len(r) <= h["TotalVotes"] or not r[1].strip():
            continue
        div = r[h["DivisionNm"]].strip()
        div_state[div] = SMAP[r[h["StateAb"]].strip()]
        fr, inf = votes.get(div, (0, 0))
        v = int(r[h["TotalVotes"]].strip())
        if r[h["PartyNm"]].strip() == "Informal":
            inf += v
        else:
            fr += v
        votes[div] = (fr, inf)
    return votes, div_state

def legacy_votes(year):
    """{division: (formal, informal)} for the statistics era: htpp's
       per-booth Informal Vote column sums, and hcands' formal
       first-preference totals (the tables the primary lane reads the
       same divisions' shares from - one record, two products)."""
    lines = open(os.path.join(FLOW_SRC, f"htpp-{year}.txt"),
                 encoding="utf-8-sig").read().splitlines()
    head = lines[0].split(";")
    idiv, iinf = head.index("Division"), head.index("Informal Vote")
    votes = {}
    for ln in lines[1:]:
        c = ln.split(";")
        if len(c) <= iinf or not c[idiv].strip():
            continue
        div = c[idiv].strip()
        fr, inf = votes.get(div, (0, 0))
        votes[div] = (fr, inf + int((c[iinf] or "0").strip()))
    hlines = open(os.path.join(FLOW_SRC, f"hcands-{year}.txt"),
                  encoding="utf-8-sig").read().splitlines()
    hhead = hlines[0].split(";")
    hdiv, hvote = hhead.index("Division"), hhead.index("Vote")
    for ln in hlines[1:]:
        c = ln.split(";")
        if len(c) <= hvote or not c[hvote].strip():
            continue
        div = c[hdiv].strip()
        # 1998 Newcastle (a supplementary election, Labor v Greens) is
        # absent from the HTPP product: its informal count comes from the
        # AEC's supplementary result page
        if year == 1998 and div == "Newcastle" and div not in votes:
            votes[div] = (0, NEWCASTLE_1998["informal"])
        assert div in votes, f"{year} {div}: a formal vote with no htpp informal row"
        fr, inf = votes[div]
        votes[div] = (fr + int(c[hvote].strip()), inf)
    if year == 1998:
        assert votes["Newcastle"][0] == NEWCASTLE_1998["formal"], \
            f"1998 Newcastle: hcands formal {votes['Newcastle'][0]} != the AEC page's 65,223"
    return votes

def cut_shares(votes, to_cut):
    """Group divisions by the to_cut callable's cut of each division and
       return {cut: informal ÷ (formal + informal) %}."""
    agg = {}
    for div, (fr, inf) in votes.items():
        cut = to_cut(div)
        fr2, inf2 = agg.get(cut, (0, 0))
        agg[cut] = (fr2 + fr, inf2 + inf)
    return {cut: 100.0 * inf / (fr + inf) for cut, (fr, inf) in agg.items()}

# ---- view assembly ------------------------------------------------------------
def aligned(rows, cuts, null_complete=False):
    """rows: {year: {cut: pct}} -> (years, {cut: [cells aligned]}).
       Every year carries every cut once it appears - cells before that
       (a territory not yet represented) are nulls."""
    years = sorted(rows)
    out = {}
    for cut in cuts:
        out[cut] = [rows[y].get(cut) for y in years]
    return years, out

def cap_range(series, where):
    for cut, cells in series.items():
        for v in cells:
            if v is not None:
                assert 0 < v <= 25, f"{where} {cut} {v}: outside the printable informal range"

def view(label, elections, years, inf, short=None):
    d = {"label": label, "elections": elections, "years": years}
    if short:
        d["short"] = short
    d["inf"] = inf
    return d

def r2(x):
    return None if x is None else round(x, 2)

def build():
    aph_h, aph_s = aph_house(), aph_senate()
    aec_s, aec_h = aec_page()
    assert aph_h[1977]["nat"] == aec_h[1977]["nat"] == 2.5, \
        "the committed-page tables' chamber identity drifted (APH 1977 House 2.5, AEC table-1 1977 House 2.5)"
    assert aph_s[1977]["nat"] == aec_s[1977]["nat"] == 9.0, \
        "the committed-page tables' chamber identity drifted (APH 1977 Senate 9.0, AEC table-0 1977 Senate 9.0)"

    # ---- House national + states -------------------------------------------
    # APH governs 1901–2001 (its span ends 2013, but derived fpvvt cells,
    # the exact per-division counts, already own 2004 → the APH row joins
    # only the years no derivation serves).
    h_rows = {y: dict(c) for y, c in aph_h.items()}
    nat_derived, st_derived = {}, {}
    for y in EVENTS:
        votes, div_state = fpvvt_votes(y)
        nat_derived[y] = cut_shares(votes, lambda _d: "nat")
        st_derived[y] = cut_shares(votes, div_state.get)
        # assert the APH overlap recomposes at 1dp (national and states)…
        if y in aph_h:
            for cut, p in list(nat_derived[y].items()) + list(st_derived[y].items()):
                aph = (aph_h[y].get("nat") if cut == "nat" else aph_h[y].get(cut))
                assert aph is not None and abs(p - aph) < 0.06, \
                    f"{y} {cut}: fpvvt {p:.2f} != APH {aph}"
        # …and the AEC summary page's cells where it prints them, within
        # 0.1 - past 1dp rounding: several 2016/19/22 page cells sit
        # rounding-consistent, but 2022's Total (5.1) and Qld (4.1) and
        # SA (5.1) cells read as truncations of the count's 5.19/4.17/
        # 5.12 (rounded properly they print 5.2/4.2/5.1) - the derivation
        # governs the lane, the page is the cross-check, never the cell.
        # ONE page cell is a misprint its own neighbours convict: House
        # SA 2013 prints 5.5 - verbatim its OWN 2010 SA cell - while the
        # count stands 4.85 and the APH prints 4.8. It is exempted,
        # never adopted.
        if y in aec_h:
            for cut in ("nat",) + tuple(STATES):
                p = (nat_derived if cut == "nat" else st_derived)[y][cut]
                apg = aec_h[y].get(cut)
                if y == 2013 and cut == "sa":
                    assert abs(p - 4.85) < 0.03 and apg == 5.5, \
                        "the AEC page's 2013 SA House cell moved - re-adjudicate the misprint exemption"
                    continue
                assert apg is not None and abs(p - apg) < 0.10, \
                    f"{y} {cut}: fpvvt {p:.2f} != AEC page {apg}"
    for y in EVENTS:
        cells = {}
        for cut in ("nat",) + tuple(STATES):
            cells[cut] = (nat_derived if cut == "nat" else st_derived)[y][cut]
        h_rows[y] = cells
    years_h, h_series = aligned(h_rows, ("nat",) + tuple(STATES))
    cap_range(h_series, "house")

    # ---- Senate national + states -------------------------------------------
    # APH governs 1903–1975 (its 1901 row is n.a. nationally); the AEC
    # page governs 1977–2022. On the shared span the two official prints
    # diverge in six national years, the documented set: 1980/1987/2007/
    # 2010 by ~0.1, 1984 by ~0.4 (and its WA cell by 1.2 - the 1984
    # ballot simplification's informality was restated between the
    # handbook's compilation and the modern summary), 2013 by the WA
    # re-election fold. Neither is a misprint; the NEWER official
    # product governs, so the page's cells win 1977 on here and the
    # bound per year is shaped for the 1984 restatement. The nat-level
    # divergence years must stay exactly the documented set.
    s_rows = {}
    divergence = []
    for y in sorted(aph_s):
        if y == 1901:
            continue   # n.a. nationally - no Senate figures file that year
        cells = dict(aph_s[y])
        if y in aec_s:
            na, nb = cells.get("nat"), aec_s[y].get("nat")
            if na is not None and nb is not None and abs(na - nb) > 0.05:
                divergence.append((y, na, nb))
            bound = 1.5 if y <= 1990 else 0.5
            for cut in ("nat",) + tuple(STATES):
                a, b = cells.get(cut), aec_s[y].get(cut)
                assert a is None or b is None or abs(a - b) < bound, \
                    f"Senate {y} {cut}: APH {a} vs AEC page {b} - past the bound"
            cells = dict(aec_s[y])   # the newer official product governs
        s_rows[y] = cells
    assert [d[0] for d in divergence] == [1980, 1984, 1987, 2007, 2010, 2013], \
        f"Senate APH/AEC nat divergence set moved from the documented six: {divergence}"
    for y in sorted(aec_s):          # AEC-only years past the APH table's end
        if y not in s_rows:
            s_rows[y] = dict(aec_s[y])
    years_s, s_series = aligned(s_rows, ("nat",) + tuple(STATES))
    assert years_s[0] == 1903 and years_s[-1] == 2022, \
        "the Senate lane's span drifted - 2022 is its floor until an AEC 2025 Senate informal product exists"
    cap_range(s_series, "senate")

    # ---- House classes -------------------------------------------------------
    cls_blocks = json.load(open(os.path.join(ROOT, "data", "division-classifications.json"),
                                encoding="utf-8"))["elections"]
    class_rows = {k: {} for k, _, _ in CLASS_META}
    class_recon = {}
    for y in CLASS_YEARS:
        assert str(y) in cls_blocks, f"{y}: no division-classifications block"
        votes = legacy_votes(y) if y < 2004 else fpvvt_votes(y)[0]
        blk = cls_blocks[str(y)]
        # the join is exact by construction (1998's Newcastle filled from
        # its supplementary-election page)
        missing = sorted(set(blk) - set(votes))
        assert not sorted(set(votes) - set(blk)), \
            f"{y}: counted divisions the class block never heard of - {sorted(set(votes) - set(blk))[:3]}"
        assert missing == [], \
            f"{y}: class join missing {missing[:3]}"
        shares = cut_shares(votes, lambda d: CLS_KEY[blk[d]["classification"].lower()])
        for ck, _, _ in CLASS_META:
            class_rows[ck][y] = shares[ck]
        tfr = sum(fr for fr, _ in votes.values())
        tinf = sum(inf for _, inf in votes.values())
        class_recon[y] = (tfr, tinf)

    # ---- the SEIFA fifths (same ballots, two indexes' partitions) ------------
    quint_rows = {ix: {m[0]: {} for m in INDEX_META[ix]["meta"]} for ix in QIDXES}
    for y in SEIFA_YEARS:
        votes = legacy_votes(y) if y < 2004 else fpvvt_votes(y)[0]
        tfr = sum(fr for fr, _ in votes.values())
        tinf = sum(inf for _, inf in votes.values())
        assert (tfr, tinf) == class_recon[y], \
            f"{y}: the seats counted under a fifth's partition differ from the class lane's"
        for ix in QIDXES:
            mem = seifa_membership(y, ix)
            assert set(votes) == set(mem), \
                f"{y} {ix}: quintile join drifted - counted {sorted(set(votes) - set(mem))[:3]}, quintilised-only {sorted(set(mem) - set(votes))[:3]}"
            shares = cut_shares(votes, lambda d: mem[d]["classification"])
            for m in INDEX_META[ix]["meta"]:
                quint_rows[ix][m[0]][y] = shares[m[0]]

    # ---- emit -----------------------------------------------------------------
    doc = {
        "_comment": "GENERATED by .build/aec-informal-history.py - informal ballots as a share of ballots cast (informal / (formal + informal), %) at each federal election. House national + states 1901-2025 (the APH election-handbook appendix to 2001, the VTR vote-type downloads' recomposed counts from 2004); Senate 1903-2022 (the APH appendix to 1975, the AEC's informality summary page after - no 2025 Senate informal product exists yet); AEC seat classes 1996-2025 and IRSAD/IEO fifths 2001-2025 (each division's figures regrouped by that election's own grouping). Source seams, the Senate floor, divergence notes and provenance: .build/aec-informal-src/README.md.",
        "fed": view("Federal", "Australian federal elections",
                    years_h, [r2(v) for v in h_series["nat"]]),
    }
    states = {}
    for s in STATES:
        states[s] = view(STATE_FULL[s], STATE_FULL[s] + " electorates at federal elections",
                         years_h, [r2(v) for v in h_series[s]], short=STATE_SHORT[s])
    doc["fed"]["states"] = states
    sen_states = {}
    for s in STATES:
        sen_states[s] = view(STATE_FULL[s], STATE_FULL[s] + " Senate",
                             years_s, [r2(v) for v in s_series[s]], short=STATE_SHORT[s])
    doc["fed"]["sen"] = view("Federal Senate", "Australian Senate elections",
                             years_s, [r2(v) for v in s_series["nat"]],
                             short="Senate")
    doc["fed"]["sen"]["states"] = sen_states
    doc["fed"]["classes"] = {}
    for ck, label, short in CLASS_META:
        ys = sorted(class_rows[ck])
        doc["fed"]["classes"][ck] = view(label, f"federal elections in {short} seats",
                                         ys, [r2(class_rows[ck][y]) for y in ys], short=short)
    for ix in QIDXES:
        for q, qlbl, qshort, qdesc in INDEX_META[ix]["meta"]:
            ys = sorted(quint_rows[ix][q])
            doc["fed"]["classes"][q] = {"seifa": True, "ix": ix,
                                        **view(qlbl, f"federal elections in the {qdesc} of seats by {ix.upper()}",
                                               ys, [r2(quint_rows[ix][q][y]) for y in ys], short=qshort)}
    return doc

def main():
    doc = build()
    if "--check" in sys.argv:
        original = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else None
        if original != doc:
            print("CHECK FAIL: data/informal-history.json is not what the script builds", file=sys.stderr)
            sys.exit(1)
        print("check ok")
        return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, separators=(",", ": "))
        f.write("\n")
    print("wrote", os.path.relpath(OUT, ROOT))
    f = doc["fed"]
    print(f"\nHouse national: {f['years'][0]}–{f['years'][-1]} ({len(f['years'])} elections), "
          f"latest {f['inf'][-1]}")
    s = f["sen"]
    print(f"Senate national: {s['years'][0]}–{s['years'][-1]} ({len(s['years'])} elections), "
          f"latest {s['inf'][-1]}")
    print("classes:", ", ".join(f"{k} {v['years'][0]}–{v['years'][-1]}"
                                for k, v in f["classes"].items()))

if __name__ == "__main__":
    main()
