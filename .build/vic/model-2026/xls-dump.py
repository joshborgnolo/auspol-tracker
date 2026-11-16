import sys, json, xlrd
wb = xlrd.open_workbook(sys.argv[1])
out = {}
for sh in wb.sheets():
    rows = []
    for r in range(sh.nrows):
        rows.append([sh.cell_value(r, c) for c in range(sh.ncols)])
    out[sh.name] = rows
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
for k, v in out.items():
    print(k, len(v), "rows")
    for row in v[:12]: print("  ", row)
