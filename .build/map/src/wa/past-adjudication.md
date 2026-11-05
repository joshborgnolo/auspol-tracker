# WA redistribution adjudication for /map/ past lanes (wa13→wa17, wa17→wa21, wa21→wa25)

Authoritative source preferred by the convention (sentenced Vic-style): the
redistribution commissioners' notional estimates — Antony Green's Parliamentary
Library analyses (WA2023_RedistributionForPrint_FINAL.pdf and the 2019
edition) are WAF-walled (`parliament.wa.gov.au` answers an Azure WAF JS
challenge) — so the adjudication was derived locally and cross-checked by
polygon-centroid overlap between consecutive ABS SED editions:

- SED_2016 (2007-era, "Alfred Cove" set) ↔ SED_2017 (2015 redistribution)
- SED_2017 ↔ SED_2021 (2019 redistribution)
- SED_2021 ↔ SED_2025 (2023 redistribution)

plus the EIS roster name diffs per election. Elected-member records for
2001-2013 live in the flow mirror (.build/state-flow-src/wa/sg<yyyy>).

## wa17 past join (against the 2013 election, 2007 boundaries)

Names shared: 54 of 59 join cleanly by name.

Remaps decided:

  NEW 2017         FORMER 2013    basis
  Bicton           Alfred Cove    2015 redistribution rename (well documented);
                                  centroid-overlap pin ambiguous (new Bicton
                                  gains from old Fremantle; old Alfred Cove's
                                  centroid sits on its own successor's edge) —
                                  record adjudicates.
  Burns Beach      Ocean Reef     centroid maps Ocean Reef → Burns Beach
                                  (and back).

Created (empty h, zeroed candidate swings, null tpp swing):
  Baldivis, Roe, Thornlie
Abolished (votes count into state aggregates only):
  Eyre, Gosnells, Wagin
  (Eyre's remnant body forms the new Roe; Gosnells → Southern River.)

## wa21 past join (against the 2017 election)

  NEW 2021         FORMER 2017    basis
  Landsdale        Girrawheen     centroid maps Girrawheen → Landsdale and
                                  Landsdale → Girrawheen (reciprocal).

Created: none. Abolished: none beyond the rename target.

## wa25 past join (against the 2021 election)

  NEW 2025         FORMER 2021    basis
  Secret Harbour   Warnbro        centroid maps Warnbro → Secret Harbour.

Created (empty h, zeroed swings): Bibra Lake (over Willagee's end),
Mindarie (over Burns Beach's), Oakford (new South-East-Perth seat),
Girrawheen (reforms over Mirrabooka's end), Mid-West (formed from Moore +
North West Central, whose centroids both land inside its fence — NB the
2023 redistribution created the Mid West name itself; the 2021-era map has
NO Mid West district, so no rename semantics attach).

Abolished (aggregates only): Burns Beach, Mirrabooka, Moore,
North West Central, Willagee.

Caution recovered mid-build: LGATE's "current" (2025-era) layer carries a
couple of stray non-election name rows (LC-region remindings like 'MID
WEST'); the EIS roster showed the 2021 election had no such district —
always adjudicate against the EIS roster, never the GIS row list.
