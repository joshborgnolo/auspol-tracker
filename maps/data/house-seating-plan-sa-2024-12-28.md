# Seating plan — House of Assembly chamber, 47th Parliament of South Australia

From the Parliament of South Australia's interactive chamber map ([chamber-maps.parliament.sa.gov.au](https://chamber-maps.parliament.sa.gov.au/psa1/#floor_2020111280982479), floor 2020111280982479 — 'House of Assembly'), as preserved by the Internet Archive on **28 December 2024** (capture [20241228133435](https://web.archive.org/web/20241228133435/https://chamber-maps.parliament.sa.gov.au/_engine/AjaxAction.aspx) of the floor's staffmap data feed; the [floor artwork](https://web.archive.org/web/20241228133437/https://chamber-maps.parliament.sa.gov.au/psa1/images/HOA%20Chamber%20Map%20Final%20-%20v2.png) from the same crawl). Source files committed in `.build/map/src/sa-hoa-2024-12-28/`; machine-readable form `house-seating-plan-sa-2024-12-28.json` (same folder), written by `.build/map/build_sa22_seating.py`.

**Capture date.** The floor's seat assignments are served to the app live by an HTTP POST, which web crawlers do not record — the page's own captures (including the much-linked Wayback capture of 20 October 2022) hold only the app shell. The floor itself was crawled twice, late in the term: the Legislative Council floor on 25 September 2024 and this House of Assembly floor on **28 December 2024**. That capture is the only archived version of the floor, so it is the one filed here; it is not a plan printed soon after the 19 March 2022 election. Employee records on the floor are stamped with their creation date, and every desk whose occupant never changed still carries the record filed on 25 March/1 April 2022 — the benches the new parliament took at its first sittings.

**Changes between election day and the capture**, all dated by the floor's own records:
- **Bragg** — Jack Batty (LIB) now sits at the desk: won the 21 May 2022 by-election after Vickie Chapman (LIB) resigned 4 May 2022.
- **Dunstan** — Cressida O'Hanlon (ALP) now sits at the desk: won the 23 March 2024 by-election after Steven Marshall (LIB) resigned.
- **Black** — Alex Dighton (ALP) now sits at the desk: won the 16 November 2024 by-election after David Speirs (LIB) resigned.
- **Speaker** — Dan Cregan (Kavel, IND), elected Speaker on 13 October 2021 and re-elected when the new parliament first sat in May 2022, stood down on 11 April 2024 to join the ministry. Leon Bignell (Mawson, ALP) took the chair, and the plan shows him there (desk T1); Cregan sits at desk C1. On this repo's sa22 view, which shows the election-night members, Cregan appears in the chair and Bignell in a government-side seat near it (seating.mjs LATER_SPEAKER, the 2010 Slipper precedent); desk C1 is left empty.

The sa22 view as filed therefore shows 44 of 47 members at the desks they took in April 2022, Bragg/Dunstan/Black at their successors' desks (Dunstan and Black's successors — both Labor gains — sit in the government column, so those two divisions appear there rather than on their party's side), Bignell moved from the chair to a government-side seat, and C1 empty.

**Orientation.** The chamber is drawn with the Speaker's chair at the top (the printed label centred at (894, 120) of the 1375×1226 floor — the origin of the json's coordinates), the Clerk and Chairman of Committees below it, then two columns of desks running down the page: the government's (Labor) down the middle-left, the opposition's (Liberal) down the right, the crossbench's country members off the opposition's foot, and desk T1 — the Speaker's own — at the head. Desks are lettered in rows A–T.

**Seat order below:** the floor's own desk letters grouped in rows 1–8 from the Speaker end, each row's seats ordered from the Speaker end (the printed rows, left column first). Parties are as at the capture.

## Row 1

1.1 **Peter Malinauskas** (Croydon, ALP) — desk A1
1.2 **Vincent Tarzia** (Hartley, LIB) — desk F1
1.3 **Susan Close** (Port Adelaide, ALP) — desk A2
1.4 **Josh Teague** (Heysen, LIB) — desk F2
1.5 **Tom Koutsantonis** (West Torrens, ALP) — desk A3
1.6 **Stephen Mullighan** (Lee, ALP) — desk A4
1.7 **Ashton Hurn** (Schubert, LIB) — desk F4

## Row 2

2.1 **Zoe Bettison** (Ramsay, ALP) — desk B1
2.2 **Jack Batty** (Bragg, LIB) — desk E1
2.3 **Chris Picton** (Kaurna, ALP) — desk B2
2.4 **Stephen Patterson** (Morphett, LIB) — desk E2
2.5 **Katrine Hildyard** (Reynell, ALP) — desk B3
2.6 **Nat Cook** (Hurtle Vale, ALP) — desk B4
2.7 **John Gardner** (Morialta, LIB) — desk E4

## Row 3

3.1 **Lucy Hood** (Adelaide, ALP) — desk K1
3.2 **Lee Odenwalder** (Elizabeth, ALP) — desk G1
3.3 **Sarah Andrews** (Gibson, ALP) — desk K2
3.4 **Cressida O'Hanlon** (Dunstan, ALP) — desk G2
3.5 **Rhiannon Pearce** (King, ALP) — desk G3
3.6 **Erin Thompson** (Davenport, ALP) — desk K3
3.7 **Tim Whetstone** (Chaffey, LIB) — desk I1
3.8 **Sam Telfer** (Flinders, LIB) — desk I3

## Row 4

4.1 **David Pisoni** (Unley, LIB) — desk J1
4.2 **Matt Cowdrey** (Colton, LIB) — desk J2
4.3 **Penny Pratt** (Frome, LIB) — desk J3
4.4 **Jayne Stinson** (Badcoe, ALP) — desk H1
4.5 **Blair Boyer** (Wright, ALP) — desk H2
4.6 **Andrea Michaels** (Enfield, ALP) — desk H3

## Row 5

5.1 **David Basham** (Finniss, LIB) — desk Q1
5.2 **Adrian Pederick** (Hammond, LIB) — desk Q3
5.3 **Catherine Hutchesson** (Waite, ALP) — desk L1
5.4 **Nadia Clancy** (Elder, ALP) — desk L2
5.5 **Olivia Savvas** (Newland, ALP) — desk L3

## Row 6

6.1 **Fraser Ellis** (Narungga, IND) — desk R1 *(crossbench)*
6.2 **Dana Wortley** (Torrens, ALP) — desk M3
6.3 **Alex Dighton** (Black, ALP) — desk M2
6.4 **Nick McBride** (MacKillop, LIB) — desk R2
6.5 **Michael Brown** (Florey, ALP) — desk M1

## Row 7

7.1 **Joe Szakacs** (Cheltenham, ALP) — desk C4
7.2 **Nick Champion** (Taylor, ALP) — desk C3
7.3 **Dan Cregan** (Kavel, IND) — desk C1 *(crossbench)*

## Row 8

8.1 **Leon Bignell** (Mawson, ALP) — desk T1 *(chair — the Speaker)*
8.2 **John Fulbrook** (Playford, ALP) — desk N3
8.3 **Troy Bell** (Mount Gambier, IND) — desk O2 *(crossbench)*
8.4 **Eddie Hughes** (Giles, ALP) — desk N2
8.5 **Tony Piccolo** (Light, ALP) — desk N1
8.6 **Geoff Brock** (Stuart, IND) — desk O3 *(crossbench)*

**Counts at the capture:** ALP 29, LIB 14, IND 4 (47). Labor won 27 seats at the election and gained Dunstan and Black at by-elections; the Liberals won 16 and hold 14 at the capture; the four independents are unchanged.
