"""The sa22 frame's past election and its upper house.

The sa26-past build's own mirror for the sa22 frame (the South Australian
state election of 19 March 2022 — the frame's own election rides the ECSA
results API; build_sa22_data.py reads the 2022 caches the sa26 pipeline
committed in .build/map/src/sa26/):

1. The previous SA election (17 March 2018), lower AND upper house, STORED
   but never rendered as its own frame — joined INTO map/data/data-sa22.json
   exactly as build_sa26_past.py joined 2022 into the sa26 frame: `prev`
   2018, agg pprim/pformal, each district's `h` history row ([year, TCP%,
   party, member]), every candidate's c[5] change on 2018, and classic-pair
   districts' tpp[2] swings where 2018's final pair was Labor v Liberal too.
   The 2020 redistribution redrew boundaries but renamed no district, so
   every 2022 district name matches its 2018 page one-for-one (RENAMES sits
   empty as documentation).
   There is NO 2018 results API: the ECSA publishes the 2018 election only
   as static HTML snapshots under
     https://www.ecsa.sa.gov.au/html/results/2018/<District>.html
   (plus House_of_Assembly.html and Legislative_Council.html). Each district
   page carries a First Preference Votes table and a Two Candidate Preferred
   table of exact "Ballot Papers" counts; the statewide page carries the
   party primary table. The pages' chrome still says "Count In Progress /
   91% counted" — vestigial text from the live count the snapshot froze;
   the figures themselves are the FINAL certified ones, proved by the
   hard-coded reference checks below (LIB 398,182 = 37.97%, the AEC-style
   published statewide honours) and by the internal checks (the 47 district
   formal counts sum to the statewide 1,048,713; the per-district party
   primaries sum to the statewide party table). A page that drifts from the
   answer key fails the build loudly rather than filing a close-enough row.
   The fetched pages stay cached (committed) in .build/map/src/sa22/.

2. The Legislative Council, map/data/senate-sa22.json, in the federal
   Senate files' own shape with lc:true — as of the 19 March 2022 election.
   SA's council is 22 members elected statewide, half (11) at each state
   election to terms ending at the election eight years on: the 2022 cohort
   (terms to 2030, from the 2022 LCChange summary the sa26 pipeline cached —
   it files orderElected names) and the 2018 cohort (terms to 2026, from
   the 2018 election's declared seats — the 2018 static pages file party
   votes but not members, so the roster sits in ELECTED_2018 below, in the
   ECSA'd-own declaration order of composition: 4 Liberal, 4 Labor,
   2 SA-BEST, 1 Greens). All eleven were sitting on polling day 2022
   (Girolamo joined the council in 2021, holding David Ridgway's Liberal
   seat). Sarah Game sat as One Nation on election day — her FGA relabel
   belongs to the sa26 frame's view, not this one's.
   The statewide LC party votes come from the 2022 LCChange payload
   (`votes`) and the 2018 Legislative_Council.html party table (`pvotes`).

usage: python3 -I .build/map/build_sa22_past.py <map_data_dir> [--fetch]
runs AFTER build_sa22_data.py (it joins into that script's data-sa22.json);
then node .build/map/geo_build.mjs refreshes the shipped res-sa22.json.
"""
import gzip, json, os, re, sys, urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SRC = os.path.join(REPO, ".build", "map", "src", "sa22")
SRC26 = os.path.join(REPO, ".build", "map", "src", "sa26")
OUT = sys.argv[1]
FETCH = "--fetch" in sys.argv[2:]
BASE18 = "https://www.ecsa.sa.gov.au/html/results/2018"
E18, E22 = "2018-03-17", "2022-03-19"

EXPECTED_2018_SEATS = {"LIB": 25, "ALP": 19, "IND": 3}
# the 2020 redistribution named no district anew: 2022's 47 names are 2018's
RENAMES = {}

# The statewide answer key the 2018 pages are proved against (the published
# final figures): HoA party primaries, and both houses' count totals.
REF_2018_PRIM = {
    "LIB": 398182, "ALP": 343896, "SAB": 148360, "GRN": 69826, "IND": 36780,
    "AC": 31826, "DIG": 15565, "AJP": 3262, "DPA": 732, "SPGN": 284,
}
REF_2018_TOTALS = {"formal": 1048713, "informal": 44821, "papers": 1093534, "electors": 1201775}
REF_2018_LC_TOTALS = {"formal": 1050874, "informal": 44497, "papers": 1095371}

# the 2018 Legislative Council cohort, terms to 2026 — the ECSA's 2018 pages
# carry party votes but no elected-member list
ELECTED_2018 = [
    ("Connie Bonaros", "SAB"), ("Emily Bourke", "ALP"), ("Tammy Franks", "GRN"),
    ("Heidi Girolamo", "LIB"), ("Justin Hanson", "ALP"), ("Jing Lee", "LIB"),
    ("Frank Pangallo", "SAB"), ("Irene Pnevmatikos", "ALP"), ("Clare Scriven", "ALP"),
    ("Terry Stephens", "LIB"), ("Stephen Wade", "LIB"),
]
EXPECTED_2018_LC_SEATS = {"LIB": 4, "ALP": 4, "SAB": 2, "GRN": 1}
EXPECTED_2022_LC_SEATS = {"ALP": 5, "LIB": 4, "GRN": 1, "ONP": 1}

# 2018 LC party-table names onto the senate file's party codes
LC_PARTY = {
    "Liberal Party": "LIB",
    "Australian Labor Party": "ALP",
    "Nick Xenophon's SA-BEST": "SAB",
    "The Greens": "GRN",
    "Australian Conservatives (SA)": "AC",
    "Liberal Democrats": "LDP",
    "Advance SA": "ADV",
    "Animal Justice Party": "AJP",
    "Dignity Party Inc": "DIG",
    "Stop Population Growth Now": "SPGN",
    "Danig Party of Australia (SA Division)": "DPA",
    "Child Protection Party": "CPP",
}
PN18 = {"ALP": "Australian Labor Party", "LIB": "Liberal Party",
        "SAB": "Nick Xenophon's SA-BEST", "GRN": "The Greens"}


def fail(msg):
    raise SystemExit(f"sa22-past: {msg}")


def fetch_page(name, slug):
    p = os.path.join(SRC, f"{name}.html.gz")
    if FETCH or not os.path.exists(p):
        req = urllib.request.Request(f"{BASE18}/{slug}", headers={"User-Agent": "auspol-tracker sa22 2018 cache"})
        with urllib.request.urlopen(req) as r:
            body = r.read()
        text = body.decode("utf-8", "replace")
        with gzip.open(p, "wt", encoding="utf-8") as f:
            f.write(text)
        return text
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return f.read()


def cached_json(name):
    p = os.path.join(SRC26, f"{name}.json.gz")
    with gzip.open(p, "rt", encoding="utf-8") as f:
        return json.load(f)


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
    # the pages run "SURNAME Given"; the 2022 API runs "Given SURNAME"
    n = (n or "").strip()
    if not n:
        return n
    if "," in n:
        sur, giv = n.split(",", 1)
        return title_name(giv, sur)
    parts = n.split(" ")
    if len(parts) > 1 and parts[-1].isupper() and not parts[0].isupper():
        return title_name(" ".join(parts[:-1]), parts[-1])
    lead = 0
    for i, w in enumerate(parts):
        if w.isupper() and len(w) > 1:
            lead = i + 1
        elif i == 0 and w.isupper():
            lead = i + 1
        else:
            break
    if not lead:
        fail(f"candidate cell {n!r} has no caps run to split on")
    sur, giv = " ".join(parts[:lead]), " ".join(parts[lead:])
    return title_name(giv, sur) if giv else title_name("", sur)


COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}
BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]


def bucket(ab):
    ab = (ab or "").upper()
    if ab == "ALP":
        return "alp"
    if ab in COALITION:
        return "lnp"
    if ab == "GRN":
        return "grn"
    if ab in ("ON", "HAN", "ONP"):
        return "onp"
    if ab in ("IND", "", "NAFD"):
        return "ind"
    return "oth"


def r2(v):
    return round(v + 1e-9, 2)


# ---------------------------------------------------------------- the 2018 static pages
def strip_bars(html):
    s = re.sub(r'<div class="d-none d-sm-block">.*?</div>', "", html, flags=re.S)
    s = re.sub(r'<table style="width: 100%; height: 1em;">[\s\S]*?</table>', "", s)
    return s


ROW_RE = re.compile(
    r'<tr>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>'
    r'\s*<td class="text-right">([\d.]+)</td>\s*<td class="text-right">([\d,]+)</td>\s*</tr>')
# the statewide HoA table carries no name cell: abbr, bar, pct, votes
STATE_ROW_RE = re.compile(
    r'<tr>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]*)</td>'
    r'\s*<td class="text-right">([\d.]+)</td>\s*<td class="text-right">([\d,]+)</td>\s*</tr>')


def votes_table(html, anchor, label):
    i = html.find(anchor)
    if i < 0:
        fail(f"{label}: no {anchor!r} anchor")
    tbl = html[i:html.find("</table>", i)]
    rows = []
    for m in ROW_RE.finditer(tbl):
        name, ab, _bar, _pct, votes = m.groups()
        rows.append((name.strip(), ab.strip(), int(votes.replace(",", ""))))
    for m in STATE_ROW_RE.finditer(tbl):
        name, ab, _pct, votes = m.groups()
        rows.append((name.strip(), ab.strip(), int(votes.replace(",", ""))))
    foot = {}
    fm = re.search(r"<tfoot>([\s\S]*?)</tfoot>", tbl)
    if fm:
        for tr in re.findall(r"<tr>([\s\S]*?)</tr>", fm.group(1)):
            cells = [re.sub(r"<[^>]+>", "", c).strip() for c in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", tr)]
            lab = next((c for c in cells if c and not c[0].isdigit()), "")
            nums = [int(c.replace(",", "")) for c in cells if re.fullmatch(r"[\d,]+", c)]
            if lab and nums:
                foot[lab.rstrip(":")] = nums[-1]
    return rows, foot


def parse_2018_district(name):
    slug = name.replace(" ", "_") + ".html"
    html = strip_bars(fetch_page("ecsa-2018-" + slug[:-5], slug))
    fpv, foot = votes_table(html, "First Preference Votes", name)
    if foot.get("Total Formal") is None or foot.get("Total Informal") is None:
        fail(f"2018 {name}: missing total formal/informal rows ({foot})")
    candidates = []
    for nm, ab, v in fpv:
        if not ab or len(ab) > 5:
            fail(f"2018 {name}: odd affiliation {ab!r} on {nm!r}")
        candidates.append({"n": flat_name(nm), "ab": ab, "v": v})
    fsum = sum(c["v"] for c in candidates)
    if fsum != foot["Total Formal"]:
        fail(f"2018 {name}: candidates sum {fsum} != Total Formal {foot['Total Formal']}")
    tcp, _ = votes_table(html, "Two Candidate Preferred", name)
    if len(tcp) != 2:
        fail(f"2018 {name}: {len(tcp)} two-candidate rows, expected 2")
    tsum = sum(v for _, _, v in tcp)
    if tsum != foot["Total Formal"]:
        fail(f"2018 {name}: TCP sum {tsum} != formal {foot['Total Formal']}")
    (na, aa, va), (nb, ab_, vb) = tcp
    win = (na, aa, va) if va > vb else (nb, ab_, vb)
    return {
        "candidates": candidates, "formal": foot["Total Formal"],
        "inf": foot["Total Informal"],
        "winner": {"n": flat_name(win[0]), "ab": win[1], "pct": r2(100 * max(va, vb) / tsum)},
        "tpp": None if {aa, ab_} != {"ALP", "LIB"} else (
            [va, vb] if aa == "ALP" else [vb, va]),
    }


def build_2018():
    # statewide House of Assembly composition and totals
    html = strip_bars(fetch_page("ecsa-2018-house", "House_of_Assembly.html"))
    body = re.search(r'<tbody id="hoaBody">([\s\S]*?)</tbody>', html)
    if not body:
        fail("2018 statewide: no #hoaBody table")
    prim_state = {}
    for m in STATE_ROW_RE.finditer(body.group(1)):
        ab, _bar, _pct, votes = m.groups()
        ab = ab.strip()
        if ab:
            prim_state[ab] = prim_state.get(ab, 0) + int(votes.replace(",", ""))
    if prim_state != REF_2018_PRIM:
        fail(f"2018 statewide primaries {prim_state} != reference {REF_2018_PRIM}")
    foot = {}
    fm = re.search(r"<tfoot>([\s\S]*?)</tfoot>", html[html.find("hoaBody"):])
    if fm:
        for tr in re.findall(r"<tr>([\s\S]*?)</tr>", fm.group(1)):
            nums = [int(x.replace(",", "")) for x in re.findall(r'text-right">([\d,]+)</th>', tr)]
            if nums:
                foot.setdefault("rows", []).append(nums)
    rows = [r[0] for r in foot.get("rows", []) if r]
    if rows != [REF_2018_TOTALS["formal"], REF_2018_TOTALS["informal"], REF_2018_TOTALS["papers"]]:
        fail(f"2018 statewide totals {rows} != reference")
    el = re.search(r'id="num_electors">([\d,]+)<', html)
    if not el or int(el.group(1).replace(",", "")) != REF_2018_TOTALS["electors"]:
        fail(f"2018 electors {el.group(1) if el else None!r} != reference")

    # the 47 districts
    names = [d["districtName"] for d in cached_json("ecsa-2022-ha")["districts"]]
    if len(names) != 47:
        fail(f"{len(names)} 2022 district names")
    dists, seats, prim_sum = {}, {}, {b: 0 for b in BUCKETS}
    formal_all = 0
    for name in sorted(names):
        d = parse_2018_district(name)
        dists[name] = d
        formal_all += d["formal"]
        for c in d["candidates"]:
            prim_sum[bucket(c["ab"])] += c["v"]
        w = d["winner"]["ab"]
        seats[w] = seats.get(w, 0) + 1
    if formal_all != REF_2018_TOTALS["formal"]:
        fail(f"2018 district formal sum {formal_all} != {REF_2018_TOTALS['formal']}")
    if sum(prim_sum.values()) != formal_all:
        fail(f"2018 primary buckets {sum(prim_sum.values())} stray from formal")
    for bs in (("lnp", "LIB"), ("alp", "ALP"), ("grn", "GRN"), ("ind", "IND")):
        if prim_sum[bs[0]] != REF_2018_PRIM[bs[1]]:
            fail(f"2018 bucket {bs[0]} {prim_sum[bs[0]]} != statewide {bs[1]} {REF_2018_PRIM[bs[1]]}")
    oth_ref = sum(v for k, v in REF_2018_PRIM.items() if k not in ("LIB", "ALP", "GRN", "IND"))
    if prim_sum["oth"] != oth_ref or prim_sum["onp"] != 0:
        fail(f"2018 tail buckets oth {prim_sum['oth']} (want {oth_ref}), onp {prim_sum['onp']} (want 0)")
    if seats != EXPECTED_2018_SEATS:
        fail(f"2018 seats {seats} != expected {EXPECTED_2018_SEATS}")
    return {"dists": dists, "prim": prim_sum, "formal": formal_all}


# ---------------------------------------------------------------- the Legislative Council file
def ab_of(p):
    pid = (p.get("partyId") or "").upper()
    if pid in ("ALP", "LIB", "GRN", "SAB", "ONP"):
        return pid
    if pid in ("ON", "HAN", "PHON") or "ONE NATION" in (p.get("partyName") or "").upper():
        return "ONP"
    return pid or (p.get("partyName") or "?")[:4].upper()


def build_lc():
    lc22 = cached_json("ecsa-2022-lc")
    lc22s = cached_json("ecsa-2022-lcs")
    if lc22.get("electionDate") != E22 or lc22.get("electionStatus") != "final":
        fail(f"LC {E22}: date or status off ({lc22.get('electionDate')!r}, {lc22.get('electionStatus')!r})")
    if lc22s.get("lcSeatsContested") != 11:
        fail(f"lcSeatsContested {lc22s.get('lcSeatsContested')} != 11")
    p22 = {p["id"]: p for p in lc22s["parties"]}

    votes22, elected22 = {}, []
    for grp in lc22.get("parties") or []:
        ab = ab_of(p22.get(grp["id"], {}))
        for cd in grp.get("candidates") or []:
            elected22.append({"n": flat_name(cd["name"]), "ab": ab, "order": cd["orderElected"]})
        votes22[ab] = votes22.get(ab, 0) + (grp.get("votes") or 0)
    form22 = lc22.get("totalFormalVotes")
    rem22 = form22 - sum(votes22.values())
    if not 0 <= rem22 <= 2000:
        fail(f"2022 LC: parties' votes leave {rem22} of {form22} unaccounted")
    if rem22:
        votes22["ind"] = votes22.get("ind", 0) + rem22
    s22 = {}
    for m in elected22:
        s22[m["ab"]] = s22.get(m["ab"], 0) + 1
    if len(elected22) != 11 or s22 != EXPECTED_2022_LC_SEATS:
        fail(f"2022 LC seats {s22} != expected {EXPECTED_2022_LC_SEATS}")

    # 2018 statewide party votes
    html = strip_bars(fetch_page("ecsa-2018-lc", "Legislative_Council.html"))
    rows, foot = votes_table(html, "First Preference Votes", "Legislative Council")
    if not rows:
        fail("2018 LC: no party rows")
    votes18 = {}
    for nm, _ab, v in rows:
        key = LC_PARTY.get(nm) or ("IND" if nm.lower().startswith("independent") else None)
        if key is None:
            fail(f"2018 LC: unmapped party {nm!r}")
        votes18[key] = votes18.get(key, 0) + v
    got = (foot.get("Total Formal"), foot.get("Total Informal"), foot.get("Total Ballot Papers"))
    want = (REF_2018_LC_TOTALS["formal"], REF_2018_LC_TOTALS["informal"], REF_2018_LC_TOTALS["papers"])
    if got != want:
        fail(f"2018 LC totals {got} != reference {want}")
    if sum(votes18.values()) != REF_2018_LC_TOTALS["formal"]:
        fail(f"2018 LC party votes {sum(votes18.values())} != formal {REF_2018_LC_TOTALS['formal']}")

    s18 = {}
    for _, ab in ELECTED_2018:
        s18[ab] = s18.get(ab, 0) + 1
    if s18 != EXPECTED_2018_LC_SEATS or len(ELECTED_2018) != 11:
        fail(f"2018 LC cohort {s18} malformed")
    for _, ab in ELECTED_2018:
        if ab not in PN18:
            fail(f"2018 LC cohort party {ab} has no party name")

    pn = {}
    for p in p22.values():
        pn.setdefault(ab_of(p), p.get("partyName") or "")
    pn["ONP"] = "Pauline Hanson's One Nation"
    senators = (
        [{"n": m, "st": "SA", "ab": ab, "pn": PN18[ab], "term": 2026, "elected": 2018} for m, ab in ELECTED_2018]
        + [{"n": m["n"], "st": "SA", "ab": m["ab"], "pn": pn[m["ab"]], "term": 2030, "elected": 2022}
           for m in sorted(elected22, key=lambda x: x["order"])]
    )
    return {
        "year": "sa22", "lc": True, "asOf": E22, "date": E22, "dd": False, "later": 2030,
        "seatsN": 22, "gov": "alp", "prev": 2018,
        "source": "ECSA: the 2022 Legislative Council summary, and the 2018 Legislative Council and House of Assembly results",
        "senators": senators,
        "votes": votes22, "pvotes": votes18, "formal": form22,
        "pformal": REF_2018_LC_TOTALS["formal"],
        "inf": lc22.get("totalInformalVotes"),
    }


# ---------------------------------------------------------------- join into the sa22 frame
def main():
    os.makedirs(SRC, exist_ok=True)
    ha = build_2018()
    lc = build_lc()
    sen_path = os.path.join(OUT, "senate-sa22.json")
    with open(sen_path, "w") as f:
        json.dump(lc, f, separators=(",", ":"), ensure_ascii=False)

    data_path = os.path.join(OUT, "data-sa22.json")
    if not os.path.exists(data_path):
        fail("data-sa22.json missing — run .build/map/build_sa22_data.py first")
    with open(data_path) as f:
        data = json.load(f)
    if data.get("year") != "sa22":
        fail("data-sa22.json is not the sa22 frame")

    agg = data["agg"]
    for st_k in ("AUS", "SA"):
        agg[st_k]["pprim"] = ha["prim"]
        agg[st_k]["pformal"] = ha["formal"]
    data["prev"] = 2018

    n_hist = n_sw = n_tpp = 0
    matched_names = set()
    for div in data["divs"]:
        name = div["n"]
        old = next((k for k, v in RENAMES.items() if v == name), name)
        past = ha["dists"].get(old)
        if not past:
            fail(f"2022 district {name} matches no 2018 page (extend RENAMES if redistricting renamed one)")
        matched_names.add(old)
        w = past["winner"]
        div["h"] = [[2018, w["pct"], w["ab"], w["n"]]]
        n_hist += 1
        formal = sum(r[4] for r in div["c"])
        prev_by_ab = {}
        for c in past["candidates"]:
            prev_by_ab[c["ab"]] = prev_by_ab.get(c["ab"], 0) + c["v"]
        for r in div["c"]:
            share = (100 * r[4]) / formal
            # same party id in the seat last time, or the whole share as the
            # change (the federal files' convention for a name that didn't stand)
            prev_share = (100 * prev_by_ab[r[1]]) / past["formal"] if r[1] in prev_by_ab else 0.0
            r[5] = r2(share - prev_share)
            n_sw += 1
        if div.get("tpp") and past["tpp"]:
            cur = (100 * div["tpp"][0]) / (div["tpp"][0] + div["tpp"][1])
            old2 = (100 * past["tpp"][0]) / sum(past["tpp"])
            div["tpp"][2] = r2(cur - old2)
            n_tpp += 1
    for k in ha["dists"]:
        if k not in matched_names and k not in RENAMES:
            fail(f"2018 district {k} matched no 2022 district (extend RENAMES)")

    with open(data_path, "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
    print(f"sa22 past: {n_hist} history rows, {n_sw} candidate swings, {n_tpp} 2PP swings;"
          f" LC {len(lc['senators'])} members -> senate-sa22.json;"
          f" 2018 stored (HA {ha['formal']} formal, LC {lc['pformal']} formal)")


main()
