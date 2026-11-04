"""The nsw15 and nsw19 frames' upper houses — map/data/senate-nsw15.json and
map/data/senate-nsw19.json, in the exact shape of map/data/senate-nsw23.json
(lc:true), to the discipline of .build/map/build_nsw23_past.py § 2.

NSW's Legislative Council is 42 members elected statewide, half (21) at each
state election to terms ending at the election eight years on:
- senate-nsw15 is the council at the 28 March 2015 election: the 2011 cohort
  (terms to the 2019 election) plus the 2015 cohort (terms to 2023),
  `later` 2023, gov "lnp" (the Baird Coalition government was returned);
- senate-nsw19 is the council at the 23 March 2019 election: the 2015
  cohort (terms to 2023) plus the 2019 cohort (terms to 2027),
  `later` 2027, gov "lnp" (the Berejiklian Coalition government).

Rosters: the elected cohorts are the NSWEC's own records — the 2015 and 2019
LC/state/candidates_elected pages (committed caches
.build/state-flow-src/nsw/<year>/lc-elected.html.gz) and, for 2011, the
NSWEC's printed r09 party/group result report (committed as
.build/nswec-lc-flow-src/published/sge2011-r09-party-group-result.html).
Per-member parties within the joint LIBERAL/NATIONALS ticket and every
vacancy fill are Parliament of NSW records (the members lists and the
council's casual-vacancy register), hand-entered here exactly as
build_nsw23_past.py hand-enters its 2019 cohort. Each cohort is recorded as
constituted at its frame's settling — every vacancy fill from the cohort's
election through the frame's own election and its settling joint sitting —
with parties as the member sat on the frame's polling day (the sa22 frame's
"Sarah Game" rule); a member who left their elected party before polling
day carries `electedAs` like the vic22 frame's Somyurek/Deeming rows.

The mid-term work, by cohort (all dates from Parliament of NSW records):

2011 cohort (elected 26 March 2011, terms to the 2019 election) —
- Tony Kelly (ALP) resigned 6 June 2011; Steve Whan appointed 20 June 2011;
  Whan resigned during the last parliament (February 2015, to run for the
  Assembly); Daniel Mookhey appointed to Whan's vacancy at the new
  parliament's joint sitting of 6 May 2015 — the 2015 twin of the 2019
  cohort's Latham->Mihailuk fill the nsw23 sheet records. Marked for Whan,
  whose resignation caused the vacancy; the elected page's top of the chain
  is Kelly (the cross-check substitutes him).
- Eric Roozendaal resigned 9 May 2013 (he had sat as an Independent since
  his November 2012 suspension from the ALP); Ernest Wong (ALP) appointed
  24 May 2013.
- Penny Sharpe resigned before polling day to contest the Assembly seat of
  Newtown, lost, and was re-appointed to her own vacancy at the same
  6 May 2015 sitting; marked a self-fill like the federal file's Jeannie
  Ferris (senate-1998.json).
- Mike Gallacher (LIB) withdrew from the parliamentary Liberal Party in May
  2014 and sat as an independent on polling day 2015: carried IND with
  electedAs LIB.
- The 21st elected member (2011 count) is "JOHNSTON Sarah" on the NSWEC
  page: The Nationals' Sarah Mitchell, elected under her then surname; the
  sheet rides "Sarah Mitchell" as the 2019/2023 NSW files do.
The cohort's 2017-era fills (Barham->Walker, Gallacher->Martin, Gay->Fang,
Pearce->Ward) belong to horizons beyond this frame, and the term expired at
the 2019 election, so — exactly as build_nsw23_past leaves the pre-2019
service of its 2019-elected members unrecorded — they appear on no sheet.

2015 cohort (elected 28 March 2015, terms to the 2023 election) —
- John Kaye (GRN) died 2 May 2016; Justin Field appointed 23 August 2016.
  Field resigned from The Greens on 3 April 2019 — AFTER 2019 polling day,
  so on the nsw19 sheet he still sits for The Greens (the sa22 "on election
  day" rule; a later relabel is the next frame's business).
- Sophie Cotsis (ALP) resigned 16 September 2016 to contest the Canterbury
  by-election; John Graham appointed 12 October 2016.
- Mehreen Faruqi (GRN) resigned 14 August 2018 to enter the federal Senate;
  Cate Faehrmann appointed 15 August 2018.
- Lynda Voltz (ALP) and Ben Franklin (NAT) resigned before polling day to
  run for the Assembly; at the new parliament's joint sitting of 8 May 2019
  Franklin (unsuccessful at Ballina) was re-appointed to his own vacancy
  and Rose Jackson was appointed to Voltz's.
Ajaka->Poulos (2021), Khan->Barrett (2022) and Harwin->Rath (2022) filled
this cohort after nsw19's frame date but before its term expired at the
2023 election; like the 2015 cohort itself they appear on no later sheet
(the same truncation the nsw23 file's own horizon shows).

2019 cohort (elected 23 March 2019, terms to 2027) — recorded as elected;
its 2019-23 fills (Blair->Farraway, Shoebridge->Higginson, Cusack->
MacDonald, Latham->Mihailuk, Maclaren-Jones->Farlow) belong to the nsw23
frame's horizon and live in senate-nsw23.json already. The roster below is
the same 21 names the nsw23 file carries for the cohort, without the fills.

Statewide LC votes (`votes`/`pvotes`) — the nsw23 file's convention, copied:
per-group first-preference lines of the NSWEC fp_summary caches
(.build/state-flow-src/nsw/<year>/lc-fp.html.gz), named groups keyed to the
senate-nsw23 party-code vocabulary, blank/unaffiliated group lines and the
ungrouped below-the-line remainder folded into `ind`. For 2011 there is no
fp_summary page: the per-letter ATL totals come from the committed
counts.json bank (.build/nswec-lc-flow-src/counts.json, reconciled to the
NSWEC's OFFICIAL tables) and the group identities and the full
(ATL+BTL) first-preference figure per group from the NSWEC's r02 report
(sge2011-r02-fp-by-group.pdf), parsed with pdftotext -layout. The script
reconciles, per group letter, r02's full figure against counts.json's ATL
figure groupFirst — the pairwise differences plus the UNGROUPED line must
sum exactly to counts.json's btl total — and asserts the r02 printed totals
(enrolment, quota, formal 4,076,024, informal 230,261, total 4,306,285).
The 2011 `ind` lump is then the two unaffiliated group lines (Hatton's
group C and Hanson's unnamed group J) plus the whole below-the-line
remainder, exactly the 2015/2019/2023 folding. Group-name spellings vary by
year ("LIBERAL/NATIONALS" 2011, "LIBERAL / NATIONALS" 2015, "LIBERAL / THE
NATIONALS" 2019); the LC_GROUP map takes every printed form onto the one
canon id.

usage: python3 -I .build/map/build_nsw_lc.py [map_data_dir]
"""
import collections
import gzip
import html
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
FLOW = os.path.join(REPO, ".build", "state-flow-src", "nsw")
LC_FLOW = os.path.join(REPO, ".build", "nswec-lc-flow-src")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

E15, E19 = "2015-03-28", "2019-03-23"

# the statewide LC totals the NSWEC's own pages print (the fp_summary
# totals block; pinned once, then every re-run must reproduce them, and
# papers == formal + informal is asserted below — mirrors REF_LC in
# build_nsw23_past.py, whose 2019 row this agrees with)
REF_LC = {
    "2015": {"formal": 4316498, "informal": 258368, "papers": 4574866},
    "2019": {"formal": 4451146, "informal": 301681, "papers": 4752827},
}
# the 2011 r02 report's printed totals (same pinning, off the committed PDF)
REF_LC_2011 = {"enrol": 4635810, "quota": 185274, "formal": 4076024,
               "informal": 230261, "papers": 4306285}

# cohort blocks by group-name line, from the elected-members records
EXPECTED_LC = {
    "2011": {"LIBERAL/NATIONALS": 11, "LABOR/COUNTRY LABOR": 5, "THE GREENS": 3,
             "CHRISTIAN DEMOCRATIC PARTY (FRED NILE GROUP)": 1,
             "SHOOTERS AND FISHERS": 1},
    "2015": {"LIBERAL / NATIONALS": 9, "LABOR / COUNTRY LABOR": 7, "THE GREENS": 2,
             "SHOOTERS AND FISHERS": 1,
             "CHRISTIAN DEMOCRATIC PARTY (FRED NILE GROUP)": 1,
             "ANIMAL JUSTICE PARTY": 1},
    "2019": {"LABOR / COUNTRY LABOR": 7, "LIBERAL / THE NATIONALS": 8, "THE GREENS": 2,
             "PAULINE HANSON'S ONE NATION": 2, "SHOOTERS, FISHERS AND FARMERS": 1,
             "ANIMAL JUSTICE PARTY": 1},
}

# group-name lines onto the canon ids — build_nsw23_past.py's LC_GROUP map
# mirrored (verbatim where the years overlap) plus the 2015 and 2011 lines;
# None folds the line into the `ind` lump with the blank/ungrouped remainder
LC_GROUP = {
    "LABOR": "ALP",
    "LABOR / COUNTRY LABOR": "ALP",
    "LABOR/COUNTRY LABOR": "ALP",
    "LIBERAL / THE NATIONALS": "LNP",
    "LIBERAL / NATIONALS": "LNP",
    "LIBERAL/NATIONALS": "LNP",
    "THE GREENS": "GRN",
    "ONE NATION": "ONP",
    "PAULINE HANSON'S ONE NATION": "ONP",
    "SHOOTERS, FISHERS AND FARMERS": "SFF",
    "SHOOTERS AND FISHERS": "SFF",   # the party's pre-2016 name
    "ANIMAL JUSTICE PARTY": "AJP",
    "LEGALISE CANNABIS PARTY": "LCP",
    "LIBERAL DEMOCRATS": "LDP",
    "SOCIALIST ALLIANCE": "SOA",
    "KEEP SYDNEY OPEN": "KSO",
    "CHRISTIAN DEMOCRATIC PARTY (FRED NILE GROUP)": "CDP",
    "AUSTRALIAN CONSERVATIVES (NSW)": "AC",
    "ADVANCE": "ADV",
    "FLUX": "FLUX",
    "VOLUNTARY EUTHANASIA PARTY": "VEP",
    "THE SMALL BUSINESS PARTY": "SBP",
    "PUBLIC EDUCATION PARTY": "PEP",
    "INFORMED MEDICAL OPTIONS PARTY (IMOP)": "IMO",
    "SUSTAINABLE AUSTRALIA": "SAP",
    "ELIZABETH FARRELLY INDEPENDENTS": None,   # an independents line, into ind
    # 2015's additional lines
    "NO LAND TAX": "NLT",
    "OUTDOOR RECREATION PARTY": "ORP",
    "AUSTRALIAN MOTORIST PARTY": "AMP",
    "BUILDING AUSTRALIA PARTY": "BAP",
    "NO PARKING METERS PARTY": "NPM",
    "THE FISHING PARTY": "TFP",
    "AUSTRALIAN DEMOCRATS": "DEM",
    "AUSTRALIAN CYCLISTS PARTY": "CYC",
    # 2011's additional lines (r02/r09 vocabulary)
    "SAVE OUR STATE": "SOS",
    "FAMILY FIRST": "FFP",
    "BUILDING AUSTRALIA": "BAP",
    "RESTORE THE WORKERS' RIGHTS PARTY": "RWR",
}
LC_PARTY_NAME = {"ALP": "Australian Labor Party", "LIB": "Liberal Party",
                 "NAT": "The Nationals", "GRN": "The Greens",
                 "ONP": "Pauline Hanson's One Nation", "AJP": "Animal Justice Party",
                 "LCP": "Legalise Cannabis", "LDP": "Liberal Democrats",
                 "CDP": "Christian Democratic Party", "IND": "Independent"}
# the Shooters' party was "Shooters, Fishers and Farmers" by 2019 but plain
# "Shooters and Fishers" at both nsw15 horizons — the sheet names it as it sat
LC_PARTY_NAME_BY_FRAME = {
    "nsw15": {**LC_PARTY_NAME, "SFF": "Shooters and Fishers"},
    "nsw19": {**LC_PARTY_NAME, "SFF": "Shooters, Fishers and Farmers"},
}

# the rosters — (name, party, casual_for, page_top, elected_as):
# casual_for marks a vacancy fill against the member whose place was taken
# (None for everyone elected to the cohort); page_top is the elected-page
# name the fill sits in for (only when that differs from casual_for, viz the
# Kelly->Whan->Mookhey chain); elected_as records a pre-polling-day party
# change. Sarah Mitchell rides under that name — see the docstring.
ROSTER_2011 = [
    ("Ernest Wong", "ALP", "Eric Roozendaal", None, None),
    ("Greg Donnelly", "ALP", None, None, None),
    ("Penny Sharpe", "ALP", "Penny Sharpe", None, None),
    ("Peter Primrose", "ALP", None, None, None),
    ("Daniel Mookhey", "ALP", "Steve Whan", "Tony Kelly", None),
    ("Greg Pearce", "LIB", None, None, None),
    ("David Clarke", "LIB", None, None, None),
    ("Scot MacDonald", "LIB", None, None, None),
    ("Catherine Cusack", "LIB", None, None, None),
    ("Natasha Maclaren-Jones", "LIB", None, None, None),
    ("Peter Phelps", "LIB", None, None, None),
    ("Duncan Gay", "NAT", None, None, None),
    ("Rick Colless", "NAT", None, None, None),
    ("Niall Blair", "NAT", None, None, None),
    ("Sarah Mitchell", "NAT", None, None, None),
    ("David Shoebridge", "GRN", None, None, None),
    ("Jan Barham", "GRN", None, None, None),
    ("Jeremy Buckingham", "GRN", None, None, None),
    ("Mike Gallacher", "IND", None, None, "LIB"),
    ("Paul Green", "CDP", None, None, None),
    ("Robert Brown", "SFF", None, None, None),
]
ROSTER_2015 = [  # the 2015 cohort as elected (the nsw15 frame's view)
    ("Sophie Cotsis", "ALP", None, None, None),
    ("Walt Secord", "ALP", None, None, None),
    ("Lynda Voltz", "ALP", None, None, None),
    ("Shaoquett Moselmane", "ALP", None, None, None),
    ("Mick Veitch", "ALP", None, None, None),
    ("Adam Searle", "ALP", None, None, None),
    ("Courtney Houssos", "ALP", None, None, None),
    ("John Ajaka", "LIB", None, None, None),
    ("Matthew Mason-Cox", "LIB", None, None, None),
    ("Don Harwin", "LIB", None, None, None),
    ("Louis Amato", "LIB", None, None, None),
    ("Shayne Mallard", "LIB", None, None, None),
    ("Scott Farlow", "LIB", None, None, None),
    ("Ben Franklin", "NAT", None, None, None),
    ("Bronnie Taylor", "NAT", None, None, None),
    ("Trevor Khan", "NAT", None, None, None),
    ("John Kaye", "GRN", None, None, None),
    ("Mehreen Faruqi", "GRN", None, None, None),
    ("Robert Borsak", "SFF", None, None, None),
    ("Fred Nile", "CDP", None, None, None),
    ("Mark Pearson", "AJP", None, None, None),
]
ROSTER_2015_AT_19 = [  # the 2015 cohort at the 2019 frame's settling
    ("John Graham", "ALP", "Sophie Cotsis", None, None),
    ("Walt Secord", "ALP", None, None, None),
    ("Rose Jackson", "ALP", "Lynda Voltz", None, None),
    ("Shaoquett Moselmane", "ALP", None, None, None),
    ("Mick Veitch", "ALP", None, None, None),
    ("Adam Searle", "ALP", None, None, None),
    ("Courtney Houssos", "ALP", None, None, None),
    ("John Ajaka", "LIB", None, None, None),
    ("Matthew Mason-Cox", "LIB", None, None, None),
    ("Don Harwin", "LIB", None, None, None),
    ("Louis Amato", "LIB", None, None, None),
    ("Shayne Mallard", "LIB", None, None, None),
    ("Scott Farlow", "LIB", None, None, None),
    ("Ben Franklin", "NAT", "Ben Franklin", None, None),
    ("Bronnie Taylor", "NAT", None, None, None),
    ("Trevor Khan", "NAT", None, None, None),
    ("Justin Field", "GRN", "John Kaye", None, None),
    ("Cate Faehrmann", "GRN", "Mehreen Faruqi", None, None),
    ("Robert Borsak", "SFF", None, None, None),
    ("Fred Nile", "CDP", None, None, None),
    ("Mark Pearson", "AJP", None, None, None),
]
ROSTER_2019 = [  # the 2019 cohort as elected (senate-nsw23's, fills stripped)
    ("Tara Moriarty", "ALP", None, None, None),
    ("Penny Sharpe", "ALP", None, None, None),
    ("Greg Donnelly", "ALP", None, None, None),
    ("Anthony D'Adam", "ALP", None, None, None),
    ("Daniel Mookhey", "ALP", None, None, None),
    ("Peter Primrose", "ALP", None, None, None),
    ("Mark Buttigieg", "ALP", None, None, None),
    ("Catherine Cusack", "LIB", None, None, None),
    ("Damien Tudehope", "LIB", None, None, None),
    ("Taylor Martin", "LIB", None, None, None),
    ("Natalie Ward", "LIB", None, None, None),
    ("Natasha Maclaren-Jones", "LIB", None, None, None),
    ("Niall Blair", "NAT", None, None, None),
    ("Sarah Mitchell", "NAT", None, None, None),
    ("Wes Fang", "NAT", None, None, None),
    ("David Shoebridge", "GRN", None, None, None),
    ("Abigail Boyd", "GRN", None, None, None),
    ("Mark Latham", "ONP", None, None, None),
    ("Rod Roberts", "ONP", None, None, None),
    ("Emma Hurst", "AJP", None, None, None),
    ("Mark Banasiak", "SFF", None, None, None),
]
# Sarah Mitchell was elected in 2011 as "Sarah Johnston" (the r09 page's
# line); the alias joins the elected-page sets to the rosters
ALIAS_2011 = {"Sarah Johnston": "Sarah Mitchell"}


def fail(msg):
    raise SystemExit(f"nsw-lc: {msg}")


def read_page(year, slug, kind):
    p = os.path.join(FLOW, year, f"{slug}-{kind}.html.gz")
    if not os.path.exists(p):
        fail(f"cache miss {p} — the {kind} pages are the committed record")
    with gzip.open(p, "rt", encoding="utf-8", errors="replace") as f:
        return f.read()


def txt(c):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c))).strip()


def fix_word(w):
    """The NSWEC record's name casing, build_nsw23_data.fix_word mirrored
    (self-contained sibling, byte-identical behaviour)."""
    if w.isupper() and len(w) > 1:
        t = w.capitalize()
        for pre in ("Mc", "O'", "D'"):
            if t.startswith(pre) and len(t) > len(pre):
                t = pre + t[len(pre)].upper() + t[len(pre) + 1:]
        return t
    m = re.fullmatch(r"(Mc|Mac)([A-Z]{2,})", w)
    if m:
        return m.group(1) + m.group(2).capitalize()
    return w


def flat_name(n):
    """NSWEC rows run "SURNAME Given"; the map's files ride "Given SURNAME"
    (build_nsw23_data.flat_name mirrored)."""
    n = (n or "").strip()
    if not n:
        return n
    parts = n.split(" ")
    lead = 0
    for i, w in enumerate(parts):
        if w.isupper() or re.fullmatch(r"(Mc|Mac)[A-Z]{2,}(?:-[A-Z]+)*", w):
            lead = i + 1
        else:
            break
    if not lead or lead == len(parts):
        return " ".join(fix_word(p) for p in parts)
    sur = " ".join("-".join(fix_word(p) if p else p for p in w.split("-"))
                   for w in parts[:lead])
    return (" ".join(parts[lead:]) + " " + sur).strip()


def counts():
    """The committed first-preference bank (.build/nswec-lc-flow-src/
    counts.json): per-year group-letter ATL first preferences reconciled to
    the NSWEC's OFFICIAL tables, with formal/atl/btl splits."""
    with open(os.path.join(LC_FLOW, "counts.json")) as f:
        return json.load(f)["events"]


# ------------------------------------------------------------------ the LC vote pages
def lc_votes(year, ev):
    """The fp_summary page's party-group lines -> canon votes, keyed by
    group letter so the bank's groupFirst pins ride along (blank and
    unaffiliated lines fold into ind with the ungrouped remainder — the
    nsw23 convention)."""
    page = read_page(year, "lc", "fp")
    flat = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page))
    tot = re.search(r"Formal Votes\s*([\d,]+)[^0-9]*100\.00%[^0-9]*Informal\s*([\d,]+)"
                    r"[^0-9]*Total Votes / Ballot Papers\s*([\d,]+)", flat)
    if not tot:
        fail(f"{year} LC: totals block drifted")
    got = {"formal": int(tot.group(1).replace(",", "")),
           "informal": int(tot.group(2).replace(",", "")),
           "papers": int(tot.group(3).replace(",", ""))}
    if got != REF_LC[year]:
        fail(f"{year} LC totals {got} != reference {REF_LC[year]}")
    if got["formal"] + got["informal"] != got["papers"]:
        fail(f"{year} LC totals {got} do not add")
    letters = {}
    for tbl in re.findall(r"<table.*?</table>", page, re.S | re.I):
        rows = [[txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]
                for tr in re.findall(r"<tr.*?</tr>", tbl, re.S | re.I)]
        rows = [r for r in rows if r]
        if not rows or rows[0][:2] != ["Group", "Candidates in Ballot Order"]:
            continue
        for r in rows[1:]:
            if r[0] and len(r) > 2:
                if r[0] in letters:
                    fail(f"{year} LC: group letter {r[0]} twice")
                v = int(r[2].replace(",", "")) if re.fullmatch(r"[\d,]+", r[2]) else 0
                letters[r[0]] = (r[1], v)
    want = ev[year]["groupFirst"]
    for letter, v in want.items():
        have = letters.get(letter, ("", 0))[1]
        if have != v:
            fail(f"{year} LC group {letter}: page {have:,} != bank groupFirst {v:,}")
    if sum(v for _n, v in letters.values()) != ev[year]["atl"]:
        fail(f"{year} LC group lines do not sum to the bank's ATL total")
    if got["formal"] - ev[year]["atl"] != ev[year]["btl"]:
        fail(f"{year} LC formal/ATL/BTL split does not reconcile")

    votes = collections.Counter()
    for _letter, (nm, v) in letters.items():
        if not v:
            continue
        if not nm:
            key = None                     # blank group names fold into ind
        elif nm in LC_GROUP:
            key = LC_GROUP[nm]             # None = fold into ind
        elif nm.startswith("SUSTAINABLE AUSTRALIA"):
            key = "SAP"
        else:
            fail(f"{year} LC: unmapped group line {nm!r} ({v:,} votes)")
        votes[key or "ind"] += v
    rest = got["formal"] - sum(votes.values())
    if rest != ev[year]["btl"] or not 0 < rest < 150000:
        fail(f"{year} LC: ungrouped remainder {rest} out of band")
    votes["ind"] += rest
    return {"votes": dict(votes), **got}


def votes_2011(ev):
    """The 2011 vector: per-letter ATL votes from the bank (official), names
    and the full ATL+BTL figures from the r02 first-preferences PDF
    (parsed with pdftotext -layout), with the BTL remainder folded into
    ind exactly as the 2015/2019 pages fold it."""
    pdf = os.path.join(LC_FLOW, "published", "sge2011-r02-fp-by-group.pdf")
    if not os.path.exists(pdf):
        fail(f"cache miss {pdf}")
    exe = shutil.which("pdftotext")
    if not exe:
        fail("pdftotext is required to read the r02 report")
    out = subprocess.run([exe, "-layout", pdf, "-"], capture_output=True,
                         text=True, check=True).stdout
    groups, ungrouped = {}, None
    got = {}
    for line in out.splitlines():
        m = re.match(r"^\s+([A-Z])\s{2,}(.+?)\s{2,}([\d,]+)\s+[\d.]+\s+[\d.]+\s*$", line)
        if m and m.group(1) != "U" or (m and m.group(1) == "U" and
                                       "UNGROUPED" not in line):
            if m and not m.group(2).startswith("UNGROUPED"):
                letter = m.group(1)
                if letter in groups:
                    fail(f"2011 r02: group letter {letter} twice")
                groups[letter] = (m.group(2).strip(), int(m.group(3).replace(",", "")))
                continue
        m = re.match(r"^\s+UNGROUPED CANDIDATES\s+([\d,]+)\s+[\d.]+\s+[\d.]+\s*$", line)
        if m:
            ungrouped = int(m.group(1).replace(",", ""))
            continue
        m = re.match(r"^\s*Enrolment:\s*([\d,]+)", line)
        if m:
            got["enrol"] = int(m.group(1).replace(",", ""))
        m = re.match(r"^\s*Date of Election:.*?Quota:\s*([\d,]+)", line)
        if m:
            got["quota"] = int(m.group(1).replace(",", ""))
        m = re.match(r"^\s+FORMAL VOTES\s+([\d,]+)\s+100\.00\s*$", line)
        if m:
            got["formal"] = int(m.group(1).replace(",", ""))
        m = re.match(r"^\s+INFORMAL VOTES\s+([\d,]+)\s*$", line)
        if m:
            got["informal"] = int(m.group(1).replace(",", ""))
        m = re.match(r"^\s+TOTAL VOTES\s+([\d,]+)\s*$", line)
        if m:
            got["papers"] = int(m.group(1).replace(",", ""))
    if got != REF_LC_2011:
        fail(f"2011 r02 totals {got} != reference {REF_LC_2011}")
    if ungrouped is None or len(groups) != 16:
        fail(f"2011 r02 parse: {len(groups)} groups, ungrouped {ungrouped}")
    e = ev["2011"]
    want = e["groupFirst"]
    if set(groups) != set(want) - {"UNG"}:
        fail(f"2011 r02 letters {sorted(groups)} != bank {sorted(set(want) - {'UNG'})}")
    # the bank's per-letter ATL figure and r02's whole-ballot figure differ by
    # that group's below-the-line first preferences; the differences plus the
    # UNGROUPED line must rebuild the bank's BTL total
    dbtl = ungrouped
    for letter, (_nm, v) in groups.items():
        if v < want[letter]:
            fail(f"2011 r02 {letter}: {v:,} below the ATL figure {want[letter]:,}")
        dbtl += v - want[letter]
    if dbtl != e["btl"]:
        fail(f"2011 r02/bank BTL split {dbtl} != {e['btl']}")
    if sum(want.values()) != e["atl"] or e["formal"] - e["atl"] != e["btl"]:
        fail("2011 bank formal/ATL/BTL split does not reconcile")
    if sum(v for _n, v in groups.values()) + ungrouped != got["formal"]:
        fail("2011 r02 group lines do not sum to formal")
    votes = collections.Counter()
    for letter, (nm, _v) in groups.items():
        v = want[letter]                       # the ATL-basis figure (the 2015+ convention)
        if not nm:
            key = None                         # the unnamed independent groups C and J
        elif nm in LC_GROUP:
            key = LC_GROUP[nm]
        else:
            fail(f"2011 LC: unmapped group line {nm!r}")
        votes[key or "ind"] += v
    votes["ind"] += e["btl"]
    if sum(votes.values()) != e["formal"]:
        fail("2011 votes do not sum to formal")
    return {"votes": dict(votes), "formal": e["formal"]}


# ------------------------------------------------------------------ the elected members
def lc_elected(year):
    """The LC/state/candidates_elected page: (name, group-name) pairs, all
    21, with the group tallies pinned (build_nsw23_past's parser)."""
    page = read_page(year, "lc", "elected")
    rows = []
    for tbl in re.findall(r"<table.*?</table>", page, re.S | re.I):
        trs = [[txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]
               for tr in re.findall(r"<tr.*?</tr>", tbl, re.S | re.I)]
        trs = [r for r in trs if r]
        if not trs or trs[0][1:3] != ["Candidate Name", "Group"]:
            continue
        for r in trs[1:]:
            if len(r) >= 4 and r[1]:
                rows.append((flat_name(r[1]), r[3]))
    if len(rows) != 21:
        fail(f"{year} LC elected page lists {len(rows)} members, expected 21")
    tall = collections.Counter(g for _, g in rows)
    if dict(tall) != EXPECTED_LC[year]:
        fail(f"{year} LC cohort groups {dict(tall)} != expected {EXPECTED_LC[year]}")
    return [n for n, _g in rows]


def elected_2011():
    """The r09 party/group result report (HTML, committed): the GROUP
    blocks' ELECTED lines are the 21 members of the 2011 cohort."""
    path = os.path.join(LC_FLOW, "published", "sge2011-r09-party-group-result.html")
    if not os.path.exists(path):
        fail(f"cache miss {path}")
    with open(path, encoding="utf-8", errors="replace") as f:
        page = f.read()
    rows, group, letter = [], None, None
    for tbl in re.findall(r"<table.*?</table>", page, re.S | re.I):
        for tr in re.findall(r"<tr.*?</tr>", tbl, re.S | re.I):
            cells = [txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]
            cells = [c for c in cells]
            if not cells:
                continue
            m = re.match(r"^GROUP ([A-Z])$", cells[0])
            if m:
                letter, group = m.group(1), cells[1] if len(cells) > 1 else ""
                continue
            if cells[0] == "UNGROUPED CANDIDATES":
                group, letter = "", "UNG"
                continue
            if group is not None and len(cells) >= 4 and cells[1] and \
                    cells[3].startswith("ELECTED"):
                rows.append((flat_name(cells[1]), group, letter))
    if len(rows) != 21:
        fail(f"2011 r09 lists {len(rows)} elected members, expected 21")
    tall = collections.Counter(g for _n, g, _l in rows)
    if dict(tall) != EXPECTED_LC["2011"]:
        fail(f"2011 cohort groups {dict(tall)} != expected {EXPECTED_LC['2011']}")
    return [n for n, _g, _l in rows]


# ------------------------------------------------------------------ the sheets
def senators(roster, elected_year, term, names):
    rows = []
    for (n, ab, cas, top, eas) in roster:
        if ab not in names:
            fail(f"roster party {ab!r} has no party name ({n})")
        row = {"n": n, "st": "NSW", "ab": ab, "pn": names[ab], "term": term}
        if eas:
            row["elected"] = elected_year
            row["electedAs"] = eas
        elif cas:
            row["casual"] = {"for": cas, "elected": elected_year}
        else:
            row["elected"] = elected_year
        rows.append(row)
    return rows


def check_cohort(roster, page_names, year, aliases=None):
    """The roster checked against the elected-members record: fills are
    swapped for the departed member (page_top, else casual_for when it
    names a page member), as build_nsw23_past checks its roster."""
    out, tops = set(), set()
    for (n, ab, cas, top, eas) in roster:
        if cas and cas != n:
            out.add(n)
            tops.add(top or cas)
    want = ({n for n, _a, _c, _t, _e in roster} - out) | tops
    got = {aliases.get(n, n) if aliases else n for n in page_names}
    if len(got) != 21:
        fail(f"{year} elected record has duplicate names: {sorted(got)}")
    surplus, missing = got - want, want - got
    if surplus or missing:
        fail(f"{year} cohort drift: page-only {sorted(surplus)}, roster-only {sorted(missing)}")


def main():
    ev = counts()
    v15, v19 = lc_votes("2015", ev), lc_votes("2019", ev)
    v11 = votes_2011(ev)
    el11, el15, el19 = elected_2011(), lc_elected("2015"), lc_elected("2019")
    # the 2019 vectors are reproduced byte-for-byte in senate-nsw23.json's
    # pvotes/pformal — the two files must never disagree on them
    with open(os.path.join(REPO, "map", "data", "senate-nsw23.json")) as f:
        nsw23 = json.load(f)
    if v19["votes"] != nsw23["pvotes"] or v19["formal"] != nsw23["pformal"]:
        fail("2019 LC vectors drifted from senate-nsw23.json's pvotes block")

    check_cohort(ROSTER_2011, el11, "2011", ALIAS_2011)
    check_cohort(ROSTER_2015, el15, "2015")
    check_cohort(ROSTER_2019, el19, "2019")
    # the nsw19 frame's 2015 cohort answers to the 2015 elected page too
    check_cohort(ROSTER_2015_AT_19, el15, "2015")
    # and the 2019 cohort is membership-identical to senate-nsw23.json's
    # 2019 block (there recorded with its through-2023 fills — map those
    # casuals back to the members they stand in for before comparing)
    want23 = {(n, ab) for (n, ab, _c, _t, _e) in ROSTER_2019}
    got23 = {(s["casual"]["for"] if "casual" in s else s["n"], s["ab"])
             for s in nsw23["senators"] if s["term"] == 2027}
    if want23 != got23:
        fail(f"2019 cohort drifted from senate-nsw23.json: only-here {sorted(want23 - got23)}, "
             f"only-nsw23 {sorted(got23 - want23)}")

    nsw15_tally = collections.Counter(ab for _n, ab, _c, _t, _e in (ROSTER_2011 + ROSTER_2015))
    want15 = {"ALP": 12, "LIB": 12, "NAT": 7, "GRN": 5, "CDP": 2, "SFF": 2,
              "AJP": 1, "IND": 1}
    if dict(nsw15_tally) != want15:
        fail(f"nsw15 council tally {dict(nsw15_tally)} != expected {want15}")
    nsw19_tally = collections.Counter(ab for _n, ab, _c, _t, _e in (ROSTER_2015_AT_19 + ROSTER_2019))
    want19 = {"ALP": 14, "LIB": 11, "NAT": 6, "GRN": 4, "ONP": 2, "SFF": 2,
              "AJP": 2, "CDP": 1}
    if dict(nsw19_tally) != want19:
        fail(f"nsw19 council tally {dict(nsw19_tally)} != expected {want19}")

    for v, yr in ((v15, "2015"), (v11, "2011"), (v19, "2019")):
        if sum(v["votes"].values()) != v["formal"]:
            fail(f"{yr} votes do not sum to formal")
    sheets = {
        "nsw15": {
            "year": "nsw15", "lc": True, "asOf": E15, "date": E15, "dd": False,
            "later": 2023, "seatsN": 42, "gov": "lnp", "prev": 2011,
            "source": "NSWEC: the 2015 Legislative Council first-preference summary "
                      "and elected-members list, and the 2011 first-preferences and "
                      "party/group result reports (r02 and r09); member parties and "
                      "vacancy fills from Parliament of NSW records",
            "senators": senators(ROSTER_2011, 2011, 2019, LC_PARTY_NAME_BY_FRAME["nsw15"]) +
                        senators(ROSTER_2015, 2015, 2023, LC_PARTY_NAME_BY_FRAME["nsw15"]),
            "votes": v15["votes"], "pvotes": v11["votes"],
            "formal": v15["formal"], "pformal": v11["formal"], "inf": v15["informal"],
        },
        "nsw19": {
            "year": "nsw19", "lc": True, "asOf": E19, "date": E19, "dd": False,
            "later": 2027, "seatsN": 42, "gov": "lnp", "prev": 2015,
            "source": "NSWEC: the 2019 and 2015 Legislative Council first-preference "
                      "summaries and elected-members lists; member parties and "
                      "vacancy fills from Parliament of NSW records",
            "senators": senators(ROSTER_2015_AT_19, 2015, 2023, LC_PARTY_NAME_BY_FRAME["nsw19"]) +
                        senators(ROSTER_2019, 2019, 2027, LC_PARTY_NAME_BY_FRAME["nsw19"]),
            "votes": v19["votes"], "pvotes": v15["votes"],
            "formal": v19["formal"], "pformal": v15["formal"], "inf": v19["informal"],
        },
    }
    os.makedirs(OUT, exist_ok=True)
    for yr, sheet in sheets.items():
        with open(os.path.join(OUT, f"senate-{yr}.json"), "w") as f:
            json.dump(sheet, f, separators=(",", ":"), ensure_ascii=False)
        print(f"senate-{yr}.json: {len(sheet['senators'])} members, "
              f"{sum(sheet['votes'].values()):,} votes == formal {sheet['formal']:,}, "
              f"prev {sheet['prev']} formal {sheet['pformal']:,}")


if __name__ == "__main__":
    main()
