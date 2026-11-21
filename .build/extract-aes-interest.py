"""extract-aes-interest.py – recurring AES political attitudes, 1987–2025.

Input: the ADA general release of the AES integrated file 1967–2025, version
1 (2_aes67to25_integrated_general_v1.dta). The licensed respondent file is
not committed; only the weighted response distributions are. Run from root:

    /usr/bin/python3 .build/extract-aes-interest.py <path to the .dta>

Output: data/aes-one-offs.json. Every recurring question retains its full
answer scale. Sample is the unweighted valid-answer count; sampleEff is
Kish's effective sample from the release weight. Missing/skipped and zero-
weight rows are excluded. Waves use the month after polling day, matching
data/trust-government.json; no exact fieldwork dates are fabricated.
"""
import json
import os
import sys

import pandas as pd

WAVE_MONTH = {
    1987: "1987-08", 1990: "1990-04", 1993: "1993-04", 1996: "1996-04",
    1998: "1998-11", 2001: "2001-12", 2004: "2004-11", 2007: "2007-12",
    2010: "2010-09", 2013: "2013-10", 2016: "2016-08", 2019: "2019-06",
    2022: "2022-06", 2025: "2025-06",
}
INTEREST_RESPONSES = ["A good deal", "Some", "Not much", "None at all"]
DEMOCRACY_RESPONSES = ["Very satisfied", "Fairly satisfied", "Not very satisfied", "Not at all satisfied"]
ECONOMY_RESPONSES = ["A lot better", "A little better", "About the same", "A little worse", "A lot worse"]
GOV_FOR_RESPONSES = [
    "Entirely run for the big interests", "Mostly run for the big interests",
    "About half and half", "Mostly run for the benefit of all", "Entirely run for the benefit of all",
]
KNOW_PEOPLE_RESPONSES = [
    "Politicians know what ordinary people think — 1", "Politicians know what ordinary people think — 2",
    "Midpoint — 3", "Politicians don't know what ordinary people think — 4",
    "Politicians don't know what ordinary people think — 5",
]
MEASURES = [
    {
        "id": "political-interest",
        "var": "polintr",
        "first": 1987,
        "question": "Generally speaking, how much interest do you usually have in what's going on in politics?",
        "questionNo": "A1",
        "responses": INTEREST_RESPONSES,
    },
    {
        "id": "campaign-interest",
        "var": "intrelc",
        "first": 1993,
        "question": "And, how much interest would you say you took in the election campaign overall?",
        "questionNo": "A3",
        "responses": INTEREST_RESPONSES,
    },
    {
        "id": "satisfaction-democracy",
        "var": "stfaudem",
        "first": 1996,
        "question": "On the whole, are you very satisfied, fairly satisfied, not very satisfied or not at all satisfied with the way democracy works in Australia?",
        "questionNo": "C4",
        "responses": DEMOCRACY_RESPONSES,
        "trendNote": "The report notes the 1996 top answer was 'Satisfied', rather than the later 'Very satisfied'. ",
    },
    {
        "id": "household-economy-year",
        "var": "fnshhold",
        "first": 1987,
        "question": "How does the financial situation of your household now compare with what it was 12 months ago?",
        "questionNo": "D4a",
        "responses": ECONOMY_RESPONSES,
    },
    {
        "id": "national-economy-year",
        "var": "fnscnt",
        "first": 1987,
        "question": "How do you think the general economic situation in Australia now compares with what it was 12 months ago?",
        "questionNo": "D4b",
        "responses": ECONOMY_RESPONSES,
    },
    {
        "id": "campaign-news-tv",
        "var": "elctv",
        "first": 1987,
        "question": "How much attention did you pay to reports about the election campaign on television?",
        "questionNo": "A2b",
        "responses": INTEREST_RESPONSES,
        "exclusiveToNone": True,
        "trendNote": "In 1987 and 1990, codes naming only other channels are counted as none at all for television. ",
    },
    {
        "id": "campaign-news-radio",
        "var": "elcrd",
        "first": 1987,
        "last": 2022,
        "question": "How much attention did you pay to reports about the election campaign on the radio?",
        "questionNo": "A2c",
        "responses": INTEREST_RESPONSES,
        "exclusiveToNone": True,
        "trendNote": "The integrated release and official report contain no 2025 radio reading; the series ends in 2022. In 1987 and 1990, codes naming only other channels are counted as none at all for radio. ",
    },
    {
        "id": "campaign-news-newspapers",
        "var": "elcnwsp",
        "first": 1987,
        "question": "How much attention did you pay to reports about the election campaign in newspapers?",
        "questionNo": "A2a",
        "responses": INTEREST_RESPONSES,
        "exclusiveToNone": True,
        "trendNote": "In 1987 and 1990, codes naming only other channels are counted as none at all for newspapers. ",
    },
    {
        "id": "campaign-news-internet",
        "var": "elcnet",
        "first": 1998,
        "question": "How much attention did you pay to reports about the election campaign on the internet?",
        "questionNo": "A2d",
        "responses": INTEREST_RESPONSES,
    },
    {
        "id": "government-big-interests",
        "var": "govintr",
        "first": 1998,
        "question": "Would you say the government is run by a few big interests looking out for themselves, or that it is run for the benefit of all the people?",
        "questionNo": "C6",
        "responses": GOV_FOR_RESPONSES,
    },
    {
        "id": "politicians-know-people",
        "var": "fedptknw",
        "first": 2001,
        "question": "Some people say that Federal politicians know what ordinary people think. Others say that Federal politicians don't know what ordinary people think. Where would you place yourself on this scale of 1 to 5?",
        "questionNo": "C8",
        "responses": KNOW_PEOPLE_RESPONSES,
        "trendNote": "The official comparable trend starts in 2001; the integrated file's 1996 and 1998 codes are deliberately not used. ",
    },
]
REPORT = "https://australianelectionstudy.org/wp-content/uploads/Trends-in-Australian-Political-Opinion-1987-2025.pdf"
DATA = "https://doi.org/10.26193/HJ3KT1"


def main(filename):
    columns = ["aeswave", "weight"] + [m["var"] for m in MEASURES]
    df = pd.read_stata(filename, columns=columns, convert_categoricals=False)
    entries = []
    for measure in MEASURES:
        var = measure["var"]
        responses = measure["responses"]
        for year, wave in WAVE_MONTH.items():
            if year < measure["first"] or year > measure.get("last", 2025):
                continue
            answered = df[(df.aeswave == year) & (df[var] > 0) & (df.weight > 0)].copy()
            valid = answered[var].between(1, len(responses))
            if measure.get("exclusiveToNone"):
                valid = valid | answered[var].between(5, 7)
            unexpected = answered.loc[~valid, var].astype(int).unique().tolist()
            if unexpected:
                raise ValueError(f"{var} {year}: unrecognised positive response codes {unexpected}; recheck the coding")
            answered = answered.loc[valid].copy()
            if measure.get("exclusiveToNone"):
                answered[var] = answered[var].where(answered[var] <= 4, 4)
            if len(answered) < 500:
                raise ValueError(f"{var} {year}: only {len(answered)} valid weighted respondents; recheck the coding")
            w = answered.weight
            total = w.sum()
            shares = [round(float(w[answered[var] == code].sum() / total * 100), 1) for code in range(1, len(responses) + 1)]
            weighted = year == 1993 or year >= 2010
            entries.append({
                "id": measure["id"],
                "waveDate": wave,
                "dateStart": None,
                "sample": int(len(answered)),
                "sampleEff": round(float(total ** 2 / (w ** 2).sum()), 1),
                "question": measure["question"],
                "notes": f"The 2025 questionnaire's wording ({measure['questionNo']}); integrated-file variable {var}. "
                         + measure.get("trendNote", "")
                         + ("Weighted to the national electorate; " if weighted else "Unweighted in the integrated release; ")
                         + "shares are of valid answers, with missing, skipped and zero-weight rows excluded. "
                       + "SampleEff is Kish's effective sample from the release weight. Wave dated to the month after polling day.",
                "url": REPORT,
                "tables": [{
                    "title": None,
                    "source": DATA,
                    "rows": [[label, share] for label, share in zip(responses, shares)],
                }],
            })
    out = {
        "_about": "Recurring political attitudes, economic evaluations and campaign-media use from the Australian Election Study's national post-election surveys. "
                  "Political participation, issue batteries and one-off election questions are outside this store.",
        "generated": "2026-11-21",
        "_readme": "Generated by .build/extract-aes-interest.py from the ADA general release of the Australian Election Study integrated file "
                   "1967–2025 v1 (2_aes67to25_integrated_general_v1.dta), whose respondent data is licensed and not committed. "
                   "Question wording is quoted from the 2025 questionnaire (A1/A2/A3/C4/C6/C8/D4). Figures were cross-checked against the AES's official "
                   "Trends in Australian Political Opinion 1987–2025 (November 2025): Interest in the election, p10; Followed election in the mass media, p12; "
                   "Retrospective household and national economic evaluations, pp52–53; Interest in politics, p74; Satisfaction with democracy, p102; "
                   "Who the government is run for, p104; Politicians know what ordinary people think, p107. "
                   "The 1993 and 2010–2025 waves are weighted to the national electorate; 1987/1990 and 1996–2007 are unweighted in this release. "
                   "Percentages are weighted response distributions at one decimal, not reverse-engineered from the report's rounded charts. "
                   "Wave dates use the month after polling day, matching data/trust-government.json's AES convention.",
        "entries": entries,
    }
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "aes-one-offs.json")
    with open(dest, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(entries)} response distributions to {dest}")
    for measure in MEASURES:
        points = [e for e in entries if e["id"] == measure["id"]]
        for e in points[-1:]:
            print(measure["id"], e["waveDate"], e["sample"], e["sampleEff"], e["tables"][0]["rows"])


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
