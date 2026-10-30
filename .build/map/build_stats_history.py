#!/usr/bin/env python3
"""Build 1993/1998 map results directly from the committed AEC statistics packs.

Approximate later-venue matches are applied from the audited location store;
no census figures are imputed. 1993 has only
division-level DOP counts beyond first preferences; its HTPPBYPP contains
informal votes only. Missing cells stay null. First preferences are compared
with HCANDS/DIVS; exact 1993 source discrepancies are pinned below. Flows
are withheld where those files disagree. Senate ticket/candidate sums are checked
against the pack's separate ZZ formal/informal/total records at every place.
Run: python3 .build/map/build_stats_history.py
Then: node .build/map/handbook_geo.mjs
"""
import collections as C
import csv
import gzip
import hashlib
import json
from pathlib import Path
import re
import build_map_data as common
from historical_booth_locations import apply_locations

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / '.build/aec-flow-src'
OUT = ROOT / 'map/data'
DECL = {'ABSENT': 'abs', 'PRE POLL': 'pre', 'POSTAL': 'post', 'PROVISIONAL': 'prov'}
BASE = dict(zip(['ACT', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT'], range(100, 900, 100)))
FAMS = ['alp', 'lnp', 'grn', 'onp', 'ind', 'oth']


def rows(name):
    p = SRC / name
    with (gzip.open(p, 'rt', encoding='utf-8-sig') if name.endswith('.gz') else p.open(encoding='utf-8-sig')) as f:
        return list(csv.DictReader(f, delimiter=';'))


def integer(s):
    return int(s) if s not in ('', None) else 0


def norm(s):
    return re.sub('[^a-z0-9]', '', s.lower())


def write(name, obj):
    (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n')


def build(year):
    raw = rows(f'divs-{year}.txt')
    assert len(raw) == {1993: 147, 1998: 148}[year]
    byname = {r['Division']: r for r in raw}
    ids = {}
    for st, base in BASE.items():
        for i, n in enumerate(sorted(n for n, r in byname.items() if r['State'] == st), 1):
            ids[n] = base + i
    candidates = C.defaultdict(list)
    for r in rows(f'hcands-{year}.txt'):
        if int(r['Ballot Position']) < 900:
            candidates[r['Division']].append(r)
    for n, cs in candidates.items():
        cs.sort(key=lambda r: int(r['Ballot Position']))
        assert [int(c['Ballot Position']) for c in cs] == list(range(1, len(cs) + 1))
        assert sum(integer(c['Vote']) for c in cs) == integer(byname[n]['Formal Vote'])
        assert sum(c['Member'] == '#' for c in cs) == 1

    # (division, place) -> count -> ballot position -> source row.
    counts = C.defaultdict(lambda: C.defaultdict(dict))
    for r in rows(f'dop-{year}.csv.gz'):
        key = (r['Division'], r['Polling Place'])
        k, bp = int(r['Count']), int(r['Ballot Position'])
        if bp in counts[key][k]:
            # The 1993 print reuses hospital-team names. Preserve every
            # vote under the printed place name; do not invent venues.
            assert year == 1993 and k == 1 and 'Hospital' in key[1], (year, key, k, bp)
            counts[key][k][bp]['Vote'] = str(integer(counts[key][k][bp]['Vote']) + integer(r['Vote']))
        else:
            counts[key][k][bp] = r
    sums = C.defaultdict(C.Counter)
    types = C.defaultdict(C.Counter)
    for (n, pp), ck in counts.items():
        if pp == 'DIVISION SUMMARY':
            continue
        for bp, r in ck[1].items():
            sums[n][bp] += integer(r['Vote'])
            types[n][DECL.get(pp, 'ord')] += integer(r['Vote'])
    discrepancies = sorted((n, int(c['Ballot Position']), sums[n][int(c['Ballot Position'])], integer(c['Vote']))
                           for n, cs in candidates.items() for c in cs if sums[n][int(c['Ballot Position'])] != integer(c['Vote']))
    if year == 1998:
        assert not discrepancies, discrepancies
    else:
        # 1993's DOP figures differ from HCANDS. Keep certified
        # division totals and the printed booth figures; never allocate the
        # difference to an invented polling place or alter a candidate count.
        assert hashlib.sha256(json.dumps(discrepancies, separators=(',', ':')).encode()).hexdigest() == '3f83d4685cb2c13e001df42313d00131004000fdb201bda5776a360a2f203a17', discrepancies
    for n in candidates:
        assert sum(types[n].values()) == sum(sums[n].values())
    # The independently packed first-preference lane must reproduce every cell.
    fpv = C.Counter()
    for r in rows(f'booth/fpv/{year}.csv.gz'):
        fpv[r['Division'], r['Polling Place'], int(r['Ballot Position'])] += integer(r['Vote'])
    for (n, pp, bp), v in fpv.items():
        assert v == integer(counts[n, pp][1][bp]['Vote'])

    count_discrepancies = []
    def final(n, ck, pair=None):
        last = ck[max(ck)]
        if pair is None:
            pair = sorted(sorted(last, key=lambda bp: -integer(last[bp]['Vote']))[:2])
        flow = C.defaultdict(C.Counter)
        for k in sorted(ck)[1:]:
            cr = ck[k]
            exited = [bp for bp, r in cr.items() if r['Candidate Status'] == 'X']
            assert len(exited) == 1, (year, n, k, exited)
            x = exited[0]
            before = ck[sorted(ck)[sorted(ck).index(k) - 1]]
            distributed = sum(integer(r['Vote Distributed']) for bp, r in cr.items() if bp != x)
            exhausted = sum(integer(r['Exhausted Transfer']) for r in cr.values())
            if integer(before[x]['Vote']) != distributed + exhausted:
                assert year == 1993, (year, n, k, 'exclusion')
                count_discrepancies.append([n, k, 'exclusion', integer(before[x]['Vote']), distributed + exhausted])
            for dest in pair:
                if dest != x:
                    flow[x][dest] += integer(cr.get(dest, {}).get('Vote Distributed'))
        tcp = [integer(ck[1][bp]['Vote']) + sum(f[bp] for f in flow.values()) for bp in pair]
        printed = [integer(last.get(bp, {}).get('Vote')) for bp in pair]
        if tcp != printed:
            assert year == 1993, (year, n, 'final piles', tcp, printed)
            count_discrepancies.append([n, 'final', tcp, printed])
            return pair, printed, []  # no fabricated balancing transfers
        return pair, tcp, [[bp - 1, f[pair[0]], f[pair[1]]] for bp, f in sorted(flow.items()) if any(f.values())]

    history = common.build_history()
    D, index, pairs = [], {}, {}
    party_names = {}
    for line in (SRC / 'party-codes-1993-1998.txt').read_text(encoding='cp1252').splitlines():
        cells = line.split('\t')
        if len(cells) >= 2 and cells[0] and cells[1]:
            party_names[cells[0].rstrip('*')] = cells[1]
    previous = json.loads((OUT / 'res-1996.json').read_text()) if year == 1998 else None
    prev_winners = {d['n']: next(c[0] for c in d['c'] if c[6]) for d in previous['divs']} if previous else {}
    classes = json.loads((ROOT / 'data/division-classifications.json').read_text())['elections'].get(str(year), {})
    for n in sorted(ids, key=ids.get):
        r, cs = byname[n], candidates[n]
        pair, tcp, flows = final(n, counts[n, 'DIVISION SUMMARY'])
        if any(x[0] == n for x in discrepancies) or any(x[0] == n for x in count_discrepancies):
            flows = []
        pairs[n] = pair
        winner = int(next(c for c in cs if c['Member'] == '#')['Ballot Position'])
        assert pair[tcp.index(max(tcp))] == winner, (year, n, 'winner')
        crows = []
        for c in cs:
            surname, _, given = c['Candidate'].partition(', ')
            name = common.title_name(given, surname)
            crows.append([name, c['Party'] or 'IND', party_names.get(c['Party'], c['Party']) or 'Independent', common.bucket(c['Party']), integer(c['Vote']), common.fnum(c['Swing']), int(c['Member'] == '#'), int(prev_winners.get(n) == name) if previous else None])
        a, co = integer(r['ALP TPP Vote']), integer(r['Coalition TPP Vote'])
        # Newcastle 1998 has no ALP/Coalition count: neither zero nor 50%.
        assert not (a + co) or a + co + integer(r['TPP Exhausted']) == integer(r['Formal Vote'])
        index[n] = len(D)
        D.append({'id': ids[n], 'n': n, 'st': r['State'], 'cls': classes.get(n, {}).get('classification'),
                  'c': crows, 'inf': integer(r['Informal Vote']), 'vt': {**types[n], 'ppvc': 0},
                  'tcp': [[pair[i] - 1, tcp[i]] for i in range(2)], 'fl': flows,
                  'tpp': [a, co, common.fnum(r['ALP Swing'])] if a + co else None,
                  'seifa': {}, 'h': history.get(n, [])})

    places = {n: sorted(pp for nn, pp in counts if nn == n and pp not in DECL and pp != 'DIVISION SUMMARY') for n in ids}
    pids = {(n, pp): ids[n] * 10000 + i for n in ids for i, pp in enumerate(places[n], 1)}
    htpp = rows(f'htpp-{year}.txt')
    ht = {}
    for r in htpp:
        n, pp = r['Division'], r['Polling Place']
        if pp not in DECL:
            matches = [p for p in places[n] if p == pp] or [p for p in places[n] if norm(p).startswith(norm(pp))]
            if not matches and not any(integer(r.get(k)) for k in ['ALP TPP Vote', 'Coalition TPP Vote', 'Informal Vote', 'TPP Exhausted']):
                continue
            assert len(matches) == 1, (year, n, pp, matches)
            pp = matches[0]
        if (n, pp) in ht:
            assert year == 1993 and 'Hospital' in pp, (year, n, pp)
            ht[n, pp]['Informal Vote'] = str(integer(ht[n, pp]['Informal Vote']) + integer(r['Informal Vote']))
        else:
            ht[n, pp] = r
    informal_differences = []
    if htpp:
        for n, r in byname.items():
            for col in (['ALP TPP Vote', 'Coalition TPP Vote', 'Informal Vote'] if year == 1998 else ['Informal Vote']):
                got = sum(integer(t[col]) for (nn, pp), t in ht.items() if nn == n)
                if year == 1998 and n == 'Newcastle' and col == 'Informal Vote':
                    assert got == 0 and year == 1998  # absent from the TPP product
                elif year == 1998 and n == 'Reid' and col == 'Informal Vote':
                    assert (got, integer(r[col])) == (5465, 5468) and year == 1998
                elif year == 1993 and got != integer(r[col]):
                    informal_differences.append([n, got, integer(r[col])])
                else:
                    assert got == integer(r[col]), (year, n, col)
    if year == 1993:
        assert hashlib.sha256(json.dumps(sorted(informal_differences), separators=(',', ':')).encode()).hexdigest() == '553c9fe55044c052ca33943c2eb0e0106c43e118b34aaff11ab357ddcf44a59e'
    B = {k: [] for k in ['d', 'id', 'n', 'ty', 'prem', 'sub', 'pc', 'lat', 'lon', 'v', 'inf', 'tpp', 'tcp', 'fl', 'dec', 'vdec']}
    for n in sorted(ids, key=ids.get):
        for pp in places[n]:
            ck = counts[n, pp]
            votes = [integer(ck[1][bp]['Vote']) for bp in range(1, len(candidates[n]) + 1)]
            t = ht.get((n, pp))
            a, co = (integer(t.get('ALP TPP Vote')), integer(t.get('Coalition TPP Vote'))) if t else (0, 0)
            if t and a + co:
                assert a + co + integer(t['TPP Exhausted']) == sum(votes), (year, n, pp, 'booth formal')
            tcp = flows = None
            if year == 1998:
                _, tcp, flows = final(n, ck, pairs[n])
            b = dict(d=index[n], id=pids[n, pp], n=pp, ty=2 if 'Hospital' in pp else 3 if 'Mobile' in pp else 1,
                     prem='', sub='', pc='', lat=None, lon=None, v=votes,
                     inf=integer(t['Informal Vote']) if t else None,
                     tpp=[a, co, common.fnum(t['ALP Swing'])] if a + co else None,
                     tcp=tcp, fl=flows, dec=None, vdec=None)
            for k in B:
                B[k].append(b[k])
    A = {}
    for st in ['AUS'] + common.STATES:
        ds = [d for d in D if st == 'AUS' or d['st'] == st]
        prim, seats = C.Counter(), C.Counter()
        for d in ds:
            for c in d['c']:
                prim[c[3]] += c[4]
                if c[6]:
                    seats[c[1]] += 1
        a = sum(d['tpp'][0] for d in ds if d['tpp'])
        co = sum(d['tpp'][1] for d in ds if d['tpp'])
        prior = previous['agg'][st] if previous else None
        sw = 100 * a / (a + co) - 100 * prior['tpp'][0] / sum(prior['tpp'][:2]) if prior else None
        A[st] = dict(prim={f: prim[f] for f in FAMS}, pprim=prior['prim'] if prior else None,
                     formal=sum(prim.values()), pformal=prior['formal'] if prior else None,
                     inf=sum(d['inf'] for d in ds), tpp=[a, co, round(sw, 2) if sw is not None else None], seats=dict(seats))
    doc = dict(year=year, event=None, date={1993:'1993-03-13', 1998:'1998-10-03'}[year], prev={1993:1990, 1998:1996}[year],
               speaker={1993:'Cunningham', 1998:'Wakefield'}[year], agg=A, divs=D, booths=B,
               seifaCuts={k:None for k in ['irsad','irsd','ier','ieo']}, demoBasis=None, incomeCuts=None, cobKeys=None,
               coverage={'boothCoordinates':False, 'boothInformal':True, 'boothPreferences':year == 1998,
                         'firstPreferenceDifferences': discrepancies, 'countDiscrepancies':count_discrepancies,
                         'informalDifferences': informal_differences,
                         'note':'Polling-place names and votes are from the AEC statistics pack. Historical venue coordinates are unavailable in this source; these polling places are not plotted. Census figures are unavailable.'})
    apply_locations(doc)
    write(f'data-{year}.json', doc)
    senate(year, byname, pids)
    print(year, len(D), 'divisions;', len(pids), 'polling places;', A['AUS']['seats'])


def senate(year, divs, pids):
    candidates = {(r['State'], r['Ticket'], int(r['Ballot Position'])):r for r in rows(f'scands-{year}.txt')}
    group = {}
    for (st, ticket, bp), r in candidates.items():
        group[st, ticket] = r['Group'] or r['Party'] or 'IND'
    sums, zz = C.defaultdict(lambda:[0]*7), C.defaultdict(dict)
    for r in rows(f'sppvote-{year}.csv.gz'):
        n, pp, t, bp, v = r['Division'], r['Polling Place'], r['Ticket'], int(r['Ballot Position']), integer(r['Vote'])
        if pp in ('Division Summary', 'Adj'):
            continue
        if t == 'ZZ':
            assert bp not in zz[n, pp]
            zz[n, pp][bp] = v
            continue
        st = divs[n]['State']
        assert bp == 0 or (st, t, bp) in candidates, (year, st, t, bp)
        ab = group[st, t] if bp == 0 else candidates[st, t, bp]['Party']
        # The official code table names JPI as Janet Powell Independents'
        # Network; HAR is Brian Harradine's independent Senate group.
        fam = 'ind' if ab == 'JPI' else 'lnp' if ab == 'LPNP' else common.bucket(ab)
        sums[n, pp][0] += v
        sums[n, pp][1 + FAMS.index(fam)] += v
    for k, z in zz.items():
        assert z[998] + z[999] == z[1000] and sums[k][0] == z[998], (year, k, z, sums[k])
    assert set(sums) == set(zz)
    D, B = C.defaultdict(lambda:[0]*7), {}
    for (n, pp), v in sums.items():
        D[n] = [a+b for a,b in zip(D[n], v)]
        pid = pids.get((n, pp))
        if pid is not None:
            B[str(pid)] = v
    assert set(D) == set(divs)
    write(f'senate-vote-{year}.json', dict(year=year, fams=FAMS, divs=D, booths=B))


if __name__ == '__main__':
    for year in [1993, 1998]:
        build(year)
    history = common.build_history()
    for year in common.YEARS:
        target = OUT / f'res-{year}.json'
        doc = json.loads(target.read_text())
        for d in doc['divs']:
            d['h'] = history.get(d['n'], [])
        write(target.name, doc)
