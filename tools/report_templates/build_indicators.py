"""Build indicators.json from the Monitoring framework table (TOP-07.S05) of the manual workbook.

One source: the indicators of the reports and the Tool dashboard are the rows of that table.
IDs are kept stable: a row keeps its ID as long as its Goal + Indicator text matches indicators.json;
new rows get the next free ID; rows removed from the manual are reported, not silently dropped.

Run:  python build_indicators.py
"""
import json, re, sys
from pathlib import Path
import openpyxl

HERE = Path(__file__).resolve().parent
XLSX = HERE.parent / "manual_builder" / "data" / "VTS_manual_content.xlsx"
OUT = HERE / "indicators.json"
UNIT = [(r"\(%\)", "%"), (r"\(in\)", "in"), (r"\(mg/L\)", "mg/L"), (r"\(yes / no\)", "yes / no"), (r"\(class\)", "class")]


def read_framework():
    wb = openpyxl.load_workbook(XLSX, read_only=True)
    ws = wb["Topic_Sections"]
    h = [c.value for c in next(ws.iter_rows(max_row=1))]
    for r in ws.iter_rows(min_row=2, values_only=True):
        d = dict(zip(h, r))
        if d["Key"] == "TOP-07.S05":
            lines = [l for l in d["Table data"].splitlines() if l.strip().startswith("|")]
            cells = lambda l: [c.strip() for c in l.strip().strip("|").split("|")]
            head = cells(lines[0])
            return [dict(zip(head, cells(l))) for l in lines[2:]]
    sys.exit("TOP-07.S05 not found in the workbook")


def main():
    rows = read_framework()
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    by_text = {(i["goal"], i["indicator"]): i["id"] for i in old}
    used = {i["id"] for i in old}
    nxt = max([int(i[4:]) for i in used] + [0]) + 1
    out = []
    for r in rows:
        key = (r["Goal"], r["Indicator"])
        iid = by_text.get(key)
        if not iid:
            iid = f"IND-{nxt:02d}"; nxt += 1
        unit = next((u for pat, u in UNIT if re.search(pat, r["Indicator"])), None)
        out.append({"id": iid, "goal": r["Goal"], "indicator": r["Indicator"], "method": r["Method"],
                    "frequency": r["When"], "unit": unit, "recorded_in": r["Recorded in"]})
    gone = [i for i in old if (i["goal"], i["indicator"]) not in {(o["goal"], o["indicator"]) for o in out}]
    for g in gone:
        print(f"WARNING: {g['id']} is no longer in TOP-07.S05 ({g['indicator']}). Check sample_data.json and the templates.")
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(out)} indicators -> {OUT.name}")


if __name__ == "__main__":
    main()
