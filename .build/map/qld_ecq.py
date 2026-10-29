"""qld_ecq.py — the Electoral Commission of Queensland's two results products,
read into one ElectionData shape for the /map/ Queensland frames (qld17,
qld20, qld24). The builders (build_qld17/20/24_data.py) all file districts,
booths and TCP from here; the past joins (build_qld20/24_past.py) read the
previous election through the same door.

Era one — the Vote Result System media feed (2020, 2024 and the era's
by-elections): publicResults.xml, mirrored by the flow machinery at
.build/state-flow-src/qld/<YYYY>/xml/publicResults.xml (harvest:
.build/harvest-qld-state-flows.py). Anatomy (pinned against the committed
2024-11-12 and 2020-11-23 copies):
  <venues count=N><booth id name latitude longitude locality postcode state
    streetName streetNo buildingName><boothDistrict districtName election/>
  — every REAL venue (day booths and early voting centres), geocoded.
  <election eventType="State General"> exactly one (the archives bundle a
    council by-election, ignored by that predicate), 93 <district> blocks
    with enrolment, candidates (ballotOrderNumber + party/partyCode), a
    declaredCandidate marker, and count rounds:
      preliminary="YES" — election-night unofficial counts, never used here
      the official FPV round (preliminary="NO" preferences="NO"): district
        primaryVoteResults + formal/informal/total, and a <booths> block with
        per-candidate counts at EVERY row — real venues and the pseudo rows:
        typeCodes DV1/DV2 (postal and in-person declaration), AB1/AB2 (absent
        day/early), plus Telephone Voting rows riding PB/EV codes.
      preferences="YES" — the official distribution: district
        twoCandidateVotes (the final pair), a <booths> block carrying the
        SAME pair's count per real venue and pseudo row, and the
        preferenceDistributionSummary chain.
  Totals doctrine (asserted in load): a district's official FPV figures equal
  the sum of its booth rows — real AND pseudo — per candidate and for
  formal/informal/total, exactly. The pseudo rows' votes fold into the
  district totals; the map booth lane files the real venues only.

Era two — the Ektron results site (2017), committed verbatim (gzipped):
  .build/state-flow-src/qld/2017/booth<N>.html.gz (flow-machinery mirror):
      "Primary Results by Booth Details" table + the district's "Summary of
      Distribution of Preferences". The FPV table's numbered rows are the
      district's own day booths and pre-poll centres FOLLOWED by the
      administration lanes (every other district's "Returning Officer X
      Pre-Poll" row, the All-Districts pre-poll centres, Telephone Voting,
      eAssist); its fixed trailers are Polling Booth Totals, the seven-row
      declaration block and Declaration Votes Totals. Asserted: own-venue
      sums per candidate == Polling Booth Totals minus the admin rows'
      contributions, and Polling Booth Totals + Declaration Votes Totals ==
      the district summary's Total Formal Votes, per candidate.
  .build/map/src/qld17/district<N>.html.gz (this pipeline's mirror):
      Electors at Close of Roll, the candidate roster with short party
      codes, and Total Formal/Informal/Votes.
  .build/map/src/qld17/profile<N>.html.gz: the venue roll (booth name,
      premise, street, suburb — no coordinates anywhere in 2017, so the
      frame's day-booth coords come from the (name, locality) join onto the
      VRS-era venue roll; measured coverage lands in the build's tally line).
  .build/map/src/qld17/prepoll-offices.html.gz / returning-officers.html.gz:
      the era's pre-poll venue roll and returning-officer addresses.

Candidate keys: VRS era keys candidates by ballotOrderNumber (never
duplicated in a district; Maiwar 2020 stands two BURKEs). 2017 keys by the
normalised ballot name — one 2017 district's roster cross-check is against
the summary page's own names, not an index.

Booth-lane policy (shared by all three eras): REAL venues only — day booths
(ty 1), early voting centres and pre-poll offices (ty 5), ECQ mobile teams
(ty 4, null coords). Absent/postal/declaration/telephone lumps never enter
the lane; their votes fold into district totals. The lane's own formal sums
plus the pseudo rows' sums equal the district's official totals exactly
(asserted per district per candidate).
"""
import gzip, html, json, os, re, sys
import xml.etree.ElementTree as ET

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FLOW_MIRROR = os.path.join(REPO, ".build", "state-flow-src", "qld")
SRC17 = os.path.join(REPO, ".build", "map", "src", "qld17")

ELECTIONS = {
    "qld17": {"year": 2017, "date": "2017-11-25", "date_ymd": "25 Nov 2017"},
    "qld20": {"year": 2020, "date": "2020-10-31", "date_ymd": "31 Oct 2020"},
    "qld24": {"year": 2024, "date": "2024-10-26", "date_ymd": "26 Oct 2024"},
}

BUCKETS = ["alp", "lnp", "grn", "onp", "ind", "oth"]


def fail(msg):
    raise SystemExit(f"qld-ecq: {msg}")


#: ECQ party text -> the site's display abbreviation. Fail-loud coverage:
#: an unlisted party code fails the load (extend this map deliberately).
CODE_AB = {
    "ALP": "ALP",
    "AUSTRALIAN LABOR PARTY": "ALP",
    "LNP": "LNP",
    "LIBERAL NATIONAL PARTY": "LNP",
    "LIBERAL NATIONAL PARTY OF QUEENSLAND": "LNP",
    "LIBERAL NATIONAL PARTY OF QUEENSLAND - LNP": "LNP",
    "GRN": "GRN",
    "GREENS": "GRN",
    "THE GREENS": "GRN",
    "QLD GREENS": "GRN",
    "QUEENSLAND GREENS": "GRN",
    "ONP": "ONP",
    "ON": "ONP",
    "ONE NATION": "ONP",
    "PHON": "ONP",
    "PAULINE HANSON'S ONE NATION": "ONP",
    "PAULINE HANSON’S ONE NATION": "ONP",
    "PAULINE HANSON'S ONE NATION QUEENSLAND DIVISION": "ONP",
    "KAP": "KAP",
    "KATTER": "KAP",
    "KATTER'S AUSTRALIAN PARTY": "KAP",
    "KATTER’S AUSTRALIAN PARTY": "KAP",
    "KATTER'S AUSTRALIAN PARTY (KAP)": "KAP",
    "IND": "IND",
    "UNA": "IND",
    "FFP": "FFP",
    "FAMILY FIRST": "FFP",
    "FAMILY FIRST QUEENSLAND": "FFP",
    "CLMP": "HMP",
    "LCQP": "HMP",
    "LEGALISE CANNABIS QUEENSLAND": "HMP",
    "LEGALISE CANNABIS QUEENSLAND (PARTY)": "HMP",
    "LEGALISE CANNABIS QLD (PARTY)": "HMP",
    "LDP": "LDP",
    "LIBERTARIAN": "LTP",
    "LIBERTARIANS": "LTP",
    "LIBERTARIAN PARTY OF QUEENSLAND": "LTP",
    "AJP": "AJP",
    "ANIMAL JUSTICE PARTY": "AJP",
    "ANIMAL JUSTICE PARTY (QUEENSLAND)": "AJP",
    "UAPP": "UAPP",
    "UNITED AUSTRALIA PARTY": "UAPP",
    "CLIVE PALMER'S UAP": "UAPP",
    "CLIVE PALMER’S UAP": "UAPP",
    "PUP": "PUP",
    "PALMER UNITED": "PUP",
    "PALMER'S UNITED AUSTRALIA PARTY": "UAPP",
    "SFF": "ASP",
    "SFFP": "ASP",
    "SHOOTERS, FISHERS AND FARMERS": "ASP",
    "SHOOTERS, FISHERS AND FARMERS QLD": "ASP",
    "SAP": "SAP",
    "SUSTAINABLE AUSTRALIA PARTY": "SAP",
    "IMOP": "IMOP",
    "INFORMED MEDICAL OPTIONS PARTY": "IMOP",
    "CYA": "CYA",
    "CIV": "CIV",
    "LNQ": "LNQ",
    "DSP": "DSP",
    "MMP": "MMP",
    "NQF": "NQF",
    "TCS": "TCS",
    "CR": "CR",
    "CRNT": "CR",
    "WAP": "WAP",
    "ZYL": "ZYL",
}


def code_ab(text):
    t = (text or "").strip().upper()
    if not t:
        # the 2017 summaries leave Independents' party cell blank
        return "IND"
    ab = CODE_AB.get(t)
    if ab is None:
        fail(f"party code {text!r} not in CODE_AB — extend the map deliberately")
    return ab


COALITION = {"LP", "LNP", "NP", "CLP", "NAT", "LNQ", "LIB"}


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


def ballot_to_name(ballot):
    """'ENOCH, Leeanne' -> 'Leeanne Enoch' (+ the party-code abbrs mirror)."""
    if "," in ballot:
        sur, giv = ballot.split(",", 1)
        return title_name(giv, sur)
    return ballot.strip()


# ------------------------------------------------------------------ venues
def norm_key(s):
    """venue-name join key: case/punctuation/apostrophe-insensitive, ws-folded."""
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def vrs_venues(root):
    """The media feed's venue roll: {id: rec}. The block lists the pseudo
    rows too (Mobile Polling, the four declaration lodges) with NO coords —
    the only records without coords anywhere (pinned count 5, 2024-11-12 and
    2020-11-23; a sixth kind appearing is a guard trip)."""
    venues, by_name = {}, {}
    v = root.find("venues")
    if v is None or not v.findall("booth"):
        fail("publicResults.xml carries no venues block")
    for b in v.findall("booth"):
        bd = b.find("boothDistrict")
        lat = b.get("latitude")
        lon = b.get("longitude")
        f_lat, f_lon = (float(lat) if lat else None), (float(lon) if lon else None)
        coords = f_lat is not None and f_lon is not None and not (f_lat == 0 and f_lon == 0)
        rec = {
            "id": b.get("id"), "n": b.get("name") or "",
            "prem": b.get("buildingName") or "",
            "street": " ".join(x for x in ((b.get("streetNo") or "").strip(), (b.get("streetName") or "").strip()) if x),
            "sub": b.get("locality") or "",
            "pc": b.get("postcode") or "",
            "lat": f_lat if coords else None,
            "lon": f_lon if coords else None,
            "d": bd.get("districtName") if bd is not None else None,
        }
        if coords and not (-44 < rec["lat"] < -9 and 112 < rec["lon"] < 154):
            fail(f"venue {rec['id'] or '?'} {rec['n']!r} has coords {rec['lat']},{rec['lon']} outside Australia")
        if not coords:
            if not re.search(r"(?i)mobile polling|declaration votes|absent (election day|early voting)", rec["n"]):
                fail(f"venue {rec['id']} {rec['n']!r} records no coordinates and is not"
                     " one of the known mobile/declaration placeholders")
        if rec["id"] in venues:
            fail(f"venue id {rec['id']} duplicated in the roll")
        venues[rec["id"]] = rec
        by_name.setdefault(norm_key(rec["n"]), []).append(rec)
    return venues, by_name


# ------------------------------------------------------------------ era 1: VRS
#: typeCodes whose rows are vote lumps, never a polling-place lane row
PSEUDO_TYPE = {"DV1", "DV2", "AB1", "AB2"}


def pseudo_borrowed_name(name):
    """A PB/EV-coded row that is still a vote lump: the telephone lines."""
    return bool(re.match(r"(?i)telephone voting", name or ""))


BOOTH_TY = {
    ("PB", False): 1,
    ("EV", False): 5,
}


def load_vrs(frame):
    """Parse publicResults.xml for qld20/qld24 into the ElectionData shape."""
    year = ELECTIONS[frame]["year"]
    path = os.path.join(FLOW_MIRROR, str(year), "xml", "publicResults.xml")
    if not os.path.exists(path):
        fail(f"{path} missing — run .build/map/harvest-qld-src.py")
    root = ET.parse(path).getroot()
    venues, _ = vrs_venues(root)
    els = [e for e in root.findall("election") if e.get("eventType") == "State General"]
    if len(els) != 1:
        fail(f"{len(els)} state-general election blocks, expected 1")
    el = els[0]
    districts = []
    for d in el.find("districts").findall("district"):
        name = d.get("districtName")
        enrolled = int(d.get("enrolment") or 0)
        cands = []
        cb = d.find("candidates")
        for c in cb.findall("candidate"):
            bo = c.get("ballotOrderNumber")
            if not bo:
                fail(f"{name}: candidate without ballotOrderNumber")
            cands.append({
                "key": bo, "n": ballot_to_name(c.get("ballotName") or ""),
                "ab": code_ab(c.get("partyCode") or c.get("party") or ""),
                "pn": c.get("party") or "",
            })
        decl = d.find("declaredCandidate")
        if decl is None or not decl.get("ballotOrderNumber"):
            fail(f"{name}: no declaredCandidate marker")
        elected = decl.get("ballotOrderNumber")
        keys = [c["key"] for c in cands]
        if elected not in keys or len(keys) != len(set(keys)):
            fail(f"{name}: declared candidate/roster keys disagree")

        fpv_round = dop_round = None
        for cr in d.findall("countRound"):
            if cr.get("preliminary") == "NO" and cr.get("preferences") == "NO":
                fpv_round = cr
            if cr.get("preferences") == "YES":
                dop_round = cr
        if fpv_round is None or dop_round is None:
            fail(f"{name}: official FPV and/or preference rounds missing")

        def counts(row, tag="primaryVoteResults"):
            out = {}
            blk = row.find(tag) if tag else row
            for c in blk.findall("candidate"):
                out[c.get("ballotOrderNumber")] = int(c.findtext("count") or 0)
            return out

        fpv = counts(fpv_round)
        formal = int(fpv_round.findtext("totalFormalVotes/count") or 0)
        informal = int(fpv_round.findtext("totalInformalVotes/count") or 0)
        total = int(fpv_round.findtext("totalVotes") or 0) or (formal + informal)
        if sum(fpv.values()) != formal:
            fail(f"{name}: district FPV candidates {sum(fpv.values())} != recorded formal {formal}")
        if set(fpv) != set(keys):
            fail(f"{name}: FPV candidate keys differ from the roster")

        booths = []
        pseudo_formal = 0
        fsum = isum = tsum = 0
        fb = fpv_round.find("booths")
        if fb is None:
            fail(f"{name}: official FPV round carries no booths block")
        pair = dop_pair(dop_round)
        pair_keys = list(pair)
        db = dop_round.find("booths")
        tcp_by_id = {}
        if db is not None:
            for b in db.findall("booth"):
                tc = counts(b, "twoCandidateVotes")
                tcp_by_id[b.get("id")] = tc
        for b in fb.findall("booth"):
            bid = b.get("id")
            tcode = b.get("typeCode") or ""
            bname = b.get("name") or ""
            bformal = int(b.findtext("formalVotes") or 0)
            binf = int(b.findtext("informalVotes") or 0)
            ballots = int(b.findtext("ballots") or 0)
            pv = counts(b)
            if sum(pv.values()) != bformal:
                fail(f"{name}: booth {bname!r} candidate sum {sum(pv.values())} != its formal {bformal}")
            pseudo = tcode in PSEUDO_TYPE or pseudo_borrowed_name(bname)
            ty = None
            if not pseudo:
                ty = BOOTH_TY.get((tcode, False))
                if ty is None:
                    fail(f"{name}: booth {bname!r} typeCode {tcode!r} unmapped")
                v = venues.get(bid)
                mobile = False
                if v is None:
                    # ECQ files its roving teams under the EV code with no
                    # venue record — the map's mobile-team lane
                    mobile = bool(re.search(r"(?i)mobile|declared institution", bname))
                elif v["lat"] is None:
                    # the venues block's coord-less placeholders are Mobile
                    # Polling and the declaration lodges (vrs_venues pins the
                    # universe); a real booth landing on one is a mobile team
                    mobile = bool(re.search(r"(?i)mobile|declared institution", bname))
                    if not mobile:
                        fail(f"{name}: booth {bname!r} landed on the coord-less venue"
                             f" {v['n']!r} without naming itself a mobile team")
                if mobile:
                    ty = 4
                    v = None
                elif v is None:
                    fail(f"{name}: real booth {bname!r} (id {bid}) has no venue record")
            else:
                v = None
                pseudo_formal += bformal
            tc = tcp_by_id.get(bid)
            tcp = None
            if tc is not None:
                if set(tc) != set(pair_keys):
                    fail(f"{name}: booth {bname!r} TCP pair {sorted(tc)} != the district's final pair")
                tcp = [tc[pair_keys[0]], tc[pair_keys[1]]]
                if sum(tc.values()) > bformal:
                    fail(f"{name}: booth {bname!r} TCP sum {sum(tc.values())} exceeds its formal {bformal}")
                if bformal and sum(tc.values()) < bformal - 60:
                    fail(f"{name}: booth {bname!r} TCP sum {sum(tc.values())} short of formal {bformal} beyond CPV exhaust tolerance")
            fsum += bformal
            isum += binf
            tsum += ballots
            booths.append({
                "name": bname, "ty": ty, "pseudo": pseudo, "venue": v,
                "formal": bformal, "informal": binf, "ballots": ballots,
                "pv": pv, "tcp": tcp,
            })
        if fsum != formal or isum != informal:
            fail(f"{name}: booth rows formal {fsum}+{isum} != district {formal}+{informal}")
        if abs(sum(pair.values()) - formal) > formal * 0.02:
            fail(f"{name}: final TCP pair counts {sum(pair.values())} drift from formal {formal}")
        for k in pair:
            if k not in keys:
                fail(f"{name}: final TCP candidate {k} not on the roster")
        districts.append({
            "name": name, "enrolled": enrolled, "cands": cands,
            "elected": elected, "fpv": fpv, "formal": formal, "informal": informal,
            "booths": booths,
            "tcp": {"k": pair_keys, "v": [pair[k] for k in pair_keys]},
            "unmatched_tcp_booths": sum(1 for b in booths if not b["pseudo"] and b["tcp"] is None),
            "expected_voters": tsum,
        })
    return {"frame": frame, "districts": districts}


def dop_pair(cr):
    tv = cr.find("twoCandidateVotes")
    if tv is None:
        fail("preference round lacks twoCandidateVotes")
    out = {}
    for c in tv.findall("candidate"):
        out[c.get("ballotOrderNumber")] = int(c.findtext("count") or 0)
    if len(out) != 2:
        fail(f"final twoCandidateVotes carries {len(out)} candidates, expected 2")
    # file in finishing order: the higher count first
    return dict(sorted(out.items(), key=lambda kv: -kv[1]))


# ------------------------------------------------------------------ era 2: Ektron 2017
def _cells(r):
    return [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip()
            for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]


def _num(x):
    x = (x or "").replace(",", "").strip()
    return int(x) if re.fullmatch(r"-?\d+", x) else None


def read17(fname):
    for root in (SRC17, os.path.join(FLOW_MIRROR, "2017")):
        p = os.path.join(root, fname)
        if os.path.exists(p):
            with gzip.open(p, "rt", encoding="utf-8", errors="replace") as f:
                return f.read()
    fail(f"{fname} not found under {SRC17} nor the 2017 flow mirror"
         " — run .build/map/harvest-qld-src.py")


def _tables(doc):
    return re.findall(r'<table[^>]*class="resultTableBorder"[^>]*>(.*?)</table>', doc, re.S)


#: 2017 FPV-table trailer rows: sums asserted, votes fold into district totals
DECLARATION_ROWS = {
    "Postal, Special Postal, Unenrolled Votes",
    "Pre-Poll (In Person) Absent Votes",
    "Polling Day Absent Votes",
    "Declared Institution Votes",
    "Polling Day Declaration Votes",
    "Uncertain Identity",
}
TOTAL_ROWS = {"Polling Booth Totals", "Declaration Votes Totals", "District Totals"}
HEADER_ROW_MARKERS = {"No.", "Booth Details", "Votes", "", "Declaration Votes"}


def _fpv_table_rows(doc):
    tables = _tables(doc)
    fpv = dop = None
    for t in tables:
        head = _cells(re.search(r"<tr.*?</tr>", t, re.S).group(0)) if re.search(r"<tr.*?</tr>", t, re.S) else []
        if head[:1] == ["Booth Details"]:
            fpv = [_cells(r) for r in re.findall(r"<tr.*?</tr>", t, re.S)]
        elif head[:1] == ["Summary of Distribution of Preferences"]:
            dop = [_cells(r) for r in re.findall(r"<tr.*?</tr>", t, re.S)]
    if fpv is None or dop is None:
        fail("booth page lacks its Booth Details and/or DoP tables")
    return fpv, dop


def _dop_summary(dop_rows):
    """The 2017 DoP table: header names candidates, one 'X Excluded' row per
    exclusion with recipient transfers + exhausted delta, and Total rows.
    Files fpv, the exclusion chain (excluded name, exhausted, transfers) and
    the final pair counts, in finishing order."""
    head = next((r for r in dop_rows if r and r[0] == "Preference Distribution"), None)
    if not head:
        fail("DoP table: no Preference Distribution header")
    names = []
    for c in head[1:head.index("Votes Remaining in Count")]:
        m = re.match(r"^(.*?)\s+([A-Z][A-Z0-9]{1,6})$", c)
        nm = (m.group(1) if m and "," in m.group(1) else c)
        names.append(nm)
    k = len(names)

    def vals(r):
        got = {}
        for j, n in enumerate(names):
            i = 1 + 2 * j
            if i < len(r):
                v = _num(r[i])
                if v is not None:
                    got[n] = v
        exh = _num(r[2 + 2 * k]) if len(r) > 2 + 2 * k else None
        return got, (exh or 0)

    fp = next((r for r in dop_rows if r and r[0] == "First Preference Votes"), None)
    if fp is None:
        fail("DoP table: no First Preference Votes row")
    fpv, _ = vals(fp)
    chain, prev = [], fpv
    pending = None
    totals = None
    for r in dop_rows:
        if r and r[0].endswith("Excluded"):
            got, exh = vals(r)
            pending = (exh, {n: v for n, v in got.items() if v})
        elif r and r[0] in ("Total", "District Total") and pending is not None:
            got, _ = vals(r)
            live = {n: v for n, v in got.items()}
            totals = live
            chain.append((pending[0], pending[1], live))
            pending = None
            prev = live
    if totals is None or len(totals) != 2:
        fail(f"DoP table: final totals carry {len(totals or {})} candidates, expected 2")
    tcp = dict(sorted(totals.items(), key=lambda kv: -kv[1]))
    return {"names": names, "fpv": fpv, "chain": chain, "tcp": tcp}


# ------------------------------------------------------------------ 2017: venue rolls
def parse_profile(doc):
    """The district profile's Polling Booths roll: one line per booth of
    'Name (Premise) street, SUBURB' (premise/street optional). Keys by the
    normalised booth name; premise/suburb ride along."""
    out = {}
    for m in re.finditer(r"<td width='94%' colspan='5' valign='middle'>(.*?)</td>", doc, re.S):
        line = re.sub(r"<[^>]+>", "", m.group(1))
        line = html.unescape(re.sub(r"\s+", " ", line)).strip()
        if not line:
            continue
        nm, prem, rest = line, "", ""
        mm = re.match(r"^(.*?)\s*\((.*?)\)\s*,?\s*(.*)$", line)
        if mm:
            nm, prem, rest = mm.group(1).strip(), (mm.group(2) or "").strip(), (mm.group(3) or "").strip()
        elif "," in line:
            # no parenthesised premise: 'Name, Street, SUBURB' (the ADC rows)
            parts = line.split(",", 1)
            nm, rest = parts[0].strip(), parts[1].strip() if len(parts) > 1 else ""
        sub = ""
        if "," in rest:
            street, sub = rest.rsplit(",", 1)
            street = street.strip()
        else:
            street = rest
        sub = re.sub(r"\s+\d{4}$", "", sub.strip())
        key = norm_key(nm)
        if key in out:
            fail(f"profile: venue name {nm!r} twice in a district's roll")
        out[key] = {"n": nm, "prem": prem, "street": street, "sub": sub}
    return out


_VRS_ROLL = None


def vrs_coord_roll():
    """The 2020+2024 VRS venue rolls merged for the 2017 coord join:
    {norm_name: [recs]}; 2020's era-nearer record sorts before 2024's."""
    global _VRS_ROLL
    if _VRS_ROLL is not None:
        return _VRS_ROLL
    roll = {}
    for year in (2020, 2024):
        path = os.path.join(FLOW_MIRROR, str(year), "xml", "publicResults.xml")
        if not os.path.exists(path):
            fail(f"{path} missing — run .build/map/harvest-qld-src.py")
        venues, _ = vrs_venues(ET.parse(path).getroot())
        for rec in venues.values():
            roll.setdefault(norm_key(rec["n"]), []).append(rec)
    _VRS_ROLL = roll
    return roll


def join_coords(name, suburb, roll):
    """Best-effort coords for a 2017 venue against the VRS rolls: locality+
    name first, then a unique statewide name match. Never invents coords."""
    key, skey = norm_key(name), norm_key(suburb)
    cands = roll.get(key) or []
    if skey:
        local = [c for c in cands if norm_key(c["sub"]) == skey]
        if len(local) == 1:
            return local[0]
    if len(cands) == 1 or (cands and len({norm_key(c["n"]) for c in cands}) == 1 and len({(round(c["lat"], 4), round(c["lon"], 4)) for c in cands}) == 1):
        return cands[0]
    return None


def parse_prepoll_roll():
    """The 2017 site's one-site-wide pre-poll roll (early voting centres AND
    the 93 returning officers' offices, ~161 distinct offices, each listed
    once per district block — the 93 identical repeats are read and merged;
    a name filing two different addresses is a guard trip). Row address
    anatomy: premise<br>street<br>SUBURB QLD postcode<br>… — the locality
    segment is the QLD-carrying one, not necessarily the last.
    Aliases: names carrying a parenthesised qualifier ('Collinsville
    Pre-poll (QGAP Office)') are keyed by their stem too, so the FPV
    table's bare-name row finds them."""
    txt = read17("prepoll-offices.html.gz")
    out, aliases = {}, {}
    for row in re.findall(r"<tr[^>]*bgcolor='#F2F2F2'>(.*?)</tr>", txt, re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 3:
            continue
        name = html.unescape(re.sub(r"<[^>]+>", " ", cells[0])).strip()
        # Name | &nbsp; | Address (premise<br>street<br>SUBURB QLD pc…) | …
        addr_raw = re.split(r"<br\s*/?>", cells[2])
        addr_raw = [html.unescape(re.sub(r"<[^>]+>", " ", a)).strip() for a in addr_raw]
        addr = [a for a in addr_raw if a and re.sub(r"\s+", " ", a)]
        if not name or not addr:
            continue
        li = next((i for i, a in enumerate(addr) if re.search(r"\bQLD\b\s*\d{0,4}\s*$", a)), len(addr) - 1)
        tail = addr[li]
        bodies = addr[:li]
        m = re.match(r"^(.*?)\s*QLD\s*(\d{4})?\s*$", tail)
        sub = (m.group(1) or "").strip().title() if m else tail
        pc = (m.group(2) if m and m.group(2) else "")
        rec = {
            "n": name,
            "prem": bodies[0] if bodies else "",
            "street": ", ".join(bodies[1:]) if len(bodies) > 1 else "",
            "sub": re.sub(r"\bMc([a-z])", lambda x: "Mc" + x.group(1).upper(), sub),
            "pc": pc,
        }
        key = norm_key(name)
        if key in out and (out[key]["prem"], out[key]["street"], out[key]["sub"]) != (rec["prem"], rec["street"], rec["sub"]):
            fail(f"pre-poll roll: {name!r} files two addresses"
                 f" ({out[key]['prem']}|{out[key]['street']}|{out[key]['sub']}"
                 f" vs {rec['prem']}|{rec['street']}|{rec['sub']})")
        out[key] = rec
        stem = norm_key(re.sub(r"\s*\(.*?\)\s*$", "", name))
        if stem != key:
            prev = aliases.get(stem)
            if prev is not None and prev != "AMBIGUOUS" and \
                    (prev["n"], prev["prem"], prev["street"], prev["sub"]) != (rec["n"], rec["prem"], rec["street"], rec["sub"]):
                # the office reappears in all 93 blocks; a DIFFERENT office
                # claiming the same stem is ambiguous and never aliases
                aliases[stem] = "AMBIGUOUS"
            elif prev is None:
                aliases[stem] = rec
    for k, rec in aliases.items():
        if k not in out and rec != "AMBIGUOUS":
            out[k] = rec
    if len(out) < 150:
        fail(f"pre-poll roll parsed {len(out)} offices, expected ~160")
    return out


def _evc_coords(name, sub, roll):
    """2017 'X Pre-Poll' ↔ VRS-era 'X Early Voting Centre' coords: locality
    stem + the VRS name's 'early voting' marker, asserted unique."""
    stem = norm_key(re.sub(r"\s*Pre-[Pp]oll\b.*$", "", name))
    cands = []
    for rec in roll.get(norm_key(f"{stem} Early Voting Centre"), []) or []:
        cands.append(rec)
    if not cands:
        for key, recs in roll.items():
            for rec in recs:
                if norm_key(rec["sub"]) == stem and "early voting" in key:
                    cands.append(rec)
    uniq = {(round(c["lat"], 4), round(c["lon"], 4)) for c in cands if c["lat"]}
    if len(uniq) == 1:
        return cands[0]
    return None


def _2017_classify(vname):
    """One 2017 FPV numbered row -> lane class.
    'admin' rows are vote lumps (every district's RO pre-poll rows, the
    All-Districts centres — suffixed 'Pre-Poll' or not — telephone and
    e-assist lines, and the electoral-visit teams): never the map lane;
    their votes fold into the district totals. The district's OWN RO
    pre-poll row is the lump of its pre-poll centres' votes (2017 published
    no per-EVC breakdown) — admin by the same token."""
    if re.match(r"^Returning Officer .+ Pre-[Pp]oll$", vname):
        return "ro"
    if re.match(r"^.+ All-Districts Centre( Pre-[Pp]oll)?$", vname):
        return "admin"
    if re.match(r"^Telephone Voting", vname) or re.match(r"^eAssist\b", vname):
        return "admin"
    if re.match(r"^Electoral Visit$", vname):
        return "admin"
    if re.match(r"^Mobile Team \d+$", vname):
        # the era's roving teams (three rows election-wide, 2017): real
        # results under a mobile principle — the lane's ty 4, venue-free
        return "mobile"
    if re.match(r"^.+ Pre-[Pp]oll\b", vname):
        # the era's named early voting centres (Ayr Pre-Poll, Bowen
        # Pre-poll, …) — a district's own real EVC rows, ty 5
        return "evc"
    return "day"


def load2017():
    """The whole 2017 election (Ektron era), into the ElectionData shape."""
    roll = vrs_coord_roll()
    prepoll_roll = parse_prepoll_roll()
    districts = []
    targets = {"geocoord": 0, "day_venues": 0, "evc_venues": 0, "mobile_venues": 0}
    for n in range(1, 94):
        dsum = read17(f"district{n}.html.gz")
        m = re.search(r"(\d{4}) State General Election - (.*?) -?\s*District Summary", dsum)
        if not m or m.group(1) != "2017":
            fail(f"district{n}.html: title not the 2017 district-summary shape")
        dname = m.group(2).strip()

        enr_m = re.search(r"Electors at Close of Roll:\s*</td>\s*<td[^>]*>\s*([\d,]+)", dsum)
        enrolled = _num(enr_m.group(1)) if enr_m else None
        if enrolled is None:
            fail(f"{dname}: no Electors at Close of Roll figure")

        # roster: Candidate | Party | Votes rows of the results table (the
        # walk .build/parse-qld-state-flows.py's parse_district_summary runs)
        cands, fpv = [], {}
        seen = set()
        for r in re.findall(r"<tr.*?</tr>", dsum, re.S):
            c = _cells(r)
            if len(c) >= 3 and "," in c[0] and _num(c[2]) is not None and re.fullmatch(r"[A-Z0-9]{0,6}", c[1] or ""):
                key = ballot_to_name(c[0])
                if key in seen:
                    fail(f"{dname}: candidate {key!r} twice on the roster")
                seen.add(key)
                cands.append({"key": key, "n": key, "ab": code_ab(c[1].strip()), "pn": ""})
                fpv[key] = _num(c[2]) or 0
        if not cands:
            fail(f"{dname}: summary page's candidate table did not parse")
        tot_m = re.search(r"Total Formal Votes</span>.*?<span class=\"totalLabelOrValue\">\s*([\d,]+)", dsum, re.S)
        inf_m = re.search(r"Total Informal</span>.*?<span class=\"totalLabelOrValue\">\s*([\d,]+)", dsum, re.S)
        formal = _num(tot_m.group(1)) if tot_m else None
        informal = _num(inf_m.group(1)) if inf_m else None
        if formal is None or informal is None:
            fail(f"{dname}: summary page totals row did not parse")
        if sum(fpv.values()) != formal:
            fail(f"{dname}: roster sum {sum(fpv.values())} != recorded formal {formal}")

        doc = read17(f"booth{n}.html.gz")
        m2 = re.search(r"(\d{4}) State General Election - (.*?) -?\s*Booth Details", doc)
        if not m2 or m2.group(2).strip() != dname:
            fail(f"booth{n}: title district {m2.group(2).strip() if m2 else '?'} != summary's {dname}")
        fpv_rows, dop_rows = _fpv_table_rows(doc)
        dop = _dop_summary(dop_rows)
        keys = [c["key"] for c in cands]
        dop_names = [ballot_to_name(x) for x in dop["names"]]
        if sorted(dop_names) != sorted(keys):
            fail(f"{dname}: DoP candidates != roster")
        # rekey the DoP products onto roster keys
        raw_to_key = dict(zip(dop["names"], dop_names))
        dop_fpv = {raw_to_key[k2]: v for k2, v in dop["fpv"].items()}
        if dop_fpv != fpv:
            fail(f"{dname}: DoP first preferences disagree with the summary totals")
        tcp = {raw_to_key[k2]: v for k2, v in dop["tcp"].items()}
        tcp = dict(sorted(tcp.items(), key=lambda kv: -kv[1]))
        elected = next(iter(tcp))

        # profile venue roll (premise/suburb per day booth)
        prof = parse_profile(read17(f"profile{n}.html.gz"))

        header = next((r for r in fpv_rows if r and r[0] == "No."), None)
        if header is None:
            fail(f"{dname}: no FPV header row")
        k = len(keys)
        head_cols = []
        for c in header[2:2 + k]:
            mm = re.match(r"^(.*)\s+[A-Z][A-Z0-9]{1,6}$", c)
            # independents' header cells carry no party code: name only
            head_cols.append(ballot_to_name(mm.group(1)) if mm and "," in mm.group(1) else ballot_to_name(c))
        if sorted(head_cols) != sorted(keys):
            fail(f"{dname}: FPV header candidates != roster")

        def rowvals(r):
            # numbered rows carry two label cells (No., booth), trailer rows one
            off = 2 if r[0].isdigit() else 1
            out = {}
            for j, col in enumerate(head_cols):
                i = off + 2 * j
                v = _num(r[i]) if i < len(r) else None
                if v is None:
                    fail(f"{dname}: cell ({r[:1]}, {col}) not a number")
                out[col] = v
            return out

        numbered = [r for r in fpv_rows if r and r[0].isdigit()]
        trailers = {}
        for r in fpv_rows:
            if r and r[0] and not r[0].isdigit() and r[0] not in HEADER_ROW_MARKERS:
                trailers[r[0]] = r
        missing_t = [t for t in ("Polling Booth Totals", "Declaration Votes Totals") if t not in trailers]
        if missing_t:
            fail(f"{dname}: trailers {missing_t} missing from the FPV table")

        day_rows, evc_rows, mobile_rows, admin_rows = [], [], [], []
        for r in numbered:
            vname = r[1]
            cls = _2017_classify(vname)
            (day_rows if cls == "day" else evc_rows if cls == "evc" else
             mobile_rows if cls == "mobile" else admin_rows).append(r)

        pbt = rowvals(trailers["Polling Booth Totals"])
        dvt = rowvals(trailers["Declaration Votes Totals"])
        real_sum = {kk: 0 for kk in head_cols}
        for r in day_rows + evc_rows + mobile_rows:
            for kk, vv in rowvals(r).items():
                real_sum[kk] += vv
        admin_sum = {kk: 0 for kk in head_cols}
        for r in admin_rows:
            for kk, vv in rowvals(r).items():
                admin_sum[kk] += vv
        for kk in head_cols:
            if real_sum[kk] + admin_sum[kk] != pbt[kk]:
                fail(f"{dname}: real+admin rows {real_sum[kk]}+{admin_sum[kk]} != Polling Booth Totals {pbt[kk]} ({kk})")
            if pbt[kk] + dvt[kk] != fpv[kk]:
                fail(f"{dname}: PollingBooth+DeclarationTotals {pbt[kk]}+{dvt[kk]} != summary formal {fpv[kk]} ({kk})")

        # informal doctrine: the numbered rows' informal plus the declaration
        # block's informal equals the summary's Total Informal — the seven
        # declaration rows carry their own informal counts. Row layout:
        # (label cells) | (votes, %)*k | formal | informal, % | total, %district
        def inf_of(r):
            off = 2 if r[0].isdigit() else 1
            i = off + 1 + 2 * k
            return _num(r[i]) if len(r) > i else 0
        inf_num = sum(inf_of(r) or 0 for r in numbered)
        decl_sum = 0
        for lbl in DECLARATION_ROWS:
            r = trailers.get(lbl)
            if r is None:
                fail(f"{dname}: declaration row {lbl!r} missing")
            decl_sum += inf_of(r) or 0
        if inf_num + decl_sum != informal:
            fail(f"{dname}: informal doctrine {inf_num}+{decl_sum} != summary {informal}")

        no_tr = [r[0] for r in numbered if _2017_classify(r[1]) == "day" and norm_key(r[1]) not in prof]
        if no_tr:
            fail(f"{dname}: day rows with no profile-roll venue: {no_tr[:4]}")

        booths = []
        lane_formal = 0
        EMPTY_VENUE = {"prem": "", "street": "", "sub": "", "pc": ""}
        for cls_rows, ty, facts_of, coords_of in (
            (day_rows, 1,
             lambda nm: prof[norm_key(nm)],
             lambda nm, venue: join_coords(nm, venue["sub"], roll)),
            (evc_rows, 5,
             lambda nm: prepoll_roll.get(norm_key(nm)) or fail(f"{dname}: pre-poll {nm!r} not in the roll"),
             lambda nm, venue: _evc_coords(nm, venue["sub"], roll)),
            (mobile_rows, 4,
             lambda nm: EMPTY_VENUE,
             lambda nm, venue: None),
        ):
            for r in cls_rows:
                vname = r[1]
                venue = facts_of(vname)
                coord = coords_of(vname, venue)
                if coord:
                    targets["geocoord"] += 1
                votes = rowvals(r)
                row_formal = _num(r[2 + 2 * k]) or 0
                if sum(votes.values()) != row_formal:
                    fail(f"{dname}: booth {vname!r} candidate sum {sum(votes.values())}"
                         f" != its formal column {row_formal}")
                lane_formal += sum(votes.values())
                booths.append({
                    "name": vname,
                    "ty": ty,
                    "pseudo": False,
                    "venue": {
                        "prem": venue["prem"], "street": venue["street"], "sub": venue["sub"],
                        "pc": venue.get("pc") or (coord["pc"] if coord else ""),
                        "lat": coord["lat"] if coord else None,
                        "lon": coord["lon"] if coord else None,
                    },
                    "formal": sum(votes.values()),
                    "informal": inf_of(r) or 0,
                    "ballots": None,
                    "pv": votes,
                    "tcp": None,
                })
                targets["mobile_venues" if ty == 4 else "evc_venues" if ty == 5 else "day_venues"] += 1

        # admin rows' votes fold into district totals (kept for the lane-coverage check)
        admin_votes = sum(sum(rowvals(r).values()) for r in admin_rows)
        if lane_formal + admin_votes != sum(pbt.values()):
            fail(f"{dname}: lane+admin formal {lane_formal}+{admin_votes} != Polling Booth Totals {sum(pbt.values())}")

        districts.append({
            "name": dname, "enrolled": enrolled, "cands": cands,
            "elected": elected, "fpv": fpv, "formal": formal, "informal": informal,
            "booths": booths,
            "admin_formal": admin_votes,
            "tcp": {"k": list(tcp), "v": list(tcp.values())},
            "unmatched_tcp_booths": len(booths),
        })
    return {"frame": "qld17", "districts": districts,
            "coverage": dict(targets)}


def load(frame):
    if frame in ("qld20", "qld24"):
        return load_vrs(frame)
    if frame == "qld17":
        return load2017()
    fail(f"unknown frame {frame!r}")
