#!/usr/bin/env python3
"""The vic14 and vic18 frames' upper house: map/data/senate-vic14.json and
map/data/senate-vic18.json — Victoria's Legislative Council in the vic22
frame's own shape (build_vic22_lc.py's child; read it first).

Victoria's council is NOT staggered: all 40 members (five a region, eight
regions) are elected together to a term that ends at the state election four
years on — the 2014 council's term ran to the 24 November 2018 election, the
2018 council's to the 26 November 2022 election. So each frame's `later` and
every member's `term` is that next election year — the term lens's "everyone
faces the voters" case, exactly as build_vic22_lc.py documents it for vic22,
and the sa22/nsw23 frames' discipline for a historical upper-house frame:
the roster is the sheet AS CONSTITUTED AT THE ELECTION (asOf = polling day).
Mid-term vacancy fills and party changes after polling day belong to the
NEXT frame's view, so neither file carries `casual` or `electedAs` rows —
the record, for the file's own footnote:

  2014-2018 (Parliament of Victoria records, via the "Members of the
  Legislative Council, 2014-2018" list):
    Danny O'Brien (NAT, Eastern Victoria) resigned Feb 2015 -> Melina Bath
      appointed 16 Apr 2015; Damian Drum (NAT, Northern Victoria) resigned
      26 May 2016 (won Murray federally) -> Luke O'Sullivan appointed
      13 Oct 2016; Steve Herbert (ALP, Northern Victoria) resigned
      6 Apr 2017 -> Mark Gepp appointed 7 Jun 2017; Greg Barber (GRN,
      Northern Metropolitan) resigned 28 Sep 2017 -> Samantha Ratnam
      appointed 19 Oct 2017; Colleen Hartland (GRN, Western Metropolitan)
      resigned 8 Feb 2018 -> Huong Truong appointed 21 Feb 2018.
      Rachel Carling-Jenkins (DLP, Western Metropolitan) crossed to the
      Australian Conservatives in 2017 and to independent 3 Aug 2018.
  2018-2022 (same source, 2018-2022 list):
    Philip Dalidakis (ALP) resigned 17 Jun 2019 -> Enver Erdogan;
    Mary Wooldridge (LIB) resigned 8 Dec 2019 -> Matthew Bach;
    Gavin Jennings (ALP) resigned 23 Mar 2020 -> Lee Tarlamis;
    Jane Garrett (ALP) resigned 2020 -> Tom McIntosh (sitting MLC into the
      2022 election, ABC's 2022 guide);
    Jenny Mikakos (ALP) resigned 26 Sep 2020 -> Sheena Watt;
    Edward O'Donohue (LIB) resigned 1 Dec 2021 -> Cathrine Burnett-Wake
      (sitting MLC into the 2022 election, ABC's 2022 guide);
    David Limbrick (LDP) resigned 11 Apr 2022 to run federally.
    Party changes: Adem Somyurek left the ALP 15 Jun 2020, Kaushaliya
      Vaghela 7 Mar 2022, Bernie Finn was expelled from the Liberals
      24 May 2022, Catherine Cumming left DHJP — all to independent.

Sources (read-only, committed; the 2022 parent files the same discipline):
  .build/state-flow-src/vic/lc/2014/<region>region.html
  .build/state-flow-src/vic/lc/2018/<region>region.html
      the VEC's historical-results pages, eight regions a year: an "Elected
      members" block (the roster authority — declaration order, party per
      member), a totals block (Formal / Informal / Total votes / Quota) and
      a "Final first preference votes" candidate table summed per party cell
      into `votes` (blank party cells fold into IND, the parent's own rule).
  .build/state-flow-src/vic/lc/2010/state2010result<region>.html
      the 2010 pages, the same grammar in mixed case (`Liberal`, `ALP`,
      `Greens`): vic14's `pvotes`/`pformal`.
  .build/map/src/vic22/xlc/ is the PARENT frame's source — here only as the
      schema reference, never read.
  map/data/senate-vic22.json (read): vic18's `votes` must EQUAL the parent
      file's committed `pvotes` — both parse the 2018 pages; likewise
      pformal. A drift there fails the build loudly.

Region names: the 2010-2018 pages' "Eastern Metropolitan Region" files the
2022 file's eighth region — renamed "North-Eastern Metropolitan Region" in
the 2021 redistribution. The parent's declaration order is kept verbatim;
Eastern Metropolitan's five sit last, in the parent's slot.

Party cells onto the vic22 file's party codes: the parent's AB_2018 map
verbatim; 2014 and 2010 follow the same convention — a joint Lib/Nat
group's candidates file under their own printed cells (LIBERAL / THE
NATIONALS separately, as the parent's 2018 pvotes did; the ticket's
above-the-line vote lands on the Liberal lead candidate either way). Blank
party cells (ungrouped) -> IND. Codes with no vic22 precedent: SEX (Sex
Party), ACA (Australian Country Alliance; 2010's "CA" — distinct from
ACP, 2018's Australian Country Party), AUC (Australian Christians),
RUA (Rise Up Australia), CYC (Australian Cyclists), PPV (People Power
Victoria/No Smart Meters), BRNP (The Basics Rock 'n' Roll Party),
VFW (Voice for the West).

Reconciliation (all asserted, fail-loud):
  - every region's printed candidates sum to its printed Formal figure
    (holds for all 24 pages);
  - statewide sums pinned: 2010 formal 3,216,386 / informal 112,475;
    2014 formal 3,418,671 / informal 121,497;
    2018 formal 3,583,478 / informal 147,713
    (the in-repo state-lc-primaries store vic.json, built independently
    from the same pages, agrees exactly);
  - NOTE on the 2014 statewide figure: the VEC's own pages today file
    3,418,671 formal / 121,497 informal, and the committed mirrors copy
    them (live-fetched from the VEC's blob 4 Nov 2026 and diffed clean).
    Election-era third-party snapshots — psephos' 2014 council file and
    Wikipedia's 2014 LC results table — carry Eastern Metropolitan as
    423,463 formal / 12,222 informal (statewide 3,418,280 / 121,482),
    391 formal and 15 informal fewer; the delta sits entirely in that
    one region (Samantha Dunn's fifth seat, the count finalised at the
    VEC's December 2014 declaration). The pages are the record.
  - per-council seat tallies pinned (EXPECTED_SEATS): 2014 — ALP 14,
    LIB 14, NAT 2, GRN 5, SFF 2, DLP 1, SEX 1, VLJ 1; 2018 — ALP 18,
    LIB 10, NAT 1, GRN 1, LDP 2, DHJP 3, SFF 1, SA 1, AJP 1, RP 1, TMP 1
    (the known council compositions; Tally Room's published summaries
    agree).

usage: python3 -I .build/map/build_vic_lc.py <map_data_dir>     # e.g. map/data
"""
import html as htmlm
import json
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
LC = os.path.join(REPO, ".build", "state-flow-src", "vic", "lc")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "map", "data")

# the parent vic22 file's declaration order verbatim — Eastern Metropolitan
# (2010-2018 pages) files its last slot under the 2022 redistribution's
# "North-Eastern Metropolitan" name
REGIONS = [
    "eastern-victoria", "northern-metropolitan", "northern-victoria",
    "south-eastern-metropolitan", "southern-metropolitan", "western-metropolitan",
    "western-victoria", "north-eastern-metropolitan",
]
FN = {}
for _y in ("2014", "2018"):
    FN[_y] = {
        "eastern-victoria": "easternvictoriaregion.html",
        "northern-metropolitan": "northernmetropolitanregion.html",
        "northern-victoria": "northernvictoriaregion.html",
        "south-eastern-metropolitan": "south-easternmetropolitanregion.html",
        "southern-metropolitan": "southernmetropolitanregion.html",
        "western-metropolitan": "westernmetropolitanregion.html",
        "western-victoria": "westernvictoriaregion.html",
        "north-eastern-metropolitan": "easternmetropolitanregion.html",
    }
FN["2010"] = {
    "eastern-victoria": "state2010resulteasternvictoriaregion.html",
    "northern-metropolitan": "state2010resultnorthernmetropolitanregion.html",
    "northern-victoria": "state2010resultnorthernvictoriaregion.html",
    "south-eastern-metropolitan": "state2010resultsoutheasternmetropolitanregion.html",
    "southern-metropolitan": "state2010resultsouthernmetropolitanregion.html",
    "western-metropolitan": "state2010resultwesternmetropolitanregion.html",
    "western-victoria": "state2010resultwesternvictoriaregion.html",
    "north-eastern-metropolitan": "state2010resulteasternmetropolitanregion.html",
}

# the pages' party cells onto the vic22 file's party codes (blank = the
# ungrouped, -> IND): 2018 reproduces the parent builder's AB_2018 verbatim
AB_2010 = {  # the 2010 pages' mixed-case cells
    "ALP": "ALP", "Liberal": "LIB", "Nationals": "NAT", "Greens": "GRN",
    "FAMILY FIRST": "FFP", "DLP": "DLP", "CA": "ACA", "CDP": "CDP",
    "SEX PARTY": "SEX", "": "IND",
}
AB_2014 = {
    "AUSTRALIAN LABOR PARTY": "ALP", "LIBERAL": "LIB", "THE NATIONALS": "NAT",
    "AUSTRALIAN GREENS": "GRN", "SEX PARTY": "SEX",
    "SHOOTERS AND FISHERS PARTY VICTORIA": "SFF", "PALMER UNITED PARTY": "PUP",
    "RISE UP AUSTRALIA PARTY": "RUA", "AUSTRALIAN CHRISTIANS": "AUC",
    "FAMILY FIRST": "FFP", "ANIMAL JUSTICE PARTY": "AJP",
    "DEMOCRATIC LABOUR PARTY (DLP)": "DLP",
    "PEOPLE POWER VICTORIA/NO SMART METERS": "PPV",
    "AUSTRALIAN CYCLISTS PARTY": "CYC", "AUSTRALIAN COUNTRY ALLIANCE": "ACA",
    "THE BASICS ROCK 'N' ROLL PARTY": "BRNP", "VOTE 1 LOCAL JOBS": "VLJ",
    "VOICE FOR THE WEST": "VFW", "VOLUNTARY EUTHANASIA PARTY (VICTORIA)": "VEP",
    "LIBERAL DEMOCRATS": "LDP", "": "IND",
}
AB_2018 = {  # == build_vic22_lc.py's AB_2018
    "AUSTRALIAN LABOR PARTY": "ALP", "LIBERAL": "LIB", "THE NATIONALS": "NAT",
    "AUSTRALIAN GREENS": "GRN", "SHOOTERS, FISHERS & FARMERS VIC": "SFF",
    "LIBERAL DEMOCRATS": "LDP", "ANIMAL JUSTICE PARTY": "AJP", "LABOUR DLP": "DLP",
    "DERRYN HINCH'S JUSTICE PARTY": "DHJP", "FIONA PATTEN'S REASON PARTY": "RP",
    "VOLUNTARY EUTHANASIA PARTY (VICTORIA)": "VEP", "AUSSIE BATTLER PARTY": "ABP",
    "VICTORIAN SOCIALISTS": "VS", "SUSTAINABLE AUSTRALIA": "SA",
    "HEALTH AUSTRALIA PARTY": "HAP", "AUSTRALIAN COUNTRY PARTY": "ACP",
    "TRANSPORT MATTERS": "TMP", "AUSTRALIAN LIBERTY ALLIANCE": "ALA",
    "HUDSON 4 NV": "HNV", "VOTE 1 LOCAL JOBS": "VLJ", "": "IND",
}
AB = {"2010": AB_2010, "2014": AB_2014, "2018": AB_2018}

# party display names for the elected-member rows — the vic22 file's
# vocabulary, era-corrected for the historical frames (Liberal Democrats
# renamed itself the Libertarian Party only in 2023, so vic18 says Liberal
# Democrats where vic22 says Libertarian)
PN = {"ALP": "Australian Labor Party", "LIB": "Liberal Party", "NAT": "The Nationals",
      "GRN": "Australian Greens", "LDP": "Liberal Democrats",
      "AJP": "Animal Justice Party", "SFF": "Shooters, Fishers and Farmers Party",
      "DLP": "Democratic Labour Party", "SEX": "Sex Party",
      "VLJ": "Vote 1 Local Jobs", "RP": "Fiona Patten’s Reason Party",
      "DHJP": "Derryn Hinch’s Justice Party", "SA": "Sustainable Australia",
      "TMP": "Transport Matters", "IND": "Independent"}

# the pages' own statewide sums, pinned (sa22's REF discipline): a cached
# page drifting fails the build loudly rather than filing a new number
REF_TOTALS = {
    "2010": {"formal": 3216386, "informal": 112475},
    "2014": {"formal": 3418671, "informal": 121497},
    "2018": {"formal": 3583478, "informal": 147713},
}
EXPECTED_SEATS = {
    "vic14": {"ALP": 14, "LIB": 14, "NAT": 2, "GRN": 5, "SFF": 2, "DLP": 1, "SEX": 1, "VLJ": 1},
    "vic18": {"ALP": 18, "LIB": 10, "NAT": 1, "GRN": 1, "LDP": 2, "DHJP": 3, "SFF": 1,
              "SA": 1, "AJP": 1, "RP": 1, "TMP": 1},
}


def fail(msg):
    raise SystemExit(f"vic-lc: {msg}")


def title(name):
    """'O'BRIEN, Danny' -> 'Danny O'Brien'; 'McARTHUR, Beverley' -> 'Beverley McArthur'."""
    sur, giv = name.split(",", 1)
    sur, giv = sur.strip(), giv.strip()
    parts = re.split(r"([\s\-'])", sur)
    out = []
    for p in parts:
        if not p or p in " -'":
            out.append(p)
        elif p.lower().startswith("mc") and len(p) > 2:
            out.append("Mc" + p[2:].title())
        else:
            out.append(p.title())
    if giv.isupper():
        giv = giv.title()
    return f"{giv} {''.join(out)}"


def parse_region(year, slug, roster):
    """One region page -> elected members, party-summed first prefs, totals."""
    path = os.path.join(LC, year, FN[year][slug])
    if not os.path.exists(path):
        fail(f"{path} missing — harvest the VEC historical-results pages first")
    h = open(path, encoding="utf-8").read()

    def fig(label):
        m = re.search(r"<th>\s*" + label + r"\s*</th>\s*<td>([\d,]+)", h)
        if not m:
            fail(f"{year} {slug}: no {label!r} figure")
        return int(m.group(1).replace(",", ""))

    formal, informal, quota = fig("Formal Votes:"), fig("Informal Votes:"), fig("Quota:")

    ab_map = AB[year]
    elected = []
    if roster:
        em = re.search(r'<table title="Elected members".*?</table>', h, re.S)
        if not em:
            fail(f"{year} {slug}: no Elected members table")
        mem = re.findall(r"(\d)(?:st|nd|rd|th) elected:\s*([^<]+?)\s*</span>\s*<br\s*/?>"
                         r"<span class=\"italic\">([^<]+)</span>", em.group(0))
        if [int(o) for o, _, _ in mem] != [1, 2, 3, 4, 5]:
            fail(f"{year} {slug}: elected list {[o for o, _, _ in mem]}, 1..5 expected")
        for ordn, nm, party in mem:
            pcell = re.sub(r"\s+", " ", htmlm.unescape(party)).strip().replace("’", "'")
            ab = ab_map.get(pcell)
            if ab is None:
                fail(f"{year} {slug}: unmapped elected-member party {pcell!r} — extend AB_{year}")
            elected.append((ordn, nm.strip(), ab))

    i = h.find('title="First preference votes"')
    if i < 0:
        fail(f"{year} {slug}: no first-preference table")
    tbl = h[i:h.find("</table>", i)]
    rows = re.findall(r"<tr>\s*<td>([^<]+)</td>\s*<td>([^<]*)</td>\s*<td>([\d,]+)</td>", tbl)
    if not rows:
        fail(f"{year} {slug}: first-preference table parses to no rows")
    votes, tot = {}, 0
    for _nm, party, v in rows:
        pcell = re.sub(r"\s+", " ", htmlm.unescape(party)).strip().replace("’", "'")
        ab = ab_map.get(pcell)
        if ab is None:
            fail(f"{year} {slug}: unmapped party {pcell!r} — extend AB_{year}")
        v = int(v.replace(",", ""))
        votes[ab] = votes.get(ab, 0) + v
        tot += v
    if tot != formal:
        fail(f"{year} {slug}: candidates sum {tot} != formal {formal}")
    return {"elected": elected, "votes": votes, "formal": formal, "informal": informal,
            "quota": quota, "partycells": len(rows)}


def parse_year(year, roster):
    regions = {}
    for slug in REGIONS:
        regions[slug] = parse_region(year, slug, roster)
    votes, formal, informal = {}, 0, 0
    for slug in REGIONS:
        for ab, v in regions[slug]["votes"].items():
            votes[ab] = votes.get(ab, 0) + v
        formal += regions[slug]["formal"]
        informal += regions[slug]["informal"]
    if sum(votes.values()) != formal:
        fail(f"{year}: statewide candidates {sum(votes.values())} != formal {formal}")
    ref = REF_TOTALS[year]
    if formal != ref["formal"] or informal != ref["informal"]:
        fail(f"{year}: pages moved — formal {formal} vs {ref['formal']}, "
             f"informal {informal} vs {ref['informal']}")
    return {"regions": regions, "votes": votes, "formal": formal, "informal": informal}


def frame(name, year, year_prev, term, prev_year, date):
    y = parse_year(year, roster=True)
    p = parse_year(year_prev, roster=False)
    senators = []
    for slug in REGIONS:
        for _ordn, raw_name, ab in y["regions"][slug]["elected"]:
            senators.append({"n": title(raw_name), "st": "VIC", "ab": ab,
                             "pn": PN[ab], "term": term, "elected": int(year)})
    if len(senators) != 40:
        fail(f"{name}: {len(senators)} members, 40 expected")
    tally = {}
    for s in senators:
        tally[s["ab"]] = tally.get(s["ab"], 0) + 1
    if tally != EXPECTED_SEATS[name]:
        fail(f"{name}: seat tally {tally} != expected {EXPECTED_SEATS[name]}")

    out = {
        "year": name, "lc": True, "asOf": date, "date": date, "dd": False,
        "later": term, "seatsN": 40, "gov": "alp", "prev": prev_year,
        "source": ("Victorian Electoral Commission: the "
                   f"{year} state election's Legislative Council first preferences and "
                   f"elected members across its eight region pages, and the {year_prev} "
                   "election's region results for the previous election's figures; the "
                   "council as elected on polling day"),
        "senators": senators,
        "votes": y["votes"], "pvotes": p["votes"], "formal": y["formal"],
        "pformal": p["formal"], "inf": y["informal"],
    }
    with open(os.path.join(OUT, f"senate-{name}.json"), "w") as fh:
        json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)
        fh.write("\n")
    print(f"senate-{name}.json:", " ".join(f"{k} {v}" for k, v in
          sorted(tally.items(), key=lambda kv: -kv[1])),
          f"| formal {y['formal']}, {year_prev} {p['formal']}, informal {y['informal']}")


def build():
    frame("vic14", "2014", "2010", 2018, 2010, "2014-11-29")
    frame("vic18", "2018", "2014", 2022, 2014, "2018-11-24")

    got14 = json.load(open(os.path.join(OUT, "senate-vic14.json")))
    got18 = json.load(open(os.path.join(OUT, "senate-vic18.json")))
    # the 2014 pages are parsed twice (vic14's votes, vic18's pvotes): the
    # frame's own previous-election figures must match its predecessor's
    if got18["pvotes"] != got14["votes"] or got18["pformal"] != got14["formal"]:
        fail("vic18's 2014 figures drifted from senate-vic14.json's")

    # vic18's votes must equal the parent vic22 file's committed pvotes —
    # both read the same 2018 pages (build_vic22_lc.py's pvotes_2018)
    v22 = json.load(open(os.path.join(OUT, "senate-vic22.json")))
    if got18["votes"] != v22["pvotes"]:
        diff = {k: (got18["votes"].get(k), v22["pvotes"].get(k))
                for k in set(got18["votes"]) | set(v22["pvotes"])
                if got18["votes"].get(k) != v22["pvotes"].get(k)}
        fail(f"vic18 votes drifted from senate-vic22.json's pvotes: {diff}")
    if got18["formal"] != v22["pformal"]:
        fail(f"vic18 formal {got18['formal']} != senate-vic22.json pformal {v22['pformal']}")
    print("cross-checks OK: vic14 votes == vic18 pvotes; vic18 votes == senate-vic22 pvotes")


if __name__ == "__main__":
    build()
