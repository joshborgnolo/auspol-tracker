#!/usr/bin/env python3
"""data-vic22.json for /map/ — the Victorian state election of 26 Nov 2022
(88 Legislative Assembly districts), the sa26/nsw23 discipline on the VEC's
own results files rather than an API.

Sources (the committed mirror, assembled by .build/map/harvest-vic22-src.py;
this script never refetches — a cache gap fails the build loudly):

  .build/map/src/vic22/xls/<slug>.xls — the VEC Azure-blob "Results by
    Voting Centre" district workbook (sheet 'Results-ElectorateResultsVoting').
    Grammar (pinned across all 88 files, 2026-10-27):
      row 3  "<Name> District (Primary)" in col0
      rows 5–8  ENROLMENT / FORMAL VOTES / INFORMAL VOTES / TOTAL VOTES,
                an integer in col2 (numbers arrive as floats)
      row 12 candidate header — "SURNAME, Given\n\n<party>\n" cells at SPARSE
                column indices (Kew has a phantom empty column at index 5;
                the candidate columns are keyed off the non-empty header
                cells, the venue-row cells read at those same indices),
                closed by "Informal Votes\n" then "Total Votes\nPolled"
      rows 14.. venue rows: label col1 (col0 empty), per-candidate cells at
                the header's own indices, informal and total at the sentinels'
                indices; each venue's candidate sum + informal == its total
      'Total Ordinary Votes' subtotal (== venue sums, per column)
      declaration rows (Absent / Early Vote / Postal Vote / Marked as Voted /
                Provisional — skipped from the booth lanes, summed into the
                district totals), 'Total Declaration Votes' subtotal
      'TOTAL ALL VOTE TYPES' (== the two subtotals; its candidate cells ARE
                the district's formal per-candidate figures)
      'Percentage of Formal Vote' row ("\n44.32%" strings — recomputed here)
    The chain asserts every one of those equalities and fails loud.
  .build/map/src/vic22/2cp/<slug>.html — the results pages' 2CP annex: one
    table; the header row names the final TCP pair; rows per voting centre
    [pairA, pairB, mis-sorts, informal, total]; a closing 'Total' row. The
    booth `tcp` lane and the district TCP totals are made here — the VEC
    publishes no TCP XLS. (Pakenham's and Shepparton's district lanes
    carry the certified distribution final instead — THE CERTIFIED-FINAL
    OVERRIDE below.) (Narracan's annex is the May 2023 SUPPLEMENTARY
    election's page, the only record: that district's ordinary poll was
    deferred, so the frame carries the supplementary result — see the
    harvester's comment.)

  THE TWO VEC VINTAGES. The XLS is a DECLARATION-STAGE snapshot (printed
  6–7 Dec 2022; Narracan's Feb 2023 supplementary print) while the live
  annex pages carry a LATER tally: 62 districts agree exactly, the 26 in
  BOOTH_TCP_DRIFT differ by 1…1,675 votes (declaration-pile movements:
  per-booth cells agree everywhere bar five venues with a pinned
  venue-cell glitch, so the district differences sit overwhelmingly in
  the declaration rows' lumped totals). A third,
  recheck-era vintage exists in the web pages' "Recheck votes" blocks
  (rechecks move votes formal→informal virtually everywhere) — it has no
  venue detail and stays OUT of the frame. Contract: the XLS is the
  frame's canonical formal/informal/total record (the only internally
  consistent per-booth product); the annex supplies the TCP pair and
  per-booth TCP splits; every annex↔XLS divergence is enumerated in
  BOOTH_TCP_DRIFT below and asserted EXACTLY — an unlisted drift of one
  vote fails the build.
  NEPEAN'S BLOB SLOT WAS REUSED: the canonical Azure name "Nepean
  District-Results by Voting Centre.xls" now serves the 2026 Nepean
  BY-ELECTION file (print 08/05/2026, 13 venues); the committed
  src/vic22/xls/nepean.xls is the 2022-general file recovered from
  web.archive.org/web/20250430153207id_/… (18 venues, enrolment 48,944,
  matching the annex's venue set). Re-running the harvester would
  re-clobber it — do not.
  .build/map/src/vic22/demsausage/vic-2022.json — Democracy Sausage's
    1,659-place roll (election id 34), the geocode source (the VEC publishes
    no venue coordinates). Places join within a district on the VEC venue
    short name (exact); a miss or an extra fails loudly.
  .build/map/src/vic22/results-summary.html — the VEC's 2022 general-election
    results summary: one `<h2 class="grid-tile-title">X District</h2>` tile
    per district whose `Elected member:<br />NAME` span + following
    `<strong>Party</strong>` declare the winner. 87 districts (Narracan's
    tile waited on its supplementary poll).
  .build/map/src/vic22/narracan-supplementary.html — the Narracan May 2023
    supplementary election's own results page ("Elected member" block),
    covering the 88th district.

THE WINNER AUTHORITY. The `elected` flag and the seat tally cannot come
from the 2CP annex: the annex's pair figures are a vintage mosaic (see
THE TWO VEC VINTAGES). Usually the annex IS the seat's actual final TCP
at declaration vintage (Prahran's sits ~136–113 votes off the certified
distribution final — pre-certification, the same vintage class as the
XLS). But Pakenham's annex reads FARRELLY 19,558 over VULIN 19,468 —
the declaration-night figures before Vulin's recheck win (she is the
member; also why Pakenham's per-venue cells sit outside the XLS
generational drift pattern); and Shepparton's annex counts only a
notional HAMMER (LIB) v SHEED (IND) pair while the seat was won by
O'KEEFFE (NAT) in the full preference distribution's final exclusion
(23,455 v Sheed 17,846). So the annex pair's leader is NOT the elected
member in general. The frame's winner authority is the VEC's own
declaration — the results-summary tiles plus Narracan's supplementary
page (the demsausage roll analogue: authoritative, machine-pinned
grammar, asserted in load_roster). The TCP LANES ride the annex as
published (the annex is the VEC's only per-venue 2CP product) — except
THE CERTIFIED-FINAL OVERRIDE: Pakenham's and Shepparton's district tcp
lanes carry the certified distribution-of-preferences final exclusion
from the committed certified/<slug>.html pages instead, because the
annex's figures there contradict the commission's own declaration
(Pakenham 19,587 VULIN v 19,280 FARRELLY, not the annex's
declaration-night 19,468 v 19,558; Shepparton 23,455 O'KEEFFE v
17,846 SHEED — a PAIR CHANGE from the annex's notional HAMMER v
SHEED), and the seat cards everywhere read member and margin straight
off the district tcp lane. Their per-booth tcp lanes stay the annex's
(the recheck plain tally has no venue rerun); the other 86 districts
stay the annex's too, drift pinned exactly by BOOTH_TCP_DRIFT. A
build-time guard then fails if any district's tcp-lane top figure is
not the roster-declared member. The tally is pinned at EXPECTED_SEATS
= {ALP 56, LIB 19 (18
general + Narracan), NAT 9, GRN 4}, the VEC's official 88-district
count. load_roster also fails loudly if a roster winner's party is not
in ROSTER_PARTY (e.g. a future independent winner) — that is a schema
decision, never a silent pass-through.

The frame's res file rides the nsw23 shape exactly ({year, date, prev,
jurisdiction, demoBasis, agg{AUS,VIC{...}}, divs[], booths{}}; candidate
rows [n, ab, pn, bucket, votes, swing, elected, x]; booth lanes d,id,n,ty,
prem,sub,pc,lat,lon,v,inf,tpp,tcp,fl,dec,vdec with every fixed centre
ty=1 — the VEC XLS prints only election-day venues (Early Vote is one
aggregated declaration pile, so there are no EVC lanes); tpp only on
classic ALP-v-LNP final pairs, sums written; fl empty — no flow source is
wired for Vic 2022).

The census people lane rides data/vic22-demo.json and the SEIFA lane
data/vic22-seifa.json (.build/map/build_vic22_demo.py /
build_vic22_seifa.py, on the frame's own boundary geojson in
.build/map/src/vic22/n-vic22.geojson), spliced exactly as sa26 does.
Booth census lanes (dec/demo) are the booth-census splice's job
(build_vic22_boothcensus.py), run after this build — this script writes
null dec/vdec lanes and no demo lane, exactly as the SA/NSW builders do.

usage: python3 .build/map/build_vic22_data.py <out_dir>   # no -I: xlrd rides the env's site-packages
then:  python3 .build/map/build_vic22_boothcensus.py
then:  python3 .build/map/build_vic22_past.py <out_dir>
then:  node .build/map/geo_build.mjs .build/map/src/vic22 <out_dir> map/data --years=vic22
"""
import collections
import html as H
import json
import os
import re
import sys
import warnings

import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from vic22_geo import EXPECTED_NAMES  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, ".build", "map", "src", "vic22")
XLS_DIR = os.path.join(SRC, "xls")
ANNEX_DIR = os.path.join(SRC, "2cp")
CERT_DIR = os.path.join(SRC, "certified")
DS_STORE = os.path.join(SRC, "demsausage", "vic-2022.json")
DEMO_STORE = os.path.join(REPO, "data", "vic22-demo.json")
SEIFA_STORE = os.path.join(REPO, "data", "vic22-seifa.json")
SUMMARY_PAGE = os.path.join(SRC, "results-summary.html")
NARR_SUPP_PAGE = os.path.join(SRC, "narracan-supplementary.html")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

ELECTION = "2022-11-26"
# the VEC's declared 2022 tally: 87 general-election districts from the
# results-summary tiles plus Narracan's supplementary win (see THE WINNER
# AUTHORITY). COUNTED FROM THE ROSTER in load_roster and cross-checked at
# the end of main().
EXPECTED_SEATS = {"ALP": 56, "GRN": 4, "LIB": 19, "NAT": 9}
# certified distribution-of-preferences finals, pinned (THE
# CERTIFIED-FINAL OVERRIDE): slug -> (winner, winner votes, runner-up,
# runner-up votes). parse_certified parses the committed certified/
# pages and asserts they say exactly this — a page move, a hand edit
# or a source drift all fail loudly.
CERTIFIED_FINAL = {"pakenham": ("Emma Vulin", 19587, "David Farrelly", 19280),
                   "shepparton": ("Kim O'Keeffe", 23455, "Suzanna Sheed", 17846)}
# the results-summary tile's <strong> party strings -> frame abbrs.
# Narracan's supplementary page says "Liberal". Anything else (an
# independent, a new party) fails loudly — a schema decision, not a guess.
ROSTER_PARTY = {
    "Australian Labor Party - Victorian Branch": "ALP",
    "Liberal": "LIB",
    "The Nationals": "NAT",
    "Australian Greens": "GRN",
}
JUR = "VIC"
N_DISTRICTS = 88

# Annex(later vintage)-vs-XLS(declaration snapshot) divergences, generated
# verbatim from the source pair 2026-10-27 (see the docstring's "TWO VEC
# VINTAGES" block). "sums": [annex pair-votes+mis-sorts − XLS formal,
# annex informal − XLS informal, annex total − XLS total], all ascribed to
# the declaration rows (per-booth cells agree); "ven": pinned venue-cell
# glitches [dInf, dTot, dTcp] where dTcp = annex venue pair+mis-sorts −
# XLS venue formal. Asserted EXACT in parse_annex — a divergence not
# listed here, or a listed one that no longer holds, fails the build.
BOOTH_TCP_DRIFT = {
    "bass": {"sums": [1, -1, 0]},
    "bellarine": {"sums": [-3, 0, -3]},
    "box-hill": {"sums": [-63, 0, -63]},
    "bulleen": {"sums": [-163, -11, -174]},
    "eltham": {"sums": [-3, 0, -3]},
    "eureka": {"sums": [-3, 0, -3]},
    "evelyn": {"sums": [-1, 1, 0]},
    "geelong": {"sums": [6, -6, 0]},
    "gippsland-east": {"ven": {"Johnsonville": [1, 0, -1]}, "sums": [-1, 1, 0]},
    "greenvale": {"sums": [1, 0, 1]},
    "ivanhoe": {"sums": [-4, 0, -4]},
    "lara": {"sums": [-6, -1, -7]},
    "melbourne": {"sums": [-42, 0, -42]},
    "monbulk": {"sums": [-26, -4, -30]},
    "murray-plains": {"sums": [1553, 122, 1675]},
    "nepean": {"sums": [-110, -14, -124]},
    "niddrie": {"sums": [-144, -10, -154]},
    "oakleigh": {"ven": {"Oakleigh North": [-3, -1, 2]}, "sums": [2, -3, -1]},
    "ovens-valley": {"sums": [-285, -11, -296]},
    "richmond": {"ven": {"Richmond": [-1, 0, 1]}, "sums": [1, -1, 0]},
    "ringwood": {"sums": [-205, -7, -212]},
    "ripon": {"ven": {"Elmhurst": [0, -1, -1]}, "sums": [-2, 0, -2]},
    "shepparton": {"sums": [-4, 0, -4]},
    "st-albans": {"ven": {"Cairnlea": [-4, -4, 0]}, "sums": [0, -4, -4]},
    "sydenham": {"sums": [-1, 0, -1]},
    "warrandyte": {"sums": [-1, 0, -1]},
}

# The demsausage roll is the NOV 2022 general-election venue roll; Narracan's
# poll was the May 2023 SUPPLEMENTARY election, which ran on 26 of the 36
# rolled venues. These ten roll venues took no votes there (the VEC's
# supplementary venue list kept them shut); they are exempt from the
# every-roll-venue-claimed check, pinned exact.
NARRACAN_UNRUN = frozenset({
    "Bona Vista", "Cora Lynn", "Lillico", "Nar Nar Goon North", "Narracan",
    "Noojee", "Rawson", "Rokeby", "Tanjil South", "Tetoora Road",
})

COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]

# the VEC's own party strings onto canon ids (the XLS candidate header
# cells' party lines; the empty string is an independent). A "(canon-id,
# canon-name)" value folds an odd one-off printing onto the canon's.
PARTY = {
    "Australian Labor Party - Victorian Branch": ("ALP", None),
    "Liberal": ("LIB", None),
    "The Nationals": ("NAT", None),
    "Australian Greens": ("GRN", None),
    "The Greens": ("GRN", "Australian Greens"),
    "Pauline Hanson's One Nation": ("ONP", None),
    "Family First Victoria": ("FFP", None),
    "Animal Justice Party": ("AJP", None),
    "Freedom Party of Victoria": ("FPV", None),
    "Freedom Party": ("FPV", "Freedom Party of Victoria"),
    "Labour DLP": ("DLP", None),
    "Victorian Socialists": ("VS", None),
    "Liberal Democrats": ("LDP", None),
    "Libertarian": ("LBT", None),
    "Derryn Hinch's Justice Party": ("DHJP", None),
    "New Democrats": ("NND", None),
    "Companions and Pets Party": ("CPP", None),
    "Fiona Patten's Reason Party": ("REAS", None),
    "Shooters, Fishers & Farmers Vic": ("SFF", None),
    "Legalise Cannabis Victoria": ("LCP", None),
    "Legalise Cannabis": ("LCP", "Legalise Cannabis"),
    "Angry Victorians Party": ("AVP", None),
    "Health Australia Party": ("HAP", None),
    "Transport Matters": ("TMP", None),
    "Affordable Housing Now – Sustainable Australia Party": ("AHN", None),
    "End Mass Immigration – Reform AU": ("EMI", None),
    "": ("IND", None),
}
PARTY_NAME_CANON = {"IND": "Independent"}


def fail(msg):
    raise SystemExit(f"vic22: {msg}")


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP":
        return "alp"
    if ab in COALITION:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "ONP"):
        return "onp"
    if ab in ("IND", ""):
        return "ind"
    return "oth"


def title_name(given, surname):
    s = surname or ""
    out = []
    for w in s.split(" "):
        if w.isupper() and len(w) > 1:
            t = w.capitalize()
            for pre in ("Mc", "O'", "D'"):
                if t.startswith(pre) and len(t) > len(pre):
                    t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
            if "-" in t:
                t = "-".join(p[:1].upper() + p[1:] for p in t.split("-"))
            out.append(t)
        else:
            out.append(w)
    return ((given or "").strip() + " " + " ".join(out)).strip()


def flat_name(n):
    """VEC cells run "SURNAME, Given"; the map's files ride "Given SURNAME"."""
    n = (n or "").strip()
    if "," in n:
        sur, giv = n.split(",", 1)
        return title_name(giv.strip(), sur.strip())
    return title_name("", n)


def numcell(sheet, r, c, ctx):
    v = sheet.cell_value(r, c)
    if isinstance(v, float) and v.is_integer():
        return int(v)
    fail(f"{ctx}: cell r{r}c{c} not a whole number ({v!r})")


# -------------------------------------- the VEC's elected-member declaration
def load_roster():
    """{district name: (elected flat name, frame party abbr)} off the two
    committed results pages (see THE WINNER AUTHORITY). Grammar pinned; the
    district set must equal the 88-district roster and the party strings
    must all sit in ROSTER_PARTY."""
    page = open(SUMMARY_PAGE, encoding="utf-8").read()
    tiles = re.findall(
        r'<h2 class="grid-tile-title">\s*([\s\S]{1,80}?)\s*</h2>\s*'
        r'<p class="grid-tile-text">\s*'
        r'<span>Elected member:<br\s*/>\s*([\s\S]{1,80}?)\s*</span>\s*'
        r'<strong>\s*([^<]+?)\s*</strong>',
        page)
    roster = {}
    for district, elected, party in tiles:
        m = re.fullmatch(r"(.+?) District", H.unescape(district).strip())
        if not m:
            fail(f"results-summary: odd tile title {district!r}")
        dn = m.group(1)
        if dn in roster:
            fail(f"results-summary: {dn} listed twice")
        ab = ROSTER_PARTY.get(party.strip())
        if ab is None:
            fail(f"results-summary {dn}: unmapped winner party {party!r}")
        roster[dn] = (flat_name(H.unescape(elected)), ab)
    supp = open(NARR_SUPP_PAGE, encoding="utf-8").read()
    m = re.search(r"<h3>Elected member</h3>\s*<p>\s*<b>([^<]+)</b>"
                  r"\s*<br\s*/?>\s*<em>([^<]*)</em>", supp)
    if not m:
        fail("narracan supplementary page: elected-member block drifted")
    ab = ROSTER_PARTY.get(m.group(2).strip())
    if ab is None:
        fail(f"narracan supplementary: unmapped winner party {m.group(2)!r}")
    roster["Narracan"] = (flat_name(H.unescape(m.group(1))), ab)
    got = set(roster)
    if got != set(EXPECTED_NAMES):
        fail(f"results-summary roster drift: page-only "
             f"{sorted(got - set(EXPECTED_NAMES))[:4]}, roster-only "
             f"{sorted(set(EXPECTED_NAMES) - got)[:4]}")
    return roster


# ------------------------------------------------------------------ XLS parse
def parse_district(path):
    """The whole workbook's grammar pinned and reconciled; returns None-proof
    records only after every internal equality holds."""
    ctx = os.path.basename(path)
    wb = xlrd.open_workbook(path)
    if wb.sheet_names() != ["Results-ElectorateResultsVoting"]:
        fail(f"{ctx}: sheets {wb.sheet_names()}")
    s = wb.sheet_by_index(0)
    hdr = str(s.cell_value(3, 0))
    m = re.fullmatch(r"(.+?) District \(Primary\)", hdr)
    if not m:
        fail(f"{ctx}: district header line drifted ({hdr!r})")
    name = m.group(1).strip()
    enrolled = numcell(s, 5, 2, ctx)
    formal = numcell(s, 6, 2, ctx)
    informal = numcell(s, 7, 2, ctx)
    total = numcell(s, 8, 2, ctx)
    if formal + informal != total:
        fail(f"{ctx}: formal+informal != total")

    # candidate header: the ONE row carrying both printed sentinels
    hr = None
    for r in range(9, min(20, s.nrows)):
        cells = [str(s.cell_value(r, c)) for c in range(s.ncols)]
        if "Informal Votes\n" in cells and "Total Votes\nPolled" in cells:
            if hr is not None:
                fail(f"{ctx}: two candidate header rows ({hr}, {r})")
            hr = r
    if hr is None:
        fail(f"{ctx}: no candidate header row")
    cells = [str(s.cell_value(hr, c)) for c in range(s.ncols)]
    inf_col = cells.index("Informal Votes\n")
    tot_col = cells.index("Total Votes\nPolled")
    if inf_col != tot_col - 1:
        fail(f"{ctx}: informal/total header columns drift ({inf_col}, {tot_col})")
    cand_cols, cands = [], []
    for c in range(2, s.ncols):
        cell = cells[c]
        if not cell or cell in ("Informal Votes\n", "Total Votes\nPolled"):
            continue
        nm, _, party = cell.partition("\n")
        party = party.strip()
        if party not in PARTY:
            fail(f"{ctx}: unmapped party {party!r} (candidate {nm!r})")
        ab, alias = PARTY[party]
        cand_cols.append(c)
        cands.append({"n": flat_name(nm), "ab": ab,
                      "pn": alias or party or PARTY_NAME_CANON[ab]})
    if len(cands) < 2:
        fail(f"{ctx}: {len(cands)} candidates")

    # body: venue rows, declaration rows, subtotals, the grand total, the
    # printed percentages
    venues, decl = [], []
    ordinary = decl_tot = grand = pct_row = None
    for r in range(hr + 1, s.nrows):
        lab0, lab = str(s.cell_value(r, 0)).strip(), str(s.cell_value(r, 1)).strip()
        if lab0:
            fail(f"{ctx} r{r}: label in col0 ({lab0!r})")
        if not lab:
            continue
        if lab == "Total Ordinary Votes":
            ordinary = r
        elif lab == "Total Declaration Votes":
            decl_tot = r
        elif lab == "TOTAL ALL VOTE TYPES":
            grand = r
        elif lab.startswith("Percentage of Formal Vote"):
            pct_row = r
        elif ordinary is None:
            vals = [numcell(s, r, c, ctx) for c in cand_cols]
            inf = numcell(s, r, inf_col, ctx)
            tot = numcell(s, r, tot_col, ctx)
            if sum(vals) + inf != tot:
                fail(f"{ctx} venue {lab!r}: {sum(vals) + inf} != polled {tot}")
            venues.append({"n": lab, "v": vals, "inf": inf, "tot": tot})
        elif decl_tot is None:
            vals = [numcell(s, r, c, ctx) for c in cand_cols]
            inf = numcell(s, r, inf_col, ctx)
            tot = numcell(s, r, tot_col, ctx)
            if sum(vals) + inf != tot:
                fail(f"{ctx} decl {lab!r}: {sum(vals) + inf} != polled {tot}")
            decl.append({"n": lab, "v": vals, "inf": inf, "tot": tot})
        else:
            fail(f"{ctx} r{r}: row after the subtotals ({lab!r})")
    if ordinary is None or decl_tot is None or grand is None or pct_row is None:
        fail(f"{ctx}: subtotal/total row missing")
    if not venues or not decl:
        fail(f"{ctx}: venue {len(venues)} / declaration {len(decl)} rows empty")

    for tag, rows, sub_r in (("ordinary", venues, ordinary), ("declaration", decl, decl_tot)):
        for i, c in enumerate(cand_cols):
            if sum(x["v"][i] for x in rows) != numcell(s, sub_r, c, ctx):
                fail(f"{ctx}: {tag} subtotal != summed rows ({cands[i]['n']})")
        if sum(x["inf"] for x in rows) != numcell(s, sub_r, inf_col, ctx):
            fail(f"{ctx}: {tag} informal subtotal drift")
        if sum(x["tot"] for x in rows) != numcell(s, sub_r, tot_col, ctx):
            fail(f"{ctx}: {tag} total subtotal drift")

    formal_of = {}
    for i, c in enumerate(cand_cols):
        v = numcell(s, grand, c, ctx)
        have = sum(x["v"][i] for x in venues) + sum(x["v"][i] for x in decl)
        if v != have:
            fail(f"{ctx}: grand {v} != ordinary+declaration {have} ({cands[i]['n']})")
        formal_of[cands[i]["n"]] = v
    if sum(formal_of.values()) != formal:
        fail(f"{ctx}: grand candidate sums != FORMAL {formal}")
    if numcell(s, grand, inf_col, ctx) != informal:
        fail(f"{ctx}: grand informal != INFORMAL {informal}")
    if numcell(s, grand, tot_col, ctx) != total:
        fail(f"{ctx}: grand total != TOTAL {total}")
    for i, c in enumerate(cand_cols):
        pc = str(s.cell_value(pct_row, c)).strip().strip("%").strip()
        if not pc:
            continue
        try:
            pv = float(pc)
        except ValueError:
            fail(f"{ctx}: pct cell {pc!r} does not parse")
        mine = 100 * formal_of[cands[i]["n"]] / formal
        if abs(mine - pv) > 0.006:
            fail(f"{ctx}: printed pct {pv} vs computed {mine:.4f} ({cands[i]['n']})")
    return {"name": name, "enrolled": enrolled, "formal": formal,
            "informal": informal, "total": total,
            "cands": cands, "formalOf": formal_of, "venues": venues}


# ------------------------------------------------------------------ annex parse
def txt(c):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", "", c))).strip()


def parse_annex(path, name, xls, drift):
    ctx = f"annex {name}"
    page = open(path, encoding="utf-8").read()
    tabs = re.findall(r"<table[^>]*>.*?</table>", page, re.S | re.I)
    if len(tabs) != 1:
        fail(f"{ctx}: {len(tabs)} tables")
    rows = []
    for tr in re.findall(r"<tr.*?</tr>", tabs[0], re.S | re.I):
        rows.append([txt(cell) for cell in
                     re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)])
    if len(rows) < 6:
        fail(f"{ctx}: {len(rows)} rows")
    pair = [flat_name(rows[0][1]), flat_name(rows[0][2])]
    if not pair[0] or not pair[1] or pair[0] == pair[1]:
        fail(f"{ctx}: pair cells {rows[0]!r}")
    if rows[1][0] != "Voting centres":
        fail(f"{ctx}: second header row drift ({rows[1]!r})")

    idx = 2
    per_venue = {}
    while idx < len(rows) and rows[idx][0] != "Ordinary votes total":
        r = rows[idx]
        vn = r[0]
        if not vn:
            fail(f"{ctx} row {idx}: blank venue")
        if vn in per_venue:
            fail(f"{ctx}: venue {vn!r} twice")
        try:
            a, b, ms, inf, tot = (int(r[c]) for c in range(1, 6))
        except (ValueError, IndexError):
            fail(f"{ctx} row {idx}: cells not the six-column form ({r!r})")
        if a + b + ms + inf != tot:
            fail(f"{ctx} venue {vn!r}: {a}+{b}+{ms}+{inf} != {tot}")
        per_venue[vn] = (a, b, ms, inf, tot)
        idx += 1
    if idx >= len(rows):
        fail(f"{ctx}: no Ordinary-votes subtotal row")
    sub = [int(x) for x in rows[idx][1:6]]
    if sub != [sum(x[i] for x in per_venue.values()) for i in range(5)]:
        fail(f"{ctx}: ordinary subtotal != venue sums")

    idx += 1
    decl_rows = []
    tot = None
    while idx < len(rows):
        r = rows[idx]
        lab = r[0]
        idx += 1
        if not lab:
            continue
        if lab.startswith("Percentage"):
            break
        if lab == "Total":
            tot = [int(x) for x in r[1:6]]
            break
        if not lab.endswith("votes"):
            fail(f"{ctx}: odd declaration row {lab!r}")
        decl_rows.append([int(x) for x in r[1:6]])
    if tot is None:
        fail(f"{ctx}: no closing Total row")
    if not decl_rows:
        fail(f"{ctx}: no declaration rows")
    for i in range(5):
        if sub[i] + sum(d[i] for d in decl_rows) != tot[i]:
            fail(f"{ctx}: Total row cell {i} != ordinary subtotal + declarations")
    a, b, ms, inf, tot_votes = tot

    # against the XLS: identical venue sets; per-venue informal/total and
    # pair+mis-sorts-vs-formal deltas pinned by BOOTH_TCP_DRIFT; district
    # sums pinned by the same entry. Drift is asserted EXACTLY, both ways
    # (an unlisted difference fails; a listed one that has moved fails).
    drift = drift or {}
    ven_drift = drift.get("ven", {})
    x_by_name = {v["n"]: v for v in xls["venues"]}
    if set(per_venue) != set(x_by_name):
        fail(f"{ctx}: venue sets differ (annex-only "
             f"{sorted(set(per_venue) - set(x_by_name))[:3]}, xls-only "
             f"{sorted(set(x_by_name) - set(per_venue))[:3]})")
    got_ven = {}
    tcp_drift = {}
    for vn, (a_v, b_v, ms_v, inf_v, tot_v) in per_venue.items():
        xv = x_by_name[vn]
        d = [inf_v - xv["inf"], tot_v - xv["tot"],
             (a_v + b_v + ms_v) - sum(xv["v"])]
        if d != [0, 0, 0]:
            got_ven[vn] = d
        if d[2]:
            tcp_drift[vn] = d[2]
    if got_ven != {k: list(v) for k, v in ven_drift.items()}:
        fail(f"{ctx}: venue drift {got_ven} != pinned {ven_drift}")
    want_sums = drift.get("sums", [0, 0, 0])
    got_sums = [a + b + ms - xls["formal"], inf - xls["informal"],
                tot_votes - xls["total"]]
    if got_sums != want_sums:
        fail(f"{ctx}: district drift {got_sums} != pinned {want_sums}")
    if drift.keys() - {"ven", "sums"}:
        fail(f"{ctx}: unknown drift keys {sorted(drift)}")
    return {"pair": pair, "pairVotes": (a, b, ms), "venues": per_venue,
            "tcpDrift": tcp_drift}


# ------------------------------------------------------------ certified page
def parse_certified(path, name, cn, pinned):
    """A distribution-of-preferences page (certified/<slug>.html): its
    'Elected member' block joins the first-pref roster, its sole FINAL
    TOTAL row names exactly the final two candidates with their certified
    votes and their sum as the TOTAL cell, and the count's top figure IS
    the declared member — then the whole record must equal the pinned
    figures (a source move or a hand edit both fail loudly)."""
    ctx = f"certified {name}"
    page = open(path, encoding="utf-8").read()
    m = re.search(r"<h3>\s*Elected member\s*</h3>\s*<p>\s*<b>(.*?)</b>",
                  page, re.S | re.I)
    if not m:
        fail(f"{ctx}: no Elected-member block")
    elected = flat_name(txt(m.group(1)))
    if elected not in cn:
        fail(f"{ctx}: declared member {elected!r} not on the ballot")
    tabs = re.findall(r"<table[^>]*>.*?</table>", page, re.S | re.I)
    finals = []
    for t in tabs:
        trs = re.findall(r"<tr.*?</tr>", t, re.S | re.I)
        if not trs:
            continue
        hdr = [txt(c) for c in re.findall(r"<th[^>]*>.*?</th[^>]*>", trs[0], re.S | re.I)]
        last = [txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", trs[-1], re.S | re.I)]
        if last and last[0] == "FINAL TOTAL":
            finals.append((hdr, last))
    if len(finals) != 1:
        fail(f"{ctx}: {len(finals)} FINAL TOTAL rows, expected 1")
    hdr, row = finals[0]
    if len(row) != len(hdr):
        fail(f"{ctx}: FINAL TOTAL row {len(row)} cells vs header {len(hdr)}")
    pair, tot = [], None
    for h, v in zip(hdr, row):
        if not h:
            continue
        if h == "TOTAL":
            tot = int(v)
        elif v:
            pair.append((flat_name(h), int(v)))
    if tot is None or len(pair) != 2:
        fail(f"{ctx}: final row {row!r} not a two-candidate count with TOTAL")
    pair.sort(key=lambda x: -x[1])
    (w, wv), (r, rv) = pair
    if wv + rv != tot:
        fail(f"{ctx}: {wv}+{rv} != TOTAL {tot}")
    if w != elected:
        fail(f"{ctx}: count winner {w!r} != declared member {elected!r}")
    if r not in cn:
        fail(f"{ctx}: final-two {r!r} not on the ballot")
    got = (w, wv, r, rv)
    if got != pinned:
        fail(f"{ctx}: certified final {got} != pinned {pinned}")
    return {"pair": (w, r), "votes": (wv, rv)}


# ------------------------------------------------------------------ demsausage
ADDR_RE = re.compile(r"^(?P<street>.*),\s*(?P<sub>[A-Za-z][A-Za-z .'-]*)\s+(?P<pc>\d{4})$")


def load_roll():
    if not os.path.exists(DS_STORE):
        fail(f"demsausage roll {DS_STORE} missing — run .build/map/harvest-vic22-src.py")
    with open(DS_STORE) as f:
        places = json.load(f)
    if len(places) < 1500:
        fail(f"demsausage roll covers {len(places)} places, expected ~1,659")
    by_div = {}
    for p in places:
        if not p.get("premises"):
            fail(f"demsausage {p['id']}: no premises")
        g = p.get("geom") or {}
        if g.get("type") != "Point" or len(g.get("coordinates") or []) != 2:
            fail(f"demsausage {p['id']}: geom drift {g!r}")
        lon, lat = (round(float(x), 5) for x in g["coordinates"])
        if not (-40 < lat < -33.5 and 140 < lon < 150.5):
            fail(f"demsausage {p['id']}: coords {lat},{lon} outside Victoria")
        m = ADDR_RE.match(p["address"] or "")
        if not m:
            fail(f"demsausage {p['id']} {p['name']!r}: address {p['address']!r} "
                 f"outside the '<street>, <suburb> NNNN' form")
        p["_sub"], p["_pc"], p["_lat"], p["_lon"] = m.group("sub"), int(m.group("pc")), lat, lon
        for div in p["divisions"]:
            m2 = re.fullmatch(r"(.+?) District", div)
            if not m2:
                fail(f"demsausage {p['id']}: odd division {div!r}")
            by_div.setdefault(m2.group(1), {})[p["name"]] = p
    out = {}
    for div, names in by_div.items():
        if len(names) != len([p for p in places if div in [re.fullmatch(r"(.+?) District", d).group(1) for d in p["divisions"]]]):
            fail(f"{div}: demsausage venue names collide ({len(names)} unique)")
        out[div] = names
    if set(out) != set(EXPECTED_NAMES):
        fail(f"demsausage divisions drift: roll-only {sorted(set(out) - set(EXPECTED_NAMES))[:4]}, "
             f"roster-only {sorted(set(EXPECTED_NAMES) - set(out))[:4]}")
    return out


# ------------------------------------------------------------------ the stores
def load_store(path, key, want_basis):
    if not os.path.exists(path):
        fail(f"store {path} missing — run its builder first")
    with open(path) as f:
        d = json.load(f)
    if d.get("year") != "vic22":
        fail(f"store {os.path.basename(path)} is year {d.get('year')!r}")
    if want_basis and d.get("demoBasis") != "sa1":
        fail(f"store {os.path.basename(path)} basis not sa1")
    rows = d.get(key)
    if not isinstance(rows, dict) or set(rows) != set(EXPECTED_NAMES):
        fail(f"store {os.path.basename(path)} districts drift")
    return rows


# ------------------------------------------------------------------ the frame
def main():
    os.makedirs(OUT, exist_ok=True)
    roster = load_roster()
    roll = load_roll()
    demo = load_store(DEMO_STORE, "demo", True)
    seifa = load_store(SEIFA_STORE, "seifa", False)
    files = sorted(fn for fn in os.listdir(XLS_DIR) if fn.endswith(".xls"))
    if len(files) != N_DISTRICTS:
        fail(f"{len(files)} district XLS files, expected {N_DISTRICTS}")

    warnings.simplefilter("ignore")  # xlrd's benign sector-size note on the VEC blobs

    cert_files = {f[:-5] for f in os.listdir(CERT_DIR)
                  if f.endswith(".html")} if os.path.isdir(CERT_DIR) else set()
    if cert_files != set(CERTIFIED_FINAL):
        fail(f"certified pages {sorted(cert_files)} != pinned "
             f"CERTIFIED_FINAL {sorted(CERTIFIED_FINAL)}")

    D = []
    seats = collections.Counter()
    tot_prim = collections.Counter()
    tot_formal = tot_inf = tot_enrolled = 0
    tpp_tot = [0, 0]
    B = {k: [] for k in ("d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon",
                         "v", "inf", "tpp", "tcp", "fl", "dec", "vdec")}
    n_booths_tcp = 0
    n_cert = 0
    for di, slug in enumerate(files):
        xls = parse_district(os.path.join(XLS_DIR, slug))
        name = xls["name"]
        ann_path = os.path.join(ANNEX_DIR, slug[:-4] + ".html")
        if not os.path.exists(ann_path):
            fail(f"{name}: 2CP annex {ann_path} missing")
        ann = parse_annex(ann_path, name, xls, BOOTH_TCP_DRIFT.get(slug[:-4]))

        # the TCP pair rides the candidate roster
        cands = xls["cands"]
        cn = {c["n"]: i for i, c in enumerate(cands)}
        if len(cn) != len(cands):
            fail(f"{name}: candidate names collide")
        if ann["pair"][0] not in cn or ann["pair"][1] not in cn:
            fail(f"{name}: TCP pair {ann['pair']} not on the ballot")
        pA, pB, pMs = ann["pairVotes"]

        # candidate rows, votes descending; the winner rides the VEC's own
        # declaration (THE WINNER AUTHORITY — never the annex pair's leader)
        rows = [{**c, "v": xls["formalOf"][c["n"]]} for c in cands]
        rows.sort(key=lambda r: (-r["v"], r["n"]))
        win, win_ab = roster[name]
        wrec = next((r for r in rows if r["n"] == win), None)
        if wrec is None:
            fail(f"{name}: elected member {win!r} not on the ballot")
        if wrec["ab"] != win_ab:
            fail(f"{name}: elected member {win!r} is {wrec['ab']} on the "
                 f"ballot but {win_ab} in the results summary")
        rows_out = [[r["n"], r["ab"], r["pn"], bucket(r["ab"]), r["v"], 0,
                     1 if r["n"] == win else 0, 0] for r in rows]
        seats[win_ab] += 1

        # the district tcp lane: the annex's pair and figures, except the
        # CERTIFIED-FINAL OVERRIDE districts', which carry the certified
        # distribution final's pair and totals (per-booth lanes untouched)
        pair_names = ann["pair"]
        pair_votes = (pA, pB)
        if slug[:-4] in CERTIFIED_FINAL:
            cert = parse_certified(os.path.join(CERT_DIR, slug[:-4] + ".html"),
                                   name, set(cn), CERTIFIED_FINAL[slug[:-4]])
            pair_names = cert["pair"]
            pair_votes = cert["votes"]
            n_cert += 1
        tcpA = next(i for i, r in enumerate(rows) if r["n"] == pair_names[0])
        tcpB = next(i for i, r in enumerate(rows) if r["n"] == pair_names[1])
        tcp = [[tcpA, pair_votes[0]], [tcpB, pair_votes[1]]]
        pair_buckets = {bucket(r["ab"]) for r in rows if r["n"] in pair_names}
        # every lane's top figure must be the declared member — the seat
        # cards read their member and margin straight off this lane
        if rows[tcpA if pair_votes[0] >= pair_votes[1] else tcpB]["n"] != win:
            fail(f"{name}: tcp-lane top figure "
                 f"{rows[tcpA if pair_votes[0] < pair_votes[1] else tcpB]['n']!r} "
                 f"!= declared member {win!r}")

        tpp = None
        if pair_buckets == {"alp", "lnp"}:
            alp = next(r for r in rows if r["n"] in pair_names and bucket(r["ab"]) == "alp")
            lnp = next(r for r in rows if r["n"] in pair_names and bucket(r["ab"]) == "lnp")
            va = pair_votes[0] if alp["n"] == pair_names[0] else pair_votes[1]
            vb = pair_votes[0] if lnp["n"] == pair_names[0] else pair_votes[1]
            tpp = [va, vb, None]
            tpp_tot[0] += va
            tpp_tot[1] += vb

        # booths: XLS venue rows geocoded on the demsausage roll
        places = roll[name]
        used = set()
        for bk, v in enumerate(xls["venues"]):
            p = places.get(v["n"])
            if p is None:
                stray = sorted(set(places) - used)
                fail(f"{name}: XLS venue {v['n']!r} not in the demsausage roll (unclaimed: {stray[:5]})")
            if p["name"] in used:
                fail(f"{name}: demsausage venue {v['n']!r} joined twice")
            used.add(p["name"])
            av = ann["venues"][v["n"]]
            per_row = {}
            # venue votes keyed by candidate, re-ordered onto the sorted rows
            for i, c in enumerate(cands):
                per_row[c["n"]] = v["v"][i]
            pvotes = [per_row[r["n"]] for r in rows]
            tcp_b = [av[0], av[1]]
            want_tcp_d = ann["tcpDrift"].get(v["n"], 0)
            if sum(tcp_b) + av[2] - sum(v["v"]) != want_tcp_d:
                fail(f"{name} booth {v['n']!r}: 2CP+mis-sorts−XLS formal "
                     f"{sum(tcp_b) + av[2] - sum(v['v'])} != pinned {want_tcp_d}")
            n_booths_tcp += 1
            B["d"].append(di)
            B["id"].append(f"vic22-{di}-{bk}")
            B["n"].append(v["n"])
            B["ty"].append(1)
            B["prem"].append(p.get("premises"))
            B["sub"].append(p["_sub"])
            B["pc"].append(p["_pc"])
            B["lat"].append(p["_lat"])
            B["lon"].append(p["_lon"])
            B["v"].append(pvotes)
            B["inf"].append(v["inf"])
            B["tpp"].append(None)
            B["tcp"].append(tcp_b)
            B["fl"].append(None)
            B["dec"].append(None)
            B["vdec"].append(None)
        spare = set(places) - used
        allowed = NARRACAN_UNRUN if name == "Narracan" else frozenset()
        if spare != allowed:
            fail(f"{name}: demsausage/XLS venue gap {sorted(spare)[:6]} "
                 f"!= exempt {sorted(allowed)[:6]}")

        rec = {
            "id": di, "n": name, "st": JUR,
            "c": rows_out,
            "inf": xls["informal"],
            "tcp": tcp,
            "fl": [],
            "h": [],
            "enrolled": xls["enrolled"],
            "demo": demo[name],
            "seifa": seifa[name],
        }
        if tpp:
            rec["tpp"] = tpp
        D.append(rec)
        tot_formal += xls["formal"]
        tot_inf += xls["informal"]
        tot_enrolled += xls["enrolled"]
        for r in rows:
            tot_prim[bucket(r["ab"])] += r["v"]

    if set(EXPECTED_NAMES) != {d["n"] for d in D}:
        fail("XLS-district roster drifted from the pinned 88 (geometry + manifest stay the oracle)")
    D.sort(key=lambda r: r["id"])
    got_seats = dict(sorted(seats.items()))
    if got_seats != EXPECTED_SEATS:
        fail(f"seat counts {got_seats} != expected {EXPECTED_SEATS}")

    agg = {"prim": {k: tot_prim[k] for k in BUCKETS}, "formal": tot_formal, "inf": tot_inf,
           "tpp": [tpp_tot[0], tpp_tot[1], None], "seats": got_seats}
    out = {"year": "vic22", "date": ELECTION, "prev": None, "jurisdiction": JUR,
           "demoBasis": "sa1",
           "agg": {"AUS": agg, "VIC": dict(agg)}, "divs": D, "booths": B}
    p = os.path.join(OUT, "data-vic22.json")
    with open(p, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    tp = 100 * tpp_tot[0] / (tpp_tot[0] + tpp_tot[1]) if sum(tpp_tot) else 0
    print("vic22 districts", len(D), "| seats", got_seats,
          "| est. 2PP (classic finals, sums) ALP", round(tp, 2),
          "| informal", round(100 * tot_inf / (tot_inf + tot_formal), 2),
          "| enrolled", tot_enrolled, "| booths", len(B["id"]),
          f"(tcp on {n_booths_tcp})",
          f"| certified-final tcp on {n_cert}" if n_cert else "",
          "->", os.path.getsize(p), "bytes")


if __name__ == "__main__":
    main()
