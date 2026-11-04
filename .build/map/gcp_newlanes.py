"""GCP-2021 new-lane cell counts for the /map/ state-frame census joins.

One tiny reader shared by build_sa_boothcensus.py, build_sa26_demo.py,
build_nsw23_boothcensus.py and build_nsw23_demo.py: the six new People
lanes' per-SA1 counts from the 2021 GCP SA1 datapack, keyed one row
plainly so each caller folds/shares with its own safe()/acc recipe.
This module deliberately re-reads the tables rather than import the
federal seat-model pipelines; the column choices and bases IDENTICALLY
mirror derive-booth-seifa-voter.py's new-lane tables (the sess stores
pin them), namely:

  G01 — the six highest-year-of-schooling persons columns (the
        y12less lane's numerator = the five sub-Year-12 printed
        levels, denominator their stated sum)
  G07 — Indigenous status, the table's OWN Tot row (the per-band
        Indigenous columns individually suppress small cells and
        underread a fifth nationally)
  G14 — the Religion menu's ten categories plus affiliation-not-stated
        and total (ex-not-stated persons basis; orth = Eastern +
        Oriental orthodox)
  G32 — family composition totals (one-parent over all four totals)
  G37 — tenure by landlord totals (owned/mortgaged/rented-all/
        rented-state-housing-authority/other, over the
        ex-tenure-not-stated occupied-private-dwellings basis)

keys emitted: G01 {code: 6-tuple}, G07 {code: (indig, indig+nonindig)},
G14 {code: (relvec10, relNS, relTot)}, G32 {code: (onepar, famTot)},
G37 {code: (own, mort, rent, rentPub, othType, tenNS)}.
"""

import csv
import io
import json
import os
import zipfile

_REPO = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", ".."))


def hl_alloc_of(ed, form):
    """The homeless lane's est-allocation (2026-10-31 lanes arc):
    {unit: {"e": est, "p": pop}} per edition's key form ("m"
    SA1-main | "c7" cube-7-digit), from
    .build/analysis/seat-model/cache/homeless-sa1-<ed>-alloc.json —
    derive-booth-homeless era reads via homeless_alloc.alloc_of; the
    state frames read the same caches through this mirror (the module
    deliberately stays seat-model-free, like the rest of its readers)."""
    p = os.path.join(_REPO, ".build/analysis/seat-model/cache",
                     f"homeless-sa1-{ed}-alloc.json")
    if not os.path.exists(p):
        _fail(f"missing {p} (run .build/analysis/seat-model/"
              "homeless_alloc.py)")
    d = json.load(open(p, encoding="utf-8"))
    if form not in d or not d[form]:
        _fail(f"homeless alloc {ed}/{form}: empty form")
    return d[form]


GCP_ZIP = None  # set via connect(); module stays import-light (no heavy read)
GCP_ROWS = 61844
GCP16_ROWS = 57523
# per-vintage member table ids: the same concepts ride differently-
# numbered tables per GCP edition (tenure's landlord grid is G37 in
# 2021, G33 in 2016; family composition G32 vs G28; the religion and
# Indigenous-status names are edition-stable)
VINTAGES = {
    "2021": dict(rows=GCP_ROWS,
                 member="2021 Census GCP Statistical Area 1 for AUS/"
                        "2021Census_{table}_AUST_SA1.csv",
                 key="SA1_CODE_2021", school="G01", indig="G07",
                 religion="G14", tenure="G37", family="G32",
                 income_family="G32", income_household="G33"),
    "2016": dict(rows=GCP16_ROWS,
                 member="2016 Census GCP Statistical Area 1 for AUST/"
                        "2016Census_{table}_AUS_SA1.csv",
                 key="SA1_7DIGITCODE_2016", school="G01", indig="G07",
                 religion="G14", tenure="G33", family="G28",
                 income_family="G28", income_household="G29"),
    # the Basic Community Profile is the GCP's pre-2016 form: same
    # concepts, differently-numbered tables (schooling/ages/language/
    # citizenship all ride B01; tenure grid B32; family composition
    # B25; religion B14; method of travel B46 carries the 2016
    # table's exact column spellings; ancestry splits its response
    # counts (B08A) from the persons denominator (B08B) — the only
    # two-table lane of the stack). Column spellings verified from
    # the zip's own headers 2026-11-04 (the vic14 frame's era);
    # BCP rows pin at 54,805 with every table complete.
    "2011": dict(rows=54805,
                 member="2011 Census BCP Statistical Areas Level 1 "
                        "for AUST/AUST/2011Census_{table}_AUST_SA1_"
                        "short.csv",
                 key="region_id", school="B01", indig="B07",
                 religion="B14", tenure="B32", family="B25",
                 fam_cols=("OPF_Total_P", "Total_P"),
                 income_family="B26", income_household="B28"),
}
DEMO_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
              "55_64", "65_74", "75_84", "85ov"]
AGE_COLS = [f"Age_{b}_yr_P" for b in DEMO_BANDS[:-1]] + ["Age_85ov_P"]
SCHOOL_COLS = ["High_yr_schl_comp_Yr_12_eq_P",
               "High_yr_schl_comp_Yr_11_eq_P",
               "High_yr_schl_comp_Yr_10_eq_P",
               "High_yr_schl_comp_Yr_9_eq_P",
               "High_yr_schl_comp_Yr_8_belw_P",
               "High_yr_schl_comp_D_n_g_sch_P"]
REL_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth", "budd",
            "isl", "hind", "jew"]
REL_MAP = {
    "norel": ["SB_OSB_NRA_NR_P"],
    "cath": ["Christianity_Catholic_P"],
    "angl": ["Christianity_Anglican_P"],
    "unch": ["Christianity_Uniting_Church_P"],
    "pres": ["Christinty_Prsbytrin_Refrmd_P"],
    "orth": ["Christianity_Eastrn_Orthdox_P",
             "Christianity_Orintal_Orthdx_P"],
    "budd": ["Buddhism_P"],
    "isl": ["Islam_P"],
    "hind": ["Hinduism_P"],
    "jew": ["Judaism_P"],
}
G14_TAIL = ["Religious_affiliation_ns_P", "Tot_P"]
# the 2011 BCP's B14 prints the no-religion row "No_Religion_P"
# (the GCPs' SB_OSB_NRA_NR_P); the other nine rows carry the GCP
# spellings verbatim (verified from the B14 header 2026-11-04)
REL_MAP_2011 = {**REL_MAP, "norel": ["No_Religion_P"]}
REL_MAP_BY_ERA = {"2011": REL_MAP_2011}
# ---- the 2026-10-31 people-lanes arc (public transport to work,
# non-citizens, women with three or more children, Ancestry): G01's
# Australian-citizens cell; the era's method-of-travel table (G62/G59);
# children-ever-born (G28/G24); ancestry (G08's Tot-response cells ex
# the ancestry-not-stated responses — a not-stated person counts
# exactly one not-stated response, so the NS response cell IS the
# person-level NS; people could name two ancestries and the shares
# are independent, never normalised). Column spellings drifted at
# 2021 (tram "or lt rail" and three-method train; G08's _Tot_resp
# lower-case). Reader table ids per vintage mirror
# derive-booth-seifa-voter.py's new_lane_tables arc block.
ANC_KEYS = ["english", "australian", "irish", "scottish", "chinese",
            "italian", "german", "indian", "filipino", "dutch",
            "vietnamese", "lebanese"]
ARC = {
    "2021": dict(travel="G62", children="G28", ancestry="G08",
                 tram="One_met_Tram_or_lt_rail_P",
                 three_tr="Three_meth_Tr_2_oth_meth_P",
                 resp_sfx="resp", ns_resp="Ancestry_NS_Tot_resp",
                 tot_resp="Tot_P_Tot_resp"),
    "2016": dict(travel="G59", children="G24", ancestry="G08",
                 tram="One_met_Tram_incl_lt_rail_P",
                 three_tr="Three_meth_Trn_two_othr_met_P",
                 resp_sfx="Resp", ns_resp="Ancestry_NS_Tot_Resp",
                 tot_resp="Tot_P_Tot_Resp"),
    # 2011 BCP: B46/B24 ride the 2016 column spellings verbatim;
    # ancestry's twelve response cells live in B08A with the
    # (lowercase-ns) not-stated response, while the persons
    # denominator is B08B's Tot_P_Tot_Resp — ancestry_tot splits
    # the lane across the two tables (both verified 2026-11-04)
    "2011": dict(travel="B46", children="B24", ancestry="B08A",
                 ancestry_tot="B08B",
                 tram="One_met_Tram_incl_lt_rail_P",
                 three_tr="Three_meth_Trn_two_othr_met_P",
                 resp_sfx="Resp", ns_resp="Ancestry_ns_Tot_Resp",
                 tot_resp="Tot_P_Tot_Resp"),
}


def load_arc31(gcp_zip, prefix="", era="2021", rows_pin=None,
               key_col=None):
    """The 2026-10-31 lanes arc per SA1 -> {code: (citz,
    (ptn, ptot, ptns), (ceb3p, cebns, cebtot), (ancvec12, ancTotP,
    ancNS))}; universes assert against load()'s own G01 set."""
    v = VINTAGES[era]
    a = ARC[era]
    memb = v["member"].format
    idc = key_col or v["key"]
    pin = rows_pin or v["rows"]
    z = zipfile.ZipFile(gcp_zip)
    g01c = _table(z, memb(table=v["school"]), idc,
                  ["Australian_citizen_P"], pin, prefix)
    mtw = _table(
        z, memb(table=a["travel"]), idc,
        ["One_method_Train_P", "One_method_Bus_P",
         "One_method_Ferry_P", a["tram"],
         "Two_methods_Train_Tot_P", "Two_methods_Bus_Tot_P",
         "Two_methods_Train_Bus_P", a["three_tr"],
         "Three_met_Bs_2_ot_met_ex_tr_P",
         "Tot_P", "Method_travel_to_work_ns_P"], pin, prefix)
    ceb = _table(z, memb(table=a["children"]), idc,
                 ["Tot_Nmbr_children_ever_born_3",
                  "Tot_Nmbr_children_ever_born_4",
                  "Tot_Nmbr_children_ever_born_5",
                  "Tot_Nmbr_chidrn_ever_brn_6_mr",
                  "Tot_Nmbr_childrn_ever_born_Ns", "Total_Total"],
                 pin, prefix)
    anc_cols = [f"{b}_Tot_{a['resp_sfx']}" for b in
                ("English", "Aust", "Irish", "Scottish", "Chinese",
                 "Italian", "German", "Indian", "Filipino", "Dutch",
                 "Vietnamese", "Lebanese")]
    if a.get("ancestry_tot"):
        # 2011 BCP shape: response cells + NS response in the ancestry
        # table, the persons denominator in its own B08B
        anc = _table(z, memb(table=a["ancestry"]), idc,
                     anc_cols + [a["ns_resp"]], pin, prefix)
        anct = _table(z, memb(table=a["ancestry_tot"]), idc,
                      [a["tot_resp"]], pin, prefix)
        if set(anc) != set(anct):
            _fail("arc-31 ancestry response/denominator SA1 sets diverge")
        anc = {c: anc[c] + anct[c] for c in anc}
    else:
        anc = _table(z, memb(table=a["ancestry"]), idc,
                     anc_cols + [a["ns_resp"], a["tot_resp"]], pin,
                     prefix)
    if not (set(g01c) == set(mtw) == set(ceb) == set(anc)):
        _fail("arc-31 SA1 universes diverge")
    out = {}
    for code in g01c:
        t = mtw[code]
        tr1, bu1, fe1, tm1, tr2, bu2, tb2, t3t, t3b = t[:9]
        ptn = tr1 + bu1 + fe1 + tm1 + tr2 + bu2 - tb2 + t3t + t3b
        c = ceb[code]
        anc_row = anc[code]
        out[code] = (g01c[code][0], (ptn, t[9], t[10]),
                     (c[0] + c[1] + c[2] + c[3], c[4], c[5]),
                     (anc_row[:len(ANC_KEYS)], anc_row[-1], anc_row[-2]))
    print(f"GCP arc-31 cells: {len(out)} SA1s (prefix {prefix or 'AU'}, "
          f"era {era})")
    return out


def _fail(msg):
    raise SystemExit(f"gcp-newlanes: {msg}")


def _table(z, member, idcol, cols, rows_pin, prefix):
    if member not in z.namelist():
        _fail(f"GCP zip lacks {member}")
    out = {}
    n = 0
    with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") as fh:
        rdr = csv.DictReader(fh)
        fn = rdr.fieldnames or []
        miss = [c for c in [idcol, *cols] if c not in fn]
        if miss:
            _fail(f"GCP {member.split('/')[-1]} header drift, missing {miss}")
        for row in rdr:
            n += 1
            code = row[idcol]
            if prefix and not code.startswith(prefix):
                continue
            if code in out:
                _fail(f"GCP {member.split('/')[-1]} dup code {code}")
            out[code] = tuple(int(row[c]) for c in cols)
    if n != rows_pin:
        _fail(f"GCP {member.split('/')[-1]} rows {n} != pin {rows_pin}")
    return out


def load(gcp_zip, prefix="", era="2021", rows_pin=None, key_col=None):
    """Every new-lane cell off a GCP SA1 datapack for one prefix
    ("1" NSW, "2" Vic, "3" Qld, "4" SA).
    -> {code: (school6, indt2, (relvec10, relns, reltot), ten6, fam2)}
    era is the GCP edition id key (its VINTAGES entry drives the member
    template, the G07/G14/G32/G37 table ids, the id column and the
    edition's national row pin)."""
    v = VINTAGES[era]
    memb = v["member"].format
    idc = key_col or v["key"]
    pin = rows_pin or v["rows"]
    z = zipfile.ZipFile(gcp_zip)
    rel_map = REL_MAP_BY_ERA.get(era, REL_MAP)
    fam_n, fam_d = v.get("fam_cols", ("Tot_One_parent_fam", "Tot_Tot"))
    g01 = _table(z, memb(table=v["school"]), idc, SCHOOL_COLS, pin, prefix)
    g07 = _table(z, memb(table=v["indig"]), idc,
                 ["Tot_Indigenous_P", "Tot_Non_Indigenous_P"], pin, prefix)
    g14 = _table(z, memb(table=v["religion"]), idc,
                 [c for k in REL_KEYS for c in rel_map[k]] + G14_TAIL,
                 pin, prefix)
    fam = _table(z, memb(table=v["family"]), idc,
                 [fam_n, fam_d], pin, prefix)
    ten = _table(z, memb(table=v["tenure"]), idc,
                 ["O_OR_Total", "O_MTG_Total", "R_Tot_Total",
                  "R_ST_h_auth_Total", "Oth_ten_type_Total",
                  "Ten_type_NS_Total"], pin, prefix)
    if not (set(g01) == set(g07) == set(g14) == set(fam) == set(ten)):
        _fail("new-lane SA1 universes diverge")
    out = {}
    for code in g01:
        r14 = g14[code]
        relvec = []
        i = 0
        for k in REL_KEYS:
            span = len(rel_map[k])
            relvec.append(sum(r14[i:i + span]))
            i += span
        out[code] = (g01[code],
                     (g07[code][0], g07[code][0] + g07[code][1]),
                     (tuple(relvec), r14[-2], r14[-1]),
                     ten[code],
                     (fam[code][0], fam[code][1]))
    print(f"GCP new-lane cells: {len(out)} SA1s (prefix {prefix or 'AU'}, era {era})")
    return out


def y12less_cell(school6, safe):
    """The share cell from the six schooling counts using the caller's
    safe()/bounded recipe."""
    return safe(sum(school6[1:]), sum(school6))


def u15_cell(bands, safe):
    """Under-15 share of the stated ages."""
    return safe(bands[0] + bands[1], sum(bands))


# ---- the six canonical venue-demo cells' raw counts -----------------
# the [lang, a65, a2034, fborn, uni, blue] reads every frame's booth-
# level census join shares, keyed one row plainly so each caller folds/
# shares with its own safe() recipe. Per-era table ids and column
# prints are identical to the district people stores': G01|B01 carries
# persons, the language pair and the eleven age bands; birthplace
# totals ride G09F+G09H on the GCP editions and the single B09 on the
# 2011 BCP; higher education B40B/G46B/G49B and occupation
# B45B/G57B/G60B. Column prints verified from the packs' own headers
# 2026-11-04 (the vic14/vic18 district stores' constants).
BASE_UNI_COLS = ["P_PGrad_Deg_Total", "P_GradDip_and_GradCert_Total",
                 "P_BachDeg_Total", "P_Lev_Edu_NS_Total"]
BASE_OCC_COLS = ["P_Tot_Managers", "P_Tot_Professionals",
                 "P_Tot_TechnicTrades_W", "P_Tot_CommunPersnlSvc_W",
                 "P_Tot_ClericalAdminis_W", "P_Tot_Sales_W",
                 "P_Tot_Mach_oper_drivers", "P_Tot_Labourers"]
_BASE_TABLES = {
    "2021": dict(lang=("Lang_used_home_Eng_only_P",
                       "Lang_used_home_Oth_Lang_P"),
                 cob_tab="G09F", aust_col="P_Australia_Tot",
                 cobt_tab="G09H", tot_col="P_Tot_Tot",
                 ns_col="P_COB_NS_Tot", uni="G49B", occ="G60B"),
    "2016": dict(lang=("Lang_spoken_home_Eng_only_P",
                       "Lang_spoken_home_Oth_Lang_P"),
                 cob_tab="G09F", aust_col="P_Australia_Tot",
                 cobt_tab="G09H", tot_col="P_Tot_Tot",
                 ns_col="P_COB_NS_Tot", uni="G46B", occ="G57B"),
    "2011": dict(lang=("Lang_spoken_home_Eng_only_P",
                       "Lang_spoken_home_Oth_Lang_P"),
                 cob_tab="B09", aust_col="Australia_P",
                 cobt_tab="B09", tot_col="Tot_P",
                 ns_col="Country_birth_not_stated_P",
                 uni="B40B", occ="B45B"),
}

_DEMO_BASE_SITES = {}


def demo_base(gcp_zip, prefix="", era="2021", rows_pin=None,
              key_col=None):
    """The venue-demo lanes' raw counts per SA1 for one prefix
    ("2" Vic on the vic14/vic18 frames):
    {code: (totP, langEng, langOth, bands11, aust, cobTot, cobNS,
            uni4, occ8)} — every numerator and denominator a caller's
    safe() divides for the six canonical people cells
    ([lang, a65, a2034, fborn, uni, blue] on the district people
    lanes' bases); the caller folds occ8 (blue = oc2+oc6+oc7) and
    uni4 (three degrees, less level-not-stated) with its own recipe."""
    v = VINTAGES[era]
    b = _BASE_TABLES[era]
    key = (gcp_zip, prefix, era)
    if key in _DEMO_BASE_SITES:
        return _DEMO_BASE_SITES[key]
    memb = v["member"].format
    idc = key_col or v["key"]
    pin = rows_pin or v["rows"]
    z = zipfile.ZipFile(gcp_zip)
    g01 = _table(z, memb(table=v["school"]), idc,
                 ["Tot_P_P", *b["lang"], *AGE_COLS], pin, prefix)
    if b["cob_tab"] == b["cobt_tab"]:
        cobr = _table(z, memb(table=b["cobt_tab"]), idc,
                      [b["aust_col"], b["tot_col"], b["ns_col"]],
                      pin, prefix)
    else:
        cobf = _table(z, memb(table=b["cob_tab"]), idc,
                      [b["aust_col"]], pin, prefix)
        cobh = _table(z, memb(table=b["cobt_tab"]), idc,
                      [b["tot_col"], b["ns_col"]], pin, prefix)
        if set(cobf) != set(cobh):
            _fail("demo-base birthplace G09 SA1 sets diverge")
        cobr = {c: (cobf[c][0], cobh[c][0], cobh[c][1]) for c in cobf}
    uni = _table(z, memb(table=b["uni"]), idc, BASE_UNI_COLS, pin,
                 prefix)
    occ = _table(z, memb(table=b["occ"]), idc, BASE_OCC_COLS, pin,
                 prefix)
    if not (set(g01) == set(cobr) == set(uni) == set(occ)):
        _fail("demo-base SA1 universes diverge")
    out = {}
    for code, r in g01.items():
        out[code] = (r[0], r[1], r[2], tuple(r[3:]),
                     cobr[code][0], cobr[code][1], cobr[code][2],
                     uni[code], occ[code])
    _DEMO_BASE_SITES[key] = out
    label = "BCP" if era == "2011" else "GCP"
    print(f"{label} demo-base cells: {len(out)} SA1s "
          f"(prefix {prefix or 'AU'}, era {era})")
    return out


def band_median(masses, bands=None):
    """Interpolated median weekly household income ($) of a household-
    band histogram at wherever it lives (matching income_lanes'
    band_median's rule; interpolated linearly inside its median band,
    None on an empty histogram or an open top band)."""
    bands = bands or INC_BANDS
    tot = sum(masses)
    if tot <= 0:
        return None
    half = tot / 2
    cum = 0.0
    for i, (lo, hi) in enumerate(bands):
        cum2 = cum + masses[i]
        if cum2 >= half:
            if hi is None or masses[i] == 0:
                return None
            return lo + (hi - lo + 1) * (half - cum) / masses[i]
        cum = cum2
    return None


# ----- the 2021-era income lanes, state-frame profile -----------------
# the same arithmetic the GCP venue era runs on the federal frames
# (income_lanes.engine 01/06-era + derive-booth-seifa-voter's
# compute): each SA1's household-band masses re-weighted to adults by
# (fam share × adults-per-family-type factor + non-family × the lone-
# person factor), clamped fam share, national mix as empty fallback —
# except the cut and the top share are computed on the PREFIX-filtered
# state universe, so every state frame's incomeCuts record is its own
# jurisdiction figure, never a borrowed national one.
import json as _json

INC_BANDS = [(1, 149), (150, 299), (300, 399), (400, 499), (500, 649),
             (650, 799), (800, 999), (1000, 1249), (1250, 1499),
             (1500, 1749), (1750, 1999), (2000, 2499), (2500, 2999),
             (3000, 3499), (3500, 3999), (4000, None)]
_INC_HIGH_EDGE = 4000
_INC_LO_Q = 0.25
_INC_HI_Q = 0.75  # the HIGH lane's state-universe top-quartile cut
_INC_CUT_GUARDS = {
    # measured 2026-10-31 from the first full runs (the cuts record
    # sits inside its band; a profile migration outside its own band
    # trips the chain):
    #   2021 census: NSW 888.77 / Vic 882.13 / Qld 863.16 / SA 761.65/week
    #   2016 census: Qld 721.76/week (qld17's own vintage)
    "1": (820, 980),  # NSW
    "2": (820, 980),  # Vic
    "3": (700, 950),  # Qld, covering both of its census vintages
    "4": (700, 930),  # SA
}
# plausible windows for each universe's 75th-percentile (top-quartile)
# cut, era-keyed like _INC_CUT_GUARDS above
_INC_HIQ_GUARDS = {
    "2021": {"1": (2900, 3600), "2": (2850, 3500),
             "3": (2700, 3300), "4": (2400, 3100)},
    "2016": {"1": (2600, 3000), "2": (2200, 2600), "3": (2200, 3000)},
    # NSW 2016-era 75% cut measured $2,794.98/wk 2026-11-04 (the
    # shared _INC_CUT_GUARDS 820-980 window holds its 25% cut 911.45,
    # so no by-era lo-guard entry is needed for it)
}
# era-specific 25th-percentile cut windows, keyed (era, prefix); these
# override _INC_CUT_GUARDS when the same prefix's window moves between
# census editions (Vic's own cut measured $882.13/wk at 2021 but
# $741.01/wk at the 2016 edition, 2026-11-04 — unlike Qld's, one window
# cannot span both)
_INC_CUT_GUARDS_BY_ERA = {
    ("2016", "2"): (680, 810),
}
_INC_SITES = {}


def _income_factors():
    """Adults-per-household factors from data/income-dist.json (the
    mirror lane of income_lanes.income_factors's load — kept
    import-free so the map builders run inside their -I isolation)."""
    path = os.path.join(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__)))),
        "data", "income-dist.json")
    if not os.path.exists(path):
        _fail(f"missing data/income-dist.json (looked at {path})")
    ax = _json.loads(open(path).read())["axes"]["household"]
    adults_per = ax["adultsPer"]
    return ((adults_per["coupleNoChildren"],
             adults_per["coupleWithChildren"],
             adults_per["oneParent"], adults_per["otherFamily"]),
            adults_per["nonFamily"])


def state_income(gcp_zip, era, prefix):
    """Per-SA1 income cohorts for a state prefix: returns
    (cohorts, cutrec) with cohorts keyed SA1 code ->
    (adults, loMass, hiMass, medIncWeekly,
    (16 adults-band masses), (16 household-band masses)),
    and cutrec the frame's own incomeCuts record (cut over
    the prefix universe only)"""
    key = f"{era}:{prefix}"
    if key in _INC_SITES:
        return _INC_SITES[key]
    ad, nonfam = _income_factors()
    v = VINTAGES[era]
    memb = v["member"].format
    bands = INC_BANDS
    nb = len(bands)
    z = zipfile.ZipFile(gcp_zip)
    pin = v["rows"]

    def band_h(band):
        lo, hi = band
        return f"{lo}_{hi}" if hi is not None else f"{lo}_{hi}_more" \
            .replace("_None", "")
    cols32_extra = ["Neg_Nil_inc_cpl_fam_no_child",
                    "Neg_Nil_inc_cpl_fam_wth_chld",
                    "Neg_Nil_inc_One_parent_fam",
                    "Neg_Nil_inc_Other_fam", "Neg_Nil_inc_Tot"]
    # ABS names its OWN "with children" type-variant per band ("with"
    # shortens to "wth" at the print's $800 figure; the Neg_Nil families
    # use the short form for every band)
    types_ = (("cpl_fam_no_child", "cpl_fam_no_child"),
              ("cpl_fam_with_child", "cpl_fam_wth_chld"),
              ("One_parent_fam", "One_parent_fam"),
              ("Other_fam", "Other_fam"), ("Tot", "Tot"))
    fh32nh = io.TextIOWrapper(
        z.open(memb(table=v["income_family"])),
        encoding="utf-8-sig")
    have32 = next(csv.reader(fh32nh))
    strip = next(csv.DictReader(fh32nh))
    fh32nh.close()
    col_of = {}
    for (lo, hi) in bands:
        for want_full, want_short in types_:
            stem = f"FI_{band_h((lo, hi))}_{want_full}"
            if stem in have32:
                col_of[(lo, want_full)] = stem
                continue
            stem = f"FI_{band_h((lo, hi))}_{want_short}"
            if stem in have32:
                col_of[(lo, want_full)] = stem
                continue
            _fail(f"family-income table lacks a {want_full} column at band "
                  f"{band_h((lo, hi))} (tried the full and short print "
                  "forms)")
    cols32 = [col_of[(lo, w)] for (lo, hi) in bands
              for w, _s in types_]
    g32 = _table(z, memb(table=v["income_family"]), v["key"],
                 cols32_extra + cols32, pin, prefix)
    cols33 = [f"HI_{band_h(b)}_Tot" for b in bands]
    g33 = _table(z, memb(table=v["income_household"]), v["key"],
                 ["Negative_Nil_income_Tot"] + cols33, pin, prefix)

    rows = {}
    for code in set(g33) & set(g32):
        r33 = g33[code]
        neg33 = int(r33[0])
        hhs = [int(x) for x in r33[1:]]
        hh = [hhs[i] + (neg33 if i == 0 else 0) for i in range(nb)]
        r32 = g32[code]
        fi = [int(r32[(4 + i * 5) + 4]) + (int(r32[4]) if i == 0 else 0)
              for i in range(nb)]
        mix = [[int(r32[(4 + i * 5) + j]) + (int(r32[j]) if i == 0 else 0)
                for j in range(4)] for i in range(nb)]
        rows[code] = (tuple(hh), tuple(fi), tuple(tuple(m) for m in mix))
    nat = {"b": [0.0] * nb, "fi": [0.0] * nb,
           "mix": [[0.0] * 4 for _ in range(nb)]}
    for hh, fi, mix in rows.values():
        for i in range(nb):
            nat["b"][i] += hh[i]
            nat["fi"][i] += fi[i]
            for k in range(4):
                nat["mix"][i][k] += mix[i][k]
    nat_famper, nat_fams = [], []
    for i in range(nb):
        if sum(nat["mix"][i]) <= 0 or nat["b"][i] <= 0:
            _fail(f"state {prefix}: income band {bands[i]} "
                  "empty national mix")
        nat_famper.append(sum(m * a for m, a in zip(nat["mix"][i], ad))
                          / sum(nat["mix"][i]))
        nat_fams.append(min(1.0, nat["fi"][i] / nat["b"][i]))
    nat_adults = [nat["b"][i] * (nat_fams[i] * nat_famper[i]
                                 + (1 - nat_fams[i]) * nonfam)
                  for i in range(nb)]
    nat_tot = sum(nat_adults)
    cum, cut = 0.0, None
    for i, (lo, hi) in enumerate(bands):
        cum += nat_adults[i] / nat_tot
        if cum >= _INC_LO_Q:
            prev = cum - nat_adults[i] / nat_tot
            f = (_INC_LO_Q - prev) / (nat_adults[i] / nat_tot)
            if hi is None:
                _fail(f"state {prefix}: income 25% cut lands the open band")
            cut = lo + f * (hi - lo + 1)
            break
    gloQ, ghiQ = _INC_CUT_GUARDS_BY_ERA.get(
        (str(era), prefix), _INC_CUT_GUARDS.get(prefix, (800, 1900)))
    if cut is None or not gloQ <= cut <= ghiQ:
        _fail(f"state {prefix}: income 25% cut {cut} outside guard "
              f"{gloQ}..{ghiQ}")
    cum, cut75 = 0.0, None
    for i, (lo, hi) in enumerate(bands):
        cum += nat_adults[i] / nat_tot
        if cum >= _INC_HI_Q:
            prev = cum - nat_adults[i] / nat_tot
            f = (_INC_HI_Q - prev) / (nat_adults[i] / nat_tot)
            if hi is None:
                _fail(f"state {prefix}: income 75% cut lands the open band")
            cut75 = lo + f * (hi - lo + 1)
            break
    guq = _INC_HIQ_GUARDS.get(str(era), {}).get(prefix)
    if cut75 is None or (guq is not None
                         and not guq[0] <= cut75 <= guq[1]):
        _fail(f"state {prefix}: income 75% cut {cut75} outside guard "
              f"{guq}")
    hi_share = nat_adults[-1] / nat_tot
    if not 0.05 <= hi_share <= 0.25:
        _fail(f"state {prefix}: income top-band share {hi_share:.4f} "
              "outside 5-25%")

    out = {}
    for code, (hh, fi, mix) in rows.items():
        bands_ad = []
        for i in range(nb):
            mixn = sum(mix[i])
            famper = (sum(m * a for m, a in zip(mix[i], ad)) / mixn
                      if mixn > 0 else nat_famper[i])
            fams = min(1.0, fi[i] / hh[i]) if hh[i] > 0 else nat_fams[i]
            bands_ad.append(hh[i] * (fams * famper + (1 - fams) * nonfam))
        tsum = sum(bands_ad)
        lo_mass = 0.0
        for i, (lo, hi) in enumerate(bands):
            if cut <= lo:
                continue
            if hi is not None and cut > hi:
                lo_mass += bands_ad[i]
                continue
            lo_mass += bands_ad[i] * (cut - lo) / (hi - lo + 1)
            break
        hiq_mass = tsum
        for i, (lo, hi) in enumerate(bands):
            if cut75 <= lo:
                break
            if hi is not None and cut75 > hi:
                hiq_mass -= bands_ad[i]
                continue
            hiq_mass -= bands_ad[i] * (cut75 - lo) / (hi - lo + 1)
            break
        tot = sum(hh)
        med = None
        if tot > 0:
            half = tot / 2
            acc = 0.0
            for i, (lo, hi) in enumerate(bands):
                acc2 = acc + hh[i]
                if acc2 >= half:
                    if hi is not None and hh[i] > 0:
                        med = int(round(lo + (hi - lo + 1)
                                        * (half - acc) / hh[i]))
                    break
                acc = acc2
        out[code] = (tsum, lo_mass, bands_ad[-1], med,
                     tuple(bands_ad), tuple(hh), hiq_mass)
    cutrec = {"loQuantile": _INC_LO_Q, "loCutWeekly": round(cut, 2),
              "hiQuantile": _INC_HI_Q, "hiQCutWeekly": round(cut75, 2),
              "hiEdgeWeekly": _INC_HIGH_EDGE,
              "hiNationalShare": round(hi_share, 6),
              "dollarsYear": int(era)}
    _INC_SITES[key] = (out, cutrec)
    print(f"GCP income cells: {len(out)} SA1s (prefix {prefix}, "
          f"era {era}, cut {cut:.0f}, hi-top {hi_share:.4f})")
    return _INC_SITES[key]


# ----- the 2011-BCP income lanes, state-frame profile ------------------
# the vic14 frame's era: the BCP prints the SAME family-by-household
# income grids as B26 (families, by composition) and B28 (households)
# over its FOURTEEN-band 2011-dollar grid (the $4,000+ open top band is
# the same dollar edge the 16-band GCP grids pin; what moves per census
# year is the share). Column choices and the Negative/Nil fold mirror
# derive-booth-demo-2013.py's income_bcp verbatim (this is its
# state-prefix sibling: the quantile cuts are computed over the
# PREFIX-filtered state universe, never nationally, matching
# state_income's discipline above). Fi-band family-type column PRINTS
# drift mid-table in 2011 (cpl_fam_with_child shortens per band), so
# type columns resolve per band by stem+regex, never positionally.
INC_BANDS14 = [(1, 199), (200, 299), (300, 399), (400, 599), (600, 799),
               (800, 999), (1000, 1249), (1250, 1499), (1500, 1999),
               (2000, 2499), (2500, 2999), (3000, 3499), (3500, 3999),
               (4000, None)]
_INC14_CUT_GUARDS = {
    # Vic ("2") and NSW ("1"), measured 2026-11-04 on the shipped
    # function: adults-basis 25% cut $735.47/wk (Vic), $726.94/wk
    # (NSW; the national-universe 2011 pin is $738 — the state records
    # are their own universes'), windows centred on the measurements
    "1": (680, 800),
    "2": (680, 800),
}
# Vic 75% cut measured $2,325.59/wk; NSW's $2,449.89/wk (national's
# own $2,386.71)
_INC14_HIQ_GUARDS = {"1": (2250, 2650), "2": (2140, 2520)}
# Vic top-band ($4,000+) adults share measured 0.0405; NSW's 0.0523
_INC14_HI_SHARE_GUARDS = {"1": (0.035, 0.075), "2": (0.025, 0.075)}
_INC14_SITES = {}


def state_income_bcp(bcp_zip, prefix):
    """state_income's 2011-BCP counterpart: per-SA1 income cohorts
    keyed code -> (adults, loMass, hiMass, medIncWeekly,
    (14 adults-band masses), (14 household-band masses), hiqMass),
    cutrec the frame's own incomeCuts record (dollarsYear 2011) —
    same return contract as state_income above, 14 bands wide."""
    import re as _re
    key = f"2011bcp:{prefix}"
    if key in _INC14_SITES:
        return _INC14_SITES[key]
    ad, nonfam = _income_factors()
    v = VINTAGES["2011"]
    memb = v["member"].format
    bands = INC_BANDS14
    nb = len(bands)
    z = zipfile.ZipFile(bcp_zip)
    fam_t, hh_t = memb(table="B26"), memb(table="B28")

    def head_of(member):
        if member not in z.namelist():
            _fail(f"BCP zip lacks {member}")
        with io.TextIOWrapper(z.open(member), encoding="utf-8-sig") \
                as fh:
            return [h.strip() for h in next(csv.reader(fh))]

    h26, h28 = head_of(fam_t), head_of(hh_t)
    negf, negh = "Neg_Nil_inc_Tot", "Negative_Nil_income_Tot"
    neg_types = ("Neg_Nil_inc_cpl_fam_no_child",
                 "Neg_Nil_inc_cpl_fam_wth_chld",
                 "Neg_Nil_inc_One_parent_fam",
                 "Neg_Nil_inc_Other_fam")
    if negf not in h26 or any(c not in h26 for c in neg_types):
        _fail("BCP B26 lacks its Neg_Nil columns")
    if negh not in h28:
        _fail("BCP B28 lacks its Negative_Nil column")
    plan = []
    for lo, hi in bands:
        stem = f"{lo}_{hi if hi is not None else 'more'}"
        hi_tot, fi_tot = f"HI_{stem}_Tot", f"FI_{stem}_Tot"
        if hi_tot not in h28:
            _fail(f"BCP B28 lacks {hi_tot}")
        if fi_tot not in h26:
            _fail(f"BCP B26 lacks {fi_tot}")
        types = []
        for want in (r"cpl_fam_no_child$", r"cpl_fam_(with|wth)_ch",
                     r"One_parent_fam$", r"Other_fam$"):
            c = next((h for h in h26
                      if h.startswith(f"FI_{stem}_")
                      and _re.search(want, h)), None)
            if c is None:
                _fail(f"BCP B26 lacks FI_{stem} {want}")
            types.append(c)
        plan.append((hi_tot, fi_tot, types))
    cols26 = [negf, *neg_types] + [c for p in plan for c in
                                   (p[1], *p[2])]
    cols28 = [negh] + [p[0] for p in plan]
    g26 = _table(z, fam_t, v["key"], cols26, v["rows"], prefix)
    g28 = _table(z, hh_t, v["key"], cols28, v["rows"], prefix)
    if set(g26) != set(g28):
        _fail("BCP B26/B28 SA1 sets diverge")
    # col order: r28 = (neg, HI band Tots x14); r26 = (neg Tot, 4 neg
    # types, then per band (FI Tot, 4 family-type counts))
    rows = {}
    for code in g26:
        r28, r26 = g28[code], g26[code]
        hh = tuple(int(r28[i + 1]) + (int(r28[0]) if i == 0 else 0)
                   for i in range(nb))
        fi = tuple(int(r26[5 + i * 5]) + (int(r26[0]) if i == 0 else 0)
                   for i in range(nb))
        mix = tuple(tuple(int(r26[6 + i * 5 + k]) +
                          (int(r26[1 + k]) if i == 0 else 0)
                          for k in range(4)) for i in range(nb))
        rows[code] = (hh, fi, mix)
    nat = {"b": [0.0] * nb, "fi": [0.0] * nb,
           "mix": [[0.0] * 4 for _ in range(nb)]}
    for hh, fi, mix in rows.values():
        for i in range(nb):
            nat["b"][i] += hh[i]
            nat["fi"][i] += fi[i]
            for k in range(4):
                nat["mix"][i][k] += mix[i][k]
    nat_famper, nat_fams = [], []
    for i in range(nb):
        if sum(nat["mix"][i]) <= 0 or nat["b"][i] <= 0:
            _fail(f"state {prefix}: 2011 income band {bands[i]} "
                  "empty universe mix")
        nat_famper.append(sum(m * a for m, a in zip(nat["mix"][i], ad))
                          / sum(nat["mix"][i]))
        nat_fams.append(min(1.0, nat["fi"][i] / nat["b"][i]))
    nat_adults = [nat["b"][i] * (nat_fams[i] * nat_famper[i]
                                 + (1 - nat_fams[i]) * nonfam)
                  for i in range(nb)]
    nat_tot = sum(nat_adults)
    cum, cut = 0.0, None
    for i, (lo, hi) in enumerate(bands):
        cum += nat_adults[i] / nat_tot
        if cum >= _INC_LO_Q:
            prev = cum - nat_adults[i] / nat_tot
            f = (_INC_LO_Q - prev) / (nat_adults[i] / nat_tot)
            if hi is None:
                _fail(f"state {prefix}: 2011 income 25% cut lands "
                      "the open band")
            cut = lo + f * (hi - lo + 1)
            break
    gloQ = _INC14_CUT_GUARDS.get(prefix)
    if cut is None or (gloQ is not None
                       and not gloQ[0] <= cut <= gloQ[1]):
        _fail(f"state {prefix}: 2011 income 25% cut {cut} outside "
              f"guard {gloQ}")
    cum, cut75 = 0.0, None
    for i, (lo, hi) in enumerate(bands):
        cum += nat_adults[i] / nat_tot
        if cum >= _INC_HI_Q:
            prev = cum - nat_adults[i] / nat_tot
            f = (_INC_HI_Q - prev) / (nat_adults[i] / nat_tot)
            if hi is None:
                _fail(f"state {prefix}: 2011 income 75% cut lands "
                      "the open band")
            cut75 = lo + f * (hi - lo + 1)
            break
    guq = _INC14_HIQ_GUARDS.get(prefix)
    if cut75 is None or (guq is not None
                         and not guq[0] <= cut75 <= guq[1]):
        _fail(f"state {prefix}: 2011 income 75% cut {cut75} outside "
              f"guard {guq}")
    hi_share = nat_adults[-1] / nat_tot
    gsh = _INC14_HI_SHARE_GUARDS.get(prefix, (0.03, 0.06))
    if not gsh[0] <= hi_share <= gsh[1]:
        _fail(f"state {prefix}: 2011 income top-band share "
              f"{hi_share:.4f} outside guard {gsh}")

    out = {}
    for code, (hh, fi, mix) in rows.items():
        bands_ad = []
        for i in range(nb):
            mixn = sum(mix[i])
            famper = (sum(m * a for m, a in zip(mix[i], ad)) / mixn
                      if mixn > 0 else nat_famper[i])
            fams = min(1.0, fi[i] / hh[i]) if hh[i] > 0 else \
                nat_fams[i]
            bands_ad.append(hh[i] * (fams * famper
                                     + (1 - fams) * nonfam))

        def below(cutv):
            mass = 0.0
            for j, (lo, hi) in enumerate(bands):
                if cutv <= lo:
                    break
                if hi is not None and cutv > hi:
                    mass += bands_ad[j]
                    continue
                mass += bands_ad[j] * (cutv - lo) / (hi - lo + 1)
                break
            return mass

        tsum = sum(bands_ad)
        tot = sum(hh)
        med = None
        if tot > 0:
            half = tot / 2
            acc = 0.0
            for j, (lo, hi) in enumerate(bands):
                if acc + hh[j] >= half:
                    if hi is not None and hh[j] > 0:
                        med = int(round(lo + (hi - lo + 1)
                                        * (half - acc) / hh[j]))
                    break
                acc += hh[j]
        out[code] = (tsum, below(cut), bands_ad[-1], med,
                     tuple(bands_ad), tuple(hh), tsum - below(cut75))
    cutrec = {"loQuantile": _INC_LO_Q, "loCutWeekly": round(cut, 2),
              "hiQuantile": _INC_HI_Q, "hiQCutWeekly": round(cut75, 2),
              "hiEdgeWeekly": _INC_HIGH_EDGE,
              "hiNationalShare": round(hi_share, 6),
              "dollarsYear": 2011}
    _INC14_SITES[key] = (out, cutrec)
    print(f"BCP income cells: {len(out)} SA1s (prefix {prefix}, "
          f"2011, cut {cut:.0f}, cut75 {cut75:.0f}, hi-top "
          f"{hi_share:.4f})")
    return _INC14_SITES[key]
