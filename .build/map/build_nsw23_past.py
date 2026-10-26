"""The nsw23 frame's past election and its upper house.

1. The previous NSW election (23 March 2019, SG1901), lower house, joined
   INTO map/data/data-nsw23.json exactly as build_sa22_past.py joined 2018
   into the sa22 frame: `prev` 2019, agg pprim/pformal, each district's `h`
   history row, every candidate's c[5] change on 2019 (same party code as
   2023, else the whole share), and classic-pair districts' tpp[2] swings
   where 2019's final pair was also Labor v Coalition.
   The 2021 redistribution renamed four districts and abolished a fifth:
     Baulkham Hills -> Kellyville, Ku-ring-gai -> Wahroonga,
     Mulgoa -> Badgerys Creek, Seven Hills -> Winston Hills
   (the renames ride their predecessors' 2019 rows); Lakemba was abolished
   outright (its electors went mostly into Bankstown) and Leppington is a
   new district, so Leppington keeps an empty history and Lakemba keeps
   nothing — Antony Green's final-determination note is the authority.
   Sources are the committed state-flow caches (.build/state-flow-src/nsw/
   2019/<slug>-{fp,dop}.html.gz), parsed by build_nsw23_data.py's own
   parsers; district sums are proved against the hard-coded REF_2019_* key
   (the statewide figures the NSWEC's own pages report) and fail loudly.

2. The Legislative Council, map/data/senate-nsw23.json, in the federal
   Senate files' shape with lc:true — as of the 25 March 2023 election.
   NSW's council is 42 members elected statewide, half (21) at each state
   election to terms ending at the election eight years on: the 2023
   cohort (terms to 2031) and the 2019 cohort (terms to 2027). The elected
   cohorts are the NSWEC's own LC/state/candidates_elected pages (cached
   committed as nsw/<year>/lc-elected.html.gz); per-member parties within
   the joint LIB/NAT ticket are Parliament of NSW records, hand-entered
   here. The 2019 cohort is recorded as constituted after the election —
   the sa22 frame's own discipline (Girolamo/Pangallo there): Blair->Farraway
   (Oct 2019), Cusack->MacDonald (Sep 2022), Shoebridge->Higginson (Sep 2022)
   were filled before polling day; Latham and Maclaren-Jones resigned their
   2019-term seats on/before 6 Mar 2023 to draw fresh 2023 terms (both
   appear in the 2023 cohort), and those TWO vacancies were filled by
   joint sitting 23 May 2023 (Mihailuk ONP, Farlow LIB) — marked `casual`
   against the departed member, as the federal senate file marks its fills.
   The statewide LC party votes ride the fp_summary caches
   (nsw/<year>/lc-fp.html.gz): party-group lines, with blank/unaffiliated
   groups, the Elizabeth Farrelly Independents line and ungrouped
   below-the-lines folded into `ind`. The joint LIBERAL / THE NATIONALS
   ticket is filed under "LNP", the federal vocabulary's one
   joint-coalition id (the family's display name reads "Coalition").

usage: python3 -I .build/map/build_nsw23_past.py <map_data_dir>
runs AFTER build_nsw23_data.py (it joins into that script's data-nsw23.json);
then node .build/map/geo_build.mjs ... --years=nsw23 refreshes res-nsw23.json.
"""
import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_nsw23_data as B  # noqa: E402  (parsers, PARTY_AB, flat_name)

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(B.REPO, "map", "data")
E19, E23 = "2019-03-23", "2023-03-25"

# the 2019 statewide answer key — the summed districts pinned once and
# every re-run verified against it (== the NSWEC's published statewide LA
# figures: 4,551,886 formal of 4,714,783 votes, on 5,524,406 enrolled)
REF_2019_PRIM = {"alp": 1516143, "lnp": 1892816, "grn": 435401, "onp": 49948,
                 "ind": 217277, "oth": 440301}
REF_2019_TOTALS = {"formal": 4551886, "informal": 162897}
EXPECTED_2019_SEATS = {"ALP": 36, "LIB": 35, "NAT": 13, "SFF": 3, "GRN": 3, "IND": 3}

# the statewide LC figures the NSWEC's fp_summary pages print
REF_LC = {
    "2019": {"formal": 4451146, "informal": 301681, "papers": 4752827},
    "2023": {"formal": 4616858, "informal": 278477, "papers": 4895335},
}
EXPECTED_LC = {
    # elected cohorts by group-name line, from the elected-members pages
    "2019": {"LABOR / COUNTRY LABOR": 7, "LIBERAL / THE NATIONALS": 8, "THE GREENS": 2,
             "PAULINE HANSON'S ONE NATION": 2, "SHOOTERS, FISHERS AND FARMERS": 1,
             "ANIMAL JUSTICE PARTY": 1},
    "2023": {"LABOR": 8, "LIBERAL / THE NATIONALS": 7, "THE GREENS": 2, "ONE NATION": 1,
             "LEGALISE CANNABIS PARTY": 1, "LIBERAL DEMOCRATS": 1,
             "SHOOTERS, FISHERS AND FARMERS": 1},
}

# 2021 redistribution: 2019 name -> 2023 name (four renames); Lakemba
# abolished with no successor; Leppington created with no predecessor
RENAMES = {"Baulkham Hills": "Kellyville", "Ku-ring-gai": "Wahroonga",
           "Mulgoa": "Badgerys Creek", "Seven Hills": "Winston Hills"}
ABOLISHED_2019 = {"Lakemba"}
NEW_2023 = {"Leppington"}

# LC group-name lines onto the canon ids (blank lines and the Farrelly
# independents fold into the `ind` lump with the ungrouped remainder)
LC_GROUP = {
    "LABOR": "ALP",
    "LABOR / COUNTRY LABOR": "ALP",
    "LIBERAL / THE NATIONALS": "LNP",
    "THE GREENS": "GRN",
    "ONE NATION": "ONP",
    "PAULINE HANSON'S ONE NATION": "ONP",
    "SHOOTERS, FISHERS AND FARMERS": "SFF",
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
    "ELIZABETH FARRELLY INDEPENDENTS": None,  # into ind
}
LC_PARTY_NAME = {"ALP": "Australian Labor Party", "LIB": "Liberal Party",
                 "NAT": "The Nationals", "GRN": "The Greens",
                 "ONP": "Pauline Hanson's One Nation", "AJP": "Animal Justice Party",
                 "SFF": "Shooters, Fishers and Farmers", "LCP": "Legalise Cannabis",
                 "LDP": "Liberal Democrats"}

# the 2019 cohort as constituted after the 2023 election (incl. the
# pre-poll replacements and the May 2023 vacancy fills, marked casual);
# Latham and Maclaren-Jones appear instead in the 2023 cohort they were
# re-elected to. The page's as-elected names are checked against this
# roster in build_lc().
ROSTER_2019 = [
    ("Tara Moriarty", "ALP", None), ("Penny Sharpe", "ALP", None),
    ("Greg Donnelly", "ALP", None), ("Anthony D'Adam", "ALP", None),
    ("Daniel Mookhey", "ALP", None), ("Peter Primrose", "ALP", None),
    ("Mark Buttigieg", "ALP", None),
    ("Aileen MacDonald", "LIB", "Catherine Cusack"),
    ("Damien Tudehope", "LIB", None), ("Taylor Martin", "LIB", None),
    ("Natalie Ward", "LIB", None),
    ("Scott Farlow", "LIB", "Natasha Maclaren-Jones"),
    ("Sam Farraway", "NAT", "Niall Blair"), ("Sarah Mitchell", "NAT", None),
    ("Wes Fang", "NAT", None),
    ("Sue Higginson", "GRN", "David Shoebridge"), ("Abigail Boyd", "GRN", None),
    ("Rod Roberts", "ONP", None), ("Tania Mihailuk", "ONP", "Mark Latham"),
    ("Emma Hurst", "AJP", None), ("Mark Banasiak", "SFF", None),
]
ROSTER_2023 = [
    ("Courtney Houssos", "ALP", None), ("Rose Jackson", "ALP", None),
    ("Cameron Murphy", "ALP", None), ("Emily Suvaal", "ALP", None),
    ("John Graham", "ALP", None), ("Bob Nanva", "ALP", None),
    ("Stephen Lawrence", "ALP", None), ("Sarah Kaine", "ALP", None),
    ("Natasha Maclaren-Jones", "LIB", None), ("Chris Rath", "LIB", None),
    ("Susan Carter", "LIB", None), ("Jacqui Munro", "LIB", None),
    ("Rachel Merton", "LIB", None),
    ("Bronnie Taylor", "NAT", None), ("Ben Franklin", "NAT", None),
    ("Cate Faehrmann", "GRN", None), ("Amanda Cohn", "GRN", None),
    ("Mark Latham", "ONP", None),
    ("Jeremy Buckingham", "LCP", None), ("John Ruddick", "LDP", None),
    ("Robert Borsak", "SFF", None),
]


def fail(msg):
    raise SystemExit(f"nsw23-past: {msg}")


def r2(v):
    return round(v + 1e-9, 2)


# ------------------------------------------------------------------ the 2019 house
def build_2019():
    sdir = os.path.join(B.FLOW, "2019")
    slugs = sorted(f[: -len("-fp.html.gz")] for f in os.listdir(sdir)
                   if f.endswith("-fp.html.gz") and not f.startswith("lc-"))
    if len(slugs) != 93:
        fail(f"2019 cache holds {len(slugs)} districts, expected 93")
    dists, seats = {}, {}
    prim = collections.Counter()
    formal = informal = 0
    for slug in slugs:
        fp = B.parse_fp(B.read_page("2019", slug, "fp"), "2019", slug)
        dop = B.parse_dop(B.read_page("2019", slug, "dop"), "2019", slug, fp)
        m = re.search(r"District of ([^<]+)", B.read_page("2019", slug, "fp"))
        if not m:
            fail(f"2019 {slug}: no District-of line")
        name = m.group(1).strip()
        if slug != B.slug_for("2019", name):
            fail(f"2019 {slug}: page names district {name!r}")
        ab_of = {}
        for i, c in enumerate(fp["cands"]):
            code = fp["keys"][i][1]
            ab = B.PARTY_AB.get(code)
            if ab is None:
                fail(f"2019 {slug}: unmapped party code {code!r} ({c['pn']!r})")
            ab_of[c["nm"]] = ab
            prim[B.bucket(ab)] += c["v"]
        formal += fp["formal"]
        informal += fp["inf"]
        w = dop["winner"]
        # 2019's TCP pair -> bucket pair; keep the counts for a classic 2PP
        tcp = {flat_ab: v for flat_ab, v in
               ((B.bucket(ab_of[n]), v) for n, v in dop["tcp"].items())}
        wab = ab_of[w]
        seats[wab] = seats.get(wab, 0) + 1
        wv = dop["tcp"][w]
        tot = sum(dop["tcp"].values())
        dists[name] = {
            "cands": [{"nm": c["nm"], "ab": ab_of[c["nm"]], "v": c["v"]} for c in fp["cands"]],
            "formal": fp["formal"],
            "winner": {"n": B.flat_name(w), "ab": wab, "pct": r2(100 * wv / tot)},
            "tcp_buckets": frozenset(tcp),
        }
        dists[name]["tpp"] = ([tcp["alp"], tcp["lnp"]] if "alp" in tcp and "lnp" in tcp else None)
    if seats != EXPECTED_2019_SEATS:
        fail(f"2019 seats {seats} != expected {EXPECTED_2019_SEATS}")
    got = {k: prim[k] for k in ("alp", "lnp", "grn", "onp", "ind", "oth")}
    if got != REF_2019_PRIM:
        fail(f"2019 primaries {got} != reference {REF_2019_PRIM}")
    if formal != REF_2019_TOTALS["formal"] or informal != REF_2019_TOTALS["informal"]:
        fail(f"2019 totals {(formal, informal)} != reference {REF_2019_TOTALS}")
    return {"dists": dists, "prim": got, "formal": formal}


# ------------------------------------------------------------------ the LC pages
def txt(c):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c)).strip()


def lc_votes(year):
    """The fp_summary page's party-group lines -> canon votes (blank and
    unaffiliated lines fold into ind with the ungrouped remainder)."""
    page = B.read_page(year, "lc", "fp")
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
    groups = {}
    for tbl in re.findall(r"<table.*?</table>", page, re.S | re.I):
        rows = [[txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]
                for tr in re.findall(r"<tr.*?</tr>", tbl, re.S | re.I)]
        rows = [r for r in rows if r]
        if not rows or rows[0][:2] != ["Group", "Candidates in Ballot Order"]:
            continue
        for r in rows[1:]:
            if r[0] and len(r) > 2:
                v = int(r[2].replace(",", "")) if re.fullmatch(r"[\d,]+", r[2]) else 0
                groups[r[1] or "?"] = groups.get(r[1] or "?", 0) + v
    votes = collections.Counter()
    for nm, v in groups.items():
        if not v:
            continue
        if nm in LC_GROUP:
            key = LC_GROUP[nm]             # None = fold into ind
        elif nm.startswith("SUSTAINABLE AUSTRALIA"):
            key = "SAP"                    # 2019 "SUSTAINABLE AUSTRALIA"; 2023's longer line
        elif nm == "?":
            key = None                     # blank group names fold into ind
        else:
            fail(f"{year} LC: unmapped group line {nm!r} ({v:,} votes)")
        votes[key or "ind"] += v
    rest = got["formal"] - sum(votes.values())
    if not 0 < rest < 150000:
        fail(f"{year} LC: ungrouped remainder {rest} out of band")
    votes["ind"] += rest
    return {"votes": dict(votes), **got}


def lc_elected(year):
    """The LC/state/candidates_elected page: (Given SURNAME, group-name)
    pairs, all 21, with the group tallies pinned."""
    page = B.read_page(year, "lc", "elected")
    rows = []
    for tbl in re.findall(r"<table.*?</table>", page, re.S | re.I):
        trs = [[txt(c) for c in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", tr, re.S | re.I)]
               for tr in re.findall(r"<tr.*?</tr>", tbl, re.S | re.I)]
        trs = [r for r in trs if r]
        if not trs or trs[0][1:3] != ["Candidate Name", "Group"]:
            continue
        for r in trs[1:]:
            if len(r) >= 4 and r[1]:
                rows.append((B.flat_name(r[1]), r[3]))
    if len(rows) != 21:
        fail(f"{year} LC elected page lists {len(rows)} members, expected 21")
    tall = collections.Counter(g for _, g in rows)
    if dict(tall) != EXPECTED_LC[year]:
        fail(f"{year} LC cohort groups {dict(tall)} != expected {EXPECTED_LC[year]}")
    return rows


def build_lc():
    el19 = lc_elected("2019")
    el23 = lc_elected("2023")
    # the page's as-elected 2019 names: the roster's own people, with the
    # five vacancy fills swapped for the members they replaced
    fills19 = {n for n, _a, c in ROSTER_2019 if c}
    removed19 = {c for n, _a, c in ROSTER_2019 if c}
    want19 = ({n for n, _a, _c in ROSTER_2019} - fills19) | removed19
    got19 = {n for n, _g in el19}
    if len(got19) != 21:
        fail(f"2019 elected page has duplicate names: {sorted(got19)}")
    surplus = got19 - want19
    missing = want19 - got19
    if surplus or missing:
        fail(f"2019 cohort drift: page-only {sorted(surplus)}, roster-only {sorted(missing)}")
    # the 2023 cohort rides the page's own list, checked against the roster
    if {n for n, _g in el23} != {n for n, _ab, _c in ROSTER_2023}:
        fail(f"2023 cohort drift: page-only {sorted({n for n, _g in el23} - {n for n, _a, _c in ROSTER_2023})}, "
             f"roster-only {sorted({n for n, _a, _c in ROSTER_2023} - {n for n, _g in el23})}")

    v19 = lc_votes("2019")
    v23 = lc_votes("2023")

    sen = []
    for n, ab, cas in ROSTER_2019 + ROSTER_2023:
        if ab not in LC_PARTY_NAME:
            fail(f"roster party {ab!r} has no party name ({n})")
        row = {"n": n, "st": "NSW", "ab": ab, "pn": LC_PARTY_NAME[ab],
               "term": 2027 if (n, ab, cas) in ROSTER_2019 else 2031,
               "elected": 2019 if (n, ab, cas) in ROSTER_2019 else 2023}
        if cas:
            row = {"n": n, "st": "NSW", "ab": ab, "pn": LC_PARTY_NAME[ab],
                   "term": 2027, "casual": {"for": cas, "elected": 2019}}
        sen.append(row)
    tally = collections.Counter(ab for _n, ab, _c in ROSTER_2019 + ROSTER_2023)
    want = {"ALP": 15, "LIB": 10, "NAT": 5, "GRN": 4, "ONP": 3, "SFF": 2, "AJP": 1,
            "LCP": 1, "LDP": 1}
    if dict(tally) != want:
        fail(f"council tally {dict(tally)} != expected {want}")
    return {
        "year": "nsw23", "lc": True, "asOf": E23, "date": E23, "dd": False,
        "later": 2031, "seatsN": 42, "gov": "alp", "prev": 2019,
        "source": "NSWEC: the 2023 and 2019 Legislative Council first-preference "
                  "summaries and elected-members lists; member parties and "
                  "vacancy fills from Parliament of NSW records",
        "senators": sen,
        "votes": v23["votes"], "pvotes": v19["votes"],
        "formal": v23["formal"], "pformal": v19["formal"], "inf": v23["informal"],
    }


# ------------------------------------------------------------------ join into the frame
def main():
    ha = build_2019()
    lc = build_lc()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "senate-nsw23.json"), "w") as f:
        json.dump(lc, f, separators=(",", ":"), ensure_ascii=False)

    data_path = os.path.join(OUT, "data-nsw23.json")
    if not os.path.exists(data_path):
        fail("data-nsw23.json missing — run .build/map/build_nsw23_data.py first")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != "nsw23":
        fail("data-nsw23.json is not the nsw23 frame")

    agg = data["agg"]
    for st_k in ("AUS", "NSW"):
        agg[st_k]["pprim"] = ha["prim"]
        agg[st_k]["pformal"] = ha["formal"]
    data["prev"] = 2019

    n_hist = n_sw = n_tpp = 0
    matched19 = set()
    new_got = set()
    for div in data["divs"]:
        name = div["n"]
        old = next((k for k, v in RENAMES.items() if v == name), name)
        past = ha["dists"].get(old)
        if past is None:
            if name in NEW_2023:
                new_got.add(name)
                continue
            fail(f"2023 district {name} matches no 2019 page (extend RENAMES if the "
                 f"redistribution renamed one)")
        matched19.add(old)
        w = past["winner"]
        div["h"] = [[2019, w["pct"], w["ab"], w["n"]]]
        n_hist += 1
        formal = sum(r[4] for r in div["c"])
        prev_by_ab = {}
        for c in past["cands"]:
            prev_by_ab[c["ab"]] = prev_by_ab.get(c["ab"], 0) + c["v"]
        for r in div["c"]:
            share = (100 * r[4]) / formal
            prev_share = (100 * prev_by_ab[r[1]]) / past["formal"] if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1
        if div.get("tpp") and past["tpp"]:
            cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
            oldv = (100 * past["tpp"][0]) / sum(past["tpp"])
            div["tpp"][2] = r2(cur - oldv)
            n_tpp += 1
    unresolved = set(ha["dists"]) - matched19
    if unresolved != ABOLISHED_2019:
        fail(f"2019 districts matched to none in 2023: {sorted(unresolved)} != {sorted(ABOLISHED_2019)}")
    if new_got != NEW_2023:
        fail(f"2023 districts with no past: {sorted(new_got)} != {sorted(NEW_2023)}")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"nsw23 past: {n_hist} history rows, {n_sw} candidate swings, {n_tpp} 2PP swings;"
          f" LC {len(lc['senators'])} members -> senate-nsw23.json;"
          f" 2019 stored (LA {ha['formal']} formal incl. Lakemba as stored, "
          f"LC {lc['pformal']} formal)")


if __name__ == "__main__":
    main()
