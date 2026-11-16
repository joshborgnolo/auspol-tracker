# Victorian model inputs, 2026

One-off stores for the Victorian election model (`.build/analysis/seat-model/vic-inputs.mjs`) and the scripts
that made them. None of this runs in CI: the scripts need python3 with `xlrd`, `pdftotext`/`pdftoppm` (poppler)
and, for the OCR fallback, `tesseract`.

## Nominations: `data/vic-candidates-2026.json`

1. Download the VEC's "spreadsheet of all the candidates" (linked from any district's nominations page) to a
   directory **outside the repo**. It carries contact persons' phone numbers and email addresses, which are not kept.
2. `python3 xls-dump.py <candidates.xls> <raw.json>` then `python3 cands-parse.py <raw.json> <candidates-2026.json>`.
3. The store wraps that file's `asAt` and `districts` with its source. Names and parties only.

## Council vote by district: `data/vic-lc-2022-by-district.json`

`python3 extract-lc22.py` reads the committed mirror of the VEC's 2022 region workbooks
(`.build/map/src/vic22/xlc`) and writes the store.

## How-to-vote cards: `data/vic-htv-2026.json` (`htv/`)

Work in a scratch directory `W` holding `candidates-2026.json` from above. The PDFs are 2-3 MB each, about
500 MB in all, and are not kept.

1. Save <https://www.vec.vic.gov.au/voting/2026-state-election/how-to-vote-cards> as `W/web/vec-htv.html`.
2. `python3 htv-list.py W` fetches the register's table for each district; `python3 htv-parse.py W` writes
   `W/htv-register.json` (a copy as listed on 16 November is `htv/register-2026-11-16.json`).
3. `python3 htv-fetch.py W lib,nat` and `python3 htv-fetch.py W alp` download one card per party per district
   into `W/htv-pdf`. One Nation's statewide card is any district's `MEHTVC` row: save it as
   `W/htv-pdf/on__statewide.pdf`.
4. `python3 htv-read.py W` reads every card's numbering against the nominations (the PDF's text layer, with an
   OCR fallback); `python3 htv-on.py W` reads One Nation's statewide card.
5. The Nationals draw their numbers as artwork. Render each (`pdftoppm`) and read it by eye into `EYE` in
   `htv-merge.py`, numbers in ballot order.
6. `python3 htv-merge.py W` writes `W/htv-2026.json` and prints the tally of card directions; the store wraps
   it with its source and the date the register was listed.

Registration ran from 10 to 20 November 2026. The store holds the register as listed on 16 November: re-list
and re-read after the 20th if a card may have changed (no Liberal card had been registered for Williamstown).
The model reads the store through `prepVic` (the six districts whose cards depart from the federal pattern),
and `test-vic-model.mjs` checks every card read is a full order of its district's ballot or an open card.
