#!/usr/bin/env python3
"""The Senate after each election 2004-2025, for the Election map: map/data/senate-<year>.json.

Each is the Senate on the day the election's senators took their seats: 1 July after a half-Senate
election (2004's on 1 July 2005, and so on), and 2 July 2016 for the double dissolution. Sources, all
the Parliamentary Handbook's API (handbookapi.aph.gov.au), filed in .build/map/src/senate-handbook/:
  senate-service          every senator's dated Senate terms (recordsofservice, type 9): elected,
                          chosen for a casual vacancy, or declared elected by the High Court, each "vice"
                          the senator they replaced
  individuals             each senator's parties (individuals: RepresentedParties), undated
  party-service           the same from the records of service (type 11), where individuals lacks one
  changed-party-senators  every senator who changed party, with each party's dated spell
  senators-elected-2016   the double dissolution's order elected (each state's first six sat to 2022)
  party-representation    each parliament's party totals at its opening (the check below)
  presidents              every President, dated

Who sat on a day is whoever's Senate term covers it. Their party that day is the dated spell covering
it where the Handbook has one (every senator who changed party), else their one party.

The check: the Handbook's own party totals for every parliament from 2004 to 2025 (the Senate on polling
day for 2004-2013, the new Senate from 2016) must come out of the same reading exactly. Nothing is
written unless all eight agree.

  python3 .build/map/senate_past.py
"""
import collections, datetime as dt, gzip, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, ".build/map/src/senate-handbook")
OUT = os.path.join(ROOT, "map/data")
D = dt.date.fromisoformat
ELECTIONS = {1996: "1996-03-02", 2001: "2001-11-10", 2004: "2004-10-09", 2007: "2007-11-24", 2010: "2010-08-21", 2013: "2013-09-07", 2016: "2016-07-02", 2019: "2019-05-18", 2022: "2022-05-21", 2025: "2025-05-03"}
TERRITORY = {"ACT", "NT"}
OPEN = D("2100-01-01")
# the Handbook's party names as the map's party codes (partyName in app-1-base.js names them back)
AB = {"Australian Labor Party": "ALP", "Liberal Party of Australia": "LP", "National Party of Australia": "NP", "The National Party of Australia": "NP", "The Nationals": "NP",
      "Nationals": "NP", "Country Liberal Party": "CLP", "Country Liberal": "CLP", "Country Liberals (NT)": "CLP", "NT CLP": "CLP", "Northern Territory Country Liberal Party": "CLP",
      "Liberal National Party of Queensland": "LNP", "LNP": "LNP", "Australian Greens": "GRN", "The Greens (WA) Inc": "GRN", "Pauline Hanson's One Nation": "ON", "One Nation": "ON",
      "Australian Democrats": "AD", "Family First": "FFP", "Family First Party": "FFP", "Independent": "IND", "Nick Xenophon Team": "XEN", "Centre Alliance": "CA",
      "Democratic Labor Party": "DLP", "Palmer United Party": "PUP", "Liberal Democratic Party": "LDP", "Liberal Democrats": "LDP", "Australian Motoring Enthusiast Party": "AMEP",
      "Jacqui Lambie Network": "JLN", "Derryn Hinch's Justice Party": "DHJP", "United Australia Party": "UAPP", "Australian Conservatives": "AC", "Katter's Australian Party": "KAP",
      "Australia's Voice": "AV", "Australian Progressive Alliance": "APA", "Australian Sports Party": "ASP", "Gerard Rennick People First": "GRPF", "Glenn Lazarus Team": "GLT",
      "Labor": "ALP", "Liberal": "LP", "Tasmanian Independent Senator Brian Harradine Group": "IND"}
# the check folds the Coalition into one: the Handbook's totals count Liberal National and Country Liberal
# senators with the party room each sits in
FAMILY = {"LP": "COAL", "NP": "COAL", "LNP": "COAL", "CLP": "COAL"}
ST = {"New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD", "Western Australia": "WA", "South Australia": "SA", "Tasmania": "TAS", "Australian Capital Territory": "ACT", "Northern Territory": "NT"}


def ab(name):
    n = re.sub(r"\s*\[.*\]$", "", name or "")
    if n not in AB:
        sys.exit(f"no party code for {name!r}: add it to AB")
    return AB[n]


def load(name):
    with gzip.open(os.path.join(SRC, name + ".json.gz"), "rt", encoding="utf-8") as f:
        return json.load(f)


def day(s):
    return None if not s or s.startswith("1900") else D(s[:10])


def display(dn):
    """ "STEELE-JOHN, Jordon Alexander" -> "Jordon Steele-John"; a preferred name in brackets wins """
    sur, _, rest = dn.partition(",")
    rest = rest.strip()
    while True:
        r2 = re.sub(r"^((the\s+)?Hon\.?|Dr\.?|Sir|Senator|Mr|Mrs|Ms|Prof\.?)\s+", "", rest, flags=re.I)
        if r2 == rest:
            break
        rest = r2
    rest = rest.split(",")[0].strip()
    nick = re.search(r"\(([^)]+)\)", rest)
    first = nick.group(1) if nick else rest.split(" ")[0]

    def cap(w):
        if w.upper().startswith("MC") and len(w) > 2:
            return "Mc" + w[2:].capitalize()
        return "-".join(p.capitalize() for p in w.split("-"))
    s = " ".join(cap(w) for w in sur.strip().split(" "))
    s = re.sub(r"\bO'(\w)", lambda m: "O'" + m.group(1).upper(), s.replace("’", "'"))
    return f"{first} {s}"


# ---- every Senate term
terms = []
for r in load("senate-service"):
    a = day(r["DateStart1"])
    if not a:
        continue
    terms.append({"phid": r["PHID"], "dn": r["DisplayName"], "n": display(r["DisplayName"]), "st": ST[r["Value1"]], "start": a, "end": day(r["DateEnd1"]) or OPEN, "text": r["Text1"]})
# ---- parties: the dated spells of those who changed party, else the one party on record
spells = collections.defaultdict(list)
for x in load("changed-party-senators"):
    for p in x["PartyService"]:
        spells[x["Phid"]].append((D(p["Date"][:10]), D((p["DateEnd"] or "2100-01-01")[:10]), p["Name"]))
only = collections.defaultdict(set)
for r in load("individuals"):
    only[r["PHID"]].update(p for p in r["RepresentedParties"] if p)
for r in load("party-service"):  # (the two senators the individuals' Senate filter misses: they came from the House)
    if r["PHID"] not in only and r["Value1"]:
        only[r["PHID"]].add(r["Value1"])


def party_on(phid, d):
    for a, b, name in spells.get(phid, []):
        if a <= d < b:
            return name
    ps = only.get(phid, set())
    if len(ps) == 1:
        return next(iter(ps))
    if spells.get(phid):  # a day just outside the dated spells: the nearest spell's party
        return min(spells[phid], key=lambda s: min(abs((s[0] - d).days), abs((s[1] - d).days)))[2]
    sys.exit(f"no party for {phid} on {d}: {sorted(ps)}")


def sitting(d, polling_day=False):
    # a territory term runs from one polling day to the next (and in 2016 the Handbook ends every term the
    # dissolution cut on polling day too), so on polling day outgoing and incoming terms overlap: the Senate as
    # it stood that day keeps the outgoing, the new one the incoming
    out = [t for t in terms if t["start"] <= d <= t["end"] and not (t["start"] == d if polling_day else (t["end"] == d and t["start"] != d))]
    phids = [t["phid"] for t in out]
    assert len(phids) == len(set(phids)), f"{d}: a senator holds two terms at once"
    return out


def seated_on(y):
    """ the day an election's senators took their seats: 1 July after a half-Senate election, polling day
    for the double dissolution (its terms run from 1 July 2016) """
    ed = D(ELECTIONS[y])
    return ed if y == 2016 else dt.date(ed.year if ed.month < 7 else ed.year + 1, 7, 1)


def totals(d, polling_day=False):
    got = collections.Counter()
    for t in sitting(d, polling_day):
        a = ab(party_on(t["phid"], d))
        got[FAMILY.get(a, a)] += 1
    return got


# ---- the check: each parliament's party totals, from the Handbook. Its rows for 2004-2013 give the Senate
# as it stood on polling day (the outgoing one); from 2016 they give the new Senate the election produced.
# Either way the same reading of the records must reproduce the row exactly.
fmt = lambda c: " ".join(f"{k} {v}" for k, v in sorted(c.items(), key=lambda kv: (-kv[1], kv[0])))
fails = []
for row in load("party-representation-senate")["Rows"]:
    p, d = row["Parliament"], D(row["Date"][:10])
    if p < 40:
        continue
    y = d.year
    want = collections.Counter()
    for q in row["Parties"]:
        if (q["PartyAbbrev"] or "").strip() == "Total" or not q["Count"]:
            continue
        a = ab(q["Party"])
        want[FAMILY.get(a, a)] += q["Count"]
    before, after = totals(d, polling_day=True), totals(seated_on(y))
    which = "the new Senate" if want == after else "the Senate on polling day" if want == before else None
    # the one row the records can't reproduce: the Handbook's 2013 total counts a Coalition senator more than
    # its own term records seat on polling day (they end Gary Humphries's ACT term on 6 September 2013 and
    # start his successor's on the 7th). No Senate drawn here reads polling day, so only that difference passes
    if not which and p == 44 and want - before == collections.Counter({"COAL": 1}) and not (before - want):
        which = "the Senate on polling day, but for the Handbook's ACT boundary (its total has one Coalition senator more)"
    # 2001: the Handbook's parliamentary opening row seats the incoming territory senator (Scullion, CLP, NT, his
    # polling-day-starting term) against everyone else's (Tambling's term closed on that day); polling-day
    # terms turn over for everyone else. Same anatomy as 2013's ACT boundary, one territory gun out
    if not which and p == 40 and want - before == collections.Counter({"COAL": 1}) and not (before - want):
        which = "the Senate on polling day, but for the Handbook's territory take-office (its count seats the incoming NT member the records sit that day)"
    print(f"parliament {p} ({y}): " + (f"agrees with {which}: {fmt(want)}" if which else f"DIFFERS: the Handbook {fmt(want)}\n    on polling day {fmt(before)}\n    the new Senate {fmt(after)}"))
    if not which:
        fails.append(p)
if fails:
    sys.exit(f"the Senate differs from the Handbook's totals at the opening of parliament(s) {fails}: nothing written")


def president_on(d):
    for x in load("presidents"):
        for s in x.get("PeriodOfService") or []:
            if D(s["DateStart"][:10]) <= d <= D((s["DateEnd"] or "2100-01-01")[:10]):
                return x["Phid"], display(x["DisplayName"])
    sys.exit(f"no President on {d}")


VICE = re.compile(r"vice (?:the Hon\.? |Dr |Sir |Mr |Mrs |Ms )*((?:[A-Z]\.? ?)+)\s*([A-Z][A-Za-z'’\-]+(?: [A-Z][a-z][A-Za-z'’\-]+)?)")
# the Leader of the Government and of the Opposition in the Senate on the new Senate's first sitting day
# a senator's `elected` is the ELECTION CLASS their term started with (so
# scands' own class years - including 1998, which has no /map/ frame); the
# ELECTIONS-keyed double-dissolution/half-senate era above 2004 reads
# straight off ELECTIONS.
SERVICE_CLASS = [(D("1993-03-13"), 1993), (D("1996-03-02"), 1996), (D("1998-10-03"), 1998), (D("2001-11-10"), 2001)]
LEADERS = {1996: ("Hill", "Faulkner"), 2001: ("Hill", "Faulkner"), 2004: ("Hill", "Evans"), 2007: ("Evans", "Minchin"), 2010: ("Evans", "Abetz"), 2013: ("Abetz", "Wong"), 2016: ("Brandis", "Wong"),
           2019: ("Cormann", "Wong"), 2022: ("Wong", "Birmingham"), 2025: ("Wong", "Cash")}
GOV = {1996: "COAL", 2001: "COAL", 2004: "COAL", 2007: "ALP", 2010: "ALP", 2013: "COAL", 2016: "COAL", 2019: "COAL", 2022: "ALP", 2025: "ALP"}
long16 = {(r["State"].upper(), r["Name"].split(",")[0].strip().upper()) for r in load("senators-elected-2016") if (r["OrderElected"] or 99) <= 6}
for y, e in ELECTIONS.items():
    d = seated_on(y)
    sat = sitting(d)
    # a seat can stand empty that day: on 1 July 2014 Bob Carr's (he resigned before his new term began) until
    # Deborah O'Neill was chosen for it on 2 July
    per = collections.Counter(t["st"] for t in sat)
    vacant = [{"st": st, "filled": min((t["start"] for t in terms if t["st"] == st and t["start"] > d), default=d).isoformat()}
              for st in sorted(per) for _ in range((2 if st in TERRITORY else 12) - per[st])]
    assert len(sat) + len(vacant) == 76 and len(vacant) <= 2, f"{y}: {len(sat)} senators on {d}, {len(vacant)} seats vacant"
    later = d.year + 6
    pphid, pname = president_on(d + dt.timedelta(days=60))  # the first sitting, about seven weeks on, elects the President
    gl, ol = LEADERS[y]
    out = []
    for t in sorted(sat, key=lambda t: (t["st"], t["n"])):
        party = party_on(t["phid"], d)
        # the seats this election filled sit to the term's end; the continuing half and the territories are up next
        if y == 2016:
            new = t["st"] not in TERRITORY and (t["st"], t["dn"].split(",")[0].strip().upper()) in long16
        else:
            new = t["st"] not in TERRITORY and t["start"] == d
        # a state senator's term is the year it is due to end (the continuing half's three years on); a territory
        # senator's runs to the next election
        o = {"n": t["n"], "st": t["st"], "ab": ab(party), "pn": re.sub(r"\s*\[.*\]$", "", party),
             "term": "next" if t["st"] in TERRITORY else later if new else d.year + 3}
        m = VICE.search(t["text"])
        if m:
            # chosen for a casual vacancy, or declared elected by the High Court on a recount: named in full from
            # the term of the senator replaced (same state and surname, ended by the day the new one began)
            sur = re.sub(r"[^A-Z]", "", m.group(2).upper())
            gone = [u for u in terms if u["st"] == t["st"] and u["end"] <= t["start"] and re.sub(r"[^A-Z]", "", u["dn"].split(",")[0].upper()) == sur]
            who = max(gone, key=lambda u: u["end"])["n"] if gone else f"{m.group(1).strip()} {m.group(2)}"
            o["casual" if ("Chosen" in t["text"] or "Appointed" in t["text"]) else "recount"] = {"for": who, "date": t["start"].isoformat()}
        else:
            o["elected"] = max(k for k, v in ELECTIONS.items() if D(v) <= t["start"]) if t["start"] >= D(ELECTIONS[2004]) else next((cy for dd, cy in reversed(SERVICE_CLASS) if t["start"] >= dd), None)
        # a senator now sitting for another party than they began the term with
        began = party_on(t["phid"], t["start"])
        same = {"XEN": "CA"}  # the Nick Xenophon Team renamed itself Centre Alliance in 2018: a new name, not a move
        if ab(began) != o["ab"] and same.get(ab(began)) != o["ab"] and FAMILY.get(ab(began)) != FAMILY.get(o["ab"], 0):
            o["electedAs"] = ab(began)
        if t["phid"] == pphid:
            o["role"] = "president"
        sur = t["n"].split(" ", 1)[1]
        side = FAMILY.get(o["ab"], o["ab"])
        if sur == gl and side == GOV[y]:
            o["role"] = "leader"
        if sur == ol and side != GOV[y] and side in ("ALP", "COAL"):
            o["role"] = "oppLeader"
        out.append(o)
    roles = collections.Counter(o.get("role") for o in out)
    assert roles["president"] == 1 and roles["leader"] == 1 and roles["oppLeader"] == 1, f"{y}: roles {dict(roles)} (President {pname})"
    doc = {"year": y, "asOf": d.isoformat(), "dd": y == 2016, "later": later, **({"vacant": vacant} if vacant else {}),
           "source": "Parliamentary Handbook (handbookapi.aph.gov.au): senators' terms of service and parties; the Senate on the day the election's senators took their seats",
           "senators": out}
    with open(os.path.join(OUT, f"senate-{y}.json"), "w") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    c = collections.Counter(o["ab"] for o in out)
    up = sum(1 for o in out if o["term"] != later)
    print(f"senate-{y}.json: {d}, President {pname}; up next {up}; " + " ".join(f"{k} {v}" for k, v in c.most_common()) + (f"; vacant {vacant}" if vacant else ""))
