#!/usr/bin/env python3
"""The vic22 frame's past election: the 24 November 2018 Victorian state
election, joined into .build/map/vic22/data-vic22.json the way
build_sa26_past.py joined SA 2022 into the sa26 frame.

Sources (read-only, committed — the state preference-flows pipeline's own
mirror; no re-mirror here):
  .build/state-flow-src/vic/2018/<slug>district.html            ×88 pages
  .build/state-flow-src/vic/2018/tcpbyvotingcentre<slug>district.html  ×88
Each district page carries the elected-member cell, the electorate-results
summary (enrolment, formal, informal, turnout) and the "Recheck first
preference votes" candidate table (the VEC's post-recheck certified
vintage). The FINAL-PAIR AUTHORITY is the district's tcpbyvotingcentre
page — the VEC's own two-candidate-preferred count, the same product
family as the 2022 annex pages the frame's own tcp lanes ride, and the
exact figures the VEC's own notional-redistribution paper reallocates
(districts the boundaries left alone reproduce their certified margins
here to the printed digit: Bellarine 61.45% ALP, Broadmeadows 80.28%).
The district pages' own "Results after distribution of preferences"
tables are NOT used: they are the declaration-round stop remnant
(Bellarine's stops with four unreleased candidates at Neville's 50.16%
quota crossing), not the final pair — only 48 pages carry one and they
stop wherever the declaration count stopped. The TCP count's implied
formal total drifts from the certified district-page figure by 0–653
votes across the 88 (same vintage split as the federal indicative 2CP);
the parse guards the pairing (2% gate), never asserts vintage equality.

THE WINNER AUTHORITY: each page's own "Elected member" cell, cross-checked
against the certified pair's arithmetic leader (elected == argmax of the
TCP pair) on all 88.

The redistricted district names (six renames, three genuinely new names,
three abolitions) are adjudicated by the VEC's own August 2022 publication
"Methodology of estimating 2018 election results on new electoral
boundaries" — the rename tags ("Ashwood (formerly Burwood)" etc.), the new
districts and the abolished districts ride its table verbatim, cited in
.build/map/src/vic22/renames-adjudication.txt (mirrored PDF beside it).
Conventions (the nsw23 Leppington pattern): a NEW_2022 district keeps an
empty history row, zeroed candidate swings and a null tpp swing; an
ABOLISHED_2018 district's votes still count into the state pprim/pformal
aggregates but carry no h row anywhere.

Joined into the frame (mirroring the landed nsw23 file cell for cell):
  prev            → 2018
  agg.{AUS,VIC}   → pprim (2018 first prefs by bucket, frame vocabulary:
                    alp/lnp/grn/onp/ind/oth — One Nation stood no Assembly
                    candidates in 2018, so onp is 0 by fact, not by fudge),
                    pformal (state formal total)
  div.h           → [[2018, winner's final-pair %, winner ab, member name]]
  div.c[*][5]     → primary points change vs the 2018 partner district's
                    same-token primary share; a candidate whose ab token
                    didn't stand in 2018 gets their whole share (the federal
                    files' new-name convention)
  div.tpp[2]      → swing vs the 2018 final, only where both parties were
                    ALP and Coalition ({ALP,LIB} or {ALP,NAT}) in 2018 and
                    the frame's 2022 lane is a classic pair too

No Legislative Council senate file: the /map/ chamber-file scope for vic22
is Assembly + past join (per the frame-skill's remaining-steps note); the
2022 LC XLS mirror already sits in .build/map/src/vic22/xlc/ if a later
frame wants it.

usage: python3 .build/map/build_vic22_past.py <out_dir>   # e.g. .build/map/vic22
run after build_vic22_boothcensus.py, then geo_build --years=vic22
"""
import html as htmlm
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_vic22_data import flat_name  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC18 = os.path.join(REPO, ".build", "state-flow-src", "vic", "2018")
OUT = sys.argv[1]
EXPECTED_2018_SEATS = {"ALP": 55, "LIB": 21, "NAT": 6, "GRN": 3, "IND": 3}

# the VEC's own adjudication — see .build/map/src/vic22/renames-adjudication.txt
RENAMES = {"Burwood": "Ashwood", "Buninyong": "Eureka",
           "Forest Hill": "Glen Waverley", "Yuroke": "Kalkallo",
           "Gembrook": "Pakenham", "Altona": "Point Cook"}
NEW_2022 = {"Berwick", "Greenvale", "Laverton"}
ABOLISHED_2018 = {"Ferntree Gully", "Keysborough", "Mount Waverley"}

# 2018 page party strings -> the vic22 frame's ab vocabulary. A party with no
# 2022 standing gets a token of its own; it only feeds state aggregates and
# can never match a 2022 candidate (its swings ride the new-name convention).
AB_2018 = {
    "AUSTRALIAN LABOR PARTY": "ALP",
    "LIBERAL": "LIB",
    "THE NATIONALS": "NAT",
    "AUSTRALIAN GREENS": "GRN",
    "ANIMAL JUSTICE PARTY": "AJP",
    "LABOUR DLP": "DLP",
    "VICTORIAN SOCIALISTS": "VS",
    "FIONA PATTEN'S REASON PARTY": "REAS",
    "TRANSPORT MATTERS": "TMP",
    "SHOOTERS, FISHERS & FARMERS VIC": "SFF",
    "DERRYN HINCH'S JUSTICE PARTY": "DHJP",
    "LIBERAL DEMOCRATS": "LDP",
    "SUSTAINABLE AUSTRALIA": "SA",
    "AUSSIE BATTLER PARTY": "ABP",
    "AUSTRALIAN COUNTRY PARTY": "ACP",
    "AUSTRALIAN LIBERTY ALLIANCE": "ALA",
    "": "IND",
}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]


def bucket(ab):
    if ab == "ALP":
        return "alp"
    if ab in ("LIB", "NAT"):
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab == "ONP":
        return "onp"
    if ab == "IND":
        return "ind"
    return "oth"


def r2(v):
    return round(v + 1e-9, 2)


def ab_of(party):
    if party not in AB_2018:
        fail(f"unmapped 2018 party string {party!r} — extend AB_2018 (ROSTER_PARTY discipline: never a silent other)")
    return AB_2018[party]


def fail(msg):
    raise SystemExit(f"vic22-past: {msg}")


def clean(cell):
    return htmlm.unescape(re.sub(r"\s+", " ", cell)).strip()


# ----------------------------------------------------------------- tcp page
def parse_tcp(slug, want_name, roster, formality):
    """The certified final pair from the tcpbyvotingcentre page: two named
    candidates, their Total-row votes and mis-sorts, cross-validated against
    the page's own printed percentages and the district page's formal total."""
    path = os.path.join(SRC18, f"tcpbyvotingcentre{slug}district.html")
    if not os.path.exists(path):
        fail(f"{want_name}: no certified-pair page {path} in the mirror")
    h = open(path, encoding="utf-8").read()
    m = re.search(r"<h2>([\s\S]{1,80}?) District<br>Two Candidate Preferred", h)
    if not m:
        fail(f"{path}: no district h2")
    if clean(m.group(1)) != want_name:
        fail(f"{path}: h2 says {clean(m.group(1))!r}, expected {want_name!r}")
    cands = [clean(x) for x in re.findall(r'id="candidate[12]">([^<]+)</th>', h)]
    if len(cands) != 2:
        fail(f"{want_name}: tcp page names {len(cands)} pair candidates, expected 2")
    m = re.search(r"<th>\s*Total\s*</th>\s*((?:<td>[^<]*</td>\s*){5})", h)
    if not m:
        fail(f"{want_name}: tcp page has no 5-cell Total row")
    try:
        v1, v2, missorts, _informal, polled = (int(x) for x in
                                               re.findall(r"<td>(\d*)</td>", m.group(1)))
    except ValueError:
        fail(f"{want_name}: unparseable tcp Total row {m.group(1)!r}")
    if polled != v1 + v2 + missorts + _informal:
        fail(f"{want_name}: tcp Total row {v1}+{v2}+{missorts}+{_informal} != polled {polled}")
    # the TCP count is its own vintage (the indicative pair count, the same
    # product family as the 2022 annex pages the frame's own tcp lanes ride):
    # its implied formal total reconciles with the certified district-page
    # Formal Votes only within its own sweep — measured drift across the 88
    # districts is 0..653 votes (<=1.75%); a WRONG SLUG pairing would drift
    # by thousands. Guard the pairing, not the vintage.
    drift = v1 + v2 + missorts - formality
    if abs(drift) > 0.02 * formality:
        fail(f"{want_name}: tcp implied formal {v1 + v2 + missorts} drifts {drift} "
             f"from district-page Formal Votes {formality} (>{2}%) — check the slug pairing")
    pair = [(cands[0], v1), (cands[1], v2)]
    for nm, _v in pair:
        if nm not in roster:
            fail(f"{want_name}: tcp pair member {nm!r} is not on the first-pref roster")
    # the page prints its own percentages — the arithmetic must reproduce them
    m = re.search(r"Percentage of formal vote polled by candidate</th>([\s\S]*?)</tr>", h)
    if not m:
        fail(f"{want_name}: tcp page has no printed-percentage row")
    pcts = re.findall(r"<td>\s*([\d.]+)%\s*</td>", m.group(1))
    if len(pcts) != 2:
        fail(f"{want_name}: tcp printed-percentage row has {len(pcts)} cells, expected 2")
    tot = v1 + v2
    for (printed, v) in ((float(pcts[0]), v1), (float(pcts[1]), v2)):
        if abs(100 * v / tot - printed) > 0.00501:
            fail(f"{want_name}: tcp pair share {100 * v / tot:.4f} vs page's printed {printed}")
    return pair


# ------------------------------------------------------------------- one page
def parse_page(path):
    h = open(path, encoding="utf-8").read()
    m = re.search(r"<h2>([\s\S]{1,80}?) District</h2>", h)
    if not m:
        fail(f"{path}: no district h2")
    name = clean(m.group(1))

    elected_all = re.findall(r'class="bold-text">([^<]+)</span><br><span[^>]*>([^<]*)</span>', h)
    if len(elected_all) != 1:
        fail(f"{name}: elected-member cell found {len(elected_all)} times, expected 1")
    elected_name = flat_name(clean(elected_all[0][0]))
    elected_party = clean(elected_all[0][1])
    elected_ab = ab_of(elected_party)

    m = re.search(r"<th>Formal Votes:</th>\s*<td>([\d,]+)</td>", h)
    if not m:
        fail(f"{name}: no Formal Votes figure")
    formality = int(m.group(1).replace(",", ""))

    m = re.search(r'<table[^>]*title="First preference votes"[\s\S]*?</thead>\s*<tbody>([\s\S]*?)</tbody>', h)
    if not m:
        fail(f"{name}: no first-preference table")
    rows = re.findall(r"<tr>\s*<td>([\s\S]*?)</td>\s*<td>([\s\S]*?)</td>\s*<td>([\s\S]*?)</td>\s*<td>[\s\S]*?</td>\s*</tr>", m.group(1))
    roster = {}
    for raw_name, raw_party, raw_votes in rows:
        nm = clean(raw_name)
        votes = clean(raw_votes).replace(",", "")
        if not re.fullmatch(r"\d+", votes):
            fail(f"{name}: unparseable first-pref votes {raw_votes!r} for {nm!r}")
        if nm in roster:
            fail(f"{name}: duplicate candidate {nm!r} in first-pref table")
        roster[nm] = {"ab": ab_of(clean(raw_party)), "votes": int(votes)}
    if not roster:
        fail(f"{name}: first-pref table parses to no rows")
    if sum(r["votes"] for r in roster.values()) != formality:
        fail(f"{name}: first-pref votes sum to {sum(r['votes'] for r in roster.values())}, page says Formal Votes {formality}")

    # the certified final pair: the district's tcpbyvotingcentre page
    slug = os.path.basename(path)[:-len("district.html")]
    pair = parse_tcp(slug, name, roster, formality)

    won_nm, won_votes = max(pair, key=lambda t: t[1])
    if flat_name(won_nm) != elected_name:
        fail(f"{name}: elected member is {elected_name!r} but the final pair's leader is {won_nm!r}")
    won_ab = roster[won_nm]["ab"]
    if won_ab != elected_ab:
        fail(f"{name}: elected member's party cell is {elected_party!r} ({elected_ab}) but the ballot papers them {won_ab}")
    pct = r2(100 * max(pair[0][1], pair[1][1]) / (pair[0][1] + pair[1][1]))
    pair_abs = {roster[nm]["ab"] for nm, _v in pair}
    tpp = None
    if pair_abs in ({"ALP", "LIB"}, {"ALP", "NAT"}):
        alp_votes = next(v for nm, v in pair if roster[nm]["ab"] == "ALP")
        tpp = [alp_votes, pair[0][1] + pair[1][1] - alp_votes]
    return {"name": name, "roster": roster, "formal": formality,
            "winner": {"n": elected_name, "ab": won_ab, "pct": pct},
            "tpp": tpp}


# ------------------------------------------------------------------ the 2018s
def build_2018():
    # the district-rollup pages only: the same shared cache also carries the
    # FPV-by-voting-centre pages (parse-vic-state-flows.py's prefix
    # exclusion idiom — distribution / fpvbyvotingcentre /
    # tcpbyvotingcentre are booth-level products, not district rollups)
    files = sorted(f for f in os.listdir(SRC18)
                   if f.endswith("district.html")
                   and not f.startswith("distribution")
                   and not f.startswith("fpvbyvotingcentre")
                   and not f.startswith("tcpbyvotingcentre"))
    if len(files) != 88:
        fail(f"{len(files)} district pages in {SRC18}, expected 88")
    dists, seats = {}, {}
    formal_all = 0
    prim_all = {b: 0 for b in BUCKETS}
    for f in files:
        d18 = parse_page(os.path.join(SRC18, f))
        if d18["name"] in dists:
            fail(f"district display name {d18['name']!r} appears twice")
        dists[d18["name"]] = d18
        w_ab = d18["winner"]["ab"]
        seats[w_ab] = seats.get(w_ab, 0) + 1
        formal_all += d18["formal"]
        for r in d18["roster"].values():
            prim_all[bucket(r["ab"])] += r["votes"]
    if seats != EXPECTED_2018_SEATS:
        fail(f"2018 seats {seats} != expected {EXPECTED_2018_SEATS} (the VEC's own tally)")
    print(f"2018: {len(dists)} districts, {formal_all} formal, seats {seats}")
    return {"dists": dists, "prim": prim_all, "formal": formal_all, "seats": seats}


# ------------------------------------------------------------------- the join
def main():
    p18 = build_2018()
    data_path = os.path.join(OUT, "data-vic22.json")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != "vic22":
        fail(f"{data_path} is not the vic22 frame")
    if data.get("prev") is not None:
        fail("frame already carries a prev — rerun build_vic22_data.py .build/map/vic22 first (the lanes are not this script's on a stale build)")

    for st_k in data["agg"]:
        data["agg"][st_k]["pprim"] = p18["prim"]
        data["agg"][st_k]["pformal"] = p18["formal"]
    data["prev"] = 2018

    names22 = [div["n"] for div in data["divs"]]
    if len(names22) != 88:
        fail(f"frame carries {len(names22)} districts, expected 88")
    for n in NEW_2022:
        if n in p18["dists"]:
            fail(f"{n} is pinned NEW_2022 but a 2018 district page carries that name — the VEC's new-district adjudication moved")
    for old, new in RENAMES.items():
        if old not in p18["dists"] or new in p18["dists"]:
            fail(f"rename {old}->{new} disagrees with the 2018 pages' names")
        if new not in names22:
            fail(f"rename target {new} is not a 2022 frame district")

    n_hist = n_sw = n_tpp = 0
    matched18 = set()
    for div in data["divs"]:
        name = div["n"]
        if name in NEW_2022:
            # the nsw23 Leppington convention: no 2018 district exists to join
            for r in div["c"]:
                if r[5] != 0:
                    fail(f"{name}: new district carries a non-zero swing already")
            continue
        old = next((k for k, v in RENAMES.items() if v == name), name)
        past = p18["dists"].get(old)
        if not past:
            fail(f"2022 district {name} matches no 2018 district (extend RENAMES if the "
                 f"VEC's successor table gained a district)")
        matched18.add(old)
        w = past["winner"]
        div["h"] = [[2018, w["pct"], w["ab"], w["n"]]]
        n_hist += 1
        cur_formal = sum(r[4] for r in div["c"])
        prev_by_ab = {}
        for nm, rec in past["roster"].items():
            prev_by_ab[rec["ab"]] = prev_by_ab.get(rec["ab"], 0) + rec["votes"]
        for r in div["c"]:
            share = (100 * r[4]) / cur_formal
            prev_share = (100 * prev_by_ab[r[1]]) / past["formal"] if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1
        if div.get("tpp") and past["tpp"]:
            cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
            old2 = (100 * past["tpp"][0]) / sum(past["tpp"])
            div["tpp"][2] = r2(cur - old2)
            n_tpp += 1
    if len(matched18) != 85:
        fail(f"matched {len(matched18)} 2018 districts, expected 85 (88 - 3 official new)")
    residual = set(p18["dists"]) - matched18
    if residual != ABOLISHED_2018:
        fail(f"2018 districts outside the join: {sorted(residual)} — expected exactly {sorted(ABOLISHED_2018)}")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"vic22 past: {n_hist} history rows, {n_sw} candidate swings, {n_tpp} 2PP swings"
          f" (3 official-new districts stay flat); 2018 state pprim {p18['prim']}, pformal {p18['formal']};"
          f" -> {data_path} ({os.path.getsize(data_path)} bytes)")


if __name__ == "__main__":
    main()
