"""Render the two report templates to HTML and A4 PDF, then run the checks of COWORK 2026-11-19 (Part 3).

Run (conda env "vts"):
    python render_reports.py                       # all sites in sample_data.json, both reports
    python render_reports.py --site S-TW --history # one site; Food Safety Record with the change-history appendix
Output: output/<site>_food_safety_record.(html|pdf) and output/<site>_water_summary.(html|pdf)  (output/ is not committed)
"""
import argparse, json, re, subprocess, sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
import report_model as RM
import build_indicators

HERE = Path(__file__).resolve().parent
XLSX = HERE.parent / "manual_builder" / "data" / "VTS_manual_content.xlsx"
FONTS = (HERE.parent / "manual_builder" / "fonts").resolve().as_uri()
OUT = HERE / "output"


def render(data_path, sites, history):
    from weasyprint import HTML
    data, indicators, items = RM.load(data_path, XLSX)
    env = Environment(loader=FileSystemLoader(HERE), autoescape=select_autoescape(["html"]))
    OUT.mkdir(exist_ok=True); made = []
    for sid in sites or [s["id"] for s in data["sites"]]:
        for name, fn in (("food_safety_record", lambda: RM.food_safety(data, indicators, items, sid, history)),
                         ("water_summary", lambda: RM.water_summary(data, indicators, items, sid))):
            html = env.get_template(f"{name}.html").render(r=fn(), font_dir=FONTS)
            stem = OUT / f"{sid}_{name}"
            stem.with_suffix(".html").write_text(html, encoding="utf-8")
            HTML(string=html, base_url=str(HERE)).write_pdf(str(stem.with_suffix(".pdf")))
            made.append(stem)
            print("written:", stem.with_suffix(".pdf").name)
    return data, indicators, made


def checks(data, indicators, made):
    ok = True
    def report(cond, msg):
        nonlocal ok; ok &= bool(cond); print(("PASS " if cond else "FAIL ") + msg)
    # schema
    try:
        import jsonschema
        jsonschema.validate(data, json.loads((HERE / "data_schema.json").read_text(encoding="utf-8")))
        report(True, "sample_data.json matches data_schema.json")
    except ImportError:
        print("SKIP schema validation (jsonschema not installed)")
    except Exception as e:
        report(False, f"schema: {str(e)[:200]}")
    # check 5: indicator IDs exist in indicators.json and in TOP-07.S05
    fw = {(r["Goal"], r["Indicator"]) for r in build_indicators.read_framework()}
    ids = {i["id"] for i in indicators}
    report(all((i["goal"], i["indicator"]) in fw for i in indicators), "every indicator in indicators.json is a row of TOP-07.S05")
    used = {m["indicator"] for m in data["measurements"]} | {f"IND-{k:02d}" for k in range(1, 11)}
    report(used <= ids, f"every indicator ID used by the data and the reports exists ({len(used)} used)")
    for stem in made:
        html = stem.with_suffix(".html").read_text(encoding="utf-8")
        # check 6: strip values have no decimals; methods labelled; conversion note under each nitrate table
        strip_vals = re.findall(r"<td>([^<]*mg/L NO3-N[^<]*)<br><span class=\"small\">closest color block", html)
        report(all("." not in v for v in strip_vals), f"{stem.name}: {len(strip_vals)} strip values, none with decimals")
        n_tables = len(re.findall(r"<th>Value</th>", html))
        n_notes = html.count("NO3 = NO3-N x 4.43")
        report(n_notes >= n_tables, f"{stem.name}: conversion note present ({n_notes}) for each nitrate table ({n_tables})")
        report(not re.search(r"%\s*removal|removal\s*\(%\)|percent removal", html, re.I), f"{stem.name}: no percent removal")
        if "water_summary" in stem.name:
            site = next(s for s in data["sites"] if stem.name.startswith(s["id"]))
            loc = site.get("location") or {}
            report(not loc or str(loc.get("lat")) not in html, f"{stem.name}: exact location not shown")
            report(site["sharing"].get("show_owner_in_water_summary") or site["project_owner"] not in html, f"{stem.name}: project owner not shown by default")
            report("Methods and limitations" in html, f"{stem.name}: methods page present")
        # check 7 (part): 'Sample data' on every page of the PDF
        if data["meta"].get("sample"):
            try:
                txt = subprocess.run(["pdftotext", "-layout", str(stem.with_suffix(".pdf")), "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout
                pages = [p for p in txt.split("\f") if p.strip()]
                report(pages and all("Sample data" in p or "SAMPLE DATA" in p for p in pages), f"{stem.name}: 'Sample data' on all {len(pages)} pages")
            except FileNotFoundError:
                print("SKIP page check (pdftotext not found)")
    print("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")
    return ok


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(); ap.add_argument("--data", default=str(HERE / "sample_data.json")); ap.add_argument("--site", action="append"); ap.add_argument("--history", action="store_true")
    a = ap.parse_args()
    d, ind, made = render(a.data, a.site, a.history)
    sys.exit(0 if checks(d, ind, made) else 1)
